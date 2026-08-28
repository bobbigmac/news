// Summarise pipeline (reworked).
//
// Flow:
//   1. Load new stories (raw-new.json) + existing digest + summarised ids.
//   2. Embed all relevant stories locally (Transformers.js, cached by id).
//   3. Cross-source dedup of new stories (cosine sim >= SIM_DEDUP).
//   4. Cluster new stories into event groups (DBSCAN on embeddings).
//   5. Match each group to an existing digest cluster by centroid similarity
//      (stories accumulate into living clusters across runs).
//   6. For each cluster (existing-updated or new), make ONE LLM call to write
//      headline + summary + impact + trigger words. Grouping is already done
//      locally, so the LLM only writes editorial copy — simple and reliable.
//      A failed call degrades only that cluster's text (heuristic fallback).
//   7. Annotate clusters with entities (compromise NER), tags (TF-IDF), and
//      lifecycle fields (active/archive, timeline, story count).
//   8. Persist digest + run-log.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { SYSTEM_PROMPT, buildSummaryPrompt } from './prompts.js';
import { extractJson } from './extract-json.js';
import { embedStories, cosineSim, centroid } from './embeddings.js';
import { dedupStories, clusterEvents, matchToExisting } from './cluster.js';
import { annotateClusters, buildEntityIndex } from './entities.js';
import { computeClusterTags } from './tags.js';
import { enrichStory } from './story-enrich.js';

const CACHE_DIR = 'cache';
const RAW_FILE = join(CACHE_DIR, 'raw-new.json');
const DIGEST_FILE = join(CACHE_DIR, 'digest.json');
const STORY_STORE_FILE = join(CACHE_DIR, 'stories.json');
const SUMMARISED_IDS_FILE = join(CACHE_DIR, 'summarised-ids.json');
const RUN_LOG_FILE = join(CACHE_DIR, 'run-log.json');
const MODEL_REGISTRY_FILE = join(CACHE_DIR, 'model-registry.json');

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 5000;
const MAX_DELAY_MS = 60000;
const INTER_CALL_DELAY_MS = 2000; // pause between LLM calls to avoid rate limiting
const ACTIVE_WINDOW_HOURS = 48;   // a cluster is "active" if updated within this window

// --- Model registry ---
// When openrouter/free gives us a good :free model, we remember it. On
// subsequent calls we try known-good models directly (still free — :free
// suffix means zero cost) instead of gambling on the random router. This
// eliminates the retry-roulette with safety classifier models.
// Falls back to openrouter/free if all known-good models are unavailable.
const MODEL_REGISTRY = loadJson(MODEL_REGISTRY_FILE, { good: [], bad: [] });
function saveModelRegistry() { saveJson(MODEL_REGISTRY_FILE, MODEL_REGISTRY); }
function rememberGoodModel(modelId) {
  if (!modelId || !modelId.endsWith(':free')) return;
  if (!MODEL_REGISTRY.good.includes(modelId)) {
    MODEL_REGISTRY.good.unshift(modelId); // most recent first
    if (MODEL_REGISTRY.good.length > 10) MODEL_REGISTRY.good.pop();
    saveModelRegistry();
  }
}
function rememberBadModel(modelId) {
  if (!modelId) return;
  if (!MODEL_REGISTRY.bad.includes(modelId)) {
    MODEL_REGISTRY.bad.push(modelId);
    if (MODEL_REGISTRY.bad.length > 20) MODEL_REGISTRY.bad.shift();
    saveModelRegistry();
  }
}
function isKnownBad(modelId) {
  return MODEL_REGISTRY.bad.includes(modelId);
}

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const PROVIDERS = [
  // OpenRouter free router: 'openrouter/free' randomly picks from available
  // free models. Some of those models are content-safety classifiers (e.g.
  // nvidia/nemotron-3.5-content-safety:free) that return "User Safety: safe"
  // instead of chat completions, and some wrap JSON in markdown fences. The
  // free router doesn't support excluded_models, so we handle bad-model
  // responses in callLLM by detecting them and retrying (each retry gets a
  // new random model). Override with OPENROUTER_MODEL to pin a specific model.
  { name: 'OpenRouter', keyEnv: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1', model: process.env.OPENROUTER_MODEL || 'openrouter/free', headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'HTTP-Referer': 'https://github.com/bobbigmac/news', 'X-Title': 'News Dashboard' }) },
  { name: 'Featherless', keyEnv: 'FEATHERLESS_API_KEY', baseUrl: 'https://api.featherless.ai/v1', model: process.env.FEATHERLESS_MODEL || 'meta-llama/Llama-3.3-70B-Instruct', headers: (key) => ({ 'Authorization': `Bearer ${key}` }) },
  { name: 'OpenAI', keyEnv: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', headers: (key) => ({ 'Authorization': `Bearer ${key}` }) },
];

const PROVIDER = PROVIDERS.find(p => process.env[p.keyEnv]);
if (!PROVIDER) {
  console.error('No LLM API key found. Set one of: OPENROUTER_API_KEY, FEATHERLESS_API_KEY, OPENAI_API_KEY');
  process.exit(0);
}
const API_KEY = process.env[PROVIDER.keyEnv];
const LLM_BASE = PROVIDER.baseUrl;
const MODEL = PROVIDER.model;

const MIN_STORY_WORDS = 15;
const MAX_CONTENT_CHARS = 800;

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

function saveJson(path, data) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function truncate(text, max) {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return t.substring(0, max).replace(/\s+\S*$/, '') + '...';
}

// Build the compact story object sent to the LLM (text for comprehension)
// and the metadata object stored on the cluster (for the frontend).
function prepareStoryForLLM(story) {
  const title = truncate(story.title, 200);
  const desc = truncate(story.description || '', 400);
  const content = truncate(story.content || '', MAX_CONTENT_CHARS);
  const combined = [title, desc, content].filter(Boolean).join(' — ');
  return {
    id: story.id,
    text: combined,
    // Keep the raw description/content for story enrichment (bodyText).
    description: desc,
    content: content,
    source: story.source || '',
    sourceName: story.sourceName || '',
    url: story.url || '',
    image: story.image || '',
    published: story.published || '',
    category: story.category || 'General',
    originalTitle: story.title,
    plugin: story.plugin || story._plugin || null,
    pluginPriority: story.pluginPriority ?? story._pluginPriority ?? null,
  };
}

function makeStoryData(s) {
  return enrichStory({
    id: s.id,
    title: s.originalTitle || s.title,
    source: s.source || '',
    sourceName: s.sourceName || '',
    url: s.url || '',
    image: s.image || '',
    published: s.published || '',
    category: normaliseCategory(Array.isArray(s.category) ? s.category[0] : (s.category || 'Other')),
    plugin: s.plugin || s._plugin || null,
    pluginPriority: s.pluginPriority ?? s._pluginPriority ?? null,
  });
}

function normaliseCategory(raw) {
  const cat = Array.isArray(raw) ? raw.join(' ') : (raw || 'general');
  const lower = cat.toLowerCase();
  if (/sport|football|cricket|rugby|tennis|olympic/.test(lower)) return 'sports';
  if (/politic|election|government|parliament|minister/.test(lower)) return 'politics';
  if (/business|finance|economy|market|bank|trade/.test(lower)) return 'business';
  if (/tech|ai|software|digital|cyber|internet/.test(lower)) return 'technology';
  if (/health|medical|disease|hospital|drug|vaccine/.test(lower)) return 'health';
  if (/science|space|research|climate|environment/.test(lower)) return 'science';
  if (/entertainment|celebrity|film|music|tv|gaming|game/.test(lower)) return 'entertainment';
  if (/local|regional|wales|scotland|ireland|manchester|london/.test(lower)) return 'regional';
  return 'general';
}

function extractKeywords(text) {
  const stop = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','can','this','that','these','those','it','its','they','them','their','there','here','who','whom','whose','which','what','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','just','don','now','said','says','say','after','before','during','while','about','against','between','into','through','above','below','up','down','out','off','over','under','again','further','then','once','uk','us','mr','mrs','ms']);
  const words = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  return [...new Set(words)];
}

// --- LLM call (with retry/backoff + free-router bad-model handling) ---

// --- Paid-model safeguard ---
// The $10 OpenRouter credit is a daily-limit unlock, NOT spendable budget.
// We must NEVER call paid models. The free router should only pick :free
// models, but if it ever routes to a paid model (bug, config change, etc.)
// we reject the response immediately and retry. We also check the usage
// object for any non-zero cost as a belt-and-braces check.
function isPaidModel(modelId) {
  // Free models on OpenRouter always end with ':free'.
  return !modelId || !modelId.endsWith(':free');
}

function hasCost(usage) {
  if (!usage) return false;
  // OpenRouter returns cost in USD as a number (e.g. 0.0001).
  // Any non-zero cost means we spent real money.
  const cost = typeof usage.cost === 'number' ? usage.cost
    : typeof usage.total_cost === 'number' ? usage.total_cost
    : 0;
  return cost > 0;
}

// Models in the openrouter/free pool that are not chat completion models.
// The free router picks randomly and doesn't support exclusions, so we detect
// these by their output and retry to get a different model.
const BAD_MODEL_PATTERNS = [
  /user safety/i,
  /^safe$/i,
  /^unsafe$/i,
];

// Models known to be non-generative (classifiers, safety models).
const BAD_MODEL_IDS = new Set([
  'nvidia/nemotron-3.5-content-safety:free',
]);

// Some free models wrap JSON in markdown fences despite response_format
// json_object. Strip fences so the parser can handle the content.
function stripMarkdownFences(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

// Parse the single-cluster JSON object returned by buildSummaryPrompt.
// The prompt asks for a flat { headline, summary, category, impact,
// trigger_words } object — not the old { clusters: [...] } wrapper — so we
// parse directly. callLLM already strips markdown fences; we also tolerate
// fences here and fall back to extractJson (which handles truncated/malformed
// JSON) if direct parse fails.
function parseSummaryResponse(text) {
  const cleaned = stripMarkdownFences(text).trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj && obj.headline) return obj;
    // Some models wrap in a clusters array despite the prompt
    if (obj && obj.clusters && obj.clusters[0]?.headline) return obj.clusters[0];
  } catch { /* fall through to extractJson */ }
  const recovered = extractJson(text);
  if (recovered && recovered.clusters && recovered.clusters[0]?.headline) {
    return recovered.clusters[0];
  }
  return null;
}

// Build the list of models to try for a single LLM call.
// Known-good :free models first (direct calls, still zero cost), then
// openrouter/free as a fallback to discover new good models.
function buildModelQueue() {
  const queue = [];
  // Only use known-good models for OpenRouter free router
  if (PROVIDER.name === 'OpenRouter') {
    for (const m of MODEL_REGISTRY.good) {
      if (!isKnownBad(m)) queue.push(m);
    }
    // Always include the free router last to discover new good models
    // (or as the only option if no known-good models yet)
    if (MODEL === 'openrouter/free' && !queue.includes('openrouter/free')) {
      queue.push('openrouter/free');
    } else if (!queue.includes(MODEL)) {
      queue.push(MODEL);
    }
  } else {
    queue.push(MODEL);
  }
  return queue;
}

async function callLLM(prompt) {
  let lastError = null;
  const queue = buildModelQueue();
  let attempt = 0;

  for (let qi = 0; qi < queue.length + MAX_RETRIES; qi++) {
    const modelToTry = queue[qi % queue.length];
    // After the first pass through the queue, we're retrying — add delay
    if (qi >= queue.length) {
      const delay = Math.min(BASE_DELAY_MS * Math.pow(1.5, attempt), MAX_DELAY_MS);
      console.log(`  Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }

    try {
      const res = await fetch(`${LLM_BASE}/chat/completions`, {
        method: 'POST',
        headers: { ...PROVIDER.headers(API_KEY), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToTry,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const retryable = res.status === 429 || res.status === 503 || res.status === 502;
        const reason = res.status === 429 ? 'rate limited' : res.status === 503 ? 'service unavailable' : res.status === 502 ? 'bad gateway' : `HTTP ${res.status}`;
        lastError = new Error(`${PROVIDER.name} ${reason}: ${errText.substring(0, 300)}`);
        if (!retryable) throw lastError;
        // Rate-limited on a specific model — try the next one in the queue
        if (res.status === 429 && modelToTry !== 'openrouter/free') {
          console.log(`  ${modelToTry} rate limited — trying next model`);
          continue;
        }
        continue;
      }

      const data = await res.json();
      const usedModel = data.model || modelToTry;
      const text = data.choices?.[0]?.message?.content;

      // Paid-model safeguard: reject immediately, no retry.
      if (isPaidModel(usedModel)) {
        lastError = new Error(`PAID MODEL BLOCKED: ${usedModel} is not a :free model — refusing to spend credit`);
        console.error(`  ${lastError.message}`);
        throw lastError;
      }
      if (hasCost(data.usage)) {
        lastError = new Error(`PAID USAGE BLOCKED: response from ${usedModel} has non-zero cost (${data.usage.cost || data.usage.total_cost})`);
        console.error(`  ${lastError.message}`);
        throw lastError;
      }

      // Detect content-safety classifier models by ID or output.
      // Remember as bad and try the next model in the queue.
      if (BAD_MODEL_IDS.has(usedModel) || isKnownBad(usedModel)) {
        console.log(`  Known bad model ${usedModel} — trying next`);
        rememberBadModel(usedModel);
        continue;
      }
      if (text && BAD_MODEL_PATTERNS.some(p => p.test(text.trim()))) {
        console.log(`  Safety-classifier response from ${usedModel} — remembering as bad, trying next`);
        rememberBadModel(usedModel);
        continue;
      }

      if (!text) {
        const finish = data.choices?.[0]?.finish_reason;
        lastError = new Error(`${PROVIDER.name} returned empty response${finish ? ` (finish_reason: ${finish})` : ''} from ${usedModel}`);
        if (finish === 'length' || finish === 'content_filter') throw lastError;
        console.log(`  ${lastError.message} — trying next model`);
        continue;
      }

      // Success! Remember this model as good for future calls.
      if (usedModel !== modelToTry) {
        // The free router picked a model — remember which one
        rememberGoodModel(usedModel);
      } else if (modelToTry !== 'openrouter/free') {
        // Direct model call succeeded — make sure it's in the registry
        rememberGoodModel(modelToTry);
      }

      return stripMarkdownFences(text);
    } catch (err) {
      lastError = err;
      const isNetwork = err.cause?.code || err.name === 'TypeError' || /fetch|network|connection|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|aborted/i.test(err.message);
      if (isNetwork && attempt < MAX_RETRIES - 1) {
        console.log(`  Network error (${err.cause?.code || err.message}) — retrying`);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error(`${PROVIDER.name}: all retries exhausted`);
}

function loadExistingDigest() {
  return loadJson(DIGEST_FILE, { date: new Date().toISOString().split('T')[0], clusters: [] });
}

function findClusterForStory(digest, storyId) {
  return digest.clusters.find(c => c.stories?.some(s => s.id === storyId));
}

// Heuristic fallback when the LLM fails for a cluster: derive headline/summary
// from the story text directly. Crude but never loses a story.
function fallbackClusterCopy(stories) {
  const lead = stories[0];
  const headline = (lead.originalTitle || lead.title || 'Untitled').slice(0, 80);
  const summary = (lead.text || '').slice(0, 200).replace(/\s+\S*$/, '') + '...';
  const triggerWords = extractKeywords(headline + ' ' + summary).slice(0, 5);
  return { headline, summary, triggerWords, impact: 'medium', category: normaliseCategory(lead.category) };
}

// Sort a cluster's stories chronologically (oldest first) so the stored
// stories array reads as a timeline of how the event developed.
function sortTimeline(stories) {
  return [...stories].sort((a, b) => String(a.published || '').localeCompare(String(b.published || '')));
}

// Attach lifecycle fields to every cluster: active flag, story count, sorted
// timeline, and first/last published dates.
function annotateLifecycle(digest) {
  const now = Date.now();
  const activeCutoff = now - ACTIVE_WINDOW_HOURS * 60 * 60 * 1000;
  for (const cluster of (digest.clusters || [])) {
    cluster.stories = sortTimeline(cluster.stories || []);
    const dates = cluster.stories
      .map(s => s.published)
      .filter(Boolean)
      .map(d => { try { return new Date(d).getTime(); } catch { return 0; } })
      .filter(Boolean);
    cluster.storyCount = cluster.stories.length;
    cluster.firstPublished = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
    cluster.lastPublished = dates.length ? new Date(Math.max(...dates)).toISOString() : null;
    const updatedTs = cluster.updated ? new Date(cluster.updated).getTime() : 0;
    cluster.active = updatedTs >= activeCutoff;
  }
}

// Merge a group of new stories into an existing cluster (dedup by id).
function mergeIntoCluster(cluster, prepared) {
  const existingIds = new Set(cluster.stories.map(s => s.id));
  let added = 0;
  for (const s of prepared) {
    if (!existingIds.has(s.id)) { cluster.stories.push(makeStoryData(s)); added++; }
  }
  return added;
}

async function main() {
  console.log('=== Summarise News (reworked) ===');
  console.log(`Provider: ${PROVIDER.name} | Model: ${MODEL}`);

  const rawStories = loadJson(RAW_FILE, []);
  const digest = loadExistingDigest();
  const summarisedIds = new Set(loadJson(SUMMARISED_IDS_FILE, []));
  const storyStore = loadJson(STORY_STORE_FILE, { stories: {} });

  // Dedupe: only process stories not yet summarised.
  const toProcess = rawStories.filter(s => !summarisedIds.has(s.id));

  if (!toProcess.length) {
    console.log('No new stories to summarise. Refreshing metadata only.');
    computeClusterTags(digest);
    annotateClusters(digest);
    annotateLifecycle(digest);
    digest.date = new Date().toISOString().split('T')[0];
    digest.generated = new Date().toISOString();
    digest.entityIndex = buildEntityIndex(digest).entities;
    saveJson(DIGEST_FILE, digest);
    writeRunLog(digest, 0, 0, 0, 0, 0, 0, true);
    return;
  }

  // Filter out stories too short to be meaningful.
  const filtered = toProcess.filter(s => wordCount((s.description || '') + ' ' + (s.content || '')) >= MIN_STORY_WORDS);
  const tooShort = toProcess.length - filtered.length;
  if (tooShort) console.log(`Filtered out ${tooShort} stories with < ${MIN_STORY_WORDS} words`);
  console.log(`Stories to process: ${filtered.length} (skipped ${rawStories.length - toProcess.length} already summarised)`);

  // --- Embed ---
  // We need embeddings for: new stories, AND any existing-cluster stories not
  // yet in the embedding cache (so we can compute existing cluster centroids).
  const existingClusterStoryIds = new Set();
  for (const c of digest.clusters) for (const s of (c.stories || [])) existingClusterStoryIds.add(s.id);
  const store = storyStore.stories || {};
  const existingStoriesToEmbed = [...existingClusterStoryIds]
    .map(id => store[id] || rawStories.find(r => r.id === id))
    .filter(Boolean);
  // embedStories uses the on-disk cache, so already-embedded ids are skipped.
  const embeddings = await embedStories([...filtered, ...existingStoriesToEmbed]);

  // --- Dedup + cluster new stories ---
  const dedupGroups = dedupStories(filtered, embeddings);
  const dedupedReps = dedupGroups.map(g => g[0]);
  const eventGroups = clusterEvents(dedupedReps, embeddings);
  // Expand each event group back to include all dedup members.
  const expandedGroups = eventGroups.map(group => {
    const all = [];
    const seen = new Set();
    for (const rep of group) {
      const dg = dedupGroups.find(dg => dg[0].id === rep.id) || [rep];
      for (const s of dg) if (!seen.has(s.id)) { seen.add(s.id); all.push(s); }
    }
    return all;
  });

  // --- Match to existing clusters ---
  const assignments = matchToExisting(expandedGroups, digest.clusters, embeddings);

  // --- Summarise each cluster (one LLM call each) ---
  let totalAdded = 0;
  let totalUpdated = 0;
  let clustersCreated = 0;
  let llmCalls = 0;
  let llmFailed = 0;

  for (let i = 0; i < assignments.length; i++) {
    const { stories, existingCluster } = assignments[i];
    const prepared = stories.map(prepareStoryForLLM);

    if (existingCluster) {
      const added = mergeIntoCluster(existingCluster, prepared);
      totalAdded += added;
      totalUpdated++;
      console.log(`\n[${i + 1}/${assignments.length}] update: ${existingCluster.headline?.slice(0, 60)} (+${added} new)`);
    } else {
      const newCluster = {
        id: `cluster-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        headline: prepared[0].originalTitle || 'Untitled',
        summary: '',
        category: normaliseCategory(prepared[0].category),
        stories: prepared.map(makeStoryData),
        triggerWords: [],
        impact: 'medium',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        contentVersion: 1,
      };
      digest.clusters.push(newCluster);
      totalAdded += prepared.length;
      clustersCreated++;
      console.log(`\n[${i + 1}/${assignments.length}] new cluster (${prepared.length} stories): ${prepared[0].originalTitle?.slice(0, 60)}`);
    }

    const cluster = existingCluster || digest.clusters[digest.clusters.length - 1];

    // One LLM call to write the cluster's editorial copy.
    llmCalls++;
    let prompt;
    try {
      prompt = buildSummaryPrompt(prepared, existingCluster);
      const responseText = await callLLM(prompt);
      const parsed = parseSummaryResponse(responseText);
      if (parsed && parsed.headline) {
        cluster.headline = parsed.headline;
        cluster.summary = parsed.summary || cluster.summary;
        if (parsed.category) cluster.category = normaliseCategory(parsed.category);
        if (parsed.trigger_words && Array.isArray(parsed.trigger_words)) cluster.triggerWords = parsed.trigger_words;
        if (parsed.region) cluster.region = parsed.region;
        if (parsed.impact && ['low', 'medium', 'high'].includes(parsed.impact.toLowerCase())) cluster.impact = parsed.impact.toLowerCase();
        cluster.contentVersion = (cluster.contentVersion || 0) + 1;
        console.log(`  LLM ok: "${parsed.headline?.slice(0, 60)}"`);
      } else {
        console.log(`  LLM returned unparseable JSON — using fallback copy`);
        llmFailed++;
        const fb = fallbackClusterCopy(prepared);
        if (!existingCluster) { cluster.headline = fb.headline; cluster.summary = fb.summary; cluster.triggerWords = fb.triggerWords; }
      }
    } catch (err) {
      console.error(`  LLM failed: ${err.message}. Using fallback copy.`);
      llmFailed++;
      if (!existingCluster) {
        const fb = fallbackClusterCopy(prepared);
        cluster.headline = fb.headline;
        cluster.summary = fb.summary;
        cluster.triggerWords = fb.triggerWords;
        cluster.impact = fb.impact;
      }
    }

    cluster.updated = new Date().toISOString();
    for (const s of prepared) summarisedIds.add(s.id);
    // Persist progress after each cluster so a mid-run crash keeps prior work.
    saveJson(SUMMARISED_IDS_FILE, [...summarisedIds]);
    saveJson(DIGEST_FILE, digest);

    if (i < assignments.length - 1) await new Promise(r => setTimeout(r, INTER_CALL_DELAY_MS));
  }

  // --- Annotate: entities, tags, lifecycle, entity index ---
  annotateClusters(digest);
  computeClusterTags(digest);
  annotateLifecycle(digest);
  digest.entityIndex = buildEntityIndex(digest).entities;

  digest.date = new Date().toISOString().split('T')[0];
  digest.generated = new Date().toISOString();
  saveJson(DIGEST_FILE, digest);

  writeRunLog(digest, filtered.length, totalAdded, clustersCreated, totalUpdated, llmCalls, llmFailed, false, tooShort);

  console.log(`\nSummarisation complete: ${totalAdded} stories added, ${clustersCreated} new clusters, ${totalUpdated} clusters updated.`);
  console.log(`LLM: ${llmCalls} calls, ${llmFailed} fell back to heuristic. Digest: ${digest.clusters.length} clusters.`);
}

function writeRunLog(digest, processed, added, created, updated, llmCalls, llmFailed, skipped, filteredTooShort = 0) {
  const runLog = loadJson(RUN_LOG_FILE, []);
  runLog.unshift({
    timestamp: new Date().toISOString(),
    provider: PROVIDER.name,
    model: MODEL,
    storiesProcessed: processed,
    storiesAdded: added,
    clustersCreated: created,
    clustersUpdated: updated,
    totalClusters: digest.clusters.length,
    llmCalls,
    llmFailed,
    chunks: llmCalls, // retained for frontend compatibility
    chunksFailed: llmFailed, // retained for frontend compatibility
    filteredTooShort,
    skipped,
  });
  saveJson(RUN_LOG_FILE, runLog.slice(0, 10));
}

main().catch(err => { console.error(err); process.exit(1); });

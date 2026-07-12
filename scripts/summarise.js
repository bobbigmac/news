import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';
import { extractJson } from './extract-json.js';

const CACHE_DIR = 'cache';
const RAW_FILE = join(CACHE_DIR, 'raw-new.json');
const DIGEST_FILE = join(CACHE_DIR, 'digest.json');
const SUMMARISED_IDS_FILE = join(CACHE_DIR, 'summarised-ids.json');
const RUN_LOG_FILE = join(CACHE_DIR, 'run-log.json');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 3000;
const MAX_DELAY_MS = 15000;

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

const CHUNK_MAX_STORIES = 12;
const CHUNK_MAX_CHARS = 12000;
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

function prepareStoryForLLM(story) {
  const title = truncate(story.title, 200);
  const desc = truncate(story.description || '', 400);
  const content = truncate(story.content || '', MAX_CONTENT_CHARS);
  const combined = [title, desc, content].filter(Boolean).join(' — ');
  return { id: story.id, text: combined, source: story.source || '', sourceName: story.sourceName || '', url: story.url || '', image: story.image || '', published: story.published || '', category: story.category || 'General', originalTitle: story.title, plugin: story.plugin || null, pluginPriority: story.pluginPriority ?? null };
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
  const stop = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','can','this','that','these','those','it','its','they','them','their','there','here','who','whom','whose','which','what','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','just','don','now','said','says','say','said','after','before','during','while','about','against','between','into','through','during','above','below','up','down','out','off','over','under','again','further','then','once','uk','us','mr','mrs','ms']);
  const words = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  return [...new Set(words)];
}

function keywordOverlap(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  let shared = 0;
  for (const w of setA) if (setB.has(w)) shared++;
  return shared;
}

function buildTranches(stories, existingClusters) {
  const filtered = stories.filter(s => wordCount(s.description + ' ' + s.content) >= MIN_STORY_WORDS);
  const tooShort = stories.length - filtered.length;
  if (tooShort) console.log(`Filtered out ${tooShort} stories with < ${MIN_STORY_WORDS} words`);

  // Pre-compute keywords for each story
  const storyData = filtered.map(s => ({
    story: s,
    keywords: extractKeywords(s.title + ' ' + s.description + ' ' + s.content),
    cat: normaliseCategory(s.category),
  }));

  // Pre-compute keywords for existing clusters
  const clusterData = (existingClusters || []).map(c => ({
    cluster: c,
    keywords: extractKeywords(c.headline + ' ' + (c.summary || '')),
    triggerWords: (c.triggerWords || []).map(w => w.toLowerCase()),
    cat: (c.category || '').toLowerCase(),
  }));

  // Step 1: Match stories to existing clusters
  const matchedToCluster = new Map(); // clusterId -> [storyData]
  const unmatched = [];

  for (const sd of storyData) {
    let bestMatch = null;
    let bestScore = 0;
    const storyText = (sd.story.title + ' ' + sd.story.description + ' ' + sd.story.content).toLowerCase();

    for (const cd of clusterData) {
      // Trigger word match — strong signal, any hit is enough
      if (cd.triggerWords.length) {
        const triggerHit = cd.triggerWords.some(tw => storyText.includes(tw));
        if (triggerHit) {
          const score = 100; // trigger words trump everything
          if (score > bestScore) {
            bestScore = score;
            bestMatch = cd.cluster;
          }
          continue;
        }
      }

      // Keyword overlap fallback
      const catBonus = sd.cat === cd.cat ? 2 : 0;
      const overlap = keywordOverlap(sd.keywords, cd.keywords);
      const score = overlap + catBonus;
      if (score > bestScore && overlap >= 2) {
        bestScore = score;
        bestMatch = cd.cluster;
      }
    }

    if (bestMatch) {
      if (!matchedToCluster.has(bestMatch.id)) matchedToCluster.set(bestMatch.id, []);
      matchedToCluster.get(bestMatch.id).push(sd);
    } else {
      unmatched.push(sd);
    }
  }

  console.log(`Heuristic matching: ${storyData.length - unmatched.length} stories matched to existing clusters, ${unmatched.length} unmatched`);

  // Step 2: Group unmatched stories with each other by keyword overlap
  const groups = [];
  const used = new Set();

  for (let i = 0; i < unmatched.length; i++) {
    if (used.has(i)) continue;
    const group = [unmatched[i]];
    used.add(i);

    for (let j = i + 1; j < unmatched.length; j++) {
      if (used.has(j)) continue;
      const overlap = keywordOverlap(unmatched[i].keywords, unmatched[j].keywords);
      const catBonus = unmatched[i].cat === unmatched[j].cat ? 2 : 0;
      if (overlap + catBonus >= 3) {
        group.push(unmatched[j]);
        used.add(j);
      }
    }

    groups.push(group);
  }

  console.log(`Unmatched stories grouped into ${groups.length} topic groups`);

  // Step 3: Build tranches
  const tranches = [];

  // Tranches for stories matched to existing clusters
  for (const [clusterId, sds] of matchedToCluster) {
    const cluster = existingClusters.find(c => c.id === clusterId);
    const prepared = sds.map(sd => prepareStoryForLLM(sd.story));

    // Split into LLM-sized chunks
    let current = [];
    let currentChars = 0;
    for (const p of prepared) {
      if (current.length >= CHUNK_MAX_STORIES || (current.length > 0 && currentChars + p.text.length > CHUNK_MAX_CHARS)) {
        tranches.push({ stories: current, matchedCluster: cluster });
        current = [];
        currentChars = 0;
      }
      current.push(p);
      currentChars += p.text.length;
    }
    if (current.length > 0) tranches.push({ stories: current, matchedCluster: cluster });
  }

  // Tranches for unmatched story groups
  for (const group of groups) {
    const prepared = group.map(sd => prepareStoryForLLM(sd.story));
    let current = [];
    let currentChars = 0;
    for (const p of prepared) {
      if (current.length >= CHUNK_MAX_STORIES || (current.length > 0 && currentChars + p.text.length > CHUNK_MAX_CHARS)) {
        tranches.push({ stories: current, matchedCluster: null });
        current = [];
        currentChars = 0;
      }
      current.push(p);
      currentChars += p.text.length;
    }
    if (current.length > 0) tranches.push({ stories: current, matchedCluster: null });
  }

  console.log(`Built ${tranches.length} tranches (${[...matchedToCluster.values()].reduce((s,v)=>s+v.length,0)} matched, ${unmatched.length} new)`);
  return tranches;
}

async function callOpenRouter(prompt) {
  let lastError = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${LLM_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          ...PROVIDER.headers(API_KEY),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3
        })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const retryable = res.status === 429 || res.status === 503 || res.status === 502;
        const reason = res.status === 429 ? 'rate limited' : res.status === 503 ? 'service unavailable' : res.status === 502 ? 'bad gateway' : `HTTP ${res.status}`;
        lastError = new Error(`${PROVIDER.name} ${reason}: ${errText.substring(0, 300)}`);
        if (!retryable) throw lastError;
        const delay = Math.min(BASE_DELAY_MS * Math.pow(1.5, attempt), MAX_DELAY_MS);
        console.log(`  ${PROVIDER.name} ${reason} — retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        const finish = data.choices?.[0]?.finish_reason;
        lastError = new Error(`${PROVIDER.name} returned empty response${finish ? ` (finish_reason: ${finish})` : ''}`);
        if (finish === 'length' || finish === 'content_filter') throw lastError;
        // Empty with no finish reason — might be transient, retry
        const delay = Math.min(BASE_DELAY_MS * Math.pow(1.5, attempt), MAX_DELAY_MS);
        console.log(`  ${lastError.message} — retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      console.log(`  Success (${MODEL})`);
      return text;
    } catch (err) {
      lastError = err;
      // Network-level errors (fetch aborted, connection refused, DNS, timeout)
      const isNetwork = err.cause?.code || err.name === 'TypeError' || /fetch|network|connection|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|aborted/i.test(err.message);
      if (isNetwork && attempt < MAX_RETRIES - 1) {
        const delay = Math.min(BASE_DELAY_MS * Math.pow(1.5, attempt), MAX_DELAY_MS);
        console.log(`  Network error (${err.cause?.code || err.message}) — retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, delay));
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

function mergeClusters(newClusters, chunkStories, digest) {
  const storyMap = new Map(chunkStories.map(s => [s.id, s]));
  let added = 0;
  let updated = 0;

  for (const cluster of newClusters) {
    let ids = cluster.story_ids;
    if (!ids) continue;
    if (typeof ids === 'string') ids = ids.split(',').map(s => s.trim()).filter(Boolean);
    if (!Array.isArray(ids)) ids = [String(ids)];
    if (!ids.length) continue;

    const stories = ids
      .map(id => storyMap.get(id))
      .filter(Boolean);

    if (!stories.length) continue;

    // Check if any story in this cluster already exists in digest
    let existingCluster = null;
    for (const story of stories) {
      existingCluster = findClusterForStory(digest, story.id);
      if (existingCluster) break;
    }

    const storyData = stories.map(s => ({
      id: s.id, title: s.originalTitle, source: s.source, sourceName: s.sourceName || '',
      url: s.url, image: s.image || '', published: s.published, category: s.category,
      plugin: s.plugin || null, pluginPriority: s.pluginPriority ?? null
    }));

    if (existingCluster) {
      // Merge new stories into existing cluster
      const existingIds = new Set(existingCluster.stories.map(s => s.id));
      for (const sd of storyData) {
        if (!existingIds.has(sd.id)) {
          existingCluster.stories.push(sd);
          added++;
        }
      }
      // Update headline/summary if the new one is different
      let contentChanged = false;
      if (cluster.headline && cluster.headline !== existingCluster.headline) {
        existingCluster.headline = cluster.headline;
        contentChanged = true;
      }
      if (cluster.summary && cluster.summary !== existingCluster.summary) {
        existingCluster.summary = cluster.summary;
        contentChanged = true;
      }
      if (cluster.trigger_words && Array.isArray(cluster.trigger_words)) {
        existingCluster.triggerWords = cluster.trigger_words;
      }
      if (cluster.impact && ['low','medium','high'].includes(cluster.impact.toLowerCase())) {
        existingCluster.impact = cluster.impact.toLowerCase();
      }
      if (contentChanged || stories.some(s => s._updated)) {
        existingCluster.contentVersion = (existingCluster.contentVersion || 0) + 1;
      }
      existingCluster.updated = new Date().toISOString();
      updated++;
    } else {
      // New cluster
      digest.clusters.push({
        id: `cluster-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        headline: cluster.headline || 'Untitled',
        summary: cluster.summary || '',
        category: cluster.category || 'Other',
        stories: storyData,
        triggerWords: Array.isArray(cluster.trigger_words) ? cluster.trigger_words : [],
        impact: ['low','medium','high'].includes((cluster.impact||'').toLowerCase()) ? cluster.impact.toLowerCase() : 'medium',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        contentVersion: 1
      });
      added += storyData.length;
    }
  }

  return { added, updated };
}

async function main() {
  console.log('=== Summarise News ===');
  console.log(`Provider: ${PROVIDER.name} | Model: ${MODEL}`);

  const rawStories = loadJson(RAW_FILE, []);
  if (!rawStories.length) {
    console.log('No new stories to summarise. Exiting.');
    return;
  }

  const digest = loadExistingDigest();
  const summarisedIds = new Set(loadJson(SUMMARISED_IDS_FILE, []));

  // Dedupe: only process stories not yet summarised
  const toProcess = rawStories.filter(s => !summarisedIds.has(s.id));
  if (!toProcess.length) {
    console.log('All stories already summarised. Exiting.');
    // Still log the run for audit trail
    const runLog = loadJson(RUN_LOG_FILE, []);
    runLog.unshift({
      timestamp: new Date().toISOString(),
      provider: PROVIDER.name,
      model: MODEL,
      storiesProcessed: 0,
      storiesAdded: 0,
      clustersCreated: 0,
      clustersUpdated: 0,
      totalClusters: digest.clusters.length,
      chunks: 0,
      chunksFailed: 0,
      filteredTooShort: 0,
      skipped: true,
    });
    saveJson(RUN_LOG_FILE, runLog.slice(0, 10));
    return;
  }

  console.log(`Stories to process: ${toProcess.length} (skipped ${rawStories.length - toProcess.length} already summarised)`);

  // Update metadata for already-summarised stories in existing digest
  let metadataUpdated = 0;
  for (const story of rawStories) {
    if (summarisedIds.has(story.id)) {
      const cluster = findClusterForStory(digest, story.id);
      if (cluster) {
        const existing = cluster.stories.find(s => s.id === story.id);
        if (existing && story.url && existing.url !== story.url) {
          existing.url = story.url;
          metadataUpdated++;
        }
      }
    }
  }
  if (metadataUpdated) console.log(`Updated metadata for ${metadataUpdated} existing stories`);

  // Build tranches with heuristic pre-grouping
  const tranches = buildTranches(toProcess, digest.clusters);
  console.log(`Built ${tranches.length} tranches from ${toProcess.length} stories`);

  // Process each tranche
  let totalAdded = 0;
  let totalUpdated = 0;
  for (let i = 0; i < tranches.length; i++) {
    const tranche = tranches[i];
    console.log(`\nProcessing tranche ${i + 1}/${tranches.length} (${tranche.stories.length} stories${tranche.matchedCluster ? `, matched: ${tranche.matchedCluster.headline}` : ', new'})`);

    const prompt = buildUserPrompt(tranche.stories, digest.clusters, tranche.matchedCluster);
    let responseText;
    try {
      responseText = await callOpenRouter(prompt);
    } catch (err) {
      console.error(`  Tranche ${i + 1} failed: ${err.message}. Skipping.`);
      continue;
    }

    const parsed = extractJson(responseText);
    if (!parsed || !parsed.clusters || !parsed.clusters.length) {
      console.error(`  Tranche ${i + 1}: could not extract clusters from LLM response. Will retry next run.`);
      continue;
    }

    console.log(`  LLM returned ${parsed.clusters.length} clusters`);
    const { added, updated } = mergeClusters(parsed.clusters, tranche.stories, digest);
    totalAdded += added;
    totalUpdated += updated;
    console.log(`  Merged: ${added} stories added, ${updated} clusters updated`);

    // Only mark as summarised if we actually processed clusters
    for (const story of tranche.stories) summarisedIds.add(story.id);

    // Check for stories the LLM dropped
    const clusterIds = new Set();
    for (const c of (parsed.clusters || [])) {
      let ids = c.story_ids;
      if (typeof ids === 'string') ids = ids.split(',').map(s => s.trim()).filter(Boolean);
      if (Array.isArray(ids)) ids.forEach(id => clusterIds.add(id));
    }
    const dropped = tranche.stories.filter(s => !clusterIds.has(s.id));
    if (dropped.length) {
      console.log(`  WARNING: LLM dropped ${dropped.length} stories. Adding as single-story clusters.`);
      for (const story of dropped) {
        digest.clusters.push({
          id: `cluster-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          headline: story.originalTitle || 'Untitled',
          summary: story.text.slice(0, 200),
          category: story.category || 'Other',
          stories: [{
            id: story.id, title: story.originalTitle, source: story.source,
            sourceName: story.sourceName || '', url: story.url, image: story.image || '',
            published: story.published, category: story.category,
            plugin: story.plugin || null, pluginPriority: story.pluginPriority ?? null
          }],
          triggerWords: [],
          impact: 'medium',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          contentVersion: 1
        });
        totalAdded++;
      }
    }

    // Save progress after each tranche
    saveJson(SUMMARISED_IDS_FILE, [...summarisedIds]);
    saveJson(DIGEST_FILE, digest);

    // Small delay between tranches
    if (i < tranches.length - 1) {
      console.log('  Pausing 2s between tranches...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Update digest date
  digest.date = new Date().toISOString().split('T')[0];
  digest.generated = new Date().toISOString();
  saveJson(DIGEST_FILE, digest);

  // Write run log
  const runLog = loadJson(RUN_LOG_FILE, []);
  const clustersBefore = runLog.length ? (runLog[0].totalClusters || 0) : 0;
  runLog.unshift({
    timestamp: new Date().toISOString(),
    provider: PROVIDER.name,
    model: MODEL,
    storiesProcessed: toProcess.length,
    storiesSkipped: rawStories.length - toProcess.length,
    storiesAdded: totalAdded,
    clustersUpdated: totalUpdated,
    clustersCreated: Math.max(0, digest.clusters.length - clustersBefore),
    totalClusters: digest.clusters.length,
    chunks: tranches.length,
    chunksFailed: tranches.length - (totalAdded > 0 || totalUpdated > 0 ? 1 : 0),
    filteredTooShort: toProcess.length - tranches.reduce((sum, t) => sum + t.stories.length, 0),
  });
  saveJson(RUN_LOG_FILE, runLog.slice(0, 10));

  console.log(`\nSummarisation complete: ${totalAdded} stories added, ${totalUpdated} clusters updated.`);
  console.log(`Digest: ${digest.clusters.length} total clusters in ${DIGEST_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });

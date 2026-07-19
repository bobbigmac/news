import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import nlp from 'compromise';
import { SYSTEM_PROMPT, buildUpdatePrompt, buildNewPrompt, buildAllocatePrompt } from './prompts.js';
import { extractJson } from './extract-json.js';

const CACHE_DIR = 'cache';
const RAW_FILE = join(CACHE_DIR, 'raw-new.json');
const DIGEST_FILE = join(CACHE_DIR, 'digest.json');
const SUMMARISED_IDS_FILE = join(CACHE_DIR, 'summarised-ids.json');
const RUN_LOG_FILE = join(CACHE_DIR, 'run-log.json');

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 5000;
const MAX_DELAY_MS = 60000;
const INTER_TRANCHE_DELAY_MS = 3000; // pause between tranches to avoid rate limiting

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

  // Pre-compute data for existing clusters
  const clusterData = (existingClusters || []).map(c => ({
    cluster: c,
    keywords: extractKeywords(c.headline + ' ' + (c.summary || '')),
    triggerWords: (c.triggerWords || []).map(w => w.toLowerCase()),
    cat: (Array.isArray(c.category) ? c.category.join(' ') : (c.category || '')).toLowerCase(),
  }));

  // Step 1: Match stories to existing clusters
  // Trigger word hit = confident match. High keyword overlap = confident match.
  const matchedToCluster = new Map(); // clusterId -> [storyData]
  const unmatched = [];

  for (const sd of storyData) {
    let bestMatch = null;
    let bestScore = 0;
    const storyText = (sd.story.title + ' ' + sd.story.description + ' ' + sd.story.content).toLowerCase();

    for (const cd of clusterData) {
      // Trigger word match — strong signal
      if (cd.triggerWords.length) {
        const triggerHits = cd.triggerWords.filter(tw => storyText.includes(tw));
        if (triggerHits.length) {
          const score = 100 + triggerHits.length * 10;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = cd.cluster;
          }
          continue;
        }
      }

      // Keyword overlap fallback — need decent overlap to be confident
      const catBonus = sd.cat === cd.cat ? 2 : 0;
      const overlap = keywordOverlap(sd.keywords, cd.keywords);
      const score = overlap + catBonus;
      if (score > bestScore && overlap >= 3) {
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

  const matchedCount = [...matchedToCluster.values()].reduce((s, v) => s + v.length, 0);
  console.log(`Heuristic matching: ${matchedCount} stories matched to existing clusters, ${unmatched.length} unmatched`);

  // Step 2: Group unmatched stories by keyword overlap
  // Groups of 2+ with good overlap = confident new groups
  // Singletons (no overlap with anything) = need LLM allocation
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

  const confidentNewGroups = groups.filter(g => g.length >= 2);
  const singletons = groups.filter(g => g.length === 1).map(g => g[0]);
  console.log(`Unmatched: ${confidentNewGroups.length} confident new groups (${confidentNewGroups.reduce((s,g)=>s+g.length,0)} stories), ${singletons.length} singletons for allocation`);

  // Step 3: Build typed tranches
  const tranches = [];

  // Update tranches — stories confidently matched to an existing cluster
  for (const [clusterId, sds] of matchedToCluster) {
    const cluster = existingClusters.find(c => c.id === clusterId);
    const prepared = sds.map(sd => prepareStoryForLLM(sd.story));
    // Split if too many stories for one LLM call
    for (let i = 0; i < prepared.length; i += CHUNK_MAX_STORIES) {
      const chunk = prepared.slice(i, i + CHUNK_MAX_STORIES);
      tranches.push({
        type: 'update',
        stories: chunk,
        matchedCluster: cluster,
      });
    }
  }

  // New group tranches — confident heuristic groups of 2+ unmatched stories
  for (const group of confidentNewGroups) {
    const prepared = group.map(sd => prepareStoryForLLM(sd.story));
    tranches.push({
      type: 'new',
      stories: prepared,
      matchedCluster: null,
    });
  }

  // Allocation tranches — singletons sent with existing cluster headlines for LLM to assign
  // Only do this if there are existing clusters with trigger words to match against
  const allocatableClusters = (existingClusters || [])
    .filter(c => c.triggerWords && c.triggerWords.length)
    .map(c => ({ id: c.id, headline: c.headline, triggerWords: c.triggerWords, category: c.category }));

  if (singletons.length && allocatableClusters.length) {
    // Batch singletons into tranches of up to CHUNK_MAX_STORIES
    const prepared = singletons.map(sd => prepareStoryForLLM(sd.story));
    for (let i = 0; i < prepared.length; i += CHUNK_MAX_STORIES) {
      const chunk = prepared.slice(i, i + CHUNK_MAX_STORIES);
      tranches.push({
        type: 'allocate',
        stories: chunk,
        candidates: allocatableClusters,
      });
    }
  } else if (singletons.length) {
    // No existing clusters to match against — treat singletons as new groups
    for (const sd of singletons) {
      const prepared = prepareStoryForLLM(sd.story);
      tranches.push({
        type: 'new',
        stories: [prepared],
        matchedCluster: null,
      });
    }
  }

  console.log(`Built ${tranches.length} tranches: ${tranches.filter(t=>t.type==='update').length} update, ${tranches.filter(t=>t.type==='new').length} new, ${tranches.filter(t=>t.type==='allocate').length} allocate`);
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

function consolidateClusters(digest) {
  let merged = 0;
  let changed = true;

  while (changed) {
    changed = false;
    for (let i = 0; i < digest.clusters.length; i++) {
      const a = digest.clusters[i];
      if (!a.triggerWords || !a.triggerWords.length) continue;

      for (let j = i + 1; j < digest.clusters.length; j++) {
        const b = digest.clusters[j];
        if (!b.triggerWords || !b.triggerWords.length) continue;

        // Check trigger word overlap (case-insensitive)
        const aTriggers = new Set(a.triggerWords.map(w => w.toLowerCase()));
        const bTriggers = new Set(b.triggerWords.map(w => w.toLowerCase()));
        const overlap = [...aTriggers].filter(t => bTriggers.has(t));

        if (overlap.length >= 1) {
          // Merge b into a
          const existingIds = new Set(a.stories.map(s => s.id));
          for (const s of b.stories) {
            if (!existingIds.has(s.id)) a.stories.push(s);
          }
          // Merge trigger words
          const allTriggers = new Set([...aTriggers, ...bTriggers]);
          a.triggerWords = [...allTriggers];
          // Keep the more recent headline/summary
          const aDate = a.updated || a.created || '';
          const bDate = b.updated || b.created || '';
          if (bDate > aDate) {
            a.headline = b.headline;
            a.summary = b.summary;
          }
          a.updated = new Date().toISOString();
          // Remove b
          digest.clusters.splice(j, 1);
          merged++;
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return merged;
}

function mergeClusters(newClusters, chunkStories, digest) {
  const storyMap = new Map(chunkStories.map(s => [s.id, s]));
  let added = 0;
  let updated = 0;
  const assignedIds = new Set(); // prevent same story in multiple clusters within one tranche

  for (const cluster of newClusters) {
    let ids = cluster.story_ids;
    if (!ids) continue;
    if (typeof ids === 'string') ids = ids.split(',').map(s => s.trim()).filter(Boolean);
    if (!Array.isArray(ids)) ids = [String(ids)];
    if (!ids.length) continue;

    // Filter out IDs already assigned to another cluster in this tranche
    const uniqueIds = ids.filter(id => !assignedIds.has(id));
    uniqueIds.forEach(id => assignedIds.add(id));

    const stories = uniqueIds
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
      url: s.url, image: s.image || '', published: s.published,
      category: normaliseCategory(Array.isArray(s.category) ? s.category[0] : (s.category || 'Other')),
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
      if (cluster.category) {
        const newCat = normaliseCategory(Array.isArray(cluster.category) ? cluster.category[0] : cluster.category);
        if (newCat !== existingCluster.category) {
          existingCluster.category = newCat;
          contentChanged = true;
        }
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
        category: normaliseCategory(Array.isArray(cluster.category) ? cluster.category[0] : (cluster.category || 'Other')),
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

function makeStoryData(s) {
  return {
    id: s.id, title: s.originalTitle, source: s.source, sourceName: s.sourceName || '',
    url: s.url, image: s.image || '', published: s.published,
    category: normaliseCategory(Array.isArray(s.category) ? s.category[0] : (s.category || 'Other')),
    plugin: s.plugin || null, pluginPriority: s.pluginPriority ?? null
  };
}

function makeFallbackCluster(stories, headline) {
  return {
    id: `cluster-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    headline: headline || stories[0]?.originalTitle || 'Untitled',
    summary: stories[0]?.text?.slice(0, 200) || '',
    category: normaliseCategory(Array.isArray(stories[0]?.category) ? stories[0].category[0] : (stories[0]?.category || 'Other')),
    stories: stories.map(makeStoryData),
    triggerWords: extractKeywords((headline || '') + ' ' + (stories[0]?.text || '')).slice(0, 5),
    impact: 'medium',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    contentVersion: 1
  };
}

function applyFallback(tranche, digest) {
  if (tranche.type === 'update' && tranche.matchedCluster) {
    const existingIds = new Set(tranche.matchedCluster.stories.map(s => s.id));
    for (const s of tranche.stories) {
      if (!existingIds.has(s.id)) tranche.matchedCluster.stories.push(makeStoryData(s));
    }
    tranche.matchedCluster.updated = new Date().toISOString();
  } else {
    const headline = tranche.stories[0]?.originalTitle || 'Untitled';
    digest.clusters.push(makeFallbackCluster(tranche.stories, headline));
  }
}

function countFallback(tranche) {
  if (tranche.type === 'update' && tranche.matchedCluster) {
    return { added: tranche.stories.length, updated: 1 };
  }
  return { added: tranche.stories.length, updated: 0 };
}

// --- Tag computation (compromise NER + TF-IDF) ---
// Computes tags for every cluster in the digest and embeds them as cluster.tags.

const TAG_STOP_WORDS = new Set([
  'the','a','an','and','or','but','for','nor','yet','so','in','on','at','to','of','by','with','from',
  'as','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would',
  'could','should','may','might','must','can','this','that','these','those','it','its','they','them',
  'their','there','here','where','when','who','whom','whose','what','which','why','how','all','any',
  'each','few','more','most','other','some','such','no','not','only','own','same','than','too','very',
  'just','about','above','after','again','against','before','below','between','into','through','during',
  'over','under','further','once','said','says','say','one','two','also','new','now','well','even',
  'still','made','make','makes','making','get','got','go','goes','going','like','up','out','off','down',
  'back','way','want','wants','wanted','need','needs','needed','use','used','uses','using','know',
  'known','knows','think','thinks','thought','see','seen','sees','look','looks','looked','come','came',
  'comes','take','took','taken','takes','give','gave','given','gives','find','found','finds','tell',
  'told','tells','ask','asked','asks','seem','seems','seemed','feel','feels','felt','try','tries','tried',
  'let','lets','may','might','put','puts','putting','set','sets','setting','went','gone','goes',
  'news','report','says','told','according','year','years','day','days','week','weeks','month',
  'months','people','person','today','yesterday','tomorrow','last','first','time','times','world',
]);

function extractClusterTerms(cluster) {
  const text = [
    cluster.headline || '',
    cluster.summary || '',
    ...(cluster.stories || []).slice(0, 5).map(s => s.title || ''),
  ].join(' ');

  const doc = nlp(text);
  const terms = new Set();

  doc.topics().out('array').forEach(t => {
    const lt = t.toLowerCase().trim();
    if (lt && lt.length >= 2 && !TAG_STOP_WORDS.has(lt)) terms.add(lt);
  });

  doc.nouns().out('array').forEach(t => {
    const lt = t.toLowerCase().trim();
    if (lt.length >= 3 && !TAG_STOP_WORDS.has(lt) && !/^\d+$/.test(lt)) {
      const singular = nlp(lt).nouns().toSingular().out('text') || lt;
      terms.add(singular);
    }
  });

  return [...terms];
}

function computeClusterTags(digest) {
  const clusters = digest.clusters || [];
  if (!clusters.length) return;

  // Document frequency across all clusters
  const df = new Map();
  const clusterTerms = clusters.map(cluster => {
    const terms = extractClusterTerms(cluster);
    const seen = new Set();
    for (const term of terms) {
      if (!seen.has(term)) {
        seen.add(term);
        df.set(term, (df.get(term) || 0) + 1);
      }
    }
    return terms;
  });

  const docCount = clusters.length;

  clusters.forEach((cluster, i) => {
    const terms = clusterTerms[i];
    if (!terms.length) { cluster.tags = []; return; }

    const cat = Array.isArray(cluster.category) ? cluster.category[0] : cluster.category;
    const plugin = cluster.stories?.find(s => s.plugin)?.plugin;
    const structuralTags = [];
    if (cat && cat !== 'Other' && cat !== 'General') structuralTags.push(cat.toLowerCase());
    if (plugin) structuralTags.push(plugin.toLowerCase());

    const termFreq = new Map();
    for (const term of terms) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }

    const scored = terms.map(term => {
      const tf = termFreq.get(term) / terms.length;
      const dfVal = df.get(term) || 1;
      const idf = Math.log(docCount / dfVal);
      return { term, score: tf * idf };
    });

    scored.sort((a, b) => b.score - a.score);
    const topTerms = scored.slice(0, 10).map(s => s.term);

    cluster.tags = [...new Set([...structuralTags, ...topTerms])].slice(0, 12);
  });

  console.log(`Computed tags for ${clusters.length} clusters`);
}

async function main() {
  console.log('=== Summarise News ===');
  console.log(`Provider: ${PROVIDER.name} | Model: ${MODEL}`);

  const rawStories = loadJson(RAW_FILE, []);
  if (!rawStories.length) {
    console.log('No new stories to summarise. Exiting.');
    const digest = loadExistingDigest();
    computeClusterTags(digest);
    digest.date = new Date().toISOString().split('T')[0];
    digest.generated = new Date().toISOString();
    saveJson(DIGEST_FILE, digest);
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

  const digest = loadExistingDigest();
  const summarisedIds = new Set(loadJson(SUMMARISED_IDS_FILE, []));

  // Dedupe: only process stories not yet summarised
  const toProcess = rawStories.filter(s => !summarisedIds.has(s.id));
  if (!toProcess.length) {
    console.log('All stories already summarised. Exiting.');
    // Still log the run for audit trail
    computeClusterTags(digest);
    saveJson(DIGEST_FILE, digest);
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

  // Build typed tranches with heuristic pre-grouping
  const tranches = buildTranches(toProcess, digest.clusters);

  // Process each tranche
  let totalAdded = 0;
  let totalUpdated = 0;
  let chunksFailed = 0;

  for (let i = 0; i < tranches.length; i++) {
    const tranche = tranches[i];
    const typeLabel = tranche.type === 'update'
      ? `update: ${tranche.matchedCluster?.headline?.slice(0, 50)}`
      : tranche.type === 'allocate'
        ? `allocate (${tranche.candidates?.length || 0} candidates)`
        : 'new';
    console.log(`\nTranche ${i + 1}/${tranches.length} [${tranche.type}] (${tranche.stories.length} stories, ${typeLabel})`);

    // Build the appropriate prompt
    let prompt;
    if (tranche.type === 'update') {
      prompt = buildUpdatePrompt(tranche.stories, tranche.matchedCluster);
    } else if (tranche.type === 'allocate') {
      prompt = buildAllocatePrompt(tranche.stories, tranche.candidates);
    } else {
      prompt = buildNewPrompt(tranche.stories);
    }

    // Call LLM
    let responseText;
    try {
      responseText = await callOpenRouter(prompt);
    } catch (err) {
      console.error(`  LLM failed: ${err.message}. Using heuristic fallback.`);
      chunksFailed++;
      applyFallback(tranche, digest);
      const { added, updated } = countFallback(tranche);
      totalAdded += added; totalUpdated += updated;
      for (const story of tranche.stories) summarisedIds.add(story.id);
      saveJson(SUMMARISED_IDS_FILE, [...summarisedIds]);
      saveJson(DIGEST_FILE, digest);
      if (i < tranches.length - 1) await new Promise(r => setTimeout(r, INTER_TRANCHE_DELAY_MS));
      continue;
    }

    const parsed = extractJson(responseText);
    if (!parsed || !parsed.clusters || !parsed.clusters.length) {
      console.error(`  Could not extract clusters from LLM response. Using heuristic fallback.`);
      chunksFailed++;
      applyFallback(tranche, digest);
      const { added, updated } = countFallback(tranche);
      totalAdded += added; totalUpdated += updated;
      for (const story of tranche.stories) summarisedIds.add(story.id);
      saveJson(SUMMARISED_IDS_FILE, [...summarisedIds]);
      saveJson(DIGEST_FILE, digest);
      if (i < tranches.length - 1) await new Promise(r => setTimeout(r, INTER_TRANCHE_DELAY_MS));
      continue;
    }

    console.log(`  LLM returned ${parsed.clusters.length} clusters`);

    // For 'update' tranches, always merge into the matched cluster
    if (tranche.type === 'update' && tranche.matchedCluster) {
      const llmCluster = parsed.clusters[0];
      const rejectedIds = new Set(parsed.rejected_ids || []);
      const existingIds = new Set(tranche.matchedCluster.stories.map(s => s.id));
      for (const s of tranche.stories) {
        if (rejectedIds.has(s.id)) continue;
        if (!existingIds.has(s.id)) {
          tranche.matchedCluster.stories.push(makeStoryData(s));
          totalAdded++;
        }
      }
      if (llmCluster.headline) tranche.matchedCluster.headline = llmCluster.headline;
      if (llmCluster.summary) tranche.matchedCluster.summary = llmCluster.summary;
      if (llmCluster.trigger_words && Array.isArray(llmCluster.trigger_words)) tranche.matchedCluster.triggerWords = llmCluster.trigger_words;
      if (llmCluster.impact && ['low','medium','high'].includes(llmCluster.impact.toLowerCase())) tranche.matchedCluster.impact = llmCluster.impact.toLowerCase();
      tranche.matchedCluster.updated = new Date().toISOString();
      tranche.matchedCluster.contentVersion = (tranche.matchedCluster.contentVersion || 0) + 1;
      totalUpdated++;
      // Handle rejected stories as their own clusters
      const rejected = tranche.stories.filter(s => rejectedIds.has(s.id));
      for (const s of rejected) {
        digest.clusters.push(makeFallbackCluster([s], s.originalTitle));
        totalAdded++;
      }
      console.log(`  Updated: ${tranche.matchedCluster.headline?.slice(0, 50)} (${tranche.stories.length - rejected.length} in, ${rejected.length} rejected)`);
    } else {
      // 'new' and 'allocate' tranches
      for (const cluster of parsed.clusters) {
        // Check if LLM assigned to existing cluster (allocate type)
        if (cluster.existing_cluster_id) {
          const existing = digest.clusters.find(c => c.id === cluster.existing_cluster_id);
          if (existing) {
            let ids = cluster.story_ids;
            if (typeof ids === 'string') ids = ids.split(',').map(s => s.trim()).filter(Boolean);
            if (!Array.isArray(ids)) ids = ids ? [String(ids)] : [];
            const stories = ids.map(id => tranche.stories.find(s => s.id === id)).filter(Boolean);
            const existingIds = new Set(existing.stories.map(s => s.id));
            for (const s of stories) {
              if (!existingIds.has(s.id)) { existing.stories.push(makeStoryData(s)); totalAdded++; }
            }
            if (cluster.headline) existing.headline = cluster.headline;
            if (cluster.summary) existing.summary = cluster.summary;
            if (cluster.trigger_words && Array.isArray(cluster.trigger_words)) existing.triggerWords = cluster.trigger_words;
            existing.updated = new Date().toISOString();
            totalUpdated++;
            continue;
          }
        }
        // New cluster
        let ids = cluster.story_ids;
        if (typeof ids === 'string') ids = ids.split(',').map(s => s.trim()).filter(Boolean);
        if (!Array.isArray(ids)) ids = ids ? [String(ids)] : [];
        const stories = ids.map(id => tranche.stories.find(s => s.id === id)).filter(Boolean);
        if (!stories.length) continue;
        digest.clusters.push({
          id: `cluster-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          headline: cluster.headline || stories[0]?.originalTitle || 'Untitled',
          summary: cluster.summary || '',
          category: normaliseCategory(Array.isArray(cluster.category) ? cluster.category[0] : (cluster.category || 'Other')),
          stories: stories.map(makeStoryData),
          triggerWords: Array.isArray(cluster.trigger_words) ? cluster.trigger_words : [],
          impact: ['low','medium','high'].includes((cluster.impact||'').toLowerCase()) ? cluster.impact.toLowerCase() : 'medium',
          created: new Date().toISOString(), updated: new Date().toISOString(), contentVersion: 1
        });
        totalAdded += stories.length;
      }
    }

    for (const story of tranche.stories) summarisedIds.add(story.id);
    saveJson(SUMMARISED_IDS_FILE, [...summarisedIds]);
    saveJson(DIGEST_FILE, digest);

    if (i < tranches.length - 1) {
      console.log(`  Pausing ${INTER_TRANCHE_DELAY_MS / 1000}s...`);
      await new Promise(r => setTimeout(r, INTER_TRANCHE_DELAY_MS));
    }
  }

  // Consolidate clusters with overlapping trigger words
  const mergedCount = consolidateClusters(digest);
  if (mergedCount) console.log(`\nConsolidated ${mergedCount} duplicate clusters`);

  // Compute tags for all clusters (compromise NER + TF-IDF)
  computeClusterTags(digest);

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
    chunksFailed,
    filteredTooShort: toProcess.length - tranches.reduce((sum, t) => sum + t.stories.length, 0),
  });
  saveJson(RUN_LOG_FILE, runLog.slice(0, 10));

  console.log(`\nSummarisation complete: ${totalAdded} stories added, ${totalUpdated} clusters updated, ${chunksFailed} tranches fell back to heuristic.`);
  console.log(`Digest: ${digest.clusters.length} total clusters in ${DIGEST_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = 'cache';
const RAW_FILE = join(CACHE_DIR, 'raw-new.json');
const DIGEST_FILE = join(CACHE_DIR, 'digest.json');
const SUMMARISED_IDS_FILE = join(CACHE_DIR, 'summarised-ids.json');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const FREE_MODELS = [
  process.env.OPENROUTER_MODEL || 'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openai/gpt-oss-120b:free',
  'openai/gpt-oss-20b:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
].filter(Boolean);
let currentModelIndex = 0;

const CHUNK_MAX_STORIES = 12;
const CHUNK_MAX_CHARS = 12000;
const MIN_STORY_WORDS = 15;
const MAX_CONTENT_CHARS = 800;

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const API_KEY = process.env.openrouter_api_key || process.env.OPENROUTER_API_KEY || '';
if (!API_KEY) { console.error('No OPENROUTER_API_KEY found. Skipping summarisation.'); process.exit(0); }

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
  return { id: story.id, text: combined, source: story.source || '', url: story.url || '', published: story.published || '', category: story.category || 'General', originalTitle: story.title, plugin: story.plugin || null, pluginPriority: story.pluginPriority ?? null };
}

function buildChunks(stories) {
  const filtered = stories.filter(s => wordCount(s.description + ' ' + s.content) >= MIN_STORY_WORDS);
  const tooShort = stories.length - filtered.length;
  if (tooShort) console.log(`Filtered out ${tooShort} stories with < ${MIN_STORY_WORDS} words`);

  const chunks = [];
  let current = [];
  let currentChars = 0;

  for (const story of filtered) {
    const prepared = prepareStoryForLLM(story);
    const storyChars = prepared.text.length;

    if (current.length >= CHUNK_MAX_STORIES || (current.length > 0 && currentChars + storyChars > CHUNK_MAX_CHARS)) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(prepared);
    currentChars += storyChars;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

const SYSTEM_PROMPT = `You are a news editor for a serious broadsheet newspaper. Your job is to take raw news stories and produce a clean, non-sensational news digest.

Rules:
1. Group related stories together into clusters. Stories about the same event or topic go in one cluster.
2. For each cluster, write a SHORT factual headline (max 8 words). No clickbait, no sensationalism, no question marks. Just the facts.
3. Write a SUMMARY of 2-4 sentences in block text. State the key facts clearly. Do NOT repeat information. Do NOT use phrases like "according to reports" or "it is said". Be direct.
4. Assign a CATEGORY from: Politics, Business, Technology, Science, Health, World, Sports, Entertainment, Environment, Other.
5. List the story IDs that belong to each cluster.

Respond ONLY with valid JSON in this exact format:
{
  "clusters": [
    {
      "headline": "Short factual headline",
      "summary": "2-4 sentences of block text facts.",
      "category": "Politics",
      "story_ids": ["id1", "id2"]
    }
  ]
}`;

function buildUserPrompt(chunk) {
  const storyLines = chunk.map((s, i) =>
    `[${i + 1}] ID: ${s.id}\n    Title: ${s.originalTitle}\n    Source: ${s.source}\n    Content: ${s.text}`
  ).join('\n\n');

  return `Here are ${chunk.length} news stories. Group related ones together, write factual headlines and summaries.\n\n${storyLines}`;
}

async function callOpenRouter(prompt, retries = 3) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const model = FREE_MODELS[currentModelIndex % FREE_MODELS.length];
    try {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/bobbigmac/news',
          'X-Title': 'News Dashboard'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 4000
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(`OpenRouter ${res.status}: ${errText.substring(0, 200)}`);
        console.log(`  Model ${model} error: ${res.status}`);
        if (currentModelIndex < FREE_MODELS.length - 1) {
          currentModelIndex++;
          continue;
        }
        if (attempt < retries) {
          const wait = 5000 * (attempt + 1);
          console.log(`  All models tried, waiting ${wait / 1000}s before retry...`);
          currentModelIndex = 0;
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw lastError;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from LLM');
      console.log(`  Success with model: ${model}`);
      return text;
    } catch (err) {
      lastError = err;
      if (currentModelIndex < FREE_MODELS.length - 1) {
        currentModelIndex++;
        console.log(`  Trying next model: ${FREE_MODELS[currentModelIndex]}...`);
        continue;
      }
      if (attempt < retries) {
        const wait = 3000 * (attempt + 1);
        console.log(`  Attempt ${attempt + 1} failed, waiting ${wait / 1000}s...`);
        currentModelIndex = 0;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('All retries exhausted');
}

function extractJson(text) {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let raw = fenceMatch ? fenceMatch[1] : text;
  let jsonStart = raw.indexOf('{');
  let jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1) return null;
  if (jsonEnd === -1) {
    // Truncated response — try to close braces
    const openBraces = (raw.match(/\{/g) || []).length;
    const closeBraces = (raw.match(/}/g) || []).length;
    for (let i = 0; i < openBraces - closeBraces; i++) raw += '}';
    jsonEnd = raw.lastIndexOf('}');
  }
  try {
    return JSON.parse(raw.substring(jsonStart, jsonEnd + 1));
  } catch (e) {
    // Try fixing trailing commas
    try {
      return JSON.parse(raw.substring(jsonStart, jsonEnd + 1).replace(/,\s*([}\]])/g, '$1'));
    } catch { /* give up */ }
    console.log(`  JSON parse error: ${e.message}`);
    return null;
  }
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
    if (!cluster.story_ids || !cluster.story_ids.length) continue;

    const stories = cluster.story_ids
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
      id: s.id, title: s.originalTitle, source: s.source,
      url: s.url, published: s.published, category: s.category,
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
      // Update headline/summary if the new one is better/different
      if (cluster.headline && cluster.headline !== existingCluster.headline) {
        existingCluster.headline = cluster.headline;
      }
      if (cluster.summary && cluster.summary !== existingCluster.summary) {
        existingCluster.summary = cluster.summary;
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
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      });
      added += storyData.length;
    }
  }

  return { added, updated };
}

async function main() {
  console.log('=== Summarise News ===');
  console.log(`Models: ${FREE_MODELS.join(', ')}`);

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

  // Build chunks
  const chunks = buildChunks(toProcess);
  console.log(`Built ${chunks.length} chunks from ${toProcess.length} stories`);

  // Process each chunk
  let totalAdded = 0;
  let totalUpdated = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`\nProcessing chunk ${i + 1}/${chunks.length} (${chunk.length} stories)...`);

    const prompt = buildUserPrompt(chunk);
    let responseText;
    try {
      responseText = await callOpenRouter(prompt);
    } catch (err) {
      console.error(`  Chunk ${i + 1} failed: ${err.message}. Skipping.`);
      continue;
    }

    const parsed = extractJson(responseText);
    if (!parsed || !parsed.clusters) {
      console.error(`  Chunk ${i + 1}: could not parse LLM response. Skipping.`);
      console.log(`  Raw response (first 500 chars): ${responseText.substring(0, 500)}`);
      console.log(`  Raw response (last 200 chars): ${responseText.substring(responseText.length - 200)}`);
      continue;
    }

    console.log(`  LLM returned ${parsed.clusters.length} clusters`);
    const { added, updated } = mergeClusters(parsed.clusters, chunk, digest);
    totalAdded += added;
    totalUpdated += updated;
    console.log(`  Merged: ${added} stories added, ${updated} clusters updated`);

    // Mark these story IDs as summarised
    for (const story of chunk) summarisedIds.add(story.id);

    // Save progress after each chunk
    saveJson(SUMMARISED_IDS_FILE, [...summarisedIds]);
    saveJson(DIGEST_FILE, digest);

    // Small delay between chunks
    if (i < chunks.length - 1) {
      console.log('  Pausing 2s between chunks...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Update digest date
  digest.date = new Date().toISOString().split('T')[0];
  digest.generated = new Date().toISOString();
  saveJson(DIGEST_FILE, digest);

  console.log(`\nSummarisation complete: ${totalAdded} stories added, ${totalUpdated} clusters updated.`);
  console.log(`Digest: ${digest.clusters.length} total clusters in ${DIGEST_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });

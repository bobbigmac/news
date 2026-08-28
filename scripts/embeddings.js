// Local semantic embeddings via Transformers.js (Xenova/all-MiniLM-L6-v2).
// Runs on CPU, no API key, no quota. Embeddings are cached per story id so
// we only embed stories we haven't seen before.
//
// Cache file: cache/embeddings.json  ->  { [storyId]: number[384], ... }

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pipeline, env } from '@xenova/transformers';

// Don't try to load models from a local ./models dir; always pull from HF Hub.
env.allowLocalModels = false;

const CACHE_DIR = 'cache';
const EMBED_FILE = join(CACHE_DIR, 'embeddings.json');
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const EMBED_DIM = 384;
const MAX_TEXT_CHARS = 1000; // title + description + truncated content

let _extractor = null;

async function getExtractor() {
  if (!_extractor) {
    console.log(`Embeddings: loading model ${MODEL_ID} ...`);
    _extractor = await pipeline('feature-extraction', MODEL_ID);
    console.log('Embeddings: model ready.');
  }
  return _extractor;
}

function loadCache() {
  if (!existsSync(EMBED_FILE)) return {};
  try { return JSON.parse(readFileSync(EMBED_FILE, 'utf8')); } catch { return {}; }
}

function saveCache(cache) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(EMBED_FILE, JSON.stringify(cache));
}

function truncate(text, max) {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return t.substring(0, max).replace(/\s+\S*$/, '') + '...';
}

// Build the text we embed for a story. Same field combination the matching
// logic cares about: title carries the most signal, then description, then
// a slice of body content.
export function storyEmbeddingText(story) {
  return [
    truncate(story.title, 200),
    truncate(story.description || '', 400),
    truncate(story.content || '', 400),
  ].filter(Boolean).join(' — ');
}

// Embed a batch of stories, using the cache for any id we've seen before.
// Returns a Map<id, number[]> (normalised 384-dim vectors).
export async function embedStories(stories) {
  const cache = loadCache();
  const toEmbed = [];
  const result = new Map();

  for (const s of stories) {
    if (!s || !s.id) continue;
    if (cache[s.id]) {
      result.set(s.id, cache[s.id]);
    } else {
      toEmbed.push(s);
    }
  }

  if (toEmbed.length) {
    console.log(`Embeddings: ${toEmbed.length} new stories to embed (${result.size} cached)`);
    const extractor = await getExtractor();
    // Embed in chunks to keep memory bounded.
    const BATCH = 16;
    for (let i = 0; i < toEmbed.length; i += BATCH) {
      const slice = toEmbed.slice(i, i + BATCH);
      const texts = slice.map(storyEmbeddingText);
      const out = await extractor(texts, { pooling: 'mean', normalize: true });
      const data = out.data;
      for (let j = 0; j < slice.length; j++) {
        const vec = Array.from(data.slice(j * EMBED_DIM, (j + 1) * EMBED_DIM));
        // Round to 6 decimals to keep the cache file compact.
        const rounded = vec.map(v => Math.round(v * 1e6) / 1e6);
        cache[slice[j].id] = rounded;
        result.set(slice[j].id, rounded);
      }
    }
    saveCache(cache);
  } else {
    console.log(`Embeddings: all ${result.size} stories already cached`);
  }

  return result;
}

// Cosine similarity. Vectors are already L2-normalised by the model, so this
// is just a dot product — but we handle un-normalised input defensively.
export function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Mean of a set of vectors (used for cluster centroids). Returns a normalised
// vector so it can be compared with cosineSim directly.
export function centroid(vectors) {
  if (!vectors.length) return null;
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  const mean = sum.map(x => x / vectors.length);
  // Normalise.
  let norm = 0;
  for (const x of mean) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return mean.map(x => x / norm);
}

export const EMBED_DIMENSION = EMBED_DIM;

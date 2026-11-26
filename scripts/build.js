import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import { annotateClustersIfMissing, buildEntityIndex } from './entities.js';
import { computeClusterTagsIfMissing } from './tags.js';
import { enrichAllStories } from './story-enrich.js';
import { canonicalCategory, recategoriseCluster } from './categories.js';
import { collectSources } from './favicons.js';
import { deriveShortSummary } from './short-summary.js';

const CACHE_DIR = 'cache';
const DIGEST_FILE = join(CACHE_DIR, 'digest.json');
const RUN_LOG_FILE = join(CACHE_DIR, 'run-log.json');
const OUT_DIR = 'dist';

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

function copyStatic(file) {
  const src = join('src', file);
  if (existsSync(src)) copyFileSync(src, join(OUT_DIR, file));
}

mkdirSync(OUT_DIR, { recursive: true });

const digest = loadJson(DIGEST_FILE, { date: new Date().toISOString().split('T')[0], clusters: [] });

// Backfill fields that older pipeline runs may not have set, so the frontend
// never sees a cluster missing a required field.
for (const c of digest.clusters) {
  if (!Array.isArray(c.triggerWords)) c.triggerWords = [];
  if (!c.impact) c.impact = 'medium';
  if (!c.contentVersion) c.contentVersion = 1;
  if (!c.created) c.created = c.updated || new Date().toISOString();
  if (!c.updated) c.updated = c.created;
  if (!c.region) c.region = null;
  // Normalise category aliases/casing before and after keyword recategorisation
  // so plural and multi-word variants cannot appear as separate frontend facets.
  c.category = canonicalCategory(c.category);
  recategoriseCluster(c);
  c.category = canonicalCategory(c.category);
  if (!c.shortSummary) c.shortSummary = deriveShortSummary(c.summary, c.headline);
}

// Enrich all stories with bodyText, wordCount, storyType for external consumers.
enrichAllStories(digest);

// Ensure every cluster has tags + entities even if summarise didn't run fully.
computeClusterTagsIfMissing(digest);
annotateClustersIfMissing(digest);

// --- Pipeline stats (consumed by the frontend info panel) ---
const storyStore = loadJson(join(CACHE_DIR, 'stories.json'), { stories: {} });
const summarisedIds = loadJson(join(CACHE_DIR, 'summarised-ids.json'), []);
const totalStories = Object.keys(storyStore.stories || {}).length;
const summarised = summarisedIds.length;
const inDigest = digest.clusters.reduce((a, c) => a + (c.stories?.length || 0), 0);
digest.pipelineStats = {
  totalStories,
  summarised,
  unsummarised: totalStories - summarised,
  inDigest,
  clusters: digest.clusters.length,
};

// --- Sort clusters: most stories first, then by most recent update ---
digest.clusters.sort((a, b) => {
  const aCount = a.stories?.length || 0;
  const bCount = b.stories?.length || 0;
  if (bCount !== aCount) return bCount - aCount;
  const aDate = a.updated || a.created || '';
  const bDate = b.updated || b.created || '';
  return bDate.localeCompare(aDate);
});

// --- Entity index (inverted: entity -> clusters) ---
const { entities } = buildEntityIndex(digest);

// --- Topics: cross-cluster theme groups ---
// Two clusters are linked if they share >= 2 tags OR >= 1 entity that itself
// appears in 2+ clusters. Connected components become topics. Each topic is
// named after its most frequent shared tag/entity.
const topics = buildTopics(digest, entities);

// --- Timeline: every story across all clusters, chronological ---
const timeline = [];
for (const cluster of digest.clusters) {
  for (const story of (cluster.stories || [])) {
    timeline.push({
      id: story.id,
      title: story.title,
      url: story.url,
      sourceName: story.sourceName,
      published: story.published,
      image: story.image || '',
      category: story.category || cluster.category,
      region: cluster.region || null,
      storyType: story.storyType || 'news',
      wordCount: story.wordCount || 0,
      plugin: story.plugin || null,
      clusterId: cluster.id,
      clusterHeadline: cluster.headline,
    });
  }
}
timeline.sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')));

// --- Aggregate stats for consumers ---
const byCategory = {};
const bySource = {};
const byImpact = {};
const byRegion = {};
const byStoryType = {};
let activeCount = 0;
for (const c of digest.clusters) {
  const cat = Array.isArray(c.category) ? c.category[0] : (c.category || 'Other');
  byCategory[cat] = (byCategory[cat] || 0) + 1;
  byImpact[c.impact || 'medium'] = (byImpact[c.impact || 'medium'] || 0) + 1;
  const region = c.region || 'Unknown';
  byRegion[region] = (byRegion[region] || 0) + 1;
  if (c.active) activeCount++;
  for (const s of (c.stories || [])) {
    const src = s.sourceName || 'Unknown';
    bySource[src] = (bySource[src] || 0) + 1;
    const st = s.storyType || 'news';
    byStoryType[st] = (byStoryType[st] || 0) + 1;
  }
}
const pubTimes = timeline
  .map(t => t.published)
  .filter(Boolean)
  .map(d => { try { return new Date(d).getTime(); } catch { return 0; } })
  .filter(Boolean);
const stats = {
  totalClusters: digest.clusters.length,
  totalStories: timeline.length,
  activeClusters: activeCount,
  archivedClusters: digest.clusters.length - activeCount,
  totalEntities: entities.length,
  totalTopics: topics.length,
  byCategory,
  bySource,
  byImpact,
  byRegion,
  byStoryType,
  newestStory: pubTimes.length ? new Date(Math.max(...pubTimes)).toISOString() : null,
  oldestStory: pubTimes.length ? new Date(Math.min(...pubTimes)).toISOString() : null,
};

// --- Source index ---
// The frontend uses the checked-in favicon spritesheet directly; the digest
// only needs the canonical host, label, count, and freshness metadata here.
const sources = collectSources(digest);

// --- Assemble the final public dataset ---
const publicDigest = {
  date: digest.date,
  generated: digest.generated,
  clusters: digest.clusters,
  entities,
  topics,
  timeline,
  stats,
  sources,
  pipelineStats: digest.pipelineStats,
};

writeFileSync(join(OUT_DIR, 'digest.json'), JSON.stringify(publicDigest, null, 2));

// Write run-log.json if it exists
const runLog = loadJson(RUN_LOG_FILE, []);
writeFileSync(join(OUT_DIR, 'run-log.json'), JSON.stringify(runLog, null, 2));

// Copy static assets that Vite doesn't process
copyStatic('og-image.jpg');
copyStatic('sw.js');

console.log(`Build complete. ${digest.clusters.length} clusters, ${entities.length} entities, ${topics.length} topics, ${timeline.length} stories in timeline -> ${OUT_DIR}/digest.json`);

// --- Topic derivation (connected components over tag/entity overlap) ---
function buildTopics(digest, entities) {
  const clusters = digest.clusters || [];

  // Structural tags (plugin names, category names, source names) are useless
  // for topic linking — they're ubiquitous and would chain every BBC story
  // into one giant "bbc" topic. Only use content-derived tags for linking.
  const STRUCTURAL = new Set([
    'bbc', 'guardian', 'gaming', 'rss', 'currents',
    'politics', 'business', 'technology', 'science', 'health', 'world',
    'sports', 'entertainment', 'environment', 'regional', 'general', 'other',
  ]);
  const contentTags = (c) => (c.tags || [])
    .map(t => t.toLowerCase().replace(/[:;,.?!…\s]+$/, '').trim())
    .filter(t => t && !STRUCTURAL.has(t));
  const clusterTags = clusters.map(c => new Set(contentTags(c)));

  // Union-find keeps this O(shared-tag edges) instead of comparing every
  // cluster pair. Large cache-data digests contain thousands of clusters.
  const parent = clusters.map((_, i) => i);
  const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const union = (a, b) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pb] = pa;
  };

  // Map tag -> cluster indices, then count how many tags each pair shares.
  // A pair is linked only when it shares >= 2 content tags.
  const tagClusters = new Map();
  clusterTags.forEach((tags, i) => {
    for (const tag of tags) {
      if (!tagClusters.has(tag)) tagClusters.set(tag, []);
      tagClusters.get(tag).push(i);
    }
  });
  const sharedTags = new Map();
  for (const indices of tagClusters.values()) {
    if (indices.length < 2) continue;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const key = indices[i] * clusters.length + indices[j];
        const shared = (sharedTags.get(key) || 0) + 1;
        if (shared >= 2) union(indices[i], indices[j]);
        else sharedTags.set(key, shared);
      }
    }
  }

  // A shared entity appearing in 2+ clusters is enough to link clusters.
  const clusterIndexById = new Map(clusters.map((c, i) => [c.id, i]));
  for (const entity of entities) {
    if (entity.count < 2) continue;
    const indices = entity.clusterIds
      .map(id => clusterIndexById.get(id))
      .filter(i => i !== undefined);
    for (let i = 1; i < indices.length; i++) union(indices[0], indices[i]);
  }

  const components = new Map();
  for (let i = 0; i < clusters.length; i++) {
    const root = find(i);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(i);
  }

  const topics = [];
  for (const comp of components.values()) {
    if (comp.length < 2) continue; // single-cluster "topics" aren't useful
    // Name the topic by the most common content tag among members, falling
    // back to the most common entity name.
    const tagCounts = new Map();
    for (const idx of comp) for (const t of clusterTags[idx]) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
    let name = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!name) {
      // Fall back to the most common entity across members.
      const entCounts = new Map();
      for (const idx of comp) for (const e of (clusters[idx].entities ? Object.values(clusters[idx].entities).flat() : [])) {
        entCounts.set(e, (entCounts.get(e) || 0) + 1);
      }
      name = [...entCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || clusters[comp[0]].category;
    }
    topics.push({
      name,
      clusterIds: comp.map(idx => clusters[idx].id),
      clusterCount: comp.length,
      category: clusters[comp[0]].category,
    });
  }
  topics.sort((a, b) => b.clusterCount - a.clusterCount);
  return topics;
}

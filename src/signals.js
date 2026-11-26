import { saveInterestState, state } from './state.js';

// --- Interest signals (Steam discovery queue style) ---
// Each cluster can be marked 'interested' or 'not-interested' by the user.
// This is an algorithmic signal, not a like/dislike of the story.
// Signals store compact metadata so we can build a local interest profile.

// --- Tag extraction ---
// Tags are computed server-side at build time (compromise NER + TF-IDF) and
// embedded in the digest as cluster.tags. We just read them here.
// Fallback uses trigger words + category for old digests without tags.
export function extractTags(cluster) {
  if (cluster.tags && Array.isArray(cluster.tags)) return cluster.tags;

  // Fallback for clusters without pre-computed tags
  const tags = [];
  const cat = Array.isArray(cluster.category) ? cluster.category[0] : cluster.category;
  if (cat && cat !== 'Other' && cat !== 'General') tags.push(cat.toLowerCase());
  for (const tw of (cluster.triggerWords || [])) {
    const lt = tw.toLowerCase().trim();
    if (lt && lt.length >= 2) tags.push(lt);
  }
  const plugin = cluster.stories?.find(s => s.plugin)?.plugin;
  if (plugin) tags.push(plugin.toLowerCase());
  return [...new Set(tags)].slice(0, 12);
}

export function buildSignalMeta(cluster) {
  const cat = Array.isArray(cluster.category) ? cluster.category[0] || 'Other' : (cluster.category || 'Other');
  const sources = [...new Set((cluster.stories || []).map(s => s.sourceName).filter(Boolean))].slice(0, 3);
  return {
    h: (cluster.headline || '').slice(0, 120),
    cat,
    tags: extractTags(cluster),
    src: sources,
  };
}

// Backfill tags for signals saved before metadata enrichment was added
export function backfillInterestSignals(clusters) {
  const clusterMap = new Map(clusters.map(c => [c.id, c]));
  let changed = false;
  for (const [id, entry] of Object.entries(state.interestState)) {
    if (entry.tags) continue; // already has metadata
    const cluster = clusterMap.get(id);
    if (!cluster) continue; // no longer in digest, can't backfill
    const meta = buildSignalMeta(cluster);
    entry.h = meta.h;
    entry.cat = meta.cat;
    entry.tags = meta.tags;
    entry.src = meta.src;
    changed = true;
  }
  if (changed) saveInterestState();
}

export function getClusterInterest(clusterId) {
  return state.interestState[clusterId]?.signal || null;
}

export function setClusterInterest(cluster, signal) {
  const existing = state.interestState[cluster.id];
  // Toggle off if clicking the same signal again
  if (existing?.signal === signal) {
    delete state.interestState[cluster.id];
  } else {
    state.interestState[cluster.id] = {
      signal,
      at: Date.now(),
      ...buildSignalMeta(cluster),
    };
  }
  saveInterestState();
}

export function getInterestStats() {
  const interested = Object.values(state.interestState).filter(i => i.signal === 'interested').length;
  const notInterested = Object.values(state.interestState).filter(i => i.signal === 'not-interested').length;
  return { interested, notInterested, total: interested + notInterested };
}

// --- Signal-based scoring (v2: specificity-weighted, category-aware) ---
//
// Problems with the old algorithm:
//   1. No tag specificity — "technology" (in 17 clusters) counted the same
//      as "gta 6" (in 1 cluster). Generic tags dominated the score.
//   2. Sources mixed with topics — downvoting BBC sports downranked all BBC.
//   3. No category signal — the category itself is a strong indicator but
//      wasn't used in scoring.
//   4. Competing pool problem — downvoting boring non-gaming news suppressed
//      everything non-gaming because shared generic tags accumulated negative
//      weight, accidentally boosting gaming by default.
//   5. Linear scoring — up and down were treated as opposite ends of one
//      axis, but they're independent dimensions.
//
// New approach:
//   - Tags are weighted by IDF (rarity). A tag in 1 cluster is worth more
//     than one in 15 clusters.
//   - Category is a first-class signal, separate from tags.
//   - Structural tags (category name, plugin name) have capped weight — they're
//     broad buckets, not topic identifiers.
//   - Positive and negative scores are independent dimensions. A story can
//     be "interesting topic" AND "disliked source" — these don't cancel.
//   - The final score is positive - negative, but the filter threshold is
//     asymmetric: it takes more negative signal to hide a story than positive
//     signal to boost it (avoids accidental suppression).

let _cachedProfile = null;
let _cachedTagDF = null; // document frequency for IDF calculation
let _allClusters = [];   // set during render, used for IDF calculation

export function setSignalClusters(clusters) {
  _allClusters = clusters;
  _cachedTagDF = null;
}

// Build a tag document-frequency map from the current digest.
// This lets us weight rare tags higher than common ones.
function buildTagDF(clusters) {
  const df = new Map();
  for (const c of clusters) {
    for (const tag of extractTags(c)) {
      df.set(tag, (df.get(tag) || 0) + 1);
    }
  }
  return df;
}

function getTagDF() {
  if (!_cachedTagDF && _allClusters.length) {
    _cachedTagDF = buildTagDF(_allClusters);
  }
  return _cachedTagDF || new Map();
}

// Structural tags are broad buckets (category names, plugin names) — they
// should have lower weight than specific topic tags.
const STRUCTURAL_TAG_PREFIXES = ['xbox', 'playstation', 'nintendo', 'steam'];

function isStructuralTag(tag, cluster) {
  const cat = Array.isArray(cluster.category) ? cluster.category[0] : cluster.category;
  if (cat && tag === cat.toLowerCase()) return true;
  const plugin = cluster.stories?.find(s => s.plugin)?.plugin;
  if (plugin && tag === plugin.toLowerCase()) return true;
  if (STRUCTURAL_TAG_PREFIXES.includes(tag)) return true;
  return false;
}

// Compute the weight of a tag: IDF * count, capped for structural tags.
function tagWeight(tag, count, cluster, df) {
  const docCount = df.size || 1;
  const idf = Math.log(docCount / (df.get(tag) || 1));
  // Clamp IDF to [0.1, 3] — very rare tags get max 3x, very common get min 0.1x
  const clampedIdf = Math.max(0.1, Math.min(3, idf));
  let weight = count * clampedIdf;
  // Cap structural tags at 0.5 — they're broad buckets, not topic identifiers
  if (isStructuralTag(tag, cluster)) weight = Math.min(weight, 0.5);
  return weight;
}

export function buildSignalProfile() {
  const interested = {};   // tag -> count
  const notInterested = {}; // tag -> count
  const catInterested = {}; // category -> count
  const catNotInterested = {}; // category -> count
  let totalInterested = 0;
  let totalNotInterested = 0;

  for (const entry of Object.values(state.interestState)) {
    if (entry.signal === 'interested') {
      totalInterested++;
      if (entry.cat) catInterested[entry.cat.toLowerCase()] = (catInterested[entry.cat.toLowerCase()] || 0) + 1;
      for (const tag of (entry.tags || [])) {
        interested[tag] = (interested[tag] || 0) + 1;
      }
    } else if (entry.signal === 'not-interested') {
      totalNotInterested++;
      if (entry.cat) catNotInterested[entry.cat.toLowerCase()] = (catNotInterested[entry.cat.toLowerCase()] || 0) + 1;
      for (const tag of (entry.tags || [])) {
        notInterested[tag] = (notInterested[tag] || 0) + 1;
      }
    }
  }
  return { interested, notInterested, catInterested, catNotInterested, totalInterested, totalNotInterested };
}

export function getSignalProfile() {
  if (!_cachedProfile) _cachedProfile = buildSignalProfile();
  return _cachedProfile;
}

export function refreshSignalProfile() {
  _cachedProfile = buildSignalProfile();
  _cachedTagDF = null;
}

export function scoreClusterAgainstSignals(cluster) {
  const tags = extractTags(cluster);
  const tagSet = new Set(tags);
  const profile = getSignalProfile();
  const df = getTagDF();
  const cat = (Array.isArray(cluster.category) ? cluster.category[0] : cluster.category || '').toLowerCase();

  let posScore = 0, negScore = 0;
  const matchedTags = [];

  // --- Tag-based scoring (IDF-weighted) ---
  for (const tag of tagSet) {
    if (profile.interested[tag]) {
      const w = tagWeight(tag, profile.interested[tag], cluster, df);
      posScore += w;
      matchedTags.push({ tag, weight: w, signal: 'interested' });
    }
    if (profile.notInterested[tag]) {
      const w = tagWeight(tag, profile.notInterested[tag], cluster, df);
      negScore += w;
      matchedTags.push({ tag, weight: w, signal: 'not-interested' });
    }
  }

  // --- Category-based scoring ---
  // Category is a strong signal but has lower max weight than specific tags.
  // This catches "I like sport" even when individual sport stories don't share
  // many tags, and "I don't like celebrity" without needing every celebrity
  // name to be downvoted.
  if (cat && profile.catInterested[cat]) {
    const catWeight = Math.min(profile.catInterested[cat] * 0.5, 2);
    posScore += catWeight;
    matchedTags.push({ tag: `[category: ${cat}]`, weight: catWeight, signal: 'interested' });
  }
  if (cat && profile.catNotInterested[cat]) {
    const catWeight = Math.min(profile.catNotInterested[cat] * 0.5, 2);
    negScore += catWeight;
    matchedTags.push({ tag: `[category: ${cat}]`, weight: catWeight, signal: 'not-interested' });
  }

  // --- Competing pool compensation ---
  // If the user has downvoted a LOT of stories (e.g. 20+), the negative
  // weights accumulate across many tags and can swamp any story that shares
  // even one generic tag with a downvoted story. To compensate, we scale down
  // the negative score when the user has downvoted many stories — the more
  // they've downvoted, the more we discount the negative signal, because
  // at high volumes it's more about filtering noise than expressing topic
  // preferences.
  if (profile.totalNotInterested > 10) {
    const dampening = Math.max(0.3, 1 - (profile.totalNotInterested - 10) * 0.05);
    negScore *= dampening;
  }

  // The final score is positive - negative, but with asymmetric thresholds:
  // it takes more negative signal to hide a story (threshold -5) than
  // positive signal to boost it (threshold +2). This prevents accidental
  // suppression from accumulated generic-tag negative weight.
  const score = posScore - negScore;
  const signalType = score > 1 ? 'interested' : score < -3 ? 'not-interested' : null;
  return { score, posScore, negScore, matchedTags, signalType };
}

export function getTopSignalTags(signalType, limit = 10) {
  // Use fresh profile for changelog display, not the cached page-load one
  const profile = buildSignalProfile();
  const df = getTagDF();
  const bucket = signalType === 'interested' ? profile.interested : profile.notInterested;
  // Sort by IDF-weighted count (rare + frequent = strongest signal)
  return Object.entries(bucket)
    .map(([tag, count]) => {
      const idf = Math.log((df.size || 1) / (df.get(tag) || 1));
      const clampedIdf = Math.max(0.1, Math.min(3, idf));
      return [tag, count, count * clampedIdf];
    })
    .sort((a, b) => b[2] - a[2])
    .slice(0, limit)
    .map(([tag, count]) => [tag, count]);
}

export function removeTagFromSignals(tag, signalType) {
  for (const id of Object.keys(state.interestState)) {
    const entry = state.interestState[id];
    if (entry.signal !== signalType) continue;
    if (entry.tags && entry.tags.includes(tag)) {
      entry.tags = entry.tags.filter(t => t !== tag);
      if (entry.tags.length === 0 && !entry.h) {
        // No metadata left at all — drop the signal entirely
        delete state.interestState[id];
      }
    }
  }
  saveInterestState();
}

// Local clustering for news stories.
//
// Replaces the old exact-keyword-overlap grouping with:
//   1. Cross-source dedup — near-identical stories (same event, same outlet
//      wording or wire copy) are merged into one representative.
//   2. Event clustering — DBSCAN over story embeddings groups stories about
//      the same event. Handles synonyms/paraphrases the keyword matcher missed.
//   3. Existing-cluster matching — each new event group is matched to an
//      existing digest cluster by centroid similarity, so stories accumulate
//      into living clusters across runs.
//
// All local CPU work — no API calls.

import { DBSCAN } from 'density-clustering';
import { cosineSim, centroid } from './embeddings.js';

// Thresholds tuned against the embedding model (all-MiniLM-L6-v2):
//   - DEDUP: two stories are the same article if very close (>= 0.92).
//   - CLUSTER: two stories are about the same event if >= 0.65. Lowered from
//     0.72 to catch same-event pairs that differ in framing/angle (e.g. a
//     strike action story and the follow-up "strike called off" piece). We
//     tolerate the occasional near-miss — users can tell related-but-distinct
//     stories apart, but missing a real group is worse.
//   - MATCH: a new group matches an existing cluster if its centroid is
//     >= 0.62 similar to the cluster centroid. Slightly below CLUSTER because
//     centroid-to-centroid comparison is more stable than pairwise, and we
//     want ongoing stories to accumulate across runs even as the framing
//     shifts day to day.
// These were chosen from the smoke test (paraphrase ~0.80, unrelated ~0.07)
// and a sweep over the 30-day story store (0.65 catches all confirmed
// same-event pairs without producing false merges).
export const SIM_DEDUP = 0.92;
export const SIM_CLUSTER = 0.65;
export const SIM_MATCH = 0.62;

// stories: [{ id, ... }]
// embeddings: Map<id, number[]>
// Returns: groups of story objects that are near-duplicates of each other,
// plus a flat list of deduped story ids (one representative per group kept
// for clustering, but all members retained for the final cluster).
export function dedupStories(stories, embeddings) {
  const seen = new Set();
  const groups = [];

  for (let i = 0; i < stories.length; i++) {
    if (seen.has(stories[i].id)) continue;
    const group = [stories[i]];
    seen.add(stories[i].id);
    const vi = embeddings.get(stories[i].id);
    if (!vi) { groups.push(group); continue; }

    for (let j = i + 1; j < stories.length; j++) {
      if (seen.has(stories[j].id)) continue;
      const vj = embeddings.get(stories[j].id);
      if (!vj) continue;
      if (cosineSim(vi, vj) >= SIM_DEDUP) {
        group.push(stories[j]);
        seen.add(stories[j].id);
      }
    }
    groups.push(group);
  }

  const dedupedCount = stories.length - groups.length;
  if (dedupedCount > 0) console.log(`Clustering: merged ${dedupedCount} cross-source duplicate stories`);
  return groups;
}

// Cluster a set of stories into event groups using DBSCAN.
// stories: [{ id, ... }] (should be the deduped representatives)
// embeddings: Map<id, number[]>
// Returns: array of groups, each an array of story objects. Singletons become
// their own one-element group (minPts=1) — we never drop a story.
export function clusterEvents(stories, embeddings) {
  const indexed = stories.filter(s => embeddings.has(s.id));
  const noVec = stories.filter(s => !embeddings.has(s.id));
  if (noVec.length) console.log(`Clustering: ${noVec.length} stories have no embedding (will be singletons)`);

  const ids = indexed.map(s => s.id);
  const byId = new Map(indexed.map(s => [s.id, s]));

  const dbscan = new DBSCAN();
  // dataset as plain arrays for the lib. eps is a DISTANCE threshold; our
  // distance is 1 - cosineSim, so eps = 1 - SIM_CLUSTER means two stories are
  // neighbours when their cosine similarity is >= SIM_CLUSTER.
  const dataset = ids.map(id => embeddings.get(id));
  const eps = 1 - SIM_CLUSTER;
  const clustersIdx = dbscan.run(dataset, eps, 1, (a, b) => 1 - cosineSim(a, b));

  const groups = clustersIdx.map(idxArr =>
    idxArr.map(i => byId.get(ids[i]))
  );

  // Stories without embeddings each get their own group.
  for (const s of noVec) groups.push([s]);

  const multi = groups.filter(g => g.length > 1).length;
  console.log(`Clustering: ${groups.length} event groups (${multi} with 2+ stories, ${groups.length - multi} singletons)`);
  return groups;
}

// Match each new event group to an existing digest cluster by centroid
// similarity. Returns an array of assignments:
//   { stories: [...], existingCluster: cluster|null, score: number }
//
// existingClusters: digest.clusters (each needs a centroid computable from
// its member story ids via the embeddings map).
// embeddings: Map<id, number[]> (must contain new + existing story embeddings)
export function matchToExisting(newGroups, existingClusters, embeddings) {
  // Precompute existing cluster centroids.
  const clusterCentroids = existingClusters.map(c => {
    const vecs = (c.stories || [])
      .map(s => embeddings.get(s.id))
      .filter(Boolean);
    return { cluster: c, centroid: vecs.length ? centroid(vecs) : null };
  });

  const assignments = [];
  for (const group of newGroups) {
    const vecs = group.map(s => embeddings.get(s.id)).filter(Boolean);
    const groupCentroid = vecs.length ? centroid(vecs) : null;

    let best = null;
    let bestScore = 0;
    if (groupCentroid) {
      for (const cc of clusterCentroids) {
        if (!cc.centroid) continue;
        const score = cosineSim(groupCentroid, cc.centroid);
        if (score > bestScore) { bestScore = score; best = cc.cluster; }
      }
    }

    if (best && bestScore >= SIM_MATCH) {
      assignments.push({ stories: group, existingCluster: best, score: bestScore });
    } else {
      assignments.push({ stories: group, existingCluster: null, score: bestScore });
    }
  }

  const matched = assignments.filter(a => a.existingCluster).length;
  console.log(`Matching: ${matched}/${assignments.length} new groups matched to existing clusters, ${assignments.length - matched} new clusters`);
  return assignments;
}

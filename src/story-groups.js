// Optional feed grouping over the curated subject-relation tree.
//
// Clusters arrive with a server-assigned `storyGroup` node id (matched at
// build time with fuzzy word-set matching — see scripts/story-group-assign.js),
// so the client never indexes partial strings: it only measures group sizes
// over the pre-assigned nodes and picks a readable branch depth. The exact
// matcher below remains as a fallback for clusters missing a pre-assignment.

import { allocateTreeGroups } from './group-tree.js';
import { STORY_RELATION_TREE } from './story-tree.js';

export const STORY_GROUP_TARGET_CLUSTERS = 40;
export const STORY_GROUP_MIN_CLUSTERS = 4;

const normalisedTermCache = new Map();
const clusterTermCache = new WeakMap();

function normaliseTerm(value) {
  const raw = String(value || '');
  if (!normalisedTermCache.has(raw)) {
    normalisedTermCache.set(raw, raw
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim());
  }
  return normalisedTermCache.get(raw);
}

function termMatches(text, wanted) {
  if (!text || !wanted) return false;
  if (text === wanted) return true;
  const textTokens = text.split(' ');
  const wantedTokens = wanted.split(' ');
  if (wantedTokens.length === 1) return textTokens.includes(wanted);
  for (let i = 0; i <= textTokens.length - wantedTokens.length; i++) {
    let match = true;
    for (let j = 0; j < wantedTokens.length; j++) {
      if (textTokens[i + j] !== wantedTokens[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function clusterTerms(cluster) {
  if (!clusterTermCache.has(cluster)) {
    const entityValues = Object.values(cluster.entities || {}).flat();
    const triggerWords = Array.isArray(cluster.triggerWords) ? cluster.triggerWords : [];
    clusterTermCache.set(cluster, {
      values: [
        ...(cluster.tags || []),
        ...triggerWords,
        ...entityValues,
      ].map(normaliseTerm),
      headline: normaliseTerm(cluster.headline || ''),
    });
  }
  return clusterTermCache.get(cluster);
}

function nodeMatches(cluster, node) {
  const { values, headline } = clusterTerms(cluster);
  for (const term of node.terms || []) {
    const wanted = normaliseTerm(term);
    if (values.some(value => termMatches(value, wanted))) return true;
    if (wanted.includes(' ') && termMatches(headline, wanted)) return true;
  }
  return (node.headlineTerms || []).some(term => termMatches(headline, normaliseTerm(term)));
}

function subtreeMatches(cluster, node) {
  return nodeMatches(cluster, node) ||
    (node.children || []).some(child => subtreeMatches(cluster, child));
}

function bestMatchingNode(node, cluster, path) {
  let best = nodeMatches(cluster, node)
    ? { id: node.id, label: node.label, path }
    : null;
  for (const child of node.children || []) {
    if (!subtreeMatches(cluster, child)) continue;
    const candidate = bestMatchingNode(child, cluster, [...path, child.label]);
    if (candidate && (!best || candidate.path.length > best.path.length)) best = candidate;
  }
  return best;
}

const assignedGroups = new WeakMap();

export function assignStoryGroups(clusters) {
  const items = clusters.map((cluster, index) => ({
    key: cluster.id || `cluster-${index}`,
    cluster,
  }));
  // Server-assigned groups are authoritative: the pipeline matched them with
  // the full fuzzy matcher at build time. Only clusters missing an assignment
  // (older digests, test fixtures) go through the exact client matcher.
  const preAssignedByNode = new Map();
  const unassigned = [];
  for (const item of items) {
    const nodeId = item.cluster.storyGroup?.id;
    if (nodeId) {
      if (!preAssignedByNode.has(nodeId)) preAssignedByNode.set(nodeId, []);
      preAssignedByNode.get(nodeId).push(item.key);
    } else {
      unassigned.push(item);
    }
  }
  if (!unassigned.length) {
    const { groups } = allocateTreeGroups({
      roots: STORY_RELATION_TREE,
      items,
      getNodeKeys: node => preAssignedByNode.get(node.id) || [],
      targetSize: STORY_GROUP_TARGET_CLUSTERS,
      minBranchSize: STORY_GROUP_MIN_CLUSTERS,
    });
    const assignments = new Map();
    for (const item of items) assignedGroups.set(item.cluster, null);
    groups.forEach((group, order) => {
      const summary = {
        id: group.id,
        label: group.label,
        path: group.path.join(' / '),
        order,
        size: group.weight,
      };
      for (const item of group.items) {
        assignments.set(item.key, summary);
        assignedGroups.set(item.cluster, summary);
      }
    });
    return { groups, assignments };
  }
  const itemKeysByTerm = new Map();
  const termValuesByToken = new Map();
  const headlineByKey = new Map();
  const itemKeysByHeadlineToken = new Map();
  // Only unassigned items enter the fallback index — pre-assigned clusters
  // already anchor to their server-matched node and must not double-claim.
  for (const item of unassigned) {
    const { values, headline } = clusterTerms(item.cluster);
    headlineByKey.set(item.key, headline);
    for (const token of new Set(headline.split(' ').filter(Boolean))) {
      if (!itemKeysByHeadlineToken.has(token)) itemKeysByHeadlineToken.set(token, new Set());
      itemKeysByHeadlineToken.get(token).add(item.key);
    }
    for (const value of new Set(values)) {
      if (!itemKeysByTerm.has(value)) itemKeysByTerm.set(value, new Set());
      itemKeysByTerm.get(value).add(item.key);
    }
  }
  for (const value of itemKeysByTerm.keys()) {
    for (const token of value.split(' ')) {
      if (!termValuesByToken.has(token)) termValuesByToken.set(token, new Set());
      termValuesByToken.get(token).add(value);
    }
  }
  const keysForTerm = new Map();
  const itemKeysForTerm = (term, headlineSingle = false) => {
    const wanted = normaliseTerm(term);
    const cacheKey = `${headlineSingle ? 'h:' : ''}${wanted}`;
    if (!keysForTerm.has(cacheKey)) {
      const tokens = wanted.split(' ').filter(Boolean);
      let candidates = itemKeysByTerm.keys();
      if (tokens.length) {
        candidates = [...termValuesByToken.get(tokens[0]) || []];
        for (const token of tokens.slice(1)) {
          const tokenValues = termValuesByToken.get(token) || new Set();
          candidates = candidates.filter(value => tokenValues.has(value));
        }
      }
      const keys = new Set();
      for (const value of candidates) {
        if (termMatches(value, wanted)) itemKeysByTerm.get(value).forEach(key => keys.add(key));
      }
      if (tokens.length > 1 || headlineSingle) {
        for (const key of itemKeysByHeadlineToken.get(tokens[0]) || []) {
          if (termMatches(headlineByKey.get(key), wanted)) keys.add(key);
        }
      }
      keysForTerm.set(cacheKey, keys);
    }
    return keysForTerm.get(cacheKey);
  };
  const { groups } = allocateTreeGroups({
    roots: STORY_RELATION_TREE,
    items,
    getNodeKeys: node => [
      ...(preAssignedByNode.get(node.id) || []),
      ...(node.terms || []).flatMap(term => [...itemKeysForTerm(term)]),
      ...(node.headlineTerms || []).flatMap(term => [...itemKeysForTerm(term, true)]),
    ],
    targetSize: STORY_GROUP_TARGET_CLUSTERS,
    minBranchSize: STORY_GROUP_MIN_CLUSTERS,
  });

  const assignments = new Map();
  for (const item of items) assignedGroups.set(item.cluster, null);
  groups.forEach((group, order) => {
    const summary = {
      id: group.id,
      label: group.label,
      path: group.path.join(' / '),
      order,
      size: group.weight,
    };
    for (const item of group.items) {
      assignments.set(item.key, summary);
      assignedGroups.set(item.cluster, summary);
    }
  });
  return { groups, assignments };
}

export function getClusterStoryGroup(cluster) {
  if (assignedGroups.has(cluster)) return assignedGroups.get(cluster);
  if (cluster.storyGroup) {
    return {
      id: cluster.storyGroup.id,
      label: cluster.storyGroup.label,
      path: (cluster.storyGroup.path || []).join(' / '),
    };
  }

  for (const root of STORY_RELATION_TREE) {
    const match = bestMatchingNode(root, cluster, [root.label]);
    if (match) return { ...match, path: match.path.join(' / ') };
  }
  return null;
}

// Structured grouping for the feed: clusters in feed order are partitioned
// into rollup containers (ordered by their best member's feed position) plus
// the ungrouped tail. This is the dedup view — near-duplicate coverage
// consolidates into one collapsible unit instead of scattering through the
// feed. Returns null when grouping is disabled.
export function groupClustersForFeed(clusters, enabled) {
  if (!enabled) return null;
  const { groups, assignments } = assignStoryGroups(clusters);

  const positionByCluster = new Map(clusters.map((cluster, index) => [cluster, index]));
  const membersByGroup = new Map();
  const ungrouped = [];
  clusters.forEach((cluster, index) => {
    const key = cluster.id || `cluster-${index}`;
    const assigned = assignments.get(key);
    if (!assigned) {
      ungrouped.push(cluster);
      return;
    }
    if (!membersByGroup.has(assigned.id)) {
      membersByGroup.set(assigned.id, { ...assigned, clusters: [] });
    }
    membersByGroup.get(assigned.id).clusters.push(cluster);
  });

  // assignment summaries carry path as a joined string; the raw allocated
  // groups keep the array, which container headers need for the crumb
  const rawById = new Map(groups.map(group => [group.id, group]));
  const grouped = [...membersByGroup.values()]
    .map(group => ({
      ...group,
      pathParts: rawById.get(group.id)?.path || String(group.path).split(' / '),
      top: Math.min(...group.clusters.map(c => positionByCluster.get(c) ?? Infinity)),
    }))
    .sort((a, b) => a.top - b.top);
  return { groups: grouped, ungrouped };
}

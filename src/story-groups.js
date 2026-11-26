// Optional feed grouping over the curated subject-relation tree.
//
// The tree defines every eligible pool. Runtime code only measures cluster
// counts, selects a readable branch depth, and assigns each cluster once.

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
    clusterTermCache.set(cluster, [
      ...(cluster.tags || []),
      ...triggerWords,
      ...entityValues,
    ].map(normaliseTerm));
  }
  return clusterTermCache.get(cluster);
}

function nodeMatches(cluster, node) {
  const terms = node.terms || [];
  if (!terms.length) return false;
  const values = clusterTerms(cluster);
  return values.some(value => terms.some(term => termMatches(value, normaliseTerm(term))));
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
  const itemKeysByTerm = new Map();
  const termValuesByToken = new Map();
  for (const item of items) {
    for (const value of new Set(clusterTerms(item.cluster))) {
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
  const itemKeysForTerm = term => {
    const wanted = normaliseTerm(term);
    if (!keysForTerm.has(wanted)) {
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
      keysForTerm.set(wanted, keys);
    }
    return keysForTerm.get(wanted);
  };
  const { groups } = allocateTreeGroups({
    roots: STORY_RELATION_TREE,
    items,
    getNodeKeys: node => [...(node.terms || []).flatMap(term => [...itemKeysForTerm(term)])],
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

  for (const root of STORY_RELATION_TREE) {
    const match = bestMatchingNode(root, cluster, [root.label]);
    if (match) return { ...match, path: match.path.join(' / ') };
  }
  return null;
}

export function groupClustersByTag(clusters, enabled) {
  if (!enabled) return clusters;
  const { groups, assignments } = assignStoryGroups(clusters);
  const groupOrder = new Map(groups.map((group, index) => [group.id, index]));

  return clusters
    .map((cluster, index) => ({
      cluster,
      index,
      groupIndex: groupOrder.get(assignments.get(cluster.id || `cluster-${index}`)?.id) ?? groups.length,
    }))
    .sort((a, b) => a.groupIndex - b.groupIndex || a.index - b.index)
    .map(entry => entry.cluster);
}

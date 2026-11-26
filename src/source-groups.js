// Group the raw source list into a human-scale convenience filter bar.
//
// The relation tree is curated source data; this module only walks the curated
// pools and chooses the level whose article counts make sense in the current
// digest. Unknown or tiny ungrouped sources collapse into one explicit Other
// branch instead of returning hundreds of controls.

import { allocateTreeGroups } from './group-tree.js';
import { SOURCE_RELATION_TREE } from './source-tree.js';

const TARGET_GROUP_ARTICLES = 80;
const MIN_GROUP_ARTICLES = 10;
export const INDIVIDUAL_SOURCE_MIN_ARTICLES = 20;

export const OTHER_SOURCE_KEY = 'other-sources';

// Inclusion visibility: empty inclusion set means everything is visible.
// When the set is non-empty a host is visible only if the control that owns
// it (its allocated group, its own individual control, or Other Sources) is
// in the set. Hosts with no control in the current bar have nothing selecting
// them, so they stay hidden while a selection is active.
export function isSourceVisible(sourceKey, sourceInclude = {}, controlByHost = new Map()) {
  if (!sourceKey) return true;
  if (!Object.keys(sourceInclude).length) return true;
  const control = controlByHost.get(sourceKey);
  if (!control) return false;
  return sourceInclude[control] === true;
}

function summarizeGroup(choice) {
  return {
    key: `group:${choice.id}`,
    groupId: choice.id,
    rootId: choice.rootId,
    label: choice.label,
    icon: choice.node.icon || choice.keys[0],
    path: choice.path,
    count: choice.weight,
    sourceCount: choice.items.length,
    sourceKeys: choice.keys,
    sources: choice.items,
    grouped: true,
  };
}

export function groupSourceOptions(sourceOptions, sourceInclude = {}) {
  const { groups, claimed } = allocateTreeGroups({
    roots: SOURCE_RELATION_TREE,
    items: sourceOptions,
    getNodeKeys: node => node.sources || [],
    getItemWeight: source => source.count,
    targetSize: TARGET_GROUP_ARTICLES,
    minBranchSize: MIN_GROUP_ARTICLES,
  });

  const ungrouped = sourceOptions.filter(source => !claimed.has(source.key));
  // Individually-included hosts always surface as their own control, even
  // below the usual prominence cutoff — otherwise a shrinking digest could
  // strand an inclusion key with no clickable control to clear it.
  const individualSources = ungrouped.filter(source =>
    source.count >= INDIVIDUAL_SOURCE_MIN_ARTICLES || sourceInclude[source.key] === true
  );
  const individualKeys = new Set(individualSources.map(source => source.key));
  const otherSources = ungrouped.filter(source => !individualKeys.has(source.key));
  const otherSourceKeys = new Set(otherSources.map(source => source.key));

  const options = groups.map(choice => summarizeGroup(choice));
  const explicitSources = individualSources.map(source => ({
    ...source,
    grouped: false,
    otherMember: source.count < INDIVIDUAL_SOURCE_MIN_ARTICLES,
  }));

  if (otherSources.length) {
    options.push({
      key: `group:${OTHER_SOURCE_KEY}`,
      groupId: OTHER_SOURCE_KEY,
      rootId: OTHER_SOURCE_KEY,
      label: 'Other Sources',
      icon: 'concept:other',
      path: ['Other Sources'],
      count: otherSources.reduce((sum, source) => sum + source.count, 0),
      sourceCount: otherSources.length,
      sourceKeys: otherSources.map(source => source.key),
      sources: otherSources,
      grouped: true,
      otherGroup: true,
    });
  }

  const sorted = [...options, ...explicitSources].sort((a, b) =>
    b.count - a.count || a.label.localeCompare(b.label)
  );

  // Every host belongs to exactly one control (allocation is disjoint), so
  // visibility is a single lookup while a selection is active.
  const controlByHost = new Map();
  for (const control of sorted) {
    const keys = control.grouped ? control.sourceKeys : [control.key];
    for (const key of keys) controlByHost.set(key, control.key);
  }
  for (const control of sorted) control.included = sourceInclude[control.key] === true;

  return {
    options: sorted,
    groupedSourceKeys: claimed,
    otherSourceKeys,
    controlByHost,
  };
}

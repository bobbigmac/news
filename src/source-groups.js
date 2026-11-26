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

export function isSourceVisible(sourceKey, sourceFilters = {}, otherSourceKeys = new Set()) {
  if (!sourceKey) return true;
  if (sourceFilters[sourceKey] === false) return false;
  if (sourceFilters[sourceKey] === true) return true;
  if (otherSourceKeys.has(sourceKey)) return sourceFilters[OTHER_SOURCE_KEY] !== false;
  return true;
}

function summarizeGroup(choice, isVisible) {
  const members = choice.items;
  const displayedMembers = members.filter(source => isVisible(source.key));
  const displayed = displayedMembers.length === members.length;
  return {
    key: `group:${choice.id}`,
    groupId: choice.id,
    rootId: choice.rootId,
    label: choice.label,
    icon: choice.node.icon || choice.keys[0],
    path: choice.path,
    count: choice.weight,
    sourceCount: members.length,
    sourceKeys: choice.keys,
    sources: members,
    displayed,
    mixed: displayedMembers.length > 0 && !displayed,
    grouped: true,
    preferenceKeys: choice.keys,
  };
}

export function groupSourceOptions(sourceOptions, sourceFilters = {}) {
  const { groups, claimed } = allocateTreeGroups({
    roots: SOURCE_RELATION_TREE,
    items: sourceOptions,
    getNodeKeys: node => node.sources || [],
    getItemWeight: source => source.count,
    targetSize: TARGET_GROUP_ARTICLES,
    minBranchSize: MIN_GROUP_ARTICLES,
  });

  const ungrouped = sourceOptions.filter(source => !claimed.has(source.key));
  const individualSources = ungrouped.filter(source =>
    source.count >= INDIVIDUAL_SOURCE_MIN_ARTICLES ||
    sourceFilters[source.key] === false ||
    sourceFilters[source.key] === true
  );
  const individualKeys = new Set(individualSources.map(source => source.key));
  const otherSources = ungrouped.filter(source => !individualKeys.has(source.key));
  const otherSourceKeys = new Set(otherSources.map(source => source.key));
  const isVisible = sourceKey => isSourceVisible(sourceKey, sourceFilters, otherSourceKeys);

  const options = groups.map(choice => summarizeGroup(choice, isVisible));
  const explicitSources = individualSources.map(source => ({
    ...source,
    displayed: isVisible(source.key),
    grouped: false,
    otherMember: source.count < INDIVIDUAL_SOURCE_MIN_ARTICLES,
  }));

  if (otherSources.length) {
    options.push({
      key: `group:${OTHER_SOURCE_KEY}`,
      groupId: OTHER_SOURCE_KEY,
      rootId: OTHER_SOURCE_KEY,
      label: 'Other Sources',
      icon: otherSources[0]?.icon || otherSources[0]?.key,
      path: ['Other Sources'],
      count: otherSources.reduce((sum, source) => sum + source.count, 0),
      sourceCount: otherSources.length,
      sourceKeys: otherSources.map(source => source.key),
      sources: otherSources,
      displayed: sourceFilters[OTHER_SOURCE_KEY] !== false,
      mixed: false,
      grouped: true,
      otherGroup: true,
      preferenceKeys: [OTHER_SOURCE_KEY],
    });
  }

  return {
    options: [...options, ...explicitSources].sort((a, b) =>
      b.count - a.count || a.label.localeCompare(b.label)
    ),
    groupedSourceKeys: claimed,
    otherSourceKeys,
  };
}

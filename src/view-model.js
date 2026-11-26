import { groupSourceOptions, isSourceVisible } from './source-groups.js';

// Pure view-model construction for the broadsheet.
//
// The UI has two different source concepts that are easy to conflate:
//   - disabledSources: sources removed from the reader's feed in Manage Sources
//   - sourceFilters: temporary display filters in the top filter panel
// This module keeps the filter pipeline explicit so rendering code does not
// reinvent slightly different versions of the same state in several places.

export { INDIVIDUAL_SOURCE_MIN_ARTICLES } from './source-groups.js';

export function canonicalCategory(category) {
  const raw = Array.isArray(category) ? category[0] : category;
  const cleaned = String(raw || 'Other').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Other';
  if (cleaned.toLowerCase() === 'sports') return 'Sport';
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function sourceKeyFromUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function prettifySourceKey(key) {
  const parts = key.split('.').filter(Boolean);
  if (!parts.length) return 'Unknown';
  const compoundTlds = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.kr', 'com.my', 'com.pk', 'co.za', 'com.ng', 'com.sa']);
  const lastTwo = parts.slice(-2).join('.');
  const baseIndex = compoundTlds.has(lastTwo) ? parts.length - 3 : parts.length - 2;
  const base = parts[Math.max(0, baseIndex)] || parts[0];
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getNewestStoryDate(cluster) {
  const dates = (cluster.stories || [])
    .map(s => s.published)
    .filter(Boolean)
    .map(d => {
      try { return new Date(d).getTime(); } catch { return 0; }
    })
    .filter(Boolean);
  if (!dates.length) return cluster.updated || cluster.created || '';
  return new Date(Math.max(...dates)).toISOString();
}

export function filterByMode(clusters, mode) {
  if (mode === 'all') return clusters;
  if (mode === 'main') return clusters.filter(c => !c.stories?.some(s => s.plugin));
  if (mode?.startsWith('plugin:')) {
    const plugin = mode.slice(7);
    return clusters.filter(c => c.stories?.some(s => s.plugin === plugin));
  }
  return clusters;
}

function isFeedSource(sourceKey, disabledSources) {
  if (!sourceKey) return true;
  return disabledSources[sourceKey] !== true;
}

export function getFeedStories(cluster, disabledSources) {
  return (cluster.stories || []).filter(story => isFeedSource(sourceKeyFromUrl(story.url), disabledSources));
}

export function getDisplayedStories(cluster, disabledSources, sourceFilters, otherSourceKeys = new Set()) {
  return getFeedStories(cluster, disabledSources)
    .filter(story => isSourceVisible(sourceKeyFromUrl(story.url), sourceFilters, otherSourceKeys));
}

function clusterHasFeedSource(cluster, disabledSources) {
  const stories = cluster.stories || [];
  if (!stories.length) return true;
  return stories.some(story => isFeedSource(sourceKeyFromUrl(story.url), disabledSources));
}

function clusterHasDisplayedSource(cluster, disabledSources, sourceFilters, otherSourceKeys = new Set()) {
  const stories = getFeedStories(cluster, disabledSources);
  if (!stories.length) return false;
  return stories.some(story => isSourceVisible(sourceKeyFromUrl(story.url), sourceFilters, otherSourceKeys));
}

function isClusterRead(cluster, readState) {
  const entry = readState[cluster.id];
  return !!entry && entry.contentVersion >= (cluster.contentVersion || 1);
}

function isClusterUpdatedSinceRead(cluster, readState) {
  const entry = readState[cluster.id];
  return !!entry && (cluster.contentVersion || 1) > entry.contentVersion;
}

function collectSourceOptions(clusters, digestSources, disabledSources, { feedOnly }) {
  const labels = new Map((digestSources || []).map(source => [source.key, source.label]));
  const byKey = new Map();

  for (const cluster of clusters) {
    const seenInCluster = new Set();
    for (const story of cluster.stories || []) {
      const key = sourceKeyFromUrl(story.url);
      if (!key) continue;
      if (feedOnly && !isFeedSource(key, disabledSources)) continue;
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          label: labels.get(key) || prettifySourceKey(key),
          count: 0,
          clusterCount: 0,
        });
      }
      byKey.get(key).count++;
      seenInCluster.add(key);
    }
    for (const key of seenInCluster) byKey.get(key).clusterCount++;
  }

  return [...byKey.values()].sort((a, b) =>
    b.count - a.count || b.clusterCount - a.clusterCount || a.label.localeCompare(b.label)
  );
}

function collectCategoryOptions(clusters, categoryFilters) {
  const byCategory = new Map();

  for (const cluster of clusters) {
    const category = canonicalCategory(cluster.category);
    if (!byCategory.has(category)) {
      byCategory.set(category, {
        value: category,
        label: category,
        count: 0,
        storyCount: 0,
        active: categoryFilters[category] !== false,
      });
    }
    const entry = byCategory.get(category);
    entry.count++;
    entry.storyCount += (cluster.stories || []).length;
  }

  return [...byCategory.values()].sort((a, b) =>
    b.count - a.count || a.label.localeCompare(b.label)
  );
}

export function buildViewModel({
  clusters,
  digestSources = [],
  settings,
  catPrefs = {},
  sourceFilters = {},
  disabledSources = {},
  readState = {},
  isSignalVisible = () => true,
}) {
  const modeFiltered = filterByMode(clusters, settings.mode);

  const ageDays = parseInt(settings.ageLimit, 10) || 30;
  const ageCutoff = Date.now() - ageDays * 24 * 60 * 60 * 1000;
  const ageFiltered = modeFiltered.filter(cluster => {
    const newest = getNewestStoryDate(cluster);
    try { return new Date(newest).getTime() >= ageCutoff; } catch { return true; }
  });

  const categoryPrefFiltered = ageFiltered.filter(cluster =>
    (catPrefs[canonicalCategory(cluster.category)] || 'normal') !== 'hide'
  );

  const signalFiltered = categoryPrefFiltered.filter(isSignalVisible);

  const mastheadCategoryFiltered = settings.categoryFilter === 'all'
    ? signalFiltered
    : signalFiltered.filter(cluster => canonicalCategory(cluster.category) === settings.categoryFilter);

  // Read visibility is part of the visible pool: source/category counts describe
  // what can actually be shown now, not stale catch-up items already read.
  const readVisiblePool = mastheadCategoryFiltered.filter(cluster => {
    if (!isClusterRead(cluster, readState)) return true;
    return settings.showUpdated && isClusterUpdatedSinceRead(cluster, readState);
  });

  // The management inventory is the age/mode corpus before read state,
  // display filters, or hard source exclusions. Management screens need stable
  // counts: after a catch-up everything is read, but the source inventory has
  // not actually changed.
  const inventoryPool = ageFiltered;
  const allSourceOptions = collectSourceOptions(inventoryPool, digestSources, disabledSources, { feedOnly: false })
    .map(source => ({ ...source, disabled: disabledSources[source.key] === true }));

  // The pre-feed pool intentionally still contains hard-disabled sources. That
  // lets the display model keep the exclusion boundary explicit.
  const preFeedPool = readVisiblePool;
  const feedPool = preFeedPool.filter(cluster => clusterHasFeedSource(cluster, disabledSources));

  // Header source counts are calculated before temporary display filters are
  // applied, so a filtered-out branch still shows how many items it would restore.
  // The raw host list is collapsed through the curated relation tree; known
  // hosts become readable branches, prominent free-standing hosts stay
  // individual, and the rest become the explicit Other Sources branch.
  const sourceGrouping = groupSourceOptions(
    collectSourceOptions(feedPool, digestSources, disabledSources, { feedOnly: true }),
    sourceFilters,
  );
  const sourceOptions = sourceGrouping.options;

  const sourceView = feedPool.filter(cluster =>
    clusterHasDisplayedSource(cluster, disabledSources, sourceFilters, sourceGrouping.otherSourceKeys)
  );

  const categoryFilters = settings.categoryFilter === 'all'
    ? (settings.categoryDisplayFilters || {})
    : {};
  const categoryOptions = collectCategoryOptions(sourceView, categoryFilters);
  const visibleClusters = sourceView.filter(cluster =>
    categoryFilters[canonicalCategory(cluster.category)] !== false
  );

  return {
    modeFiltered,
    ageFiltered,
    categoryPrefFiltered,
    signalFiltered,
    mastheadCategoryFiltered,
    inventoryPool,
    preFeedPool,
    feedPool,
    sourceView,
    visibleClusters,
    sourceOptions,
    otherSourceKeys: sourceGrouping.otherSourceKeys,
    allSourceOptions,
    categoryOptions,
    categoryRowEnabled: settings.categoryFilter === 'all',
  };
}

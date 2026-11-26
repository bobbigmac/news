import { CAT_PREF_ORDER, getCatPref } from './state.js';
import { canonicalCategory, getNewestStoryDate } from './view-model.js';
import { getClusterInterest, scoreClusterAgainstSignals } from './signals.js';

export function sortClusters(clusters, sortMode) {
  const sorted = [...clusters];
  sorted.sort((a, b) => {
    // Explicit interest signal: interested ranks above all, not-interested ranks below all
    const aInterest = getClusterInterest(a.id);
    const bInterest = getClusterInterest(b.id);
    const aRank = aInterest === 'interested' ? 0 : aInterest === 'not-interested' ? 2 : 1;
    const bRank = bInterest === 'interested' ? 0 : bInterest === 'not-interested' ? 2 : 1;
    if (aRank !== bRank) return aRank - bRank;

    // Signal-derived score: tag overlap with past signals
    const aSignal = scoreClusterAgainstSignals(a);
    const bSignal = scoreClusterAgainstSignals(b);
    if (aSignal.score !== bSignal.score) return bSignal.score - aSignal.score;

    // Category preference takes priority within same signal tier
    const aPref = CAT_PREF_ORDER[getCatPref(a.category)] ?? 1;
    const bPref = CAT_PREF_ORDER[getCatPref(b.category)] ?? 1;
    if (aPref !== bPref) return aPref - bPref;

    // Within same preference tier, apply the selected sort mode
    if (sortMode === 'recent') {
      return String(getNewestStoryDate(b)).localeCompare(String(getNewestStoryDate(a)));
    } else {
      return (b.stories?.length || 0) - (a.stories?.length || 0);
    }
  });
  return sorted;
}

export function getAvailableModes(clusters) {
  const modes = [{ value: 'all', label: 'All' }, { value: 'main', label: 'Main' }];
  const seen = new Set();
  for (const cluster of clusters) {
    const plugin = cluster.stories?.find(s => s.plugin)?.plugin;
    if (plugin && !seen.has(plugin)) {
      seen.add(plugin);
      modes.push({ value: `plugin:${plugin}`, label: plugin });
    }
  }
  return modes;
}

export function getAvailableCategories(clusters) {
  const cats = new Set();
  for (const c of clusters) {
    if (getCatPref(c.category) !== 'hide') cats.add(canonicalCategory(c.category));
  }
  // Sort by category preference priority, then alphabetical
  return [...cats].sort((a, b) => {
    const pa = CAT_PREF_ORDER[getCatPref(a)] ?? 1;
    const pb = CAT_PREF_ORDER[getCatPref(b)] ?? 1;
    if (pa !== pb) return pa - pb;
    return String(a).localeCompare(String(b));
  });
}

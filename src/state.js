import { canonicalCategory, prettifySourceKey, sourceKeyFromUrl } from './view-model.js';

export const SETTINGS_KEY = 'broadsheet-settings';
export const READ_KEY = 'broadsheet-read';
export const GLIMPSE_KEY = 'broadsheet-glimpsed';
export const CAT_PREFS_KEY = 'broadsheet-cat-prefs';
export const INTEREST_KEY = 'broadsheet-interest';
export const SOURCE_INCLUDE_KEY = 'broadsheet-source-include';
export const SOURCE_DISABLED_KEY = 'broadsheet-source-disabled';

export const DEFAULT_SETTINGS = {
  font: 'serif',
  fontsize: 'medium',
  columns: '3',
  sort: 'recent',
  images: 'minimal',
  ageLimit: '7',
  mode: 'all',
  categoryFilter: 'all',
  categoryDisplayFilters: {},
  watchWords: '',
  expandAll: false,
  showUpdated: false,
  groupByTag: false,
  theme: 'auto',
  markRead: 'off'
};

export const THEME_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
];

export const CAT_PREF_OPTIONS = [
  { value: 'favour', label: 'Favour' },
  { value: 'normal', label: 'Normal' },
  { value: 'demote', label: 'Demote' },
  { value: 'hide', label: 'Hide' },
];
export const CAT_PREF_ORDER = { favour: 0, normal: 1, demote: 2, hide: 3 };

export const FONT_THEMES = [
  { value: 'serif', label: 'Serif', className: 'font-serif', family: 'Georgia, "Times New Roman", "Noto Serif", serif' },
  { value: 'sans', label: 'Sans', className: 'font-sans', family: '"Helvetica Neue", Arial, sans-serif' },
  { value: 'modern', label: 'Modern', className: 'font-modern', family: 'Outfit, system-ui, sans-serif' },
  { value: 'accessible', label: 'Assist', className: 'font-accessible', family: 'OpenDyslexic, system-ui, sans-serif' },
];

export const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export const COLUMN_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
];

export const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'stories', label: 'Most stories' },
];

export const IMAGE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'latest', label: 'Latest' },
  { value: 'all', label: 'All' },
];

export const AGE_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
];

export const MARK_READ_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'hover', label: 'Hover' },
  { value: 'focus', label: 'Focus' },
  { value: 'turbo', label: 'Turbo' },
];

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const settings = { ...DEFAULT_SETTINGS, ...saved };
    if (!settings.categoryDisplayFilters || Array.isArray(settings.categoryDisplayFilters) || typeof settings.categoryDisplayFilters !== 'object') {
      settings.categoryDisplayFilters = {};
    }
    // Inclusion model: only true values are meaningful. Legacy filter-out
    // entries (false) are dropped — hidden is no longer a display-filter state.
    for (const [cat, val] of Object.entries(settings.categoryDisplayFilters)) {
      if (val !== true) delete settings.categoryDisplayFilters[cat];
    }
    // Single-select now: collapse any legacy multi-select to the first entry.
    const catKeys = Object.keys(settings.categoryDisplayFilters);
    if (catKeys.length > 1) {
      settings.categoryDisplayFilters = { [catKeys[0]]: true };
    }
    // The masthead mode/category cyclers were removed; pin the pass-through
    // values so a stale saved preference can't silently filter the feed with
    // no UI left to change it back.
    settings.mode = 'all';
    settings.categoryFilter = 'all';
    if (settings.categoryFilter === 'other') settings.categoryFilter = 'all';
    return settings;
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadCatPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(CAT_PREFS_KEY) || '{}');
    const migrated = {};
    for (const [cat, pref] of Object.entries(saved)) migrated[canonicalCategory(cat)] = pref;
    return migrated;
  } catch { return {}; }
}

export const state = {
  clientPerf: {},
  digest: null,
  settings: loadSettings(),
  visibleClusters: [],
  viewModel: null,
  readState: loadJson(READ_KEY, {}),
  glimpseState: loadJson(GLIMPSE_KEY, {}),
  catPrefs: loadCatPrefs(),
  sourceInclude: loadJson(SOURCE_INCLUDE_KEY, {}),
  disabledSources: loadJson(SOURCE_DISABLED_KEY, {}),
  interestState: loadJson(INTEREST_KEY, {}),
};

// The application shell registers these after renderDigest/initSearch exist.
// Feature modules use them instead of importing the shell, keeping the module
// dependency graph acyclic.
export const ui = {
  refresh() {},
  relayout() {},
  syncFeed() { return false; },
  updateReadCount() {},
};

export function saveReadState() {
  localStorage.setItem(READ_KEY, JSON.stringify(state.readState));
}

export function saveGlimpseState() {
  localStorage.setItem(GLIMPSE_KEY, JSON.stringify(state.glimpseState));
}

export function saveCatPrefs() {
  localStorage.setItem(CAT_PREFS_KEY, JSON.stringify(state.catPrefs));
}

export function saveSourceInclude() {
  localStorage.setItem(SOURCE_INCLUDE_KEY, JSON.stringify(state.sourceInclude));
}

export function saveDisabledSources() {
  localStorage.setItem(SOURCE_DISABLED_KEY, JSON.stringify(state.disabledSources));
}

export function saveInterestState() {
  localStorage.setItem(INTEREST_KEY, JSON.stringify(state.interestState));
}

export function applySettings(settings = state.settings) {
  document.body.className = '';
  const fontTheme = FONT_THEMES.find(f => f.value === settings.font) || FONT_THEMES[0];
  document.body.classList.add(fontTheme.className);
  document.documentElement.className = `font-${settings.fontsize}`;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = settings.theme === 'auto' ? (prefersDark ? 'night' : 'day') : settings.theme;
  document.documentElement.setAttribute('data-theme', effective);
  const sheet = document.getElementById('broadsheet');
  // Preserve render-owned classes (grouped-feed) — className is shared state,
  // not ours to overwrite wholesale.
  const grouped = sheet.classList.contains('grouped-feed');
  sheet.className = `broadsheet cols-${settings.columns}`;
  if (grouped) sheet.classList.add('grouped-feed');
}

// Source display filters are filter-TO (inclusion), not filter-out: the set
// holds control keys (group:<id> or individual host keys). Empty = everything
// visible. Toggling a control adds/removes it; selecting nothing means all.
export function isSourceIncludeActive() {
  return Object.keys(state.sourceInclude).length > 0;
}

export function toggleSourceInclude(controlKey) {
  if (!controlKey) return;
  if (state.sourceInclude[controlKey]) delete state.sourceInclude[controlKey];
  else state.sourceInclude[controlKey] = true;
  saveSourceInclude();
}

export function clearSourceInclude() {
  state.sourceInclude = {};
  saveSourceInclude();
}

export function toggleCategoryInclude(category) {
  if (!category) return;
  const filters = state.settings.categoryDisplayFilters;
  const isSoleSelection = filters[category] === true && Object.keys(filters).length === 1;
  // Single-select restrict-TO: clicking a category makes it the only filter;
  // clicking the active one clears back to everything.
  state.settings.categoryDisplayFilters = isSoleSelection ? {} : { [category]: true };
  saveSettings();
}

export function clearCategoryInclude() {
  state.settings.categoryDisplayFilters = {};
  saveSettings();
}

export function setSourceFeedDisabled(sourceKey, disabled) {
  if (!sourceKey) return;
  if (disabled) state.disabledSources[sourceKey] = true;
  else delete state.disabledSources[sourceKey];
  saveDisabledSources();
}

export function getCatPref(category) {
  return state.catPrefs[canonicalCategory(category)] || 'normal';
}

export function collectSourcesFromDigest(digest) {
  if (Array.isArray(digest?.sources) && digest.sources.length) return digest.sources;

  // Fallback for older digest files that predate the additive sources index.
  const byKey = new Map();
  for (const cluster of digest?.clusters || []) {
    for (const story of cluster.stories || []) {
      const key = sourceKeyFromUrl(story.url);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, { key, label: prettifySourceKey(key), count: 0 });
      byKey.get(key).count++;
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function getAllKnownCategories(clusters) {
  const fromDigest = new Set();
  for (const c of clusters) {
    if (c.category) fromDigest.add(canonicalCategory(c.category));
  }
  for (const cat of Object.keys(state.catPrefs)) {
    fromDigest.add(cat);
  }
  return [...fromDigest].sort();
}

export function getWatchWords() {
  return (state.settings.watchWords || '')
    .split(',')
    .map(w => w.trim().toLowerCase())
    .filter(Boolean);
}

export function matchesWatchWords(cluster) {
  const words = getWatchWords();
  if (!words.length) return false;
  const haystack = [
    cluster.headline || '',
    cluster.summary || '',
    ...(cluster.stories || []).map(s => s.title || ''),
  ].join(' ').toLowerCase();
  return words.some(w => haystack.includes(w));
}

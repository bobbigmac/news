const SETTINGS_KEY = 'broadsheet-settings';
const READ_KEY = 'broadsheet-read';
const CAT_PREFS_KEY = 'broadsheet-cat-prefs';
const INTEREST_KEY = 'broadsheet-interest';
const DEFAULT_SETTINGS = {
  font: 'serif',
  fontsize: 'medium',
  columns: '3',
  sort: 'recent',
  images: 'minimal',
  mode: 'all',
  categoryFilter: 'all',
  watchWords: '',
  expandAll: false,
  showUpdated: false
};

const CAT_PREF_OPTIONS = [
  { value: 'favour', label: 'Favour' },
  { value: 'normal', label: 'Normal' },
  { value: 'demote', label: 'Demote' },
  { value: 'hide', label: 'Hide' },
];
const CAT_PREF_ORDER = { favour: 0, normal: 1, demote: 2, hide: 3 };

const FONT_THEMES = [
  { value: 'serif', label: 'Serif', className: 'font-serif', family: 'Georgia, "Times New Roman", "Noto Serif", serif' },
  { value: 'sans', label: 'Sans', className: 'font-sans', family: '"Helvetica Neue", Arial, sans-serif' },
  { value: 'modern', label: 'Modern', className: 'font-modern', family: 'Outfit, system-ui, sans-serif' },
  { value: 'accessible', label: 'Assist', className: 'font-accessible', family: 'OpenDyslexic, system-ui, sans-serif' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const COLUMN_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'stories', label: 'Most stories' },
];

const IMAGE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'all', label: 'All' },
];

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applySettings(settings) {
  document.body.className = '';
  // Font theme
  const fontTheme = FONT_THEMES.find(f => f.value === settings.font) || FONT_THEMES[0];
  document.body.classList.add(fontTheme.className);
  // Font size — applied to :root so rem units scale
  document.documentElement.className = `font-${settings.fontsize}`;
  // Columns
  const sheet = document.getElementById('broadsheet');
  sheet.className = `broadsheet cols-${settings.columns}`;
}

let currentDigest = null;
let currentSettings = loadSettings();
let readState = loadReadState();
let catPrefs = loadCatPrefs();
let interestState = {};
loadInterestState();

function loadReadState() {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}'); } catch { return {}; }
}

function saveReadState() {
  localStorage.setItem(READ_KEY, JSON.stringify(readState));
}

function loadCatPrefs() {
  try { return JSON.parse(localStorage.getItem(CAT_PREFS_KEY) || '{}'); } catch { return {}; }
}

function saveCatPrefs() {
  localStorage.setItem(CAT_PREFS_KEY, JSON.stringify(catPrefs));
}

function getCatPref(category) {
  return catPrefs[category] || 'normal';
}

function getAllKnownCategories(clusters) {
  const fromDigest = new Set();
  for (const c of clusters) {
    if (c.category) fromDigest.add(c.category);
  }
  for (const cat of Object.keys(catPrefs)) {
    fromDigest.add(cat);
  }
  return [...fromDigest].sort();
}

function getWatchWords() {
  return (currentSettings.watchWords || '')
    .split(',')
    .map(w => w.trim().toLowerCase())
    .filter(Boolean);
}

function matchesWatchWords(cluster) {
  const words = getWatchWords();
  if (!words.length) return false;
  const haystack = [
    cluster.headline || '',
    cluster.summary || '',
    ...(cluster.stories || []).map(s => s.title || ''),
  ].join(' ').toLowerCase();
  return words.some(w => haystack.includes(w));
}

function isClusterRead(cluster) {
  const entry = readState[cluster.id];
  if (!entry) return false;
  return entry.contentVersion >= (cluster.contentVersion || 1);
}

function isClusterUpdatedSinceRead(cluster) {
  const entry = readState[cluster.id];
  if (!entry) return false;
  return (cluster.contentVersion || 1) > entry.contentVersion;
}

function markClusterRead(cluster) {
  readState[cluster.id] = { contentVersion: cluster.contentVersion || 1, at: Date.now() };
  saveReadState();
}

// --- Interest signals (Steam discovery queue style) ---
// Each cluster can be marked 'interested' or 'not-interested' by the user.
// This is an algorithmic signal, not a like/dislike of the story.

function loadInterestState() {
  try {
    interestState = JSON.parse(localStorage.getItem(INTEREST_KEY) || '{}');
  } catch { interestState = {}; }
}

function saveInterestState() {
  localStorage.setItem(INTEREST_KEY, JSON.stringify(interestState));
}

function getClusterInterest(clusterId) {
  return interestState[clusterId]?.signal || null;
}

function setClusterInterest(cluster, signal) {
  const existing = interestState[cluster.id];
  // Toggle off if clicking the same signal again
  if (existing?.signal === signal) {
    delete interestState[cluster.id];
  } else {
    interestState[cluster.id] = { signal, at: Date.now() };
  }
  saveInterestState();
}

function getInterestStats() {
  const interested = Object.values(interestState).filter(i => i.signal === 'interested').length;
  const notInterested = Object.values(interestState).filter(i => i.signal === 'not-interested').length;
  return { interested, notInterested, total: interested + notInterested };
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return dateStr || ''; }
}

function relativeAge(dateStr) {
  if (!dateStr) return '';
  try {
    const ts = new Date(dateStr).getTime();
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch { return ''; }
}

function getNewestStoryDate(cluster) {
  const dates = (cluster.stories || [])
    .map(s => s.published)
    .filter(Boolean)
    .map(d => { try { return new Date(d).getTime(); } catch { return 0; } })
    .filter(Boolean);
  if (!dates.length) return cluster.updated || cluster.created || '';
  return new Date(Math.max(...dates)).toISOString();
}

function sortClusters(clusters, sortMode) {
  const sorted = [...clusters];
  sorted.sort((a, b) => {
    // Interest signal: interested ranks above all, not-interested ranks below all
    const aInterest = getClusterInterest(a.id);
    const bInterest = getClusterInterest(b.id);
    const aRank = aInterest === 'interested' ? 0 : aInterest === 'not-interested' ? 2 : 1;
    const bRank = bInterest === 'interested' ? 0 : bInterest === 'not-interested' ? 2 : 1;
    if (aRank !== bRank) return aRank - bRank;

    // Category preference takes priority within same interest tier
    const aPref = CAT_PREF_ORDER[getCatPref(a.category)] ?? 1;
    const bPref = CAT_PREF_ORDER[getCatPref(b.category)] ?? 1;
    if (aPref !== bPref) return aPref - bPref;

    // Within same preference tier, apply the selected sort mode
    if (sortMode === 'recent') {
      return getNewestStoryDate(b).localeCompare(getNewestStoryDate(a));
    } else {
      return (b.stories?.length || 0) - (a.stories?.length || 0);
    }
  });
  return sorted;
}

function pickLeadImage(cluster) {
  const withImage = (cluster.stories || []).filter(s => s.image && s.image !== 'None');
  if (!withImage.length) return null;
  return withImage[0];
}

function renderArticle(cluster, settings, isPluginLead) {
  const category = cluster.category || 'Other';
  const headline = cluster.headline || 'Untitled';
  const summary = cluster.summary || '';
  const wasUpdated = isClusterUpdatedSinceRead(cluster);

  const linksHtml = (cluster.stories || []).map(s => {
    const sourceParts = [];
    if (s.source) sourceParts.push(s.source);
    if (s.sourceName) sourceParts.push(s.sourceName);
    const sourceHtml = sourceParts.length
      ? `<span class="story-source">— ${sourceParts.join(' · ')}</span>` : '';
    return `<li><a href="${s.url || '#'}" target="_blank" rel="noopener">${s.title || 'Untitled'}</a>${sourceHtml}</li>`;
  }).join('');

  const article = document.createElement('article');
  article.className = 'article';
  article.dataset.clusterId = cluster.id;
  article.dataset.headline = headline.toLowerCase();
  article.dataset.summary = summary.toLowerCase();
  article.dataset.category = category.toLowerCase();
  if (wasUpdated) article.classList.add('has-updates');
  if (matchesWatchWords(cluster)) article.classList.add('watch-match');

  let imageHtml = '';
  if (settings.images !== 'none') {
    let showImage = false;
    if (settings.images === 'all') {
      showImage = true;
    } else if (settings.images === 'minimal') {
      showImage = isPluginLead;
    }
    if (showImage) {
      const imgStory = pickLeadImage(cluster);
      if (imgStory) {
        imageHtml = `<img class="article-image" src="${imgStory.image}" alt="" loading="lazy" onerror="this.style.display='none'">`;
      }
    }
  }

  const interest = getClusterInterest(cluster.id);

  article.innerHTML = `
    <div class="article-header">
      <div class="article-category">${category}</div>
      <div class="article-header-right">
        <div class="article-age">${relativeAge(getNewestStoryDate(cluster))}</div>
        <button class="interest-btn interested-btn ${interest === 'interested' ? 'active' : ''}" data-signal="interested" title="Relevant — show more like this">✓</button>
        <button class="interest-btn not-interested-btn ${interest === 'not-interested' ? 'active' : ''}" data-signal="not-interested" title="Ignore — show less like this">✕</button>
      </div>
    </div>
    ${imageHtml}
    <h2 class="article-headline">${headline}</h2>
    <p class="article-summary">${summary}</p>
    <div class="story-links${settings.expandAll ? ' expanded' : ''}">
      <ul>${linksHtml}</ul>
    </div>
  `;

  // Apply interest-based visibility class
  if (interest === 'not-interested') article.classList.add('downranked');

  // Whole article panel is clickable to toggle story links
  article.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' || e.target.closest('.interest-btn')) return;
    article.querySelector('.story-links').classList.toggle('expanded');
  });

  // Interest signal buttons — both mark as read and set signal
  article.querySelectorAll('.interest-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const signal = btn.dataset.signal;
      setClusterInterest(cluster, signal);
      markClusterRead(cluster);
      article.classList.remove('has-updates');
      article.classList.add('is-read');
      const newInterest = getClusterInterest(cluster.id);
      // Toggle downrank class
      article.classList.toggle('downranked', newInterest === 'not-interested');
      // Re-render to apply new sort order and hide read
      setTimeout(() => {
        renderDigest(currentDigest, currentSettings);
        initSearch();
      }, 300);
    });
  });

  return article;
}

function getAvailableModes(clusters) {
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

function filterByMode(clusters, mode) {
  if (mode === 'all') return clusters;
  if (mode === 'main') return clusters.filter(c => !c.stories?.some(s => s.plugin));
  if (mode.startsWith('plugin:')) {
    const plugin = mode.slice(7);
    return clusters.filter(c => c.stories?.some(s => s.plugin === plugin));
  }
  return clusters;
}

function getAvailableCategories(clusters) {
  const cats = new Set();
  for (const c of clusters) {
    if (getCatPref(c.category) !== 'hide') cats.add(c.category || 'Other');
  }
  // Sort by category preference priority, then alphabetical
  return [...cats].sort((a, b) => {
    const pa = CAT_PREF_ORDER[getCatPref(a)] ?? 1;
    const pb = CAT_PREF_ORDER[getCatPref(b)] ?? 1;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
}

function renderDigest(digest, settings) {
  const sheet = document.getElementById('broadsheet');
  sheet.innerHTML = '';

  const allClusters = sortClusters(digest.clusters || [], settings.sort);

  if (!allClusters.length) {
    sheet.innerHTML = '<div class="loading">No news available yet. Check back later.</div>';
    return;
  }

  const modeFiltered = filterByMode(allClusters, settings.mode);

  // Filter out hidden categories
  const visibleCats = modeFiltered.filter(c => getCatPref(c.category) !== 'hide');

  // Apply category filter (secondary filter)
  const catFiltered = settings.categoryFilter === 'all'
    ? visibleCats
    : visibleCats.filter(c => (c.category || 'Other') === settings.categoryFilter);

  const visible = catFiltered.filter(c => {
    if (!isClusterRead(c)) return true;
    if (settings.showUpdated && isClusterUpdatedSinceRead(c)) return true;
    return false;
  });

  if (!visible.length) {
    sheet.innerHTML = '<div class="loading">All caught up. Toggle "Show updated" in settings to see stories with new information.</div>';
    return;
  }

  // Determine plugin-lead clusters (first per plugin, for minimal image display)
  const seenPlugins = new Set();
  const pluginLeadIds = new Set();

  for (const cluster of visible) {
    const plugin = cluster.stories?.find(s => s.plugin)?.plugin;
    if (plugin && !seenPlugins.has(plugin)) {
      seenPlugins.add(plugin);
      pluginLeadIds.add(cluster.id);
    }
  }

  const fragment = document.createDocumentFragment();
  for (const cluster of visible) {
    const isPluginLead = pluginLeadIds.has(cluster.id);
    fragment.appendChild(renderArticle(cluster, settings, isPluginLead));
  }
  sheet.appendChild(fragment);
}

const SEARCH_HISTORY_KEY = 'broadsheet-search-history';
const MAX_RECENT_SEARCHES = 8;

function loadSearchHistory() {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveSearchHistory(history) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_RECENT_SEARCHES)));
}

function addSearchTerm(term) {
  const trimmed = term.trim();
  if (!trimmed) return;
  let history = loadSearchHistory();
  history = history.filter(h => h.toLowerCase() !== trimmed.toLowerCase());
  history.unshift(trimmed);
  saveSearchHistory(history);
}

function renderRecentSearches() {
  const container = document.getElementById('recent-searches');
  if (!container) return;
  const history = loadSearchHistory();
  if (!history.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = history.map(term =>
    `<button class="recent-search-item" type="button">${term}</button>`
  ).join('');
  container.querySelectorAll('.recent-search-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = document.getElementById('filter');
      filter.value = btn.textContent;
      filter.dispatchEvent(new Event('input'));
      addSearchTerm(btn.textContent);
      renderRecentSearches();
    });
  });
}

function initSearch() {
  const filter = document.getElementById('filter');
  if (!filter) return;

  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    const articles = document.querySelectorAll('.article');
    articles.forEach(a => {
      const match = !q ||
        a.dataset.headline.includes(q) ||
        a.dataset.summary.includes(q) ||
        a.dataset.category.includes(q);
      a.classList.toggle('hidden', !match);
    });
    renderRecentSearches();
  });

  filter.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addSearchTerm(filter.value);
      renderRecentSearches();
    }
  });
}

function makeCycleHandler(btn, options, currentValue, onChange) {
  const opt = options.find(o => o.value === currentValue) || options[0];
  btn.textContent = opt.label;

  btn.addEventListener('click', () => {
    const idx = options.findIndex(o => o.value === currentSettings[onChange.key]);
    const next = options[(idx + 1) % options.length];
    currentSettings[onChange.key] = next.value;
    btn.textContent = next.label;
    saveSettings(currentSettings);
    applySettings(currentSettings);
    if (currentDigest) renderDigest(currentDigest, currentSettings);
    initSearch();
  });
}

function renderCategoryPrefs() {
  const container = document.getElementById('category-prefs');
  if (!container) return;

  const clusters = currentDigest?.clusters || [];
  const categories = getAllKnownCategories(clusters);

  container.innerHTML = '';
  for (const cat of categories) {
    const row = document.createElement('div');
    row.className = 'setting-row cat-pref-row';

    const label = document.createElement('span');
    label.textContent = cat;

    const btn = document.createElement('button');
    btn.className = 'cycle-btn cat-pref-btn';
    btn.type = 'button';
    const current = getCatPref(cat);
    const opt = CAT_PREF_OPTIONS.find(o => o.value === current) || CAT_PREF_OPTIONS[1];
    btn.textContent = opt.label;
    btn.dataset.category = cat;

    btn.addEventListener('click', () => {
      const cur = catPrefs[cat] || 'normal';
      const idx = CAT_PREF_OPTIONS.findIndex(o => o.value === cur);
      const next = CAT_PREF_OPTIONS[(idx + 1) % CAT_PREF_OPTIONS.length];
      catPrefs[cat] = next.value;
      saveCatPrefs();
      btn.textContent = next.label;
      if (currentDigest) renderDigest(currentDigest, currentSettings);
      initSearch();
    });

    row.appendChild(label);
    row.appendChild(btn);
    container.appendChild(row);
  }
}

function initSettings() {
  const panel = document.getElementById('settings-panel');
  const toggle = document.getElementById('settings-toggle');
  const close = document.getElementById('settings-close');

  const fontBtn = document.getElementById('setting-font');
  const fontsizeBtn = document.getElementById('setting-fontsize');
  const columnsBtn = document.getElementById('setting-columns');
  const sortBtn = document.getElementById('setting-sort');
  const imagesBtn = document.getElementById('setting-images');
  const expandAllCheck = document.getElementById('setting-expandall');
  const showUpdatedCheck = document.getElementById('setting-showupdated');
  const watchWordsInput = document.getElementById('setting-watchwords');

  function syncControls() {
    const fontTheme = FONT_THEMES.find(f => f.value === currentSettings.font) || FONT_THEMES[0];
    fontBtn.textContent = fontTheme.label;
    const fsOpt = FONT_SIZE_OPTIONS.find(o => o.value === currentSettings.fontsize) || FONT_SIZE_OPTIONS[1];
    fontsizeBtn.textContent = fsOpt.label;
    const colOpt = COLUMN_OPTIONS.find(o => o.value === currentSettings.columns) || COLUMN_OPTIONS[2];
    columnsBtn.textContent = colOpt.label;
    const sortOpt = SORT_OPTIONS.find(o => o.value === currentSettings.sort) || SORT_OPTIONS[0];
    sortBtn.textContent = sortOpt.label;
    const imgOpt = IMAGE_OPTIONS.find(o => o.value === currentSettings.images) || IMAGE_OPTIONS[1];
    imagesBtn.textContent = imgOpt.label;
    expandAllCheck.checked = currentSettings.expandAll;
    showUpdatedCheck.checked = currentSettings.showUpdated;
    watchWordsInput.value = currentSettings.watchWords || '';
  }

  function updateCheckboxes() {
    currentSettings.expandAll = expandAllCheck.checked;
    currentSettings.showUpdated = showUpdatedCheck.checked;
    saveSettings(currentSettings);
    applySettings(currentSettings);
    if (currentDigest) renderDigest(currentDigest, currentSettings);
    initSearch();
  }

  makeCycleHandler(fontBtn, FONT_THEMES, currentSettings.font, { key: 'font' });
  makeCycleHandler(fontsizeBtn, FONT_SIZE_OPTIONS, currentSettings.fontsize, { key: 'fontsize' });
  makeCycleHandler(columnsBtn, COLUMN_OPTIONS, currentSettings.columns, { key: 'columns' });
  makeCycleHandler(sortBtn, SORT_OPTIONS, currentSettings.sort, { key: 'sort' });
  makeCycleHandler(imagesBtn, IMAGE_OPTIONS, currentSettings.images, { key: 'images' });

  [expandAllCheck, showUpdatedCheck].forEach(el => el.addEventListener('change', updateCheckboxes));

  // Watch words — debounce input
  let watchTimer = null;
  watchWordsInput.addEventListener('input', () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      currentSettings.watchWords = watchWordsInput.value;
      saveSettings(currentSettings);
      if (currentDigest) renderDigest(currentDigest, currentSettings);
      initSearch();
    }, 400);
  });

  toggle.addEventListener('click', () => panel.classList.toggle('hidden'));
  close.addEventListener('click', () => panel.classList.add('hidden'));

  // Manage categories panel
  const manageCatBtn = document.getElementById('manage-categories');
  const catPanel = document.getElementById('category-panel');
  const catClose = document.getElementById('category-close');
  if (manageCatBtn && catPanel) {
    manageCatBtn.addEventListener('click', () => {
      panel.classList.add('hidden');
      catPanel.classList.remove('hidden');
      renderCategoryPrefs();
    });
  }
  if (catClose) catClose.addEventListener('click', () => catPanel.classList.add('hidden'));

  syncControls();
  applySettings(currentSettings);
  renderCategoryPrefs();

  // Changelog page
  const changelogBtn = document.getElementById('settings-changelog');
  const changelogPage = document.getElementById('changelog-page');
  const changelogClose = document.getElementById('changelog-close');
  const changelogBody = document.getElementById('changelog-body');

  changelogBtn.addEventListener('click', async () => {
    panel.classList.add('hidden');
    changelogPage.classList.remove('hidden');
    if (!changelogBody.children.length) {
      changelogBody.innerHTML = '<div class="loading">Loading...</div>';
      try {
        const res = await fetch('run-log.json');
        const log = res.ok ? await res.json() : [];
        renderChangelog(log);
        attachAlgoListeners();
      } catch {
        changelogBody.innerHTML = '<div class="loading">No run history available.</div>';
      }
    }
  });
  changelogClose.addEventListener('click', () => changelogPage.classList.add('hidden'));
}

function renderChangelog(log) {
  const body = document.getElementById('changelog-body');
  const digest = currentDigest;
  if (!digest) {
    body.innerHTML = '<div class="loading">No digest loaded.</div>';
    return;
  }

  const clusters = digest.clusters || [];
  const stories = clusters.flatMap(c => c.stories || []);

  // Dataset overview
  const sources = {};
  stories.forEach(s => { const name = s.sourceName || 'Unknown'; sources[name] = (sources[name]||0)+1; });
  const sourceList = Object.entries(sources).sort((a,b) => b[1]-a[1]);

  const cats = {};
  clusters.forEach(c => { cats[c.category] = (cats[c.category]||0)+1; });
  const catList = Object.entries(cats).sort((a,b) => b[1]-a[1]);

  const plugins = {};
  stories.forEach(s => { if (s.plugin) plugins[s.plugin] = (plugins[s.plugin]||0)+1; });
  const pluginList = Object.entries(plugins).sort((a,b) => b[1]-a[1]);

  // Freshness
  const pubDates = stories.map(s => s.published).filter(Boolean).map(d => { try { return new Date(d).getTime(); } catch { return 0; } }).filter(Boolean);
  const newestPub = pubDates.length ? Math.max(...pubDates) : null;
  const clusterDates = clusters.map(c => c.updated || c.created).filter(Boolean).map(d => { try { return new Date(d).getTime(); } catch { return 0; } }).filter(Boolean);
  const newestCluster = clusterDates.length ? Math.max(...clusterDates) : null;
  const oldestCluster = clusterDates.length ? Math.min(...clusterDates) : null;

  const fmtTime = (ts) => ts ? new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  const relTime = (ts) => {
    if (!ts) return '—';
    const diff = Date.now() - ts;
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return `${Math.floor(diff/60000)}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs/24)}d ago`;
  };

  let html = '<div class="changelog-overview">';

  // Freshness section
  html += '<div class="changelog-section"><h4>Dataset Freshness</h4>';
  html += `<div class="changelog-stats">`;
  html += `<div><span class="changelog-stat-label">Newest story</span><span class="changelog-stat-val">${fmtTime(newestPub)} <small>(${relTime(newestPub)})</small></span></div>`;
  html += `<div><span class="changelog-stat-label">Last summarised</span><span class="changelog-stat-val">${fmtTime(newestCluster)} <small>(${relTime(newestCluster)})</small></span></div>`;
  html += `<div><span class="changelog-stat-label">Oldest cluster</span><span class="changelog-stat-val">${fmtTime(oldestCluster)}</span></div>`;
  html += `<div><span class="changelog-stat-label">Total stories</span><span class="changelog-stat-val">${stories.length}</span></div>`;
  html += `<div><span class="changelog-stat-label">Total clusters</span><span class="changelog-stat-val">${clusters.length}</span></div>`;

  // Pipeline stats
  const ps = digest.pipelineStats;
  if (ps) {
    html += `<div><span class="changelog-stat-label">Stories in store</span><span class="changelog-stat-val">${ps.totalStories}</span></div>`;
    html += `<div><span class="changelog-stat-label">Summarised</span><span class="changelog-stat-val">${ps.summarised}</span></div>`;
    if (ps.unsummarised > 0) {
      html += `<div><span class="changelog-stat-label">Pending summary</span><span class="changelog-stat-val">${ps.unsummarised}</span></div>`;
    }
  }

  html += `</div></div>`;

  // Sources section
  html += '<div class="changelog-section"><h4>Sources</h4>';
  html += '<div class="changelog-tags">';
  html += sourceList.map(([name, count]) => `<span class="changelog-tag">${name} <small>${count}</small></span>`).join('');
  html += '</div></div>';

  // Categories section
  html += '<div class="changelog-section"><h4>Categories</h4>';
  html += '<div class="changelog-tags">';
  html += catList.map(([name, count]) => `<span class="changelog-tag">${name} <small>${count}</small></span>`).join('');
  html += '</div></div>';

  // Plugins section (if any)
  if (pluginList.length) {
    html += '<div class="changelog-section"><h4>Search Plugins</h4>';
    html += '<div class="changelog-tags">';
    html += pluginList.map(([name, count]) => `<span class="changelog-tag">${name} <small>${count}</small></span>`).join('');
    html += '</div></div>';
  }

  // Your Algorithm panel
  const stats = getInterestStats();
  const hasSignals = stats.total > 0;
  const hasCatPrefs = Object.values(catPrefs).some(v => v && v !== 'normal');

  if (hasSignals || hasCatPrefs) {
    html += '<div class="changelog-section"><h4>Your Algorithm</h4>';

    // Category preferences
    if (hasCatPrefs) {
      html += '<div class="changelog-subsection"><small>Category preferences</small>';
      const prefOrder = ['favour', 'demote', 'hide'];
      for (const pref of prefOrder) {
        const cats = Object.entries(catPrefs).filter(([_, v]) => v === pref).map(([k]) => k);
        if (cats.length) {
          const prefLabel = CAT_PREF_OPTIONS.find(o => o.value === pref)?.label || pref;
          html += `<div class="algo-pref-row"><span class="algo-pref-label">${prefLabel}</span> ${cats.map(c => `<span class="changelog-tag">${c}</span>`).join(' ')}</div>`;
        }
      }
      html += '</div>';
    }

    // Interest signals by direction
    if (hasSignals) {
      html += '<div class="changelog-subsection"><small>Interest signals</small>';

      const interestedClusters = clusters.filter(c => getClusterInterest(c.id) === 'interested');
      if (interestedClusters.length) {
        html += '<div class="algo-signal-group">';
        html += `<div class="algo-signal-direction">✓ Relevant <small>${interestedClusters.length}</small></div>`;
        html += interestedClusters.map(c => `<div class="algo-signal-item" data-cluster-id="${c.id}" data-signal="interested"><span>${c.headline}</span><button class="algo-remove-btn" title="Remove signal">✕</button></div>`).join('');
        html += '</div>';
      }

      const notInterestedClusters = clusters.filter(c => getClusterInterest(c.id) === 'not-interested');
      if (notInterestedClusters.length) {
        html += '<div class="algo-signal-group">';
        html += `<div class="algo-signal-direction">✕ Ignore <small>${notInterestedClusters.length}</small></div>`;
        html += notInterestedClusters.map(c => `<div class="algo-signal-item" data-cluster-id="${c.id}" data-signal="not-interested"><span>${c.headline}</span><button class="algo-remove-btn" title="Remove signal">✕</button></div>`).join('');
        html += '</div>';
      }

      // Also show signals for clusters no longer in the digest
      const activeIds = new Set(clusters.map(c => c.id));
      const orphaned = Object.entries(interestState).filter(([id]) => !activeIds.has(id));
      if (orphaned.length) {
        html += '<div class="algo-signal-group algo-orphaned">';
        html += `<div class="algo-signal-direction">Expired signals <small>${orphaned.length}</small></div>`;
        html += orphaned.map(([id, info]) => `<div class="algo-signal-item" data-cluster-id="${id}" data-signal="${info.signal}"><span class="algo-orphaned-label">${info.signal === 'interested' ? '✓' : '✕'} (no longer in digest)</span><button class="algo-remove-btn" title="Remove signal">✕</button></div>`).join('');
        html += '</div>';
      }

      html += '</div>';
    }

    html += '</div>';
  }

  html += '</div>'; // end overview

  // Run history
  html += '<div class="changelog-section"><h4>Run History</h4>';
  if (!log || !log.length) {
    html += '<div class="loading">The summariser has never been run. No digest history available.</div>';
  } else {
    html += log.map(entry => {
      const date = new Date(entry.timestamp);
      const time = date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const parts = [];
      if (entry.skipped) {
        parts.push('No new stories — cache only');
      } else {
        if (entry.storiesAdded) parts.push(`+${entry.storiesAdded} stories`);
        if (entry.clustersCreated) parts.push(`${entry.clustersCreated} new clusters`);
        if (entry.clustersUpdated) parts.push(`${entry.clustersUpdated} updated`);
        if (entry.storiesProcessed) parts.push(`${entry.storiesProcessed} processed`);
        if (entry.chunksFailed > 0) parts.push(`${entry.chunksFailed} chunks failed`);
      }
      parts.push(`${entry.totalClusters} total clusters`);

      const metaParts = [];
      if (entry.provider && entry.provider !== 'unknown') metaParts.push(entry.provider);
      if (entry.model && entry.model !== 'unknown') metaParts.push(entry.model);

      return `<div class="changelog-entry">
        <div class="changelog-time">${time}</div>
        <div class="changelog-details">${parts.join(' · ')}</div>
        ${metaParts.length ? `<div class="changelog-meta">${metaParts.join(' / ')}</div>` : ''}
      </div>`;
    }).join('');
  }
  html += '</div>';

  body.innerHTML = html;
}

function attachAlgoListeners() {
  const body = document.getElementById('changelog-body');
  body.querySelectorAll('.algo-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.algo-signal-item');
      if (!item) return;
      const clusterId = item.dataset.clusterId;
      if (clusterId && interestState[clusterId]) {
        delete interestState[clusterId];
        saveInterestState();
        item.remove();
        renderDigest(currentDigest, currentSettings);
        initSearch();
      }
    });
  });
}

async function init() {
  const dateEl = document.getElementById('masthead-date');
  if (dateEl) dateEl.textContent = formatDate(new Date().toISOString());

  initSettings();

  // Mode toggle (in masthead)
  const modeBtn = document.getElementById('mode-toggle');
  const catBtn = document.getElementById('category-toggle');

  function syncCategoryToggle() {
    if (!catBtn || !currentDigest) return;
    const modeFiltered = filterByMode(sortClusters(currentDigest.clusters || [], currentSettings.sort), currentSettings.mode);
    const cats = getAvailableCategories(modeFiltered);
    const all = [{ value: 'all', label: 'Categories' }, ...cats.map(c => ({ value: c, label: c }))];
    // If current filter is no longer available, reset to 'all'
    if (!all.find(o => o.value === currentSettings.categoryFilter)) {
      currentSettings.categoryFilter = 'all';
      saveSettings(currentSettings);
    }
    const current = all.find(o => o.value === currentSettings.categoryFilter) || all[0];
    catBtn.textContent = current.label;
  }

  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      if (!currentDigest) return;
      const modes = getAvailableModes(currentDigest.clusters || []);
      const idx = modes.findIndex(m => m.value === currentSettings.mode);
      const next = modes[(idx + 1) % modes.length];
      currentSettings.mode = next.value;
      // Reset category filter when mode changes
      currentSettings.categoryFilter = 'all';
      saveSettings(currentSettings);
      modeBtn.textContent = next.label;
      syncCategoryToggle();
      renderDigest(currentDigest, currentSettings);
      initSearch();
    });
  }

  if (catBtn) {
    catBtn.addEventListener('click', () => {
      if (!currentDigest) return;
      const modeFiltered = filterByMode(sortClusters(currentDigest.clusters || [], currentSettings.sort), currentSettings.mode);
      const cats = getAvailableCategories(modeFiltered);
      const all = [{ value: 'all', label: 'Categories' }, ...cats.map(c => ({ value: c, label: c }))];
      const idx = all.findIndex(o => o.value === currentSettings.categoryFilter);
      const next = all[(idx + 1) % all.length];
      currentSettings.categoryFilter = next.value;
      saveSettings(currentSettings);
      catBtn.textContent = next.label;
      renderDigest(currentDigest, currentSettings);
      initSearch();
    });
  }

  // Search toggle
  const searchToggle = document.getElementById('search-toggle');
  const searchPanel = document.getElementById('search-panel');
  const searchInput = document.getElementById('filter');
  if (searchToggle && searchPanel) {
    searchToggle.addEventListener('click', () => {
      searchPanel.classList.toggle('hidden');
      if (!searchPanel.classList.contains('hidden')) {
        searchInput.focus();
        renderRecentSearches();
      }
    });
  }

  // Escape closes sidebar / changelog / search
  function closeAllOverlays() {
    document.getElementById('settings-panel')?.classList.add('hidden');
    document.getElementById('changelog-page')?.classList.add('hidden');
    document.getElementById('search-panel')?.classList.add('hidden');
    document.getElementById('category-panel')?.classList.add('hidden');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllOverlays();
  });

  // Back button closes overlays on mobile
  window.addEventListener('popstate', () => {
    closeAllOverlays();
  });

  try {
    const res = await fetch('digest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    currentDigest = await res.json();

    // Sync mode toggle label
    if (modeBtn) {
      const modes = getAvailableModes(currentDigest.clusters || []);
      const current = modes.find(m => m.value === currentSettings.mode) || modes[0];
      currentSettings.mode = current.value;
      modeBtn.textContent = current.label;
    }

    syncCategoryToggle();
    renderDigest(currentDigest, currentSettings);
    renderCategoryPrefs();
    initSearch();
  } catch (err) {
    document.getElementById('broadsheet').innerHTML =
      `<div class="loading">Failed to load news: ${err.message}</div>`;
  }
}

init();

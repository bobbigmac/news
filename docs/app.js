const SETTINGS_KEY = 'broadsheet-settings';
const READ_KEY = 'broadsheet-read';
const DEFAULT_SETTINGS = {
  font: 'serif',
  fontsize: 'medium',
  columns: '3',
  sort: 'stories',
  images: 'minimal',
  mode: 'all',
  showSource: false,
  expandAll: false,
  showUpdated: false
};

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
  { value: 'stories', label: 'Most stories' },
  { value: 'recent', label: 'Most recent' },
  { value: 'category', label: 'By category' },
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
  // Font size
  document.body.classList.add(`font-${settings.fontsize}`);
  // Columns
  const sheet = document.getElementById('broadsheet');
  sheet.className = `broadsheet cols-${settings.columns}`;
}

let currentDigest = null;
let currentSettings = loadSettings();
let readState = loadReadState();

function loadReadState() {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}'); } catch { return {}; }
}

function saveReadState() {
  localStorage.setItem(READ_KEY, JSON.stringify(readState));
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

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return dateStr || ''; }
}

function sortClusters(clusters, sortMode) {
  const sorted = [...clusters];
  if (sortMode === 'recent') {
    sorted.sort((a, b) => (b.updated || b.created || '').localeCompare(a.updated || a.created || ''));
  } else if (sortMode === 'category') {
    sorted.sort((a, b) => (a.category || 'Other').localeCompare(b.category || 'Other'));
  } else {
    sorted.sort((a, b) => (b.stories?.length || 0) - (a.stories?.length || 0));
  }
  return sorted;
}

function pickLeadImage(cluster) {
  const withImage = (cluster.stories || []).filter(s => s.image && s.image !== 'None');
  if (!withImage.length) return null;
  return withImage[0];
}

function renderArticle(cluster, settings, isLead, isPluginLead) {
  const storyCount = cluster.stories?.length || 0;
  const category = cluster.category || 'Other';
  const headline = cluster.headline || 'Untitled';
  const summary = cluster.summary || '';
  const wasUpdated = isClusterUpdatedSinceRead(cluster);

  const showSources = settings.showSource || settings.expandAll;
  const linksHtml = (cluster.stories || []).map(s => {
    const sourceHtml = s.source
      ? `<span class="story-source${showSources ? '' : ' hidden'}">— ${s.source}</span>` : '';
    return `<li><a href="${s.url || '#'}" target="_blank" rel="noopener">${s.title || 'Untitled'}</a>${sourceHtml}</li>`;
  }).join('');

  const article = document.createElement('article');
  article.className = 'article';
  article.dataset.clusterId = cluster.id;
  article.dataset.headline = headline.toLowerCase();
  article.dataset.summary = summary.toLowerCase();
  article.dataset.category = category.toLowerCase();
  if (wasUpdated) article.classList.add('has-updates');
  if (isLead) article.classList.add('is-lead');

  let imageHtml = '';
  if (settings.images !== 'none') {
    let showImage = false;
    if (settings.images === 'all') {
      showImage = true;
    } else if (settings.images === 'minimal') {
      showImage = isLead || isPluginLead;
    }
    if (showImage) {
      const imgStory = pickLeadImage(cluster);
      if (imgStory) {
        imageHtml = `<img class="article-image" src="${imgStory.image}" alt="" loading="lazy" onerror="this.style.display='none'">`;
      }
    }
  }

  article.innerHTML = `
    <div class="article-category">${category}${wasUpdated ? ' <span class="updated-badge">updated</span>' : ''}</div>
    ${imageHtml}
    <h2 class="article-headline">${headline}</h2>
    <p class="article-summary">${summary}</p>
    <div class="article-meta">
      <span class="article-story-count">${storyCount}</span>
      <button class="mark-read-btn" title="Mark as read">✓</button>
    </div>
    <div class="story-links${settings.expandAll ? ' expanded' : ''}">
      <ul>${linksHtml}</ul>
    </div>
  `;

  // Whole article panel is clickable to toggle story links
  article.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' || e.target.closest('.mark-read-btn')) return;
    const links = article.querySelector('.story-links');
    const isExpanded = links.classList.toggle('expanded');
    // Show source names when expanded (if not already shown by setting)
    if (isExpanded && !showSources) {
      article.querySelectorAll('.story-source.hidden').forEach(el => el.classList.remove('hidden'));
    }
  });

  const readBtn = article.querySelector('.mark-read-btn');
  readBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    markClusterRead(cluster);
    article.classList.remove('has-updates');
    article.classList.add('is-read');
    setTimeout(() => {
      if (!currentSettings.showUpdated || !isClusterUpdatedSinceRead(cluster)) {
        article.classList.add('hidden');
      }
    }, 300);
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

function renderDigest(digest, settings) {
  const sheet = document.getElementById('broadsheet');
  sheet.innerHTML = '';

  const allClusters = sortClusters(digest.clusters || [], settings.sort);

  if (!allClusters.length) {
    sheet.innerHTML = '<div class="loading">No news available yet. Check back later.</div>';
    return;
  }

  const modeFiltered = filterByMode(allClusters, settings.mode);

  const visible = modeFiltered.filter(c => {
    if (!isClusterRead(c)) return true;
    if (settings.showUpdated && isClusterUpdatedSinceRead(c)) return true;
    return false;
  });

  if (!visible.length) {
    sheet.innerHTML = '<div class="loading">All caught up. Toggle "Show updated" in settings to see stories with new information.</div>';
    return;
  }

  // Determine lead cluster (most stories) and plugin-lead clusters (first per plugin)
  const leadId = visible[0]?.id;
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
    const isLead = cluster.id === leadId;
    const isPluginLead = pluginLeadIds.has(cluster.id);
    fragment.appendChild(renderArticle(cluster, settings, isLead, isPluginLead));
  }
  sheet.appendChild(fragment);
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

function initSettings() {
  const panel = document.getElementById('settings-panel');
  const toggle = document.getElementById('settings-toggle');
  const close = document.getElementById('settings-close');

  const fontBtn = document.getElementById('setting-font');
  const fontsizeBtn = document.getElementById('setting-fontsize');
  const columnsBtn = document.getElementById('setting-columns');
  const sortBtn = document.getElementById('setting-sort');
  const imagesBtn = document.getElementById('setting-images');
  const showSourceCheck = document.getElementById('setting-showsource');
  const expandAllCheck = document.getElementById('setting-expandall');
  const showUpdatedCheck = document.getElementById('setting-showupdated');

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
    showSourceCheck.checked = currentSettings.showSource;
    expandAllCheck.checked = currentSettings.expandAll;
    showUpdatedCheck.checked = currentSettings.showUpdated;
  }

  function updateCheckboxes() {
    currentSettings.showSource = showSourceCheck.checked;
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

  [showSourceCheck, expandAllCheck, showUpdatedCheck].forEach(el => el.addEventListener('change', updateCheckboxes));

  toggle.addEventListener('click', () => panel.classList.toggle('hidden'));
  close.addEventListener('click', () => panel.classList.add('hidden'));

  syncControls();
  applySettings(currentSettings);

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
      } catch {
        changelogBody.innerHTML = '<div class="loading">No run history available.</div>';
      }
    }
  });
  changelogClose.addEventListener('click', () => changelogPage.classList.add('hidden'));
}

function renderChangelog(log) {
  const body = document.getElementById('changelog-body');
  if (!log || !log.length) {
    body.innerHTML = '<div class="loading">No run history yet.</div>';
    return;
  }

  body.innerHTML = log.map(entry => {
    const date = new Date(entry.timestamp);
    const time = date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const parts = [];
    if (entry.storiesAdded) parts.push(`+${entry.storiesAdded} stories`);
    if (entry.clustersCreated) parts.push(`${entry.clustersCreated} new clusters`);
    if (entry.clustersUpdated) parts.push(`${entry.clustersUpdated} updated`);
    if (entry.storiesProcessed) parts.push(`${entry.storiesProcessed} processed`);
    if (entry.chunksFailed > 0) parts.push(`${entry.chunksFailed} chunks failed`);
    parts.push(`${entry.totalClusters} total`);

    return `<div class="changelog-entry">
      <div class="changelog-time">${time}</div>
      <div class="changelog-details">${parts.join(' · ')}</div>
      <div class="changelog-meta">${entry.provider} / ${entry.model}</div>
    </div>`;
  }).join('');
}

async function init() {
  const dateEl = document.getElementById('masthead-date');
  if (dateEl) dateEl.textContent = formatDate(new Date().toISOString());

  initSettings();

  // Mode toggle (in masthead)
  const modeBtn = document.getElementById('mode-toggle');
  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      if (!currentDigest) return;
      const modes = getAvailableModes(currentDigest.clusters || []);
      const idx = modes.findIndex(m => m.value === currentSettings.mode);
      const next = modes[(idx + 1) % modes.length];
      currentSettings.mode = next.value;
      saveSettings(currentSettings);
      modeBtn.textContent = next.label;
      renderDigest(currentDigest, currentSettings);
      initSearch();
    });
  }

  // Escape closes sidebar / changelog
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('settings-panel')?.classList.add('hidden');
      document.getElementById('changelog-page')?.classList.add('hidden');
    }
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

    renderDigest(currentDigest, currentSettings);
    initSearch();
  } catch (err) {
    document.getElementById('broadsheet').innerHTML =
      `<div class="loading">Failed to load news: ${err.message}</div>`;
  }
}

init();

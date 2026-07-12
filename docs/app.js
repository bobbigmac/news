const SETTINGS_KEY = 'broadsheet-settings';
const DEFAULT_SETTINGS = {
  fontsize: 'medium',
  columns: '2',
  sort: 'stories',
  showSource: false,
  expandAll: false
};

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
  document.body.classList.add(`font-${settings.fontsize}`);
  const sheet = document.getElementById('broadsheet');
  sheet.className = `broadsheet cols-${settings.columns}`;
}

let currentDigest = null;
let currentSettings = loadSettings();

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

function renderArticle(cluster, settings) {
  const storyCount = cluster.stories?.length || 0;
  const category = cluster.category || 'Other';
  const headline = cluster.headline || 'Untitled';
  const summary = cluster.summary || '';

  const linksHtml = (cluster.stories || []).map(s => {
    const sourceHtml = settings.showSource && s.source
      ? `<span class="story-source">— ${s.source}</span>` : '';
    return `<li><a href="${s.url || '#'}" target="_blank" rel="noopener">${s.title || 'Untitled'}</a>${sourceHtml}</li>`;
  }).join('');

  const article = document.createElement('article');
  article.className = 'article';
  article.dataset.headline = headline.toLowerCase();
  article.dataset.summary = summary.toLowerCase();
  article.dataset.category = category.toLowerCase();

  article.innerHTML = `
    <div class="article-category">${category}</div>
    <h2 class="article-headline">${headline}</h2>
    <p class="article-summary">${summary}</p>
    <div class="article-meta">
      <span class="article-story-count">${storyCount} source${storyCount !== 1 ? 's' : ''}</span>
    </div>
    <div class="story-links${settings.expandAll ? ' expanded' : ''}">
      <ul>${linksHtml}</ul>
    </div>
  `;

  const headlineEl = article.querySelector('.article-headline');
  headlineEl.addEventListener('click', () => {
    const links = article.querySelector('.story-links');
    links.classList.toggle('expanded');
  });

  return article;
}

function renderDigest(digest, settings) {
  const sheet = document.getElementById('broadsheet');
  sheet.innerHTML = '';

  const clusters = sortClusters(digest.clusters || [], settings.sort);

  if (!clusters.length) {
    sheet.innerHTML = '<div class="loading">No news available yet. Check back later.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const cluster of clusters) {
    fragment.appendChild(renderArticle(cluster, settings));
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

function initSettings() {
  const panel = document.getElementById('settings-panel');
  const toggle = document.getElementById('settings-toggle');
  const close = document.getElementById('settings-close');

  const fontsizeSelect = document.getElementById('setting-fontsize');
  const columnsSelect = document.getElementById('setting-columns');
  const sortSelect = document.getElementById('setting-sort');
  const showSourceCheck = document.getElementById('setting-showsource');
  const expandAllCheck = document.getElementById('setting-expandall');

  function syncControls() {
    fontsizeSelect.value = currentSettings.fontsize;
    columnsSelect.value = currentSettings.columns;
    sortSelect.value = currentSettings.sort;
    showSourceCheck.checked = currentSettings.showSource;
    expandAllCheck.checked = currentSettings.expandAll;
  }

  function update() {
    currentSettings = {
      fontsize: fontsizeSelect.value,
      columns: columnsSelect.value,
      sort: sortSelect.value,
      showSource: showSourceCheck.checked,
      expandAll: expandAllCheck.checked
    };
    saveSettings(currentSettings);
    applySettings(currentSettings);
    if (currentDigest) renderDigest(currentDigest, currentSettings);
    initSearch();
  }

  toggle.addEventListener('click', () => panel.classList.toggle('hidden'));
  close.addEventListener('click', () => panel.classList.add('hidden'));

  [fontsizeSelect, columnsSelect, sortSelect].forEach(el => el.addEventListener('change', update));
  [showSourceCheck, expandAllCheck].forEach(el => el.addEventListener('change', update));

  syncControls();
  applySettings(currentSettings);
}

async function init() {
  const dateEl = document.getElementById('masthead-date');
  if (dateEl) dateEl.textContent = formatDate(new Date().toISOString());

  initSettings();

  try {
    const res = await fetch('digest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    currentDigest = await res.json();
    renderDigest(currentDigest, currentSettings);
    initSearch();
  } catch (err) {
    document.getElementById('broadsheet').innerHTML =
      `<div class="loading">Failed to load news: ${err.message}</div>`;
  }
}

init();

import { canonicalCategory, getFeedStories, prettifySourceKey, sourceKeyFromUrl } from './view-model.js';
import { isClusterRead } from './reading.js';
import { saveReadState, state, ui } from './state.js';

const SEARCH_HISTORY_KEY = 'broadsheet-search-history';
const MAX_RECENT_SEARCHES = 8;

export function getSearchQuery() {
  return (document.getElementById('filter')?.value || '').trim().toLowerCase();
}

export function storySearchText(story) {
  const sourceKey = sourceKeyFromUrl(story.url);
  return [
    story.title || '',
    story.source || '',
    story.sourceName || '',
    sourceKey,
    sourceKey ? prettifySourceKey(sourceKey) : '',
  ].join(' ');
}

export function clusterMatchesSearch(cluster, query) {
  if (!query) return true;
  const haystack = [
    cluster.headline || '',
    cluster.summary || '',
    canonicalCategory(cluster.category),
    ...getFeedStories(cluster, state.disabledSources).map(storySearchText),
  ].join(' ').toLowerCase();
  return haystack.includes(query);
}

export function getDisplayedClusters() {
  const query = getSearchQuery();
  return state.visibleClusters.filter(cluster => clusterMatchesSearch(cluster, query));
}

export function updateMarkReadButton() {
  const btn = document.getElementById('mark-all-read');
  if (!btn) return;
  const unread = getDisplayedClusters().filter(c => !isClusterRead(c)).length;
  btn.disabled = unread === 0;
  btn.textContent = unread ? `Mark ${unread} Read` : 'Mark Read';
}

export function markDisplayedClustersRead() {
  const at = Date.now();
  for (const cluster of getDisplayedClusters()) {
    state.readState[cluster.id] = { contentVersion: cluster.contentVersion || 1, at };
  }
  saveReadState();
  ui.refresh();
}

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

export function renderRecentSearches() {
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

export function applySearchFilter() {
  if (ui.syncFeed() !== true) {
    const q = getSearchQuery();
    const articles = document.querySelectorAll('.article');
    articles.forEach(a => {
      const match = !q ||
        a.dataset.headline.includes(q) ||
        a.dataset.summary.includes(q) ||
        a.dataset.category.includes(q) ||
        (a.dataset.stories || '').includes(q);
      a.classList.toggle('hidden', !match);
    });
    ui.relayout();
  }
  updateMarkReadButton();
}

export function initSearch() {
  const filter = document.getElementById('filter');
  if (!filter) return;

  if (!filter.dataset.bound) {
    let searchTimer = null;
    filter.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        applySearchFilter();
        renderRecentSearches();
      }, 120);
    });

    filter.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addSearchTerm(filter.value);
        renderRecentSearches();
      }
    });
    filter.dataset.bound = 'true';
  }

  // Rendering replaces the article DOM, so reapply any active query to the new
  // nodes. Binding happens only once; filtering itself is cheap and debounced above.
  applySearchFilter();
}

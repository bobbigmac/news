import { getColumnCount } from './layout.js';
import { buildViewModel, filterByMode } from './view-model.js';
import {
  applySettings,
  collectSourcesFromDigest,
  saveSettings,
  state,
  ui,
} from './state.js';
import { renderCategoryFilterBar, renderSourceBar } from './filters.js';
import { clearFeed, renderFeed, syncFeedToSearch } from './feed.js';
import { formatDate } from './article.js';
import { getAvailableCategories, getAvailableModes, sortClusters } from './ordering.js';
import { groupClustersForFeed } from './story-groups.js';
import {
  initSearch,
  markDisplayedClustersRead,
  renderRecentSearches,
  updateMarkReadButton,
} from './search.js';
import { initReadInteraction, refreshGlimpseObserver, refreshReadObserver } from './reading.js';
import {
  backfillInterestSignals,
  getClusterInterest,
  refreshSignalProfile,
  scoreClusterAgainstSignals,
  setSignalClusters,
} from './signals.js';
import { initSettings, renderCategoryPrefs, renderSourcePrefs } from './settings.js';

// Auto-switch theme when system preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.settings.theme === 'auto') applySettings();
});

function renderDigest(digest, settings) {
  const sheet = document.getElementById('broadsheet');
  const allClusters = sortClusters(digest.clusters || [], settings.sort);
  setSignalClusters(allClusters);

  if (!allClusters.length) {
    state.viewModel = null;
    state.visibleClusters = [];
    renderSourceBar(null);
    renderCategoryFilterBar(null);
    clearFeed();
    sheet.innerHTML = '<div class="loading">No news available yet. Check back later.</div>';
    refreshGlimpseObserver();
    updateMarkReadButton();
    return;
  }

  state.viewModel = buildViewModel({
    clusters: allClusters,
    digestSources: collectSourcesFromDigest(digest),
    settings,
    catPrefs: state.catPrefs,
    sourceInclude: state.sourceInclude,
    disabledSources: state.disabledSources,
    readState: state.readState,
    isSignalVisible: cluster => {
      const explicit = getClusterInterest(cluster.id);
      if (explicit === 'interested') return true;
      return scoreClusterAgainstSignals(cluster).score > -5;
    },
  });

  const visible = state.viewModel.visibleClusters;
  state.visibleClusters = visible;
  renderSourceBar(state.viewModel);
  renderCategoryFilterBar(state.viewModel);

  if (!visible.length) {
    clearFeed();
    sheet.innerHTML = state.viewModel.feedPool.length
      ? '<div class="loading">No stories match the current source and category filters.</div>'
      : '<div class="loading">All caught up.</div>';
    refreshGlimpseObserver();
    updateMarkReadButton();
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

  const latestReferenceTime = Date.parse(digest.generated || '') || Date.now();
  document.getElementById('source-bar')?.removeAttribute('hidden');
  renderFeed({
    clusters: visible,
    settings,
    pluginLeadIds,
    latestReferenceTime,
    grouping: groupClustersForFeed(visible, settings.groupByTag),
  });
}

// Flow columns lay themselves out; expanding content just grows its column.
ui.relayout = () => {};
ui.syncFeed = () => syncFeedToSearch();
ui.updateReadCount = () => updateMarkReadButton();
ui.refresh = () => {
  if (!state.digest) return;
  renderDigest(state.digest, state.settings);
  initSearch();
};

async function init() {
  const dateEl = document.getElementById('masthead-date');
  if (dateEl) dateEl.textContent = formatDate(new Date().toISOString());

  initSettings();
  initReadInteraction();

  const markAllBtn = document.getElementById('mark-all-read');
  if (markAllBtn) markAllBtn.addEventListener('click', markDisplayedClustersRead);

  // Mode toggle (in masthead)
  const modeBtn = document.getElementById('mode-toggle');
  const catBtn = document.getElementById('category-toggle');

  function syncCategoryToggle() {
    if (!catBtn || !state.digest) return;
    const modeFiltered = filterByMode(sortClusters(state.digest.clusters || [], state.settings.sort), state.settings.mode);
    const cats = getAvailableCategories(modeFiltered);
    const all = [{ value: 'all', label: 'All' }, ...cats.map(c => ({ value: c, label: c }))];
    // If current filter is no longer available, reset to 'all'
    if (!all.find(o => o.value === state.settings.categoryFilter)) {
      state.settings.categoryFilter = 'all';
      saveSettings();
    }
    const current = all.find(o => o.value === state.settings.categoryFilter) || all[0];
    catBtn.textContent = current.label;
  }

  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      if (!state.digest) return;
      const modes = getAvailableModes(state.digest.clusters || []);
      const idx = modes.findIndex(m => m.value === state.settings.mode);
      const next = modes[(idx + 1) % modes.length];
      state.settings.mode = next.value;
      // Reset category filter when mode changes
      state.settings.categoryFilter = 'all';
      saveSettings();
      modeBtn.textContent = next.label;
      syncCategoryToggle();
      ui.refresh();
    });
  }

  if (catBtn) {
    catBtn.addEventListener('click', () => {
      if (!state.digest) return;
      const modeFiltered = filterByMode(sortClusters(state.digest.clusters || [], state.settings.sort), state.settings.mode);
      const cats = getAvailableCategories(modeFiltered);
      const all = [{ value: 'all', label: 'All' }, ...cats.map(c => ({ value: c, label: c }))];
      const idx = all.findIndex(o => o.value === state.settings.categoryFilter);
      const next = all[(idx + 1) % all.length];
      state.settings.categoryFilter = next.value;
      saveSettings();
      catBtn.textContent = next.label;
      ui.refresh();
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
    document.getElementById('source-panel')?.classList.add('hidden');
  }

  // Clicking outside an open side panel closes it. This runs in the capture
  // phase so the first outside click does not also activate whatever is behind
  // the panel. The settings toggle is left alone so it keeps its toggle behaviour.
  document.addEventListener('click', (e) => {
    const panelSelector = '#settings-panel, #category-panel, #source-panel';
    const searchPanelEl = document.getElementById('search-panel');
    const searchOpen = searchPanelEl && !searchPanelEl.classList.contains('hidden');
    const openPanels = [...document.querySelectorAll(panelSelector)]
      .filter(panel => !panel.classList.contains('hidden'));
    if (!openPanels.length && !searchOpen) return;

    const insidePanel = !!e.target.closest(panelSelector);
    const insideSearch = !!e.target.closest('#search-panel, #search-toggle');
    if (insidePanel || insideSearch) return;

    if (searchOpen) searchPanelEl.classList.add('hidden');
    if (e.target.closest('#settings-toggle')) {
      document.getElementById('category-panel')?.classList.add('hidden');
      document.getElementById('source-panel')?.classList.add('hidden');
      return;
    }
    for (const panel of openPanels) panel.classList.add('hidden');
    // Side panels are modal enough that the first outside click should not
    // activate whatever is underneath. Search is non-modal: closing it should
    // not swallow an interaction with the page controls.
    if (openPanels.length) e.stopPropagation();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllOverlays();
    if ((e.ctrlKey || e.metaKey) && e.key === 'f' || e.key === 'F3') {
      e.preventDefault();
      const sp = document.getElementById('search-panel');
      const si = document.getElementById('filter');
      if (sp && si) {
        sp.classList.remove('hidden');
        si.focus();
        si.select();
        renderRecentSearches();
      }
    }
  });

  // Back button closes overlays on mobile
  window.addEventListener('popstate', () => {
    closeAllOverlays();
  });

  // Resize only re-renders when the column count actually changes. Width-only
  // resizes need nothing: columns are fluid and items never move.
  let resizeTimer;
  let lastColumnCount = getColumnCount();
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!state.digest) return;
      const cols = getColumnCount();
      if (cols === lastColumnCount) return;
      lastColumnCount = cols;
      renderDigest(state.digest, state.settings);
    }, 250);
  });

  try {
    const res = await fetch('digest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.digest = await res.json();

    // Backfill tags for signals saved before metadata enrichment
    backfillInterestSignals(state.digest.clusters || []);

    // Cache signal weights for this page session
    refreshSignalProfile();

    // Sync mode toggle label
    if (modeBtn) {
      const modes = getAvailableModes(state.digest.clusters || []);
      const current = modes.find(m => m.value === state.settings.mode) || modes[0];
      state.settings.mode = current.value;
      modeBtn.textContent = current.label;
    }

    syncCategoryToggle();
    renderDigest(state.digest, state.settings);
    renderCategoryPrefs();
    renderSourcePrefs();
    initSearch();
  } catch (err) {
    console.error('Failed to load news:', err);
    document.getElementById('broadsheet').innerHTML =
      `<div class="loading">Failed to load news: ${err.message}</div>`;
  }
}

init();

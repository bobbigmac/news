import { getColumnCount } from './layout.js';
import { buildViewModel } from './view-model.js';
import {
  applySettings,
  collectSourcesFromDigest,
  state,
  ui,
} from './state.js';
import { renderCategoryFilterBar, renderSourceBar } from './filters.js';
import { clearFeed, renderFeed, syncFeedToSearch } from './feed.js';
import { formatDate } from './article.js';
import { sortClusters } from './ordering.js';
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

  // Back to top: visible only past two viewport heights, and only when the
  // viewport is wide enough for it to sit in the gutter just right of the
  // broadsheet column — never overlapping content a phone reader might copy.
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    const sheet = document.getElementById('broadsheet');
    const syncBackToTop = () => {
      if (window.scrollY <= window.innerHeight * 2) {
        backToTop.hidden = true;
        return;
      }
      const rect = sheet?.getBoundingClientRect();
      if (!rect) {
        backToTop.hidden = true;
        return;
      }
      const gutter = window.innerWidth - rect.right;
      const needed = backToTop.offsetWidth + 16;
      if (gutter < needed) {
        backToTop.hidden = true;
        return;
      }
      backToTop.style.left = `${rect.right + 8}px`;
      backToTop.hidden = false;
    };
    let scrollTick = false;
    window.addEventListener('scroll', () => {
      if (scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(() => {
        scrollTick = false;
        syncBackToTop();
      });
    }, { passive: true });
    window.addEventListener('resize', syncBackToTop);
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    syncBackToTop();
  }

  // Escape closes sidebar / changelog / search
  function closeAllOverlays() {
    document.getElementById('settings-panel')?.classList.add('hidden');
    document.getElementById('changelog-page')?.classList.add('hidden');
    document.getElementById('category-panel')?.classList.add('hidden');
    document.getElementById('source-panel')?.classList.add('hidden');
  }

  // Clicking outside an open side panel closes it. This runs in the capture
  // phase so the first outside click does not also activate whatever is behind
  // the panel. The settings toggle is left alone so it keeps its toggle behaviour.
  document.addEventListener('click', (e) => {
    const panelSelector = '#settings-panel, #category-panel, #source-panel';
    const openPanels = [...document.querySelectorAll(panelSelector)]
      .filter(panel => !panel.classList.contains('hidden'));
    if (!openPanels.length) return;

    const insidePanel = !!e.target.closest(panelSelector);
    if (insidePanel) return;

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
      const si = document.getElementById('filter');
      if (si) {
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
    const bootT0 = performance.now();
    const res = await fetch('digest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fetchedAt = performance.now();
    const digestBytes = parseInt(res.headers.get('content-length') || '0', 10) || null;
    state.digest = await res.json();
    const parsedAt = performance.now();
    state.clientPerf.boot = {
      fetchMs: Math.round(fetchedAt - bootT0),
      parseMs: Math.round(parsedAt - fetchedAt),
      digestBytes,
      recentClusters: (state.digest.clusters || []).length,
    };

    // Backfill tags for signals saved before metadata enrichment
    backfillInterestSignals(state.digest.clusters || []);

    // Cache signal weights for this page session
    refreshSignalProfile();

    const renderT0 = performance.now();
    renderDigest(state.digest, state.settings);
    state.clientPerf.boot.renderMs = Math.round(performance.now() - renderT0);
    state.clientPerf.boot.totalMs = Math.round(performance.now() - bootT0);
    renderCategoryPrefs();
    renderSourcePrefs();
    initSearch();
    scheduleArchiveLoad();
  } catch (err) {
    console.error('Failed to load news:', err);
    document.getElementById('broadsheet').innerHTML =
      `<div class="loading">Failed to load news: ${err.message}</div>`;
  }
}

// The recent digest covers the 7-day window. Readers with a wider window get
// the archive merged in progressively after first paint — never on the boot
// path, and never at all for readers on the default window.
function scheduleArchiveLoad() {
  const ageDays = parseInt(state.settings.ageLimit, 10) || 7;
  if (ageDays <= 7) {
    state.clientPerf.archive = { skipped: true };
    return;
  }
  const load = async () => {
    const t0 = performance.now();
    try {
      const res = await fetch('digest-archive.json');
      if (!res.ok) {
        state.clientPerf.archive = { skipped: true, reason: `HTTP ${res.status}` };
        return;
      }
      const fetchedAt = performance.now();
      const archive = await res.json();
      const parsedAt = performance.now();
      const before = (state.digest.clusters || []).length;
      state.digest.clusters = (state.digest.clusters || []).concat(archive.clusters || []);
      const renderT0 = performance.now();
      ui.refresh();
      state.clientPerf.archive = {
        fetchMs: Math.round(fetchedAt - t0),
        parseMs: Math.round(parsedAt - fetchedAt),
        mergeRenderMs: Math.round(performance.now() - renderT0),
        archiveClusters: (archive.clusters || []).length,
        totalClusters: before + (archive.clusters || []).length,
      };
    } catch (err) {
      state.clientPerf.archive = { skipped: true, reason: err.message };
    }
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => load(), { timeout: 2000 });
  } else {
    setTimeout(load, 50);
  }
}

init();

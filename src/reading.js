import { saveGlimpseState, saveReadState, state, ui } from './state.js';

export function isClusterGlimpsed(cluster) {
  return !!state.glimpseState[cluster.id];
}

// Glimpses do not expire, but an updated cluster should still present its new
// full copy until the updated version has itself been glimpsed.
export function isCurrentVersionGlimpsed(cluster) {
  const entry = state.glimpseState[cluster.id];
  return !!entry && entry.contentVersion >= (cluster.contentVersion || 1);
}

export function recordClusterGlimpsed(cluster) {
  const existing = state.glimpseState[cluster.id];
  if (existing && existing.contentVersion >= (cluster.contentVersion || 1)) return false;
  state.glimpseState[cluster.id] = {
    contentVersion: cluster.contentVersion || 1,
    firstAt: existing?.firstAt || existing?.at || Date.now(),
    at: Date.now(),
  };
  return true;
}

export function isClusterRead(cluster) {
  const entry = state.readState[cluster.id];
  if (!entry) return false;
  return entry.contentVersion >= (cluster.contentVersion || 1);
}

export function isClusterUpdatedSinceRead(cluster) {
  const entry = state.readState[cluster.id];
  if (!entry) return false;
  return (cluster.contentVersion || 1) > entry.contentVersion;
}

export function markClusterRead(cluster) {
  state.readState[cluster.id] = { contentVersion: cluster.contentVersion || 1, at: Date.now() };
  saveReadState();
  ui.updateReadCount();
}

// --- Glimpse tracking ---
// Independent of read state: any article visibility is recorded, but the
// collapsed/short treatment is only applied when an article is rendered later.
// Changing the already-rendered card when it scrolls past would reflow the
// rest of the masonry underneath the reader.
let glimpseObserver = null;

export function refreshGlimpseObserver() {
  if (glimpseObserver) glimpseObserver.disconnect();
  glimpseObserver = null;

  const articles = document.querySelectorAll('.article[data-cluster-id]:not(.article-lazy)');
  if (!articles.length || !state.digest) return;

  glimpseObserver = new IntersectionObserver((entries) => {
    let changed = false;
    for (const ent of entries) {
      if (!ent.isIntersecting) continue;
      const clusterId = ent.target.dataset.clusterId;
      const cluster = state.digest?.clusters?.find(c => c.id === clusterId);
      if (cluster && recordClusterGlimpsed(cluster)) changed = true;
    }
    if (changed) saveGlimpseState();
  }, { threshold: 0 });

  articles.forEach(article => glimpseObserver.observe(article));
}

// --- Read tracking (viewport dwell timer) ---
// Single IntersectionObserver + single rAF loop — no per-tile handlers.
// Modes:
//   hover — only the tile under the cursor accumulates (2s)
//   focus — multiple tiles around cursor accumulate with distance falloff (2s)
//   turbo — auto-selects closest tile to viewport top-center (2s)
// Counter is non-cumulative: resets when active article(s) change.
// Clicking a link marks read instantly.
// The top border fills left-to-right as a progress indicator.

const READ_THRESHOLDS = { hover: 2500, focus: 2500, turbo: 2500 }; // ms of dwell needed
const FOCUS_MAX_RADIUS = 500; // px — articles beyond this get zero rate
let readObserver = null;
let readRafId = null;
let readProgress = new Map(); // clusterId -> { progress, lastTs, articleEl, cluster }
let readVisible = new Set(); // clusterIds with headline fully in viewport
let readHoveredClusterId = null;
let readLastActiveId = null; // the single article we're currently accumulating for
let readCursorX = 0;
let readCursorY = 0;
let readActive = true; // false when cursor leaves container or tab is hidden

export function initReadInteraction() {
  const sheet = document.getElementById('broadsheet');

  // Single mouseover listener — tracks which article the cursor is over
  sheet.addEventListener('mouseover', (e) => {
    const article = e.target.closest('.article');
    readHoveredClusterId = article?.dataset?.clusterId || null;
  });
  sheet.addEventListener('mousemove', (e) => {
    readCursorX = e.clientX;
    readCursorY = e.clientY;
    readActive = true;
  });
  sheet.addEventListener('mouseleave', () => { readHoveredClusterId = null; readActive = false; });
  sheet.addEventListener('mouseenter', () => { readActive = true; });

  // Pause when tab is hidden (user switched away)
  document.addEventListener('visibilitychange', () => {
    readActive = !document.hidden;
    if (!readActive) {
      // Reset all lastTs so there's no time jump on return
      for (const p of readProgress.values()) p.lastTs = null;
    }
  });

  // Single click listener — article clicks mark read, except interactive controls
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('.interest-btn, .summary-short')) return; // controls handle their own behaviour
    const article = e.target.closest('.article');
    if (!article?.dataset?.clusterId) return;
    const cluster = state.digest?.clusters?.find(c => c.id === article.dataset.clusterId);
    if (cluster) markClusterRead(cluster);
    article.classList.add('is-read');
    article.style.setProperty('--read-progress', 1);
  });
}

export function refreshReadObserver() {
  if (readObserver) readObserver.disconnect();
  readProgress.clear();
  readVisible.clear();

  if (state.settings.markRead === 'off') {
    if (readRafId) { cancelAnimationFrame(readRafId); readRafId = null; }
    return;
  }

  readObserver = new IntersectionObserver((entries) => {
    for (const ent of entries) {
      const article = ent.target.closest('.article');
      if (!article) continue;
      const clusterId = article.dataset.clusterId;
      if (!clusterId) continue;

      if (ent.isIntersecting && ent.intersectionRatio >= 0.9) {
        readVisible.add(clusterId);
        if (!readProgress.has(clusterId)) {
          const cluster = state.digest?.clusters?.find(c => c.id === clusterId);
          readProgress.set(clusterId, { progress: 0, lastTs: null, articleEl: article, cluster });
        }
      } else {
        readVisible.delete(clusterId);
        const p = readProgress.get(clusterId);
        if (p) {
          p.lastTs = null;
          p.progress = 0;
          p.articleEl.style.setProperty('--read-progress', 0);
        }
      }
    }
    if (readVisible.size > 0 && !readRafId) readRafLoop();
  }, { threshold: [0, 0.9] });

  document.querySelectorAll('.article:not(.article-lazy) .article-headline').forEach(h => {
    readObserver.observe(h);
  });
}

function pickActiveArticle() {
  // Hover mode: only accumulate for the article the cursor is over
  if (state.settings.markRead === 'hover') {
    if (readHoveredClusterId && readVisible.has(readHoveredClusterId)) {
      return readHoveredClusterId;
    }
    return null;
  }
  // Turbo: prefer the article the mouse is over, if it's in viewport
  if (readHoveredClusterId && readVisible.has(readHoveredClusterId)) {
    return readHoveredClusterId;
  }
  // Otherwise pick the visible article closest to viewport top-center
  let bestId = null;
  let bestDist = Infinity;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (const clusterId of readVisible) {
    const p = readProgress.get(clusterId);
    if (!p || p.articleEl.classList.contains('is-read')) continue;
    const r = p.articleEl.querySelector('.article-headline')?.getBoundingClientRect();
    if (!r) continue;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(cx - vw / 2, cy - vh * 0.3);
    if (dist < bestDist) { bestDist = dist; bestId = clusterId; }
  }
  return bestId;
}

function readRafLoop() {
  const threshold = READ_THRESHOLDS[state.settings.markRead] || 0;
  if (threshold === 0 || readVisible.size === 0) {
    readRafId = null;
    return;
  }

  const now = performance.now();
  const mode = state.settings.markRead;

  if (!readActive) {
    // Cursor left container or tab hidden — pause all timers, no accumulation
    for (const p of readProgress.values()) p.lastTs = null;
    readRafId = requestAnimationFrame(readRafLoop);
    return;
  }

  if (mode === 'focus' || mode === 'turbo') {
    // Focus circle / Turbo: multiple articles accumulate simultaneously.
    // Focus: rate falls off with distance from cursor.
    // Turbo: full rate for all visible articles.
    // Reset all when hovered article changes (cursor moved to a new area).
    if (readLastActiveId !== readHoveredClusterId) {
      for (const id of readVisible) {
        const p = readProgress.get(id);
        if (p) {
          p.lastTs = null;
          p.progress = 0;
          p.articleEl.style.setProperty('--read-progress', 0);
        }
      }
      readLastActiveId = readHoveredClusterId;
    }

    for (const clusterId of readVisible) {
      const p = readProgress.get(clusterId);
      if (!p || p.articleEl.classList.contains('is-read')) continue;

      if (p.lastTs !== null) {
        let delta = now - p.lastTs;

        if (mode === 'focus') {
          const r = p.articleEl.querySelector('.article-headline')?.getBoundingClientRect();
          if (!r) { p.lastTs = now; continue; }

          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dist = Math.hypot(cx - readCursorX, cy - readCursorY);
          const rate = Math.max(0, 1 - dist / FOCUS_MAX_RADIUS);

          if (rate <= 0) { p.lastTs = now; continue; }
          delta *= rate;
        }

        p.progress += delta;

        const ratio = Math.min(1, p.progress / threshold);
        p.articleEl.style.setProperty('--read-progress', ratio);

        if (p.progress >= threshold) {
          markClusterRead(p.cluster);
          p.articleEl.classList.add('is-read');
          readVisible.delete(clusterId);
        }
      }
      p.lastTs = now;
    }
  } else {
    // Hover / Turbo: single active article
    const activeId = pickActiveArticle();

    // Reset the previously active article — non-cumulative, per-view only
    if (readLastActiveId && readLastActiveId !== activeId) {
      const prevP = readProgress.get(readLastActiveId);
      if (prevP) {
        prevP.lastTs = null;
        prevP.progress = 0;
        prevP.articleEl.style.setProperty('--read-progress', 0);
      }
    }
    readLastActiveId = activeId;

    if (activeId) {
      const p = readProgress.get(activeId);
      if (p && !p.articleEl.classList.contains('is-read')) {
        if (p.lastTs !== null) {
          let delta = now - p.lastTs;
          p.progress += delta;

          const ratio = Math.min(1, p.progress / threshold);
          p.articleEl.style.setProperty('--read-progress', ratio);

          if (p.progress >= threshold) {
            markClusterRead(p.cluster);
            p.articleEl.classList.add('is-read');
            readVisible.delete(activeId);
          }
        }
        p.lastTs = now;
      }
    }
  }

  readRafId = requestAnimationFrame(readRafLoop);
}

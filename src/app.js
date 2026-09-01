import Masonry from 'masonry-layout';

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
  ageLimit: '30',
  mode: 'all',
  categoryFilter: 'all',
  watchWords: '',
  expandAll: false,
  showUpdated: false,
  theme: 'auto',
  markRead: 'off'
};

const THEME_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
];

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

const AGE_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
];

const MARK_READ_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'hover', label: 'Hover' },
  { value: 'focus', label: 'Focus' },
  { value: 'turbo', label: 'Turbo' },
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
  // Theme
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = settings.theme === 'auto' ? (prefersDark ? 'night' : 'day') : settings.theme;
  document.documentElement.setAttribute('data-theme', effective);
  // Columns
  const sheet = document.getElementById('broadsheet');
  sheet.className = `broadsheet cols-${settings.columns}`;
}

// Auto-switch theme when system preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentSettings.theme === 'auto') applySettings(currentSettings);
});

let currentDigest = null;
let currentSettings = loadSettings();
let masonryInstance = null;

function initMasonry() {
  if (masonryInstance) masonryInstance.destroy();
  const sheet = document.getElementById('broadsheet');
  if (typeof Masonry !== 'undefined' && sheet.querySelector('.grid-item')) {
    let cols = parseInt(currentSettings?.columns, 10) || 2;
    if (window.innerWidth <= 768) cols = 1;
    else if (window.innerWidth <= 1024 && cols > 3) cols = 3;

    const gutter = 20;
    const style = getComputedStyle(sheet);
    const padL = parseFloat(style.paddingLeft) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    const contentWidth = sheet.clientWidth - padL - padR;
    const colWidth = (contentWidth - (cols - 1) * gutter) / cols;

    // Set explicit item widths so Masonry positions correctly
    sheet.querySelectorAll('.grid-item').forEach(item => {
      item.style.width = colWidth + 'px';
    });

    masonryInstance = new Masonry(sheet, {
      itemSelector: '.grid-item',
      columnWidth: colWidth,
      gutter: gutter,
    });
    // Re-layout when images load (they change item heights)
    sheet.querySelectorAll('img').forEach(img => {
      if (!img.complete) {
        img.addEventListener('load', () => masonryInstance?.layout());
        img.addEventListener('error', () => masonryInstance?.layout());
      }
    });
  }
}
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
  const cat = Array.isArray(category) ? category[0] : category;
  return catPrefs[cat] || 'normal';
}

function getAllKnownCategories(clusters) {
  const fromDigest = new Set();
  for (const c of clusters) {
    if (c.category) {
      const cat = Array.isArray(c.category) ? c.category[0] : c.category;
      if (cat) fromDigest.add(cat);
    }
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

function initReadInteraction() {
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

  // Single click listener — clicking anywhere on an article marks it read
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('.interest-btn')) return; // interest buttons handle their own read-marking
    const article = e.target.closest('.article');
    if (!article?.dataset?.clusterId) return;
    const cluster = currentDigest?.clusters?.find(c => c.id === article.dataset.clusterId);
    if (cluster) markClusterRead(cluster);
    article.classList.add('is-read');
    article.style.setProperty('--read-progress', 1);
  });
}

function refreshReadObserver() {
  if (readObserver) readObserver.disconnect();
  readProgress.clear();
  readVisible.clear();

  if (currentSettings.markRead === 'off') {
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
          const cluster = currentDigest?.clusters?.find(c => c.id === clusterId);
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

  document.querySelectorAll('.article .article-headline').forEach(h => {
    readObserver.observe(h);
  });
}

function pickActiveArticle() {
  // Hover mode: only accumulate for the article the cursor is over
  if (currentSettings.markRead === 'hover') {
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
  const threshold = READ_THRESHOLDS[currentSettings.markRead] || 0;
  if (threshold === 0 || readVisible.size === 0) {
    readRafId = null;
    return;
  }

  const now = performance.now();
  const mode = currentSettings.markRead;

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

// --- Interest signals (Steam discovery queue style) ---
// Each cluster can be marked 'interested' or 'not-interested' by the user.
// This is an algorithmic signal, not a like/dislike of the story.
// Signals store compact metadata so we can build a local interest profile.

// --- Tag extraction ---
// Tags are computed server-side at build time (compromise NER + TF-IDF) and
// embedded in the digest as cluster.tags. We just read them here.
// Fallback uses trigger words + category for old digests without tags.

function extractTags(cluster) {
  if (cluster.tags && Array.isArray(cluster.tags)) return cluster.tags;

  // Fallback for clusters without pre-computed tags
  const tags = [];
  const cat = Array.isArray(cluster.category) ? cluster.category[0] : cluster.category;
  if (cat && cat !== 'Other' && cat !== 'General') tags.push(cat.toLowerCase());
  for (const tw of (cluster.triggerWords || [])) {
    const lt = tw.toLowerCase().trim();
    if (lt && lt.length >= 2) tags.push(lt);
  }
  const plugin = cluster.stories?.find(s => s.plugin)?.plugin;
  if (plugin) tags.push(plugin.toLowerCase());
  return [...new Set(tags)].slice(0, 12);
}

function buildSignalMeta(cluster) {
  const cat = Array.isArray(cluster.category) ? cluster.category[0] || 'Other' : (cluster.category || 'Other');
  const sources = [...new Set((cluster.stories || []).map(s => s.sourceName).filter(Boolean))].slice(0, 3);
  return {
    h: (cluster.headline || '').slice(0, 120),
    cat,
    tags: extractTags(cluster),
    src: sources,
  };
}

function loadInterestState() {
  try {
    interestState = JSON.parse(localStorage.getItem(INTEREST_KEY) || '{}');
  } catch { interestState = {}; }
}

// Backfill tags for signals saved before metadata enrichment was added
function backfillInterestSignals(clusters) {
  const clusterMap = new Map(clusters.map(c => [c.id, c]));
  let changed = false;
  for (const [id, entry] of Object.entries(interestState)) {
    if (entry.tags) continue; // already has metadata
    const cluster = clusterMap.get(id);
    if (!cluster) continue; // no longer in digest, can't backfill
    const meta = buildSignalMeta(cluster);
    entry.h = meta.h;
    entry.cat = meta.cat;
    entry.tags = meta.tags;
    entry.src = meta.src;
    changed = true;
  }
  if (changed) saveInterestState();
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
    interestState[cluster.id] = {
      signal,
      at: Date.now(),
      ...buildSignalMeta(cluster),
    };
  }
  saveInterestState();
}

function getInterestStats() {
  const interested = Object.values(interestState).filter(i => i.signal === 'interested').length;
  const notInterested = Object.values(interestState).filter(i => i.signal === 'not-interested').length;
  return { interested, notInterested, total: interested + notInterested };
}

// --- Signal-based scoring (v2: specificity-weighted, category-aware) ---
//
// Problems with the old algorithm:
//   1. No tag specificity — "technology" (in 17 clusters) counted the same
//      as "gta 6" (in 1 cluster). Generic tags dominated the score.
//   2. Sources mixed with topics — downvoting BBC sports downranked all BBC.
//   3. No category signal — the category itself is a strong indicator but
//      wasn't used in scoring.
//   4. Competing pool problem — downvoting boring non-gaming news suppressed
//      everything non-gaming because shared generic tags accumulated negative
//      weight, accidentally boosting gaming by default.
//   5. Linear scoring — up and down were treated as opposite ends of one
//      axis, but they're independent dimensions.
//
// New approach:
//   - Tags are weighted by IDF (rarity). A tag in 1 cluster is worth more
//     than one in 15 clusters.
//   - Category is a first-class signal, separate from tags.
//   - Structural tags (category name, plugin name) have capped weight — they're
//     broad buckets, not topic identifiers.
//   - Positive and negative scores are independent dimensions. A story can
//     be "interesting topic" AND "disliked source" — these don't cancel.
//   - The final score is positive - negative, but the filter threshold is
//     asymmetric: it takes more negative signal to hide a story than positive
//     signal to boost it (avoids accidental suppression).

let _cachedProfile = null;
let _cachedTagDF = null; // document frequency for IDF calculation
let _allClusters = [];   // set during render, used for IDF calculation

// Build a tag document-frequency map from the current digest.
// This lets us weight rare tags higher than common ones.
function buildTagDF(clusters) {
  const df = new Map();
  for (const c of clusters) {
    for (const tag of extractTags(c)) {
      df.set(tag, (df.get(tag) || 0) + 1);
    }
  }
  return df;
}

function getTagDF() {
  if (!_cachedTagDF && _allClusters.length) {
    _cachedTagDF = buildTagDF(_allClusters);
  }
  return _cachedTagDF || new Map();
}

// Structural tags are broad buckets (category names, plugin names) — they
// should have lower weight than specific topic tags.
const STRUCTURAL_TAG_PREFIXES = ['xbox', 'playstation', 'nintendo', 'steam'];

function isStructuralTag(tag, cluster) {
  const cat = Array.isArray(cluster.category) ? cluster.category[0] : cluster.category;
  if (cat && tag === cat.toLowerCase()) return true;
  const plugin = cluster.stories?.find(s => s.plugin)?.plugin;
  if (plugin && tag === plugin.toLowerCase()) return true;
  if (STRUCTURAL_TAG_PREFIXES.includes(tag)) return true;
  return false;
}

// Compute the weight of a tag: IDF * count, capped for structural tags.
function tagWeight(tag, count, cluster, df) {
  const docCount = df.size || 1;
  const idf = Math.log(docCount / (df.get(tag) || 1));
  // Clamp IDF to [0.1, 3] — very rare tags get max 3x, very common get min 0.1x
  const clampedIdf = Math.max(0.1, Math.min(3, idf));
  let weight = count * clampedIdf;
  // Cap structural tags at 0.5 — they're broad buckets, not topic identifiers
  if (isStructuralTag(tag, cluster)) weight = Math.min(weight, 0.5);
  return weight;
}

function buildSignalProfile() {
  const interested = {};   // tag -> count
  const notInterested = {}; // tag -> count
  const catInterested = {}; // category -> count
  const catNotInterested = {}; // category -> count
  let totalInterested = 0;
  let totalNotInterested = 0;

  for (const entry of Object.values(interestState)) {
    if (entry.signal === 'interested') {
      totalInterested++;
      if (entry.cat) catInterested[entry.cat.toLowerCase()] = (catInterested[entry.cat.toLowerCase()] || 0) + 1;
      for (const tag of (entry.tags || [])) {
        interested[tag] = (interested[tag] || 0) + 1;
      }
    } else if (entry.signal === 'not-interested') {
      totalNotInterested++;
      if (entry.cat) catNotInterested[entry.cat.toLowerCase()] = (catNotInterested[entry.cat.toLowerCase()] || 0) + 1;
      for (const tag of (entry.tags || [])) {
        notInterested[tag] = (notInterested[tag] || 0) + 1;
      }
    }
  }
  return { interested, notInterested, catInterested, catNotInterested, totalInterested, totalNotInterested };
}

function getSignalProfile() {
  if (!_cachedProfile) _cachedProfile = buildSignalProfile();
  return _cachedProfile;
}

function refreshSignalProfile() {
  _cachedProfile = buildSignalProfile();
  _cachedTagDF = null;
}

function scoreClusterAgainstSignals(cluster) {
  const tags = extractTags(cluster);
  const tagSet = new Set(tags);
  const profile = getSignalProfile();
  const df = getTagDF();
  const cat = (Array.isArray(cluster.category) ? cluster.category[0] : cluster.category || '').toLowerCase();

  let posScore = 0, negScore = 0;
  const matchedTags = [];

  // --- Tag-based scoring (IDF-weighted) ---
  for (const tag of tagSet) {
    if (profile.interested[tag]) {
      const w = tagWeight(tag, profile.interested[tag], cluster, df);
      posScore += w;
      matchedTags.push({ tag, weight: w, signal: 'interested' });
    }
    if (profile.notInterested[tag]) {
      const w = tagWeight(tag, profile.notInterested[tag], cluster, df);
      negScore += w;
      matchedTags.push({ tag, weight: w, signal: 'not-interested' });
    }
  }

  // --- Category-based scoring ---
  // Category is a strong signal but has lower max weight than specific tags.
  // This catches "I like sport" even when individual sport stories don't share
  // many tags, and "I don't like celebrity" without needing every celebrity
  // name to be downvoted.
  if (cat && profile.catInterested[cat]) {
    const catWeight = Math.min(profile.catInterested[cat] * 0.5, 2);
    posScore += catWeight;
    matchedTags.push({ tag: `[category: ${cat}]`, weight: catWeight, signal: 'interested' });
  }
  if (cat && profile.catNotInterested[cat]) {
    const catWeight = Math.min(profile.catNotInterested[cat] * 0.5, 2);
    negScore += catWeight;
    matchedTags.push({ tag: `[category: ${cat}]`, weight: catWeight, signal: 'not-interested' });
  }

  // --- Competing pool compensation ---
  // If the user has downvoted a LOT of stories (e.g. 20+), the negative
  // weights accumulate across many tags and can swamp any story that shares
  // even one generic tag with a downvoted story. To compensate, we scale down
  // the negative score when the user has downvoted many stories — the more
  // they've downvoted, the more we discount the negative signal, because
  // at high volumes it's more about filtering noise than expressing topic
  // preferences.
  if (profile.totalNotInterested > 10) {
    const dampening = Math.max(0.3, 1 - (profile.totalNotInterested - 10) * 0.05);
    negScore *= dampening;
  }

  // The final score is positive - negative, but with asymmetric thresholds:
  // it takes more negative signal to hide a story (threshold -5) than
  // positive signal to boost it (threshold +2). This prevents accidental
  // suppression from accumulated generic-tag negative weight.
  const score = posScore - negScore;
  const signalType = score > 1 ? 'interested' : score < -3 ? 'not-interested' : null;
  return { score, posScore, negScore, matchedTags, signalType };
}

function getTopSignalTags(signalType, limit = 10) {
  // Use fresh profile for changelog display, not the cached page-load one
  const profile = buildSignalProfile();
  const df = getTagDF();
  const bucket = signalType === 'interested' ? profile.interested : profile.notInterested;
  // Sort by IDF-weighted count (rare + frequent = strongest signal)
  return Object.entries(bucket)
    .map(([tag, count]) => {
      const idf = Math.log((df.size || 1) / (df.get(tag) || 1));
      const clampedIdf = Math.max(0.1, Math.min(3, idf));
      return [tag, count, count * clampedIdf];
    })
    .sort((a, b) => b[2] - a[2])
    .slice(0, limit)
    .map(([tag, count]) => [tag, count]);
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
  if (!dates.length) return String(cluster.updated || cluster.created || '');
  return new Date(Math.max(...dates)).toISOString();
}

function sortClusters(clusters, sortMode) {
  const sorted = [...clusters];
  const profile = getSignalProfile();
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

function pickLeadImage(cluster) {
  const withImage = (cluster.stories || []).filter(s => s.image && s.image !== 'None');
  if (!withImage.length) return null;
  return withImage[0];
}

function renderArticle(cluster, settings, isPluginLead) {
  const category = Array.isArray(cluster.category) ? cluster.category[0] || 'Other' : (cluster.category || 'Other');
  const headline = cluster.headline || 'Untitled';
  const summary = cluster.summary || '';
  const wasUpdated = isClusterUpdatedSinceRead(cluster);
  const storyCount = (cluster.stories || []).length;
  const isSingleton = storyCount === 1;
  const singletonStory = isSingleton ? cluster.stories[0] : null;

  // For multi-story clusters, build the expandable source list.
  // For singletons, the headline itself links to the source — no list needed.
  let linksHtml = '';
  let headlineHtml = '';
  if (isSingleton && singletonStory) {
    const sourceParts = [];
    if (singletonStory.source) sourceParts.push(singletonStory.source);
    if (singletonStory.sourceName) sourceParts.push(singletonStory.sourceName);
    const byline = sourceParts.length ? ` — ${sourceParts.join(' · ')}` : '';
    headlineHtml = `<h2 class="article-headline"><a href="${singletonStory.url || '#'}" target="_blank" rel="noopener">${headline}</a><span class="singleton-byline">${byline}</span></h2>`;
  } else {
    linksHtml = (cluster.stories || []).map(s => {
      const sourceParts = [];
      if (s.source) sourceParts.push(s.source);
      if (s.sourceName) sourceParts.push(s.sourceName);
      const sourceHtml = sourceParts.length
        ? `<span class="story-source">— ${sourceParts.join(' · ')}</span>` : '';
      return `<li><a href="${s.url || '#'}" target="_blank" rel="noopener">${s.title || 'Untitled'}</a>${sourceHtml}</li>`;
    }).join('');
    headlineHtml = `<h2 class="article-headline">${headline}</h2>`;
  }

  const article = document.createElement('article');
  article.className = 'article grid-item';
  if (isSingleton) article.classList.add('singleton');
  article.dataset.clusterId = cluster.id;
  article.dataset.headline = headline.toLowerCase();
  article.dataset.summary = summary.toLowerCase();
  article.dataset.category = category.toLowerCase();
  if (wasUpdated) article.classList.add('has-updates');
  if (matchesWatchWords(cluster)) article.classList.add('watch-match');

  // Signal-derived styling (subtle — these are guesses, not explicit signals)
  const signalScore = scoreClusterAgainstSignals(cluster);
  if (signalScore.score >= 1) article.classList.add('signal-suggested');
  else if (signalScore.score <= -3) article.classList.add('signal-demoted');

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

  // For singletons, no expandable source list — the headline is the link.
  // For multi-story clusters, keep the expandable list behaviour.
  const bodyHtml = isSingleton
    ? `<p class="article-summary">${summary}</p>`
    : `<div class="article-body${settings.expandAll ? ' show-links' : ''}">
         <p class="article-summary">${summary}</p>
         <div class="story-links">
           <ul>${linksHtml}</ul>
         </div>
       </div>`;

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
    ${headlineHtml}
    ${bodyHtml}
  `;

  // Apply interest-based visibility class
  if (interest === 'not-interested') article.classList.add('downranked');

  // Click toggles between summary and source links (multi-story only).
  // Singletons don't have an expandable list — the headline links directly.
  if (!isSingleton) {
    const body = article.querySelector('.article-body');
    article.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' || e.target.closest('.interest-btn')) return;
      body.classList.toggle('show-links');
      if (masonryInstance) masonryInstance.layout();
    });
  }

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
      article.classList.toggle('downranked', newInterest === 'not-interested');
      // Remove the article from the DOM after brief visual feedback
      // We don't re-render the digest — the cached signal profile keeps
      // remaining articles in their current order
      setTimeout(() => {
        article.remove();
        if (masonryInstance) masonryInstance.layout();
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
    if (getCatPref(c.category) !== 'hide') {
      const cat = Array.isArray(c.category) ? c.category[0] || 'Other' : (c.category || 'Other');
      cats.add(cat);
    }
  }
  // Sort by category preference priority, then alphabetical
  return [...cats].sort((a, b) => {
    const pa = CAT_PREF_ORDER[getCatPref(a)] ?? 1;
    const pb = CAT_PREF_ORDER[getCatPref(b)] ?? 1;
    if (pa !== pb) return pa - pb;
    return String(a).localeCompare(String(b));
  });
}

function renderDigest(digest, settings) {
  const sheet = document.getElementById('broadsheet');
  sheet.innerHTML = '';

  const allClusters = sortClusters(digest.clusters || [], settings.sort);
  _allClusters = allClusters; // make available for IDF calculation
  _cachedTagDF = null; // invalidate IDF cache on re-render

  if (!allClusters.length) {
    sheet.innerHTML = '<div class="loading">No news available yet. Check back later.</div>';
    return;
  }

  const modeFiltered = filterByMode(allClusters, settings.mode);

  // Filter out clusters older than the age limit
  const ageDays = parseInt(settings.ageLimit, 10) || 30;
  const ageCutoff = Date.now() - ageDays * 24 * 60 * 60 * 1000;
  const ageFiltered = modeFiltered.filter(c => {
    const newest = getNewestStoryDate(c);
    try { return new Date(newest).getTime() >= ageCutoff; } catch { return true; }
  });

  // Filter out hidden categories
  const visibleCats = ageFiltered.filter(c => getCatPref(c.category) !== 'hide');

  // Filter out clusters with strong negative signal score (guessed disinterest).
  // Asymmetric threshold: requires -5 to hide (harder than the old -3) because
  // the new IDF-weighted scoring produces smaller absolute scores for generic
  // tag matches, and we want to avoid accidental suppression.
  const signalFiltered = visibleCats.filter(c => {
    const explicit = getClusterInterest(c.id);
    if (explicit === 'interested') return true; // explicit interest always shows
    const signal = scoreClusterAgainstSignals(c);
    return signal.score > -5; // strong negative = hide
  });

  // Apply category filter (secondary filter)
  const catFiltered = settings.categoryFilter === 'all'
    ? signalFiltered
    : signalFiltered.filter(c => (c.category || 'Other') === settings.categoryFilter);

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
  initMasonry();
  refreshReadObserver();
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
    if (masonryInstance) masonryInstance.layout();
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
  const ageBtn = document.getElementById('setting-age');
  const themeBtn = document.getElementById('setting-theme');
  const expandAllCheck = document.getElementById('setting-expandall');
  const showUpdatedCheck = document.getElementById('setting-showupdated');
  const watchWordsInput = document.getElementById('setting-watchwords');
  const markReadBtn = document.getElementById('setting-markread');

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
    const ageOpt = AGE_OPTIONS.find(o => o.value === currentSettings.ageLimit) || AGE_OPTIONS[1];
    ageBtn.textContent = ageOpt.label;
    const themeOpt = THEME_OPTIONS.find(o => o.value === currentSettings.theme) || THEME_OPTIONS[0];
    themeBtn.textContent = themeOpt.label;
    const markReadOpt = MARK_READ_OPTIONS.find(o => o.value === currentSettings.markRead) || MARK_READ_OPTIONS[0];
    if (markReadBtn) markReadBtn.textContent = markReadOpt.label;
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
  makeCycleHandler(ageBtn, AGE_OPTIONS, currentSettings.ageLimit, { key: 'ageLimit' });
  makeCycleHandler(themeBtn, THEME_OPTIONS, currentSettings.theme, { key: 'theme' });
  if (markReadBtn) makeCycleHandler(markReadBtn, MARK_READ_OPTIONS, currentSettings.markRead, { key: 'markRead' });

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
        window._lastLog = log;
        renderChangelog(log);
        attachAlgoListeners();
      } catch {
        changelogBody.innerHTML = '<div class="loading">No run history available.</div>';
      }
    }
  });
  changelogClose.addEventListener('click', () => changelogPage.classList.add('hidden'));

  const resetReadBtn = document.getElementById('reset-read-log');
  if (resetReadBtn) {
    resetReadBtn.addEventListener('click', () => {
      readState = {};
      saveReadState();
      document.querySelectorAll('.article.is-read').forEach(a => {
        a.classList.remove('is-read');
        a.style.setProperty('--read-progress', 0);
      });
      if (currentDigest) {
        renderDigest(currentDigest, currentSettings);
        initSearch();
      }
    });
  }
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

    // Interest profile — derived tags, not raw signals
    if (hasSignals) {
      html += '<div class="changelog-subsection"><small>Your interest profile</small>';

      const posTags = getTopSignalTags('interested', 15);
      const negTags = getTopSignalTags('not-interested', 15);

      if (posTags.length) {
        html += '<div class="algo-profile-group">';
        html += `<div class="algo-profile-label">✓ You seem interested in</div>`;
        html += '<div class="algo-profile-tags">';
        html += posTags.map(([t, c]) => `<span class="changelog-tag algo-tag-pos algo-tag-removable" data-tag="${t}" data-signal="interested">${t} <small>${c}</small><button class="algo-tag-remove" title="Remove">&times;</button></span>`).join(' ');
        html += '</div></div>';
      }

      if (negTags.length) {
        html += '<div class="algo-profile-group">';
        html += `<div class="algo-profile-label">✕ You seem uninterested in</div>`;
        html += '<div class="algo-profile-tags">';
        html += negTags.map(([t, c]) => `<span class="changelog-tag algo-tag-neg algo-tag-removable" data-tag="${t}" data-signal="not-interested">${t} <small>${c}</small><button class="algo-tag-remove" title="Remove">&times;</button></span>`).join(' ');
        html += '</div></div>';
      }

      if (!posTags.length && !negTags.length) {
        html += '<div class="loading">No tags extracted yet. Signal a few stories to build your profile.</div>';
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

function removeTagFromSignals(tag, signalType) {
  for (const id of Object.keys(interestState)) {
    const entry = interestState[id];
    if (entry.signal !== signalType) continue;
    if (entry.tags && entry.tags.includes(tag)) {
      entry.tags = entry.tags.filter(t => t !== tag);
      if (entry.tags.length === 0 && !entry.h) {
        // No metadata left at all — drop the signal entirely
        delete interestState[id];
      }
    }
  }
  saveInterestState();
}

function attachAlgoListeners() {
  const body = document.getElementById('changelog-body');
  
  // Tag removal — strips a tag from all signals of that type
  body.querySelectorAll('.algo-tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tag = btn.closest('.algo-tag-removable')?.dataset.tag;
      const signalType = btn.closest('.algo-tag-removable')?.dataset.signal;
      if (!tag || !signalType) return;
      removeTagFromSignals(tag, signalType);
      // Re-render the changelog and digest
      const log = window._lastLog || [];
      renderChangelog(log);
      attachAlgoListeners();
      if (currentDigest) renderDigest(currentDigest, currentSettings);
      initSearch();
    });
  });

  // Signal removal (individual cluster signals)
  body.querySelectorAll('.algo-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.algo-signal-item');
      if (!item) return;
      const clusterId = item.dataset.clusterId;
      if (clusterId && interestState[clusterId]) {
        delete interestState[clusterId];
        saveInterestState();
        const log = window._lastLog || [];
        renderChangelog(log);
        attachAlgoListeners();
        if (currentDigest) renderDigest(currentDigest, currentSettings);
        initSearch();
      }
    });
  });
}

async function init() {
  const dateEl = document.getElementById('masthead-date');
  if (dateEl) dateEl.textContent = formatDate(new Date().toISOString());

  initSettings();
  initReadInteraction();

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

  // Re-layout Masonry on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentDigest) renderDigest(currentDigest, currentSettings);
    }, 250);
  });

  try {
    const res = await fetch('digest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    currentDigest = await res.json();

    // Backfill tags for signals saved before metadata enrichment
    backfillInterestSignals(currentDigest.clusters || []);

    // Cache signal weights for this page session
    refreshSignalProfile();

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
    console.error('Failed to load news:', err);
    document.getElementById('broadsheet').innerHTML =
      `<div class="loading">Failed to load news: ${err.message}</div>`;
  }
}

init();

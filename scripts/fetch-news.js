import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getSourceName } from './sources.js';
import { fetchRssFeeds } from './fetch-rss.js';
import { fetchGuardianNews } from './fetch-guardian.js';

const API_BASE_URL = 'https://api.currentsapi.services/v1';
const CACHE_DIR = 'cache';
const CACHE_FILE = join(CACHE_DIR, 'currents-api.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const STORY_STORE_FILE = join(CACHE_DIR, 'stories.json');
const RETENTION_DAYS = 30;
const MAX_PUBLISHED_AGE_DAYS = 90;
const RUN_STATE_FILE = join(CACHE_DIR, 'run-state.json');
const DAILY_QUOTA = 20;
const FIXED_CALLS_PER_RUN = 2;
const RUNS_PER_DAY = 3;

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const API_KEY = process.env.CURRENTSAPI_SERVICES_KEY || '';
if (!API_KEY) { console.error('No API key found in .env or env'); process.exit(1); }

function readCache() {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    if (Date.now() - raw.fetchedAt < CACHE_TTL_MS) return raw.news;
    console.log('Cache expired, will fetch fresh.');
  } catch { /* invalid cache */ }
  return null;
}

function readCacheAnyAge() {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    return raw.news || null;
  } catch { return null; }
}

function writeCache(news) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), news }, null, 2));
}

async function fetchFromApi(endpoint, label) {
  const url = `${API_BASE_URL}/${endpoint}&apiKey=${encodeURIComponent(API_KEY)}`;
  console.log(`Fetching ${label} from Currents API...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status} for ${label}`);
  const data = await res.json();
  const news = data.news || [];
  console.log(`  ${label}: ${news.length} items`);
  return news;
}

function loadPlugins() {
  const raw = (process.env.SEARCH_PLUGINS || '').trim();
  if (!raw) return [];
  return raw.split(';').map((group) => {
    const keywords = group.split('|').map(t => t.trim()).filter(Boolean);
    if (!keywords.length) return null;
    const name = keywords[0].toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { name, keywords };
  }).filter(Boolean);
}

function loadRunState() {
  const today = new Date().toISOString().split('T')[0];
  const fresh = { runCount: 0, date: today, callsToday: 0, pluginLastRun: {}, pluginKeywordIndex: {} };
  if (!existsSync(RUN_STATE_FILE)) return fresh;
  try {
    const state = JSON.parse(readFileSync(RUN_STATE_FILE, 'utf8'));
    if (state.date !== today) return fresh;
    if (!state.pluginLastRun) state.pluginLastRun = {};
    if (!state.pluginKeywordIndex) state.pluginKeywordIndex = {};
    return state;
  } catch { return fresh; }
}

function saveRunState(state) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(RUN_STATE_FILE, JSON.stringify(state, null, 2));
}

async function runSearchPlugins(runState) {
  const plugins = loadPlugins();
  if (!plugins.length) return [];

  // Reserve budget for remaining fixed calls today
  const remainingRuns = Math.max(0, RUNS_PER_DAY - runState.runCount);
  const reservedForFixed = remainingRuns * FIXED_CALLS_PER_RUN;
  const pluginBudget = DAILY_QUOTA - runState.callsToday - reservedForFixed;

  if (pluginBudget <= 0) {
    console.log(`No spare budget for plugins (${runState.callsToday} used, ${reservedForFixed} reserved for fixed calls). Skipping.`);
    return [];
  }

  // Sort plugins by oldest last-run first (never-run = highest priority)
  const queue = [...plugins].sort((a, b) => {
    const aLast = runState.pluginLastRun[a.name] || 0;
    const bLast = runState.pluginLastRun[b.name] || 0;
    return aLast - bLast;
  });

  console.log(`Plugin budget: ${pluginBudget} spare calls (after reserving ${reservedForFixed} for fixed), ${queue.length} plugins queued`);

  const allResults = [];
  let pluginCalls = 0;
  for (const plugin of queue) {
    if (pluginCalls >= pluginBudget) {
      console.log(`Plugin budget exhausted, deferring remaining plugins`);
      break;
    }

    const terms = plugin.keywords;
    const kwIdx = (runState.pluginKeywordIndex[plugin.name] || 0) % terms.length;
    const keyword = terms[kwIdx];
    const nextIdx = (kwIdx + 1) % terms.length;
    console.log(`Plugin ${plugin.name}: using keyword "${keyword}" (${kwIdx + 1}/${terms.length})`);

    const queryParams = [`keywords=${encodeURIComponent(keyword)}`];
    if (plugin.country) queryParams.push(`country=${plugin.country}`);
    if (plugin.language) queryParams.push(`language=${plugin.language}`);
    const endpoint = `search?${queryParams.join('&')}`;

    try {
      const results = await fetchFromApi(endpoint, `plugin:${plugin.name}/${keyword}`);
      const seenIds = new Set();
      const pluginResults = [];
      for (const item of results) {
        if (!item.id || seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        item._plugin = plugin.name;
        item._pluginPriority = terms.findIndex(t =>
          (item.title || '').toLowerCase().includes(t.toLowerCase()) ||
          (item.description || '').toLowerCase().includes(t.toLowerCase())
        );
        if (item._pluginPriority < 0) item._pluginPriority = 99;
        pluginResults.push(item);
      }
      pluginResults.sort((a, b) => (a._pluginPriority ?? 99) - (b._pluginPriority ?? 99));
      allResults.push(...pluginResults);
      runState.callsToday++;
      pluginCalls++;
      runState.pluginLastRun[plugin.name] = Date.now();
      runState.pluginKeywordIndex[plugin.name] = nextIdx;
    } catch (err) {
      console.error(`Plugin ${plugin.name} failed: ${err.message}`);
    }
  }

  return allResults;
}

async function fetchLatestNews(runState) {
  const cached = readCache();
  if (cached) { console.log(`Using cached API response (${cached.length} items)`); return cached; }

  try {
    const general = await fetchFromApi('latest-news?language=en', 'general');
    const gb = await fetchFromApi('latest-news?language=en&country=gb', 'GB');
    runState.callsToday += FIXED_CALLS_PER_RUN;

    const deduped = new Map();
    for (const item of general) if (item.id) deduped.set(item.id, item);
    for (const item of gb) if (item.id && !deduped.has(item.id)) deduped.set(item.id, item);

    const news = [...deduped.values()];
    writeCache(news);
    console.log(`Combined: ${news.length} unique items (general: ${general.length}, GB: ${gb.length}), cached to ${CACHE_FILE}`);
    return news;
  } catch (err) {
    console.error(`API fetch failed: ${err.message}`);
    const stale = readCacheAnyAge();
    if (stale) {
      console.log(`Falling back to cached data (${stale.length} items, may be stale)`);
      return stale;
    }
    console.error('No cache available, cannot continue.');
    throw err;
  }
}

function loadStoryStore() {
  if (!existsSync(STORY_STORE_FILE)) return { stories: {} };
  try { return JSON.parse(readFileSync(STORY_STORE_FILE, 'utf8')); } catch { return { stories: {} }; }
}

function saveStoryStore(store) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(STORY_STORE_FILE, JSON.stringify(store, null, 2));
}

function pruneOldStories(store) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let pruned = 0;
  for (const id of Object.keys(store.stories)) {
    const s = store.stories[id];
    const lastSeen = new Date(s.lastSeen || s.firstSeen || 0).getTime();
    if (lastSeen < cutoff) { delete store.stories[id]; pruned++; }
  }
  if (pruned) console.log(`Pruned ${pruned} stories not seen in ${RETENTION_DAYS} days`);
}

function isPublishedTooOld(published) {
  if (!published) return false;
  try {
    const ts = new Date(published).getTime();
    if (!ts) return false;
    return ts < Date.now() - MAX_PUBLISHED_AGE_DAYS * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

function cullOldPublished(store) {
  let culled = 0;
  for (const id of Object.keys(store.stories)) {
    if (isPublishedTooOld(store.stories[id].published)) {
      delete store.stories[id];
      culled++;
    }
  }
  if (culled) console.log(`Culled ${culled} stories published more than ${MAX_PUBLISHED_AGE_DAYS} days ago`);
  return culled;
}

function normalizeStory(item) {
  const sourceName = getSourceName(item.url);
  return {
    id: item.id,
    title: item.title || '',
    description: item.description || '',
    content: item.content || '',
    url: item.url || '',
    image: item.image || '',
    source: item.author || item.source || '',
    sourceName: sourceName || '',
    published: item.published || '',
    category: item.category || 'General',
    keywords: item.keywords || '',
    plugin: item._plugin || null,
    pluginPriority: item._pluginPriority ?? null
  };
}

async function main() {
  console.log('=== Fetch News ===');
  const runState = loadRunState();
  runState.runCount++;
  console.log(`Run #${runState.runCount} today, ${runState.callsToday}/${DAILY_QUOTA} API calls used so far`);

  let newsItems = await fetchLatestNews(runState);
  if (!newsItems.length) { console.error('No news fetched. Aborting.'); return; }

  // Run search plugins (budget-aware)
  const pluginResults = await runSearchPlugins(runState);
  if (pluginResults.length) {
    const unique = pluginResults.filter(r => r.id && !newsItems.some(n => n.id === r.id));
    newsItems.push(...unique);
    console.log(`Plugins contributed ${unique.length} unique stories`);
  }

  // Fetch from optional RSS feeds (BBC, etc.) — no API quota impact
  const rssItems = await fetchRssFeeds();
  if (rssItems.length) {
    const unique = rssItems.filter(r => r.id && !newsItems.some(n => n.id === r.id));
    newsItems.push(...unique);
    console.log(`RSS feeds contributed ${unique.length} unique stories`);
  }

  // Fetch from Guardian API (optional, separate quota)
  const guardianItems = await fetchGuardianNews();
  if (guardianItems.length) {
    const unique = guardianItems.filter(r => r.id && !newsItems.some(n => n.id === r.id));
    newsItems.push(...unique);
    console.log(`Guardian contributed ${unique.length} unique stories`);
  }

  saveRunState(runState);

  // Filter out stories published more than MAX_PUBLISHED_AGE_DAYS ago
  const beforeAgeFilter = newsItems.length;
  newsItems = newsItems.filter(item => !isPublishedTooOld(item.published));
  if (beforeAgeFilter !== newsItems.length) {
    console.log(`Age filter: rejected ${beforeAgeFilter - newsItems.length} incoming stories older than ${MAX_PUBLISHED_AGE_DAYS} days`);
  }

  // Pre-filter: reject stories by category or title pattern
  const rejectCategories = (process.env.REJECT_CATEGORIES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const rejectTitles = (process.env.REJECT_TITLES || '').split('|').map(s => s.trim()).filter(Boolean);
  if (rejectCategories.length || rejectTitles.length) {
    const rejectRegex = rejectTitles.length ? new RegExp(rejectTitles.join('|'), 'i') : null;
    const matchesReject = (item) => {
      const cat = Array.isArray(item.category) ? item.category.join(' ') : (item.category || '');
      if (rejectCategories.length && rejectCategories.includes(cat.toLowerCase())) return true;
      if (rejectRegex && rejectRegex.test(item.title || '')) return true;
      return false;
    };

    // Filter incoming stories
    const before = newsItems.length;
    newsItems = newsItems.filter(item => !matchesReject(item));
    console.log(`Pre-filter: removed ${before - newsItems.length} incoming stories (REJECT_CATEGORIES=${rejectCategories.join(',')}, REJECT_TITLES=${rejectTitles.join('|')})`);

    // Purge existing stories from the store that match reject filters
    const store = loadStoryStore();
    let purged = 0;
    const purgedIds = new Set();
    for (const id of Object.keys(store.stories)) {
      if (matchesReject(store.stories[id])) {
        delete store.stories[id];
        purged++;
        purgedIds.add(id);
      }
    }
    if (purged) {
      console.log(`Retroactive purge: removed ${purged} existing stories from store`);
      saveStoryStore(store);

      // Also remove from summarised-ids so they don't linger
      const summarisedIdsPath = join(CACHE_DIR, 'summarised-ids.json');
      if (existsSync(summarisedIdsPath)) {
        const summarisedIds = JSON.parse(readFileSync(summarisedIdsPath, 'utf8'));
        const cleaned = summarisedIds.filter(id => store.stories[id]);
        if (cleaned.length !== summarisedIds.length) {
          writeFileSync(summarisedIdsPath, JSON.stringify(cleaned, null, 2));
          console.log(`  Also removed ${summarisedIds.length - cleaned.length} purged IDs from summarised-ids`);
        }
      }
    }

    // Always purge from digest — stories may be in digest but not in store
    const digestPath = join(CACHE_DIR, 'digest.json');
    if (existsSync(digestPath)) {
      const digest = JSON.parse(readFileSync(digestPath, 'utf8'));
      let storiesPurged = 0;
      for (const cluster of (digest.clusters || [])) {
        if (!cluster.stories) continue;
        cluster.stories = cluster.stories.filter(s => {
          if (purgedIds.has(s.id)) { storiesPurged++; return false; }
          if (rejectRegex && rejectRegex.test(s.title || '')) { storiesPurged++; return false; }
          const cat = Array.isArray(s.category) ? s.category.join(' ') : (s.category || '');
          if (rejectCategories.length && rejectCategories.includes(cat.toLowerCase())) { storiesPurged++; return false; }
          return true;
        });
      }
      const beforeClusters = digest.clusters.length;
      digest.clusters = digest.clusters.filter(c => (c.stories || []).length > 0);
      const clustersPurged = beforeClusters - digest.clusters.length;
      if (storiesPurged || clustersPurged) {
        writeFileSync(digestPath, JSON.stringify(digest, null, 2));
        console.log(`  Digest purge: removed ${storiesPurged} stories, ${clustersPurged} empty clusters`);
      }
    }
  }

  // Update story store
  const store = loadStoryStore();
  pruneOldStories(store);
  cullOldPublished(store);

  const now = new Date().toISOString();
  const newForSummariser = [];

  for (const item of newsItems) {
    if (!item.id) continue;
    const existing = store.stories[item.id];
    const normalized = normalizeStory(item);

    if (existing) {
      // Check if content actually changed
      const changed = existing.title !== normalized.title ||
        existing.description !== normalized.description ||
        existing.content !== normalized.content;
      if (changed) {
        store.stories[item.id] = { ...normalized, firstSeen: existing.firstSeen, lastSeen: now, lastUpdated: now };
        newForSummariser.push({ ...store.stories[item.id], _updated: true });
      } else {
        store.stories[item.id] = { ...existing, lastSeen: now };
      }
    } else {
      store.stories[item.id] = { ...normalized, firstSeen: now, lastSeen: now, lastUpdated: now };
      newForSummariser.push(store.stories[item.id]);
    }
  }

  saveStoryStore(store);

  // Write new/updated stories for summarise.js
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, 'raw-new.json'), JSON.stringify(newForSummariser, null, 2));

  console.log(`Done. ${Object.keys(store.stories).length} stories in store, ${newForSummariser.length} new/updated for summariser.`);
}

main().catch(err => { console.error(err); process.exit(1); });
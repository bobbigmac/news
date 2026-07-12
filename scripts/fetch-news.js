import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_BASE_URL = 'https://api.currentsapi.services/v1';
const CACHE_DIR = 'cache';
const CACHE_FILE = join(CACHE_DIR, 'currents-api.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const STORY_STORE_FILE = join(CACHE_DIR, 'stories.json');
const RETENTION_DAYS = 30;
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
  return raw.split(';').map((group, i) => {
    const keywords = group.split('|').map(t => t.trim()).filter(Boolean);
    if (!keywords.length) return null;
    const name = keywords[0].toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { name, keywords: group.trim() };
  }).filter(Boolean);
}

function loadRunState() {
  const today = new Date().toISOString().split('T')[0];
  const fresh = { runCount: 0, date: today, callsToday: 0, pluginLastRun: {} };
  if (!existsSync(RUN_STATE_FILE)) return fresh;
  try {
    const state = JSON.parse(readFileSync(RUN_STATE_FILE, 'utf8'));
    if (state.date !== today) return fresh;
    if (!state.pluginLastRun) state.pluginLastRun = {};
    return state;
  } catch { return fresh; }
}

function saveRunState(state) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(RUN_STATE_FILE, JSON.stringify(state, null, 2));
}

function rankByKeywords(items, keywordsStr) {
  const terms = keywordsStr.split('|').map(t => t.trim().toLowerCase()).filter(Boolean);
  return items.map(item => {
    const text = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
    let priority = -1;
    for (let i = 0; i < terms.length; i++) {
      if (text.includes(terms[i])) { priority = i; break; }
    }
    return { ...item, _pluginPriority: priority };
  }).sort((a, b) => {
    if (a._pluginPriority === -1) return 1;
    if (b._pluginPriority === -1) return -1;
    return a._pluginPriority - b._pluginPriority;
  });
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

    const terms = plugin.keywords.split('|').map(t => t.trim()).filter(Boolean);
    const queryParams = [`keywords=${encodeURIComponent(terms.join(' '))}`];
    if (plugin.country) queryParams.push(`country=${plugin.country}`);
    if (plugin.language) queryParams.push(`language=${plugin.language}`);
    const endpoint = `search?${queryParams.join('&')}`;

    try {
      const results = await fetchFromApi(endpoint, `plugin:${plugin.name}`);
      const ranked = rankByKeywords(results, plugin.keywords);
      for (const item of ranked) {
        item._plugin = plugin.name;
        item._pluginPriority = item._pluginPriority ?? 0;
      }
      allResults.push(...ranked);
      runState.callsToday++;
      pluginCalls++;
      runState.pluginLastRun[plugin.name] = Date.now();
    } catch (err) {
      console.error(`Plugin ${plugin.name} failed: ${err.message}`);
    }
  }

  return allResults;
}

async function fetchLatestNews() {
  const cached = readCache();
  if (cached) { console.log(`Using cached API response (${cached.length} items)`); return cached; }

  const [general, gb] = await Promise.all([
    fetchFromApi('latest-news?language=en', 'general'),
    fetchFromApi('latest-news?language=en&country=gb', 'GB'),
  ]);

  const deduped = new Map();
  for (const item of general) if (item.id) deduped.set(item.id, item);
  for (const item of gb) if (item.id && !deduped.has(item.id)) deduped.set(item.id, item);

  const news = [...deduped.values()];
  writeCache(news);
  console.log(`Combined: ${news.length} unique items (general: ${general.length}, GB: ${gb.length}), cached to ${CACHE_FILE}`);
  return news;
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
  if (pruned) console.log(`Pruned ${pruned} stories older than ${RETENTION_DAYS} days`);
}

function normalizeStory(item) {
  return {
    id: item.id,
    title: item.title || '',
    description: item.description || '',
    content: item.content || '',
    url: item.url || '',
    image: item.image || '',
    source: item.author || item.source || '',
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

  const newsItems = await fetchLatestNews();
  if (!newsItems.length) { console.error('No news fetched. Aborting.'); return; }
  runState.callsToday += FIXED_CALLS_PER_RUN;

  // Run search plugins (budget-aware)
  const pluginResults = await runSearchPlugins(runState);
  if (pluginResults.length) {
    const unique = pluginResults.filter(r => r.id && !newsItems.some(n => n.id === r.id));
    newsItems.push(...unique);
    console.log(`Plugins contributed ${unique.length} unique stories`);
  }

  saveRunState(runState);

  // Update story store
  const store = loadStoryStore();
  pruneOldStories(store);

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
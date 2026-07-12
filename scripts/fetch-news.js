import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const API_BASE_URL = 'https://api.currentsapi.services/v1';
const CACHE_DIR = 'cache';
const CACHE_FILE = join(CACHE_DIR, 'currents-api.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEWS_DIR = 'news';
const MAX_STORIES = 200;
const PLUGINS_FILE = 'search-plugins.json';
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

const API_KEY = process.env.currentsapi_services_key || process.env.CURRENTSAPI_SERVICES_KEY || '';
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
  if (!existsSync(PLUGINS_FILE)) return [];
  try { return JSON.parse(readFileSync(PLUGINS_FILE, 'utf8')); } catch { return []; }
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

function generateSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().substring(0, 60);
}

function loadProcessedIds() {
  const idsFile = join(CACHE_DIR, 'processed-ids.json');
  if (!existsSync(idsFile)) return new Set();
  try { return new Set(JSON.parse(readFileSync(idsFile, 'utf8'))); } catch { return new Set(); }
}

function saveProcessedIds(ids) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, 'processed-ids.json'), JSON.stringify([...ids], null, 2));
}

function loadExistingStories() {
  if (!existsSync(NEWS_DIR)) return new Map();
  const map = new Map();
  for (const file of readdirSync(NEWS_DIR)) {
    if (!file.endsWith('.md')) continue;
    try {
      const content = readFileSync(join(NEWS_DIR, file), 'utf8');
      const idMatch = content.match(/story_id:\s*"([^"]+)"/);
      if (idMatch) map.set(idMatch[1], { file, content, slug: file.replace('.md', '') });
    } catch {}
  }
  return map;
}

function newsToMarkdown(item) {
  const date = new Date(item.published).toISOString().split('T')[0];
  const slug = generateSlug(item.title);
  const category = (item.category || 'General').toString();
  const tags = [category.toLowerCase()];
  if (item.keywords) item.keywords.split(',').slice(0, 3).forEach(k => { const t = k.trim().toLowerCase(); if (t) tags.push(t); });
  const esc = (s) => (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const summary = item.description ? item.description.replace(/\r/g, '').replace(/\n+/g, ' ').trim() : '';
  const yaml = [
    '---',
    `title: "${esc(item.title)}"`,
    `published_date: "${date}"`,
    `summary: "${esc(summary)}"`,
    `category: "${category.charAt(0).toUpperCase() + category.slice(1)}"`,
    `tags: ${JSON.stringify(tags)}`,
    `story_id: "${item.id || ''}"`,
    item.image ? `image: "${esc(item.image)}"` : null,
    `source: "${esc(item.author || item.source || '')}"`,
    `external_links:`,
    `  - title: "Read full article"`,
    `    url: "${esc(item.url || '')}"`,
    '---',
    '',
    `# ${item.title}`,
    '',
    item.description || '',
    '',
    item.content || '',
    '---',
    ''
  ].filter(Boolean).join('\n');
  return { slug, markdown: yaml, storyId: item.id };
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
    const pluginIds = new Set(pluginResults.map(r => r.id).filter(Boolean));
    for (const item of newsItems) pluginIds.delete(item.id);
    const unique = pluginResults.filter(r => r.id && !newsItems.some(n => n.id === r.id));
    newsItems.push(...unique);
    console.log(`Plugins contributed ${unique.length} unique stories`);
  }

  saveRunState(runState);

  const existing = loadExistingStories();
  const processedIds = loadProcessedIds();
  const keepIds = new Set();
  const newRaw = [];
  const updatedRaw = [];

  for (const item of newsItems) {
    if (!item.id) continue;
    keepIds.add(item.id);
    if (existing.has(item.id)) {
      if (processedIds.has(item.id)) continue;
      updatedRaw.push(item);
    } else {
      newRaw.push(item);
    }
  }

  // Archive stories no longer in feed
  for (const [id, story] of existing) {
    if (!keepIds.has(id) && !story.content.includes('archived: true')) {
      writeFileSync(join(NEWS_DIR, story.file), story.content.replace('story_id:', 'archived: true\nstory_id:'));
      console.log(`Archived: ${story.file}`);
    }
  }

  // Write new + updated markdown
  let written = 0;
  for (const item of [...newRaw, ...updatedRaw]) {
    const { slug, markdown } = newsToMarkdown(item);
    writeFileSync(join(NEWS_DIR, `${slug}.md`), markdown);
    written++;
  }

  // Save raw JSON for summarise.js to consume
  const rawForSummariser = [...newRaw, ...updatedRaw].map(item => ({
    id: item.id, title: item.title, description: item.description || '',
    content: item.content || '', url: item.url || '', image: item.image || '',
    source: item.author || item.source || '', published: item.published,
    category: item.category || 'General', keywords: item.keywords || '',
    plugin: item._plugin || null, pluginPriority: item._pluginPriority ?? null
  }));
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, 'raw-new.json'), JSON.stringify(rawForSummariser, null, 2));

  // Update processed IDs (only items we actually wrote)
  for (const item of [...newRaw, ...updatedRaw]) processedIds.add(item.id);
  saveProcessedIds(processedIds);

  // Cleanup old stories
  if (existing.size + newRaw.length > MAX_STORIES) {
    for (const [id, story] of existing) {
      if (!keepIds.has(id)) { try { unlinkSync(join(NEWS_DIR, story.file)); } catch {} }
    }
  }

  console.log(`Done. ${newRaw.length} new, ${updatedRaw.length} updated, ${written} files written.`);
  console.log(`Raw for summariser: ${rawForSummariser.length} items in cache/raw-new.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
import Parser from 'rss-parser';
import { createHash } from 'crypto';
import { getSourceName } from './sources.js';

const parser = new Parser({ timeout: 5000 });

// Feed definitions. Each feed has a URL and a category mapping.
// Add more feeds here as needed.
const BBC_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'General' },
  { url: 'https://feeds.bbci.co.uk/news/uk/rss.xml', category: 'General' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'World' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'Business' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'Technology' },
  { url: 'https://feeds.bbci.co.uk/news/health/rss.xml', category: 'Health' },
  { url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', category: 'Politics' },
  { url: 'https://feeds.bbci.co.uk/news/education/rss.xml', category: 'Education' },
  // { url: 'https://feeds.bbci.co.uk/sport/rss.xml', category: 'Sports' }, // disabled — re-enable if needed
];

const GAMING_FEEDS = [
  { url: 'https://www.eurogamer.net/feed/news', category: 'Gaming', maxItems: 20 },
  { url: 'https://kotaku.com/feed', category: 'Gaming' },
];

function makeId(url) {
  return 'rss-' + createHash('md5').update(url).digest('hex');
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeRssItem(item, feed, pluginName) {
  const url = item.link || '';
  const image = item.media?.thumbnail?.url || item.enclosure?.url || '';
  return {
    id: makeId(url || item.title),
    title: item.title || '',
    description: item.contentSnippet || item.content || '',
    content: item.content || item.contentSnippet || '',
    url,
    image,
    source: item.creator || item.author || '',
    sourceName: getSourceName(url) || (feed.pluginName === 'gaming' ? feed.url.includes('eurogamer') ? 'Eurogamer' : feed.url.includes('kotaku') ? 'Kotaku' : 'RSS' : 'BBC'),
    published: parseDate(item.isoDate || item.pubDate),
    category: feed.category,
    keywords: '',
    _plugin: pluginName,
    _pluginPriority: 0,
  };
}

export async function fetchRssFeeds() {
  const enabled = (process.env.RSS_FEEDS || '').trim();
  if (!enabled) return [];

  const enabledNames = enabled.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const feeds = [];

  if (enabledNames.includes('bbc')) {
    feeds.push(...BBC_FEEDS.map(f => ({ ...f, pluginName: 'bbc' })));
  }

  if (enabledNames.includes('gaming')) {
    feeds.push(...GAMING_FEEDS.map(f => ({ ...f, pluginName: 'gaming' })));
  }

  if (!feeds.length) return [];

  console.log(`RSS: Fetching ${feeds.length} feeds (enabled: ${enabledNames.join(', ')})`);

  const allItems = [];
  const seenIds = new Set();

  const results = await Promise.allSettled(feeds.map(async feed => {
    const parsed = await parser.parseURL(feed.url);
    const items = parsed.items || [];
    const limited = feed.maxItems ? items.slice(0, feed.maxItems) : items;
    console.log(`  RSS ${feed.url}: ${items.length} items${feed.maxItems ? ` (using ${limited.length})` : ''}`);
    return limited.map(item => normalizeRssItem(item, feed, feed.pluginName));
  }));

  for (const result of results) {
    if (result.status !== 'fulfilled') {
      console.error(`  RSS feed failed: ${result.reason?.message || result.reason}`);
      continue;
    }
    for (const item of result.value) {
      if (item.url && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        allItems.push(item);
      }
    }
  }

  console.log(`RSS: ${allItems.length} unique items from ${feeds.length} feeds`);
  return allItems;
}

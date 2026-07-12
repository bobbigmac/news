import Parser from 'rss-parser';
import { getSourceName } from './sources.js';

const parser = new Parser({ timeout: 10000 });

// Feed definitions. Each feed has a URL and a category mapping.
// Add more feeds here as needed.
const BBC_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'General' },
  { url: 'https://feeds.bbci.co.uk/news/uk/rss.xml', category: 'General' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'World' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'Business' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'Technology' },
  { url: 'https://feeds.bbci.co.uk/news/science/rss.xml', category: 'Science' },
  { url: 'https://feeds.bbci.co.uk/news/health/rss.xml', category: 'Health' },
  { url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', category: 'Politics' },
  { url: 'https://feeds.bbci.co.uk/news/education/rss.xml', category: 'Education' },
  // { url: 'https://feeds.bbci.co.uk/sport/rss.xml', category: 'Sports' }, // disabled — re-enable if needed
];

function makeId(url) {
  return 'rss-' + Buffer.from(url).toString('base64url').slice(0, 20);
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
    sourceName: getSourceName(url) || 'BBC',
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

  if (!feeds.length) return [];

  console.log(`RSS: Fetching ${feeds.length} feeds (enabled: ${enabledNames.join(', ')})`);

  const allItems = [];
  const seenIds = new Set();

  for (const feed of feeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      console.log(`  RSS ${feed.url}: ${parsed.items?.length || 0} items`);
      for (const item of (parsed.items || [])) {
        const normalized = normalizeRssItem(item, feed, feed.pluginName);
        if (normalized.url && !seenIds.has(normalized.id)) {
          seenIds.add(normalized.id);
          allItems.push(normalized);
        }
      }
    } catch (err) {
      console.error(`  RSS ${feed.url} failed: ${err.message}`);
    }
  }

  console.log(`RSS: ${allItems.length} unique items from ${feeds.length} feeds`);
  return allItems;
}

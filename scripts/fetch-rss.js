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

// urgent.news — cross-source aggregator, no API key needed, CORS-open.
// Already deduplicates across outlets and provides AI summaries.
// UK edition + topic desks give broad coverage without registration.
const URGENT_FEEDS = [
  { url: 'https://urgent.news/geo/gb/rss.xml', category: 'General', maxItems: 30 },
  { url: 'https://urgent.news/t/world/rss.xml', category: 'World', maxItems: 15 },
  { url: 'https://urgent.news/t/business/rss.xml', category: 'Business', maxItems: 10 },
  { url: 'https://urgent.news/t/science/rss.xml', category: 'Science', maxItems: 10 },
  { url: 'https://urgent.news/t/health/rss.xml', category: 'Health', maxItems: 10 },
];

// Techmeme — human-curated tech news aggregator (editors across 5 continents,
// led by Gabe Rivera since 2005). Sources from thousands of outlets and picks
// the stories that actually matter. The RSS feed's <link> is a Techmeme
// permalink, but the original publisher's URL is embedded in the HTML
// description. We extract it so we cite the original source, not Techmeme.
// The title format is "Headline (Author/Publication)" — we strip the
// parenthetical and use it as the byline.
const TECHMEME_FEEDS = [
  { url: 'https://www.techmeme.com/feed.xml', category: 'Technology', maxItems: 30 },
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
    sourceName: getSourceName(url) || (feed.pluginName === 'gaming' ? feed.url.includes('eurogamer') ? 'Eurogamer' : feed.url.includes('kotaku') ? 'Kotaku' : 'RSS' : feed.pluginName === 'urgent' ? 'Urgent News' : feed.pluginName === 'bbc' ? 'BBC' : feed.pluginName === 'tech' ? 'Techmeme' : 'RSS'),
    published: parseDate(item.isoDate || item.pubDate),
    category: feed.category,
    keywords: '',
    _plugin: pluginName,
    _pluginPriority: 0,
  };
}

// Techmeme-specific parser. The feed <link> is a Techmeme permalink; the
// original publisher's URL is the first non-Techmeme <A HREF> in the HTML
// description. The title has "(Author/Publication)" appended — we strip it
// and use the publication name as sourceName, author as source.
function normalizeTechmemeItem(item, feed) {
  const html = item.content || item.contentSnippet || '';
  // Extract the original article URL from the description HTML.
  // The description has: Techmeme permalink img link, then the real article link.
  // We want the first <A HREF="..."> that doesn't point to techmeme.com.
  const hrefMatches = [...html.matchAll(/<A\s+HREF="([^"]+)"/gi)];
  let originalUrl = item.link || '';
  for (const m of hrefMatches) {
    const href = m[1];
    if (!href.includes('techmeme.com')) {
      originalUrl = href;
      break;
    }
  }

  // Extract image from the description HTML (Techmeme includes an <IMG SRC>)
  const imgMatch = html.match(/<IMG[^>]+SRC="([^"]+)"/i);
  const image = imgMatch?.[1] || '';

  // Title format: "Headline (Author/Publication)" or "Headline (Publication)"
  // Strip the parenthetical and extract author + publication.
  const title = item.title || '';
  const parenMatch = title.match(/\s*\(([^)]+)\)\s*$/);
  let cleanTitle = title;
  let author = '';
  let publication = '';
  if (parenMatch) {
    cleanTitle = title.replace(/\s*\(([^)]+)\)\s*$/, '').trim();
    const inside = parenMatch[1];
    // Format is "Author/Publication" or just "Publication"
    if (inside.includes('/')) {
      const parts = inside.split('/');
      author = parts[0].trim();
      publication = parts.slice(1).join('/').trim();
    } else {
      publication = inside.trim();
    }
  }

  // Extract the text snippet from the HTML (after the links, the — separator)
  const snippetMatch = html.match(/&mdash;\s*([^<]+)/);
  const snippet = snippetMatch?.[1]?.trim() || '';

  return {
    id: makeId(originalUrl || title),
    title: cleanTitle,
    description: snippet || item.contentSnippet || '',
    content: html,
    url: originalUrl,
    image,
    source: author,
    sourceName: publication || getSourceName(originalUrl) || 'Techmeme',
    published: parseDate(item.isoDate || item.pubDate),
    category: feed.category,
    keywords: '',
    _plugin: 'tech',
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

  if (enabledNames.includes('urgent')) {
    feeds.push(...URGENT_FEEDS.map(f => ({ ...f, pluginName: 'urgent' })));
  }

  if (enabledNames.includes('tech')) {
    feeds.push(...TECHMEME_FEEDS.map(f => ({ ...f, pluginName: 'tech' })));
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
    // Techmeme needs custom parsing to extract the original publisher URL
    const normalize = feed.pluginName === 'tech'
      ? item => normalizeTechmemeItem(item, feed)
      : item => normalizeRssItem(item, feed, feed.pluginName);
    return limited.map(normalize);
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

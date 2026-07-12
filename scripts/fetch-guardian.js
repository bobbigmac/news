import { getSourceName } from './sources.js';

const GUARDIAN_API = 'https://content.guardianapis.com/search';

// Section IDs to fetch. Each maps to a category.
const GUARDIAN_SECTIONS = [
  { section: 'news', category: 'General' },
  { section: 'world', category: 'World' },
  { section: 'politics', category: 'Politics' },
  { section: 'business', category: 'Business' },
  { section: 'technology', category: 'Technology' },
  { section: 'science', category: 'Science' },
  { section: 'sport', category: 'Sports' },
  { section: 'health', category: 'Health' },
];

function makeId(id) {
  return 'guardian-' + id;
}

function normalizeGuardianItem(item, sectionInfo) {
  const fields = item.fields || {};
  const url = item.webUrl || '';
  const thumbnail = fields.thumbnail || '';
  return {
    id: makeId(item.id),
    title: fields.headline || item.webTitle || '',
    description: fields.trailText || fields.standfirst || '',
    content: fields.bodyText || fields.body || '',
    url,
    image: thumbnail,
    source: fields.byline || '',
    sourceName: 'The Guardian',
    published: item.webPublicationDate || new Date().toISOString(),
    category: sectionInfo.category,
    keywords: '',
    _plugin: 'guardian',
    _pluginPriority: 0,
  };
}

export async function fetchGuardianNews() {
  const apiKey = (process.env.GUARDIAN_API_KEY || '').trim();
  if (!apiKey) return [];

  console.log('Guardian: Fetching latest articles...');

  const allItems = [];
  const seenIds = new Set();

  for (const sectionInfo of GUARDIAN_SECTIONS) {
    const params = new URLSearchParams({
      'api-key': apiKey,
      'section': sectionInfo.section,
      'order-by': 'newest',
      'page-size': '20',
      'show-fields': 'headline,trailText,bodyText,byline,thumbnail,standfirst',
    });

    try {
      const res = await fetch(`${GUARDIAN_API}?${params}`);
      if (!res.ok) {
        console.error(`  Guardian ${sectionInfo.section}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const results = data.response?.results || [];
      console.log(`  Guardian ${sectionInfo.section}: ${results.length} items`);

      for (const item of results) {
        const normalized = normalizeGuardianItem(item, sectionInfo);
        if (!seenIds.has(normalized.id)) {
          seenIds.add(normalized.id);
          allItems.push(normalized);
        }
      }

      // Rate limit: 1 call/second on developer tier
      await new Promise(r => setTimeout(r, 1100));
    } catch (err) {
      console.error(`  Guardian ${sectionInfo.section} failed: ${err.message}`);
    }
  }

  console.log(`Guardian: ${allItems.length} unique items`);
  return allItems;
}

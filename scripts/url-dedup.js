// URL-based story deduplication across aggregators.
//
// Multiple sources (BBC RSS, urgent.news, Currents API, Eurogamer, Kotaku)
// can deliver the same story with different IDs but pointing to the same
// or equivalent URL. This module normalises URLs so we can dedup by URL
// in addition to the existing ID-based dedup.
//
// Normalisation steps:
//   1. Strip tracking params (utm_*, at_medium, at_campaign, ns_*, fbclid, etc.)
//   2. Normalise domain (www. prefix, mobile subdomains, bbc.com → bbc.co.uk)
//   3. Normalise path (trailing slash, lowercase)
//   4. Strip fragments (#...)
//   5. Sort remaining query params for stable comparison
//
// Source-specific patterns:
//   - BBC: bbc.com and bbc.co.uk are the same site; strip at_medium/at_campaign
//   - urgent.news: links to original source URLs, may have aggregator tracking
//   - This is Money: strip ns_mchannel, ns_campaign, ito params
//   - FT: strip syn-* params
//   - Guardian: clean URLs, rarely need stripping

// Params to strip (tracking, analytics, affiliate, source attribution)
const STRIP_PARAMS = new Set([
  // Generic tracking
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_referrer', 'utm_name', 'utm_brand', 'utm_social',
  'utm_social-type', 'utm_social-type', 'fbclid', 'gclid', 'msclkid',
  'mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'hsCtaTracking',
  // BBC
  'at_medium', 'at_campaign', 'at_custom',
  // This is Money / Mail Online
  'ns_mchannel', 'ns_campaign', 'ito',
  // FT
  'syn',
  // Generic
  'ref', 'source', 'src', 'reflink', 'share', 'shared', 'linkId',
  'cmpid', 'campaign', 'medium', 'affiliate', 'aff',
]);

// Params that start with these prefixes should be stripped
const STRIP_PARAM_PREFIXES = ['utm_', 'at_', 'ns_', 'syn-', 'syn', 'mc_', 'hsCta', '_hsmi', '_hsenc'];

// Domain normalisation: map equivalent domains to a canonical form
const DOMAIN_ALIASES = {
  'bbc.com': 'bbc.co.uk',
  'm.bbc.co.uk': 'bbc.co.uk',
  'm.bbc.com': 'bbc.co.uk',
  'www.bbc.co.uk': 'bbc.co.uk',
  'www.bbc.com': 'bbc.co.uk',
  'mobile.twitter.com': 'twitter.com',
  'www.twitter.com': 'twitter.com',
  'x.com': 'twitter.com',
  'www.x.com': 'twitter.com',
  'www.theguardian.com': 'theguardian.com',
  'www.thisismoney.co.uk': 'thisismoney.co.uk',
  'www.ft.com': 'ft.com',
  'www.cityam.com': 'cityam.com',
  'www.eurogamer.net': 'eurogamer.net',
  'www.kotaku.com': 'kotaku.com',
  'www.reuters.com': 'reuters.com',
  'www.independent.co.uk': 'independent.co.uk',
  'www.mirror.co.uk': 'mirror.co.uk',
  'www.dailymail.co.uk': 'dailymail.co.uk',
  'www.metro.co.uk': 'metro.co.uk',
  'www.telegraph.co.uk': 'telegraph.co.uk',
  'www.thetimes.co.uk': 'thetimes.co.uk',
  'www.express.co.uk': 'express.co.uk',
  'www.thesun.co.uk': 'thesun.co.uk',
};

// Normalise a URL into a canonical form for dedup comparison.
// Returns null if the URL is empty or invalid.
export function normaliseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Normalise domain
  let domain = url.hostname.toLowerCase();
  if (DOMAIN_ALIASES[domain]) {
    domain = DOMAIN_ALIASES[domain];
  } else {
    // Strip www. prefix for any domain not in the alias map
    domain = domain.replace(/^www\./, '');
  }

  // Normalise path: lowercase, strip trailing slash (unless root)
  let path = url.pathname.toLowerCase();
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  // Strip .html suffix (common in Mail Online, This is Money)
  if (path.endsWith('.html')) {
    path = path.slice(0, -5);
  }
  // Strip index.html / index.htm
  path = path.replace(/\/index\.html?$/, '');

  // Filter and sort query params
  const keptParams = [];
  for (const [key, value] of url.searchParams) {
    const lowerKey = key.toLowerCase();
    if (STRIP_PARAMS.has(lowerKey)) continue;
    if (STRIP_PARAM_PREFIXES.some(p => lowerKey.startsWith(p))) continue;
    keptParams.push(`${lowerKey}=${value}`);
  }
  keptParams.sort();

  // Build canonical URL (no fragment)
  const query = keptParams.length ? '?' + keptParams.join('&') : '';
  return `${domain}${path}${query}`;
}

// Deduplicate a list of news items by normalised URL.
// When two items have the same normalised URL, the first one wins (preserving
// priority order: Currents API > RSS > Guardian). The loser is dropped.
// Returns { items: dedupedItems, dropped: number, byUrl: Map<normalisedUrl, item> }
export function dedupByUrl(items) {
  const seen = new Map(); // normalisedUrl -> item
  const result = [];
  let dropped = 0;

  for (const item of items) {
    const normalised = normaliseUrl(item.url);
    if (!normalised) {
      // No URL or unparseable — keep it, dedup by ID elsewhere
      result.push(item);
      continue;
    }
    if (seen.has(normalised)) {
      dropped++;
      continue;
    }
    seen.set(normalised, item);
    result.push(item);
  }

  return { items: result, dropped, byUrl: seen };
}

// Combined dedup: first by ID (existing behaviour), then by URL.
// This is the main entry point for fetch-news.js.
export function dedupStories(allItems) {
  // First pass: dedup by ID (preserves existing behaviour)
  const byId = new Map();
  const noId = [];
  for (const item of allItems) {
    if (item.id) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    } else {
      noId.push(item);
    }
  }
  const idDeduped = [...byId.values(), ...noId];

  // Second pass: dedup by normalised URL
  const { items: urlDeduped, dropped } = dedupByUrl(idDeduped);

  return { items: urlDeduped, droppedById: allItems.length - idDeduped.length, droppedByUrl: dropped };
}

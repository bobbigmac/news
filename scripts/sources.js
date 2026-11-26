// Domain-to-source-name mapping for display alongside bylines.
// Add entries as new domains appear in the feed.

const DOMAIN_MAP = {
  'bbc.co.uk': 'BBC',
  'www.bbc.co.uk': 'BBC',
  'bbc.com': 'BBC',
  'www.bbc.com': 'BBC',
  'bbci.co.uk': 'BBC',
  'feeds.bbci.co.uk': 'BBC',
  'theguardian.com': 'The Guardian',
  'www.theguardian.com': 'The Guardian',
  'guardianapis.com': 'The Guardian',
  'belfastlive.co.uk': 'Belfast Live',
  'www.belfastlive.co.uk': 'Belfast Live',
  'bernama.com': 'Bernama',
  'www.bernama.com': 'Bernama',
  'brisbanetimes.com.au': 'Brisbane Times',
  'www.brisbanetimes.com.au': 'Brisbane Times',
  'businessinsider.com': 'Business Insider',
  'www.businessinsider.com': 'Business Insider',
  'dailymail.com': 'Daily Mail',
  'www.dailymail.com': 'Daily Mail',
  'dnaindia.com': 'DNA India',
  'www.dnaindia.com': 'DNA India',
  'economictimes.indiatimes.com': 'Economic Times',
  'edinburghnews.scotsman.com': 'Edinburgh News',
  'www.edinburghnews.scotsman.com': 'Edinburgh News',
  'guitarworld.com': 'Guitar World',
  'independent.co.uk': 'The Independent',
  'www.independent.co.uk': 'The Independent',
  'indiatoday.in': 'India Today',
  'www.indiatoday.in': 'India Today',
  'japantoday.com': 'Japan Today',
  'kark.com': 'KARK',
  'www.kark.com': 'KARK',
  'koreatimes.co.kr': 'Korea Times',
  'www.koreatimes.co.kr': 'Korea Times',
  'marieclaire.co.uk': "Marie Claire",
  'www.marieclaire.co.uk': "Marie Claire",
  'metro.co.uk': 'Metro',
  'mirror.co.uk': 'Mirror',
  'www.mirror.co.uk': 'Mirror',
  'nakedcapitalism.com': 'Naked Capitalism',
  'www.nakedcapitalism.com': 'Naked Capitalism',
  'nltimes.nl': 'NL Times',
  'scotsman.com': 'The Scotsman',
  'standard.co.uk': 'Evening Standard',
  'www.standard.co.uk': 'Evening Standard',
  'swarajyamag.com': 'Swarajya',
  'tass.com': 'TASS',
  'theage.com.au': 'The Age',
  'www.theage.com.au': 'The Age',
  'thewest.com.au': 'The West Australian',
  'tmz.com': 'TMZ',
  'www.tmz.com': 'TMZ',
  'twelfthmagpie.com': 'Twelfth Magpie',
  'walesonline.co.uk': 'Wales Online',
  'www.walesonline.co.uk': 'Wales Online',
  // High-volume RSS / aggregator publishers
  'news.sky.com': 'Sky News',
  'www.news.sky.com': 'Sky News',
  'sky.com': 'Sky News',
  'www.sky.com': 'Sky News',
  'nature.com': 'Nature',
  'www.nature.com': 'Nature',
  'phys.org': 'Phys.org',
  'www.phys.org': 'Phys.org',
  'eurogamer.net': 'Eurogamer',
  'www.eurogamer.net': 'Eurogamer',
  'kotaku.com': 'Kotaku',
  'www.kotaku.com': 'Kotaku',
  'ign.com': 'IGN',
  'www.ign.com': 'IGN',
  'gamespot.com': 'GameSpot',
  'www.gamespot.com': 'GameSpot',
  'windowscentral.com': 'Windows Central',
  'www.windowscentral.com': 'Windows Central',
  'medicalxpress.com': 'Medical Xpress',
  'cityam.com': 'City A.M.',
  'www.cityam.com': 'City A.M.',
  'punchng.com': 'Punch',
  'www.punchng.com': 'Punch',
  'thisismoney.co.uk': 'This is Money',
  'www.thisismoney.co.uk': 'This is Money',
  // Tech publishers (surfaced via Techmeme aggregation)
  'techcrunch.com': 'TechCrunch',
  'www.techcrunch.com': 'TechCrunch',
  'theverge.com': 'The Verge',
  'www.theverge.com': 'The Verge',
  'arstechnica.com': 'Ars Technica',
  'feeds.arstechnica.com': 'Ars Technica',
  'wired.com': 'Wired',
  'www.wired.com': 'Wired',
  'bloomberg.com': 'Bloomberg',
  'www.bloomberg.com': 'Bloomberg',
  'businessinsider.com': 'Business Insider',
  'reuters.com': 'Reuters',
  'www.reuters.com': 'Reuters',
  'nytimes.com': 'New York Times',
  'www.nytimes.com': 'New York Times',
  'theinformation.com': 'The Information',
  'www.theinformation.com': 'The Information',
  'cnbc.com': 'CNBC',
  'www.cnbc.com': 'CNBC',
  'axios.com': 'Axios',
  'www.axios.com': 'Axios',
  'variety.com': 'Variety',
  'www.variety.com': 'Variety',
  'fastcompany.com': 'Fast Company',
  'www.fastcompany.com': 'Fast Company',
  'engadget.com': 'Engadget',
  'www.engadget.com': 'Engadget',
  'cnet.com': 'CNET',
  'www.cnet.com': 'CNET',
  'technologyreview.com': 'MIT Tech Review',
  'www.technologyreview.com': 'MIT Tech Review',
  'theatlantic.com': 'The Atlantic',
  'www.theatlantic.com': 'The Atlantic',
  'politico.com': 'Politico',
  'www.politico.com': 'Politico',
  'wsj.com': 'Wall Street Journal',
  'www.wsj.com': 'Wall Street Journal',
  'ft.com': 'Financial Times',
  'www.ft.com': 'Financial Times',
  'apnews.com': 'AP News',
  'www.apnews.com': 'AP News',
  'washingtontimes.com': 'Washington Times',
  'www.washingtontimes.com': 'Washington Times',
  'washingtonpost.com': 'Washington Post',
  'www.washingtonpost.com': 'Washington Post',
  'semafor.com': 'Semafor',
  'www.semafor.com': 'Semafor',
  'statnews.com': 'STAT News',
  'www.statnews.com': 'STAT News',
  'techmeme.com': 'Techmeme',
  'www.techmeme.com': 'Techmeme',
};

// Multi-tenant publishing platforms: the platform itself is not a source —
// the individual publications/authors on it are. Subdomain tenants
// (yourlocalepidemiologist.substack.com) carry identity in the host;
// path tenants (dev.to/username, medium.com/@user) carry it in the first
// path segment.
export const PLATFORM_HOSTS = new Set([
  'substack.com', 'medium.com', 'wordpress.com', 'blogspot.com', 'tumblr.com',
  'patreon.com', 'typepad.com', 'ghost.io', 'beehiiv.com', 'buttondown.email',
  'livejournal.com', 'weebly.com', 'wixsite.com', 'hashnode.com', 'dev.to',
  'mirror.xyz', 'notion.site', 'write.as', 'telegra.ph', 'steemit.com',
  'peakd.com', 'hive.blog', 'neocities.org', 'bandcamp.com',
]);

const PATH_TENANT_HOSTS = new Set(['dev.to', 'medium.com']);

export function platformOfHost(host) {
  const parts = host.split('.');
  for (const platform of PLATFORM_HOSTS) {
    const pParts = platform.split('.');
    if (parts.length >= pParts.length && parts.slice(-pParts.length).join('.') === platform) {
      return platform;
    }
  }
  return null;
}

export function tenantFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const platform = platformOfHost(host);
    if (!platform) return null;
    if (host !== platform) {
      // subdomain tenant: leftmost label(s) before the platform host
      return host.slice(0, host.length - platform.length - 1);
    }
    if (PATH_TENANT_HOSTS.has(platform)) {
      const seg = u.pathname.split('/').filter(Boolean)[0];
      if (seg) return seg.replace(/^@/, '');
    }
    return null;
  } catch { return null; }
}

export function getSourceName(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return DOMAIN_MAP[hostname] || null;
  } catch {
    return null;
  }
}

export function sourceKeyFromUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    // Path-tenant platforms key by author/publication, not by platform —
    // dev.to/alice and dev.to/bob are different sources.
    if (PATH_TENANT_HOSTS.has(platformOfHost(host) || '') && host === platformOfHost(host)) {
      const seg = u.pathname.split('/').filter(Boolean)[0];
      if (seg) return `${host}/${seg.replace(/^@/, '').toLowerCase()}`;
    }
    return host;
  } catch {
    return '';
  }
}

export function prettifySourceKey(key) {
  // Path-tenant keys (dev.to/alice) display as the tenant.
  if (key.includes('/')) {
    const tenant = key.split('/')[1];
    if (tenant) return prettifyTenant(tenant);
  }
  const parts = key.split('.').filter(Boolean);
  if (!parts.length) return 'Unknown';
  const compoundTlds = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.kr', 'com.my', 'com.pk', 'co.za', 'com.ng', 'com.sa']);
  const lastTwo = parts.slice(-2).join('.');
  let baseIndex = compoundTlds.has(lastTwo) ? parts.length - 3 : parts.length - 2;
  let base = parts[Math.max(0, baseIndex)] || parts[0];
  // Platform tenants display as the tenant, never the platform:
  // yourlocalepidemiologist.substack.com is not "Substack".
  if (baseIndex > 0) {
    const hostNoTld = compoundTlds.has(lastTwo) ? parts.slice(0, -2).join('.') : parts.slice(0, -1).join('.');
    const platform = platformOfHost(parts.join('.'));
    if (platform && hostNoTld !== platform.replace(/\.[^.]+$/, '') && platform.split('.')[0] === base) {
      base = parts[0];
    }
  }
  return prettifyTenant(base);
}

function prettifyTenant(base) {
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

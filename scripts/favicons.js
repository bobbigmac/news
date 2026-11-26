import { getSourceName } from './sources.js';

const SOURCE_LABELS = {
  'bbc.co.uk': 'BBC',
  'bbc.com': 'BBC',
  'news.sky.com': 'Sky News',
  'sky.com': 'Sky News',
  'theguardian.com': 'The Guardian',
  'dailymail.com': 'Daily Mail',
  'independent.co.uk': 'The Independent',
  'mirror.co.uk': 'Mirror',
  'metro.co.uk': 'Metro',
  'standard.co.uk': 'Evening Standard',
  'eurogamer.net': 'Eurogamer',
  'kotaku.com': 'Kotaku',
  'ign.com': 'IGN',
  'ft.com': 'Financial Times',
  'phys.org': 'Phys.org',
  'medicalxpress.com': 'Medical Xpress',
  'cityam.com': 'City A.M.',
  'punchng.com': 'Punch',
  'koreatimes.co.kr': 'Korea Times',
  'thisismoney.co.uk': 'This is Money',
  'jpost.com': 'Jerusalem Post',
  'brecorder.com': 'Business Recorder',
  'notebookcheck.net': 'Notebookcheck',
  'handelsblatt.com': 'Handelsblatt',
  'thestar.com.my': 'The Star',
  'nst.com.my': 'New Straits Times',
  'tweaktown.com': 'TweakTown',
  'windowscentral.com': 'Windows Central',
  'gamespot.com': 'GameSpot',
  'newscientist.com': 'New Scientist',
  'abc.net.au': 'ABC News',
  'nypost.com': 'New York Post',
  'businessinsider.com': 'Business Insider',
  'thehindu.com': 'The Hindu',
  'marketbeat.com': 'MarketBeat',
  'vice.com': 'Vice',
  'businessday.ng': 'Business Day',
  'dailymaverick.co.za': 'Daily Maverick',
  'psypost.org': 'PsyPost',
  'wccftech.com': 'Wccftech',
  'semafor.com': 'Semafor',
  'qz.com': 'Quartz',
  'reddit.com': 'Reddit',
  'techradar.com': 'TechRadar',
  'cbsnews.com': 'CBS News',
  'newsweek.com': 'Newsweek',
  'smh.com.au': 'Sydney Morning Herald',
  'scmp.com': 'South China Morning Post',
  'thenationalnews.com': 'The National',
  'myjoyonline.com': 'MyJoyOnline',
  'nasdaq.com': 'Nasdaq',
  'theage.com.au': 'The Age',
  'statnews.com': 'STAT News',
  'dw.com': 'DW',
  'chalkbeat.org': 'Chalkbeat',
  'pbs.org': 'PBS',
  'news.xbox.com': 'Xbox Wire',
  'aljazeera.com': 'Al Jazeera',
  'middleeasteye.net': 'Middle East Eye',
  'engadget.com': 'Engadget',
  'inquirer.com': 'Inquirer',
  'lemonde.fr': 'Le Monde',
  'nature.com': 'Nature',
  'dev.to': 'DEV',
  'theregister.com': 'The Register',
  'upi.com': 'UPI',
  'winnipegfreepress.com': 'Winnipeg Free Press',
};

export function sourceKeyFromUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function prettifySourceKey(key) {
  if (SOURCE_LABELS[key]) return SOURCE_LABELS[key];
  const parts = key.split('.').filter(Boolean);
  if (!parts.length) return 'Unknown';
  const compoundTlds = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.kr', 'com.my', 'com.pk', 'co.za', 'com.ng', 'com.sa']);
  const lastTwo = parts.slice(-2).join('.');
  const baseIndex = compoundTlds.has(lastTwo) ? parts.length - 3 : parts.length - 2;
  const base = parts[Math.max(0, baseIndex)] || parts[0];
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function collectSources(digest) {
  const byKey = new Map();
  for (const cluster of digest.clusters || []) {
    for (const story of cluster.stories || []) {
      const key = sourceKeyFromUrl(story.url);
      if (!key) continue;
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          label: SOURCE_LABELS[key] || getSourceName(story.url) || prettifySourceKey(key),
          count: 0,
          newest: null,
          oldest: null,
        });
      }
      const entry = byKey.get(key);
      entry.count++;
      const ts = Date.parse(story.published || '');
      if (ts) {
        const iso = new Date(ts).toISOString();
        if (!entry.newest || iso > entry.newest) entry.newest = iso;
        if (!entry.oldest || iso < entry.oldest) entry.oldest = iso;
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

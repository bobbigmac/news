import { getSourceName, platformOfHost, prettifySourceKey, sourceKeyFromUrl } from './sources.js';

export const SOURCE_LABELS = {
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
  'phys.org': 'Phys.org',
  'medicalxpress.com': 'Medical Xpress',
  'techxplore.com': 'Tech Xplore',
  'sciencedaily.com': 'ScienceDaily',
  'futurity.org': 'Futurity',
  'sciencealert.com': 'ScienceAlert',
  'psypost.org': 'PsyPost',
  'sci.news': 'Sci.News',
  'zmescience.com': 'ZME Science',
  'livescience.com': 'Live Science',
  'scientificamerican.com': 'Scientific American',
  'sciencenews.org': 'Science News',
  'sciencebasedmedicine.org': 'Science-Based Medicine',
  'abc.net.au': 'ABC News',
  'nypost.com': 'New York Post',
  'pagesix.com': 'Page Six',
  'foxnews.com': 'Fox News',
  'foxbusiness.com': 'Fox Business',
  'foxsports.com': 'Fox Sports',
  'foxnation.com': 'Fox Nation',
  'fox2now.com': 'FOX 2 St. Louis',
  'fox40.com': 'FOX 40 Sacramento',
  'fox59.com': 'FOX 59 Indianapolis',
  'fox5sandiego.com': 'FOX 5 San Diego',
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
  'rt-english.com': 'RT',
  'tass.com': 'TASS',
  'news.cgtn.com': 'CGTN',
  'cgtn.com': 'CGTN',
  'globaltimes.cn': 'Global Times',
  'eng.belta.by': 'BelTA',
  'prensa-latina.cu': 'Prensa Latina',
  'trtworld.com': 'TRT World',
  'aa.com.tr': 'Anadolu Agency',
  'uatv.ua': 'FREEDOM',
  'middleeasteye.net': 'Middle East Eye',
  'engadget.com': 'Engadget',
  'inquirer.com': 'Inquirer',
  'lemonde.fr': 'Le Monde',
  'nature.com': 'Nature',
  'dev.to': 'DEV Community',
  'yourlocalepidemiologist.substack.com': 'Your Local Epidemiologist',
  'laurenleek.substack.com': 'Lauren Leek',
  'en.thebell.io': 'The Bell',
  'theregister.com': 'The Register',
  'upi.com': 'UPI',
  'winnipegfreepress.com': 'Winnipeg Free Press',
};

export function collectSources(digest) {
  const byKey = new Map();
  for (const cluster of digest.clusters || []) {
    for (const story of cluster.stories || []) {
      const key = sourceKeyFromUrl(story.url);
      if (!key) continue;
      if (!byKey.has(key)) {
        const isTenant = key.includes('/') || platformOfHost(key) !== null;
        const authorLabel = isTenant && typeof story.source === 'string' && story.source.trim()
          ? story.source.trim()
          : null;
        byKey.set(key, {
          key,
          label: SOURCE_LABELS[key] || authorLabel || getSourceName(story.url) || prettifySourceKey(key),
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

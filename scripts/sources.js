// Domain-to-source-name mapping for display alongside bylines.
// Add entries as new domains appear in the feed.

const DOMAIN_MAP = {
  'bbc.co.uk': 'BBC',
  'www.bbc.co.uk': 'BBC',
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
};

export function getSourceName(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return DOMAIN_MAP[hostname] || null;
  } catch {
    return null;
  }
}

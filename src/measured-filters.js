// Reader-interest filter groups: sector/type comparisons a reader would actually
// want, not ownership-tree or dataset structure. Membership rules were validated
// against the measured export so most sources fall into at least one group; a few
// cross-cutting groups (billionaire-owned, state-influenced, lots of articles)
// deliberately overlap with the sector groups.
export const FILTER_GROUPS = [
  { key: 'uk-nationals', label: 'UK national papers', families: ['The Guardian', 'Daily Mail', 'Independent', 'Evening Standard', 'Reach Nationals'], keys: ['metro.co.uk'] },
  { key: 'us-nationals', label: 'US national news', families: ['New York Times', 'News Corp Print'], keys: ['usatoday.com'] },
  { key: 'local-metro', label: 'Local & metro news', families: ['Reach Local', 'The Scotsman', 'Independent City Papers', 'Tribune', 'Gannett', 'Gray Media', 'Advance Local', 'Independent Canadian Newspapers', 'Postmedia', 'Nine', 'Australia National'], keys: [] },
  { key: 'broadcasters', label: 'Broadcasters', families: ['BBC', 'Sky UK', 'Australia & NZ Public', 'European Public', 'North America Public', 'Paramount / CBS', 'Qatari State-Funded Network', 'Corus Entertainment'], keys: [] },
  { key: 'world-news', label: 'World & international news', families: ['India Media', 'Pakistan Media', 'Ghana Media', 'Kenya Media', 'Nigeria Companion Papers', 'The Punch', 'The Star Malaysia', 'Malay Mail', 'Malaysia Alternative', 'New Straits Times', 'Singapore Media', 'Philippine Daily Inquirer', 'Qatar Media', 'Saudi Media', 'UAE Media', 'Middle East Companion', 'Japan Media', 'Hong Kong & Taiwan', 'Korea Times', 'Indonesia Media', 'Latin America Media', 'Europe English', 'Jerusalem Post', 'South Africa Media', 'Bernama'], keys: [] },
  { key: 'games', label: 'Games media', families: ['Keleops', 'Fandom'], keys: ['eurogamer.net', 'ign.com', 'rockpapershotgun.com'] },
  { key: 'sports', label: 'Sports media', families: ['Sports Press', 'Yahoo'], keys: [] },
  { key: 'tech', label: 'Tech press', families: ['Condé Nast', 'Vox Media', 'Tech Analysis', 'Consumer Gadgets', 'Static Media', 'Mobile & Software', 'Future Tech', 'Enthusiast Hardware', 'Hardware Guides', 'Notebookcheck'], keys: ['mashable.com', 'group-mashable', 'cnet.com'] },
  { key: 'science-health', label: 'Science & health', families: ['Phys.org', 'Medical Xpress', 'Institutional Research Releases', 'Popular Science News', 'Science Magazines', 'Science Journals & Repositories', 'Space & Physics', 'Health & Medical'], keys: [] },
  { key: 'business', label: 'Business & markets', families: ['Financial Times', 'Business Newsweeklies', 'City A.M.', 'Axel Springer', 'Business Magazines', 'European Business Analysis', 'Business & Startup Digital', 'Regional Business', 'Nigeria Business', 'Markets Data', 'Retail Investor'], keys: ['economictimes.indiatimes.com', 'qz.com', 'thisismoney.co.uk', 'arabianbusiness.com', 'brecorder.com', 'elfinanciero.com.mx', 'businesskorea.co.kr'] },
  { key: 'digital-native', label: 'Digital-native news', families: ['Digital-native News'], keys: ['politico.eu', 'variety.com', 'chalkbeat.org'] },
  { key: 'billionaire', label: 'Billionaire-owned', families: ['Daily Mail', 'DMGT Companion', 'News Corp Print'], keys: [] },
  { key: 'state-influenced', label: 'State-influenced media', families: ['Belarusian State-Controlled Media', 'Qatari State-Funded Network', 'Bernama'], keys: [] },
  { key: 'corporate-official', label: 'Corporate & official channels', families: ['Microsoft', 'Press Releases'], keys: [] },
  { key: 'aggregators', label: 'Aggregators & platforms', families: ['Social Aggregators', 'DEV Community'], keys: [] },
  { key: 'high-volume', label: 'Lots of articles', minHeadlines: 150 },
];

export function sourceMatchesGroup(source, group) {
  if (group.minHeadlines) return source.headlines >= group.minHeadlines;
  if ((group.families || []).includes(source.family)) return true;
  const keys = group.keys || [];
  if (keys.includes(source.key) || keys.includes(source.iconKey)) return true;
  return (source.members || []).some(member => keys.includes(member.key));
}

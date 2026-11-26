// Research notes shown on the relationships page.
//
// Profiles are intentionally heterogeneous: a source may be a public body, a
// family newspaper, a billionaire-backed title, a wire, a press-release pipe,
// a community platform, or a specialist outlet. Fields are optional because the
// useful properties differ by source. Links point to the evidence used to make
// the note rather than pretending one generic record can capture every outlet.

export const BRANCH_PROFILES = {
  'public-international': {
    summary: 'Public-service, state-funded, charter-bound, and international broadcasters. Public funding or statutory missions do not make these outlets identical: governance, remit, funding pressure, and political context vary widely.',
    watch: ['Separate charter obligations from editorial outcome', 'State-funded is not the same property as state-controlled', 'Regional/public outlets often duplicate the same agency copy'],
  },
  'specialist-press': {
    summary: 'Beat-led publications grouped by the job they do for the reader. Ownership is still shown in the full membership graph where the same outlet also belongs to a publisher family.',
    watch: ['Specialist expertise can coexist with affiliate-commerce incentives', 'Beat outlets often share embargoed material and PR access'],
  },
  'murdoch': {
    summary: 'News Corp/Fox branches share corporate infrastructure and recurring talent pipelines, but their titles have different formats, regulators, and audience contracts. The Sun is not treated as interchangeable with The Times or the Wall Street Journal.',
    watch: ['News Corp and Fox Corporation are related by Murdoch-family control but are separate listed companies', 'News, comment, TV opinion, and tabloid formats carry different editorial cultures'],
    links: [
      { label: 'News UK brands', url: 'https://www.news.co.uk/about-news-uk/' },
      { label: 'Ofcom on Murdoch influence', url: 'https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1035791/Annex_B_-_Ofcom_Advice_on_application_by_News_Corp_UK_and_Ireland_Limited__Redacted_v2.pdf' },
    ],
  },
  'uk-media': {
    summary: 'UK national, regional, and magazine publishers. This branch mixes family-controlled trusts, public companies, free sheets, tabloids, and local networks; the profile notes below identify where those properties diverge.',
    watch: ['A shared owner does not erase a title’s own editorial position', 'Local brands can share workflows, freelancers, and templated distribution while still serving distinct places'],
  },
  'us-media': {
    summary: 'US national papers, broadcast networks, and local chains. Local groups are especially important because many station sites republish similar wire copy under different local brands.',
    watch: ['Local station branding is not proof of a locally reported story', 'Owner-backed national papers have different newsroom governance even when grouped for convenience'],
  },
  'digital-publishers': {
    summary: 'Digital-native and magazine publishers, including specialist portfolios and owner families. These relations are useful because brands share business models, content-management patterns, freelancers, and commerce incentives.',
    watch: ['Portfolio membership is a business relation, not a claim that every desk agrees politically', 'Affiliate review economics can shape article mix without appearing in a headline'],
  },
  'regional-english': {
    summary: 'English-language national and regional media ecosystems outside the UK/US. These are grouped because they provide local context the global outlets often flatten, not because they share an editorial line.',
    watch: ['State pressure, family ownership, and media-market concentration differ substantially by country', 'A regional grouping is geographic convenience, not a political claim'],
  },
  'wires-releases': {
    summary: 'Reporting wires and paid press-release distribution are deliberately separated from bylined editorial publishers. They can be useful primary material, but they should not be mistaken for a national newsroom’s own editorial selection.',
    watch: ['A wire is source material', 'A release is an interested party’s statement', 'Both can be valuable, but not under the same assumption of independent selection'],
  },
  'platforms-aggregators': {
    summary: 'Community, developer, social, and aggregation surfaces. These are useful for signals and expert discussion, but authorship, verification, and moderation differ post-by-post.',
    watch: ['Platform items are not equivalent to edited newsroom copy', 'Self-posted material may be excellent, promotional, or simply wrong'],
  },
  'official-organizations': {
    summary: 'First-party institutional sources. These are treated as primary claims from the institution rather than independent reporting about it.',
    watch: ['Useful for announcements, records, and primary detail', 'Not independent confirmation of the institution’s own claims'],
  },
  'other-sources': {
    summary: 'Hosts not yet assigned a curated relation, or low-volume hosts whose branches would produce an unusable source bar. Membership in Other is a UI allocation result, not a judgement that the source is unimportant.',
    watch: ['The page still lists every Other host individually', 'Sources can graduate out of Other as their volume or a curated relation grows'],
  },
};

export const SOURCE_PROFILES = {
  'bbc.co.uk': {
    kind: 'Public-service broadcaster',
    properties: ['Royal Charter remit', 'licence-fee funded', 'statutory impartiality', 'national and international scale'],
    leaning: 'Institutionally required to be impartial; criticised from both left and right over framing, access, and political coverage.',
    watch: ['Its scale makes it useful but can crowd out independent reporting', 'Charter impartiality is an obligation, not proof that every editorial choice is neutral'],
    links: [
      { label: 'BBC Charter', url: 'https://www.gov.uk/government/publications/bbc-charter-and-framework-agreement/bbc-charter' },
      { label: 'BBC mission', url: 'https://www.bbc.com/aboutthebbc/governance/mission/' },
      { label: '2024 impartiality review', url: 'https://www.gov.uk/government/publications/bbc-mid-term-review-2024/bbc-mid-term-review-2024' },
    ],
  },
  'theguardian.com': {
    kind: 'Trust-owned national newspaper',
    properties: ['Scott Trust sole shareholder', 'reader-funded', 'investigations and opinion'],
    leaning: 'Broadly liberal/left-of-centre opinion culture; ownership is designed to protect editorial independence rather than enforce a party line.',
    watch: ['Guardian News and Guardian Opinion are different editorial jobs', 'Its distinctive ownership makes it unlike proprietor- or shareholder-driven papers'],
    links: [
      { label: 'Scott Trust history', url: 'https://www.theguardian.com/about/history' },
      { label: 'Guardian ownership', url: 'https://www.theguardian.com/about/organisation' },
    ],
  },
  'dailymail.com': {
    kind: 'Tabloid national newspaper',
    properties: ['DMGT/Rothermere family control', 'high-volume UK tabloid', 'campaigning consumer and political coverage'],
    leaning: 'Commonly described as right-leaning and socially conservative; the Mail on Sunday has historically taken some different positions.',
    caution: ['IPSO accuracy rulings are useful context but do not invalidate every story', 'Its criticism of institutions can be campaigning rather than detached analysis'],
    links: [
      { label: 'DMGT consumer brands', url: 'https://www.dmgt.com/businesses/consumer/' },
      { label: 'DMGT history', url: 'https://www.dmgt.com/about-us/our-history/' },
      { label: 'Associated Newspapers IPSO statement', url: 'https://www.ipso.co.uk/wp-content/uploads/2026/06/Associated-Newspapers-2025-Annual-Statement-For-publication.pdf' },
    ],
  },
  'metro.co.uk': {
    kind: 'Free urban newspaper',
    properties: ['DMGT consumer media', 'free commuter format', 'short-form national and entertainment news'],
    leaning: 'Less consistently ideological than the Daily Mail, while sharing the same corporate family and distribution model.',
  },
  'inews.co.uk': {
    kind: 'Compact national newspaper',
    properties: ['acquired by DMGT in 2019', 'concise news format', 'distinct editorial voice inside the group'],
    watch: ['Ofcom treated the i as likely to remain a distinct voice after the DMGT acquisition'],
    links: [{ label: 'Ofcom plurality advice', url: 'https://assets.publishing.service.gov.uk/media/60229716d3bf7f70b531ec9a/20200324_Ofcom_advice_FINAL_to_SoS_Redacted_v2.pdf' }],
  },
  'newscientist.com': {
    kind: 'Science magazine',
    properties: ['DMGT consumer media', 'weekly science publication', 'explainer and analysis format'],
    watch: ['Magazine science framing differs from daily news and from peer-reviewed source material'],
  },
  'thesun.co.uk': {
    kind: 'Tabloid national newspaper',
    properties: ['News UK', 'large tabloid audience', 'campaigning political coverage'],
    leaning: 'Conservative/Brexiteer tabloid identity is a meaningful grouping property, but still not a guarantee about every journalist or desk.',
    history: 'The 1989 Hillsborough “The Truth” front page remains a central source-trust issue: official inquiries documented false police-supplied allegations about Liverpool fans, while The Sun’s presentation treated them as truth and caused a lasting Merseyside boycott.',
    watch: ['Police-source claims deserve provenance checks because the Hillsborough record shows how leaks can become false consensus', 'Tabloid prominence amplifies framing even when the underlying claim is weak'],
    links: [
      { label: 'IOPC initial media coverage', url: 'https://www.policeconduct.gov.uk/hillsborough-report/chapter-7/initial-media-coverage' },
      { label: 'Panel documents for the Sun story', url: 'https://www.theguardian.com/media/2012/sep/12/documents-hillsborough-panel-sun-story' },
      { label: 'News UK brands', url: 'https://www.news.co.uk/about-news-uk/' },
    ],
  },
  'thetimes.co.uk': {
    kind: 'National broadsheet',
    properties: ['News UK', 'paper-of-record tradition', 'paywalled national news'],
    history: 'Murdoch purchased Times Newspapers in 1981; government undertakings historically existed to preserve editorial independence.',
    watch: ['Shared News Corp ownership does not make Times coverage interchangeable with The Sun'],
    links: [
      { label: 'Times history', url: 'https://www.thetimes.com/static/about-us/' },
      { label: 'Ofcom undertakings advice', url: 'https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1035791/Annex_B_-_Ofcom_Advice_on_application_by_News_Corp_UK_and_Ireland_Limited__Redacted_v2.pdf' },
    ],
  },
  'foxnews.com': {
    kind: 'US cable news network',
    properties: ['Fox Corporation', 'news and opinion programming', 'high-volume political coverage'],
    leaning: 'Opinion programming is strongly associated with the US right; straight news and prime-time opinion are different products.',
    watch: ['Fox Corporation is separate from News Corp despite shared Murdoch-family control', 'Local Fox affiliate sites can carry very different reporting from national Fox News opinion'],
  },
  'nypost.com': {
    kind: 'US tabloid',
    properties: ['News Corp', 'New York tabloid', 'sports, politics, celebrity and crime'],
    leaning: 'Conservative tabloid sensibility; Page Six celebrity content and hard-news coverage have different evidentiary profiles.',
  },
  'wsj.com': {
    kind: 'US business newspaper',
    properties: ['Dow Jones/News Corp', 'business and finance', 'paywalled reporting'],
    watch: ['The Journal’s news pages and opinion pages are frequently treated as institutionally distinct'],
  },
  'mirror.co.uk': {
    kind: 'Tabloid national newspaper',
    properties: ['Reach plc', 'Labour-associated tabloid tradition', 'UK national and celebrity news'],
    leaning: 'Historically the clearest Labour-aligned UK national tabloid, though modern Reach content mixes politics, service, celebrity, and syndicated local copy.',
    links: [{ label: 'Reach brands', url: 'https://www.reachplc.com/about-us' }],
  },
  'express.co.uk': {
    kind: 'Tabloid national newspaper',
    properties: ['Reach plc', 'campaigning right-leaning identity', 'royal, health, weather and political coverage'],
    leaning: 'Commonly grouped with right-of-centre tabloids; format and topic mix make it useful to separate from broadsheet analysis.',
  },
  'dailystar.co.uk': {
    kind: 'Tabloid national newspaper',
    properties: ['Reach plc', 'celebrity, odd news and entertainment', 'lighter tabloid format'],
    watch: ['It shares Reach infrastructure with the Mirror and Express but does not carry the same political contract'],
  },
  'dailyrecord.co.uk': {
    kind: 'Scottish tabloid',
    properties: ['Reach plc', 'Scottish edition identity', 'regional/national hybrid'],
    watch: ['Scottish politics and football coverage give it a different civic context from London tabloids'],
  },
  'independent.co.uk': {
    kind: 'Digital national newspaper',
    properties: ['online-only since 2016', 'national UK politics and world coverage', 'reader/contributor revenue mix'],
    leaning: 'Generally centrist/liberal editorial identity, but corporate ownership and syndication make it distinct from the Scott Trust model.',
  },
  'standard.co.uk': {
    kind: 'London newspaper',
    properties: ['free London paper', 'city politics and culture', 'Lebedev-associated ownership history'],
    leaning: 'London-focused establishment/free-sheet identity; political line has changed over time and should be tracked at article level.',
  },
  'ft.com': {
    kind: 'International financial newspaper',
    properties: ['Nikkei-owned', 'business and policy', 'paywalled specialist journalism'],
    leaning: 'Market- and institution-oriented rather than a conventional party tabloid; elite business access is both strength and blind spot.',
    links: [
      { label: 'Nikkei–FT partnership', url: 'https://aboutus.ft.com/press_release/nikkei-and-ft-day-one' },
      { label: 'FT group structure', url: 'https://help.ft.com/legal-privacy/policies-statements/' },
    ],
  },
  'cityam.com': {
    kind: 'Free London business newspaper',
    properties: ['THG-owned since 2023', 'City/business audience', 'free commuter distribution'],
    leaning: 'Pro-business and founder-described pro-libertarian ownership context; it should not be flattened into a generic right-wing tabloid.',
    links: [
      { label: 'BBC on THG purchase', url: 'https://www.bbc.co.uk/news/business-66311244' },
      { label: 'BDO sale notice', url: 'https://www.bdo.co.uk/en-gb/news/2023/administrators-at-bdo-complete-sale-of-city-am' },
    ],
  },
  'businessinsider.com': {
    kind: 'Business and general-news site',
    properties: ['Axel Springer', 'digital-first', 'business, tech and lifestyle mix'],
    watch: ['Traffic-driven headline framing can make solid reporting look more speculative than it is'],
  },
  'handelsblatt.com': {
    kind: 'German business newspaper',
    properties: ['German business and policy', 'English-language selected coverage', 'European institutional perspective'],
  },
  'finextra.com': {
    kind: 'Fintech trade publication',
    properties: ['payments and banking technology', 'trade-news format', 'industry source material'],
    watch: ['Useful sector detail; company-supplied material should be read as industry signal, not independent consumer reporting'],
  },
  'brecorder.com': {
    kind: 'Pakistani business newspaper',
    properties: ['Business Recorder', 'Pakistan markets and policy', 'national business record'],
  },
  'punchng.com': {
    kind: 'Nigerian national newspaper',
    properties: ['family-controlled private publisher', 'founded 1970/1973', 'history of military-era shutdowns'],
    leaning: 'Independent watchdog identity with a history of pressure from military regimes; “leftist” labels are useful only in Nigerian political context.',
    links: [
      { label: 'Punch history', url: 'https://punchng.com/about-us/' },
      { label: 'Nigeria media landscape', url: 'https://www.medialandscapes.org/country/nigeria/media/print.html' },
    ],
  },
  'premiumtimesng.com': {
    kind: 'Nigerian investigative newspaper',
    properties: ['digital-first investigations', 'anti-corruption and public-interest reporting', 'Nigerian national coverage'],
  },
  'dailypost.ng': {
    kind: 'Nigerian news site',
    properties: ['high-volume national coverage', 'politics, entertainment and local news'],
  },
  'businessday.ng': {
    kind: 'Nigerian business newspaper',
    properties: ['markets, policy and corporate coverage', 'Lagos business ecosystem'],
  },
  'nairametrics.com': {
    kind: 'Nigerian financial data site',
    properties: ['market data and explainers', 'consumer finance and business', 'data-led format'],
  },
  'phys.org': {
    kind: 'Science news portal',
    properties: ['Science X network', 'research-press-release plus staff coverage', 'high-volume daily science'],
    watch: ['Science X says it curates and edits university/research material rather than running blind PR aggregation; readers should still check whether an item is staff reporting, licensed copy, or institutional material'],
    links: [
      { label: 'Science X journalism', url: 'https://sciencex.com/help/journalism/' },
      { label: 'Phys.org about', url: 'https://sciencex.com/help/about-physorg/' },
      { label: 'Editorial process', url: 'https://sciencex.com/help/editorial-process/' },
    ],
  },
  'medicalxpress.com': {
    kind: 'Medical research news portal',
    properties: ['Science X network', 'health and medical research', 'institutional/research material'],
    watch: ['Medical claims need stronger provenance checks than general science explainers'],
  },
  'techxplore.com': {
    kind: 'Technology research news portal',
    properties: ['Science X network', 'research-to-product translation', 'low-volume in the current feed'],
  },
  'sciencealert.com': {
    kind: 'Popular science site',
    properties: ['science explainers', 'web-native science coverage', 'Australian editorial base'],
  },
  'nature.com': {
    kind: 'Scientific journal and news portal',
    properties: ['peer-reviewed journal', 'Nature news desk', 'Springer Nature'],
    watch: ['Journal papers, Nature news, and press material are different evidence classes even under one domain'],
  },
  'eurogamer.net': {
    kind: 'Games publication',
    properties: ['IGN Entertainment after the 2024 Gamer Network acquisition', 'reviews, guides and games culture', 'Digital Foundry relationship'],
    history: 'Eurogamer grew out of Gamer Network and was sold by ReedPop to Ziff Davis’s IGN Entertainment in 2024.',
    links: [
      { label: 'Gamer Network history', url: 'https://gamer.network/about-us' },
      { label: 'IGN acquisition report', url: 'https://www.videogameschronicle.com/news/ign-agrees-deal-for-gamer-network-sites-including-eurogamer-and-gi-biz/' },
    ],
  },
  'kotaku.com': {
    kind: 'Games publication',
    properties: ['Keleops-owned since 2025', 'Gawker/G/O Media heritage', 'games culture and criticism'],
    history: 'Kotaku moved from the former Gawker/G/O ecosystem to Swiss publisher Keleops, the same group that had acquired Gizmodo.',
    links: [
      { label: 'Keleops acquisition', url: 'https://www.keleops.com/en/keleops-expands-us-footprint-acquisition-kotaku.php' },
      { label: 'Axios sale report', url: 'https://www.axios.com/2025/07/02/kotaku-sale-keleops-go-media' },
    ],
  },
  'ign.com': {
    kind: 'Games and entertainment publication',
    properties: ['IGN Entertainment/Ziff Davis', 'guides, reviews and entertainment SEO', 'owner of former Gamer Network titles'],
    watch: ['Its corporate portfolio increasingly overlaps Eurogamer, RPS, VG247 and related gaming brands; shared infrastructure does not mean identical reviews'],
  },
  'gamespot.com': {
    kind: 'Games publication',
    properties: ['Red Ventures', 'games news, reviews and commerce', 'CNET network context'],
  },
  'pcgamer.com': {
    kind: 'PC games magazine',
    properties: ['Future plc', 'PC hardware and games coverage', 'US/UK editorial teams'],
  },
  'nintendolife.com': {
    kind: 'Nintendo specialist site',
    properties: ['Hookshot/Gamer Network relationship', 'Nintendo platform focus', 'guides and reviews'],
  },
  'rockpapershotgun.com': {
    kind: 'PC games publication',
    properties: ['former Gamer Network title', 'IGN Entertainment portfolio', 'PC criticism and features'],
  },
  'vg247.com': {
    kind: 'Games news site',
    properties: ['former Gamer Network title', 'IGN Entertainment portfolio', 'daily games coverage'],
  },
  'dev.to': {
    kind: 'Developer community platform',
    properties: ['member-authored posts', 'technical tutorials and career discussion', 'moderated community rather than a single newsroom'],
    watch: ['A good post can be primary practitioner evidence; it is not equivalent to an edited news report'],
  },
  'github.com': {
    kind: 'Developer platform',
    properties: ['Microsoft-owned', 'release notes, issues and first-party engineering material', 'primary source for software claims'],
  },
  'medium.com': {
    kind: 'Publishing platform',
    properties: ['individual and publication-authored posts', 'mixed editing and verification', 'not a newsroom by itself'],
  },
  'reddit.com': {
    kind: 'Social discussion platform',
    properties: ['user posts and comments', 'community moderation', 'useful for eyewitness/community signal'],
    watch: ['Claims need tracing to primary sources; votes measure attention, not truth'],
  },
  'ycombinator.com': {
    kind: 'Hacker News aggregator',
    properties: ['community-submitted links', 'tech/startup audience signal', 'comments rather than original reporting'],
  },
  'aljazeera.com': {
    kind: 'International broadcaster',
    properties: ['Qatar-based network', 'global south and Middle East strength', 'public-benefit foundation structure'],
    governance: 'Al Jazeera says it is a Private Foundation for Public Benefit under Qatari law and not directed by the Qatari government; outside reporting and academic work still treat Qatari funding as an important structural property.',
    links: [
      { label: 'Al Jazeera FAQ', url: 'https://network.aljazeera.net/en/more/faq' },
      { label: 'AP explainer', url: 'https://apnews.com/general-news-television-2bfa8ed83bf34d708abe1a567f4f4e9d' },
    ],
  },
  'dw.com': {
    kind: 'German public international broadcaster',
    properties: ['German public funding', 'international-language service', 'public-service remit'],
  },
  'france24.com': {
    kind: 'French international broadcaster',
    properties: ['France Médias Monde', 'French public international service', 'European and African coverage'],
  },
  'npr.org': {
    kind: 'US public radio network',
    properties: ['member-station model', 'public-media mission', 'audio and text journalism'],
  },
  'pbs.org': {
    kind: 'US public broadcaster',
    properties: ['member-station model', 'PBS NewsHour and educational media', 'public-media mission'],
  },
  'cbc.ca': {
    kind: 'Canadian public broadcaster',
    properties: ['CBC/Radio-Canada', 'public-service mandate', 'national and regional coverage'],
  },
  'abc.net.au': {
    kind: 'Australian public broadcaster',
    properties: ['ABC charter', 'Australian public funding', 'national and international coverage'],
  },
  'nytimes.com': {
    kind: 'US national newspaper',
    properties: ['public company', 'Ochs-Sulzberger family voting control', 'national and international reporting'],
    watch: ['Institutional reach makes framing influential; news, analysis and opinion should still be separated'],
  },
  'washingtonpost.com': {
    kind: 'US national newspaper',
    properties: ['Jeff Bezos-owned', 'Washington politics and investigations', 'owner-backed national paper'],
    links: [{ label: 'Washington Post corporate', url: 'https://corporate.washingtonpost.com/about' }],
  },
  'latimes.com': {
    kind: 'US regional-national newspaper',
    properties: ['Patrick Soon-Shiong/NantCapital-owned', 'California and national coverage', 'owner-backed national paper'],
    links: [{ label: 'Soon-Shiong purchase', url: 'https://www.latimes.com/about/pressreleases/la-mediagroup-20180618-story.html' }],
  },
  'bostonglobe.com': {
    kind: 'US regional newspaper',
    properties: ['John and Linda Henry-owned', 'Boston/New England civic coverage', 'owner-backed national paper'],
  },
  'time.com': {
    kind: 'US news magazine',
    properties: ['Marc and Lynne Benioff-owned', 'weekly magazine heritage', 'person-of-the-year franchise'],
  },
  'jpost.com': {
    kind: 'Israeli English-language newspaper',
    properties: ['Jerusalem Post', 'Israeli politics and diaspora audience', 'English-language national perspective'],
    leaning: 'Commonly described as conservative/right-of-centre in Israeli political context; breaking news and comment differ.',
  },
  'koreatimes.co.kr': {
    kind: 'South Korean English-language newspaper',
    properties: ['English-language Korean coverage', 'expatriate and international audience', 'sister paper to Hankook Ilbo'],
  },
  'thestar.com.my': {
    kind: 'Malaysian national newspaper',
    properties: ['Star Media Group', 'English-language Malaysian coverage', 'historical political ownership context'],
    watch: ['Malaysian political history matters when reading party and election coverage'],
  },
  'nst.com.my': {
    kind: 'Malaysian national newspaper',
    properties: ['New Straits Times', 'Media Prima group', 'English-language Malaysian coverage'],
  },
  'malaymail.com': {
    kind: 'Malaysian news site',
    properties: ['English-language Malaysian coverage', 'online-first national news'],
  },
  'freemalaysiatoday.com': {
    kind: 'Malaysian independent news site',
    properties: ['independent online news', 'politics and civil society', 'Malaysian alternative press'],
  },
  'apnews.com': {
    kind: 'News wire',
    properties: ['not-for-profit cooperative', 'member news organisations', 'baseline reporting'],
    watch: ['Wires are often the shared source behind many outlet versions of the same event'],
  },
  'reuters.com': {
    kind: 'News wire',
    properties: ['Thomson Reuters', 'international wire', 'markets and breaking news'],
  },
  'factcheck.afp.com': {
    kind: 'Fact-check wire',
    properties: ['Agence France-Presse', 'fact-check and verification desk', 'international wire'],
  },
  'globenewswire.com': {
    kind: 'Press-release distributor',
    properties: ['paid company announcements', 'investor and corporate disclosure', 'not independent editorial selection'],
  },
  'prnewswire.com': {
    kind: 'Press-release distributor',
    properties: ['paid company announcements', 'marketing and corporate disclosure', 'not independent editorial selection'],
  },
  'nasa.gov': {
    kind: 'Government agency source',
    properties: ['US space agency', 'missions, imagery and official updates', 'primary institutional source'],
  },
  'news.xbox.com': {
    kind: 'Corporate publication',
    properties: ['Microsoft/Xbox official news', 'product announcements', 'first-party marketing context'],
  },
  'microsoft.com': {
    kind: 'Corporate source',
    properties: ['Microsoft official announcements', 'product and policy statements', 'first-party claims'],
  },
  'metoffice.gov.uk': {
    kind: 'Public weather service',
    properties: ['UK Met Office', 'forecasts, warnings and observations', 'primary weather source'],
  },
  'newsweek.com': {
    kind: 'US news magazine',
    properties: ['digital newsweekly heritage', 'high-volume national and trending coverage', 'post-print-era ownership changes'],
  },
  'semafor.com': {
    kind: 'Global digital news start-up',
    properties: ['Semaform story format', 'global/business/policy audience', 'newsroom-founded 2022'],
  },
  'qz.com': {
    kind: 'Business and global-affairs site',
    properties: ['Quartz heritage', 'digital business coverage', 'ownership has changed several times'],
  },
  'vice.com': {
    kind: 'Digital culture and news publisher',
    properties: ['youth/culture reporting heritage', 'bankruptcy and restructuring history', 'mixed investigative and lifestyle output'],
  },
};

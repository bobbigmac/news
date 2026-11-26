// Curated subject-relation tree for optional tag grouping.
//
// Terms are explicit in-routes: every alias or surface form that should pull a
// cluster into this subject. They are not discovered at runtime. The allocator
// claims each cluster once in tree order, so a story with several plausible
// homes lands in the first matching relation and `related` links document the
// others.
//
// Node fields:
//   terms   — the explicit catch list: every alias that routes a cluster here
//             (names, abbreviations, possessive forms, platform spellings).
//             Matching is whole-token string matching, never substring search,
//             so a term only catches the exact surface forms it names.
//   related — cross-tree links: { to: '<node-id>', note: '<why>' }. A story is
//             grouped by its claimed branch; related entries explain the
//             connections that branch does not express (for example Russell
//             Brand's comedy peers while his current coverage is legal).
//   pivot   — marks catch-all roots listed last. The allocator reaches them
//             only after the real taxonomy, so they group whatever genuine
//             branches leave thin without competing with them.

export const STORY_RELATION_TREE = [
  {
    id: 'technology',
    label: 'Technology',
    children: [
      {
        id: 'ai-computing',
        label: 'AI & Computing',
        children: [
          {
            id: 'frontier-labs',
            label: 'Frontier Labs',
            children: [
              {
                id: 'openai',
                label: 'OpenAI',
                terms: ['openai', 'chatgpt', 'sam altman', 'sora', 'gpt'],
                related: [
                  { to: 'microsoft-corporate', note: 'Microsoft is OpenAI’s largest outside investor; corporate moves overlap.' },
                  { to: 'nvidia', note: 'Runs on Nvidia hardware; supply and funding stories intertwine.' },
                ],
              },
              {
                id: 'anthropic',
                label: 'Anthropic',
                terms: ['anthropic', 'claude', 'claude code', 'claude opus', 'claude sonnet'],
              },
              {
                id: 'google-ai',
                label: 'Google AI',
                terms: ['deepmind', 'google deepmind', 'gemini', 'alphagenome', 'google ai', 'notebooklm'],
                related: [{ to: 'google', note: 'DeepMind is Google’s AI lab; grouped separately because AI stories outnumber Google-product stories.' }],
              },
              { id: 'other-labs', label: 'Other Labs', terms: ['xai', 'grok', 'mistral', 'meta ai', 'llama', 'deepseek', 'qwen', 'perplexity', 'hugging face'] },
            ],
          },
          {
            id: 'ai-industry',
            label: 'AI Industry',
            children: [
              { id: 'ai-content', label: 'AI Content', terms: ['ai slop', 'ai generated', 'ai content', 'ai cheating', 'ai microdrama', 'ghostwriter ai', 'ai commentator', 'ai actor', 'ai actress'] },
              { id: 'ai-business', label: 'AI Business', terms: ['ai company', 'ai data', 'ai institute', 'ai workers', 'ai development', 'ai investments', 'ai costs', 'ai tool', 'ai group', 'ai slowdown', 'ai overhaul', 'ai datacenter', 'ai data center'] },
              { id: 'ai-society', label: 'AI & Society', terms: ['ai safety', 'ai regulation', 'ai act', 'ai jobs', 'ai bubble', 'ai backlash'] },
              { id: 'ai-core', label: 'AI Core', terms: ['artificial intelligence', 'ai', 'ai model', 'ai models', 'gen ai', 'generative ai', 'gen-ai', 'llm', 'chatbot'] },
            ],
          },
        ],
      },
      {
        id: 'platform-companies',
        label: 'Platform Companies',
        children: [
          {
            id: 'microsoft',
            label: 'Microsoft',
            children: [
              {
                id: 'xbox',
                label: 'Xbox',
                terms: ['xbox game pass', 'xbox series', 'xbox pc app', 'xbox cloud gaming', 'xbox labs', 'xbox development', 'xbox console', 'project helix', 'game pass'],
                related: [{ to: 'game-publishers', note: 'Xbox is a platform holder; game-specific stories group under Gaming.' }],
              },
              { id: 'windows-github', label: 'Windows & GitHub', terms: ['windows 11', 'github', 'github -', 'copilot', 'microsoft 365', 'visual studio'] },
              { id: 'microsoft-corporate', label: 'Microsoft Corporate', terms: ['microsoft', 'microsofts', 'microsoft\'s', 'satya nadella'] },
            ],
          },
          { id: 'google', label: 'Google', terms: ['google', 'googles', 'youtube', 'chromebook', 'android', 'waymo'] },
          { id: 'meta-platforms', label: 'Meta Platforms', terms: ['meta', 'facebook', 'instagram', 'whatsapp', 'mark zuckerberg'] },
          { id: 'apple', label: 'Apple', terms: ['apple', 'iphone', 'ipad', 'macbook', 'app store', 'vision pro', 'tim cook'] },
          { id: 'samsung', label: 'Samsung', terms: ['samsung', 'galaxy s', 'galaxy z'] },
          { id: 'tiktok-bytedance', label: 'TikTok & ByteDance', terms: ['tiktok', 'bytedance'] },
        ],
      },
      {
        id: 'hardware-chipmakers',
        label: 'Hardware & Chipmakers',
        children: [
          {
            id: 'nvidia',
            label: 'Nvidia',
            terms: ['nvidia', 'nvidias', 'nvidia\'s', 'jensen huang', 'jensen huangs', 'megaspeed', 'geforce', 'rtx'],
            related: [
              { to: 'openai', note: 'Nvidia supplies and invests in the frontier labs; chip supply is the shared story.' },
              { to: 'amd', note: 'Direct GPU/accelerator competitor.' },
            ],
          },
          { id: 'amd', label: 'AMD', terms: ['amd', 'amd\'s', 'ryzen', 'radeon'] },
          { id: 'intel', label: 'Intel', terms: ['intel'] },
          { id: 'palantir', label: 'Palantir', terms: ['palantir'] },
          { id: 'semiconductor-industry', label: 'Semiconductors', terms: ['tsmc', 'semiconductor', 'chipmaker', 'ai chip', 'chip war', 'sk hynix'] },
        ],
      },
      {
        id: 'consumer-tech',
        label: 'Consumer Tech',
        children: [
          { id: 'phones-wearables', label: 'Phones & Wearables', terms: ['smartphone', 'smart watch', 'fitbit', 'foldable phone'] },
          { id: 'robots-automation', label: 'Robots & Automation', terms: ['robot', 'humanoid robot', 'robotaxi', 'self driving', 'autonomous vehicle'] },
        ],
      },
      {
        id: 'tech-industry',
        label: 'Tech Industry',
        children: [
          { id: 'apps-software', label: 'Apps & Software', terms: ['app', 'apps', 'software', 'saas', 'digital', 'open source'] },
          { id: 'tech-sector', label: 'Tech Sector', terms: ['tech', 'big tech', 'startup', 'startups', 'ai startup', 'silicon valley', 'tech company', 'tech industry'] },
        ],
      },
    ],
  },
  {
    id: 'gaming',
    label: 'Gaming',
    children: [
      {
        id: 'game-franchises',
        label: 'Game Franchises',
        children: [
          {
            id: 'gta',
            label: 'GTA',
            children: [
              { id: 'gta-6', label: 'GTA 6', terms: ['gta 6', 'gta vi', 'grand theft auto 6', 'grand theft auto vi', 'project leonida', 'leonida'] },
              { id: 'gta-series', label: 'GTA Series', terms: ['gta', 'grand theft auto', 'gta online', 'gta 5', 'rockstar games', 'rockstar'] },
            ],
          },
          {
            id: 'zelda',
            label: 'Zelda',
            terms: ['zelda', 'ocarina', 'tears of the kingdom', 'breath of the wild', 'hyrule', 'legend of zelda'],
            related: [{ to: 'nintendo', note: 'First-party Nintendo franchise; hardware and company stories still group under Nintendo.' }],
          },
          { id: 'pokemon', label: 'Pokémon', terms: ['pokemon', 'pokémon', 'pokemon go', 'pocket monsters'], related: [{ to: 'nintendo', note: 'Nintendo co-owns the Pokémon franchise.' }] },
          { id: 'minecraft', label: 'Minecraft', terms: ['minecraft'], related: [{ to: 'microsoft-corporate', note: 'Mojang/Microsoft property.' }] },
          { id: 'call-of-duty', label: 'Call of Duty', terms: ['call of duty', 'black ops', 'warzone', 'modern warfare'], related: [{ to: 'microsoft-corporate', note: 'Activision Blizzard is a Microsoft studio.' }] },
          { id: 'monster-hunter', label: 'Monster Hunter', terms: ['monster hunter', 'hunter wilds', 'monster hunter wilds'] },
          { id: 'warcraft-blizzard', label: 'Warcraft & Blizzard', terms: ['warcraft', 'world of warcraft', 'blizzard', 'diablo', 'overwatch'] },
          { id: 'nintendo-franchises', label: 'Nintendo Franchises', terms: ['mario', 'pikmin', 'kirby', 'metroid', 'donkey kong', 'smash bros', 'animal crossing', 'splatoon', 'fire emblem'] },
          { id: 'fromsoftware-souls', label: 'FromSoftware & Souls', terms: ['fromsoftware', 'dark souls', 'elden ring', 'bloodborne', 'sekiro', 'nightreign'] },
          { id: 'playstation-franchises', label: 'PlayStation Franchises', terms: ['god of war', 'spider-man 2', 'horizon zero dawn', 'ghost of tsushima', 'last of us', 'kait'], related: [{ to: 'playstation', note: 'Sony first-party franchises; platform stories group under PlayStation.' }] },
          { id: 'live-service', label: 'Live Service', terms: ['fortnite', 'roblox', 'destiny 2', 'apex legends', 'league of legends'] },
          { id: 'upcoming-titles', label: 'Upcoming Titles', terms: ['crimson desert', 'pearl abyss', 'state of decay 3', 'fable', 'perfect dark'] },
        ],
      },
      {
        id: 'platform-holders',
        label: 'Platform Holders',
        children: [
          { id: 'nintendo', label: 'Nintendo', terms: ['nintendo', 'nintendo switch', 'switch 2', 'official nintendo', 'nintendos', 'nintendo\'s', 'eshop'] },
          { id: 'playstation', label: 'PlayStation', terms: ['playstation', 'ps5', 'ps6', 'ps plus', 'playstation portal', 'playstation store', 'pulse elevate', 'state of play'] },
          { id: 'sony-games', label: 'Sony Games', terms: ['sony', 'sonys', 'sony interactive'] },
          { id: 'pc-storefronts', label: 'PC Storefronts', terms: ['steam', 'steam deck', 'epic games store', 'gog'] },
        ],
      },
      {
        id: 'game-industry',
        label: 'Game Industry',
        children: [
          { id: 'game-publishers', label: 'Game Publishers', terms: ['activision', 'activision blizzard', 'tencent', 'ubisoft', 'electronic arts', 'ea sports', 'ea fc', 'square enix', 'capcom', 'larian studios', 'bioware', 'bandai namco', 'sega', 'konami', 'cd projekt', 'take-two'] },
          { id: 'game-development', label: 'Game Development', terms: ['game developer', 'game studio', 'game director', 'gameplay', 'developer update', 'first-person', 'third-person'] },
          { id: 'game-releases', label: 'Releases & Reviews', terms: ['release date', 'game trailer', 'review score', 'early access', 'open beta'] },
          { id: 'games-general', label: 'Games General', terms: ['video game', 'video games', 'videogame', 'game', 'games', 'gamer'] },
        ],
      },
    ],
  },
  {
    id: 'sport',
    label: 'Sport',
    children: [
      {
        id: 'football',
        label: 'Football',
        children: [
          {
            id: 'premier-league',
            label: 'Premier League',
            children: [
              { id: 'manchester-united', label: 'Manchester United', terms: ['manchester united', 'man utd', 'bruno fernandes', 'jim ratcliffe', 'jj gabriel', 'ruben amorim', 'old trafford'] },
              { id: 'manchester-city', label: 'Manchester City', terms: ['manchester city', 'man city', 'pep guardiola', 'etihad'] },
              { id: 'liverpool-arsenal', label: 'Liverpool & Arsenal', terms: ['liverpool', 'liverpool fc', 'anfield', 'arsenal', 'mikel arteta', 'emirates'] },
              { id: 'aston-villa', label: 'Aston Villa', terms: ['aston villa'] },
              { id: 'newcastle-united', label: 'Newcastle United', terms: ['newcastle', 'newcastle united', 'st james park', 'eddie howe'] },
              { id: 'everton-chelsea', label: 'Everton & Chelsea', terms: ['everton', 'chelsea', 'chelsea\'s', 'stamford bridge'] },
              { id: 'promoted-regional', label: 'Promoted & Regional Clubs', terms: ['sunderland', 'leeds', 'leeds united', 'brighton', 'brentford', 'fulham', 'nottingham forest', 'crystal palace', 'west ham', 'wolves', 'bournemouth', 'burnley'] },
              { id: 'premier-league-general', label: 'Premier League General', terms: ['premier league', 'fantasy premier league', 'fpl', 'premier league table'] },
            ],
          },
          {
            id: 'international-football',
            label: 'International Football',
            children: [
              { id: 'european-clubs', label: 'European Clubs', terms: ['real madrid', 'barcelona', 'saint germain', 'psg', 'saint-germain', 'bayern', 'bayern munich', 'juventus', 'inter milan', 'ac milan', 'atletico', 'borussia dortmund'] },
              { id: 'national-teams', label: 'National Teams', terms: ['thomas tuchel', 'world cup', 'england squad', 'three lions', 'wales football', 'scotland football'] },
              { id: 'global-stars', label: 'Global Stars', terms: ['cristiano ronaldo', 'ronaldo', 'messi', 'lionel messi', 'ivan toney', 'mbappe', 'haaland'] },
            ],
          },
          {
            id: 'player-watch',
            label: 'Player Watch',
            terms: ['harry kane', 'kane', 'cole palmer', 'palmer', 'mauricio pochettino', 'bukayo saka', 'jude bellingham', 'phil foden'],
          },
        ],
      },
      {
        id: 'us-sport',
        label: 'US Sport',
        children: [
          { id: 'nfl', label: 'NFL', terms: ['nfl', 'super bowl', 'quarterback', 'touchdown'], related: [{ to: 'taylor-swift', note: 'Kelce/Swift coverage crosses entertainment and NFL.' }] },
          { id: 'nba', label: 'NBA', terms: ['nba', 'lakers', 'celtics'] },
          { id: 'nhl', label: 'NHL', terms: ['nhl', 'stanley cup'] },
          { id: 'baseball', label: 'Baseball', terms: ['mlb', 'yankees', 'dodgers', 'world series'], related: [{ to: 'surgery', note: '“Tommy John surgery” is a baseball injury term that groups under Surgery when the story is medical.' }] },
        ],
      },
      { id: 'motorsport', label: 'Motorsport', terms: ['formula 1', 'f1', 'lewis hamilton', 'ferrari', 'mclaren f1', 'verstappen', 'grand prix', 'nascar'] },
      { id: 'golf', label: 'Golf', terms: ['liv golf', 'pga tour', 'rory mcilroy', 'the open'] },
      { id: 'darts', label: 'Darts', terms: ['luke littler', 'pdc darts', 'littler'] },
      { id: 'boxing-mma', label: 'Boxing & MMA', terms: ['boxing', 'heavyweight', 'ufc', 'mma', 'tyson fury', 'anthony joshua'] },
      { id: 'cricket-rugby', label: 'Cricket & Rugby', terms: ['cricket', 'ashes', 'test match', 'rugby', 'six nations', 'all blacks', 'twickenham'] },
      { id: 'tennis-athletics', label: 'Tennis & Athletics', terms: ['tennis', 'wimbledon', 'grand slam', 'olympics', 'marathon', 'athletics'] },
      {
        id: 'sport-general',
        label: 'Sport General',
        children: [
          { id: 'players-coaches', label: 'Players & Coaches', terms: ['player', 'players', 'coach', 'transfer', 'signing', 'contract'] },
          { id: 'matches-results', label: 'Matches & Results', terms: ['match', 'fixture', 'score', 'league', 'stadium', 'tournament', 'draw', 'kick-off'] },
          { id: 'fans-culture', label: 'Fans & Culture', terms: ['fan', 'fans', 'supporters', 'ultras', 'season ticket'] },
        ],
      },
    ],
  },
  {
    id: 'politics',
    label: 'Politics',
    children: [
      {
        id: 'uk-politics',
        label: 'UK Politics',
        children: [
          {
            id: 'andy-burnham',
            label: 'Andy Burnham',
            terms: ['andy burnham', 'burnham', 'greater manchester mayor'],
            related: [
              { to: 'labour-government', note: 'Burnham is a Labour mayor whose leadership speculation is a Westminster story.' },
              { to: 'local-community', note: 'His remit is Greater Manchester; local stories stay under the community pivot.' },
            ],
          },
          { id: 'labour-government', label: 'Labour Government', terms: ['starmer', 'keir starmer', 'labour party', 'labour', 'downing street', 'number 10', 'tory government'] },
          {
            id: 'scotland-wales-ni',
            label: 'Scotland, Wales & NI',
            children: [
              { id: 'scotland', label: 'Scotland', terms: ['scottish government', 'first minister', 'holyrood', 'snp', 'scottish parliament'], related: [{ to: 'british-isles', note: 'Bare Scotland/Wales geography groups under the regions pivot, not politics.' }] },
              { id: 'wales', label: 'Wales', terms: ['welsh government', 'welsh nhs', 'senedd', 'welsh parliament'] },
              { id: 'northern-ireland', label: 'Northern Ireland', terms: ['northern ireland', 'stormont', 'sinn fein', 'dup'] },
              { id: 'london-government', label: 'London Government', terms: ['sadiq khan', 'london assembly', 'city hall'] },
            ],
          },
          { id: 'uk-ministers', label: 'UK Ministers', terms: ['lisa nandy', 'john healey', 'home office', 'chancellor', 'rachel reeves', 'wes streeting', 'shabana mahmood', 'yvette cooper'] },
          { id: 'conservatives-reform', label: 'Conservatives & Reform', terms: ['tory', 'conservative party', 'reform uk', 'nigel farage', 'farage', 'kemi badenoch'] },
          { id: 'uk-parliament', label: 'Parliament', terms: ['mps', 'mp', 'parliament', 'westminster', 'house of commons', 'commons', 'lords', 'pmqs', 'backbench'] },
          { id: 'local-government', label: 'Local Government', terms: ['council', 'local council', 'mayor', 'local election', 'councillor'] },
        ],
      },
      {
        id: 'us-politics',
        label: 'US Politics',
        children: [
          {
            id: 'trump-administration',
            label: 'Trump Administration',
            children: [
              { id: 'donald-trump', label: 'Donald Trump', terms: ['donald trump', 'trump', 'president donald trump', 'president trump'] },
              { id: 'trump-officials', label: 'Trump Officials', terms: ['trump administration', 'pete hegseth', 'secretary pete hegseth', 'rfk jr', 'vance', 'jd vance', 'rubio', 'marco rubio', 'first lady', 'melania', 'white house', 'karoline leavitt'] },
            ],
          },
          {
            id: 'us-election-politics',
            label: 'US Election Politics',
            children: [
              { id: 'midterms', label: 'Midterms', terms: ['midterm', 'midterm elections', 'midterms', '2026 midterms'] },
              {
                id: 'democrats',
                label: 'Democrats',
                children: [
                  { id: 'house-democrats', label: 'House Democrats', terms: ['house democrats', 'house democrat', 'top house democrat'] },
                  { id: 'democratic-party', label: 'Democratic Party', terms: ['democrats', 'democrat', 'judith levine democrats', 'dnc'] },
                ],
              },
              { id: 'republicans', label: 'Republicans', terms: ['gop', 'republican', 'republicans', 'marjorie taylor greene', 'maga'] },
              { id: 'us-candidates', label: 'US Candidates', terms: ['ilhan omar', 'abdul el sayed', 'abdul el-sayed', 'scott colom', 'jamie davis', 'james talarico', 'newsom', 'governor newsom'] },
              { id: 'congress-senate', label: 'Congress & Senate', terms: ['congress', 'senate', 'senator', 'congressman', 'congresswoman', 'capitol'] },
            ],
          },
          { id: 'us-federal-agencies', label: 'US Federal Agencies', terms: ['federal government', 'justice department', 'doj', 'fbi', 'fbi\'s', 'dea', 'ice agents', 'ice raids', 'supreme court', 'pentagon', 'state department'] },
        ],
      },
      {
        id: 'nigeria-politics',
        label: 'Nigeria Politics',
        children: [
          { id: 'nigeria-federal', label: 'Nigeria Federal', terms: ['apc', 'tinubu', 'atiku', 'nigeria senate', 'nigerian government', 'federal capital territory', 'abuja', 'pdp'] },
          { id: 'lagos-state', label: 'Lagos Government', terms: ['lagos government', 'lagos state', 'sanwo-olu'] },
          { id: 'nigeria-security-graft', label: 'Nigeria Security & Graft', terms: ['efcc', 'peter obi', 'ogun', 'boko haram', 'nigerian police'] },
        ],
        related: [{ to: 'africa-regions', note: 'Nigeria geography and society stories group under the Africa regions pivot; this branch is its politics.' }],
      },
      {
        id: 'europe-politics',
        label: 'European Politics',
        children: [
          { id: 'eu-institutions', label: 'EU Institutions', terms: ['brussels', 'european parliament', 'european commission', 'nato summit', 'european council'], related: [{ to: 'eu-policy', note: 'Policy detail groups under Economic Policy; this branch is the politics of the institutions.' }] },
          { id: 'european-leaders', label: 'European Leaders', terms: ['macron', 'merz', 'meloni', 'sanchez', 'tusk'] },
        ],
        related: [
          { to: 'eu-policy', note: 'EU regulatory and trade detail groups under Economic Policy.' },
          { to: 'europe-regions', note: 'Bare “Europe” geography groups under the regions pivot.' },
        ],
      },
      {
        id: 'world-leaders',
        label: 'World Leaders',
        children: [
          { id: 'named-leaders', label: 'Named Leaders', terms: ['putin', 'zelensky', 'benjamin netanyahu', 'netanyahu', 'anthony albanese', 'albanese government', 'anwar', 'president lee', 'modi', 'xi jinping', 'kim jong', 'kim jong un'], related: [{ to: 'pope-leo', note: 'Pope Leo is also a head of state; religious coverage groups under People in the News.' }] },
          { id: 'leaders-general', label: 'Leaders General', terms: ['president', 'prime minister', 'leader', 'head of state', 'foreign minister'] },
        ],
      },
      {
        id: 'elections-worldwide',
        label: 'Elections Worldwide',
        terms: ['election', 'elections', 'vote', 'votes', 'ballot', 'referendum', 'by-election', 'polling'],
      },
    ],
  },
  {
    id: 'world-conflicts',
    label: 'World Conflicts',
    children: [
      {
        id: 'ukraine-russia',
        label: 'Ukraine / Russia',
        children: [
          { id: 'ukraine', label: 'Ukraine', terms: ['ukraine', 'kyiv', 'ukraine war', 'ukraine\'s', 'ukrainian'] },
          { id: 'russia', label: 'Russia', terms: ['russia', 'kremlin', 'russian military', 'russia us', 'russia\'s', 'russian'] },
        ],
      },
      {
        id: 'israel-gaza',
        label: 'Israel / Gaza',
        children: [
          { id: 'gaza-conflict', label: 'Gaza Conflict', terms: ['gaza', 'hamas', 'west bank', 'hezbollah', 'hostage release', 'ceasefire'] },
          { id: 'israel-domestic', label: 'Israel', terms: ['israel', 'israeli', 'israel\'s', 'jerusalem', 'israeli military', 'knesset'] },
        ],
      },
      { id: 'iran', label: 'Iran', terms: ['iran', 'tehran', 'iranian', 'irgc'] },
      {
        id: 'china-taiwan',
        label: 'China / Taiwan',
        children: [
          { id: 'china', label: 'China', terms: ['china', 'beijing', 'south china', 'china\'s', 'chinese', 'hong kong'] },
          { id: 'taiwan', label: 'Taiwan', terms: ['taiwan', 'taipei'] },
        ],
      },
      { id: 'north-korea-tensions', label: 'North Korea Tensions', terms: ['north korea', 'pyongyang', 'dprk', 'korean peninsula', 'korean war'] },
      { id: 'other-conflicts', label: 'Other Conflicts', terms: ['sudan', 'dr congo', 'drc', 'myanmar', 'sahel', 'yemen', 'houthi', 'venezuela', 'haiti'] },
      {
        id: 'defence-security',
        label: 'Defence & Security',
        children: [
          { id: 'military-forces', label: 'Military Forces', terms: ['military', 'army', 'navy', 'air force', 'defence', 'defense', 'troops', 'warship', 'fighter jet', 'raf'] },
          { id: 'weapons-strikes', label: 'Weapons & Strikes', terms: ['missile', 'drone', 'airstrike', 'air strike', 'ballistic', 'nato', 'nuclear'] },
        ],
      },
    ],
  },
  {
    id: 'science-health',
    label: 'Science & Health',
    children: [
      {
        id: 'space',
        label: 'Space',
        children: [
          { id: 'nasa', label: 'NASA', terms: ['nasa', 'nasas', 'nasa\'s', 'artemis', 'james webb', 'iss', 'international space station'] },
          { id: 'spaceflight', label: 'Spaceflight', terms: ['spacex', 'starlink', 'rocket launch', 'moon mission', 'mars mission', 'starship', 'blue origin', 'rocket lab'], related: [{ to: 'nasa', note: 'Commercial crews fly NASA missions; agency stories stay under NASA.' }] },
          { id: 'astronomy', label: 'Astronomy', terms: ['space', 'deep space', 'asteroid', 'comet', 'space telescope', 'exoplanet', 'black hole', 'meteor', 'astronaut'] },
        ],
      },
      {
        id: 'health-medicine',
        label: 'Health & Medicine',
        children: [
          {
            id: 'nhs-healthcare',
            label: 'NHS & Healthcare',
            children: [
              { id: 'nhs', label: 'NHS', terms: ['nhs', 'welsh nhs', 'nhs england', 'scotland s nhs', 'nhs trust'] },
              { id: 'hospitals', label: 'Hospitals', terms: ['hospital', 'health board', 'royal free hospital', 'general hospital', 'teaching hospital', 'a&e', 'waiting list'] },
              { id: 'medical-workforce', label: 'Medical Workforce', terms: ['doctor', 'surgeon', 'british doctor', 'doctor who', 'nurse', 'gp', 'junior doctor', 'paramedic'], related: [{ to: 'tv-formats', note: '“Doctor Who” the TV series is aliased here because entity tagging cannot tell them apart.' }] },
            ],
          },
          { id: 'medicines-regulation', label: 'Medicines & Regulation', terms: ['fda', 'drug administration', 'pfizer', 'novartis', 'medicare', 'drug approval', 'mhra', 'nice'] },
          {
            id: 'disease-research',
            label: 'Disease Research',
            children: [
              {
                id: 'cancer',
                label: 'Cancer',
                children: [
                  { id: 'specific-cancers', label: 'Specific Cancers', terms: ['prostate cancer', 'lung cancer', 'breast cancer', 'ovarian cancer', 'cervical cancer', 'bowel cancer', 'skin cancer', 'pancreatic cancer', 'breast'] },
                  { id: 'cancer-general', label: 'Cancer General', terms: ['cancer', 'cancer research', 'american cancer society', 'cancer center', 'cancer fighting', 'chemotherapy', 'tumour', 'tumor'] },
                ],
              },
              { id: 'alzheimer-dementia', label: 'Alzheimer’s & Dementia', terms: ['alzheimer', 'alzheimer\'s', 'dementia', 'memory loss'] },
              { id: 'metabolic-heart', label: 'Diabetes & Heart', terms: ['diabetes', 'heart disease', 'heart attack', 'cholesterol', 'blood pressure', 'obesity', 'weight loss drug', 'ozempic', 'wegovy'] },
              { id: 'mental-health', label: 'Mental Health', terms: ['mental health', 'mental illness', 'depression', 'anxiety', 'psychiatric', 'adhd', 'autism', 'suicide'] },
              { id: 'biomedical-research', label: 'Biomedical Research', terms: ['gene', 'protein', 'cell', 'brain', 'dna', 'clinical trial', 'vaccine', 'antibiotic', 'stem cell'] },
              { id: 'surgery', label: 'Surgery', terms: ['surgery', 'knee surgery', 'plastic surgery', 'tommy john surgery', 'transplant', 'operation'] },
              { id: 'patient-care', label: 'Patient Care', terms: ['patient', 'patients', 'disease', 'assault patient', 'diagnosis', 'treatment'] },
            ],
          },
          { id: 'public-health', label: 'Public Health', terms: ['covid', 'flu', 'vaccine rollout', 'outbreak', 'who', 'pandemic', 'measles', 'mpox'] },
        ],
      },
      {
        id: 'environment-climate',
        label: 'Environment & Climate',
        children: [
          { id: 'weather-warnings', label: 'Weather & Warnings', terms: ['met office', 'weather warning', 'storm', 'flooding', 'flood', 'heatwave', 'cold snap', 'snow warning'] },
          { id: 'climate-policy', label: 'Climate Policy', terms: ['climate', 'climate change', 'net zero', 'emissions', 'cop', 'paris agreement', 'environment agency'] },
          { id: 'wildlife-nature', label: 'Wildlife & Nature', terms: ['wildlife', 'conservation', 'endangered', 'species', 'rewilding', 'national park'] },
        ],
      },
    ],
  },
  {
    id: 'crime-justice',
    label: 'Crime & Justice',
    children: [
      {
        id: 'public-figure-cases',
        label: 'Public Figure Cases',
        children: [
          {
            id: 'russell-brand',
            label: 'Russell Brand',
            terms: ['russell brand'],
            related: [
              { to: 'british-comedy', note: 'Brand came up through the same UK comedy/TV circuit as David Walliams, but current coverage is legal, not entertainment.' },
              { to: 'celebrity-news', note: 'Fame is why this is news at all; the grouping is the case, not the celebrity.' },
            ],
          },
          { id: 'epstein-network', label: 'Epstein Network', terms: ['epstein', 'jeffrey epstein', 'ghislaine maxwell'], related: [{ to: 'sussex-andrew', note: 'Prince Andrew’s Epstein association sits under Royal while his coverage remains institutional.' }] },
          { id: 'other-figure-cases', label: 'Other Figure Cases', terms: ['harvey weinstein', 'diddy', 'sean combs', 'andrew tate', 'mogul'] },
        ],
      },
      {
        id: 'courts-trials',
        label: 'Courts & Trials',
        children: [
          { id: 'court-proceedings', label: 'Court Proceedings', terms: ['court', 'courthouse', 'judge', 'pleaded', 'plea', 'bail'] },
          { id: 'trials', label: 'Trials', terms: ['trial', 'jury', 'testified', 'testimony', 'defendant', 'witness', 'prosecution'] },
          { id: 'verdicts-sentences', label: 'Verdicts & Sentences', terms: ['guilty', 'verdict', 'convicted', 'acquitted', 'sentencing', 'conviction'] },
          { id: 'legal-disputes', label: 'Legal Disputes', terms: ['lawsuit', 'appeal', 'settlement', 'injunction', 'tribunal', 'high court', 'legal challenge'] },
        ],
      },
      {
        id: 'policing-investigations',
        label: 'Policing & Investigations',
        children: [
          { id: 'met-police', label: 'Met & UK Police', terms: ['met police', 'metropolitan police', 'police force', 'constable', 'chief constable'] },
          { id: 'police-general', label: 'Police General', terms: ['police', 'officer', 'officers', 'police officer', 'law enforcement', 'sheriff'] },
          { id: 'investigations', label: 'Investigations', terms: ['investigation', 'inquiry', 'cold case', 'probe', 'watchdog investigation'] },
          { id: 'missing-persons', label: 'Missing Persons', terms: ['missing', 'disappearance', 'missing person'] },
          { id: 'arrests', label: 'Arrests', terms: ['arrested', 'manhunt', 'detained', 'suspect', 'raid'] },
          { id: 'charges-accusations', label: 'Charges & Accusations', terms: ['charged', 'charges', 'accused', 'allegedly', 'allegations', 'indicted'] },
        ],
      },
      {
        id: 'violence-killings',
        label: 'Violence & Killings',
        children: [
          { id: 'killings', label: 'Killings', terms: ['murder', 'killed', 'killer', 'homicide', 'manslaughter', 'body found'] },
          { id: 'assaults-shootings', label: 'Assaults & Shootings', terms: ['shot', 'shooting', 'stabbing', 'stabbed', 'assault', 'attacker', 'victim', 'hostage', 'machete'] },
        ],
      },
      { id: 'sexual-offences', label: 'Sexual Offences', terms: ['rape', 'sexual assault', 'sex abuse', 'paedophile', 'grooming'] },
      { id: 'prisons-sentencing', label: 'Prisons & Sentencing', terms: ['jailed', 'prison', 'jail', 'custody', 'sentence', 'parole', 'life sentence'] },
      { id: 'drug-offences', label: 'Drug Offences', terms: ['drug', 'drugs', 'cannabis', 'cocaine', 'trafficking', 'smuggling', 'drug gang'] },
      { id: 'fraud-financial-crime', label: 'Fraud & Financial Crime', terms: ['fraud', 'scam', 'money laundering', 'bribery', 'corruption case', 'ponzi'] },
    ],
  },
  {
    id: 'business-economy',
    label: 'Business & Economy',
    children: [
      {
        id: 'major-corporates',
        label: 'Major Corporates',
        children: [
          { id: 'retail-logistics', label: 'Retail & Logistics', terms: ['walmart', 'ups', 'ebay', 'nike', 'amazon', 'tesco', 'sainsbury', 'asda', 'primark', 'shein'] },
          { id: 'transport-industry', label: 'Transport Industry', terms: ['boeing', 'ford', 'bmw', 'uber', 'audi', 'tesla', 'toyota', 'airline', 'ryanair', 'british airways'] },
          { id: 'finance-companies', label: 'Finance Companies', terms: ['visa', 'goldman sachs', 'world bank', 'central bank', 'securities exchange commission', 'bank of england', 'hsbc', 'barclays', 'jpmorgan'] },
          {
            id: 'energy-utilities',
            label: 'Energy & Utilities',
            children: [
              { id: 'energy-markets', label: 'Energy Markets', terms: ['oil', 'gas', 'opec', 'energy', 'fuel', 'shell', 'bp', 'crude', 'petrol', 'diesel'] },
              { id: 'utilities-water', label: 'Utilities & Water', terms: ['water', 'thames water', 'sewage', 'water company', 'national grid', 'offshore wind', 'energy bills', 'power grid'] },
            ],
          },
        ],
      },
      {
        id: 'markets',
        label: 'Markets',
        children: [
          { id: 'market-indexes', label: 'Market Indexes', terms: ['nasdaq', 'ftse', 'markets authority', 's&p', 'dow jones', 'stock market'] },
          { id: 'stocks-deals', label: 'Stocks & Deals', terms: ['shares', 'stocks', 'stock', 'ipo', 'earnings', 'takeover', 'merger', 'acquisition', 'share price'] },
        ],
      },
      {
        id: 'economic-policy',
        label: 'Economic Policy',
        children: [
          { id: 'eu-policy', label: 'EU Policy', terms: ['eu', 'eu s', 'eu deal', 'eu power', 'eu rules', 'eu uk', 'european union s eu', 'european union', 'eurozone', 'schengen'], related: [{ to: 'europe-politics', note: 'EU summits and leaders group under European Politics.' }] },
          { id: 'uk-economy', label: 'UK Economy', terms: ['budget', 'obr', 'interest rates', 'bank rate', 'inflation', 'recession', 'growth', 'brexit'] },
          { id: 'household-economy', label: 'Household Economy', terms: ['cost of living', 'mortgage', 'rent', 'housing', 'house prices', 'wages', 'pensions', 'universal credit', 'benefits', 'tax'] },
          { id: 'international-institutions', label: 'International Institutions', terms: ['un security council', 'united nations', 'imf', 'wto', 'world trade'] },
        ],
      },
    ],
  },
  {
    id: 'royal',
    label: 'Royal',
    children: [
      { id: 'king-charles', label: 'King Charles', terms: ['king charles', 'king charles iii', 'king\'s', 'camilla', 'queen camilla'] },
      { id: 'wales-family', label: 'Wales Family', terms: ['prince william', 'kate middleton', 'princess of wales', 'princess kate', 'zara tindall', 'prince george'] },
      { id: 'sussex-andrew', label: 'Sussex & Andrew', terms: ['prince harry', 'meghan', 'meghan markle', 'thomas markle', 'prince andrew', 'andrew mountbatten-windsor', 'duke of sussex', 'duchess of sussex'], related: [{ to: 'epstein-network', note: 'Andrew’s Epstein ties are documented under public-figure cases; royal-removal stories stay here.' }] },
      { id: 'royal-institution', label: 'Royal Institution', terms: ['royal family', 'buckingham palace', 'kensington palace', 'windsor', 'sandringham'] },
    ],
  },
  {
    id: 'entertainment-culture',
    label: 'Entertainment & Culture',
    children: [
      {
        id: 'screen',
        label: 'Screen',
        children: [
          { id: 'streaming-platforms', label: 'Streaming Platforms', terms: ['netflix', 'netflixs', 'netflix\'s', 'disney plus', 'disney+', 'hbo', 'hbo max', 'prime video', 'apple tv', 'streaming', 'tv series', 'tv show'] },
          { id: 'tv-formats', label: 'TV Formats', terms: ['strictly', 'strictly come dancing', 'bake off', 'love island', 'i\'m a celebrity', 'traitors', 'eastenders', 'coronation street', 'doctor who'], related: [{ to: 'medical-workforce', note: 'Entity tagging can’t separate Doctor Who from actual doctors; the alias lives on both branches.' }] },
          { id: 'film', label: 'Film', terms: ['james bond', 'marvel', 'mcu', 'film', 'box office', 'sequel', 'hollywood', 'movie', 'oscars', 'bafta', 'film festival'] },
          {
            id: 'screen-general',
            label: 'Screen General',
            children: [
              { id: 'series-shows', label: 'Series & Shows', terms: ['series', 'show', 'shows', 'episode', 'finale', 'premiere', 'season finale'] },
              { id: 'trailers-docs', label: 'Trailers & Docs', terms: ['trailer', 'documentary', 'docuseries', 'teaser'] },
            ],
          },
        ],
      },
      {
        id: 'music-celebrity',
        label: 'Music & Celebrity',
        children: [
          { id: 'taylor-swift', label: 'Taylor Swift', terms: ['taylor swift', 'eras tour'], related: [{ to: 'nfl', note: 'Kelce relationship crosses into NFL coverage.' }] },
          { id: 'music-artists', label: 'Music Artists', terms: ['mariah carey', 'kanye west', 'ye', 'beyonce', 'lady gaga', 'singer', 'album', 'tour', 'concert', 'grammy'] },
          { id: 'celebrity-news', label: 'Celebrity News', terms: ['kim kardashian', 'kardashian', 'celebrity', 'actor', 'actress', 'fame', 'red carpet'] },
          {
            id: 'british-comedy',
            label: 'British Comedy',
            terms: ['david walliams', 'little britain', 'ricky gervais', 'comedian', 'stand up', 'matt lucas'],
            related: [{ to: 'russell-brand', note: 'Same comedy-circuit generation; Brand’s current coverage is court proceedings, so it groups under public-figure cases.' }],
          },
        ],
      },
      {
        id: 'culture-heritage',
        label: 'Culture & Heritage',
        children: [
          { id: 'history-archaeology', label: 'History & Archaeology', terms: ['ancient', 'archaeology', 'archaeological', 'roman', 'medieval', 'history', 'heritage', 'museum', 'viking'] },
          { id: 'arts-media', label: 'Arts & Media', terms: ['book', 'novel', 'author', 'poetry', 'theatre', 'west end', 'opera', 'radio'] },
          { id: 'food-home', label: 'Food & Home', terms: ['food', 'recipe', 'restaurant', 'chef', 'cooking', 'baking', 'garden', 'gardening'] },
        ],
      },
    ],
  },
  {
    id: 'education',
    label: 'Education',
    children: [
      { id: 'schools', label: 'Schools', terms: ['school', 'schools', 'teacher', 'pupil', 'headteacher', 'gcse', 'a-level', 'exam', 'ofsted', 'curriculum'] },
      { id: 'universities', label: 'Universities', terms: ['university', 'students', 'student', 'college', 'campus', 'tuition', 'degree', 'oxbridge'] },
    ],
  },
  {
    id: 'pivots',
    label: 'Pivoted Angles',
    pivot: true,
    children: [
      {
        id: 'named-individuals',
        label: 'People in the News',
        children: [
          { id: 'pope-leo', label: 'Pope Leo', terms: ['pope leo', 'pope', 'vatican'], related: [{ to: 'world-leaders', note: 'The Pope is a head of state; faith coverage groups here.' }] },
          { id: 'former-leaders', label: 'Former Leaders', terms: ['obama', 'barack obama', 'biden', 'tony blair', 'boris johnson'] },
          { id: 'public-voices', label: 'Public Voices', terms: ['asha sharma', 'gen z', 'influencer', 'youtuber', 'podcaster'] },
        ],
      },
      {
        id: 'studies-findings',
        label: 'Studies & Findings',
        children: [
          { id: 'published-studies', label: 'Published Studies', terms: ['study', 'research', 'researchers', 'new study', 'study finds', 'peer reviewed'] },
          { id: 'scientist-voices', label: 'Scientists', terms: ['scientist', 'scientists', 'professor', 'researcher'] },
          { id: 'expert-analysis', label: 'Experts & Analysis', terms: ['expert', 'experts', 'analysis', 'analyst', 'watchdog'] },
        ],
      },
      {
        id: 'deaths-obituaries',
        label: 'Deaths & Obituaries',
        children: [
          { id: 'obituaries', label: 'Obituaries & Tributes', terms: ['obituary', 'tributes', 'dies aged', 'has died'] },
          { id: 'passings', label: 'Deaths', terms: ['dies', 'died', 'dead', 'death', 'passing'] },
        ],
      },
      {
        id: 'money-prices',
        label: 'Money & Prices',
        children: [
          { id: 'prices-bills', label: 'Prices & Bills', terms: ['price', 'prices', 'cost', 'costs', 'bills', 'fee', 'fees', 'money'] },
          { id: 'spending-saving', label: 'Spending & Saving', terms: ['deal', 'discount', 'sale', 'saving', 'savings', 'worth', 'free'] },
        ],
      },
      {
        id: 'seasonal-events',
        label: 'Seasonal Events',
        children: [
          { id: 'christmas', label: 'Christmas', terms: ['christmas', 'christmas day', 'christmas market', 'advent', 'festive'] },
          { id: 'other-seasonal', label: 'Other Seasonal', terms: ['halloween', 'thanksgiving', 'new year', 'easter', 'valentine', 'bonfire night', 'firework'] },
        ],
      },
      {
        id: 'human-interest',
        label: 'Human Interest',
        children: [
          { id: 'animals', label: 'Animals', terms: ['dog', 'cat', 'puppy', 'kitten', 'pet', 'pets', 'whale', 'elephant'] },
          { id: 'rescues-survivors', label: 'Rescues & Survivors', terms: ['rescue', 'survivor', 'miracle', 'escaped', 'reunited'] },
          {
            id: 'family-life',
            label: 'Family Life',
            children: [
              { id: 'children-parents', label: 'Children & Parents', terms: ['children', 'parents', 'mother', 'father', 'mum', 'mummy', 'dad', 'baby', 'son', 'daughter', 'toddler', 'teenager'] },
              { id: 'partnerships', label: 'Partnerships', terms: ['wife', 'husband', 'marriage', 'wedding', 'divorce', 'engaged', 'couple'] },
              { id: 'family-general', label: 'Family General', terms: ['family', 'families', 'relatives', 'siblings'] },
            ],
          },
          { id: 'charity-causes', label: 'Charity & Causes', terms: ['charity', 'fundraising', 'donate', 'donation', 'volunteers', 'nonprofit'] },
        ],
      },
      {
        id: 'world-regions',
        label: 'World Regions',
        children: [
          {
            id: 'british-isles',
            label: 'British Isles',
            children: [
              { id: 'london', label: 'London', terms: ['london', 'east london', 'west london', 'south london', 'north london', 'central london'] },
              { id: 'england-britain', label: 'England & Britain', terms: ['england', 'england\'s', 'britain', 'british', 'english'] },
              { id: 'scotland-wales-regions', label: 'Scotland & Wales', terms: ['scotland', 'scottish', 'scotland\'s', 'wales', 'welsh', 'edinburgh', 'glasgow', 'cardiff', 'belfast'] },
              { id: 'ireland-isle', label: 'Ireland', terms: ['ireland', 'irish', 'dublin', 'cork', 'galway'] },
            ],
            related: [{ to: 'uk-politics', note: 'Government and policy stories group under UK Politics before this geographic net sees them.' }],
          },
          {
            id: 'americas',
            label: 'Americas',
            children: [
              { id: 'us-general', label: 'US General', terms: ['america', 'united states', 'american', 'u s'] },
              { id: 'us-states', label: 'US States', terms: ['california', 'texas', 'florida', 'new york', 'los angeles', 'colorado', 'michigan', 'north carolina', 'jersey', 'chicago', 'boston', 'ohio', 'georgia state'] },
              { id: 'canada', label: 'Canada', terms: ['canada', 'canadian', 'ontario', 'toronto', 'quebec', 'vancouver', 'ottawa', 'montreal', 'british columbia'] },
              { id: 'latin-america', label: 'Latin America', terms: ['brazil', 'argentina', 'mexico', 'chile', 'colombia', 'peru', 'cuba', 'jamaica', 'caribbean', 'latin america'] },
            ],
          },
          {
            id: 'europe-regions',
            label: 'European Regions',
            children: [
              { id: 'western-europe', label: 'Western Europe', terms: ['france', 'french', 'paris', 'germany', 'german', 'berlin', 'netherlands', 'amsterdam', 'belgium', 'austria', 'vienna', 'switzerland'] },
              { id: 'southern-europe', label: 'Southern Europe', terms: ['spain', 'spanish', 'madrid', 'italy', 'italian', 'milan', 'rome', 'athens', 'greece', 'lisbon', 'portugal', 'venice'] },
              { id: 'northern-eastern-europe', label: 'Northern & Eastern Europe', terms: ['poland', 'norway', 'sweden', 'denmark', 'finland', 'czech', 'hungary', 'romania', 'baltic', 'iceland'] },
              { id: 'europe-general', label: 'Europe General', terms: ['europe', 'european', 'continental europe'] },
            ],
          },
          {
            id: 'asia-pacific',
            label: 'Asia Pacific',
            children: [
              {
                id: 'south-asia',
                label: 'South Asia',
                children: [
                  { id: 'india', label: 'India', terms: ['india', 'india\'s', 'indian', 'delhi', 'mumbai', 'bengaluru'] },
                  { id: 'pakistan', label: 'Pakistan', terms: ['pakistan', 'punjab', 'lahore', 'karachi', 'islamabad', 'pakistani'] },
                  { id: 'south-asia-other', label: 'South Asia Other', terms: ['bangladesh', 'sri lanka', 'dhaka', 'nepal'] },
                ],
              },
              {
                id: 'east-asia',
                label: 'East Asia',
                children: [
                  { id: 'south-korea-region', label: 'South Korea', terms: ['korea', 'korea\'s', 'korean', 'south korea', 'seoul', 'south korea\'s'], related: [{ to: 'north-korea-tensions', note: 'North Korea is a security topic under World Conflicts; South Korea geography is regional.' }] },
                  { id: 'east-asia-general', label: 'East Asia General', terms: ['japan', 'japanese', 'tokyo', 'singapore', 'shanghai'] },
                ],
              },
              { id: 'southeast-asia', label: 'Southeast Asia', terms: ['malaysia', 'lumpur', 'kuala lumpur', 'indonesia', 'thailand', 'philippines', 'vietnam', 'jakarta', 'bangkok', 'manila', 'cambodia'] },
              { id: 'oceania', label: 'Oceania', terms: ['australia', 'australia\'s', 'australian', 'sydney', 'melbourne', 'new zealand', 'zealand', 'auckland', 'brisbane', 'perth', 'fiji'] },
            ],
          },
          {
            id: 'middle-east-central',
            label: 'Middle East & Central Asia',
            terms: ['saudi arabia', 'saudi', 'uae', 'qatar', 'dubai', 'abu dhabi', 'turkey', 'istanbul', 'oman', 'kuwait', 'jordan', 'lebanon', 'iraq', 'syria', 'afghanistan'],
          },
          {
            id: 'africa-regions',
            label: 'Africa',
            children: [
              { id: 'west-africa', label: 'West Africa', terms: ['nigeria', 'nigerian', 'lagos', 'ghana', 'senegal', 'ivory coast', 'accra'], related: [{ to: 'nigeria-politics', note: 'Nigerian political stories group under the primary Nigeria Politics branch.' }] },
              { id: 'east-africa', label: 'East Africa', terms: ['kenya', 'ethiopia', 'uganda', 'rwanda', 'nairobi', 'tanzania'] },
              { id: 'southern-africa', label: 'Southern Africa', terms: ['south africa', 'zimbabwe', 'johannesburg', 'cape town', 'botswana'] },
              { id: 'north-africa', label: 'North Africa', terms: ['egypt', 'morocco', 'tunisia', 'algeria', 'cairo', 'libya'] },
              { id: 'africa-general', label: 'Africa General', terms: ['africa', 'african', 'africa\'s'] },
            ],
          },
        ],
      },
      {
        id: 'work-jobs',
        label: 'Work & Jobs',
        children: [
          { id: 'employment', label: 'Employment', terms: ['job', 'jobs', 'employment', 'hiring', 'layoffs', 'work', 'workplace', 'redundancy', 'minimum wage'] },
          { id: 'industrial-action', label: 'Industrial Action', terms: ['strike', 'strikes', 'union', 'unions', 'walkout', 'picket', 'industrial action'] },
          { id: 'pay-workers', label: 'Pay & Workers', terms: ['pay', 'workers', 'worker', 'wage', 'wages', 'pay rise', 'salary'] },
        ],
      },
      {
        id: 'corporate-news',
        label: 'Corporate News',
        children: [
          { id: 'banking', label: 'Banking', terms: ['bank', 'banks', 'banking', 'lender', 'mortgage lender'] },
          { id: 'corporate-general', label: 'Corporate General', terms: ['company', 'ceo', 'firm', 'firms', 'profit', 'revenue', 'quarterly', 'board', 'corporate'] },
          { id: 'investment-deals', label: 'Investment & Deals', terms: ['investment', 'investors', 'funding', 'funding round', 'valuation', 'backer'] },
        ],
      },
      {
        id: 'travel-transport',
        label: 'Travel & Transport',
        children: [
          { id: 'rail-road', label: 'Rail & Road', terms: ['train', 'rail', 'railway', 'car', 'driver', 'driving', 'traffic', 'motorway', 'bus'] },
          { id: 'flights-tourism', label: 'Flights & Tourism', terms: ['flight', 'airport', 'tourist', 'tourism', 'travel', 'holiday', 'passenger', 'cruise'] },
        ],
      },
      {
        id: 'local-community',
        label: 'Local & Community',
        children: [
          { id: 'manchester-local', label: 'Manchester Local', terms: ['longsight', 'levenshulme', 'gorton', 'manchester'], related: [{ to: 'andy-burnham', note: 'City-region stories overlap the mayor; Burnham himself groups under UK Politics.' }] },
          { id: 'uk-local', label: 'UK Local', terms: ['birmingham', 'bristol', 'leeds', 'sheffield', 'nottingham', 'community', 'residents', 'neighbours'] },
        ],
      },
      {
        id: 'weather-disasters',
        label: 'Weather & Disasters',
        children: [
          { id: 'fires-disasters', label: 'Fires & Disasters', terms: ['fire', 'blaze', 'wildfire', 'earthquake', 'hurricane', 'typhoon', 'tsunami', 'volcano', 'landslide', 'disaster'] },
          { id: 'extreme-weather', label: 'Extreme Weather', terms: ['heatwave', 'cold wave', 'snowstorm', 'drought', 'monsoon'] },
        ],
      },
    ],
  },
];

// Topic-based category classification.
//
// Newspapers use vague categories (Politics, Business, Technology) because
// they cover everything and appeal to everyone. We have specific sources and
// a specific user — we can be more precise about what stories are actually
// about.
//
// Each category has a weighted keyword graph. A story's tags, trigger words,
// headline, and summary are checked against all categories. The category with
// the highest total weight wins. This is more accurate than the LLM's
// single-shot categorisation because:
//   1. We can tune the keyword weights based on what actually appears
//   2. We can handle edge cases (gaming != technology, celebrity != entertainment)
//   3. It's deterministic — same input always gets same output
//   4. It doesn't cost an LLM call
//
// The LLM still suggests a category, but this module overrides it when the
// keyword graph disagrees. This catches the common mislabelling patterns.

// Category definitions: keyword -> weight (higher = stronger indicator)
const CATEGORY_GRAPH = {
  // Video games, consoles, game industry, esports
  Gaming: {
    weight: 1,
    keywords: {
      game: 3, games: 3, gaming: 4, gamer: 3, gameplay: 3, trailer: 2,
      console: 3, xbox: 4, playstation: 4, ps5: 4, ps4: 3, nintendo: 4,
      switch: 2, steam: 3, valve: 2, esports: 3, mmorpg: 3, rpg: 2, fps: 2,
      gta: 4, 'grand theft auto': 4, rockstar: 4, sega: 3, capcom: 3,
      fromsoftware: 3, obsidian: 3, bethesda: 3, ubisoft: 3, blizzard: 3,
      gamescom: 4, e3: 3, 'game pass': 4, 'video game': 4, 'game release': 4,
      'game industry': 4, 'game studio': 4, 'game developer': 3, dlc: 3,
      'beta test': 2, patch: 2, 'frame rate': 2, '60fps': 3, '30fps': 3,
      'first-person': 2, 'open world': 2, 'role-playing': 2, dungeoneering: 3,
      'path of exile': 4, 'zenless zone zero': 4, 'gears of war': 4,
      'cassette beasts': 4, 'roco kingdom': 4, 'diablo': 4, 'join us': 2,
      duel: 2, 'disc to digital': 3, 'physical disc': 2,
    },
  },

  // All sports — football, cricket, rugby, tennis, cycling, racing, etc.
  Sport: {
    weight: 1,
    keywords: {
      sport: 3, sports: 3, football: 4, soccer: 4, cricket: 4, rugby: 4,
      tennis: 4, cycling: 4, 'cycling classic': 5, olympic: 4, olympics: 4,
      athlete: 3, athlete: 3, team: 2, match: 3, game: 1, tournament: 3,
      league: 3, championship: 3, 'eagles': 3, 'phillies': 3, roster: 3,
      'wide receiver': 4, quarterback: 4, touchdown: 4, pitcher: 4, baseball: 4,
      'mlb': 4, 'nfl': 4, 'premier league': 4, 'la liga': 4, 'serie a': 4,
      'bundesliga': 4, 'transfer': 3, 'transfer window': 4, 'jockey': 4,
      'horse racing': 4, 'race meeting': 4, 'races cancelled': 4, jockey: 4,
      'galatasaray': 3, 'aston villa': 3, 'al nassr': 3, 'match guide': 3,
      'wild-card': 3, 'wild card': 3, 'playoff': 3, 'play-offs': 3,
      '53-man roster': 5, 'training camp': 3, 'preseason': 3, 'draft pick': 4,
      'a.j. brown': 3, 'makai lemon': 3, 'mike hazen': 3, 'ketel marte': 3,
      'philly cycling': 5, 'kim stoveld': 3, 'ben franklin parkway': 3,
      'manayunk wall': 3, 'thirsk': 4, 'bellewstown': 4, 'jockey fall': 5,
      'good good golf': 4, golf: 3, 'pga': 4, 'ryder cup': 4,
    },
  },

  // Celebrity gossip, entertainment personalities, film/TV/music stars
  Celebrity: {
    weight: 1,
    keywords: {
      celebrity: 4, celebrities: 4, star: 2, stars: 2, actor: 3, actress: 3,
      singer: 3, musician: 3, 'film star': 4, 'tv personality': 4,
      'jennifer lopez': 5, 'ricky gervais': 5, 'vanessa feltz': 5,
      'luisa zissman': 5, 'jenny powell': 5, knighthood: 3, 'celebrity fit club': 5,
      selfie: 2, nude: 2, burnout: 1, 'reading & leeds': 3, 'reading festival': 4,
      'leeds festival': 4, 'festival lineup': 3, influencer: 3,
      'instagram food trend': 3, 'social media trend': 2, 'tiktok trend': 3,
      'red carpet': 4, 'award ceremony': 3, 'bafta': 4, 'oscar': 4, 'grammy': 4,
      'brit award': 4, 'emmy': 4, 'film premiere': 4, 'box office': 3,
    },
  },

  // Government, elections, policy, parliament, politicians
  Politics: {
    weight: 1,
    keywords: {
      politics: 4, political: 4, election: 4, government: 3, parliament: 4,
      minister: 4, 'prime minister': 5, 'cabinet': 4, 'mp ': 3, 'member of parliament': 5,
      'secretary of state': 5, 'energy secretary': 5, 'private school': 3,
      'policy': 2, 'legislation': 3, 'bill ': 2, 'act of parliament': 4,
      'downing street': 5, 'whitehall': 4, 'westminster': 4, 'labour': 3,
      'conservative': 3, 'tories': 3, 'lib dem': 3, 'snp': 3, 'reform': 2,
      'by-election': 5, 'local election': 4, 'general election': 5,
      'postal service': 3, 'mail-in': 3, 'voting rights': 4, 'voter': 3,
      'shackamaxon': 3, 'sheriff': 3, 'sheriff office': 4, 'abolish': 2,
      'jason kelce': 2, 'data center': 1,
    },
  },

  // Crime, courts, policing, justice system
  Crime: {
    weight: 1,
    keywords: {
      crime: 4, criminal: 4, arrest: 4, charged: 3, 'guilty plea': 5,
      'pleads guilty': 5, 'prison': 3, 'jail': 3, 'sentenced': 4, 'sentence': 3,
      'court': 3, 'judge': 3, 'magistrate': 4, 'trial': 4, 'hearing': 2,
      'police': 2, 'investigation': 2, 'probe': 2, 'detective': 3,
      'leaking': 3, 'leak': 3, 'classified': 3, 'state secrets': 4,
      'dia': 3, 'espionage': 4, 'prankster': 3, 'prank': 3, 'pizza deliveries': 3,
      'smuggling': 4, 'lizard': 2, 'border': 2, 'tampon': 3, 'arrested': 4,
      'prosecutor': 4, 'prosecution': 3, 'defendant': 3, 'indicted': 4,
      'fraud': 4, 'theft': 3, 'assault': 3, 'violence': 2,
    },
  },

  // Companies, finance, markets, trade, deals
  Business: {
    weight: 1,
    keywords: {
      business: 3, company: 3, companies: 3, corporate: 3, corporation: 3,
      finance: 3, financial: 3, 'stock market': 4, shares: 3, 'share price': 4,
      'merger': 4, 'acquisition': 4, 'takeover': 4, 'deal': 2, 'deal worth': 3,
      'billion': 2, 'million': 2, '€50m': 3, '$300m': 3, 'licensing': 3,
      'ip bundle': 3, 'hollywood deals': 3, 'movie adaptation': 3,
      'tv adaptation': 3, 'trade': 2, 'tariff': 3, 'economy': 3,
      'recession': 4, 'inflation': 3, 'interest rate': 4, 'bank': 2,
      'startup': 3, 'funding round': 4, 'venture capital': 4, 'ipo': 4,
      'profit': 3, 'revenue': 3, 'earnings': 3, 'layoff': 3, 'redundancy': 3,
      'xbox pitches': 3, 'gaming ip': 2,
    },
  },

  // Medicine, hospitals, disease, wellbeing, drugs
  Health: {
    weight: 1,
    keywords: {
      health: 3, medical: 4, medicine: 4, hospital: 3, 'emergency room': 4,
      'er units': 4, 'geriatric': 4, 'geriatric emergency': 5, 'patient': 3,
      disease: 3, 'disease outbreak': 4, 'cancer': 3, 'diabetes': 4,
      'vaccine': 4, 'vaccination': 4, 'drug trial': 4, 'clinical trial': 4,
      'nhs': 4, 'gp surgery': 4, 'waiting list': 3, 'mental health': 4,
      'wellbeing': 3, 'diet': 2, 'weight loss': 3, 'starved': 2,
      'fit club': 3, 'prescription': 3, 'pharmacy': 3, 'metformin': 4,
      'cartilage repair': 4, 'traumatic brain injury': 5, 'th17 cells': 5,
      'medical research': 4, 'treatment': 2, 'therapy': 3, 'surgery': 3,
    },
  },

  // Research, space, discoveries, academic studies
  Science: {
    weight: 1,
    keywords: {
      science: 3, scientific: 3, research: 3, 'research paper': 4, study: 2,
      'study finds': 4, 'researchers': 3, 'university': 2, 'academic': 3,
      'peer-reviewed': 4, 'journal': 3, 'nature': 2, 'science journal': 4,
      space: 3, 'nasa': 4, 'esa': 4, 'spacecraft': 4, 'satellite': 3,
      'mars': 3, 'moon': 3, 'telescope': 4, 'exoplanet': 5, 'black hole': 4,
      'quantum': 4, 'particle': 4, 'physics': 3, 'chemistry': 3, 'biology': 3,
      'genetics': 4, 'dna': 3, 'genome': 4, 'fossil': 4, 'archaeology': 4,
      'discovery': 2, 'breakthrough': 2, 'experiment': 3, 'laboratory': 3,
    },
  },

  // Climate, wildlife, pollution, natural world
  Environment: {
    weight: 1,
    keywords: {
      environment: 3, environmental: 3, climate: 4, 'climate change': 5,
      'global warming': 5, 'carbon': 3, 'emissions': 4, 'net zero': 4,
      'greenhouse': 4, 'pollution': 4, 'air quality': 4, 'water quality': 3,
      wildlife: 4, 'endangered species': 5, 'habitat': 3, 'biodiversity': 4,
      'deforestation': 5, 'wildfire': 4, 'wildfires': 4, 'bushfire': 4,
      'flooding': 3, 'flood': 3, 'drought': 4, 'hurricane': 4, 'storm': 2,
      'natural disaster': 4, 'disaster': 2, 'dam burst': 4, 'lake': 1,
      'glacier': 4, 'ice cap': 4, 'ocean': 2, 'reef': 4, 'coral': 4,
      'recycling': 3, 'plastic waste': 4, 'conservation': 4, 'rspb': 4,
      'national trust': 3, 'nature reserve': 4,
    },
  },

  // Hardware, software, AI, processors, tech industry (NOT gaming)
  Technology: {
    weight: 1,
    keywords: {
      technology: 3, tech: 3, 'ai': 3, 'artificial intelligence': 5,
      'machine learning': 5, 'llm': 4, 'chatgpt': 4, 'openai': 4,
      'software': 3, 'app': 2, 'algorithm': 3, 'cybersecurity': 4,
      'cyber attack': 4, 'data breach': 4, 'hacking': 3, 'ransomware': 4,
      'processor': 4, 'chip': 3, 'cpu': 4, 'gpu': 3, 'semiconductor': 5,
      'intel': 3, 'amd': 3, 'nvidia': 3, 'arm': 3, 'tsmc': 4,
      'smartphone': 3, 'iphone': 3, 'android': 3, 'ios': 2,
      'broadband': 3, '5g': 3, 'fiber': 2, 'cloud computing': 4,
      'saas': 3, 'api': 2, 'open source': 3, 'github': 3,
      'tech industry': 4, 'big tech': 4, 'silicon valley': 4,
      'lead classification': 3, 'form tool': 3, 'crm': 3,
    },
  },

  // Cars, EVs, transport, vehicle reviews
  Motoring: {
    weight: 1,
    keywords: {
      car: 3, cars: 3, 'car review': 5, 'road test': 5, 'test drive': 4,
      'electric vehicle': 5, 'ev': 3, 'tesla': 3, 'charging point': 4,
      'hybrid': 3, 'diesel': 2, 'petrol': 2, 'mpg': 4, 'fuel economy': 4,
      'pickup': 3, 'pickup truck': 4, 'musso rhino': 5, 'kgm': 4,
      'ford mustang': 4, 'luca serafini': 5, 'car launch': 4,
      'motor show': 4, 'geneva motor show': 5, 'auto show': 4,
      'driving': 2, 'motoring': 4, 'highway': 2, 'transport': 2,
      'driving licence': 4, 'speed limit': 3, 'car tax': 4, 'ulez': 4,
    },
  },

  // Power generation, oil, gas, renewables, energy policy
  Energy: {
    weight: 1,
    keywords: {
      energy: 3, 'energy project': 4, 'power plant': 5, 'gas plant': 5,
      'natural gas': 4, 'gas plant approval': 5, '500 mw': 5, 'megawatt': 5,
      'mw gas': 5, 'green light': 2, 'conditional approval': 3,
      'oil': 3, 'oil field': 4, 'oil spill': 5, 'pipeline': 4,
      'renewable': 4, 'renewables': 4, 'solar': 3, 'wind farm': 5,
      'wind turbine': 4, 'nuclear': 4, 'nuclear plant': 5, 'reactor': 4,
      'coal': 3, 'coal mine': 4, 'fracking': 5, 'carbon capture': 4,
      'energy secretary': 3, 'energy policy': 4, 'grid capacity': 4,
      'national grid': 4, 'power station': 5, 'electricity': 3,
      'new brunswick government': 2, 'fredericton': 2, 'brunswick': 2,
    },
  },

  // International news that doesn't fit a specific category
  World: {
    weight: 0.5, // lower weight — only used when nothing else matches well
    keywords: {
      'nepal': 2, 'nepali': 2, 'nepal-china': 3, 'china': 1, 'tibet': 3,
      'border disaster': 3, 'death toll': 2, 'dam': 1, 'flood threat': 2,
      'fresh alert': 2, 'lake pours': 2, 'community': 1, 'disaster': 1,
      'russia': 2, 'ukraine': 3, 'gaza': 3, 'israel': 2, 'palestine': 3,
      'iran': 2, 'saudi': 2, 'afghanistan': 3, 'kabul': 3, 'syria': 3,
      'sudan': 3, 'yemen': 3, 'myanmar': 3, 'rohingya': 4,
      'united nations': 3, 'un security council': 4, 'humanitarian': 3,
      'refugee': 3, 'asylum': 3, 'sanctions': 3, 'diplomatic': 2,
    },
  },

  // Hyperlocal community news — planning, schools, local council
  Local: {
    weight: 1,
    keywords: {
      'townhouse': 2, 'property maintenance': 4, 'overgrown grass': 4,
      'trash disposal': 4, 'rubbish': 3, 'compliance': 2, 'ticket': 2,
      'neglected property': 4, 'proposed fine': 3, 'homeowner': 3,
      'upper darby': 3, 'camden': 3, 'high school uniform': 3,
      'dress code': 2, 'compulsory uniform': 3, 'durag': 3, 'bonnet': 3,
      'hair rollers': 3, 'pajama': 3, 'varied attire': 2,
      'local council': 4, 'council': 2, 'planning permission': 4,
      'planning application': 4, 'zoning': 3, 'development proposal': 3,
      'community centre': 4, 'library closure': 4, 'bus route': 3,
      'school uniform': 3, 'school policy': 3, 'local school': 3,
      'neighborhood': 2, 'neighbourhood': 2, 'residents': 2,
    },
  },

  // Quirky, unusual, offbeat news
  'Odd News': {
    weight: 0.8,
    keywords: {
      'prankster': 4, 'prank': 3, 'pizza deliveries': 4, 'pizza hoax': 5,
      'eight-year prison': 3, 'lizard smuggling': 4, '116 lizards': 5,
      'russian border': 2, 'tampon-throw': 4, 'alaia baldwin': 3,
      'odd': 2, 'bizarre': 3, 'unusual': 2, 'weird': 3, 'quirky': 4,
      'guinness world record': 5, 'world record': 3, 'stunt': 3,
    },
  },
};

// Classify a cluster into a category using the keyword graph.
// Returns { category, score, matchedKeywords }
export function classifyCategory(cluster) {
  const text = [
    cluster.headline || '',
    cluster.summary || '',
    ...(cluster.tags || []),
    ...(cluster.triggerWords || []),
    ...(cluster.stories || []).slice(0, 3).map(s => s.title || s.originalTitle || ''),
  ].join(' ').toLowerCase();

  const scores = {};
  const matched = {};

  for (const [category, def] of Object.entries(CATEGORY_GRAPH)) {
    let score = 0;
    const matches = [];
    for (const [keyword, weight] of Object.entries(def.keywords)) {
      // Use word boundary matching for short keywords, substring for longer
      const pattern = keyword.length <= 3
        ? new RegExp(`\\b${keyword}\\b`, 'i')
        : new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (pattern.test(text)) {
        score += weight * def.weight;
        matches.push(keyword);
      }
    }
    if (score > 0) {
      scores[category] = score;
      matched[category] = matches;
    }
  }

  // Find the best category
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0 || sorted[0][1] < 2) {
    return { category: null, score: 0, matchedKeywords: [] };
  }

  const [category, score] = sorted[0];
  return { category, score, matchedKeywords: matched[category] };
}

// Recategorise a cluster if the keyword graph strongly disagrees with the
// LLM's category. Only override when the keyword graph score is confident
// (>= 5) and points to a different category than the LLM chose.
export function recategoriseCluster(cluster) {
  const result = classifyCategory(cluster);
  if (result.score < 5 || !result.category) return false;

  const current = Array.isArray(cluster.category)
    ? cluster.category[0]
    : cluster.category || '';
  const currentLower = current.toLowerCase();

  // Map old categories to new ones for comparison
  const currentNormalised = currentLower === 'entertainment' ? 'celebrity' : currentLower;

  if (result.category.toLowerCase() !== currentNormalised) {
    cluster.category = result.category;
    return true;
  }
  return false;
}

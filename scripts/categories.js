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
//
// Design principles:
//   - Use GENERAL pattern keywords, not specific names (no "makai lemon")
//   - Weight by discriminative power: "console" is more discriminative than "game"
//   - Order matters: more specific categories checked before broader ones
//   - Every keyword should be a word that would rarely appear in a non-matching story

// Category definitions: keyword -> weight (higher = stronger indicator)
const CATEGORY_GRAPH = {
  // Video games, consoles, game industry, esports
  Gaming: {
    weight: 1,
    keywords: {
      // Core gaming terms (high discriminative power)
      gaming: 5, gameplay: 5, console: 4, xbox: 5, playstation: 5, ps5: 5,
      ps4: 4, nintendo: 5, steam: 4, esports: 5, mmorpg: 5, 'video game': 5,
      'game developer': 4, 'game studio': 4, 'game release': 4, 'game pass': 5,
      'game industry': 4, dlc: 4, 'beta test': 3, 'open world': 3,
      'frame rate': 3, '60fps': 4, '30fps': 4, 'first-person': 3,
      'role-playing': 3, 'trailer reveal': 4, 'gameplay trailer': 5,
      // Game franchises/studios (strong indicators)
      gta: 5, 'grand theft auto': 5, rockstar: 5, sega: 4, capcom: 4,
      fromsoftware: 4, obsidian: 4, bethesda: 4, ubisoft: 4, blizzard: 4,
      valve: 3, gamescom: 5, 'e3 ': 4, 'game preview': 4,
      'witcher': 3, 'pokemon': 4, 'overwatch': 4, 'star citizen': 4,
      'path of exile': 5, 'gears of war': 5, 'diablo': 4, 'tamagotchi': 4,
      'dlss': 3, 'disc-to-digital': 4, 'physical disc': 3,
      // Generic "game" is weaker — appears in sports too
      game: 1, games: 1,
    },
  },

  // All sports — football, cricket, rugby, tennis, cycling, racing, etc.
  Sport: {
    weight: 1,
    keywords: {
      // Core sport terms
      sport: 4, sports: 4, football: 5, soccer: 5, cricket: 5, rugby: 5,
      tennis: 5, cycling: 4, olympic: 5, olympics: 5, athlete: 4,
      tournament: 4, championship: 4, league: 3, match: 3,
      // Specific leagues/teams (strong indicators)
      'premier league': 5, 'la liga': 5, 'serie a': 5, 'bundesliga': 5,
      nfl: 5, mlb: 5, nba: 4, pga: 5, 'ryder cup': 5, 'world cup': 5,
      'eagles': 3, 'phillies': 3, 'galatasaray': 3, 'aston villa': 3,
      'al nassr': 3, 'chelsea': 3, 'bournemouth': 3, 'sunderland': 3,
      'celtic': 3, 'rangers': 3, 'ac milan': 4, 'barca': 3,
      // Sport-specific terms
      quarterback: 5, touchdown: 5, pitcher: 5, baseball: 5, 'wide receiver': 5,
      'training camp': 4, preseason: 4, 'draft pick': 5, 'playoff': 4,
      'wild-card': 4, 'wild card': 4, 'play-offs': 4, 'playoffs': 4,
      transfer: 3, 'transfer window': 5, jockey: 5, 'horse racing': 5,
      'race meeting': 4, 'races cancelled': 4, golf: 3, 'cycling classic': 5,
      'manayunk wall': 4, 'ben franklin parkway': 3, 'philly cycling': 5,
      'roster': 3, '53-man': 5, 'preseason': 4, 'manager': 2,
      'coach': 2, 'striker': 4, 'winger': 4, 'midfielder': 4, 'defender': 4,
      'goalkeeper': 5, 'bat': 2, 'bowler': 3, 'wicket': 4, 'innings': 4,
      'set point': 5, 'match point': 5, 'grand slam': 4,
    },
  },

  // Celebrity gossip, entertainment personalities, film/TV/music stars
  Celebrity: {
    weight: 1,
    keywords: {
      celebrity: 5, celebrities: 5, 'film star': 4, 'tv personality': 4,
      influencer: 4, 'social media trend': 3, 'instagram food trend': 4,
      'tiktok trend': 4, selfie: 3, 'red carpet': 5, 'award ceremony': 4,
      bafta: 5, oscar: 5, grammy: 5, 'brit award': 5, emmy: 5,
      'box office': 3, 'film premiere': 4, 'knighthood': 3,
      'celebrity fit club': 5, 'weight loss show': 4,
      // Gossip indicators
      'nude': 2, 'burnout': 1, 'relationship': 2, 'divorce': 3,
      'breakup': 3, 'engagement': 2, 'wedding ceremony': 2,
      'comedian': 4, 'actor': 3, 'actress': 4, 'singer': 3, 'musician': 3,
    },
  },

  // Film, TV, music, books, festivals, arts — the work itself, not gossip
  Entertainment: {
    weight: 1,
    keywords: {
      // Film/TV
      film: 3, 'film review': 5, movie: 3, 'movie review': 5, cinema: 4,
      'box office': 4, 'film premiere': 4, 'film festival': 5, 'tv series': 4,
      'tv show': 4, 'season finale': 5, 'hbo': 4, 'netflix': 3, 'streaming': 3,
      'documentary': 4, 'sitcom': 5, 'drama series': 4, 'cast member': 3,
      'harry potter': 3, 'the odyssey': 3, 'spider-man': 3,
      // Music
      music: 3, 'music festival': 5, 'festival lineup': 5, 'reading festival': 5,
      'leeds festival': 5, 'reading & leeds': 5, concert: 4, 'live music': 4,
      album: 3, 'album release': 4, 'single release': 4, 'tour dates': 4,
      // Arts/culture
      'art exhibition': 5, 'art gallery': 5, museum: 3, 'book review': 5,
      'novel release': 4, 'book launch': 4, theatre: 3, 'stage show': 4,
      'comedy show': 4, 'stand-up': 4, comedian: 3,
      // Odeon/cinema chain
      odeon: 4, 'cinema chain': 4, 'best summer': 2,
    },
  },

  // Government, elections, policy, parliament, politicians
  Politics: {
    weight: 1,
    keywords: {
      politics: 5, political: 4, election: 5, government: 3, parliament: 5,
      minister: 4, 'prime minister': 5, cabinet: 5, 'member of parliament': 5,
      'secretary of state': 5, 'energy secretary': 4, policy: 3,
      legislation: 4, 'downing street': 5, whitehall: 5, westminster: 5,
      labour: 3, conservative: 3, tories: 3, 'lib dem': 3, snp: 3,
      'by-election': 5, 'local election': 5, 'general election': 5,
      'mail-in': 4, 'postal service': 3, 'voting rights': 5, voter: 4,
      'mail-in vote': 5, 'restrict mail': 4, 'district judge': 3,
      'white house': 4, 'trump': 2, 'congress': 3, 'senate': 4,
      'governor': 3, 'mayor': 2, 'council leader': 3,
      'budget': 2, 'fiscal': 3, 'treasury': 3, 'chancellor': 4,
      'reform': 2, 'policy change': 4, 'government policy': 4,
      'icac': 4, 'corruption probe': 4, 'hidden payments': 3,
      'political hit': 3, 'perrottet': 3,
    },
  },

  // Crime, courts, policing, justice system
  Crime: {
    weight: 1,
    keywords: {
      crime: 5, criminal: 4, arrest: 4, charged: 3, 'guilty plea': 5,
      'pleads guilty': 5, prison: 4, jail: 4, sentenced: 5, sentence: 4,
      court: 3, 'court case': 4, judge: 2, magistrate: 5, trial: 5,
      hearing: 3, police: 2, investigation: 2, probe: 2, detective: 4,
      'leaking': 3, 'classified': 3, 'state secrets': 4, espionage: 5,
      'arrested': 5, prosecutor: 5, prosecution: 4, defendant: 4,
      indicted: 5, fraud: 5, theft: 4, assault: 4, 'arson attack': 5,
      'smuggling': 5, 'lizard smuggling': 4, 'illegal arms': 5,
      'vandalism': 4, 'tampon-throw': 4, 'pizza deliveries': 3,
      'prankster': 3, 'prank': 2, 'faces jail': 5, 'faces prison': 5,
      'eight-year': 2, 'serial rapist': 5, rapist: 5, 'vetting': 3,
      'violence against women': 4, 'drug gangs': 4, 'shootings surge': 4,
      'settles lawsuit': 3, 'lawsuit': 3, 'painkiller prescriptions': 3,
      'walmart settles': 3, 'refusing to pay': 2,
    },
  },

  // Companies, finance, markets, trade, deals
  Business: {
    weight: 1,
    keywords: {
      business: 4, company: 3, companies: 3, corporate: 4, corporation: 4,
      finance: 4, financial: 3, 'stock market': 5, shares: 4, 'share price': 5,
      merger: 5, acquisition: 5, takeover: 5, 'deal worth': 4,
      'licensing': 4, 'ip bundle': 4, 'hollywood deals': 3,
      'movie adaptation': 3, 'tv adaptation': 3, trade: 3, tariff: 4,
      economy: 3, recession: 5, inflation: 4, 'interest rate': 5,
      'federal reserve': 4, 'fed will': 3, 'central bank': 4,
      startup: 4, 'funding round': 5, 'venture capital': 5, ipo: 5,
      profit: 4, revenue: 4, earnings: 4, layoff: 4, redundancy: 4,
      'paypal shares': 4, 'stripe-advent': 4, 'collapse of': 2,
      'scale-up fund': 3, 'venture heavyweights': 3,
      'crypto firm': 4, 'stablecoin': 4, 'usd.ai': 3, 'bullish invests': 3,
      'circle': 2, 'shirt sponsor': 3, 'affirm': 2, 'shopify': 2,
      'installments payments': 3, 'business moguls': 3,
    },
  },

  // Personal finance, consumer money, savings, mortgages, pensions
  'Personal Finance': {
    weight: 1,
    keywords: {
      'current account': 5, 'regular saver': 5, 'savings rate': 5,
      'savings account': 5, mortgage: 5, 'mortgage rate': 5,
      'house purchase': 5, 'home buyer': 5, 'homebuyer': 5, 'home purchase': 5,
      'townhouse': 2, 'first-time buyer': 5,
      'rental': 3, rent: 2, 'renting crisis': 5, 'retirement crisis': 5,
      'pension': 4, 'pension pot': 5, 'retirement': 3,
      'fuel prices': 4, 'petrol prices': 5, 'gas prices': 3,
      'cost of': 2, 'cost of living': 4, 'inflation': 2,
      'shopping addiction': 4, 'spending': 2, '£700 a month': 3,
      'money podcast': 4, 'this is money': 3, 'how does it compare': 3,
      'biscuit current account': 4, 'zopa': 3, 'savings': 3,
      'bank holiday': 2, 'getaway': 2, 'drivers': 2,
      'price hike': 3, 'price increase': 3, 'gas prices': 3,
      'energy bills': 3, 'energy prices': 4, 'sse airtricity': 4,
      'price comparison': 4, 'best buy': 2, 'worth your money': 3,
    },
  },

  // Medicine, hospitals, disease, wellbeing, drugs
  Health: {
    weight: 1,
    keywords: {
      health: 4, medical: 4, medicine: 4, hospital: 3, 'emergency room': 5,
      'er units': 5, geriatric: 5, 'geriatric emergency': 5, patient: 4,
      disease: 4, 'disease outbreak': 5, cancer: 4, diabetes: 4,
      vaccine: 5, vaccination: 5, 'drug trial': 5, 'clinical trial': 5,
      nhs: 5, 'gp surgery': 5, 'waiting list': 4, 'mental health': 5,
      wellbeing: 4, 'adhd': 5, autism: 5, 'autism care': 5,
      'prescription': 4, pharmacy: 4, 'metformin': 5,
      'cartilage repair': 5, 'brain injury': 5, 'medical research': 4,
      treatment: 3, therapy: 4, surgery: 3, 'hypermobility': 5,
      'bendy disease': 5, 'fatigue': 3, 'chronic pain': 4,
      'battery fires': 3, 'e-bike': 3, 'hidden danger': 2,
      'sweetener': 4, 'chewing gum': 3, 'strokes': 3, 'heart attacks': 3,
      'measles': 4, 'vaccine misinformation': 5, 'rfk': 3,
      'painkiller': 3, 'walmart settles': 2,
    },
  },

  // Research, space, discoveries, academic studies
  Science: {
    weight: 1,
    keywords: {
      science: 4, scientific: 4, research: 3, 'research paper': 5,
      study: 3, 'study finds': 4, researchers: 4, university: 3,
      academic: 4, 'peer-reviewed': 5, journal: 4, 'science journal': 5,
      space: 3, nasa: 5, esa: 5, spacecraft: 5, satellite: 4,
      mars: 4, moon: 3, telescope: 5, 'space telescope': 5,
      exoplanet: 5, 'black hole': 5, 'blood moon': 4, 'lunar eclipse': 5,
      'star at the centre': 3, 'fastest star': 4, 'galaxy': 3,
      quantum: 5, particle: 5, physics: 4, chemistry: 3, biology: 3,
      genetics: 5, dna: 4, genome: 5, fossil: 5, archaeology: 5,
      '520-million-year': 4, 'apex predator': 3, 'fang wound': 4,
      discovery: 3, breakthrough: 3, experiment: 4, laboratory: 4,
      'magnetic field': 4, superconductor: 5, 'brain injuries': 2,
    },
  },

  // Climate, wildlife, pollution, natural world
  Environment: {
    weight: 1,
    keywords: {
      environment: 4, environmental: 4, climate: 5, 'climate change': 5,
      'global warming': 5, carbon: 4, emissions: 5, 'net zero': 5,
      greenhouse: 5, pollution: 5, 'air quality': 5, 'water quality': 4,
      wildlife: 5, 'endangered species': 5, habitat: 4, biodiversity: 5,
      deforestation: 5, wildfire: 5, wildfires: 5, bushfire: 5,
      'forest protections': 4, 'extinction': 5, '400 endangered': 4,
      'drought': 4, 'hurricane': 4, 'tropical storm': 4,
      'storm dolly': 3, 'caribbean': 2,
      'reef': 5, coral: 5, 'plastic waste': 5,
      recycling: 4, conservation: 5, 'national trust': 3,
      'nature reserve': 5, 'gps collars': 3, shepherds: 2,
      'meat imports': 3, 'brazilian meat': 3, 'health concerns': 2,
      'cattle ranchers': 3, 'beef imports': 3, 'food safety': 2,
    },
  },

  // Hardware, software, AI, processors, tech industry (NOT gaming)
  Technology: {
    weight: 1,
    keywords: {
      technology: 4, tech: 3, 'artificial intelligence': 5,
      'machine learning': 5, llm: 5, chatgpt: 5, openai: 5,
      'ai slop': 4, 'ai filter': 4, 'dlss': 3, 'nvidia': 3,
      software: 4, algorithm: 4, cybersecurity: 5, 'cyber attack': 5,
      'data breach': 5, hacking: 4, ransomware: 5,
      processor: 5, chip: 4, cpu: 5, gpu: 4, semiconductor: 5,
      intel: 4, amd: 3, arm: 4, tsmc: 5,
      smartphone: 4, iphone: 4, android: 4, ios: 3,
      broadband: 4, '5g': 4, fiber: 3, 'cloud computing': 5,
      'data center': 3, 'datacenter': 3, 'noise pollution': 2,
      'tech industry': 5, 'big tech': 5, 'silicon valley': 5,
      'open source': 4, github: 4, 'tech moguls': 3,
      'digital platform': 3, 'tg-ipass': 3, 'digital approvals': 3,
    },
  },

  // Cars, EVs, transport, vehicle reviews
  Motoring: {
    weight: 1,
    keywords: {
      car: 3, cars: 3, 'car review': 5, 'road test': 5, 'test drive': 5,
      'electric vehicle': 5, 'ev ': 3, 'charging point': 5,
      hybrid: 4, diesel: 3, petrol: 3, mpg: 5, 'fuel economy': 5,
      pickup: 4, 'pickup truck': 5, 'musso rhino': 5, kgm: 5,
      'beast in class': 4, 'car launch': 5,
      'motor show': 5, 'geneva motor show': 5, 'auto show': 5,
      driving: 3, motoring: 5, 'driving licence': 5,
      'speed limit': 4, 'car tax': 5, ulez: 5,
      'number plates': 4, 'banned plates': 4, 'too rude': 3,
      'chinese cars': 4, 'range and price': 3,
      'rollercoaster': 3, 'six flags': 3, 'brain injuries': 2,
    },
  },

  // Power generation, oil, gas, renewables, energy policy
  Energy: {
    weight: 1,
    keywords: {
      energy: 4, 'energy project': 5, 'power plant': 5, 'gas plant': 5,
      'natural gas': 5, 'gas plant approval': 5, '500 mw': 5, megawatt: 5,
      'mw gas': 5, 'green light': 2, 'conditional approval': 3,
      oil: 3, 'oil field': 5, 'oil spill': 5, pipeline: 5,
      renewable: 5, renewables: 5, solar: 4, 'wind farm': 5,
      'wind turbine': 5, nuclear: 5, 'nuclear plant': 5, reactor: 5,
      coal: 4, 'coal mine': 5, fracking: 5, 'carbon capture': 5,
      'energy policy': 5, 'grid capacity': 5, 'national grid': 5,
      'power station': 5, electricity: 4, 'hydropower': 5,
      'gas to electric': 4, 'switching from gas': 3, 'chefs turning': 2,
    },
  },

  // Disasters, accidents, emergencies — floods, earthquakes, crashes
  Disaster: {
    weight: 1,
    keywords: {
      disaster: 4, 'flash flood': 5, 'flash floods': 5, flooding: 4,
      flood: 4, 'flood threat': 5, 'death toll': 4, 'dam burst': 5,
      'barrier lake': 5, 'hydropower tunnel': 5, 'rescued from': 3,
      'rescue efforts': 4, 'rescuers': 3, 'nepal-tibet': 4,
      'nepal army': 4, 'missing in nepal': 5, 'british nationals missing': 5,
      'red cross': 3, 'great need': 3, 'devastation': 4,
      earthquake: 5, 'tsunami': 5, 'volcanic': 5, eruption: 5,
      'car crash': 4, 'a66': 3, 'balloon release': 2, 'died in': 3,
      'bridge': 2, 'jumping from': 3, 'man rescued': 3,
      'water outage': 4, 'main burst': 3, 'gatwick': 2,
      'crash': 2, 'accident': 3, 'emergency': 3,
    },
  },

  // Military, defence, armed forces, security
  Defence: {
    weight: 1,
    keywords: {
      military: 5, defence: 5, defense: 5, 'armed forces': 5,
      'army chief': 5, 'defence college': 5, soldiers: 5, troops: 5,
      'paragliders': 4, 'enemy lines': 4, 'combat': 4, 'weapon': 3,
      'missile': 4, 'airstrike': 5, 'drone strike': 5, 'special forces': 5,
      'air force': 5, 'navy': 4, 'infantry': 5, 'battalion': 5,
      'nato': 4, 'allied': 3, 'military operation': 5,
      'field marshal': 5, 'asim munir': 3, 'ghq': 3,
      'illegal arms': 3, 'weapons': 3, 'intercept': 3,
      'security': 2, 'intelligence': 2, 'dia': 3,
    },
  },

  // International news — conflicts, diplomacy, foreign affairs
  World: {
    weight: 0.5, // lower weight — only used when nothing else matches well
    keywords: {
      'united nations': 4, 'un security council': 5, humanitarian: 4,
      refugee: 4, asylum: 4, sanctions: 4, diplomatic: 3, diplomacy: 3,
      'embassy': 4, 'ambassador': 4, 'treaty': 4,
      // Conflict zones
      'israeli settler': 4, 'occupied west bank': 5, 'gaza': 4,
      'israel': 2, 'palestine': 3, 'iran': 2, 'saudi': 2,
      'afghanistan': 3, 'kabul': 3, 'syria': 3, 'sudan': 3, 'yemen': 3,
      'myanmar': 3, 'rohingya': 4, 'nigeria': 2, 'anambra': 3,
      'lagos': 2, 'ekiti': 3, 'oyo': 2, 'india': 2,
      // Country-specific (lower weight)
      'nepal': 2, 'nepali': 2, 'china': 1, 'tibet': 3,
      'russia': 2, 'ukraine': 3, 'norway': 2, 'oslo': 2,
      'vienna': 2, 'brussels': 2, 'louisiana': 2, 'detroit': 2,
    },
  },

  // Hyperlocal community news — planning, schools, local council
  Local: {
    weight: 1,
    keywords: {
      'local council': 5, council: 3, 'planning permission': 5,
      'planning application': 5, zoning: 4, 'development proposal': 4,
      'community centre': 5, 'library closure': 5, 'bus route': 4,
      'school uniform': 4, 'school policy': 4, 'local school': 4,
      'dress code': 3, 'compulsory uniform': 4, durag: 3, bonnet: 3,
      'hair rollers': 3, pajama: 3, 'varied attire': 2,
      'high school': 3, 'high schools': 3,
      'property maintenance': 5, 'overgrown grass': 5, 'trash disposal': 5,
      'rubbish': 3, 'neglected property': 5, 'proposed fine': 4,
      'homeowner': 4, 'compliance': 3, 'improper trash': 4,
      'waste disposal': 4, 'waste fees': 3, 'refusing to pay': 2,
      'upper darby': 4, 'camden': 3, 'philadelphia': 2,
      'neighborhood': 3, 'neighbourhood': 3, 'residents': 3,
    },
  },

  // Education — schools, universities, curriculum, student news
  Education: {
    weight: 1,
    keywords: {
      education: 4, school: 3, schools: 3, university: 3, universities: 4,
      student: 3, students: 3, 'student prize': 5, 'proficiency prize': 5,
      teacher: 4, curriculum: 5, 'exam results': 5, 'gcse': 5, 'a-level': 5,
      'school uniform': 3, 'dress code': 2, 'high school': 3,
      'private school': 4, 'school choice': 4, 'academy': 3,
      'head teacher': 5, 'headteacher': 5, 'ofsted': 5,
      'university place': 4, 'university admission': 5, 'clearing': 3,
      'lecture': 3, 'seminar': 3, 'graduation': 4, 'degree': 3,
      'scholarship': 5, 'bursary': 5, 'tuition fee': 5,
      'chinese proficiency': 4, 'global prize': 3,
    },
  },

  // Royal family, monarchy, aristocracy
  Royal: {
    weight: 1,
    keywords: {
      royal: 4, monarchy: 5, monarch: 5, 'king haakon': 5, 'norway\'s king': 5,
      'queen': 3, 'prince': 3, 'princess': 3, 'duke': 4, 'duchess': 4,
      'coronation': 5, 'abdicate': 5, 'abdication': 5, 'reign': 4,
      'succession': 4, 'throne': 4, 'royal family': 5,
      'traditional monarch': 5, 'youngest reigning': 4,
      'wedding ceremony': 2, 'calls off wedding': 3,
      'knighthood': 3, 'accept knighthood': 4,
    },
  },

  // Quirky, unusual, offbeat news
  'Odd News': {
    weight: 0.8,
    keywords: {
      'prankster': 4, 'prank': 3, 'pizza deliveries': 4, 'pizza hoax': 5,
      'lizard smuggling': 4, '116 lizards': 5, 'tampon-throw': 4,
      'guinness world record': 5, 'world record': 4, 'stunt': 4,
      'alligator hunt': 4, 'recreational alligator': 5,
      'bizarre': 3, 'quirky': 5, 'weird': 3, 'unusual': 2,
      'banned plates': 3, 'too rude': 3, 'offensive': 2,
    },
  },
};

// Classify a cluster into a category using the keyword graph.
// Returns { category, score, matchedKeywords }
export function classifyCategory(cluster) {
  // Build the text to match against. We include headline, summary, tags,
  // trigger words, and story titles — but we EXCLUDE the LLM's own category
  // label from tags, because the LLM's category is what we're trying to
  // override. If we matched "technology" as a tag on a cluster the LLM
  // labelled Technology, we'd just be reinforcing the LLM's choice.
  const llmCategory = (Array.isArray(cluster.category) ? cluster.category[0] : cluster.category || '').toLowerCase();
  const tags = (cluster.tags || []).filter(t => t.toLowerCase() !== llmCategory);

  const text = [
    cluster.headline || '',
    cluster.summary || '',
    ...tags,
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
// If the graph agrees with the LLM, we just normalise the casing (e.g.
// "sports" -> "Sport") even at a lower score.
export function recategoriseCluster(cluster) {
  const result = classifyCategory(cluster);
  if (!result.category) return false;

  const current = Array.isArray(cluster.category)
    ? cluster.category[0]
    : cluster.category || '';
  const currentLower = current.toLowerCase();

  // Map old categories to new ones for comparison.
  // Handle common singular/plural mismatches (sports -> sport).
  const pluralMap = { 'sports': 'sport', 'entertainment': 'celebrity' };
  const currentNormalised = pluralMap[currentLower] || currentLower;

  if (result.category.toLowerCase() === currentNormalised) {
    // Graph agrees with LLM — just normalise casing
    if (cluster.category !== result.category) {
      cluster.category = result.category;
      return true;
    }
    return false;
  }

  // Graph disagrees — only override if confident
  if (result.score >= 5) {
    cluster.category = result.category;
    return true;
  }
  return false;
}

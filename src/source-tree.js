// Curated source-relation tree for the header source bar.
//
// These branches describe useful source properties — shared brand, publisher,
// public service, wire/press-release pipe, specialist beat, regional media —
// rather than legal ownership claims. A source may be listed under more than
// one relation. The allocator claims each host once, in tree order, so the UI
// still renders disjoint branches.

export const SOURCE_RELATION_TREE = [
  {
    id: 'public-international',
    label: 'Public & International',
    icon: 'bbc.co.uk',
    children: [
      {
        id: 'bbc',
        label: 'BBC',
        icon: 'bbc.co.uk',
        sources: ['bbc.co.uk', 'bbc.com', 'bbc.in', 'bbci.co.uk'],
      },
      {
        id: 'uk-public-media',
        label: 'UK Public Media',
        icon: 'itv.com',
        sources: ['itv.com', 'channel4.com', 's4c.cymru', 'stv.tv'],
      },
      {
        id: 'north-america-public-media',
        label: 'North America Public',
        icon: 'pbs.org',
        sources: [
          'pbs.org', 'npr.org', 'opb.org', 'wnyc.org', 'wbez.org',
          'wfyi.org', 'wgbh.org', 'kqed.org', 'cbc.ca', 'radio-canada.ca',
        ],
      },
      {
        id: 'australasia-public-media',
        label: 'Australia & NZ Public',
        icon: 'abc.net.au',
        sources: ['abc.net.au', 'sbs.com.au', 'rnz.co.nz', 'tvnz.co.nz', 'newsroom.co.nz'],
      },
      {
        id: 'european-public-media',
        label: 'European Public',
        icon: 'dw.com',
        sources: [
          'dw.com', 'france24.com', 'rfi.fr', 'rte.ie', 'yle.fi', 'nrk.no',
          'sverigesradio.se', 'svt.se', 'dr.dk', 'rtve.es', 'rai.it', 'orf.at',
          'vrt.be', 'nos.nl', 'err.ee', 'lrt.lt', 'lsm.lv', 'swissinfo.ch',
        ],
      },
      {
        id: 'international-public-media',
        label: 'International Public',
        icon: 'aljazeera.com',
        sources: [
          'aljazeera.com', 'trtworld.com', 'aa.com.tr', 'news.cgtn.com', 'cgtn.com',
          'uatv.ua', 'eng.belta.by', 'tass.com', 'rt-english.com', 'prensa-latina.cu',
        ],
      },
    ],
  },
  {
    id: 'specialist-press',
    label: 'Specialist Press',
    icon: 'eurogamer.net',
    children: [
      {
        id: 'gaming-press',
        label: 'Gaming Press',
        icon: 'eurogamer.net',
        children: [
          {
            id: 'gaming-press-major',
            label: 'Major Gaming Outlets',
            icon: 'eurogamer.net',
            children: [
              { id: 'eurogamer', label: 'Eurogamer', icon: 'eurogamer.net', sources: ['eurogamer.net'] },
              { id: 'kotaku', label: 'Kotaku', icon: 'kotaku.com', sources: ['kotaku.com'] },
              { id: 'ign', label: 'IGN', icon: 'ign.com', sources: ['ign.com'] },
            ],
          },
          {
            id: 'gaming-press-networks',
            label: 'Gaming Networks',
            icon: 'gamespot.com',
            sources: [
              'gamespot.com', 'pcgamer.com', 'gamesradar.com', 'polygon.com',
              'vg247.com', 'gamerant.com', 'thegamer.com', 'gamepur.com',
              'dualshockers.com', 'destructoid.com', 'nintendolife.com',
              'rockpapershotgun.com', 'pcgamesn.com', 'gamesbeat.com',
              'adventuregamers.com', 'pokde.net', 'yugatech.com', 'pushsquare.com',
              'nintendoeverything.com', 'gameinformer.com', 'gamesindustry.biz',
              'rpgfan.com', 'gematsu.com', 'nintendoworldreport.com',
            ],
          },
          {
            id: 'gaming-platforms',
            label: 'Gaming Platforms',
            icon: 'news.xbox.com',
            sources: ['news.xbox.com', 'xbox.com', 'playstation.com', 'blog.playstation.com', 'nintendo.com'],
          },
        ],
      },
      {
        id: 'science-health-press',
        label: 'Science & Health Press',
        icon: 'phys.org',
        children: [
          {
            id: 'science-xpress',
            label: 'Science Xpress',
            icon: 'phys.org',
            children: [
              { id: 'phys-org', label: 'Phys.org', icon: 'phys.org', sources: ['phys.org'] },
              { id: 'medical-xpress', label: 'Medical Xpress', icon: 'medicalxpress.com', sources: ['medicalxpress.com'] },
              { id: 'tech-xplore', label: 'Tech Xplore', icon: 'techxplore.com', sources: ['techxplore.com'] },
            ],
          },
          {
            id: 'science-popular',
            label: 'Popular Science',
            icon: 'livescience.com',
            children: [
              {
                id: 'science-aggregators',
                label: 'Science Aggregators',
                icon: 'sciencealert.com',
                sources: ['sciencedaily.com', 'sciencealert.com', 'psypost.org', 'sci.news', 'zmescience.com', 'sciencebasedmedicine.org', 'futurity.org'],
              },
              {
                id: 'science-magazines',
                label: 'Science Magazines',
                icon: 'newscientist.com',
                sources: ['livescience.com', 'newscientist.com', 'scientificamerican.com', 'sciencenews.org', 'smithsonianmag.com', 'discovermagazine.com'],
              },
              {
                id: 'space-physics',
                label: 'Space & Physics',
                icon: 'space.com',
                sources: ['space.com', 'universetoday.com', 'physicsworld.com'],
              },
            ],
          },
          {
            id: 'science-journals',
            label: 'Science Journals',
            icon: 'nature.com',
            sources: [
              'nature.com', 'frontiersin.org', 'cell.com', 'science.org', 'scirp.org',
              'plos.org', 'biorxiv.org', 'arxiv.org', 'jamanetwork.com',
              'thelancet.com', 'nejm.org', 'bmj.com', 'royalsocietypublishing.org',
            ],
          },
          {
            id: 'health-medical',
            label: 'Health & Medical',
            icon: 'medpagetoday.com',
            sources: [
              'medpagetoday.com', 'statnews.com', 'endpoints.com', 'genengnews.com',
              'labiotech.eu', 'healthpolicy-watch.news', 'kffhealthnews.org',
              'yourlocalepidemiologist.substack.com', 'health-e.org.za', 'cancerresearchuk.org',
              'reutershealth.com', 'webmd.com', 'healthline.com', 'medscape.com',
            ],
          },
        ],
      },
      {
        id: 'business-money',
        label: 'Business & Money',
        icon: 'ft.com',
        children: [
          {
            id: 'financial-national',
            label: 'Financial Nationals',
            icon: 'ft.com',
            children: [
              { id: 'financial-times', label: 'Financial Times', icon: 'ft.com', sources: ['ft.com'] },
              {
                id: 'business-newsweeklies',
                label: 'Business Newsweeklies',
                icon: 'economist.com',
                sources: ['economist.com', 'bloomberg.com', 'wsj.com', 'barrons.com', 'marketwatch.com'],
              },
            ],
          },
          {
            id: 'investor-advice',
            label: 'Investor & Markets',
            icon: 'fool.com',
            children: [
              {
                id: 'markets-data',
                label: 'Markets Data',
                icon: 'marketbeat.com',
                sources: ['marketbeat.com', 'nasdaq.com', 'seekingalpha.com', 'netinterest.co'],
              },
              {
                id: 'retail-investor',
                label: 'Retail Investor',
                icon: 'fool.com',
                sources: ['fool.com', 'fool.ca', 'fool.com.au', 'fool.co.uk', 'nairametrics.com', 'moneyweb.co.za', 'macrobusiness.com.au', 'stockhead.com.au'],
              },
              { id: 'business-recorder', label: 'Business Recorder', icon: 'brecorder.com', sources: ['brecorder.com'] },
            ],
          },
          {
            id: 'business-specialist',
            label: 'Business Specialist',
            icon: 'finextra.com',
            children: [
              { id: 'cityam', label: 'City A.M.', icon: 'cityam.com', sources: ['cityam.com'] },
              {
                id: 'business-insider-network',
                label: 'Business Insider Network',
                icon: 'businessinsider.com',
                sources: ['businessinsider.com', 'insider.com', 'morningbrew.com', 'finextra.com', 'gfmag.com', 'pymnts.com', 'inc42.com', 'yourstory.com', 'startupdaily.net', 'fintechnews.sg', 'e27.co'],
              },
              {
                id: 'european-business-analysis',
                label: 'European Business Analysis',
                icon: 'handelsblatt.com',
                sources: ['handelsblatt.com', 'taxfoundation.org', 'mckinsey.com'],
              },
            ],
          },
          {
            id: 'regional-business',
            label: 'Regional Business',
            icon: 'businessday.ng',
            sources: [
              'businessday.ng', 'businesstimes.com.sg', 'thehindubusinessline.com',
              'business-standard.com', 'businesslive.co.za', 'engineeringnews.co.za',
              'miningweekly.com', 'braziljournal.com', 'elfinanciero.com.mx',
              'expansion.com', 'ilsole24ore.com', 'businesskorea.co.kr',
            ],
          },
        ],
      },
      {
        id: 'technology-press',
        label: 'Technology Press',
        icon: 'theverge.com',
        children: [
          {
            id: 'consumer-tech',
            label: 'Consumer Tech',
            icon: 'theverge.com',
            children: [
              {
                id: 'tech-analysis',
                label: 'Tech Analysis',
                icon: 'theverge.com',
                sources: ['theverge.com', 'wired.com', 'arstechnica.com', 'techcrunch.com', 'theregister.com', 'zdnet.com'],
              },
              {
                id: 'consumer-gadgets',
                label: 'Consumer Gadgets',
                icon: 'techradar.com',
                sources: ['techradar.com', 'engadget.com', 'cnet.com', 'digitaltrends.com', 'bgr.com'],
              },
              {
                id: 'social-tech',
                label: 'Social Tech',
                icon: 'mashable.com',
                sources: ['mashable.com', 'in.mashable.com', 'sea.mashable.com', 'lifehacker.com', 'gizmodo.com'],
              },
            ],
          },
          {
            id: 'hardware-components',
            label: 'Hardware & Components',
            icon: 'tomshardware.com',
            children: [
              { id: 'notebookcheck', label: 'Notebookcheck', icon: 'notebookcheck.net', sources: ['notebookcheck.net'] },
              {
                id: 'enthusiast-hardware',
                label: 'Enthusiast Hardware',
                icon: 'tweaktown.com',
                sources: ['tweaktown.com', 'kitguru.net', 'hothardware.com', 'techspot.com'],
              },
              {
                id: 'hardware-guides',
                label: 'Hardware Guides',
                icon: 'tomshardware.com',
                sources: ['tomshardware.com', 'tomsguide.com', 'pcmag.com', 'wccftech.com', 'hardwarezone.com.sg', 'extremetech.com', 'anandtech.com'],
              },
            ],
          },
          {
            id: 'mobile-software',
            label: 'Mobile & Software',
            icon: 'androidauthority.com',
            sources: [
              'androidauthority.com', 'androidheadlines.com', '9to5google.com',
              '9to5mac.com', 'macrumors.com', 'macstories.net', 'apple.news',
              'techdows.com', 'bleepingcomputer.com', 'windowscentral.com',
              'thewindowsclub.com', 'mspoweruser.com', 'ghacks.net',
            ],
          },
          {
            id: 'industry-b2b',
            label: 'Industry & B2B',
            icon: 'retaildive.com',
            children: [
              {
                id: 'industry-dive',
                label: 'Industry Dive',
                icon: 'retaildive.com',
                sources: [
                  'bankingdive.com', 'retaildive.com', 'restaurantdive.com',
                  'grocerydive.com', 'marketingdive.com', 'supplychaindive.com',
                  'truckingdive.com', 'hrdive.com', 'manufacturingdive.com',
                  'constructiondive.com', 'biopharmadive.com', 'healthcaredive.com',
                  'medtechdive.com', 'pharmavoice.com', 'utilitydive.com',
                  'educationdive.com', 'smartcitiesdive.com', 'wastedive.com',
                  'cybersecuritydive.com', 'legaldive.com',
                ],
              },
              {
                id: 'b2b-specialist',
                label: 'B2B Specialist',
                icon: 'retail-insider.com',
                sources: [
                  'retail-insider.com', 'fashionunited.uk', 'marketingweek.com',
                  'prolificnorth.co.uk', 'adweek.com', 'digiday.com', 'martech.org',
                  'cio.com', 'csoonline.com', 'thefastmode.com', 'risk.net',
                  'complianceweek.com', 'thenationallawreview.com', 'livemint.com',
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'entertainment-culture',
        label: 'Entertainment & Culture',
        icon: 'variety.com',
        children: [
          {
            id: 'entertainment-trade',
            label: 'Entertainment Trade',
            icon: 'variety.com',
            sources: [
              'variety.com', 'deadline.com', 'hollywoodreporter.com', 'indiewire.com',
              'thewrap.com', 'screenrant.com', 'comingsoon.net', 'comicbook.com',
              'superherohype.com', 'decider.com', 'vulture.com', 'pitchfork.com',
              'sportico.com',
            ],
          },
          {
            id: 'music-culture',
            label: 'Music & Culture',
            icon: 'billboard.com',
            sources: [
              'billboard.com', 'rollingstone.com', 'nme.com', 'atwoodmagazine.com',
              'soompi.com', 'seoulbeats.com', 'bustle.com', 'hypebeast.com',
              'marieclaire.com', 'marieclaire.co.uk', 'wwd.com', 'footwearnews.com',
            ],
          },
        ],
      },
      {
        id: 'sports-press',
        label: 'Sports Press',
        icon: 'espn.com',
        sources: [
          'espn.com', 'espnfc.com', 'andscape.com', 'sportico.com',
          'worldsoccertalk.com', 'frontofficesports.com', 'yardbarker.com',
          'givemesport.com', 'cbssports.com', 'nbcsports.com', 'skysports.com',
          'sbnation.com', 'sports.yahoo.com', 'sportsgrid.com', 'sportsmole.co.uk',
          'planetfootball.com', '90min.com', 'theanalyst.com',
        ],
      },
    ],
  },
  {
    id: 'murdoch',
    label: 'Fox / News Corp',
    icon: 'nypost.com',
    children: [
      {
        id: 'fox',
        label: 'Fox',
        icon: 'foxnews.com',
        sources: [
          'foxnews.com', 'foxbusiness.com', 'foxsports.com', 'foxnation.com',
          'fox2now.com', 'fox4news.com', 'fox5atlanta.com', 'fox5dc.com',
          'fox5ny.com', 'fox5sandiego.com', 'fox5vegas.com', 'fox6now.com',
          'fox7austin.com', 'fox8live.com', 'fox9.com', 'fox10phoenix.com',
          'fox11online.com', 'fox12oregon.com', 'fox13news.com', 'fox13memphis.com',
          'fox14tv.com', 'fox16.com', 'fox17.com', 'fox19.com', 'fox21online.com',
          'fox23maine.com', 'fox25boston.com', 'fox26houston.com', 'fox28media.com',
          'fox29.com', 'fox30jax.com', 'fox32chicago.com', 'fox35orlando.com',
          'fox40.com', 'fox43.com', 'fox44.com', 'fox46charlotte.com',
          'fox47news.com', 'fox59.com',
        ],
      },
      {
        id: 'news-corp-print',
        label: 'News Corp Print',
        icon: 'nypost.com',
        sources: [
          'nypost.com', 'pagesix.com', 'thesun.co.uk', 'thetimes.co.uk',
          'thesundaytimes.co.uk', 'news.com.au', 'dailytelegraph.com.au',
          'heraldsun.com.au', 'couriermail.com.au', 'perthnow.com.au',
          'adelaidenow.com.au', 'ntnews.com.au', 'townsvillebulletin.com.au',
          'cairnspost.com.au', 'goldcoastbulletin.com.au', 'geelongadvertiser.com.au',
          'weeklytimesnow.com.au', 'theaustralian.com.au', 'skynews.com.au',
        ],
      },
      {
        id: 'news-corp-business',
        label: 'News Corp Business',
        icon: 'wsj.com',
        sources: ['wsj.com', 'barrons.com', 'marketwatch.com'],
      },
    ],
  },
  {
    id: 'uk-media',
    label: 'UK Media',
    icon: 'dailymail.com',
    children: [
      {
        id: 'dmgt',
        label: 'Daily Mail / DMGT',
        icon: 'dailymail.com',
        children: [
          {
            id: 'daily-mail',
            label: 'Daily Mail',
            icon: 'dailymail.com',
            sources: ['dailymail.com', 'mailonline.com'],
          },
          {
            id: 'dmgt-companion',
            label: 'DMGT Companion',
            icon: 'metro.co.uk',
            sources: ['metro.co.uk', 'thisismoney.co.uk', 'inews.co.uk', 'newscientist.com'],
          },
        ],
      },
      { id: 'guardian', label: 'The Guardian', icon: 'theguardian.com', sources: ['theguardian.com', 'guardian.co.uk'] },
      {
        id: 'reach',
        label: 'Reach',
        icon: 'mirror.co.uk',
        children: [
          {
            id: 'reach-national',
            label: 'Reach Nationals',
            icon: 'mirror.co.uk',
            sources: ['mirror.co.uk', 'express.co.uk', 'dailystar.co.uk', 'ok.co.uk', 'dailyrecord.co.uk'],
          },
          {
            id: 'reach-local',
            label: 'Reach Local',
            icon: 'belfastlive.co.uk',
            sources: [
              'belfastlive.co.uk', 'glasgowlive.co.uk', 'gloucestershirelive.co.uk',
              'walesonline.co.uk', 'manchestereveningnews.co.uk', 'liverpoolecho.co.uk',
              'dublinlive.ie', 'edinburghlive.co.uk', 'chroniclelive.co.uk',
              'birminghammail.co.uk', 'leicestermercury.co.uk', 'bristollive.co.uk',
              'bristolpost.co.uk', 'cornwalllive.com', 'derbyshirelive.co.uk',
              'devonlive.com', 'examinerlive.co.uk', 'hulldailymail.co.uk',
              'kentlive.news', 'lancs.live', 'leeds-live.co.uk', 'lincolnshirelive.co.uk',
              'nottinghampost.com', 'plymouthherald.co.uk', 'somersetlive.co.uk',
              'stokesentinel.co.uk', 'surrey.live', 'sussexlive.co.uk',
              'cambridge-news.co.uk', 'cheshire-live.co.uk', 'mylondon.news',
            ],
          },
        ],
      },
      {
        id: 'future',
        label: 'Future',
        icon: 'techradar.com',
        children: [
          {
            id: 'future-tech',
            label: 'Future Tech',
            icon: 'techradar.com',
            sources: ['techradar.com', 'tomshardware.com', 'tomsguide.com', 't3.com', 'creativebloq.com', 'techadvisor.com', 'trustedreviews.com', 'itpro.com', 'whathifi.com', 'laptopmag.com'],
          },
          {
            id: 'future-science',
            label: 'Future Science',
            icon: 'livescience.com',
            sources: ['space.com', 'livescience.com'],
          },
          {
            id: 'future-games-lifestyle',
            label: 'Future Games & Lifestyle',
            icon: 'pcgamer.com',
            sources: ['pcgamer.com', 'gamesradar.com', 'marieclaire.co.uk', 'homesandgardens.com', 'idealhome.co.uk', 'womanandhome.com', 'countrylife.co.uk'],
          },
        ],
      },
      {
        id: 'uk-nationals',
        label: 'UK Nationals',
        icon: 'independent.co.uk',
        children: [
          { id: 'independent', label: 'Independent', icon: 'independent.co.uk', sources: ['independent.co.uk', 'independent.ie'] },
          { id: 'standard', label: 'Evening Standard', icon: 'standard.co.uk', sources: ['standard.co.uk'] },
          { id: 'telegraph', label: 'The Telegraph', icon: 'telegraph.co.uk', sources: ['telegraph.co.uk'] },
          { id: 'observer', label: 'The Observer', icon: 'observer.co.uk', sources: ['observer.co.uk'] },
          { id: 'scotsman', label: 'The Scotsman', icon: 'scotsman.com', sources: ['scotsman.com', 'edinburghnews.scotsman.com'] },
          { id: 'evening-gazette', label: 'Evening Gazette', icon: 'gazettelive.co.uk', sources: ['gazettelive.co.uk'] },
        ],
      },
      {
        id: 'uk-regional',
        label: 'UK Regional',
        icon: 'theolivepress.es',
        sources: [
          'glasgowtimes.co.uk', 'heraldscotland.com', 'thecourier.co.uk',
          'pressandjournal.co.uk', 'eveningexpress.co.uk', 'belfasttelegraph.co.uk',
          'newsletter.co.uk', 'wales247.co.uk', 'nation.cymru', 'theolivepress.es',
          'euroweeklynews.com', 'hot-dinners.com', 'timeout.com/london',
        ],
      },
    ],
  },
  {
    id: 'us-media',
    label: 'US Media',
    icon: 'nytimes.com',
    children: [
      {
        id: 'us-nationals',
        label: 'US Nationals',
        icon: 'nytimes.com',
        children: [
          { id: 'nytimes', label: 'New York Times', icon: 'nytimes.com', sources: ['nytimes.com'] },
          {
            id: 'billionaire-backed-nationals',
            label: 'Owner-backed Nationals',
            icon: 'washingtonpost.com',
            sources: ['washingtonpost.com', 'latimes.com', 'bostonglobe.com', 'time.com'],
          },
          { id: 'independent-city-papers', label: 'Independent City Papers', icon: 'seattletimes.com', sources: ['seattletimes.com', 'startribune.com', 'sfchronicle.com', 'houstonchronicle.com'] },
        ],
      },
      {
        id: 'us-local',
        label: 'US Local Media',
        icon: 'usatoday.com',
        children: [
          {
            id: 'gannett',
            label: 'Gannett',
            icon: 'usatoday.com',
            sources: [
              'usatoday.com', 'detroitnews.com', 'nwfdailynews.com', 'onlineathens.com',
              'palmbeachpost.com', 'indystar.com', 'courier-journal.com', 'azcentral.com',
              'desmoinesregister.com', 'freep.com', 'jsonline.com', 'tennessean.com',
              'dispatch.com', 'statesman.com', 'providencejournal.com', 'registerguard.com',
              'democratandchronicle.com', 'northjersey.com', 'pressconnects.com',
              'lohud.com', 'poughkeepsiejournal.com', 'app.com', 'floridatoday.com',
              'naplesnews.com', 'news-press.com', 'tcpalm.com', 'tallahassee.com',
              'montgomeryadvertiser.com', 'clarionledger.com', 'hattiesburgamerican.com',
              'goupstate.com', 'knoxnews.com', 'commercialappeal.com', 'capecodtimes.com',
              'telegram.com', 'savannahnow.com', 'staugustine.com',
            ],
          },
          {
            id: 'mcclatchy',
            label: 'McClatchy',
            icon: 'miamiherald.com',
            sources: [
              'miamiherald.com', 'kentucky.com', 'modbee.com', 'idahostatesman.com',
              'thenewstribune.com', 'kansascity.com', 'star-telegram.com', 'sacbee.com',
              'charlotteobserver.com', 'newsobserver.com', 'bnd.com', 'heraldonline.com',
              'ledger-enquirer.com', 'macon.com', 'sunherald.com', 'thestate.com',
              'bradenton.com', 'centredailytimes.com', 'kansas.com',
            ],
          },
          {
            id: 'tribune',
            label: 'Tribune',
            icon: 'courant.com',
            sources: ['courant.com', 'chicagotribune.com', 'nydailynews.com', 'baltimoresun.com', 'orlandosentinel.com', 'sun-sentinel.com', 'dailypress.com', 'mcall.com', 'pilotonline.com', 'capitalgazette.com'],
          },
          {
            id: 'hearst-local',
            label: 'Hearst Local',
            icon: 'sfgate.com',
            sources: ['sfgate.com', 'timesunion.com', 'connecticutpost.com', 'greenwichtime.com', 'middletownpress.com', 'newstimes.com', 'registercitizen.com', 'stamfordadvocate.com', 'thehour.com'],
          },
          {
            id: 'advance-local',
            label: 'Advance Local',
            icon: 'oregonlive.com',
            sources: ['oregonlive.com', 'obits.oregonlive.com', 'lehighvalleylive.com', 'nj.com', 'mlive.com', 'masslive.com', 'syracuse.com', 'cleveland.com', 'al.com', 'pennlive.com'],
          },
          {
            id: 'tegna',
            label: 'Tegna',
            icon: 'king5.com',
            sources: ['king5.com', 'kare11.com', 'khou.com', 'kusa.com', 'wgrz.com', 'wtsp.com', '13newsnow.com', 'firstcoastnews.com', 'wfaa.com', 'wzzm13.com', 'wcnc.com', 'wusa9.com', 'cbs8.com', 'krem.com', 'ksdk.com', 'wbir.com', 'wxia.com', 'whas11.com', 'wltx.com'],
          },
          {
            id: 'nexstar',
            label: 'Nexstar',
            icon: 'wivb.com',
            sources: ['wivb.com', 'keloland.com', 'wkrg.com', 'wreg.com', 'wwlp.com', 'wavy.com', 'ktla.com', 'wpix.com', 'newsnationnow.com', 'cw33.com', 'kron4.com'],
          },
          {
            id: 'scripps',
            label: 'E.W. Scripps',
            icon: 'denver7.com',
            sources: ['denver7.com', 'kjrh.com', 'wrtv.com', 'wcpo.com', 'kshb.com', 'ktnv.com', 'wfts.com', 'wxyz.com', 'tucson.com', 'newson5.com'],
          },
          {
            id: 'gray-media',
            label: 'Gray Media',
            icon: 'kait8.com',
            sources: ['kait8.com', 'kwqc.com', 'wndu.com', 'wibw.com', 'wdbj7.com', 'wcax.com', 'wect.com', 'weau.com', 'wgem.com', 'kgwn.tv', 'kolotv.com', 'kktv.com', 'ky3.com', 'wjhg.com', 'wmbfnews.com', 'wmcactionnews5.com', 'wsaz.com', 'wsmv.com', 'wtvy.com', 'wvlt.tv', 'wwbt.com'],
          },
          {
            id: 'sinclair',
            label: 'Sinclair',
            icon: 'thenationaldesk.com',
            sources: ['thenationaldesk.com', 'komonews.com', 'wjla.com', 'wsbt.com', 'katu.com', 'kutv.com', 'nbc15.com', 'turnto10.com'],
          },
          {
            id: 'lee',
            label: 'Lee Enterprises',
            icon: 'madison.com',
            sources: ['madison.com', 'journalstar.com', 'tucson.com', 'richmond.com', 'buffalonews.com', 'stltoday.com', 'omaha.com', 'siouxcityjournal.com', 'billingsgazette.com', 'missoulian.com', 'mtstandard.com', 'journalnow.com', 'greensboro.com', 'roanoke.com', 'nwitimes.com', 'wacotrib.com'],
          },
        ],
      },
      {
        id: 'us-broadcast',
        label: 'US Broadcast Networks',
        icon: 'nbcnews.com',
        children: [
          { id: 'nbcu', label: 'NBCUniversal', icon: 'nbcnews.com', sources: ['nbcnews.com', 'cnbc.com', 'msnbc.com', 'today.com', 'eonline.com', 'telemundo.com', 'oxygen.com'] },
          { id: 'abc-disney', label: 'Disney / ABC', icon: 'abcnews.com', sources: ['abcnews.com', 'abcnews.go.com', '6abc.com', 'abc7ny.com', 'abc7.com', 'abc7chicago.com', 'abc7news.com', 'abc13.com', 'abc11.com', 'abc30.com'] },
          { id: 'cbs-paramount', label: 'Paramount / CBS', icon: 'cbsnews.com', sources: ['cbsnews.com', 'cbslocal.com'] },
          { id: 'comcast-sky', label: 'Comcast / Sky', icon: 'news.sky.com', sources: ['news.sky.com', 'sky.com', 'skysports.com'] },
          { id: 'cnn', label: 'CNN', icon: 'cnn.com', sources: ['cnn.com'] },
        ],
      },
    ],
  },
  {
    id: 'digital-publishers',
    label: 'Digital Publishers',
    icon: 'theverge.com',
    children: [
      { id: 'axel-springer', label: 'Axel Springer', icon: 'businessinsider.com', sources: ['businessinsider.com', 'insider.com', 'politico.com', 'politico.eu', 'morningbrew.com'] },
      {
        id: 'ziff-davis',
        label: 'Ziff Davis / IGN Entertainment',
        icon: 'ign.com',
        sources: [
          'ign.com', 'mashable.com', 'in.mashable.com', 'sea.mashable.com',
          'pcmag.com', 'extremetech.com', 'geek.com', 'askmen.com', 'lifehacker.com',
          'eurogamer.net', 'rockpapershotgun.com', 'vg247.com', 'gamesindustry.biz',
          'nintendolife.com', 'pushsquare.com', 'purexbox.com', 'timeextension.com',
        ],
      },
      { id: 'keleops', label: 'Keleops', icon: 'kotaku.com', sources: ['kotaku.com', 'gizmodo.com', 'journaldugeek.com', 'presse-citron.com', '01net.com', 'iphon.fr'] },
      { id: 'vox-media', label: 'Vox Media', icon: 'theverge.com', sources: ['theverge.com', 'polygon.com', 'vulture.com', 'nymag.com', 'thecut.com', 'sbnation.com', 'vox.com', 'eater.com', 'curbed.com', 'thrillist.com', 'popsugar.com'] },
      { id: 'conde-nast', label: 'Condé Nast', icon: 'arstechnica.com', sources: ['arstechnica.com', 'wired.com', 'newyorker.com', 'vanityfair.com', 'vogue.com', 'gq.com', 'glamour.com', 'allure.com', 'bonappetit.com', 'epicurious.com', 'cntraveler.com', 'self.com', 'them.us', 'pitchfork.com'] },
      { id: 'hearst-magazines', label: 'Hearst Magazines', icon: 'housebeautiful.com', sources: ['housebeautiful.com', 'cosmopolitan.com', 'esquire.com', 'menshealth.com', 'womenshealthmag.com', 'goodhousekeeping.com', 'countryliving.com', 'elle.com', 'harpersbazaar.com', 'caranddriver.com', 'popularmechanics.com', 'roadandtrack.com', 'bestproducts.com', 'delish.com', 'prevention.com', 'runnersworld.com', 'bicycling.com', 'oprahdaily.com', 'townandcountrymag.com'] },
      { id: 'penske', label: 'Penske Media', icon: 'variety.com', sources: ['variety.com', 'deadline.com', 'hollywoodreporter.com', 'indiewire.com', 'rollingstone.com', 'billboard.com', 'sportico.com', 'wwd.com', 'footwearnews.com'] },
      { id: 'yahoo', label: 'Yahoo', icon: 'sports.yahoo.com', sources: ['sports.yahoo.com', 'news.yahoo.com', 'finance.yahoo.com', 'yahoo.com', 'aol.com', 'engadget.com', 'autoblog.com'] },
      { id: 'red-ventures', label: 'Red Ventures', icon: 'cnet.com', sources: ['cnet.com', 'gamespot.com', 'zdnet.com', 'healthline.com', 'lonelyplanet.com', 'bankrate.com'] },
      { id: 'valnet', label: 'Valnet', icon: 'gamerant.com', sources: ['gamerant.com', 'thegamer.com', 'screenrant.com', 'makeuseof.com', 'howtogeek.com', 'movieweb.com', 'xda-developers.com'] },
      { id: 'static-media', label: 'Static Media', icon: 'nickiswift.com', sources: ['nickiswift.com', 'thelist.com', 'looper.com', 'grunge.com', 'mashable.com'] },
      { id: 'motley-fool', label: 'Motley Fool', icon: 'fool.com', sources: ['fool.com', 'fool.ca', 'fool.com.au', 'fool.co.uk'] },
      {
        id: 'digital-news-standalones',
        label: 'Independent Digital News',
        icon: 'newsweek.com',
        sources: ['newsweek.com', 'semafor.com', 'qz.com', 'vice.com', 'huffpost.com', 'thedailybeast.com', 'rawstory.com', 'salon.com', 'slate.com', 'thedispatch.com'],
      },
    ],
  },
  {
    id: 'australia-media',
    label: 'Australia Media',
    icon: 'smh.com.au',
    children: [
      { id: 'nine', label: 'Nine', icon: 'smh.com.au', sources: ['smh.com.au', 'theage.com.au', 'watoday.com.au', 'afr.com', 'nine.com.au', '9news.com.au', '2gb.com', '3aw.com.au', '4bc.com.au', '6pr.com.au'] },
      { id: 'australia-national', label: 'Australia National', icon: 'theaustralian.com.au', sources: ['theaustralian.com.au', 'news.com.au', 'thewest.com.au', 'crikey.com.au'] },
    ],
  },
  {
    id: 'canada-media',
    label: 'Canada Media',
    icon: 'torontosun.com',
    children: [
      {
        id: 'postmedia',
        label: 'Postmedia',
        icon: 'torontosun.com',
        sources: ['torontosun.com', 'vancouversun.com', 'theprovince.com', 'calgaryherald.com', 'edmontonjournal.com', 'ottawacitizen.com', 'montrealgazette.com', 'windsorstar.com', 'leaderpost.com', 'thestarphoenix.com', 'nationalpost.com', 'financialpost.com', 'winnipegsun.com', 'edmontonsun.com', 'calgarysun.com', 'ottawasun.com'],
      },
      { id: 'torstar', label: 'Torstar', icon: 'thestar.com', sources: ['thestar.com', 'toronto.com'] },
    ],
  },
  {
    id: 'regional-english',
    label: 'Regional English Media',
    icon: 'punchng.com',
    children: [
      {
        id: 'nigeria-media',
        label: 'Nigeria Media',
        icon: 'punchng.com',
        children: [
          {
            id: 'nigeria-nationals',
            label: 'Nigeria Nationals',
            icon: 'punchng.com',
            children: [
              { id: 'punch', label: 'The Punch', icon: 'punchng.com', sources: ['punchng.com'] },
              {
                id: 'nigeria-companion-papers',
                label: 'Nigeria Companion Papers',
                icon: 'premiumtimesng.com',
                sources: ['premiumtimesng.com', 'dailypost.ng', 'vanguardngr.com', 'dailytrust.com', 'thisdaylive.com'],
              },
            ],
          },
          { id: 'nigeria-business', label: 'Nigeria Business', icon: 'businessday.ng', sources: ['businessday.ng', 'nairametrics.com'] },
        ],
      },
      {
        id: 'malaysia-media',
        label: 'Malaysia Media',
        icon: 'thestar.com.my',
        children: [
          {
            id: 'malaysia-nationals',
            label: 'Malaysia Nationals',
            icon: 'thestar.com.my',
            children: [
              { id: 'the-star-malaysia', label: 'The Star Malaysia', icon: 'thestar.com.my', sources: ['thestar.com.my'] },
              { id: 'nst-malaysia', label: 'New Straits Times', icon: 'nst.com.my', sources: ['nst.com.my'] },
              { id: 'malay-mail', label: 'Malay Mail', icon: 'malaymail.com', sources: ['malaymail.com'] },
            ],
          },
          { id: 'malaysia-alt', label: 'Malaysia Alternative', icon: 'freemalaysiatoday.com', sources: ['freemalaysiatoday.com', 'thevibes.com', 'lowyat.net'] },
        ],
      },
      {
        id: 'pakistan-media',
        label: 'Pakistan Media',
        icon: 'dailytimes.com.pk',
        sources: ['dailytimes.com.pk', 'propakistani.pk', 'nation.com.pk', 'dawn.com', 'tribune.com.pk', 'arynews.tv', 'geo.tv', 'brecorder.com', 'samaa.tv', 'dunyanews.tv', 'humnews.pk', 'bolnews.com'],
      },
      {
        id: 'india-media',
        label: 'India Media',
        icon: 'thehindu.com',
        sources: ['thehindu.com', 'timesofindia.com', 'hindustantimes.com', 'indiatoday.in', 'livemint.com', 'economictimes.com', 'dnaindia.com', 'freepressjournal.in', 'ndtv.com', 'ndtvprofit.com', 'thewire.in'],
      },
      {
        id: 'philippines-media',
        label: 'Philippines Media',
        icon: 'inquirer.com',
        children: [
          { id: 'inquirer', label: 'Inquirer', icon: 'inquirer.com', sources: ['inquirer.com', 'newsinfo.inquirer.net', 'business.inquirer.net', 'cebudailynews.inquirer.net', 'entertainment.inquirer.net', 'lifestyle.inquirer.net', 'technology.inquirer.net'] },
          { id: 'philippines-networks', label: 'Philippines Networks', icon: 'gmanetwork.com', sources: ['gmanetwork.com', 'abs-cbn.com', 'mb.com.ph', 'rappler.com', 'philstar.com', 'sunstar.com.ph', 'interaksyon.com'] },
        ],
      },
      {
        id: 'south-africa-media',
        label: 'South Africa Media',
        icon: 'dailymaverick.co.za',
        sources: ['dailymaverick.co.za', 'iol.co.za', 'mg.co.za', 'citizen.co.za', 'ewn.co.za', 'groundup.org.za', 'health-e.org.za', 'moneyweb.co.za', 'engineeringnews.co.za', 'miningweekly.com', 'techcentral.co.za', 'sabcnews.com'],
      },
      {
        id: 'ghana-media',
        label: 'Ghana Media',
        icon: 'myjoyonline.com',
        sources: ['myjoyonline.com', 'ghanabusinessnews.com', 'gbcghanaonline.com', 'newsghana.com.gh', 'adomonline.com', 'citinewsroom.com', '3news.com'],
      },
      {
        id: 'kenya-media',
        label: 'Kenya Media',
        icon: 'nation.africa',
        sources: ['nation.africa', 'standardmedia.co.ke', 'kenyans.co.ke', 'tuko.co.ke', 'the-star.co.ke', 'kbc.co.ke'],
      },
      {
        id: 'indonesia-media',
        label: 'Indonesia Media',
        icon: 'thejakartapost.com',
        sources: ['thejakartapost.com', 'en.antaranews.com', 'kompas.com', 'detik.com', 'tempo.co', 'republika.co.id', 'jakartaglobe.id'],
      },
      {
        id: 'korea-media',
        label: 'Korea Media',
        icon: 'koreatimes.co.kr',
        children: [
          { id: 'korea-times', label: 'Korea Times', icon: 'koreatimes.co.kr', sources: ['koreatimes.co.kr'] },
          {
            id: 'korea-companion-media',
            label: 'Korea Companion Media',
            icon: 'koreaherald.com',
            sources: ['koreaherald.com', 'koreaittimes.com', 'en.yna.co.kr', 'world.kbs.co.kr', 'chosun.com', 'koreajoongangdaily.joins.com', 'hani.co.kr', 'mk.co.kr'],
          },
        ],
      },
      {
        id: 'china-media',
        label: 'China Media',
        icon: 'globaltimes.cn',
        sources: ['globaltimes.cn', 'chinadaily.com.cn', 'peopledaily.com', 'shanghaidaily.com', 'sixthtone.com', 'cgtn.com', 'news.cgtn.com'],
      },
      {
        id: 'hongkong-taiwan-media',
        label: 'Hong Kong & Taiwan',
        icon: 'scmp.com',
        sources: ['scmp.com', 'hongkongfp.com', 'taiwannews.com.tw', 'taipeitimes.com', 'news.ltn.com.tw'],
      },
      {
        id: 'singapore-media',
        label: 'Singapore Media',
        icon: 'straitstimes.com',
        sources: ['straitstimes.com', 'businesstimes.com.sg', 'channelnewsasia.com', 'cnaluxury.channelnewsasia.com', 'mothership.sg', 'hardwarezone.com.sg', 'fintechnews.sg', 'e27.co'],
      },
      {
        id: 'thailand-media',
        label: 'Thailand Media',
        icon: 'bangkokpost.com',
        sources: ['bangkokpost.com', 'khaosodenglish.com', 'thailand-business-news.com', 'nationthailand.com', 'thethaiger.com', 'chiangraitimes.com'],
      },
      {
        id: 'japan-media',
        label: 'Japan Media',
        icon: 'japantimes.co.jp',
        sources: ['japantimes.co.jp', 'japantoday.com', 'mainichi.jp', 'english.kyodonews.net', 'newsonjapan.com', 'asahi.com'],
      },
      {
        id: 'gulf-media',
        label: 'Gulf Media',
        icon: 'gulf-times.com',
        children: [
          { id: 'qatar-media', label: 'Qatar Media', icon: 'qatar-tribune.com', sources: ['gulf-times.com', 'qatar-tribune.com', 'thepeninsulaqatar.com', 'dohanews.co'] },
          { id: 'uae-media', label: 'UAE Media', icon: 'thenationalnews.com', sources: ['gulfnews.com', 'thenationalnews.com', 'arabianbusiness.com'] },
          { id: 'saudi-media', label: 'Saudi Media', icon: 'english.ajel.sa', sources: ['english.ajel.sa', 'saudigazette.com.sa', 'khaleejtimes.com', 'arabnews.com'] },
        ],
      },
      {
        id: 'middle-east-media',
        label: 'Middle East Media',
        icon: 'middleeasteye.net',
        children: [
          { id: 'jpost', label: 'Jerusalem Post', icon: 'jpost.com', sources: ['jpost.com'] },
          {
            id: 'middle-east-companion',
            label: 'Middle East Companion',
            icon: 'middleeasteye.net',
            sources: ['middleeasteye.net', 'haaretz.com', 'timesofisrael.com', 'al-monitor.com', 'israelhayom.com', 'ynetnews.com', 'iranintl.com'],
          },
        ],
      },
      {
        id: 'ukraine-media',
        label: 'Ukraine Media',
        icon: 'kyivindependent.com',
        sources: ['kyivindependent.com', 'kyivpost.com', 'euromaidanpress.com', 'ukrinform.net', 'uatv.ua', 'english.nv.ua'],
      },
      {
        id: 'latin-america-media',
        label: 'Latin America Media',
        icon: 'batimes.com.ar',
        sources: ['batimes.com.ar', 'buenosairesherald.com', 'colombiaone.com', 'mexiconewsdaily.com', 'riotimesonline.com', 'braziljournal.com', 'elfinanciero.com.mx', 'en.mercopress.com'],
      },
      {
        id: 'europe-english',
        label: 'Europe English',
        icon: 'euronews.com',
        sources: [
          'euronews.com', 'euobserver.com', 'english.elpais.com', 'lemonde.fr',
          'derstandard.at', 'dutchnews.nl', 'nltimes.nl', 'e24.no', 'thelocal.com',
          'thelocal.ch', 'thelocal.es', 'thelocal.fr', 'thelocal.de', 'thelocal.it',
          'thelocal.no', 'thelocal.se', 'thelocal.dk', 'thelocal.at', 'anadoluagency.com',
        ],
      },
    ],
  },
  {
    id: 'wires-releases',
    label: 'Wires & Releases',
    icon: 'apnews.com',
    children: [
      {
        id: 'news-wires',
        label: 'News Wires',
        icon: 'apnews.com',
        sources: ['apnews.com', 'reuters.com', 'factcheck.afp.com', 'afp.com', 'upi.com', 'pressassociation.com', 'dpa.com', 'ansa.it', 'efe.com', 'kyodonews.net', 'interfax.com'],
      },
      {
        id: 'press-releases',
        label: 'Press Releases',
        icon: 'globenewswire.com',
        sources: ['globenewswire.com', 'prnewswire.com', 'prweb.com', 'businesswire.com', 'accesswire.com', 'einnews.com', 'openpr.com'],
      },
    ],
  },
  {
    id: 'platforms-aggregators',
    label: 'Platforms & Aggregators',
    icon: 'reddit.com',
    children: [
      { id: 'social-aggregators', label: 'Social Aggregators', icon: 'reddit.com', sources: ['reddit.com', 'ycombinator.com', 'apple.news', 'flipboard.com', 'techmeme.com', 'slashdot.org', 'games.slashdot.org', 'science.slashdot.org'] },
      {
        id: 'developer-platforms',
        label: 'Developer Platforms',
        icon: 'dev.to',
        children: [
          { id: 'dev-to', label: 'DEV Community', icon: 'dev.to', sources: ['dev.to'] },
          {
            id: 'developer-blogs',
            label: 'Developer Blogs',
            icon: 'github.com',
            sources: ['github.com', 'medium.com', 'hackernoon.com', 'bennadel.com', 'learningjquery.com', 'icode4.coffee', 'seodata.dev', 'rixdata.net', 'kpwags.com'],
          },
        ],
      },
      { id: 'independent-blogs', label: 'Independent Blogs', icon: 'substack.com', sources: ['substack.com', 'laurenleek.substack.com', 'systemdrift.neocities.org', 'twelfthmagpie.com', 'lumafield.com'] },
    ],
  },
  {
    id: 'official-organizations',
    label: 'Official Organizations',
    icon: 'nasa.gov',
    children: [
      { id: 'microsoft', label: 'Microsoft', icon: 'news.xbox.com', sources: ['news.xbox.com', 'xbox.com', 'github.com', 'microsoft.com', 'linkedin.com'] },
      { id: 'nasa', label: 'NASA', icon: 'nasa.gov', sources: ['nasa.gov', 'science.nasa.gov'] },
      { id: 'public-bodies', label: 'Public Bodies', icon: 'who.int', sources: ['who.int', 'afro.who.int', 'metoffice.gov.uk', 'fda.gov', 'nasa.gov', 'science.nasa.gov'] },
      { id: 'research-organizations', label: 'Research Organizations', icon: 'caltech.edu', sources: ['caltech.edu', 'taxfoundation.org', 'mckinsey.com', 'cancerresearchuk.org'] },
    ],
  },
];

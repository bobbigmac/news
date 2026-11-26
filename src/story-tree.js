// Loader for the portable story-relation dataset. The data itself lives in
// JSON files under src/trees/story/ (primary branches) and
// src/trees/story-pivots/ (pivoted-angle branches, claimed last).
//
// Schema per node:
// {
//   "id": "kebab-id",                 // unique across the tree
//   "label": "Display Label",         // rendered in groups
//   "related": [                      // optional cross-tree links
//     { "to": "node-id", "note": "why this link exists" }
//   ],
//   "terms": ["exact", "multi word"], // explicit catch vocabulary
//   "children": [ ... ]               // deeper branches
// }
import technology from './trees/story/technology.json' with { type: 'json' };
import gaming from './trees/story/gaming.json' with { type: 'json' };
import sport from './trees/story/sport.json' with { type: 'json' };
import politics from './trees/story/politics.json' with { type: 'json' };
import worldConflicts from './trees/story/world-conflicts.json' with { type: 'json' };
import scienceHealth from './trees/story/science-health.json' with { type: 'json' };
import crimeJustice from './trees/story/crime-justice.json' with { type: 'json' };
import businessEconomy from './trees/story/business-economy.json' with { type: 'json' };
import royal from './trees/story/royal.json' with { type: 'json' };
import entertainmentCulture from './trees/story/entertainment-culture.json' with { type: 'json' };
import education from './trees/story/education.json' with { type: 'json' };

import namedIndividuals from './trees/story-pivots/named-individuals.json' with { type: 'json' };
import studiesFindings from './trees/story-pivots/studies-findings.json' with { type: 'json' };
import deathsObituaries from './trees/story-pivots/deaths-obituaries.json' with { type: 'json' };
import moneyPrices from './trees/story-pivots/money-prices.json' with { type: 'json' };
import seasonalEvents from './trees/story-pivots/seasonal-events.json' with { type: 'json' };
import humanInterest from './trees/story-pivots/human-interest.json' with { type: 'json' };
import worldRegions from './trees/story-pivots/world-regions.json' with { type: 'json' };
import workJobs from './trees/story-pivots/work-jobs.json' with { type: 'json' };
import corporateNews from './trees/story-pivots/corporate-news.json' with { type: 'json' };
import travelTransport from './trees/story-pivots/travel-transport.json' with { type: 'json' };
import localCommunity from './trees/story-pivots/local-community.json' with { type: 'json' };
import weatherDisasters from './trees/story-pivots/weather-disasters.json' with { type: 'json' };
import serviceContent from './trees/story-pivots/service-content.json' with { type: 'json' };

const pivots = {
  id: 'pivots',
  label: 'Pivoted Angles',
  pivot: true,
  children: [
    namedIndividuals, studiesFindings, deathsObituaries, moneyPrices,
    seasonalEvents, humanInterest, worldRegions, workJobs, corporateNews,
    travelTransport, localCommunity, weatherDisasters, serviceContent,
  ],
};

export const STORY_RELATION_TREE = [
  technology, gaming, sport, politics, worldConflicts, scienceHealth,
  crimeJustice, businessEconomy, royal, entertainmentCulture, education,
  pivots,
];

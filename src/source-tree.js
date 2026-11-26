// Loader for the portable source-relation dataset. The data itself lives in
// JSON files under src/trees/sources/ — one file per root branch, each holding
// explicit `sources` pools (exact publisher hosts) and deeper children.
// Groups are convenience relations, not ownership claims.
import publicInternational from './trees/sources/public-international.json' with { type: 'json' };
import specialistPress from './trees/sources/specialist-press.json' with { type: 'json' };
import murdoch from './trees/sources/murdoch.json' with { type: 'json' };
import ukMedia from './trees/sources/uk-media.json' with { type: 'json' };
import usMedia from './trees/sources/us-media.json' with { type: 'json' };
import digitalPublishers from './trees/sources/digital-publishers.json' with { type: 'json' };
import australiaMedia from './trees/sources/australia-media.json' with { type: 'json' };
import canadaMedia from './trees/sources/canada-media.json' with { type: 'json' };
import regionalEnglish from './trees/sources/regional-english.json' with { type: 'json' };
import wiresReleases from './trees/sources/wires-releases.json' with { type: 'json' };
import platformsAggregators from './trees/sources/platforms-aggregators.json' with { type: 'json' };
import officialOrganizations from './trees/sources/official-organizations.json' with { type: 'json' };

export const SOURCE_RELATION_TREE = [
  publicInternational, specialistPress, murdoch, ukMedia, usMedia,
  digitalPublishers, australiaMedia, canadaMedia, regionalEnglish,
  wiresReleases, platformsAggregators, officialOrganizations,
];

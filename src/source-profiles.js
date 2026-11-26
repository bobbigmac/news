// Loader for the portable source-profile dataset. The data itself lives in
// JSON files under src/trees/profiles/: branch.json (notes per tree branch) and
// sources.json (per-host research notes shown on the relationships page).
//
// Profiles are intentionally heterogeneous: a source may be a public body, a
// family newspaper, a billionaire-backed title, a wire, a press-release pipe,
// a community platform, or a specialist outlet. Fields are optional because the
// useful properties differ by source. Links point to the evidence used to make
// the note rather than pretending one generic record can capture every outlet.
import BRANCH_PROFILES from './trees/profiles/branches.json' with { type: 'json' };
import SOURCE_PROFILES from './trees/profiles/sources.json' with { type: 'json' };

export { BRANCH_PROFILES, SOURCE_PROFILES };

// Generates .working/sources-manifest-GAPS-<date>.md — a raw gap dump for the
// next research round, across three dimensions:
//   1. additional sources — corpus/digest keys with no or thin curated profiles
//   2. relationships & connections — profiles missing ownership/funding structure
//   3. non-measured quality — sources with no external assessment evidence
// Input universe: cache/digest.json story keys + measured corpus keys.
// Run: node scripts/build-gaps-manifest.js
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { sourceKeyFromUrl, prettifySourceKey } from './sources.js';

const TODAY = new Date().toISOString().slice(0, 10);

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

// --- universe: count unique headlines per source key across the digest ---
const digest = loadJson('cache/digest.json', { clusters: [] });
const counts = new Map();
const samples = new Map();
for (const cluster of digest.clusters || []) {
  for (const story of cluster.stories || []) {
    const key = sourceKeyFromUrl(story.url || '');
    if (!key) continue;
    const seen = counts.get(key) || { titles: new Set(), stories: 0 };
    seen.stories++;
    if (story.title) seen.titles.add(story.title);
    counts.set(key, seen);
    if (!samples.has(key) && story.title) samples.set(key, story.title);
  }
}

// merge in measured-corpus keys that may no longer appear in the live digest
const measured = loadJson('src/data/measured-sources.json', { sources: [] });
for (const s of measured.sources || []) {
  if (!counts.has(s.key)) counts.set(s.key, { titles: new Set(), stories: s.headlines || 0 });
}

// --- knowledge layers ---
const profiles = loadJson('src/trees/profiles/sources.json', {});
const assessments = loadJson('src/trees/profiles/source-assessments.json', { sources: {} });
const assessed = new Set(Object.keys(assessments.sources || {}));

// tree membership: every host listed anywhere in the source tree
const treeHosts = new Set();
function walk(node) {
  for (const h of node.sources || []) treeHosts.add(h);
  for (const c of node.children || []) walk(c);
}
for (const f of readdirSync('src/trees/sources')) {
  if (!f.endsWith('.json')) continue;
  walk(JSON.parse(readFileSync(join('src/trees/sources', f), 'utf8')));
}

// --- classify each key ---
const OWNER_WORDS = /own|parent|proprietor|shareholder|billionaire|family|murd(och)?|funded by|financed|state-owned|state media|government|licence fee|licence-fee|publicly traded|listed on|subsidiary|acqui|bought|sold to|media group|holdings|conglomerate|press baron/i;
function profileDepth(key, profile) {
  if (!profile) return 'none';
  const props = (profile.properties || []).length;
  const watch = (profile.watch || []).length;
  const links = (profile.links || []).length;
  const words = JSON.stringify(profile).length;
  // links are bonus evidence, not depth — curated prose without links still counts.
  void links;
  if (words < 260 || (props + watch) < 2) return 'minimal';
  if (words < 520) return 'thin';
  return 'full';
}
function hasOwnershipSignal(profile) {
  if (!profile) return false;
  // structured ownership/governance fields count directly; otherwise scan all prose.
  if (profile.ownership || profile.governance) return true;
  return OWNER_WORDS.test(JSON.stringify(profile));
}

const rows = [];
for (const [key, info] of counts) {
  const profile = profiles[key];
  rows.push({
    key,
    label: prettifySourceKey(key),
    headlines: info.titles.size || info.stories,
    depth: profileDepth(key, profile),
    inTree: treeHosts.has(key),
    hasOwner: hasOwnershipSignal(profile),
    assessed: assessed.has(key),
    sample: samples.get(key) || '',
  });
}
rows.sort((a, b) => b.headlines - a.headlines);

const noProfile = rows.filter(r => r.depth === 'none');
const thin = rows.filter(r => r.depth === 'thin' || r.depth === 'minimal');
const relGaps = rows.filter(r => r.depth !== 'none' && !r.hasOwner);
const noAssess = rows.filter(r => r.depth !== 'none' && !r.assessed);
const noTree = rows.filter(r => !r.inTree);
const unprofiledHighValue = noProfile.filter(r => r.headlines >= 3);

// measured-set cross-reference: which ranked sources lack assessment evidence
const measuredNoAssess = (measured.sources || []).filter(s => !assessed.has(s.key));

function lines(list, fn) {
  return list.map(r => fn(r)).join('\n');
}
const row = (r, extras = '') =>
  `- \`${r.key}\` — **${r.label}** — ${r.headlines} unique headlines — ${extras}${extras ? ' — ' : ''}sample: "${r.sample.replace(/"/g, "'").slice(0, 110)}"`;

const md = `# Sources manifest — knowledge GAPS

**Generated:** ${TODAY}
**Input:** \`cache/digest.json\` + \`src/data/measured-sources.json\`

Fresh gap dump for the next research round. Sorted by unique cached headline count, so the first rows are the highest-value research targets. Three dimensions: missing profiles (additional sources), missing ownership/funding structure (relationships & connections), missing external ratings (non-measured quality).

## Gap counts

- Corpus source keys: **${rows.length}**
- No curated profile: **${noProfile.length}** (of which ${unprofiledHighValue.length} have 3+ unique headlines)
- Thin or minimal profile: **${thin.length}**
- Profiled but no ownership/funding signal: **${relGaps.length}**
- Profiled but no external assessment: **${noAssess.length}**
- Measured sources with no external assessment: **${measuredNoAssess.length}** of ${(measured.sources || []).length}
- Keys with no home in the source tree: **${noTree.length}**

## 1. Additional sources — no curated profile (${noProfile.length})

${lines(noProfile, r => row(r))}

## 2. Thin or minimal profiles — need deepening (${thin.length})

${lines(thin, r => row(r, `existing profile: ${r.depth}`))}

## 3. Relationships & connections — profiled but no ownership/funding signal (${relGaps.length})

These profiles describe what the outlet publishes but not who owns or funds it — the relationship layer is incomplete.

${lines(relGaps, r => row(r, 'no ownership/funding evidence in profile'))}

## 4. Non-measured quality — profiled but no external assessment (${noAssess.length})

${lines(noAssess, r => row(r, 'no TOLD/MBFC/AllSides/Ad Fontes/NewsGuard-style evidence'))}

## 5. Measured sources missing assessment evidence (${measuredNoAssess.length})

Highest-priority cross-section: these sources are prominent enough to be measured, so external quality evidence is most valuable here.

${lines(measuredNoAssess.map(s => ({ key: s.key, label: s.label, headlines: s.headlines, sample: '' })), r => row(r, `measured rank ${(measured.sources || []).find(m => m.key === r.key)?.rank}`))}

## 6. Keys with no home in the source tree (${noTree.length})

${lines(noTree, r => row(r, 'missing curated relation'))}
`;

writeFileSync(`.working/sources-manifest-GAPS-${TODAY}.md`, md);
console.log(`written .working/sources-manifest-GAPS-${TODAY}.md`);
console.log(`corpus keys ${rows.length} | no profile ${noProfile.length} | thin ${thin.length} | no-owner ${relGaps.length} | no-assessment ${noAssess.length} | measured-no-assessment ${measuredNoAssess.length} | treeless ${noTree.length}`);

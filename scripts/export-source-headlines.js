import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_RELATION_TREE } from '../src/source-tree.js';
import { BRANCH_PROFILES, SOURCE_PROFILES } from '../src/source-profiles.js';
import { SOURCE_LABELS } from './favicons.js';
import { getSourceName, platformOfHost, sourceKeyFromUrl } from './sources.js';
import { dedupStories, normaliseUrl } from './url-dedup.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = { ref: 'origin/cache-data', out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ref') options.ref = argv[++i];
    else if (argv[i] === '--out') options.out = argv[++i];
    else if (argv[i] === '--help') {
      console.log('Usage: node scripts/export-source-headlines.js [--ref origin/cache-data] [--out exports/file.zip]');
      process.exit(0);
    }
  }
  return options;
}

function readCacheJson(ref, filename) {
  const blob = execFileSync('git', ['show', `${ref}:cache/${filename}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 200 * 1024 * 1024,
  });
  return JSON.parse(blob);
}

function readOptionalCacheJson(ref, filename) {
  try {
    return readCacheJson(ref, filename);
  } catch {
    return null;
  }
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function bodyTextFor(story) {
  return cleanText(story.bodyText || story.content || story.description || '').slice(0, 2000);
}

function richestText(...values) {
  return values.map(cleanText).sort((a, b) => b.length - a.length)[0] || '';
}

function canonicalSourceKey(url) {
  const normalised = normaliseUrl(url);
  if (normalised) return sourceKeyFromUrl(`https://${normalised}`);
  return sourceKeyFromUrl(url);
}

function baseHost(key) {
  return key.includes('/') ? key.split('/')[0] : key;
}

function timestamp(story) {
  const ts = Date.parse(story.published || '');
  return Number.isFinite(ts) ? ts : 0;
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values.map(cleanText).filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '';
}

const EXPORT_ACRONYMS = new Set([
  'bbc', 'cnn', 'nbc', 'abc', 'cbs', 'npr', 'pbs', 'itv', 'sky', 'dw', 'cbc', 'sbs',
  'rnz', 'cnbc', 'msnbc', 'espn', 'tsn', 'nfl', 'nhl', 'nba', 'mlb', 'fox', 'rt',
  'nyt', 'wsj', 'usa', 'uk', 'eu', 'un', 'nato', 'ft', 'ap', 'upi', 'afp', 'err',
]);

function prettifyExportKey(key) {
  let base;
  if (key.includes('/')) {
    base = key.split('/')[1];
  } else {
    const host = baseHost(key);
    const parts = host.split('.').filter(Boolean);
    const platform = platformOfHost(host);
    if (platform && host !== platform) {
      base = host.slice(0, host.length - platform.length - 1).split('.')[0];
    } else {
      const penultimate = parts[parts.length - 2];
      const compoundTld = parts.length >= 3 && ['co', 'com', 'org', 'net', 'ac', 'gov', 'edu', 'mil'].includes(penultimate);
      base = parts[compoundTld ? parts.length - 3 : parts.length - 2] || parts[0];
    }
  }
  if (!base) return 'Unknown';
  if (EXPORT_ACRONYMS.has(base.toLowerCase())) return base.toUpperCase();
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function labelForSource(key, stories) {
  const host = baseHost(key);
  const explicit = SOURCE_LABELS[key]
    || stories.map(s => getSourceName(s.url)).find(Boolean)
    || getSourceName(`https://${host}`);
  const isTenant = key.includes('/') || (platformOfHost(host) && host !== platformOfHost(host));
  const authorLabel = mostCommon(stories.map(s => s.source));
  if (isTenant) return authorLabel || explicit || prettifyExportKey(key);
  return explicit || prettifyExportKey(key);
}

function flattenRelationTree() {
  const blocks = [];
  const exact = new Map();
  const rootPriority = { 'state-media': 10 };

  function walk(node, root, ancestors = []) {
    const pathParts = [...ancestors, node.label];
    if (node.sources?.length) {
      const block = {
        id: node.id,
        root: root.label,
        rootId: root.id,
        path: pathParts,
        explicit: [...node.sources],
        keys: [],
        order: blocks.length,
      };
      blocks.push(block);
      for (const source of node.sources) {
        const existing = exact.get(source);
        if (!existing || (rootPriority[block.rootId] || 0) > (rootPriority[existing.rootId] || 0)) {
          exact.set(source, block);
        }
      }
    }
    for (const child of node.children || []) walk(child, root, pathParts);
  }

  for (const root of SOURCE_RELATION_TREE) walk(root, root);
  return { blocks, exact };
}

function findRelationBlock(key, exact) {
  if (exact.has(key)) return exact.get(key);
  const host = baseHost(key);
  if (key.includes('/') && exact.has(host)) return exact.get(host);

  const platform = platformOfHost(host);
  if (platform && exact.has(platform)) return exact.get(platform);

  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (exact.has(parent)) return exact.get(parent);
  }
  return null;
}

function keyRankInBlock(key, block) {
  const exactIndex = block.explicit.indexOf(key);
  if (exactIndex !== -1) return exactIndex;
  const host = baseHost(key);
  const hostIndex = block.explicit.indexOf(host);
  if (hostIndex !== -1) return hostIndex + 0.5;
  const platform = platformOfHost(host);
  if (platform) {
    const platformIndex = block.explicit.indexOf(platform);
    if (platformIndex !== -1) return platformIndex + 0.5;
  }
  return block.explicit.length + 1;
}

function slugify(value) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function uniqueHeadlineStoriesFor(stories) {
  const seen = new Set();
  const rows = [];
  const sorted = [...stories].sort((a, b) => timestamp(b) - timestamp(a));
  for (const story of sorted) {
    const title = cleanText(story.title);
    if (!title) continue;
    const dedupeKey = title.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rows.push({ title, story });
  }
  return rows;
}

function headlinesFor(stories) {
  return uniqueHeadlineStoriesFor(stories).map(row => row.title);
}

const options = parseArgs(process.argv.slice(2));
const digest = readCacheJson(options.ref, 'digest.json');
const storyStore = readCacheJson(options.ref, 'stories.json');
const rawNew = readOptionalCacheJson(options.ref, 'raw-new.json');
const currentsApi = readOptionalCacheJson(options.ref, 'currents-api.json');

const storedStories = Object.values(storyStore.stories || {});
const storedById = new Map(storedStories.filter(story => story.id).map(story => [story.id, story]));
const storedByUrl = new Map(storedStories.map(story => [normaliseUrl(story.url), story]).filter(([key]) => key));
function enrichStory(story) {
  const stored = storedById.get(story.id) || storedByUrl.get(normaliseUrl(story.url));
  return {
    ...stored,
    ...story,
    bodyText: richestText(story.bodyText, story.content, story.description, stored?.bodyText, stored?.content, stored?.description),
  };
}

const ingested = [];
for (const cluster of digest.clusters || []) {
  for (const story of cluster.stories || []) ingested.push(enrichStory(story));
}
for (const story of storedStories) ingested.push(enrichStory(story));
if (Array.isArray(rawNew)) ingested.push(...rawNew.map(enrichStory));
if (Array.isArray(currentsApi?.news)) ingested.push(...currentsApi.news.map(enrichStory));

const { items: stories, droppedById, droppedByUrl } = dedupStories(ingested);
const bySource = new Map();
for (const story of stories) {
  if (!cleanText(story.title)) continue;
  const key = canonicalSourceKey(story.url);
  if (!key) continue;
  if (!bySource.has(key)) bySource.set(key, []);
  bySource.get(key).push(story);
}

const baseLabels = new Map();
const labelCounts = new Map();
for (const [key, sourceStories] of bySource) {
  const label = labelForSource(key, sourceStories);
  baseLabels.set(key, label);
  labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
}
function displayLabel(key) {
  const label = baseLabels.get(key) || key;
  return labelCounts.get(label) > 1 ? key : label;
}

const { blocks, exact } = flattenRelationTree();
const unmatchedKeys = [];
for (const key of bySource.keys()) {
  const block = findRelationBlock(key, exact);
  if (block) block.keys.push(key);
  else unmatchedKeys.push(key);
}

const sourceBlockCache = new Map();
function sourceBlockFor(key) {
  if (!sourceBlockCache.has(key)) {
    const sourceStories = bySource.get(key) || [];
    const headlines = headlinesFor(sourceStories);
    const label = displayLabel(key);
    sourceBlockCache.set(key, headlines.length ? `SOURCE: ${label}\n${headlines.join('\n')}` : '');
  }
  return sourceBlockCache.get(key);
}

for (const block of blocks) {
  block.keys.sort((a, b) => {
    const rank = keyRankInBlock(a, block) - keyRankInBlock(b, block);
    if (rank) return rank;
    return displayLabel(a).localeCompare(displayLabel(b)) || a.localeCompare(b);
  });
}
unmatchedKeys.sort((a, b) => displayLabel(a).localeCompare(displayLabel(b)) || a.localeCompare(b));

const files = [];
let fileIndex = 1;
for (const root of SOURCE_RELATION_TREE) {
  const rootBlocks = blocks
    .filter(block => block.root === root.label)
    .map(block => block.keys.map(sourceBlockFor).filter(Boolean).join('\n'))
    .filter(Boolean);
  if (!rootBlocks.length) continue;
  const filename = `${String(fileIndex++).padStart(2, '0')}-${slugify(root.label)}.md`;
  files.push({ filename, content: rootBlocks.join('\n\n') + '\n' });
}

const unmatchedBlocks = unmatchedKeys.map(sourceBlockFor).filter(Boolean);
if (unmatchedBlocks.length) {
  files.push({ filename: '99-unmatched-sources.md', content: unmatchedBlocks.join('\n') + '\n' });
}

function markdownLink(key) {
  return `[${displayLabel(key)}](https://${key})`;
}

function humaniseField(field) {
  return field.replace(/_/g, ' ').replace(/^./, char => char.toUpperCase());
}

function linkList(links) {
  return (links || []).map(link => `[${link.label}](${link.url})`).join('; ');
}

function profileForKey(key) {
  if (SOURCE_PROFILES[key]) return SOURCE_PROFILES[key];
  const host = baseHost(key);
  const platform = platformOfHost(host);
  const isTenant = key.includes('/') || (platform && host !== platform);
  if (isTenant) return null;
  if (SOURCE_PROFILES[host]) return SOURCE_PROFILES[host];
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (SOURCE_PROFILES[parent]) return SOURCE_PROFILES[parent];
  }
  return null;
}

function collectMemberships() {
  const memberships = new Map();
  const add = (source, path) => {
    if (!memberships.has(source)) memberships.set(source, []);
    memberships.get(source).push(path.join(' / '));
  };
  const walk = (node, ancestors = []) => {
    const path = [...ancestors, node.label];
    for (const source of node.sources || []) add(source, path);
    for (const child of node.children || []) walk(child, path);
  };
  SOURCE_RELATION_TREE.forEach(root => walk(root));
  return memberships;
}

const membershipsBySource = collectMemberships();
function membershipsFor(key) {
  const direct = membershipsBySource.get(key) || membershipsBySource.get(baseHost(key));
  if (direct?.length) return direct;
  const block = findRelationBlock(key, exact);
  return block ? [block.path.join(' / ')] : [];
}

function appendProfileDetails(lines, profile) {
  const handled = new Set(['properties', 'watch', 'caution', 'links', 'flags']);
  for (const field of ['kind', 'ownership', 'history', 'model', 'governance', 'leaning']) {
    handled.add(field);
    if (profile[field]) lines.push(`  - ${humaniseField(field)}: ${cleanText(profile[field])}`);
  }
  for (const field of ['properties', 'watch', 'caution']) {
    if (!profile[field]?.length) continue;
    lines.push(`  - ${humaniseField(field)}:`);
    for (const item of profile[field]) lines.push(`    - ${cleanText(item)}`);
  }
  if (profile.links?.length) lines.push(`  - Links: ${linkList(profile.links)}`);
  if (profile.flags?.length) {
    lines.push('  - Flags:');
    for (const flag of profile.flags) {
      lines.push(`    - **${cleanText(flag.label)}** — ${cleanText(flag.note)}`);
      if (flag.links?.length) lines.push(`      - Evidence: ${linkList(flag.links)}`);
    }
  }
  for (const [field, value] of Object.entries(profile)) {
    if (handled.has(field) || value == null || value === '') continue;
    if (typeof value === 'string') lines.push(`  - ${humaniseField(field)}: ${cleanText(value)}`);
    else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      lines.push(`  - ${humaniseField(field)}:`);
      for (const item of value) lines.push(`    - ${cleanText(item)}`);
    } else {
      lines.push(`  - ${humaniseField(field)}: \`${JSON.stringify(value)}\``);
    }
  }
}

function appendBranchDetails(lines, profile, noun) {
  if (!profile) return;
  lines.push(`- What we know about this ${noun}:`);
  if (profile.summary) lines.push(`  - Summary: ${cleanText(profile.summary)}`);
  if (profile.watch?.length) {
    lines.push('  - Watch:');
    for (const item of profile.watch) lines.push(`    - ${cleanText(item)}`);
  }
  if (profile.links?.length) lines.push(`  - Links: ${linkList(profile.links)}`);
}

function manifestEntry(key) {
  const sourceStories = bySource.get(key) || [];
  const headlineCount = headlinesFor(sourceStories).length;
  const lines = [
    `#### ${markdownLink(key)}`,
    '',
    `- Key: \`${key}\``,
    `- Cache evidence: ${sourceStories.length} ${sourceStories.length === 1 ? 'story' : 'stories'} / ${headlineCount} unique ${headlineCount === 1 ? 'headline' : 'headlines'} in this export`,
  ];
  const memberships = membershipsFor(key);
  if (memberships.length) {
    lines.push('- Relations:');
    for (const membership of memberships) lines.push(`  - ${membership}`);
  } else {
    lines.push('- Relations: no curated relation');
  }
  const profile = profileForKey(key);
  if (!profile) {
    lines.push('- What we know: no curated source profile yet');
  } else {
    lines.push('- What we know:');
    appendProfileDetails(lines, profile);
  }
  lines.push('');
  return lines;
}

const manifest = [
  '# Sources manifest',
  '',
  'Each entry dumps the curated profile evidence currently held for that source, plus its relation-tree memberships and cache presence. `No curated source profile yet` marks a gap rather than a judgement that the source is unimportant.',
  '',
];
for (const root of SOURCE_RELATION_TREE) {
  const rootBlocks = blocks.filter(block => block.root === root.label && block.keys.length);
  if (!rootBlocks.length) continue;
  manifest.push(`## ${root.label}`, '');
  appendBranchDetails(manifest, BRANCH_PROFILES[root.id], 'branch');
  if (BRANCH_PROFILES[root.id]) manifest.push('');
  for (const block of rootBlocks) {
    const groupPath = block.path.slice(1).join(' / ') || root.label;
    manifest.push(`### ${groupPath}`, '');
    appendBranchDetails(manifest, BRANCH_PROFILES[block.id], 'source-group');
    if (BRANCH_PROFILES[block.id]) manifest.push('');
    for (const key of block.keys) manifest.push(...manifestEntry(key));
  }
}
if (unmatchedKeys.length) {
  manifest.push('## Unmatched sources', '');
  for (const key of unmatchedKeys) manifest.push(...manifestEntry(key));
}
files.push({ filename: 'sources-manifest.md', content: manifest.join('\n') });

const headlineRows = [];
for (const key of bySource.keys()) {
  const block = findRelationBlock(key, exact);
  const profile = profileForKey(key);
  const memberships = membershipsFor(key);
  const base = {
    source_key: key,
    source: displayLabel(key),
    tree_root: block?.root || 'Unmatched sources',
    tree_root_id: block?.rootId || 'unmatched',
    branch_path: block ? block.path.slice(1).join(' / ') : '',
    relation_memberships: memberships,
    curated_group: block ? block.path[block.path.length - 1] : 'Unmatched sources',
    profiled: Boolean(profile),
    profile_kind: profile?.kind || '',
    profile_model: profile?.model || '',
    profile_ownership: profile?.ownership || '',
  };
  for (const { title, story } of uniqueHeadlineStoriesFor(bySource.get(key) || [])) {
    headlineRows.push({
      ...base,
      headline: title,
      body_text: bodyTextFor(story),
      story_id: story.id || '',
      url: story.url || '',
      published: story.published || '',
      first_seen: story.firstSeen || '',
      last_seen: story.lastSeen || '',
      last_updated: story.lastUpdated || '',
      category: story.category || '',
      story_type: story.storyType || '',
      word_count: story.wordCount || null,
      plugin: story.plugin || '',
    });
  }
}
files.push({
  filename: 'headline-rows.jsonl',
  content: headlineRows.map(row => JSON.stringify(row)).join('\n') + '\n',
});

const sourceCount = bySource.size;
const headlineCount = [...bySource.values()].reduce((total, sourceStories) => total + headlinesFor(sourceStories).length, 0);
const readme = [
  '# Source headlines export',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Cache ref: ${options.ref}`,
  `Digest date: ${digest.date || 'unknown'}`,
  '',
  'Format: `SOURCE: name` followed by one newest-first headline per line. Related sources continue directly after the previous source block; blank lines separate source-groups in the relation tree. `99-unmatched-sources.md` uses single line breaks throughout because no curated relation is known.',
  '`sources-manifest.md` lists every source with cache counts, relation-tree memberships, branch/group notes, curated profile fields, trust flags and evidence links. `No curated source profile yet` marks a knowledge gap for later gap-filling. `headline-rows.jsonl` is the machine-readable analysis input: one row per source/unique headline with canonical source key, URL, timestamps, relation memberships, curated profile context, and the available body/summary text (capped at 2,000 characters).',
  '',
  `Input stories from digest.json, stories.json, raw-new.json, and currents-api.json: ${ingested.length}; after id/URL dedupe: ${stories.length} (${droppedById} duplicate ids, ${droppedByUrl} duplicate URLs).`,
  `Sources: ${sourceCount}; matched to relation tree: ${sourceCount - unmatchedKeys.length}; unmatched: ${unmatchedKeys.length}; unique headlines per source: ${headlineCount}.`,
  'Cross-member relation-tree sources are emitted once only. State-control membership takes priority over geographic cross-membership; other duplicates use their first depth-first tree position.',
  '',
].join('\n');
files.unshift({ filename: 'README.md', content: readme });

const defaultName = `source-headlines-${digest.date || new Date().toISOString().slice(0, 10)}.zip`;
const zipPath = path.resolve(repoRoot, options.out || path.join('.working', defaultName));
fs.mkdirSync(path.dirname(zipPath), { recursive: true });
fs.rmSync(zipPath, { force: true });

const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'source-headlines-'));
try {
  const filenames = [];
  for (const file of files) {
    fs.writeFileSync(path.join(staging, file.filename), file.content);
    filenames.push(file.filename);
  }
  execFileSync('zip', ['-q', '-j', zipPath, ...filenames], { cwd: staging });
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}

console.log(JSON.stringify({
  zip: zipPath,
  files: files.map(f => f.filename),
  sources: sourceCount,
  matchedSources: sourceCount - unmatchedKeys.length,
  unmatchedSources: unmatchedKeys.length,
  headlines: headlineCount,
  headlineRows: headlineRows.length,
  inputStories: ingested.length,
  dedupedStories: stories.length,
}, null, 2));

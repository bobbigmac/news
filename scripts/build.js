import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = 'cache';
const DIGEST_FILE = join(CACHE_DIR, 'digest.json');
const RUN_LOG_FILE = join(CACHE_DIR, 'run-log.json');
const OUT_DIR = 'docs';

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

function copyStatic(file) {
  const src = join('src', file);
  if (existsSync(src)) copyFileSync(src, join(OUT_DIR, file));
}

mkdirSync(OUT_DIR, { recursive: true });

const digest = loadJson(DIGEST_FILE, { date: new Date().toISOString().split('T')[0], clusters: [] });

// Gather pipeline stats for the data panel
const storyStore = loadJson(join(CACHE_DIR, 'stories.json'), { stories: {} });
const summarisedIds = loadJson(join(CACHE_DIR, 'summarised-ids.json'), []);
const totalStories = Object.keys(storyStore.stories || {}).length;
const summarised = summarisedIds.length;
const inDigest = digest.clusters.reduce((a, c) => a + (c.stories?.length || 0), 0);
digest.pipelineStats = {
  totalStories,
  summarised,
  unsummarised: totalStories - summarised,
  inDigest,
  clusters: digest.clusters.length,
};

// Sort clusters: most stories first, then by most recent update
digest.clusters.sort((a, b) => {
  const aCount = a.stories?.length || 0;
  const bCount = b.stories?.length || 0;
  if (bCount !== aCount) return bCount - aCount;
  const aDate = a.updated || a.created || '';
  const bDate = b.updated || b.created || '';
  return bDate.localeCompare(aDate);
});

// Write digest.json for client-side consumption
writeFileSync(join(OUT_DIR, 'digest.json'), JSON.stringify(digest, null, 2));

// Write run-log.json if it exists
const runLog = loadJson(RUN_LOG_FILE, []);
writeFileSync(join(OUT_DIR, 'run-log.json'), JSON.stringify(runLog, null, 2));

// Copy static assets
copyStatic('index.html');
copyStatic('style.css');
copyStatic('app.js');
copyStatic('og-image.jpg');
copyStatic('sw.js');

console.log(`Build complete. ${digest.clusters.length} clusters written to ${OUT_DIR}/digest.json`);

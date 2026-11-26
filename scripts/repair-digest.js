// ONE-OFF MIGRATION — not part of the pipeline. Run manually with:
//   node scripts/repair-digest.js
// Repairs damage caused by pipeline bugs fixed at the ingest boundary
// (truncation at 200 chars with fake ellipses, raw feed markup baked into
// summaries, double-encoded entities, description/content duplicated into
// the summary join). Once the cache is clean this script has no work to do
// and should be deleted rather than kept around as permanent machinery.
import { loadJson, saveJson } from './cache-io.js';
import { toPlainText } from './plain-text.js';
import { join } from 'path';

const CACHE_DIR = 'cache';
const DIGEST_FILE = join(CACHE_DIR, 'digest.json');

const digest = loadJson(DIGEST_FILE, { clusters: [] });
const store = loadJson(join(CACHE_DIR, 'stories.json'), { stories: {} }).stories || {};

// Reconstruct what the cluster copy SHOULD have been: lead title plus
// description/content as plain text, parts that contain earlier parts
// wholesale (Techmeme card structure) or repeat them dropped.
const fullSourceText = (story) => {
  const parts = [];
  for (const part of [story?.title, story?.description, story?.content]) {
    const text = toPlainText(part || '');
    if (!text) continue;
    if (parts.some(existing => existing === text || existing.startsWith(text) || text.includes(existing))) continue;
    parts.push(text);
  }
  return parts.join(' — ');
};

let repaired = 0;
let backfilled = 0;
let unrecoverable = 0;

for (const c of digest.clusters) {
  for (const story of c.stories || []) {
    const stored = store[story.id];
    if (!stored) continue;
    if (!(story.description || '').trim() && (stored.description || '').trim()) {
      story.description = toPlainText(stored.description);
      backfilled++;
    }
    if (!(story.content || '').trim() && (stored.content || '').trim()) {
      story.content = toPlainText(stored.content);
    }
  }

  const summary = (c.summary || '').trim();
  if (!summary) continue;
  const lead = c.stories?.[0];
  if (!lead) continue;
  const storedLead = store[lead.id];

  // Damage markers: mechanical truncation, markup injection, entity junk,
  // or self-duplication from the broken join.
  const hasMarkup = /<[a-zA-Z][^>]*>/.test(summary);
  const hasEntities = /&(nbsp|mdash|amp|lt|gt|quot);/.test(summary);
  const isEllipsed = summary.endsWith('...');
  const half = summary.slice(0, Math.floor(summary.length / 2));
  const selfDuplicates = half.length > 60 && summary.indexOf(half, 10) > 10;
  if (!hasMarkup && !hasEntities && !isEllipsed && !selfDuplicates) continue;

  // Proof it is source-derived copy (never LLM editorial copy): the summary
  // must begin with the exact lead story title, since fallback copy was
  // always built as title-first joins.
  const leadTitle = toPlainText(lead.title || storedLead?.title || '');
  if (!leadTitle || !toPlainText(summary).startsWith(leadTitle.slice(0, 40))) continue;

  const fullText = fullSourceText({
    title: lead.title || storedLead?.title,
    description: lead.description || storedLead?.description,
    content: lead.content || storedLead?.content,
  });
  if (!fullText || fullText === summary) {
    if (!fullText) unrecoverable++;
    continue;
  }
  c.summary = fullText;
  delete c.shortSummary;
  repaired++;
}

console.log(`Repaired ${repaired} damaged summaries`);
if (backfilled) console.log(`Backfilled source text on ${backfilled} digest stories`);
if (unrecoverable) console.log(`${unrecoverable} clusters damaged but no source text recoverable`);

if (repaired || backfilled) {
  saveJson(DIGEST_FILE, digest);
  console.log('digest.json written');
} else {
  console.log('nothing to do');
}

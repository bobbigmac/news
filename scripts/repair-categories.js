// One-off migration (NOT part of the build — run once, then it can go):
// repairs singleton categories poisoned by the plugin-provenance bug.
//
// The bug: plugin keyword matches ('dark souls' etc.) carried the plugin name
// as a structural tag, and the category graph counted that tag as content
// evidence — so spiritual/film/lifestyle stories self-certified as Gaming.
// The corrections in category-corrections.json were produced by READING all
// 415 Gaming-classified plugin singletons (LLM editorial judgement, not
// keyword heuristics) and reassigning the false positives.
//
// Going forward this can't recur: singletons now get categorised in the
// clickbait-screening LLM call (prompts.js), and plugin ingestion verifies
// the exact phrase (fetch-news.js).
//
// Usage: node scripts/repair-categories.js [path-to-digest.json]
import { readFileSync, writeFileSync } from 'fs';

const digestPath = process.argv[2] || 'cache/digest.json';
const corrections = JSON.parse(readFileSync(new URL('./category-corrections.json', import.meta.url), 'utf8'));

const digest = JSON.parse(readFileSync(digestPath, 'utf8'));
let applied = 0;
for (const c of digest.clusters || []) {
  const fix = corrections[c.id];
  if (fix && c.category !== fix) {
    c.category = fix;
    applied++;
  }
}
writeFileSync(digestPath, JSON.stringify(digest));
console.log(`repair-categories: ${applied} of ${Object.keys(corrections).length} corrections applied to ${digestPath}`);

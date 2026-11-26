// Server-side story-group assignment.
//
// Runs in the pipeline (build.js) so clients never index partial strings:
// every cluster is matched ONCE against the curated story-relation tree and
// the winning node is written onto the cluster as `storyGroup`. Because this
// runs at build time over the whole digest, tree edits apply retroactively —
// the dataset stays portable and updatable rather than baked per-run.
//
// Matching is word-set based, never char-substring:
//   - a tree term matches a cluster tag when every content word of the term
//     matches a distinct word of the tag ("ai" matches "ai in farming")
//   - longer terms win: "ai farming" beats "ai" for the same cluster
//   - light levenshtein per word ("closest match with fewest changes"):
//     1 edit for words >= 5 chars, 2 for >= 8 — covers plurals and morphology
//     without substring-style false positives
//   - primary branches always beat pivots; ties break by fewer edits, then
//     deeper node, then tree order

import { STORY_RELATION_TREE } from '../src/story-tree.js';

const MATCH_STOPWORDS = new Set([
  'in', 'of', 'the', 'a', 'an', 'on', 'for', 'and', 'at', 'to', 'by', 'with',
  'from', 'as', 'is', 'are', 'was', 'were', 'be', 'or', 'vs', 'vs.', 'into',
  'over', 'under', 'after', 'before', 'during', 'new',
]);

export function normalizeWords(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => (w.length >= 2 || /^\d+$/.test(w)) && !MATCH_STOPWORDS.has(w));
}

// Light stem for index keys only — full levenshtein decides the real match.
function stemKey(word) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function levenshtein(a, b, cap) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

function wordEdits(a, b) {
  if (a === b) return 0;
  const len = Math.max(a.length, b.length);
  const allowed = len >= 8 ? 2 : len >= 5 ? 1 : 0;
  if (!allowed) return Infinity;
  const d = levenshtein(a, b, allowed);
  return d <= allowed ? d : Infinity;
}

const wordEditsCache = new Map();
function wordEditsCached(a, b) {
  const key = `${a}|${b}`;
  if (!wordEditsCache.has(key)) wordEditsCache.set(key, wordEdits(a, b));
  return wordEditsCache.get(key);
}

// Match every term word against a distinct vocab word (injective, greedy on
// best-edits). Returns total edits, or Infinity when any word fails.
function matchTermWords(termWords, vocabWords) {
  // fast path: exact word-set containment needs no edit arithmetic at all
  if (termWords.every(word => vocabWords.includes(word))) return 0;
  const used = new Array(vocabWords.length).fill(false);
  let edits = 0;
  // match the rarest words first so common words can't steal their only pair
  const order = termWords
    .map((word, index) => ({ word, index, best: Math.min(...vocabWords.map(v => wordEditsCached(word, v))) }))
    .sort((a, b) => a.best - b.best);
  for (const { word } of order) {
    let bestIdx = -1;
    let bestEdits = Infinity;
    for (let i = 0; i < vocabWords.length; i++) {
      if (used[i]) continue;
      const d = wordEditsCached(word, vocabWords[i]);
      if (d < bestEdits) { bestEdits = d; bestIdx = i; }
      if (d === 0) break;
    }
    if (bestIdx < 0 || bestEdits === Infinity) return Infinity;
    used[bestIdx] = true;
    edits += bestEdits;
  }
  return edits;
}

// --- tree indexing -----------------------------------------------------------

function flattenTree() {
  const nodes = [];
  const walk = (node, path, root, depth) => {
    nodes.push({ node, path, root, depth });
    for (const child of node.children || []) walk(child, [...path, child.label], root, depth + 1);
  };
  for (const root of STORY_RELATION_TREE) walk(root, [root.label], root, 0);
  return nodes;
}

const ALL_NODES = flattenTree();

// word stem -> candidate term entries. Candidates are verified fully later;
// the index only narrows the field.
const TERM_INDEX = new Map();
const TERM_ENTRIES = [];
for (const entry of ALL_NODES) {
  for (const term of entry.node.terms || []) {
    const words = normalizeWords(term);
    if (!words.length) continue;
    const rec = { entry, term, words, headlineOnly: false };
    TERM_ENTRIES.push(rec);
    for (const word of new Set(words.map(stemKey))) {
      if (!TERM_INDEX.has(word)) TERM_INDEX.set(word, []);
      TERM_INDEX.get(word).push(rec);
    }
  }
  for (const term of entry.node.headlineTerms || []) {
    const words = normalizeWords(term);
    if (!words.length) continue;
    const rec = { entry, term, words, headlineOnly: true };
    TERM_ENTRIES.push(rec);
    for (const word of new Set(words.map(stemKey))) {
      if (!TERM_INDEX.has(word)) TERM_INDEX.set(word, []);
      TERM_INDEX.get(word).push(rec);
    }
  }
}

export function clusterVocab(cluster) {
  const curated = [
    ...(cluster.tags || []),
    ...(cluster.triggerWords || []),
    ...(cluster.keywords || []),
  ];
  const entities = Object.values(cluster.entities || {}).flat();
  const entries = [];
  const seen = new Set();
  for (const [values, curatedSource] of [[curated, true], [entities, false]]) {
    for (const value of values) {
      const words = normalizeWords(value);
      if (!words.length) continue;
      const key = words.join(' ');
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ words, curated: curatedSource });
    }
  }
  return entries;
}

// Find the best tree node for one cluster. Returns
// { id, label, path, term, words, edits } or null.
export function matchClusterToTree(cluster) {
  const vocab = clusterVocab(cluster);
  const headlineWords = normalizeWords(cluster.headline || '');
  if (!vocab.length && !headlineWords.length) return null;

  // gather candidate terms sharing at least one stemmed word with the cluster
  const candidates = new Set();
  const stemmedClusterWords = new Set();
  for (const wordList of [...vocab.map(entry => entry.words), headlineWords]) {
    for (const word of wordList) stemmedClusterWords.add(stemKey(word));
  }
  for (const stem of stemmedClusterWords) {
    for (const rec of TERM_INDEX.get(stem) || []) candidates.add(rec);
  }
  if (!candidates.size) return null;

  // verify each candidate term against the cluster vocab (and headline for
  // multi-word terms / curated headlineTerms)
  const nodeScores = new Map(); // node entry -> best { words, edits, term }
  for (const rec of candidates) {
    let bestEdits = Infinity;
    const multiWord = rec.words.length > 1;
    for (const entryVocab of vocab) {
      if (rec.headlineOnly) break;
      const { words, curated } = entryVocab;
      if (words.length < rec.words.length) continue;
      // strict-subset matching (term smaller than the entry) is licensed only
      // for curated vocab; noisy entities must match the whole entry
      if (!curated && words.length !== rec.words.length) continue;
      const edits = matchTermWords(rec.words, words);
      if (edits < bestEdits) bestEdits = edits;
      if (bestEdits === 0 && rec.words.length === words.length) break;
    }
    if (headlineWords.length >= rec.words.length && (multiWord || rec.headlineOnly)) {
      const edits = matchTermWords(rec.words, headlineWords);
      if (edits < bestEdits) bestEdits = edits;
    }
    if (bestEdits === Infinity) continue;
    // multi-word terms may be loose but not sloppy: total edits must stay
    // below the word count; single words obey their own per-word cap already
    if (bestEdits >= rec.words.length && rec.words.length > 1) continue;
    const prev = nodeScores.get(rec.entry);
    const score = { words: rec.words.length, edits: bestEdits, term: rec.term, evidence: 1 };
    if (!prev) {
      nodeScores.set(rec.entry, score);
    } else {
      prev.evidence += 1;
      if (score.words > prev.words || (score.words === prev.words && score.edits < prev.edits)) {
        score.evidence = prev.evidence;
        nodeScores.set(rec.entry, score);
      }
    }
  }
  if (!nodeScores.size) return null;

  // Ranking: the most specific match wins across the whole tree — a two-word
  // pivot match ("flash flood") is genuinely more informative than a one-word
  // primary match, so pivot branches lose only TIES, not automatically. Tie
  // order: fewer edits, more corroborating terms, primaries over pivots,
  // deeper nodes, then tree order.
  let best = null;
  for (const [entry, score] of nodeScores) {
    const pivot = entry.root.pivot === true || entry.root.id === 'pivots';
    const rank = { entry, score, pivot };
    if (!best) { best = rank; continue; }
    const better =
      rank.score.words > best.score.words ||
      (rank.score.words === best.score.words && rank.score.edits < best.score.edits) ||
      (rank.score.words === best.score.words && rank.score.edits === best.score.edits && rank.score.evidence > best.score.evidence) ||
      (rank.score.words === best.score.words && rank.score.edits === best.score.edits && rank.score.evidence === best.score.evidence && !rank.pivot && best.pivot) ||
      (rank.score.words === best.score.words && rank.score.edits === best.score.edits && rank.score.evidence === best.score.evidence && rank.pivot === best.pivot && rank.entry.depth > best.entry.depth);
    if (better) best = rank;
  }
  if (!best) return null;
  const { entry, score } = best;
  return {
    id: entry.node.id,
    label: entry.node.label,
    path: entry.path,
    term: score.term,
    words: score.words,
    edits: score.edits,
  };
}

// Assign story groups across a whole digest, in place. Returns counts.
export function assignStoryGroupsToDigest(digest) {
  const clusters = digest.clusters || [];
  let assigned = 0;
  let fuzzy = 0;
  for (const cluster of clusters) {
    const match = matchClusterToTree(cluster);
    if (match) {
      cluster.storyGroup = {
        id: match.id,
        label: match.label,
        path: match.path,
        term: match.term,
      };
      assigned++;
      if (match.edits > 0) fuzzy++;
    } else {
      delete cluster.storyGroup;
    }
  }
  return { assigned, fuzzy, total: clusters.length };
}

// Topic-based category classification.
//
// Newspapers use vague categories (Politics, Business, Technology) because
// they cover everything and appeal to everyone. We have specific sources and
// a specific user — we can be more precise about what stories are actually
// about.
//
// Each category has a weighted keyword graph. A story's tags, trigger words,
// headline, and summary are checked against all categories. The category with
// the highest total weight wins. This is more accurate than the LLM's
// single-shot categorisation because:
//   1. We can tune the keyword weights based on what actually appears
//   2. We can handle edge cases (gaming != technology, celebrity != entertainment)
//   3. It's deterministic — same input always gets same output
//   4. It doesn't cost an LLM call
//
// The LLM still suggests a category, but this module overrides it when the
// keyword graph disagrees. This catches the common mislabelling patterns.
//
// Design principles:
//   - Use GENERAL pattern keywords, not specific names (no "makai lemon")
//   - Weight by discriminative power: "console" is more discriminative than "game"
//   - Order matters: more specific categories checked before broader ones
//   - Every keyword should be a word that would rarely appear in a non-matching story

import { CATEGORY_GRAPH } from './category-graph.js';

const CANONICAL_CATEGORY_KEYS = new Map(
  Object.keys(CATEGORY_GRAPH).map(category => [category.toLowerCase(), category])
);
const CATEGORY_ALIASES = new Map([
  ['sports', 'sport'],
]);

export function canonicalCategory(category) {
  const raw = Array.isArray(category) ? category[0] : category;
  const cleaned = String(raw || 'Other').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Other';
  const key = cleaned.toLowerCase();
  const canonical = CANONICAL_CATEGORY_KEYS.get(CATEGORY_ALIASES.get(key) || key);
  if (canonical) return canonical;
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Builds the text the graph matches against. We include headline, summary,
// tags, trigger words, and story titles — but EXCLUDE structural provenance:
// - the LLM's own category label (matching it would reinforce the choice
//   we're trying to override)
// - plugin names ('xbox', 'gaming') — attached because the story arrived
//   through that plugin's keyword search; says nothing about what the story
//   is ABOUT, and counting it means every false-positive API keyword match
//   (a spiritual article containing the phrase "dark souls") self-certifies
//   as Gaming
// - ALL category names — tags.js prepends the category label into every
//   cluster's tags, so any category keyword in tags is provenance too, and
//   a stale/overridden label leaks as evidence for a DIFFERENT category
// Shared by classification and evidence validation so both see exactly the
// same content.
function classificationText(cluster) {
  const llmCategory = (Array.isArray(cluster.category) ? cluster.category[0] : cluster.category || '').toLowerCase();
  const pluginNames = new Set(
    (cluster.stories || []).map(s => (s.plugin || '').toLowerCase()).filter(Boolean)
  );
  const categoryNames = new Set([...CANONICAL_CATEGORY_KEYS.keys(), 'sports']);
  const tags = (cluster.tags || []).filter(t => {
    const tag = t.toLowerCase();
    return tag !== llmCategory && !pluginNames.has(tag) && !categoryNames.has(tag);
  });

  return [
    cluster.headline || '',
    cluster.summary || '',
    ...tags,
    ...(cluster.triggerWords || []),
    ...(cluster.stories || []).slice(0, 3).map(s => s.title || s.originalTitle || ''),
  ].join(' ').toLowerCase();
}

function keywordPattern(keyword) {
  return keyword.length <= 3
    ? new RegExp(`\\b${keyword}\\b`, 'i')
    : new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

// Does a category have ANY graph evidence in this cluster's actual content?
// Used to validate stored categories — a category backed only by structural
// provenance is noise, not a classification.
export function hasCategoryEvidence(cluster, category) {
  const key = (Array.isArray(category) ? category[0] : category || '').toLowerCase();
  const canonical = CANONICAL_CATEGORY_KEYS.get(CATEGORY_ALIASES.get(key) || key);
  if (!canonical) return false;
  const def = CATEGORY_GRAPH[canonical];
  if (!def) return false;
  const text = classificationText(cluster);
  return Object.keys(def.keywords).some(keyword => keywordPattern(keyword).test(text));
}

// Classify a cluster into a category using the keyword graph.
// Returns { category, score, matchedKeywords }
export function classifyCategory(cluster) {
  const text = classificationText(cluster);

  const scores = {};
  const matched = {};

  for (const [category, def] of Object.entries(CATEGORY_GRAPH)) {
    let score = 0;
    const matches = [];
    for (const [keyword, weight] of Object.entries(def.keywords)) {
      // Use word boundary matching for short keywords, substring for longer
      if (keywordPattern(keyword).test(text)) {
        score += weight * def.weight;
        matches.push(keyword);
      }
    }
    if (score > 0) {
      scores[category] = score;
      matched[category] = matches;
    }
  }

  // Find the best category
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0 || sorted[0][1] < 2) {
    return { category: null, score: 0, matchedKeywords: [] };
  }

  const [category, score] = sorted[0];
  return { category, score, matchedKeywords: matched[category] };
}

// Recategorise a cluster if the keyword graph strongly disagrees with the
// LLM's category. Only override when the keyword graph score is confident
// (>= 5) and points to a different category than the LLM chose.
// If the graph agrees with the LLM, we just normalise the casing (e.g.
// "sports" -> "Sport") even at a lower score.
export function recategoriseCluster(cluster) {
  const result = classifyCategory(cluster);

  const current = Array.isArray(cluster.category)
    ? cluster.category[0]
    : cluster.category || '';
  const currentLower = current.toLowerCase();

  // Map old categories to new ones for comparison.
  // Handle common singular/plural mismatches (sports -> sport).
  const pluralMap = { 'sports': 'sport', 'entertainment': 'celebrity' };
  const currentNormalised = pluralMap[currentLower] || currentLower;

  if (result.category && result.category.toLowerCase() === currentNormalised) {
    // Graph agrees with LLM — just normalise casing
    if (cluster.category !== result.category) {
      cluster.category = result.category;
      return true;
    }
    return false;
  }

  // Graph disagrees — only override if confident
  if (result.category && result.score >= 5) {
    cluster.category = result.category;
    return true;
  }
  return false;
}

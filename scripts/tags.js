// Shared tag computation (compromise NER + TF-IDF).
// Used by both summarise.js (after clustering) and build.js (to backfill any
// clusters missing tags). Tags are embedded as cluster.tags in the digest.
//
// Tags are designed for the interest-signal algorithm: they must be short,
// clean, specific terms that describe what a story is ABOUT — not sentence
// fragments, not source names, not generic words. The frontend weights tags
// by rarity (IDF), so clean specific tags are essential for good scoring.

import nlp from 'compromise';

const TAG_STOP_WORDS = new Set([
  'the','a','an','and','or','but','for','nor','yet','so','in','on','at','to','of','by','with','from',
  'as','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would',
  'could','should','may','might','must','can','this','that','these','those','it','its','they','them',
  'their','there','here','where','when','who','whom','whose','what','which','why','how','all','any',
  'each','few','more','most','other','some','such','no','not','only','own','same','than','too','very',
  'just','about','above','after','again','against','before','below','between','into','through','during',
  'over','under','further','once','said','says','say','one','two','also','new','now','well','even',
  'still','made','make','makes','making','get','got','go','goes','going','like','up','out','off','down',
  'back','way','want','wants','wanted','need','needs','needed','use','used','uses','using','know',
  'known','knows','think','thinks','thought','see','seen','sees','look','looks','looked','come','came',
  'comes','take','took','taken','takes','give','gave','given','gives','find','found','finds','tell',
  'told','tells','ask','asked','asks','seem','seems','seemed','feel','feels','felt','try','tries','tried',
  'let','lets','put','puts','set','sets','went','gone','news','report','according','year','years','day',
  'days','week','weeks','month','months','people','person','today','yesterday','tomorrow','last','first',
  'time','times','world','man','woman','men','women','child','children','city','town','country','state',
  'government','official','minister','spokesperson','police','court','judge','law','rule','plan','call',
  'reveal','announce','launch','release','confirm','deny','claim','warn','urge','seek','vow','press',
  'he','she','him','her','his','their','them','they','we','us','our','my','me','i','who','what','which',
  'sunday','monday','tuesday','wednesday','thursday','friday','saturday','weekend',
]);

// Clean a raw term into a tag-worthy string, or null if it should be discarded.
// Rules:
//   - Max 3 words (longer = sentence fragment, not a tag)
//   - No trailing/leading punctuation
//   - No standalone articles or prepositions as words within the phrase
//   - Strip possessives and trailing commas/periods
//   - Reject sentence fragments (hyphenated ages, mixed number-word patterns, etc.)
function cleanTerm(raw) {
  let t = raw.trim().toLowerCase();
  // Strip leading articles
  t = t.replace(/^(the|a|an)\s+/i, '');
  // Strip trailing punctuation (commas, periods, quotes, em-dashes, etc.)
  t = t.replace(/[.,;:!?"'()\[\]{}\u2013\u2014\u2019\u2018\u201c\u201d]+$/g, '');
  t = t.replace(/^[.,;:!?"'()\[\]{}\u2013\u2014\u2019\u2018\u201c\u201d]+/g, '');
  // Strip possessives
  t = t.replace(/['\u2019]s$/i, '');
  // Split into words and filter stop words from within the phrase
  let words = t.split(/\s+/).filter(w => w.length >= 2 && !TAG_STOP_WORDS.has(w));
  if (words.length === 0) return null;
  if (words.length > 3) return null; // too long = sentence fragment
  // Reject if any word is purely numeric
  if (words.every(w => /^\d+$/.test(w))) return null;
  // Reject terms with hyphenated age/number patterns (e.g. "thirty-five-year-old")
  if (/\b\w+-year-old\b/i.test(t)) return null;
  // Reject if any word starts with a digit AND is more than 2 chars (e.g. "1.5", "35-year-old")
  // but allow well-known identifiers like "gta 6", "ps5", "xbox"
  if (words.some(w => /^\d/.test(w) && w.length > 2 && !/^(ps\d|xbox|gta|amd|nvidia|ios|iphone|windows\d)$/.test(w))) return null;
  // Reject if it looks like a sentence fragment (contains verbs commonly found in headlines)
  const sentenceFragmentWords = new Set(['will','has','had','was','were','being','been','says','said','tells','told','asks','asked','urges','vows','seeks','warns','claims','confirms','denies','announces','launches','reveals','reports','according','consideration','under']);
  if (words.some(w => sentenceFragmentWords.has(w))) return null;
  // Reject single words that are too generic (common nouns that don't identify a topic)
  const tooGeneric = new Set(['policy','decision','development','situation','theater','theatre','critic','acting','insight','proposal','plan','call','report','review','update','change','move','step','action','effort','bid','push','rise','fall','boost','hit','cut','ban','law','rule','data','center','breach','ticket','fine']);
  if (words.length === 1 && tooGeneric.has(words[0])) return null;
  return words.join(' ');
}

function extractClusterTerms(cluster) {
  const text = [
    cluster.headline || '',
    cluster.summary || '',
    ...(cluster.stories || []).slice(0, 8).map(s => s.title || ''),
  ].join(' ');
  const doc = nlp(text);
  const terms = new Set();

  // Topics (proper nouns, places, organisations) — highest quality tags.
  // These can be multi-word (e.g. "New Brunswick", "Jason Kelce").
  doc.topics().out('array').forEach(t => {
    const cleaned = cleanTerm(t);
    if (cleaned) terms.add(cleaned);
  });

  // Nouns — only take SINGLE-WORD nouns. Multi-word noun phrases from
  // compromise are often sentence fragments ("property maintenance breach",
  // "confusion data center"). Single words are cleaner subject tags.
  doc.nouns().out('array').forEach(t => {
    // Only accept single-word nouns
    const wordCount = t.trim().split(/\s+/).length;
    if (wordCount !== 1) return;
    const cleaned = cleanTerm(t);
    if (cleaned && cleaned.length >= 3) {
      const singular = nlp(cleaned).nouns().toSingular().out('text') || cleaned;
      const cleanedSingular = cleanTerm(singular);
      if (cleanedSingular) terms.add(cleanedSingular);
    }
  });

  // Also include trigger words from the LLM — these are curated, specific,
  // and designed to identify the topic. High quality.
  for (const tw of (cluster.triggerWords || [])) {
    const cleaned = cleanTerm(tw);
    if (cleaned) terms.add(cleaned);
  }

  return [...terms];
}

// Compute TF-IDF-weighted tags for every cluster in the digest.
export function computeClusterTags(digest) {
  const clusters = digest.clusters || [];
  if (!clusters.length) return;
  const df = new Map();
  const clusterTerms = clusters.map(cluster => {
    const terms = extractClusterTerms(cluster);
    const seen = new Set();
    for (const term of terms) {
      if (!seen.has(term)) { seen.add(term); df.set(term, (df.get(term) || 0) + 1); }
    }
    return terms;
  });
  const docCount = clusters.length;
  clusters.forEach((cluster, i) => {
    const terms = clusterTerms[i];
    if (!terms.length) { cluster.tags = []; return; }
    const cat = Array.isArray(cluster.category) ? cluster.category[0] : cluster.category;
    const plugin = cluster.stories?.find(s => s.plugin)?.plugin;
    const structuralTags = [];
    if (cat && cat !== 'Other' && cat !== 'General') structuralTags.push(cat.toLowerCase());
    if (plugin) structuralTags.push(plugin.toLowerCase());
    const termFreq = new Map();
    for (const term of terms) termFreq.set(term, (termFreq.get(term) || 0) + 1);
    const scored = terms.map(term => {
      const tf = termFreq.get(term) / terms.length;
      const idf = Math.log(docCount / (df.get(term) || 1));
      return { term, score: tf * idf };
    });
    scored.sort((a, b) => b.score - a.score);
    const topTerms = scored.slice(0, 10).map(s => s.term);
    cluster.tags = [...new Set([...structuralTags, ...topTerms])].slice(0, 12);
  });
}

// Only compute tags for clusters that don't already have them. Used at build
// time to backfill clusters from older runs.
export function computeClusterTagsIfMissing(digest) {
  const clusters = digest.clusters || [];
  const missing = clusters.filter(c => !Array.isArray(c.tags) || !c.tags.length);
  if (!missing.length) return;
  // Compute over the full digest so IDF is well-calibrated, but only write
  // tags onto clusters that are missing them.
  const before = clusters.map(c => c.tags);
  computeClusterTags(digest);
  clusters.forEach((c, i) => { if (before[i] && before[i].length) c.tags = before[i]; });
  console.log(`Tags: backfilled ${missing.length} clusters missing tags`);
}

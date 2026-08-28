// Shared tag computation (compromise NER + TF-IDF).
// Used by both summarise.js (after clustering) and build.js (to backfill any
// clusters missing tags). Tags are embedded as cluster.tags in the digest.

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
  'time','times','world',
]);

function extractClusterTerms(cluster) {
  const text = [
    cluster.headline || '',
    cluster.summary || '',
    ...(cluster.stories || []).slice(0, 8).map(s => s.title || ''),
  ].join(' ');
  const doc = nlp(text);
  const terms = new Set();
  doc.topics().out('array').forEach(t => {
    const lt = t.toLowerCase().trim();
    if (lt && lt.length >= 2 && !TAG_STOP_WORDS.has(lt)) terms.add(lt);
  });
  doc.nouns().out('array').forEach(t => {
    const lt = t.toLowerCase().trim();
    if (lt.length >= 3 && !TAG_STOP_WORDS.has(lt) && !/^\d+$/.test(lt)) {
      const singular = nlp(lt).nouns().toSingular().out('text') || lt;
      terms.add(singular);
    }
  });
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

// Entity extraction and cross-cluster entity index.
//
// Uses compromise for lightweight NER (people, places, organisations) over
// each cluster's headline + summary + story titles, then builds an inverted
// index: entity -> [clusterIds]. This lets consumers navigate by entity
// (e.g. "all clusters mentioning Manchester") without scanning every cluster.
//
// All local — no API calls.

import nlp from 'compromise';

// Stoplist for entity terms that are noisy at this scale.
const ENTITY_STOP = new Set([
  'uk', 'us', 'eu', 'un', 'nhs', 'bbc', 'news', 'government', 'police',
  'minister', 'ministers', 'council', 'party', 'labour', 'tory', 'tories',
  'conservative', 'conservatives', 'republican', 'republicans', 'democrat',
  'democrats', 'photo', 'image', 'getty', 'reuters', 'pa', 'reporter',
  'correspondent', 'editor', 'today', 'yesterday', 'tomorrow', 'week', 'month',
  'year', 'years', 'day', 'days',
]);

function cleanTerm(t) {
  return (t || '').toLowerCase().trim().replace(/^the\s+/, '').replace(/[^a-z0-9\s'.-]/g, '').trim();
}

// Extract entities from a cluster. Returns { people, places, orgs } arrays
// (lowercased, deduped, stoplisted).
export function extractClusterEntities(cluster) {
  const text = [
    cluster.headline || '',
    cluster.summary || '',
    ...(cluster.stories || []).slice(0, 8).map(s => s.title || ''),
  ].join(' ');

  const doc = nlp(text);
  const collect = (fn) => {
    const out = new Set();
    fn(doc).out('array').forEach(t => {
      const c = cleanTerm(t);
      if (c && c.length >= 3 && !ENTITY_STOP.has(c) && !/^\d+$/.test(c)) out.add(c);
    });
    return [...out];
  };

  return {
    people: collect(d => d.people()),
    places: collect(d => d.places()),
    orgs: collect(d => d.organizations()),
  };
}

// Build the cross-cluster entity index from a digest.
// Returns: { entities: [{ name, type, clusterIds: [ids], count }], byName: Map }
export function buildEntityIndex(digest) {
  const clusters = digest.clusters || [];
  const byName = new Map(); // name -> { type, clusterIds: Set }

  for (const cluster of clusters) {
    const ents = extractClusterEntities(cluster);
    for (const [type, names] of Object.entries(ents)) {
      for (const name of names) {
        if (!byName.has(name)) byName.set(name, { name, type, clusterIds: new Set() });
        byName.get(name).clusterIds.add(cluster.id);
      }
    }
  }

  // Only keep entities that appear in at least 1 cluster; sort by coverage.
  const entities = [...byName.values()]
    .map(e => ({ name: e.name, type: e.type, clusterIds: [...e.clusterIds], count: e.clusterIds.size }))
    .filter(e => e.count >= 1)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { entities, byName };
}

// Attach an `entities` field to every cluster in the digest.
export function annotateClusters(digest) {
  for (const cluster of (digest.clusters || [])) {
    cluster.entities = extractClusterEntities(cluster);
  }
}

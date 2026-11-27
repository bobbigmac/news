import { getSourceName, platformOfHost, prettifySourceKey, sourceKeyFromUrl } from './sources.js';

import { SOURCE_LABELS } from '../src/source-labels.js';

export { SOURCE_LABELS };


export function collectSources(digest) {
  const byKey = new Map();
  for (const cluster of digest.clusters || []) {
    for (const story of cluster.stories || []) {
      const key = sourceKeyFromUrl(story.url);
      if (!key) continue;
      if (!byKey.has(key)) {
        const isTenant = key.includes('/') || platformOfHost(key) !== null;
        const authorLabel = isTenant && typeof story.source === 'string' && story.source.trim()
          ? story.source.trim()
          : null;
        byKey.set(key, {
          key,
          label: SOURCE_LABELS[key] || authorLabel || getSourceName(story.url) || prettifySourceKey(key),
          count: 0,
          newest: null,
          oldest: null,
        });
      }
      const entry = byKey.get(key);
      entry.count++;
      const ts = Date.parse(story.published || '');
      if (ts) {
        const iso = new Date(ts).toISOString();
        if (!entry.newest || iso > entry.newest) entry.newest = iso;
        if (!entry.oldest || iso < entry.oldest) entry.oldest = iso;
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

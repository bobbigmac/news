import { DIGEST_FILE, loadJson } from './cache-io.js';
import { enrichStory } from './story-enrich.js';
import { toPlainText } from './plain-text.js';
export const ACTIVE_WINDOW_HOURS = 48;   // a cluster is "active" if last story published within this window
export const EXPIRE_AFTER_DAYS = 30;     // clusters with no stories in 30 days are removed from digest

export function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// Build the story object sent to the LLM (text for comprehension) and the
// metadata object stored on the cluster (for the frontend). Text is never
// truncated — the LLM is asked for length-controlled output, and stored
// copy must be the full source text, not a mangled prefix of it.
export function prepareStoryForLLM(story) {
  const title = toPlainText(story.title || '');
  const desc = toPlainText(story.description || '');
  const content = toPlainText(story.content || '');
  const combined = [title, desc, content].filter(Boolean).join(' — ');
  return {
    id: story.id,
    text: combined,
    // Keep the raw description/content for story enrichment (bodyText).
    description: desc,
    content: content,
    source: story.source || '',
    sourceName: story.sourceName || '',
    url: story.url || '',
    image: story.image || '',
    published: story.published || '',
    category: story.category || 'General',
    originalTitle: story.title,
    plugin: story.plugin || story._plugin || null,
    pluginPriority: story.pluginPriority ?? story._pluginPriority ?? null,
  };
}

export function makeStoryData(s) {
  return enrichStory({
    id: s.id,
    title: s.originalTitle || s.title,
    source: s.source || '',
    sourceName: s.sourceName || '',
    url: s.url || '',
    image: s.image || '',
    published: s.published || '',
    description: s.description || '',
    content: s.content || '',
    category: normaliseCategory(Array.isArray(s.category) ? s.category[0] : (s.category || 'Other')),
    plugin: s.plugin || s._plugin || null,
    pluginPriority: s.pluginPriority ?? s._pluginPriority ?? null,
  });
}

export function normaliseCategory(raw) {
  const cat = Array.isArray(raw) ? raw.join(' ') : (raw || 'general');
  const lower = cat.toLowerCase().trim();
  // Direct match against our known categories (case-insensitive)
  const knownCategories = [
    'politics', 'business', 'technology', 'science', 'health', 'world',
    'sport', 'sports', 'gaming', 'entertainment', 'celebrity',
    'environment', 'energy', 'disaster', 'defence', 'defense',
    'crime', 'local', 'education', 'motoring', 'personal finance',
    'royal', 'other', 'general', 'regional',
  ];
  if (knownCategories.includes(lower)) {
    // Normalise plural and variants
    if (lower === 'sports') return 'sport';
    if (lower === 'defense') return 'defence';
    if (lower === 'general') return 'other';
    if (lower === 'regional') return 'local';
    return lower;
  }
  // Fuzzy match for common variants
  if (/gaming|game|console|xbox|playstation|nintendo|steam|video game|esports|mmorpg|rpg|fps/.test(lower)) return 'gaming';
  if (/sport|football|cricket|rugby|tennis|olympic/.test(lower)) return 'sport';
  if (/politic|election|government|parliament|minister/.test(lower)) return 'politics';
  if (/business|finance|economy|market|bank|trade/.test(lower)) return 'business';
  if (/tech|ai|software|digital|cyber|internet|processor|chip|cpu|gpu|semiconductor/.test(lower)) return 'technology';
  if (/health|medical|disease|hospital|drug|vaccine/.test(lower)) return 'health';
  if (/science|space|research/.test(lower)) return 'science';
  if (/environment|climate|wildlife|pollution/.test(lower)) return 'environment';
  if (/energy|power plant|gas plant|renewable|nuclear|oil|solar|wind/.test(lower)) return 'energy';
  if (/disaster|flood|earthquake|tsunami|eruption|emergency/.test(lower)) return 'disaster';
  if (/defence|defense|military|armed forces|army|navy|air force/.test(lower)) return 'defence';
  if (/crime|criminal|arrest|prison|court|police|justice/.test(lower)) return 'crime';
  if (/entertainment|film|music|tv|television|cinema|festival|book/.test(lower)) return 'entertainment';
  if (/celebrity|influencer|gossip|star/.test(lower)) return 'celebrity';
  if (/local|regional|council|community|neighborhood|neighbourhood/.test(lower)) return 'local';
  if (/education|school|university|student|curriculum/.test(lower)) return 'education';
  if (/motoring|car|vehicle|driving|ev /.test(lower)) return 'motoring';
  if (/personal finance|mortgage|savings|pension|money/.test(lower)) return 'personal finance';
  if (/royal|monarchy|monarch|king|queen|prince|princess/.test(lower)) return 'royal';
  return 'other';
}

export function extractKeywords(text) {
  const stop = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','can','this','that','these','those','it','its','they','them','their','there','here','who','whom','whose','which','what','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','just','don','now','said','says','say','after','before','during','while','about','against','between','into','through','above','below','up','down','out','off','over','under','again','further','then','once','uk','us','mr','mrs','ms']);
  const words = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  return [...new Set(words)];
}

export function loadExistingDigest() {
  return loadJson(DIGEST_FILE, { date: new Date().toISOString().split('T')[0], clusters: [] });
}

export function findClusterForStory(digest, storyId) {
  return digest.clusters.find(c => c.stories?.some(s => s.id === storyId));
}

// Source-derived copy for clusters without LLM text (singletons by design,
// or LLM failure): the full source text, never truncated, never fake-ellipsed.
export function fallbackClusterCopy(stories, cleanHeadline) {
  const lead = stories[0];
  const rawHeadline = lead.originalTitle || lead.title || 'Untitled';
  const headline = cleanHeadline || rawHeadline;
  const summary = (lead.text || '').trim();
  const triggerWords = extractKeywords(headline + ' ' + summary).slice(0, 5);
  return { headline, summary, triggerWords, impact: 'medium', category: normaliseCategory(lead.category) };
}

// Sort a cluster's stories chronologically (oldest first) so the stored
// stories array reads as a timeline of how the event developed.
export function sortTimeline(stories) {
  return [...stories].sort((a, b) => String(a.published || '').localeCompare(String(b.published || '')));
}

// Attach lifecycle fields to every cluster: active flag, story count, sorted
// timeline, and first/last published dates. Also expire clusters whose stories
// are all older than EXPIRE_AFTER_DAYS — they're dead news taking up space.
export function annotateLifecycle(digest) {
  const now = Date.now();
  const activeCutoff = now - ACTIVE_WINDOW_HOURS * 60 * 60 * 1000;
  const expireCutoff = now - EXPIRE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const before = digest.clusters.length;
  for (const cluster of (digest.clusters || [])) {
    cluster.stories = sortTimeline(cluster.stories || []);
    const dates = cluster.stories
      .map(s => s.published)
      .filter(Boolean)
      .map(d => { try { return new Date(d).getTime(); } catch { return 0; } })
      .filter(Boolean);
    cluster.storyCount = cluster.stories.length;
    cluster.firstPublished = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
    cluster.lastPublished = dates.length ? new Date(Math.max(...dates)).toISOString() : null;
    // Active = last STORY published within the window (not pipeline touch time).
    // Using lastPublished means a cluster only stays active if real new stories
    // arrive — the pipeline refreshing metadata doesn't keep dead stories alive.
    const lastPubTs = cluster.lastPublished ? new Date(cluster.lastPublished).getTime() : 0;
    cluster.active = lastPubTs >= activeCutoff;
  }
  // Expire clusters where ALL stories are older than EXPIRE_AFTER_DAYS.
  // These are dead news — the event is over and no new developments are coming.
  digest.clusters = digest.clusters.filter(c => {
    const lastPubTs = c.lastPublished ? new Date(c.lastPublished).getTime() : 0;
    if (lastPubTs < expireCutoff) {
      console.log(`  Expiring stale cluster (${Math.floor((now - lastPubTs)/86400000)}d old): ${c.headline?.slice(0,60)}`);
      return false;
    }
    return true;
  });
  const expired = before - digest.clusters.length;
  if (expired) console.log(`  Expired ${expired} stale clusters (>${EXPIRE_AFTER_DAYS}d no new stories)`);
}

// Merge a group of new stories into an existing cluster (dedup by id).
export function mergeIntoCluster(cluster, prepared) {
  const existingIds = new Set(cluster.stories.map(s => s.id));
  let added = 0;
  for (const s of prepared) {
    if (!existingIds.has(s.id)) { cluster.stories.push(makeStoryData(s)); added++; }
  }
  return added;
}

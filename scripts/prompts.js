// LLM prompts for the news digest.
//
// The LLM's ONLY job now is summarisation: given a cluster of stories that
// local embedding-based clustering has already grouped as one event, write a
// single headline + summary + impact + trigger words. Grouping is done
// locally (see cluster.js), so the LLM never decides which stories belong
// together — it just writes the editorial copy for an already-formed cluster.
// This is a far simpler, more reliable prompt and degrades gracefully: a
// single failed call only affects one cluster's text.

export const SYSTEM_PROMPT = `You are a news editor writing concise summaries for a broadsheet digest. Your task is summarisation: distil a group of stories about one event into a single headline and summary.

Write in a plain, authoritative broadsheet voice — third person, active voice, British English spelling. State facts directly. Get to the point without front-loading context.

Editorial style:
- Name specifics. If a source says "Manchester", write "Manchester" — not "a major city". If it says "weedkiller", write "weedkiller" — not "an effective liquid". Include proper nouns from the headline.
- Be information-dense. Every sentence contains a concrete fact. Replace vague nouns with the actual name from the source.
- Answer questions the headline poses. The reader should not need to click through for facts available in the source.
- Do not invent details the source does not contain.

Output:
1. "headline" — 8 words max, factual, no question marks.
2. "summary" — 30-60 words, block text, key facts only. Do not repeat the headline.
3. "category" — one of: Politics, Business, Technology, Science, Health, World, Sports, Entertainment, Environment, Regional, Other.
4. "region" — the geographic scope of the story. Use a place name if the story is tied to a specific location (e.g. "Manchester", "London", "Bangkok", "Gaza"). Use "UK" for national British stories with no specific locality. Use "International" for cross-border or non-UK stories. Use "Global" for worldwide-scope stories (climate, pandemics).
5. "trigger_words" — 1-5 specific words that identify this topic (e.g. "Kabul", "Widdecombe").
6. "impact" — "low" (local/minor), "medium" (sector/group level), or "high" (broad societal/national consequence).

Respond with JSON:
{
  "headline": "Short factual headline",
  "summary": "30-60 words of block text facts.",
  "category": "Politics",
  "region": "Manchester",
  "impact": "high",
  "trigger_words": ["Kabul", "Widdecombe"]
}`;

function relativeAge(published) {
  if (!published) return '';
  const ts = new Date(published).getTime();
  if (isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  return `${Math.floor(days / 7)} weeks ago`;
}

function storyLines(stories) {
  const sorted = [...stories].sort((a, b) => (b.published || '').localeCompare(a.published || ''));
  return sorted.map((s, i) => {
    const age = relativeAge(s.published);
    const ageTag = age ? ` (${age})` : '';
    return `[${i + 1}]${ageTag} Source headline (may be clickbait — do not emulate its style): ${s.originalTitle}\n    Byline: ${s.source}\n    Content: ${s.text}`;
  }).join('\n\n');
}

// Build a freshness-aware instruction based on the age spread of stories.
// If all stories are similarly recent, no special instruction — just summarise.
// If there's a clear split between old context and new developments, tell the
// LLM to lead with what's new and treat older stories as background.
function freshnessGuidance(stories) {
  const now = Date.now();
  const ages = stories
    .map(s => s.published ? new Date(s.published).getTime() : null)
    .filter(Boolean);
  if (ages.length < 2) return '';

  // Timestamps: larger = newer (closer to now). Math.max = newest, Math.min = oldest.
  const newest = Math.max(...ages);
  const oldest = Math.min(...ages);
  const spreadHours = (newest - oldest) / 3600000;
  const newestAgeHours = (now - newest) / 3600000;

  // All stories within 48h of each other — no special guidance needed.
  if (spreadHours < 48) return '';

  // There's a meaningful age gap. Distinguish "new developments" from "context".
  // "New" = published within 48h of the newest story. Everything else is context.
  const newThreshold = newestAgeHours + 48;
  const newCount = ages.filter(a => (now - a) / 3600000 < newThreshold).length;
  const oldCount = ages.length - newCount;

  if (newCount >= 1 && oldCount >= 1) {
    return `\nNote: The most recent ${newCount === 1 ? 'story is' : `${newCount} stories are`} new development${newCount === 1 ? '' : 's'}; the older ${oldCount} ${oldCount === 1 ? 'story provides' : 'stories provide'} background context. The reader may already know the background. Lead with what is new — the latest development should be the focus of the headline and the first sentence of the summary. Use older stories only to add essential context, not to retell the original event.\n`;
  }
  return '';
}

// Summary-only prompt for one already-clustered group of stories.
// `existing` is the existing cluster being updated (or null for a new cluster),
// used to carry forward context so the rewritten summary reflects the latest
// state of an ongoing story rather than just the latest batch.
export function buildSummaryPrompt(stories, existing) {
  const lines = storyLines(stories);
  const freshness = freshnessGuidance(stories);
  const ctx = existing
    ? `\n--- EXISTING CLUSTER BEING UPDATED ---\nCurrent headline: ${existing.headline}\nCurrent summary: ${(existing.summary || '(none)').slice(0, 300)}\n--- END EXISTING CLUSTER ---\n\nThese stories are developments of an existing news cluster. Write an updated headline and summary that reflects the CURRENT state of the story incorporating all developments shown below. The reader sees only the latest version.\n`
    : '';

  return `${ctx}These ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'} ${stories.length === 1 ? 'is' : 'are'} about a single news event. Write one headline and one summary that captures the story across all the sources below.\n${freshness}\n${lines}\n\nRespond ONLY with valid JSON in this exact format:\n{\n  "headline": "Short factual headline (max 8 words)",\n  "summary": "30-60 words of block text facts",\n  "category": "Politics|Business|Technology|Science|Health|World|Sports|Entertainment|Environment|Regional|Other",\n  "region": "Manchester|London|UK|International|Global",\n  "impact": "low|medium|high",\n  "trigger_words": ["specific", "unique", "words"]\n}`;
}

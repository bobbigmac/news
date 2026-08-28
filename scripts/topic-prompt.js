// LLM prompt for topic slug assignment (preflight categorisation).
//
// One call per run. Takes all new story headlines and asks the LLM to assign
// each a deterministic topic slug (e.g. "gta-6", "phillies", "gamescom-2026").
// Stories about the same topic get the same slug, even if the text is very
// different (different angles on the same event). The slugs are then used as
// a pre-clustering grouping layer — stories with the same slug are candidates
// for the same cluster, and the embedding layer refines within each group.
//
// This is separate from summarisation: a different prompt, a different call,
// and a failure only means we fall back to embedding-only clustering.

export const TOPIC_SYSTEM_PROMPT = `You are a news categorisation system. Your task is to assign topic slugs to news stories.

A topic slug is a short lowercase kebab-case identifier for the topic a story covers. Examples:
- "gta-6" for stories about Grand Theft Auto VI
- "phillies" for stories about the Philadelphia Phillies
- "gamescom-2026" for stories about the Gamescom 2026 event
- "uk-politics" for stories about UK politics
- "nepal-china-flood" for stories about the Nepal-China border flood

Rules:
- Stories about the SAME topic must get the SAME slug.
- Stories about DIFFERENT topics must get DIFFERENT slugs.
- Be specific: "gta-6" not "gaming", "phillies" not "baseball", "gamescom-2026" not "gaming-event".
- If a story is unique with no related stories, still give it a specific slug.
- Slugs should be 2-5 words, kebab-case, lowercase, no spaces.

You will receive a list of stories with IDs and headlines. Return a JSON object mapping each story ID to its topic slug.`;

export function buildTopicPrompt(stories) {
  const lines = stories.map(s => `${s.id}: ${s.title}`);
  return `Assign a topic slug to each of these ${stories.length} stories. Return JSON mapping story IDs to slugs.

${lines.join('\n')}

Respond with JSON:
{ "${stories[0]?.id || 'example-id'}": "topic-slug", ... }`;
}

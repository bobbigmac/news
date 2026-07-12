export const SYSTEM_PROMPT = `You are the news editor for a serious broadsheet newspaper — think The Times, The Guardian, Reuters. You maintain a living news digest that evolves as stories develop.

Your core job: when new stories arrive, integrate them into the existing digest. A new story about an ongoing event should UPDATE the existing cluster — revise the headline and summary to reflect the latest development, and add the new story's ID to that cluster. Do not create a separate cluster for a development of a story we already have.

Only create a NEW cluster when a story is genuinely about something not already in the digest.

Writing voice:
- Authoritative but plain. No editorialising, no opinion, no speculation.
- Write in the third person. Never use "we" or "you".
- Use active voice. "The government announced" not "It was announced by the government".
- State facts directly. Do not hedge with "reportedly", "allegedly", "it is understood that". If the source says it, report it as fact.
- Do not front-load context the reader already has. Get to the point.
- British English spelling (organisation, colour, programme, defence).
- Avoid telling the reader how to feel about the news.

Anti-clickbait rules — strictly enforced:
- NEVER use vague or teasing language. If a source names a specific thing — a substance, a person, a place, a number, a law, a company, a programme, a project — you MUST name it in the summary. Do not write "an effective liquid" when the source says "weedkiller". Do not write "a well-known figure" when the source says "Elon Musk". Do not write "a major city" when the source says "Manchester".
- The source headline often contains the key name or entity. Always check the headline for proper nouns and include them in the summary.
- NEVER create information gaps. If the source content contains the answer, state it. The reader should never need to click through to learn a fact that was available in the source.
- NEVER use phrases like "you won't believe", "this surprising", "an unexpected", "a shocking", "the truth about", "what happens next", "the real reason", "one simple trick", "this effective method", or any similar clickbait framing.
- NEVER omit a key fact to create curiosity. If the headline asks a question, the summary must answer it.
- If the source content does not contain a specific detail, do not invent one. But if it does, you must include it.
- Summaries must be information-dense. Every sentence should contain a concrete fact. Remove any sentence that does not. Replace vague nouns ("a programme", "a report", "a study") with the actual name from the source.

Rules:
1. EVERY story must be included in at least one cluster. Do not omit any story. If a story doesn't relate to existing clusters or other new stories, give it its own cluster.
2. If a story is a development of an existing cluster (listed in the context below), include its ID in that cluster's story_ids and rewrite the headline and summary to reflect the latest state of the story. Do NOT create a duplicate cluster.
3. When updating an existing cluster, rewrite the headline and summary as the current state of the story — not as a delta. The reader sees only the latest version.
4. For new clusters, write a SHORT factual headline — no more than 8 words. No question marks. State what happened, not what might happen.
5. Write a SUMMARY of 30-60 words in block text. Cover the key facts: what happened, who is involved, why it matters. Do NOT repeat the headline. Do NOT list every detail — distil. Name every specific detail the source provides.
6. Assign a CATEGORY from: Politics, Business, Technology, Science, Health, World, Sports, Entertainment, Environment, Other.
7. List the story IDs that belong to each cluster. Only include IDs from the stories provided in this batch.
8. For each cluster, provide a "trigger_words" array of 1-5 specific words or short phrases that uniquely identify this story topic. These words should be precise enough that ONLY stories about this topic would contain them (e.g. "Kabul", "Widdecombe", "Hillsborough Law"). Avoid generic words that could match unrelated stories. These will be used to automatically assign future stories to this cluster without needing the LLM.
9. For each cluster, assign an "impact" level: "low", "medium", or "high". Low impact = minor/local incidents with limited consequence (e.g. a theft, a single arrest, a human interest story). Medium impact = developments affecting specific groups or sectors (e.g. a company closure, a policy change, a court ruling). High impact = events with broad societal, national, or international consequence (e.g. war, major legislation, natural disaster, pandemic).

Respond ONLY with valid JSON in this exact format:
{
  "clusters": [
    {
      "headline": "Short factual headline",
      "summary": "30-60 words of block text facts.",
      "category": "Politics",
      "impact": "high",
      "story_ids": ["id1", "id2"],
      "trigger_words": ["Kabul", "Widdecombe"]
    }
  ]
}`;

function storyLines(stories) {
  const sorted = [...stories].sort((a, b) => (b.published || '').localeCompare(a.published || ''));
  return sorted.map((s, i) =>
    `[${i + 1}] ID: ${s.id}\n    Published: ${s.published || 'unknown'}\n    Source headline (may be clickbait — do not emulate its style): ${s.originalTitle}\n    Byline: ${s.source}\n    Content: ${s.text}`
  ).join('\n\n');
}

// Prompt for 'update' tranches: stories confidently matched to an existing cluster.
// LLM writes a new headline/summary reflecting the latest state, confirms membership.
export function buildUpdatePrompt(stories, cluster) {
  const lines = storyLines(stories);
  const clusterContext = `--- EXISTING CLUSTER TO UPDATE ---\n[cluster: ${cluster.id}] ${cluster.headline} (${cluster.category})\nSummary: ${(cluster.summary || '(no summary)').slice(0, 300)}\nTrigger words: ${(cluster.triggerWords || []).join(', ') || 'none yet'}\n--- END EXISTING CLUSTER ---\n`;

  return `These ${stories.length} stories have been identified as developments of an existing news cluster. Your job: write an updated headline and summary that reflects the CURRENT state of this story incorporating all developments. Confirm which story IDs belong to this cluster. If any story is clearly NOT about this topic, exclude it and list it under "rejected_ids".\n\n${clusterContext}\n${lines}\n\nRespond ONLY with valid JSON:\n{\n  "clusters": [\n    {\n      "headline": "Updated factual headline (max 8 words)",\n      "summary": "30-60 words reflecting the current state of the story,\n      "category": "${cluster.category}",\n      "impact": "low|medium|high",\n      "story_ids": ["id1", "id2"],\n      "trigger_words": ["specific", "unique", "words"]\n    }\n  ],\n  "rejected_ids": ["id-of-story-that-doesnt-belong"]\n}`;
}

// Prompt for 'new' tranches: confident heuristic group of 2+ unmatched stories.
// LLM writes headline/summary/trigger_words for this pre-formed group.
export function buildNewPrompt(stories) {
  const lines = storyLines(stories);

  return `These ${stories.length} stories appear to be about the same topic. Your job: write a single headline and summary that covers the overall story. Confirm which story IDs belong together — if the stories are actually about different topics, split them into separate clusters. Every story must appear in at least one cluster.\n\n${lines}\n\nRespond ONLY with valid JSON in this exact format:\n{\n  "clusters": [\n    {\n      "headline": "Short factual headline (max 8 words)",\n      "summary": "30-60 words of block text facts",\n      "category": "Politics|Business|Technology|Science|Health|World|Sports|Entertainment|Environment|Other",\n      "impact": "low|medium|high",\n      "story_ids": ["id1", "id2"],\n      "trigger_words": ["specific", "unique", "words"]\n    }\n  ]\n}`;
}

// Prompt for 'allocate' tranches: singletons that need LLM to check against existing clusters.
// LLM sees story headlines + existing cluster headlines/trigger words, assigns or creates new.
export function buildAllocatePrompt(stories, candidates) {
  const lines = storyLines(stories);
  const candidateLines = candidates.map(c =>
    `- [${c.id}] ${c.headline} (${c.category}) — trigger: ${(c.triggerWords || []).join(', ')}`
  ).join('\n');

  return `These ${stories.length} stories could not be confidently matched to existing clusters by keyword analysis. Below are the stories and the existing clusters with their trigger words. For each story, either assign it to an existing cluster (by including its ID in that cluster's story_ids) or create a new cluster for it. Every story must appear in at least one cluster.\n\n--- EXISTING CLUSTERS ---\n${candidateLines}\n--- END EXISTING CLUSTERS ---\n\n${lines}\n\nRespond ONLY with valid JSON in this exact format:\n{\n  "clusters": [\n    {\n      "headline": "Short factual headline (max 8 words)",\n      "summary": "30-60 words of block text facts",\n      "category": "Politics|Business|Technology|Science|Health|World|Sports|Entertainment|Environment|Other",\n      "impact": "low|medium|high",\n      "story_ids": ["id1", "id2"],\n      "trigger_words": ["specific", "unique", "words"],\n      "existing_cluster_id": "id-of-existing-cluster-if-updating,-or-omit-if-new"
    }\n  ]\n}`;
}

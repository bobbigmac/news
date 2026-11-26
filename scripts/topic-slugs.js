import { TOPIC_SYSTEM_PROMPT, buildTopicPrompt } from './topic-prompt.js';
import { callLLM, stripMarkdownFences } from './llm-client.js';

// Merge embedding clusters that share a topic slug. Stories with the same
// slug are about the same topic (per the LLM), so their clusters should be
// merged even if embedding similarity was below the clustering threshold.
// Also stores the slug on each story for future reference.
export function mergeGroupsBySlug(groups, topicSlugs) {
  if (!topicSlugs || Object.keys(topicSlugs).length === 0) return groups;

  // Tag each story with its slug
  for (const group of groups) {
    for (const story of group) {
      story._topicSlug = topicSlugs[story.id] || null;
    }
  }

  // Group clusters by shared slug
  const bySlug = new Map(); // slug -> array of group indices
  const noSlug = []; // groups with no slug (keep as-is)

  groups.forEach((group, i) => {
    const slugsInGroup = new Set(
      group.map(s => s._topicSlug).filter(Boolean)
    );
    if (slugsInGroup.size === 0) {
      noSlug.push(i);
      return;
    }
    // If a group has multiple slugs (shouldn't happen often), use the first
    const slug = [...slugsInGroup][0];
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(i);
  });

  // Merge groups that share a slug
  const merged = [];
  const used = new Set();

  for (const [slug, indices] of bySlug) {
    if (indices.length <= 1) {
      // Only one group has this slug — keep as-is
      for (const i of indices) {
        if (!used.has(i)) { used.add(i); merged.push(groups[i]); }
      }
      continue;
    }
    // Merge all groups with this slug
    const combined = [];
    const seen = new Set();
    for (const i of indices) {
      used.add(i);
      for (const s of groups[i]) {
        if (!seen.has(s.id)) { seen.add(s.id); combined.push(s); }
      }
    }
    console.log(`  Topic merge: "${slug}" merged ${indices.length} groups -> ${combined.length} stories`);
    merged.push(combined);
  }

  // Add groups with no slug
  for (const i of noSlug) {
    if (!used.has(i)) { used.add(i); merged.push(groups[i]); }
  }

  return merged;
}

// --- Topic slug assignment (preflight categorisation) ---
// One LLM call per run: takes all new story headlines and assigns each a
// topic slug (e.g. "gta-6", "phillies"). Stories with the same slug are
// forced into the same embedding cluster, catching same-topic-different-angle
// stories that embedding similarity alone would miss. Falls back gracefully
// (no slugs = embedding-only clustering, same as before).
export async function assignTopicSlugs(stories) {
  if (stories.length < 2) return {};
  try {
    const compact = stories.map(s => ({ id: s.id, title: s.title || s.originalTitle || '' }));
    const prompt = buildTopicPrompt(compact);
    const responseText = await callLLM(prompt, { systemPrompt: TOPIC_SYSTEM_PROMPT, temperature: 0.2 });
    const cleaned = stripMarkdownFences(responseText).trim();
    const parsed = JSON.parse(cleaned);
    // Validate: must be an object mapping string -> string
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const slugs = {};
      let multiSlugCount = 0;
      const slugCounts = {};
      for (const [id, slug] of Object.entries(parsed)) {
        if (typeof slug === 'string' && slug.length > 0) {
          slugs[id] = slug;
          slugCounts[slug] = (slugCounts[slug] || 0) + 1;
        }
      }
      for (const count of Object.values(slugCounts)) {
        if (count > 1) multiSlugCount++;
      }
      console.log(`Topic slugs: ${Object.keys(slugCounts).length} unique slugs, ${multiSlugCount} multi-story groups`);
      return slugs;
    }
  } catch (e) {
    console.log(`Topic slug assignment failed (${e.message?.slice(0, 80)}) — falling back to embedding-only clustering`);
  }
  return {};
}

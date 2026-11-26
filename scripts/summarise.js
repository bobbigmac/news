// Summarise pipeline orchestration.
//
// Grouping is local (embeddings + DBSCAN + topic-slug merge); the LLM only
// writes editorial copy for already-formed clusters. Helpers live in focused
// modules: cache-io, llm-client, topic-slugs, and cluster-copy.

import { buildSummaryPrompt, buildBatchPrompt, buildClickbaitPrompt } from './prompts.js';
import { embedStories } from './embeddings.js';
import { dedupStories, clusterEvents, matchToExisting } from './cluster.js';
import { annotateClusters, buildEntityIndex } from './entities.js';
import { computeClusterTags } from './tags.js';
import {
  DIGEST_FILE,
  loadJson,
  RAW_FILE,
  RUN_LOG_FILE,
  saveJson,
  STORY_STORE_FILE,
  SUMMARISED_IDS_FILE,
} from './cache-io.js';
import {
  callLLM,
  INTER_CALL_DELAY_MS,
  MODEL,
  parseSummaryResponse,
  PROVIDER,
  stripMarkdownFences,
} from './llm-client.js';
import { assignTopicSlugs, mergeGroupsBySlug } from './topic-slugs.js';
import {
  annotateLifecycle,
  fallbackClusterCopy,
  loadExistingDigest,
  makeStoryData,
  mergeIntoCluster,
  normaliseCategory,
  prepareStoryForLLM,
} from './cluster-copy.js';

// --- LLM call consolidation ---
// Free LLM calls are not unlimited. OpenRouter :free models have rate limits
// (typically 20 requests/minute, 1000/day). With 336+ stories per run, we
// could easily have 50-100 clusters needing summarisation. These settings
// reduce the number of LLM calls per run:
const SKIP_MINOR_UPDATE_THRESHOLD = 3;  // Don't re-summarise existing clusters with >= this many stories
                                        // if only 1 new story is added (the existing copy is still good)
const BATCH_NEW_CLUSTERS = true;        // Batch small new clusters into one LLM call
const BATCH_SIZE = 5;                   // Max clusters per batch LLM call
const BATCH_MAX_STORIES = 2;            // Only batch clusters with <= this many stories

async function main() {
  console.log('=== Summarise News (reworked) ===');
  console.log(`Provider: ${PROVIDER.name} | Model: ${MODEL}`);

  const rawStories = loadJson(RAW_FILE, []);
  const digest = loadExistingDigest();
  const summarisedIds = new Set(loadJson(SUMMARISED_IDS_FILE, []));
  const storyStore = loadJson(STORY_STORE_FILE, { stories: {} });

  // Dedupe: only process stories not yet summarised.
  const toProcess = rawStories.filter(s => !summarisedIds.has(s.id));

  if (!toProcess.length) {
    console.log('No new stories to summarise. Refreshing metadata only.');
    computeClusterTags(digest);
    annotateClusters(digest);
    annotateLifecycle(digest);
    digest.date = new Date().toISOString().split('T')[0];
    digest.generated = new Date().toISOString();
    digest.entityIndex = buildEntityIndex(digest).entities;
    saveJson(DIGEST_FILE, digest);
    writeRunLog(digest, 0, 0, 0, 0, 0, 0, true);
    return;
  }

  // Every fetched story is a pipeline input. Do not silently discard short or
  // thin items here; bad source extraction should be visible in output/logs.
  const storiesToProcess = toProcess;
  console.log(`Stories to process: ${storiesToProcess.length} (skipped ${rawStories.length - toProcess.length} already summarised)`);

  // --- Embed ---
  // We need embeddings for: new stories, AND any existing-cluster stories not
  // yet in the embedding cache (so we can compute existing cluster centroids).
  const existingClusterStoryIds = new Set();
  for (const c of digest.clusters) for (const s of (c.stories || [])) existingClusterStoryIds.add(s.id);
  const store = storyStore.stories || {};
  const existingStoriesToEmbed = [...existingClusterStoryIds]
    .map(id => store[id] || rawStories.find(r => r.id === id))
    .filter(Boolean);
  // embedStories uses the on-disk cache, so already-embedded ids are skipped.
  const embeddings = await embedStories([...storiesToProcess, ...existingStoriesToEmbed]);

  // --- Dedup + cluster new stories ---
  const dedupGroups = dedupStories(storiesToProcess, embeddings);
  const dedupedReps = dedupGroups.map(g => g[0]);
  const eventGroups = clusterEvents(dedupedReps, embeddings);
  // Expand each event group back to include all dedup members.
  const expandedGroups = eventGroups.map(group => {
    const all = [];
    const seen = new Set();
    for (const rep of group) {
      const dg = dedupGroups.find(dg => dg[0].id === rep.id) || [rep];
      for (const s of dg) if (!seen.has(s.id)) { seen.add(s.id); all.push(s); }
    }
    return all;
  });

  // --- Topic slug merge (LLM preflight) ---
  // Assign topic slugs to all new stories, then merge embedding clusters
  // that share a slug. This catches same-topic-different-angle stories
  // (e.g. GTA 6 frame rate + GTA 6 first person + GTA 6 console comparison)
  // that embedding similarity alone would leave as separate clusters.
  const topicSlugs = await assignTopicSlugs(storiesToProcess);
  const mergedGroups = mergeGroupsBySlug(expandedGroups, topicSlugs);

  // --- Match to existing clusters ---
  const assignments = matchToExisting(mergedGroups, digest.clusters, embeddings);

  // --- Summarise clusters (consolidated LLM calls) ---
  // Four tiers to minimise LLM calls:
  //   1. SKIP: existing cluster with >= SKIP_MINOR_UPDATE_THRESHOLD stories
  //      getting only 1 new story — don't re-summarise, just add the story.
  //   2. SINGLETON: new clusters with only 1 story — no cluster was learned,
  //      so we don't need an LLM to write a headline. Use the source headline
  //      as-is, but screen all singletons in ONE LLM call for clickbait/
  //      sensationalism and get clean replacements where needed.
  //   3. BATCH: small new clusters (2-BATCH_MAX_STORIES stories) are grouped
  //      into batches of BATCH_SIZE, one LLM call per batch.
  //   4. SOLO: everything else (large new clusters, existing clusters with
  //      significant new content) gets a dedicated LLM call.
  let totalAdded = 0;
  let totalUpdated = 0;
  let clustersCreated = 0;
  let llmCalls = 0;
  let llmFailed = 0;
  let skippedMinor = 0;
  let singletonCount = 0;

  // First pass: merge stories into clusters, classify into tiers
  const singletonTier = []; // new 1-story clusters — clickbait screen only
  const batchTier = [];     // small new clusters (2+ stories) — batched LLM call
  const soloTier = [];      // everything else — dedicated LLM call

  for (let i = 0; i < assignments.length; i++) {
    const { stories, existingCluster } = assignments[i];
    const prepared = stories.map(prepareStoryForLLM);

    if (existingCluster) {
      const added = mergeIntoCluster(existingCluster, prepared);
      totalAdded += added;
      totalUpdated++;
      const newSlug = stories.find(s => s._topicSlug)?._topicSlug;
      if (newSlug && !existingCluster.topicSlug) existingCluster.topicSlug = newSlug;

      // Tier 1: skip if existing cluster is well-established and only 1 new story
      const existingStoryCount = (existingCluster.stories || []).length - added;
      if (added === 1 && existingStoryCount >= SKIP_MINOR_UPDATE_THRESHOLD) {
        skippedMinor++;
        console.log(`\n[${i + 1}/${assignments.length}] skip minor: ${existingCluster.headline?.slice(0, 60)} (+${added} new, ${existingStoryCount} existing)`);
        existingCluster.updated = new Date().toISOString();
        for (const s of prepared) summarisedIds.add(s.id);
        continue;
      }
      console.log(`\n[${i + 1}/${assignments.length}] update: ${existingCluster.headline?.slice(0, 60)} (+${added} new)`);
      soloTier.push({ prepared, existingCluster, cluster: existingCluster });
    } else {
      const newSlug = stories.find(s => s._topicSlug)?._topicSlug;
      const newCluster = {
        id: `cluster-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        headline: prepared[0].originalTitle || 'Untitled',
        summary: '',
        category: normaliseCategory(prepared[0].category),
        stories: prepared.map(makeStoryData),
        triggerWords: [],
        impact: 'medium',
        topicSlug: newSlug || null,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        contentVersion: 1,
      };
      digest.clusters.push(newCluster);
      totalAdded += prepared.length;
      clustersCreated++;
      console.log(`\n[${i + 1}/${assignments.length}] new cluster (${prepared.length} stories): ${prepared[0].originalTitle?.slice(0, 60)}`);

      if (prepared.length === 1) {
        // Tier 2: singleton — no LLM summarisation, just clickbait screening
        singletonTier.push({ prepared, cluster: newCluster });
      } else if (BATCH_NEW_CLUSTERS && prepared.length <= BATCH_MAX_STORIES) {
        // Tier 3: batch small new clusters (2+ stories)
        batchTier.push({ prepared, cluster: newCluster });
      } else {
        // Tier 4: solo for larger new clusters
        soloTier.push({ prepared, existingCluster: null, cluster: newCluster });
      }
    }
  }

  // Helper: apply parsed LLM response to a cluster
  function applySummaryToCluster(cluster, parsed) {
    if (parsed && parsed.headline) {
      const parsedShortSummary = String(parsed.short_summary || parsed.shortSummary || '').replace(/\s+/g, ' ').trim();
      const summaryChanged = parsed.summary && parsed.summary !== cluster.summary;
      cluster.headline = parsed.headline;
      cluster.summary = parsed.summary || cluster.summary;
      if (parsedShortSummary) cluster.shortSummary = parsedShortSummary;
      else if (summaryChanged) delete cluster.shortSummary;
      if (parsed.category) cluster.category = normaliseCategory(parsed.category);
      if (parsed.trigger_words && Array.isArray(parsed.trigger_words)) cluster.triggerWords = parsed.trigger_words;
      if (parsed.keywords && Array.isArray(parsed.keywords)) {
        cluster.keywords = parsed.keywords
          .map(k => String(k || '').trim().toLowerCase())
          .filter(k => k.length >= 2 && k.length <= 60)
          .slice(0, 12);
      }
      if (parsed.region) cluster.region = parsed.region;
      if (parsed.impact && ['low', 'medium', 'high'].includes(parsed.impact.toLowerCase())) cluster.impact = parsed.impact.toLowerCase();
      cluster.contentVersion = (cluster.contentVersion || 0) + 1;
      console.log(`  LLM ok: "${parsed.headline?.slice(0, 60)}"`);
      return true;
    }
    return false;
  }

  // Helper: apply fallback copy to a new cluster
  function applyFallbackToCluster(cluster, prepared, cleanHeadline) {
    const fb = fallbackClusterCopy(prepared, cleanHeadline);
    cluster.headline = fb.headline;
    cluster.summary = fb.summary;
    cluster.triggerWords = fb.triggerWords;
    cluster.impact = fb.impact;
  }

  // --- Tier 2: Singleton clusters — clickbait screening in 1 LLM call ---
  // Singletons don't need LLM summarisation (no cluster to summarise — just
  // 1 story). We use the source headline + description as fallback copy.
  // But first, screen all singleton headlines in ONE LLM call to flag
  // clickbait/sensationalism and get clean replacements where needed.
  if (singletonTier.length > 0) {
    singletonCount = singletonTier.length;
    console.log(`\n=== Singleton screening: ${singletonTier.length} single-story clusters in 1 LLM call ===`);

    // Build the headlines list for the clickbait prompt
    const headlines = singletonTier.map(s => ({
      id: s.cluster.id,
      headline: s.prepared[0].originalTitle || s.prepared[0].title || 'Untitled',
      source: s.prepared[0].sourceName || 'Unknown',
      description: (s.prepared[0].description || '').slice(0, 300),
    }));

    // Call LLM to screen headlines (batched in chunks of 50 to stay within context)
    const CLICKBAIT_BATCH = 50;
    const cleanHeadlines = new Map(); // cluster.id -> clean headline
    const llmCategories = new Map();  // cluster.id -> editorial category

    for (let bi = 0; bi < headlines.length; bi += CLICKBAIT_BATCH) {
      const chunk = headlines.slice(bi, bi + CLICKBAIT_BATCH);
      llmCalls++;
      try {
        const prompt = buildClickbaitPrompt(chunk);
        const responseText = await callLLM(prompt);
        const cleaned = stripMarkdownFences(responseText).trim();
        const parsed = JSON.parse(cleaned);
        const flagged = Array.isArray(parsed) ? parsed : (parsed.flagged || parsed.results || parsed.data || []);
        if (Array.isArray(flagged)) {
          for (const r of flagged) {
            if (r.id && r.headline) {
              cleanHeadlines.set(r.id, r.headline);
              const original = headlines.find(h => h.id === r.id)?.headline;
              console.log(`  Clickbait: "${original?.slice(0, 50)}" -> "${r.headline?.slice(0, 50)}"`);
            }
          }
        }
        const categories = parsed.categories || [];
        if (Array.isArray(categories)) {
          for (const r of categories) {
            if (r.id && r.category) llmCategories.set(r.id, r.category);
          }
        }
      } catch (err) {
        console.error(`  Clickbait screening failed: ${err.message}. Using source headlines as-is.`);
        llmFailed++;
      }
      if (bi + CLICKBAIT_BATCH < headlines.length) await new Promise(r => setTimeout(r, INTER_CALL_DELAY_MS));
    }

    // Apply fallback copy to all singletons, using clean headline where available.
    // The screening call's editorial category replaces the ingest-time
    // publisher/API metadata — it is the only comprehended judgement a
    // singleton ever gets.
    for (const s of singletonTier) {
      const cleanHeadline = cleanHeadlines.get(s.cluster.id);
      const editorialCategory = llmCategories.get(s.cluster.id);
      if (editorialCategory) s.cluster.category = normaliseCategory(editorialCategory);
      applyFallbackToCluster(s.cluster, s.prepared, cleanHeadline);
      s.cluster.updated = new Date().toISOString();
      for (const story of s.prepared) summarisedIds.add(story.id);
    }
    saveJson(SUMMARISED_IDS_FILE, [...summarisedIds]);
    saveJson(DIGEST_FILE, digest);
    console.log(`  Applied ${cleanHeadlines.size} clean headlines, ${llmCategories.size} editorial categories, ${singletonTier.length - cleanHeadlines.size} source headlines as-is`);
  }

  // --- Tier 3: Batch small new clusters (2+ stories) ---
  if (batchTier.length > 0) {
    const batches = [];
    for (let i = 0; i < batchTier.length; i += BATCH_SIZE) {
      batches.push(batchTier.slice(i, i + BATCH_SIZE));
    }
    console.log(`\n=== Batch summarisation: ${batchTier.length} small clusters in ${batches.length} LLM call(s) ===`);

    for (const batch of batches) {
      llmCalls++;
      const batchClusters = batch.map(b => ({ id: b.cluster.id, stories: b.prepared }));
      try {
        const prompt = buildBatchPrompt(batchClusters);
        const responseText = await callLLM(prompt);
        const cleaned = stripMarkdownFences(responseText).trim();
        const parsed = JSON.parse(cleaned);
        // The response is a JSON object with a "clusters" array (OpenRouter's
        // json_object mode can't return a bare array). Also handle bare arrays
        // for robustness in case the LLM ignores the wrapper.
        const results = Array.isArray(parsed) ? parsed : (parsed.clusters || parsed.data || parsed.results || []);
        if (Array.isArray(results) && results.length > 0) {
          // Match responses to clusters by id
          const byId = new Map(results.map(p => [p.id, p]));
          for (const b of batch) {
            const result = byId.get(b.cluster.id);
            if (!applySummaryToCluster(b.cluster, result)) {
              console.log(`  Batch: unparseable result for ${b.cluster.id} — using fallback`);
              llmFailed++;
              applyFallbackToCluster(b.cluster, b.prepared);
            }
          }
        } else {
          console.log(`  Batch: response had no cluster array — using fallback for all`);
          llmFailed++;
          for (const b of batch) applyFallbackToCluster(b.cluster, b.prepared);
        }
      } catch (err) {
        console.error(`  Batch LLM failed: ${err.message}. Using fallback for all.`);
        llmFailed++;
        for (const b of batch) applyFallbackToCluster(b.cluster, b.prepared);
      }

      // Persist after each batch
      for (const b of batch) {
        b.cluster.updated = new Date().toISOString();
        for (const s of b.prepared) summarisedIds.add(s.id);
      }
      saveJson(SUMMARISED_IDS_FILE, [...summarisedIds]);
      saveJson(DIGEST_FILE, digest);
      if (batches.indexOf(batch) < batches.length - 1) await new Promise(r => setTimeout(r, INTER_CALL_DELAY_MS));
    }
  }

  // --- Tier 4: Solo summarisation for significant updates and large new clusters ---
  if (soloTier.length > 0) {
    console.log(`\n=== Solo summarisation: ${soloTier.length} clusters (1 LLM call each) ===`);
    for (let i = 0; i < soloTier.length; i++) {
      const { prepared, existingCluster, cluster } = soloTier[i];
      llmCalls++;
      try {
        const prompt = buildSummaryPrompt(prepared, existingCluster);
        const responseText = await callLLM(prompt);
        const parsed = parseSummaryResponse(responseText);
        if (!applySummaryToCluster(cluster, parsed)) {
          console.log(`  LLM returned unparseable JSON — using fallback copy`);
          llmFailed++;
          if (!existingCluster) applyFallbackToCluster(cluster, prepared);
        }
      } catch (err) {
        console.error(`  LLM failed: ${err.message}. Using fallback copy.`);
        llmFailed++;
        if (!existingCluster) applyFallbackToCluster(cluster, prepared);
      }

      cluster.updated = new Date().toISOString();
      for (const s of prepared) summarisedIds.add(s.id);
      saveJson(SUMMARISED_IDS_FILE, [...summarisedIds]);
      saveJson(DIGEST_FILE, digest);

      if (i < soloTier.length - 1) await new Promise(r => setTimeout(r, INTER_CALL_DELAY_MS));
    }
  }

  if (skippedMinor > 0) console.log(`\nSkipped ${skippedMinor} minor updates (existing cluster + 1 new story, no re-summarisation needed)`);
  if (singletonCount > 0) console.log(`Screened ${singletonCount} singletons (source headline + clickbait check, no per-story LLM call)`);

  // --- Annotate: entities, tags, lifecycle, entity index ---
  annotateClusters(digest);
  computeClusterTags(digest);
  annotateLifecycle(digest);
  digest.entityIndex = buildEntityIndex(digest).entities;

  digest.date = new Date().toISOString().split('T')[0];
  digest.generated = new Date().toISOString();
  saveJson(DIGEST_FILE, digest);

  writeRunLog(digest, storiesToProcess.length, totalAdded, clustersCreated, totalUpdated, llmCalls, llmFailed, false, skippedMinor);

  const wouldHaveCalled = assignments.length;
  const saved = wouldHaveCalled - llmCalls;
  console.log(`\nSummarisation complete: ${totalAdded} stories added, ${clustersCreated} new clusters, ${totalUpdated} clusters updated.`);
  console.log(`LLM: ${llmCalls} calls (would have been ${wouldHaveCalled} without consolidation — saved ${saved}), ${llmFailed} fell back to heuristic.`);
  console.log(`Skipped ${skippedMinor} minor updates, ${singletonCount} singletons screened. Digest: ${digest.clusters.length} clusters.`);
}

function writeRunLog(digest, processed, added, created, updated, llmCalls, llmFailed, skipped, skippedMinor = 0) {
  const runLog = loadJson(RUN_LOG_FILE, []);
  runLog.unshift({
    timestamp: new Date().toISOString(),
    provider: PROVIDER.name,
    model: MODEL,
    storiesProcessed: processed,
    storiesAdded: added,
    clustersCreated: created,
    clustersUpdated: updated,
    totalClusters: digest.clusters.length,
    llmCalls,
    llmFailed,
    skippedMinor,
    chunks: llmCalls, // retained for frontend compatibility
    chunksFailed: llmFailed, // retained for frontend compatibility
    skipped,
  });
  saveJson(RUN_LOG_FILE, runLog.slice(0, 10));
}

main().catch(err => { console.error(err); process.exit(1); });

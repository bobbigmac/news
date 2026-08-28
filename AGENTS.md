# Agent Guidelines

## Currents API Quota — Critical Constraints

- **Daily quota: 20 API calls** (free plan). Exceeding returns HTTP 429.
- **3 scheduled runs per day** (cron: 7:23, 13:23, 19:23 London time).
  Timed to story publish peaks from a 30-day publish-time analysis: 08:00 is the
  busiest hour, with a secondary plateau 14:00-17:00 and a dead zone 03:00-05:00.
- **2 fixed calls per run**: `latest-news?language=en` (general) + `latest-news?language=en&country=gb` (GB).
- **2 plugin calls per run**: 1 call per plugin, 1 keyword per call.
- **Total: 4 calls/run × 3 runs = 12/day** — safely under 20.

### Plugin Search Design (DO NOT CHANGE WITHOUT EXPLICIT APPROVAL)

The `keywords` parameter on the Currents API search endpoint **ANDs multiple words**.
Sending `keywords=longsight levenshulme gorton manchester` requires ALL four words
in a single article and returns 0 results. This is not a bug — it's how the API works.

**Correct approach** (current): round-robin one keyword per plugin per run.
- `run-state.json` tracks `pluginKeywordIndex` to cycle through terms.
- Run 1 searches `longsight`, run 2 searches `levenshulme`, etc.
- With 3 runs/day, a 4-keyword plugin covers all terms in ~1.3 days.
- Results are ranked client-side by keyword match priority.

**What NOT to do:**
- Do NOT join all keywords into one API call — returns 0 results (ANDed).
- Do NOT make one API call per keyword per run — blows the quota (9+ calls/run).
- Do NOT add test plugins to `.env` or GitHub secrets without removing them after.
- Do NOT delete `rankByKeywords` logic without replacing it with equivalent client-side ranking.

### Quota Tracking

- `cache/run-state.json` tracks `callsToday`, `runCount`, `pluginLastRun`, `pluginKeywordIndex`.
- Resets daily (checked via `date` field vs current date).
- `callsToday` only increments on **successful** API calls, never on 429 errors.
- `fetchLatestNews` increments by `FIXED_CALLS_PER_RUN` (2) only after both calls succeed.
- Plugin calls increment by 1 each, only on success.
- **This file must persist between runs** — see cache-data branch notes below.

### Cache-Data Branch

- Cache files (`cache/`) are stored on a separate `cache-data` branch, not on `main`.
- The workflow restores them via `git checkout origin/cache-data -- cache/`.
- **Must use `origin/cache-data`** (remote tracking ref), not `cache-data` (local branch doesn't exist).
- If this checkout fails silently, every run starts at 0 calls used and re-fetches everything,
  wasting quota and breaking the round-robin keyword cycling.
- Do NOT suppress checkout errors with `2>/dev/null || true` without also logging the failure.

## Summarise Pipeline

- `scripts/summarise.js` must always write a `run-log.json` entry, even when exiting early
  (no new stories or all already summarised). Otherwise the site's infopanel stays stale.
- `scripts/build.js` copies `digest.json` and `run-log.json` from `cache/` to `docs/`.
- The site reads these from `docs/` (GitHub Pages serves the `docs/` directory).

### Architecture (reworked — local grouping, LLM for summary only)

The pipeline has three stages: **ingest** (fetch-news.js), **comprehend** (summarise.js),
**publish** (build.js). The reworked comprehend stage does grouping locally and only uses
the LLM to write editorial copy per cluster — it never asks the LLM to decide which stories
belong together. This fixed the old problem where 86% of clusters were single-story because
the free LLM failed constantly and the fallback fragmented everything.

**Comprehend flow** (summarise.js):
1. Load new stories from `raw-new.json`, filter out already-summarised ids.
2. **Embed** all stories locally via Transformers.js (`Xenova/all-MiniLM-L6-v2`, 384-dim,
   CPU-only, no API key). Embeddings cached in `cache/embeddings.json` by story id — only
   new stories are embedded each run. See `scripts/embeddings.js`.
3. **Cross-source dedup** — stories with cosine similarity >= 0.92 are the same article
   from different sources; merged into one representative for clustering. See
   `scripts/cluster.js`.
4. **Event clustering** — DBSCAN over embeddings (eps = 1 - 0.65 = 0.35 distance, i.e.
   cosine sim >= 0.65 to be neighbours). minPts=1 so singletons become their own group
   (no story is ever dropped). Threshold tuned on the 30-day story store: 0.65 catches
   all confirmed same-event pairs without false merges. See `scripts/cluster.js`.
5. **Topic slug merge** (LLM preflight, one call per run) — all new story headlines are
   sent to the LLM in a single call, which assigns each a deterministic topic slug
   (e.g. "gta-6", "phillies", "gamescom-2026"). Embedding clusters that share a slug
   are merged, catching same-topic-different-angle stories (e.g. GTA 6 frame rate +
   GTA 6 first person + GTA 6 console comparison) that embedding similarity alone
   misses. Falls back gracefully to embedding-only clustering if the LLM call fails.
   See `scripts/topic-prompt.js`. Nemotron Super 120B excels at this task.
6. **Match to existing clusters** — each new event group is compared to existing digest
   clusters by centroid similarity. If >= 0.62, the new stories merge into the existing
   cluster (living cluster that accumulates developments across runs). Also matches by
   topic slug: if the new group's slug matches an existing cluster's `topicSlug`, they
   merge even if embedding similarity is below threshold. Otherwise a new cluster is
   created. See `scripts/cluster.js`.
7. **LLM summary** — one LLM call per cluster to write headline + summary + impact +
   trigger words + region. The LLM only writes copy for an already-formed cluster — it
   never groups. A failed call degrades only that cluster's text (heuristic fallback uses
   the lead story's title/content). See `scripts/prompts.js` (`buildSummaryPrompt`).
8. **Annotate** — entities (compromise NER: people/places/orgs, `scripts/entities.js`),
   tags (TF-IDF over compromise nouns/topics, `scripts/tags.js`), lifecycle fields
   (`active` flag based on lastPublished within 48h — NOT pipeline touch time,
   `storyCount`, `firstPublished`/`lastPublished`, stories sorted as a timeline),
   per-story enrichment (`bodyText`, `wordCount`, `storyType` — see
   `scripts/story-enrich.js`), and expiry (clusters with all stories >30 days
   old are removed from the digest — they're dead news, not current events).
9. Persist `digest.json` + `run-log.json` + `summarised-ids.json` + `embeddings.json`.

**Publish flow** (build.js):
- Backfills missing fields on old clusters (triggerWords, impact, contentVersion, category
  casing) so the frontend never sees an incomplete cluster.
- Builds the cross-cluster **entity index** (entity name -> cluster ids, `scripts/entities.js`).
- Builds **topics** — connected components over content-tag overlap (>= 2 shared tags) or
  shared entities (appearing in 2+ clusters). Structural tags (source names, plugin names,
  category names) are excluded from topic linking to avoid a giant "bbc" topic. See
  `buildTopics` in `scripts/build.js`.
- Builds a **timeline** — all stories across all clusters, chronological, with cluster ref.
- Computes aggregate **stats** (by category, by source, by impact, by region, by story
  type, active vs archived).
- Output shape: `{ date, generated, clusters[], entities[], topics[], timeline[], stats, pipelineStats }`.
  The frontend reads `clusters` and `pipelineStats` (unchanged contract); `entities`,
  `topics`, `timeline`, `stats` are additive fields for external consumers.

### Dataset fields for external consumers

The public `docs/digest.json` is designed as a general-purpose news dataset, not just
for our own frontend. Each cluster has:
- `region` — geographic scope (place name, "UK", "International", "Global"). Identified
  by the LLM as part of the summary request — not heuristic, so it handles any location.
- `entities` — `{ people, places, orgs }` arrays from compromise NER.
- `tags` — TF-IDF-weighted topic tags.
- `impact` — low/medium/high.
- `active` — whether the cluster was updated in the last 48h.
- `storyCount`, `firstPublished`, `lastPublished` — lifecycle metadata.
- `stories[]` — each story has `bodyText` (cleaned plain text), `wordCount` (for
  pagination onto fixed-width displays), and `storyType` (news/analysis/video/feature/
  opinion, classified by URL pattern heuristics).

The `timeline[]` array flattens all stories chronologically with `region`, `storyType`,
`wordCount`, and `clusterId`/`clusterHeadline` cross-references — consumers can filter
and paginate without walking the cluster tree.

The `stats` object includes `byRegion`, `byStoryType`, `byCategory`, `bySource`,
`byImpact` distributions for consumer-side page assignment.

### Clustering thresholds (scripts/cluster.js)

- `SIM_DEDUP = 0.92` — same article from different sources.
- `SIM_CLUSTER = 0.65` — same event (lowered from 0.72 to catch same-event pairs that
  differ in framing; tolerates occasional near-misses per user preference).
- `SIM_MATCH = 0.62` — new group matches existing cluster (slightly below CLUSTER because
  centroid-to-centroid is more stable than pairwise, and we want ongoing stories to
  accumulate across runs as framing shifts).

Do NOT change these without re-running the threshold sweep over the story store and
eyeballing the multi-story groups for false merges.

### Embeddings cache

- `cache/embeddings.json` maps story id -> 384-dim vector (rounded to 6 decimals).
- Must persist between runs (stored on cache-data branch, same as other cache files).
- If lost, all stories re-embed (~0.3s each on CPU, 353 stories ≈ 2 min one-time cost).
- Model downloads from HF Hub on first run (~22MB, cached by Transformers.js in
  `node_modules/.cache/` or `~/.cache/huggingface/`). In CI this means a one-time
  download per run unless the cache is persisted.

### LLM provider

- Same providers as before: OpenRouter, Featherless, OpenAI (first key found wins).
- **OpenRouter free router** (`openrouter/free`) randomly picks from available free
  models. The router classifies the request type and filters for models that support
  the needed features (JSON mode, etc). It does NOT support `excluded_models`.
- **Paid-model safeguard** (critical): the $10 OpenRouter credit is a daily-limit
  unlock, NOT spendable budget. `callLLM` rejects any response where the model ID
  doesn't end with `:free` or where `usage.cost` is non-zero. If a paid model is
  detected, the call throws immediately (no retry) and the cluster falls back to
  heuristic copy. This ensures we can NEVER spend the credit accidentally. See
  `isPaidModel` / `hasCost` in `scripts/summarise.js`.
- **Model registry** (`cache/model-registry.json`): when `openrouter/free` returns
  a good `:free` model, its ID is saved. On subsequent calls, known-good models are
  called directly (still zero cost — the `:free` suffix means free regardless of
  whether you go through the router or call directly). This eliminates the
  retry-roulette where the random router keeps picking safety classifier models.
  The free router is kept as a fallback in the queue to discover new good models.
  Bad models (safety classifiers, etc.) are remembered and skipped. Must persist
  between runs (stored on cache-data branch).
- **Prompt framing matters for the free router.** The original system prompt was
  dominated by "NEVER do X" rules and "strictly enforced" language, which made the
  router's task classifier think the request was content moderation / safety
  compliance — so it routed to `nvidia/nemotron-3.5-content-safety:free`, a classifier
  that returns "User Safety: safe" instead of chat completions. The prompt was reframed
  to lead with the summarisation task and fold style guidance in as editorial
  preferences, which fixed the routing. **Do not revert the prompt to enforcement-style
  language** or the safety classifier will return.
- `callLLM` detects and retries safety-classifier responses (by model ID and output
  pattern), and strips markdown fences from models that ignore `response_format`.
- The pipeline degrades gracefully: every story gets clustered and stored with fallback
  copy even if all LLM calls fail. Override the model with `OPENROUTER_MODEL` for a
  pinned model, or use Featherless/OpenAI.

## SEARCH_PLUGINS Format

Defined in `.env` (local) and GitHub repo secret `SEARCH_PLUGINS` (CI).
Semicolons separate plugin groups, pipes separate keywords within a group:

```
SEARCH_PLUGINS=longsight|levenshulme|gorton|manchester;xbox|dark souls|dwarf fortress|metal gear solid|game pass
```

When changing `.env`, also update the GitHub repo secret (Settings → Secrets → Actions).

## Known Pitfalls

- Commit `d8668f2` ("fix-cache") broke the plugin search by splitting 1 call per plugin
  into 1 call per keyword (9+ calls/run), added a test plugin (`election|court`) that was
  never removed, and broke the cache-data checkout by using `cache-data` instead of
  `origin/cache-data`. All fixed in commit `7088158`.
- The TODO.md from that session incorrectly described the joined-keywords approach as a
  "root cause" of 0 results. The real issue was the API ANDing keywords — the fix should
  have been round-robin, not per-keyword calls.

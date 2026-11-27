# Agent Guidelines

## Dev-time analysis tasks

- Re-runnable analysis/task configuration lives in `docs/tasks/*.task.json`. Edit the config file rather than maintaining long CLI parameter lists.
- `docs/tasks/headline-analysis.task.json` controls the exploratory headline/source analysis: export current `origin/cache-data` into `.working/`, then run `.venv/bin/python scripts/headline-analysis/analyse_headlines.py --config docs/tasks/headline-analysis.task.json`. Validation helpers are `scripts/headline-analysis/validate_detectors.py sample` (write a source-capped blank labelling sheet) and `validate_detectors.py score` (score completed `human_*` labels); both read the same task config.
- This headline analysis is dev-time/run-once measurement tooling only. Do not run the analyser in `scripts/build.js`, CI, or the normal digest pipeline without explicit approval. The frozen `src/data/measured-sources.json` export may be copied as static site data for the measured-sources page. No large transformer models or GPU-dependent models.
- Completed work is logged in `docs/DONE.md`; open work stays in root `TODO.md`.

### Platform-tenant attribution (keep copies in sync)

Multi-tenant platforms (substack, medium, dev.to, neocities, etc.) are NOT sources —
the publications/authors on them are. `sourceKeyFromUrl` and `prettifySourceKey`
implement this twice: `scripts/sources.js` (pipeline) and `src/view-model.js` (client).
**The two copies must be edited together** — key shape affects filtering, sprite
lookup, and read-state consistently only if both sides agree.
- Subdomain tenants: `x.substack.com` displays/keys as the tenant, never the platform.
- Path tenants (`dev.to/user`, `medium.com/@user`): keys include the first path
  segment (`dev.to/alice`) — different authors are different sources.
- Build-time labels prefer the story's own author field for tenants; explicit
  overrides live in `SOURCE_LABELS` in `scripts/favicons.js`.
- Only hosts in `PLATFORM_HOSTS` get this treatment — publisher subdomains
  (news.xbox.com) still attribute to the parent brand.

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
- The cache save step intentionally runs after the Pages artifact upload but before
  `actions/deploy-pages`. Artifact metadata flakes must not discard fetch,
  embedding, or model-registry state.

## Client boot performance (windowed digests)

The client boot payload is split at publish time by `scripts/digest-split.js`
(shared with the vite dev middleware, so dev matches prod):

- `dist/digest.json` — slim clusters whose newest story is within 7 days
  (~2.6MB vs 23.8MB for the full corpus). This is the only boot fetch.
- `dist/digest-archive.json` — everything older, slim. The client fetches it
  in idle time after first paint, and ONLY when the reader's age window
  setting exceeds 7 days. Default-window readers never download it.
- `dist/dataset.json` — the full export for external consumers (timeline,
  entities, topics, stats, per-story bodyText/wordCount/storyType). The client
  never reads it; those fields are stripped from client digests.

Client-side progressive rendering (`src/feed.js`): column assignment is pure
math over height estimates and runs synchronously, but article shells
materialize in chunks — first ~120 synchronously, then ~250 per
animation frame in feed order. A render token cancels superseded passes.

Memory/boot metrics surface in the changelog panel (boot fetch/parse/render
ms, payload sizes, archive timings, JS heap, DOM node count) via
`state.clientPerf`.

Default age window is 7 days for new readers (`DEFAULT_SETTINGS.ageLimit`).

## Summarise Pipeline

- `scripts/summarise.js` must always write a `run-log.json` entry, even when exiting early
  (no new stories or all already summarised). Otherwise the site's infopanel stays stale.
- `scripts/build.js` copies `digest.json` and `run-log.json` from `cache/` to `dist/`.
- `dist/` is the disposable build artifact uploaded to GitHub Pages; `docs/` is for
  checked-in documentation and session logs.

## News Sources

- **Currents API** — 4 calls/run × 3 runs = 12/day (under 20 free quota). General + GB +
  2 plugin searches. See quota constraints above.
- **BBC RSS** (8 feeds) — no quota, no key. Enabled via `RSS_FEEDS=bbc` secret.
- **urgent.news** (5 feeds: UK edition + world/business/science/health desks) — no key,
  no registration, CORS-open cross-source aggregator. Enabled via `RSS_FEEDS=urgent`.
- **Techmeme** (1 feed: main feed, 30 items max) — human-curated tech news aggregator
  (editors across 5 continents, led by Gabe Rivera since 2005). Sources from thousands
  of outlets. The RSS `<link>` is a Techmeme permalink, but we extract the original
  publisher's URL from the HTML description so we cite the original source (Bloomberg,
  TechCrunch, Reuters, Wired, etc.), not Techmeme. The title format
  `"Headline (Author/Publication)"` is parsed to extract the byline and publication name.
  Enabled via `RSS_FEEDS=tech`.
- **Eurogamer + Kotaku** (gaming RSS) — enabled via `RSS_FEEDS=gaming`.
- **Sky News** (6 feeds: home/UK/world/politics/business/technology) — official RSS,
  no key, tightly capped because the desks overlap. Enabled via `RSS_FEEDS=sky`.
- **Direct tech press** (Ars Technica, The Verge, Wired; 10 items each) — resilience
  alongside Techmeme. Enabled via `RSS_FEEDS=techpress`.
- **Science** (Nature tightly capped + Phys.org) — enabled via `RSS_FEEDS=science`.
- **Guardian API** — available but disabled (requires registration). urgent.news already
  aggregates Guardian content.
- `RSS_FEEDS` secret is in the `github-pages` environment (not repo-level).
  Current value: `bbc,gaming,urgent,tech,sky,techpress,science`.

### Cross-Source URL Deduplication (`scripts/url-dedup.js`)

Multiple aggregators can deliver the same story (e.g. a BBC story via BBC RSS and via
urgent.news). URL-based dedup normalises URLs before comparison:
- Strip tracking params (`utm_*`, `at_*`, `ns_*`, `syn-*`, `fbclid`, `gclid`, etc.)
- Normalise domains (`bbc.com` → `bbc.co.uk`, strip `www.`, mobile subdomains)
- Strip `.html` suffix, trailing slashes, fragments
- Sort remaining query params for stable comparison
- Dedup by ID first (existing behaviour), then by normalised URL

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
7. **LLM summary** (consolidated calls) — four tiers to minimise LLM calls:
   - **SKIP**: existing cluster with >= 3 stories getting only 1 new story — no
     re-summarisation, just add the story. The existing copy is still good.
   - **SINGLETON**: new cluster with only 1 story — no cluster copy is written
     (uses the source headline + description as-is). All singleton headlines are
     screened in ONE LLM call (`buildClickbaitPrompt`) which does TWO jobs:
     flags clickbait/sensationalism for clean replacements, AND assigns an
     editorial category to every singleton. The category assignment matters:
     a singleton's ingest-time category is publisher/API metadata (arbitrary),
     and heuristic keyword graphs cannot categorise — provenance tags leaking
     into the graph once classified spiritual-healing and film-list articles
     as Gaming because they arrived via the "dark souls" keyword search.
   - **BATCH**: small new clusters (2-2 stories) are grouped into batches of 5,
     one LLM call per batch (`buildBatchPrompt` in `scripts/prompts.js`).
   - **SOLO**: everything else (large new clusters, existing clusters with significant
     new content) gets a dedicated LLM call (`buildSummaryPrompt`).
   The LLM only writes copy for an already-formed cluster — it never groups. Batch and
   solo summary calls write `summary` and `shortSummary` in the same response; do not
   add a separate short-summary LLM call. A failed call degrades only that cluster's
   text (heuristic fallback uses the lead story's title/content). Run log tracks
   `skippedMinor` and `llmCalls` for monitoring.
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
- **Recategorises** clusters using a keyword graph (`scripts/category-graph.js`, applied by `scripts/categories.js`) that overrides
  the LLM's category when the graph is confident (score >= 5). Categories are more specific
  than newspaper conventions: Gaming, Sport, Celebrity, Entertainment, Politics, Crime,
  Business, Personal Finance, Health, Science, Environment, Technology, Motoring, Energy,
  Disaster, Defence, World, Local, Education, Royal, Odd News. The graph excludes the LLM's
  own category label from matching (to avoid reinforcing mislabelling).
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

The deployed `/digest.json` (generated as `dist/digest.json`) is designed as a
general-purpose news dataset, not just for our own frontend. Each cluster has:
- `region` — geographic scope (place name, "UK", "International", "Global"). Identified
  by the LLM as part of the summary request — not heuristic, so it handles any location.
- `entities` — `{ people, places, orgs }` arrays from compromise NER.
- `tags` — TF-IDF-weighted topic tags.
- `impact` — low/medium/high.
- `shortSummary` — very short cluster summary written by the normal LLM summary call
  (legacy/missing values are backfilled deterministically at publish time).
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

The `sources` array is a canonical URL-host index (`key`, display `label`, story
`count`, and freshness timestamps). Raw favicons are checked in under
`src/favicons/` as hostname-named files. When sources change, update those assets
and regenerate the spritesheet once on the dev system — do not add
favicon downloading or spritesheet generation to CI/build. The published assets
are the checked-in `src/public/favicons/sprite.png` plus the static coordinate
module `src/favicon-sprite.js`; Vite copies the sprite verbatim. Do not replace
this with client-side Google/proxy favicon services; readers should only request
local files.

The frontend source bar hides a source by canonical URL host, not by the unreliable
`sourceName` field. Currents/RSS often put author bylines in source-like fields, so
use the story URL host as the grouping key.

The frontend records glimpses independently of read state in localStorage. A glimpse
means the article intersected the viewport at least once; it never marks the cluster
read. The short-summary collapse is version-aware: an updated cluster shows full copy
again until that updated `contentVersion` has itself been glimpsed, and expanding a
short summary does not count as read.

### Server-side story-group assignment (scripts/story-group-assign.js)

Clusters are assigned to the curated story tree **once, at build time** — never
per-client. The client (`src/story-groups.js`) only measures group sizes over the
pre-assigned node ids and picks a readable branch depth; its exact matcher is a
fallback for unassigned clusters only. This keeps partial-string indexing off
every client.

**Matching algorithm** (longest-string word-match + light levenshtein):
- Cluster vocab = tags + keywords + triggerWords + entity names (curated) plus
  headline words (non-curated). Terms from the tree are matched as word-sets:
  more matched words = more specific = wins. `["ai","farming"]` beats `["ai"]`.
- Subset matching: a vocab entry matches a term if all the term's words are in
  the entry — but only when the entry is not much longer than the term
  (length ratio <= 1.5x or diff <= 2 for curated entries). This stops junk
  TF-IDF/entity compounds like `["nepal","china"]` from matching `china`.
- Light levenshtein (1 edit on 5+ char words, 2 on 9+) handles morphology:
  `universities` → `university`. Never applied to words under 5 chars
  (`ai`/`uk` stay exact). Digits are preserved (`gta 6` ≠ `gta`).
- Ranking: specificity (word count) first across the whole tree, then fewer
  edits, more corroborating terms, non-pivot over pivot, deeper node, tree
  order. Pivot branches lose only ties — a two-word pivot match (`flash flood`)
  legitimately beats a one-word primary match (`china`).
- Performance: stemmed-word inverted index, ~3-4s for 5,557 clusters at build
  time. ~88% of the corpus assigns; ~120 of those via fuzzy matches.

**Taxonomy hinting in the LLM prompt** (`scripts/prompts.js`): the keyword/tag
instruction includes the verbatim line "Prefer tags/keywords in mainstream
taxonomies, like IPTC NewsCodes, Guardian/AssociatedPress/Reuters News/API
Tags, common semantic APIs or Wiki word-sets, for portability". It asks for
7-12 keywords per cluster. Do not add more examples to it — the soft hint
tightens suggestions just enough for portability without the model hallucinating
exact taxonomy ids.

**This is a living dataset**: after new sources or a news-cycle shift, re-check
what escapes the net (clusters with no `storyGroup`) and extend the tree JSON
files in `src/trees/` — especially now that many sources were added in one day.
The tree files are the portable/transferable asset; the matcher is generic.

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
  `isPaidModel` / `hasCost` in `scripts/llm-client.js`.
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

## Testing

- `npm test` runs the Vitest suite (`test/**/*.test.js`, jsdom environment).
- `npm run test:unit` covers pure view-model and pipeline helpers.
- `npm run test:integration` covers DOM/search/catch-up/glimpse/filter-panel behaviour.
- Do not use manually driven Firefox checks as the mainstream test path; keep
  regression coverage in `test/` and run the suite before builds.
- For local dev data, sync the remote pipeline cache instead of rerunning quota
  or LLM calls: `git fetch origin cache-data && git checkout origin/cache-data -- cache/`
  then `git restore --staged cache/` if the path checkout staged it. The Vite dev
  middleware serves `cache/digest.json` directly.

## Trust flags on the relationships page

- Profiles (`src/trees/profiles/sources.json`) support a `flags` array: `{label, note, links[]}`.
- **Every flag must cite at least 2 independent references** — regulators, court records,
  peer-reviewed studies, press-freedom monitors. A single-source accusation is never enough,
  and the test suite enforces this structurally.
- Flags are for documented, externally evidenced trust problems (state control, deprecation
  consensus, proven fabrication) — not for editorial disagreement or leaning.
- State-directed outlets belong in the `state-media` tree family, never among public-service
  broadcasters. Cross-file outlets that legitimately belong to two families (CGTN is in both
  Chinese State Media and China Media) rather than choosing one.
- Flag chips render on the collapsed outlet row — do not hide them inside expandable content.

## Site content rule — never talk about the dataset on the website

Public-facing pages are for readers. They must never describe dataset internals,
methodology, allocation mechanics, control counts, or how grouping/filtering is
implemented. That analysis belongs only in the codebase and `docs/`. Reader-facing
copy talks about the subject matter itself (the news, the sources, who owns them)
in plain editorial language. This mistake has been made repeatedly — check copy
for meta-referential framing before shipping any page.

## Masonry & Virtualization — Hard Constraints

- **Never pin heights on hydrated articles.** Rendered article panels are always
  natural height. Only unhydrated shells carry an inline height (estimated for
  never-shown content, measured real height once displayed). The user has
  repeated this constraint many times — treat any implementation need to pin
  visible heights as a decision to escalate, not to ship.
- **Glimpse state is pure data.** It must never affect rendering in any way —
  no classes, no collapsed summaries, no expanders.
- **The hydration driver is the single geometric window pass** in `feed.js`
  (`updateWindow`), driven by scroll/resize through rAF. Do not reintroduce
  IntersectionObserver for feed hydration, scroll-settle sweeps, or
  click-to-hydrate fallbacks — layered backup drivers are how the fixed-height
  shell regression happened. Enter margin 1200px, leave margin 2400px
  (hysteresis — do not equalize them or boundary nodes oscillate).
- Height spec (user's words): content below the viewport may be estimated size
  until close enough to measure; content above the viewport has been displayed,
  so its measured height is known until browser resize. Unloading drops sub-DOM
  content only. Images are allowed to re-futz layout.

## Known Pitfalls

- Commit `d8668f2` ("fix-cache") broke the plugin search by splitting 1 call per plugin
  into 1 call per keyword (9+ calls/run), added a test plugin (`election|court`) that was
  never removed, and broke the cache-data checkout by using `cache-data` instead of
  `origin/cache-data`. All fixed in commit `7088158`.
- The TODO.md from that session incorrectly described the joined-keywords approach as a
  "root cause" of 0 results. The real issue was the API ANDing keywords — the fix should
  have been round-robin, not per-keyword calls.

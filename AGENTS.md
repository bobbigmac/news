# Agent Guidelines

## Currents API Quota — Critical Constraints

- **Daily quota: 20 API calls** (free plan). Exceeding returns HTTP 429.
- **3 scheduled runs per day** (cron: 6:23, 12:23, 18:23 London time).
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

# TODO — Broadsheet News Digest

## Request Audit

Each user request from this session, verbatim or paraphrased, with implementation status.

---

### From prior session (checkpoint summary)

| # | Request | Status | Notes |
|---|---------|--------|-------|
| 1 | `npm run dev` shouldn't hit news endpoint every time | ✅ Done | `dev` script checks cache staleness |
| 2 | Fix "no llm api key found" | ✅ Done | `loadEnv()` moved before provider detection |
| 3 | Robust JSON extraction from LLM responses | ✅ Done | `extract-json.js` imported from battle-tested pattern |
| 4 | Only mark stories as summarised if parsing succeeds | ✅ Done | `summarisedIds.add()` moved inside success path |
| 5 | Tolerant `mergeClusters` for malformed `story_ids` | ✅ Done | Coerces to array, filters invalid |
| 6 | Pre-group stories by category before chunking | ✅ Done | `buildChunks` groups by normalised category |
| 7 | Pass existing cluster context to LLM prompt | ✅ Done | `buildUserPrompt` accepts existing clusters |
| 8 | Reduce retries from 8 to 3, improve error messages | ✅ Done | `MAX_RETRIES=3`, clear HTTP/network/empty distinction |
| 9 | Clean modern broadsheet UI, no rounded corners, no visible panels | ✅ Done | All `border-radius` removed, subtle shadow only |
| 10 | Image display setting (none/minimal/all) | ✅ Done | Cycle button in settings, lead + plugin-lead images in minimal |
| 11 | Organise UI for broadsheet presentation | ✅ Done | Column layout, masthead, lead article spans all |

---

### This session

#### Request A — "debug info... changes/additions/updates for last few runs (dedicated page, in the gear menu)... No redundant labels. '1 source' is redundant... treat the panel as the interactor, for mobile-friendliness. Use an extra column in most/wide views."

| Item | Status | Notes |
|------|--------|-------|
| Debug/changelog page accessible from gear menu | ✅ Done | "Recent Updates" button in settings, full-page overlay, fetches `run-log.json` |
| Run logging in `summarise.js` | ✅ Done | Tracks stories processed/added/skipped, clusters created/updated, chunks, failures, provider/model. Last 10 runs. |
| `run-log.json` copied to `docs/` in build | ✅ Done | `build.js` writes it alongside `digest.json` |
| No redundant labels ("1 source") | ✅ Done | Source count removed entirely (later in Request G) |
| Show source only if 'show sources' enabled or story expanded | ✅ Done | Sources hidden by default, shown on panel expand or when setting enabled |
| Treat whole panel as interactor (not just heading) | ✅ Done | Click anywhere on article toggles story links, excluding links and mark-read button |
| Extra column in most/wide views | ✅ Done | 4-column option added, default bumped to 3, auto-collapses 4→3 below 1024px |

#### Request B — "I don't like dropdowns... click to proceed through lists... remember their setting between page reloads. Also font size change doesn't work, support font-family toggle (like better-britain-reports year of labour, google fonts via cdn)."

| Item | Status | Notes |
|------|--------|-------|
| Replace all dropdowns with click-to-cycle buttons | ✅ Done | Font, Size, Columns, Sort, Images all cycle buttons |
| Settings persist between page reloads | ✅ Done | `localStorage` under `broadsheet-settings` |
| Fix font size not working | ✅ Done | Missing `font-medium` class added, all three sizes explicitly defined |
| Font-family toggle with Google Fonts CDN | ✅ Done | Serif / Sans / Modern (Outfit) / Assist (OpenDyslexic), loaded via `fonts.googleapis.com` |

#### Request C — "escape/back should close the sidebar. The top/heading should have a modes toggle that runs through All\|Main\|plugin1\|plugin2... tap tap tap cycle, not dropdowns."

| Item | Status | Notes |
|------|--------|-------|
| Escape closes sidebar | ✅ Done | Closes settings panel, changelog page, and search panel |
| Browser back button/gesture closes sidebar | ✅ Done | `popstate` listener closes all overlays |
| Modes toggle (All\|Main\|plugin1\|plugin2) | ✅ Done | Cycle button in masthead, dynamically built from digest data, persists in localStorage |

#### Request D — "settings panel for user to promote or demote categories... Favour\|Normal\|Demote\|Hide... remembering categories even if not in the current pool but have been in a previous pool."

| Item | Status | Notes |
|------|--------|-------|
| Category preference cycle buttons (Favour/Normal/Demote/Hide) | ✅ Done | In settings panel, each category gets a cycle button |
| Remember categories from previous pools | ✅ Done | Stored separately in `localStorage` (`broadsheet-cat-prefs`), merged with current digest categories |
| Effective on client (sorting + filtering) | ✅ Done | Favour sorts up, Demote sorts down, Hide filters out. Applied in `sortClusters` and `renderDigest` |

#### Request E — "user setting for watch words, comma separated, that highlight that story with a clear border and slightly changed background colour."

| Item | Status | Notes |
|------|--------|-------|
| Watch words text input (comma-separated) | ✅ Done | In settings panel, debounced input (400ms) |
| Highlight matching stories with border + background | ✅ Done | 3px left border in accent colour, subtle `rgba(139,26,26,0.03)` background tint |
| Match against story text (headline, summary, story titles) | ✅ Done | Case-insensitive substring match across all text |
| Works for both plugin and main feed stories | ✅ Done | Checks all clusters regardless of source |

#### Request F — "the `1/n sources` boxes are ugly and detract from readability, remove them. No badges or badge-like shit please."

| Item | Status | Notes |
|------|--------|-------|
| Remove source count boxes | ✅ Done | `article-story-count` and `article-meta` removed entirely |
| Remove all badge-like elements | ✅ Done | `updated-badge` span removed, only a small accent dot remains after headline for updated stories |
| Mark-read button de-emphasised | ✅ Done | Floats top-right, borderless, appears faintly on hover only |

#### Request G — "put the search box in the header behind a simple magnifying glass next to the cog/gear, expand and auto-focus on click, remembering past searches, deduped, appearing below the expanded search box."

| Item | Status | Notes |
|------|--------|-------|
| Search behind magnifying glass icon in masthead | ✅ Done | Icon next to gear icon in masthead-right |
| Expand and auto-focus on click | ✅ Done | Panel toggles, input focused on open |
| Remember past searches, deduped | ✅ Done | `localStorage` (`broadsheet-search-history`), max 8, deduped case-insensitive |
| Recent searches appear below expanded search box | ✅ Done | Clickable chips below input |
| Saves vertical space | ✅ Done | Old always-visible search bar removed |
| Escape closes search panel | ✅ Done | Added to Escape handler |

#### Request H — "none of my plugins give any results from this source, add another plugin line for specific stories that probably/certainly do exist, so we can test the plugin-based searches do work."

| Item | Status | Notes |
|------|--------|-------|
| Add test plugin with common search terms | ✅ Done | Added `election\|court\|police\|market` to `.env` |
| Fix plugin search returning 0 results | ✅ Done | Root cause: all keywords joined into one API query. Fixed: each keyword gets its own API call, results deduped within plugin |
| Test that plugins work without creating dupes | ⚠️ Pending | Rate limited at 17/20 API calls today. Needs testing when quota resets (midnight UTC). Run `npm run fetch-news` then `npm run summarise` then `npm run build` |
| Verify mode toggle shows plugin names | ⚠️ Pending | Depends on plugins returning results first. Once plugin stories exist in digest, mode toggle should cycle All → Main → election → longsight → xbox |

---

## Follow-up items (not explicitly requested but identified)

| Item | Priority | Notes |
|------|----------|-------|
| Browser back button closes overlays (mobile) | ✅ Done | `popstate` listener closes all overlays on back gesture |
| Remove unused `rankByKeywords` function in `fetch-news.js` | ✅ Done | Dead code removed |
| Remove unused `storyCount` variable in `renderArticle` | ✅ Done | Dead code removed |
| Update `SEARCH_PLUGINS` GitHub secret | Medium | Deploy workflow uses `secrets.SEARCH_PLUGINS` — needs updating in GitHub repo settings to include the new `election\|court\|police\|market` plugin |
| Test plugin flow end-to-end | High | Blocked by API rate limit. Verify: fetch returns plugin stories → summarise includes `plugin` field → digest has plugin-tagged stories → mode toggle shows plugin names → minimal images show for plugin-lead stories |
| Design pass | Medium | User said "I'll take a design pass" — UI is functional but awaits user's visual polish |

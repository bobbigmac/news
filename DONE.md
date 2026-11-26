# DONE

## Platform-tenant source attribution audit

- Multi-tenant platforms are no longer treated as sources: `yourlocalepidemiologist.substack.com` displayed as "Substack" because base-domain extraction took the platform label — same class of bug hit neocities, and worst of all dev.to, where 115 stories by ~97 individual authors were all lumped under one "DEV" source.
- `sourceKeyFromUrl` (both pipeline `scripts/sources.js` and client `src/view-model.js`, kept in sync) is now platform-aware: subdomain tenants display/key as the tenant, and path-tenant platforms (dev.to/user, medium.com/@user) key by author — dev.to/alice and dev.to/bob are different sources.
- Build-time labels prefer the story's own author field for platform tenants (real names like "Aniket Maurya" instead of handles), with explicit label overrides where prettified handles would be unreadable ("Your Local Epidemiologist").
- Audit verified the inverse direction too: legitimate publisher subdomains (news.xbox.com, sports.yahoo.com) still attribute to the publisher brand — the fix only fires for hosts in the curated PLATFORM_HOSTS set.

## Relationships page UX rebuild + content expansion

- Rows are collapsed `<details>` elements by default — icon + name + host is the whole visible row, styled after the filter bar; profiles render only on expansion. This eliminates the wasted-space problem directly: thin rows cost one line each instead of matching their neighbor's height. Members flow in CSS columns so expansion pushes rows down rather than leaving holes in a grid.
- "Also" cross-memberships are now anchor links to the other family sections (`#rel-…` ids) with just the family label — no more full breadcrumb dumps on every card.
- Group headings disambiguate: a group whose label collides with its members ("BBC" containing only BBC outlets) renders as "BBC Sources", and every group header carries its descendant outlet count.
- Search auto-opens matching rows so hits are visible in context.
- Content expansion with real research: profiles grew 77 → 90 with the thin keyword-triplet entries rewritten into substantive ownership/history/governance/watch notes — Independent's Saudi stake, NST's UMNO factional history, Qatar Tribune's royal ownership, the CBS/Skydance/Bari Weiss 2025 transition, AP's ownerless cooperative structure, The Hindu's Kasturi family, Zuberi family's Business Recorder, Lebedev/etc. Every claim verified against current sources (ownership changes hands; several entries would have been wrong from memory).

## Source filter bar rework (session audit)

- Restored a bounded source bar: 526 nonzero story hosts now allocate to ~101 human-scale controls instead of one toggle per host.
- Built `src/source-tree.js`, a deep curated source-relation tree (ownership families, public broadcasters, specialist press, billionaire-backed nationals, wires/press-release pipes, regional media). Runtime never infers grouping — `src/group-tree.js` only measures article counts and picks disjoint branches near a target of ~80 stories per group.
- Ungrouped and low-volume hosts collapse into a real `Other Sources` toggle (`otherSourceKeys` threads through feed visibility so the toggle actually hides/restores its 132+ hosts).
- Explicitly display-filtered sources stay visible in the bar with their counts, including branches below the cutoff, so filters can be restored.
- Source buttons are 36px click targets with 28px canonical CSS sprite classes and per-source story-count badges; zero-story sources are excluded.
- Added regression coverage for grouped options, the Other toggle, individual-source prominence, and source visibility in `test/view-model.test.js` / `test/filter-bar.test.js`.

## Tag-based story grouping

- Built `src/story-tree.js`, a deep curated subject tree rebuilt against the real `cache-data` digest vocabulary, driven by the same disjoint article-count allocator (40 clusters/group target, ~4 min). Source/category noise tags (bbc, urgent, gaming, xbox) are excluded.
- Tree schema supports `related` cross-links between nodes (e.g. Russell Brand ↔ British Comedy while his coverage groups under public-figure cases), alias in-routes via per-node `terms`, and a `pivot` root claimed last so catch-all branches only group what the real taxonomy leaves thin.
- `Group By Tag` setting (off by default) consolidates matching clusters into collapsible full-width rollup containers — one per allocated group, ordered by their best member's feed position — each internally laid out in the normal column flow, with the ungrouped tail following in the standard band. The container header carries group identity (crumb + label + visible count); individual tiles never print topic labels. Collapse state survives re-renders within the session. The point is dedup: near-duplicate coverage becomes one collapsible unit instead of scattered tiles.
- Term matching is whole-token string matching only — never char-substring — so each node's `terms` act as an explicit catch list. Escape analysis against the real digest drives new catch terms and branches, including a `world-regions` pivot that groups leftover geography (British Isles, Americas, Europe, Asia Pacific, Middle East, Africa).
- Tag allocation runs ~300ms over 5,557 clusters via an inverted term index; produces ~195 groups covering ~4,430 clusters (80%). Remaining oversized groups are coherent single subjects (China, Police, Wales, US States, Games).

## Relationships page (reader-facing media guide)

- `relationships.html` is a reader-facing guide to who owns, funds, and operates the outlets in the broadsheet — never a dataset-transparency page. No allocation mechanics, no control counts, no methodology panels, no story-tree internals: dataset analysis lives in docs/ and the codebase only.
- Fully static content (no digest.json fetch): renders the curated source-relation tree as nested family sections with branch research notes (summary + read-carefully guidance + evidence links) and per-outlet profile cards (kind, ownership, governance, editorial context, history, watch notes).
- Cross-membership index: outlets appearing in several families show "Also:" cross-references on their cards.
- Search matches across ancestor family context (searching "murdoch" surfaces the whole Fox / News Corp family) and normalizes hyphens ("licence fee" matches licence-fee). Outlet names are acronym-aware (BBC, CNN, not Bbc).
- Regression test asserts the page never contains dataset/methodology framing and never fetches the digest.
- Linked from the site footer and the Settings sidebar.

## Docs/build boundary

- Build output moved from `docs/` to `dist/`; the Pages action uploads `./dist`; stale generated `docs/` artifacts removed; `docs/` now holds real documentation including `docs/sessions/` logs.

## Server-side story-group assignment (fuzzy matching + taxonomy hinting)

- Story-group assignment moved server-side: `scripts/story-group-assign.js` runs in `build.js` after tag computation and stamps each cluster with `storyGroup` `{id, label, path, fuzzy}`. Clients consume the pre-assigned node id — no per-client partial-string indexing. The client's exact matcher remains only as a fallback for unassigned clusters.
- Matching is longest-string word-match: word-sets, more matched words wins (`ai farming` beats `ai`), then fewer edits, corroboration count, non-pivot over pivot (pivots lose ties only), deeper node, tree order. Light levenshtein (1 edit on 5+ chars, 2 on 9+) catches morphology (`universities`→`university`); digits preserved (`gta 6` ≠ `gta`); short words stay exact.
- Junk-vocab guards: subset matches rejected when the vocab entry is much longer than the term (ratio/diff caps), which stops TF-IDF/entity compounds like `nepal-china` subset-matching the place term `china`. Curated vocab gets looser caps than headline words.
- LLM prompt now asks for 7-12 `keywords` per cluster plus the verbatim taxonomy hint ("Prefer tags/keywords in mainstream taxonomies, like IPTC NewsCodes, Guardian/AssociatedPress/Reuters News/API Tags, common semantic APIs or Wiki word-sets, for portability") — keywords merge into tag computation in `scripts/tags.js` and are stored on clusters in `summarise.js`.
- Measured on the live corpus: 4,889/5,557 clusters assigned (88%, 119 via fuzzy) in ~3-4s at build time; client grouping of the pre-assigned digest takes ~135ms and produces 236 readable groups. Verified routing: Nepal flash floods → Weather & Disasters (specific pivot beats generic `china` primary), GTA 6 stories → Gaming/GTA franchise.
- Decision and tweak procedure documented in AGENTS.md — the tree JSON files in `src/trees/` are the portable asset and need re-checking as new sources shift the corpus vocabulary.

## Client boot performance (windowed digests + progressive rendering)

- Boot payload cut from 23.8MB to 2.6MB: `digest.json` now carries only slim clusters within the 7-day window; `digest-archive.json` (7.8MB) loads in idle time after first paint and only when the reader's window setting exceeds 7 days; the full export moved to `dataset.json` for external consumers. Splitting logic shared between build and vite dev middleware (`scripts/digest-split.js`).
- Client digests strip everything the client never reads: timeline, entities, topics, stats, and per-story bodyText/wordCount/storyType.
- Progressive shell materialization: column assignment stays synchronous pure math, but article shells materialize in chunks — first 120 synchronously for first paint, then 250 per animation frame — instead of thousands of DOM nodes blocking the UI thread in one pass.
- Boot/archive/memory instrumentation surfaces in the changelog panel (fetch/parse/render timings, payload sizes, JS heap, DOM node count).
- Default age window for new readers is now 7 days (was 30).

## Stable-column feed layout (masonry replacement)

- Replaced `masonry-layout` with `src/layout.js` stable columns: items are assigned to a column exactly once (greedy by estimated height, in feed order) and never move afterwards. Image loads, expanding summaries, and hydration resizing simply make a column longer — no relayout passes, no column hops.
- Root-cause fixes: the app resize handler used to re-render the entire digest on EVERY resize (unloading all hydrated articles and images); it now only re-renders when the column count actually changes. `ui.relayout` is a no-op because flow columns need nothing.
- Images reserve aspect-ratio space in CSS so lazy loading causes minimal column growth rather than reflow storms.
- `masonry-layout` dependency removed; regression coverage in `test/layout.test.js` (distribution, hidden items, node identity preservation).

## Source filter bar plain-icon restyle

- Source toggles are now plain transparent 32px icon buttons — no black-and-white chrome, no padding box. Inactive state is grayscale + reduced opacity only. Text buttons (categories, Mark Read) keep their inverse treatment since they need a visible affordance.
- Updated `test/filter-bar.test.js` to the new contract.

## Story/source tree portable JSON migration

- Trees converted from monolithic JS to per-branch JSON datasets: `src/trees/story/*.json`, `src/trees/story-pivots/*.json` (including new `service-content.json` for promotional/service journalism), `src/trees/sources/*.json`. `src/story-tree.js` / `src/source-tree.js` / `src/source-profiles.js` are now thin loaders, so the dataset is editable data rather than code.
- Headline matching in `src/story-groups.js`: multi-word terms match normalized cluster headlines (proper-noun surface forms catch stories the tagger failed to label); single words stay tag/entity-only unless curated into a per-node `headlineTerms` list.
- Dataset expansion across all branches driven by ungrouped-corpus escape analysis: gaming releases, science papers, crypto, corporate/funding routine, horse racing, Scottish football, cybersecurity, dev/open-source, service journalism, diet/nutrition, telecoms, fandom. Coverage reached ~4,762/5,557 clusters (86%, 230 groups, ~600ms).

## Favicon sprite pipeline (repeatable) + icon coverage

- Built `scripts/build-favicon-sprite.js`: repeatable fetch/quality-gate/composite pipeline (apple-touch-icon -> favicon.ico embedded PNG -> gstatic fallback, 8-way concurrent). Rejects tiles with <10% visible coverage; light-on-transparent glyphs get a dark rounded chip baked behind them so they read on the paper background. Re-runnable with `--no-fetch` (rebuild from cached tiles) or `--force host1,host2`.
- Refetched all 8 fully-transparent tiles that caused the "plain white icon" bug (cityam, nypost, vice, newscientist, digitaltrends, courant, globalnews, winnipegfreepress) plus 800+ others: 933 tiles in the sheet, all 99 allocated filter-bar controls now have icons (zero missing/zero letter-fallbacks).
- Concept icons for genuinely generic control groups: 15 fluentui-emoji SVGs in `src/favicons/concepts/` (other, wires, official, mobile, entertainment, sports, hardware, industry, finance, social, newspaper, broadcast, globe x3) patched into the source tree JSON for groups like news-wires, press-releases, public-bodies, regional clusters. `concept:x` keys normalize through `getFaviconSpriteClass` like host keys.
- Sprite registry keys are normalized sprite ids so lookup is consistent for hosts and concepts; offsets verified as 32px multiples in tests.

## Filter-TO semantics + filter bar loading/badges rework

- Inverted display-filter semantics from filter-out to filter-to: clicking a source icon or category chip now means "show only this" — the clicked control stays full color, every other icon dims (greyscale) but remains clickable to additively widen the selection. Clicking a selected control removes it; an empty selection shows everything. Applies to both the source bar and the category row.
- `state.sourceInclude` (new storage key) holds control keys (`group:<id>` or host keys) rather than per-host booleans, so group inclusion survives re-allocation. Legacy filter-out data is abandoned; legacy category `false` entries are stripped on settings load. `disabledSources` (Manage Sources) is unchanged — permanent exclusion is a separate concept.
- Visibility is a single lookup: allocation is disjoint, so `controlByHost` maps every host to exactly one control; a host is visible when the selection is empty or its control is selected. Individually-included hosts always surface as their own control even below the prominence cutoff, so a shrinking digest can't strand a selection with no clickable control.
- Per-icon count badges removed — exact counts live in tooltips. Icons are clustered into volume tiers derived from the actual distribution (geometric bounds from the max count, adapting to both thousand-story local digests and hundred-story deployed ones); each tier gets one small label chip ("216+", "54+", "few").
- A small × reset control appears in the source bar only while a selection is active; the category row's All button clears category selection.
- The whole source bar (filters + Mark Read) is `hidden` in the HTML and only revealed once digest data renders — no empty chrome before load.
- Tests rewritten for the inclusion contract: 59/59 pass.

## Filter bar layout + control cleanup
- Mark Read moved from the source-icons row into the categories row, pulled right —
  the icons row now spans the full width alone.
- Category pills are restrict-TO single-select like the source filters: transparent
  by default, inverse only when selected, others dimmed; clicking a category replaces
  any prior selection, clicking the active one clears. Legacy multi-select settings
  collapse to the first entry on load.
- Masthead cyclers removed (all/main/bbc mode toggle + Categories cycler) — the
  inclusion filters supersede them; saved `mode`/`categoryFilter` settings are pinned
  to the pass-through values on load so nothing can silently filter with no UI left.
- Search is a persistent textbox — the magnifier pre-state and panel show/hide wiring
  are gone; the input is visible in the header area at all times.


## Trust flags + state-media restructure (2025)

- **Nationalist & State Media family** added to the source tree — state-directed outlets
  (RT, TASS, CGTN, Global Times, TRT World, Anadolu, BelTA, Prensa Latina, UATV, Al Jazeera)
  no longer sit among genuine public-service broadcasters in "International Public".
  RT sits inside Russian State Media within the nationalist/state family; CGTN is cross-filed
  in both Chinese State Media and China Media so the also-links connect the memberships.
  Al Jazeera is placed by ownership reality (Qatari state media) with notes on its documented
  editorial independence rather than a red flag.
- **Trust flags**: profiles now support a `flags` array — label, explanatory note, and
  reference links. Flags render as visible red chips on the collapsed outlet row (never
  hidden inside expansion) plus full note + references inside the profile body.
- **Multi-reference rule enforced in tests**: every flag must cite at least 2 independent
  references (regulators, court records, peer-reviewed studies, press-freedom monitors).
  Single-source accusations are structurally impossible.
- First flags: RT (EU sanctions + Ofcom revocation), TASS (Kremlin-appointed leadership +
  peer-reviewed propaganda analysis), CGTN (CCP-controlled, Ofcom revocation + US foreign
  agent), Global Times, BelTA, Prensa Latina, TRT World (DOJ foreign-agent determination),
  Anadolu, UATV (self-declared information-warfare channel), Fox News ($787.5m Dominion
  settlement), Daily Mail + The Sun (Wikipedia deprecation RfCs), The National UAE
  (state-owned with documented royal-family red lines).

## Sprite uniformity fix + ALL source-filter control (2025)

- **Spritesheet cropping bug**: legacy tiles were cached at whatever size they were fetched
  (16px to 448px) and composited into 32px grid cells without resampling, so icons spilled
  across neighbouring cells and displayed as clipped fragments. The cache-reuse path never
  validated dimensions. Fixed: transparent margins are trimmed, every glyph is resampled
  into a uniform 28px inner box inside exact 32x32 cells (never cropped, aspect preserved),
  lanczos3 for downscales, nearest-neighbour upscaling for tiny pixel-art favicons.
  Wrong-sized cache entries are resampled in place rather than refetched; `--renormalize`
  forces a full no-network rebuild. All 933 tiles verified uniform; sheet-to-CSS offsets
  verified pixel-identical.
- **ALL control**: the sources bar now leads with an ALL button before the first volume-tier
  chip — inked when nothing is filtered, clickable whenever a selection is active to unset
  everything. Replaces the trailing × reset.

## Masthead search (2025)

- The search textbox lives in the masthead itself (right side, before the settings icon) —
  not in a separate panel below the source bar. Immediately focusable, always visible,
  no pre-state of any kind. Ctrl+F/F3 still focus-and-select it.
- Recent searches render as a dropdown beneath the input, revealed only while the field
  has focus (focus-within) — no always-on chip row cluttering the layout.
- Responsive: the masthead title is fluid (clamp) and shrinks first; below 640px the
  title takes its own row and the search input flexes full-width alongside the date —
  the box is never crushed or hidden on narrow devices.

## Back-to-top + hydration self-healing (2025)

- **Back to top**: fixed button styled like Mark Read, appears only after scrolling two
  viewport heights. Positioned in the gutter just right of the broadsheet column —
  never overlapping content phone readers might want to select/copy. Hidden entirely
  when the viewport is too narrow to have a real gutter.
- **Hydration no longer depends on IntersectionObserver event delivery alone.** The old
  design had no state reconciliation: hydration was implicit in DOM classes, driven purely
  by observer callbacks, so any missed event left permanent empty shells, and one throwing
  entry silently killed hydration for every other node in the same batch. Fixed twice over:
  per-entry error isolation in the observer callback, plus a geometric sweep that runs when
  scrolling settles (160ms debounce), after progressive materialization completes, and after
  search re-reveals hidden shells — any shell inside the hydrate margin is hydrated based on
  where it actually IS, not whether an event happened to fire. Verified observerless in jsdom:
  the sweep alone hydrates in-viewport shells and leaves far-below ones lazy.
- **Search box restyled**: pill shape, tinted fill with inset magnifier glyph, soft focus
  ring, hover border, theme-aware icons for day/night, styled native clear control.

- **More-expander removal + virtualization rebuild** — removed the short-summary
  collapse/"More" rendering entirely (glimpse is now pure data with zero rendering
  impact, enforced by test); removed the fixed-height in-place swap grid so
  article panels are natural height in both states. Rebuilt feed hydration as
  textbook windowed virtualization: single geometric rAF driver (no
  IntersectionObserver, no sweep, no click fallback), overscan hysteresis
  (1200px enter / 2400px leave), phased read-then-write geometry, measured
  heights for displayed content and estimates only below the fold.

- **Text truncation removed end-to-end** — no artificial truncation anywhere in the
  pipeline: prepareStoryForLLM passes full text (the LLM is length-controlled by
  instruction, so input truncation only destroyed data), source-derived cluster copy
  is the full source text with no fabricated ellipses, and the dead short-summary
  deriver is gone. Publish-time repair pass reconstructs full summaries from the
  story store for clusters mangled by older runs (~3-4.6k repaired per build),
  backfills missing story description/content (8125 stories), and dedups feeds that
  repeat description as content. Remaining ellipsis endings are publisher-side
  truncations in the feeds themselves.

- **Feed-markup injection fix** — RSS content HTML (including Techmeme's
  self-contained item cards with their own headline/byline/permalink chrome) was
  stored raw and baked into summaries, rendering foreign cards nested inside
  article chrome. Boundary fixed at ingest: all feed text is plain-text normalized
  (tags stripped, entities decoded to fixpoint) in fetch-rss and prepareStoryForLLM,
  so markup never enters the pipeline. Client rendering escapes plain-text fields
  as contract enforcement. One-off migration scripts/repair-digest.js cleaned the
  cache (1542 summaries rebuilt, proof-gated to never touch LLM editorial copy) —
  the repair is NOT in the forever-build; prevention lives at the boundary.

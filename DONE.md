# DONE

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

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
- `Group By Tag` setting (off by default) moves matching clusters into contiguous curated groups preserving sort order; articles show a compact group path label.
- Term matching is whole-token string matching only — never char-substring — so each node's `terms` act as an explicit catch list. Escape analysis against the real digest drives new catch terms and branches, including a `world-regions` pivot that groups leftover geography (British Isles, Americas, Europe, Asia Pacific, Middle East, Africa).
- Tag allocation runs ~300ms over 5,557 clusters via an inverted term index; produces ~195 groups covering ~4,430 clusters (80%). Remaining oversized groups are coherent single subjects (China, Police, Wales, US States, Games).

## Relationships page

- Added `src/relationships.html` + `src/relationships.js` + `src/styles/relationships.css`, bundled into `dist/` via vite config.
- Shows every host's current allocated filter branch, all curated relation paths (hosts can belong to several), researched per-source profiles (`src/source-profiles.js`, heterogeneous fields + evidence links), and the curated tag tree.
- Linked from the site footer and the Settings sidebar.

## Docs/build boundary

- Build output moved from `docs/` to `dist/`; the Pages action uploads `./dist`; stale generated `docs/` artifacts removed; `docs/` now holds real documentation including `docs/sessions/` logs.

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

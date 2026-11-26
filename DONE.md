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

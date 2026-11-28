# DONE

## Measured-source interest filters + manage-panel links (2026-11-28)

- Fox absence explained, not a bug: Fox News and the Fox local affiliates have only 1-7 pooled headlines each because no Fox feed is configured in ingestion (`RSS_FEEDS` covers BBC/gaming/urgent/techmeme/sky/techpress/science). The few Fox items arrive via aggregators. The Fox feed itself (`moxie.foxnews.com/google-publisher/latest.xml`) is live, so measuring Fox is an ingestion decision, not a measurement limitation.
- Reader-interest filter chips added above the measured-source sections: sixteen sector/type groups (UK national papers, US national news, local & metro, broadcasters, world & international, games, sports, tech, science & health, business & markets, digital-native, billionaire-owned, state-influenced, corporate & official, aggregators, lots of articles). Groups are comparison-minded rather than ownership-tree-minded per the design guidance; cross-cutting sets (billionaire-owned, state-influenced, high-volume) deliberately overlap sector sets. Filters narrow the existing corpus-relative ordering only — no recalculation. Definitions live in `src/measured-filters.js`, validated so every measured source falls into at least one group and every group has at least two members.
- Manage Sources panel now links to the measured-sources page at the top ("See how sources measure up"), since the only other paths were the page footer or the settings list.
- Verification: `npm test` 15/15 files, 109/109 tests including five new filter-coverage tests; production build passes.

## Measured-sources ordering, coverage and manage-list quality (2026-11-28)

- Multi-column source lists were CSS-column layouts, so reading order ran down the left column then continued at the top of the right (1–10 left, 11–19 right), hiding the fact that position in the list is the ranking. The layout is now a row-major grid (`repeat(auto-fill, minmax(min(100%, 430px), 1fr))`), so reading left-to-right, top-to-bottom follows the score order at any column count; expanded cards span the full grid width. Rank numbers are bold so the ordering is visibly deliberate.
- Quartile-band sections replaced by three reader-oriented sections: top twenty, one unified middle list, bottom twenty. Band chips remain on cards as per-source context, and the methodology panel now says plainly that adjacent positions are often effectively tied and points readers at the per-source sampling-uncertainty range.
- Coverage widened from the stable-rank set (n≥20, 76 sources) to every source with at least 10 pooled headlines: **145 measured sources**. This brings back major outlets that sat just below the old threshold — Al Jazeera, Axios, the New York Times, DW, Le Monde, Middle East Eye, Euronews and others. Scores for small samples were already computed (empirical shrinkage regresses them toward the mean); the gap was bootstrap uncertainty intervals, which the pipeline previously only calculated for rank-eligible rows. The bootstrap now covers n≥10 rows using the same reference distribution — purely additive, no existing score changes — so every displayed source carries a 95% sampling range. Small samples are marked "small sample — unstable" in the card subtitle (e.g. Investing.com scores 77.5 at rank 3 but with a 56.8–95.0 sampling range).
- The export now assigns display ranks across the full included ordering and writes a slim `src/data/source-quality.json` lookup (156 keys including grouped member keys) so other pages can reference measured quality without bundling the full 380KB export.
- Manage-sources list: the per-source row now reads "N articles, quality NN.N" instead of "N stories in pool", using the quality lookup; unmeasured sources show the article count alone.
- Verification: corpus invariants pass unchanged (pipeline rank set still 76 at n≥20 — the export's wider inclusion is a presentation decision); `npm test` 14/14 files, 104/104 tests including updated manage-panel expectations; production build passes; `dist/measured-sources.json` matches the source export. Nothing committed.

## Title-case truecasing for headline parsing (2026-11-28)

- Diagnosed a systematic measurement bias: title-case headlines (Kotaku/IGN publish almost entirely in Title Case) broke spaCy POS tagging, so verbs were misread as nouns and event/action surfaces were undercounted for exactly the gaming sources whose style prompted the investigation. Confirmed with maintainers' own answers that no spaCy model setting fixes this — even `en_core_web_lg`/`trf` fail on Title Case input.
- Adopted truecasing (the purpose-built NLP solution, Lita et al.'s tRuEcasIng) via the `truecase` package with a conservative fallback in `scripts/headline-analysis/headline_truecasing.py`, preserving all-caps acronyms and first tokens. Title-case rows are now scored as the maximum over the original parse and the truecased parse — 1,893 of 11,461 rows dual-parsed, costing ~2s of a ~204s runtime.
- Full corpus rerun: rankings reordered materially. TweakTown 78.11, MyJoyOnline 77.86 and Eurogamer 76.53 now lead; Kotaku falls to 23.29 (rank 75, event rate 0.335) and IGN to 29.52 — their low scores are no longer parse artefacts but measured headline behaviour. Eurogamer's high score is genuine: sentence-case headlines with real event verbs. Composite range 20.17–78.11 across 76 ranked sources.
- Regression coverage: one exact curiosity expectation shifted slightly (better POS densities), updated with four new title-case regression cases — 87 detector cases + 4 suffix-strip cases pass.
- The stale pre-truecasing export (range 62.57–81.04) was regenerated: `src/data/measured-sources.json` now reflects the post-truecasing measurement (bands 62.80–78.11 / 48.95–62.57 / 39.03–48.37 / 20.17–38.06) and `dist/measured-sources.json` matches it.

## GAPS source-research ingestion (2026-11-28)

- Curated all 83 deep profiles from `.working/sources-manifest-GAPS-RESEARCH-2026-11-27.md` into `src/trees/profiles/sources.json` (67 new keys, 17 merged into existing profiles), keeping only durable reader-relevant facts: ownership, funding model, declared missions, structural incentives and conflicts — not ChatGPT hedging or methodological disclaimers.
- External ratings kept separate as structured evidence: 39 new rater entries in `src/trees/profiles/source-assessments.json` (TOLD, MBFC, AllSides, Ad Fontes), preserving rater/type/rating/URL rather than compositing — several entries note explicitly that lean ratings describe framing, not factual accuracy.
- Family-level guidance applied to member sources rather than blanket-copied: Industry Dive titles share the public editorial-code note; Future plc consumer titles carry the commerce-engine article-class warning; McClatchy local newsrooms are distinct local newsrooms with parent-level context; press-release wires attribute claims to issuers, not newsrooms.
- Corrected the research file's own errors where verification contradicted it: `thenewsstar.com` is Gannett/USA Today Co. (confirmed against its own help centre and Wikipedia), not McClatchy as the research grouping implied; `stuff.tv` is explicitly not Stuff NZ; `biomedviews.com` carries a feed/domain-integrity anomaly warning rather than a clean biomedical classification.
- 120 `dev.to/<author>` pages, 2 Medium author pages and 4 Substack tenants classified as individual author output on multi-tenant platforms — not independent newsrooms, no platform-wide reliability rating.
- Tree homes added for all newly profiled keys across the family files (Industry Dive, Future, McClatchy, Gannett, Condé Nast, regional-english including new small Bangladesh/Vietnam nodes, platform tenants under DEV/independent-blogs/developer-blogs/social-aggregators). Tree coverage: 1,129 hosts; all 424 profiles now sit inside the curated source tree; 110 sources carry external assessments.
- Verification: `npm test` 14/14 files, 104/104 tests (including the profiles-inside-tree invariant that initially failed for the 169 unplaced keys); `npm run build` passes; corpus invariants unchanged (11,461 headlines / 687 sources / 76 ordered).

## Measurement implementation split into focused modules (2026-11-28)

- Split the monolithic headline analyser (previously ~2,000 lines in one file) into focused modules under `scripts/headline-analysis/`: lexicon (`headline_measurement_lexicon.py`), metric schema (`headline_measurement_schema.py`), source/name-specific measurement corrections (`headline_measurement_tunings.py`), evidence surfaces (`headline_evidence_features.py`), curiosity-gap risk (`headline_curiosity_features.py`), event/numeric/place/context surfaces (`headline_language_features.py`), row orchestration (`headline_measurement_features.py`), corpus structure — topic model, reuse, phrase signatures (`headline_corpus_structure.py`), source-level aggregation/composites (`headline_source_statistics.py`), and report writing (`headline_reporting.py`). `analyse_headlines.py` is now a ~400-line orchestrator.
- Source-specific measurement presentation moved out of code: display labels and per-source measured-quality notes live in `src/trees/profiles/source-measurement-overrides.json` beside the other source profiles; measurement-grouping reasons and the Fox non-grouping decision live in `docs/tasks/headline-analysis.task.json` next to the groups they explain. The REPORT grouping paragraph is generated from that config rather than hardcoded.
- Frontend split: spiderweb SVG rendering extracted to `src/measured-spiderweb.js`; `src/styles/measured-sources.css` is now five concern-based partials (layout, cards, detail, methodology, responsive) behind one import file. The first manual split dropped 38 CSS rules through a mid-rule boundary cut; the split was redone programmatically at rule boundaries and verified rule-for-rule identical to the committed original (81/81 rules).
- Export builder decoupled from the analyser module: `build_measured_sources.py`, `validate_detectors.py` and `make_charts.py` import schema constants directly instead of pulling in the spaCy-loading analyser.
- Verification: post-refactor analyser output is value-identical to the pre-refactor baseline (`source_rankings.csv` 687×155, `source_axis_profiles.csv` 687×64, `headline_level_signals.csv` 11,461×119, analysis summary identical ignoring runtime). Numbers unchanged: 76 ranked sources, Eurogamer 81.04 top, range 18.43–81.04. 83 detector cases + 4 suffix-strip cases pass; corpus invariants pass; `npm test` passes 14/14 files and 104/104 tests (including 3 new spiderweb geometry/rendering tests); production `npm run build` passes; `dist/measured-sources.json` matches the source export. Nothing committed.


## Continuous evidence/curiosity measurement finalised (2026-11-28)

- Replaced the sparse stock-regex evidence detector with a family-based continuous evidence-surface score: documentary/legal/data evidence highest, typed research evidence next, direct testimony moderate, communication-event or vague-attribution surfaces low. spaCy `en_core_web_sm` supplies noisy POS/entity support, but measurement remains transparent token-boundary surface matching rather than semantic truth judgement. Proper-name collisions, passive fragments, negated `tell` constructions, content labels such as standalone transcripts, and compound uses such as video game/gameplay footage are guarded.
- Replaced binary curiosity-gap detection with continuous curiosity-gap risk using broad structural withholding families: stock teaser forms, listicle/example withholding, unresolved forward references, resolution/reaction/mechanism gaps, vague references, and pronoun/determiner/WH load, attenuated where the headline already supplies concrete anchors. Transparent service/explanatory headlines are not treated as clickbait merely because they use question or how-to form.
- Calibrated the curiosity measurement only in aggregate against the fixed stratified LLM audit labels: 133 assessable rows, Spearman 0.751, Pearson 0.735; mean risk by audit score rises 0.029 → 0.140 → 0.390 → 0.547 across scores 0–3. Low-label rows scoring at least 0.5: 4/95; high-label rows scoring below 0.2: 4/38. This is a graded source-level language measurement, not a story verdict or formal precision/recall validation.
- Body/summary diagnostics now include strong-evidence, testimony and vague-attribution surfaces. They remain diagnostics only because coverage varies sharply by feed/source; they do not alter the headline composite. The report body table now exposes those newer surfaces rather than the older narrow regex-only rates.
- Full regeneration completed: 11,461 headline rows, 687 measured/grouped source keys, 76 ranked sources, runtime 204.1s. Empirical composite shrinkage is k=15.38; axis cap is 12.51 adjusted percentage points. Final measured-quality range is 18.43–81.04. High-volume ordering is Eurogamer 81.0, Korea Times 70.5, The Guardian 69.1, City A.M. 58.7, Financial Times 57.2, Medical Xpress 52.6, BBC 45.8, Phys.org 42.5, The Independent 42.5, Mirror 41.6, Punch 34.7, IGN 26.0, Daily Mail 25.7, Kotaku 18.4.
- Axis display spread is no longer narrow for the two problem axes. Across the 76 measured sources, evidence specificity now spans 9.3–100 on the shared spiderweb scale (median 47.95; 11/76 within 45–55), while curiosity-gap restraint spans 0–79.4 (median 52.7; 16/76 within 45–55). The underlying adjusted-point ranges remain asymmetric because these are mostly penalty/risk axes; the display spread is corpus-relative and the natural-unit differences remain visible in the detail cards/export.
- Evidence-source distributions are now plausible at aggregate level: direct testimony is the common layer (median source rate about 6.8%), strong documentary/legal/data evidence remains rare, and research-release sources separate clearly — Medical Xpress has a 15.7% research-evidence surface rate versus 0.8% direct headline testimony, while The Guardian has broader direct testimony and quotation surfaces. Curiosity-risk leaders include Business Insider, CBS News, Vice, TechRadar, Reddit and Kotaku; many wire-like/source-specific streams remain near zero.
- Updated methodology, metric dictionary, detector validation axes, corpus invariants, measured-source diagnostics/export, radar annotation, audit sample and regression coverage. Final detector regression coverage is 83 detector cases plus 4 suffix-strip cases; corpus-output invariants pass for 11,461 headlines, 687 sources, 13 radar axes and 76 ordered sources.
- Rebuilt `src/data/measured-sources.json`, `dist/measured-sources.json`, validation sample, charts and production site. `npm test` passes 13/13 files and 101/101 tests; `npm run build` succeeds. Nothing was committed.

## Measured-source numerical scaling finalised (2026-11-27)

- Final measured-source composite rebuilt as a robust natural-unit aggregate: per-axis context-adjusted residuals are empirically shrunk, each shrunk axis contribution is symmetrically capped at the corpus-derived 95th-percentile absolute axis deviation, then the 11 axes are averaged and corpus-normalised for display. This was a numerical scaling change only; the frozen headline rows and detector outputs were not further cleaned.
- Fringe-case text review drove the choice. Equal z-weighting made formulaic research-release sources look too strong (PsyPost/Medical Xpress) and over-penalised moderate curiosity/service deviations; uncapped natural units gave single large axes too much leverage. The capped natural-unit compromise preserves real magnitudes without letting one axis swamp the profile.
- Final run: 11,461 headline rows, 687 measured/grouped source keys, 76 ranked sources, empirical shrinkage k=16.18, axis cap 12.23 adjusted percentage points, composite range 18.33–82.56, mean bootstrap CI width 27.61, runtime 177.2s.
- High-volume ordering is now: Eurogamer 82.6, Korea Times 70.2, The Guardian 68.6, Financial Times 57.2, City A.M. 56.2, Medical Xpress 55.0, BBC 46.5, Phys.org 44.9, The Independent 42.8, Mirror 42.6, Punch 35.3, Daily Mail 26.5, IGN 24.2, Kotaku 18.3. These remain bands/ordering aids, not precise publisher-quality scores.
- Final numerical audit is embedded in `docs/headline-data/current/REPORT.md`: length-adjusted ranking Spearman 0.932, simple axis-z average 0.915, raw unadjusted signal 0.809. Leave-one-axis-out ordering remains Spearman 0.908–0.999; time/place, material consequences, event clarity and context carry most spread, while sparse evidence/curiosity axes carry less. Cap sensitivity is high: q=0.90 Spearman 0.992, q=0.99 Spearman 0.995, uncapped Spearman 0.992 versus the primary q=0.95 composite.
- Sparse-axis decision: curiosity-gap restraint and evidence specificity are not separately boosted. Median absolute adjusted deviation is only 0.11pp for curiosity-gap restraint and 0.53pp for evidence specificity, so most sources genuinely cluster there; unusual offenders/evidence-heavy sources still matter without giving sparse cues artificial equality with high-variance event/context axes.
- Overlap decision: explanatory framing and avoidance of direct/service packaging correlate at -0.50, but they are intentionally not decorrelated. Explanatory/service headlines can receive explanatory credit while still incurring packaging pressure; removing that overlap numerically would erase the distinction.
- Regenerated `docs/headline-data/current/*`, `src/data/measured-sources.json`, validation sample and charts; built `dist/measured-sources.html` plus copied `dist/measured-sources.json`. Corpus invariants pass; `npm test` passes 13/13 files and 101/101 tests; production `npm run build` passes.

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

- **Generated og-image (Nov 26)**: `src/og-image.jpg` is generated on demand by `scripts/build-og-image.js` (run manually, commit the output) — a dense edge-to-edge field of source favicons at native resolution (no upscaling; baked-in tile margins cropped out), volume-ordered with irregularly scattered 2×2 quad slots for sources that have real hi-res artwork, masthead type on localised dark strips. The build just copies the committed file like any other static asset.
- **Category provenance repair (Nov 26)**: fixed the plugin-provenance bug end-to-end. Causes: plugin keyword searches matched loosely (API ANDs words but not as a phrase), and `tags.js` structural tags (plugin name, category label) counted as category evidence — spiritual/film/lifestyle stories matching "dark souls" self-certified as Gaming. Fixes: exact-phrase verification at plugin ingest (`fetch-news.js`), structural tags excluded from classification (`categories.js`), singletons now categorised editorially in the clickbait-screening LLM call, and 91 already-poisoned backlog clusters repaired by actually reading all 415 Gaming singletons (`scripts/repair-categories.js`, one-off).
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

## Headline-source analysis instrument (2026)

- Recovered the truncated external headline-analysis zip, placed its scripts under
  `scripts/headline-analysis/`, and reworked the tool into a reproducible dev-time
  analyser driven by `docs/tasks/headline-analysis.task.json`. Outputs now live in
  `docs/headline-data/current/`; this is run-once measurement tooling only and is
  not wired into build/CI.
- Export format now includes machine-readable `headline-rows.jsonl` with canonical
  source keys, URLs, timestamps, relation branches and curated profile context, so
  the analyser no longer depends only on display names or flat export-file groups.
- Detector taxonomy improved: explicit curiosity gaps, direct/service packaging,
  and sensational/personal framing are separate axes; evidence provenance is
  fractional (generic research 0.5, primary artefacts 1.0). Manual audit led to
  exact-word matching with explicit inflections rather than substring stems,
  ambiguity guards for words such as open/pass/rules, removal of literal event
  verbs from the sensational lexicon, narrower stock-clickbait matching, and
  precision fixes for evidence/original-access false positives (`record contract`,
  databases, generic investigations, gaming/platform exclusives, `pose risk`,
  science/genre uses of horror/chaos, Tyson Fury's surname, earnings transcript
  labels, and narrative uses of "we found"). 59 detector regression cases pass.
- Export merging now prefers the richest available duplicate story text, so
  article summaries from `stories.json` are retained instead of being displaced by
  shorter digest text. Body/summary coverage rose from 4.6% to 58.4% of rows under
  the strict materially-longer-than-headline check; body cues are exported as a
  corroboration tier, not composite input, because coverage varies sharply by feed.
- Source ordering uses cross-fitted topic/editorial-context expectations
  (GroupKFold by source), residual shrinkage with a sensitivity grid, quartile
  bands, bootstrap intervals, and partial rather than full topic forgiveness for
  attention farming. Length-adjusted ordering is exported as a sensitivity rather
  than the primary index because headline-level information density is the object
  being measured.
- Added validation scaffolding: corpus-output invariants, source-capped random
  `detector_validation_sample.csv` with blank `human_*` columns, and
  `validate_detectors.py score` for precision/recall/F1 once labels exist. Current
  validation status is explicitly unlabelled; no quantitative detector precision
  is claimed.
- Final verified local run over 11,461 headlines / 695 sources took ~85s. Corpus
  invariants pass; validation remains unlabelled, so no quantitative detector
  precision is claimed. High-volume ordering: Eurogamer, Medical Xpress and the
  Guardian at the top; BBC slightly above Mirror; Kotaku and Daily Mail at the
  bottom. Small-sample leaders remain interpretive leads rather than robust
  publisher verdicts. Charts, interactive radar, per-headline rows, source axes,
  body/summary diagnostics, sensitivity tables and the machine-readable metric
  dictionary are in `docs/headline-data/current/`.

## Measured-source quality page + machine-readable export

- Added `measured-sources.html` as a peer to the relationships page, linked from
  the footer, settings panel, and relationships cross-link. It orders the 76
  sources meeting the minimum measured-headline threshold into quartile buckets
  and presents ranks as broad bands rather than precise quality verdicts.
- Each source expands into an eleven-axis spiderweb (events, numbers, place,
  causality, stakes, evidence, context, explanation, plus three attention-restraint
  axes). All axes point in the desirable direction, with 50 as the corpus-relative
  typical ring; source-specific measurement notes appear beneath the spiderweb only
  where they add information (research-release pipelines, journal-title form,
  German-language undercounting, syndicated obituaries, official platform copy,
  tabloid packaging drivers, grouped-edition structure).
- Added `src/data/measured-sources.json` via
  `scripts/headline-analysis/build_measured_sources.py`: bands, axis definitions,
  scale metadata, per-source composite/axes/rates/adjustments/diagnostics, member
  detail, notes, relationship anchors, and `sourceIndex` aliases so grouped member
  hosts resolve to their measured group. The frozen export is copied as static site
  data; analysis itself remains dev-time only.
- Conservative measurement grouping is configured in the task file: BBC services,
  Mashable regional editions, Philippine Daily Inquirer verticals, and New York
  Post/Page Six are measured together; unlike-owned Fox-branded affiliates are not
  grouped with Fox News. Member-level raw profiles were checked before grouping: Mashable editions
  are similar, Page Six is small and close to the main New York Post stream, while
  the Inquirer note explicitly warns that tiny verticals differ and the combined
  view mainly describes the main/news streams.
- Filled source-tree membership gaps needed by the measured page: Times of India /
  Indian Express / Economic Times hosts, Bernama, Inc., Winnipeg Free Press, and
  Chalkbeat now have relationship-tree placements. Renamed the misleading
  `Business Insider Network` grouping to `Business & Startup Digital` because most
  members are not Business Insider properties. Every measured source now resolves
  to a real relationship-page anchor.
- Presentation audit fixed the expander layout, mobile search layout, dark-mode
  band colours, spiderweb label clipping, cramped expanded cards, duplicate source
  family labels, quartile boundary overlap, and stale analysis charts. Verified
  rendered output in Firefox headless at desktop/mobile widths and with expanded
  spiderwebs. `npm test` passes 97/97 and `npm run build` succeeds.

## Source-manifest update import (2026-11-27)

- Reviewed all 118 source blocks in `docs/sources-manifest-UPDATE-2026-11-27.md`
  and imported the durable facts into `src/trees/profiles/sources.json`: ownership,
  governance, publishing model, source-specific watch notes, structural corrections
  and evidence links. Corpus-observation percentages and repetitive self-description
  disclaimers were deliberately not copied; they are snapshot/method framing rather
  than durable source facts.
- Added tree homes for previously unplaced sparse sources including Axios, BuzzFeed,
  The Hill, Global News, News18, Interfax-Ukraine, People Daily, The Conversation,
  Mongabay, Nautilus, Endpoints, Investing.com, Benzinga and `dev.to/wlz`. Matched
  export coverage improved from 522 to 543 of 695 cache sources.
- Applied explicit relation corrections: Engadget/BGR moved from Yahoo to Static
  Media; GameSpot moved from Red Ventures to Fandom; CNET and Mashable sit under
  Ziff Davis; Sky News UK moved out of the US Comcast branch into UK national
  broadcasters; Philadelphia `inquirer.com` and Philippine `newsinfo.inquirer.net`
  are now structurally separate publishers.
- Corrected entity kinds where the hostname was misleading: `obits.oregonlive.com`
  is Legacy-hosted obituary listings rather than the OregonLive newsroom,
  `factcheck.afp.com` is the AFP Fact Check vertical rather than a general AFP wire
  feed, and `dev.to/wlz` is an individual author feed rather than DEV as a platform.
- Centralised display labels in `src/source-labels.js` so pipeline, export and
  reader pages resolve the same names. This fixed visible labels such as Economic
  Times, Times of India, Interfax-Ukraine, Philippine Daily Inquirer, The
  Philadelphia Inquirer, Yahoo Sports and Xbox Wire instead of host-derived
  fragments such as “Indiatimes”.
- Reran the full dev-time analysis after the tree corrections: 11,461 headline rows,
  687 measured/grouped source keys, 76 ranked sources, corpus invariants passing.
  The Philippine Daily Inquirer group contains only Philippine verticals;
  Philadelphia remains separate but unranked with 17 headlines. Measured-source
  relationship links now point at the corrected Static Media/Fandom/Sky UK anchors.
- The update file itself has been reduced to an import ledger: processed source
  blocks were removed so the same ChatGPT research delta cannot accidentally be
  imported twice.

## Source-knowledge gaps dump + external bias assessments (2026-11-27)

- Generated `.working/sources-manifest-GAPS-2026-11-27.md`: 517 gap rows out of
  695 cached source keys (488 unprofiled, 15 minimal, 14 thin), sorted by cached
  unique-headline count with relation status and one sample headline per row. The
  same generation pass validated the completed update import: all 118 keys resolve
  to usable profiles and curated relations, with no unprocessed update markers left.
- Imported `.working/sources-bias-reports-2026-11-27.md` into a separate structured
  dataset, `src/trees/profiles/source-assessments.json`, rather than folding third-party
  verdicts into curated profile prose. It preserves 126 source-level assessments across
  86 source keys by rater, scope and evidence URL: 44 MBFC, 59 MediaBias.News index,
  18 AllSides and 5 Ad Fontes entries. MediaBias.News rows are explicitly typed as
  republished index signals rather than independent votes; no composite or averaged
  ideological score was created. Rows that mentioned an AllSides review without
  reproducing its current label were not imported as ratings.
- Relationships and measured-source detail cards now surface external assessments
  beside curated context, including MBFC factual-reporting tiers where present and a
  compact “republished index” tag for MediaBias.News rows. `measured-sources.json`
  carries the same assessments as metadata; they are not inputs to measured quality.
- Verification: regenerated `src/data/measured-sources.json`; `npm test` passes
  101/101 and `npm run build` succeeds.

## Measured-score decompression + final validation (2026-11-27)

- Reworked the measured-quality composite after finding that independently
  z-scoring eleven sparse axes compressed almost every source into a narrow band.
  The composite now aggregates cue residuals in natural percentage-point units
  before one corpus-relative display normalisation. Axis z-scores remain
  diagnostic spiderweb inputs rather than a second equally weighted composite
  stage. Composite shrinkage is estimated from within/between-source variance
  (`k≈16.18` in the final run), and shrinkage sensitivity remains high
  (Spearman about 0.999 at nearby settings).
- Deepened weak binary detectors into fractional measurements where that was
  tractable: direct/speech/nominal event forms, exact versus weak numeric detail,
  explicit versus weak context/comparison, and research-claim versus primary-artefact
  evidence. Final detector regression coverage is 72 detector cases plus 4
  source-suffix cases.
- Corrected two measurement artefacts found during manual audit. First, raw spaCy
  place entities are no longer trusted alone because the small model frequently
  labels sports clubs, companies, games, people and “AI” as places; exact
  corpus-audited false-positive overrides, context requirements for ambiguous
  place names, and reduced-weight facility hits are used instead. Second, exact
  publisher boilerplate suffixes such as “- The Korea Times” and
  “| The Jerusalem Post” are stripped before measurement while editorial
  hyphenated subtitles remain; 238 rows were cleaned and raw headlines remain
  exported for audit.
- Final run: 11,461 headlines, 687 grouped/measured source keys, 76 ranked
  sources, runtime about 181s. Composite range is now 21.40–81.46 rather than
  the previous narrow cluster. High-volume ordering is Eurogamer 81.5, Guardian
  73.8, Korea Times 67.9, City A.M. 59.9, Financial Times 58.0, Medical Xpress
  54.3, BBC 46.7, Phys.org 45.2, Independent 43.3, Mirror 41.0, Punch 30.0,
  Daily Mail 28.8, IGN 23.5, Kotaku 21.4. Small-sample leaders remain leads,
  not robust publisher verdicts.
- Rebuilt `src/data/measured-sources.json` with one shared axis display scale
  derived from the pooled 95th-percentile absolute z position across all measured
  axes (22.26 points per z unit). This keeps axes comparable while using most of
  the spiderweb range. Final quartile ranges: strongest 62.66–81.46,
  above-typical 46.95–60.67, below-typical 38.98–46.81, weakest 21.40–38.94.
- Measured-source detail cards now show sampling intervals, underlying adjusted
  percentage-point differences, and strongest/weakest axes with their natural-unit
  differences, so sparse-axis spiderweb positions are less likely to be misread
  as absolute percentages.
- Verification: detector tests pass (72+4 cases); corpus-output invariants pass
  for 11,461 headlines, 687 sources, 13 radar axes and 76 ordered sources;
  `npm test` passes 101/101; `npm run build` succeeds. No analysis step was added
  to the normal build pipeline.

# Title-only reader-value signals — improved exploratory run

Corpus: **11,461 headline rows**, **687 sources**.
Source ordering eligible: **76** sources with at least 20 headlines. **611** sources are below the threshold and unranked.
Runtime: **216.8s** local. Stage timings: parse_archive 2.0s, detectors 98.9s, headline_reuse_and_templates 26.1s, topic_model_and_crossfit_expectations 8.5s, source_statistics_and_bootstrap 77.0s, write_tables_and_radar 4.3s.

## Measurement definition
The core ordering has 11 cue inputs: eight information-delivery markers plus inverse forms of curiosity-gap risk, direct-address/service packaging, and sensational/personal framing. Original-access cues and cross-source title echo are plotted as diagnostic axes but excluded from the composite. Evidence specificity is now a continuous evidence-surface score rather than two stock regex tiers: documentary/legal/data evidence scores highest, typed research evidence next, direct testimony and quotation moderate, communication events or vague attribution low, and no surface evidence zero. Curiosity-gap risk is also continuous: stock teaser forms are high-risk, while vague references, withheld listicle examples, unresolved forward references, resolution/reaction/mechanism gaps and pronoun/determiner load combine as inspectable noisy-or evidence, attenuated when the headline already supplies concrete anchors. Event clarity is fractional: direct action verbs count 1.0, grammatically uncertain title-case verb forms count 0.75, speech/report/announcement acts count 0.5, and nominal event references count 0.5. Context is fractional as well: explicit comparison or record/history cues count 1.0, amid/following count 0.75, and bare sequence or comparative forms count 0.5. Numeric detail distinguishes exact quantities from weaker years, scale words, ordinals, listicle positions and product/version numerals. The composite aggregates cue residuals in natural units, so a source with several concrete cue differences outranks one with a single cue. After empirical shrinkage, axis contributions are saturated symmetrically at a corpus-derived 95th-percentile absolute axis deviation before averaging; this keeps one unusually large axis residual from dominating without renormalising rare and common cues into artificial equality. The spiderweb axes themselves remain uncapped diagnostic z-scores, not a second equally-weighted composite stage.

## Method changes in this run
- Curated export metadata is used when `headline-rows.jsonl` is present: canonical source key, URL, timestamps, relation branch, editorial context, and the available body/summary text.
- Exact publisher-name boilerplate suffixes such as “- The Korea Times” or “| The Jerusalem Post” are stripped before detection, while editorial hyphenated subtitles are retained; the original raw headline remains exported for audit.
- Publisher-section/regional-edition groups configured in the task file are consolidated before measurement: BBC — BBC services are one publisher for headline-measurement purposes; Mashable — Regional Mashable editions substantially reuse the same articles; Philippine Daily Inquirer — Philippine Daily Inquirer vertical and regional subdomains are sections of one publisher. Philadelphia's unrelated inquirer.com is deliberately excluded; New York Post / Page Six — Page Six is part of the New York Post publishing operation. Non-grouping decisions: unlike-owned Fox-branded local affiliates are not grouped with Fox News because the cache holds only a few rows each and the stations have different owners.
- Attention packaging is split into continuous curiosity-gap risk, direct-address/service packaging, and sensational/personal framing rather than one opaque bait bucket. The curiosity implementation follows the aggregate LLM audit taxonomy: it does not treat question form or service journalism as clickbait by themselves.
- Event and consequence word pools now use corpus-audited explicit inflections rather than unbounded wildcard stems. This removes systematic collisions such as first/Burnham/surgery/election/bank/winter/firms while keeping exact event words.
- Country acronyms are case-sensitive, so lowercase “us” no longer counts as the United States. Quoted titles/quotations are ignored for direct-address packaging, reducing false service hits such as a work titled “You Can See Everything”.
- Evidence language now uses broad token-boundary surface families guided by spaCy POS rather than a pair of stock regexes. Documentary/legal/data objects joined to empirical verbs or disclosure modifiers score highest; typed research objects and direct testimony form lower tiers; passive fragments such as “X told to…” and proper-name collisions such as a person named Testimony are guarded. Standalone earnings-call transcript labels still do not count as evidence merely because the word transcript appears. Original-access cues remain high-precision but diagnostic-only because they occur too rarely for stable source ordering.
- Body/summary text is exported and scanned for evidence/event/explanatory support as a diagnostic tier, now including broad strong-evidence, testimony and vague-attribution surfaces. It is not composite input because body coverage and length vary by feed and ingest path; missing body evidence is neutral.
- Expected detector rates are cross-fitted with GroupKFold by source: a source does not train the topic/editorial-context expectation used to residualise itself. Primary title-length adjustment is **disabled**; length-adjusted sensitivity columns are **included**.
- Delivery markers are fully topic/context-adjusted, while attention packaging is only partly context-adjusted (25% by default) and otherwise compared with corpus-wide incidence; this treats attention farming more as publisher behaviour than unavoidable subject matter.
- The local `en_core_web_sm` spaCy model supplies POS tags, lemmas and named entities. It is a small classical NLP model, not a transformer. Event detection combines verbal POS evidence with conservative local grammar for title-case or plural/-s forms that the tagger misreads; speech/report/announcement acts and noun-led event references count as weaker fractional evidence than direct action verbs. Place detection no longer trusts raw GPE/LOC/FAC labels alone because the small NER model frequently labels sports clubs, companies, games, people and “AI” as places; corpus-audited false-positive overrides, locative syntax for ambiguous entities, and reduced-weight facility hits are used instead. Numeric detail distinguishes exact quantities, bare counts, calendar years, scale words, ordinals, listicle positions and product/version numerals.
- The composite is calculated in natural cue units before display normalisation. This avoids the previous compression artefact caused by averaging eleven independently z-scored axes. Manual inspection of fringe cases supported this choice: equal z-weighting put formulaic research-release language at the very top and over-penalised moderate curiosity/service deviations, while uncapped natural units gave single large axes too much leverage. The final composite therefore caps each shrunk axis contribution at the corpus-derived 95th-percentile absolute axis deviation before averaging.
- Composite shrinkage is estimated from within- and between-source variance rather than fixed by hand; this run uses k=15.38 in the n/(n+k) factor. The composite axis saturation point is 12.51 adjusted percentage points. The displayed score is then corpus-normalised to mean 50 and standard deviation 15 among eligible sources, with clipping only at the extremes. Raw adjusted percentage-point residuals remain exported.
- Shrinkage sensitivity is exported across the configured grid; broad quartile ordering bands are emphasised over false precision in adjacent ranks.
- `detector_audit_sample.csv` is a stratified manual-labelling sample intended for future precision/recall estimation.

## Important limitations
- The composite remains headline-led. Body/summary diagnostics add context but do not measure truth, factual accuracy, importance, full article quality, or whether reporting is original in fact.
- Event detection remains incomplete. Direct actions are stronger than speech acts and nominal event references, but appointment/casting announcements written with copulas, some market/state movements, and less standard headline syntax can still be missed or underweighted; those absences are not evidence that no event occurred.
- English-language cues mean non-English sources naturally produce sparse detector hits and should not be compared directly with English-language sources.
- The minimum-n leaderboard can still be unstable or source-type-specific at n≈20–70; syndication-heavy, official-release, obituary-heavy and transcript-heavy sources need per-axis inspection before interpretation.
- The curiosity implementation is calibrated only against a small stratified LLM audit (133 assessable rows) and corpus/source distributions; evidence-family validation is aggregate rather than a complete human-labelled precision/recall study. The exported audit sample remains preparation for formal validation, not validation itself.
- The composite is a corpus-relative ordering aid, not an absolute 0–100 quality measurement. Its display scale is normalised against the measured sources in this corpus; raw adjusted percentage-point residuals, confidence intervals, sample sizes and per-axis profiles are needed for interpretation.
- Cross-fitting reduces in-sample leakage but does not model detector error, topic-model uncertainty, or corpus-selection uncertainty.
- Direct-address/service packaging is adverse packaging pressure, not uselessness: transparent how-to/service headlines can be both search-captured and useful.
- Research-release language can still resemble evidence specificity. Direct testimony also measures explicit attribution, not truth or independent verification. Conversely, scientific paper titles are often descriptive noun phrases with few event verbs, and narrative science journalism can omit formulaic “study finds” evidence language even when the article is evidence-based; neither extreme is a quality verdict.
- Cross-source title echo can reflect syndication, shared ownership, wires or legitimate same-event language; timestamps/URLs help inspection but do not prove provenance.

## Axis definitions
- **Explicit event / action** (`event_clarity`, included in composite): Specific event/action predicate. Direct action verbs count fully; grammatically uncertain title-case verb forms count 0.75; speech/report/announcement acts and clear noun-led event references count 0.5. Independent of attention packaging so packaging is not double-counted.
- **Quantified detail** (`quantified_specificity`, included in composite): Fractional numeric detail: exact quantities/money/percentages/ages count fully; bare or spelled counts slightly less; years, scale words and ordinals are weaker; product/version/listicle numerals are discounted.
- **Time / place anchor** (`time_place_anchor`, included in composite): Explicit date/time/day or country/place anchor; NER place candidates are filtered for headline-case false positives, and facility-only anchors count weakly.
- **Causal relationship** (`causal_explanation`, included in composite): Causal, consequence-linking or explicit relational language.
- **Material consequences** (`material_consequence`, included in composite): Impacts, costs, risks, jobs, health, harm, benefits or material changes.
- **Evidence specificity** (`evidence_provenance`, included in composite): Continuous evidence-surface score: documentary/legal/data evidence highest, typed research evidence next, direct testimony moderate, communication events or vague attribution low. Surface specificity only, not truth or methodological quality.
- **Context / comparison** (`context_comparison`, included in composite): Fractional context cue: explicit comparisons, trends, records or historical references count fully; amid/following count 0.75; bare sequence markers and comparative forms count 0.5.
- **Explanatory / service framing** (`explanatory_framing`, included in composite): Explanation, guide, mechanism, why/how question or explicit service-journalism framing; language presence only, not correctness.
- **Original-access cue** (`original_reporting_signal`, diagnostic only): Explicit original-access/provenance cue: investigation reveals/found, exclusive interview/report/access, documents obtained, interview with, FOI or our-analysis. High precision, very low recall; diagnostic only because it is too sparse for stable source ordering.
- **Curiosity-gap restraint** (`low_explicit_curiosity_gap`, included in composite): Continuous curiosity-gap risk built from stock teaser phrases plus structural withholding cues: vague references, listicle examples, unresolved forward references, reaction/resolution gaps and pronoun/determiner load. Stored inverse is used in the composite; exported adverse rate is mean risk, not binary incidence.
- **Direct-address/service packaging incidence** (`low_direct_service_packaging`, included in composite): How-to/you/your/search-capture framing. Often useful service journalism, but still a packaging/aggregation style; stored inverse is used in the composite.
- **Sensational / personal framing incidence** (`low_sensational_personal`, included in composite): Strong sensational vocabulary or celebrity/personal-life teaser framing; stored inverse is used in the composite.
- **Near-identical cross-source headline** (`cross_source_title_echo`, diagnostic only): Near-identical title match at character n-gram cosine similarity above threshold; diagnostic only, excluded from the composite.

## High-volume ordering (n ≥ 100)
| Rank | Source | n | Topic-adjusted title signal (95% interval) | Length-adjusted sensitivity | Raw 11-signal mean |
|---:|---|---:|---:|---:|---:|
| 1 | Eurogamer | 458 | 81.0 (74.6–85.8) | 76.8 | 39.7 |
| 2 | Korea Times | 123 | 70.5 (60.4–80.0) | 72.5 | 42.8 |
| 3 | The Guardian | 485 | 69.1 (62.7–75.5) | 68.5 | 42.7 |
| 4 | City A.M. | 173 | 58.7 (51.0–67.7) | 56.8 | 40.4 |
| 5 | Financial Times | 116 | 57.2 (47.5–66.1) | 64.6 | 40.8 |
| 6 | Medical Xpress | 127 | 52.6 (41.8–62.4) | 54.1 | 38.7 |
| 7 | BBC | 3537 | 45.8 (43.0–48.3) | 47.8 | 39.9 |
| 8 | Phys.org | 190 | 42.5 (32.0–52.4) | 40.7 | 36.5 |
| 9 | The Independent | 246 | 42.5 (33.8–50.5) | 40.4 | 39.7 |
| 10 | Mirror | 133 | 41.6 (31.3–51.1) | 39.2 | 38.8 |
| 11 | Punch | 348 | 34.7 (29.4–40.3) | 41.4 | 38.8 |
| 12 | IGN | 125 | 26.0 (17.8–35.1) | 35.4 | 34.2 |
| 13 | Daily Mail | 350 | 25.7 (19.9–31.8) | 25.9 | 37.6 |
| 14 | Kotaku | 671 | 18.4 (14.1–23.2) | 17.1 | 34.9 |

## Composite numerical audit
The composite cap is **12.51 adjusted percentage points**, applied symmetrically to each shrunk axis contribution before averaging. Axis spread below is the standard deviation of capped adjusted axis positions across ranked sources; leave-one-out compares the composite ranking with the ranking after removing that axis.
| Axis | Capped spread (pp sd) | Composite correlation | Leave-one-out Spearman | Max rank move |
|---|---:|---:|---:|---:|
| Explicit event / action | 7.22 | +0.69 | 0.952 | 16 |
| Quantified detail | 6.31 | +0.36 | 0.957 | 14 |
| Time / place anchor | 8.09 | +0.39 | 0.910 | 20 |
| Causal relationship | 2.53 | +0.37 | 0.991 | 13 |
| Material consequences | 6.86 | +0.58 | 0.934 | 22 |
| Evidence specificity | 3.29 | +0.51 | 0.988 | 12 |
| Context / comparison | 4.81 | +0.59 | 0.973 | 14 |
| Explanatory / service framing | 2.83 | -0.21 | 0.992 | 8 |
| Curiosity-gap restraint | 1.50 | +0.05 | 0.997 | 6 |
| Avoidance of direct/service packaging | 3.62 | +0.21 | 0.981 | 15 |
| Avoidance of sensational/personal framing | 1.75 | +0.16 | 0.995 | 9 |

Ranking comparisons — length-adjusted sensitivity: Spearman 0.924; simple axis-z average: Spearman 0.929; raw unadjusted signal: Spearman 0.824. The simple axis-z average is a diagnostic weighting sensitivity, not the primary composite.

Cap sensitivity — q=0.80: Spearman 0.980, max rank move 12; q=0.90: Spearman 0.995, max rank move 8; q=0.95: Spearman 1.000, max rank move 0; q=0.99: Spearman 0.995, max rank move 6; uncapped: Spearman 0.991, max rank move 13. The cap changes tail leverage; it is not a hidden reweighting of the axis scales.

Sparse axes are not separately boosted: median absolute adjusted deviation is only 1.16 pp for curiosity-gap restraint and 1.93 pp for evidence specificity. Those axes remain in natural units, so unusual offenders or evidence-heavy sources still matter without inflating sparse cues to the same leverage as high-variance event/context axes.

Explanatory framing and avoidance of direct/service packaging correlate at -0.50 across ranked sources. They are intentionally not decorrelated: explanatory/service headlines can receive explanatory credit while still incurring packaging pressure, and removing that overlap numerically would erase the distinction rather than resolve it.

## Body/summary corroboration diagnostics (high-volume sources)
Available article summaries are treated as the body tier. Coverage means the summary is materially longer than the headline. Strong evidence includes documentary/data/legal/research surface; testimony includes direct speech attribution. These rates corroborate or contextualise title cues; they are not composite inputs because feed coverage varies substantially by source.
| Source | n | Body coverage | Body strong-evidence surface | Body testimony surface | Body event cue | Body explanatory cue |
|---|---:|---:|---:|---:|---:|---:|
| Eurogamer | 458 | 65.3% | 1.3% | 19.4% | 70.1% | 1.1% |
| Korea Times | 123 | 77.2% | 3.3% | 30.1% | 71.5% | 0.0% |
| The Guardian | 485 | 67.4% | 4.3% | 35.5% | 73.6% | 1.9% |
| City A.M. | 173 | 71.1% | 1.7% | 36.4% | 76.9% | 0.6% |
| Financial Times | 116 | 35.3% | 2.6% | 14.7% | 51.7% | 2.6% |
| Medical Xpress | 127 | 86.6% | 13.4% | 18.9% | 66.1% | 1.6% |
| BBC | 3537 | 55.8% | 1.8% | 24.5% | 53.7% | 0.6% |
| Phys.org | 190 | 91.6% | 11.1% | 17.4% | 58.9% | 3.2% |
| The Independent | 246 | 37.0% | 2.8% | 21.1% | 42.3% | 0.0% |
| Mirror | 133 | 64.7% | 1.5% | 15.8% | 59.4% | 1.5% |
| Punch | 348 | 80.2% | 0.9% | 21.6% | 67.8% | 1.1% |
| IGN | 125 | 71.2% | 1.6% | 10.4% | 63.2% | 2.4% |
| Daily Mail | 350 | 86.9% | 3.4% | 14.6% | 52.3% | 1.1% |
| Kotaku | 671 | 17.3% | 0.4% | 10.6% | 34.0% | 0.6% |

## Highest topic-adjusted title-signal profiles (minimum n)
| Rank | Source | n | Topic-adjusted title signal (95% interval) | Band | Raw 11-signal mean |
|---:|---|---:|---:|---|---:|
| 1 | Eurogamer | 458 | 81.0 (74.6–85.8) | A — upper quartile | 39.7 |
| 2 | TweakTown | 46 | 77.5 (60.6–91.4) | A — upper quartile | 40.7 |
| 3 | MyJoyOnline | 28 | 77.3 (55.5–91.3) | A — upper quartile | 45.4 |
| 4 | Jerusalem Post | 68 | 73.6 (59.1–86.6) | A — upper quartile | 45.6 |
| 5 | Qatar Tribune | 28 | 72.7 (55.5–88.3) | A — upper quartile | 45.9 |
| 6 | South China Morning Post | 25 | 72.3 (51.3–87.1) | A — upper quartile | 45.3 |
| 7 | Wccftech | 27 | 71.7 (52.0–87.5) | A — upper quartile | 43.8 |
| 8 | The Indian Express | 20 | 70.6 (55.0–86.7) | A — upper quartile | 44.9 |
| 9 | Korea Times | 123 | 70.5 (60.4–80.0) | A — upper quartile | 42.8 |
| 10 | STAT News | 22 | 69.7 (50.6–83.5) | A — upper quartile | 42.1 |
| 11 | Quartz | 24 | 69.4 (53.3–84.3) | A — upper quartile | 45.1 |
| 12 | The Guardian | 485 | 69.1 (62.7–75.5) | A — upper quartile | 42.7 |
| 13 | PBS | 20 | 67.0 (47.5–80.0) | A — upper quartile | 44.3 |
| 14 | Yahoo Sports | 21 | 66.9 (50.7–79.1) | A — upper quartile | 39.2 |
| 15 | New York Post / Page Six | 48 | 64.1 (42.8–82.9) | A — upper quartile | 40.4 |

## Lowest topic-adjusted title-signal profiles (minimum n)
| Rank | Source | n | Topic-adjusted title signal (95% interval) | Band | Raw 11-signal mean |
|---:|---|---:|---:|---|---:|
| 76 | Kotaku | 671 | 18.4 (14.1–23.2) | D — lower quartile | 34.9 |
| 75 | Handelsblatt | 55 | 22.5 (14.4–31.9) | D — lower quartile | 33.5 |
| 74 | GameSpot | 56 | 25.2 (14.4–40.7) | D — lower quartile | 34.6 |
| 73 | Daily Mail | 350 | 25.7 (19.9–31.8) | D — lower quartile | 37.6 |
| 72 | IGN | 125 | 26.0 (17.8–35.1) | D — lower quartile | 34.2 |
| 71 | OregonLive Obituaries | 29 | 27.4 (27.2–32.9) | D — lower quartile | 36.7 |
| 70 | Engadget | 21 | 30.7 (17.4–45.1) | D — lower quartile | 30.8 |
| 69 | Sydney Morning Herald | 28 | 32.2 (24.7–43.6) | D — lower quartile | 33.7 |
| 68 | Nature | 42 | 32.9 (18.5–45.2) | D — lower quartile | 33.8 |
| 67 | Philippine Daily Inquirer | 20 | 33.4 (18.9–50.4) | D — lower quartile | 35.5 |
| 66 | Metro | 73 | 34.5 (22.3–45.3) | D — lower quartile | 39.1 |
| 65 | Punch | 348 | 34.7 (29.4–40.3) | D — lower quartile | 38.8 |
| 64 | Business Recorder | 70 | 35.1 (24.4–48.5) | D — lower quartile | 36.5 |
| 63 | Business Day | 31 | 35.3 (25.2–45.3) | D — lower quartile | 37.6 |
| 62 | The Hindu | 52 | 36.5 (23.1–55.3) | D — lower quartile | 36.5 |

## Files
- `headline_level_signals.csv`: one row per headline with detector results and metadata.
- `source_rankings.csv`: source rates, context expectations, residuals, composite ordering, intervals, timestamps and sensitivity fields.
- `source_axis_profiles.csv`: compact radar-ready occurrence rates, including explicit adverse incidences.
- `source_index_sensitivity.csv`: composite and rank under alternate residual-shrinkage settings.
- `detector_audit_sample.csv`: stratified manual-labelling sample for future detector validation.
- `detector_validation_sample.csv`: source-capped random validation sheet with predicted axes and blank `human_*` fields; `validate_detectors.py score` turns completed labels into precision/recall/F1 output.
- `metric_dictionary.json`: machine-readable axis definitions and composite inclusion.
- `run_metrics.json`: runtime and configuration record.
- `source_radar.html`: interactive radar for sources above the minimum sample threshold.

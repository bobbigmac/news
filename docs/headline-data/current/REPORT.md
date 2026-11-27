# Title-only reader-value signals — improved exploratory run

Corpus: **11,461 headline rows**, **686 sources**.
Source ordering eligible: **76** sources with at least 20 headlines. **610** sources are below the threshold and unranked.
Runtime: **85.2s** local. Stage timings: parse_archive 1.3s, detectors 19.7s, headline_reuse_and_templates 19.9s, topic_model_and_crossfit_expectations 5.1s, source_statistics_and_bootstrap 36.7s, write_tables_and_radar 2.6s.

## Measurement definition
The core ordering has 11 composite inputs: eight information-delivery markers plus inverse forms of explicit curiosity-gap, direct-address/service packaging, and sensational/personal framing. Original-access cues and cross-source title echo are plotted as diagnostic axes but excluded from the composite. Evidence specificity is fractional: generic research/study claims count 0.5; primary artefacts such as filings, documents, datasets, audits and court material count 1.0. Event/action detection is independent of attention packaging to avoid double-penalising packaged but informative headlines.

## Method changes in this run
- Curated export metadata is used when `headline-rows.jsonl` is present: canonical source key, URL, timestamps, relation branch, editorial context, and the available body/summary text.
- Publisher-section/regional-edition groups configured in the task file are consolidated before measurement. This is conservative: BBC services, Mashable regional editions, Inquirer verticals, and New York Post/Page Six are grouped; unlike-owned Fox-branded local affiliates are not grouped with Fox News.
- Attention packaging is split into explicit curiosity-gap teasing, direct-address/service packaging, and sensational/personal framing rather than one opaque bait bucket.
- Event and consequence word pools now use corpus-audited explicit inflections rather than unbounded wildcard stems. This removes systematic collisions such as first/Burnham/surgery/election/bank/winter/firms while keeping exact event words.
- Country acronyms are case-sensitive, so lowercase “us” no longer counts as the United States. Quoted titles/quotations are ignored for direct-address packaging, reducing false service hits such as a work titled “You Can See Everything”.
- Evidence language distinguishes generic research claims from stronger primary-artefact provenance. Standalone earnings-call transcript labels no longer count as evidence merely because the word transcript appears; transcript language must be evidential. Original-access cues remain high-precision but are diagnostic-only because they occur too rarely for stable source ordering.
- Body/summary text is exported and scanned for evidence/event/explanatory support as a diagnostic tier. It is not yet composite input because body coverage and length vary by feed and ingest path.
- Expected detector rates are cross-fitted with GroupKFold by source: a source does not train the topic/editorial-context expectation used to residualise itself. Primary title-length adjustment is **disabled**; length-adjusted sensitivity columns are **included**.
- Delivery markers are fully topic/context-adjusted, while attention packaging is only partly context-adjusted (25% by default) and otherwise compared with corpus-wide incidence; this treats attention farming more as publisher behaviour than unavoidable subject matter.
- Shrinkage sensitivity is exported across the configured grid; broad quartile ordering bands are emphasised over false precision in adjacent ranks.
- `detector_audit_sample.csv` is a stratified manual-labelling sample intended for future precision/recall estimation.

## Important limitations
- The composite remains headline-led. Body/summary diagnostics add context but do not measure truth, factual accuracy, importance, full article quality, or whether reporting is original in fact.
- Event detection is precision-led rather than exhaustive. It can miss appointment/casting announcements written with copulas, some noun-led market movements, and speech/report claims; those absences are not evidence that no event occurred.
- English-language cues mean non-English sources naturally produce sparse detector hits and should not be compared directly with English-language sources.
- The minimum-n leaderboard can still be unstable or source-type-specific at n≈20–70; syndication-heavy, official-release, obituary-heavy and transcript-heavy sources need per-axis inspection before interpretation.
- No human-labelled validation set has yet been completed; detector precision/recall is still unmeasured. The audit sample is preparation, not validation.
- The composite remains an equally weighted ordering aid. It should be read with the per-axis table, confidence interval, sample size and sensitivity output.
- Cross-fitting reduces in-sample leakage but does not model detector error, topic-model uncertainty, or corpus-selection uncertainty.
- Direct-address/service packaging is adverse packaging pressure, not uselessness: transparent how-to/service headlines can be both search-captured and useful.
- Research-release language can still resemble evidence specificity. The fractional evidence score reduces but does not remove the institutional-release confound. Conversely, scientific paper titles are often descriptive noun phrases with few event verbs, and narrative science journalism can omit formulaic “study finds” evidence language even when the article is evidence-based; neither extreme is a quality verdict.
- Cross-source title echo can reflect syndication, shared ownership, wires or legitimate same-event language; timestamps/URLs help inspection but do not prove provenance.

## Axis definitions
- **Explicit event / action** (`event_clarity`, included in composite): Specific event/action predicate. Independent of attention packaging so packaging is not double-counted.
- **Quantified detail** (`quantified_specificity`, included in composite): Number, percentage, amount, age, count or other numeric detail.
- **Time / place anchor** (`time_place_anchor`, included in composite): Explicit date/time/day or country/place anchor.
- **Causal relationship** (`causal_explanation`, included in composite): Causal, consequence-linking or explicit relational language.
- **Material consequences** (`material_consequence`, included in composite): Impacts, costs, risks, jobs, health, harm, benefits or material changes.
- **Evidence specificity** (`evidence_provenance`, included in composite): Fractional cue: 0.5 for research/survey/study claims, 1.0 for primary artefacts such as documents, filings, audits, datasets, transcripts or court material.
- **Context / comparison** (`context_comparison`, included in composite): Comparisons, trends, historical references, records or prior-period context.
- **Explanatory / service framing** (`explanatory_framing`, included in composite): Explanation, guide, mechanism, why/how or explicit service-journalism framing; language presence only, not correctness.
- **Original-access cue** (`original_reporting_signal`, diagnostic only): Explicit original-access/provenance cue: investigation reveals/found, exclusive interview/report/access, documents obtained, interview with, FOI or our-analysis. High precision, very low recall; diagnostic only because it is too sparse for stable source ordering.
- **Explicit curiosity-gap incidence** (`low_explicit_curiosity_gap`, included in composite): Stock clickbait phrases, explicit guessing/teasing or a trailing ellipsis; stored inverse is used in the composite, exported incidence is adverse.
- **Direct-address/service packaging incidence** (`low_direct_service_packaging`, included in composite): How-to/you/your/search-capture framing. Often useful service journalism, but still a packaging/aggregation style; stored inverse is used in the composite.
- **Sensational / personal framing incidence** (`low_sensational_personal`, included in composite): Strong sensational vocabulary or celebrity/personal-life teaser framing; stored inverse is used in the composite.
- **Near-identical cross-source headline** (`cross_source_title_echo`, diagnostic only): Near-identical title match at character n-gram cosine similarity above threshold; diagnostic only, excluded from the composite.

## High-volume ordering (n ≥ 100)
| Rank | Source | n | Topic-adjusted title signal (95% interval) | Length-adjusted sensitivity | Raw 11-signal mean |
|---:|---|---:|---:|---:|---:|
| 1 | Eurogamer | 458 | 59.5 (56.6–62.1) | 56.1 | 37.8 |
| 2 | The Guardian | 485 | 58.3 (55.3–60.9) | 56.6 | 38.4 |
| 3 | Medical Xpress | 127 | 56.1 (50.9–59.9) | 56.4 | 36.5 |
| 4 | Financial Times | 116 | 54.2 (50.5–58.6) | 54.8 | 38.0 |
| 5 | City A.M. | 173 | 53.0 (49.1–55.9) | 53.2 | 38.6 |
| 6 | Korea Times | 123 | 52.5 (48.1–57.3) | 50.7 | 38.8 |
| 7 | The Independent | 246 | 50.9 (47.0–54.9) | 51.1 | 37.0 |
| 8 | BBC | 3537 | 49.9 (48.8–50.9) | 50.5 | 36.8 |
| 9 | IGN | 125 | 48.5 (44.0–52.7) | 52.4 | 34.9 |
| 10 | Phys.org | 190 | 48.1 (42.9–52.5) | 48.5 | 34.4 |
| 11 | Mirror | 133 | 46.5 (43.5–49.7) | 46.2 | 35.9 |
| 12 | Punch | 348 | 46.2 (44.3–48.2) | 49.2 | 35.7 |
| 13 | Kotaku | 671 | 39.4 (37.3–41.2) | 41.6 | 33.5 |
| 14 | Daily Mail | 350 | 36.9 (34.2–40.9) | 38.8 | 33.7 |

## Body/summary corroboration diagnostics (high-volume sources)
Available article summaries are treated as the body tier. Coverage means the summary is materially longer than the headline. These rates corroborate or contextualise title cues; they are not composite inputs because feed coverage varies substantially by source.
| Source | n | Body coverage | Body research cue | Body primary-evidence cue | Body event cue | Body explanatory cue |
|---|---:|---:|---:|---:|---:|---:|
| Eurogamer | 458 | 65.3% | 0.4% | 0.0% | 65.9% | 1.1% |
| The Guardian | 485 | 67.4% | 3.7% | 1.6% | 68.7% | 1.9% |
| Medical Xpress | 127 | 86.6% | 42.5% | 0.0% | 63.0% | 1.6% |
| Financial Times | 116 | 35.3% | 0.9% | 0.0% | 44.8% | 2.6% |
| City A.M. | 173 | 71.1% | 1.2% | 0.6% | 73.4% | 0.6% |
| Korea Times | 123 | 75.6% | 2.4% | 0.0% | 62.6% | 0.0% |
| The Independent | 246 | 37.0% | 2.8% | 1.2% | 38.6% | 0.0% |
| BBC | 3537 | 55.8% | 0.5% | 0.5% | 47.8% | 0.6% |
| IGN | 125 | 71.2% | 0.8% | 0.0% | 54.4% | 2.4% |
| Phys.org | 190 | 91.6% | 22.1% | 0.0% | 55.3% | 3.2% |
| Mirror | 133 | 64.7% | 0.8% | 0.0% | 57.1% | 1.5% |
| Punch | 348 | 80.2% | 0.9% | 0.3% | 60.6% | 1.1% |
| Kotaku | 671 | 17.3% | 0.0% | 0.0% | 30.4% | 0.6% |
| Daily Mail | 350 | 86.9% | 1.1% | 1.1% | 47.7% | 1.1% |

## Highest topic-adjusted title-signal profiles (minimum n)
| Rank | Source | n | Topic-adjusted title signal (95% interval) | Band | Raw 11-signal mean |
|---:|---|---:|---:|---|---:|
| 1 | South China Morning Post | 25 | 63.2 (56.2–67.4) | A — upper quartile | 44.7 |
| 2 | TweakTown | 46 | 60.1 (55.2–64.8) | A — upper quartile | 38.7 |
| 3 | PsyPost | 28 | 59.5 (51.7–64.0) | A — upper quartile | 38.0 |
| 4 | Eurogamer | 458 | 59.5 (56.6–62.1) | A — upper quartile | 37.8 |
| 5 | Quartz | 24 | 59.2 (53.7–64.1) | A — upper quartile | 43.2 |
| 6 | The Guardian | 485 | 58.3 (55.3–60.9) | A — upper quartile | 38.4 |
| 7 | Jerusalem Post | 68 | 57.7 (51.6–62.0) | A — upper quartile | 40.4 |
| 8 | MyJoyOnline | 28 | 57.4 (52.3–62.7) | A — upper quartile | 42.0 |
| 9 | Wccftech | 27 | 57.2 (51.4–64.8) | A — upper quartile | 40.4 |
| 10 | Indiatimes | 20 | 56.7 (51.3–61.8) | A — upper quartile | 40.0 |
| 11 | Medical Xpress | 127 | 56.1 (50.9–59.9) | A — upper quartile | 36.5 |
| 12 | Qatar Tribune | 28 | 55.7 (51.8–60.3) | A — upper quartile | 41.2 |
| 13 | PBS | 20 | 55.5 (48.6–60.7) | A — upper quartile | 37.3 |
| 14 | Financial Times | 116 | 54.2 (50.5–58.6) | A — upper quartile | 38.0 |
| 15 | Reddit | 40 | 53.1 (47.0–58.5) | A — upper quartile | 33.4 |

## Lowest topic-adjusted title-signal profiles (minimum n)
| Rank | Source | n | Topic-adjusted title signal (95% interval) | Band | Raw 11-signal mean |
|---:|---|---:|---:|---|---:|
| 76 | Daily Mail | 350 | 36.9 (34.2–40.9) | D — lower quartile | 33.7 |
| 75 | Kotaku | 671 | 39.4 (37.3–41.2) | D — lower quartile | 33.5 |
| 74 | Yahoo | 21 | 39.6 (37.2–45.6) | D — lower quartile | 35.1 |
| 73 | New Scientist | 40 | 41.9 (37.1–49.1) | D — lower quartile | 35.9 |
| 72 | Handelsblatt | 55 | 43.3 (40.9–45.9) | D — lower quartile | 32.2 |
| 71 | Inquirer | 37 | 44.0 (38.8–53.3) | D — lower quartile | 34.6 |
| 70 | GameSpot | 56 | 44.3 (39.3–49.3) | D — lower quartile | 34.3 |
| 69 | Oregonlive | 29 | 44.6 (44.2–45.3) | D — lower quartile | 36.7 |
| 68 | Engadget | 21 | 44.7 (40.7–49.0) | D — lower quartile | 28.6 |
| 67 | Metro | 73 | 45.6 (40.9–50.0) | D — lower quartile | 37.0 |
| 66 | Nature | 42 | 45.7 (39.7–51.1) | D — lower quartile | 31.6 |
| 65 | Chalkbeat | 23 | 45.7 (41.7–49.2) | D — lower quartile | 32.8 |
| 64 | Sydney Morning Herald | 28 | 45.8 (42.9–49.5) | D — lower quartile | 30.5 |
| 63 | Punch | 348 | 46.2 (44.3–48.2) | D — lower quartile | 35.7 |
| 62 | CBS News | 29 | 46.4 (43.8–49.8) | D — lower quartile | 35.4 |

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

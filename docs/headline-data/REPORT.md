# Title-only reader-value signals — exploratory backend run

Corpus: **11,461 headline rows**, **695 sources**.
Source ranking eligible: **74** sources with at least 20 headlines. **621** sources have fewer than 20 and are not assigned a rank.
Exact duplicate headline rows retained in the input: **45**.

## Measurement definition
Each detector returns 0/1 per headline. Source axes are occurrence rates (% of titles triggering the detector). The radar shows raw occurrence rates; title-echo and the two attention-framing axes are adverse behaviours, so lower is better. The compact `source_axis_profiles.csv` stores those three as explicit incidence columns (not inverse hygiene columns). The composite title index excludes title echo. The 11-signal title-language proxy combines nine information-delivery detectors with two inverse attention-framing detectors. A separate 0–100 delivery-only signal and attention-pressure signal are exported for every headline. Public/systemic subject matter and named-entity density remain separate descriptive fields, not intrinsic quality bonuses. Expected rates are estimated from the combination of 22 unsupervised topic memberships and the archive's curated source-family group.

## Important limitations
- These are headline-only linguistic signals. `information_delivery_signal` measures the presence of nine title-level information markers, not actual story value, factual accuracy, whether the event is important, or whether the publisher has done original reporting. `attention_packaging_pressure` is reported separately.
- Named-entity detection uses capitalisation, acronym and institutional lexicon proxies; sentence case, title case, game/product names and proper nouns confound it.
- Repeated-trigram and cross-publisher title overlap measures are diagnostics for formulaicity/reuse, not proof of copied work or low quality. The title-echo radar axis is a near-identical title-match rate, not article-body provenance.
- Topic-adjusted title-signal index is the mean standardised publisher residual over eleven included detectors, shrunk toward its topic/group expectation and re-centred at 50; it is a comparative corpus index, not a probability or absolute story-quality score.
- Expected-rate adjustment uses TF-IDF/NMF topic memberships plus curated source-family group in ridge regressions. This reduces, but does not eliminate, topic/genre confounding; the source-family groups are coarse.
- 95% intervals are within-source headline bootstrap intervals with the topic/group model held fixed; they do not include detector or model uncertainty. The composite ranking is exploratory. No human-labelled validation set was supplied, and detector precision/recall is not established.
- Source counts are newest-first snapshots with no per-headline timestamps/URLs in this archive; chronology, article reuse and wire provenance cannot be reliably established.
- Attribution and anonymous-source cues are exported as diagnostics, but are not treated as proof of sourcing quality.
- Cross-source headline similarity is a title-level reuse proxy only, not evidence of copied article text.

## Axis definitions
- **Explicit event / action** (`event_clarity`): Share with a specific event/action predicate not caught by the explicit curiosity-gap detector.
- **Quantified detail** (`quantified_specificity`): Share with a number, percentage, amount, age, count or other numeric detail.
- **Time / place anchor** (`time_place_anchor`): Share with explicit date/time/day or country/place anchor.
- **Causal relationship** (`causal_explanation`): Share with causal, consequence-linking or explicit relational language.
- **Material consequences** (`material_consequence`): Share with impacts, costs, risks, jobs, health, harm, benefits or material changes.
- **Evidence / provenance cue** (`evidence_provenance`): Share with stronger evidence artefacts such as studies, data, records, filings, audits, trials or documents; generic says/claims attribution is tracked separately.
- **Context / comparison** (`context_comparison`): Share with comparisons, trends, historical references, records or prior-period context.
- **Explanatory / analytical framing** (`explanatory_framing`): Share with explicit explanation, analysis, guide, mechanism or why/how framing; this measures the presence of explanatory language, not whether the explanation is correct.
- **Original-access / investigation cue** (`original_reporting_signal`): Share with explicit original-reporting or primary-material cues such as investigation, special report, documents obtained, interview, FOI or our analysis.
- **Near-identical cross-source headline (lower is better)** (`cross_source_title_echo`): Share with a near-identical cross-source headline match at character n-gram cosine similarity ≥0.82; lower means less title echo, but does not establish originality or copying.
- **Curiosity-gap incidence (lower is better)** (`low_curiosity_bait`): Share with explicit curiosity-gap/direct-address/question/ellipsis patterns; lower is better.
- **Sensational / personal framing (lower is better)** (`low_sensational_personal`): Share with stronger sensational vocabulary or celebrity/personal-life teaser framing; ordinary family mentions alone are not enough; lower is better.

## High-volume ranking (n ≥ 100)
| Rank | Source | n | Topic-adjusted title signal (95% interval) | Raw 11-signal mean |
|---:|---|---:|---:|---:|
| 1 | The Guardian | 485 | 59.1 (55.5–62.1) | 31.5 |
| 2 | Eurogamer | 458 | 55.9 (52.3–59.9) | 29.5 |
| 3 | Medical Xpress | 127 | 55.7 (51.2–60.1) | 30.1 |
| 4 | Phys.org | 190 | 52.6 (47.2–58.3) | 27.7 |
| 5 | Financial Times | 116 | 51.6 (45.7–56.8) | 31.3 |
| 6 | The Independent | 246 | 51.6 (46.5–56.7) | 29.6 |
| 7 | City A.M. | 173 | 50.4 (46.4–54.1) | 31.9 |
| 8 | BBC | 3537 | 49.6 (48.4–50.8) | 29.6 |
| 9 | Korea Times | 123 | 48.9 (44.6–52.8) | 31.9 |
| 10 | IGN | 125 | 48.5 (42.4–53.2) | 26.5 |
| 11 | Punch | 348 | 44.2 (41.9–46.5) | 28.5 |
| 12 | Mirror | 133 | 43.6 (40.4–47.3) | 27.9 |
| 13 | Kotaku | 671 | 41.9 (38.8–45.0) | 25.1 |
| 14 | Daily Mail | 350 | 37.8 (35.2–41.8) | 25.7 |

## Headline-level information-delivery distribution (n ≥ 100)
| Source | n | Mean delivery signal | Median | 0–1 of 9 markers | 4–9 of 9 markers | Attention pressure |
|---|---:|---:|---:|---:|---:|---:|
| The Guardian | 485 | 17.0 | 11.1 | 52.0% | 3.9% | 3.3 |
| Eurogamer | 458 | 15.1 | 11.1 | 59.4% | 3.9% | 5.7 |
| Medical Xpress | 127 | 15.0 | 11.1 | 61.4% | 3.9% | 1.6 |
| Phys.org | 190 | 11.9 | 11.1 | 70.5% | 3.2% | 1.3 |
| Financial Times | 116 | 16.6 | 11.1 | 54.3% | 6.0% | 2.6 |
| The Independent | 246 | 14.9 | 11.1 | 63.8% | 4.1% | 4.3 |
| City A.M. | 173 | 17.1 | 11.1 | 52.0% | 3.5% | 1.4 |
| BBC | 3537 | 14.7 | 11.1 | 60.2% | 2.5% | 3.1 |
| Korea Times | 123 | 17.3 | 11.1 | 50.4% | 0.8% | 2.0 |
| IGN | 125 | 11.0 | 11.1 | 78.4% | 1.6% | 4.0 |
| Punch | 348 | 12.7 | 11.1 | 64.7% | 0.9% | 0.7 |
| Mirror | 133 | 13.8 | 11.1 | 60.2% | 0.0% | 8.6 |
| Kotaku | 671 | 9.8 | 11.1 | 76.8% | 0.9% | 6.1 |
| Daily Mail | 350 | 11.1 | 11.1 | 70.9% | 0.6% | 9.0 |

## Highest topic-adjusted title-signal profiles (n ≥ 20)
| Rank | Source | n | Topic-adjusted title signal (95% interval) | Raw 11-signal mean |
|---:|---|---:|---:|---:|
| 1 | Wccftech | 27 | 62.3 (52.9–70.0) | 34.7 |
| 2 | Jerusalem Post | 68 | 59.9 (52.3–65.5) | 34.9 |
| 3 | The Guardian | 485 | 59.1 (55.5–62.1) | 31.5 |
| 4 | TweakTown | 46 | 58.8 (52.9–64.1) | 31.0 |
| 5 | Reddit | 40 | 57.8 (50.0–63.6) | 25.9 |
| 6 | South China Morning Post | 25 | 57.7 (52.2–61.8) | 37.1 |
| 7 | PBS | 20 | 57.3 (49.5–62.4) | 33.6 |
| 8 | MyJoyOnline | 28 | 56.6 (50.3–62.9) | 36.4 |
| 9 | PsyPost | 28 | 56.1 (48.5–61.5) | 31.5 |
| 10 | Eurogamer | 458 | 55.9 (52.3–59.9) | 29.5 |
| 11 | Medical Xpress | 127 | 55.7 (51.2–60.1) | 30.1 |
| 12 | Indiatimes | 20 | 55.0 (49.7–61.2) | 35.5 |
| 13 | This is Money | 81 | 54.5 (48.0–60.5) | 32.4 |
| 14 | Quartz | 24 | 54.3 (47.0–60.6) | 36.0 |
| 15 | Qatar Tribune | 28 | 53.5 (48.8–57.9) | 33.4 |

## Lowest topic-adjusted title-signal profiles (n ≥ 20)
| Rank | Source | n | Topic-adjusted title signal (95% interval) | Raw 11-signal mean |
|---:|---|---:|---:|---:|
| 74 | Daily Mail | 350 | 37.8 (35.2–41.8) | 25.7 |
| 73 | Handelsblatt | 55 | 40.5 (38.2–42.8) | 24.8 |
| 72 | Oregonlive | 29 | 40.9 (39.8–42.7) | 28.2 |
| 71 | Engadget | 21 | 41.7 (37.0–45.8) | 19.5 |
| 70 | Kotaku | 671 | 41.9 (38.8–45.0) | 25.1 |
| 69 | ABC News | 38 | 43.1 (38.4–47.6) | 25.8 |
| 68 | Business Recorder | 70 | 43.3 (39.9–46.9) | 26.1 |
| 67 | Mirror | 133 | 43.6 (40.4–47.3) | 27.9 |
| 66 | Punch | 348 | 44.2 (41.9–46.5) | 28.5 |
| 65 | GameSpot | 56 | 45.4 (39.0–50.9) | 26.0 |
| 64 | MarketBeat | 37 | 45.9 (42.6–49.1) | 31.7 |
| 63 | Business Day | 31 | 46.1 (41.9–50.4) | 27.3 |
| 62 | Notebookcheck | 61 | 46.1 (40.4–51.6) | 25.8 |
| 61 | Daily Maverick | 29 | 46.2 (41.1–50.8) | 26.6 |
| 60 | The Verge | 35 | 46.2 (40.8–52.6) | 26.8 |

## Files
- `headline_level_signals.csv`: one row per headline with detector results.
- `source_rankings.csv`: all sources, raw rates, topic-mix expectations, shrunk adjusted rates, rank and sample tier.
- `source_axis_profiles.csv`: compact radar-ready source profiles; all 12 primary columns are actual occurrence rates, including adverse title-echo, curiosity-gap and sensational/personal incidences. Named-entity and public-subject descriptors are separate.
- `source_phrase_signatures.csv`: corpus-discovered source-distinctive bigrams and trigrams using weighted log-odds.
- `source_story_score_distributions.csv`: source-level distribution of per-headline value proxies.
- `cross_source_title_matches.csv`: title-level cross-publisher near-matches above the similarity threshold.
- `source_radar.html`: interactive dropdown radar chart for sources with n ≥ 20.
- `topic_model.json`: NMF topics and top terms.
- `source_topic_profiles.csv`: source-level soft topic proportions.
- `analysis_summary.json`: machine-readable summary.
- `analyse_headlines.py`: reproducible script.

# Headline reader-value analysis

## What this run measures

This is a title-only corpus instrument. It extracts 12 radar dimensions as headline occurrence rates, plus per-headline signals and source-level aggregates.

The 9-marker `information_delivery_signal` counts title-level signs of information delivery:

1. explicit event/action;
2. quantification;
3. time/place anchoring;
4. causal relationship;
5. material consequence;
6. evidence/provenance artefact;
7. context/comparison;
8. explanatory/analytical framing;
9. explicit original-access/investigation cue.

`attention_packaging_pressure` is a separate average of explicit curiosity-gap/direct-address packaging and sensational/personal-life framing. `title_value_signal` combines the nine delivery markers with inverse versions of those two attention signals. All story-level fields are in `headline_level_signals.csv`. The per-headline delivery score is the share of the nine markers scaled to 0–100; attention pressure is the mean of two adverse binary flags scaled to 0–100; the 11-signal title-value proxy averages the nine positive markers and two inverse attention markers.

The 12 radar axes are the nine delivery markers, near-identical cross-source title echo, curiosity-gap incidence and sensational/personal framing incidence. All are plotted as actual within-publisher occurrence rates; the final three are adverse, so lower is better. Named-entity density and public/systemic subject matter are retained separately as descriptive fields. Public/systemic subject matter and named-entity density are provided separately as descriptive fields, not quality bonuses.

## Statistical work

- spaCy English tokenizer (`spacy.blank('en')`) normalises tokenisation; no pretrained spaCy parser or NER model is used.
- scikit-learn TF-IDF word unigrams/bigrams and 22-component NMF discover corpus topics.
- Ridge regression estimates expected detector prevalence from each headline's soft topic mixture and the manifest's curated source-family group.
- Publisher residuals are shrunk by `n/(n+25)`, standardised across sources with at least 20 titles, and averaged into `topic_adjusted_value_index` (50 is the comparison-cohort centre). Higher values mean a publisher's titles trigger more of the nine delivery signals and fewer of the two attention-framing signals than expected for its inferred topic mix and manifest source family; this is not a truth or article-quality score.
- 95% intervals use 250 within-source headline bootstrap replicates; the fitted topic/group expectations are held fixed.
- Source-distinctive bigrams/trigrams use a corpus-informed weighted log-odds score.
- Char n-gram TF-IDF and nearest-neighbour similarity identify title-level near-matches. A near-identical cross-source title echo rate is included in the radar (and excluded from the composite index). Repeated within-source trigrams identify recurring phrase templates.

The regex/construction detectors are explicit high-precision proxies, not a trained semantic classifier. `test_detectors.py` contains synthetic regression cases only; it does not establish precision/recall against human labels. No contextual transformer or LLM annotations were run in this backend pass.

## Important interpretation limits

A headline can communicate useful information without triggering these particular markers, and a factually empty headline can contain them. The scores indicate *observable title language*, not truth, factual accuracy, event importance, originality of the article body, or the complete value of the story. Body text, dates, URLs and source provenance are needed for those questions.

Topic and source-family adjustment reduces some subject-mix confounding but does not fully model genre or event severity. Small-source ranks should be read with their intervals and sample counts; sources with fewer than 20 headlines are not ranked.

## Files

- `headline_level_signals.csv`: every headline, 9-marker delivery signal, attention pressure, 11-signal title-value proxy, 12 radar dimensions and diagnostics.
- `source_rankings.csv`: all publishers, raw occurrence rates, expected rates, residuals, bootstrap intervals, sample tiers and ranks.
- `source_axis_profiles.csv`: radar-ready occurrence-rate and expected-rate profiles.
- `source_story_score_distributions.csv`: per-publisher distribution of delivery-only headline signals.
- `source_radar.html`: interactive publisher radar; Plotly is embedded for offline use.
- `publisher_radar_comparison.png`, `high_volume_source_ranking.png`, `story_signal_distribution.png`: static chart exports.
- `publisher_radar_comparison.png`: static multi-publisher radar.
- `high_volume_source_ranking.png`: ranking of publishers with at least 100 headlines, with bootstrap intervals.
- `story_signal_distribution.png`: delivery-marker distribution for selected publishers.
- `source_phrase_signatures.csv`: source-distinctive bigrams and trigrams from weighted log-odds.
- `source_topic_profiles.csv`, `topic_model.json`: NMF topic profiles and terms.
- `cross_source_title_matches.csv`: title-level near-match candidates.
- `REPORT.md`: result tables and metric definitions.
- `test_detectors.py` and `test_corpus_outputs.py`: synthetic detector regressions and corpus-output invariants.

## Re-run

Python 3.10+ is recommended.

```bash
python -m pip install -r requirements.txt
python analyse_headlines.py --zip source-headlines-2026-11-27.zip --out .
python make_charts.py
python test_detectors.py
```

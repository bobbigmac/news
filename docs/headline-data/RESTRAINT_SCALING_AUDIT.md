# Restraint-axis distribution and scaling audit

Date: 2026-11-28

## Purpose

This audit checks whether the narrow/high-clustered restraint axes are caused by:

1. genuinely long-tailed offender behaviour;
2. thin binary measurements that miss the underlying construct;
3. small-sample/binomial noise;
4. display scaling that compresses ordinary sources together.

It uses corpus-level distributions and broad feature families only. It does not rate individual stories.

Inputs:

- `docs/headline-data/current/source_axis_profiles.csv`
- `docs/headline-data/current/headline_level_signals.csv`
- `.working/restraint_axis_distribution.json`
- `.working/restraint_family_probe.json`
- `.working/restraint_component_source_rates.txt`

## Source-level distribution summary

Among the 76 ranked sources with at least 20 headlines:

| Axis incidence | Sources at zero | Median | 75% | 90% | 95% | Max |
|---|---:|---:|---:|---:|---:|---:|
| explicit curiosity-gap incidence | 90.8% | 0 | 0 | 0 | 0.64% | 9.52% |
| direct/service packaging incidence | 50.0% | 0.29% | 3.81% | 10.89% | 16.32% | 38.10% |
| sensational/personal incidence | 52.6% | 0 | 3.25% | 4.88% | 7.14% | 10.53% |
| evidence-provenance rate | 60.5% | 0 | 1.82% | 5.13% | 8.46% | 17.86% |

For comparison, ordinary delivery axes are much less zero-inflated:

- event clarity median 37.9%, maximum 59.4%;
- quantified specificity median 18.3%, maximum 72.4%.

## The small-sample problem is real

Restricting to better-measured sources changes the shape substantially.

| Axis incidence | n>=20 zero | n>=50 zero | n>=100 zero |
|---|---:|---:|---:|
| explicit curiosity-gap | 90.8% | 82.1% | 71.4% |
| direct/service packaging | 50.0% | 32.1% | 7.1% |
| sensational/personal | 52.6% | 25.0% | 7.1% |
| evidence provenance | 60.5% | 50.0% | 28.6% |

For n>=100 sources, service and sensational behaviour are almost never absent; they are simply infrequent. Much of the zero inflation across all 76 ranked sources is therefore a sample-size artifact.

The binomial noise scale is material:

- at n=20, a true 5% rate has standard error about 4.9 percentage points;
- at n=100, a true 1% rate has standard error about 1.0 point;
- at n=100, a true 3% rate has standard error about 1.7 points;
- at n=500, a true 1% rate has standard error about 0.44 points.

So nonlinearly stretching small probabilities would mostly stretch noise for small sources. Empirical shrinkage is more defensible than variance expansion.

## Curiosity-gap restraint: thin measurement, not a real narrow gradient

The explicit curiosity detector is extremely sparse:

- 20/11,461 rows;
- only 11 rows from stock teaser phrases;
- 9 rows from terminal ellipses;
- several ellipsis cases are truncation/feed artefacts rather than publisher-written teaser punctuation.

The curiosity audit in `CURIOSITY_GAP_AUDIT.md` shows that the underlying construct is broader: withheld list examples, reasons, mechanisms, findings, timing, identity and referents. Those structural cases are mostly absent from the current detector.

Conclusion: **do not nonlinearly rescale the current curiosity-axis zeros.** The axis is thin because the detector measures only stock phrases and punctuation artefacts. A nonlinear transform would manufacture variation around an almost-empty detector and amplify artefacts. The row-level measurement has to improve first.

## Direct/service packaging: genuine long tail plus some measurement compression

Corpus-level family incidence:

| Family | Rows | Rate |
|---|---:|---:|
| second-person `you/your` | 382 | 3.33% |
| explicit how-to/service frames | 92 | 0.80% |
| `here's what/why` frames | 41 | 0.36% |
| direct second-person questions | 44 | 0.38% |
| need-to-know frames | 18 | 0.16% |

The existing detector is already broad enough to be a strict subset of this family union: 351 current rows, all within the 484-row broad-family union. The extra rows mostly come from broader service forms such as `how do you`, `how can you`, and `what to know`.

Among n>=100 sources, direct/service incidence varies meaningfully:

- Kotaku 6.3%;
- Eurogamer 3.5%;
- IGN 3.2%;
- Daily Mail 3.1%;
- BBC 1.6%;
- Guardian 1.9%;
- Punch 0.6%;
- Korea Times 0%.

Source-level rates correlate strongly with the second-person component (`r=0.87`) and moderately with explicit how-to (`r=0.68`) and `here's what/why` (`r=0.61`). This is not an inert axis for high-volume sources.

Conclusion: service packaging is a **genuine asymmetric penalty axis**. It should not be forced into a symmetric gradient. However, the row-level detector should separate:

- transparent service journalism (`How to spot X`);
- search-capture/direct-address framing (`What you need to know`, `Here's what`);
- second-person involvement inside quoted speech, which should not automatically count.

That is a measurement-severity problem, not a nonlinear-display problem.

## Sensational/personal restraint: genuine offender tail

Corpus-level component incidence:

| Family | Rows | Rate |
|---|---:|---:|
| sensational affect vocabulary | 138 | 1.20% |
| sensational conflict vocabulary | 46 | 0.40% |
| personal-life terms | 421 | 3.67% |
| celebrity-role terms | 162 | 1.41% |

The final composite is not merely the presence of personal/celebrity vocabulary; it requires sensational wording or a personal/celebrity frame combination. Among n>=100 sources, the ordering is plausible and wide:

- Mirror 10.5%;
- Daily Mail 8.9%;
- The Independent 3.7%;
- Korea Times 3.3%;
- City A.M. 2.3%;
- Eurogamer 2.0%;
- BBC 1.9%;
- Kotaku 1.5%;
- Guardian 1.2%;
- Medical Xpress 0%;
- Punch 0.3%.

Component correlations with the final high-volume source rate are high:

- sensational affect `r=0.95`;
- sensational conflict `r=0.91`;
- personal-life terms `r=0.77`;
- celebrity terms `r=0.73`.

Conclusion: sensational/personal restraint is a real long-tail offender axis. Most ordinary sources cluster high because they genuinely avoid the behaviour most of the time. That is not automatically a defect. The measurement problem is severity composition — factual severity words, celebrity-news packaging and personal-life hard-news references are not interchangeable — not lack of numerical spread.

## Nonlinear scaling decision

Do **not** apply a global nonlinear stretch such as logit/sqrt odds to the existing restraint axes.

Reasons:

1. It would amplify binomial noise for small sources.
2. It would manufacture differences among sources whose true rate is approximately zero.
3. It would treat a sparse detector failure as if it were a meaningful zero-inflated behaviour distribution.
4. The current composite already uses empirical shrinkage and caps precisely because tail leverage/noise matter.

A better distinction is:

- **measurement layer**: estimate row-level severity continuously rather than binary cue presence;
- **aggregation layer**: empirical shrinkage plus natural-unit residuals;
- **display layer**: corpus-relative position can remain asymmetric;
- **interpretation layer**: describe these as offender/penalty axes, not smooth virtue gradients.

If a transform is ever justified, it should be a hurdle-style interpretation after row measurement improves:

1. whether a source has any reliably measured offences;
2. frequency among sources with enough observations;
3. severity of those offences.

It should not be a monotonic stretch of the current binary rates.

## Recommended direction by axis

### Curiosity-gap restraint

Priority: replace the row measurement.

Use continuous structural evidence from the curiosity audit:

- unresolved forward-reference load;
- low specificity/concreteness;
- pronoun/determiner structure;
- listicle-withholding frames;
- missing referent/central-fact patterns;
- truncation/provenance guards.

Only after that should source-level scaling be reassessed.

### Direct/service restraint

Priority: split severity/types, not more phrases.

Useful broad families:

- explicit task guide (`how to`);
- direct second-person address;
- `here's what/why/how` forward packaging;
- need-to-know/search-capture framing.

Quoted speech should be excluded from direct-address scoring. Transparent task guides should not automatically receive the same penalty as search-capture framing.

### Sensational/personal restraint

Priority: preserve the offender-axis interpretation.

The axis already separates Mirror/Daily Mail from most high-volume sources. Improve precision through broad structural families rather than deeper word hunting:

- affect/intensifier use;
- conflict metaphors;
- personal-life frame;
- celebrity/entertainment frame;
- whether the subject is hard-news harm versus lifestyle/celebrity packaging.

Nonlinear scaling is not the main need.

## Bottom line

The restraint axes are not all narrow for the same reason.

- Curiosity restraint is narrow because the detector is too thin.
- Service and sensational restraint are long-tailed penalty axes with meaningful high-volume variation.
- Small-source zeros are heavily binomial.
- Nonlinear stretching would mostly amplify noise and detector artefacts.

The correct sequence is: better row-level measurement first, then reassess whether any nonlinear aggregation is still needed.

# Evidence-specificity measurement audit

Date: 2026-11-28

## Purpose

This audit evaluates the current evidence-specificity axis at corpus level and tests whether broad, library-backed token families can measure more of the construct without falling into phrase-by-phrase tinkering.

It does **not** rate individual stories. Examples are retained only as sanity checks for aggregate pattern families.

Inputs and outputs:

- corpus rows: `docs/headline-data/current/headline_level_signals.csv`
- spaCy probe features: `.working/measurement_probe.csv`
- matcher implementation: `.working/evidence_matcher_probe_v2.py`
- row-level probe output: `.working/evidence_matcher_v2_rows_surface.csv`
- aggregate summary: `.working/evidence_matcher_v2_summary_surface.json`
- aggregate examples: `.working/evidence_matcher_v2_examples_surface.md`
- analysis tables: `.working/evidence_aggregate_analysis_surface.txt`

## Method

The probe uses spaCy `en_core_web_sm` tokenization/POS plus a spaCy `Matcher`, with broad watchlists for:

- documentary/data objects: documents, records, reports, audits, transcripts, testimony, memos, emails, letters, messages, datasets, data, figures, statistics, evidence;
- visual records: footage, video, images, photos;
- research instruments: study, research, survey, poll, analysis, trial, experiment, review, findings, results, paper;
- legal evidence forums: court, judge, jury, trial, inquest, hearing, tribunal;
- empirical verbs: show, reveal, indicate, suggest, find, estimate, document, demonstrate;
- direct speech verbs: say, tell, claim, warn, confirm, admit, report, testify;
- communication-event verbs: announce, urge, deny;
- disclosure verbs: obtain, leak, publish, release, disclose, share, review;
- evidence modifiers: official, leaked, internal, court, government, police, confidential, independent, clinical, peer-reviewed, preliminary and related broad modifiers.

The first probe showed two structural library problems:

- spaCy sometimes lemmatises `data` as `datum` and sometimes mistags final verbs such as `data shows` as nouns;
- strict POS constraints therefore miss high-precision surface relations.

The final probe keeps POS constraints on evidence **objects** — preventing proper names such as `Testimony Jaga` from counting as testimony — but uses shallow surface inflection lists for common empirical verbs. This is exactly the right role for spaCy: a noisy guider, not the semantic floor.

## Corpus-level family incidence

| Family | Headline rows | Rate | Body rows where body coverage exists | Body rate |
|---|---:|---:|---:|---:|
| any testimony/attribution family | 1,229 | 10.72% | 1,622 | 18.33% |
| direct speaker + speech verb | 1,063 | 9.27% | 1,320 | 14.92% |
| weak typed evidence/research object | 663 | 5.78% | 1,097 | 12.40% |
| research object present | 350 | 3.05% | 576 | 6.51% |
| document object present | 328 | 2.86% | 576 | 6.51% |
| quotation plus testimony | 263 | 2.29% | 426 | 4.82% |
| strong empirical/document/legal surface | 192 | 1.68% | 276 | 3.12% |
| speaker + announcement verb | 142 | 1.24% | 127 | 1.44% |
| explicit vague attribution | 123 | 1.07% | 161 | 1.82% |
| research object + empirical verb | 80 | 0.70% | 94 | 1.06% |
| document/data object + empirical verb | 47 | 0.41% | 52 | 0.59% |
| legal testimony forum | 37 | 0.32% | 11 | 0.12% |
| modified research object | 28 | 0.24% | 113 | 1.28% |
| `according to` | 10 | 0.09% | 200 | 2.26% |
| modified document object | 8 | 0.07% | 23 | 0.26% |
| document disclosure | 7 | 0.06% | 33 | 0.37% |

The crucial result is that **testimony/attribution is much more common than documentary or research evidence**. A detector limited to `study finds`, `documents show`, `data show` and `court hears` misses most explicit sourcing surface.

## Agreement with the current evidence score

Current score bands:

- 0: no evidence cue — 11,271 rows;
- 1: research claim — 160 rows;
- 2: primary evidence — 30 rows.

Matcher rates within those bands:

| Current band | Strong empirical/document/legal | Weak typed object | Testimony | Quote+testimony |
|---|---:|---:|---:|---:|
| 0 | 0.7% | 4.7% | 10.6% | 2.3% |
| 1 research | 50.0% | 76.9% | 10.0% | 0% |
| 2 primary | 93.3% | 46.7% | 50.0% | 26.7% |

Interpretation:

1. The current **primary** band is largely coherent. 28/30 rows hit the broad strong family. One known class of error was proper-noun collision (`Testimony` as a person's name), which the POS-constrained matcher avoids.
2. The current **research** band is mixed. Half hits strong empirical structures; most hit at least a typed research object. But 37/160 hit neither strong nor weak typed-object families, usually because the cue is a generic authority formula such as scientists/researchers plus a discovery or warning verb.
3. The zero band contains substantial evidence surface, especially testimony. That is a design gap in the current detector, not necessarily a precision failure: the current detector was never designed to count attribution as evidence.
4. Strong empirical/document/legal evidence remains sparse even after broadening. The axis should not pretend that every `X says` headline is equivalent to documents/data/court evidence.

## Body/summary corroboration

Among rows with materially available body/summary text:

| Current band | Rows | Body current evidence positive | Body strong matcher | Body testimony matcher |
|---|---:|---:|---:|---:|
| headline evidence 0 | 8,685 | 2.2% | 2.5% | 18.2% |
| headline evidence 1 | 138 | 60.9% | 36.2% | 23.2% |
| headline evidence 2 | 24 | 37.5% | 25.0% | 20.8% |

Family-level corroboration:

| Headline family | Body-covered rows | Same family in body | Any current body evidence | Body strong matcher | Body testimony matcher |
|---|---:|---:|---:|---:|---:|
| strong empirical/document/legal | 164 | 35.4% | 35.4% | 35.4% | 25.6% |
| weak typed object | 537 | 57.0% | 18.2% | 15.8% | 25.3% |
| testimony | 927 | 52.9% | 1.6% | 3.1% | 52.9% |
| quote+testimony | 211 | 39.8% | 0.9% | 3.8% | 51.7% |
| vague attribution | 99 | 58.6% | 0% | 2.0% | 28.3% |

Interpretation:

- Research-headline cues are usually corroborated by the summary: 60.9% of current research-positive rows also have current body evidence. This supports the conclusion that research-release language is often genuinely evidence-shaped, not merely a regex accident.
- Primary-evidence headlines are less consistently repeated in the summary. That does **not** imply the headline evidence is absent; short summaries often state the substance rather than repeating `court hears` or `documents show`.
- Testimony corroborates testimony reasonably well (52.9%) even though the current body regex almost never counts it. This again shows the current evidence definition is narrower than the evidence typology.
- Body absence must remain neutral. Body-positive evidence can increase confidence or form a separate story-evidence metric, but it should not retroactively make a vague headline informationally specific.

## High-volume source distribution

Rates are headline-row rates, not quality verdicts.

| Source | n | Current evidence rate | Strong matcher | Weak typed object | Testimony | Quote+testimony | Vague attribution |
|---|---:|---:|---:|---:|---:|---:|---:|
| Medical Xpress | 127 | 19.7% | 15.7% | 22.8% | 3.1% | 0% | 0% |
| Phys.org | 190 | 10.5% | 7.9% | 14.2% | 2.6% | 0% | 0% |
| The Independent | 246 | 2.8% | 2.8% | 6.1% | 12.6% | 4.1% | 1.2% |
| The Guardian | 485 | 2.1% | 2.5% | 9.7% | 16.3% | 4.3% | 1.6% |
| BBC | 3,537 | 0.8% | 1.9% | 5.2% | 13.7% | 3.1% | 0.5% |
| Daily Mail | 350 | 0.6% | 1.1% | 2.9% | 6.9% | 2.9% | 0.3% |
| Financial Times | 116 | 0% | 0.9% | 6.9% | 12.9% | 2.6% | 0% |
| Korea Times | 123 | 2.4% | 0.8% | 4.9% | 14.6% | 0% | 3.3% |
| City A.M. | 173 | 0% | 0.6% | 3.5% | 12.7% | 4.0% | 0% |
| Punch | 348 | 0.9% | 0.3% | 2.9% | 13.8% | 0% | 0.3% |
| Eurogamer | 458 | 0.2% | 0.2% | 5.5% | 12.7% | 6.1% | 6.3% |
| Kotaku | 671 | 0% | 0.1% | 1.9% | 7.9% | 3.0% | 1.5% |
| IGN | 125 | 0.8% | 0% | 0% | 5.6% | 1.6% | 1.6% |
| Mirror | 133 | 0% | 0% | 3.0% | 8.3% | 2.3% | 0% |

Consequences:

- Medical Xpress and Phys.org really do have dense empirical/research surface. The measurement should reflect that, but source interpretation still needs the research-release caveat: evidence-shaped text is not independent verification.
- General news sources have substantial testimony/attribution even when their documentary/research rates are low. Ignoring testimony makes the evidence axis artificially sparse.
- Gaming/technology sources often have attribution plus explicit vague attribution (`reportedly`) rather than research/document evidence. That should score differently from strong empirical evidence, not identically.

## Precision observations by family

### Strong empirical/document/legal family

This is the most useful high-precision family. Common zero-current hits include:

- `report finds`;
- `review finds`;
- `results show`;
- `polls suggest`;
- `experiments reveal`;
- `court/trial/jury/inquest told/hears`;
- visual-record forms such as `footage/images/photos show`.

There is still noise:

- `video shows` can be direct visual evidence or merely video content;
- `report finds` can be a real document or a vague media/PR report;
- `trial to find` is an infinitival false positive from the small verb watchlist;
- visual evidence is weaker than documentary evidence unless tied to a concrete event.

These are reasons for tiering, not for endless phrase patching.

### Weak typed-object family

Weak object presence is too noisy to score strongly by itself:

- `trial` often means a legal trial, not a research trial;
- `poll` can mean an election vote or a survey;
- `report` can mean a financial report, a live report, or a document;
- `Letter:` can be a content-type label rather than evidence;
- `review` can mean a review article, an institutional review, a game review, or a process.

Use weak typed objects only when they are modified (`clinical trial`, `official data`, `leaked documents`), connected to an empirical verb, or corroborated by another anchor.

### Testimony/attribution family

This is broad and valuable but heterogeneous:

- named direct speech (`Zelensky says`, `prosecutor says`) is meaningful attribution;
- institutional speech (`police say`, `ministry confirms`) is meaningful but varies in evidential weight;
- inverted `says X` forms are common and now captured only after punctuation to avoid object misreads;
- passive fragments such as `Pippa told to…` can look like speech attribution without actually supplying a source;
- announcement verbs (`announces`, `urges`, `denies`) are communication events. They are provenance surface, but weaker than testimony/direct quotation and not equivalent to empirical evidence.

The right response is tiering by evidence type, not trying to make one binary attribution flag carry everything.

### Quotation

Quotation alone is not evidence. Quoted phrases can be titles, scare quotes, slogans, or content fragments. Quotation plus a speech/legal attribution family is useful; 263 rows had quote+testimony surface.

## Recommended measurement model

Evidence specificity should be ordinal/continuous, not the current two-regex hierarchy. A defensible row-level interpretation is:

| Level | Surface type |
|---:|---|
| 0 | no evidence/attribution surface |
| 1 | vague sourcing (`reportedly`, unspecified `sources say`) or communication-event-only surface |
| 2 | direct testimony/attribution, especially named or role-specific speaker; unanchored typed object |
| 3 | typed empirical/documentary/legal evidence: study/poll/data/documents/court/inquest plus empirical relation or modifier |
| 4 | anchored evidence combination: typed evidence plus named entity, quantity, date/place, document type, or compatible body corroboration |

Important qualifications:

1. Level measures **surface specificity**, not truth, independence, or methodological quality.
2. Body corroboration should be a confidence/validation tier or separate story-evidence metric. It should not rewrite the headline-level construct.
3. Missing body text is neutral.
4. Testimony should count, but not equal documentary/data evidence.
5. Announcements and vague attribution should count less than direct testimony.
6. Weak typed objects should not score strongly alone because of structural polysemy.
7. Evidence-shaped research-release language is real evidence surface; it still needs source-type caveats because it is not independent verification.

## Implementation implications

The probe supports implementing transparent per-row features in the analyser:

- `evidence_strong_surface`: object+empirical verb, modified evidence object, document disclosure, legal testimony forum;
- `evidence_research_surface`: research object+empirical verb or modified research object;
- `evidence_document_surface`: document/data object+empirical verb or modified document object;
- `evidence_legal_surface`: court/trial/jury/inquest hears/told;
- `testimony_direct_surface`: noun/proper-noun speaker plus direct speech verb, including punctuated inversion;
- `testimony_quote_surface`: quotation plus testimony;
- `announcement_surface`: speaker plus announcement verb;
- `vague_attribution_surface`: reportedly/allegedly/unspecified sources;
- `evidence_anchor_count`: entity/quantity/time-place/official modifiers accompanying evidence;
- corresponding body-tier features for corroboration only.

The watchlists can stay broad. The matcher should use:

- POS constraints on objects to avoid proper-name collisions;
- shallow inflection surfaces because spaCy lemma/POS output is noisy in headlines;
- token boundaries always;
- no substring matching;
- no attempt to enumerate every deep-tree variation.

## Implementation status, 2026-11-28

The recommended family model has now been implemented in `analyse_headlines.py` as a continuous headline-level evidence-surface score:

| Surface tier | Score |
|---|---:|
| documentary/data/legal evidence with empirical/disclosure relation, or existing high-precision primary evidence | 1.0 |
| typed research evidence with empirical relation or evidence modifier | 0.8 |
| direct testimony from a specific speaker, with a small quotation/anchor increase | 0.6–0.65 |
| generic research/authority claim | 0.45 |
| direct testimony from a vague collective speaker | 0.35 |
| communication-event-only attribution such as announce/urge/deny | 0.25 |
| weak unambiguous typed object without a relation | 0.25 |
| explicit vague attribution such as `reportedly` | 0.15 |
| no evidence/attribution surface | 0 |

Implementation guards added after aggregate smoke checks:

- proper-name collisions such as a person named `Testimony` do not count;
- standalone `transcript`/`testimony` content labels do not count as weak evidence;
- passive fragments such as `X told to…` are not treated as attribution;
- negated constructions such as `X doesn't tell you` are not treated as testimony;
- compound/content uses such as `video game` or `gameplay footage` are not treated as visual evidence;
- vague collective speakers such as `experts` score lower than named or role-specific speakers.

Body/summary diagnostics now include strong-evidence, testimony and vague-attribution surface rates. They remain diagnostics only; they do not alter the headline-level composite.

## Bottom line

The original evidence axis was directionally coherent but too narrow. Its primary band was mostly valid; its research band mixed strong typed evidence with generic authority formulas; and it missed the much larger testimony/attribution layer entirely.

The replacement is a small family-based evidence-surface model, not a bigger regex pile. It should produce a less sparse, more meaningful axis without pretending that attribution extraction is solved or that evidence-shaped language proves publisher quality.

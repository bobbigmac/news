# Curiosity-gap measurement audit

Date: 2026-11-28

## Purpose

This audit uses LLM judgment on real corpus headlines to establish what the curiosity-gap axis should measure, where the current detector fails, and which lightweight linguistic signals are worth retaining as candidate measurements.

It is not a corpus-prevalence estimate. The sample was deliberately stratified toward low-concreteness, forward-reference, question, listicle, service and control rows so that borderline and failure cases would actually appear.

Inputs:

- candidate/probe measurements: `.working/measurement_probe.csv`
- first labelled sample: `.working/curiosity_audit_labels.csv`
- augmented sample: `.working/curiosity_audit_augment_labels.csv`
- merged audit labels: `.working/curiosity_audit_labels_merged.csv`

## LLM scoring scale

The audit scored **information withholding in the headline**, not clickbait morality and not whether the article is useful.

| Score | Meaning |
|---:|---|
| 0 | Fully resolving, explicit, transparent service/metadata, or otherwise not materially withholding a central fact. |
| 1 | Topic-explicit explanatory, analysis or service question. The article obviously contains the answer/interpretation, but the headline still leaves resolution to the article. |
| 2 | Moderate withholding: central examples, reasons, mechanisms, findings or timing are not supplied, but the topic is clear. Includes many listicles and `how/why` explanatory frames. |
| 3 | Strong withholding or vagueness: missing referent, central fact withheld, unresolved identity, vague reaction/emotion, or teaser framing where the headline is doing little independent information work. |
| 4 | Extreme bait: direct guessing games, virtually no recoverable topic/event, or pure teaser fragments. |
| blank | Not assessable as publisher behaviour: truncation artefacts, feed fragments, column/programme labels. |

Important boundary: **all headlines omit details**. A score of 1 is not a defect by itself. The axis should penalise stronger withholding, not the normal fact that an article contains more information than its headline.

## Sample composition

Merged sample:

- 139 rows total
- 133 assessable rows
- 7 not assessable as publisher behaviour

Assessable score distribution:

| Score | Count |
|---:|---:|
| 0 | 46 |
| 1 | 48 |
| 2 | 26 |
| 3 | 9 |
| 4 | 3 |

The small number of 3/4 rows is partly a corpus fact — mainstream RSS headlines are usually topic-explicit — but also means severe cases need targeted validation before any final scaling.

## What the current detector catches

The current explicit detector flags only 20 of 11,461 corpus rows. All 20 were included in the audit.

| LLM result among existing positives | Count | Interpretation |
|---|---:|---|
| not assessable / truncation artefact | 5 | feed truncation or fragments, not reliable publisher style |
| score 0 | 1 | false positive |
| score 1 | 3 | marginal/topic-explicit explanatory packaging |
| score 2 | 6 | genuine moderate withholding |
| score 3 | 3 | strong teaser/withholding |
| score 4 | 2 | extreme bait |

So the detector does find some genuine cases, but its positives are not clean:

- 5/20 are unreliable because the ellipsis appears to come from truncation rather than the publisher's headline;
- 4/20 assessable rows were below the moderate-withholding threshold;
- only 5/20 assessable rows reached strong/extreme withholding.

Examples of problematic positives:

- `The One Thing EA Has Always Been Good At Is Killing Video Game Studios` — despite the stock `one thing` frame, the answer is explicitly supplied; score 0.
- `The truth about autistic masking and its toll on mental health` — packaged but topic-explicit; score 1.
- `Indonesia calls for G20 unity ... meetin...` — word-level truncation/feed artefact, not assessable as deliberate curiosity style.
- `And lastly, Brandon Miller has been diagnosed with a ...` — critical object truncated by the feed/pipeline, not assessable as publisher behaviour.

This means trailing ellipses need a provenance guard. A mechanically truncated fragment is not the same thing as a publisher-written suspense ellipsis.

## False-negative patterns found

Among assessable sampled rows not flagged by the current detector, 27 scored 2 or higher. Because suspicious rows were oversampled, this is **not** a corpus false-negative rate. It does, however, establish recurring structural false-negative families.

### Strong/extreme false negatives

- `It Didn't Have To End This Way` — score 4. No recoverable event, actor or topic.
- `'Hopefully things get done': Americans react to historic political shift` — score 3. The shift is unspecified and the only promised content is reaction.
- `When will we know the results?` — score 3. The relevant results are not named in the headline.
- `What the hell is going on in the Michigan Senate Race?` — score 3. Topic present, but the triggering event/problem is absent and the wording heightens drama.
- `Met Office pinpoints when heavy rain will end as temperatures rise this weekend` — score 3. The central fact — when — is explicitly promised but withheld.
- `She spent 18 years believing she had MS. Then her diagnosis changed.` — score 3. Identity and corrected diagnosis are withheld despite narrative detail.
- `'They're Looking for Scapegoats': What We Heard This Week` — score 3. Pronoun/referent and topic are not recoverable.

### Moderate false negatives

Recurring families:

- **withheld list examples**: `These Are The 11 Best Romances BioWare Ever Made`, `Here Are Some Super Useful Control Shortcuts GTA 6 Doesn't Tell You About`, `7 simple ways to turn a new workout routine into a lasting habit`
- **withheld reason/mechanism**: `How online predator duped 70 girls into believing he loved them`, `Revealed: How Russia's pink slime is poisoning online news`
- **withheld lesson/finding**: `What six grazing horses tell us about England's housing crisis`, `NHS England mental health services review: what has it found and what does it recommend?`
- **withheld event details**: `What happened overnight with the Microsoft global outage?`
- **vague follow-up/analysis**: `Jensen Huang Is Gone. Now What?`, `Rusty or something more? South Africa's concern after Australia loss`
- **withheld timing/result**: `When will we actually know who controls Congress?`
- **service headline with missing referent**: `How to Get Ready for November 19`

These are mostly not stock clickbait phrases. They are structural information gaps.

## Feature evidence from the audit sample

Spearman correlations with the 0-4 LLM score, within the stratified sample:

| Feature | rho | Direction |
|---|---:|---|
| pronoun density | +0.339 | more unresolved pronoun use → higher withholding |
| concreteness | −0.296 | lower concreteness → higher withholding |
| determiner density | +0.289 | more noun-phrase/stopword structure → higher withholding |
| forward-reference density | +0.285 | more `this/what/how/here` style structure → higher withholding |
| WH density | +0.246 | questions often withhold, but mostly score 1 rather than severe |
| entity count | −0.195 | more named entities → lower withholding |
| entity density | −0.182 | more named specificity → lower withholding |
| proper-noun density | −0.181 | more proper-noun density → lower withholding |

Grouped means:

| Score group | Concreteness | Entity density | Proper-noun density | Pronoun density | Determiner density | Forward-reference density |
|---|---:|---:|---:|---:|---:|---:|
| 0 | 3.454 | 0.109 | 0.260 | 0.028 | 0.040 | 0.034 |
| 1 | 3.110 | 0.047 | 0.117 | 0.100 | 0.065 | 0.097 |
| 2-4 | 2.984 | 0.060 | 0.156 | 0.096 | 0.083 | 0.092 |

Useful threshold patterns, again only within this stratified sample:

- determiner density `>= 0.10`: 19.6% of score-0 rows, 25.0% of score-1 rows, 52.6% of score-2-4 rows;
- pronoun density `>= 0.08`: 19.6% of score-0 rows, 52.1% of score-1 rows, 60.5% of score-2-4 rows;
- forward-reference density `>= 0.15`: 6.5% of score-0 rows, 31.2% of score-1 rows, 26.3% of score-2-4 rows;
- low concreteness `<= 2.8`: 13.0% of score-0 rows, 27.1% of score-1 rows, 34.2% of score-2-4 rows.

Interpretation:

1. **No single feature is sufficient.** Questions and forward references often indicate legitimate explainers (score 1), not manipulation.
2. **The useful signal is conjunctive.** Low concreteness plus low named specificity plus unresolved references is much more meaningful than any one cue.
3. **Entity density is informative but noisy.** SpaCy misses valid entities and mislabels organisations/products, so it should be a specificity cue rather than a semantic verdict.
4. **Determiner/pronoun structure matters.** This agrees with clickbait research: clickbait tends to be more sentence-like and stopword/determiner heavy, while resolving news headlines are denser in proper nouns and content words.
5. **Severe cases are semantic.** The difference between “article naturally contains details” and “headline withholds the central fact” cannot be reduced to a regex. The LLM audit labels are the reference for calibrating and checking the numerical approximation.

## Semantic category structure

The category labels were coherent enough to use as a design schema.

Typical score-0 categories:

- resolving headlines;
- explicit service/commerce/guide headlines;
- transparent content metadata (`Official Rally DLC Launch Trailer`, earnings-call labels);
- explicit marketing where the offer itself is named.

Typical score-1 categories:

- analysis questions;
- explanatory questions;
- service/explainer questions;
- topic-explicit responses or performance questions.

Typical score-2 categories:

- withheld listicle examples;
- withheld reasons/mechanisms;
- withheld findings/lessons;
- vague sports/follow-up analysis;
- service headlines with a missing referent.

Typical score-3/4 categories:

- missing topic or referent;
- central fact explicitly promised but absent;
- vague reaction/emotion;
- salacious/teaser clues;
- direct guessing games;
- extreme vague teasers.

This validates the continuous-scale approach from the research: curiosity gap is not binary, and not every question/list/explainer is equivalent.

## Implementation implications

### What not to do

- Do not treat question form as clickbait.
- Do not treat every `how/why/what` headline as equally withholding.
- Do not use substring matching for trigger words.
- Do not count feed-truncated fragments as publisher curiosity style.
- Do not collapse service packaging into curiosity gap. They are related but distinct axes: a transparent `How to spot X` guide can be service journalism without withholding what the article is about.
- Do not expect spaCy/compromise entity extraction to decide whether the headline is withholding. It can only provide noisy specificity evidence.

### Candidate numerical measurement

A better row-level curiosity-gap measurement should combine:

1. **forward-reference load** — WH words, demonstratives, unresolved pronouns, `here's why/what` structures;
2. **specificity floor** — entity count/density, proper-noun density, concreteness, perhaps numbers where they carry actual information;
3. **sentence-like stopword structure** — determiner and pronoun density rather than fixed phrases;
4. **listicle-withholding structure** — numeric quantity plus a category noun such as `ways/reasons/things/shortcuts`, with word-boundary token matching;
5. **vague reference structure** — definite noun phrases such as `the results`, `the truth`, `what happened` where no referent is established in the headline;
6. **truncation/provenance guard** — incomplete words, source fragments, feed truncation and column labels should be excluded or marked not assessable;
7. **legitimate-frame attenuation** — explicit service guides and topic-explicit analysis questions should cap out around mild withholding unless they also hide the central referent.

The score should be continuous or ordinal, not a binary `explicit_curiosity_gap_present`. A sensible interpretation is:

- 0-0.5: resolving/explicit;
- 0.5-1.5: normal explanatory/article gap;
- 1.5-2.5: moderate withholding;
- 2.5+: strong/teaser withholding.

Exact cut points should come from the audit labels and source-level distribution, not from aesthetic preference.

## Measurement risks

- The audit sample is small for score 3/4. Severe cases should be oversampled once more before final calibration if implementation depends on exact tail weights.
- The sample is stratified, so correlations and threshold rates above cannot be read as corpus prevalence.
- Some sources supply truncated RSS titles. Treating truncation as source behaviour would unfairly penalise them.
- Low concreteness sometimes reflects lexicon gaps or concise factual headlines, not withholding. Example: `The Duskbloods Is Officially Delayed Until 2027` had low measured concreteness but is fully resolving.
- Entity extraction can fail precisely on gaming, informal, social-platform or non-US/UK sources. Entity evidence should therefore be directional and aggregate-level.

## Post-implementation aggregate calibration, 2026-11-28

A continuous implementation of the candidate measurement now exists in `analyse_headlines.py`. It combines broad surface families with noisy-or accumulation rather than additive penalties:

- stock teaser/direct guessing formulas;
- trailing ellipses as moderate rather than automatically extreme evidence;
- listicle/example withholding;
- withheld reasons, mechanisms, findings, timing and resolution;
- reaction and emphatic gaps;
- vague references and unresolved forward starts;
- pronoun, determiner, WH and forward-reference density;
- attenuation when entities, numbers, time/place and event structure already make the headline concrete.

Calibration used the fixed audit labels only in aggregate. It did not tune individual story verdicts. On the 133 assessable rows, the implementation has:

- Spearman correlation with the ordinal LLM score: **0.751**;
- Pearson correlation: **0.735**;
- mean risk by audit score: 0 → **0.029**, 1 → **0.140**, 2 → **0.390**, 3 → **0.547**, 4 → **0.577**;
- score ≤1 rows with risk ≥0.5: **4/95**;
- score ≥2 rows with risk <0.2: **4/38**.

This is acceptable as a continuous risk signal, not as a binary classifier. The score-4 mean is based on only three rows, so the high tail remains under-calibrated. Some categories are intrinsically hard for surface measurement: withheld referents that depend on reader/world context, service headlines whose missing answer is legitimate, and vague teaser fragments that can also be feed truncation. Those cases should remain uncertainty rather than be chased with ever-deeper phrase rules.

## Bottom line

The original detector was not merely too strict; it measured only the stock-phrase tail of the construct. The replacement now measures structural withholding as a continuous risk signal while keeping transparent service/explanatory headlines separate from teaser-style withholding.

The implementation should be interpreted as a graded publisher-language measurement aggregated at source level. It is not a story verdict, and the small stratified calibration sample is not formal precision/recall validation.

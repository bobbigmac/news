# Measured-source scoring research assessment

Date: 2026-11-28

## Purpose

This assessment evaluates research-backed ways to improve the measured-source axes, especially:

- **curiosity-gap restraint**, currently almost inert because it is essentially `1 - explicit_stock_phrase`;
- **evidence specificity**, currently a small set of stock evidence phrases;
- the sparse/asymmetric restraint axes, where most sources cluster near the same value.

The aim is not another cycle of hand-tuned regexes. The recommended direction is:

1. use lightweight libraries to extract transparent candidate features;
2. use validated research measures where they exist;
3. use LLM judgment on stratified samples to define and validate the language categories;
4. fit or calibrate only small, inspectable numerical models against those judgments;
5. keep corpus inputs frozen and treat all extraction as noisy measurement, not ground truth.

No production implementation is approved by this document.

## Audit update, 2026-11-28

Three follow-up audits now supersede the sample-labelling-heavy next-step sketch in section 8:

- `CURIOSITY_GAP_AUDIT.md` — LLM audit of curiosity-gap construct boundaries and current false negatives;
- `EVIDENCE_SPECIFICITY_AUDIT.md` — corpus-level evidence-family audit using broad spaCy token-matcher watchlists and body corroboration;
- `RESTRAINT_SCALING_AUDIT.md` — distribution/noise audit showing that nonlinear stretching should not be applied before row-level measurement improves.

Important process correction: do **not** turn implementation into row-by-row story rating. Use libraries and broad token/dependency families, validate them in aggregate, and reserve LLM judgment for construct boundaries and spot-checking failure families.

---

## 1. What is wrong with the current measurement

### Curiosity-gap restraint

The current detector flags only 20 of 11,461 rows (**0.17%**) as explicit curiosity-gap headlines. That is not a plausible measure of the underlying construct. Blom and Hansen's 2015 study of 100,000 Danish online-news headlines found forward-reference in **17.2%** of headlines. The Danish figure is not a target rate for this corpus, but the two-order-of-magnitude difference shows that stock phrases such as trailing ellipses and "you won't believe" are only the extreme tail.

More importantly, the axis currently confuses several different things:

- vague headlines with no recoverable topic (`What is happening?`);
- headlines that name a topic but withhold the answer (`What killed Weil Gotshal?`);
- explanatory/service questions (`What is AI, how does it work…?`);
- listicles that withhold examples (`These are the 11 best…`);
- direct marketing/service fragments (`Get 31% off forever`);
- sensational teaser language (`Wow, GTA 6 has some incredible animations`).

These should not receive the same curiosity-gap penalty. The valid target is not "abstractness" or "question form"; it is **how much reader-relevant information the headline withholds while promising resolution in the article**.

### Evidence specificity

The current evidence score is mostly two regex families:

- primary evidence phrases such as court records, documents showing something, official data, transcripts;
- research phrases such as `study finds`, `research shows`, `scientists discover`.

This produces both false negatives and inflated positives.

False negatives seen in the probe sample:

- direct quoted testimony in the headline;
- `scientist says` testimony;
- court/action/amount combinations such as `SERAP drags FG to ECOWAS Court over N78.8bn cash transfer`;
- document/event combinations such as `Secret Oslo negotiations… documents`;
- concrete official actors, police/court context, quantities, dates and named entities.

Inflated or weak positives:

- `Scientists Discover Why Microplastics Trigger Inflammation` — a generic authority/research formula with no methodological or documentary detail in the headline;
- research-release headlines from Phys.org, Medical Xpress and PsyPost where `study finds/suggests` is formulaic;
- cases where the body contains methodological detail, but the headline itself only uses the stock research formula.

The research literature supports a richer evidence typology, but also warns against expecting surface rules to perform like human judgment.

---

## 2. Research base: curiosity gaps and clickbait

### 2.1 Continuous headline concreteness

The strongest directly relevant validation is:

> Marianne Aubin Le Quéré and J. Nathan Matias, *When curiosity gaps backfire: effects of headline concreteness on information selection decisions*, Scientific Reports 15, 994 (2025).  
> https://www.nature.com/articles/s41598-024-81575-9

Important findings:

- They explicitly argue that curiosity-gap headlines should be treated as a **continuous information-concreteness scale**, not a binary genre.
- Their measure uses Brysbaert/Warriner/Kuperman word-concreteness ratings.
- Person, place and organisation entities are assigned maximum concreteness **5**.
- Standard stopwords are removed, but forward-reference words and pronouns such as `this`, `these`, `she`, `they`, `what`, and `how` are deliberately retained because journalism research identifies them as information-gap devices.
- Punctuation and cardinal numbers are ignored; unmatched long words can make a headline unusable.
- Validation: 176 participants rated 320 Upworthy headlines; the automated measure correlated with mean human judgments at **r = 0.61, p < 0.0001**.
- The measure was then applied to 8,977 valid one-image headline A/B tests from the Upworthy archive.
- Higher concreteness increased clickthrough when baseline headlines were vague, but decreased clickthrough when baseline headlines were already very concrete.

Interpretation for this project:

- The validation supports using concreteness as a **continuous component** of information specificity.
- The clickthrough curve is not a normative target. We are not trying to maximise clicks; we are measuring reader-facing information delivery and restraint. Mid-level concreteness may maximise curiosity/CTR, but that does not make it better journalism.
- Low concreteness is especially meaningful when combined with unresolved references and low named-specificity. Low concreteness alone is insufficient.

### 2.2 Forward-reference linguistics

Blom and Hansen, *Click bait: Forward-reference as lure in online news headlines*, Journal of Pragmatics 76 (2015), analysed 100,000 Danish headlines.

Useful distinctions:

- **discourse deixis**: reference to forthcoming discourse, e.g. `This is why you should read this article`;
- **cataphora**: reference forward to a later phrase or entity, e.g. `When he arrived…, the journalist…`;
- forward-reference creates anticipation because the headline itself does not resolve the referent.

Later clickbait studies repeatedly identify:

- demonstratives (`this`, `these`, `that`);
- unresolved personal pronouns;
- interrogatives;
- imperatives/direct address;
- definite noun phrases with missing referents (`the reason`, `the thing`, `the truth`);
- ellipses and suspense punctuation;
- numeric/list frames (`11 things`, `the 5 reasons`);
- hyperbolic or affective language.

This does not mean every use is clickbait. `This is what video game preservation looks like` is structurally forward-referring but may still name the topic. The measure needs degrees and semantic adjudication, not a binary word list.

### 2.3 Clickbait machine-learning evidence

Chakraborty et al., *Stop Clickbait* (ASONAM 2016), compared 7,500 crowd-labelled clickbait headlines from BuzzFeed/Upworthy/ViralNova/Scoopwhoop/ViralStories with 7,500 Wikinews headlines.

Useful linguistic findings:

- clickbait headlines were longer and more sentence-like;
- they used far more stopwords (**45% vs 18%** in their data);
- they used more contractions, determiners, adverbs and personal/possessive pronouns;
- non-clickbait headlines had more proper-noun/content density;
- clickbait headlines reused formulaic n-grams much more heavily;
- simple sentence-structure features alone reached about **0.77 accuracy**; richer feature families reached about **0.93** in-domain.

Serious limitation: the non-clickbait class is Wikinews and the clickbait class is viral publishers. A classifier can learn publisher/domain/style rather than the construct. This dataset is useful for feature design and coarse validation, not as an unbiased ground-truth scoring machine.

The Clickbait Challenge 2017/Webis corpus is better in one respect: it contains 38,517 tweets with 4-point crowdsourced clickbait-strength judgments and is CC-BY 4.0. It supports the crucial point that clickbait is continuous. But it is still a 2017 social-media corpus, and annotators were not required to read the target article carefully. Cao et al. found that models struggle most in the ambiguous middle and that labels are noisy/subjective.

### 2.4 Body/headline relationship evidence

Cao et al., *Machine Learning Based Detection of Clickbait Posts in Social Media* (Clickbait Challenge 2017), tested 331 features and selected 60. They included post/target relations such as:

- similarity between teaser/headline and target title;
- similarity between teaser/headline and target paragraphs;
- overlap between teaser/headline and target keywords.

The relation features were directionally sensible — non-clickbait had more overlap — but were weak alone. Post-text features were much stronger. This supports using body/summary overlap as corroboration, not as a stand-alone truth or clickbait verdict.

That fits our data limitation: only about 59% of rows have materially useful body/summary coverage, and coverage differs sharply by source.

---

## 3. Research base: evidence specificity and attribution

### 3.1 Evidence typology

Argumentation and fact-checking research commonly distinguishes evidence types such as:

- **study/statistics**: research, surveys, polls, measurements, data, clinical trials;
- **testimony/expert**: direct or indirect quotation, named expert, official statement;
- **anecdote/event**: concrete event, case, observation or example;
- **document/record**: court filings, official records, reports, transcripts, audits, leaked documents.

This maps better to evidence specificity than the current two-regex hierarchy.

A useful scoring concept would be:

| Level | Meaning |
|---|---|
| 0 | no evidence surface signal; bare claim or generic interpretation |
| 1 | generic authority or evidence formula (`scientists say`, `a report finds`) |
| 2 | typed evidence (`poll`, `court filing`, direct quote, `clinical trial`, official data) |
| 3 | anchored evidence: type plus named person/institution/document, quantity, date or place |
| 4 | corroborated specificity: headline/body contains multiple compatible details or distinct evidence types |

This is still **evidence surface specificity**, not truth, independence or methodological quality.

### 3.2 Evidence-type classifiers are only moderately reliable

Al-Khatib et al.'s editorial-argumentation work annotated 300 editorials and classified argumentative units as testimony/statistics/anecdote/none. Reported class-level F1 was only about:

- testimony **0.50**;
- statistics **0.59**;
- anecdote **0.51**;
- none **0.87**.

The overall system was useful, but nowhere near perfect. This is a strong warning not to treat lexical evidence detection as solved.

### 3.3 Informational-source attribution is broader than quotes

Spangher et al., *Identifying Informational Sources in News Articles*, EMNLP 2023, built a large annotated corpus of informational sources in news writing.

Important conceptual findings:

- a sentence is attributable if there is explicit or implicit indication that facts came from a source;
- a sentence may be unattributable because it is journalist analysis, speculation or context;
- sources are usually people or organisations, but information channels also include public statements, published work, court proceedings, orders/laws, direct observation, email/social posts and more;
- quote-focused systems capture only part of attribution.

Their modelling table is directly relevant:

- simple co-occurrence of a speaking verb and source entity had detection F1 around **64.7**;
- dependency-governed rules were better but still only around **71.3**;
- end-to-end attribution for these rule systems was much weaker;
- their best fine-tuned GPT-3 Curie pipeline reached about **83%** end-to-end attribution accuracy;
- they explicitly found simple lexical cues insufficient.

Interpretation: quote/attribution extraction is useful as evidence of sourcing, but full attribution is too hard for the lightweight offline stack. We should extract surface cues and combinations, not pretend to resolve the true source.

### 3.4 Claim extraction is not a shortcut

ClaimBuster-style check-worthy claim detection is transformer-era research and the public implementation is GPL plus model-heavy. NewsClaims benchmark results show poor transfer: ClaimBuster had high recall but very low precision in news-claim detection, and even human agreement was limited. Modern atomic-claim libraries such as ReClaim generally expect LLM or transformer infrastructure.

Conclusion: do not build evidence scoring on atomic claim extraction. Extract evidence surface features and use LLM judgment for audit/calibration.

---

## 4. Library assessment

### Adopt or continue using

| Tool/data | Licence | Fit | Evidence from probing | Recommendation |
|---|---|---|---|---|
| **spaCy `en_core_web_sm` 3.8.0** | MIT | Strong | Already installed; CI precedent exists in the podcasts project. Measured roughly **268–293 headlines/sec** locally in batches. NER F1 reported at **84.33**. | Continue as the main lightweight linguistic extraction layer: POS, lemmas, entities, noun/verb shape. Treat output as noisy signals, not semantic truth. |
| **GeoNames city gazetteer** | CC-BY 4.0 | Strong for validation | `cities15000.zip` is only **3.3 MB compressed**; parsed **34,251 rows** in **0.38s** in a test. It includes useful local names and alternates. `Longsight` appears; some smaller localities do not. | Use as a candidate-validation gazetteer for place anchoring, with attribution. Do not use it as a full geoparser or as proof that a string is being used as a place. |
| **`pycountry`** | LGPL-2.1-only | Moderate | Already in the project environment. | Continue using for country/nationality reference, but not as the only place detector. |
| **Clickbait Challenge corpus** | CC-BY 4.0 | Validation/calibration data | 38,517 posts from 27 major US news publishers, sampled to reduce publisher/topic bias and annotated on a 4-point scale by five annotators; still a 2016–2017 social-media corpus. | Use for external validation/feature calibration if useful. Do not directly transfer a trained score without source/time-domain audits. |

### Conditionally useful

| Tool/data | Licence | Fit | Evidence from probing | Recommendation |
|---|---|---|---|---|
| **`wordtangible` 0.7.0** | MIT code; mixed upstream norm licences | Useful reference/development dependency | Bundles Brysbaert, Muraki, Glasgow and Lancaster-style resources. `source="open"` avoids research-only MRC. Output behaved sensibly: concrete headlines scored around 3.9–4.1, vaguer headlines around 2.6–2.9. But it does **not** implement the validated entity=5 method and defaults to removing stopwords, including some forward-reference words. Cold import/use was slow; warm scoring was still several ms per call because NLTK tokenization is repeated. NLTK 3.10 security rules made data setup brittle. | Do not use blindly as the measure. Either use it as a dev-time lexical-resource/reference implementation, or implement the validated method directly against open norm data using spaCy tokenization/entities. |
| **`quantulum3` 0.10.0 base** | MIT | Useful complement for quantities | Fast after warm-up in small tests and correctly extracted percentages, years, durations and spelled-out billions. Without its optional classifier it misread `$38bn` as an implausible compound unit (`dollar bit newton`); spelled `38 billion dollar` was correct. Optional classifier dependency resolution was fragile/heavy in the Python 3.14 test environment. | Use only as a candidate quantity extractor with unit whitelists/guards. Do not treat parsed units as semantic truth. Probably dev-analysis only, because the ingestion pipeline is Node. |
| **`compromise-dates`** | MIT | Useful for ingestion-time guessed tags, with constraints | Correctly extracted explicit weekdays, quarters and relative weeks. But it processed only about **100 headlines/sec** and produced false date interpretations such as treating `for 12 years after` as a future date. The newest 3.12.0 release is only days old, so pin an older compatible release if adopted. Peer requirements currently expect a newer compromise than the project has installed. | Consider only for ingestion decoration, not as a measurement truth. Prefilter obvious date candidates and store as provisional guessed tags. Do not use raw output as a date fact. |
| **BBC Citron** | Apache-2.0 | Conceptually relevant, operationally weak | Experimental quote extraction/attribution system using spaCy/sklearn; built around older package versions and the PARC quote-attribution tradition. | Do not adopt now. Revisit only if body-level quote attribution becomes important enough to justify dependency work. |

### Reject or do not use for this task

| Tool/data | Why |
|---|---|
| **`sentence_concreteness` PyPI package** | The paper's method is valuable, but the package is a research artifact. PyPI metadata pins `spacy==3.2.0` and `numpy==1.21.0`, incompatible with the current spaCy 3.8 / Python 3.14 stack. The repo itself calls the package experimental; the implementation assumes working-directory data files, uses NLTK data at import/runtime, and has fragile packaging. Adopt the method, not the package. |
| **`en_core_web_md` upgrade** | MIT and only ~31 MB, but the reported NER improvement over `sm` is tiny (**84.73 vs 84.33 F1** in 3.8.0). Vectors do not solve the measurement problem. Not worth the operational cost for this use. |
| **`textacy`** | Attractive extraction helpers, but 0.13.0 pins `spacy~=3.0`, incompatible with spaCy 3.8. It also pulls a large dependency set. |
| **`dateparser` / `dateparser-search`** | BSD-licensed and useful for explicit date parsing, but probing showed it was slow and false-positive prone (`12 years after` became a datetime). Not suitable for blind high-volume scoring. |
| **`geotext`** | MIT and fast, but probing showed poor precision/recall for headline place anchoring, including common false positives such as treating `Man` as a city. Not a replacement for NER plus gazetteer validation. |
| **full geoparsers: Mordecai3 / modern `geoparser`** | Real geoparsing is heavy: transformer NER or sentence-transformer ranking, large PyTorch dependencies, GeoNames indexes and sometimes Elasticsearch. That conflicts with the lightweight/no-large-model constraint. We only need place-anchor evidence, not full geocoding. |
| **SaysWho** | Interesting quote attribution, but depends on textacy, older spaCy expectations and experimental coreference/transformer/large-model components. |
| **ClaimBuster implementation** | GPL, transformer-oriented, and domain transfer to news is weak. Not suitable as the foundation. |
| **ReClaim / atomic-claim systems** | Conceptually useful but generally LLM/transformer-dependent. Violates the lightweight constraint. |
| **`guessit`** | Not relevant: it extracts metadata from video/media filenames, not general proper nouns or evidence in news language. |

---

## 5. Empirical probe on the frozen corpus

A one-off probe wrote `.working/measurement_probe.csv` for all 11,461 headlines. It combined:

- spaCy POS/entity features;
- a local approximation of the validated concreteness method using the Brysbaert CSV;
- entity, proper-noun, pronoun, determiner, WH and forward-reference-ish densities.

This is not a final metric. It is evidence about what the features see.

### Distributions

| Feature | Mean | Median | 5% | 95% |
|---|---:|---:|---:|---:|
| concreteness approximation | 3.595 | 3.581 | 2.835 | 4.385 |
| entity density | 0.113 | 0.100 | 0 | 0.286 |
| PROPN density | 0.230 | 0.200 | 0 | 0.600 |
| pronoun density | 0.024 | 0 | 0 | 0.133 |
| determiner density | 0.033 | 0 | 0 | 0.143 |
| WH density | 0.011 | 0 | 0 | 0.091 |
| forward-reference-ish density | 0.017 | 0 | 0 | 0.100 |

The 20 rows currently flagged as explicit curiosity gaps do move in the expected direction:

- mean concreteness **3.268 vs 3.596**;
- mean entity density **0.070 vs 0.113**;
- mean determiner density **0.104 vs 0.033**.

So the research features are not disconnected from the current detector; the detector merely catches only the extreme tail.

### Examples showing why concreteness alone is insufficient

Low-concreteness probe examples include:

- `What is happening?` — genuinely vague, strong curiosity gap;
- `I'm ready.` — vague/personal teaser;
- `These Are The 11 Best Romances BioWare Ever Made` — listicle withholding examples, moderate curiosity packaging;
- `How well do we actually know what's going on in the economy?` — abstract explanatory question, not automatically manipulative;
- `What is Pip?` — service/explainer question with an explicit topic;
- `The Duskbloods Is Officially Delayed Until 2027` — concrete event headline, scored low only because the game title and event vocabulary are not in the lexicon/NER output;
- `Wow, GTA 6 Has Some Incredible Animations` — sensational/enthusiastic, but not strongly information-withholding because the subject is explicit;
- `Get 31% off forever` — marketing/service packaging, not primarily a curiosity gap.

This validates the design requirement: curiosity-gap measurement must combine concreteness with **reference resolution, topic specificity and communicative intent**. LLM judgment is needed to distinguish those categories during calibration.

### spaCy noise observed directly

The probe and small examples show why spaCy cannot be a rock floor:

- `Manchester` correctly became GPE;
- `Longsight` was capitalised/PROPN but had no entity label;
- `Gorton` was mislabelled PERSON;
- `Belgorod` was labelled NORP rather than GPE;
- `Manchester United` was labelled PERSON;
- `OpenAI` was missed in `OpenAI signs $38bn cloud deal with Amazon`, although `38bn` was correctly recognised as MONEY.

Therefore:

- use spaCy entities as one signal;
- use proper-noun sequences as a recall-complement;
- use GeoNames/pycountry as validation for place candidates;
- aggregate over many headlines before drawing source-level conclusions;
- never make a single entity label decisive.

---

## 6. Recommended measurement architecture

### 6.1 Feature layer

Compute transparent per-row features, not final verdicts:

1. **Validated concreteness approximation**
   - implement the Aubin Le Quéré/Matias method directly;
   - use open concreteness norms with attribution;
   - assign PERSON/GPE/ORG entities maximum concreteness 5;
   - retain forward-reference stopwords and pronouns;
   - expose unmatched-token coverage so low-confidence rows can be excluded or downweighted.

2. **Specificity density**
   - spaCy entities by type;
   - proper-noun token/sequence density;
   - numeric entities and validated quantity extraction;
   - date/time entities;
   - place candidates corroborated by gazetteer/country data.

3. **Unresolved-reference structure**
   - demonstratives and pronouns with no plausible antecedent in the headline;
   - WH/question forms;
   - cataphoric openings;
   - generic noun frames such as `the reason`, `the thing`, `the truth` only as candidate cues;
   - listicle numeric frames as a separate packaging cue.

4. **Evidence surface features**
   - study/statistics/document/testimony/event surface type;
   - direct or indirect quote markers;
   - speech/attribution verbs near a person/org candidate;
   - official/document nouns near institutions;
   - quantity/date/place/person/org anchoring;
   - body-summary corroboration where present.

5. **Body-resolution features**
   - overlap between headline entities/content terms and body summary;
   - whether the body supplies who/what/where/when details absent from the headline;
   - missing body must be neutral, not a penalty;
   - LLM-generated cross-source story cells must be excluded or separately flagged.

### 6.2 LLM calibration/audit layer

Use the LLM where language interpretation matters. Do not ask it to bless regex output; ask it to classify meaningful categories on a stratified sample.

For curiosity-gap audits, sample across:

- current explicit-positive rows;
- low/mid/high concreteness;
- high/low entity density;
- high forward-reference density;
- questions;
- listicles;
- direct service headlines;
- random controls.

Useful labels:

- `clearly resolving` — headline itself supplies the central who/what;
- `topic-explicit question` — topic is clear, answer is in article; mild or no curiosity penalty depending on presentation;
- `withholding listicle` — topic clear, examples deliberately withheld;
- `vague forward-reference` — key referent missing;
- `teaser/sensational gap` — emotional promise plus missing information;
- `service/marketing fragment` — not primarily curiosity-gap;
- `unclear/provenance artefact` — Reddit/aggregator/summary artefacts.

For evidence audits, sample across:

- current evidence 0/1/2;
- body-only positive;
- direct quotes;
- named entities + quantities but no stock evidence phrase;
- research-formula rows;
- court/police/document rows;
- random controls.

Useful labels:

- no evidence surface;
- generic authority/evidence formula;
- typed evidence;
- anchored evidence;
- corroborated evidence detail;
- not applicable/opinion/service/content metadata.

Then fit small inspectable numerical models or calibrate feature weights against held-out labels. Validation should be split by source and ideally time so the model cannot memorise publisher phrasing.

### 6.3 Axis construction and nonlinear scaling

Do not use variance equalisation as a substitute for construct validity.

The evidence so far suggests three different axis shapes:

1. **Continuous information-density axes** — event clarity, context, time/place, quantities, concreteness/specificity. These can use continuous corpus-relative deviations with empirical shrinkage and caps.
2. **Sparse penalty axes** — sensational framing, explicit service capture, extreme teaser punctuation. Most sources cluster high because most headlines avoid the behaviour. These should be treated as penalty/outlier axes, not stretched into fake gradients.
3. **Continuous-but-asymmetric curiosity/evidence axes** — the underlying construct is continuous, but individual stock cues are sparse. The solution is better continuous measurement, not larger z-scores on rare regex hits.

A zero-inflated or hurdle interpretation may be appropriate for the restraint axes:

- most rows/sources have no offence;
- among offenders, measure frequency and severity;
- combine with empirical shrinkage rather than allowing a handful of rows to dominate small sources.

Do not transform mid-level concreteness into an ideal merely because the CTR literature finds an inverted-U click response. That is publisher attention optimisation, not reader-facing measurement.

---

## 7. Ingestion-time guessed tags

The library evidence supports only a cautious ingestion-decoration role.

Reasonable candidates:

- compromise entities already produced by the JS pipeline;
- compromise-dates output for explicit date-like expressions, stored as provisional date guesses;
- place candidates later validated in analysis against GeoNames/pycountry;
- quantity strings/entities as raw extracted text, not interpreted facts.

Rules:

- guessed tags must remain visibly provisional;
- they must not overwrite originator or LLM tags;
- they should not become hard filters;
- no Python-only quantitative/scoring dependency should be added to routine ingestion without a separate decision;
- pin versions and avoid the newly released compromise-dates 3.12.0 until it has been out long enough to assess.

---

## 8. Recommended next steps

1. **Build a small audit sheet, not implementation code.**
   - stratified curiosity sample of roughly 150–250 rows;
   - stratified evidence sample of roughly 150–250 rows;
   - include headline, body excerpt, current scores, new probe features and spaCy entity output.

2. **LLM-label the samples using the categories above.**
   - label the construct directly;
   - keep notes only where the decision depends on a distinction that heuristics cannot see.

3. **Measure feature separability.**
   - compare concreteness/entity/forward-reference/evidence features across LLM labels;
   - check source-level aggregation so one publisher style does not dominate.

4. **Only then implement the smallest numerical change.**
   - likely a continuous curiosity-risk feature and a multi-level evidence-specificity feature;
   - small inspectable calibration, not a transformer and not another regex pile.

5. **Regression-test interpretive cases.**
   Include cases such as:
   - `What is Pip?` — service explainer, not strong curiosity gap;
   - `What is happening?` — strong vague gap;
   - `The Duskbloods Is Officially Delayed Until 2027` — concrete event despite low lexicon coverage;
   - `Scientists Discover Why Microplastics Trigger Inflammation` — generic research claim, not high evidence specificity;
   - direct-quote testimony — evidence surface even without `study finds`;
   - court/institution/amount combinations — anchored documentary/legal evidence even without stock phrases.

---

## Bottom line

The research supports replacing binary stock-cue detectors with continuous, multi-signal measurement. The strongest validated component is headline concreteness, but it cannot carry curiosity-gap measurement alone. Evidence specificity should use the study/statistics/testimony/document/event typology and reward anchored combinations rather than isolated trigger phrases.

The practical lightweight stack is:

- spaCy `en_core_web_sm` for POS/lemma/entity candidates;
- open concreteness norms, using the validated method rather than the broken research package;
- GeoNames/pycountry for place validation;
- quantulum-style quantity extraction only with guards;
- compromise-dates only for optional ingestion-time guessed tags;
- LLM judgment for construct definition, calibration and audit.

The main thing not to do is train or adopt a black-box clickbait/evidence classifier and pretend it understands the corpus. The reliable path is slower but simpler: transparent candidate extraction, LLM-audited construct labels, small inspectable calibration, and explicit uncertainty.

The analysis should operate on the actual headline distributions, not a manually assembled list of suspicious phrases. In particular, I would combine linguistic features, statistical comparisons between publishers, and automated semantic classification.

I've inspected the headline files. The largest useful starting pools are:

| Publisher       | Headlines |
| --------------- | --------- |
| BBC             | 3,537     |
| Kotaku          | 671       |
| The Guardian    | 485       |
| Eurogamer       | 458       |
| Daily Mail      | 350       |
| Punch           | 348       |
| The Independent | 246       |
| Phys.org        | 190       |
| City A.M.       | 173       |
| Medical Xpress  | 127       |
| IGN             | 125       |
| Financial Times | 116       |

There is an interesting opportunity here: BBC and The Guardian give us large general-news baselines; Daily Mail and Punch give us different forms of commercial/tabloid publishing; Kotaku and Eurogamer give us entertainment-oriented specialist journalism; Phys.org and Medical Xpress give us science and research-oriented publishing.

These are useful contrasts, not assumed quality rankings.

I would also avoid using the BBC's much larger sample as an ordinary peer in every comparison. Statistical comparisons should account for sample size, publication category and subject mix.

## **1. What the Daily Mail actually looks like**

I ran a first-pass analysis using scikit-learn TF-IDF bigrams and NMF topic decomposition, alongside headline-level linguistic features.

The following are proportions of headlines, not subjective ratings.

Snapshot: 27 November 2026. Lexical feature detectors are exploratory, not trained quality classifiers.

| Signal                               | Daily Mail (350) | BBC (3,537) | Guardian (485) |
| ------------------------------------ | ---------------- | ----------- | -------------- |
| Teaser/reveal vocabulary             | 8.9%             | 1.8%        | 1.4%           |
| Sensational vocabulary               | 5.7%             | 2.0%        | 2.3%           |
| Entertainment/person-life vocabulary | 10.0%            | 3.1%        | 1.4%           |
| Explicit attribution cues            | 5.7%             | 10.3%       | 13.6%          |
| Question headlines                   | 2.0%             | 9.5%        | 7.4%           |
| Exclamation marks                    | 1.7%             | 0.1%        | 0.4%           |
| Ellipses                             | 1.1%             | 0.3%        | 0.2%           |

Some interesting comparisons:

| Signal                               | Independent | Mirror |
| ------------------------------------ | ----------- | ------ |
| Teaser/reveal vocabulary             | 5.3%        | 2.3%   |
| Sensational vocabulary               | 3.7%        | 9.0%   |
| Entertainment/person-life vocabulary | 10.2%       | 12.8%  |
| Explicit attribution cues            | 11.0%       | 3.0%   |

Three observations:

**The Daily Mail is substantially more teaser-oriented than the BBC and Guardian.** But it doesn't rely particularly heavily on questions. Its style is more declarative, personal and suggestive.

**The Mirror is actually more sensational by the initial vocabulary measure.** That is an important distinction between different forms of tabloid behaviour.

**The Independent has a similar entertainment-content signature to the Daily Mail.** So entertainment concentration alone cannot distinguish quality.

There is also an important false-positive: Phys.org scores 11.6% on my broad teaser/reveal detector, partly because scientific headlines regularly say research "reveals" something. This is precisely why semantic classification needs to replace simplistic word counting.

## **2. The interesting combinations**

These are more revealing than individual words.

In the Daily Mail sample, I found recurring patterns such as:

| Pattern                            | Actual headline example                                                | What it signals                          |
| ---------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| Person + reveals + personal detail | Jennifer Lopez reveals son Max, 18, doesn't like her sexy stage looks  | Celebrity intimacy                       |
| Person + shares + private moment   | Maya Jama shares a glimpse inside her Halloween bash                   | Personal-life content                    |
| Secret + family/relationships      | Rock legend's son was battling secret family chaos before death        | Personal intrigue                        |
| Direct address + curiosity gap     | UK zoo welcomes a new rare baby.... can YOU guess what the animal is?  | Audience manipulation                    |
| Teaser + speculation               | Here's a BIG CLUE Barry Keoghan could be his Bond villain              | Suspense without substantive information |
| Sensational diagnosis              | World famous TV sommelier dies aged 46 after shock diagnosis           | Emotional amplification                  |
| First-person + commercial interest | I've found Princess Kate's best fashion looks in the Black Friday sale | Personality-led commercial content       |

I would call the first three related patterns **parasocial personal-life framing**.

That is a particularly useful concept because it captures something that generic clickbait detection misses: the systematic conversion of people's private lives, relationships, appearance and family circumstances into attention-generating content.

A celebrity name alone isn't the problem.

A celebrity name combined with a personal-life frame, a revelation verb, and little public-interest substance is much more informative.

## **3. What the unsupervised topic analysis found**

The Daily Mail's 350 headlines were also passed through TF-IDF and an NMF topic model.

It identified recurring clusters around:

- Celebrity revelations, personal relationships, children and family.
- Russell Brand, associated allegations, relationships and scandal.
- Crime, accusations, arrests and court proceedings.
- Death, violence, domestic incidents and human-interest stories.
- UK politics, personalities and political conflict.
- Lifestyle, consumer stories and unusual incidents.

The clusters are not perfectly separated, but they demonstrate something important: the publisher's headline corpus has identifiable recurring thematic and linguistic signatures.

For example, `reveals`, `actress`, `love`, `child`, `ex` and `son` emerge together in one cluster. That's more interesting than simply observing that the word "reveals" occurs frequently.

It suggests we can learn recurring story templates and content frames directly from a publisher's output.

This is where I'd invest more heavily in topic modelling and semantic clustering.

## **4. The actual feature model I'd use**

I'd make a distinction between eight families of measurements.

**A. Attention-harvesting language**

Curiosity gaps, unresolved promises, direct address, personalisation, urgency, imperative phrasing, withholding of essential information.

Examples: "Here's what happened", "Can YOU guess?", "The truth about...", "You won't believe..."

**B. Personal-life and celebrity concentration**

Named-person density, entity types, celebrity status, private-life framing, relationship content, appearance, lifestyle, wealth and family.

Particularly interesting combinations: PERSON + REVEALS + PERSONAL DETAIL; PERSON + SECRET + RELATIONSHIP.

**C. Emotional manipulation**

Emotional valence, arousal, sentiment extremity, hyperbole, dramatic adjectives, emotive verbs, outrage framing and fear amplification.

This should use an emotion/sentiment model, not just a dictionary of words like "horror" and "shocking".

**D. Informational density**

Specificity of subjects, events, actions, dates, locations and quantities; number of distinct factual propositions; proportion of informative content to packaging.

Distinguishes "Something terrible happened" from an actual description of what happened.

**E. Attribution and evidential language**

Explicit named sources, unnamed sources, institutions, documents, studies, witnesses, claims, allegations, hedging and assertions of certainty.

Crucially, the body text can reveal whether attribution represents independent reporting or merely repetition of an interested party's account.

**F. Originality and repetition**

Near-duplicate headlines, recurring story templates, cross-publisher similarity, wire-copy reuse, press-release reuse and derivative reporting.

**G. Editorial framing**

Blame assignment, agency, loaded descriptions, polarisation, moral judgement, selection of protagonists, emphasis on conflict and presentation of opinion as fact.

**H. Depth and explanatory value**

Context, causal explanations, historical background, competing perspectives, evidence, source diversity, and whether the article contributes anything beyond the announcement it reports.

An important additional measurement is **micro-focus versus macro-focus**.

For example, a political story can be presented as:

- What a government policy means for millions of people.
- What a particular politician said about another politician.
- A personality clash between two politicians.
- A politician's private life.

All four might concern exactly the same underlying event.

A model that can identify this framing distinction would be quite useful in differentiating public-interest reporting from personality-driven coverage.

## **5. Prior art worth incorporating**

There is considerably more relevant research than just clickbait classification.

**Clickbait detection**

Webis-Clickbait-17 contains 38,517 posts associated with 27 major US publishers, annotated on a four-point clickbait scale. Useful as a starting training corpus, although it concerns social posts rather than exclusively article headlines.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://webis.de\&sz=32)

webis.de



**Sensationalism detection**

SENS-HEAD is particularly relevant. It describes over 30,000 annotated headlines and incorporates sentiment polarity, syntactic complexity, punctuation distribution and stopword ratios. Its reported balanced F1 is 0.66. It explicitly targets sensationalism rather than clickbait alone.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.bjmas.org\&sz=32)

bjmas.org



**Hyperpartisan and ideological language**

A 2025 systematic review covers 81 studies and discusses stylistic, topical, lexical, semantic and sentiment-based approaches. It also highlights the lack of standardised definitions, which is important when deciding what constitutes biased versus merely opinionated writing.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://pmc.ncbi.nlm.nih.gov\&sz=32)

PMC



**Churnalism and textual reuse**

Tom Nicholls' 2019 paper, *Detecting Textual Reuse in News Stories, at Scale*, is particularly relevant. It uses n-gram shingling to distinguish newswire material, press-release material, source-to-source copying and incidental overlap. This is a direct precedent for mechanically measuring originality.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://ijoc.org\&sz=32)

International Journal of Communication



**Source attribution**

Spangher et al.'s 2023 EMNLP paper, *Identifying Informational Sources in News Articles*, is another excellent fit. It identifies 16 categories of informational sources, including forms of sourcing beyond straightforward quotations. Its dataset contains 28,000 source attributions across 1,304 articles, and its GPT-3 approach achieved 83% attribution accuracy.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://aclanthology.org\&sz=32)

ACL Anthology



**News quality**

A study of 1,500 public-affairs articles and more than 7,800 news consumers found that believability, depth and diversity were stronger predictors of perceived article quality than superficial linguistic characteristics. Bylines, sources, subjective expressions and article similarity also mattered.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://doi.org\&sz=32)

DOI



This last finding is particularly important. It suggests that stylistic quality and substantive journalistic quality need separate measurements.

## **6. How I'd combine the actual machine techniques**

I wouldn't build this as one classifier.

I'd use a hybrid of four different kinds of analysis:

| Technology         | Main job                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| spaCy              | POS tagging, dependency parsing, named entities, grammatical constructions                                                                |
| scikit-learn       | TF-IDF, bigram/trigram analysis, NMF, clustering, similarity, regression and outlier detection                                            |
| Transformer models | Semantic similarity, emotional tone, claim classification, topic classification and headline/body consistency                             |
| LLM classification | Context-sensitive classification of story focus, personal-life framing, informational value, attribution quality and editorial techniques |

The important distinction is that the LLM should be doing semantic work that a conventional NLP pipeline cannot reliably do.

For example, given a headline, the classifier could establish:

- Is the main subject a celebrity, politician, institution, ordinary individual, company or scientific discovery?
- Is the subject's private life or public activity the focus?
- Is the story primarily informative, entertaining, promotional, speculative or personality-driven?
- Does the headline actually tell us what happened?
- Does it withhold information to generate curiosity?
- Does the emotional intensity seem proportionate to the reported event?

These aren't merely keyword matches.

They are structured semantic judgements which can then be aggregated statistically across publishers.

I'd also use embeddings for grouping related headlines before measuring patterns. This prevents the same underlying story appearing 40 times from distorting a publisher's linguistic profile.

## **7. The metric that I think is especially interesting**

I would experiment with an **attention-to-information ratio**.

The underlying idea:

**Attention intensity**

Curiosity gaps + emotional amplification + personalisation + celebrity/private-life framing + sensational presentation.

**Informational substance**

Specificity + factual content + transparent attribution + original reporting + context + explanatory depth.

**The interesting combination**

High attention intensity, low informational substance.

This is a much better candidate for identifying consistently low-value editorial output than clickbait detection alone.

It would also allow useful distinctions:

- High attention, high substance: genuinely significant breaking news.
- Low attention, high substance: understated but excellent reporting.
- High attention, low substance: attention harvesting.
- Low attention, low substance: potentially formulaic or uninformative content.

These are meaningful differences.

The score should be adjusted for subject matter: celebrity coverage, sport, science, financial reporting and political journalism have naturally different linguistic signatures.

One last technical point: the ZIP you supplied contains headline strings, not the underlying article bodies. That limits the present analysis to headline-level behaviour. The summary/body text you mentioned would unlock the most valuable additional measures: original-source attribution, actual evidence density, press-release dependence, headline/body semantic agreement and explanatory depth.

**My main conclusion from this first pass:** Daily Mail's distinctive issue isn't simply clickbait. It is the combination of parasocial personal-life coverage, revelation-style packaging, emotional framing and comparatively weak visible attribution in headlines. That's a much more interesting target for a computational quality model.

My view is that this is fundamentally a problem of **inferring editorial quality and information integrity from observable publishing behaviour**.

I would not approach it as conventional media-bias classification, nor as a general-purpose fake-news classifier. Both are too narrow.

There are several things I think are important.

### **1. Trustworthiness is partly observable in the writing itself**

A publisher reveals quite a lot about its editorial priorities through its output:

- What it chooses to cover.
- What it chooses to emphasise.
- How it describes people and events.
- How much information it actually communicates.
- Whether it distinguishes facts, allegations, interpretations and speculation.
- Whether it introduces original information.
- How it uses other people's reporting.
- Whether its headlines accurately represent its articles.
- Whether it provides context or manufactures drama.

These are observable behaviours. They don't require us to know anything about the publisher's reputation, ownership or political affiliations.

They also accumulate into recognisable institutional signatures.

### **2. The important distinction is between linguistic signals and editorial constructs**

This is where I think modern NLP and LLMs become particularly useful.

Consider three different measurements:

- Frequency of emotionally charged vocabulary.
- Frequency of emotional language in headlines relative to the underlying event.
- Frequency of emotionally charged framing in articles that contribute little substantive information.

These are increasingly sophisticated measurements of essentially the same phenomenon.

The first is lexical. The second is contextual. The third approaches an editorial-quality judgement.

The same progression applies to nearly everything:

| Surface signal             | Deeper editorial construct                            |
| -------------------------- | ----------------------------------------------------- |
| Celebrity names            | Personality-driven editorial selection                |
| Revelation verbs           | Manufactured curiosity                                |
| Emotional vocabulary       | Disproportionate emotional framing                    |
| Repeated n-grams           | Formulaic content production                          |
| Similar article embeddings | Derivative reporting                                  |
| Vague attribution          | Weak evidential accountability                        |
| High entity density        | Potentially high specificity, or simply name-dropping |
| Short summaries            | Potentially low informational value                   |
| Hedging language           | Appropriate uncertainty, or evasiveness               |
| Assertive language         | Appropriate confidence, or unsupported certainty      |

The deeper constructs are much more valuable than the surface indicators.

### **3. The unit of analysis matters enormously**

An individual headline is a poor basis for judging a publisher.

A hundred headlines start revealing editorial habits. A thousand can reveal much more about topic selection, stylistic conventions, recurring narrative structures and content-production patterns.

But even then, subject matter matters.

A football publisher will have a high concentration of named individuals. A science publisher will have technical terminology. A financial publisher will discuss companies, markets and executives.

The interesting measurement is not simply how frequently these characteristics occur, but how they behave relative to what would reasonably be expected for that kind of publication and subject.

This is where conditional comparisons and learned baselines become important.

### **4. I would be particularly interested in measuring information value**

This is arguably the most interesting dimension.

A story can be perfectly accurate, grammatically competent and completely devoid of useful information.

Conversely, a dramatic headline can introduce a genuinely important investigation.

I think a good assessment needs to distinguish:

- Information communicated.
- Information withheld.
- Information newly contributed.
- Information repeated.
- Information contextualised.
- Information supported by evidence.

An important distinction is between *reporting something that happened* and *providing readers with meaningful knowledge about what happened*.

That is a much richer question than clickbait detection.

### **5. LLMs change the nature of the problem**

I wouldn't restrict this to traditional NLP classifiers.

An LLM can make contextual judgements about framing, originality, relevance, evidential language, information density and the relationship between a headline and its article.

Embeddings, clustering and conventional statistical techniques provide complementary measurements of recurrence, similarity, distributions and deviations.

The interesting part is bringing those observations together without treating any one of them as ground truth.

There is also a distinction between detecting an editorial behaviour and establishing its consequences. An LLM can identify speculative framing; establishing whether the speculation was actually wrong requires evidence outside the language itself.

That distinction matters.

### **6. My overall position**

I think the most fruitful way to think about this is as an empirical study of **how publishers manufacture, select, package, substantiate and communicate information**.

Trustworthiness is not a directly observable linguistic property. But many of the behaviours that make a publisher more or less trustworthy are observable, measurable and comparable.

And importantly, some of these behaviours are considerably more revealing in combination than individually.

A publisher might be:

- Highly sensational but factually accurate.
- Politically partisan but evidentially rigorous.
- Commercially motivated but competent.
- Original but careless.
- Accurate but almost entirely derivative.
- Formally neutral but systematically misleading through selection and omission.

These distinctions are why I would be interested in constructing a rich behavioural profile rather than training a classifier to predict whether a source is trustworthy.

**The ultimate question isn't whether a publisher sounds trustworthy. It's what kind of information-producing organisation its actual output reveals it to be.**

The key is to turn each editorial behaviour into a measurable variable, using several levels of NLP rather than trying to classify whole publishers directly.

I'd approach this as a combination of **automated linguistic measurement, semantic annotation, comparative corpus analysis and statistical publisher profiling**.

There is quite a lot of usable prior art, including some genuinely interesting 2026 work.

## **1. What actually gets measured**

I'd distinguish the measurement methods by the kind of evidence they need.

| Property               | Machine measurement                                                                  | Useful output               |
| ---------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| Clickbait              | Ordinal classification of attention-harvesting techniques                            | Clickbait intensity         |
| Sensationalism         | Emotion, arousal, intensity and framing classification                               | Sensationalism residual     |
| Celebrity fixation     | Entity recognition, entity linking, semantic classification of personal-life framing | Personal-life concentration |
| Churnalism             | Textual reuse, semantic similarity, source attribution and originality analysis      | Reuse/originality rate      |
| Content farming        | Template recurrence, topic repetition, information novelty, output frequency         | Formulaicity                |
| Speculation            | Claim extraction, epistemic modality, attribution and evidential support             | Speculation rate            |
| Attribution laundering | Source identification, entity resolution, attribution-chain extraction               | Source transparency         |
| Headline distortion    | Headline/body entailment and factual-claim comparison                                | Headline fidelity           |
| Informational value    | Claim density, novelty, context, explanatory relations                               | Information density         |
| Editorial framing      | Actor, action, sentiment, agency and perspective extraction                          | Framing distribution        |
| Editorial independence | Source diversity, interested-party dependence, reuse, promotional provenance         | Independence indicators     |
| Subject competence     | Technical specificity, explanatory depth, source expertise and contextual accuracy   | Domain-specific competence  |

These are measurements, not predetermined judgements about whether a publication is good.

## **2. The NLP techniques that make this possible**

There are several particularly valuable techniques that can be combined.

### **A. Dependency parsing and grammatical pattern extraction**

spaCy is useful here, but the important capability isn't simply POS tagging.

Dependency parsing allows us to identify grammatical relationships and recurring constructions.

For example:

- PERSON reveals DETAIL.
- PERSON shares DETAIL.
- PERSON admits DETAIL.
- PERSON exposed for ACTION.
- What happened to PERSON?
- Why PERSON is facing BACKLASH.
- X sparks FURY over Y.
- X's SECRET relationship with Y.

These are different editorial constructions even when the vocabulary changes.

A parser can extract grammatical structures and slot their entities into common templates. Clustering those templates across thousands of headlines reveals a publisher's preferred narrative constructions.

I'd also use relation extraction and semantic embeddings because syntactically different sentences often perform the same editorial function.

For example:

> Celebrity reveals why she will never return.

> Star opens up about the truth behind her departure.

The important similarity isn't their shared vocabulary. It's the rhetorical function: personal revelation and a withheld explanation.

### **B. Semantic classification**

This is where LLMs and modern encoder models become particularly valuable.

Instead of assigning one class to a headline, extract multiple independent annotations.

For example:

**Illustrative semantic annotation**

Headline: "TV star reveals shocking secret behind dramatic marriage split"

| Attribute                    | Classification                |
| ---------------------------- | ----------------------------- |
| Primary subject              | Celebrity                     |
| Story category               | Entertainment / personal life |
| Main narrative frame         | Personal revelation           |
| Attention technique          | Curiosity gap                 |
| Emotional framing            | High                          |
| Specific factual information | Low                           |
| Public-interest relevance    | Unclear                       |
| Speculation                  | Not established               |
| Source attribution           | None visible                  |
| Headline completeness        | Low                           |

Illustrative annotations, not an actual model prediction.

The model can return continuous values, categorical labels, confidence estimates and evidence spans.

This matters because otherwise a classifier tends to reduce quite different behaviours to the same generic category.

A useful distinction is between:

- What the headline says.
- How it says it.
- What it implies.
- What information it actually communicates.

### **C. Embeddings and unsupervised discovery**

This is particularly useful for discovering patterns that haven't been explicitly defined.

Transform each headline into an embedding, then analyse:

- Semantic clusters.
- Cluster concentration by publisher.
- Recurring narrative structures.
- Unusual language relative to other publishers.
- Changes in editorial style over time.
- Combinations of concepts associated with low-value stories.

TF-IDF and NMF are useful for interpretable vocabulary and topic discovery; sentence embeddings and clustering capture more semantic equivalence.

The interesting part is that the clusters can subsequently be passed to an LLM for descriptions and classification.

This avoids having to enumerate every possible way of saying something.

## **3. Measuring the individual properties in more depth**

The biggest gains come from looking beyond headline vocabulary.

**Clickbait and attention harvesting**

The Webis Clickbait Corpus 2017 is an established starting point. It contains 38,517 annotated posts, with five annotators assigning a four-level clickbait intensity score. It includes publishers and the linked article content, although its original task is social-media clickbait, not a complete measure of editorial quality.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://webis.de\&sz=32)

webis.de+1



The useful extensions are:

- Curiosity-gap detection.
- Unresolved entity or event references.
- Personal address and imperatives.
- Information withholding.
- Exaggerated promises.
- Headline/body discrepancy.
- Attention intensity relative to informational content.

I'd specifically measure whether the headline's central promise is fulfilled by the article.

**Sensationalism**

SENS-HEAD is relevant prior art here. Its published framework uses linguistic and semantic features, including sentiment, syntactic complexity and punctuation. It reports balanced F1 of 0.66, so it is a starting point rather than a sufficiently reliable final judgement.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.bjmas.org\&sz=32)

bjmas.org



More interesting is contextual sensationalism.

A headline about a terrorist attack naturally has different emotional content from one about a new mobile phone.

What matters is the deviation from expected language given the subject and event.

**Churnalism and originality**

This is one of the most technically tractable properties.

Nicholls' *Detecting Textual Reuse in News Stories, at Scale* uses n-gram shingling to identify newswire reuse, press-release material, copying between publishers and incidental textual overlap.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://ijoc.org\&sz=32)

International Journal of Communication



I'd extend this with semantic similarity:

1. Identify candidate matching articles through MinHash and locality-sensitive hashing.
2. Compare their paragraphs and factual claims.
3. Determine whether the match is direct copying, paraphrasing or common reporting of the same event.
4. Establish publication sequence.
5. Identify attribution and provenance.
6. Measure the amount of novel reporting introduced.

This gives a much more interesting measure than simply counting similar articles.

An article that reproduces 80% of a wire report with attribution is different from one that reproduces 80% of a competitor's article while presenting itself as original reporting.

**Attribution and sourcing**

There is good research here too.

Spangher et al. developed a dataset and models for identifying informational sources in news articles, published at EMNLP 2023. It addresses source identification and the combinations of sources used in reporting.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://aclanthology.org\&sz=32)

ACL Anthology



The relevant measurements include:

- Named versus anonymous sources.
- Primary versus secondary sources.
- Institutional versus individual sources.
- Expert versus interested-party sources.
- Direct versus indirect attribution.
- Number of distinct independent sources.
- Repeated dependence on a single originating source.
- Attribution-chain depth.

There is an important 2026 development worth noting: a March 2026 benchmark tested 13 LLMs on journalistic source extraction. Models generally performed reasonably well at extracting source names and types, but source justification remained much harder, with the best model scoring only 56.17%.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.scu.edu\&sz=32)

Markkula Center for Applied Ethics



That makes structured extraction viable, but it cautions against treating an LLM's explanation of why a journalist used a source as established fact.

**Headline/body fidelity**

This is another well-developed area.

ExHalder is a headline-hallucination detection framework that compares article content with headline claims. Its evaluation included more than 6,000 labelled headline/article pairs.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://research.google\&sz=32)

Google Research



I'd measure:

- Percentage of headline propositions supported by the body.
- Contradictory propositions.
- Claims made more strongly in the headline than in the article.
- Missing qualifications.
- Material omitted context.
- Unsupported causal relationships.
- Headline implications not actually established.

This can be measured using natural-language inference models, followed by structured LLM examination of borderline cases.

**Informational depth and quality**

This is where I would move away from conventional text metrics altogether.

Extract factual propositions and classify them into:

- New event information.
- Historical context.
- Causal explanations.
- Consequences.
- Quantitative evidence.
- Supporting documentation.
- Competing explanations.
- Independently obtained information.

Then measure the contribution of each article relative to other articles about the same event.

A 1,000-word article that merely elaborates on one press release may have less informational value than a 300-word article containing genuinely new findings.

A 2020 study of 1,500 public-affairs articles and more than 7,800 readers found that believability, depth and diversity were more influential predictors of perceived news quality than readability, factuality and sensationalism.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://doi.org\&sz=32)

DOI



That is a useful reason to treat depth as its own measurement.

## **4. Publisher-level measurement: the important statistical part**

The measurements above produce article-level observations.

The interesting question is how to turn thousands of observations into defensible comparisons between publishers.

I would use hierarchical statistical models rather than raw percentages.

For example, consider sensationalism:

\\[ S_i = f(\text{topic},\text{genre},\text{event severity}, \text{article format},\text{publisher}) \\]

The model estimates the expected sensationalism given the subject and format, and then measures each publisher's residual.

A publisher producing unusually sensational headlines about routine consumer news would therefore be distinguished from one producing equally dramatic headlines about major disasters.

The same principle applies to celebrity concentration, speculation, attribution, information density and other measures.

A mixed-effects model is particularly useful:

\\[ \operatorname{logit}(P(y_i=1)) = \beta_0 + \beta_1 X_i + u\_{\text{publisher}} + u\_{\text{topic}} + u\_{\text{genre}} \\]

Here, \\(u\_{\text{publisher}}\\) estimates the publisher-specific effect after accounting for differences in subject matter and format.

Partial pooling is useful because publishers with very few articles shouldn't acquire extreme scores from small samples.

I'd also calculate topic-specific publisher profiles. A source can behave quite differently in politics, science, entertainment and business.

## **5. An important development in 2026**

There is a particularly relevant recent paper:

**The Media Bias Detector: A Framework for Annotating and Analyzing the News**, published in *Science Advances* in September 2026.

It combines LLM-based annotation and near-real-time news collection, extracting structured information including political lean, tone, topics, article type and major events.

It analyses material at sentence, article and publisher level, with a dataset of more than 140,000 articles from ten publishers.

Importantly, the authors validate model annotations against independently annotated samples, including testing human–model agreement.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://pmc.ncbi.nlm.nih.gov\&sz=32)

PubMed Central (PMC)+1



This is very close to the computational direction relevant here, although its principal focus is media bias and framing rather than the wider set of editorial-quality measures we're discussing.

The important precedent is that LLM-derived semantic annotations can be aggregated into longitudinal publisher-level measurements.

## **6. What makes this particularly interesting**

The individual metrics become much more revealing when treated as interacting variables.

Consider these combinations:

| Combination                                                            | Behaviour being measured                       |
| ---------------------------------------------------------------------- | ---------------------------------------------- |
| Celebrity concentration + private-life framing + curiosity gaps        | Parasocial attention harvesting                |
| High emotional intensity + low information density                     | Sensationalisation without substantive payload |
| High article volume + high template repetition + low novelty           | Content farming                                |
| High source repetition + low original information + weak attribution   | Derivative journalism                          |
| Strong headline claims + weak body support                             | Headline distortion                            |
| Strong assertions + speculative evidence + vague attribution           | Evidential overstatement                       |
| High topic concentration + disproportionate attention to personalities | Personality-led editorial selection            |
| High institutional-source concentration + low source diversity         | Potential institutional dependence             |

These combinations can be discovered statistically, too. Feature interactions, cluster analysis and correlation networks can reveal patterns that weren't explicitly designed into the taxonomy.

I would retain both the individual measurements and the discovered combinations. Otherwise, a single aggregate score hides the reason a publisher is receiving a particular assessment.

**The central technical distinction is that the unit being classified is initially the article, but the object being characterised is the publisher's distribution of editorial behaviours.** That is what makes this a corpus-analysis problem rather than a collection of headline classifiers.

The research above establishes that several important pieces already exist: clickbait intensity, sensationalism, textual reuse, sourcing extraction and headline/body fidelity. The larger opportunity is measuring their interactions, controlling for topic and format, and extending them into information novelty, evidential quality and editorial behaviour.
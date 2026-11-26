---
title: News Taxonomy Options
source: https://chatgpt.com/c/6b07d600-c950-83eb-8faf-a5cfb48d92d0
---

# News Taxonomy Options

#### You:
i want to identify some news-based taxonomies for tagging/keywording news stories from an existing, mainstream, named corpus... what are my options? Like if I wanted to tell an LLM "Tag these 10 news stories with content/meaning keywords based off the [x] taxonomy." what are my options for x?

#### You:
I don't want to give the LLM the taxonomy in full... I want one most LLMs probably already know

#### ChatGPT:
<details>
<summary>Thought for 23 seconds</summary>

- Searching the web
- Searching 9 websites
- Searching 17 websites

I’m noting that Reuters labels such as `earn`, `crude`, and `trade` are strongly business-focused, while BBC’s broad categories are accessible but coarse. I’ll distinguish benchmark corpora from general-purpose news taxonomies and avoid treating them as interchangeable.

Clarified corpus fit

Searched 17 websites

</details>

There are several good options, but they fall into two quite different categories\:

1. **Industry-standard taxonomies\:** established, maintained classification systems intended to describe news content consistently across publishers.
2. **Publisher or corpus-specific taxonomies\:** categories, subjects and labels used by a particular news organisation or research dataset.

For your proposed use case - asking an LLM to assign meaningful, reusable keywords to a batch of stories - I'd investigate the first category first, particularly IPTC Media Topics.

## 1\. News-industry standard taxonomies

### A. IPTC Media Topics - strongest starting point

(Best overall fit)

IPTC Media Topics is probably the closest match to what you're describing.

- Approximately 1,394 controlled concepts.
- Hierarchical, with up to five levels of subject classification.
- Designed specifically to describe the subject matter of news stories.
- Maintained and updated by the International Press Telecommunications Council.
- Available in machine-readable formats including SKOS/RDF, Turtle, JSON-LD and NewsML-G2.
- Supports mappings to the older IPTC Subject Codes and, where possible, Wikidata concepts.

Examples of subject areas include politics, economics, crime, health, education, environment, arts, sport and technology, with more specific concepts underneath.

It is used by major news agencies, including Reuters, Associated Press and Agence France-Presse.

**Why it fits\:** You can give an LLM the taxonomy, ask it to select the most appropriate concepts for each story, and retain stable concept identifiers rather than generating arbitrary free-text keywords.

Resources\:

- [IPTC Media Topics overview](turn746629search0)
- [Browse or download the vocabulary](turn746629search5)
- [IPTC NewsCodes guidelines](turn746629search2)

### B. IPTC Subject Codes - predecessor

The original IPTC subject classification, developed in the 1990s.

It has roughly 1,400 terms organised into three hierarchical levels. It remains available, but IPTC stopped actively maintaining it in 2010 and recommends Media Topics as its replacement.

**Why consider it\:** Historical compatibility. Useful if you have an existing dataset already coded using this system, but I wouldn't choose it for a new project.

[IPTC Subject Codes](turn746629search6)

That changes the shortlist considerably. You're looking for a **named classification system that can act as a prompt-level reference**, relying on the model's pretrained knowledge rather than supplying its vocabulary.

I'd distinguish these options\:

## 1\. Best-known named news classification systems

| X                           | What it offers                                                                                                | Main limitation                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Reuters RCV1**            | 103 hierarchical news topic labels, across corporate/industrial, economics, government/social and markets     | Strongly business/economics-oriented                             |
| **Reuters-21578**           | Classic news classification benchmark, with 90 commonly used topic categories in its standard benchmark split | Old, heavily financial and commodity-oriented                    |
| **IPTC Media Topics**       | Industry-standard news subject taxonomy, with 1,200+ concepts and five levels of hierarchy                    | Less certain that an LLM knows its precise vocabulary            |
| **BBC News Classification** | Business, entertainment, politics, sport, technology                                                          | Only five very broad categories                                  |
| **AG News**                 | World, Sports, Business, Sci/Tech                                                                             | Very coarse classification                                       |
| **AP News Taxonomy**        | Professional publisher taxonomy covering subjects, events, people, organisations and places                   | Proprietary; less likely to be accurately recalled from training |

Sources:

## 2\. My actual recommendations

I'd shortlist three, depending on what you mean by keywords.

**IPTC Media Topics**

Best if you want a genuine news-industry subject classification. This is the one I'd choose for a professional tagging exercise, even though you cannot assume the LLM knows every term in it.

**Reuters RCV1**

Best if you specifically want a named, established news corpus and its associated classification scheme. It's particularly recognisable in NLP and document-classification literature. However, its historical business and financial orientation is a significant limitation.

**BBC News Classification**

Best if you want something almost any LLM can understand without much explanation. Very recognisable categories, but probably too shallow for meaningful semantic keywording.

## 3\. An important distinction for your prompting

There are actually three different kinds of labels you might want\:

| Label type        | Example                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Subject/topic     | Immigration, housing, inflation, healthcare                                              |
| Story angle/theme | Government failure, economic inequality, political controversy, technological disruption |
| News genre        | Investigation, analysis, opinion, breaking news, interview                               |

IPTC Media Topics is primarily designed for the first. Reuters is also primarily subject-oriented.

Neither is really designed to capture the second - which is often what people mean when they ask for *meaning-based* or *semantic* keywords.

## 4\. What I'd actually test

I'd run the same ten stories against these three instructions\:

- "Apply the IPTC Media Topics classification."
- "Apply the Reuters RCV1 topic classification."
- "Apply the BBC News classification scheme, extending its categories with relevant subtopics."

Ask for 5-10 tags per story, allowing multiple categories, and require the model to distinguish primary from secondary themes.

One caveat: a model recognising a taxonomy's name does not mean it reliably remembers its full controlled vocabulary. You should test whether it invents plausible-sounding labels.

**One question that would materially change my recommendation\:** Are you primarily trying to identify *what a story is about* \(e.g. immigration, climate change, taxation), or *what the story is saying about it* \(e.g. government incompetence, social division, economic decline)? Those lead to rather different taxonomies.


#### You:
i didn't ask for recommendations. I asked for the list of options. I dont want your opinion. BIG taxonomies only, ideally graph or heirarchical.

#### ChatGPT:
<details>
<summary>Thought for 91 seconds</summary>

- Searching the web
- Searching 8 websites

I’m assembling a broad, source-checked catalog of hierarchical taxonomies, ontologies, knowledge graphs, and labeled news datasets. I’ll distinguish topic systems from event schemas and general-purpose vocabularies without ranking or recommending them.

Mapped classification systems

I’m checking exact sizes, hierarchy types, and coverage for news taxonomies, labeled corpora, ontologies, and knowledge graphs, while separating genuine topic systems from event or advertising classifications.

Refined the catalog

I’m grouping the remaining options by function: news taxonomies, event schemas, knowledge graphs, library classifications, and domain thesauri. I’ll preserve concrete scale and relationship details only where they’re established.

I’m adding established labeled datasets, including MIND, Reuters collections, AG News, BBC News, HuffPost, and the New York Times corpus, while noting which provide hierarchy versus flat labels.

Organized candidate systems and compared news corpora

I’m checking primary documentation for AP, IPTC, Reuters, MIND, NYT, LCSH, Wikidata, and related systems, prioritizing official descriptions and distinguishing taxonomies from corpora or general knowledge graphs.

Verified named systems

I’m narrowing the list to large, named systems with substantial hierarchies or graphs, including publisher taxonomies, news corpora, knowledge graphs, library classifications, and domain thesauri—without ranking or recommending them.

Assembled the catalog

I’m narrowing the catalog to substantial, named taxonomies and graphs: AP, NYT, Guardian, IPTC, Wikipedia, Wikidata, LCSH, FAST, MeSH, EuroVoc, AGROVOC, GEMET, and major labeled news corpora.

I’m compiling large, named options without ranking them: publisher taxonomies, news standards, knowledge graphs, library classifications, domain thesauri, and corpora. I’m marking whether each is hierarchical, graph-based, or merely labeled.

I’m separating genuinely large systems from smaller but influential news labels: publisher taxonomies, IPTC, IAB, Wikipedia, Wikidata, LCSH, FAST, EuroVoc, MeSH, AGROVOC, GEMET, and event schemas like CAMEO.

I’m presenting only substantial systems: AP, NYT, Guardian, IPTC, IAB, Wikipedia, Wikidata, LCSH, FAST, EuroVoc, MeSH, AGROVOC, GEMET, and CAMEO, while excluding small benchmark label sets such as AG News and BBC News.

Filtered and consolidated large system options

Searched 50 websites

</details>

Understood. Below is a broader inventory, restricted to substantial, established taxonomies, thesauri, ontologies and classification graphs. I've separated news-publisher systems from general-purpose knowledge structures that can be applied to news.

## 1\. News-publisher and news-industry taxonomies

| Taxonomy                                       | Approximate scale                                    | Structure and coverage                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **AP News Taxonomy**                           | 200,000+ terms                                       | Hierarchical subjects, events, people, organisations, companies and geography; semantic relationships    |
| **New York Times Semantic API / Times Topics** | 100,000+ concepts                                    | Subjects, people, places, organisations; linked concepts and taxonomic relationships                     |
| **The Guardian Tags**                          | 50,000+ tags                                         | Publisher-assigned content keywords, subjects, entities and hierarchical tag paths                       |
| **IPTC Media Topics**                          | 1,200+ concepts                                      | Five-level hierarchical news subject taxonomy                                                            |
| **IAB Tech Lab Content Taxonomy 3.0**          | 1,500+ categories                                    | Hierarchical content classification, including news, video, podcasts and other media                     |
| **BBC Ontologies**                             | Multiple domain ontologies                           | RDF/linked-data models for subjects, people, organisations, places, sports, education and creative works |
| **Reuters RCV1 / RCV2 classification**         | 103 topic labels, plus industry and region code sets | Newswire classification; topic and industry hierarchies                                                  |

Sources\:

- [AP News Taxonomy](turn886906search1) · [NYT Semantic API](turn596588search4) · [Guardian Open Platform](turn455043search0)
- [IPTC Media Topics](turn886906search2) · [IAB Content Taxonomy](turn455043search1)
- [BBC Ontologies](turn455043search7) · [Reuters RCV1](turn493507search112)

## 2\. General-purpose knowledge graphs and category hierarchies

These are not specifically news taxonomies, but provide large, established semantic structures.

| Taxonomy / knowledge system                           | Approximate scale                                             | Structure                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Wikipedia Category System**                         | 2.2 million categories                                        | Directed category graph; hierarchical and associative links              |
| **Wikidata**                                          | Very large knowledge graph                                    | Entity graph; `instance of`, `subclass of`, properties and relationships |
| **DBpedia Ontology**                                  | 768 classes; millions of instances                            | Class hierarchy and directed acyclic graph                               |
| **Library of Congress Subject Headings (LCSH)**       | 390,000+ authority records                                    | Hierarchical subject headings, broader/narrower and related terms        |
| **FAST (Faceted Application of Subject Terminology)** | 1.7 million headings                                          | Faceted subject classification, derived from LCSH                        |
| **Dewey Decimal Classification (DDC)**                | 1,000 published summary classes, much more detailed schedules | Hierarchical knowledge classification                                    |
| **Universal Decimal Classification (UDC)**            | Large multilingual classification system                      | Hierarchical and faceted classification                                  |

Sources:

## 3\. Large international subject thesauri

| Taxonomy                            | Approximate scale                | Coverage                                                                                |
| ----------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| **EuroVoc**                         | Thousands of concepts            | Politics, government, international relations, economics, law, society and EU affairs   |
| **UNESCO Thesaurus**                | 4,500 concepts                   | Education, culture, science, technology, politics, economics, society and communication |
| **Medical Subject Headings (MeSH)** | Tens of thousands of descriptors | Medicine, diseases, healthcare, biology and public health                               |
| **AGROVOC**                         | 41,000+ concepts                 | Agriculture, food, nutrition, environment, fisheries and biology                        |
| **GEMET**                           | Thousands of descriptors         | Environment, ecology, climate, pollution, sustainability and natural resources          |
| **OECD Macrothesaurus**             | Multidisciplinary thesaurus      | Economics, development, public policy, employment, finance and social affairs           |

Sources:

## 4\. Event and interaction classification systems

These classify what happens, rather than simply what a story is about.

| Taxonomy                                              | Structure                               | Coverage                                                                                          |
| ----------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **CAMEO (Conflict and Mediation Event Observations)** | Three-level hierarchical event codes    | Conflict, cooperation, diplomacy, threats, protests, sanctions, agreements and other interactions |
| **GDELT Event Codes**                                 | Uses CAMEO event taxonomy               | Events extracted from international news coverage                                                 |
| **ICEWS Event Codes**                                 | Uses CAMEO-derived event classification | Political events, international relations, conflict and cooperation                               |

Sources:

## 5\. Corpus-specific classification schemes

For completeness, these are named datasets whose original article labels can also serve as references\:

| Corpus                        | Classification structure         |
| ----------------------------- | -------------------------------- |
| Reuters RCV1                  | Topic, industry and region codes |
| Reuters-21578                 | Newswire topic categories        |
| Microsoft News Dataset (MIND) | 18 categories, 242 subcategories |
| BBC News dataset              | Editorial categories             |
| AG News                       | Four top-level categories        |

Sources:

---

## 6\. Direct reference links

These are the actual taxonomies, ontologies or browsing interfaces rather than descriptions of them.

| Name      | Resource                                                                               |
| --------- | -------------------------------------------------------------------------------------- |
| AP        | [AP Taxonomy](https://developer.ap.org/ap-taxonomy/)                                   |
| NYT       | [NYT Semantic API](https://developer.nytimes.com/docs/semantic-api-product/1/overview) |
| Guardian  | [Guardian API tags](https://open-platform.theguardian.com/documentation/)              |
| IPTC      | [IPTC Media Topics](https://cv.iptc.org/newscodes/mediatopic/)                         |
| IAB       | [IAB Content Taxonomy](https://iabtechlab.com/standards/content-taxonomy/)             |
| BBC       | [BBC Ontologies](https://iptc.org/thirdparty/bbc-ontologies/)                          |
| Wikipedia | [Wikipedia categories](https://en.wikipedia.org/wiki/Portal:Contents/Categories)       |
| Wikidata  | [Wikidata](https://www.wikidata.org/)                                                  |
| LCSH      | [Library of Congress Subject Headings](https://id.loc.gov/authorities/subjects.html)   |
| FAST      | [FAST](https://fast.oclc.org/)                                                         |
| EuroVoc   | [EuroVoc](https://eur-lex.europa.eu/browse/eurovoc.html)                               |
| UNESCO    | [UNESCO Thesaurus](https://vocabularies.unesco.org/browser/thesaurus/en/)              |
| MeSH      | [MeSH Browser](https://meshb.nlm.nih.gov/)                                             |
| AGROVOC   | [AGROVOC](https://www.fao.org/agrovoc/)                                                |
| GEMET     | [GEMET](https://www.eionet.europa.eu/gemet/en/)                                        |
| CAMEO     | [CAMEO codebook](https://eventdata.parusanalytics.com/data.dir/cameo.html)             |

**Structural distinction\:** AP, NYT and IPTC provide news-specific vocabularies; Wikipedia and Wikidata provide much larger general-purpose semantic structures; LCSH, FAST, EuroVoc and UNESCO provide established controlled subject vocabularies; CAMEO provides a classification of event types. These are different kinds of reference systems, even though all can be used to generate tags for news stories.


#### You:
has anyone in the mainstream tried to consolidate all of these?

#### You:
soft value of 'all'

#### ChatGPT:
<details>
<summary>Thought for 29 seconds</summary>

- Searching the web
- Searching 3 websites
- Searching 9 websites

I’m finding several serious interoperability efforts, but no universal master taxonomy. IPTC provides crosswalks, AP connects with IAB, Wikidata supplies shared identifiers, and newer news ontologies model relationships across systems without fully merging their vocabularies.

Assessed the landscape

I’m treating “all of these” as the wider ecosystem, not every vocabulary literally. The mainstream pattern is interoperability: crosswalks, shared identifiers, and ontology layers—useful bridges, but not one authoritative consolidated taxonomy.

Clarified broad consolidation scope

I’m narrowing this to established cross-vocabulary efforts. The closest examples are IPTC’s mappings, AP–IAB alignment, Wikidata links, and SKOS-based registries; they improve interoperability without creating one universal taxonomy.

I’m seeing four main approaches: publisher crosswalks, semantic-web hubs, vocabulary registries, and domain-specific metathesauri. They connect systems, but differences in scope and meaning prevent a single authoritative “master” taxonomy.

Identified closest matches and separated integration layers

Yes, broadly: IPTC, AP, Wikidata, SKOS, EU Vocabularies, and domain hubs have tried to connect major taxonomies. But these are crosswalks and linking layers—not one universal master taxonomy—because each system serves different purposes.

Searched 16 websites

</details>

Yes. There have been several mainstream attempts, but they generally take the form of **cross-taxonomy mappings, shared knowledge graphs and vocabulary hubs**, rather than merging everything into one universal hierarchy.

For the systems discussed above, the relevant initiatives are\:

## 1\. Direct consolidation and mapping initiatives

| Initiative                               | What it brings together                                                                 | Nature of consolidation                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **IPTC NewsCodes**                       | News-industry vocabularies, Media Topics, Subject Codes and external concept references | Common news metadata framework                    |
| **AP News Taxonomy / Metadata Services** | AP vocabularies and IAB Content Taxonomy                                                | Publisher taxonomy with explicit cross-mappings   |
| **Wikidata**                             | Concepts across subjects, organisations, people, places, events and domains             | Shared, linked knowledge graph                    |
| **AGROVOC Linked Data**                  | LCSH, DDC, EuroVoc, DBpedia and other vocabularies                                      | Cross-vocabulary mapping hub                      |
| **EU Vocabularies**                      | EuroVoc and numerous European institutional vocabularies                                | Central vocabulary registry with cross-references |
| **Finto / KOKO**                         | Multiple Finnish and international subject vocabularies and ontologies                  | Integrated ontology and vocabulary service        |

### 2\. The important distinction: these aren't complete unifications

- **IPTC\:** maintains over 200 separate news-media controlled vocabularies. It explicitly chose not to create one enormous vocabulary, instead separating subject, genre, geography and other concept types. Media Topics maps to the older Subject Codes and Wikidata.
- **AP\:** provides mappings between its news taxonomy and the IAB Content Taxonomy. It does not claim to consolidate all the library, research and general-purpose taxonomies listed above.
- **Wikidata\:** operates as a general-purpose linking graph, connecting concepts from different classification systems. IPTC explicitly describes it as a central reference point for semantic mapping.
- **AGROVOC\:** is a concrete example of a cross-taxonomy hub. Its current linked-data mappings include EuroVoc, LCSH, UNESCO Thesaurus, GEMET and STW, among others.
- **EU Vocabularies\:** provides a common registry, with machine-readable alignments between institutional vocabularies.

### 3\. The underlying interoperability standard

Two things are worth knowing\:

- **SKOS (W3C Simple Knowledge Organization System)\:** provides a standard representation for taxonomies and thesauri, including relationships between concepts and mappings between different vocabularies. [SKOS Reference](https://www.w3.org/TR/skos-reference/)\.
- **ISO 25964\:** the international standard for thesauri and interoperability between vocabularies. It explicitly addresses cross-vocabulary mapping and interoperability. [ISO 25964](https://www.iso.org/standard/53657.html)\.

SKOS supports mapping relationships such as\:

| Relationship   | Meaning                                |
| -------------- | -------------------------------------- |
| `exactMatch`   | Equivalent concept                     |
| `closeMatch`   | Similar but not necessarily equivalent |
| `broadMatch`   | Target is broader                      |
| `narrowMatch`  | Target is narrower                     |
| `relatedMatch` | Semantically related                   |

**So, historically and institutionally, there are genuine consolidation efforts.** They tend to preserve the original vocabularies and connect them through concept mappings, rather than replace them with one universal taxonomy.

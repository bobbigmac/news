#!/usr/bin/env python3
"""Title-only editorial-value signal analysis for source-headlines ZIP.

This is an exploratory corpus instrument, not a truth/accuracy detector. It
extracts title-level signals, adjusts publisher comparisons for inferred topic
mix, and writes story- and source-level tables plus an interactive radar.
"""
from __future__ import annotations
import argparse, re, zipfile, html, json, math, unicodedata
from pathlib import Path
from collections import Counter

import numpy as np
import pandas as pd
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS
from sklearn.decomposition import NMF
from sklearn.neighbors import NearestNeighbors
from sklearn.linear_model import Ridge
from sklearn.preprocessing import OneHotEncoder
from scipy.sparse import csr_matrix, hstack
from sklearn.feature_extraction.text import CountVectorizer
import plotly.graph_objects as go

DEFAULT_ZIP = Path(__file__).resolve().parent / 'source-headlines-2026-11-27.zip'

# Broad, deliberately explicit patterns. Every detector is a proxy and its
# precision/recall should be evaluated against a hand-labelled sample.
MONTHS = r"january|february|march|april|may|june|july|august|september|october|november|december"
DAYS = r"monday|tuesday|wednesday|thursday|friday|saturday|sunday"

EVENT_ACTIONS = re.compile(r"\b(?:announc\w*|approv\w*|reject\w*|resign\w*|win\w*|los\w*|die\w*|died|dead|kill\w*|arrest\w*|charg\w*|convict\w*|acquit\w*|launch\w*|open\w*|clos\w*|suspend\w*|ban\w*|sign\w*|bought|buy\w*|sold|sell\w*|fell|fall\w*|rose|ris\w*|increas\w*|decreas\w*|found|finds|find\w*|discover\w*|ruled|rules|order\w*|vot\w*|pass\w*|delay\w*|cut\w*|fir\w*|strik\w*|investigat\w*|publish\w*|releas\w*|unveil\w*|introduc\w*|remov\w*|add\w*|updat\w*|chang\w*|shut\w*|expand\w*|reduc\w*|withdraw\w*|oust\w*|appoint\w*|elect\w*|beat\w*|defeat\w*|earn\w*|sue\w*|settle\w*|plead\w*|warn\w*|attack\w*|invad\w*|agree\w*|reach\w*|break\w*|surge\w*|drop\w*|climb\w*|declin\w*|recover\w*|collaps\w*|rescu\w*|evacuat\w*|return\w*|confirm\w*|expos\w*|oust\w*|back\w*|scrap\w*|scrutin\w*|file\w*|settle\w*|plead\w*|acquir\w*|merg\w*|oust\w*|sack\w*|rescu\w*|evacu\w*|surviv\w*|injur\w*|wound\w*|kill\w*|attack\w*|bomb\w*|crash\w*|burn\w*|flood\w*|storm\w*|explode\w*|erupt\w*|strike\w*|shoot\w*|stab\w*|sentenc\w*|convict\w*|acquit\w*|indict\w*|prosecut\w*|plead\w*|appeal\w*|overturn\w*|uphold\w*|block\w*|clear\w*|approve\w*|reject\w*|pass\w*|enact\w*|repeal\w*|adopt\w*|launch\w*|release\w*|publish\w*|introduc\w*|roll\w* out|ship\w*|debut\w*|break\w*|set\w*|record\w*|top\w*|outperform\w*|underperform\w*)\b", re.I)

NUMERIC = re.compile(r"(?:\b\d+(?:[.,]\d+)?\s?(?:%|per cent|percent|million|billion|trillion|thousand|th|years?|months?|weeks?|days?|hours?|minutes?|people|cases|deaths|jobs|homes|miles|km|kg|\$|£|€|¥)|(?:\$|£|€|¥)\s?\d|\b\d{4}\b|\b\d+\s?(?:to|-)\s?\d+\b)", re.I)
TIME_PLACE = re.compile(rf"\b(?:{MONTHS}|{DAYS}|today|yesterday|tomorrow|tonight|this morning|this week|next week|last week|next year|last year|in \d{{4}}|by \d{{4}}|since \d{{4}}|during \d{{4}}|\d{{1,2}}(?:st|nd|rd|th)?\s+(?:{MONTHS})|(?:{MONTHS})\s+\d{{1,2}})\b", re.I)
CAUSAL = re.compile(r"\b(?:because|due to|as a result|resulting in|results? in|led to|leads? to|caused? by|causes?|trigger\w*|prompt\w*|driv\w*|fuel\w*|in response to|thanks to|which means|what it means|linked to|associated with|contribut\w* to|forces? .* to|means that)\b", re.I)
CONSEQUENCE = re.compile(r"\b(?:impact\w*|consequence\w*|affect\w*|threat\w*|risk\w*|cost\w*|damage\w*|benefit\w*|save\w*|kill\w*|injur\w*|death\w*|dead|fatalit\w*|job\w*|price\w*|bill\w*|wage\w*|tax\w*|spend\w*|fund\w*|profit\w*|loss\w*|harm\w*|boost\w*|cut\w*|reduc\w*|increase\w*|increased|rise\w*|rose|fall\w*|fell|drop\w*|dropped|declined|decreased|soared|plunged|grew|climbed|surge\w*|shortage\w*|crisis|outage\w*|delay\w*|disrupt\w*|expos\w*|ban\w*|restrict\w*|change\w*|shift\w*|force\w*|leave\w*|push\w*|put\w* at risk)\b", re.I)
EVIDENCE = re.compile(r"\b(?:study|research|researchers?|scientists?|data|figures?|statistics|survey|poll|analysis|analys\w*|report\w*|documents?|records?|filings?|court|judg\w*|ruling|audit|inquiry|investigation|investigat\w*|evidence|according to|based on|dataset|database|officials?|experts?|witness\w*|testimony|transcript\w*|review\w*|paper|journal|estimates?|measures?|findings?|finds?|shows?|says?|warns?|confirms?|admits?|tells?|announces?|claims?|reportedly|sources? say|internal memo|foi|freedom of information)\b", re.I)
ATTRIBUTION = re.compile(r"\b(?:according to|says?|said|tells?|told|warns?|warned|claims?|claimed|confirms?|confirmed|admits?|admitted|announces?|announced|estimates?|estimated|reports?|reported|sources? say|officials? say|police say|court heard|documents? show|data show)\b", re.I)
ANONYMOUS_SOURCE = re.compile(r"\b(?:anonymous source|unnamed source|sources? familiar with|people familiar with|insider says|insiders say|a source told|sources told|according to sources|sources close to|speaking on condition of anonymity)\b", re.I)
HARD_EVIDENCE = re.compile(r"\b(?:study|research|researchers?|scientists?|data|figures?|statistics|survey|poll|analysis|documents?|records?|filings?|court|judg\w*|ruling|audit|inquiry|investigation|evidence|dataset|database|testimony|transcript|paper|journal|internal memo|foi|freedom of information|court filing|official report|inspection report|trial records|clinical trial|peer.reviewed)\b", re.I)
CONTEXT = re.compile(r"\b(?:first time|for the first time|first ever|since|compared with|compared to|than|versus|vs\.?|record high|record low|highest|lowest|more than|less than|fewer than|over the past|in the past|over \d+ years|\d+ years ago|decade\w*|centur\w*|previously|earlier|historical|historic|history|longest|largest|smallest|fastest|slowest|again|return\w*|still|already|new record|all.time)\b", re.I)
PUBLIC_INTEREST = re.compile(r"\b(?:government|minister\w*|president|prime minister|parliament|congress|senate|court|judge|police|law\w*|policy|regulat\w*|election\w*|vote\w*|council|councillor|mayor|public|taxpayer\w*|health|nhs|hospital\w*|doctor\w*|patient\w*|school\w*|universit\w*|education|climate|carbon|environment|energy|econom\w*|inflation|interest rates|housing|rent\w*|mortgage\w*|jobs|employment|unemployment|war|conflict|military|defen[cs]e|border\w*|migration|asylum|rights|crime|security|infrastructure|transport|rail|airport\w*|water|food|poverty|inequalit\w*|public service\w*)\b", re.I)
ORIGINALITY = re.compile(r"\b(?:investigation|investigates?|exclusive|special report|our analysis|we found|documents? obtained|records? obtained|leaked documents?|internal memo|internal documents?|foi|freedom of information|first.hand account|on the ground|interview with|interviewed|original analysis|independent analysis|court filing|data obtained|dataset assembled|our reporting)\b", re.I)
EXPLANATORY = re.compile(r"\b(?:explained|explainer|analysis|guide to|the science behind|what (?:it|this|that|a new|the) means for|why .{1,75} matter\w*|how .{1,75} works|how .{1,55} affect\w*|what causes|what drives|what is behind|how it works|what the evidence says|(?:why|how|what|who) (?:is|are|does|do|did|has|have|can|could|would|will|should) |what happens now|what comes next|inside the (?:control room|laboratory|lab|factory|power station|hospital|courtroom|data centre|data center))\b", re.I)
BAIT = re.compile(r"(?:\b(?:can you guess|you won't believe|you won't expect|here's what|here is what|what you need to know|all you need to know|the one thing|the truth about|the secret of|secret behind|what happened to|find out why|take a look|big clue|here's why|here is why|what we know|what does it mean|what's really going on|is this the|could this be|do you remember|remember when|guess who|meet the|the (?:incredible|shocking|surprising|strange|weird|unexpected|bizarre)? ?reason|reason (?:why|you|they|it)|what they don't tell you|what nobody tells you|what no one tells you)\b|\b(?:YOU|YOUR)\b|\.\.\.|…)", re.I)
SENSATIONAL = re.compile(r"\b(?:shocking|shock|horror|horrific|terrifying|fury|furious|outrage|outrageous|bombshell|stunning|stuns|jaw.dropping|unbelievable|bizarre|brutal|chaos|nightmare|disaster|explosive|explodes|savage|slams|blasts|destroys|humiliat\w*|devastat\w*|heartbreak\w*|astonish\w*|sensational|scandal\w*|meltdown|erupts?|sickening|gruesome|horrifying|horrendous|bonkers|frenzy|panic|mayhem|crushing|rips into|tears into|under fire|sparks fury|sparks outrage|sex scandal|shameful|disgraceful)\b", re.I)
PERSONAL_LIFE = re.compile(r"\b(?:dating|relationship\w*|marriage|married|divorc\w*|affair\w*|girlfriend|boyfriend|husband|wife|ex.wife|ex.husband|son|daughter|children|kids|family|pregnan\w*|baby|babies|romance|breakup|split|love life|sex life|wedding|engaged|engagement|body|weight loss|weight gain|looks?|appearance|fashion|outfit|dress|bikini|flaunts?|poses?|snap\w*|rare photo|steps out|seen for the first time|opens up about|personal life|home life|inside .* home|holiday snaps|red carpet)\b", re.I)
CELEBRITY_CUE = re.compile(r"\b(?:celebrity|celebrit\w*|actor|actress|singer|model|reality star|tv star|hollywood star|pop star|rapper|influencer|footballer|royal|duchess|prince|princess|reality tv|showbiz|soap star|screen star|movie star|famous singer|famous actor)\b", re.I)
TEASER_VERBS = re.compile(r"\b(?:reveals?|opens up|shares?|admits?|confesses?|breaks silence|speaks out|teases?|hints?|spills?|unpacks?)\b", re.I)

# Evidence-oriented named entity hints; caps-based extraction is deliberately
# labelled as a weak proxy because title case and game/product names confound it.
ORG_HINT = re.compile(r"\b(?:government|department|ministry|court|parliament|congress|senate|police|NHS|WHO|UN|EU|FDA|CDC|Ofcom|Ofgem|ONS|CMA|SEC|FCA|FTC|NASA|ESA|ECB|IMF|World Bank|Supreme Court|High Court|House of Commons|White House|Downing Street|Bank of England|Federal Reserve|Treasury|Supreme Court|Met Office)\b", re.I)

# Countries and demonyms from pycountry, if installed.
try:
    import pycountry
    country_names = [c.name for c in pycountry.countries]
    country_names += ['UK', 'US', 'USA', 'UAE', 'Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'America']
except Exception:
    country_names = ['UK','US','USA','Britain','England','Scotland','Wales','France','Germany','China','Russia','Ukraine','India','Australia','Canada','Japan','Israel','Iran','Brazil','Mexico','South Africa']
COUNTRY_RE = re.compile(r"\b(?:" + '|'.join(re.escape(x) for x in sorted(set(country_names), key=len, reverse=True)) + r")\b", re.I)

# Stable feature names and polarity. All radar axes are oriented so higher is
# more value-bearing signal (the two attention axes are inverted).
DELIVERY_METRICS = ['event_clarity','quantified_specificity','time_place_anchor','causal_explanation','material_consequence','evidence_provenance','context_comparison','original_reporting_signal','explanatory_framing']
VALUE_METRICS = DELIVERY_METRICS + ['low_curiosity_bait','low_sensational_personal']

FEATURES = [
    # Twelve radar dimensions. Named-entity density is retained separately as
    # a descriptive diagnostic, not treated as intrinsic quality.
    ('event_clarity', 'Explicit event / action', 'positive'),
    ('quantified_specificity', 'Quantified detail', 'positive'),
    ('time_place_anchor', 'Time / place anchor', 'positive'),
    ('causal_explanation', 'Causal relationship', 'positive'),
    ('material_consequence', 'Material consequences', 'positive'),
    ('evidence_provenance', 'Evidence / provenance cue', 'positive'),
    ('context_comparison', 'Context / comparison', 'positive'),
    ('explanatory_framing', 'Explanatory / analytical framing', 'positive'),
    ('original_reporting_signal', 'Original-access / investigation cue', 'positive'),
    ('cross_source_title_echo', 'Near-identical cross-source headline (lower is better)', 'adverse'),
    ('low_curiosity_bait', 'Curiosity-gap incidence (lower is better)', 'inverse_bait'),
    ('low_sensational_personal', 'Sensational / personal framing (lower is better)', 'inverse_sensational'),
]
PROFILE_METRICS = ['named_entity_signal']


def normalize(s: str) -> str:
    s = unicodedata.normalize('NFKC', s)
    s = s.replace('’', "'").replace('“','"').replace('”','"')
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def parse_archive(zip_path: Path):
    rows=[]
    with zipfile.ZipFile(zip_path) as zf:
        for name in zf.namelist():
            if not name.endswith('.md') or name in ('README.md','sources-manifest.md'):
                continue
            text = zf.read(name).decode('utf-8', errors='replace')
            current=None
            for raw in text.splitlines():
                line=raw.strip()
                if line.startswith('SOURCE: '):
                    current=line[len('SOURCE: '):].strip()
                elif line and current:
                    title=normalize(line)
                    if title:
                        rows.append({'source':current,'group_file':name,'headline':title})
    df=pd.DataFrame(rows)
    df['group'] = df['group_file'].str.replace(r'^\d+-','',regex=True).str.replace('.md','',regex=False).str.replace('-', ' ').str.title()
    # Exact duplicate title rows retained in story-level table; distinct count is reported.
    return df


def detect_one(title: str, nlp):
    low=title.casefold()
    doc=nlp(title)
    tokens=[t for t in doc if not t.is_space]
    words=[t for t in tokens if t.is_alpha]
    # Approximate named-entity signal: multi-token capitalized spans, acronyms,
    # known institution labels. Avoid counting the first token when it is merely
    # sentence-initial single-word capitalization.
    cap_tokens=[]
    for i,t in enumerate(tokens):
        if t.text.isupper() and len(t.text)>1:
            cap_tokens.append(t.text)
        elif t.text[:1].isupper() and t.text[1:].islower() and i>0:
            cap_tokens.append(t.text)
    cap_multi = len(re.findall(r"\b[A-Z][a-z]+(?:\s+(?:of|the|and|[A-Z][a-z]+)){1,4}\b", title))
    acronym = len(re.findall(r"\b[A-Z]{2,}(?:\d+)?\b", title))
    named_entity = int(cap_multi>0 or acronym>0 or ORG_HINT.search(title) is not None)
    # A direct, informative predicate is required; generic rhetorical verbs are excluded.
    event_action = int(EVENT_ACTIONS.search(title) is not None)
    numeric = int(NUMERIC.search(title) is not None)
    time_place = int(TIME_PLACE.search(title) is not None or COUNTRY_RE.search(title) is not None)
    causal = int(CAUSAL.search(title) is not None)
    consequence = int(CONSEQUENCE.search(title) is not None)
    context = int(CONTEXT.search(title) is not None)
    public = int(PUBLIC_INTEREST.search(title) is not None)
    original = int(ORIGINALITY.search(title) is not None)
    explanatory = int(EXPLANATORY.search(title) is not None)
    bait = int(BAIT.search(title) is not None)
    # Combine private-life markers with celebrity/personality cues, but include
    # explicit family/relationship frames even if no celebrity label is present.
    personal = bool(PERSONAL_LIFE.search(title))
    celebrity = bool(CELEBRITY_CUE.search(title))
    sens = bool(SENSATIONAL.search(title))
    teaser_verb=bool(TEASER_VERBS.search(title))
    lifestyle_detail = bool(re.search(r"\b(?:flaunts?|poses?|bikini|outfit|fashion|red carpet|rare photo|snapshots?|love life|sex life|weight loss|cosmetic surgery|plastic surgery|steps out|inside .* home)\b", title, re.I))
    personal_sensational = int(sens or (personal and (celebrity or lifestyle_detail or (named_entity and teaser_verb))))
    # Contextual teaser rule: a revelation verb attached to a named person and
    # private-life detail is attention packaging even without a stock clickbait phrase.
    bait = int(bool(bait or (personal and named_entity and teaser_verb)))
    clear_event = int(event_action and not bait)
    n_words=len(words)
    # Non-axis diagnostic measures.
    teaser_verb=int(teaser_verb)
    title_case_entity_count = len(cap_tokens) + cap_multi + acronym
    # Title-level value proxy: 11 value-delivery/attention-hygiene signals; profile axes excluded.
    raw = [clear_event,numeric,time_place,causal,consequence,int(HARD_EVIDENCE.search(title) is not None),context,original,explanatory,1-bait,1-personal_sensational]
    return {
        'word_count':n_words,'char_count':len(title),'event_action_present':event_action,
        'named_entity_proxy':named_entity,'capitalised_entity_count_proxy':title_case_entity_count,
        'teaser_verb_present':teaser_verb,'bait_present':bait,'question_form_present':int('?' in title),'sensational_word_present':int(sens),
        'personal_life_frame_present':int(personal),'personal_sensational_frame_present':int(personal_sensational),'celebrity_cue_present':int(celebrity),'attribution_present':int(ATTRIBUTION.search(title) is not None),'anonymous_source_cue':int(ANONYMOUS_SOURCE.search(title) is not None),
        'event_clarity':clear_event,'named_entity_signal':named_entity,'quantified_specificity':numeric,
        'time_place_anchor':time_place,'causal_explanation':causal,'material_consequence':consequence,
        'evidence_provenance':int(HARD_EVIDENCE.search(title) is not None),'context_comparison':context,'public_interest':public,
        'original_reporting_signal':original,'explanatory_framing':explanatory,'low_curiosity_bait':1-bait,
        'low_sensational_personal':1-personal_sensational,
        'title_value_signal_raw':float(np.mean(raw)),
    }


def topic_adjust(df: pd.DataFrame, feature_cols, n_topics=22, min_df=4):
    # Unsupervised topic mix controls for source subject-matter composition.
    vec=TfidfVectorizer(stop_words='english', ngram_range=(1,2), min_df=min_df,
                        max_df=0.88, max_features=26000, sublinear_tf=True,
                        strip_accents='unicode')
    X=vec.fit_transform(df['headline'].tolist())
    n_topics=min(n_topics, max(5, X.shape[1]//10), X.shape[0]-1)
    nmf=NMF(n_components=n_topics, init='nndsvda', random_state=27,
            max_iter=320, l1_ratio=0.05, alpha_W=0.00005, alpha_H=0.00005)
    W=nmf.fit_transform(X)
    # Row-normalised soft topic membership.
    W=W/(W.sum(axis=1,keepdims=True)+1e-12)
    # Topic feature prevalence, soft-assignment weighted.
    F=df[feature_cols].to_numpy(dtype=float)
    topic_mass=W.sum(axis=0)+1e-12
    topic_rates=(W.T @ F)/topic_mass[:,None]
    per_title_expected=W @ topic_rates
    terms=np.array(vec.get_feature_names_out())
    topics=[]
    for k, comp in enumerate(nmf.components_):
        top=terms[np.argsort(comp)[-10:][::-1]].tolist()
        topics.append({'topic':int(k),'terms':top})
    # Predict expected detector prevalence from both unsupervised topic mix
    # and curated source-family group. This reduces genre/topic confounding
    # without using a publisher's name as an explanatory variable.
    enc = OneHotEncoder(handle_unknown='ignore')
    G = enc.fit_transform(df[['group']])
    Xctx = hstack([csr_matrix(W), G], format='csr')
    Y = df[feature_cols].to_numpy(dtype=float)
    contextual_expected = np.zeros_like(Y)
    for j in range(Y.shape[1]):
        model = Ridge(alpha=8.0)
        model.fit(Xctx, Y[:, j])
        contextual_expected[:, j] = np.clip(model.predict(Xctx), 0.0, 1.0)
    return W, contextual_expected, topics, vec, nmf


def source_phrase_signatures(df, out_path: Path, min_source_n=30, min_phrase_count=3, top_k=20):
    """Extract source-distinctive unigrams/bigrams/trigrams via weighted log-odds."""
    cv = CountVectorizer(stop_words='english', ngram_range=(2, 3), min_df=2,
                         max_features=50000, binary=True, strip_accents='unicode')
    X = cv.fit_transform(df['headline'].tolist()).tocsr()
    terms = np.asarray(cv.get_feature_names_out())
    global_counts = np.asarray(X.sum(axis=0)).ravel().astype(float)
    prior_total = 100.0
    alpha = (global_counts / max(global_counts.sum(), 1.0)) * prior_total + 1e-3
    alpha0 = float(alpha.sum())
    N = X.shape[0]
    rows = []
    for source, positions in df.groupby('source', sort=False).indices.items():
        positions = np.asarray(positions, dtype=int)
        n_s = len(positions)
        if n_s < min_source_n:
            continue
        source_counts = np.asarray(X[positions].sum(axis=0)).ravel().astype(float)
        other_counts = global_counts - source_counts
        n_o = N - n_s
        denom_s = np.maximum(n_s - source_counts + alpha0 - alpha, 1e-9)
        denom_o = np.maximum(n_o - other_counts + alpha0 - alpha, 1e-9)
        delta = np.log((source_counts + alpha) / denom_s) - np.log((other_counts + alpha) / denom_o)
        var = 1.0/(source_counts + alpha) + 1.0/denom_s + 1.0/(other_counts + alpha) + 1.0/denom_o
        z = delta / np.sqrt(var)
        eligible = np.where(source_counts >= min_phrase_count)[0]
        if len(eligible) == 0:
            continue
        top = eligible[np.argsort(z[eligible])[-top_k:][::-1]]
        for j in top:
            rows.append({'source': source, 'n_headlines': n_s, 'phrase': terms[j],
                         'source_doc_count': int(source_counts[j]),
                         'source_share': float(source_counts[j]/n_s),
                         'corpus_share': float(global_counts[j]/N),
                         'weighted_log_odds_z': float(z[j])})
    pd.DataFrame(rows).to_csv(out_path, index=False)


def headline_reuse_proxy(df):
    # Cross-source near-duplicate headline proxy using character n-gram TF-IDF.
    # It detects headline reuse/paraphrase-like lexical overlap, not copied body text.
    texts=df['headline'].tolist()
    v=TfidfVectorizer(analyzer='char_wb', ngram_range=(3,5), min_df=2,
                      max_features=30000, sublinear_tf=True)
    X=v.fit_transform(texts)
    nn=NearestNeighbors(n_neighbors=min(8,len(texts)), metric='cosine', algorithm='brute', n_jobs=-1)
    nn.fit(X)
    d, ix=nn.kneighbors(X)
    sources=df['source'].to_numpy()
    max_cross=np.zeros(len(df),dtype=float)
    nearest_source=np.array(['']*len(df),dtype=object)
    nearest_title=np.array(['']*len(df),dtype=object)
    nearest_idx=np.full(len(df),-1,dtype=int)
    for i in range(len(df)):
        sims=1-d[i]
        candidates=[(float(sims[j]),int(k)) for j,k in enumerate(ix[i]) if k!=i and sources[k]!=sources[i]]
        best=max(candidates,default=(0.0,-1),key=lambda x:x[0])
        max_cross[i]=best[0]
        nearest_idx[i]=best[1]
        if best[1]>=0:
            nearest_source[i]=sources[best[1]]
            nearest_title[i]=df.iloc[best[1]]['headline']
    df['cross_source_title_similarity']=max_cross
    df['cross_source_near_duplicate_proxy']=(max_cross>=0.82).astype(int)
    df['cross_source_nearest_source']=nearest_source
    df['cross_source_nearest_headline']=nearest_title
    return df


def add_within_source_template_proxy(df):
    """Mark titles containing a content-bearing trigram repeated in that source.

    This is a template/topic recurrence diagnostic, not proof of content farming.
    """
    stop=set(ENGLISH_STOP_WORDS)
    repeated=np.zeros(len(df),dtype=int)
    for source, positions in df.groupby('source',sort=False).indices.items():
        positions=np.asarray(positions)
        per_title=[]
        counts=Counter()
        for pos in positions:
            toks=re.findall(r"[a-z0-9]+", df.iloc[pos]['headline'].casefold())
            grams=[]
            for j in range(max(0,len(toks)-2)):
                gram=tuple(toks[j:j+3])
                if sum(w not in stop for w in gram)>=2:
                    grams.append(gram)
            per_title.append(set(grams))
            counts.update(set(grams))
        # Require repetition across >=3 headlines and >=2% of the source pool.
        min_count=max(3,int(math.ceil(len(positions)*0.02)))
        common={g for g,c in counts.items() if c>=min_count}
        for pset,pos in zip(per_title,positions):
            repeated[pos]=int(bool(pset & common))
    df['within_source_repeated_trigram_proxy']=repeated
    return df


def source_statistics(df, W, expected, features):
    g=df.groupby('source', sort=False)
    src=g.agg(n=('headline','size'),group=('group',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              mean_words=('word_count','mean'), title_value_raw=('title_value_signal_raw','mean'),
              delivery_signal_mean=('information_delivery_signal','mean'),
              delivery_signal_median=('information_delivery_signal','median'),
              delivery_signal_p25=('information_delivery_signal',lambda x:x.quantile(.25)),
              delivery_signal_p75=('information_delivery_signal',lambda x:x.quantile(.75)),
              delivery_signal_p90=('information_delivery_signal',lambda x:x.quantile(.90)),
              delivery_share_le20=('information_delivery_signal',lambda x:(x<=20).mean()),
              delivery_share_ge44=('information_delivery_signal',lambda x:(x>=44.444444).mean()),
              attention_pressure_mean=('attention_packaging_pressure','mean'),
              within_source_template_reuse_rate=('within_source_repeated_trigram_proxy','mean'),
              attribution_cue_rate=('attribution_present','mean'), anonymous_source_cue_rate=('anonymous_source_cue','mean'),
              cross_source_near_duplicate_rate=('cross_source_near_duplicate_proxy','mean'),
              mean_cross_source_similarity=('cross_source_title_similarity','mean')).reset_index()
    feat_cols=[x[0] for x in FEATURES]
    rows=[]
    # Topic expected source rates, observed rates, shrinkage, z-residuals.
    source_index={s:i for i,s in enumerate(src['source'])}
    for source, idx in g.indices.items():
        idx=np.asarray(idx)
        n=len(idx)
        r={'source':source}
        for fi,(col,label,polarity) in enumerate(FEATURES):
            obs=float(df.iloc[idx][col].mean())
            exp=float(expected[idx,fi].mean())
            residual=obs-exp
            shrink=n/(n+25.0)
            r[col+'_rate']=obs
            r[col+'_expected_topic_group']=exp
            r[col+'_adjusted_pp'] = 100*residual*shrink
            r[col+'_shrunk_rate']=exp+residual*shrink
        rows.append(r)
    metrics=pd.DataFrame(rows)
    src=src.merge(metrics,on='source',how='left')
    # Named-entity density is a descriptive diagnostic, not a quality bonus.
    entity_rates = g['named_entity_signal'].mean().rename('named_entity_signal_rate').reset_index()
    public_rates = g['public_interest'].mean().rename('public_interest_rate').reset_index()
    src = src.merge(entity_rates, on='source', how='left').merge(public_rates, on='source', how='left')
    src['curiosity_bait_incidence_rate'] = 1.0 - src['low_curiosity_bait_rate']
    src['sensational_personal_incidence_rate'] = 1.0 - src['low_sensational_personal_rate']
    # Standardise publisher residuals per axis, using only sources with n>=20.
    eligible=src['n']>=20
    zs=[]
    for col,label,polarity in FEATURES:
        rcol=col+'_adjusted_pp'
        vals=src.loc[eligible,rcol].astype(float)
        mu=float(vals.mean()) if len(vals) else 0.0
        sd=float(vals.std(ddof=1)) if vals.std(ddof=1)>1e-8 else 1.0
        src[col+'_relative_z']=(src[rcol]-mu)/sd
        # Radar: observed prevalence, with adverse dimensions direction-inverted.
        if polarity.startswith('inverse'):
            src[col+'_radar']=100*(1-src[col+'_rate'])
        else:
            src[col+'_radar']=100*src[col+'_rate']
        if col in VALUE_METRICS: zs.append(col+'_relative_z')
    # Profile-only dimensions (named entities and civic subject matter) are
    # displayed but not treated as intrinsic quality bonuses.
    src['topic_adjusted_value_index']=(50+15*src[zs].clip(-3,3).mean(axis=1)).clip(0,100)
    # Within-source bootstrap intervals: headline sampling uncertainty only;
    # topic model and regression expectation are held fixed.
    rng = np.random.default_rng(27)
    value_idx = [i for i,(col,_,_) in enumerate(FEATURES) if col in VALUE_METRICS]
    value_cols = [FEATURES[i][0] for i in value_idx]
    resid_mu = np.array([float(src.loc[eligible, c+'_adjusted_pp'].mean()) for c in value_cols])
    resid_sd = np.array([max(float(src.loc[eligible, c+'_adjusted_pp'].std(ddof=1)), 1e-8) for c in value_cols])
    ci_low = np.full(len(src), np.nan)
    ci_high = np.full(len(src), np.nan)
    for row_i, row in src.iterrows():
        n = int(row['n'])
        if n < 20:
            continue
        pos = np.asarray(g.indices[row['source']], dtype=int)
        Ysrc = df.iloc[pos][value_cols].to_numpy(dtype=float)
        Esrc = expected[pos][:, value_idx]
        boot_ix = rng.integers(0, n, size=(250, n))
        obs_b = Ysrc[boot_ix].mean(axis=1)
        exp_b = Esrc[boot_ix].mean(axis=1)
        adj_b = 100.0 * (obs_b-exp_b) * (n/(n+25.0))
        z_b = (adj_b-resid_mu) / resid_sd
        score_b = np.clip(50.0 + 15.0*np.clip(z_b, -3, 3).mean(axis=1), 0, 100)
        ci_low[row_i], ci_high[row_i] = np.quantile(score_b, [0.025, 0.975])
    src['topic_adjusted_index_ci95_low'] = ci_low
    src['topic_adjusted_index_ci95_high'] = ci_high
    # Raw title signal index for transparency.
    src['raw_title_signal_index']=100*src['title_value_raw']
    src['rank_eligible']=src['n']>=20
    src['confidence_tier']=np.select([src['n']>=100,src['n']>=50,src['n']>=20],['High sample volume','Moderate sample volume','Limited sample volume'],default='Insufficient sample (<20)')
    src['rank']=np.nan
    src['rank_n50']=np.nan
    src['rank_n100']=np.nan
    eligible_order=src.loc[src['n']>=20].sort_values('topic_adjusted_value_index',ascending=False).index
    src.loc[eligible_order,'rank']=np.arange(1,len(eligible_order)+1)
    for threshold, rank_col in [(50,'rank_n50'),(100,'rank_n100')]:
        order=src.loc[src['n']>=threshold].sort_values('topic_adjusted_value_index',ascending=False).index
        src.loc[order,rank_col]=np.arange(1,len(order)+1)
    src=src.sort_values(['rank_eligible','topic_adjusted_value_index','n'],ascending=[False,False,False]).reset_index(drop=True)
    return src


def make_radar(src, output_html: Path, top_n=74):
    axes=[x[1] for x in FEATURES]
    # Dropdown list includes all publishers with >=20 titles, pre-sorted by rank.
    eligible=src[src['rank_eligible']].sort_values('rank')
    if len(eligible)==0: return
    traces=[]
    for _,r in eligible.iterrows():
        vals=[float(r[x[0]+'_radar']) for x in FEATURES]
        traces.append(go.Scatterpolar(r=vals+[vals[0]],theta=axes+[axes[0]],
                        fill='toself',name=f"{int(r['rank'])}. {r['source']} (n={int(r['n'])})",
                        visible=False,opacity=0.65,
                        hovertemplate='%{theta}: %{r:.1f}%<extra>'+html.escape(str(r['source']))+'</extra>'))
    if traces:
        traces[0].visible=True
    fig=go.Figure(data=traces)
    buttons=[]
    for i,(_,r) in enumerate(eligible.iterrows()):
        vis=[False]*len(traces); vis[i]=True
        buttons.append(dict(label=f"{int(r['rank']):02d} · {r['source']} · n={int(r['n'])}",
                            method='update',args=[{'visible':vis},{'title':f"{r['source']} — title-signal profile (n={int(r['n'])})"}]))
    fig.update_layout(title=f"{eligible.iloc[0]['source']} — title-signal profile (n={int(eligible.iloc[0]['n'])})",
        polar=dict(radialaxis=dict(visible=True,range=[0,100],ticksuffix='%'),
                   angularaxis=dict(direction='clockwise')),
        showlegend=False, height=800, width=1050,
        updatemenus=[dict(type='dropdown',direction='down',x=0.02,y=1.13,
                          buttons=buttons,showactive=True)],
        margin=dict(t=145,b=75,l=80,r=80),
        annotations=[dict(text='Each axis = share of titles triggering that detector. Twelve axes show raw occurrence rates. Curiosity-gap and sensational/personal framing axes are adverse behaviours (lower is better); public/systemic subject matter is descriptive. Title-only signals, not truth/accuracy ratings.',
                          x=0.5,y=-0.11,xref='paper',yref='paper',showarrow=False,font=dict(size=11))])
    fig.write_html(output_html,include_plotlyjs=True,full_html=True)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--zip',type=Path,default=DEFAULT_ZIP)
    ap.add_argument('--out',type=Path,default=Path('/mnt/data/source_analysis'))
    ap.add_argument('--topics',type=int,default=22)
    args=ap.parse_args(); args.out.mkdir(parents=True,exist_ok=True)
    df=parse_archive(args.zip)
    # Normalise duplicate title whitespace/punctuation only for exact duplicate diagnostic.
    df['headline_id']=np.arange(len(df))
    nlp=spacy.blank('en')
    det=pd.DataFrame([detect_one(t,nlp) for t in df['headline']])
    df=pd.concat([df.reset_index(drop=True),det],axis=1)
    df=headline_reuse_proxy(df)
    df['cross_source_title_echo'] = df['cross_source_near_duplicate_proxy'].astype(int)
    df=add_within_source_template_proxy(df)
    feature_cols=[x[0] for x in FEATURES]
    W,expected,topics,vec,nmf=topic_adjust(df,feature_cols,n_topics=args.topics)
    df['dominant_topic']=W.argmax(axis=1)
    df['topic_strength']=W.max(axis=1)
    # Story-level delivery and attention signals are kept separate; the
    # combined index is supplementary and should not replace the per-axis data.
    df['information_delivery_signal']=100*df[DELIVERY_METRICS].mean(axis=1)
    df['attention_packaging_pressure']=100*df[['bait_present','personal_sensational_frame_present']].mean(axis=1)
    df['title_value_signal']=100*df[VALUE_METRICS].mean(axis=1)
    # Per-source profiles/rankings with topic-mix residual shrinkage.
    src=source_statistics(df,W,expected,FEATURES)
    # Persist artifacts.
    story_cols=['headline_id','source','group','group_file','headline','word_count','information_delivery_signal','attention_packaging_pressure','title_value_signal','dominant_topic','topic_strength']
    story_cols += [x[0] for x in FEATURES] + ['event_action_present','named_entity_proxy','capitalised_entity_count_proxy','teaser_verb_present','bait_present','question_form_present','sensational_word_present','personal_life_frame_present','personal_sensational_frame_present','celebrity_cue_present','attribution_present','anonymous_source_cue','cross_source_title_similarity','cross_source_near_duplicate_proxy','cross_source_nearest_source','cross_source_nearest_headline','within_source_repeated_trigram_proxy']
    df[story_cols].to_csv(args.out/'headline_level_signals.csv',index=False)
    df.loc[df.cross_source_near_duplicate_proxy.eq(1), ['source','headline','cross_source_nearest_source','cross_source_nearest_headline','cross_source_title_similarity']].sort_values('cross_source_title_similarity',ascending=False).to_csv(args.out/'cross_source_title_matches.csv',index=False)
    src.to_csv(args.out/'source_rankings.csv',index=False)
    source_phrase_signatures(df, args.out/'source_phrase_signatures.csv')
    story_dist_cols=['source','group','n','topic_adjusted_value_index','raw_title_signal_index','delivery_signal_mean','delivery_signal_median','delivery_signal_p25','delivery_signal_p75','delivery_signal_p90','delivery_share_le20','delivery_share_ge44','attention_pressure_mean']
    src[story_dist_cols].to_csv(args.out/'source_story_score_distributions.csv',index=False)
    # Radar-ready source profile: all 12 columns are actual detector
    # occurrence rates (including adverse attention/echo axes). The ranking
    # model stores the inverse attention-hygiene features, so expose their
    # incidence-oriented complements explicitly here to avoid ambiguity.
    src['curiosity_bait_expected_topic_group'] = 1.0 - src['low_curiosity_bait_expected_topic_group']
    src['curiosity_bait_adjusted_pp'] = -src['low_curiosity_bait_adjusted_pp']
    src['sensational_personal_expected_topic_group'] = 1.0 - src['low_sensational_personal_expected_topic_group']
    src['sensational_personal_adjusted_pp'] = -src['low_sensational_personal_adjusted_pp']
    radar_metrics = [x[0] for x in FEATURES[:10]] + ['curiosity_bait_incidence','sensational_personal_incidence']
    profile_cols = ['source','group','n']
    profile_cols += [m+'_rate' for m in radar_metrics[:10]]
    profile_cols += ['curiosity_bait_incidence_rate','sensational_personal_incidence_rate']
    profile_cols += [m+'_expected_topic_group' for m in radar_metrics[:10]]
    profile_cols += ['curiosity_bait_expected_topic_group','sensational_personal_expected_topic_group']
    profile_cols += [m+'_adjusted_pp' for m in radar_metrics[:10]]
    profile_cols += ['curiosity_bait_adjusted_pp','sensational_personal_adjusted_pp']
    profile_cols += ['named_entity_signal_rate','public_interest_rate']
    src[profile_cols].to_csv(args.out/'source_axis_profiles.csv',index=False)
    (args.out/'topic_model.json').write_text(json.dumps(topics,indent=2))
    topic_share_rows=[]
    for source, positions in df.groupby('source',sort=False).indices.items():
        shares=W[np.asarray(positions)].mean(axis=0)
        row={'source':source,'n':len(positions)}
        row.update({f'topic_{k:02d}_share':float(v) for k,v in enumerate(shares)})
        topic_share_rows.append(row)
    pd.DataFrame(topic_share_rows).to_csv(args.out/'source_topic_profiles.csv',index=False)
    make_radar(src,args.out/'source_radar.html')
    # Summary report.
    eligible=src[src.rank_eligible].copy().sort_values('topic_adjusted_value_index',ascending=False)
    top=eligible.head(15)
    bottom=eligible.tail(15).sort_values('topic_adjusted_value_index')
    exact_dups=df.groupby('headline').size()
    summary={
      'zip':str(args.zip),'headline_rows':int(len(df)),'sources':int(df.source.nunique()),
      'exact_duplicate_headline_rows':int((exact_dups-1).clip(lower=0).sum()),
      'cross_source_near_duplicate_title_rows':int(df.cross_source_near_duplicate_proxy.sum()),
      'sources_ranked_n_ge_20':int(len(eligible)),
      'sources_n_ge_50':int((src.n>=50).sum()),'sources_n_ge_100':int((src.n>=100).sum()),
      'sources_lt_20':int((src.n<20).sum()),'nmf_topics':len(topics),'value_signal_count':len(VALUE_METRICS),'delivery_signal_count':len(DELIVERY_METRICS),'radar_axis_count':len(FEATURES),
      'overall_axis_rates':{('curiosity_bait_incidence' if x[0]=='low_curiosity_bait' else 'sensational_personal_incidence' if x[0]=='low_sensational_personal' else x[0]):float(1-df[x[0]].mean() if x[0] in ('low_curiosity_bait','low_sensational_personal') else df[x[0]].mean()) for x in FEATURES},
      'overall_stored_feature_means':{x[0]:float(df[x[0]].mean()) for x in FEATURES},
      'top_15':top[['rank','source','n','topic_adjusted_value_index','raw_title_signal_index']].to_dict(orient='records'),
      'bottom_15':bottom[['rank','source','n','topic_adjusted_value_index','raw_title_signal_index']].to_dict(orient='records'),
      'largest_sources':src.sort_values('n',ascending=False).head(20)[['source','n','group','topic_adjusted_value_index']].to_dict(orient='records'),
    }
    (args.out/'analysis_summary.json').write_text(json.dumps(summary,indent=2))
    lines=[]
    lines += ['# Title-only reader-value signals — exploratory backend run','',
      f"Corpus: **{len(df):,} headline rows**, **{df.source.nunique():,} sources**.",
      f"Source ranking eligible: **{len(eligible)}** sources with at least 20 headlines. **{int((src.n<20).sum())}** sources have fewer than 20 and are not assigned a rank.",
      f"Exact duplicate headline rows retained in the input: **{summary['exact_duplicate_headline_rows']}**.",
      '', '## Measurement definition',
      'Each detector returns 0/1 per headline. Source axes are occurrence rates (% of titles triggering the detector). The radar shows raw occurrence rates; title-echo and the two attention-framing axes are adverse behaviours, so lower is better. The compact `source_axis_profiles.csv` stores those three as explicit incidence columns (not inverse hygiene columns). The composite title index excludes title echo. The 11-signal title-language proxy combines nine information-delivery detectors with two inverse attention-framing detectors. A separate 0–100 delivery-only signal and attention-pressure signal are exported for every headline. Public/systemic subject matter and named-entity density remain separate descriptive fields, not intrinsic quality bonuses. Expected rates are estimated from the combination of 22 unsupervised topic memberships and the archive\'s curated source-family group.',
      '', '## Important limitations',
      '- These are headline-only linguistic signals. `information_delivery_signal` measures the presence of nine title-level information markers, not actual story value, factual accuracy, whether the event is important, or whether the publisher has done original reporting. `attention_packaging_pressure` is reported separately.',
      '- Named-entity detection uses capitalisation, acronym and institutional lexicon proxies; sentence case, title case, game/product names and proper nouns confound it.',
      '- Repeated-trigram and cross-publisher title overlap measures are diagnostics for formulaicity/reuse, not proof of copied work or low quality. The title-echo radar axis is a near-identical title-match rate, not article-body provenance.',
      '- Topic-adjusted title-signal index is the mean standardised publisher residual over eleven included detectors, shrunk toward its topic/group expectation and re-centred at 50; it is a comparative corpus index, not a probability or absolute story-quality score.',
      '- Expected-rate adjustment uses TF-IDF/NMF topic memberships plus curated source-family group in ridge regressions. This reduces, but does not eliminate, topic/genre confounding; the source-family groups are coarse.',
      '- 95% intervals are within-source headline bootstrap intervals with the topic/group model held fixed; they do not include detector or model uncertainty. The composite ranking is exploratory. No human-labelled validation set was supplied, and detector precision/recall is not established.',
      '- Source counts are newest-first snapshots with no per-headline timestamps/URLs in this archive; chronology, article reuse and wire provenance cannot be reliably established.',
      '- Attribution and anonymous-source cues are exported as diagnostics, but are not treated as proof of sourcing quality.',
      '- Cross-source headline similarity is a title-level reuse proxy only, not evidence of copied article text.',
      '', '## Axis definitions',
    ]
    axis_defs={
      'event_clarity':'Share with a specific event/action predicate not caught by the explicit curiosity-gap detector.',
      'quantified_specificity':'Share with a number, percentage, amount, age, count or other numeric detail.',
      'time_place_anchor':'Share with explicit date/time/day or country/place anchor.',
      'causal_explanation':'Share with causal, consequence-linking or explicit relational language.',
      'material_consequence':'Share with impacts, costs, risks, jobs, health, harm, benefits or material changes.',
      'evidence_provenance':'Share with stronger evidence artefacts such as studies, data, records, filings, audits, trials or documents; generic says/claims attribution is tracked separately.',
      'context_comparison':'Share with comparisons, trends, historical references, records or prior-period context.',
      'cross_source_title_echo':'Share with a near-identical cross-source headline match at character n-gram cosine similarity ≥0.82; lower means less title echo, but does not establish originality or copying.',
      'explanatory_framing':'Share with explicit explanation, analysis, guide, mechanism or why/how framing; this measures the presence of explanatory language, not whether the explanation is correct.',
      'original_reporting_signal':'Share with explicit original-reporting or primary-material cues such as investigation, special report, documents obtained, interview, FOI or our analysis.',
      'low_curiosity_bait':'Share with explicit curiosity-gap/direct-address/question/ellipsis patterns; lower is better.',
      'low_sensational_personal':'Share with stronger sensational vocabulary or celebrity/personal-life teaser framing; ordinary family mentions alone are not enough; lower is better.'}
    for col,label,pol in FEATURES:
      lines.append(f"- **{label}** (`{col}`): {axis_defs[col]}")
    high_volume=src[src.n>=100].sort_values('topic_adjusted_value_index',ascending=False)
    lines += ['', '## High-volume ranking (n ≥ 100)',
              '| Rank | Source | n | Topic-adjusted title signal (95% interval) | Raw 11-signal mean |', '|---:|---|---:|---:|---:|']
    for _,r in high_volume.iterrows():
      lines.append(f"| {int(r['rank_n100'])} | {r['source']} | {int(r['n'])} | {r['topic_adjusted_value_index']:.1f} ({r['topic_adjusted_index_ci95_low']:.1f}–{r['topic_adjusted_index_ci95_high']:.1f}) | {r['raw_title_signal_index']:.1f} |")
    lines += ['', '## Headline-level information-delivery distribution (n ≥ 100)',
              '| Source | n | Mean delivery signal | Median | 0–1 of 9 markers | 4–9 of 9 markers | Attention pressure |',
              '|---|---:|---:|---:|---:|---:|---:|']
    for _,r in high_volume.iterrows():
      lines.append(f"| {r['source']} | {int(r['n'])} | {r['delivery_signal_mean']:.1f} | {r['delivery_signal_median']:.1f} | {100*r['delivery_share_le20']:.1f}% | {100*r['delivery_share_ge44']:.1f}% | {r['attention_pressure_mean']:.1f} |")
    lines += ['', '## Highest topic-adjusted title-signal profiles (n ≥ 20)',
              '| Rank | Source | n | Topic-adjusted title signal (95% interval) | Raw 11-signal mean |', '|---:|---|---:|---:|---:|']
    for _,r in top.iterrows():
      lines.append(f"| {int(r['rank'])} | {r['source']} | {int(r['n'])} | {r['topic_adjusted_value_index']:.1f} ({r['topic_adjusted_index_ci95_low']:.1f}–{r['topic_adjusted_index_ci95_high']:.1f}) | {r['raw_title_signal_index']:.1f} |")
    lines += ['', '## Lowest topic-adjusted title-signal profiles (n ≥ 20)',
              '| Rank | Source | n | Topic-adjusted title signal (95% interval) | Raw 11-signal mean |', '|---:|---|---:|---:|---:|']
    for _,r in bottom.iterrows():
      lines.append(f"| {int(r['rank'])} | {r['source']} | {int(r['n'])} | {r['topic_adjusted_value_index']:.1f} ({r['topic_adjusted_index_ci95_low']:.1f}–{r['topic_adjusted_index_ci95_high']:.1f}) | {r['raw_title_signal_index']:.1f} |")
    lines += ['', '## Files',
      '- `headline_level_signals.csv`: one row per headline with detector results.',
      '- `source_rankings.csv`: all sources, raw rates, topic-mix expectations, shrunk adjusted rates, rank and sample tier.',
      '- `source_axis_profiles.csv`: compact radar-ready source profiles; all 12 primary columns are actual occurrence rates, including adverse title-echo, curiosity-gap and sensational/personal incidences. Named-entity and public-subject descriptors are separate.',
      '- `source_phrase_signatures.csv`: corpus-discovered source-distinctive bigrams and trigrams using weighted log-odds.',
      '- `source_story_score_distributions.csv`: source-level distribution of per-headline value proxies.',
      '- `cross_source_title_matches.csv`: title-level cross-publisher near-matches above the similarity threshold.',
      '- `source_radar.html`: interactive dropdown radar chart for sources with n ≥ 20.',
      '- `topic_model.json`: NMF topics and top terms.',
      '- `source_topic_profiles.csv`: source-level soft topic proportions.',
      '- `analysis_summary.json`: machine-readable summary.',
      '- `analyse_headlines.py`: reproducible script.']
    (args.out/'REPORT.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps({k:summary[k] for k in ['headline_rows','sources','sources_ranked_n_ge_20','sources_n_ge_50','sources_n_ge_100','sources_lt_20','exact_duplicate_headline_rows']},indent=2))
    print('\nTOP:')
    print(eligible.head(15)[['rank','source','n','topic_adjusted_value_index','raw_title_signal_index']].to_string(index=False))
    print('\nBOTTOM:')
    print(bottom[['rank','source','n','topic_adjusted_value_index','raw_title_signal_index']].to_string(index=False))
    print('\nLARGEST:')
    print(src.sort_values('n',ascending=False).head(20)[['source','n','topic_adjusted_value_index','raw_title_signal_index']].to_string(index=False))

if __name__=='__main__':
    main()

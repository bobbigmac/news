#!/usr/bin/env python3
"""Title-only editorial-value signal analysis for source-headlines ZIP exports.

Exploratory dev-time corpus instrument, not a truth/accuracy detector. It extracts
interpretable title-level signals, cross-fits topic/editorial-context expectations,
and writes story- and source-level tables plus an interactive radar.
"""
from __future__ import annotations

import argparse, html, json, math, re, time, unicodedata, zipfile
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
import spacy
import plotly.graph_objects as go
from scipy.sparse import csr_matrix, hstack
from sklearn.decomposition import NMF
from sklearn.feature_extraction.text import CountVectorizer, ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import OneHotEncoder

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = REPO_ROOT / 'docs/tasks/headline-analysis.task.json'

MONTHS = r"january|february|march|april|may|june|july|august|september|october|november|december"
DAYS = r"monday|tuesday|wednesday|thursday|friday|saturday|sunday"

def compile_word_pool(words):
    return re.compile(r"\b(?:" + '|'.join(re.escape(w) for w in sorted(set(words), key=len, reverse=True)) + r")\b", re.I)

EVENT_WORDS = """
announce announces announced announcing approve approves approved approving reject rejects rejected rejecting
resign resigns resigned resigning win wins won winning lose loses losing lost die dies died dying
kill kills killed killing arrest arrests arrested arresting charge charges charged charging convict convicts convicted convicting
acquit acquits acquitted acquitting launch launches launched launching open opens opened opening close closes closed closing
suspend suspends suspended suspending ban bans banned banning sign signs signed signing bought buy buys buying sold sell sells selling
fell fall falls falling rose rise rises rising increase increases increased increasing decrease decreases decreased decreasing
find finds found finding discover discovers discovered discovering ruled rule rules ruling order orders ordered ordering
vote votes voted voting pass passes passed passing delay delays delayed delaying cut cuts cutting
fire fires fired firing hire hires hired hiring strike strikes struck striking investigate investigates investigated investigating
publish publishes published publishing release releases released releasing unveil unveils unveiled unveiling
introduce introduces introduced introducing remove removes removed removing add adds added adding update updates updated updating
change changes changed changing shut shuts shutting expand expands expanded expanding reduce reduces reduced reducing
withdraw withdraws withdrawing withdrawn oust ousts ousted ousting appoint appoints appointed appointing
elect elects elected electing beat beats beating defeat defeats defeated defeating earn earns earned earning
sue sues sued suing settle settles settled settling plead pleads pleaded pleading warn warns warned warning
attack attacks attacked attacking invade invades invaded invading agree agrees agreed agreeing reach reaches reached reaching
break breaks broke broken breaking surge surges surged surging drop drops dropped dropping climb climbs climbed climbing
decline declines declined declining recover recovers recovered recovering collapse collapses collapsed collapsing
rescue rescues rescued rescuing evacuate evacuates evacuated evacuating return returns returned returning
confirm confirms confirmed confirming expose exposes exposed exposing scrap scraps scrapped scrapping
scrutinise scrutinises scrutinised scrutinising scrutinize scrutinizes scrutinized scrutinizing file files filed filing
acquire acquires acquired acquiring merge merges merged merging sack sacks sacked sacking survive survives survived surviving
injure injures injured injuring wound wounds wounded wounding bomb bombs bombed bombing crash crashes crashed crashing
burn burns burned burning burnt flood floods flooded flooding storm storms stormed storming explode explodes exploded exploding
erupt erupts erupted erupting shoot shoots shot shooting stab stabs stabbed stabbing sentence sentences sentenced sentencing
indict indicts indicted indicting prosecute prosecutes prosecuted prosecuting appeal appeals appealed appealing
overturn overturns overturned overturning uphold upholds upheld upholding block blocks blocked blocking
clear clears cleared clearing enact enacts enacted enacting repeal repeals repealed repealing adopt adopts adopted adopting
ship ships shipped shipping debut debuts debuted debuting
set sets record records recorded recording outperform outperforms outperformed outperforming
underperform underperforms underperformed underperforming become becomes became undergo undergoes underwent undergoing
sanction sanctions sanctioned sanctioning condemn condemns condemned condemning seek seeks sought seeking pledge pledges pledged pledging
infect infects infected infecting impeach impeaches impeached impeaching
""".split()
EVENT_WORDS.extend(['roll out', 'rolls out', 'rolled out', 'rolling out'])
EVENT_ACTIONS = compile_word_pool(EVENT_WORDS)
NUMERIC = re.compile(r"(?:\b\d+(?:[.,]\d+)?\s?(?:%|per cent|percent|million|billion|trillion|thousand|th|years?|months?|weeks?|days?|hours?|minutes?|people|cases|deaths|jobs|homes|miles|km|kg|\$|£|€|¥)|(?:\$|£|€|¥)\s?\d|\b\d{4}\b|\b\d+\s?(?:to|-)\s?\d+\b)", re.I)
TIME_PLACE = re.compile(rf"\b(?:{MONTHS}|{DAYS}|today|yesterday|tomorrow|tonight|this morning|this week|next week|last week|next year|last year|in \d{{4}}|by \d{{4}}|since \d{{4}}|during \d{{4}}|\d{{1,2}}(?:st|nd|rd|th)?\s+(?:{MONTHS})|(?:{MONTHS})\s+\d{{1,2}})\b", re.I)
CAUSAL = re.compile(r"\b(?:because|due to|as a result|resulting in|results? in|led to|leads? to|caused? by|causes?|trigger\w*|prompt\w*|driv\w*|fuel\w*|in response to|thanks to|which means|what it means|linked to|associated with|contribut\w* to|forces? .* to|means that)\b", re.I)
CONSEQUENCE_WORDS = """
impact impacts impacted consequence consequences affect affects affected affecting
threat threats threatened threatening risk risks risked risking cost costs costing damage damages damaged damaging
benefit benefits benefited benefiting save saves saved saving kill kills killed killing
injure injures injured injuring injury injuries death deaths dead fatal fatality fatalities
job jobs layoff layoffs unemployment employment price prices priced pricing bill bills billed billing
wage wages tax taxes taxed taxation spend spends spent spending fund funds funded funding
profit profits loss losses harm harms harmed harming boost boosts boosted boosting
cut cuts cutting reduce reduces reduced reducing reduction reductions increase increases increased increasing
rise rises rose rising fall falls fell falling drop drops dropped dropping decline declines declined declining
decrease decreases decreased decreasing soar soars soared soaring plunge plunges plunged plunging
grew growth climb climbs climbed climbing surge surges surged surging shortage shortages crisis crises
outage outages delay delays delayed delaying disrupt disrupts disrupted disrupting disruption disruptions
exposure exposures exposed ban bans banned banning restriction restrictions restricted restricting
bankrupt bankruptcy
""".split()
CONSEQUENCE_WORDS.append('put at risk')
CONSEQUENCE = compile_word_pool(CONSEQUENCE_WORDS)
ATTRIBUTION = re.compile(r"\b(?:according to|says?|said|tells?|told|warns?|warned|claims?|claimed|confirms?|confirmed|admits?|admitted|announces?|announced|estimates?|estimated|reports?|reported|sources? say|officials? say|police say|court heard|documents? show|data show)\b", re.I)
ANONYMOUS_SOURCE = re.compile(r"\b(?:anonymous source|unnamed source|sources? familiar with|people familiar with|insider says|insiders say|a source told|sources told|according to sources|sources close to|speaking on condition of anonymity)\b", re.I)
PRIMARY_EVIDENCE = re.compile(r"\b(?:court (?:filing\w*|records?|documents?)|documents? (?:show|shows|reveal\w*|obtained|seen|reviewed)|obtained documents?|leaked documents?|internal (?:memo|documents?)|filings? (?:show|shows|reveal\w*)|audit (?:show\w*|find\w*|reveal\w*)|official (?:report|figures|data)|inspection report|data (?:show|shows|reveal\w*)|figures? (?:show|shows|reveal\w*)|statistics show|testimony|transcript\w* (?:show|shows|reveal\w*|indicate\w*)|freedom of information|\bfoi\b|trial records|peer.reviewed|court heard|court hears|inquest hears)\b", re.I)
RESEARCH_CLAIM = re.compile(r"\b(?:study|studies|survey|poll|findings|clinical trial)\b|\b(?:research|analysis)\s+(?:finds?|shows?|suggests?|reveals?|indicates?)\b|\b(?:scientists?|researchers?)\s+(?:find|finds|show|shows|suggest|suggests|indicate|indicates|reveal|reveals|report|reports|warn|warns|say|says|discover|discovers|identify|identifies|develop|develops|engineer|engineers)\b", re.I)
CONTEXT = re.compile(r"\b(?:first time|for the first time|first ever|since|compared with|compared to|than|versus|vs\.?|record high|record low|highest|lowest|more than|less than|fewer than|over the past|in the past|over \d+ years|\d+ years ago|decade\w*|centur\w*|previously|earlier|historical|historic|history|longest|largest|smallest|fastest|slowest|again|return\w*|still|already|new record|all.time)\b", re.I)
PUBLIC_INTEREST = re.compile(r"\b(?:government|minister\w*|president|prime minister|parliament|congress|senate|court|judge|police|law\w*|policy|regulat\w*|election\w*|vote\w*|council|councillor|mayor|public|taxpayer\w*|health|nhs|hospital\w*|doctor\w*|patient\w*|school\w*|universit\w*|education|climate|carbon|environment|energy|econom\w*|inflation|interest rates|housing|rent\w*|mortgage\w*|jobs|employment|unemployment|war|conflict|military|defen[cs]e|border\w*|migration|asylum|rights|crime|security|infrastructure|transport|rail|airport\w*|water|food|poverty|inequalit\w*|public service\w*)\b", re.I)
ORIGINALITY = re.compile(r"\b(?:exclusive (?:interview|report|investigation|access|extract|reveal|documents?)|special report|our analysis|documents? obtained|records? obtained|leaked documents?|internal memo|internal documents?|foi|freedom of information|first.hand account|interview with|original analysis|independent analysis|data obtained|dataset assembled|our reporting|our investigation|investigation reveals|investigation found)\b", re.I)
EXPLANATORY = re.compile(r"\b(?:explained|explainer|analysis|guide to|guide|how to|the science behind|what (?:it|this|that|a new|the) means for|why .{1,75} matter\w*|how .{1,75} works|how .{1,55} affect\w*|what causes|what drives|what is behind|how it works|what the evidence says|what happens now|what comes next|inside the (?:control room|laboratory|lab|factory|power station|hospital|courtroom|data centre|data center))\b", re.I)

# Attention packaging is deliberately split. Explicit curiosity gaps withhold or
# tease information; direct-address/service packaging is search/capture framing
# that may still be useful; sensational/personal framing is a separate failure mode.
EXPLICIT_CURIOSITY = re.compile(r"(?:\b(?:can you guess|you won't believe|you won't expect|the one thing|the truth about|the secret of|secret behind|what happened to|find out why|big clue|guess who|the (?:incredible|shocking|surprising|strange|weird|unexpected|bizarre|real|simple) reason|what they don't tell you|what nobody tells you|what no one tells you)\b|(?:\.\.\.|…)\s*$)", re.I)
DIRECT_SERVICE_PACKAGING = re.compile(r"(?:\b(?:how to|how you can|what you need to know|all you need to know|here's how|here is how|here's what|here is what|here's why|here is why|why you|what you|can you|could you|should you|you should|you can|do you|are you|is your|your)\b)", re.I)
LEGACY_BAIT = re.compile(r"(?:\b(?:can you guess|you won't believe|you won't expect|here's what|here is what|what you need to know|all you need to know|the one thing|the truth about|the secret of|secret behind|what happened to|find out why|take a look|big clue|here's why|here is why|what we know|what does it mean|what's really going on|is this the|could this be|do you remember|remember when|guess who|meet the|the (?:incredible|shocking|surprising|strange|weird|unexpected|bizarre)? ?reason|reason (?:why|you|they|it)|what they don't tell you|what nobody tells you|what no one tells you)\b|\b(?:YOU|YOUR)\b|\.\.\.|…)", re.I)
SENSATIONAL = re.compile(r"\b(?:shocking|shock|horrific|terrifying|furious|outrage|outrageous|bombshell|stunning|stuns|jaw.dropping|unbelievable|bizarre|brutal|nightmare|explosive|savage|slams|blasts|destroys|humiliat\w*|devastat\w*|heartbreak\w*|astonish\w*|sensational|scandal\w*|meltdown|sickening|gruesome|horrifying|horrendous|bonkers|frenzy|panic|mayhem|crushing|rips into|tears into|under fire|fury as|sparks fury|sparks outrage|sex scandal|shameful|disgraceful)\b", re.I)
PERSONAL_LIFE = re.compile(r"\b(?:dating|relationship\w*|marriage|married|divorc\w*|affair\w*|girlfriend|boyfriend|husband|wife|ex.wife|ex.husband|son|daughter|children|kids|family|pregnan\w*|baby|babies|romance|breakup|split|love life|sex life|wedding|engaged|engagement|personal life|home life)\b", re.I)
CELEBRITY_CUE = re.compile(r"\b(?:celebrity|celebrit\w*|actor|actress|singer|model|reality star|tv star|hollywood star|pop star|rapper|influencer|footballer|royal|duchess|prince|princess|reality tv|showbiz|soap star|screen star|movie star|famous singer|famous actor)\b", re.I)
TEASER_VERBS = re.compile(r"\b(?:reveals?|opens up|shares?|admits?|confesses?|breaks silence|speaks out|teases?|hints?|spills?|unpacks?)\b", re.I)
ORG_HINT = re.compile(r"\b(?:government|department|ministry|court|parliament|congress|senate|police|NHS|WHO|UN|EU|FDA|CDC|Ofcom|Ofgem|ONS|CMA|SEC|FCA|FTC|NASA|ESA|ECB|IMF|World Bank|Supreme Court|High Court|House of Commons|White House|Downing Street|Bank of England|Federal Reserve|Treasury|Met Office)\b", re.I)
QUOTED_SPAN = re.compile(r"(?:\"[^\"\n]{2,180}\"|“[^”\n]{2,180}”|(?<![\w'])'[^'\n]*\s[^'\n]*'(?!\w))")

AMBIGUOUS_EVENT_WORDS = {'clear','clears','cleared','rule','rules','order','orders','pass','passes','passed','record','records','set','sets','open','opens'}
EVENT_CONTEXT_ACTIONS = re.compile(r"\b(?:court|courts|judge|judges|jury|prosecutors?|parliament|congress|senate|government|ministers?|council|regulators?|watchdogs?)\s+(?:rule|rules|ruled|orders?|clears?|cleared|blocks?|approves?|rejects?|passes|passed)\b", re.I)
SERVICE_TASK_FRAME = re.compile(r"^\s*(?:how to|how do|how can|can you|could you|should you|why you|what you need|what to know|here's how|here is how)\b", re.I)

def detect_event_action(title: str) -> int:
    # High-precision event verbs count directly. Ambiguous verbs such as "clear",
    # "rules" and "order" count only with an institutional actor, because they are
    # often nouns or user-task instructions. Service/task frames are explanatory,
    # not news events, even when they contain an action verb.
    if SERVICE_TASK_FRAME.search(title):
        return 0
    matches=list(EVENT_ACTIONS.finditer(title))
    for match in matches:
        term=match.group(0).casefold()
        if term not in AMBIGUOUS_EVENT_WORDS:
            return 1
    return int(bool(matches and EVENT_CONTEXT_ACTIONS.search(title)))

try:
    import pycountry
    country_names = [c.name for c in pycountry.countries]
    country_names += ['Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'America']
except Exception:
    country_names = ['Britain','England','Scotland','Wales','France','Germany','China','Russia','Ukraine','India','Australia','Canada','Japan','Israel','Iran','Brazil','Mexico','South Africa']
COUNTRY_RE = re.compile(r"\b(?:" + '|'.join(re.escape(x) for x in sorted(set(country_names), key=len, reverse=True)) + r")\b", re.I)
COUNTRY_ACRONYM_RE = re.compile(r"\b(?:UK|US|USA|UAE)\b")

DELIVERY_METRICS = ['event_clarity','quantified_specificity','time_place_anchor','causal_explanation','material_consequence','evidence_provenance','context_comparison','explanatory_framing','original_reporting_signal']
COMPOSITE_DELIVERY_METRICS = ['event_clarity','quantified_specificity','time_place_anchor','causal_explanation','material_consequence','evidence_provenance','context_comparison','explanatory_framing']
ATTENTION_METRICS = ['low_explicit_curiosity_gap','low_direct_service_packaging','low_sensational_personal']
VALUE_METRICS = COMPOSITE_DELIVERY_METRICS + ATTENTION_METRICS
FEATURES = [
    {'key':'event_clarity','label':'Explicit event / action','polarity':'positive','value':True,'description':'Specific event/action predicate. Independent of attention packaging so packaging is not double-counted.'},
    {'key':'quantified_specificity','label':'Quantified detail','polarity':'positive','value':True,'description':'Number, percentage, amount, age, count or other numeric detail.'},
    {'key':'time_place_anchor','label':'Time / place anchor','polarity':'positive','value':True,'description':'Explicit date/time/day or country/place anchor.'},
    {'key':'causal_explanation','label':'Causal relationship','polarity':'positive','value':True,'description':'Causal, consequence-linking or explicit relational language.'},
    {'key':'material_consequence','label':'Material consequences','polarity':'positive','value':True,'description':'Impacts, costs, risks, jobs, health, harm, benefits or material changes.'},
    {'key':'evidence_provenance','label':'Evidence specificity','polarity':'positive','value':True,'description':'Fractional cue: 0.5 for research/survey/study claims, 1.0 for primary artefacts such as documents, filings, audits, datasets, transcripts or court material.'},
    {'key':'context_comparison','label':'Context / comparison','polarity':'positive','value':True,'description':'Comparisons, trends, historical references, records or prior-period context.'},
    {'key':'explanatory_framing','label':'Explanatory / service framing','polarity':'positive','value':True,'description':'Explanation, guide, mechanism, why/how or explicit service-journalism framing; language presence only, not correctness.'},
    {'key':'original_reporting_signal','label':'Original-access cue','polarity':'positive','value':False,'description':'Explicit original-access/provenance cue: investigation reveals/found, exclusive interview/report/access, documents obtained, interview with, FOI or our-analysis. High precision, very low recall; diagnostic only because it is too sparse for stable source ordering.'},
    {'key':'low_explicit_curiosity_gap','label':'Explicit curiosity-gap incidence','polarity':'inverse','value':True,'description':'Stock clickbait phrases, explicit guessing/teasing or a trailing ellipsis; stored inverse is used in the composite, exported incidence is adverse.'},
    {'key':'low_direct_service_packaging','label':'Direct-address/service packaging incidence','polarity':'inverse','value':True,'description':'How-to/you/your/search-capture framing. Often useful service journalism, but still a packaging/aggregation style; stored inverse is used in the composite.'},
    {'key':'low_sensational_personal','label':'Sensational / personal framing incidence','polarity':'inverse','value':True,'description':'Strong sensational vocabulary or celebrity/personal-life teaser framing; stored inverse is used in the composite.'},
]
ECHO_FEATURE = {'key':'cross_source_title_echo','label':'Near-identical cross-source headline','polarity':'adverse','value':False,'description':'Near-identical title match at character n-gram cosine similarity above threshold; diagnostic only, excluded from the composite.'}
RADAR_FEATURES = FEATURES + [ECHO_FEATURE]
FEATURE_KEYS = [x['key'] for x in FEATURES]


def normalize(s: str) -> str:
    s = unicodedata.normalize('NFKC', str(s))
    s = s.replace('’', "'").replace('‘', "'").replace('“','"').replace('”','"')
    return re.sub(r'\s+', ' ', s).strip()


def resolve_repo_path(value) -> Path:
    p = Path(value)
    return p if p.is_absolute() else REPO_ROOT / p


def load_config(args):
    cfg = {}
    config_path = resolve_repo_path(args.config) if args.config else DEFAULT_CONFIG
    if config_path.exists():
        cfg = json.loads(config_path.read_text())
    analysis = dict(cfg.get('analysis', {}))
    if args.zip: analysis['input_zip'] = str(args.zip)
    if args.out: analysis['output_dir'] = str(args.out)
    if args.topics is not None: analysis['topics'] = args.topics
    if args.folds is not None: analysis['folds'] = args.folds
    if args.bootstrap is not None: analysis['bootstrap'] = args.bootstrap
    analysis.setdefault('input_zip', '.working/source-headlines-analysis.zip')
    analysis.setdefault('output_dir', 'docs/headline-data/current')
    analysis.setdefault('topics', 22)
    analysis.setdefault('topic_min_df', 4)
    analysis.setdefault('folds', 4)
    analysis.setdefault('bootstrap', 250)
    analysis.setdefault('min_source_n', 20)
    analysis.setdefault('random_seed', 27)
    analysis.setdefault('nearest_neighbors', 8)
    analysis.setdefault('cross_source_similarity_threshold', 0.82)
    analysis.setdefault('shrinkage_grid', [10, 25, 50])
    analysis.setdefault('default_shrinkage', 25)
    analysis['config_path'] = str(config_path)
    analysis['input_zip_path'] = str(resolve_repo_path(analysis['input_zip']))
    analysis['output_dir_path'] = str(resolve_repo_path(analysis['output_dir']))
    return analysis


def parse_archive(zip_path: Path):
    rows=[]
    with zipfile.ZipFile(zip_path) as zf:
        names=set(zf.namelist())
        if 'headline-rows.jsonl' in names:
            for line in zf.read('headline-rows.jsonl').decode('utf-8', errors='replace').splitlines():
                if line.strip(): rows.append(json.loads(line))
            df=pd.DataFrame(rows)
            for col,default in [
                ('source_key',''),('tree_root',''),('tree_root_id','uncurated'),('branch_path',''),('curated_group',''),
                ('profile_kind',''),('profile_model',''),('profile_ownership',''),('url',''),('published',''),('story_id',''),
                ('category',''),('story_type',''),('plugin',''),('first_seen',''),('last_seen',''),('last_updated',''),('body_text','')]:
                if col not in df: df[col]=default
                df[col]=df[col].fillna(default)
            df['headline']=df['headline'].map(normalize)
            df['body_text']=df['body_text'].map(normalize)
            if 'word_count' in df:
                df=df.rename(columns={'word_count':'story_word_count'})
            df['source_key']=np.where(df['source_key'].astype(str).str.len()>0,df['source_key'],df['source'])
            df['group']=np.where(df['curated_group'].astype(str).str.len()>0,df['curated_group'],df['tree_root'])
            df['group_file']='headline-rows.jsonl'
        else:
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
            df['source_key']=df['source']
            for col in ['tree_root','tree_root_id','branch_path','curated_group','profile_kind','profile_model','profile_ownership','url','published','story_id','category','story_type','plugin','first_seen','last_seen','last_updated','body_text']:
                df[col]=''
            df['tree_root']=df['group']
            df['tree_root_id']=df['group_file'].str.replace(r'^\d+-','',regex=True).str.replace('.md','',regex=False)
            df['curated_group']=df['group']
    if 'profiled' not in df:
        df['profiled']=False
    else:
        df['profiled']=df['profiled'].fillna(False).astype(bool)
    df['editorial_context']=np.where(df['profile_kind'].astype(str).str.len()>0,df['profile_kind'],df['tree_root'])
    df['editorial_context']=df['editorial_context'].replace('', 'uncurated')
    df['tree_root_id']=df['tree_root_id'].replace('', 'uncurated')

    def neutral_context(row):
        text=' '.join(str(row.get(c,'')) for c in ['tree_root','branch_path','curated_group','profile_kind']).casefold()
        root=str(row.get('tree_root','')) or 'uncurated'
        if 'gaming press' in text or 'games publication' in text or 'gaming' in text:
            return 'gaming and entertainment specialist press'
        if 'science' in text or 'medical/health research' in text or 'health press' in text:
            return 'science and health specialist press'
        if 'technology press' in text or 'tech journalism' in text:
            return 'technology specialist press'
        if 'business' in text or 'financial' in text or 'money' in text:
            return 'business and finance specialist press'
        if 'local media' in text or 'regional' in text:
            return 'local and regional news'
        if 'platform' in text or 'aggregator' in text or 'developer community' in text:
            return 'platforms and aggregators'
        if 'state-controlled' in text or 'state-linked' in text or 'state media' in text:
            return 'state-linked media'
        if 'wire' in text or 'press-release' in text or 'official organization' in text:
            return 'wires releases and official organisations'
        if 'national' in text or 'newspaper' in text or 'broadcaster' in text or 'public' in text:
            return 'general national and international news'
        return root or 'uncurated'

    df['neutral_editorial_context']=df.apply(neutral_context,axis=1).replace('', 'uncurated')
    df['published_dt']=pd.to_datetime(df['published'].replace('', pd.NA), errors='coerce', utc=True, format='mixed')
    return df


def apply_measurement_groups(df: pd.DataFrame, groups):
    df['member_source_key']=df['source_key']
    df['member_source']=df['source']
    df['measurement_grouped']=False
    for group in groups or []:
        members=set(group.get('sources',[]))
        if not members: continue
        mask=df['source_key'].isin(members)
        if not mask.any(): continue
        df.loc[mask,'source_key']=group['key']
        df.loc[mask,'source']=group.get('label') or group['key']
        df.loc[mask,'measurement_grouped']=True
    return df


def detect_one(title: str, nlp):
    doc=nlp(title)
    tokens=[t for t in doc if not t.is_space]
    words=[t for t in tokens if t.is_alpha]
    cap_tokens=[]
    for i,t in enumerate(tokens):
        if t.text.isupper() and len(t.text)>1:
            cap_tokens.append(t.text)
        elif t.text[:1].isupper() and t.text[1:].islower() and i>0:
            cap_tokens.append(t.text)
    cap_multi = len(re.findall(r"\b[A-Z][a-z]+(?:\s+(?:of|the|and|[A-Z][a-z]+)){1,4}\b", title))
    acronym = len(re.findall(r"\b[A-Z]{2,}(?:\d+)?\b", title))
    named_entity = int(cap_multi>0 or acronym>0 or ORG_HINT.search(title) is not None)

    event_action = detect_event_action(title)
    numeric = int(NUMERIC.search(title) is not None)
    time_place = int(TIME_PLACE.search(title) is not None or COUNTRY_RE.search(title) is not None or COUNTRY_ACRONYM_RE.search(title) is not None)
    causal = int(CAUSAL.search(title) is not None)
    consequence = int(CONSEQUENCE.search(title) is not None)
    context = int(CONTEXT.search(title) is not None)
    public = int(PUBLIC_INTEREST.search(title) is not None)
    original = int(ORIGINALITY.search(title) is not None)
    explanatory = int(EXPLANATORY.search(title) is not None)
    primary_evidence = bool(PRIMARY_EVIDENCE.search(title))
    research_claim = bool(RESEARCH_CLAIM.search(title))
    evidence_score = 1.0 if primary_evidence else 0.5 if research_claim else 0.0

    explicit_gap = int(EXPLICIT_CURIOSITY.search(title) is not None)
    packaging_text = QUOTED_SPAN.sub(' ', title)
    direct_service = int(DIRECT_SERVICE_PACKAGING.search(packaging_text) is not None)
    legacy_bait = int(LEGACY_BAIT.search(title) is not None)
    question = int('?' in title)
    personal = bool(PERSONAL_LIFE.search(title))
    celebrity = bool(CELEBRITY_CUE.search(title))
    sens = bool(SENSATIONAL.search(title))
    teaser_verb=bool(TEASER_VERBS.search(title))
    lifestyle_detail = bool(re.search(r"\b(?:flaunts?|pos(?:es|ed|ing) for|bikini|outfit|fashion|red carpet|rare photo|rare snap|snapshots?|love life|sex life|cosmetic surgery|plastic surgery|steps out|inside .* home)\b", title, re.I))
    intimate_lifestyle_detail = bool(re.search(r"\b(?:bikini|red carpet|rare photo|rare snap|love life|sex life|weight loss|weight gain|cosmetic surgery|plastic surgery|steps out|inside .* home|holiday snaps)\b", title, re.I))
    person_name_proxy = cap_multi>0
    personal_sensational = int(sens or (personal and (celebrity or lifestyle_detail or (person_name_proxy and teaser_verb))) or (celebrity and lifestyle_detail) or (person_name_proxy and intimate_lifestyle_detail))
    direct_service = int(bool(direct_service))

    n_words=len(words)
    teaser_verb=int(teaser_verb)
    title_case_entity_count = len(cap_tokens) + cap_multi + acronym
    raw = [event_action,numeric,time_place,causal,consequence,evidence_score,context,explanatory,1-explicit_gap,1-direct_service,1-personal_sensational]
    legacy_raw = [int(event_action and not legacy_bait),numeric,time_place,causal,consequence,int(evidence_score>0),context,original,explanatory,1-legacy_bait,1-personal_sensational]
    return {
        'word_count':n_words,'char_count':len(title),'event_action_present':event_action,
        'named_entity_proxy':named_entity,'capitalised_entity_count_proxy':title_case_entity_count,
        'teaser_verb_present':teaser_verb,'explicit_curiosity_gap_present':explicit_gap,
        'direct_service_packaging_present':direct_service,'legacy_bait_present':legacy_bait,
        'question_form_present':question,'sensational_word_present':int(sens),
        'personal_life_frame_present':int(personal),'personal_sensational_frame_present':personal_sensational,
        'celebrity_cue_present':int(celebrity),'attribution_present':int(ATTRIBUTION.search(title) is not None),
        'anonymous_source_cue':int(ANONYMOUS_SOURCE.search(title) is not None),
        'primary_evidence_cue':int(primary_evidence),'research_claim_cue':int(research_claim),
        'evidence_strength':int(2 if primary_evidence else 1 if research_claim else 0),
        'event_clarity':event_action,'named_entity_signal':named_entity,'quantified_specificity':numeric,
        'time_place_anchor':time_place,'causal_explanation':causal,'material_consequence':consequence,
        'evidence_provenance':evidence_score,'context_comparison':context,'public_interest':public,
        'original_reporting_signal':original,'explanatory_framing':explanatory,
        'low_explicit_curiosity_gap':1-explicit_gap,'low_direct_service_packaging':1-direct_service,
        'low_sensational_personal':1-personal_sensational,
        'title_value_signal_raw':float(np.mean(raw)),
        'legacy_title_value_signal_raw':float(np.mean(legacy_raw)),
    }


def topic_model(df: pd.DataFrame, n_topics=22, min_df=4, seed=27):
    vec=TfidfVectorizer(stop_words='english', ngram_range=(1,2), min_df=min_df,
                        max_df=0.88, max_features=26000, sublinear_tf=True,
                        strip_accents='unicode')
    X=vec.fit_transform(df['headline'].tolist())
    n_topics=min(n_topics, max(5, X.shape[1]//10), X.shape[0]-1)
    nmf=NMF(n_components=n_topics, init='nndsvda', random_state=seed,
            max_iter=320, l1_ratio=0.05, alpha_W=0.00005, alpha_H=0.00005)
    W=nmf.fit_transform(X)
    W=W/(W.sum(axis=1,keepdims=True)+1e-12)
    terms=np.array(vec.get_feature_names_out())
    topics=[]
    for k, comp in enumerate(nmf.components_):
        top=terms[np.argsort(comp)[-10:][::-1]].tolist()
        topics.append({'topic':int(k),'terms':top})
    return W, topics, vec, nmf


def crossfit_expected(df: pd.DataFrame, W, feature_cols, folds=4, seed=27, context_fields=None, adjust_title_length=True):
    """Cross-fit expected detector rates by source groups, not in-source rows.

    Topic mixture plus coarse behaviour-neutral context predicts each detector.
    GroupKFold by source means a source's own headlines do not train the expectation
    used to residualise that source. This reduces in-sample absorption of real differences.
    """
    context_fields=context_fields or ['tree_root_id','neutral_editorial_context']
    context=df[context_fields].copy()
    for c in context.columns:
        context[c]=context[c].fillna('').replace('', 'uncurated').astype(str)
    enc = OneHotEncoder(handle_unknown='ignore')
    G = enc.fit_transform(context)
    numeric_parts=[]
    if adjust_title_length and 'word_count' in df:
        length=np.log1p(df['word_count'].astype(float).to_numpy()).reshape(-1,1)
        sd=length.std()
        if sd>1e-8: length=(length-length.mean())/sd
        numeric_parts.append(csr_matrix(length))
    Xctx = hstack([csr_matrix(W), *numeric_parts, G], format='csr')
    Y = df[feature_cols].to_numpy(dtype=float)
    expected = np.zeros_like(Y)
    groups = df['source_key'].astype(str).to_numpy()
    n_splits=max(2,min(int(folds),len(np.unique(groups))))
    splitter=GroupKFold(n_splits=n_splits)
    for train_ix,test_ix in splitter.split(Xctx,Y,groups):
        for j in range(Y.shape[1]):
            model=Ridge(alpha=8.0)
            model.fit(Xctx[train_ix],Y[train_ix,j])
            expected[test_ix,j]=np.clip(model.predict(Xctx[test_ix]),0.0,1.0)
    return expected


def normalised_title_for_match(title):
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', title.casefold())).strip()


def headline_reuse_proxy(df, n_neighbors=8, threshold=0.82):
    texts=[normalised_title_for_match(t) for t in df['headline'].tolist()]
    v=TfidfVectorizer(analyzer='char_wb', ngram_range=(3,5), min_df=2,
                      max_features=30000, sublinear_tf=True)
    X=v.fit_transform(texts)
    nn=NearestNeighbors(n_neighbors=min(n_neighbors,len(texts)), metric='cosine', algorithm='brute', n_jobs=-1)
    nn.fit(X)
    d, ix=nn.kneighbors(X)
    sources=df['source_key'].astype(str).to_numpy()
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
            nearest_source[i]=df.iloc[best[1]]['source']
            nearest_title[i]=df.iloc[best[1]]['headline']
    df['cross_source_title_similarity']=max_cross
    df['cross_source_near_duplicate_proxy']=(max_cross>=threshold).astype(int)
    df['cross_source_title_echo']=df['cross_source_near_duplicate_proxy']
    df['cross_source_nearest_source']=nearest_source
    df['cross_source_nearest_headline']=nearest_title
    return df


def add_within_source_template_proxy(df):
    stop=set(ENGLISH_STOP_WORDS)
    repeated=np.zeros(len(df),dtype=int)
    for source, positions in df.groupby('source_key',sort=False).indices.items():
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
        min_count=max(3,int(math.ceil(len(positions)*0.02)))
        common={g for g,c in counts.items() if c>=min_count}
        for pset,pos in zip(per_title,positions):
            repeated[pos]=int(bool(pset & common))
    df['within_source_repeated_trigram_proxy']=repeated
    return df


def source_phrase_signatures(df, out_path: Path, min_source_n=30, min_phrase_count=3, top_k=20):
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
        if n_s < min_source_n: continue
        source_counts = np.asarray(X[positions].sum(axis=0)).ravel().astype(float)
        other_counts = global_counts - source_counts
        n_o = N - n_s
        denom_s = np.maximum(n_s - source_counts + alpha0 - alpha, 1e-9)
        denom_o = np.maximum(n_o - other_counts + alpha0 - alpha, 1e-9)
        delta = np.log((source_counts + alpha) / denom_s) - np.log((other_counts + alpha) / denom_o)
        var = 1.0/(source_counts + alpha) + 1.0/denom_s + 1.0/(other_counts + alpha) + 1.0/denom_o
        z = delta / np.sqrt(var)
        eligible = np.where(source_counts >= min_phrase_count)[0]
        if len(eligible) == 0: continue
        top = eligible[np.argsort(z[eligible])[-top_k:][::-1]]
        for j in top:
            rows.append({'source': source, 'n_headlines': n_s, 'phrase': terms[j],
                         'source_doc_count': int(source_counts[j]),
                         'source_share': float(source_counts[j]/n_s),
                         'corpus_share': float(global_counts[j]/N),
                         'weighted_log_odds_z': float(z[j])})
    pd.DataFrame(rows).to_csv(out_path, index=False)


def composite_for_shrink(src, shrink, min_n):
    out=src.copy()
    zcols=[]
    eligible=out['n']>=min_n
    for col in VALUE_METRICS:
        residual_col=col+'_index_residual' if col+'_index_residual' in out else col+'_residual'
        adj=100*out[residual_col]*(out['n']/(out['n']+float(shrink)))
        tmp=adj.astype(float)
        mu=float(tmp[eligible].mean())
        sd=float(tmp[eligible].std(ddof=1))
        if sd<=1e-8: sd=1.0
        out[col+'_relative_z']=(tmp-mu)/sd
        zcols.append(col+'_relative_z')
    out['topic_adjusted_value_index']=(50+15*out[zcols].clip(-3,3).mean(axis=1)).clip(0,100)
    order=out.loc[out['n']>=min_n].sort_values('topic_adjusted_value_index',ascending=False).index
    out['rank']=np.nan
    out.loc[order,'rank']=np.arange(1,len(order)+1)
    return out


def band_from_rank(rank, eligible_count):
    if not np.isfinite(rank): return 'Unranked'
    pct=rank/max(eligible_count,1)
    if pct<=0.25: return 'A — upper quartile'
    if pct<=0.50: return 'B — second quartile'
    if pct<=0.75: return 'C — third quartile'
    return 'D — lower quartile'


def source_statistics(df, expected, min_source_n=20, shrinkage=25, shrinkage_grid=(10,25,50), bootstrap=250, seed=27, attention_context_adjustment=0.25):
    g=df.groupby('source_key', sort=False)
    src=g.agg(source=('source',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              n=('headline','size'),
              group=('group',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              tree_root=('tree_root',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              editorial_context=('editorial_context',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              neutral_editorial_context=('neutral_editorial_context',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              measurement_members=('member_source',lambda x:'; '.join(sorted(set(map(str,x))))),
              measurement_member_keys=('member_source_key',lambda x:';'.join(sorted(set(map(str,x))))),
              icon_source_key=('member_source_key',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              measurement_grouped=('measurement_grouped','max'),
              mean_words=('word_count','mean'), title_value_raw=('title_value_signal_raw','mean'),
              legacy_title_value_raw=('legacy_title_value_signal_raw','mean'),
              delivery_signal_mean=('information_delivery_signal','mean'),
              delivery_signal_median=('information_delivery_signal','median'),
              delivery_signal_p25=('information_delivery_signal',lambda x:x.quantile(.25)),
              delivery_signal_p75=('information_delivery_signal',lambda x:x.quantile(.75)),
              delivery_signal_p90=('information_delivery_signal',lambda x:x.quantile(.90)),
              delivery_share_le20=('information_delivery_signal',lambda x:(x<=20).mean()),
              delivery_share_ge44=('information_delivery_signal',lambda x:(x>=44.444444).mean()),
              attention_pressure_mean=('attention_packaging_pressure','mean'),
              body_coverage_rate=('body_coverage_present','mean'), body_word_count_mean=('body_word_count','mean'),
              body_primary_evidence_rate=('body_primary_evidence_cue','mean'), body_research_claim_rate=('body_research_claim_cue','mean'),
              body_event_action_rate=('body_event_action_cue','mean'), body_explanatory_rate=('body_explanatory_cue','mean'),
              within_source_template_reuse_rate=('within_source_repeated_trigram_proxy','mean'),
              attribution_cue_rate=('attribution_present','mean'), anonymous_source_cue_rate=('anonymous_source_cue','mean'),
              cross_source_near_duplicate_rate=('cross_source_near_duplicate_proxy','mean'),
              mean_cross_source_similarity=('cross_source_title_similarity','mean'),
              first_published=('published_dt','min'), last_published=('published_dt','max')).reset_index()
    span=(src['last_published']-src['first_published']).dt.total_seconds()/86400
    src['published_span_days']=span.fillna(0).round(2)
    src['headlines_per_week']=np.where(src['published_span_days']>1,src['n']/(src['published_span_days']/7),np.nan)

    rows=[]
    for source_key, idx in g.indices.items():
        idx=np.asarray(idx)
        n=len(idx)
        r={'source_key':source_key}
        for fi,col in enumerate(FEATURE_KEYS):
            obs=float(df.iloc[idx][col].mean())
            exp=float(expected[idx,fi].mean())
            r[col+'_rate']=obs
            r[col+'_expected_context']=exp
            r[col+'_residual']=obs-exp
        rows.append(r)
    metrics=pd.DataFrame(rows)
    src=src.merge(metrics,on='source_key',how='left')
    entity_rates = g['named_entity_signal'].mean().rename('named_entity_signal_rate').reset_index()
    public_rates = g['public_interest'].mean().rename('public_interest_rate').reset_index()
    research_rates = g['research_claim_cue'].mean().rename('research_claim_cue_rate').reset_index()
    primary_rates = g['primary_evidence_cue'].mean().rename('primary_evidence_cue_rate').reset_index()
    src = src.merge(entity_rates,on='source_key',how='left').merge(public_rates,on='source_key',how='left').merge(research_rates,on='source_key',how='left').merge(primary_rates,on='source_key',how='left')
    src['explicit_curiosity_gap_incidence_rate'] = 1.0 - src['low_explicit_curiosity_gap_rate']
    src['direct_service_packaging_incidence_rate'] = 1.0 - src['low_direct_service_packaging_rate']
    src['sensational_personal_incidence_rate'] = 1.0 - src['low_sensational_personal_rate']

    # Delivery markers are fully topic/context-adjusted. Attention packaging is only
    # partly forgiven by context: the rest is compared with the corpus-wide incidence,
    # because attention farming is a publisher behaviour rather than an inevitable
    # consequence of covering a topic. This keeps high absolute sensational/service
    # pressure visible in the composite instead of treating it as genre-normal.
    attention_lambda=float(attention_context_adjustment)
    attention_corpus_mean={c:float(df[c].mean()) for c in ATTENTION_METRICS}
    for col in VALUE_METRICS:
        if col in ATTENTION_METRICS:
            topic_part=src[col+'_residual']
            absolute_part=src[col+'_rate']-attention_corpus_mean[col]
            src[col+'_index_residual']=attention_lambda*topic_part+(1.0-attention_lambda)*absolute_part
        else:
            src[col+'_index_residual']=src[col+'_residual']

    # Default composite and sensitivity grid.
    sensitivity=[]
    base=None
    for shrink in shrinkage_grid:
        comp=composite_for_shrink(src,shrink,min_source_n)
        if float(shrink)==float(shrinkage): base=comp
        sensitivity.append((shrink,comp))
    if base is None:
        base=composite_for_shrink(src,shrinkage,min_source_n)
        sensitivity.append((shrinkage,base))
    for col in VALUE_METRICS:
        factor=src['n']/(src['n']+float(shrinkage))
        src[col+'_adjusted_pp']=100*src[col+'_index_residual']*factor
    for col in ['topic_adjusted_value_index','rank']+[c+'_relative_z' for c in VALUE_METRICS]:
        src[col]=base[col]

    sens_rows=[]
    for shrink,comp in sensitivity:
        for _,row in comp[['source_key','source','n','topic_adjusted_value_index','rank']].iterrows():
            sens_rows.append({'source_key':row['source_key'],'source':row['source'],'n':row['n'],'shrinkage':shrink,
                              'topic_adjusted_value_index':row['topic_adjusted_value_index'],'rank':row['rank']})
    sensitivity_df=pd.DataFrame(sens_rows)

    # Bootstrap intervals for the default composite: headline sampling uncertainty only.
    rng=np.random.default_rng(seed)
    eligible=src['n']>=min_source_n
    resid_mu=np.array([float(src.loc[eligible,c+'_adjusted_pp'].mean()) for c in VALUE_METRICS])
    resid_sd=np.array([max(float(src.loc[eligible,c+'_adjusted_pp'].std(ddof=1)),1e-8) for c in VALUE_METRICS])
    ci_low=np.full(len(src),np.nan); ci_high=np.full(len(src),np.nan)
    src_index={key:i for i,key in enumerate(src['source_key'])}
    if int(bootstrap)>0:
        for source_key, positions in g.indices.items():
            row_i=src_index[source_key]
            n=len(positions)
            if n<min_source_n: continue
            pos=np.asarray(positions,dtype=int)
            value_ix=[FEATURE_KEYS.index(c) for c in VALUE_METRICS]
            Ysrc=df.iloc[pos][VALUE_METRICS].to_numpy(dtype=float)
            Esrc=expected[pos][:,value_ix]
            boot_ix=rng.integers(0,n,size=(int(bootstrap),n))
            obs_b=Ysrc[boot_ix].mean(axis=1)
            exp_b=Esrc[boot_ix].mean(axis=1)
            resid_b=obs_b-exp_b
            for j,col in enumerate(VALUE_METRICS):
                if col in ATTENTION_METRICS:
                    resid_b[:,j]=attention_lambda*(obs_b[:,j]-exp_b[:,j])+(1.0-attention_lambda)*(obs_b[:,j]-attention_corpus_mean[col])
            adj_b=100.0*resid_b*(n/(n+float(shrinkage)))
            z_b=(adj_b-resid_mu)/resid_sd
            score_b=np.clip(50.0+15.0*np.clip(z_b,-3,3).mean(axis=1),0,100)
            ci_low[row_i],ci_high[row_i]=np.quantile(score_b,[0.025,0.975])
    src['topic_adjusted_index_ci95_low']=ci_low
    src['topic_adjusted_index_ci95_high']=ci_high

    src['raw_title_signal_index']=100*src['title_value_raw']
    src['legacy_raw_title_signal_index']=100*src['legacy_title_value_raw']
    src['rank_eligible']=src['n']>=min_source_n
    src['confidence_tier']=np.select([src['n']>=100,src['n']>=50,src['n']>=min_source_n],['High sample volume','Moderate sample volume','Limited sample volume'],default=f'Insufficient sample (<{min_source_n})')
    eligible_count=int(src['rank_eligible'].sum())
    src['ordering_band']=[band_from_rank(r,eligible_count) for r in src['rank']]
    for threshold,rank_col in [(50,'rank_n50'),(100,'rank_n100')]:
        order=src.loc[src['n']>=threshold].sort_values('topic_adjusted_value_index',ascending=False).index
        src[rank_col]=np.nan
        src.loc[order,rank_col]=np.arange(1,len(order)+1)
    src=src.sort_values(['rank_eligible','topic_adjusted_value_index','n'],ascending=[False,False,False]).reset_index(drop=True)
    return src,sensitivity_df


def make_radar(src, output_html: Path):
    axes=[x['label'] for x in RADAR_FEATURES]
    eligible=src[src['rank_eligible']].sort_values('rank')
    if len(eligible)==0: return
    def radar_value(row, key):
        if key=='low_explicit_curiosity_gap': return 100*row['explicit_curiosity_gap_incidence_rate']
        if key=='low_direct_service_packaging': return 100*row['direct_service_packaging_incidence_rate']
        if key=='low_sensational_personal': return 100*row['sensational_personal_incidence_rate']
        if key=='cross_source_title_echo': return 100*row['cross_source_near_duplicate_rate']
        return 100*row[key+'_rate']
    traces=[]
    for _,r in eligible.iterrows():
        vals=[float(radar_value(r,x['key'])) for x in RADAR_FEATURES]
        traces.append(go.Scatterpolar(r=vals+[vals[0]],theta=axes+[axes[0]],
                        fill='toself',name=f"{int(r['rank'])}. {r['source']} (n={int(r['n'])})",
                        visible=False,opacity=0.65,
                        hovertemplate='%{theta}: %{r:.1f}%<extra>'+html.escape(str(r['source']))+'</extra>'))
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
        showlegend=False, height=820, width=1080,
        updatemenus=[dict(type='dropdown',direction='down',x=0.02,y=1.13,
                          buttons=buttons,showactive=True)],
        margin=dict(t=145,b=80,l=80,r=80),
        annotations=[dict(text='Axes are occurrence rates. The final four axes are adverse/diagnostic, so lower is better. Evidence specificity is fractional (research claim = 0.5, primary artefact = 1.0). Title-language signals only.',
                          x=0.5,y=-0.11,xref='paper',yref='paper',showarrow=False,font=dict(size=11))])
    fig.write_html(output_html,include_plotlyjs=True,full_html=True)


def detector_audit_sample(df, out_path, seed=27, per_stratum=30):
    rng=np.random.default_rng(seed)
    rows=[]
    strata=[
        ('explicit_curiosity_gap',df['explicit_curiosity_gap_present'].eq(1)),
        ('direct_service_packaging',df['direct_service_packaging_present'].eq(1)),
        ('sensational_personal',df['personal_sensational_frame_present'].eq(1)),
        ('evidence_primary',df['primary_evidence_cue'].eq(1)),
        ('evidence_research_only',df['research_claim_cue'].eq(1)&df['primary_evidence_cue'].eq(0)),
        ('unflagged',df[['explicit_curiosity_gap_present','direct_service_packaging_present','personal_sensational_frame_present']].sum(axis=1).eq(0)),
    ]
    for label,mask in strata:
        ix=np.flatnonzero(mask.to_numpy())
        if len(ix)==0: continue
        take=rng.choice(ix,size=min(per_stratum,len(ix)),replace=False)
        for i in take:
            r=df.iloc[int(i)]
            rows.append({'stratum':label,'source':r['source'],'headline':r['headline'],'url':r.get('url',''),
                         'explicit_curiosity_gap_present':r['explicit_curiosity_gap_present'],
                         'direct_service_packaging_present':r['direct_service_packaging_present'],
                         'personal_sensational_frame_present':r['personal_sensational_frame_present'],
                         'evidence_strength':r['evidence_strength'],'human_label':'','human_notes':''})
    pd.DataFrame(rows).drop_duplicates(subset=['source','headline']).to_csv(out_path,index=False)


def main():
    started=time.perf_counter()
    stage_times={}
    def mark(name,t0):
        stage_times[name]=round(time.perf_counter()-t0,3)
        return time.perf_counter()

    ap=argparse.ArgumentParser()
    ap.add_argument('--config',type=Path,default=DEFAULT_CONFIG)
    ap.add_argument('--zip',type=Path)
    ap.add_argument('--out',type=Path)
    ap.add_argument('--topics',type=int)
    ap.add_argument('--folds',type=int)
    ap.add_argument('--bootstrap',type=int)
    args=ap.parse_args()
    cfg=load_config(args)
    zip_path=Path(cfg['input_zip_path'])
    out=Path(cfg['output_dir_path'])
    out.mkdir(parents=True,exist_ok=True)

    t=time.perf_counter()
    df=parse_archive(zip_path)
    df=apply_measurement_groups(df,cfg.get('measurement_groups'))
    df['headline_id']=np.arange(len(df))
    t=mark('parse_archive',t)

    nlp=spacy.blank('en')
    det=pd.DataFrame([detect_one(x,nlp) for x in df['headline']])
    df=pd.concat([df.reset_index(drop=True),det],axis=1)
    body=df['body_text'].fillna('').astype(str)
    df['body_word_count']=body.str.split().str.len()
    df['body_coverage_present']=(df['body_word_count']>df['word_count']+5).astype(int)
    df['body_primary_evidence_cue']=body.map(lambda x:int(PRIMARY_EVIDENCE.search(x) is not None))
    df['body_research_claim_cue']=body.map(lambda x:int(RESEARCH_CLAIM.search(x) is not None))
    df['body_evidence_strength']=np.select([df['body_primary_evidence_cue'].eq(1),df['body_research_claim_cue'].eq(1)],[2,1],default=0)
    df['body_event_action_cue']=body.map(lambda x:int(EVENT_ACTIONS.search(x) is not None))
    df['body_explanatory_cue']=body.map(lambda x:int(EXPLANATORY.search(x) is not None))
    t=mark('detectors',t)

    df=headline_reuse_proxy(df,n_neighbors=int(cfg['nearest_neighbors']),threshold=float(cfg['cross_source_similarity_threshold']))
    df=add_within_source_template_proxy(df)
    t=mark('headline_reuse_and_templates',t)

    W,topics,vec,nmf=topic_model(df,n_topics=int(cfg['topics']),min_df=int(cfg['topic_min_df']),seed=int(cfg['random_seed']))
    primary_length_adjustment=bool(cfg.get('adjust_title_length',False))
    expected=crossfit_expected(df,W,FEATURE_KEYS,folds=int(cfg['folds']),seed=int(cfg['random_seed']),context_fields=cfg.get('context_fields'),adjust_title_length=primary_length_adjustment)
    expected_length_adjusted=None
    if bool(cfg.get('length_adjusted_sensitivity',False)) and not primary_length_adjustment:
        expected_length_adjusted=crossfit_expected(df,W,FEATURE_KEYS,folds=int(cfg['folds']),seed=int(cfg['random_seed']),context_fields=cfg.get('context_fields'),adjust_title_length=True)
    df['dominant_topic']=W.argmax(axis=1)
    df['topic_strength']=W.max(axis=1)
    t=mark('topic_model_and_crossfit_expectations',t)

    df['information_delivery_signal']=100*df[DELIVERY_METRICS].mean(axis=1)
    df['attention_packaging_pressure']=100*df[['explicit_curiosity_gap_present','direct_service_packaging_present','personal_sensational_frame_present']].mean(axis=1)
    df['title_value_signal']=100*df[VALUE_METRICS].mean(axis=1)
    src,sensitivity_df=source_statistics(df,expected,min_source_n=int(cfg['min_source_n']),shrinkage=float(cfg['default_shrinkage']),
                                         shrinkage_grid=cfg['shrinkage_grid'],bootstrap=int(cfg['bootstrap']),seed=int(cfg['random_seed']),
                                         attention_context_adjustment=float(cfg.get('attention_context_adjustment',0.25)))
    if expected_length_adjusted is not None:
        src_len,_=source_statistics(df,expected_length_adjusted,min_source_n=int(cfg['min_source_n']),shrinkage=float(cfg['default_shrinkage']),
                                    shrinkage_grid=cfg['shrinkage_grid'],bootstrap=0,seed=int(cfg['random_seed']),
                                    attention_context_adjustment=float(cfg.get('attention_context_adjustment',0.25)))
        len_cols=['source_key','topic_adjusted_value_index','rank','rank_n50','rank_n100','ordering_band']
        len_suffix=src_len[len_cols].rename(columns={c:'length_adjusted_'+c for c in len_cols if c!='source_key'})
        src=src.merge(len_suffix,on='source_key',how='left')
    t=mark('source_statistics_and_bootstrap',t)

    df['body_text_excerpt']=df['body_text'].fillna('').astype(str).str.slice(0,600)
    story_cols=['headline_id','source_key','source','member_source_key','member_source','measurement_grouped','group','tree_root','branch_path','curated_group','editorial_context','neutral_editorial_context','group_file','headline','body_text_excerpt','url','published','story_id','category','story_type','word_count','story_word_count','information_delivery_signal','attention_packaging_pressure','title_value_signal','legacy_title_value_signal_raw','dominant_topic','topic_strength']
    story_cols += FEATURE_KEYS + ['cross_source_title_echo','event_action_present','named_entity_proxy','capitalised_entity_count_proxy','teaser_verb_present','explicit_curiosity_gap_present','direct_service_packaging_present','legacy_bait_present','question_form_present','sensational_word_present','personal_life_frame_present','personal_sensational_frame_present','celebrity_cue_present','attribution_present','anonymous_source_cue','primary_evidence_cue','research_claim_cue','evidence_strength','body_coverage_present','body_word_count','body_primary_evidence_cue','body_research_claim_cue','body_evidence_strength','body_event_action_cue','body_explanatory_cue','cross_source_title_similarity','cross_source_near_duplicate_proxy','cross_source_nearest_source','cross_source_nearest_headline','within_source_repeated_trigram_proxy']
    for col in story_cols:
        if col not in df: df[col]=''
    df[story_cols].to_csv(out/'headline_level_signals.csv',index=False)
    df.loc[df.cross_source_near_duplicate_proxy.eq(1), ['source','headline','cross_source_nearest_source','cross_source_nearest_headline','cross_source_title_similarity']].sort_values('cross_source_title_similarity',ascending=False).to_csv(out/'cross_source_title_matches.csv',index=False)
    src.to_csv(out/'source_rankings.csv',index=False)
    sensitivity_df.to_csv(out/'source_index_sensitivity.csv',index=False)
    source_phrase_signatures(df,out/'source_phrase_signatures.csv')
    story_dist_cols=['source_key','source','group','tree_root','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index','legacy_raw_title_signal_index','delivery_signal_mean','delivery_signal_median','delivery_signal_p25','delivery_signal_p75','delivery_signal_p90','delivery_share_le20','delivery_share_ge44','attention_pressure_mean','published_span_days','headlines_per_week']
    src[story_dist_cols].to_csv(out/'source_story_score_distributions.csv',index=False)

    # Compact axis export: positive rates plus explicit adverse incidences.
    src['explicit_curiosity_gap_expected_context'] = 1.0-src['low_explicit_curiosity_gap_expected_context']
    src['explicit_curiosity_gap_adjusted_pp'] = -src['low_explicit_curiosity_gap_adjusted_pp']
    src['direct_service_packaging_expected_context'] = 1.0-src['low_direct_service_packaging_expected_context']
    src['direct_service_packaging_adjusted_pp'] = -src['low_direct_service_packaging_adjusted_pp']
    src['sensational_personal_expected_context'] = 1.0-src['low_sensational_personal_expected_context']
    src['sensational_personal_adjusted_pp'] = -src['low_sensational_personal_adjusted_pp']
    profile_cols=['source_key','source','group','tree_root','n']
    profile_cols += [m+'_rate' for m in DELIVERY_METRICS]
    profile_cols += ['explicit_curiosity_gap_incidence_rate','direct_service_packaging_incidence_rate','sensational_personal_incidence_rate','cross_source_near_duplicate_rate']
    profile_cols += [m+'_expected_context' for m in COMPOSITE_DELIVERY_METRICS]
    profile_cols += ['explicit_curiosity_gap_expected_context','direct_service_packaging_expected_context','sensational_personal_expected_context']
    profile_cols += [m+'_adjusted_pp' for m in COMPOSITE_DELIVERY_METRICS]
    profile_cols += ['explicit_curiosity_gap_adjusted_pp','direct_service_packaging_adjusted_pp','sensational_personal_adjusted_pp']
    profile_cols += ['named_entity_signal_rate','public_interest_rate','research_claim_cue_rate','primary_evidence_cue_rate']
    profile_cols += ['body_coverage_rate','body_word_count_mean','body_primary_evidence_rate','body_research_claim_rate','body_event_action_rate','body_explanatory_rate']
    src[profile_cols].to_csv(out/'source_axis_profiles.csv',index=False)
    (out/'topic_model.json').write_text(json.dumps(topics,indent=2))
    topic_rows=[]
    for source_key,positions in df.groupby('source_key',sort=False).indices.items():
        shares=W[np.asarray(positions)].mean(axis=0)
        row={'source_key':source_key,'source':df.iloc[positions[0]]['source'],'n':len(positions)}
        row.update({f'topic_{k:02d}_share':float(v) for k,v in enumerate(shares)})
        topic_rows.append(row)
    pd.DataFrame(topic_rows).to_csv(out/'source_topic_profiles.csv',index=False)
    metric_docs=[]
    for f in RADAR_FEATURES:
        metric_docs.append({'key':f['key'],'label':f['label'],'polarity':f['polarity'],'included_in_composite':f['value'],'description':f['description']})
    (out/'metric_dictionary.json').write_text(json.dumps(metric_docs,indent=2))
    detector_audit_sample(df,out/'detector_audit_sample.csv',seed=int(cfg['random_seed']))
    make_radar(src,out/'source_radar.html')
    t=mark('write_tables_and_radar',t)

    exact_dups=df.groupby('headline').size()
    eligible=src[src.rank_eligible].copy().sort_values('topic_adjusted_value_index',ascending=False)
    top=eligible.head(15); bottom=eligible.tail(15).sort_values('topic_adjusted_value_index')
    overall_rates={
        'event_clarity':float(df['event_clarity'].mean()),
        'quantified_specificity':float(df['quantified_specificity'].mean()),
        'time_place_anchor':float(df['time_place_anchor'].mean()),
        'causal_explanation':float(df['causal_explanation'].mean()),
        'material_consequence':float(df['material_consequence'].mean()),
        'evidence_provenance':float(df['evidence_provenance'].mean()),
        'context_comparison':float(df['context_comparison'].mean()),
        'explanatory_framing':float(df['explanatory_framing'].mean()),
        'original_reporting_signal':float(df['original_reporting_signal'].mean()),
        'explicit_curiosity_gap_incidence':float(df['explicit_curiosity_gap_present'].mean()),
        'direct_service_packaging_incidence':float(df['direct_service_packaging_present'].mean()),
        'sensational_personal_incidence':float(df['personal_sensational_frame_present'].mean()),
        'cross_source_title_echo':float(df['cross_source_title_echo'].mean()),
    }
    sensitivity_pivot=sensitivity_df.dropna(subset=['rank']).pivot_table(index='source_key',columns='shrinkage',values='topic_adjusted_value_index')
    sensitivity_corr=sensitivity_pivot.corr(method='spearman').round(4).to_dict() if sensitivity_pivot.shape[1]>1 else {}
    total_time=round(time.perf_counter()-started,3)
    summary={
      'zip':str(zip_path),'config':cfg['config_path'],'headline_rows':int(len(df)),'sources':int(df.source_key.nunique()),
      'exact_duplicate_headline_rows':int((exact_dups-1).clip(lower=0).sum()),
      'cross_source_near_duplicate_title_rows':int(df.cross_source_near_duplicate_proxy.sum()),
      'sources_ranked_min_n':int(len(eligible)),'min_source_n':int(cfg['min_source_n']),
      'sources_n_ge_50':int((src.n>=50).sum()),'sources_n_ge_100':int((src.n>=100).sum()),
      'sources_below_min_n':int((src.n<int(cfg['min_source_n'])).sum()),'nmf_topics':len(topics),
      'value_signal_count':len(VALUE_METRICS),'delivery_signal_count':len(DELIVERY_METRICS),'radar_axis_count':len(RADAR_FEATURES),
      'crossfit_folds':int(cfg['folds']),'default_shrinkage':float(cfg['default_shrinkage']),'shrinkage_grid':cfg['shrinkage_grid'],
      'shrinkage_spearman_correlation':sensitivity_corr,
      'overall_axis_rates':overall_rates,
      'top_15':top[['rank','source','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index']].to_dict(orient='records'),
      'bottom_15':bottom[['rank','source','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index']].to_dict(orient='records'),
      'largest_sources':src.sort_values('n',ascending=False).head(20)[['source','n','group','topic_adjusted_value_index']].to_dict(orient='records'),
      'runtime_seconds':total_time,'stage_times':stage_times,
    }
    (out/'analysis_summary.json').write_text(json.dumps(summary,indent=2))
    (out/'run_metrics.json').write_text(json.dumps({'runtime_seconds':total_time,'stage_times':stage_times,'config':{k:v for k,v in cfg.items() if not k.endswith('_path')}},indent=2,default=str))

    lines=[]
    lines += ['# Title-only reader-value signals — improved exploratory run','',
      f"Corpus: **{len(df):,} headline rows**, **{df.source_key.nunique():,} sources**.",
      f"Source ordering eligible: **{len(eligible)}** sources with at least {int(cfg['min_source_n'])} headlines. **{int((src.n<int(cfg['min_source_n'])).sum())}** sources are below the threshold and unranked.",
      f"Runtime: **{total_time:.1f}s** local. Stage timings: " + ', '.join(f'{k} {v:.1f}s' for k,v in stage_times.items()) + '.',
      '', '## Measurement definition',
      'The core ordering has 11 composite inputs: eight information-delivery markers plus inverse forms of explicit curiosity-gap, direct-address/service packaging, and sensational/personal framing. Original-access cues and cross-source title echo are plotted as diagnostic axes but excluded from the composite. Evidence specificity is fractional: generic research/study claims count 0.5; primary artefacts such as filings, documents, datasets, audits and court material count 1.0. Event/action detection is independent of attention packaging to avoid double-penalising packaged but informative headlines.',
      '', '## Method changes in this run',
      '- Curated export metadata is used when `headline-rows.jsonl` is present: canonical source key, URL, timestamps, relation branch, editorial context, and the available body/summary text.',
      '- Publisher-section/regional-edition groups configured in the task file are consolidated before measurement. This is conservative: BBC services, Mashable regional editions, Philippine Daily Inquirer verticals, and New York Post/Page Six are grouped; Philadelphia’s unrelated inquirer.com is excluded from the Philippine group, and unlike-owned Fox-branded local affiliates are not grouped with Fox News.',
      '- Attention packaging is split into explicit curiosity-gap teasing, direct-address/service packaging, and sensational/personal framing rather than one opaque bait bucket.',
      '- Event and consequence word pools now use corpus-audited explicit inflections rather than unbounded wildcard stems. This removes systematic collisions such as first/Burnham/surgery/election/bank/winter/firms while keeping exact event words.',
      '- Country acronyms are case-sensitive, so lowercase “us” no longer counts as the United States. Quoted titles/quotations are ignored for direct-address packaging, reducing false service hits such as a work titled “You Can See Everything”.',
      '- Evidence language distinguishes generic research claims from stronger primary-artefact provenance. Standalone earnings-call transcript labels no longer count as evidence merely because the word transcript appears; transcript language must be evidential. Original-access cues remain high-precision but are diagnostic-only because they occur too rarely for stable source ordering.',
      '- Body/summary text is exported and scanned for evidence/event/explanatory support as a diagnostic tier. It is not yet composite input because body coverage and length vary by feed and ingest path.',
      f"- Expected detector rates are cross-fitted with GroupKFold by source: a source does not train the topic/editorial-context expectation used to residualise itself. Primary title-length adjustment is **{'enabled' if primary_length_adjustment else 'disabled'}**; length-adjusted sensitivity columns are **{'included' if expected_length_adjusted is not None else 'not included'}**.",
      '- Delivery markers are fully topic/context-adjusted, while attention packaging is only partly context-adjusted (25% by default) and otherwise compared with corpus-wide incidence; this treats attention farming more as publisher behaviour than unavoidable subject matter.',
      '- Shrinkage sensitivity is exported across the configured grid; broad quartile ordering bands are emphasised over false precision in adjacent ranks.',
      '- `detector_audit_sample.csv` is a stratified manual-labelling sample intended for future precision/recall estimation.',
      '', '## Important limitations',
      '- The composite remains headline-led. Body/summary diagnostics add context but do not measure truth, factual accuracy, importance, full article quality, or whether reporting is original in fact.',
      '- Event detection is precision-led rather than exhaustive. It can miss appointment/casting announcements written with copulas, some noun-led market movements, and speech/report claims; those absences are not evidence that no event occurred.',
      '- English-language cues mean non-English sources naturally produce sparse detector hits and should not be compared directly with English-language sources.',
      '- The minimum-n leaderboard can still be unstable or source-type-specific at n≈20–70; syndication-heavy, official-release, obituary-heavy and transcript-heavy sources need per-axis inspection before interpretation.',
      '- No human-labelled validation set has yet been completed; detector precision/recall is still unmeasured. The audit sample is preparation, not validation.',
      '- The composite remains an equally weighted ordering aid. It should be read with the per-axis table, confidence interval, sample size and sensitivity output.',
      '- Cross-fitting reduces in-sample leakage but does not model detector error, topic-model uncertainty, or corpus-selection uncertainty.',
      '- Direct-address/service packaging is adverse packaging pressure, not uselessness: transparent how-to/service headlines can be both search-captured and useful.',
      '- Research-release language can still resemble evidence specificity. The fractional evidence score reduces but does not remove the institutional-release confound. Conversely, scientific paper titles are often descriptive noun phrases with few event verbs, and narrative science journalism can omit formulaic “study finds” evidence language even when the article is evidence-based; neither extreme is a quality verdict.',
      '- Cross-source title echo can reflect syndication, shared ownership, wires or legitimate same-event language; timestamps/URLs help inspection but do not prove provenance.',
      '', '## Axis definitions']
    for f in RADAR_FEATURES:
        composite_note='included in composite' if f['value'] else 'diagnostic only'
        lines.append(f"- **{f['label']}** (`{f['key']}`, {composite_note}): {f['description']}")
    high_volume=src[src.n>=100].sort_values('topic_adjusted_value_index',ascending=False)
    lines += ['', '## High-volume ordering (n ≥ 100)',
              '| Rank | Source | n | Topic-adjusted title signal (95% interval) | Length-adjusted sensitivity | Raw 11-signal mean |', '|---:|---|---:|---:|---:|---:|']
    for _,r in high_volume.iterrows():
        len_adj=f"{r['length_adjusted_topic_adjusted_value_index']:.1f}" if 'length_adjusted_topic_adjusted_value_index' in r and np.isfinite(r['length_adjusted_topic_adjusted_value_index']) else '—'
        lines.append(f"| {int(r['rank_n100'])} | {r['source']} | {int(r['n'])} | {r['topic_adjusted_value_index']:.1f} ({r['topic_adjusted_index_ci95_low']:.1f}–{r['topic_adjusted_index_ci95_high']:.1f}) | {len_adj} | {r['raw_title_signal_index']:.1f} |")
    lines += ['', '## Body/summary corroboration diagnostics (high-volume sources)',
              'Available article summaries are treated as the body tier. Coverage means the summary is materially longer than the headline. These rates corroborate or contextualise title cues; they are not composite inputs because feed coverage varies substantially by source.',
              '| Source | n | Body coverage | Body research cue | Body primary-evidence cue | Body event cue | Body explanatory cue |', '|---|---:|---:|---:|---:|---:|---:|']
    for _,r in high_volume.iterrows():
        lines.append(f"| {r['source']} | {int(r['n'])} | {100*r['body_coverage_rate']:.1f}% | {100*r['body_research_claim_rate']:.1f}% | {100*r['body_primary_evidence_rate']:.1f}% | {100*r['body_event_action_rate']:.1f}% | {100*r['body_explanatory_rate']:.1f}% |")
    lines += ['', '## Highest topic-adjusted title-signal profiles (minimum n)',
              '| Rank | Source | n | Topic-adjusted title signal (95% interval) | Band | Raw 11-signal mean |', '|---:|---|---:|---:|---|---:|']
    for _,r in top.iterrows():
        lines.append(f"| {int(r['rank'])} | {r['source']} | {int(r['n'])} | {r['topic_adjusted_value_index']:.1f} ({r['topic_adjusted_index_ci95_low']:.1f}–{r['topic_adjusted_index_ci95_high']:.1f}) | {r['ordering_band']} | {r['raw_title_signal_index']:.1f} |")
    lines += ['', '## Lowest topic-adjusted title-signal profiles (minimum n)',
              '| Rank | Source | n | Topic-adjusted title signal (95% interval) | Band | Raw 11-signal mean |', '|---:|---|---:|---:|---|---:|']
    for _,r in bottom.iterrows():
        lines.append(f"| {int(r['rank'])} | {r['source']} | {int(r['n'])} | {r['topic_adjusted_value_index']:.1f} ({r['topic_adjusted_index_ci95_low']:.1f}–{r['topic_adjusted_index_ci95_high']:.1f}) | {r['ordering_band']} | {r['raw_title_signal_index']:.1f} |")
    lines += ['', '## Files',
      '- `headline_level_signals.csv`: one row per headline with detector results and metadata.',
      '- `source_rankings.csv`: source rates, context expectations, residuals, composite ordering, intervals, timestamps and sensitivity fields.',
      '- `source_axis_profiles.csv`: compact radar-ready occurrence rates, including explicit adverse incidences.',
      '- `source_index_sensitivity.csv`: composite and rank under alternate residual-shrinkage settings.',
      '- `detector_audit_sample.csv`: stratified manual-labelling sample for future detector validation.',
      '- `detector_validation_sample.csv`: source-capped random validation sheet with predicted axes and blank `human_*` fields; `validate_detectors.py score` turns completed labels into precision/recall/F1 output.',
      '- `metric_dictionary.json`: machine-readable axis definitions and composite inclusion.',
      '- `run_metrics.json`: runtime and configuration record.',
      '- `source_radar.html`: interactive radar for sources above the minimum sample threshold.']
    (out/'REPORT.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps({k:summary[k] for k in ['headline_rows','sources','sources_ranked_min_n','sources_n_ge_50','sources_n_ge_100','sources_below_min_n','exact_duplicate_headline_rows','runtime_seconds']},indent=2))
    print('\nTOP:')
    print(top.head(15)[['rank','source','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index']].to_string(index=False))
    print('\nBOTTOM:')
    print(bottom[['rank','source','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index']].to_string(index=False))


if __name__=='__main__':
    main()

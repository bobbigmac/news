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
cancel cancels canceled cancelled canceling cancelling postpone postpones postponed postponing
retire retires retired retiring escape escapes escaped escaping steal steals stole stolen stealing
issue issues issued issuing arrive arrives arrived arriving admit admits admitted admitting deny denies denied denying
halt halts halted halting resume resumes resumed resuming protest protests protested protesting
fail fails failed failing delete deletes deleted deleting
plummet plummets plummeted plummeting soar soars soared soaring slump slumps slumped slumping tumble tumbles tumbled tumbling
select selects selected selecting choose chooses chose chosen choosing quit quits quitted quitting
seize seizes seized seizing expel expels expelled expelling authorize authorizes authorized authorizing authorise authorises authorised authorising
name names named naming sink sinks sank sunk sinking restart restarts restarted restarting
hit hits hitting target targets targeted targeting jail jails jailed jailing
torch torches torched torching raze razes razed razing revive revives revived reviving
decide decides decided deciding sentence sentences sentenced sentencing
cut cuts cutting extend extends extended extending shift shifts shifted shifting ok oks oked okays okayed
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
PRIMARY_EVIDENCE = re.compile(r"\b(?:court (?:filing\w*|records?|documents?)|documents? (?:show|shows|reveal\w*|obtained|seen|reviewed)|obtained documents?|leaked documents?|internal (?:memo|documents?)|filings? (?:show|shows|reveal\w*)|audit (?:show\w*|find\w*|reveal\w*)|official (?:report|figures|data)|inspection report|data (?:show|shows|reveal\w*)|figures? (?:show|shows|reveal\w*)|statistics show|transcript\w* (?:show|shows|reveal\w*|indicate\w*)|freedom of information|\bfoi\b|trial records|peer.reviewed|court heard|court hears|inquest hears)\b", re.I)
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
EVENT_RECORD_ACTIONS = re.compile(r"\b(?:set|sets|hit|hits|break|breaks|broke|smash|smashes|smashed|reach|reaches)\s+(?:(?:a|an|the|new|world|massive|livestreaming|opening-weekend|first-week)\s+){0,4}record\b", re.I)
SERVICE_TASK_FRAME = re.compile(r"^\s*(?:how to|how do|how can|can you|could you|should you|why you|what you need|what to know|here's how|here is how)\b", re.I)

GENERIC_EVENT_LEMMAS = {'become'}
EVENT_NOUN_LEMMAS = set('attack strike crash collision explosion fire flood shooting stabbing death murder killing arrest trial verdict ruling protest riot election vote charge resignation collapse closure launch release update delay ban accident evacuation merger takeover'.split())
SPEECH_EVENT_RESCUE=compile_word_pool("say says said tell tells told reveal reveals revealed warn warns warned confirm confirms confirmed admit admits admitted deny denies denied announce announces announced expose exposes exposed publish publishes published unveil unveils unveiled urge urges urged demand demands demanded pledge pledges pledged threaten threatens threatened concede concedes conceded accuse accuses accused allege alleges alleged express expresses expressed".split())
SPEECH_EVENT_LEMMAS=set('say tell report claim reveal warn confirm admit deny announce expose publish unveil call urge demand pledge threaten concede accuse allege express'.split())
MARKET_NOMINAL_MOVEMENT = re.compile(r"\b(?:price\w*|inflation|shares?|stocks?|rates?|sales|profits?|revenue|unemployment|growth)\b[^.!?|]{0,45}\b(?:rise\w*|fall\w*|drop\w*|increase\w*|decrease\w*|cut\w*|surge\w*|plunge\w*|decline\w*)\b|\b(?:rise\w*|fall\w*|drop\w*|increase\w*|decrease\w*|cut\w*|surge\w*|plunge\w*|decline\w*)\b[^.!?|]{0,45}\b(?:price\w*|inflation|shares?|stocks?|rates?|sales|profits?|revenue|unemployment|growth)\b", re.I)
INFLECTED_EVENT_SURFACE = re.compile(r"(?:s|ed|ing)$")
EVENT_NOUN_COMPLEMENT_HEADS = {'date','trailer','window','notes','details','version'}
NOUN_HEAVY_EVENT_LEMMAS = EVENT_NOUN_LEMMAS | {'sanction','hit','target','record','rule','order','pass','set','open','clear'}
NUM_WORDS = set('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion'.split())
SCALE_WORDS = set('dozens hundreds thousands millions billions'.split())
ORDINAL_WORDS = set('second third fourth fifth sixth seventh eighth ninth tenth'.split())
LISTICLE_NUMERIC_FRAME = re.compile(r"\b(?:best|top|worst|things|ways|reasons|tips|tricks|games|movies|shows|deals|gifts)\b", re.I)
STRONG_QUANTITY = re.compile(r"(?:\b\d+(?:[.,]\d+)?\s?(?:%|per cent|percent|million|billion|trillion|thousand|th|years?|months?|weeks?|days?|hours?|minutes?|people|cases|deaths|jobs|homes|miles|km|kg|\$|£|€|¥)|(?:\$|£|€|¥)\s?\d)", re.I)
NUMERIC_RANGE = re.compile(r"\b\d+\s?(?:to|-)\s?\d+\b", re.I)

# Broad evidence-surface families. These are token-boundary watchlists used with
# spaCy POS/context checks; they are transparent surface cues, not truth judgments.
EVIDENCE_DOCUMENT_TOKENS = set('document documents record records report reports audit audits transcript transcripts testimony memo memos email emails letter letters message messages dataset datasets data datum figure figures statistic statistics evidence filing filings'.split())
EVIDENCE_VISUAL_TOKENS = set('footage video videos image images photo photos photograph photographs'.split())
EVIDENCE_RESEARCH_TOKENS = set('study studies research survey surveys poll polls analysis analyses trial trials experiment experiments review reviews finding findings result results paper papers'.split())
AMBIGUOUS_EVIDENCE_TOKENS = set('report reports poll polls trial trials letter letters review reviews result results paper papers'.split())
STANDALONE_CONTENT_OBJECTS = set('transcript transcripts testimony'.split())
EVIDENCE_MODIFIERS = set('official leaked internal court courts government police confidential independent clinical peer reviewed preliminary new global national public regulatory forensic postmortem post-mortem autopsy randomized randomised'.split())
EMPIRICAL_EVIDENCE_FORMS = set('show shows showed shown showing reveal reveals revealed revealing indicate indicates indicated indicating suggest suggests suggested suggesting find finds found finding estimate estimates estimated estimating document documents documented documenting demonstrate demonstrates demonstrated demonstrating'.split())
EVIDENCE_DISCLOSURE_FORMS = set('obtain obtains obtained obtaining leak leaks leaked leaking publish publishes published publishing release releases released releasing disclose discloses disclosed disclosing share shares shared sharing review reviews reviewed reviewing'.split())
LEGAL_FORUM_TOKENS = set('court judge jury trial inquest hearing tribunal'.split())
LEGAL_TESTIMONY_SURFACE = re.compile(r"\b(?:court|judge|jury|trial|inquest|hearing|tribunal)\s+(?:hears?|heard|told)\b", re.I)
DIRECT_SPEECH_FORMS = set('say says said tell tells told claim claims claimed warn warns warned confirm confirms confirmed admit admits admitted report reports reported testify testifies testified'.split())
ANNOUNCEMENT_SPEECH_FORMS = set('announce announces announced urge urges urged deny denies denied'.split())
PAST_SPEECH_FORMS = set('said told claimed warned confirmed admitted reported testified'.split())
SPECIFIC_SPEAKER_ROLES = set('police prosecutor prosecutors judge jury court minister ministers president government ministry department spokesperson spokesman spokeswoman lawyer lawyers attorney attorneys officer officers witness witnesses victim victims doctor doctors patient patients mayor council regulator regulators agency authorities army military navy ceo cfo boss bosses chief chiefs head heads director directors tank tanks husband wife mother father mum dad man woman boy girl caller callers residents resident staff workers worker employees employee'.split())
VAGUE_SPEAKER_ROLES = set('expert experts official officials source sources analyst analysts critic critics scientist scientists researcher researchers campaigner campaigners activist activists insider insiders people'.split())
VAGUE_ATTRIBUTION_SURFACE = re.compile(r"\b(?:reportedly|allegedly|sources say|officials say|according to sources|people familiar with|sources familiar with)\b", re.I)

# Curiosity-gap evidence is intentionally structural and ordinal. These broad
# families come from the audit taxonomy; none is treated as a verdict by itself.
CURIOSITY_STOCK_TEASER = re.compile(r"\b(?:can you guess|you won't believe|you won't expect|the one thing|the truth about|the secret of|secret behind|what happened to|find out why|big clue|guess who|the (?:incredible|shocking|surprising|strange|weird|unexpected|bizarre|real|simple) reason|what they don't tell you|what nobody tells you|what no one tells you)\b", re.I)
TRAILING_ELLIPSIS = re.compile(r"(?:\.\.\.|…)\s*[?]?\s*$")
LIST_WITHHOLDING_FRAME = re.compile(r"\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:simple|easy|best|top|worst|essential|brilliant|surprising|weird|incredible|new|underrated|greatest)?\s*(?:ways|reasons|things|tips|tricks|steps|habits|signs|lessons|moments|games|movies|shows|deals|gifts|companies|romances|shortcuts|secrets)\b|\b(?:best|top|worst)\s+[\w'’-]{2,30}\s+(?:of|for|in)\s+(?:the\s+)?(?:year|\d{4})|\b(?:these|here)\s+(?:are|is)\s+(?:the\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)?\s*(?:best|top|worst|simple|easy)?\s*(?:ways|reasons|things|tips|tricks|steps|habits|signs|lessons|moments|games|movies|shows|deals|gifts|companies|romances|shortcuts|secrets)\b", re.I)
OPEN_LIST_WITHHOLDING_FRAME = re.compile(r"\b(?:here|these)\s+(?:are|is)\s+(?:some|the)?\s*(?:[\w'’-]+\s+){0,4}(?:ways|reasons|things|tips|tricks|steps|habits|signs|lessons|moments|games|movies|shows|deals|gifts|companies|romances|shortcuts|secrets)\b", re.I)
WITHHELD_EXAMPLES_BEHAVIOUR = re.compile(r"\b(?:what|here's what|here is what)\s+(?:people|fans|players|users|customers|readers|viewers|they)\s+(?:are|were|have been|'re)?\s*(?:playing|watching|buying|reading|loving|using|stockpiling|talking about)\b|\bwhat are\s+(?:people|fans|players|users|customers|readers|viewers|they)\s+\w+ing\b", re.I)
WITHHELD_REASON_FRAME = re.compile(r"\b(?:the\s+)?(?:real|true|secret|simple|incredible|surprising|strange|shocking|weird|unexpected)\s+reason\b|\breason\s+(?:why|behind|for)\b", re.I)
RESOLUTION_GAP_FRAME = re.compile(r"\b(?:what happened|what really happened|what went wrong|what comes next|what happens next|what now|now what|what we heard|what we learned|what we know|what we don't know)\b", re.I)
WITHHELD_TIMING_FRAME = re.compile(r"\bwhen\s+(?:will|do|does|did|can|could|should)\b[^?|]{0,80}\b(?:know|happen|start|end|arrive|release|come out|return|begin|open)\b", re.I)
REACTION_GAP_FRAME = re.compile(r"\b(?:reacts?|reacted|reacting|reaction|responds?|responded|responding|response)\s+to\b", re.I)
EMPHATIC_GAP_FRAME = re.compile(r"\b(?:what the hell|what on earth|what in the world|how on earth|why on earth)\b", re.I)
VAGUE_REFERENCE_TERMS = re.compile(r"\b(?:the truth|secret|secrets|mystery|mysterious|unknown|hidden|surprise|surprising|clue|clues|the answer|answers?|the results?|the outcome|everything|something|the thing|the real story|details)\b", re.I)
FOLLOWUP_QUESTION_FRAME = re.compile(r"[.!?]\s+(?:did|does|do|will|would|could|can|should|is|are|was|were|what|why|how|when)\b[^?]{2,120}\?\s*$", re.I)
TEACHING_WITHHOLDING_FRAME = re.compile(r"\bwhat\b[^?|]{1,60}\btell\w*\s+us\b", re.I)
UNRESOLVED_FINDING_QUESTION_FRAME = re.compile(r"\bwhat\s+(?:has|have|did)\s+(?:it|they|the\s+review|the\s+report|the\s+inquiry|the\s+investigation)\b", re.I)
VERBAL_WITHHOLDING_FRAME = re.compile(r"\b(?:pinpoints?|reveals?|identifies?|explains?|announces?)\s+(?:when|why|how|what|who)\b", re.I)

BODY_STRONG_EVIDENCE_SURFACE = re.compile(
    r"\b(?:documents?|records?|reports?|audits?|transcripts?|testimony|memos?|emails?|letters?|messages?|datasets?|data|figures?|statistics|evidence|filings?|footage|videos?|images?|photos?|photographs?|study|studies|research|surveys?|polls?|analysis|trials?|experiments?|reviews?|findings|results|papers?)\b"
    r"[\w\s,.;'’()/-]{0,48}?\b(?:show|shows|showed|shown|showing|reveal\w*|indicate\w*|suggest\w*|find|finds|found|finding|estimate\w*|document\w*|demonstrate\w*)\b"
    r"|\b(?:court|judge|jury|trial|inquest|hearing|tribunal)\s+(?:hears?|heard|told)\b", re.I)
BODY_TESTIMONY_SURFACE = re.compile(
    r"(?:\b[A-Z][\w.'’-]+(?:\s+(?:of|the|de|van|von|and|[A-Z][\w.'’-]+)){0,4}|\b(?:police|prosecutors?|ministers?|president|government|ministry|department|spokesperson|spokesman|spokeswoman|lawyers?|attorneys?|officers?|witnesses?|victims?|doctors?|patients?|mayor|council|regulators?|agency|authorities|army|military|ceo|cfo|boss|husband|wife|mother|father|mum|dad|man|woman|residents?|workers?|employees?|experts?|officials?|scientists?|researchers?)\b)"
    r"\s+(?:say|says|said|tell|tells|told|claim\w*|warn\w*|confirm\w*|admit\w*|report\w*|testif\w*)\b", re.I)
BODY_VAGUE_ATTRIBUTION_SURFACE = VAGUE_ATTRIBUTION_SURFACE


def normalise_evidence_object(token):
    lower = token.lower_.casefold()
    if lower == 'datum':
        return 'data'
    if lower == 'analyses':
        return 'analysis'
    return lower


def tokens_between_have_sentence_break(tokens, start, end):
    lo, hi = sorted((start, end))
    return any(tokens[i].text in {'.', '|', '…'} for i in range(lo + 1, hi))


def nearby_surface_index(tokens, start, stop, forms, exclude_index=None):
    for j in range(max(0, start), min(len(tokens), stop)):
        if j == exclude_index:
            continue
        if tokens[j].lower_.casefold() in forms:
            return j
    return -1


def speaker_strength_before(tokens, verb_index):
    inspected = 0
    best = 0.0
    for j in range(verb_index - 1, max(-1, verb_index - 7), -1):
        tok = tokens[j]
        if tok.is_space:
            continue
        if tok.is_punct:
            if tok.text in {',', ':', ';'}:
                break
            continue
        lower = tok.lower_.casefold()
        inspected += 1
        if lower in SPECIFIC_SPEAKER_ROLES:
            return 1.0
        if lower in VAGUE_SPEAKER_ROLES:
            return 0.5
        if tok.pos_ == 'PROPN':
            return 1.0
        if tok.pos_ in {'NOUN', 'PRON'}:
            return 0.0
        if tok.pos_ in {'ADJ', 'DET', 'NUM', 'ADP', 'PART', 'CCONJ', 'ADV'}:
            continue
        if inspected >= 5:
            break
    return best


def speaker_strength_after(tokens, verb_index):
    # Inverted attribution is usually punctuated: “…”, says Minister X / police say.
    if verb_index > 0 and tokens[verb_index - 1].text not in {',', ':', ';', '"', '”', "'", '”'} and verb_index > 2:
        return 0.0
    best = 0.0
    inspected = 0
    for j in range(verb_index + 1, min(len(tokens), verb_index + 7)):
        tok = tokens[j]
        if tok.is_space or tok.is_punct:
            continue
        lower = tok.lower_.casefold()
        if lower in {'the', 'a', 'an', 'his', 'her', 'their'}:
            continue
        inspected += 1
        if tok.pos_ == 'PROPN' or (tok.text[:1].isupper() and tok.is_alpha):
            return 1.0
        if lower in SPECIFIC_SPEAKER_ROLES:
            return 1.0
        if lower in VAGUE_SPEAKER_ROLES:
            return 0.5
        if inspected >= 4:
            break
    return best


def evidence_surface_features(title, doc):
    tokens = [t for t in doc if not t.is_space]
    flags = {
        'document_object_surface': False,
        'research_object_surface': False,
        'visual_object_surface': False,
        'weak_typed_object_surface': False,
        'document_empirical_surface': False,
        'research_empirical_surface': False,
        'visual_empirical_surface': False,
        'modified_evidence_surface': False,
        'document_disclosure_surface': False,
        'legal_testimony_surface': bool(LEGAL_TESTIMONY_SURFACE.search(title)),
        'direct_testimony_surface': False,
        'direct_testimony_vague_speaker': False,
        'announcement_surface': False,
        'vague_attribution_surface': bool(VAGUE_ATTRIBUTION_SURFACE.search(title)),
    }
    anchor_surface = bool(TIME_PLACE.search(title) or STRONG_QUANTITY.search(title) or any(ent.label_ in {'PERSON','ORG','GPE','LOC','PRODUCT','EVENT','LAW','NORP'} for ent in getattr(doc, 'ents', [])))

    for i, tok in enumerate(tokens):
        obj = normalise_evidence_object(tok)
        if tok.pos_ in {'NOUN', 'PROPN'}:
            in_document = obj in EVIDENCE_DOCUMENT_TOKENS
            in_visual = obj in EVIDENCE_VISUAL_TOKENS
            in_research = obj in EVIDENCE_RESEARCH_TOKENS
            if in_document or in_visual or in_research:
                flags['document_object_surface'] |= in_document
                flags['research_object_surface'] |= in_research
                flags['visual_object_surface'] |= in_visual
                if obj not in AMBIGUOUS_EVIDENCE_TOKENS and obj not in STANDALONE_CONTENT_OBJECTS and not in_visual and (tok.pos_ != 'PROPN' or tok.text.islower()):
                    flags['weak_typed_object_surface'] = True
                end = min(len(tokens), i + 7)
                verb_index = nearby_surface_index(tokens, i + 1, end, EMPIRICAL_EVIDENCE_FORMS, exclude_index=i)
                compound_object = i + 1 < len(tokens) and tokens[i + 1].pos_ in {'NOUN', 'PROPN'} and tokens[i + 1].lower_.casefold() not in EMPIRICAL_EVIDENCE_FORMS
                if verb_index >= 0 and not compound_object and not tokens_between_have_sentence_break(tokens, i, verb_index):
                    if in_document:
                        flags['document_empirical_surface'] = True
                    if in_visual:
                        flags['visual_empirical_surface'] = True
                    if in_research:
                        flags['research_empirical_surface'] = True
                modifier_start = max(0, i - 4)
                modifier_index = nearby_surface_index(tokens, modifier_start, i, EVIDENCE_MODIFIERS)
                if modifier_index >= 0 and not tokens_between_have_sentence_break(tokens, modifier_index, i):
                    flags['modified_evidence_surface'] = True
                before_index = nearby_surface_index(tokens, max(0, i - 5), i, EVIDENCE_DISCLOSURE_FORMS)
                after_index = nearby_surface_index(tokens, i + 1, min(len(tokens), i + 5), EVIDENCE_DISCLOSURE_FORMS)
                disclosure_index = before_index if before_index >= 0 else after_index
                if disclosure_index >= 0 and not tokens_between_have_sentence_break(tokens, disclosure_index, i):
                    flags['document_disclosure_surface'] = True

        lower = tok.lower_.casefold()
        if lower in DIRECT_SPEECH_FORMS or lower in ANNOUNCEMENT_SPEECH_FORMS:
            passive_fragment = lower in PAST_SPEECH_FORMS and i + 1 < len(tokens) and tokens[i + 1].lower_.casefold() == 'to'
            negated_speech = any(tokens[j].lower_.casefold() in {'not', "n't", 'never', 'no', 'cannot', "can't", "don't", "doesn't", "didn't", "won't"} for j in range(max(0, i - 3), i))
            if not passive_fragment and not negated_speech:
                speaker_strength = max(speaker_strength_before(tokens, i), speaker_strength_after(tokens, i))
                if speaker_strength > 0:
                    if lower in DIRECT_SPEECH_FORMS:
                        flags['direct_testimony_surface'] = True
                        if speaker_strength < 1:
                            flags['direct_testimony_vague_speaker'] = True
                    else:
                        flags['announcement_surface'] = True

    strong_document = flags['document_empirical_surface'] or flags['visual_empirical_surface'] or flags['legal_testimony_surface'] or (flags['document_disclosure_surface'] and flags['document_object_surface'])
    strong_research = flags['research_empirical_surface'] or flags['modified_evidence_surface']
    quote_present = bool(QUOTED_SPAN.search(title))
    primary_regex = bool(PRIMARY_EVIDENCE.search(title))
    research_regex = bool(RESEARCH_CLAIM.search(title))

    score = 0.0
    if strong_document or primary_regex:
        score = 1.0
    elif strong_research:
        score = 0.8
    elif flags['direct_testimony_surface'] and not flags['direct_testimony_vague_speaker']:
        score = 0.6
        if quote_present or anchor_surface:
            score = min(0.7, score + 0.05)
    elif research_regex:
        score = 0.45
    elif flags['weak_typed_object_surface']:
        score = 0.25
    elif flags['direct_testimony_surface']:
        score = 0.35
    elif flags['announcement_surface']:
        score = 0.25
    elif flags['vague_attribution_surface']:
        score = 0.15

    strength = 0
    if strong_document or primary_regex:
        strength = 4
    elif strong_research:
        strength = 3
    elif flags['direct_testimony_surface'] or research_regex or flags['weak_typed_object_surface']:
        strength = 2
    elif flags['announcement_surface'] or flags['vague_attribution_surface']:
        strength = 1
    flags.update({
        'evidence_surface_score': float(score),
        'evidence_surface_strength': int(strength),
        'evidence_anchor_surface': bool(anchor_surface),
        'quote_testimony_surface': bool(quote_present and flags['direct_testimony_surface']),
    })
    return flags


def noisy_or(weights):
    remaining = 1.0
    for weight in weights:
        remaining *= 1.0 - min(max(float(weight), 0.0), 1.0)
    return 1.0 - remaining


def curiosity_gap_features(title, doc, event_action=0.0, numeric=0.0, time_place=0.0, evidence_score=0.0, explanatory=0, direct_service=0):
    tokens = [t for t in doc if not t.is_space]
    words = [t for t in tokens if t.is_alpha]
    lowers = [t.lower_.casefold() for t in words]
    n_words = max(len(words), 1)
    wh_words = {'what','why','how','when','where','who','which'}
    forwardish_words = wh_words | {'this','these','that','those','here','there'}
    pronoun_count = sum(1 for t in words if t.pos_ == 'PRON' or t.lower_.casefold() in {'i','me','my','we','us','our','you','your','he','him','his','she','her','they','them','their','it','its'})
    determiner_count = sum(1 for t in words if t.pos_ == 'DET')
    wh_count = sum(1 for x in lowers if x in wh_words)
    forwardish_count = sum(1 for x in lowers if x in forwardish_words)
    pronoun_density = pronoun_count / n_words
    determiner_density = determiner_count / n_words
    wh_density = wh_count / n_words
    forwardish_density = forwardish_count / n_words

    first_alpha = words[0].lower_.casefold() if words else ''
    second_pos = words[1].pos_ if len(words) > 1 else ''
    unresolved_start = first_alpha in {'it','this','that'} and second_pos not in {'NOUN','PROPN'}
    narrative_pronoun_hook = first_alpha in {'i','we','she','he','they'} and bool(re.search(r"\b(?:then|but|until|after|when)\b|,", title, re.I))
    question_form = '?' in title
    mechanism_gap = False
    for i, tok in enumerate(tokens[:-1]):
        if tok.lower_.casefold() != 'how':
            continue
        following = [x for x in tokens[i+1:min(len(tokens), i+10)] if not x.is_space and not x.is_punct]
        if not following or following[0].lower_.casefold() in {'to','do','does','can','could','should','would','you','we'}:
            continue
        if any(x.tag_ in {'VBD','VBG'} or x.lower_.casefold().endswith('ing') for x in following[1:]):
            mechanism_gap = True
            break

    flags = {
        'stock_teaser_surface': bool(CURIOSITY_STOCK_TEASER.search(title)),
        'trailing_ellipsis_surface': bool(TRAILING_ELLIPSIS.search(title)),
        'listicle_withholding_surface': bool(LIST_WITHHOLDING_FRAME.search(title) or OPEN_LIST_WITHHOLDING_FRAME.search(title)),
        'mechanism_gap_surface': bool(mechanism_gap),
        'teaching_withholding_surface': bool(TEACHING_WITHHOLDING_FRAME.search(title)),
        'unresolved_finding_question_surface': bool(UNRESOLVED_FINDING_QUESTION_FRAME.search(title)),
        'verbal_withholding_surface': bool(VERBAL_WITHHOLDING_FRAME.search(title)),
        'withheld_examples_surface': bool(WITHHELD_EXAMPLES_BEHAVIOUR.search(title)),
        'withheld_reason_surface': bool(WITHHELD_REASON_FRAME.search(title)),
        'resolution_gap_surface': bool(RESOLUTION_GAP_FRAME.search(title)),
        'withheld_timing_surface': bool(WITHHELD_TIMING_FRAME.search(title)),
        'reaction_gap_surface': bool(REACTION_GAP_FRAME.search(title)),
        'emphatic_gap_surface': bool(EMPHATIC_GAP_FRAME.search(title)),
        'vague_reference_surface': bool(VAGUE_REFERENCE_TERMS.search(title)),
        'followup_question_surface': bool(FOLLOWUP_QUESTION_FRAME.search(title)),
        'unresolved_forward_start': bool(unresolved_start),
        'narrative_pronoun_hook': bool(narrative_pronoun_hook),
    }

    weights = []
    if flags['trailing_ellipsis_surface']:
        weights.append(0.30)
    if flags['listicle_withholding_surface']:
        weights.append(0.38)
    if flags['mechanism_gap_surface']:
        weights.append(0.32)
    if flags['teaching_withholding_surface']:
        weights.append(0.32)
    if flags['unresolved_finding_question_surface']:
        weights.append(0.34)
    if flags['verbal_withholding_surface']:
        weights.append(0.32)
    if flags['withheld_examples_surface']:
        weights.append(0.40)
    if flags['withheld_reason_surface']:
        weights.append(0.42)
    if flags['resolution_gap_surface']:
        weights.append(0.38)
    if flags['withheld_timing_surface']:
        weights.append(0.28)
    if flags['reaction_gap_surface']:
        weights.append(0.28)
    if flags['emphatic_gap_surface']:
        weights.append(0.58)
    if flags['vague_reference_surface']:
        weights.append(0.30)
    if flags['followup_question_surface']:
        weights.append(0.20)
    if flags['unresolved_forward_start']:
        weights.append(0.36)
    if flags['narrative_pronoun_hook']:
        weights.append(0.30)

    structural_weights = []
    if pronoun_density >= 0.14:
        structural_weights.append(0.10)
    if determiner_density >= 0.24:
        structural_weights.append(0.08)
    if forwardish_density >= 0.12:
        structural_weights.append(0.10)
    if wh_count and question_form:
        structural_weights.append(0.08)
    structural = noisy_or(structural_weights)
    moderate = noisy_or(weights)

    entity_count = len([ent for ent in getattr(doc, 'ents', []) if ent.label_ in {'PERSON','ORG','GPE','LOC','PRODUCT','EVENT','WORK_OF_ART','NORP','LAW','FAC'}])
    specificity_points = min(entity_count, 2)
    specificity_points += 1.0 if numeric >= 0.75 else 0.5 if numeric > 0 else 0.0
    specificity_points += 1.0 if time_place >= 0.75 else 0.5 if time_place > 0 else 0.0
    specificity_points += 0.5 if event_action else 0.0

    attenuation = 1.0
    if specificity_points >= 2.0:
        attenuation = 0.65
    elif specificity_points >= 1.0:
        attenuation = 0.82
    structural *= attenuation
    if not weights and (direct_service or explanatory):
        structural = min(structural, 0.14)
    elif not weights and question_form:
        structural = min(structural, 0.20)

    # Stock teaser formulas are explicit publisher framing and are not forgiven
    # merely because they name a topic. Other cues are noisy-or evidence, not
    # additive penalties, and are attenuated when the headline already supplies
    # multiple concrete anchors.
    stock_score = 0.0
    if re.search(r"\b(?:can you guess|guess who|you won't believe|you won't expect)\b", title, re.I):
        stock_score = 0.95
    elif re.search(r"\b(?:the secret of|secret behind|what they don't tell you|what nobody tells you|what no one tells you|big clue)\b", title, re.I):
        stock_score = 0.86
    elif re.search(r"\b(?:the one thing|the truth about)\b", title, re.I):
        stock_score = 0.58
    elif re.search(r"\bthe (?:incredible|shocking|surprising|strange|weird|unexpected|bizarre|real|simple) reason\b", title, re.I):
        stock_score = 0.78
    elif re.search(r"\b(?:what happened to|find out why)\b", title, re.I):
        stock_score = 0.62
    combined_moderate = noisy_or([moderate, structural]) if weights or structural else 0.0
    score = max(stock_score, min(1.0, combined_moderate))

    flags.update({
        'curiosity_gap_score': float(score),
        'curiosity_pronoun_density': float(pronoun_density),
        'curiosity_determiner_density': float(determiner_density),
        'curiosity_wh_density': float(wh_density),
        'curiosity_forwardish_density': float(forwardish_density),
        'curiosity_specificity_points': float(specificity_points),
        'curiosity_structural_load': float(structural),
    })
    return flags


def body_evidence_surface_score(text):
    text = str(text or '')
    if BODY_STRONG_EVIDENCE_SURFACE.search(text):
        return 1.0
    if BODY_TESTIMONY_SURFACE.search(text):
        return 0.6
    if BODY_VAGUE_ATTRIBUTION_SURFACE.search(text):
        return 0.15
    return 0.0


def build_event_lemma_pool(nlp):
    lemmas=set()
    for phrase in EVENT_WORDS:
        first=phrase.split()[0]
        doc=nlp(first)
        if len(doc):
            lemmas.add((doc[0].lemma_ or doc[0].lower_).casefold())
        else:
            lemmas.add(first.casefold())
    return lemmas-GENERIC_EVENT_LEMMAS


def event_surface_lemmas(token):
    surface=token.lower_.casefold()
    lemma=(token.lemma_ or token.lower_).casefold()
    candidates={lemma,surface}
    if surface.endswith('ies') and len(surface)>3:
        candidates.add(surface[:-3]+'y')
    if surface.endswith('s') and len(surface)>1:
        candidates.add(surface[:-1])
    if surface.endswith('es') and len(surface)>2:
        candidates.add(surface[:-2])
        candidates.add(surface[:-2]+'e')
    if surface.endswith('ed') and len(surface)>2:
        candidates.add(surface[:-2])
        candidates.add(surface[:-2]+'e')
    if surface.endswith('ing') and len(surface)>3:
        candidates.add(surface[:-3])
        candidates.add(surface[:-3]+'e')
    return candidates


def subject_object_verb_shape(token_list, index):
    token=token_list[index]
    surface=token.lower_.casefold()
    if not INFLECTED_EVENT_SURFACE.search(surface):
        return False
    subject=False
    for prior in range(index-1,max(-1,index-4),-1):
        item=token_list[prior]
        if item.is_punct:
            break
        if item.pos_ in {'NOUN','PROPN','PRON'}:
            subject=True
            break
        if item.pos_ in {'ADJ','ADV','NUM','DET'}:
            continue
        break
    if not subject:
        return False
    if surface.endswith('ed'):
        return True
    following=None
    for later in range(index+1,min(len(token_list),index+4)):
        item=token_list[later]
        if item.is_punct:
            break
        following=item
        break
    if following is None or following.pos_ not in {'NOUN','PROPN','PRON','DET','ADJ','NUM','ADV'}:
        return False
    if event_surface_lemmas(token) & {'release','launch','update'} and following.lower_.casefold() in EVENT_NOUN_COMPLEMENT_HEADS|{'of'}:
        return False
    return True


def subject_only_verb_shape(token_list, index):
    token=token_list[index]
    surface=token.lower_.casefold()
    if not INFLECTED_EVENT_SURFACE.search(surface):
        return False
    if event_surface_lemmas(token) & NOUN_HEAVY_EVENT_LEMMAS:
        return False
    for prior in range(index-1,max(-1,index-4),-1):
        item=token_list[prior]
        if item.is_punct:
            break
        if item.pos_ in {'PROPN','PRON'}:
            return True
        if item.pos_ in {'ADJ','ADV','NUM','DET'}:
            continue
        break
    return False


def detect_event_action(title: str, doc=None, event_lemmas=None) -> float:
    # High-precision event verbs count directly. When a tagger/lemmatizer is
    # available, require verbal use so noun phrases such as "the fall of X" or
    # game/product names do not count merely because they contain an event word.
    # Ambiguous verbs such as "clear", "rules" and "order" count only with an
    # institutional actor. Service/task frames are explanatory, not news events.
    if SERVICE_TASK_FRAME.search(title):
        return 0
    if doc is not None and event_lemmas:
        if EVENT_CONTEXT_ACTIONS.search(title) or EVENT_RECORD_ACTIONS.search(title):
            return 1
        speech_hit=False
        weak_action_hit=False
        token_list=list(doc)
        for index,token in enumerate(token_list):
            candidates=event_surface_lemmas(token)
            speech_lemma=next((candidate for candidate in candidates if candidate in SPEECH_EVENT_LEMMAS),None)
            action_lemma=next((candidate for candidate in candidates if candidate in event_lemmas),None)
            verbal=token.pos_ in {'VERB','AUX'}
            strong_grammar_rescue=(not verbal) and subject_object_verb_shape(token_list,index)
            weak_grammar_rescue=(not verbal) and (not strong_grammar_rescue) and subject_only_verb_shape(token_list,index)
            if not verbal and not strong_grammar_rescue and not weak_grammar_rescue:
                continue
            if speech_lemma:
                speech_hit=True
                continue
            if not action_lemma:
                continue
            if action_lemma=='roll':
                following=' '.join(t.lower_ for t in token_list[index+1:index+3])
                if 'out' not in following:
                    continue
            if action_lemma in AMBIGUOUS_EVENT_WORDS and not EVENT_CONTEXT_ACTIONS.search(title):
                continue
            if verbal or strong_grammar_rescue:
                return 1
            weak_action_hit=True
        alpha_tokens=[token for token in doc if any(ch.isalpha() for ch in token.text)]
        later_tokens=alpha_tokens[1:] if len(alpha_tokens)>1 else []
        titleish=len(alpha_tokens)>=5 and later_tokens and sum(token.text[:1].isupper() for token in later_tokens)/len(later_tokens)>=0.35
        if weak_action_hit:
            return 0.75
        if speech_hit or (titleish and SPEECH_EVENT_RESCUE.search(title)):
            return 0.5
        nominal_event=any((token.lemma_ or token.lower_).casefold() in EVENT_NOUN_LEMMAS and token.pos_ in {'NOUN','PROPN'} for token in doc)
        return 0.5 if nominal_event or MARKET_NOMINAL_MOVEMENT.search(title) else 0
    matches=list(EVENT_ACTIONS.finditer(title))
    for match in matches:
        term=match.group(0).casefold()
        if term not in AMBIGUOUS_EVENT_WORDS:
            return 1
    return int(bool(matches and EVENT_CONTEXT_ACTIONS.search(title)))


def quantified_specificity_score(title: str, doc=None) -> float:
    """Fractional numeric-detail score.

    Exact quantities, money, percentages, ages and counts are strongest. Bare
    digits and spelled-out counts are useful but slightly weaker; calendar years,
    scale words and ordinal sequencing carry less quantitative information.
    Product/version numerals and listicle positions are heavily discounted.
    """
    if STRONG_QUANTITY.search(title):
        return 1.0
    score=0.5 if re.search(r"\b(?:19|20)\d{2}\b",title) else 0.0
    if NUMERIC_RANGE.search(title):
        score=max(score,0.75)
    if doc is None:
        return score
    listicle=bool(LISTICLE_NUMERIC_FRAME.search(title))
    tokens=list(doc)
    for i,token in enumerate(tokens):
        low=token.text.casefold()
        value=0.0
        if re.fullmatch(r"\d+(?:[.,]\d+)?",token.text):
            prev=tokens[i-1] if i else None
            nxt=tokens[i+1] if i+1<len(tokens) else None
            is_year=len(token.text)==4 and token.text.isdigit() and 1900<=int(token.text)<=2100
            if is_year:
                value=max(value,0.5)
            elif (prev is not None and prev.pos_=='PROPN') or (nxt is not None and nxt.pos_=='PROPN'):
                value=min(value,0.15)
            elif listicle:
                value=min(value,0.25)
            elif prev is not None and prev.text.casefold() in {'at','age','aged'}:
                value=max(value,1.0)
            else:
                value=max(value,0.75)
        elif low in NUM_WORDS:
            nxt=tokens[i+1] if i+1<len(tokens) else None
            if low=='one' and nxt is not None and nxt.text.casefold()=='of':
                value=0.0
            elif nxt is not None and nxt.pos_ in {'NOUN','PROPN'}:
                value=0.25 if listicle else 0.75
            elif low in {'hundred','thousand','million','billion'}:
                value=0.5
        elif low in SCALE_WORDS:
            value=0.5
        elif low in ORDINAL_WORDS:
            value=0.25
        score=max(score,value)
    return float(score)


def spacy_place_anchor(title: str, doc=None) -> float:
    if TIME_PLACE.search(title) or COUNTRY_RE.search(title) or COUNTRY_ACRONYM_RE.search(title):
        return 1
    if doc is None:
        return 0
    score = 0.0
    for ent in doc.ents:
        if ent.label_ not in {'GPE','LOC','FAC'}:
            continue
        normalised = normalise_place_entity(ent.text)
        if not normalised or normalised in PLACE_FALSE_POSITIVE_ENTITIES:
            continue
        locative = locative_place_context(title, ent)
        if ent.label_ == 'FAC':
            if locative:
                score = max(score, 0.5)
            continue
        if normalised in PLACE_CONTEXT_REQUIRED_ENTITIES and not locative:
            continue
        score = max(score, 1.0)
    return score


def enhanced_explanatory_framing(title: str) -> int:
    if EXPLANATORY.search(title):
        return 1
    if EXPLICIT_CURIOSITY.search(title):
        return 0
    lower=title.casefold()
    if re.match(r"^\s*(?:why|how)\b",lower):
        return 1
    if re.search(r"^\s*what\b.{0,90}\?\s*$",lower):
        return 1
    if re.search(r"\bwhat\b.{1,55}\bmeans?\b",lower):
        return 1
    if re.match(r"^\s*inside\b",lower):
        return 1
    return 0


def enhanced_context_comparison(title: str, doc=None) -> float:
    if CONTEXT.search(title):
        return 1
    if re.search(r"\b(?:amid|following)\b",title,re.I):
        return 0.75
    if re.search(r"\b(?:after|before)\b",title,re.I):
        return 0.5
    if doc is not None and any(token.tag_ in {'JJR','RBR'} and token.lower_ not in {'more','less','fewer'} for token in doc):
        return 0.5
    return 0

try:
    import pycountry
    country_names = [c.name for c in pycountry.countries]
    country_names += ['Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'America']
except Exception:
    country_names = ['Britain','England','Scotland','Wales','France','Germany','China','Russia','Ukraine','India','Australia','Canada','Japan','Israel','Iran','Brazil','Mexico','South Africa']
country_names += ['Russia', 'Iran', 'Turkey', 'Syria', 'Vietnam', 'Laos', 'Bolivia', 'Moldova', 'Tanzania', 'Korea', 'North Korea', 'South Korea', 'S. Korea', 'U.S.', 'U.K.']
COUNTRY_RE = re.compile(r"\b(?:" + '|'.join(re.escape(x) for x in sorted(set(country_names), key=len, reverse=True)) + r")\b", re.I)
COUNTRY_ACRONYM_RE = re.compile(r"(?<![A-Za-z])(?:UK|U\.K\.|US|U\.S\.|USA|U\.S\.A\.|UAE|GB)(?![A-Za-z])")

PLACE_FALSE_POSITIVE_ENTITIES = {
    'ai', 'man city', 'manchester city', 'man united', 'nvidia', 'poundland', 'netflix',
    'f1', 'badenoch', 'duran', 'infantino', 'burnham', 'isak', 'tributes', 'steam',
    'pochettino', 'ebola', 'liv golf', 'kompany', 'haaland', 'titan', 'ubisoft', 'us',
    'osimhen', 'grand slam', 'game pass', 'bungie', 'atlus', 'the ocarina of time',
    'toy story', 'infinity ward', 'night city', 'zombies', 'navi', 'dungeon', 'south park',
    'alien', 'ninja gaiden', 'lost ark', 'the game awards', 'grand theft auto', 'grey cup',
    'uconn', 'magician', 'g20', 'bundesliga', 'carney', 'prabowo', 'clavius', 'audi korea',
    'premium bonds', 'fedex', 'wawa', 'royal', 'ea', 'lammens', 'mississippi senate', 'qa',
}

PLACE_CONTEXT_REQUIRED_ENTITIES = {
    'liverpool', 'newcastle', 'sunderland', 'brighton', 'ipswich', 'leeds', 'barcelona',
    'madrid', 'milan', 'brugge', 'sporting', 'washington', 'warren', 'hollywood', 'delta',
    'belmont', 'lexington', 'west', 'hamilton', 'reading', 'victoria', 'chelsea', 'arsenal',
    'portland', 'oakland', 'memphis', 'st. thomas', 'le havre', 'rome', 'jerusalem',
}
PLACE_GEO_SUFFIX_RE = re.compile(r"^(?:city|county|province|state|island|islands|coast|airport|hospital|prison|school|university|council|police|border|harbour|harbor|beach|port|region|district|highway|runway)\b", re.I)
LOCATIVE_PREFIX_RE = re.compile(r"\b(?:in|at|near|across|around|throughout|inside|outside|off|from|to|into|towards?|on)\s+(?:the\s+)?$", re.I)


def normalise_place_entity(text):
    value = re.sub(r'\s+', ' ', str(text).strip().casefold())
    value = re.sub(r"[’']s$", '', value).strip(' .,:;|')
    return value


def locative_place_context(title, ent):
    prefix = title[:ent.start_char].rstrip()
    suffix = title[ent.end_char:].lstrip()
    return bool(LOCATIVE_PREFIX_RE.search(prefix) or PLACE_GEO_SUFFIX_RE.match(suffix))

DELIVERY_METRICS = ['event_clarity','quantified_specificity','time_place_anchor','causal_explanation','material_consequence','evidence_provenance','context_comparison','explanatory_framing','original_reporting_signal']
COMPOSITE_DELIVERY_METRICS = ['event_clarity','quantified_specificity','time_place_anchor','causal_explanation','material_consequence','evidence_provenance','context_comparison','explanatory_framing']
ATTENTION_METRICS = ['low_explicit_curiosity_gap','low_direct_service_packaging','low_sensational_personal']
VALUE_METRICS = COMPOSITE_DELIVERY_METRICS + ATTENTION_METRICS
FEATURES = [
    {'key':'event_clarity','label':'Explicit event / action','polarity':'positive','value':True,'description':'Specific event/action predicate. Direct action verbs count fully; grammatically uncertain title-case verb forms count 0.75; speech/report/announcement acts and clear noun-led event references count 0.5. Independent of attention packaging so packaging is not double-counted.'},
    {'key':'quantified_specificity','label':'Quantified detail','polarity':'positive','value':True,'description':'Fractional numeric detail: exact quantities/money/percentages/ages count fully; bare or spelled counts slightly less; years, scale words and ordinals are weaker; product/version/listicle numerals are discounted.'},
    {'key':'time_place_anchor','label':'Time / place anchor','polarity':'positive','value':True,'description':'Explicit date/time/day or country/place anchor; NER place candidates are filtered for headline-case false positives, and facility-only anchors count weakly.'},
    {'key':'causal_explanation','label':'Causal relationship','polarity':'positive','value':True,'description':'Causal, consequence-linking or explicit relational language.'},
    {'key':'material_consequence','label':'Material consequences','polarity':'positive','value':True,'description':'Impacts, costs, risks, jobs, health, harm, benefits or material changes.'},
    {'key':'evidence_provenance','label':'Evidence specificity','polarity':'positive','value':True,'description':'Continuous evidence-surface score: documentary/legal/data evidence highest, typed research evidence next, direct testimony moderate, communication events or vague attribution low. Surface specificity only, not truth or methodological quality.'},
    {'key':'context_comparison','label':'Context / comparison','polarity':'positive','value':True,'description':'Fractional context cue: explicit comparisons, trends, records or historical references count fully; amid/following count 0.75; bare sequence markers and comparative forms count 0.5.'},
    {'key':'explanatory_framing','label':'Explanatory / service framing','polarity':'positive','value':True,'description':'Explanation, guide, mechanism, why/how question or explicit service-journalism framing; language presence only, not correctness.'},
    {'key':'original_reporting_signal','label':'Original-access cue','polarity':'positive','value':False,'description':'Explicit original-access/provenance cue: investigation reveals/found, exclusive interview/report/access, documents obtained, interview with, FOI or our-analysis. High precision, very low recall; diagnostic only because it is too sparse for stable source ordering.'},
    {'key':'low_explicit_curiosity_gap','label':'Curiosity-gap restraint','polarity':'inverse','value':True,'description':'Continuous curiosity-gap risk built from stock teaser phrases plus structural withholding cues: vague references, listicle examples, unresolved forward references, reaction/resolution gaps and pronoun/determiner load. Stored inverse is used in the composite; exported adverse rate is mean risk, not binary incidence.'},
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


def compact_brand_text(value):
    compact = re.sub(r'[^a-z0-9]+', '', str(value).casefold())
    return re.sub(r'^the', '', compact)


SOURCE_SUFFIX_ALIASES = {
    'fox59indianapolis': {'fox59'},
    'kait8': {'kait'},
    'ghacks': {'ghackstechnews'},
    'vnexpress': {'vnexpressinternational'},
    'nature': {'natureimmunology', 'naturemedicine'},
    'oregonliveobituaries': {'legacy'},
}


def strip_source_boilerplate_suffix(title, source):
    match = re.search(r'\s[-–—|]\s([^-–—|]{2,60})$', title)
    if not match:
        return title, False
    source_compact = compact_brand_text(source)
    suffix_compact = compact_brand_text(match.group(1))
    aliases = {source_compact, *SOURCE_SUFFIX_ALIASES.get(source_compact, set())}
    if suffix_compact in aliases:
        return title[:match.start()].rstrip(' -–—|'), True
    return title, False


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


def detect_one(title: str, nlp, doc=None, event_lemmas=None):
    doc=doc if doc is not None else nlp(title)
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
    ner_named = any(ent.label_ in {'PERSON','ORG','GPE','LOC','PRODUCT','EVENT','WORK_OF_ART','NORP','LAW','FAC'} for ent in getattr(doc,'ents',[]))
    named_entity = int(cap_multi>0 or acronym>0 or ORG_HINT.search(title) is not None or ner_named)

    event_action = detect_event_action(title,doc=doc,event_lemmas=event_lemmas)
    numeric = quantified_specificity_score(title,doc=doc)
    time_place = spacy_place_anchor(title,doc=doc)
    causal = int(CAUSAL.search(title) is not None)
    consequence = int(CONSEQUENCE.search(title) is not None)
    context = enhanced_context_comparison(title,doc=doc)
    public = int(PUBLIC_INTEREST.search(title) is not None)
    original = int(ORIGINALITY.search(title) is not None)
    explanatory = enhanced_explanatory_framing(title)
    primary_evidence = bool(PRIMARY_EVIDENCE.search(title))
    research_claim = bool(RESEARCH_CLAIM.search(title))
    evidence_features = evidence_surface_features(title, doc)
    evidence_score = evidence_features['evidence_surface_score']

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
    curiosity_features = curiosity_gap_features(title,doc,event_action=event_action,numeric=numeric,time_place=time_place,evidence_score=evidence_score,explanatory=explanatory,direct_service=direct_service)
    curiosity_gap_score = curiosity_features['curiosity_gap_score']

    n_words=len(words)
    teaser_verb=int(teaser_verb)
    title_case_entity_count = len(cap_tokens) + cap_multi + acronym
    raw = [event_action,numeric,time_place,causal,consequence,evidence_score,context,explanatory,1-curiosity_gap_score,1-direct_service,1-personal_sensational]
    legacy_raw = [int(event_action and not legacy_bait),numeric,time_place,causal,consequence,int(evidence_score>0),context,original,explanatory,1-legacy_bait,1-personal_sensational]
    return {
        'word_count':n_words,'char_count':len(title),'event_action_present':event_action,
        'named_entity_proxy':named_entity,'capitalised_entity_count_proxy':title_case_entity_count,
        'teaser_verb_present':teaser_verb,'explicit_curiosity_gap_present':explicit_gap,
        'explicit_curiosity_gap_risk':curiosity_gap_score,
        'stock_teaser_surface':int(curiosity_features['stock_teaser_surface']),
        'trailing_ellipsis_surface':int(curiosity_features['trailing_ellipsis_surface']),
        'listicle_withholding_surface':int(curiosity_features['listicle_withholding_surface']),
        'mechanism_gap_surface':int(curiosity_features['mechanism_gap_surface']),
        'teaching_withholding_surface':int(curiosity_features['teaching_withholding_surface']),
        'unresolved_finding_question_surface':int(curiosity_features['unresolved_finding_question_surface']),
        'verbal_withholding_surface':int(curiosity_features['verbal_withholding_surface']),
        'withheld_examples_surface':int(curiosity_features['withheld_examples_surface']),
        'withheld_reason_surface':int(curiosity_features['withheld_reason_surface']),
        'resolution_gap_surface':int(curiosity_features['resolution_gap_surface']),
        'withheld_timing_surface':int(curiosity_features['withheld_timing_surface']),
        'reaction_gap_surface':int(curiosity_features['reaction_gap_surface']),
        'emphatic_gap_surface':int(curiosity_features['emphatic_gap_surface']),
        'vague_reference_surface':int(curiosity_features['vague_reference_surface']),
        'followup_question_surface':int(curiosity_features['followup_question_surface']),
        'unresolved_forward_start':int(curiosity_features['unresolved_forward_start']),
        'narrative_pronoun_hook':int(curiosity_features['narrative_pronoun_hook']),
        'curiosity_pronoun_density':curiosity_features['curiosity_pronoun_density'],
        'curiosity_determiner_density':curiosity_features['curiosity_determiner_density'],
        'curiosity_wh_density':curiosity_features['curiosity_wh_density'],
        'curiosity_forwardish_density':curiosity_features['curiosity_forwardish_density'],
        'curiosity_specificity_points':curiosity_features['curiosity_specificity_points'],
        'curiosity_structural_load':curiosity_features['curiosity_structural_load'],
        'direct_service_packaging_present':direct_service,'legacy_bait_present':legacy_bait,
        'question_form_present':question,'sensational_word_present':int(sens),
        'personal_life_frame_present':int(personal),'personal_sensational_frame_present':personal_sensational,
        'celebrity_cue_present':int(celebrity),'attribution_present':int(ATTRIBUTION.search(title) is not None),
        'anonymous_source_cue':int(ANONYMOUS_SOURCE.search(title) is not None),
        'primary_evidence_cue':int(primary_evidence),'research_claim_cue':int(research_claim),
        'evidence_strength':int(2 if primary_evidence else 1 if research_claim else 0),
        'evidence_surface_strength':evidence_features['evidence_surface_strength'],
        'evidence_anchor_surface':int(evidence_features['evidence_anchor_surface']),
        'document_object_surface':int(evidence_features['document_object_surface']),
        'research_object_surface':int(evidence_features['research_object_surface']),
        'visual_object_surface':int(evidence_features['visual_object_surface']),
        'weak_typed_object_surface':int(evidence_features['weak_typed_object_surface']),
        'document_empirical_surface':int(evidence_features['document_empirical_surface']),
        'research_empirical_surface':int(evidence_features['research_empirical_surface']),
        'visual_empirical_surface':int(evidence_features['visual_empirical_surface']),
        'modified_evidence_surface':int(evidence_features['modified_evidence_surface']),
        'document_disclosure_surface':int(evidence_features['document_disclosure_surface']),
        'legal_testimony_surface':int(evidence_features['legal_testimony_surface']),
        'direct_testimony_surface':int(evidence_features['direct_testimony_surface']),
        'direct_testimony_vague_speaker':int(evidence_features['direct_testimony_vague_speaker']),
        'quote_testimony_surface':int(evidence_features['quote_testimony_surface']),
        'announcement_surface':int(evidence_features['announcement_surface']),
        'vague_attribution_surface':int(evidence_features['vague_attribution_surface']),
        'event_clarity':event_action,'named_entity_signal':named_entity,'quantified_specificity':numeric,
        'time_place_anchor':time_place,'causal_explanation':causal,'material_consequence':consequence,
        'evidence_provenance':evidence_score,'context_comparison':context,'public_interest':public,
        'original_reporting_signal':original,'explanatory_framing':explanatory,
        'low_explicit_curiosity_gap':1-curiosity_gap_score,'low_direct_service_packaging':1-direct_service,
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


def value_component_residuals(df: pd.DataFrame, expected, attention_context_adjustment=0.25):
    """Return per-headline residuals for composite inputs in natural cue units.

    Delivery cues are fully topic/context-residualised. Inverse attention-restraint
    cues use the configured partial topic adjustment, with the remainder compared
    against corpus-wide incidence. The row mean of these components rewards
    headlines that carry several cues at once instead of averaging independently
    renormalised axis z-scores later.
    """
    value_ix=[FEATURE_KEYS.index(c) for c in VALUE_METRICS]
    Y=df[VALUE_METRICS].to_numpy(dtype=float)
    E=expected[:,value_ix]
    R=Y-E
    attention_lambda=float(attention_context_adjustment)
    for j,col in enumerate(VALUE_METRICS):
        if col in ATTENTION_METRICS:
            corpus_mean=float(df[col].mean())
            R[:,j]=Y[:,j]-(attention_lambda*E[:,j]+(1.0-attention_lambda)*corpus_mean)
    return R,R.mean(axis=1)


def estimate_aggregate_shrinkage(df: pd.DataFrame, row_signal, min_source_n=20):
    """Estimate the shrinkage constant from within- and between-source variance.

    Under the usual random-effects approximation, row variance sigma^2 gives
    sampling variance sigma^2/n and between-source variance tau^2 gives shrinkage
    n/(n+sigma^2/tau^2). This replaces the earlier hand-picked constant while keeping
    the same conservative empirical-Bayes interpretation.
    """
    rows=[]
    for source_key, positions in df.groupby('source_key',sort=False).indices.items():
        x=np.asarray(row_signal[np.asarray(positions,dtype=int)],dtype=float)
        n=len(x)
        if n<min_source_n or n<2: continue
        rows.append({'source_key':source_key,'n':n,'mean':float(x.mean()),'row_variance':float(x.var(ddof=1))})
    stats=pd.DataFrame(rows)
    if len(stats)<3:
        return {'k':25.0,'sigma2':np.nan,'tau2':np.nan,'mean_sampling_variance':np.nan,'source_count':len(stats)}
    weights=np.maximum(stats['n']-1,1).to_numpy(dtype=float)
    sigma2=float(np.average(stats['row_variance'],weights=weights))
    stats['sampling_variance']=stats['row_variance']/stats['n']
    # A zero observed within-source variance is sampling luck, not proof of zero
    # uncertainty. Use the pooled row variance as a floor in that degenerate case.
    stats['sampling_variance']=np.maximum(stats['sampling_variance'],sigma2/stats['n']*0.05)
    v=stats['sampling_variance'].to_numpy(dtype=float)
    r=stats['mean'].to_numpy(dtype=float)
    w=1.0/np.maximum(v,1e-12)
    rbar=float((w*r).sum()/w.sum())
    q=float((w*(r-rbar)**2).sum())
    c=float(w.sum()-(w**2).sum()/w.sum())
    tau2=max(0.0,(q-(len(stats)-1))/c) if c>0 else 0.0
    k=sigma2/tau2 if tau2>1e-12 else 250.0
    k=float(min(max(k,1.0),250.0))
    return {'k':k,'sigma2':sigma2,'tau2':tau2,'mean_sampling_variance':float(v.mean()),'source_count':int(len(stats))}


def axis_diagnostics(src, shrink, min_n):
    """Keep per-axis adjusted positions inspectable without making them the composite."""
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
        out[col+'_adjusted_pp']=tmp
        out[col+'_relative_z']=(tmp-mu)/sd
        zcols.append(col+'_relative_z')
    out['axis_average_index']=(50+15*out[zcols].clip(-3,3).mean(axis=1)).clip(0,100)
    return out


def composite_for_shrink(src, shrink, min_n, cap_quantile=0.9, fixed_cap_pp=None):
    """Corpus-normalise the aggregate natural-unit residual.

    Axis residuals are first shrunk in natural cue units. A symmetric corpus-derived
    saturation point then limits how much leverage one very large axis deviation can
    have before the eleven axes are averaged. The spiderweb axes themselves remain
    uncapped; the cap applies only to composite aggregation. The final 50/15 transform
    is a corpus-relative display calibration rather than a claim that one axis z-score
    is interchangeable with another.
    """
    out=src.copy()
    eligible=out['n']>=min_n
    factor=out['n']/(out['n']+float(shrink))
    residual_cols=[c+'_index_residual' for c in VALUE_METRICS]
    components=100*out[residual_cols].astype(float).mul(factor,axis=0)
    if fixed_cap_pp is not None:
        cap_pp=float(fixed_cap_pp)
    elif cap_quantile is not None and 0<float(cap_quantile)<1:
        cap_pp=float(np.quantile(np.abs(components.loc[eligible].to_numpy(dtype=float)),float(cap_quantile)))
    else:
        cap_pp=float('inf')
    capped=components.clip(lower=-cap_pp,upper=cap_pp) if np.isfinite(cap_pp) else components
    adj=capped.mean(axis=1)
    out['composite_axis_cap_pp']=cap_pp if np.isfinite(cap_pp) else np.nan
    out['composite_adjusted_pp']=adj
    mu=float(adj[eligible].mean())
    sd=float(adj[eligible].std(ddof=1))
    if sd<=1e-8: sd=1.0
    out['composite_relative_z']=(adj-mu)/sd
    out['topic_adjusted_value_index']=(50+15*out['composite_relative_z'].clip(-3,3)).clip(0,100)
    order=out.loc[out['n']>=min_n].sort_values('topic_adjusted_value_index',ascending=False).index
    out['rank']=np.nan
    out.loc[order,'rank']=np.arange(1,len(order)+1)
    return out,cap_pp


def band_from_rank(rank, eligible_count):
    if not np.isfinite(rank): return 'Unranked'
    pct=rank/max(eligible_count,1)
    if pct<=0.25: return 'A — upper quartile'
    if pct<=0.50: return 'B — second quartile'
    if pct<=0.75: return 'C — third quartile'
    return 'D — lower quartile'


def source_statistics(df, expected, min_source_n=20, shrinkage=25, shrinkage_grid=(10,25,50), bootstrap=250, seed=27, attention_context_adjustment=0.25, empirical_composite_shrinkage=True, composite_axis_cap_quantile=0.9):
    component_residuals,composite_row_residual=value_component_residuals(df,expected,attention_context_adjustment=attention_context_adjustment)
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
              body_evidence_surface_rate=('body_strong_evidence_surface','mean'), body_testimony_surface_rate=('body_testimony_surface','mean'),
              body_evidence_surface_score_mean=('body_evidence_surface_score','mean'),
              body_event_action_rate=('body_event_action_cue','mean'), body_explanatory_rate=('body_explanatory_cue','mean'),
              within_source_template_reuse_rate=('within_source_repeated_trigram_proxy','mean'),
              attribution_cue_rate=('attribution_present','mean'), anonymous_source_cue_rate=('anonymous_source_cue','mean'),
              strong_evidence_surface_rate=('strong_evidence_surface','mean'), research_evidence_surface_rate=('research_evidence_surface','mean'),
              direct_testimony_surface_rate=('direct_testimony_surface','mean'), quote_testimony_surface_rate=('quote_testimony_surface','mean'),
              vague_attribution_surface_rate=('vague_attribution_surface','mean'),
              curiosity_gap_risk_mean=('explicit_curiosity_gap_risk','mean'),
              stock_teaser_surface_rate=('stock_teaser_surface','mean'),
              listicle_withholding_surface_rate=('listicle_withholding_surface','mean'),
              withheld_reason_surface_rate=('withheld_reason_surface','mean'),
              resolution_gap_surface_rate=('resolution_gap_surface','mean'),
              vague_reference_surface_rate=('vague_reference_surface','mean'),
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

    composite_rows=[]
    for source_key, positions in g.indices.items():
        x=np.asarray(composite_row_residual[np.asarray(positions,dtype=int)],dtype=float)
        composite_rows.append({'source_key':source_key,
                               'composite_residual_uncapped_mean':float(x.mean()),
                               'composite_residual_row_variance':float(x.var(ddof=1)) if len(x)>1 else np.nan})
    src=src.merge(pd.DataFrame(composite_rows),on='source_key',how='left')
    shrinkage_stats=estimate_aggregate_shrinkage(df,composite_row_residual,min_source_n=min_source_n) if empirical_composite_shrinkage else {'k':float(shrinkage),'sigma2':np.nan,'tau2':np.nan,'mean_sampling_variance':np.nan,'source_count':0}
    primary_shrinkage=float(shrinkage_stats['k']) if empirical_composite_shrinkage else float(shrinkage)
    src['composite_shrinkage_k']=primary_shrinkage
    src['composite_shrinkage_factor']=src['n']/(src['n']+primary_shrinkage)
    for key,value in shrinkage_stats.items():
        if key!='k': src['composite_variance_'+key]=value

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

    # Axis z-scores remain diagnostic profiles. The composite is instead built in
    # natural cue units so co-occurring information cues accumulate rather than
    # being compressed by a second round of independent z-score averaging.
    src=axis_diagnostics(src,primary_shrinkage,min_source_n)

    sensitivity=[]
    sensitivity_ks=[]
    for shrink in shrinkage_grid:
        if not any(abs(float(shrink)-float(x))<1e-9 for x in sensitivity_ks):
            sensitivity_ks.append(float(shrink))
    if not any(abs(primary_shrinkage-float(x))<1e-9 for x in sensitivity_ks):
        sensitivity_ks.append(primary_shrinkage)
    base,primary_cap_pp=composite_for_shrink(src,primary_shrinkage,min_source_n,cap_quantile=composite_axis_cap_quantile)
    for shrink in sensitivity_ks:
        comp,_=composite_for_shrink(src,shrink,min_source_n,cap_quantile=composite_axis_cap_quantile,fixed_cap_pp=primary_cap_pp)
        sensitivity.append((shrink,comp))
    for col in ['topic_adjusted_value_index','rank','composite_adjusted_pp','composite_relative_z','composite_axis_cap_pp']:
        src[col]=base[col]

    sens_rows=[]
    for shrink,comp in sensitivity:
        for _,row in comp[['source_key','source','n','topic_adjusted_value_index','rank']].iterrows():
            sens_rows.append({'source_key':row['source_key'],'source':row['source'],'n':row['n'],'shrinkage':shrink,
                              'topic_adjusted_value_index':row['topic_adjusted_value_index'],'rank':row['rank']})
    sensitivity_df=pd.DataFrame(sens_rows)

    # Bootstrap intervals for the aggregate composite: headline sampling uncertainty only.
    rng=np.random.default_rng(seed)
    eligible=src['n']>=min_source_n
    comp_mu=float(src.loc[eligible,'composite_adjusted_pp'].mean())
    comp_sd=max(float(src.loc[eligible,'composite_adjusted_pp'].std(ddof=1)),1e-8)
    ci_low=np.full(len(src),np.nan); ci_high=np.full(len(src),np.nan)
    src_index={key:i for i,key in enumerate(src['source_key'])}
    if int(bootstrap)>0:
        cap_pp=float(src['composite_axis_cap_pp'].iloc[0])
        for source_key, positions in g.indices.items():
            row_i=src_index[source_key]
            n=len(positions)
            if n<min_source_n: continue
            pos=np.asarray(positions,dtype=int)
            Rsrc=component_residuals[pos,:]
            boot_ix=rng.integers(0,n,size=(int(bootstrap),n))
            component_means_b=Rsrc[boot_ix].mean(axis=1)
            adj_components_b=100.0*component_means_b*(n/(n+primary_shrinkage))
            adj_b=np.clip(adj_components_b,-cap_pp,cap_pp).mean(axis=1)
            z_b=np.clip((adj_b-comp_mu)/comp_sd,-3,3)
            score_b=np.clip(50.0+15.0*z_b,0,100)
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
        annotations=[dict(text='Axes are occurrence rates or mean continuous risk. The final four axes are adverse/diagnostic, so lower is better. Evidence specificity is a tiered evidence/testimony surface score. Title-language signals only.',
                          x=0.5,y=-0.11,xref='paper',yref='paper',showarrow=False,font=dict(size=11))])
    fig.write_html(output_html,include_plotlyjs=True,full_html=True)


def detector_audit_sample(df, out_path, seed=27, per_stratum=30):
    rng=np.random.default_rng(seed)
    rows=[]
    strata=[
        ('explicit_curiosity_gap',df['explicit_curiosity_gap_present'].eq(1)),
        ('curiosity_risk_moderate',df['explicit_curiosity_gap_risk'].ge(0.3)&df['explicit_curiosity_gap_risk'].lt(0.6)),
        ('curiosity_risk_high',df['explicit_curiosity_gap_risk'].ge(0.6)),
        ('direct_service_packaging',df['direct_service_packaging_present'].eq(1)),
        ('sensational_personal',df['personal_sensational_frame_present'].eq(1)),
        ('evidence_document_legal',df['evidence_surface_strength'].eq(4)),
        ('evidence_research_surface',df['evidence_surface_strength'].eq(3)),
        ('evidence_testimony_surface',df['evidence_surface_strength'].eq(2)),
        ('evidence_weak_or_vague',df['evidence_surface_strength'].eq(1)),
        ('unflagged',df[['explicit_curiosity_gap_present','direct_service_packaging_present','personal_sensational_frame_present']].sum(axis=1).eq(0)&df['evidence_surface_strength'].eq(0)),
    ]
    for label,mask in strata:
        ix=np.flatnonzero(mask.to_numpy())
        if len(ix)==0: continue
        take=rng.choice(ix,size=min(per_stratum,len(ix)),replace=False)
        for i in take:
            r=df.iloc[int(i)]
            rows.append({'stratum':label,'source':r['source'],'headline':r['headline'],'url':r.get('url',''),
                         'explicit_curiosity_gap_present':r['explicit_curiosity_gap_present'],
                         'explicit_curiosity_gap_risk':r['explicit_curiosity_gap_risk'],
                         'direct_service_packaging_present':r['direct_service_packaging_present'],
                         'personal_sensational_frame_present':r['personal_sensational_frame_present'],
                         'evidence_strength':r['evidence_strength'],'evidence_surface_strength':r['evidence_surface_strength'],
                         'evidence_provenance':r['evidence_provenance'],'human_label':'','human_notes':''})
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
    df['raw_headline']=df['headline']
    cleaned=[strip_source_boilerplate_suffix(title,source) for title,source in zip(df['headline'],df['member_source'])]
    df['headline']=[x[0] for x in cleaned]
    df['source_suffix_stripped']=[int(x[1]) for x in cleaned]
    df['headline_id']=np.arange(len(df))
    t=mark('parse_archive',t)

    spacy_model=str(cfg.get('spacy_model','en_core_web_sm'))
    if bool(cfg.get('use_spacy_model',True)):
        try:
            nlp=spacy.load(spacy_model,disable=['parser'])
        except Exception as exc:
            print(f'spaCy model {spacy_model!r} unavailable ({exc}); falling back to blank tokeniser',flush=True)
            nlp=spacy.blank('en')
    else:
        nlp=spacy.blank('en')
    event_lemmas=build_event_lemma_pool(nlp) if 'tagger' in nlp.pipe_names and 'lemmatizer' in nlp.pipe_names else None
    titles=df['headline'].tolist()
    docs=list(nlp.pipe(titles,batch_size=int(cfg.get('spacy_batch_size',500))))
    det=pd.DataFrame([detect_one(title,nlp,doc=doc,event_lemmas=event_lemmas) for title,doc in zip(titles,docs)])
    df=pd.concat([df.reset_index(drop=True),det],axis=1)
    df['strong_evidence_surface']=df['evidence_surface_strength'].ge(4).astype(int)
    df['research_evidence_surface']=df['evidence_surface_strength'].eq(3).astype(int)
    body=df['body_text'].fillna('').astype(str)
    df['body_word_count']=body.str.split().str.len()
    df['body_coverage_present']=(df['body_word_count']>df['word_count']+5).astype(int)
    df['body_primary_evidence_cue']=body.map(lambda x:int(PRIMARY_EVIDENCE.search(x) is not None))
    df['body_research_claim_cue']=body.map(lambda x:int(RESEARCH_CLAIM.search(x) is not None))
    df['body_evidence_strength']=np.select([df['body_primary_evidence_cue'].eq(1),df['body_research_claim_cue'].eq(1)],[2,1],default=0)
    df['body_evidence_surface_score']=body.map(body_evidence_surface_score)
    df['body_strong_evidence_surface']=(df['body_evidence_surface_score']>=0.95).astype(int)
    df['body_testimony_surface']=(df['body_evidence_surface_score']>=0.55).astype(int)
    df['body_vague_attribution_surface']=body.map(lambda x:int(BODY_VAGUE_ATTRIBUTION_SURFACE.search(x) is not None))
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
    df['attention_packaging_pressure']=100*df[['explicit_curiosity_gap_risk','direct_service_packaging_present','personal_sensational_frame_present']].mean(axis=1)
    df['title_value_signal']=100*df[VALUE_METRICS].mean(axis=1)
    src,sensitivity_df=source_statistics(df,expected,min_source_n=int(cfg['min_source_n']),shrinkage=float(cfg['default_shrinkage']),
                                         shrinkage_grid=cfg['shrinkage_grid'],bootstrap=int(cfg['bootstrap']),seed=int(cfg['random_seed']),
                                         attention_context_adjustment=float(cfg.get('attention_context_adjustment',0.25)),
                                         empirical_composite_shrinkage=bool(cfg.get('empirical_composite_shrinkage',True)),
                                         composite_axis_cap_quantile=float(cfg.get('composite_axis_cap_quantile',0.9)))
    if expected_length_adjusted is not None:
        src_len,_=source_statistics(df,expected_length_adjusted,min_source_n=int(cfg['min_source_n']),shrinkage=float(cfg['default_shrinkage']),
                                    shrinkage_grid=cfg['shrinkage_grid'],bootstrap=0,seed=int(cfg['random_seed']),
                                    attention_context_adjustment=float(cfg.get('attention_context_adjustment',0.25)),
                                    empirical_composite_shrinkage=bool(cfg.get('empirical_composite_shrinkage',True)),
                                    composite_axis_cap_quantile=float(cfg.get('composite_axis_cap_quantile',0.9)))
        len_cols=['source_key','topic_adjusted_value_index','rank','rank_n50','rank_n100','ordering_band']
        len_suffix=src_len[len_cols].rename(columns={c:'length_adjusted_'+c for c in len_cols if c!='source_key'})
        src=src.merge(len_suffix,on='source_key',how='left')
    t=mark('source_statistics_and_bootstrap',t)

    df['body_text_excerpt']=df['body_text'].fillna('').astype(str).str.slice(0,600)
    story_cols=['headline_id','source_key','source','member_source_key','member_source','measurement_grouped','group','tree_root','branch_path','curated_group','editorial_context','neutral_editorial_context','group_file','headline','raw_headline','source_suffix_stripped','body_text_excerpt','url','published','story_id','category','story_type','word_count','story_word_count','information_delivery_signal','attention_packaging_pressure','title_value_signal','legacy_title_value_signal_raw','dominant_topic','topic_strength']
    story_cols += FEATURE_KEYS + ['cross_source_title_echo','event_action_present','named_entity_proxy','capitalised_entity_count_proxy','teaser_verb_present','explicit_curiosity_gap_present','explicit_curiosity_gap_risk','stock_teaser_surface','trailing_ellipsis_surface','listicle_withholding_surface','mechanism_gap_surface','teaching_withholding_surface','unresolved_finding_question_surface','verbal_withholding_surface','withheld_examples_surface','withheld_reason_surface','resolution_gap_surface','withheld_timing_surface','reaction_gap_surface','emphatic_gap_surface','vague_reference_surface','followup_question_surface','unresolved_forward_start','narrative_pronoun_hook','curiosity_pronoun_density','curiosity_determiner_density','curiosity_wh_density','curiosity_forwardish_density','curiosity_specificity_points','curiosity_structural_load','direct_service_packaging_present','legacy_bait_present','question_form_present','sensational_word_present','personal_life_frame_present','personal_sensational_frame_present','celebrity_cue_present','attribution_present','anonymous_source_cue','primary_evidence_cue','research_claim_cue','evidence_strength','evidence_surface_strength','strong_evidence_surface','research_evidence_surface','evidence_anchor_surface','document_object_surface','research_object_surface','visual_object_surface','weak_typed_object_surface','document_empirical_surface','research_empirical_surface','visual_empirical_surface','modified_evidence_surface','document_disclosure_surface','legal_testimony_surface','direct_testimony_surface','direct_testimony_vague_speaker','quote_testimony_surface','announcement_surface','vague_attribution_surface','body_coverage_present','body_word_count','body_primary_evidence_cue','body_research_claim_cue','body_evidence_strength','body_evidence_surface_score','body_strong_evidence_surface','body_testimony_surface','body_vague_attribution_surface','body_event_action_cue','body_explanatory_cue','cross_source_title_similarity','cross_source_near_duplicate_proxy','cross_source_nearest_source','cross_source_nearest_headline','within_source_repeated_trigram_proxy']
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
    profile_cols += ['strong_evidence_surface_rate','research_evidence_surface_rate','direct_testimony_surface_rate','quote_testimony_surface_rate','vague_attribution_surface_rate']
    profile_cols += ['curiosity_gap_risk_mean','stock_teaser_surface_rate','listicle_withholding_surface_rate','withheld_reason_surface_rate','resolution_gap_surface_rate','vague_reference_surface_rate']
    profile_cols += ['body_coverage_rate','body_word_count_mean','body_primary_evidence_rate','body_research_claim_rate','body_evidence_surface_rate','body_testimony_surface_rate','body_evidence_surface_score_mean','body_event_action_rate','body_explanatory_rate']
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
        'explicit_curiosity_gap_incidence':float(df['explicit_curiosity_gap_risk'].mean()),
        'direct_service_packaging_incidence':float(df['direct_service_packaging_present'].mean()),
        'sensational_personal_incidence':float(df['personal_sensational_frame_present'].mean()),
        'cross_source_title_echo':float(df['cross_source_title_echo'].mean()),
    }
    sensitivity_pivot=sensitivity_df.dropna(subset=['rank']).pivot_table(index='source_key',columns='shrinkage',values='topic_adjusted_value_index')
    sensitivity_corr=sensitivity_pivot.corr(method='spearman').round(4).to_dict() if sensitivity_pivot.shape[1]>1 else {}
    total_time=round(time.perf_counter()-started,3)
    summary={
      'zip':str(zip_path),'config':cfg['config_path'],'headline_rows':int(len(df)),'sources':int(df.source_key.nunique()),
      'source_suffix_stripped_rows':int(df['source_suffix_stripped'].sum()),
      'exact_duplicate_headline_rows':int((exact_dups-1).clip(lower=0).sum()),
      'cross_source_near_duplicate_title_rows':int(df.cross_source_near_duplicate_proxy.sum()),
      'sources_ranked_min_n':int(len(eligible)),'min_source_n':int(cfg['min_source_n']),
      'sources_n_ge_50':int((src.n>=50).sum()),'sources_n_ge_100':int((src.n>=100).sum()),
      'sources_below_min_n':int((src.n<int(cfg['min_source_n'])).sum()),'nmf_topics':len(topics),
      'value_signal_count':len(VALUE_METRICS),'delivery_signal_count':len(DELIVERY_METRICS),'radar_axis_count':len(RADAR_FEATURES),
      'crossfit_folds':int(cfg['folds']),'default_shrinkage':float(cfg['default_shrinkage']),'shrinkage_grid':cfg['shrinkage_grid'],
      'empirical_composite_shrinkage':bool(cfg.get('empirical_composite_shrinkage',True)),
      'composite_shrinkage_k':float(src['composite_shrinkage_k'].iloc[0]) if 'composite_shrinkage_k' in src else None,
      'composite_axis_cap_quantile':float(cfg.get('composite_axis_cap_quantile',0.9)),
      'composite_axis_cap_pp':float(src['composite_axis_cap_pp'].iloc[0]) if 'composite_axis_cap_pp' in src else None,
      'composite_score_range':[float(eligible['topic_adjusted_value_index'].min()),float(eligible['topic_adjusted_value_index'].max())] if len(eligible) else None,
      'composite_ci95_width_mean':float((eligible['topic_adjusted_index_ci95_high']-eligible['topic_adjusted_index_ci95_low']).mean()) if len(eligible) else None,
      'shrinkage_spearman_correlation':sensitivity_corr,
      'overall_axis_rates':overall_rates,
      'top_15':top[['rank','source','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index']].to_dict(orient='records'),
      'bottom_15':bottom[['rank','source','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index']].to_dict(orient='records'),
      'largest_sources':src.sort_values('n',ascending=False).head(20)[['source','n','group','topic_adjusted_value_index']].to_dict(orient='records'),
      'runtime_seconds':total_time,'stage_times':stage_times,
    }
    (out/'analysis_summary.json').write_text(json.dumps(summary,indent=2))
    (out/'run_metrics.json').write_text(json.dumps({'runtime_seconds':total_time,'stage_times':stage_times,'config':{k:v for k,v in cfg.items() if not k.endswith('_path')}},indent=2,default=str))

    cap_percentile=100*float(cfg.get('composite_axis_cap_quantile',0.9))
    lines=[]
    lines += ['# Title-only reader-value signals — improved exploratory run','',
      f"Corpus: **{len(df):,} headline rows**, **{df.source_key.nunique():,} sources**.",
      f"Source ordering eligible: **{len(eligible)}** sources with at least {int(cfg['min_source_n'])} headlines. **{int((src.n<int(cfg['min_source_n'])).sum())}** sources are below the threshold and unranked.",
      f"Runtime: **{total_time:.1f}s** local. Stage timings: " + ', '.join(f'{k} {v:.1f}s' for k,v in stage_times.items()) + '.',
      '', '## Measurement definition',
      f'The core ordering has 11 cue inputs: eight information-delivery markers plus inverse forms of curiosity-gap risk, direct-address/service packaging, and sensational/personal framing. Original-access cues and cross-source title echo are plotted as diagnostic axes but excluded from the composite. Evidence specificity is now a continuous evidence-surface score rather than two stock regex tiers: documentary/legal/data evidence scores highest, typed research evidence next, direct testimony and quotation moderate, communication events or vague attribution low, and no surface evidence zero. Curiosity-gap risk is also continuous: stock teaser forms are high-risk, while vague references, withheld listicle examples, unresolved forward references, resolution/reaction/mechanism gaps and pronoun/determiner load combine as inspectable noisy-or evidence, attenuated when the headline already supplies concrete anchors. Event clarity is fractional: direct action verbs count 1.0, grammatically uncertain title-case verb forms count 0.75, speech/report/announcement acts count 0.5, and nominal event references count 0.5. Context is fractional as well: explicit comparison or record/history cues count 1.0, amid/following count 0.75, and bare sequence or comparative forms count 0.5. Numeric detail distinguishes exact quantities from weaker years, scale words, ordinals, listicle positions and product/version numerals. The composite aggregates cue residuals in natural units, so a source with several concrete cue differences outranks one with a single cue. After empirical shrinkage, axis contributions are saturated symmetrically at a corpus-derived {cap_percentile:.0f}th-percentile absolute axis deviation before averaging; this keeps one unusually large axis residual from dominating without renormalising rare and common cues into artificial equality. The spiderweb axes themselves remain uncapped diagnostic z-scores, not a second equally-weighted composite stage.',
      '', '## Method changes in this run',
      '- Curated export metadata is used when `headline-rows.jsonl` is present: canonical source key, URL, timestamps, relation branch, editorial context, and the available body/summary text.',
      '- Exact publisher-name boilerplate suffixes such as “- The Korea Times” or “| The Jerusalem Post” are stripped before detection, while editorial hyphenated subtitles are retained; the original raw headline remains exported for audit.',
      '- Publisher-section/regional-edition groups configured in the task file are consolidated before measurement. This is conservative: BBC services, Mashable regional editions, Philippine Daily Inquirer verticals, and New York Post/Page Six are grouped; Philadelphia’s unrelated inquirer.com is excluded from the Philippine group, and unlike-owned Fox-branded local affiliates are not grouped with Fox News.',
      '- Attention packaging is split into continuous curiosity-gap risk, direct-address/service packaging, and sensational/personal framing rather than one opaque bait bucket. The curiosity implementation follows the aggregate LLM audit taxonomy: it does not treat question form or service journalism as clickbait by themselves.',
      '- Event and consequence word pools now use corpus-audited explicit inflections rather than unbounded wildcard stems. This removes systematic collisions such as first/Burnham/surgery/election/bank/winter/firms while keeping exact event words.',
      '- Country acronyms are case-sensitive, so lowercase “us” no longer counts as the United States. Quoted titles/quotations are ignored for direct-address packaging, reducing false service hits such as a work titled “You Can See Everything”.',
      '- Evidence language now uses broad token-boundary surface families guided by spaCy POS rather than a pair of stock regexes. Documentary/legal/data objects joined to empirical verbs or disclosure modifiers score highest; typed research objects and direct testimony form lower tiers; passive fragments such as “X told to…” and proper-name collisions such as a person named Testimony are guarded. Standalone earnings-call transcript labels still do not count as evidence merely because the word transcript appears. Original-access cues remain high-precision but diagnostic-only because they occur too rarely for stable source ordering.',
      '- Body/summary text is exported and scanned for evidence/event/explanatory support as a diagnostic tier, now including broad strong-evidence, testimony and vague-attribution surfaces. It is not composite input because body coverage and length vary by feed and ingest path; missing body evidence is neutral.',
      f"- Expected detector rates are cross-fitted with GroupKFold by source: a source does not train the topic/editorial-context expectation used to residualise itself. Primary title-length adjustment is **{'enabled' if primary_length_adjustment else 'disabled'}**; length-adjusted sensitivity columns are **{'included' if expected_length_adjusted is not None else 'not included'}**.",
      '- Delivery markers are fully topic/context-adjusted, while attention packaging is only partly context-adjusted (25% by default) and otherwise compared with corpus-wide incidence; this treats attention farming more as publisher behaviour than unavoidable subject matter.',
      '- The local `en_core_web_sm` spaCy model supplies POS tags, lemmas and named entities. It is a small classical NLP model, not a transformer. Event detection combines verbal POS evidence with conservative local grammar for title-case or plural/-s forms that the tagger misreads; speech/report/announcement acts and noun-led event references count as weaker fractional evidence than direct action verbs. Place detection no longer trusts raw GPE/LOC/FAC labels alone because the small NER model frequently labels sports clubs, companies, games, people and “AI” as places; corpus-audited false-positive overrides, locative syntax for ambiguous entities, and reduced-weight facility hits are used instead. Numeric detail distinguishes exact quantities, bare counts, calendar years, scale words, ordinals, listicle positions and product/version numerals.',
      f'- The composite is calculated in natural cue units before display normalisation. This avoids the previous compression artefact caused by averaging eleven independently z-scored axes. Manual inspection of fringe cases supported this choice: equal z-weighting put formulaic research-release language at the very top and over-penalised moderate curiosity/service deviations, while uncapped natural units gave single large axes too much leverage. The final composite therefore caps each shrunk axis contribution at the corpus-derived {cap_percentile:.0f}th-percentile absolute axis deviation before averaging.',
      f"- Composite shrinkage is estimated from within- and between-source variance rather than fixed by hand; this run uses k={float(src['composite_shrinkage_k'].iloc[0]):.2f} in the n/(n+k) factor. The composite axis saturation point is {float(src['composite_axis_cap_pp'].iloc[0]):.2f} adjusted percentage points. The displayed score is then corpus-normalised to mean 50 and standard deviation 15 among eligible sources, with clipping only at the extremes. Raw adjusted percentage-point residuals remain exported.",
      '- Shrinkage sensitivity is exported across the configured grid; broad quartile ordering bands are emphasised over false precision in adjacent ranks.',
      '- `detector_audit_sample.csv` is a stratified manual-labelling sample intended for future precision/recall estimation.',
      '', '## Important limitations',
      '- The composite remains headline-led. Body/summary diagnostics add context but do not measure truth, factual accuracy, importance, full article quality, or whether reporting is original in fact.',
      '- Event detection remains incomplete. Direct actions are stronger than speech acts and nominal event references, but appointment/casting announcements written with copulas, some market/state movements, and less standard headline syntax can still be missed or underweighted; those absences are not evidence that no event occurred.',
      '- English-language cues mean non-English sources naturally produce sparse detector hits and should not be compared directly with English-language sources.',
      '- The minimum-n leaderboard can still be unstable or source-type-specific at n≈20–70; syndication-heavy, official-release, obituary-heavy and transcript-heavy sources need per-axis inspection before interpretation.',
      '- The curiosity implementation is calibrated only against a small stratified LLM audit (133 assessable rows) and corpus/source distributions; evidence-family validation is aggregate rather than a complete human-labelled precision/recall study. The exported audit sample remains preparation for formal validation, not validation itself.',
      '- The composite is a corpus-relative ordering aid, not an absolute 0–100 quality measurement. Its display scale is normalised against the measured sources in this corpus; raw adjusted percentage-point residuals, confidence intervals, sample sizes and per-axis profiles are needed for interpretation.',
      '- Cross-fitting reduces in-sample leakage but does not model detector error, topic-model uncertainty, or corpus-selection uncertainty.',
      '- Direct-address/service packaging is adverse packaging pressure, not uselessness: transparent how-to/service headlines can be both search-captured and useful.',
      '- Research-release language can still resemble evidence specificity. Direct testimony also measures explicit attribution, not truth or independent verification. Conversely, scientific paper titles are often descriptive noun phrases with few event verbs, and narrative science journalism can omit formulaic “study finds” evidence language even when the article is evidence-based; neither extreme is a quality verdict.',
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
    # Numerical audit of the final capped composite. These diagnostics are descriptive,
    # not another weighting stage: they show which axes carry observed spread and how
    # sensitive the ordering is to removing one axis at a time.
    audit_base=src[src['rank_eligible']].copy()
    audit_axis_cols=[m+'_adjusted_pp' for m in VALUE_METRICS]
    X=audit_base[audit_axis_cols].astype(float).to_numpy()
    cap=float(src['composite_axis_cap_pp'].iloc[0])
    Xc=np.clip(X,-cap,cap)
    composite_rank=pd.Series(audit_base['topic_adjusted_value_index'].to_numpy()).rank(ascending=False)
    lines += ['', '## Composite numerical audit',
      f"The composite cap is **{cap:.2f} adjusted percentage points**, applied symmetrically to each shrunk axis contribution before averaging. Axis spread below is the standard deviation of capped adjusted axis positions across ranked sources; leave-one-out compares the composite ranking with the ranking after removing that axis.",
      '| Axis | Capped spread (pp sd) | Composite correlation | Leave-one-out Spearman | Max rank move |', '|---|---:|---:|---:|---:|']
    audit_labels={
        'low_explicit_curiosity_gap':'Curiosity-gap restraint',
        'low_direct_service_packaging':'Avoidance of direct/service packaging',
        'low_sensational_personal':'Avoidance of sensational/personal framing',
    }
    for j,m in enumerate(VALUE_METRICS):
        axis_vals=Xc[:,j]
        corr=float(np.corrcoef(axis_vals,audit_base['topic_adjusted_value_index'])[0,1]) if np.std(axis_vals)>1e-12 else 0.0
        keep=[x for x in range(len(VALUE_METRICS)) if x!=j]
        loo_vals=Xc[:,keep].mean(axis=1)
        loo_rank=pd.Series(loo_vals).rank(ascending=False)
        spear=float(composite_rank.corr(loo_rank,method='spearman'))
        max_move=int(np.abs(composite_rank-loo_rank).max())
        label=audit_labels.get(m) or next((f['label'] for f in FEATURES if f['key']==m),m)
        lines.append(f"| {label} | {float(np.std(axis_vals,ddof=1)):.2f} | {corr:+.2f} | {spear:.3f} | {max_move} |")
    comparisons=[]
    for col,label in [('length_adjusted_topic_adjusted_value_index','length-adjusted sensitivity'),('axis_average_index','simple axis-z average'),('raw_title_signal_index','raw unadjusted signal')]:
        if col in audit_base:
            valid=audit_base[['topic_adjusted_value_index',col]].dropna()
            if len(valid)>2:
                comparisons.append(f"{label}: Spearman {valid['topic_adjusted_value_index'].rank().corr(valid[col].rank(),method='spearman'):.3f}")
    if comparisons:
        lines += ['', 'Ranking comparisons — ' + '; '.join(comparisons) + '. The simple axis-z average is a diagnostic weighting sensitivity, not the primary composite.']
    cap_grid=sorted(set([0.8,0.9,float(cfg.get('composite_axis_cap_quantile',0.9)),0.99]))
    base_vals=Xc.mean(axis=1)
    base_rank=pd.Series(base_vals).rank(ascending=False)
    cap_notes=[]
    for q in cap_grid:
        qcap=float(np.quantile(np.abs(X),q))
        q_rank=pd.Series(np.clip(X,-qcap,qcap).mean(axis=1)).rank(ascending=False)
        cap_notes.append(f"q={q:.2f}: Spearman {base_rank.corr(q_rank,method='spearman'):.3f}, max rank move {int(np.abs(base_rank-q_rank).max())}")
    uncapped_rank=pd.Series(X.mean(axis=1)).rank(ascending=False)
    cap_notes.append(f"uncapped: Spearman {base_rank.corr(uncapped_rank,method='spearman'):.3f}, max rank move {int(np.abs(base_rank-uncapped_rank).max())}")
    lines += ['', 'Cap sensitivity — ' + '; '.join(cap_notes) + '. The cap changes tail leverage; it is not a hidden reweighting of the axis scales.']
    curiosity_mad=float(np.median(np.abs(Xc[:,VALUE_METRICS.index('low_explicit_curiosity_gap')])))
    evidence_mad=float(np.median(np.abs(Xc[:,VALUE_METRICS.index('evidence_provenance')])))
    lines += ['', f"Sparse axes are not separately boosted: median absolute adjusted deviation is only {curiosity_mad:.2f} pp for curiosity-gap restraint and {evidence_mad:.2f} pp for evidence specificity. Those axes remain in natural units, so unusual offenders or evidence-heavy sources still matter without inflating sparse cues to the same leverage as high-variance event/context axes."]
    explanatory_ix=VALUE_METRICS.index('explanatory_framing')
    service_ix=VALUE_METRICS.index('low_direct_service_packaging')
    explanatory_service_corr=float(np.corrcoef(Xc[:,explanatory_ix],Xc[:,service_ix])[0,1])
    lines += ['', f"Explanatory framing and avoidance of direct/service packaging correlate at {explanatory_service_corr:+.2f} across ranked sources. They are intentionally not decorrelated: explanatory/service headlines can receive explanatory credit while still incurring packaging pressure, and removing that overlap numerically would erase the distinction rather than resolve it."]
    lines += ['', '## Body/summary corroboration diagnostics (high-volume sources)',
              'Available article summaries are treated as the body tier. Coverage means the summary is materially longer than the headline. Strong evidence includes documentary/data/legal/research surface; testimony includes direct speech attribution. These rates corroborate or contextualise title cues; they are not composite inputs because feed coverage varies substantially by source.',
              '| Source | n | Body coverage | Body strong-evidence surface | Body testimony surface | Body event cue | Body explanatory cue |', '|---|---:|---:|---:|---:|---:|---:|']
    for _,r in high_volume.iterrows():
        lines.append(f"| {r['source']} | {int(r['n'])} | {100*r['body_coverage_rate']:.1f}% | {100*r['body_evidence_surface_rate']:.1f}% | {100*r['body_testimony_surface_rate']:.1f}% | {100*r['body_event_action_rate']:.1f}% | {100*r['body_explanatory_rate']:.1f}% |")
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

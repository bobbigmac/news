"""Surface-language lexicons for headline measurement.

These are broad token-boundary watchlists and lightweight regular expressions.
They measure visible wording only; they are not semantic truth judgements.
"""
import re

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


try:
    import pycountry
    country_names = [c.name for c in pycountry.countries]
    country_names += ['Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'America']
except Exception:
    country_names = ['Britain','England','Scotland','Wales','France','Germany','China','Russia','Ukraine','India','Australia','Canada','Japan','Israel','Iran','Brazil','Mexico','South Africa']
country_names += ['Russia', 'Iran', 'Turkey', 'Syria', 'Vietnam', 'Laos', 'Bolivia', 'Moldova', 'Tanzania', 'Korea', 'North Korea', 'South Korea', 'S. Korea', 'U.S.', 'U.K.']
COUNTRY_RE = re.compile(r"\b(?:" + '|'.join(re.escape(x) for x in sorted(set(country_names), key=len, reverse=True)) + r")\b", re.I)
COUNTRY_ACRONYM_RE = re.compile(r"(?<![A-Za-z])(?:UK|U\.K\.|US|U\.S\.|USA|U\.S\.A\.|UAE|GB)(?![A-Za-z])")

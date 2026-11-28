"""Event, numeric, place, explanatory and context surface measurements."""
import re

from headline_measurement_lexicon import *
from headline_measurement_tunings import (
    PLACE_CONTEXT_REQUIRED_ENTITIES,
    PLACE_FALSE_POSITIVE_ENTITIES,
    PLACE_GEO_SUFFIX_RE,
    LOCATIVE_PREFIX_RE,
)

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


def normalise_place_entity(text):
    value = re.sub(r'\s+', ' ', str(text).strip().casefold())
    value = re.sub(r"[’']s$", '', value).strip(' .,:;|')
    return value


def locative_place_context(title, ent):
    prefix = title[:ent.start_char].rstrip()
    suffix = title[ent.end_char:].lstrip()
    return bool(LOCATIVE_PREFIX_RE.search(prefix) or PLACE_GEO_SUFFIX_RE.match(suffix))

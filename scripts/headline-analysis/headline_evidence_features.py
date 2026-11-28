"""Evidence and attribution surface-feature extraction."""
from headline_measurement_lexicon import *

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


def body_evidence_surface_score(text):
    text = str(text or '')
    if BODY_STRONG_EVIDENCE_SURFACE.search(text):
        return 1.0
    if BODY_TESTIMONY_SURFACE.search(text):
        return 0.6
    if BODY_VAGUE_ATTRIBUTION_SURFACE.search(text):
        return 0.15
    return 0.0

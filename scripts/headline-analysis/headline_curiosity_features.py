"""Continuous curiosity-gap surface-risk measurement."""
import re

from headline_measurement_lexicon import *

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

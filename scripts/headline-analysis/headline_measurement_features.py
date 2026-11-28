"""Row-level headline feature orchestration."""
import re

import numpy as np

from headline_measurement_lexicon import *
from headline_curiosity_features import curiosity_gap_features
from headline_evidence_features import body_evidence_surface_score, evidence_surface_features
from headline_language_features import (
    build_event_lemma_pool,
    detect_event_action,
    enhanced_context_comparison,
    enhanced_explanatory_framing,
    quantified_specificity_score,
    spacy_place_anchor,
)

def detect_one(title: str, nlp, doc=None, event_lemmas=None, extra_docs=()):
    doc=doc if doc is not None else nlp(title)
    tokens=[t for t in doc if not t.is_space]
    words=[t for t in tokens if t.is_alpha]
    # Casing diagnostics must use the original string: the primary parse input is
    # truecased for title-case headlines, which deliberately erases casing evidence.
    string_tokens=re.findall(r"\b[A-Za-z][A-Za-z'’\-]*\b",title)
    cap_tokens=[]
    for i,text in enumerate(string_tokens):
        if text.isupper() and len(text)>1:
            cap_tokens.append(text)
        elif text[:1].isupper() and text[1:].islower() and i>0:
            cap_tokens.append(text)
    cap_multi = len(re.findall(r"\b[A-Z][a-z]+(?:\s+(?:of|the|and|[A-Z][a-z]+)){1,4}\b", title))
    acronym = len(re.findall(r"\b[A-Z]{2,}(?:\d+)?\b", title))
    ner_named = any(ent.label_ in {'PERSON','ORG','GPE','LOC','PRODUCT','EVENT','WORK_OF_ART','NORP','LAW','FAC'} for ent in getattr(doc,'ents',[]))
    named_entity = int(cap_multi>0 or acronym>0 or ORG_HINT.search(title) is not None or ner_named)

    event_action = detect_event_action(title,doc=doc,event_lemmas=event_lemmas,extra_docs=extra_docs)
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

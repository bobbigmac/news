"""Presentation schema for the measured-source export."""

AXES = [
    {'key':'event_clarity','metricKey':'event_clarity','label':'Events & actions','shortLabel':'Events','kind':'delivery','description':'The headline says something happened, changed or was decided; speech acts and noun-led event references count less than direct action verbs.'},
    {'key':'quantified_specificity','metricKey':'quantified_specificity','label':'Numbers & detail','shortLabel':'Detail','kind':'delivery','description':'The headline carries concrete quantities, amounts, ages or counts; bare years and scale words count less, while product/listicle numerals are discounted.'},
    {'key':'time_place_anchor','metricKey':'time_place_anchor','label':'Time & place','shortLabel':'Place','kind':'delivery','description':'The headline anchors the story in a time or location; place candidates are precision-filtered because headline-case entity recognition often mistakes teams, brands and products for places.'},
    {'key':'causal_explanation','metricKey':'causal_explanation','label':'Cause & effect','shortLabel':'Cause','kind':'delivery','description':'The headline links events, causes or consequences.'},
    {'key':'material_consequence','metricKey':'material_consequence','label':'Real-world stakes','shortLabel':'Stakes','kind':'delivery','description':'The headline signals costs, risks, harm, benefit or other material consequences.'},
    {'key':'evidence_provenance','metricKey':'evidence_provenance','label':'Evidence cues','shortLabel':'Evidence','kind':'delivery','description':'The headline points to evidence surface: documents/data/legal material strongest, typed research next, direct testimony or quotation moderate, and vague sourcing weak.'},
    {'key':'context_comparison','metricKey':'context_comparison','label':'Context & comparison','shortLabel':'Context','kind':'delivery','description':'The headline compares, contrasts or places events in a sequence; bare sequence markers count less than explicit comparisons or historical anchors.'},
    {'key':'explanatory_framing','metricKey':'explanatory_framing','label':'Explanatory framing','shortLabel':'Explain','kind':'delivery','description':'The headline offers explanation, mechanism, guidance or service information.'},
    {'key':'curiosity_restraint','metricKey':'low_explicit_curiosity_gap','label':'Curiosity restraint','shortLabel':'No tease','kind':'restraint','adverseKey':'explicit_curiosity_gap_incidence_rate','description':'The headline resolves rather than withholds the central example, reason, mechanism, timing or referent; stock teasers count most strongly.'},
    {'key':'packaging_restraint','metricKey':'low_direct_service_packaging','label':'Low search-capture packaging','shortLabel':'No capture','kind':'restraint','adverseKey':'direct_service_packaging_incidence_rate','description':'The headline avoids direct-address, how-to and search-capture packaging.'},
    {'key':'sensational_restraint','metricKey':'low_sensational_personal','label':'Sensational restraint','shortLabel':'No hype','kind':'restraint','adverseKey':'sensational_personal_incidence_rate','description':'The headline avoids sensational vocabulary and celebrity/personal-life framing.'},
]

BAND_META = {
    'A — upper quartile': {
        'key':'strongest',
        'label':'Strongest measured headline value',
        'summary':'Headlines most often combine concrete information with comparatively restrained packaging.',
    },
    'B — second quartile': {
        'key':'above-typical',
        'label':'Above-typical measured headline value',
        'summary':'Headlines are usually informative or restrained, with some weaker axes or mixed behaviour.',
    },
    'C — third quartile': {
        'key':'below-typical',
        'label':'Below-typical measured headline value',
        'summary':'Headlines more often omit concrete anchors or use more attention-oriented framing.',
    },
    'D — lower quartile': {
        'key':'weakest',
        'label':'Weakest measured headline value',
        'summary':'Headlines are comparatively thin on concrete information, heavier on packaging, or both.',
    },
}


PROFILE_FIELDS = ['kind','ownership','model','leaning','history','notes']

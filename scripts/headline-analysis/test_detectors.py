"""High-precision regression cases for title-level detector behaviour."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import spacy
from analyse_headlines import detect_one

nlp = spacy.blank('en')

cases = [
    ("UK net migration fell 14% in 2025 as asylum claims also fell, ONS data show",
     {'event_clarity':1,'quantified_specificity':1,'time_place_anchor':1,'material_consequence':1,'evidence_provenance':1}),
    ("Can YOU guess the secret behind the new royal relationship...?",
     {'bait_present':1,'low_curiosity_bait':0}),
    ("Jennifer Lopez reveals son Max does not like her stage looks",
     {'personal_life_frame_present':1,'teaser_verb_present':1,'bait_present':1,'low_curiosity_bait':0,'low_sensational_personal':0}),
    ("Star Wars studio announces a new game for 2027",
     {'celebrity_cue_present':0,'event_clarity':1,'quantified_specificity':1}),
    ("The incredible reason your heart never develops cancer",
     {'bait_present':1,'low_curiosity_bait':0}),
    ("Study finds forever chemicals in New Jersey tap water",
     {'evidence_provenance':1,'event_clarity':1}),
    ("How rail fare increases affect commuters across England",
     {'explanatory_framing':1,'material_consequence':1}),
    ("Why the new housing rules matter for renters",
     {'explanatory_framing':1}),
    ("What happened to the missing flight?",
     {'bait_present':1,'explanatory_framing':0}),
    ("Did Scotland's departing chief medical officer actually do anything wrong?",
     {'bait_present':0,'question_form_present':1,'explanatory_framing':0}),
]
for title, expected in cases:
    got = detect_one(title, nlp)
    for key, value in expected.items():
        assert got[key] == value, (title, key, got[key], value)
print(f'{len(cases)} detector regression cases passed')

"""Structural/invariant tests for the exported corpus analysis outputs."""
from pathlib import Path
import json
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
h = pd.read_csv(ROOT / 'headline_level_signals.csv')
s = pd.read_csv(ROOT / 'source_rankings.csv')
a = pd.read_csv(ROOT / 'source_axis_profiles.csv')
m = json.loads((ROOT / 'analysis_summary.json').read_text())

# Corpus integrity.
assert len(h) == 11_461, len(h)
assert h['source'].nunique() == 695, h['source'].nunique()
assert len(s) == 695 and s['source'].nunique() == 695
assert set(h['source']) == set(s['source'])

# Story-level score arithmetic and bounds.
delivery = ['event_clarity','quantified_specificity','time_place_anchor',
            'causal_explanation','material_consequence','evidence_provenance',
            'context_comparison','explanatory_framing','original_reporting_signal']
value = delivery + ['low_curiosity_bait','low_sensational_personal']
expected_delivery = 100*h[delivery].mean(axis=1)
expected_attention = 100*h[['bait_present','personal_sensational_frame_present']].mean(axis=1)
expected_value = 100*h[value].mean(axis=1)
assert np.allclose(h['information_delivery_signal'], expected_delivery)
assert np.allclose(h['attention_packaging_pressure'], expected_attention)
assert np.allclose(h['title_value_signal'], expected_value)
for c in ['information_delivery_signal','attention_packaging_pressure','title_value_signal']:
    assert h[c].between(0,100).all(), c

# Radar export is occurrence-oriented: all 12 axes are actual event/adverse incidences.
axis_cols = ['event_clarity_rate','quantified_specificity_rate','time_place_anchor_rate',
             'causal_explanation_rate','material_consequence_rate','evidence_provenance_rate',
             'context_comparison_rate','explanatory_framing_rate','original_reporting_signal_rate',
             'cross_source_title_echo_rate','curiosity_bait_incidence_rate',
             'sensational_personal_incidence_rate']
assert len(a) == 695 and a['source'].nunique() == 695
assert set(axis_cols).issubset(a.columns)
assert a[axis_cols].apply(lambda x: x.between(0,1).all()).all()
# Inverse dimensions in ranking are the complements of incidence dimensions.
assert np.allclose(s['curiosity_bait_incidence_rate'], 1-s['low_curiosity_bait_rate'])
assert np.allclose(s['sensational_personal_incidence_rate'], 1-s['low_sensational_personal_rate'])
assert np.allclose(a['curiosity_bait_incidence_rate'], s.set_index('source').loc[a.source, 'curiosity_bait_incidence_rate'].to_numpy())
assert np.allclose(a['sensational_personal_incidence_rate'], s.set_index('source').loc[a.source, 'sensational_personal_incidence_rate'].to_numpy())
assert np.allclose(a['curiosity_bait_expected_topic_group'], 1-s.set_index('source').loc[a.source, 'low_curiosity_bait_expected_topic_group'].to_numpy())
assert np.allclose(a['sensational_personal_expected_topic_group'], 1-s.set_index('source').loc[a.source, 'low_sensational_personal_expected_topic_group'].to_numpy())

# Ranking eligibility and intervals.
assert s.loc[s['n'] < 20, 'rank'].isna().all()
assert s.loc[s['n'] >= 20, 'rank'].notna().all()
elig = s[s['n'] >= 20]
assert len(elig) == 74
assert (elig['topic_adjusted_index_ci95_low'] <= elig['topic_adjusted_value_index']).all()
assert (elig['topic_adjusted_value_index'] <= elig['topic_adjusted_index_ci95_high']).all()
assert m['radar_axis_count'] == 12 and m['delivery_signal_count'] == 9
print('Corpus-output invariants passed: 11,461 headlines; 695 sources; 12 radar axes; 9 delivery markers; 74 ranked sources.')

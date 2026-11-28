"""Structural/invariant tests for the exported corpus analysis outputs."""
import argparse, json, sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from analyse_headlines import DELIVERY_METRICS, VALUE_METRICS, RADAR_FEATURES, REPO_ROOT

ap = argparse.ArgumentParser()
ap.add_argument('--config', type=Path, default=REPO_ROOT / 'docs/tasks/headline-analysis.task.json')
ap.add_argument('--out', type=Path)
args = ap.parse_args()

out = args.out
if out is None:
    cfg = json.loads(args.config.read_text()) if args.config.exists() else {}
    out = Path(cfg.get('analysis', {}).get('output_dir', 'docs/headline-data/current'))
if not out.is_absolute():
    out = REPO_ROOT / out

h = pd.read_csv(out / 'headline_level_signals.csv')
s = pd.read_csv(out / 'source_rankings.csv')
a = pd.read_csv(out / 'source_axis_profiles.csv')
m = json.loads((out / 'analysis_summary.json').read_text())

# Corpus integrity.
assert len(h) == m['headline_rows'], (len(h), m['headline_rows'])
assert h['source_key'].nunique() == m['sources'], h['source_key'].nunique()
assert len(s) == m['sources'] and s['source_key'].nunique() == m['sources']
assert set(h['source_key']) == set(s['source_key'])

# Story-level score arithmetic and bounds.
expected_delivery = 100*h[DELIVERY_METRICS].mean(axis=1)
expected_attention = 100*h[['explicit_curiosity_gap_risk','direct_service_packaging_present','personal_sensational_frame_present']].mean(axis=1)
expected_value = 100*h[VALUE_METRICS].mean(axis=1)
assert np.allclose(h['information_delivery_signal'], expected_delivery)
assert np.allclose(h['attention_packaging_pressure'], expected_attention)
assert np.allclose(h['title_value_signal'], expected_value)
for c in ['information_delivery_signal','attention_packaging_pressure','title_value_signal']:
    assert h[c].between(0,100).all(), c
assert h['evidence_provenance'].between(0,1).all()
assert h['explicit_curiosity_gap_risk'].between(0,1).all()
assert h['low_explicit_curiosity_gap'].between(0,1).all()
assert np.allclose(h['low_explicit_curiosity_gap'], 1-h['explicit_curiosity_gap_risk'])
assert h['evidence_surface_strength'].isin([0,1,2,3,4]).all()
assert h['time_place_anchor'].isin([0.0,0.5,1.0]).all()
assert 'raw_headline' in h.columns and h['source_suffix_stripped'].isin([0,1]).all()
for c in ['body_coverage_present','body_primary_evidence_cue','body_research_claim_cue','body_event_action_cue','body_explanatory_cue','body_strong_evidence_surface','body_testimony_surface','body_vague_attribution_surface']:
    assert c in h.columns and h[c].isin([0,1]).all(), c
for c in ['body_coverage_rate','body_primary_evidence_rate','body_research_claim_rate','body_evidence_surface_rate','body_testimony_surface_rate','body_evidence_surface_score_mean','body_event_action_rate','body_explanatory_rate']:
    assert c in s.columns and s[c].between(0,1).all(), c

# Radar export is occurrence-oriented: positive rates plus explicit adverse incidences.
axis_cols = [x+'_rate' for x in DELIVERY_METRICS] + [
    'explicit_curiosity_gap_incidence_rate','direct_service_packaging_incidence_rate',
    'sensational_personal_incidence_rate','cross_source_near_duplicate_rate']
assert len(a) == len(s) and a['source_key'].nunique() == len(s)
assert set(axis_cols).issubset(a.columns), sorted(set(axis_cols)-set(a.columns))
assert a[axis_cols].apply(lambda x: x.between(0,1).all()).all()

# Inverse dimensions in ranking are complements of incidence dimensions.
assert np.allclose(s['explicit_curiosity_gap_incidence_rate'], 1-s['low_explicit_curiosity_gap_rate'])
assert np.allclose(s['direct_service_packaging_incidence_rate'], 1-s['low_direct_service_packaging_rate'])
assert np.allclose(s['sensational_personal_incidence_rate'], 1-s['low_sensational_personal_rate'])

# Ordering eligibility and intervals.
min_n = int(m['min_source_n'])
assert s.loc[s['n'] < min_n, 'rank'].isna().all()
assert s.loc[s['n'] >= min_n, 'rank'].notna().all()
elig = s[s['n'] >= min_n]
assert len(elig) == int(m['sources_ranked_min_n'])
assert (elig['topic_adjusted_index_ci95_low'] <= elig['topic_adjusted_value_index']).all()
assert (elig['topic_adjusted_value_index'] <= elig['topic_adjusted_index_ci95_high']).all()
assert 'composite_axis_cap_pp' in s.columns and np.isfinite(s['composite_axis_cap_pp'].iloc[0])
assert 0 < float(s['composite_axis_cap_pp'].iloc[0]) <= 100
assert m['radar_axis_count'] == len(RADAR_FEATURES)
assert m['delivery_signal_count'] == len(DELIVERY_METRICS)
assert m['value_signal_count'] == len(VALUE_METRICS)
assert (out/'metric_dictionary.json').exists()
assert (out/'detector_audit_sample.csv').exists()
cfg_all = json.loads(args.config.read_text()) if args.config.exists() else {}
if cfg_all.get('analysis', {}).get('length_adjusted_sensitivity'):
    assert 'length_adjusted_topic_adjusted_value_index' in s.columns
    assert s.loc[s['n'] >= min_n, 'length_adjusted_topic_adjusted_value_index'].notna().all()
print(f'Corpus-output invariants passed: {len(h):,} headlines; {len(s):,} sources; {m["radar_axis_count"]} radar axes; {m["delivery_signal_count"]} delivery markers; {len(elig)} ordered sources.')

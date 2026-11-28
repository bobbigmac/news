#!/usr/bin/env python3
"""Build the client-facing measured-source JSON from headline-analysis output."""
import argparse, json, sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from measured_source_schema import AXES, BAND_META, PROFILE_FIELDS

REPO_ROOT = Path(__file__).resolve().parents[2]




def clamp(v, lo=0.0, hi=100.0):
    return max(lo, min(hi, float(v)))


def slug_part(value):
    import re
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', str(value).lower()))


def load_json(path, fallback):
    try:
        return json.loads(Path(path).read_text())
    except Exception:
        return fallback


def relationship_anchors(repo):
    anchors = {}
    families = {}
    for path in sorted((repo/'src/trees/sources').glob('*.json')):
        root = load_json(path, None)
        if not root: continue
        def walk(node, parts):
            next_parts = parts + [node.get('label','')]
            anchor = 'rel-' + '--'.join(slug_part(x) for x in next_parts)
            for host in node.get('sources') or []:
                anchors.setdefault(host, anchor)
                families.setdefault(host, node.get('label',''))
            for child in node.get('children') or []:
                walk(child, next_parts)
        walk(root, [])
    return anchors, families


def clean_text(value):
    if value is None or pd.isna(value):
        return ''
    return str(value)


def band_key(value):
    return BAND_META.get(value, BAND_META['D — lower quartile'])['key']


def axis_payload(row, axis):
    metric = axis['metricKey']
    z = float(row.get(metric + '_relative_z', 0.0) or 0.0)
    if not np.isfinite(z): z = 0.0
    display_scale = float(axis.get('displayScale', 15.0))
    payload = {
        'score': round(clamp(50 + display_scale*z), 1),
        'z': round(z, 3),
        'rate': round(float(row.get(metric + '_rate', 0.0) or 0.0), 5),
        'expectedRate': round(float(row.get(metric + '_expected_context', 0.0) or 0.0), 5),
        'adjustedPoints': round(float(row.get(metric + '_adjusted_pp', 0.0) or 0.0), 2),
    }
    if axis.get('adverseKey'):
        adverse_rate = round(float(row.get(axis['adverseKey'], 0.0) or 0.0), 5)
        payload['adverseRate'] = adverse_rate
        payload['adverseIncidenceRate'] = adverse_rate
    return payload


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', type=Path, default=REPO_ROOT/'docs/tasks/headline-analysis.task.json')
    ap.add_argument('--out', type=Path, default=REPO_ROOT/'src/data/measured-sources.json')
    args = ap.parse_args()
    cfg = load_json(args.config, {})
    analysis = cfg.get('analysis', {})
    out_dir = Path(analysis.get('output_dir', 'docs/headline-data/current'))
    if not out_dir.is_absolute(): out_dir = REPO_ROOT/out_dir

    rankings = pd.read_csv(out_dir/'source_rankings.csv')
    headlines = pd.read_csv(out_dir/'headline_level_signals.csv')
    summary = load_json(out_dir/'analysis_summary.json', {})
    profiles = load_json(REPO_ROOT/'src/trees/profiles/sources.json', {})
    assessment_payload = load_json(REPO_ROOT/'src/trees/profiles/source-assessments.json', {})
    measurement_overrides = load_json(REPO_ROOT/'src/trees/profiles/source-measurement-overrides.json', {})
    assessment_sources = assessment_payload.get('sources', {})
    display_overrides = measurement_overrides.get('displayLabels', {})
    source_notes = measurement_overrides.get('notes', {})
    anchors, relationship_families = relationship_anchors(REPO_ROOT)

    def measurement_note(source_key):
        entry = source_notes.get(source_key)
        if isinstance(entry, dict):
            return entry.get('note', '')
        return entry or ''

    def assessments_for(source_key):
        if source_key in assessment_sources:
            return assessment_sources[source_key]
        host = source_key.split('/')[0]
        if host in assessment_sources:
            return assessment_sources[host]
        parts = host.split('.')
        for i in range(1, len(parts)-1):
            parent = '.'.join(parts[i:])
            if parent in assessment_sources:
                return assessment_sources[parent]
        return []

    include_min_n = int(analysis.get('export_min_source_n', 10))
    ranked = rankings[rankings['n'] >= include_min_n].copy().sort_values('topic_adjusted_value_index', ascending=False)
    # Display ordering is a single score-ordered list across every included source,
    # including small samples below the stable-rank threshold. Small samples carry
    # wider uncertainty intervals rather than being silently dropped.
    ranked['display_rank'] = np.arange(1, len(ranked) + 1)
    quartile_labels = ['A — upper quartile', 'B — second quartile', 'C — third quartile', 'D — lower quartile']
    ranked['display_band'] = [quartile_labels[min(3, int((r - 1) * 4 / max(len(ranked), 1)))] for r in ranked['display_rank']]
    axes = []
    pooled_z = []
    for axis in AXES:
        zvals = ranked[axis['metricKey'] + '_relative_z'].astype(float).replace([np.inf, -np.inf], np.nan).dropna().to_numpy()
        pooled_z.append(zvals)
    pooled_z = np.concatenate(pooled_z) if pooled_z else np.array([])
    pooled_spread = float(np.quantile(np.abs(pooled_z), 0.95)) if len(pooled_z) else 2.0
    common_display_scale = round(45.0 / max(pooled_spread, 1e-6), 2)
    for axis in AXES:
        item = dict(axis)
        item['displayScale'] = common_display_scale
        axes.append(item)
    member_counts = {}
    if 'member_source_key' in headlines:
        for (group_key, member_key, member_label), count in headlines.groupby(['source_key','member_source_key','member_source']).size().items():
            member_counts.setdefault(group_key, []).append({'key':member_key,'label':member_label,'headlines':int(count)})

    band_ranges = {}
    for band, rows in ranked.groupby('display_band'):
        meta = BAND_META.get(band)
        if not meta: continue
        vals = rows['topic_adjusted_value_index'].astype(float)
        band_ranges[meta['key']] = {
            **meta,
            'rangeText': f"{vals.min():.2f}–{vals.max():.2f}",
            'min': round(float(vals.min()), 2),
            'max': round(float(vals.max()), 2),
            'sourceCount': int(len(rows)),
        }
    bands = [band_ranges[key] for key in ['strongest','above-typical','below-typical','weakest'] if key in band_ranges]

    sources = []
    for _, row in ranked.iterrows():
        key = row['source_key']
        icon_key = row.get('icon_source_key') or key
        members = member_counts.get(key, [])
        members.sort(key=lambda x: -x['headlines'])
        grouped = bool(row.get('measurement_grouped', False)) and len(members) > 1
        if len(members) == 1:
            key = members[0]['key']
            icon_key = key
        display = display_overrides.get(key) or row['source']
        profile_source = profiles.get(icon_key) or {}
        profile = {field: profile_source[field] for field in PROFILE_FIELDS if profile_source.get(field)}
        member_labels = [display_overrides.get(m['key']) or m['label'] for m in members]
        axes_payload = {axis['key']: axis_payload(row, axis) for axis in axes}
        positive = sorted(((k, v['z']) for k, v in axes_payload.items()), key=lambda x: -x[1])
        row_family = clean_text(row.get('group'))
        tree_family = relationship_families.get(icon_key, '')
        family = tree_family or (row_family if row_family != 'Unmatched sources' else '')
        tree_root = clean_text(row.get('tree_root'))
        source = {
            'key': key,
            'label': display,
            'headlines': int(row['n']),
            'rank': int(row['display_rank']),
            'stableSample': bool(row.get('rank_eligible', False)),
            'measuredQuality': round(float(row['topic_adjusted_value_index']), 2),
            'measuredQualityZ': round(float(row.get('composite_relative_z', 0.0) or 0.0), 3),
            'measuredQualityAdjustedPoints': round(float(row.get('composite_adjusted_pp', 0.0) or 0.0), 3),
            'measuredQualityCi95': [round(float(row.get('topic_adjusted_index_ci95_low', np.nan)), 2), round(float(row.get('topic_adjusted_index_ci95_high', np.nan)), 2)] if np.isfinite(row.get('topic_adjusted_index_ci95_low', np.nan)) and np.isfinite(row.get('topic_adjusted_index_ci95_high', np.nan)) else None,
            'band': band_key(row['display_band']),
            'bandLabel': BAND_META[row['display_band']]['label'],
            'grouped': grouped,
            'iconKey': icon_key,
            'members': members,
            'memberLabels': member_labels,
            'family': family,
            'treeRoot': tree_root,
            'profile': profile,
            'assessments': assessments_for(icon_key),
            'relationshipsUrl': './relationships.html' + (('#' + anchors[icon_key]) if icon_key in anchors else ''),
            'axes': axes_payload,
            'strongestAxes': [k for k,_ in positive[:3]],
            'weakestAxes': [k for k,_ in positive[-3:]],
            'diagnostics': {
                'originalAccessCueRate': round(float(row.get('original_reporting_signal_rate', 0.0) or 0.0), 5),
                'titleEchoRate': round(float(row.get('cross_source_near_duplicate_rate', 0.0) or 0.0), 5),
                'strongEvidenceSurfaceRate': round(float(row.get('strong_evidence_surface_rate', 0.0) or 0.0), 5),
                'researchEvidenceSurfaceRate': round(float(row.get('research_evidence_surface_rate', 0.0) or 0.0), 5),
                'directTestimonySurfaceRate': round(float(row.get('direct_testimony_surface_rate', 0.0) or 0.0), 5),
                'quoteTestimonySurfaceRate': round(float(row.get('quote_testimony_surface_rate', 0.0) or 0.0), 5),
                'vagueAttributionSurfaceRate': round(float(row.get('vague_attribution_surface_rate', 0.0) or 0.0), 5),
                'curiosityGapRiskMean': round(float(row.get('curiosity_gap_risk_mean', 0.0) or 0.0), 5),
                'stockTeaserSurfaceRate': round(float(row.get('stock_teaser_surface_rate', 0.0) or 0.0), 5),
                'listicleWithholdingSurfaceRate': round(float(row.get('listicle_withholding_surface_rate', 0.0) or 0.0), 5),
                'withheldReasonSurfaceRate': round(float(row.get('withheld_reason_surface_rate', 0.0) or 0.0), 5),
                'resolutionGapSurfaceRate': round(float(row.get('resolution_gap_surface_rate', 0.0) or 0.0), 5),
                'bodyCoverageRate': round(float(row.get('body_coverage_rate', 0.0) or 0.0), 5),
                'bodyResearchCueRate': round(float(row.get('body_research_claim_rate', 0.0) or 0.0), 5),
                'bodyEvidenceSurfaceRate': round(float(row.get('body_evidence_surface_rate', 0.0) or 0.0), 5),
                'bodyTestimonySurfaceRate': round(float(row.get('body_testimony_surface_rate', 0.0) or 0.0), 5),
                'bodyEvidenceSurfaceScoreMean': round(float(row.get('body_evidence_surface_score_mean', 0.0) or 0.0), 5),
            },
            'notes': [note] if (note := measurement_note(key)) else [],
        }
        sources.append(source)

    source_index = {}
    for source in sources:
        source_index[source['key']] = source['key']
        for member in source.get('members', []):
            source_index.setdefault(member['key'], source['key'])

    data = {
        'version': 1,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'measurementLabel': 'Measured headline value',
        'axisScale': {
            'midpoint': 50,
            'minimum': 0,
            'maximum': 100,
            'meaning': 'Corpus-relative axis position; higher is always more desirable. 50 is typical across measured sources. Each axis keeps its adjusted z-score in the z field, while the display score applies one shared corpus calibration across all axes so positions remain comparable.',
            'method': 'adjusted z-score scaled by the pooled 95th percentile absolute z position across all measured axes and sources, then bounded to 0–100',
        },
        'compositeScale': {
            'meaning': 'Corpus-relative measured headline value. 50 is typical across measured sources; higher indicates more concrete headline information and less attention packaging after comparison with similar story mixes.',
            'method': 'natural-unit axis residuals, empirically shrunk for sample size, symmetrically saturated at a corpus-derived high-percentile axis deviation, averaged across the eleven composite axes, then centred and scaled across eligible sources',
            'axisCapQuantile': summary.get('composite_axis_cap_quantile'),
            'axisCapAdjustedPoints': summary.get('composite_axis_cap_pp'),
            'shrinkageK': summary.get('composite_shrinkage_k'),
        },
        'minimumHeadlines': include_min_n,
        'stableSampleHeadlines': int(analysis.get('min_source_n', 20)),
        'summary': {
            'sourceCount': len(sources),
            'headlineRows': int(summary.get('headline_rows', len(headlines))),
            'inputSourceCount': int(summary.get('sources', 0)),
        },
        'bands': bands,
        'axes': axes,
        'sourceIndex': source_index,
        'sources': sources,
    }

    out = args.out
    if not out.is_absolute(): out = REPO_ROOT/out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=2) + '\n')
    print(f'wrote {len(sources)} measured sources to {out}')

    # Slim key -> quality lookup for the manage-sources list: every measured key
    # (including grouped member keys) maps to the group's measured quality so the
    # settings UI does not need the full export.
    quality = {}
    for source in sources:
        entry = {'quality': source['measuredQuality'], 'headlines': source['headlines']}
        quality[source['key']] = entry
        for member in source.get('members', []):
            quality.setdefault(member['key'], entry)
    quality_out = out.parent/'source-quality.json'
    quality_out.write_text(json.dumps({
        'version': 1,
        'generatedAt': data['generatedAt'],
        'sources': quality,
    }, indent=1) + '\n')
    print(f'wrote {len(quality)} quality lookup keys to {quality_out}')


if __name__ == '__main__':
    main()

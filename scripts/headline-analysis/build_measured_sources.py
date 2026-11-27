#!/usr/bin/env python3
"""Build the client-facing measured-source JSON from headline-analysis output."""
import argparse, json, sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from analyse_headlines import REPO_ROOT, COMPOSITE_DELIVERY_METRICS

DISPLAY_OVERRIDES = {
    'sports.yahoo.com': 'Yahoo Sports',
    'channelnewsasia.com': 'CNA',
    'timesofindia.indiatimes.com': 'Times of India',
    'obits.oregonlive.com': 'OregonLive obituaries',
    'seekingalpha.com': 'Seeking Alpha',
    'inc.com': 'Inc.',
    'indianexpress.com': 'The Indian Express',
    'dailytimes.com.pk': 'Daily Times',
    'freemalaysiatoday.com': 'Free Malaysia Today',
}

AXES = [
    {'key':'event_clarity','metricKey':'event_clarity','label':'Events & actions','shortLabel':'Events','kind':'delivery','description':'The headline says something happened, changed or was decided.'},
    {'key':'quantified_specificity','metricKey':'quantified_specificity','label':'Numbers & detail','shortLabel':'Detail','kind':'delivery','description':'The headline carries concrete quantities, amounts or counts.'},
    {'key':'time_place_anchor','metricKey':'time_place_anchor','label':'Time & place','shortLabel':'Place','kind':'delivery','description':'The headline anchors the story in a time or location.'},
    {'key':'causal_explanation','metricKey':'causal_explanation','label':'Cause & effect','shortLabel':'Cause','kind':'delivery','description':'The headline links events, causes or consequences.'},
    {'key':'material_consequence','metricKey':'material_consequence','label':'Real-world stakes','shortLabel':'Stakes','kind':'delivery','description':'The headline signals costs, risks, harm, benefit or other material consequences.'},
    {'key':'evidence_provenance','metricKey':'evidence_provenance','label':'Evidence cues','shortLabel':'Evidence','kind':'delivery','description':'The headline points to research, documents, data or other evidence.'},
    {'key':'context_comparison','metricKey':'context_comparison','label':'Context & comparison','shortLabel':'Context','kind':'delivery','description':'The headline compares, contrasts or places events in a sequence.'},
    {'key':'explanatory_framing','metricKey':'explanatory_framing','label':'Explanatory framing','shortLabel':'Explain','kind':'delivery','description':'The headline offers explanation, mechanism, guidance or service information.'},
    {'key':'curiosity_restraint','metricKey':'low_explicit_curiosity_gap','label':'Curiosity restraint','shortLabel':'No tease','kind':'restraint','adverseKey':'explicit_curiosity_gap_incidence_rate','description':'The headline avoids stock teasers and withholding the point.'},
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

SOURCE_NOTES = {
    'medicalxpress.com': 'High evidence and causal scores partly reflect research-release phrasing. They do not by themselves show independent verification of the underlying studies.',
    'phys.org': 'Research-release phrasing can raise evidence and causal scores. Treat them as evidence of dense research claims, not proof of independent scientific scrutiny.',
    'psypost.org': 'PsyPost often writes formulaic research-claim headlines. That raises evidence and causal scores without establishing independent verification of the studies.',
    'sciencealert.com': 'Popular science rewriting can make research cues prominent; the score does not assess the quality of the underlying paper.',
    'nature.com': 'The low event/action score is largely a form effect: many Nature rows are journal article titles written as descriptive noun phrases. This does not mean the underlying research articles lack evidence.',
    'newscientist.com': 'The low evidence score often means the headline avoids formulaic “study finds” phrasing; it is not evidence that the article lacks research support.',
    'obits.oregonlive.com': 'This measurement mostly describes syndicated obituary entries rather than OregonLive’s wider newsroom output.',
    'seekingalpha.com': 'Earnings, transcript and market-data formats make this source narrower than a general news publisher; read the axes before the composite.',
    'reddit.com': 'Reddit rows reflect headlines as posted or repeated on the platform. They describe reused headline text, not original reporting or verification by Reddit.',
    'news.xbox.com': 'Xbox Wire is official platform communication, so its score is not a measure of independent games journalism.',
    'handelsblatt.com': 'English-language cue detection undercounts German-language headlines; treat this position as non-comparable with English-language sources.',
    'group-mashable': 'Regional Mashable editions are grouped because they substantially reuse the same articles; their measured headline profiles are broadly similar rather than dominated by one outlier edition.',
    'group-philippine-inquirer': 'Philippine Daily Inquirer verticals and regional subdomains are grouped as sections of one publisher. Philadelphia’s unrelated inquirer.com is deliberately excluded.',
    'group-nypost-pagesix': 'Page Six is measured with the New York Post because it belongs to the same publishing operation; the combined view is dominated by the larger New York Post stream.',
    'dailymail.com': 'The low position is driven especially by sensational and personal framing, alongside weaker time/place and evidence cues.',
    'mirror.co.uk': 'Sensational and personal framing is the largest negative contribution here, even where individual headlines are otherwise concrete.',
    'kotaku.com': 'The low position mainly reflects fewer time/place anchors, less causal/consequence language, and more direct-address packaging.',
}

PROFILE_FIELDS = ['kind','ownership','model','leaning','history','notes']


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
    payload = {
        'score': round(clamp(50 + 15*z), 1),
        'z': round(z, 3),
        'rate': round(float(row.get(metric + '_rate', 0.0) or 0.0), 5),
        'expectedRate': round(float(row.get(metric + '_expected_context', 0.0) or 0.0), 5),
        'adjustedPoints': round(float(row.get(metric + '_adjusted_pp', 0.0) or 0.0), 2),
    }
    if axis.get('adverseKey'):
        payload['adverseIncidenceRate'] = round(float(row.get(axis['adverseKey'], 0.0) or 0.0), 5)
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
    anchors, relationship_families = relationship_anchors(REPO_ROOT)

    ranked = rankings[rankings['rank'].notna()].copy().sort_values('topic_adjusted_value_index', ascending=False)
    member_counts = {}
    if 'member_source_key' in headlines:
        for (group_key, member_key, member_label), count in headlines.groupby(['source_key','member_source_key','member_source']).size().items():
            member_counts.setdefault(group_key, []).append({'key':member_key,'label':member_label,'headlines':int(count)})

    band_ranges = {}
    for band, rows in ranked.groupby('ordering_band'):
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
        # A synthetic measurement group with only one observed member should keep
        # the canonical host key so client-side lookups stay source-shaped.
        if len(members) == 1:
            key = members[0]['key']
            icon_key = key
        display = DISPLAY_OVERRIDES.get(key) or row['source']
        profile_source = profiles.get(icon_key) or {}
        profile = {field: profile_source[field] for field in PROFILE_FIELDS if profile_source.get(field)}
        member_labels = [DISPLAY_OVERRIDES.get(m['key']) or m['label'] for m in members]
        axes = {axis['key']: axis_payload(row, axis) for axis in AXES}
        positive = sorted(((k, v['score']) for k, v in axes.items()), key=lambda x: -x[1])
        row_family = clean_text(row.get('group'))
        tree_family = relationship_families.get(icon_key, '')
        family = tree_family or (row_family if row_family != 'Unmatched sources' else '')
        tree_root = clean_text(row.get('tree_root'))
        source = {
            'key': key,
            'label': display,
            'headlines': int(row['n']),
            'rank': int(row['rank']),
            'measuredQuality': round(float(row['topic_adjusted_value_index']), 2),
            'band': band_key(row['ordering_band']),
            'bandLabel': BAND_META[row['ordering_band']]['label'],
            'grouped': grouped,
            'iconKey': icon_key,
            'members': members,
            'memberLabels': member_labels,
            'family': family,
            'treeRoot': tree_root,
            'profile': profile,
            'relationshipsUrl': './relationships.html' + (('#' + anchors[icon_key]) if icon_key in anchors else ''),
            'axes': axes,
            'strongestAxes': [k for k,_ in positive[:3]],
            'weakestAxes': [k for k,_ in positive[-3:]],
            'diagnostics': {
                'originalAccessCueRate': round(float(row.get('original_reporting_signal_rate', 0.0) or 0.0), 5),
                'titleEchoRate': round(float(row.get('cross_source_near_duplicate_rate', 0.0) or 0.0), 5),
                'bodyCoverageRate': round(float(row.get('body_coverage_rate', 0.0) or 0.0), 5),
                'bodyResearchCueRate': round(float(row.get('body_research_claim_rate', 0.0) or 0.0), 5),
            },
            'notes': [SOURCE_NOTES[key]] if key in SOURCE_NOTES else [],
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
            'meaning': 'Corpus-relative axis position; higher is always more desirable. 50 is typical across measured sources, with positions derived from adjusted z-scores and bounded for display.',
        },
        'minimumHeadlines': int(analysis.get('min_source_n', 20)),
        'summary': {
            'sourceCount': len(sources),
            'headlineRows': int(summary.get('headline_rows', len(headlines))),
            'inputSourceCount': int(summary.get('sources', 0)),
        },
        'bands': bands,
        'axes': AXES,
        'sourceIndex': source_index,
        'sources': sources,
    }

    out = args.out
    if not out.is_absolute(): out = REPO_ROOT/out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=2) + '\n')
    print(f'wrote {len(sources)} measured sources to {out}')


if __name__ == '__main__':
    main()

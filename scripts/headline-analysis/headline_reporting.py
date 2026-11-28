"""Analysis-output sampling and interactive reporting helpers."""
import html
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go

from headline_measurement_schema import FEATURES, RADAR_FEATURES, VALUE_METRICS

def make_radar(src, output_html: Path):
    axes=[x['label'] for x in RADAR_FEATURES]
    eligible=src[src['rank_eligible']].sort_values('rank')
    if len(eligible)==0: return
    def radar_value(row, key):
        if key=='low_explicit_curiosity_gap': return 100*row['explicit_curiosity_gap_incidence_rate']
        if key=='low_direct_service_packaging': return 100*row['direct_service_packaging_incidence_rate']
        if key=='low_sensational_personal': return 100*row['sensational_personal_incidence_rate']
        if key=='cross_source_title_echo': return 100*row['cross_source_near_duplicate_rate']
        return 100*row[key+'_rate']
    traces=[]
    for _,r in eligible.iterrows():
        vals=[float(radar_value(r,x['key'])) for x in RADAR_FEATURES]
        traces.append(go.Scatterpolar(r=vals+[vals[0]],theta=axes+[axes[0]],
                        fill='toself',name=f"{int(r['rank'])}. {r['source']} (n={int(r['n'])})",
                        visible=False,opacity=0.65,
                        hovertemplate='%{theta}: %{r:.1f}%<extra>'+html.escape(str(r['source']))+'</extra>'))
    traces[0].visible=True
    fig=go.Figure(data=traces)
    buttons=[]
    for i,(_,r) in enumerate(eligible.iterrows()):
        vis=[False]*len(traces); vis[i]=True
        buttons.append(dict(label=f"{int(r['rank']):02d} · {r['source']} · n={int(r['n'])}",
                            method='update',args=[{'visible':vis},{'title':f"{r['source']} — title-signal profile (n={int(r['n'])})"}]))
    fig.update_layout(title=f"{eligible.iloc[0]['source']} — title-signal profile (n={int(eligible.iloc[0]['n'])})",
        polar=dict(radialaxis=dict(visible=True,range=[0,100],ticksuffix='%'),
                   angularaxis=dict(direction='clockwise')),
        showlegend=False, height=820, width=1080,
        updatemenus=[dict(type='dropdown',direction='down',x=0.02,y=1.13,
                          buttons=buttons,showactive=True)],
        margin=dict(t=145,b=80,l=80,r=80),
        annotations=[dict(text='Axes are occurrence rates or mean continuous risk. The final four axes are adverse/diagnostic, so lower is better. Evidence specificity is a tiered evidence/testimony surface score. Title-language signals only.',
                          x=0.5,y=-0.11,xref='paper',yref='paper',showarrow=False,font=dict(size=11))])
    fig.write_html(output_html,include_plotlyjs=True,full_html=True)


def detector_audit_sample(df, out_path, seed=27, per_stratum=30):
    rng=np.random.default_rng(seed)
    rows=[]
    strata=[
        ('explicit_curiosity_gap',df['explicit_curiosity_gap_present'].eq(1)),
        ('curiosity_risk_moderate',df['explicit_curiosity_gap_risk'].ge(0.3)&df['explicit_curiosity_gap_risk'].lt(0.6)),
        ('curiosity_risk_high',df['explicit_curiosity_gap_risk'].ge(0.6)),
        ('direct_service_packaging',df['direct_service_packaging_present'].eq(1)),
        ('sensational_personal',df['personal_sensational_frame_present'].eq(1)),
        ('evidence_document_legal',df['evidence_surface_strength'].eq(4)),
        ('evidence_research_surface',df['evidence_surface_strength'].eq(3)),
        ('evidence_testimony_surface',df['evidence_surface_strength'].eq(2)),
        ('evidence_weak_or_vague',df['evidence_surface_strength'].eq(1)),
        ('unflagged',df[['explicit_curiosity_gap_present','direct_service_packaging_present','personal_sensational_frame_present']].sum(axis=1).eq(0)&df['evidence_surface_strength'].eq(0)),
    ]
    for label,mask in strata:
        ix=np.flatnonzero(mask.to_numpy())
        if len(ix)==0: continue
        take=rng.choice(ix,size=min(per_stratum,len(ix)),replace=False)
        for i in take:
            r=df.iloc[int(i)]
            rows.append({'stratum':label,'source':r['source'],'headline':r['headline'],'url':r.get('url',''),
                         'explicit_curiosity_gap_present':r['explicit_curiosity_gap_present'],
                         'explicit_curiosity_gap_risk':r['explicit_curiosity_gap_risk'],
                         'direct_service_packaging_present':r['direct_service_packaging_present'],
                         'personal_sensational_frame_present':r['personal_sensational_frame_present'],
                         'evidence_strength':r['evidence_strength'],'evidence_surface_strength':r['evidence_surface_strength'],
                         'evidence_provenance':r['evidence_provenance'],'human_label':'','human_notes':''})
    pd.DataFrame(rows).drop_duplicates(subset=['source','headline']).to_csv(out_path,index=False)

def write_analysis_report(out, df, src, eligible, top, bottom, cfg, primary_length_adjusted, expected_length_adjusted, total_time, stage_times):
    cap_percentile=100*float(cfg.get('composite_axis_cap_quantile',0.9))
    group_descriptions='; '.join(
        f"{group.get('label') or group.get('key')} — {str(group.get('reason','configured as one measured source')).rstrip('.')}"
        for group in (cfg.get('measurement_groups') or [])
    )
    grouping_notes=[str(note).rstrip('.') for note in (cfg.get('measurement_grouping_notes') or [])]
    grouping_method_line='- Publisher-section/regional-edition groups configured in the task file are consolidated before measurement'
    if group_descriptions:
        grouping_method_line += ': ' + group_descriptions
    else:
        grouping_method_line += '; no consolidated groups are configured'
    if grouping_notes:
        grouping_method_line += '. Non-grouping decisions: ' + '; '.join(grouping_notes)
    grouping_method_line += '.'
    lines=[]
    lines += ['# Title-only reader-value signals — improved exploratory run','',
      f"Corpus: **{len(df):,} headline rows**, **{df.source_key.nunique():,} sources**.",
      f"Source ordering eligible: **{len(eligible)}** sources with at least {int(cfg['min_source_n'])} headlines. **{int((src.n<int(cfg['min_source_n'])).sum())}** sources are below the threshold and unranked.",
      f"Runtime: **{total_time:.1f}s** local. Stage timings: " + ', '.join(f'{k} {v:.1f}s' for k,v in stage_times.items()) + '.',
      '', '## Measurement definition',
      f'The core ordering has 11 cue inputs: eight information-delivery markers plus inverse forms of curiosity-gap risk, direct-address/service packaging, and sensational/personal framing. Original-access cues and cross-source title echo are plotted as diagnostic axes but excluded from the composite. Evidence specificity is now a continuous evidence-surface score rather than two stock regex tiers: documentary/legal/data evidence scores highest, typed research evidence next, direct testimony and quotation moderate, communication events or vague attribution low, and no surface evidence zero. Curiosity-gap risk is also continuous: stock teaser forms are high-risk, while vague references, withheld listicle examples, unresolved forward references, resolution/reaction/mechanism gaps and pronoun/determiner load combine as inspectable noisy-or evidence, attenuated when the headline already supplies concrete anchors. Event clarity is fractional: direct action verbs count 1.0, grammatically uncertain title-case verb forms count 0.75, speech/report/announcement acts count 0.5, and nominal event references count 0.5. Context is fractional as well: explicit comparison or record/history cues count 1.0, amid/following count 0.75, and bare sequence or comparative forms count 0.5. Numeric detail distinguishes exact quantities from weaker years, scale words, ordinals, listicle positions and product/version numerals. The composite aggregates cue residuals in natural units, so a source with several concrete cue differences outranks one with a single cue. After empirical shrinkage, axis contributions are saturated symmetrically at a corpus-derived {cap_percentile:.0f}th-percentile absolute axis deviation before averaging; this keeps one unusually large axis residual from dominating without renormalising rare and common cues into artificial equality. The spiderweb axes themselves remain uncapped diagnostic z-scores, not a second equally-weighted composite stage.',
      '', '## Method changes in this run',
      '- Curated export metadata is used when `headline-rows.jsonl` is present: canonical source key, URL, timestamps, relation branch, editorial context, and the available body/summary text.',
      '- Exact publisher-name boilerplate suffixes such as “- The Korea Times” or “| The Jerusalem Post” are stripped before detection, while editorial hyphenated subtitles are retained; the original raw headline remains exported for audit.',
      grouping_method_line,
      '- Attention packaging is split into continuous curiosity-gap risk, direct-address/service packaging, and sensational/personal framing rather than one opaque bait bucket. The curiosity implementation follows the aggregate LLM audit taxonomy: it does not treat question form or service journalism as clickbait by themselves.',
      '- Event and consequence word pools now use corpus-audited explicit inflections rather than unbounded wildcard stems. This removes systematic collisions such as first/Burnham/surgery/election/bank/winter/firms while keeping exact event words.',
      '- Country acronyms are case-sensitive, so lowercase “us” no longer counts as the United States. Quoted titles/quotations are ignored for direct-address packaging, reducing false service hits such as a work titled “You Can See Everything”.',
      '- Evidence language now uses broad token-boundary surface families guided by spaCy POS rather than a pair of stock regexes. Documentary/legal/data objects joined to empirical verbs or disclosure modifiers score highest; typed research objects and direct testimony form lower tiers; passive fragments such as “X told to…” and proper-name collisions such as a person named Testimony are guarded. Standalone earnings-call transcript labels still do not count as evidence merely because the word transcript appears. Original-access cues remain high-precision but diagnostic-only because they occur too rarely for stable source ordering.',
      '- Body/summary text is exported and scanned for evidence/event/explanatory support as a diagnostic tier, now including broad strong-evidence, testimony and vague-attribution surfaces. It is not composite input because body coverage and length vary by feed and ingest path; missing body evidence is neutral.',
      f"- Expected detector rates are cross-fitted with GroupKFold by source: a source does not train the topic/editorial-context expectation used to residualise itself. Primary title-length adjustment is **{'enabled' if primary_length_adjusted else 'disabled'}**; length-adjusted sensitivity columns are **{'included' if expected_length_adjusted is not None else 'not included'}**.",
      '- Delivery markers are fully topic/context-adjusted, while attention packaging is only partly context-adjusted (25% by default) and otherwise compared with corpus-wide incidence; this treats attention farming more as publisher behaviour than unavoidable subject matter.',
      '- The local `en_core_web_sm` spaCy model supplies POS tags, lemmas and named entities. It is a small classical NLP model, not a transformer. Event detection combines verbal POS evidence with conservative local grammar for title-case or plural/-s forms that the tagger misreads; speech/report/announcement acts and noun-led event references count as weaker fractional evidence than direct action verbs. Place detection no longer trusts raw GPE/LOC/FAC labels alone because the small NER model frequently labels sports clubs, companies, games, people and “AI” as places; corpus-audited false-positive overrides, locative syntax for ambiguous entities, and reduced-weight facility hits are used instead. Numeric detail distinguishes exact quantities, bare counts, calendar years, scale words, ordinals, listicle positions and product/version numerals.',
      f'- The composite is calculated in natural cue units before display normalisation. This avoids the previous compression artefact caused by averaging eleven independently z-scored axes. Manual inspection of fringe cases supported this choice: equal z-weighting put formulaic research-release language at the very top and over-penalised moderate curiosity/service deviations, while uncapped natural units gave single large axes too much leverage. The final composite therefore caps each shrunk axis contribution at the corpus-derived {cap_percentile:.0f}th-percentile absolute axis deviation before averaging.',
      f"- Composite shrinkage is estimated from within- and between-source variance rather than fixed by hand; this run uses k={float(src['composite_shrinkage_k'].iloc[0]):.2f} in the n/(n+k) factor. The composite axis saturation point is {float(src['composite_axis_cap_pp'].iloc[0]):.2f} adjusted percentage points. The displayed score is then corpus-normalised to mean 50 and standard deviation 15 among eligible sources, with clipping only at the extremes. Raw adjusted percentage-point residuals remain exported.",
      '- Shrinkage sensitivity is exported across the configured grid; broad quartile ordering bands are emphasised over false precision in adjacent ranks.',
      '- `detector_audit_sample.csv` is a stratified manual-labelling sample intended for future precision/recall estimation.',
      '', '## Important limitations',
      '- The composite remains headline-led. Body/summary diagnostics add context but do not measure truth, factual accuracy, importance, full article quality, or whether reporting is original in fact.',
      '- Event detection remains incomplete. Direct actions are stronger than speech acts and nominal event references, but appointment/casting announcements written with copulas, some market/state movements, and less standard headline syntax can still be missed or underweighted; those absences are not evidence that no event occurred.',
      '- English-language cues mean non-English sources naturally produce sparse detector hits and should not be compared directly with English-language sources.',
      '- The minimum-n leaderboard can still be unstable or source-type-specific at n≈20–70; syndication-heavy, official-release, obituary-heavy and transcript-heavy sources need per-axis inspection before interpretation.',
      '- The curiosity implementation is calibrated only against a small stratified LLM audit (133 assessable rows) and corpus/source distributions; evidence-family validation is aggregate rather than a complete human-labelled precision/recall study. The exported audit sample remains preparation for formal validation, not validation itself.',
      '- The composite is a corpus-relative ordering aid, not an absolute 0–100 quality measurement. Its display scale is normalised against the measured sources in this corpus; raw adjusted percentage-point residuals, confidence intervals, sample sizes and per-axis profiles are needed for interpretation.',
      '- Cross-fitting reduces in-sample leakage but does not model detector error, topic-model uncertainty, or corpus-selection uncertainty.',
      '- Direct-address/service packaging is adverse packaging pressure, not uselessness: transparent how-to/service headlines can be both search-captured and useful.',
      '- Research-release language can still resemble evidence specificity. Direct testimony also measures explicit attribution, not truth or independent verification. Conversely, scientific paper titles are often descriptive noun phrases with few event verbs, and narrative science journalism can omit formulaic “study finds” evidence language even when the article is evidence-based; neither extreme is a quality verdict.',
      '- Cross-source title echo can reflect syndication, shared ownership, wires or legitimate same-event language; timestamps/URLs help inspection but do not prove provenance.',
      '', '## Axis definitions']
    for f in RADAR_FEATURES:
        composite_note='included in composite' if f['value'] else 'diagnostic only'
        lines.append(f"- **{f['label']}** (`{f['key']}`, {composite_note}): {f['description']}")
    high_volume=src[src.n>=100].sort_values('topic_adjusted_value_index',ascending=False)
    lines += ['', '## High-volume ordering (n ≥ 100)',
              '| Rank | Source | n | Topic-adjusted title signal (95% interval) | Length-adjusted sensitivity | Raw 11-signal mean |', '|---:|---|---:|---:|---:|---:|']
    for _,r in high_volume.iterrows():
        len_adj=f"{r['length_adjusted_topic_adjusted_value_index']:.1f}" if 'length_adjusted_topic_adjusted_value_index' in r and np.isfinite(r['length_adjusted_topic_adjusted_value_index']) else '—'
        lines.append(f"| {int(r['rank_n100'])} | {r['source']} | {int(r['n'])} | {r['topic_adjusted_value_index']:.1f} ({r['topic_adjusted_index_ci95_low']:.1f}–{r['topic_adjusted_index_ci95_high']:.1f}) | {len_adj} | {r['raw_title_signal_index']:.1f} |")
    # Numerical audit of the final capped composite. These diagnostics are descriptive,
    # not another weighting stage: they show which axes carry observed spread and how
    # sensitive the ordering is to removing one axis at a time.
    audit_base=src[src['rank_eligible']].copy()
    audit_axis_cols=[m+'_adjusted_pp' for m in VALUE_METRICS]
    X=audit_base[audit_axis_cols].astype(float).to_numpy()
    cap=float(src['composite_axis_cap_pp'].iloc[0])
    Xc=np.clip(X,-cap,cap)
    composite_rank=pd.Series(audit_base['topic_adjusted_value_index'].to_numpy()).rank(ascending=False)
    lines += ['', '## Composite numerical audit',
      f"The composite cap is **{cap:.2f} adjusted percentage points**, applied symmetrically to each shrunk axis contribution before averaging. Axis spread below is the standard deviation of capped adjusted axis positions across ranked sources; leave-one-out compares the composite ranking with the ranking after removing that axis.",
      '| Axis | Capped spread (pp sd) | Composite correlation | Leave-one-out Spearman | Max rank move |', '|---|---:|---:|---:|---:|']
    audit_labels={
        'low_explicit_curiosity_gap':'Curiosity-gap restraint',
        'low_direct_service_packaging':'Avoidance of direct/service packaging',
        'low_sensational_personal':'Avoidance of sensational/personal framing',
    }
    for j,m in enumerate(VALUE_METRICS):
        axis_vals=Xc[:,j]
        corr=float(np.corrcoef(axis_vals,audit_base['topic_adjusted_value_index'])[0,1]) if np.std(axis_vals)>1e-12 else 0.0
        keep=[x for x in range(len(VALUE_METRICS)) if x!=j]
        loo_vals=Xc[:,keep].mean(axis=1)
        loo_rank=pd.Series(loo_vals).rank(ascending=False)
        spear=float(composite_rank.corr(loo_rank,method='spearman'))
        max_move=int(np.abs(composite_rank-loo_rank).max())
        label=audit_labels.get(m) or next((f['label'] for f in FEATURES if f['key']==m),m)
        lines.append(f"| {label} | {float(np.std(axis_vals,ddof=1)):.2f} | {corr:+.2f} | {spear:.3f} | {max_move} |")
    comparisons=[]
    for col,label in [('length_adjusted_topic_adjusted_value_index','length-adjusted sensitivity'),('axis_average_index','simple axis-z average'),('raw_title_signal_index','raw unadjusted signal')]:
        if col in audit_base:
            valid=audit_base[['topic_adjusted_value_index',col]].dropna()
            if len(valid)>2:
                comparisons.append(f"{label}: Spearman {valid['topic_adjusted_value_index'].rank().corr(valid[col].rank(),method='spearman'):.3f}")
    if comparisons:
        lines += ['', 'Ranking comparisons — ' + '; '.join(comparisons) + '. The simple axis-z average is a diagnostic weighting sensitivity, not the primary composite.']
    cap_grid=sorted(set([0.8,0.9,float(cfg.get('composite_axis_cap_quantile',0.9)),0.99]))
    base_vals=Xc.mean(axis=1)
    base_rank=pd.Series(base_vals).rank(ascending=False)
    cap_notes=[]
    for q in cap_grid:
        qcap=float(np.quantile(np.abs(X),q))
        q_rank=pd.Series(np.clip(X,-qcap,qcap).mean(axis=1)).rank(ascending=False)
        cap_notes.append(f"q={q:.2f}: Spearman {base_rank.corr(q_rank,method='spearman'):.3f}, max rank move {int(np.abs(base_rank-q_rank).max())}")
    uncapped_rank=pd.Series(X.mean(axis=1)).rank(ascending=False)
    cap_notes.append(f"uncapped: Spearman {base_rank.corr(uncapped_rank,method='spearman'):.3f}, max rank move {int(np.abs(base_rank-uncapped_rank).max())}")
    lines += ['', 'Cap sensitivity — ' + '; '.join(cap_notes) + '. The cap changes tail leverage; it is not a hidden reweighting of the axis scales.']
    curiosity_mad=float(np.median(np.abs(Xc[:,VALUE_METRICS.index('low_explicit_curiosity_gap')])))
    evidence_mad=float(np.median(np.abs(Xc[:,VALUE_METRICS.index('evidence_provenance')])))
    lines += ['', f"Sparse axes are not separately boosted: median absolute adjusted deviation is only {curiosity_mad:.2f} pp for curiosity-gap restraint and {evidence_mad:.2f} pp for evidence specificity. Those axes remain in natural units, so unusual offenders or evidence-heavy sources still matter without inflating sparse cues to the same leverage as high-variance event/context axes."]
    explanatory_ix=VALUE_METRICS.index('explanatory_framing')
    service_ix=VALUE_METRICS.index('low_direct_service_packaging')
    explanatory_service_corr=float(np.corrcoef(Xc[:,explanatory_ix],Xc[:,service_ix])[0,1])
    lines += ['', f"Explanatory framing and avoidance of direct/service packaging correlate at {explanatory_service_corr:+.2f} across ranked sources. They are intentionally not decorrelated: explanatory/service headlines can receive explanatory credit while still incurring packaging pressure, and removing that overlap numerically would erase the distinction rather than resolve it."]
    lines += ['', '## Body/summary corroboration diagnostics (high-volume sources)',
              'Available article summaries are treated as the body tier. Coverage means the summary is materially longer than the headline. Strong evidence includes documentary/data/legal/research surface; testimony includes direct speech attribution. These rates corroborate or contextualise title cues; they are not composite inputs because feed coverage varies substantially by source.',
              '| Source | n | Body coverage | Body strong-evidence surface | Body testimony surface | Body event cue | Body explanatory cue |', '|---|---:|---:|---:|---:|---:|---:|']
    for _,r in high_volume.iterrows():
        lines.append(f"| {r['source']} | {int(r['n'])} | {100*r['body_coverage_rate']:.1f}% | {100*r['body_evidence_surface_rate']:.1f}% | {100*r['body_testimony_surface_rate']:.1f}% | {100*r['body_event_action_rate']:.1f}% | {100*r['body_explanatory_rate']:.1f}% |")
    lines += ['', '## Highest topic-adjusted title-signal profiles (minimum n)',
              '| Rank | Source | n | Topic-adjusted title signal (95% interval) | Band | Raw 11-signal mean |', '|---:|---|---:|---:|---|---:|']
    for _,r in top.iterrows():
        lines.append(f"| {int(r['rank'])} | {r['source']} | {int(r['n'])} | {r['topic_adjusted_value_index']:.1f} ({r['topic_adjusted_index_ci95_low']:.1f}–{r['topic_adjusted_index_ci95_high']:.1f}) | {r['ordering_band']} | {r['raw_title_signal_index']:.1f} |")
    lines += ['', '## Lowest topic-adjusted title-signal profiles (minimum n)',
              '| Rank | Source | n | Topic-adjusted title signal (95% interval) | Band | Raw 11-signal mean |', '|---:|---|---:|---:|---|---:|']
    for _,r in bottom.iterrows():
        lines.append(f"| {int(r['rank'])} | {r['source']} | {int(r['n'])} | {r['topic_adjusted_value_index']:.1f} ({r['topic_adjusted_index_ci95_low']:.1f}–{r['topic_adjusted_index_ci95_high']:.1f}) | {r['ordering_band']} | {r['raw_title_signal_index']:.1f} |")
    lines += ['', '## Files',
      '- `headline_level_signals.csv`: one row per headline with detector results and metadata.',
      '- `source_rankings.csv`: source rates, context expectations, residuals, composite ordering, intervals, timestamps and sensitivity fields.',
      '- `source_axis_profiles.csv`: compact radar-ready occurrence rates, including explicit adverse incidences.',
      '- `source_index_sensitivity.csv`: composite and rank under alternate residual-shrinkage settings.',
      '- `detector_audit_sample.csv`: stratified manual-labelling sample for future detector validation.',
      '- `detector_validation_sample.csv`: source-capped random validation sheet with predicted axes and blank `human_*` fields; `validate_detectors.py score` turns completed labels into precision/recall/F1 output.',
      '- `metric_dictionary.json`: machine-readable axis definitions and composite inclusion.',
      '- `run_metrics.json`: runtime and configuration record.',
      '- `source_radar.html`: interactive radar for sources above the minimum sample threshold.']
    (out/'REPORT.md').write_text('\n'.join(lines)+'\n')

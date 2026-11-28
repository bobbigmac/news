#!/usr/bin/env python3
"""Title-only editorial-value signal analysis for source-headlines ZIP exports.

Exploratory dev-time corpus instrument, not a truth/accuracy detector. It extracts
interpretable title-level signals, cross-fits topic/editorial-context expectations,
and writes story- and source-level tables plus an interactive radar.
"""
from __future__ import annotations

import argparse, json, re, time, unicodedata, zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import spacy

from headline_measurement_features import (
    body_evidence_surface_score,
    build_event_lemma_pool,
    detect_one,
)
from headline_measurement_lexicon import (
    BODY_VAGUE_ATTRIBUTION_SURFACE,
    EVENT_ACTIONS,
    EXPLANATORY,
    PRIMARY_EVIDENCE,
    RESEARCH_CLAIM,
)
from headline_measurement_schema import (
    COMPOSITE_DELIVERY_METRICS,
    DELIVERY_METRICS,
    FEATURE_KEYS,
    RADAR_FEATURES,
    VALUE_METRICS,
)
from headline_measurement_tunings import SOURCE_SUFFIX_ALIASES
from headline_corpus_structure import (
    add_within_source_template_proxy,
    crossfit_expected,
    headline_reuse_proxy,
    source_phrase_signatures,
    topic_model,
)
from headline_source_statistics import source_statistics
from headline_reporting import detector_audit_sample, make_radar, write_analysis_report

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = REPO_ROOT / 'docs/tasks/headline-analysis.task.json'


def normalize(s: str) -> str:
    s = unicodedata.normalize('NFKC', str(s))
    s = s.replace('’', "'").replace('‘', "'").replace('“','"').replace('”','"')
    return re.sub(r'\s+', ' ', s).strip()


def compact_brand_text(value):
    compact = re.sub(r'[^a-z0-9]+', '', str(value).casefold())
    return re.sub(r'^the', '', compact)


def strip_source_boilerplate_suffix(title, source):
    match = re.search(r'\s[-–—|]\s([^-–—|]{2,60})$', title)
    if not match:
        return title, False
    source_compact = compact_brand_text(source)
    suffix_compact = compact_brand_text(match.group(1))
    aliases = {source_compact, *SOURCE_SUFFIX_ALIASES.get(source_compact, set())}
    if suffix_compact in aliases:
        return title[:match.start()].rstrip(' -–—|'), True
    return title, False


def resolve_repo_path(value) -> Path:
    p = Path(value)
    return p if p.is_absolute() else REPO_ROOT / p


def load_config(args):
    cfg = {}
    config_path = resolve_repo_path(args.config) if args.config else DEFAULT_CONFIG
    if config_path.exists():
        cfg = json.loads(config_path.read_text())
    analysis = dict(cfg.get('analysis', {}))
    if args.zip: analysis['input_zip'] = str(args.zip)
    if args.out: analysis['output_dir'] = str(args.out)
    if args.topics is not None: analysis['topics'] = args.topics
    if args.folds is not None: analysis['folds'] = args.folds
    if args.bootstrap is not None: analysis['bootstrap'] = args.bootstrap
    analysis.setdefault('input_zip', '.working/source-headlines-analysis.zip')
    analysis.setdefault('output_dir', 'docs/headline-data/current')
    analysis.setdefault('topics', 22)
    analysis.setdefault('topic_min_df', 4)
    analysis.setdefault('folds', 4)
    analysis.setdefault('bootstrap', 250)
    analysis.setdefault('min_source_n', 20)
    analysis.setdefault('random_seed', 27)
    analysis.setdefault('nearest_neighbors', 8)
    analysis.setdefault('cross_source_similarity_threshold', 0.82)
    analysis.setdefault('shrinkage_grid', [10, 25, 50])
    analysis.setdefault('default_shrinkage', 25)
    analysis['config_path'] = str(config_path)
    analysis['input_zip_path'] = str(resolve_repo_path(analysis['input_zip']))
    analysis['output_dir_path'] = str(resolve_repo_path(analysis['output_dir']))
    return analysis


def parse_archive(zip_path: Path):
    rows=[]
    with zipfile.ZipFile(zip_path) as zf:
        names=set(zf.namelist())
        if 'headline-rows.jsonl' in names:
            for line in zf.read('headline-rows.jsonl').decode('utf-8', errors='replace').splitlines():
                if line.strip(): rows.append(json.loads(line))
            df=pd.DataFrame(rows)
            for col,default in [
                ('source_key',''),('tree_root',''),('tree_root_id','uncurated'),('branch_path',''),('curated_group',''),
                ('profile_kind',''),('profile_model',''),('profile_ownership',''),('url',''),('published',''),('story_id',''),
                ('category',''),('story_type',''),('plugin',''),('first_seen',''),('last_seen',''),('last_updated',''),('body_text','')]:
                if col not in df: df[col]=default
                df[col]=df[col].fillna(default)
            df['headline']=df['headline'].map(normalize)
            df['body_text']=df['body_text'].map(normalize)
            if 'word_count' in df:
                df=df.rename(columns={'word_count':'story_word_count'})
            df['source_key']=np.where(df['source_key'].astype(str).str.len()>0,df['source_key'],df['source'])
            df['group']=np.where(df['curated_group'].astype(str).str.len()>0,df['curated_group'],df['tree_root'])
            df['group_file']='headline-rows.jsonl'
        else:
            for name in zf.namelist():
                if not name.endswith('.md') or name in ('README.md','sources-manifest.md'):
                    continue
                text = zf.read(name).decode('utf-8', errors='replace')
                current=None
                for raw in text.splitlines():
                    line=raw.strip()
                    if line.startswith('SOURCE: '):
                        current=line[len('SOURCE: '):].strip()
                    elif line and current:
                        title=normalize(line)
                        if title:
                            rows.append({'source':current,'group_file':name,'headline':title})
            df=pd.DataFrame(rows)
            df['group'] = df['group_file'].str.replace(r'^\d+-','',regex=True).str.replace('.md','',regex=False).str.replace('-', ' ').str.title()
            df['source_key']=df['source']
            for col in ['tree_root','tree_root_id','branch_path','curated_group','profile_kind','profile_model','profile_ownership','url','published','story_id','category','story_type','plugin','first_seen','last_seen','last_updated','body_text']:
                df[col]=''
            df['tree_root']=df['group']
            df['tree_root_id']=df['group_file'].str.replace(r'^\d+-','',regex=True).str.replace('.md','',regex=False)
            df['curated_group']=df['group']
    if 'profiled' not in df:
        df['profiled']=False
    else:
        df['profiled']=df['profiled'].fillna(False).astype(bool)
    df['editorial_context']=np.where(df['profile_kind'].astype(str).str.len()>0,df['profile_kind'],df['tree_root'])
    df['editorial_context']=df['editorial_context'].replace('', 'uncurated')
    df['tree_root_id']=df['tree_root_id'].replace('', 'uncurated')

    def neutral_context(row):
        text=' '.join(str(row.get(c,'')) for c in ['tree_root','branch_path','curated_group','profile_kind']).casefold()
        root=str(row.get('tree_root','')) or 'uncurated'
        if 'gaming press' in text or 'games publication' in text or 'gaming' in text:
            return 'gaming and entertainment specialist press'
        if 'science' in text or 'medical/health research' in text or 'health press' in text:
            return 'science and health specialist press'
        if 'technology press' in text or 'tech journalism' in text:
            return 'technology specialist press'
        if 'business' in text or 'financial' in text or 'money' in text:
            return 'business and finance specialist press'
        if 'local media' in text or 'regional' in text:
            return 'local and regional news'
        if 'platform' in text or 'aggregator' in text or 'developer community' in text:
            return 'platforms and aggregators'
        if 'state-controlled' in text or 'state-linked' in text or 'state media' in text:
            return 'state-linked media'
        if 'wire' in text or 'press-release' in text or 'official organization' in text:
            return 'wires releases and official organisations'
        if 'national' in text or 'newspaper' in text or 'broadcaster' in text or 'public' in text:
            return 'general national and international news'
        return root or 'uncurated'

    df['neutral_editorial_context']=df.apply(neutral_context,axis=1).replace('', 'uncurated')
    df['published_dt']=pd.to_datetime(df['published'].replace('', pd.NA), errors='coerce', utc=True, format='mixed')
    return df


def apply_measurement_groups(df: pd.DataFrame, groups):
    df['member_source_key']=df['source_key']
    df['member_source']=df['source']
    df['measurement_grouped']=False
    for group in groups or []:
        members=set(group.get('sources',[]))
        if not members: continue
        mask=df['source_key'].isin(members)
        if not mask.any(): continue
        df.loc[mask,'source_key']=group['key']
        df.loc[mask,'source']=group.get('label') or group['key']
        df.loc[mask,'measurement_grouped']=True
    return df


def main():
    started=time.perf_counter()
    stage_times={}
    def mark(name,t0):
        stage_times[name]=round(time.perf_counter()-t0,3)
        return time.perf_counter()

    ap=argparse.ArgumentParser()
    ap.add_argument('--config',type=Path,default=DEFAULT_CONFIG)
    ap.add_argument('--zip',type=Path)
    ap.add_argument('--out',type=Path)
    ap.add_argument('--topics',type=int)
    ap.add_argument('--folds',type=int)
    ap.add_argument('--bootstrap',type=int)
    args=ap.parse_args()
    cfg=load_config(args)
    zip_path=Path(cfg['input_zip_path'])
    out=Path(cfg['output_dir_path'])
    out.mkdir(parents=True,exist_ok=True)

    t=time.perf_counter()
    df=parse_archive(zip_path)
    df=apply_measurement_groups(df,cfg.get('measurement_groups'))
    df['raw_headline']=df['headline']
    cleaned=[strip_source_boilerplate_suffix(title,source) for title,source in zip(df['headline'],df['member_source'])]
    df['headline']=[x[0] for x in cleaned]
    df['source_suffix_stripped']=[int(x[1]) for x in cleaned]
    df['headline_id']=np.arange(len(df))
    t=mark('parse_archive',t)

    spacy_model=str(cfg.get('spacy_model','en_core_web_sm'))
    if bool(cfg.get('use_spacy_model',True)):
        try:
            nlp=spacy.load(spacy_model,disable=['parser'])
        except Exception as exc:
            print(f'spaCy model {spacy_model!r} unavailable ({exc}); falling back to blank tokeniser',flush=True)
            nlp=spacy.blank('en')
    else:
        nlp=spacy.blank('en')
    event_lemmas=build_event_lemma_pool(nlp) if 'tagger' in nlp.pipe_names and 'lemmatizer' in nlp.pipe_names else None
    titles=df['headline'].tolist()
    docs=list(nlp.pipe(titles,batch_size=int(cfg.get('spacy_batch_size',500))))
    det=pd.DataFrame([detect_one(title,nlp,doc=doc,event_lemmas=event_lemmas) for title,doc in zip(titles,docs)])
    df=pd.concat([df.reset_index(drop=True),det],axis=1)
    df['strong_evidence_surface']=df['evidence_surface_strength'].ge(4).astype(int)
    df['research_evidence_surface']=df['evidence_surface_strength'].eq(3).astype(int)
    body=df['body_text'].fillna('').astype(str)
    df['body_word_count']=body.str.split().str.len()
    df['body_coverage_present']=(df['body_word_count']>df['word_count']+5).astype(int)
    df['body_primary_evidence_cue']=body.map(lambda x:int(PRIMARY_EVIDENCE.search(x) is not None))
    df['body_research_claim_cue']=body.map(lambda x:int(RESEARCH_CLAIM.search(x) is not None))
    df['body_evidence_strength']=np.select([df['body_primary_evidence_cue'].eq(1),df['body_research_claim_cue'].eq(1)],[2,1],default=0)
    df['body_evidence_surface_score']=body.map(body_evidence_surface_score)
    df['body_strong_evidence_surface']=(df['body_evidence_surface_score']>=0.95).astype(int)
    df['body_testimony_surface']=(df['body_evidence_surface_score']>=0.55).astype(int)
    df['body_vague_attribution_surface']=body.map(lambda x:int(BODY_VAGUE_ATTRIBUTION_SURFACE.search(x) is not None))
    df['body_event_action_cue']=body.map(lambda x:int(EVENT_ACTIONS.search(x) is not None))
    df['body_explanatory_cue']=body.map(lambda x:int(EXPLANATORY.search(x) is not None))
    t=mark('detectors',t)

    df=headline_reuse_proxy(df,n_neighbors=int(cfg['nearest_neighbors']),threshold=float(cfg['cross_source_similarity_threshold']))
    df=add_within_source_template_proxy(df)
    t=mark('headline_reuse_and_templates',t)

    W,topics,vec,nmf=topic_model(df,n_topics=int(cfg['topics']),min_df=int(cfg['topic_min_df']),seed=int(cfg['random_seed']))
    primary_length_adjustment=bool(cfg.get('adjust_title_length',False))
    expected=crossfit_expected(df,W,FEATURE_KEYS,folds=int(cfg['folds']),seed=int(cfg['random_seed']),context_fields=cfg.get('context_fields'),adjust_title_length=primary_length_adjustment)
    expected_length_adjusted=None
    if bool(cfg.get('length_adjusted_sensitivity',False)) and not primary_length_adjustment:
        expected_length_adjusted=crossfit_expected(df,W,FEATURE_KEYS,folds=int(cfg['folds']),seed=int(cfg['random_seed']),context_fields=cfg.get('context_fields'),adjust_title_length=True)
    df['dominant_topic']=W.argmax(axis=1)
    df['topic_strength']=W.max(axis=1)
    t=mark('topic_model_and_crossfit_expectations',t)

    df['information_delivery_signal']=100*df[DELIVERY_METRICS].mean(axis=1)
    df['attention_packaging_pressure']=100*df[['explicit_curiosity_gap_risk','direct_service_packaging_present','personal_sensational_frame_present']].mean(axis=1)
    df['title_value_signal']=100*df[VALUE_METRICS].mean(axis=1)
    src,sensitivity_df=source_statistics(df,expected,min_source_n=int(cfg['min_source_n']),shrinkage=float(cfg['default_shrinkage']),
                                         shrinkage_grid=cfg['shrinkage_grid'],bootstrap=int(cfg['bootstrap']),seed=int(cfg['random_seed']),
                                         attention_context_adjustment=float(cfg.get('attention_context_adjustment',0.25)),
                                         empirical_composite_shrinkage=bool(cfg.get('empirical_composite_shrinkage',True)),
                                         composite_axis_cap_quantile=float(cfg.get('composite_axis_cap_quantile',0.9)))
    if expected_length_adjusted is not None:
        src_len,_=source_statistics(df,expected_length_adjusted,min_source_n=int(cfg['min_source_n']),shrinkage=float(cfg['default_shrinkage']),
                                    shrinkage_grid=cfg['shrinkage_grid'],bootstrap=0,seed=int(cfg['random_seed']),
                                    attention_context_adjustment=float(cfg.get('attention_context_adjustment',0.25)),
                                    empirical_composite_shrinkage=bool(cfg.get('empirical_composite_shrinkage',True)),
                                    composite_axis_cap_quantile=float(cfg.get('composite_axis_cap_quantile',0.9)))
        len_cols=['source_key','topic_adjusted_value_index','rank','rank_n50','rank_n100','ordering_band']
        len_suffix=src_len[len_cols].rename(columns={c:'length_adjusted_'+c for c in len_cols if c!='source_key'})
        src=src.merge(len_suffix,on='source_key',how='left')
    t=mark('source_statistics_and_bootstrap',t)

    df['body_text_excerpt']=df['body_text'].fillna('').astype(str).str.slice(0,600)
    story_cols=['headline_id','source_key','source','member_source_key','member_source','measurement_grouped','group','tree_root','branch_path','curated_group','editorial_context','neutral_editorial_context','group_file','headline','raw_headline','source_suffix_stripped','body_text_excerpt','url','published','story_id','category','story_type','word_count','story_word_count','information_delivery_signal','attention_packaging_pressure','title_value_signal','legacy_title_value_signal_raw','dominant_topic','topic_strength']
    story_cols += FEATURE_KEYS + ['cross_source_title_echo','event_action_present','named_entity_proxy','capitalised_entity_count_proxy','teaser_verb_present','explicit_curiosity_gap_present','explicit_curiosity_gap_risk','stock_teaser_surface','trailing_ellipsis_surface','listicle_withholding_surface','mechanism_gap_surface','teaching_withholding_surface','unresolved_finding_question_surface','verbal_withholding_surface','withheld_examples_surface','withheld_reason_surface','resolution_gap_surface','withheld_timing_surface','reaction_gap_surface','emphatic_gap_surface','vague_reference_surface','followup_question_surface','unresolved_forward_start','narrative_pronoun_hook','curiosity_pronoun_density','curiosity_determiner_density','curiosity_wh_density','curiosity_forwardish_density','curiosity_specificity_points','curiosity_structural_load','direct_service_packaging_present','legacy_bait_present','question_form_present','sensational_word_present','personal_life_frame_present','personal_sensational_frame_present','celebrity_cue_present','attribution_present','anonymous_source_cue','primary_evidence_cue','research_claim_cue','evidence_strength','evidence_surface_strength','strong_evidence_surface','research_evidence_surface','evidence_anchor_surface','document_object_surface','research_object_surface','visual_object_surface','weak_typed_object_surface','document_empirical_surface','research_empirical_surface','visual_empirical_surface','modified_evidence_surface','document_disclosure_surface','legal_testimony_surface','direct_testimony_surface','direct_testimony_vague_speaker','quote_testimony_surface','announcement_surface','vague_attribution_surface','body_coverage_present','body_word_count','body_primary_evidence_cue','body_research_claim_cue','body_evidence_strength','body_evidence_surface_score','body_strong_evidence_surface','body_testimony_surface','body_vague_attribution_surface','body_event_action_cue','body_explanatory_cue','cross_source_title_similarity','cross_source_near_duplicate_proxy','cross_source_nearest_source','cross_source_nearest_headline','within_source_repeated_trigram_proxy']
    for col in story_cols:
        if col not in df: df[col]=''
    df[story_cols].to_csv(out/'headline_level_signals.csv',index=False)
    df.loc[df.cross_source_near_duplicate_proxy.eq(1), ['source','headline','cross_source_nearest_source','cross_source_nearest_headline','cross_source_title_similarity']].sort_values('cross_source_title_similarity',ascending=False).to_csv(out/'cross_source_title_matches.csv',index=False)
    src.to_csv(out/'source_rankings.csv',index=False)
    sensitivity_df.to_csv(out/'source_index_sensitivity.csv',index=False)
    source_phrase_signatures(df,out/'source_phrase_signatures.csv')
    story_dist_cols=['source_key','source','group','tree_root','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index','legacy_raw_title_signal_index','delivery_signal_mean','delivery_signal_median','delivery_signal_p25','delivery_signal_p75','delivery_signal_p90','delivery_share_le20','delivery_share_ge44','attention_pressure_mean','published_span_days','headlines_per_week']
    src[story_dist_cols].to_csv(out/'source_story_score_distributions.csv',index=False)

    # Compact axis export: positive rates plus explicit adverse incidences.
    src['explicit_curiosity_gap_expected_context'] = 1.0-src['low_explicit_curiosity_gap_expected_context']
    src['explicit_curiosity_gap_adjusted_pp'] = -src['low_explicit_curiosity_gap_adjusted_pp']
    src['direct_service_packaging_expected_context'] = 1.0-src['low_direct_service_packaging_expected_context']
    src['direct_service_packaging_adjusted_pp'] = -src['low_direct_service_packaging_adjusted_pp']
    src['sensational_personal_expected_context'] = 1.0-src['low_sensational_personal_expected_context']
    src['sensational_personal_adjusted_pp'] = -src['low_sensational_personal_adjusted_pp']
    profile_cols=['source_key','source','group','tree_root','n']
    profile_cols += [m+'_rate' for m in DELIVERY_METRICS]
    profile_cols += ['explicit_curiosity_gap_incidence_rate','direct_service_packaging_incidence_rate','sensational_personal_incidence_rate','cross_source_near_duplicate_rate']
    profile_cols += [m+'_expected_context' for m in COMPOSITE_DELIVERY_METRICS]
    profile_cols += ['explicit_curiosity_gap_expected_context','direct_service_packaging_expected_context','sensational_personal_expected_context']
    profile_cols += [m+'_adjusted_pp' for m in COMPOSITE_DELIVERY_METRICS]
    profile_cols += ['explicit_curiosity_gap_adjusted_pp','direct_service_packaging_adjusted_pp','sensational_personal_adjusted_pp']
    profile_cols += ['named_entity_signal_rate','public_interest_rate','research_claim_cue_rate','primary_evidence_cue_rate']
    profile_cols += ['strong_evidence_surface_rate','research_evidence_surface_rate','direct_testimony_surface_rate','quote_testimony_surface_rate','vague_attribution_surface_rate']
    profile_cols += ['curiosity_gap_risk_mean','stock_teaser_surface_rate','listicle_withholding_surface_rate','withheld_reason_surface_rate','resolution_gap_surface_rate','vague_reference_surface_rate']
    profile_cols += ['body_coverage_rate','body_word_count_mean','body_primary_evidence_rate','body_research_claim_rate','body_evidence_surface_rate','body_testimony_surface_rate','body_evidence_surface_score_mean','body_event_action_rate','body_explanatory_rate']
    src[profile_cols].to_csv(out/'source_axis_profiles.csv',index=False)
    (out/'topic_model.json').write_text(json.dumps(topics,indent=2))
    topic_rows=[]
    for source_key,positions in df.groupby('source_key',sort=False).indices.items():
        shares=W[np.asarray(positions)].mean(axis=0)
        row={'source_key':source_key,'source':df.iloc[positions[0]]['source'],'n':len(positions)}
        row.update({f'topic_{k:02d}_share':float(v) for k,v in enumerate(shares)})
        topic_rows.append(row)
    pd.DataFrame(topic_rows).to_csv(out/'source_topic_profiles.csv',index=False)
    metric_docs=[]
    for f in RADAR_FEATURES:
        metric_docs.append({'key':f['key'],'label':f['label'],'polarity':f['polarity'],'included_in_composite':f['value'],'description':f['description']})
    (out/'metric_dictionary.json').write_text(json.dumps(metric_docs,indent=2))
    detector_audit_sample(df,out/'detector_audit_sample.csv',seed=int(cfg['random_seed']))
    make_radar(src,out/'source_radar.html')
    t=mark('write_tables_and_radar',t)

    exact_dups=df.groupby('headline').size()
    eligible=src[src.rank_eligible].copy().sort_values('topic_adjusted_value_index',ascending=False)
    top=eligible.head(15); bottom=eligible.tail(15).sort_values('topic_adjusted_value_index')
    overall_rates={
        'event_clarity':float(df['event_clarity'].mean()),
        'quantified_specificity':float(df['quantified_specificity'].mean()),
        'time_place_anchor':float(df['time_place_anchor'].mean()),
        'causal_explanation':float(df['causal_explanation'].mean()),
        'material_consequence':float(df['material_consequence'].mean()),
        'evidence_provenance':float(df['evidence_provenance'].mean()),
        'context_comparison':float(df['context_comparison'].mean()),
        'explanatory_framing':float(df['explanatory_framing'].mean()),
        'original_reporting_signal':float(df['original_reporting_signal'].mean()),
        'explicit_curiosity_gap_incidence':float(df['explicit_curiosity_gap_risk'].mean()),
        'direct_service_packaging_incidence':float(df['direct_service_packaging_present'].mean()),
        'sensational_personal_incidence':float(df['personal_sensational_frame_present'].mean()),
        'cross_source_title_echo':float(df['cross_source_title_echo'].mean()),
    }
    sensitivity_pivot=sensitivity_df.dropna(subset=['rank']).pivot_table(index='source_key',columns='shrinkage',values='topic_adjusted_value_index')
    sensitivity_corr=sensitivity_pivot.corr(method='spearman').round(4).to_dict() if sensitivity_pivot.shape[1]>1 else {}
    total_time=round(time.perf_counter()-started,3)
    summary={
      'zip':str(zip_path),'config':cfg['config_path'],'headline_rows':int(len(df)),'sources':int(df.source_key.nunique()),
      'source_suffix_stripped_rows':int(df['source_suffix_stripped'].sum()),
      'exact_duplicate_headline_rows':int((exact_dups-1).clip(lower=0).sum()),
      'cross_source_near_duplicate_title_rows':int(df.cross_source_near_duplicate_proxy.sum()),
      'sources_ranked_min_n':int(len(eligible)),'min_source_n':int(cfg['min_source_n']),
      'sources_n_ge_50':int((src.n>=50).sum()),'sources_n_ge_100':int((src.n>=100).sum()),
      'sources_below_min_n':int((src.n<int(cfg['min_source_n'])).sum()),'nmf_topics':len(topics),
      'value_signal_count':len(VALUE_METRICS),'delivery_signal_count':len(DELIVERY_METRICS),'radar_axis_count':len(RADAR_FEATURES),
      'crossfit_folds':int(cfg['folds']),'default_shrinkage':float(cfg['default_shrinkage']),'shrinkage_grid':cfg['shrinkage_grid'],
      'empirical_composite_shrinkage':bool(cfg.get('empirical_composite_shrinkage',True)),
      'composite_shrinkage_k':float(src['composite_shrinkage_k'].iloc[0]) if 'composite_shrinkage_k' in src else None,
      'composite_axis_cap_quantile':float(cfg.get('composite_axis_cap_quantile',0.9)),
      'composite_axis_cap_pp':float(src['composite_axis_cap_pp'].iloc[0]) if 'composite_axis_cap_pp' in src else None,
      'composite_score_range':[float(eligible['topic_adjusted_value_index'].min()),float(eligible['topic_adjusted_value_index'].max())] if len(eligible) else None,
      'composite_ci95_width_mean':float((eligible['topic_adjusted_index_ci95_high']-eligible['topic_adjusted_index_ci95_low']).mean()) if len(eligible) else None,
      'shrinkage_spearman_correlation':sensitivity_corr,
      'overall_axis_rates':overall_rates,
      'top_15':top[['rank','source','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index']].to_dict(orient='records'),
      'bottom_15':bottom[['rank','source','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index']].to_dict(orient='records'),
      'largest_sources':src.sort_values('n',ascending=False).head(20)[['source','n','group','topic_adjusted_value_index']].to_dict(orient='records'),
      'runtime_seconds':total_time,'stage_times':stage_times,
    }
    (out/'analysis_summary.json').write_text(json.dumps(summary,indent=2))
    (out/'run_metrics.json').write_text(json.dumps({'runtime_seconds':total_time,'stage_times':stage_times,'config':{k:v for k,v in cfg.items() if not k.endswith('_path')}},indent=2,default=str))

    write_analysis_report(out, df, src, eligible, top, bottom, cfg, primary_length_adjustment, expected_length_adjusted, total_time, stage_times)
    print(json.dumps({k:summary[k] for k in ['headline_rows','sources','sources_ranked_min_n','sources_n_ge_50','sources_n_ge_100','sources_below_min_n','exact_duplicate_headline_rows','runtime_seconds']},indent=2))
    print('\nTOP:')
    print(top.head(15)[['rank','source','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index']].to_string(index=False))
    print('\nBOTTOM:')
    print(bottom[['rank','source','n','topic_adjusted_value_index','ordering_band','raw_title_signal_index']].to_string(index=False))


if __name__=='__main__':
    main()

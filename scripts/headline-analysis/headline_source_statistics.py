"""Source-level residual aggregation, composite scoring and uncertainty."""

import numpy as np
import pandas as pd

from headline_measurement_schema import ATTENTION_METRICS, FEATURE_KEYS, VALUE_METRICS

def value_component_residuals(df: pd.DataFrame, expected, attention_context_adjustment=0.25):
    """Return per-headline residuals for composite inputs in natural cue units.

    Delivery cues are fully topic/context-residualised. Inverse attention-restraint
    cues use the configured partial topic adjustment, with the remainder compared
    against corpus-wide incidence. The row mean of these components rewards
    headlines that carry several cues at once instead of averaging independently
    renormalised axis z-scores later.
    """
    value_ix=[FEATURE_KEYS.index(c) for c in VALUE_METRICS]
    Y=df[VALUE_METRICS].to_numpy(dtype=float)
    E=expected[:,value_ix]
    R=Y-E
    attention_lambda=float(attention_context_adjustment)
    for j,col in enumerate(VALUE_METRICS):
        if col in ATTENTION_METRICS:
            corpus_mean=float(df[col].mean())
            R[:,j]=Y[:,j]-(attention_lambda*E[:,j]+(1.0-attention_lambda)*corpus_mean)
    return R,R.mean(axis=1)


def estimate_aggregate_shrinkage(df: pd.DataFrame, row_signal, min_source_n=20):
    """Estimate the shrinkage constant from within- and between-source variance.

    Under the usual random-effects approximation, row variance sigma^2 gives
    sampling variance sigma^2/n and between-source variance tau^2 gives shrinkage
    n/(n+sigma^2/tau^2). This replaces the earlier hand-picked constant while keeping
    the same conservative empirical-Bayes interpretation.
    """
    rows=[]
    for source_key, positions in df.groupby('source_key',sort=False).indices.items():
        x=np.asarray(row_signal[np.asarray(positions,dtype=int)],dtype=float)
        n=len(x)
        if n<min_source_n or n<2: continue
        rows.append({'source_key':source_key,'n':n,'mean':float(x.mean()),'row_variance':float(x.var(ddof=1))})
    stats=pd.DataFrame(rows)
    if len(stats)<3:
        return {'k':25.0,'sigma2':np.nan,'tau2':np.nan,'mean_sampling_variance':np.nan,'source_count':len(stats)}
    weights=np.maximum(stats['n']-1,1).to_numpy(dtype=float)
    sigma2=float(np.average(stats['row_variance'],weights=weights))
    stats['sampling_variance']=stats['row_variance']/stats['n']
    # A zero observed within-source variance is sampling luck, not proof of zero
    # uncertainty. Use the pooled row variance as a floor in that degenerate case.
    stats['sampling_variance']=np.maximum(stats['sampling_variance'],sigma2/stats['n']*0.05)
    v=stats['sampling_variance'].to_numpy(dtype=float)
    r=stats['mean'].to_numpy(dtype=float)
    w=1.0/np.maximum(v,1e-12)
    rbar=float((w*r).sum()/w.sum())
    q=float((w*(r-rbar)**2).sum())
    c=float(w.sum()-(w**2).sum()/w.sum())
    tau2=max(0.0,(q-(len(stats)-1))/c) if c>0 else 0.0
    k=sigma2/tau2 if tau2>1e-12 else 250.0
    k=float(min(max(k,1.0),250.0))
    return {'k':k,'sigma2':sigma2,'tau2':tau2,'mean_sampling_variance':float(v.mean()),'source_count':int(len(stats))}


def axis_diagnostics(src, shrink, min_n):
    """Keep per-axis adjusted positions inspectable without making them the composite."""
    out=src.copy()
    zcols=[]
    eligible=out['n']>=min_n
    for col in VALUE_METRICS:
        residual_col=col+'_index_residual' if col+'_index_residual' in out else col+'_residual'
        adj=100*out[residual_col]*(out['n']/(out['n']+float(shrink)))
        tmp=adj.astype(float)
        mu=float(tmp[eligible].mean())
        sd=float(tmp[eligible].std(ddof=1))
        if sd<=1e-8: sd=1.0
        out[col+'_adjusted_pp']=tmp
        out[col+'_relative_z']=(tmp-mu)/sd
        zcols.append(col+'_relative_z')
    out['axis_average_index']=(50+15*out[zcols].clip(-3,3).mean(axis=1)).clip(0,100)
    return out


def composite_for_shrink(src, shrink, min_n, cap_quantile=0.9, fixed_cap_pp=None):
    """Corpus-normalise the aggregate natural-unit residual.

    Axis residuals are first shrunk in natural cue units. A symmetric corpus-derived
    saturation point then limits how much leverage one very large axis deviation can
    have before the eleven axes are averaged. The spiderweb axes themselves remain
    uncapped; the cap applies only to composite aggregation. The final 50/15 transform
    is a corpus-relative display calibration rather than a claim that one axis z-score
    is interchangeable with another.
    """
    out=src.copy()
    eligible=out['n']>=min_n
    factor=out['n']/(out['n']+float(shrink))
    residual_cols=[c+'_index_residual' for c in VALUE_METRICS]
    components=100*out[residual_cols].astype(float).mul(factor,axis=0)
    if fixed_cap_pp is not None:
        cap_pp=float(fixed_cap_pp)
    elif cap_quantile is not None and 0<float(cap_quantile)<1:
        cap_pp=float(np.quantile(np.abs(components.loc[eligible].to_numpy(dtype=float)),float(cap_quantile)))
    else:
        cap_pp=float('inf')
    capped=components.clip(lower=-cap_pp,upper=cap_pp) if np.isfinite(cap_pp) else components
    adj=capped.mean(axis=1)
    out['composite_axis_cap_pp']=cap_pp if np.isfinite(cap_pp) else np.nan
    out['composite_adjusted_pp']=adj
    mu=float(adj[eligible].mean())
    sd=float(adj[eligible].std(ddof=1))
    if sd<=1e-8: sd=1.0
    out['composite_relative_z']=(adj-mu)/sd
    out['topic_adjusted_value_index']=(50+15*out['composite_relative_z'].clip(-3,3)).clip(0,100)
    order=out.loc[out['n']>=min_n].sort_values('topic_adjusted_value_index',ascending=False).index
    out['rank']=np.nan
    out.loc[order,'rank']=np.arange(1,len(order)+1)
    return out,cap_pp


def band_from_rank(rank, eligible_count):
    if not np.isfinite(rank): return 'Unranked'
    pct=rank/max(eligible_count,1)
    if pct<=0.25: return 'A — upper quartile'
    if pct<=0.50: return 'B — second quartile'
    if pct<=0.75: return 'C — third quartile'
    return 'D — lower quartile'


def source_statistics(df, expected, min_source_n=20, shrinkage=25, shrinkage_grid=(10,25,50), bootstrap=250, seed=27, attention_context_adjustment=0.25, empirical_composite_shrinkage=True, composite_axis_cap_quantile=0.9, bootstrap_min_n=10):
    component_residuals,composite_row_residual=value_component_residuals(df,expected,attention_context_adjustment=attention_context_adjustment)
    g=df.groupby('source_key', sort=False)
    src=g.agg(source=('source',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              n=('headline','size'),
              group=('group',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              tree_root=('tree_root',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              editorial_context=('editorial_context',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              neutral_editorial_context=('neutral_editorial_context',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              measurement_members=('member_source',lambda x:'; '.join(sorted(set(map(str,x))))),
              measurement_member_keys=('member_source_key',lambda x:';'.join(sorted(set(map(str,x))))),
              icon_source_key=('member_source_key',lambda x:x.mode().iat[0] if len(x.mode()) else x.iloc[0]),
              measurement_grouped=('measurement_grouped','max'),
              mean_words=('word_count','mean'), title_value_raw=('title_value_signal_raw','mean'),
              legacy_title_value_raw=('legacy_title_value_signal_raw','mean'),
              delivery_signal_mean=('information_delivery_signal','mean'),
              delivery_signal_median=('information_delivery_signal','median'),
              delivery_signal_p25=('information_delivery_signal',lambda x:x.quantile(.25)),
              delivery_signal_p75=('information_delivery_signal',lambda x:x.quantile(.75)),
              delivery_signal_p90=('information_delivery_signal',lambda x:x.quantile(.90)),
              delivery_share_le20=('information_delivery_signal',lambda x:(x<=20).mean()),
              delivery_share_ge44=('information_delivery_signal',lambda x:(x>=44.444444).mean()),
              attention_pressure_mean=('attention_packaging_pressure','mean'),
              body_coverage_rate=('body_coverage_present','mean'), body_word_count_mean=('body_word_count','mean'),
              body_primary_evidence_rate=('body_primary_evidence_cue','mean'), body_research_claim_rate=('body_research_claim_cue','mean'),
              body_evidence_surface_rate=('body_strong_evidence_surface','mean'), body_testimony_surface_rate=('body_testimony_surface','mean'),
              body_evidence_surface_score_mean=('body_evidence_surface_score','mean'),
              body_event_action_rate=('body_event_action_cue','mean'), body_explanatory_rate=('body_explanatory_cue','mean'),
              within_source_template_reuse_rate=('within_source_repeated_trigram_proxy','mean'),
              attribution_cue_rate=('attribution_present','mean'), anonymous_source_cue_rate=('anonymous_source_cue','mean'),
              strong_evidence_surface_rate=('strong_evidence_surface','mean'), research_evidence_surface_rate=('research_evidence_surface','mean'),
              direct_testimony_surface_rate=('direct_testimony_surface','mean'), quote_testimony_surface_rate=('quote_testimony_surface','mean'),
              vague_attribution_surface_rate=('vague_attribution_surface','mean'),
              curiosity_gap_risk_mean=('explicit_curiosity_gap_risk','mean'),
              stock_teaser_surface_rate=('stock_teaser_surface','mean'),
              listicle_withholding_surface_rate=('listicle_withholding_surface','mean'),
              withheld_reason_surface_rate=('withheld_reason_surface','mean'),
              resolution_gap_surface_rate=('resolution_gap_surface','mean'),
              vague_reference_surface_rate=('vague_reference_surface','mean'),
              cross_source_near_duplicate_rate=('cross_source_near_duplicate_proxy','mean'),
              mean_cross_source_similarity=('cross_source_title_similarity','mean'),
              first_published=('published_dt','min'), last_published=('published_dt','max')).reset_index()
    span=(src['last_published']-src['first_published']).dt.total_seconds()/86400
    src['published_span_days']=span.fillna(0).round(2)
    src['headlines_per_week']=np.where(src['published_span_days']>1,src['n']/(src['published_span_days']/7),np.nan)

    rows=[]
    for source_key, idx in g.indices.items():
        idx=np.asarray(idx)
        n=len(idx)
        r={'source_key':source_key}
        for fi,col in enumerate(FEATURE_KEYS):
            obs=float(df.iloc[idx][col].mean())
            exp=float(expected[idx,fi].mean())
            r[col+'_rate']=obs
            r[col+'_expected_context']=exp
            r[col+'_residual']=obs-exp
        rows.append(r)
    metrics=pd.DataFrame(rows)
    src=src.merge(metrics,on='source_key',how='left')

    composite_rows=[]
    for source_key, positions in g.indices.items():
        x=np.asarray(composite_row_residual[np.asarray(positions,dtype=int)],dtype=float)
        composite_rows.append({'source_key':source_key,
                               'composite_residual_uncapped_mean':float(x.mean()),
                               'composite_residual_row_variance':float(x.var(ddof=1)) if len(x)>1 else np.nan})
    src=src.merge(pd.DataFrame(composite_rows),on='source_key',how='left')
    shrinkage_stats=estimate_aggregate_shrinkage(df,composite_row_residual,min_source_n=min_source_n) if empirical_composite_shrinkage else {'k':float(shrinkage),'sigma2':np.nan,'tau2':np.nan,'mean_sampling_variance':np.nan,'source_count':0}
    primary_shrinkage=float(shrinkage_stats['k']) if empirical_composite_shrinkage else float(shrinkage)
    src['composite_shrinkage_k']=primary_shrinkage
    src['composite_shrinkage_factor']=src['n']/(src['n']+primary_shrinkage)
    for key,value in shrinkage_stats.items():
        if key!='k': src['composite_variance_'+key]=value

    entity_rates = g['named_entity_signal'].mean().rename('named_entity_signal_rate').reset_index()
    public_rates = g['public_interest'].mean().rename('public_interest_rate').reset_index()
    research_rates = g['research_claim_cue'].mean().rename('research_claim_cue_rate').reset_index()
    primary_rates = g['primary_evidence_cue'].mean().rename('primary_evidence_cue_rate').reset_index()
    src = src.merge(entity_rates,on='source_key',how='left').merge(public_rates,on='source_key',how='left').merge(research_rates,on='source_key',how='left').merge(primary_rates,on='source_key',how='left')
    src['explicit_curiosity_gap_incidence_rate'] = 1.0 - src['low_explicit_curiosity_gap_rate']
    src['direct_service_packaging_incidence_rate'] = 1.0 - src['low_direct_service_packaging_rate']
    src['sensational_personal_incidence_rate'] = 1.0 - src['low_sensational_personal_rate']

    # Delivery markers are fully topic/context-adjusted. Attention packaging is only
    # partly forgiven by context: the rest is compared with the corpus-wide incidence,
    # because attention farming is a publisher behaviour rather than an inevitable
    # consequence of covering a topic. This keeps high absolute sensational/service
    # pressure visible in the composite instead of treating it as genre-normal.
    attention_lambda=float(attention_context_adjustment)
    attention_corpus_mean={c:float(df[c].mean()) for c in ATTENTION_METRICS}
    for col in VALUE_METRICS:
        if col in ATTENTION_METRICS:
            topic_part=src[col+'_residual']
            absolute_part=src[col+'_rate']-attention_corpus_mean[col]
            src[col+'_index_residual']=attention_lambda*topic_part+(1.0-attention_lambda)*absolute_part
        else:
            src[col+'_index_residual']=src[col+'_residual']

    # Axis z-scores remain diagnostic profiles. The composite is instead built in
    # natural cue units so co-occurring information cues accumulate rather than
    # being compressed by a second round of independent z-score averaging.
    src=axis_diagnostics(src,primary_shrinkage,min_source_n)

    sensitivity=[]
    sensitivity_ks=[]
    for shrink in shrinkage_grid:
        if not any(abs(float(shrink)-float(x))<1e-9 for x in sensitivity_ks):
            sensitivity_ks.append(float(shrink))
    if not any(abs(primary_shrinkage-float(x))<1e-9 for x in sensitivity_ks):
        sensitivity_ks.append(primary_shrinkage)
    base,primary_cap_pp=composite_for_shrink(src,primary_shrinkage,min_source_n,cap_quantile=composite_axis_cap_quantile)
    for shrink in sensitivity_ks:
        comp,_=composite_for_shrink(src,shrink,min_source_n,cap_quantile=composite_axis_cap_quantile,fixed_cap_pp=primary_cap_pp)
        sensitivity.append((shrink,comp))
    for col in ['topic_adjusted_value_index','rank','composite_adjusted_pp','composite_relative_z','composite_axis_cap_pp']:
        src[col]=base[col]

    sens_rows=[]
    for shrink,comp in sensitivity:
        for _,row in comp[['source_key','source','n','topic_adjusted_value_index','rank']].iterrows():
            sens_rows.append({'source_key':row['source_key'],'source':row['source'],'n':row['n'],'shrinkage':shrink,
                              'topic_adjusted_value_index':row['topic_adjusted_value_index'],'rank':row['rank']})
    sensitivity_df=pd.DataFrame(sens_rows)

    # Bootstrap intervals for the aggregate composite: headline sampling uncertainty only.
    rng=np.random.default_rng(seed)
    eligible=src['n']>=min_source_n
    comp_mu=float(src.loc[eligible,'composite_adjusted_pp'].mean())
    comp_sd=max(float(src.loc[eligible,'composite_adjusted_pp'].std(ddof=1)),1e-8)
    ci_low=np.full(len(src),np.nan); ci_high=np.full(len(src),np.nan)
    src_index={key:i for i,key in enumerate(src['source_key'])}
    if int(bootstrap)>0:
        cap_pp=float(src['composite_axis_cap_pp'].iloc[0])
        for source_key, positions in g.indices.items():
            row_i=src_index[source_key]
            n=len(positions)
            if n<bootstrap_min_n: continue
            pos=np.asarray(positions,dtype=int)
            Rsrc=component_residuals[pos,:]
            boot_ix=rng.integers(0,n,size=(int(bootstrap),n))
            component_means_b=Rsrc[boot_ix].mean(axis=1)
            adj_components_b=100.0*component_means_b*(n/(n+primary_shrinkage))
            adj_b=np.clip(adj_components_b,-cap_pp,cap_pp).mean(axis=1)
            z_b=np.clip((adj_b-comp_mu)/comp_sd,-3,3)
            score_b=np.clip(50.0+15.0*z_b,0,100)
            ci_low[row_i],ci_high[row_i]=np.quantile(score_b,[0.025,0.975])
    src['topic_adjusted_index_ci95_low']=ci_low
    src['topic_adjusted_index_ci95_high']=ci_high

    src['raw_title_signal_index']=100*src['title_value_raw']
    src['legacy_raw_title_signal_index']=100*src['legacy_title_value_raw']
    src['rank_eligible']=src['n']>=min_source_n
    src['confidence_tier']=np.select([src['n']>=100,src['n']>=50,src['n']>=min_source_n],['High sample volume','Moderate sample volume','Limited sample volume'],default=f'Insufficient sample (<{min_source_n})')
    eligible_count=int(src['rank_eligible'].sum())
    src['ordering_band']=[band_from_rank(r,eligible_count) for r in src['rank']]
    for threshold,rank_col in [(50,'rank_n50'),(100,'rank_n100')]:
        order=src.loc[src['n']>=threshold].sort_values('topic_adjusted_value_index',ascending=False).index
        src[rank_col]=np.nan
        src.loc[order,rank_col]=np.arange(1,len(order)+1)
    src=src.sort_values(['rank_eligible','topic_adjusted_value_index','n'],ascending=[False,False,False]).reset_index(drop=True)
    return src,sensitivity_df

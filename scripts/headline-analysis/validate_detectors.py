#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from headline_measurement_schema import DELIVERY_METRICS

REPO_ROOT = Path(__file__).resolve().parents[2]

ADVERSE_AXES=['explicit_curiosity_gap_present','direct_service_packaging_present','personal_sensational_frame_present']
AXES=DELIVERY_METRICS+['explicit_curiosity_gap_risk']+ADVERSE_AXES
FRACTIONAL_AXES={'evidence_provenance','explicit_curiosity_gap_risk'}


def load_out(args):
    out=args.out
    if out is None:
        cfg=json.loads(args.config.read_text()) if args.config.exists() else {}
        out=Path(cfg.get('analysis',{}).get('output_dir','docs/headline-data/current'))
    return out if out.is_absolute() else REPO_ROOT/out


def make_sample(h,out_path,n=150,per_source=3,seed=27):
    rng=np.random.default_rng(seed)
    order=rng.permutation(len(h))
    chosen=[]; counts={}
    for ix in order:
        key=h.iloc[int(ix)]['source_key']
        if counts.get(key,0)>=per_source: continue
        chosen.append(int(ix)); counts[key]=counts.get(key,0)+1
        if len(chosen)>=n: break
    rows=[]
    for ix in chosen:
        r=h.iloc[ix]
        row={'headline_id':r.get('headline_id',ix),'source_key':r['source_key'],'source':r['source'],'headline':r['headline'],'body_text_excerpt':r.get('body_text_excerpt',''),'url':r.get('url','')}
        for axis in AXES:
            row['pred_'+axis]=r[axis]
            row['human_'+axis]=''
        rows.append(row)
    pd.DataFrame(rows).to_csv(out_path,index=False)
    return len(rows)


def binary_metrics(y_true,y_pred):
    tp=int(((y_true==1)&(y_pred==1)).sum()); fp=int(((y_true==0)&(y_pred==1)).sum())
    fn=int(((y_true==1)&(y_pred==0)).sum()); tn=int(((y_true==0)&(y_pred==0)).sum())
    precision=tp/(tp+fp) if tp+fp else None
    recall=tp/(tp+fn) if tp+fn else None
    f1=(2*precision*recall/(precision+recall)) if precision is not None and recall is not None and precision+recall else None
    return {'n':int(len(y_true)),'tp':tp,'fp':fp,'fn':fn,'tn':tn,'precision':precision,'recall':recall,'f1':f1}


def score_sample(path,out_json):
    df=pd.read_csv(path)
    result={'input':str(path),'labelled_axes':{},'unlabelled_axes':[]}
    for axis in AXES:
        hcol='human_'+axis; pcol='pred_'+axis
        if hcol not in df:
            result['unlabelled_axes'].append(axis); continue
        vals=pd.to_numeric(df[hcol],errors='coerce')
        mask=vals.notna()
        if mask.sum()<10:
            result['unlabelled_axes'].append(axis); continue
        y_true=vals[mask].to_numpy(dtype=float)
        y_pred=pd.to_numeric(df.loc[mask,pcol],errors='coerce').fillna(0).to_numpy(dtype=float)
        if axis in FRACTIONAL_AXES:
            presence=binary_metrics((y_true>0).astype(int),(y_pred>0).astype(int))
            presence.update({'exact_accuracy':float((y_true==y_pred).mean()),'mean_absolute_error':float(np.abs(y_true-y_pred).mean())})
            result['labelled_axes'][axis]=presence
        else:
            result['labelled_axes'][axis]=binary_metrics((y_true>0).astype(int),(y_pred>0).astype(int))
    result['status']='scored' if result['labelled_axes'] else 'insufficient_labels'
    out_json.write_text(json.dumps(result,indent=2))
    return result


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('mode',choices=['sample','score'])
    ap.add_argument('--config',type=Path,default=REPO_ROOT/'docs/tasks/headline-analysis.task.json')
    ap.add_argument('--out',type=Path)
    ap.add_argument('--sample',type=Path)
    ap.add_argument('--n',type=int,default=150)
    ap.add_argument('--per-source',type=int,default=3)
    ap.add_argument('--seed',type=int,default=27)
    args=ap.parse_args()
    out=load_out(args)
    sample_path=args.sample or out/'detector_validation_sample.csv'
    if not sample_path.is_absolute(): sample_path=REPO_ROOT/sample_path
    if args.mode=='sample':
        h=pd.read_csv(out/'headline_level_signals.csv')
        n=make_sample(h,sample_path,n=args.n,per_source=args.per_source,seed=args.seed)
        print(f'wrote {n} validation rows to {sample_path}')
    else:
        result=score_sample(sample_path,out/'detector_validation_scores.json')
        print(json.dumps({'status':result['status'],'labelled_axis_count':len(result['labelled_axes']),'unlabelled_axis_count':len(result['unlabelled_axes'])},indent=2))

if __name__=='__main__':
    main()

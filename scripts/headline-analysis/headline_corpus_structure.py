"""Corpus structure: topic models, headline reuse and source phrase signatures."""
from collections import Counter
import math
import re
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix, hstack
from sklearn.decomposition import NMF
from sklearn.feature_extraction.text import CountVectorizer, ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import OneHotEncoder

def topic_model(df: pd.DataFrame, n_topics=22, min_df=4, seed=27):
    vec=TfidfVectorizer(stop_words='english', ngram_range=(1,2), min_df=min_df,
                        max_df=0.88, max_features=26000, sublinear_tf=True,
                        strip_accents='unicode')
    X=vec.fit_transform(df['headline'].tolist())
    n_topics=min(n_topics, max(5, X.shape[1]//10), X.shape[0]-1)
    nmf=NMF(n_components=n_topics, init='nndsvda', random_state=seed,
            max_iter=320, l1_ratio=0.05, alpha_W=0.00005, alpha_H=0.00005)
    W=nmf.fit_transform(X)
    W=W/(W.sum(axis=1,keepdims=True)+1e-12)
    terms=np.array(vec.get_feature_names_out())
    topics=[]
    for k, comp in enumerate(nmf.components_):
        top=terms[np.argsort(comp)[-10:][::-1]].tolist()
        topics.append({'topic':int(k),'terms':top})
    return W, topics, vec, nmf


def crossfit_expected(df: pd.DataFrame, W, feature_cols, folds=4, seed=27, context_fields=None, adjust_title_length=True):
    """Cross-fit expected detector rates by source groups, not in-source rows.

    Topic mixture plus coarse behaviour-neutral context predicts each detector.
    GroupKFold by source means a source's own headlines do not train the expectation
    used to residualise that source. This reduces in-sample absorption of real differences.
    """
    context_fields=context_fields or ['tree_root_id','neutral_editorial_context']
    context=df[context_fields].copy()
    for c in context.columns:
        context[c]=context[c].fillna('').replace('', 'uncurated').astype(str)
    enc = OneHotEncoder(handle_unknown='ignore')
    G = enc.fit_transform(context)
    numeric_parts=[]
    if adjust_title_length and 'word_count' in df:
        length=np.log1p(df['word_count'].astype(float).to_numpy()).reshape(-1,1)
        sd=length.std()
        if sd>1e-8: length=(length-length.mean())/sd
        numeric_parts.append(csr_matrix(length))
    Xctx = hstack([csr_matrix(W), *numeric_parts, G], format='csr')
    Y = df[feature_cols].to_numpy(dtype=float)
    expected = np.zeros_like(Y)
    groups = df['source_key'].astype(str).to_numpy()
    n_splits=max(2,min(int(folds),len(np.unique(groups))))
    splitter=GroupKFold(n_splits=n_splits)
    for train_ix,test_ix in splitter.split(Xctx,Y,groups):
        for j in range(Y.shape[1]):
            model=Ridge(alpha=8.0)
            model.fit(Xctx[train_ix],Y[train_ix,j])
            expected[test_ix,j]=np.clip(model.predict(Xctx[test_ix]),0.0,1.0)
    return expected


def normalised_title_for_match(title):
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', title.casefold())).strip()


def headline_reuse_proxy(df, n_neighbors=8, threshold=0.82):
    texts=[normalised_title_for_match(t) for t in df['headline'].tolist()]
    v=TfidfVectorizer(analyzer='char_wb', ngram_range=(3,5), min_df=2,
                      max_features=30000, sublinear_tf=True)
    X=v.fit_transform(texts)
    nn=NearestNeighbors(n_neighbors=min(n_neighbors,len(texts)), metric='cosine', algorithm='brute', n_jobs=-1)
    nn.fit(X)
    d, ix=nn.kneighbors(X)
    sources=df['source_key'].astype(str).to_numpy()
    max_cross=np.zeros(len(df),dtype=float)
    nearest_source=np.array(['']*len(df),dtype=object)
    nearest_title=np.array(['']*len(df),dtype=object)
    nearest_idx=np.full(len(df),-1,dtype=int)
    for i in range(len(df)):
        sims=1-d[i]
        candidates=[(float(sims[j]),int(k)) for j,k in enumerate(ix[i]) if k!=i and sources[k]!=sources[i]]
        best=max(candidates,default=(0.0,-1),key=lambda x:x[0])
        max_cross[i]=best[0]
        nearest_idx[i]=best[1]
        if best[1]>=0:
            nearest_source[i]=df.iloc[best[1]]['source']
            nearest_title[i]=df.iloc[best[1]]['headline']
    df['cross_source_title_similarity']=max_cross
    df['cross_source_near_duplicate_proxy']=(max_cross>=threshold).astype(int)
    df['cross_source_title_echo']=df['cross_source_near_duplicate_proxy']
    df['cross_source_nearest_source']=nearest_source
    df['cross_source_nearest_headline']=nearest_title
    return df


def add_within_source_template_proxy(df):
    stop=set(ENGLISH_STOP_WORDS)
    repeated=np.zeros(len(df),dtype=int)
    for source, positions in df.groupby('source_key',sort=False).indices.items():
        positions=np.asarray(positions)
        per_title=[]
        counts=Counter()
        for pos in positions:
            toks=re.findall(r"[a-z0-9]+", df.iloc[pos]['headline'].casefold())
            grams=[]
            for j in range(max(0,len(toks)-2)):
                gram=tuple(toks[j:j+3])
                if sum(w not in stop for w in gram)>=2:
                    grams.append(gram)
            per_title.append(set(grams))
            counts.update(set(grams))
        min_count=max(3,int(math.ceil(len(positions)*0.02)))
        common={g for g,c in counts.items() if c>=min_count}
        for pset,pos in zip(per_title,positions):
            repeated[pos]=int(bool(pset & common))
    df['within_source_repeated_trigram_proxy']=repeated
    return df


def source_phrase_signatures(df, out_path: Path, min_source_n=30, min_phrase_count=3, top_k=20):
    cv = CountVectorizer(stop_words='english', ngram_range=(2, 3), min_df=2,
                         max_features=50000, binary=True, strip_accents='unicode')
    X = cv.fit_transform(df['headline'].tolist()).tocsr()
    terms = np.asarray(cv.get_feature_names_out())
    global_counts = np.asarray(X.sum(axis=0)).ravel().astype(float)
    prior_total = 100.0
    alpha = (global_counts / max(global_counts.sum(), 1.0)) * prior_total + 1e-3
    alpha0 = float(alpha.sum())
    N = X.shape[0]
    rows = []
    for source, positions in df.groupby('source', sort=False).indices.items():
        positions = np.asarray(positions, dtype=int)
        n_s = len(positions)
        if n_s < min_source_n: continue
        source_counts = np.asarray(X[positions].sum(axis=0)).ravel().astype(float)
        other_counts = global_counts - source_counts
        n_o = N - n_s
        denom_s = np.maximum(n_s - source_counts + alpha0 - alpha, 1e-9)
        denom_o = np.maximum(n_o - other_counts + alpha0 - alpha, 1e-9)
        delta = np.log((source_counts + alpha) / denom_s) - np.log((other_counts + alpha) / denom_o)
        var = 1.0/(source_counts + alpha) + 1.0/denom_s + 1.0/(other_counts + alpha) + 1.0/denom_o
        z = delta / np.sqrt(var)
        eligible = np.where(source_counts >= min_phrase_count)[0]
        if len(eligible) == 0: continue
        top = eligible[np.argsort(z[eligible])[-top_k:][::-1]]
        for j in top:
            rows.append({'source': source, 'n_headlines': n_s, 'phrase': terms[j],
                         'source_doc_count': int(source_counts[j]),
                         'source_share': float(source_counts[j]/n_s),
                         'corpus_share': float(global_counts[j]/N),
                         'weighted_log_odds_z': float(z[j])})
    pd.DataFrame(rows).to_csv(out_path, index=False)

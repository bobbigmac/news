from pathlib import Path
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

OUT=Path(__file__).resolve().parent
r=pd.read_csv(OUT/'source_rankings.csv')
axes=[
('event_clarity_rate','Event/action'),('quantified_specificity_rate','Quantified detail'),
('time_place_anchor_rate','Time/place'),('causal_explanation_rate','Causal link'),
('material_consequence_rate','Consequences'),('evidence_provenance_rate','Evidence'),
('context_comparison_rate','Context'),('explanatory_framing_rate','Explanation'),
('original_reporting_signal_rate','Original access'),('cross_source_title_echo_rate','Title echo (lower better)'),
('curiosity_bait_incidence_rate','Curiosity bait (lower better)'),('sensational_personal_incidence_rate','Sensational/personal (lower better)')]

selected=['The Guardian','BBC','Daily Mail','Financial Times','Phys.org','Medical Xpress','Eurogamer','Kotaku']
fig=plt.figure(figsize=(13,12))
ax=fig.add_subplot(111,polar=True)
labels=[x[1] for x in axes]
angles=np.linspace(0,2*np.pi,len(labels),endpoint=False).tolist()
angles+=angles[:1]
for source in selected:
    q=r[r.source.eq(source)]
    if q.empty: continue
    q=q.iloc[0]
    vals=[float(q[c])*100 for c,_ in axes]
    vals+=vals[:1]
    ax.plot(angles,vals,linewidth=1.5,label=f"{source} (n={int(q.n)})")
    ax.fill(angles,vals,alpha=0.025)
ax.set_xticks(angles[:-1]); ax.set_xticklabels(labels,fontsize=8)
ax.set_ylim(0,100); ax.set_yticks([20,40,60,80,100]); ax.set_yticklabels(['20','40','60','80','100'],fontsize=7)
ax.set_title('Title-language profiles — selected publishers',pad=35,fontsize=14)
ax.legend(loc='upper left',bbox_to_anchor=(1.08,1.08),fontsize=8,frameon=False)
fig.text(0.5,0.02,'Axes are title occurrence rates. Title echo and the two attention-framing axes show adverse behaviour, so lower is better.',ha='center',fontsize=8)
fig.tight_layout(rect=[0,0.05,0.80,0.96])
fig.savefig(OUT/'publisher_radar_comparison.png',dpi=180,bbox_inches='tight')
plt.close(fig)

# Ranking chart for sources with >=100 headlines.
y=r[r.n>=100].sort_values('topic_adjusted_value_index',ascending=True)
fig,ax=plt.subplots(figsize=(10,7))
ax.barh(np.arange(len(y)),y['topic_adjusted_value_index'],xerr=[(y['topic_adjusted_value_index']-y['topic_adjusted_index_ci95_low']).clip(lower=0),(y['topic_adjusted_index_ci95_high']-y['topic_adjusted_value_index']).clip(lower=0)],capsize=2)
ax.set_yticks(np.arange(len(y))); ax.set_yticklabels([f"{s} (n={int(n)})" for s,n in zip(y.source,y.n)])
ax.axvline(50,linestyle='--',linewidth=1)
ax.set_xlim(35,70)
ax.set_xlabel('Topic + source-family adjusted title-signal index (50 = cohort baseline)')
ax.set_title('High-volume publisher ranking (at least 100 headlines)')
ax.grid(axis='x',alpha=.2)
fig.tight_layout()
fig.savefig(OUT/'high_volume_source_ranking.png',dpi=180,bbox_inches='tight')
plt.close(fig)

# Per-source story-signal distribution, separate from the source-average rank.
d=pd.read_csv(OUT/'source_story_score_distributions.csv')
selected=['The Guardian','BBC','Daily Mail','Financial Times','Phys.org','Medical Xpress','Eurogamer','Kotaku']
d=d[d.source.isin(selected)].copy().sort_values('topic_adjusted_value_index',ascending=False)
d['low']=d['delivery_share_le20']
d['high']=d['delivery_share_ge44']
d['middle']=(1-d['low']-d['high']).clip(0,1)
fig,ax=plt.subplots(figsize=(10,5.5))
ypos=np.arange(len(d))
ax.barh(ypos,d['low']*100,label='0–1 of 9 delivery markers' )
ax.barh(ypos,d['middle']*100,left=d['low']*100,label='2–3 of 9 delivery markers' )
ax.barh(ypos,d['high']*100,left=(d['low']+d['middle'])*100,label='4–9 of 9 delivery markers' )
ax.set_yticks(ypos); ax.set_yticklabels([f"{x} (n={int(n)})" for x,n in zip(d.source,d.n)])
ax.invert_yaxis(); ax.set_xlim(0,100)
ax.set_xlabel('Share of headlines (%)')
ax.set_title('Distribution of per-headline information-delivery signals')
ax.legend(loc='lower right',fontsize=8)
ax.grid(axis='x',alpha=.2)
fig.tight_layout()
fig.savefig(OUT/'story_signal_distribution.png',dpi=180,bbox_inches='tight')
plt.close(fig)

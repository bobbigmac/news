import { CAT_PREF_OPTIONS, saveInterestState, state, ui } from './state.js';
import { canonicalCategory } from './view-model.js';
import { getInterestStats, getTopSignalTags, removeTagFromSignals } from './signals.js';

export function renderChangelog(log) {
  const body = document.getElementById('changelog-body');
  const digest = state.digest;
  if (!digest) {
    body.innerHTML = '<div class="loading">No digest loaded.</div>';
    return;
  }

  const clusters = digest.clusters || [];
  const stories = clusters.flatMap(c => c.stories || []);

  // Dataset overview
  const sources = {};
  stories.forEach(s => { const name = s.sourceName || 'Unknown'; sources[name] = (sources[name]||0)+1; });
  const sourceList = Object.entries(sources).sort((a,b) => b[1]-a[1]);

  const cats = {};
  clusters.forEach(c => { const cat = canonicalCategory(c.category); cats[cat] = (cats[cat]||0)+1; });
  const catList = Object.entries(cats).sort((a,b) => b[1]-a[1]);

  const plugins = {};
  stories.forEach(s => { if (s.plugin) plugins[s.plugin] = (plugins[s.plugin]||0)+1; });
  const pluginList = Object.entries(plugins).sort((a,b) => b[1]-a[1]);

  // Freshness
  const pubDates = stories.map(s => s.published).filter(Boolean).map(d => { try { return new Date(d).getTime(); } catch { return 0; } }).filter(Boolean);
  const newestPub = pubDates.length ? Math.max(...pubDates) : null;
  const clusterDates = clusters.map(c => c.updated || c.created).filter(Boolean).map(d => { try { return new Date(d).getTime(); } catch { return 0; } }).filter(Boolean);
  const newestCluster = clusterDates.length ? Math.max(...clusterDates) : null;
  const oldestCluster = clusterDates.length ? Math.min(...clusterDates) : null;

  const fmtTime = (ts) => ts ? new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  const relTime = (ts) => {
    if (!ts) return '—';
    const diff = Date.now() - ts;
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return `${Math.floor(diff/60000)}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs/24)}d ago`;
  };

  let html = '<div class="changelog-overview">';

  // Freshness section
  html += '<div class="changelog-section"><h4>Dataset Freshness</h4>';
  html += `<div class="changelog-stats">`;
  html += `<div><span class="changelog-stat-label">Newest story</span><span class="changelog-stat-val">${fmtTime(newestPub)} <small>(${relTime(newestPub)})</small></span></div>`;
  html += `<div><span class="changelog-stat-label">Last summarised</span><span class="changelog-stat-val">${fmtTime(newestCluster)} <small>(${relTime(newestCluster)})</small></span></div>`;
  html += `<div><span class="changelog-stat-label">Oldest cluster</span><span class="changelog-stat-val">${fmtTime(oldestCluster)}</span></div>`;
  html += `<div><span class="changelog-stat-label">Total stories</span><span class="changelog-stat-val">${stories.length}</span></div>`;
  html += `<div><span class="changelog-stat-label">Total clusters</span><span class="changelog-stat-val">${clusters.length}</span></div>`;

  // Pipeline stats
  const ps = digest.pipelineStats;
  if (ps) {
    html += `<div><span class="changelog-stat-label">Stories in store</span><span class="changelog-stat-val">${ps.totalStories}</span></div>`;
    html += `<div><span class="changelog-stat-label">Summarised</span><span class="changelog-stat-val">${ps.summarised}</span></div>`;
    if (ps.unsummarised > 0) {
      html += `<div><span class="changelog-stat-label">Pending summary</span><span class="changelog-stat-val">${ps.unsummarised}</span></div>`;
    }
  }

  html += `</div></div>`;

  // Sources section
  html += '<div class="changelog-section"><h4>Sources</h4>';
  html += '<div class="changelog-tags">';
  html += sourceList.map(([name, count]) => `<span class="changelog-tag">${name} <small>${count}</small></span>`).join('');
  html += '</div></div>';

  // Categories section
  html += '<div class="changelog-section"><h4>Categories</h4>';
  html += '<div class="changelog-tags">';
  html += catList.map(([name, count]) => `<span class="changelog-tag">${name} <small>${count}</small></span>`).join('');
  html += '</div></div>';

  // Plugins section (if any)
  if (pluginList.length) {
    html += '<div class="changelog-section"><h4>Search Plugins</h4>';
    html += '<div class="changelog-tags">';
    html += pluginList.map(([name, count]) => `<span class="changelog-tag">${name} <small>${count}</small></span>`).join('');
    html += '</div></div>';
  }

  // Your Algorithm panel
  const stats = getInterestStats();
  const hasSignals = stats.total > 0;
  const hasCatPrefs = Object.values(state.catPrefs).some(v => v && v !== 'normal');

  if (hasSignals || hasCatPrefs) {
    html += '<div class="changelog-section"><h4>Your Algorithm</h4>';

    // Category preferences
    if (hasCatPrefs) {
      html += '<div class="changelog-subsection"><small>Category preferences</small>';
      const prefOrder = ['favour', 'demote', 'hide'];
      for (const pref of prefOrder) {
        const cats = Object.entries(state.catPrefs).filter(([_, v]) => v === pref).map(([k]) => k);
        if (cats.length) {
          const prefLabel = CAT_PREF_OPTIONS.find(o => o.value === pref)?.label || pref;
          html += `<div class="algo-pref-row"><span class="algo-pref-label">${prefLabel}</span> ${cats.map(c => `<span class="changelog-tag">${c}</span>`).join(' ')}</div>`;
        }
      }
      html += '</div>';
    }

    // Interest profile — derived tags, not raw signals
    if (hasSignals) {
      html += '<div class="changelog-subsection"><small>Your interest profile</small>';

      const posTags = getTopSignalTags('interested', 15);
      const negTags = getTopSignalTags('not-interested', 15);

      if (posTags.length) {
        html += '<div class="algo-profile-group">';
        html += `<div class="algo-profile-label">✓ You seem interested in</div>`;
        html += '<div class="algo-profile-tags">';
        html += posTags.map(([t, c]) => `<span class="changelog-tag algo-tag-pos algo-tag-removable" data-tag="${t}" data-signal="interested">${t} <small>${c}</small><button class="algo-tag-remove" title="Remove">&times;</button></span>`).join(' ');
        html += '</div></div>';
      }

      if (negTags.length) {
        html += '<div class="algo-profile-group">';
        html += `<div class="algo-profile-label">✕ You seem uninterested in</div>`;
        html += '<div class="algo-profile-tags">';
        html += negTags.map(([t, c]) => `<span class="changelog-tag algo-tag-neg algo-tag-removable" data-tag="${t}" data-signal="not-interested">${t} <small>${c}</small><button class="algo-tag-remove" title="Remove">&times;</button></span>`).join(' ');
        html += '</div></div>';
      }

      if (!posTags.length && !negTags.length) {
        html += '<div class="loading">No tags extracted yet. Signal a few stories to build your profile.</div>';
      }

      html += '</div>';
    }

    html += '</div>';
  }

  html += '</div>'; // end overview

  // Run history
  html += '<div class="changelog-section"><h4>Run History</h4>';
  if (!log || !log.length) {
    html += '<div class="loading">The summariser has never been run. No digest history available.</div>';
  } else {
    html += log.map(entry => {
      const date = new Date(entry.timestamp);
      const time = date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const parts = [];
      if (entry.skipped) {
        parts.push('No new stories — cache only');
      } else {
        if (entry.storiesAdded) parts.push(`+${entry.storiesAdded} stories`);
        if (entry.clustersCreated) parts.push(`${entry.clustersCreated} new clusters`);
        if (entry.clustersUpdated) parts.push(`${entry.clustersUpdated} updated`);
        if (entry.storiesProcessed) parts.push(`${entry.storiesProcessed} processed`);
        if (entry.chunksFailed > 0) parts.push(`${entry.chunksFailed} chunks failed`);
      }
      parts.push(`${entry.totalClusters} total clusters`);

      const metaParts = [];
      if (entry.provider && entry.provider !== 'unknown') metaParts.push(entry.provider);
      if (entry.model && entry.model !== 'unknown') metaParts.push(entry.model);

      return `<div class="changelog-entry">
        <div class="changelog-time">${time}</div>
        <div class="changelog-details">${parts.join(' · ')}</div>
        ${metaParts.length ? `<div class="changelog-meta">${metaParts.join(' / ')}</div>` : ''}
      </div>`;
    }).join('');
  }
  html += '</div>';

  body.innerHTML = html;
}

export function attachAlgoListeners() {
  const body = document.getElementById('changelog-body');

  // Tag removal — strips a tag from all signals of that type
  body.querySelectorAll('.algo-tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tag = btn.closest('.algo-tag-removable')?.dataset.tag;
      const signalType = btn.closest('.algo-tag-removable')?.dataset.signal;
      if (!tag || !signalType) return;
      removeTagFromSignals(tag, signalType);
      // Re-render the changelog and digest
      const log = window._lastLog || [];
      renderChangelog(log);
      attachAlgoListeners();
      ui.refresh();
    });
  });

  // Signal removal (individual cluster signals)
  body.querySelectorAll('.algo-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.algo-signal-item');
      if (!item) return;
      const clusterId = item.dataset.clusterId;
      if (clusterId && state.interestState[clusterId]) {
        delete state.interestState[clusterId];
        saveInterestState();
        const log = window._lastLog || [];
        renderChangelog(log);
        attachAlgoListeners();
        ui.refresh();
      }
    });
  });
}

import { getFaviconSpriteClass } from './favicon-sprite.js';
import MEASURED_SOURCES from './data/measured-sources.json' with { type: 'json' };
import { axisNames, renderSpiderweb } from './measured-spiderweb.js';
import { FILTER_GROUPS, sourceMatchesGroup } from './measured-filters.js';

const axes = MEASURED_SOURCES.axes;
const axisByKey = new Map(axes.map(axis => [axis.key, axis]));



function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderSourceIcon(container, key) {
  const spriteClass = getFaviconSpriteClass(key);
  if (spriteClass) {
    container.appendChild(el('span', `source-sprite ${spriteClass}`));
    return;
  }
  container.appendChild(el('span', 'measured-letter', (key || '?').charAt(0).toUpperCase()));
}

function appendProfile(container, source) {
  const profile = source.profile || {};
  const rows = [
    ['Type', profile.kind],
    ['Ownership', profile.ownership],
    ['Model', profile.model],
    ['Editorial context', profile.leaning],
  ].filter(([, value]) => value);
  if (!rows.length && source.family) rows.push(['Family', source.family]);
  for (const [label, value] of rows) {
    const row = el('p', 'measured-profile-row');
    row.appendChild(el('strong', '', `${label}: `));
    row.appendChild(document.createTextNode(value));
    container.appendChild(row);
  }
}

function appendAssessments(container, source) {
  if (!source.assessments?.length) return;
  const wrap = el('div', 'measured-assessments');
  wrap.appendChild(el('strong', '', 'External assessments'));
  const list = el('ul');
  for (const assessment of source.assessments) {
    const item = el('li');
    const subject = assessment.subject ? ` (${assessment.subject})` : '';
    const factual = assessment.factual_reporting ? `; factual: ${assessment.factual_reporting}` : '';
    item.appendChild(document.createTextNode(`${assessment.rater}: ${assessment.rating}${subject}${factual}`));
    if (assessment.type === 'republished political-leaning index') {
      const tag = el('span', 'assessment-tag', 'republished index');
      tag.title = 'MediaBias.News republishes other raters’ verdicts; it is not an independent rating.';
      item.appendChild(tag);
    }
    if (assessment.note) {
      const note = el('span', 'assessment-note', ` — ${assessment.note}`);
      item.appendChild(note);
    }
    if (assessment.url) {
      const link = el('a', 'assessment-source', 'source');
      link.href = assessment.url;
      link.target = '_blank';
      link.rel = 'noopener';
      item.appendChild(link);
    }
    list.appendChild(item);
  }
  wrap.appendChild(list);
  container.appendChild(wrap);
}

function renderScoreUncertainty(container, source) {
  if (!source.measuredQualityCi95) return;
  const wrap = el('div', 'score-uncertainty');
  const line = el('p', 'axis-reading-line');
  line.appendChild(el('strong', '', 'Sampling range: '));
  line.appendChild(document.createTextNode(`${source.measuredQualityCi95[0].toFixed(1)}–${source.measuredQualityCi95[1].toFixed(1)} at 95% headline-resampling uncertainty`));
  wrap.appendChild(line);
  if (Number.isFinite(source.measuredQualityAdjustedPoints)) {
    const raw = el('p', 'axis-reading-line');
    raw.appendChild(el('strong', '', 'Underlying adjusted difference: '));
    raw.appendChild(document.createTextNode(`${source.measuredQualityAdjustedPoints >= 0 ? '+' : ''}${source.measuredQualityAdjustedPoints.toFixed(1)} percentage points`));
    wrap.appendChild(raw);
  }
  container.appendChild(wrap);
}

function renderAxisReading(container, source) {
  const strongest = source.strongestAxes || [];
  const weakest = [...(source.weakestAxes || [])].reverse();
  const wrap = el('div', 'axis-reading');
  const strong = el('p', 'axis-reading-line');
  strong.appendChild(el('strong', '', 'Strongest measured traits: '));
  strong.appendChild(document.createTextNode(axisNames(strongest, source, axisByKey)));
  const weak = el('p', 'axis-reading-line');
  weak.appendChild(el('strong', '', 'Comparatively weaker traits: '));
  weak.appendChild(document.createTextNode(axisNames(weakest, source, axisByKey)));
  wrap.appendChild(strong);
  wrap.appendChild(weak);
  container.appendChild(wrap);
}

function renderMeasurementNotes(container, source) {
  const notes = [...(source.notes || [])];
  if ((source.diagnostics?.titleEchoRate || 0) >= 0.15) {
    notes.push('A substantial share of these headlines closely match wording seen elsewhere. That can reflect syndication, shared ownership or copied headlines rather than independent original writing.');
  }
  if (!notes.length) return;
  const box = el('div', 'measurement-notes');
  box.appendChild(el('h4', '', 'Measurement notes'));
  for (const note of notes) box.appendChild(el('p', '', note));
  container.appendChild(box);
}

function renderSourceDetail(card, source) {
  if (card.dataset.rendered === 'true') return;
  card.dataset.rendered = 'true';
  const detail = el('div', 'measured-detail');
  const webColumn = el('div', 'spider-column');
  webColumn.appendChild(renderSpiderweb(source, axes));
  renderMeasurementNotes(webColumn, source);

  const reading = el('div', 'source-reading');
  appendProfile(reading, source);
  appendAssessments(reading, source);
  if (source.members?.length > 1) {
    const members = el('p', 'measured-profile-row');
    members.appendChild(el('strong', '', 'Measured together: '));
    members.appendChild(document.createTextNode(source.members.map(member => member.label).join(' · ')));
    reading.appendChild(members);
  }
  renderScoreUncertainty(reading, source);
  renderAxisReading(reading, source);
  const actions = el('div', 'measured-actions');
  const rel = el('a', 'measured-link', 'Ownership and source context');
  rel.href = source.relationshipsUrl || './relationships.html';
  actions.appendChild(rel);
  reading.appendChild(actions);

  detail.appendChild(webColumn);
  detail.appendChild(reading);
  card.appendChild(detail);
}

function usefulFamilyLabel(source) {
  const normalise = value => String(value || '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '');
  if (!source.family || source.family === 'Unmatched sources') return '';
  return normalise(source.family) === normalise(source.label) ? '' : source.family;
}

function renderSourceCard(source) {
  const card = el('details', 'measured-source-card');
  card.dataset.band = source.band;
  card.dataset.search = [
    source.label,
    source.key,
    source.family,
    source.treeRoot,
    ...(source.memberLabels || []),
    ...(source.notes || []),
  ].join(' ').toLowerCase();
  card.dataset.groups = (groupBySourceKey.get(source.key) || []).join(' ');

  const summary = el('summary', 'measured-card-head');
  summary.appendChild(el('span', 'measured-rank', `#${source.rank}`));
  renderSourceIcon(summary, source.iconKey || source.key);
  const title = el('div', 'measured-title');
  title.appendChild(el('h3', '', source.label));
  const subtitleParts = [];
  const family = usefulFamilyLabel(source);
  if (family) subtitleParts.push(family);
  if (source.grouped && source.members?.length > 1) subtitleParts.push(`${source.members.length} measured together`);
  subtitleParts.push(`${source.headlines} headlines`);
  if (source.stableSample === false) subtitleParts.push('small sample — unstable');
  else if (source.headlines < 50) subtitleParts.push('small sample');
  title.appendChild(el('p', 'measured-subtitle', subtitleParts.join(' · ')));
  summary.appendChild(title);
  summary.appendChild(el('span', `band-chip band-${source.band}`, source.bandLabel.replace(' measured headline value', '')));
  const score = el('span', 'measured-score');
  score.appendChild(el('strong', '', source.measuredQuality.toFixed(1)));
  score.appendChild(el('small', '', 'measured quality'));
  summary.appendChild(score);
  card.appendChild(summary);
  card.addEventListener('toggle', () => {
    if (card.open) renderSourceDetail(card, source);
  });
  return card;
}

function renderSection(main, { key, label, summary, sources }) {
  if (!sources.length) return;
  const section = el('section', 'measurement-band');
  section.dataset.band = key;
  const head = el('header', 'band-head');
  const titleWrap = el('div');
  const title = el('h2', '', label);
  const scores = sources.map(source => source.measuredQuality);
  title.appendChild(el('span', 'band-range', `${Math.min(...scores).toFixed(2)}–${Math.max(...scores).toFixed(2)}`));
  titleWrap.appendChild(title);
  titleWrap.appendChild(el('p', '', summary));
  head.appendChild(titleWrap);
  head.appendChild(el('span', 'band-count', `${sources.length} sources`));
  section.appendChild(head);
  const list = el('div', 'measured-source-list');
  for (const source of sources) {
    list.appendChild(renderSourceCard(source));
  }
  section.appendChild(list);
  main.appendChild(section);
}

function render() {
  const main = document.getElementById('measured-main');
  main.textContent = '';
  const ordered = [...MEASURED_SOURCES.sources].sort((a, b) => a.rank - b.rank);
  const edge = Math.min(20, Math.floor(ordered.length / 2));
  const top = ordered.slice(0, edge);
  const bottom = ordered.slice(ordered.length - edge);
  const middle = ordered.slice(edge, ordered.length - edge);
  renderSection(main, {
    key: 'top-twenty',
    label: 'Top twenty measured headline value',
    summary: 'The highest-scoring sources in the corpus ordering: headlines most often combine concrete information with comparatively restrained packaging.',
    sources: top,
  });
  renderSection(main, {
    key: 'middle',
    label: 'Middle of the measured ordering',
    summary: 'Every other measured source with enough pooled headlines to score, in score order. Small samples are marked and carry wider uncertainty intervals in their detail view.',
    sources: middle,
  });
  renderSection(main, {
    key: 'bottom-twenty',
    label: 'Bottom twenty measured headline value',
    summary: 'The lowest-scoring sources in the corpus ordering: headlines comparatively thin on concrete information, heavier on attention packaging, or both.',
    sources: bottom,
  });
  renderUnmeasurable(main);
}

// Feeds below roughly 80% English-language headlines cannot be fairly scored by the
// English-only pipeline. They are listed without any quality claim — no score, no rank.
function renderUnmeasurable(main) {
  const sources = MEASURED_SOURCES.unmeasurableSources || [];
  if (!sources.length) return;
  const section = el('section', 'measurement-band unmeasurable-band');
  section.dataset.band = 'unmeasurable';
  const head = el('header', 'band-head');
  const titleWrap = el('div');
  titleWrap.appendChild(el('h2', '', 'Available in the digest, but not measurable'));
  titleWrap.appendChild(el('p', '', 'These sources cannot be fairly compared by this measurement: most publish in languages other than English, which the pipeline cannot reliably score, and some are structured notice or listing services rather than editorial headline writing. No quality claim is made about any of them.'));
  head.appendChild(titleWrap);
  head.appendChild(el('span', 'band-count', `${sources.length} sources`));
  section.appendChild(head);
  const list = el('div', 'unmeasurable-list');
  for (const source of sources) {
    const item = el('div', 'unmeasurable-item');
    item.dataset.search = `${source.label} ${source.key} ${source.family || ''}`.toLowerCase();
    const name = el('span', 'unmeasurable-name', source.label);
    const meta = el('span', 'unmeasurable-meta', `${source.headlines} headlines · not measured`);
    item.appendChild(name);
    if (source.note) item.appendChild(el('span', 'unmeasurable-note', source.note));
    item.appendChild(meta);
    if (source.relationshipsUrl) {
      const link = el('a', 'unmeasurable-rel', 'relationships');
      link.href = source.relationshipsUrl;
      item.appendChild(link);
    }
    list.appendChild(item);
  }
  section.appendChild(list);
  main.appendChild(section);
}

let activeFilter = 'all';
const groupBySourceKey = new Map();
for (const source of MEASURED_SOURCES.sources) {
  const groups = FILTER_GROUPS.filter(group => sourceMatchesGroup(source, group)).map(group => group.key);
  groupBySourceKey.set(source.key, groups);
}

function applyVisibility() {
  const query = (document.getElementById('measured-search')?.value || '').trim().toLowerCase();
  for (const card of document.querySelectorAll('.measured-source-card')) {
    const matchesQuery = !query || card.dataset.search.includes(query);
    const matchesFilter = activeFilter === 'all' || card.dataset.groups?.split(' ').includes(activeFilter);
    card.classList.toggle('is-hidden', !(matchesQuery && matchesFilter));
  }
  for (const section of document.querySelectorAll('.measurement-band')) {
    const visible = [...section.querySelectorAll('.measured-source-card')].some(card => !card.classList.contains('is-hidden'));
    section.classList.toggle('is-hidden', !visible);
  }
}

function renderFilters() {
  const nav = document.getElementById('measured-filters');
  if (!nav) return;
  const counts = new Map();
  for (const groups of groupBySourceKey.values()) {
    for (const key of groups) counts.set(key, (counts.get(key) || 0) + 1);
  }
  const chips = [{ key: 'all', label: `All ${MEASURED_SOURCES.sources.length} measured sources` }];
  for (const group of FILTER_GROUPS) {
    const count = counts.get(group.key) || 0;
    if (!count) continue;
    chips.push({ key: group.key, label: `${group.label} ${count}` });
  }
  for (const chip of chips) {
    const btn = el('button', 'measured-filter-chip', chip.label);
    btn.type = 'button';
    btn.dataset.filter = chip.key;
    btn.setAttribute('aria-pressed', chip.key === activeFilter ? 'true' : 'false');
    btn.addEventListener('click', () => {
      activeFilter = activeFilter === chip.key ? 'all' : chip.key;
      for (const other of nav.querySelectorAll('.measured-filter-chip')) {
        other.setAttribute('aria-pressed', other.dataset.filter === activeFilter ? 'true' : 'false');
      }
      applyVisibility();
    });
    nav.appendChild(btn);
  }
}

function bindSearch() {
  const input = document.getElementById('measured-search');
  input.addEventListener('input', applyVisibility);
}

render();
renderFilters();
bindSearch();

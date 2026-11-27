import { getFaviconSpriteClass } from './favicon-sprite.js';
import MEASURED_SOURCES from './data/measured-sources.json' with { type: 'json' };

const SVG_NS = 'http://www.w3.org/2000/svg';
const axes = MEASURED_SOURCES.axes;
const axisByKey = new Map(axes.map(axis => [axis.key, axis]));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
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

function polar(cx, cy, radius, angleDegrees) {
  const angle = (angleDegrees - 90) * Math.PI / 180;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function polygonPoints(count, cx, cy, radius) {
  const points = [];
  for (let i = 0; i < count; i++) points.push(polar(cx, cy, radius, i * 360 / count).join(','));
  return points.join(' ');
}

function renderSpiderweb(source) {
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 126;
  const labelRadius = 154;
  const svg = svgEl('svg', {
    viewBox: `0 0 ${size} ${size}`,
    class: 'spiderweb',
    role: 'img',
    'aria-label': `${source.label} measured headline-trait spiderweb`,
  });

  for (const ring of [20, 35, 50, 65, 80, 95]) {
    svg.appendChild(svgEl('polygon', {
      points: polygonPoints(axes.length, cx, cy, maxRadius * ring / 100),
      class: ring === 50 ? 'spider-ring spider-ring-mid' : 'spider-ring',
    }));
  }

  axes.forEach((axis, index) => {
    const angle = index * 360 / axes.length;
    const [x, y] = polar(cx, cy, maxRadius, angle);
    svg.appendChild(svgEl('line', {
      x1: cx, y1: cy, x2: x, y2: y,
      class: 'spider-spoke',
    }));

    const [lx, ly] = polar(cx, cy, labelRadius, angle);
    const anchor = lx > cx + 24 ? 'start' : lx < cx - 24 ? 'end' : 'middle';
    const label = svgEl('text', {
      x: lx,
      y: ly,
      'text-anchor': anchor,
      class: 'spider-label',
    });
    label.textContent = axis.shortLabel;
    const title = svgEl('title');
    title.textContent = `${axis.label}: ${source.axes[axis.key].score}`;
    label.appendChild(title);
    svg.appendChild(label);
  });

  const valuePoints = axes.map((axis, index) => {
    const score = Math.max(0, Math.min(100, source.axes[axis.key].score));
    return polar(cx, cy, maxRadius * score / 100, index * 360 / axes.length).join(',');
  }).join(' ');
  svg.appendChild(svgEl('polygon', {
    points: valuePoints,
    class: 'spider-value',
  }));

  axes.forEach((axis, index) => {
    const score = Math.max(0, Math.min(100, source.axes[axis.key].score));
    const [x, y] = polar(cx, cy, maxRadius * score / 100, index * 360 / axes.length);
    const point = svgEl('circle', {
      cx: x, cy: y, r: 3.2,
      class: 'spider-point',
    });
    const title = svgEl('title');
    title.textContent = `${axis.label}: ${source.axes[axis.key].score}`;
    point.appendChild(title);
    svg.appendChild(point);
  });

  return svg;
}

function axisNames(keys) {
  return keys.map(key => axisByKey.get(key)?.label || key).join(', ');
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

function renderAxisReading(container, source) {
  const strongest = source.strongestAxes || [];
  const weakest = [...(source.weakestAxes || [])].reverse();
  const wrap = el('div', 'axis-reading');
  const strong = el('p', 'axis-reading-line');
  strong.appendChild(el('strong', '', 'Strongest measured traits: '));
  strong.appendChild(document.createTextNode(axisNames(strongest)));
  const weak = el('p', 'axis-reading-line');
  weak.appendChild(el('strong', '', 'Comparatively weaker traits: '));
  weak.appendChild(document.createTextNode(axisNames(weakest)));
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
  webColumn.appendChild(renderSpiderweb(source));
  renderMeasurementNotes(webColumn, source);

  const reading = el('div', 'source-reading');
  appendProfile(reading, source);
  if (source.members?.length > 1) {
    const members = el('p', 'measured-profile-row');
    members.appendChild(el('strong', '', 'Measured together: '));
    members.appendChild(document.createTextNode(source.members.map(member => member.label).join(' · ')));
    reading.appendChild(members);
  }
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

function render() {
  const main = document.getElementById('measured-main');
  main.textContent = '';
  for (const band of MEASURED_SOURCES.bands) {
    const section = el('section', 'measurement-band');
    section.dataset.band = band.key;
    const head = el('header', 'band-head');
    const titleWrap = el('div');
    const title = el('h2', '', band.label);
    title.appendChild(el('span', 'band-range', band.rangeText));
    titleWrap.appendChild(title);
    titleWrap.appendChild(el('p', '', band.summary));
    head.appendChild(titleWrap);
    head.appendChild(el('span', 'band-count', `${band.sourceCount} sources`));
    section.appendChild(head);
    const list = el('div', 'measured-source-list');
    for (const source of MEASURED_SOURCES.sources.filter(item => item.band === band.key)) {
      list.appendChild(renderSourceCard(source));
    }
    section.appendChild(list);
    main.appendChild(section);
  }
}

function bindSearch() {
  const input = document.getElementById('measured-search');
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    for (const card of document.querySelectorAll('.measured-source-card')) {
      card.classList.toggle('is-hidden', query && !card.dataset.search.includes(query));
    }
    for (const section of document.querySelectorAll('.measurement-band')) {
      const visible = [...section.querySelectorAll('.measured-source-card')].some(card => !card.classList.contains('is-hidden'));
      section.classList.toggle('is-hidden', Boolean(query) && !visible);
    }
  });
}

render();
bindSearch();

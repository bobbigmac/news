const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
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

function axisTooltip(axis, source) {
  const value = source.axes[axis.key];
  const points = Number.isFinite(value.adjustedPoints)
    ? ` Adjusted difference: ${value.adjustedPoints >= 0 ? '+' : ''}${value.adjustedPoints.toFixed(1)} percentage points.`
    : '';
  return `${axis.label}: ${value.score} corpus-relative.${points} ${axis.description}`;
}

export function renderSpiderweb(source, axes) {
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
    title.textContent = axisTooltip(axis, source);
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
    title.textContent = axisTooltip(axis, source);
    point.appendChild(title);
    svg.appendChild(point);
  });

  return svg;
}

export function axisNames(keys, source, axisByKey) {
  return keys.map(key => {
    const label = axisByKey.get(key)?.label || key;
    const points = source?.axes?.[key]?.adjustedPoints;
    if (!Number.isFinite(points)) return label;
    return `${label} (${points >= 0 ? '+' : ''}${points.toFixed(1)}pp)`;
  }).join(', ');
}

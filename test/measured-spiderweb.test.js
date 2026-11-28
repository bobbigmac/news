import { readFileSync } from 'fs';
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { axisNames, renderSpiderweb } from '../src/measured-spiderweb.js';

const data = JSON.parse(readFileSync('src/data/measured-sources.json', 'utf8'));

describe('measured spiderweb rendering', () => {
  it('renders one spoke, point and label per measured axis', () => {
    const source = data.sources[0];
    const svg = renderSpiderweb(source, data.axes);
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.querySelectorAll('line.spider-spoke')).toHaveLength(data.axes.length);
    expect(svg.querySelectorAll('circle.spider-point')).toHaveLength(data.axes.length);
    expect(svg.querySelectorAll('text.spider-label')).toHaveLength(data.axes.length);
    const polygon = svg.querySelector('polygon.spider-value');
    expect(polygon).toBeTruthy();
    expect(polygon.getAttribute('points').trim().split(/\s+/)).toHaveLength(data.axes.length);
  });

  it('keeps spiderweb geometry inside the view box for every measured source', () => {
    for (const source of data.sources) {
      const svg = renderSpiderweb(source, data.axes);
      for (const point of svg.querySelectorAll('circle.spider-point')) {
        const cx = Number(point.getAttribute('cx'));
        const cy = Number(point.getAttribute('cy'));
        expect(Number.isFinite(cx), source.label).toBe(true);
        expect(Number.isFinite(cy), source.label).toBe(true);
        expect(cx).toBeGreaterThanOrEqual(0);
        expect(cx).toBeLessThanOrEqual(420);
        expect(cy).toBeGreaterThanOrEqual(0);
        expect(cy).toBeLessThanOrEqual(420);
      }
    }
  });

  it('names strongest and weakest axes for card summaries', () => {
    const source = data.sources[0];
    const axisByKey = new Map(data.axes.map(axis => [axis.key, axis]));
    const keys = Object.keys(source.axes);
    const label = axisNames(keys.slice(0, 2), source, axisByKey);
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });
});

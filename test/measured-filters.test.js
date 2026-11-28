import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { FILTER_GROUPS, sourceMatchesGroup } from '../src/measured-filters.js';

const data = JSON.parse(readFileSync('src/data/measured-sources.json', 'utf8'));

describe('measured-source interest filters', () => {
  it('offers a reader-scale set of sector/type filters', () => {
    expect(FILTER_GROUPS.length).toBeGreaterThanOrEqual(12);
    expect(FILTER_GROUPS.length).toBeLessThanOrEqual(20);
    expect(new Set(FILTER_GROUPS.map(group => group.key)).size).toBe(FILTER_GROUPS.length);
    for (const group of FILTER_GROUPS) {
      expect(group.label).toBeTruthy();
    }
  });

  it('puts every measured source in at least one group', () => {
    const uncovered = [];
    for (const source of data.sources) {
      if (!FILTER_GROUPS.some(group => sourceMatchesGroup(source, group))) {
        uncovered.push(source.key);
      }
    }
    expect(uncovered).toEqual([]);
  });

  it('gives every group at least two members so comparisons are meaningful', () => {
    for (const group of FILTER_GROUPS) {
      const count = data.sources.filter(source => sourceMatchesGroup(source, group)).length;
      expect(count, `${group.key} members`).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps sector groups selective rather than swallowing the corpus', () => {
    for (const group of FILTER_GROUPS) {
      const count = data.sources.filter(source => sourceMatchesGroup(source, group)).length;
      expect(count, `${group.key} should not cover most of the corpus`).toBeLessThan(data.sources.length * 0.6);
    }
  });

  it('places the expected flagship sources in the reader-facing groups', () => {
    const byKey = new Map(data.sources.map(source => [source.key, source]));
    const inGroup = (key, groupKey) => {
      const group = FILTER_GROUPS.find(item => item.key === groupKey);
      return sourceMatchesGroup(byKey.get(key), group);
    };
    expect(inGroup('bbc.co.uk', 'broadcasters')).toBe(true);
    expect(inGroup('theguardian.com', 'uk-nationals')).toBe(true);
    expect(inGroup('eurogamer.net', 'games')).toBe(true);
    expect(inGroup('kotaku.com', 'games')).toBe(true);
    expect(inGroup('ign.com', 'games')).toBe(true);
    expect(inGroup('nytimes.com', 'us-nationals')).toBe(true);
    expect(inGroup('bbc.co.uk', 'high-volume')).toBe(true);
    expect(inGroup('nytimes.com', 'high-volume')).toBe(false);
    expect(inGroup('bbc.co.uk', 'games')).toBe(false);
    expect(inGroup('kotaku.com', 'broadcasters')).toBe(false);
  });
});

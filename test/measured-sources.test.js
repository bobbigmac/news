import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const data = JSON.parse(readFileSync('src/data/measured-sources.json', 'utf8'));
const page = readFileSync('src/measured-sources.html', 'utf8');

describe('measured source export', () => {
  it('has the schema needed by the measured-sources client', () => {
    expect(data.version).toBe(1);
    expect(data.measurementLabel).toBe('Measured headline value');
    expect(data.summary.sourceCount).toBe(data.sources.length);
    expect(data.bands).toHaveLength(4);
    expect(data.axes).toHaveLength(11);
    expect(new Set(data.axes.map(axis => axis.key)).size).toBe(11);
    for (const band of data.bands) {
      expect(band.sourceCount).toBeGreaterThan(0);
      expect(Number.isFinite(band.min)).toBe(true);
      expect(Number.isFinite(band.max)).toBe(true);
    }
  });

  it('keeps every measured axis bounded and sorts sources by measured quality', () => {
    for (let i = 1; i < data.sources.length; i++) {
      expect(data.sources[i - 1].measuredQuality).toBeGreaterThanOrEqual(data.sources[i].measuredQuality);
    }
    for (const source of data.sources) {
      expect(source.headlines).toBeGreaterThanOrEqual(data.minimumHeadlines);
      expect(source.rank).toBeGreaterThan(0);
      expect(data.bands.map(band => band.key)).toContain(source.band);
      expect(source.strongestAxes).toHaveLength(3);
      expect(source.weakestAxes).toHaveLength(3);
      for (const axis of data.axes) {
        const value = source.axes[axis.key];
        expect(value, `${source.key}.${axis.key}`).toBeTruthy();
        expect(value.score).toBeGreaterThanOrEqual(0);
        expect(value.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('uses canonical source keys unless several publisher sections are deliberately combined', () => {
    const byKey = new Map(data.sources.map(source => [source.key, source]));
    expect(byKey.has('bbc.co.uk')).toBe(true);
    expect(byKey.has('group-bbc')).toBe(false);
    expect(byKey.get('group-mashable')?.members.length).toBeGreaterThan(1);
    expect(byKey.get('group-philippine-inquirer')?.members.length).toBeGreaterThan(1);
    expect(byKey.get('group-philippine-inquirer')?.members.map(member => member.key)).not.toContain('inquirer.com');
    expect(byKey.get('group-nypost-pagesix')?.members.length).toBeGreaterThan(1);
    expect(data.sourceIndex['in.mashable.com']).toBe('group-mashable');
    expect(data.sourceIndex['pagesix.com']).toBe('group-nypost-pagesix');
    expect(data.sourceIndex['bbc.co.uk']).toBe('bbc.co.uk');
    expect(byKey.get('indianexpress.com')?.label).toBe('The Indian Express');
    expect(byKey.get('seekingalpha.com')?.label).toBe('Seeking Alpha');
    expect([...byKey.keys()].some(key => key.includes('fox'))).toBe(false);
    for (const source of data.sources) {
      expect(source.relationshipsUrl, source.key).toContain('#rel-');
      expect(source.family, source.key).not.toBe('Unmatched sources');
    }
  });

  it('carries source-specific measurement notes for known structural cases', () => {
    const byKey = new Map(data.sources.map(source => [source.key, source]));
    expect(byKey.get('medicalxpress.com')?.notes.join(' ')).toMatch(/research-release/i);
    expect(byKey.get('nature.com')?.notes.join(' ')).toMatch(/journal article titles/i);
    expect(byKey.get('newscientist.com')?.notes.join(' ')).toMatch(/study finds/i);
    expect(byKey.get('handelsblatt.com')?.notes.join(' ')).toMatch(/German-language/i);
    expect(byKey.get('group-mashable')?.notes.join(' ')).toMatch(/Regional Mashable editions/i);
  });
});

describe('measured sources page wiring', () => {
  it('is a peer to relationships in navigation and build inputs', () => {
    const vite = readFileSync('vite.config.js', 'utf8');
    const index = readFileSync('src/index.html', 'utf8');
    const relationships = readFileSync('src/relationships.html', 'utf8');
    expect(vite).toContain('measured-sources.html');
    expect(index).toContain('./measured-sources.html');
    expect(relationships).toContain('./measured-sources.html');
    expect(page).toContain('./relationships.html');
  });

  it('keeps the methodology and known limits at the end of the page', () => {
    expect(page.indexOf('id="measured-main"')).toBeLessThan(page.indexOf('id="methodology"'));
    expect(page.indexOf('What “measured quality” means here')).toBeGreaterThan(page.indexOf('id="measured-main"'));
    expect(page.indexOf('Known limits and coverage gaps')).toBeGreaterThan(page.indexOf('What “measured quality” means here'));
    expect(page).toContain('./measured-sources.json');
  });

  it('copies the machine-readable export beside the built pages', () => {
    expect(readFileSync('scripts/build.js', 'utf8')).toContain("measured-sources.json");
  });
});

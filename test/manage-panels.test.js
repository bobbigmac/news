import { readFileSync } from 'fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderCategoryPrefs, renderSourcePrefs } from '../src/settings.js';
import { state } from '../src/state.js';

function story(id, url, title = id) {
  return {
    id,
    title,
    url,
    sourceName: 'Example',
    published: new Date().toISOString(),
  };
}

function cluster(id, category, stories) {
  return { id, category, stories, headline: id, summary: id };
}

function cssBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] || '';
}

describe('management panel rows', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="category-prefs"></div>
      <div id="source-prefs"></div>
    `;
    const clusters = [
      cluster('sport', 'Sport', [story('s1', 'https://bbc.co.uk/1'), story('s2', 'https://bbc.co.uk/2')]),
      cluster('tech', 'Technology', [story('s3', 'https://kotaku.com/3')]),
    ];
    state.digest = {
      clusters,
      sources: [
        { key: 'bbc.co.uk', label: 'BBC' },
        { key: 'kotaku.com', label: 'Kotaku' },
      ],
    };
    state.viewModel = {
      inventoryPool: clusters,
      allSourceOptions: [
        { key: 'bbc.co.uk', count: 2 },
        { key: 'kotaku.com', count: 1 },
      ],
    };
    state.catPrefs = {};
    state.disabledSources = {};
  });

  it('keeps category counts inline on the category management row', () => {
    renderCategoryPrefs();

    const rows = [...document.querySelectorAll('#category-prefs > .setting-row')];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const label = row.querySelector('.manage-label');
      expect(label.children).toHaveLength(2);
      expect(label.querySelector('.manage-name')).toBeTruthy();
      expect(label.querySelector('.manage-count')).toBeTruthy();
      expect(row.querySelectorAll('.setting-row')).toHaveLength(0);
    }
    expect(rows.map(row => row.querySelector('.manage-count').textContent))
      .toEqual(expect.arrayContaining(['2 stories', '1 story']));
  });

  it('keeps source counts inline on the source management row', () => {
    renderSourcePrefs();

    const rows = [...document.querySelectorAll('#source-prefs > .setting-row')];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.manage-name').textContent).toBe('BBC');
    expect(rows[0].querySelector('.manage-count').textContent).toBe('2 stories in pool');
    expect(rows[1].querySelector('.manage-count').textContent).toBe('1 story in pool');
    for (const row of rows) expect(row.querySelectorAll('.setting-row')).toHaveLength(0);
  });

  it('keeps management count styles on a single line', () => {
    const css = readFileSync('src/styles/settings.css', 'utf8');
    expect(cssBlock(css, '.manage-label')).not.toMatch(/flex-direction\s*:\s*column/);
    expect(cssBlock(css, '.manage-count')).toMatch(/margin-left\s*:\s*auto/);
  });

  it('does not draw border rules around or between filter-bar rows', () => {
    const css = readFileSync('src/styles/filter-bar.css', 'utf8');
    expect(cssBlock(css, '.source-bar')).not.toMatch(/border/);
    expect(cssBlock(css, '.category-filter-row')).not.toMatch(/border/);
  });
});

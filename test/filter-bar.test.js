import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderCategoryFilterBar, renderSourceBar } from '../src/filters.js';
import { state, ui } from '../src/state.js';

function cssBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] || '';
}

describe('filter bar structure', () => {
  it('keeps Mark Read inside the source filter row, split to the right', () => {
    const dom = new JSDOM(readFileSync('src/index.html', 'utf8'));
    const button = dom.window.document.getElementById('mark-all-read');
    const row = button?.closest('.source-bar-inner');
    const toggles = row?.querySelector('#source-toggles');

    expect(row?.parentElement?.id).toBe('source-bar');
    expect(toggles).toBeTruthy();
    expect(toggles.nextElementSibling).toBe(button);
    expect(button.textContent.trim()).toBe('Mark Read');
  });

  it('uses wrapped filter rows rather than thin scrollbars', () => {
    const css = readFileSync('src/styles/filter-bar.css', 'utf8');
    const sourceToggles = cssBlock(css, '.source-toggles');
    const categoryFilters = cssBlock(css, '.category-filters');
    const markRead = cssBlock(css, '.mark-all-read');

    expect(sourceToggles).toMatch(/flex\s*:\s*1/);
    expect(sourceToggles).toMatch(/flex-wrap\s*:\s*wrap/);
    expect(sourceToggles).not.toMatch(/overflow|scrollbar/);
    expect(categoryFilters).toMatch(/flex-wrap\s*:\s*wrap/);
    expect(categoryFilters).not.toMatch(/overflow|scrollbar/);
    expect(markRead).toMatch(/flex\s*:\s*0 0 auto/);
  });

  it('uses canonical sprite classes with unscaled 32px tile offsets', () => {
    const spriteCss = readFileSync('src/styles/favicon-sprite.css', 'utf8');
    const filterCss = readFileSync('src/styles/filter-bar.css', 'utf8');
    const sprite = cssBlock(spriteCss, '.source-sprite');
    const bbc = cssBlock(spriteCss, '.source-icon-bbc-co-uk');
    const button = cssBlock(filterCss, '.source-toggle');
    const tile = cssBlock(filterCss, '.source-toggle .source-sprite');

    expect(sprite).toMatch(/background-image:\s*url\('\.\.\/favicons\/sprite\.png'\)/);
    expect(sprite).not.toMatch(/background-size/);
    expect(bbc).toMatch(/background-position:\s*-192px -0px/);
    expect(button).toMatch(/width:\s*40px/);
    expect(tile).toMatch(/width:\s*32px/);
    expect(tile).toMatch(/height:\s*32px/);
  });

  it('uses the same inverse treatment for selected filters as Mark Read', () => {
    const css = readFileSync('src/styles/filter-bar.css', 'utf8');
    const sourceToggle = cssBlock(css, '.source-toggle');
    const categoryToggle = cssBlock(css, '.category-filter-toggle');
    const markRead = cssBlock(css, '.mark-all-read');

    for (const block of [sourceToggle, categoryToggle]) {
      expect(block).toMatch(/background\s*:\s*var\(--ink\)/);
      expect(block).toMatch(/color\s*:\s*var\(--paper\)/);
      expect(block).toMatch(/border\s*:\s*1px solid var\(--ink\)/);
    }
    expect(markRead).toMatch(/background\s*:\s*var\(--ink\)/);
    expect(markRead).toMatch(/color\s*:\s*var\(--paper\)/);
  });
});

describe('source filter buttons', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="source-toggles"></div>';
    state.sourceFilters = {};
    ui.refresh = vi.fn();
  });

  it('shows a story-count badge on every clickable source and skips empty sources', () => {
    renderSourceBar({
      sourceOptions: [
        { key: 'bbc.co.uk', label: 'BBC', count: 12, displayed: true },
        { key: 'example.com', label: 'Example', count: 0, displayed: true },
      ],
    });

    const buttons = [...document.querySelectorAll('.source-toggle')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].title).toBe('BBC — 12 stories in the current pool');
    expect(buttons[0].querySelector('.source-count')?.textContent).toBe('12');
    expect(buttons[0].querySelector('.source-sprite.source-icon-bbc-co-uk')).toBeTruthy();

    buttons[0].click();
    expect(state.sourceFilters).toEqual({ 'bbc.co.uk': false });
    expect(ui.refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps filtered-out sources clickable with their available count', () => {
    renderSourceBar({
      sourceOptions: [
        { key: 'example.com', label: 'Example', count: 7, displayed: false },
      ],
    });

    const button = document.querySelector('.source-toggle');
    expect(button.classList.contains('is-off')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.querySelector('.source-count')?.textContent).toBe('7');
  });

  it('toggles every host in a grouped source branch', () => {
    state.sourceFilters = { 'nypost.com': false };
    renderSourceBar({
      sourceOptions: [{
        key: 'group:murdoch',
        label: 'Fox / News Corp',
        icon: 'nypost.com',
        path: ['Fox / News Corp'],
        count: 14,
        sourceCount: 3,
        sourceKeys: ['foxnews.com', 'nypost.com', 'wsj.com'],
        displayed: false,
        mixed: true,
        grouped: true,
      }],
    });

    const button = document.querySelector('.source-toggle');
    expect(button.classList.contains('is-mixed')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('mixed');
    expect(button.title).toBe('Fox / News Corp — 14 stories across 3 sources in the current pool');
    expect(button.querySelector('.source-icon-nypost-com')).toBeTruthy();

    button.click();
    expect(state.sourceFilters).toEqual({
      'foxnews.com': false,
      'nypost.com': false,
      'wsj.com': false,
    });
  });
});

describe('category filter buttons', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div class="category-filter-row">
        <div id="category-filters"></div>
      </div>
    `;
    state.settings = { categoryDisplayFilters: {} };
    ui.refresh = vi.fn();
  });

  it('leads with All and removes display-disabled categories from the row', () => {
    renderCategoryFilterBar({
      categoryRowEnabled: true,
      categoryOptions: [
        { value: 'Sport', label: 'Sport', count: 1, storyCount: 2, active: true },
        { value: 'Technology', label: 'Technology', count: 1, storyCount: 1, active: false },
      ],
    });

    const buttons = [...document.querySelectorAll('.category-filter-toggle')];
    expect(buttons.map(button => button.textContent)).toEqual(['All', 'Sport']);
    expect(buttons[0].classList.contains('is-off')).toBe(true);

    buttons[1].click();
    expect(state.settings.categoryDisplayFilters).toEqual({ Sport: false });
    expect(ui.refresh).toHaveBeenCalledTimes(1);
  });

  it('restores every display-filtered category through All', () => {
    state.settings.categoryDisplayFilters = { Technology: false };
    renderCategoryFilterBar({
      categoryRowEnabled: true,
      categoryOptions: [
        { value: 'Sport', label: 'Sport', count: 1, storyCount: 1, active: true },
        { value: 'Technology', label: 'Technology', count: 1, storyCount: 1, active: false },
      ],
    });

    document.querySelector('.category-all-toggle').click();

    expect(state.settings.categoryDisplayFilters).toEqual({});
    expect(ui.refresh).toHaveBeenCalledTimes(1);
  });
});

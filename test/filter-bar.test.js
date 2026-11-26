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
  it('keeps Mark Read in the categories row, split to the right', () => {
    const dom = new JSDOM(readFileSync('src/index.html', 'utf8'));
    const button = dom.window.document.getElementById('mark-all-read');
    const row = button?.closest('.source-bar-inner');
    const categories = row?.querySelector('#category-filters');
    const sourceRow = dom.window.document.querySelector('#source-toggles')?.closest('.source-bar-inner');

    expect(row?.parentElement?.id).toBe('source-bar');
    expect(categories).toBeTruthy();
    expect(categories.nextElementSibling).toBe(button);
    expect(sourceRow).not.toBe(row);
    expect(sourceRow.querySelector('#mark-all-read')).toBeNull();
    expect(button.textContent.trim()).toBe('Mark Read');
  });

  it('keeps the masthead free of cyclers with the search box living in the masthead itself', () => {
    const dom = new JSDOM(readFileSync('src/index.html', 'utf8'));
    expect(dom.window.document.getElementById('mode-toggle')).toBeNull();
    expect(dom.window.document.getElementById('category-toggle')).toBeNull();
    expect(dom.window.document.getElementById('search-toggle')).toBeNull();
    // no pre-state, no separate panel: the textbox is in the masthead, always visible
    expect(dom.window.document.getElementById('search-panel')).toBeNull();
    const filter = dom.window.document.getElementById('filter');
    expect(filter).toBeTruthy();
    expect(filter.closest('.masthead')).toBeTruthy();
    expect(filter.closest('.masthead-search')).toBeTruthy();
    // recent searches ride along inside the masthead search container
    const recent = dom.window.document.getElementById('recent-searches');
    expect(recent?.closest('.masthead-search')).toBeTruthy();
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
    expect(bbc).toMatch(/background-position:\s*-\d+px -\d+px/);
    const [, bx, by] = /background-position:\s*-(\d+)px -(\d+)px/.exec(bbc) || [];
    expect(Number(bx) % 32).toBe(0);
    expect(Number(by) % 32).toBe(0);
    expect(button).toMatch(/width:\s*32px/);
    expect(tile).toMatch(/width:\s*32px/);
    expect(tile).toMatch(/height:\s*32px/);
  });

  it('keeps source toggles as plain icons, dimmed when outside the selection', () => {
    const css = readFileSync('src/styles/filter-bar.css', 'utf8');
    const sourceToggle = cssBlock(css, '.source-toggle');
    const sourceDimmed = cssBlock(css, '.source-toggle.is-dimmed');

    expect(sourceToggle).toMatch(/background\s*:\s*transparent/);
    expect(sourceToggle).toMatch(/border\s*:\s*none/);
    expect(sourceToggle).toMatch(/padding\s*:\s*0/);
    expect(sourceDimmed).toMatch(/grayscale/);
    expect(sourceDimmed).toMatch(/opacity/);
  });

  it('hides the source bar until data has loaded', () => {
    const dom = new JSDOM(readFileSync('src/index.html', 'utf8'));
    const bar = dom.window.document.getElementById('source-bar');
    expect(bar.hasAttribute('hidden')).toBe(true);
    expect(bar.querySelector('#mark-all-read')).toBeTruthy();
    expect(bar.querySelector('#source-toggles')).toBeTruthy();
  });

  it('keeps category pills transparent unless selected, mark read inverse', () => {
    const css = readFileSync('src/styles/filter-bar.css', 'utf8');
    const categoryToggle = cssBlock(css, '.category-filter-toggle');
    const categoryIncluded = cssBlock(css, '.category-filter-toggle.is-included');
    const markRead = cssBlock(css, '.mark-all-read');

    expect(categoryToggle).toMatch(/background\s*:\s*transparent/);
    expect(categoryToggle).not.toMatch(/color\s*:\s*var\(--paper\)/);
    expect(categoryIncluded).toMatch(/background\s*:\s*var\(--ink\)/);
    expect(categoryIncluded).toMatch(/color\s*:\s*var\(--paper\)/);
    expect(markRead).toMatch(/background\s*:\s*var\(--ink\)/);
    expect(markRead).toMatch(/color\s*:\s*var\(--paper\)/);
  });
});

describe('source filter buttons', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="source-toggles"></div>';
    state.sourceInclude = {};
    ui.refresh = vi.fn();
  });

  it('renders plain icons without count badges, counts only in the tooltip', () => {
    renderSourceBar({
      sourceOptions: [
        { key: 'bbc.co.uk', label: 'BBC', count: 12, included: false },
        { key: 'example.com', label: 'Example', count: 0, included: false },
      ],
      sourceIncludeActive: false,
    });

    const buttons = [...document.querySelectorAll('.source-toggle')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].title).toBe('BBC — 12 stories in the current pool');
    expect(buttons[0].querySelector('.source-count')).toBeNull();
    expect(buttons[0].querySelector('.source-sprite.source-icon-bbc-co-uk')).toBeTruthy();
    expect(buttons[0].classList.contains('is-dimmed')).toBe(false);

    buttons[0].click();
    expect(state.sourceInclude).toEqual({ 'bbc.co.uk': true });
    expect(ui.refresh).toHaveBeenCalledTimes(1);
  });

  it('dims non-selected icons while a selection is active, still clickable', () => {
    state.sourceInclude = { 'other.example': true };
    renderSourceBar({
      sourceOptions: [
        { key: 'example.com', label: 'Example', count: 7, included: false },
        { key: 'other.example', label: 'Other', count: 3, included: true },
      ],
      sourceIncludeActive: true,
    });

    const buttons = [...document.querySelectorAll('.source-toggle')];
    expect(buttons[0].classList.contains('is-dimmed')).toBe(true);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(buttons[1].classList.contains('is-dimmed')).toBe(false);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');

    // clicking a dimmed icon adds it to the selection
    buttons[0].click();
    expect(state.sourceInclude).toEqual({ 'other.example': true, 'example.com': true });

    // clicking the selected icon removes it; empty selection shows everything
    buttons[1].click();
    expect(state.sourceInclude).toEqual({ 'example.com': true });
  });

  it('toggles the whole grouped branch as one control key', () => {
    renderSourceBar({
      sourceOptions: [{
        key: 'group:murdoch',
        label: 'Fox / News Corp',
        icon: 'nypost.com',
        path: ['Fox / News Corp'],
        count: 14,
        sourceCount: 3,
        sourceKeys: ['foxnews.com', 'nypost.com', 'wsj.com'],
        included: false,
        grouped: true,
      }],
      sourceIncludeActive: false,
    });

    const button = document.querySelector('.source-toggle');
    expect(button.title).toBe('Fox / News Corp — 14 stories across 3 sources in the current pool');
    expect(button.querySelector('.source-icon-nypost-com')).toBeTruthy();

    button.click();
    expect(state.sourceInclude).toEqual({ 'group:murdoch': true });
  });

  it('leads with an ALL control that clears whatever selection is set', () => {
    renderSourceBar({
      sourceOptions: [{ key: 'a.example', label: 'A', count: 5, included: false }],
      sourceIncludeActive: false,
    });
    const all = document.querySelector('.source-all');
    expect(all).toBeTruthy();
    // ALL is the first control in the bar, before any volume chip or icon
    expect(document.getElementById('source-toggles').firstElementChild).toBe(all);
    // nothing filtered: ALL reads active and there is nothing to click
    expect(all.classList.contains('is-active')).toBe(true);
    expect(all.disabled).toBe(true);

    state.sourceInclude = { 'a.example': true };
    renderSourceBar({
      sourceOptions: [{ key: 'a.example', label: 'A', count: 5, included: true }],
      sourceIncludeActive: true,
    });
    const activeAll = document.querySelector('.source-all');
    expect(activeAll.classList.contains('is-active')).toBe(false);
    expect(activeAll.disabled).toBe(false);
    activeAll.click();
    expect(state.sourceInclude).toEqual({});
  });

  it('groups icons into volume buckets with one label per bucket', () => {
    renderSourceBar({
      sourceOptions: [
        { key: 'big.example', label: 'Big', count: 100, included: false },
        { key: 'mid.example', label: 'Mid', count: 30, included: false },
        { key: 'small.example', label: 'Small', count: 2, included: false },
      ],
      sourceIncludeActive: false,
    });

    const chips = [...document.querySelectorAll('.source-bucket')];
    expect(chips.length).toBeGreaterThanOrEqual(2);
    expect(chips[0].textContent).toBe('25+');
    // each chip precedes the first icon of its bucket
    const children = [...document.getElementById('source-toggles').children];
    const bigIdx = children.findIndex(el => el.dataset?.source === 'big.example');
    const midIdx = children.findIndex(el => el.dataset?.source === 'mid.example');
    const firstChip = children.findIndex(el => el.classList?.contains('source-bucket'));
    expect(firstChip).toBeLessThan(bigIdx);
    expect(bigIdx).toBeLessThan(midIdx);
  });

  it('renders no bucket chips when volumes are small', () => {
    renderSourceBar({
      sourceOptions: [
        { key: 'a.example', label: 'A', count: 3, included: false },
        { key: 'b.example', label: 'B', count: 2, included: false },
      ],
      sourceIncludeActive: false,
    });
    expect(document.querySelector('.source-bucket')).toBeNull();
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

  it('leads with All and dims unselected categories only while filtering', () => {
    renderCategoryFilterBar({
      categoryRowEnabled: true,
      categoryIncludeActive: false,
      categoryOptions: [
        { value: 'Sport', label: 'Sport', count: 1, storyCount: 2, included: false },
        { value: 'Technology', label: 'Technology', count: 1, storyCount: 1, included: false },
      ],
    });

    const buttons = [...document.querySelectorAll('.category-filter-toggle')];
    expect(buttons.map(button => button.textContent)).toEqual(['All', 'Sport', 'Technology']);
    expect(buttons[0].classList.contains('is-off')).toBe(false);
    expect(buttons[1].classList.contains('is-off')).toBe(false);

    buttons[1].click();
    expect(state.settings.categoryDisplayFilters).toEqual({ Sport: true });
    expect(ui.refresh).toHaveBeenCalledTimes(1);

    renderCategoryFilterBar({
      categoryRowEnabled: true,
      categoryIncludeActive: true,
      categoryOptions: [
        { value: 'Sport', label: 'Sport', count: 1, storyCount: 2, included: true },
        { value: 'Technology', label: 'Technology', count: 1, storyCount: 1, included: false },
      ],
    });
    const filtered = [...document.querySelectorAll('.category-filter-toggle')];
    expect(filtered[1].classList.contains('is-off')).toBe(false);
    expect(filtered[2].classList.contains('is-off')).toBe(true);
    expect(filtered[2].getAttribute('aria-pressed')).toBe('false');
  });

  it('clears the category selection through All', () => {
    state.settings.categoryDisplayFilters = { Technology: true };
    renderCategoryFilterBar({
      categoryRowEnabled: true,
      categoryIncludeActive: true,
      categoryOptions: [
        { value: 'Sport', label: 'Sport', count: 1, storyCount: 1, included: false },
        { value: 'Technology', label: 'Technology', count: 1, storyCount: 1, included: true },
      ],
    });

    document.querySelector('.category-all-toggle').click();

    expect(state.settings.categoryDisplayFilters).toEqual({});
    expect(ui.refresh).toHaveBeenCalledTimes(1);
  });

  it('restricts to a single category and clears when re-clicked', () => {
    state.settings.categoryDisplayFilters = {};
    renderCategoryFilterBar({
      categoryRowEnabled: true,
      categoryIncludeActive: false,
      categoryOptions: [
        { value: 'Sport', label: 'Sport', count: 1, storyCount: 1, included: false },
        { value: 'Technology', label: 'Technology', count: 1, storyCount: 1, included: false },
      ],
    });

    const [sport, tech] = [...document.querySelectorAll('.category-filter-toggle:not(.category-all-toggle)')];

    sport.click();
    expect(state.settings.categoryDisplayFilters).toEqual({ Sport: true });

    // Clicking a different category replaces rather than multi-selects
    state.settings.categoryDisplayFilters = { Sport: true };
    tech.click();
    expect(state.settings.categoryDisplayFilters).toEqual({ Technology: true });

    // Clicking the active category clears back to everything
    state.settings.categoryDisplayFilters = { Technology: true };
    tech.click();
    expect(state.settings.categoryDisplayFilters).toEqual({});
  });

  it('marks the selected pill inverse and others transparent', () => {
    state.settings.categoryDisplayFilters = { Technology: true };
    renderCategoryFilterBar({
      categoryRowEnabled: true,
      categoryIncludeActive: true,
      categoryOptions: [
        { value: 'Sport', label: 'Sport', count: 1, storyCount: 1, included: false },
        { value: 'Technology', label: 'Technology', count: 1, storyCount: 1, included: true },
      ],
    });

    const [sport, tech] = [...document.querySelectorAll('.category-filter-toggle:not(.category-all-toggle)')];
    expect(tech.classList.contains('is-included')).toBe(true);
    expect(sport.classList.contains('is-included')).toBe(false);
    expect(sport.classList.contains('is-off')).toBe(true);
  });

  it('ships a back-to-top control that starts hidden and sits outside the flow', () => {
    const dom = new JSDOM(readFileSync('src/index.html', 'utf8'));
    const btn = dom.window.document.getElementById('back-to-top');
    expect(btn).toBeTruthy();
    expect(btn.hidden).toBe(true);
    // it must live OUTSIDE the broadsheet column so it never covers copyable text
    expect(btn.closest('#broadsheet')).toBeNull();
    const css = readFileSync('src/styles/shell.css', 'utf8');
    expect(css).toMatch(/\.back-to-top\s*\{[^}]*position\s*:\s*fixed/);
  });
});

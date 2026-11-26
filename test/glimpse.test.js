import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderArticle } from '../src/article.js';
import {
  isCurrentVersionGlimpsed,
  recordClusterGlimpsed,
  refreshGlimpseObserver,
} from '../src/reading.js';
import { GLIMPSE_KEY, state, ui } from '../src/state.js';

function cluster(overrides = {}) {
  return {
    id: 'cluster-1',
    headline: 'A visible story',
    summary: 'The full summary stays available for this article.',
    shortSummary: 'Short summary.',
    category: 'Science',
    contentVersion: 1,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    stories: [{
      id: 'story-1',
      title: 'A visible story',
      url: 'https://example.com/story',
      sourceName: 'Example',
      published: new Date().toISOString(),
    }],
    ...overrides,
  };
}

describe('glimpse tracking', () => {
  let observers;

  class FakeIntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.observed = [];
      observers.push(this);
    }
    observe(element) { this.observed.push(element); }
    disconnect() { this.disconnected = true; }
  }

  beforeEach(() => {
    localStorage.clear();
    observers = [];
    document.body.innerHTML = '';
    state.digest = null;
    state.glimpseState = {};
    state.readState = {};
    state.disabledSources = {};
    state.sourceInclude = {};
    state.interestState = {};
    state.settings.watchWords = '';
    ui.relayout = vi.fn();
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('records a glimpse without changing the currently rendered article', () => {
    const item = cluster();
    state.digest = { clusters: [item] };
    const article = document.createElement('article');
    article.className = 'article';
    article.dataset.clusterId = item.id;
    document.body.appendChild(article);

    refreshGlimpseObserver();
    expect(observers).toHaveLength(1);
    expect(observers[0].observed).toEqual([article]);

    observers[0].callback([{ target: article, isIntersecting: true }]);
    expect(state.glimpseState[item.id].contentVersion).toBe(1);
    expect(isCurrentVersionGlimpsed(item)).toBe(true);
    expect(JSON.parse(localStorage.getItem(GLIMPSE_KEY))[item.id]).toBeTruthy();

    observers[0].callback([{ target: article, isIntersecting: false }]);
    expect(article.classList.contains('is-glimpsed')).toBe(false);
    expect(ui.relayout).not.toHaveBeenCalled();
  });

  it('glimpse state has zero rendering impact — full copy always, no collapse machinery', () => {
    const item = cluster();
    expect(recordClusterGlimpsed(item)).toBe(true);

    const article = renderArticle(item, { images: 'none', expandAll: false }, false, Date.now());

    expect(article.classList.contains('is-glimpsed')).toBe(false);
    expect(article.querySelector('.summary-short')).toBeNull();
    expect(article.querySelector('.summary-more')).toBeNull();
    expect(article.textContent).toContain(item.summary);
  });

  it('renders identically whether glimpsed or not', () => {
    const item = cluster({ contentVersion: 2 });
    const fresh = renderArticle(item, { images: 'none', expandAll: false }, false, Date.now());

    state.glimpseState[item.id] = { contentVersion: 2, at: Date.now() };
    const glimpsed = renderArticle(item, { images: 'none', expandAll: false }, false, Date.now());

    expect(glimpsed.className).toBe(fresh.className);
    expect(glimpsed.innerHTML).toBe(fresh.innerHTML);
  });
});

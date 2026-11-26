import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFeed,
  getFeedRenderState,
  renderFeed,
  syncFeedToSearch,
} from '../src/feed.js';
import { DEFAULT_SETTINGS, state } from '../src/state.js';

function cluster(id, headline = `Story ${id}`) {
  return {
    id,
    headline,
    summary: `${headline} summary`,
    category: 'Science',
    contentVersion: 1,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    stories: [{
      id: `${id}-story`,
      title: headline,
      url: `https://example.com/${id}`,
      sourceName: 'Example',
      published: new Date().toISOString(),
    }],
  };
}

describe('feed view manager', () => {
  let observers;

  class FakeIntersectionObserver {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      observers.push(this);
    }
    observe(element) { this.observed.push(element); }
    unobserve(element) { this.observed = this.observed.filter(item => item !== element); }
    disconnect() { this.disconnected = true; }
  }

  beforeEach(() => {
    localStorage.clear();
    observers = [];
    document.body.innerHTML = `
      <input id="filter" value="">
      <button id="mark-all-read" type="button"></button>
      <main id="broadsheet"></main>
    `;
    state.settings = { ...DEFAULT_SETTINGS, images: 'none', markRead: 'off' };
    state.readState = {};
    state.glimpseState = {};
    state.disabledSources = {};
    state.sourceInclude = {};
    state.interestState = {};
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    clearFeed();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mount(clusters) {
    state.digest = { clusters };
    state.visibleClusters = clusters;
    renderFeed({
      clusters,
      settings: state.settings,
      pluginLeadIds: new Set(),
      latestReferenceTime: Date.now(),
    });
  }

  it('creates one lightweight node per story without hydrating contents', () => {
    const clusters = Array.from({ length: 120 }, (_, i) => cluster(`c${i}`));
    mount(clusters);

    const articles = [...document.querySelectorAll('.article')];
    expect(articles).toHaveLength(120);
    expect(document.querySelectorAll('.article-lazy')).toHaveLength(120);
    expect(articles.every(article => article.style.height)).toBe(true);
    expect(getFeedRenderState()).toMatchObject({ hydrated: 0, total: 120 });
  });

  it('hydrates near articles and unloads them while preserving measured height', () => {
    const clusters = [cluster('a'), cluster('b')];
    mount(clusters);
    const article = document.querySelector('.article');
    const feedObserver = observers[0];

    feedObserver.callback([{ target: article, isIntersecting: true }]);
    expect(article.classList.contains('article-lazy')).toBe(false);
    expect(article.querySelector('.article-summary')).toBeTruthy();
    expect(getFeedRenderState().hydrated).toBe(1);

    Object.defineProperty(article, 'offsetHeight', { value: 123, configurable: true });
    feedObserver.callback([{ target: article, isIntersecting: false }]);
    expect(article.classList.contains('article-lazy')).toBe(true);
    expect(article.style.height).toBe('123px');
    expect(article.querySelector('.article-summary')).toBeNull();
    expect(getFeedRenderState().hydrated).toBe(0);
  });

  it('does not glimpse or read unhydrated shells', () => {
    mount([cluster('a')]);
    const article = document.querySelector('.article');

    expect(article.classList.contains('article-lazy')).toBe(true);
    expect(observers).toHaveLength(1);

    observers[0].callback([{ target: article, isIntersecting: true }]);
    const glimpseObserver = observers.at(-1);
    expect(observers).toHaveLength(2);
    expect(glimpseObserver.observed).toEqual([article]);
  });

  it('reuses article nodes when search changes the visible set', () => {
    const clusters = [cluster('mars', 'Mars landing'), cluster('cricket', 'Cricket result')];
    mount(clusters);
    const before = [...document.querySelectorAll('.article')];

    document.getElementById('filter').value = 'mars';
    expect(syncFeedToSearch()).toBe(true);

    const after = [...document.querySelectorAll('.article')];
    expect(after).toEqual(before);
    expect(after[0].classList.contains('hidden')).toBe(false);
    expect(after[1].classList.contains('hidden')).toBe(true);
    expect(getFeedRenderState()).toMatchObject({ total: 1, query: 'mars' });
  });

  it('keeps the same node instances across feed refreshes', () => {
    const clusters = [cluster('a'), cluster('b')];
    mount(clusters);
    const before = [...document.querySelectorAll('.article')];

    mount(clusters);

    expect([...document.querySelectorAll('.article')]).toEqual(before);
    expect(document.querySelectorAll('.article-lazy')).toHaveLength(2);
  });
});

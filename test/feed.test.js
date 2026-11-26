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
  let rafQueue;

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

  function flushRaf() {
    let guard = 0;
    while (rafQueue.length && guard++ < 200) {
      const cb = rafQueue.shift();
      cb();
    }
  }

  // jsdom has no layout — place nodes geometrically so the window driver
  // can compute visibility exactly as a browser would.
  function place(node, top, height = 300) {
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
      top,
      bottom: top + height,
      height,
      width: 320,
      left: 0,
      right: 320,
    });
  }

  beforeEach(() => {
    localStorage.clear();
    observers = [];
    rafQueue = [];
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
    vi.stubGlobal('requestAnimationFrame', cb => { rafQueue.push(cb); return rafQueue.length; });
    vi.stubGlobal('innerHeight', 900);
    clearFeed();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it('creates one lightweight shell per story without hydrating contents', () => {
    const clusters = Array.from({ length: 120 }, (_, i) => cluster(`c${i}`));
    mount(clusters);

    const articles = [...document.querySelectorAll('.article')];
    expect(articles).toHaveLength(120);
    // jsdom rects are all-zero (treated as collapsed/unmeasurable), so the
    // window driver correctly hydrates nothing here.
    expect(document.querySelectorAll('.article-lazy')).toHaveLength(120);
    expect(articles.every(article => article.style.height)).toBe(true);
    expect(getFeedRenderState()).toMatchObject({ hydrated: 0, total: 120 });
  });

  it('hydrates in-window shells on the window pass — no scroll event needed', () => {
    mount([cluster('a'), cluster('b')]);
    const [first, second] = [...document.querySelectorAll('.article')];
    place(first, 0);
    place(second, 400);

    flushRaf(); // the post-mount window pass

    expect(first.classList.contains('article-lazy')).toBe(false);
    expect(first.querySelector('.article-summary')).toBeTruthy();
    expect(second.classList.contains('article-lazy')).toBe(false);
  });

  it('hydrated articles never carry an inline height — natural masonry height only', () => {
    mount([cluster('a')]);
    const article = document.querySelector('.article');
    place(article, 0);

    flushRaf();

    expect(article.classList.contains('article-lazy')).toBe(false);
    expect(article.style.height).toBe('');
  });

  it('leaves far-below shells pinned at estimated height', () => {
    mount([cluster('near'), cluster('far')]);
    const [near, far] = [...document.querySelectorAll('.article')];
    place(near, 0);
    place(far, 5000); // beyond the 1200px enter margin below a 900px viewport

    flushRaf();

    expect(near.classList.contains('article-lazy')).toBe(false);
    expect(far.classList.contains('article-lazy')).toBe(true);
    expect(far.style.height).not.toBe('');
  });

  it('unloads hydrated nodes beyond the leave margin and re-pins measured height', () => {
    mount([cluster('a')]);
    const article = document.querySelector('.article');
    place(article, 0);
    flushRaf();
    expect(article.classList.contains('article-lazy')).toBe(false);

    Object.defineProperty(article, 'offsetHeight', { value: 123, configurable: true });
    vi.mocked(article.getBoundingClientRect).mockReturnValue({
      top: -5000, bottom: -4700, height: 300, width: 320, left: 0, right: 320,
    });
    window.dispatchEvent(new Event('scroll'));
    flushRaf();

    expect(article.classList.contains('article-lazy')).toBe(true);
    expect(article.style.height).toBe('123px');
    expect(article.querySelector('.article-summary')).toBeNull();
    expect(getFeedRenderState().hydrated).toBe(0);
  });

  it('hysteresis: nodes between enter and leave margins are left untouched', () => {
    mount([cluster('a')]);
    const article = document.querySelector('.article');
    // inside the leave margin (2400) but outside the enter margin (1200):
    // a shell here must NOT hydrate, and a hydrated node must NOT unload.
    place(article, 900 + 1500); // top at 2400, beyond enter margin of 2100
    flushRaf();
    expect(article.classList.contains('article-lazy')).toBe(true);

    // move the same node into the window and hydrate it
    vi.mocked(article.getBoundingClientRect).mockReturnValue({
      top: 100, bottom: 400, height: 300, width: 320, left: 0, right: 320,
    });
    window.dispatchEvent(new Event('scroll'));
    flushRaf();
    expect(article.classList.contains('article-lazy')).toBe(false);

    // drift it back into the hysteresis band — must stay hydrated
    vi.mocked(article.getBoundingClientRect).mockReturnValue({
      top: 2200, bottom: 2500, height: 300, width: 320, left: 0, right: 320,
    });
    window.dispatchEvent(new Event('scroll'));
    flushRaf();
    expect(article.classList.contains('article-lazy')).toBe(false);
  });

  it('drives hydration from scroll events through the single driver', () => {
    mount([cluster('a')]);
    const article = document.querySelector('.article');
    place(article, 5000);
    flushRaf();
    expect(article.classList.contains('article-lazy')).toBe(true);

    // user scrolls down — same node now near the viewport
    vi.mocked(article.getBoundingClientRect).mockReturnValue({
      top: 300, bottom: 600, height: 300, width: 320, left: 0, right: 320,
    });
    window.dispatchEvent(new Event('scroll'));
    flushRaf();

    expect(article.classList.contains('article-lazy')).toBe(false);
  });

  it('does not glimpse or read unhydrated shells', () => {
    mount([cluster('a')]);
    const article = document.querySelector('.article');
    place(article, 0);

    expect(article.classList.contains('article-lazy')).toBe(true);
    flushRaf();

    const glimpseObserver = observers.at(-1);
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

import { describe, expect, it } from 'vitest';
import {
  buildViewModel,
  canonicalCategory,
  getDisplayedStories,
  prettifySourceKey,
  INDIVIDUAL_SOURCE_MIN_ARTICLES,
  sourceKeyFromUrl,
} from '../src/view-model.js';
import { OTHER_SOURCE_KEY } from '../src/source-groups.js';

const now = new Date().toISOString();

function story(id, url, title = id) {
  return { id, title, url, sourceName: 'Test Source', published: now };
}

function cluster(id, category, stories, contentVersion = 1) {
  return {
    id,
    category,
    stories,
    contentVersion,
    created: now,
    updated: now,
    headline: `${id} headline`,
    summary: `${id} summary`,
  };
}

function settings(overrides = {}) {
  return {
    mode: 'all',
    ageLimit: '30',
    categoryFilter: 'all',
    categoryDisplayFilters: {},
    showUpdated: false,
    ...overrides,
  };
}

describe('view-model helpers', () => {
  it('canonicalises category spelling and casing', () => {
    expect(canonicalCategory('sports')).toBe('Sport');
    expect(canonicalCategory('personal finance')).toBe('Personal Finance');
    expect(canonicalCategory(['science'])).toBe('Science');
    expect(canonicalCategory('')).toBe('Other');
  });

  it('derives stable source keys and labels from story URLs', () => {
    expect(sourceKeyFromUrl('https://www.bbc.co.uk/news/article-123')).toBe('bbc.co.uk');
    expect(sourceKeyFromUrl('not a url')).toBe('');
    expect(prettifySourceKey('bbc.co.uk')).toBe('Bbc');
    expect(prettifySourceKey('kotaku.com')).toBe('Kotaku');
  });
});

describe('buildViewModel', () => {
  it('keeps display-filtered sources in the bar while removing their stories from view', () => {
    const clusters = [
      cluster('mixed', 'Sport', [
        story('s1', 'https://www.bbc.co.uk/news/one'),
        story('s2', 'https://kotaku.com/two'),
      ]),
      cluster('bbc-only', 'Technology', [story('s3', 'https://www.bbc.co.uk/news/three')]),
      cluster('blocked', 'World', [story('s4', 'https://blocked.example/four')]),
    ];

    const model = buildViewModel({
      clusters,
      digestSources: [{ key: 'bbc.co.uk', label: 'BBC' }],
      settings: settings(),
      disabledSources: { 'blocked.example': true },
      sourceFilters: { 'bbc.co.uk': false },
    });

    expect(model.feedPool.map(c => c.id)).toEqual(['mixed', 'bbc-only']);
    expect(model.visibleClusters.map(c => c.id)).toEqual(['mixed']);
    expect(getDisplayedStories(clusters[0], { 'blocked.example': true }, { 'bbc.co.uk': false }))
      .toEqual([clusters[0].stories[1]]);

    const bbc = model.sourceOptions.find(source => source.sourceKeys?.includes('bbc.co.uk'));
    expect(bbc).toMatchObject({ label: 'Public & International', count: 2, displayed: false, grouped: true });
    expect(bbc.sourceKeys).toEqual(['bbc.co.uk']);
    expect(model.allSourceOptions.find(source => source.key === 'blocked.example'))
      .toMatchObject({ count: 1, disabled: true });
  });

  it('excludes current-version reads and only restores them for show-updated mode', () => {
    const clusters = [
      cluster('read-current', 'Sport', [story('s1', 'https://a.example/1')], 2),
      cluster('unread', 'Sport', [story('s2', 'https://b.example/2')], 1),
    ];
    const readState = { 'read-current': { contentVersion: 2 } };

    const hidden = buildViewModel({
      clusters,
      settings: settings(),
      readState,
    });
    expect(hidden.visibleClusters.map(c => c.id)).toEqual(['unread']);

    const updatedSinceRead = buildViewModel({
      clusters,
      settings: settings({ showUpdated: true }),
      readState: { 'read-current': { contentVersion: 1 } },
    });
    expect(updatedSinceRead.visibleClusters.map(c => c.id)).toEqual(['read-current', 'unread']);
  });

  it('groups predetermined source families and bounds ungrouped low-volume hosts', () => {
    const busyStories = Array.from({ length: INDIVIDUAL_SOURCE_MIN_ARTICLES }, (_, index) =>
      story(`busy-${index}`, `https://busy.example/${index}`)
    );
    const clusters = [
      cluster('murdoch', 'World', [
        story('fox', 'https://foxnews.com/story'),
        story('nyp', 'https://nypost.com/story'),
        story('wsj', 'https://wsj.com/story'),
      ]),
      cluster('busy', 'Technology', busyStories),
      cluster('small', 'Sport', [story('small', 'https://small.example/story')]),
    ];

    const model = buildViewModel({ clusters, settings: settings() });
    const murdoch = model.sourceOptions.find(source => source.sourceKeys?.includes('foxnews.com'));
    expect(murdoch).toMatchObject({
      label: 'Fox / News Corp',
      count: 2,
      sourceCount: 2,
      grouped: true,
      displayed: true,
      sourceKeys: ['foxnews.com', 'nypost.com'],
    });
    const wsj = model.sourceOptions.find(source => source.sourceKeys?.includes('wsj.com'));
    expect(wsj).toMatchObject({ grouped: true, displayed: true });
    expect(model.sourceOptions.some(source => source.key === 'small.example')).toBe(false);
    expect(model.sourceOptions.some(source => source.key === 'busy.example')).toBe(true);
    expect(model.otherSourceKeys.has('small.example')).toBe(true);
    expect(model.sourceOptions.find(source => source.key === `group:${OTHER_SOURCE_KEY}`))
      .toMatchObject({ label: 'Other Sources', count: 1, sourceCount: 1, displayed: true });

    const filtered = buildViewModel({
      clusters,
      settings: settings(),
      sourceFilters: { 'small.example': false },
    });
    expect(filtered.sourceOptions.find(source => source.key === 'small.example'))
      .toMatchObject({ count: 1, displayed: false });

    const otherFiltered = buildViewModel({
      clusters,
      settings: settings(),
      sourceFilters: { [OTHER_SOURCE_KEY]: false },
    });
    expect(otherFiltered.sourceOptions.find(source => source.key === `group:${OTHER_SOURCE_KEY}`))
      .toMatchObject({ count: 1, displayed: false });
    expect(otherFiltered.visibleClusters.map(item => item.id)).toEqual(['murdoch', 'busy']);

    const restored = buildViewModel({
      clusters,
      settings: settings(),
      sourceFilters: { [OTHER_SOURCE_KEY]: false, 'small.example': true },
    });
    expect(restored.sourceOptions.find(source => source.key === 'small.example'))
      .toMatchObject({ count: 1, displayed: true, otherMember: true });
    expect(restored.visibleClusters.map(item => item.id)).toEqual(['murdoch', 'busy', 'small']);
  });

  it('uses live category filters only in all-category masthead mode', () => {
    const clusters = [
      cluster('sport', 'Sport', [story('s1', 'https://a.example/1')]),
      cluster('tech', 'Technology', [story('s2', 'https://b.example/2')]),
    ];

    const filtered = buildViewModel({
      clusters,
      settings: settings({ categoryDisplayFilters: { Sport: false } }),
    });
    expect(filtered.visibleClusters.map(c => c.id)).toEqual(['tech']);
    expect(filtered.categoryRowEnabled).toBe(true);

    const mastheadSport = buildViewModel({
      clusters,
      settings: settings({
        categoryFilter: 'Sport',
        categoryDisplayFilters: { Sport: false },
      }),
    });
    expect(mastheadSport.visibleClusters.map(c => c.id)).toEqual(['sport']);
    expect(mastheadSport.categoryRowEnabled).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applySearchFilter,
  getDisplayedClusters,
  markDisplayedClustersRead,
  updateMarkReadButton,
} from '../src/search.js';
import { READ_KEY, state, ui } from '../src/state.js';

function cluster(id, headline, contentVersion = 1) {
  return {
    id,
    headline,
    summary: `${headline} summary`,
    category: 'Science',
    contentVersion,
    stories: [{
      id: `${id}-story`,
      title: `${headline} source story`,
      url: `https://example.com/${id}`,
      sourceName: 'Example',
      published: new Date().toISOString(),
    }],
  };
}

function articleFor(cluster) {
  const article = document.createElement('article');
  article.className = 'article';
  article.dataset.headline = cluster.headline.toLowerCase();
  article.dataset.summary = cluster.summary.toLowerCase();
  article.dataset.category = cluster.category.toLowerCase();
  article.dataset.stories = cluster.stories[0].title.toLowerCase();
  return article;
}

describe('displayed-story catch-up', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <input id="filter" value="">
      <button id="mark-all-read" type="button"></button>
      <main id="broadsheet"></main>
    `;
    state.visibleClusters = [];
    state.readState = {};
    state.disabledSources = {};
    state.sourceFilters = {};
    ui.refresh = vi.fn();
    ui.relayout = vi.fn();
    ui.syncFeed = vi.fn(() => false);
  });

  it('shows the number of unread displayed stories in the Mark Read control', () => {
    const matchingUnread = cluster('mars-one', 'Mars landing begins');
    const matchingRead = cluster('mars-two', 'Mars landing delayed');
    const nonMatchingUnread = cluster('sport', 'Cricket result');
    state.visibleClusters = [matchingUnread, matchingRead, nonMatchingUnread];
    state.readState = { [matchingRead.id]: { contentVersion: 1 } };
    document.getElementById('filter').value = 'mars';

    updateMarkReadButton();

    const button = document.getElementById('mark-all-read');
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Mark 1 Read');
    expect(button.querySelector('.mark-read-count')?.textContent).toBe('1');
  });

  it('marks only the active displayed set and refreshes the UI immediately', () => {
    const matchingUnread = cluster('mars-one', 'Mars landing begins');
    const matchingRead = cluster('mars-two', 'Mars landing delayed');
    const nonMatchingUnread = cluster('sport', 'Cricket result');
    state.visibleClusters = [matchingUnread, matchingRead, nonMatchingUnread];
    state.readState = { [matchingRead.id]: { contentVersion: 1 } };
    document.getElementById('filter').value = 'mars';

    expect(getDisplayedClusters().map(c => c.id)).toEqual([matchingUnread.id, matchingRead.id]);
    markDisplayedClustersRead();

    expect(ui.refresh).toHaveBeenCalledTimes(1);
    expect(state.readState[matchingUnread.id]?.contentVersion).toBe(1);
    expect(state.readState[matchingRead.id]?.contentVersion).toBe(1);
    expect(state.readState[nonMatchingUnread.id]).toBeUndefined();

    const saved = JSON.parse(localStorage.getItem(READ_KEY));
    expect(Object.keys(saved).sort()).toEqual([matchingUnread.id, matchingRead.id].sort());

    updateMarkReadButton();
    const button = document.getElementById('mark-all-read');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Mark Read');
  });

  it('applies the active search to rendered articles before recounting', () => {
    const matching = cluster('mars-one', 'Mars landing begins');
    const nonMatching = cluster('sport', 'Cricket result');
    state.visibleClusters = [matching, nonMatching];
    const sheet = document.getElementById('broadsheet');
    const matchingArticle = articleFor(matching);
    const nonMatchingArticle = articleFor(nonMatching);
    sheet.append(matchingArticle, nonMatchingArticle);
    document.getElementById('filter').value = 'mars';

    applySearchFilter();

    expect(matchingArticle.classList.contains('hidden')).toBe(false);
    expect(nonMatchingArticle.classList.contains('hidden')).toBe(true);
    expect(ui.relayout).toHaveBeenCalledTimes(1);
    expect(document.getElementById('mark-all-read').textContent).toBe('Mark 1 Read');
  });
});

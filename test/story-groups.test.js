import { readFileSync } from 'fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderArticleShell } from '../src/article.js';
import { DEFAULT_SETTINGS, state } from '../src/state.js';
import { getClusterStoryGroup, groupClustersForFeed } from '../src/story-groups.js';
import { STORY_RELATION_TREE } from '../src/story-tree.js';

function cluster(id, fields = {}) {
  return {
    id,
    headline: `Story ${id}`,
    summary: 'Summary',
    tags: [],
    triggerWords: [],
    entities: {},
    stories: [],
    ...fields,
  };
}

describe('curated story groups', () => {
  it('is exposed as a settings toggle', () => {
    const html = readFileSync('src/index.html', 'utf8');
    expect(DEFAULT_SETTINGS.groupByTag).toBe(false);
    expect(html).toContain('id="setting-grouptag"');
    expect(html).toContain('Group By Tag');
  });

  beforeEach(() => {
    state.settings = { ...DEFAULT_SETTINGS };
  });

  it('matches explicit entity and tag terms without heuristic scoring', () => {
    expect(getClusterStoryGroup(cluster('nv', {
      entities: { people: ['Jensen Huangs'], orgs: [] },
    }))).toMatchObject({ id: 'nvidia', path: 'Technology / Hardware & Chipmakers / Nvidia' });

    expect(getClusterStoryGroup(cluster('gta', {
      tags: ['Gaming', 'GTA 6'],
    }))).toMatchObject({ id: 'gta-6', path: 'Gaming / Game Franchises / GTA / GTA 6' });
  });

  it('does not treat source or category tags as story groups', () => {
    const item = cluster('noise', {
      tags: ['bbc', 'urgent', 'gaming', 'xbox'],
      entities: { orgs: ['BBC'] },
    });
    expect(getClusterStoryGroup(item)).toBeNull();
  });

  it('partitions clusters into rollup containers plus an ungrouped tail', () => {
    const items = [
      cluster('plain-a'),
      cluster('gta', { tags: ['gta'] }),
      cluster('microsoft', { entities: { orgs: ['Microsoft'] } }),
      cluster('plain-b'),
      cluster('gta2', { tags: ['gta 6'] }),
    ];

    const grouping = groupClustersForFeed(items, true);
    // containers are ordered by their best member's feed position
    expect(grouping.groups[0].clusters.map(c => c.id)).toEqual(['gta', 'gta2']);
    expect(grouping.groups[1].clusters.map(c => c.id)).toEqual(['microsoft']);
    // member order inside a container preserves feed order
    expect(grouping.ungrouped.map(c => c.id)).toEqual(['plain-a', 'plain-b']);
    // disabled = no restructuring at all
    expect(groupClustersForFeed(items, false)).toBeNull();
  });
  it('groups russell brand under public-figure cases, not entertainment', () => {
    expect(getClusterStoryGroup(cluster('brand', {
      entities: { people: ['Russell Brand'], orgs: [] },
      tags: ['court'],
    }))).toMatchObject({ id: 'russell-brand', path: 'Crime & Justice / Public Figure Cases / Russell Brand' });

    expect(getClusterStoryGroup(cluster('walliams', {
      entities: { people: ['David Walliams'], orgs: [] },
    }))).toMatchObject({ id: 'british-comedy' });
  });

  it('keeps every related link pointed at a real node and pivots last', () => {
    const ids = new Set();
    const relatedPairs = [];
    const visit = (node) => {
      expect(ids.has(node.id), `duplicate node id ${node.id}`).toBe(false);
      ids.add(node.id);
      for (const link of node.related || []) relatedPairs.push([node.id, link.to]);
      (node.children || []).forEach(visit);
    };
    STORY_RELATION_TREE.forEach(visit);

    relatedPairs.forEach(([from, to]) => {
      expect(ids.has(to), `${from} relates to missing node ${to}`).toBe(true);
    });

    const lastRoot = STORY_RELATION_TREE[STORY_RELATION_TREE.length - 1];
    expect(lastRoot.pivot).toBe(true);
    expect(STORY_RELATION_TREE.slice(0, -1).every(root => !root.pivot)).toBe(true);
  });

  it('never labels individual tiles — the container header carries group identity', () => {
    const item = cluster('nv', { entities: { orgs: ['Nvidia'] } });
    const shell = renderArticleShell(item);
    expect(shell.dataset.groupId || '').toBe('');
    expect(shell.querySelector('.article-group-label')).toBeNull();

    state.settings.groupByTag = true;
    const grouped = renderArticleShell(item);
    expect(grouped.dataset.groupId || '').toBe('');
    expect(grouped.querySelector('.article-group-label')).toBeNull();
  });
});

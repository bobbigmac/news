import { describe, expect, it } from 'vitest';
import { canonicalCategory, classifyCategory, recategoriseCluster } from '../scripts/categories.js';
import { makeStoryData, prepareStoryForLLM } from '../scripts/cluster-copy.js';
import { annotateClustersIfMissing, buildEntityIndex } from '../scripts/entities.js';
import { extractJson } from '../scripts/extract-json.js';
import { enrichAllStories } from '../scripts/story-enrich.js';
import { dedupStories, normaliseUrl } from '../scripts/url-dedup.js';

describe('category pipeline', () => {
  it('canonicalises known category aliases', () => {
    expect(canonicalCategory('sports')).toBe('Sport');
    expect(canonicalCategory('personal finance')).toBe('Personal Finance');
    expect(canonicalCategory(['ENTERTAINMENT'])).toBe('Entertainment');
  });

  it('lets the deterministic graph correct a confident LLM category', () => {
    const item = {
      category: 'Technology',
      headline: 'Xbox Game Pass adds three new games',
      summary: 'The console subscription service adds new gameplay releases.',
      tags: ['gaming', 'xbox'],
      triggerWords: ['game pass'],
      stories: [{ title: 'New console games arrive on Game Pass' }],
    };

    const classified = classifyCategory(item);
    expect(classified.category).toBe('Gaming');
    expect(classified.score).toBeGreaterThanOrEqual(5);
    expect(recategoriseCluster(item)).toBe(true);
    expect(item.category).toBe('Gaming');
  });
});

describe('story preparation and enrichment', () => {
  it('carries a story from LLM input shape to enriched digest shape', () => {
    const raw = {
      id: 'story-1',
      title: 'Short item still enters the pipeline',
      description: 'Only three words.',
      content: '<p>Only three words.</p>',
      url: 'https://example.com/news/item',
      source: 'rss',
      sourceName: 'Example',
      image: '',
      published: new Date().toISOString(),
      category: 'sports',
      plugin: 'test-plugin',
      pluginPriority: 2,
    };

    const prepared = prepareStoryForLLM(raw);
    expect(prepared.text).toContain('Short item');
    expect(prepared.plugin).toBe('test-plugin');

    const stored = makeStoryData(prepared);
    expect(stored.id).toBe(raw.id);
    expect(stored.category).toBe('sport');
    expect(stored.bodyText).toBe('Only three words.');
    expect(stored.wordCount).toBe(3);
    expect(stored.storyType).toBe('news');
  });

  it('backfills blank source names from story URLs', () => {
    const digest = {
      clusters: [{
        stories: [{
          title: 'Sky item',
          url: 'https://news.sky.com/story/example-123',
          bodyText: 'Already enriched',
        }],
      }],
    };

    enrichAllStories(digest);
    expect(digest.clusters[0].stories[0].sourceName).toBe('Sky News');
  });
});

describe('entity indexing', () => {
  it('reuses entities already computed by the comprehend stage', () => {
    const entities = { people: [], places: ['manchester'], orgs: [] };
    const digest = { clusters: [{ id: 'c1', entities }] };

    annotateClustersIfMissing(digest);
    expect(digest.clusters[0].entities).toBe(entities);

    const index = buildEntityIndex(digest);
    expect(index.entities).toEqual([
      { name: 'manchester', type: 'places', clusterIds: ['c1'], count: 1 },
    ]);
  });
});

describe('deduplication and copy fallbacks', () => {
  it('normalises equivalent URLs before dropping duplicates', () => {
    expect(normaliseUrl('https://www.bbc.com/news/article-123.html?utm_source=x#frag'))
      .toBe('bbc.co.uk/news/article-123');

    const first = { id: 'a', url: 'https://www.bbc.com/news/article-123.html?utm_source=x' };
    const duplicate = { id: 'b', url: 'https://bbc.co.uk/news/article-123?at_campaign=rss' };
    const distinct = { id: 'c', url: 'https://bbc.co.uk/news/article-456' };
    const result = dedupStories([first, duplicate, distinct]);

    expect(result.items.map(item => item.id)).toEqual(['a', 'c']);
    expect(result.droppedByUrl).toBe(1);
  });

});

describe('source-derived copy', () => {
  it('never truncates or fabricates ellipses', async () => {
    const { fallbackClusterCopy, prepareStoryForLLM } = await import('../scripts/cluster-copy.js');
    const longDesc = 'The BBC understands the treaties contain a 10-year termination clause to reimburse costs of any need to rebuild border checks and this sentence runs well past two hundred characters to prove the point about artificial truncation being removed entirely.';
    const prepared = prepareStoryForLLM({
      id: 's1', title: 'UK government set to publish new treaties agreed with EU',
      description: longDesc, content: '', source: 'bbc', sourceName: 'BBC',
      url: 'https://bbc.co.uk/x', published: new Date().toISOString(),
    });
    expect(prepared.description).toBe(longDesc);
    expect(prepared.text).not.toContain('...');

    const copy = fallbackClusterCopy([prepared]);
    expect(copy.summary).not.toContain('...');
    expect(copy.summary).toContain(longDesc);
    expect(copy.summary.length).toBeGreaterThan(200);
    expect(copy.shortSummary).toBeUndefined();
  });
});

describe('LLM response extraction', () => {
  it('extracts and normalises a wrapped cluster response', () => {
    const response = [
      '<think>The model reasons first.</think>',
      '```json',
      '{"clusters":[{"id":"c1","headline":"Headline","summary":"Summary","story_ids":"s1,s2"}]}',
      '```',
    ].join('\n');
    const parsed = extractJson(response);
    expect(parsed.clusters).toHaveLength(1);
    expect(parsed.clusters[0]).toMatchObject({ id: 'c1', headline: 'Headline' });
    expect(parsed.clusters[0].story_ids).toEqual(['s1', 's2']);
  });
});

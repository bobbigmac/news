import { describe, expect, it } from 'vitest';
import { matchClusterToTree, assignStoryGroupsToDigest } from '../scripts/story-group-assign.js';

function cluster(overrides = {}) {
  return {
    id: 'c1',
    headline: overrides.headline || 'Test headline',
    tags: overrides.tags || [],
    keywords: overrides.keywords || [],
    triggerWords: overrides.triggerWords || [],
    entities: overrides.entities || {},
    stories: overrides.stories || [],
  };
}

describe('matchClusterToTree', () => {
  it('prefers the longest matching word-set over generic terms', () => {
    // "south china sea" vocab should beat bare "china"
    const match = matchClusterToTree(cluster({
      tags: ['south china', 'china', 'tensions'],
      headline: 'South China Sea tensions rise',
    }));
    expect(match).toBeTruthy();
    expect(match.words).toBeGreaterThanOrEqual(2);
    expect(match.path.join('/')).toContain('China');
  });

  it('matches morphological variants with light levenshtein (universities -> university)', () => {
    const match = matchClusterToTree(cluster({
      tags: ['universities', 'funding'],
    }));
    expect(match).toBeTruthy();
    expect(match.id).toContain('universit');
  });

  it('matches exact single words without fuzzy edits for short terms', () => {
    // "ai" must not fuzzy-match unrelated short words
    const match = matchClusterToTree(cluster({
      tags: ['al', 'an'],
    }));
    expect(match).toBeNull();
  });

  it('keeps digit tokens so "gta 6" stays two words', () => {
    const match = matchClusterToTree(cluster({
      tags: ['gta 6', 'rockstar'],
      headline: 'GTA 6 release date news',
    }));
    expect(match).toBeTruthy();
    expect(match.path.join('/')).toContain('GTA');
  });

  it('does not let hyphenated junk entities subset-match places', () => {
    // vocab entry ["nepal","china"] must not match the term "china"
    const match = matchClusterToTree(cluster({
      tags: ['flash floods', 'disaster'],
      entities: { places: ['Nepal', 'Nepal-China border'] },
      headline: 'Flash floods hit Nepal border region',
    }));
    if (match) {
      expect(match.path.join('/')).not.toContain('China');
    }
  });

  it('specific multi-word pivot matches beat generic one-word primary matches', () => {
    // flood vocab should route to weather even when a primary also matches weakly
    const match = matchClusterToTree(cluster({
      tags: ['flash floods', 'china'],
      headline: 'Flash floods hit southern China',
    }));
    expect(match).toBeTruthy();
    // two-word "flash flood" is more specific than one-word "china"
    expect(match.words).toBe(2);
    expect(match.path.join('/')).toContain('Weather');
  });

  it('returns null for noise-only vocab', () => {
    const match = matchClusterToTree(cluster({
      tags: ['you', 'your', 'the'],
    }));
    expect(match).toBeNull();
  });
});

describe('assignStoryGroupsToDigest', () => {
  it('assigns storyGroup onto clusters in place and returns stats', () => {
    const digest = {
      clusters: [
        cluster({ id: 'a', tags: ['gta 6'], headline: 'GTA 6 news' }),
        cluster({ id: 'b', tags: ['xyzzy nonsense'] }),
      ],
    };
    const stats = assignStoryGroupsToDigest(digest);
    expect(stats.total).toBe(2);
    expect(stats.assigned).toBe(1);
    expect(digest.clusters[0].storyGroup.id).toBeTruthy();
    expect(digest.clusters[0].storyGroup.path).toBeInstanceOf(Array);
    expect(digest.clusters[1].storyGroup).toBeUndefined();
  });
});

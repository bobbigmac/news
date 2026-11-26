import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { SOURCE_PROFILES } from '../src/source-profiles.js';
import { SOURCE_RELATION_TREE } from '../src/source-tree.js';

const treeHosts = new Set();
const visit = (node) => {
  node.sources?.forEach((host) => treeHosts.add(host));
  node.children?.forEach(visit);
};
SOURCE_RELATION_TREE.forEach(visit);

describe('relationships page', () => {
  it('is linked from the feed and included in the build', () => {
    const index = readFileSync('src/index.html', 'utf8');
    const viteConfig = readFileSync('vite.config.js', 'utf8');
    const page = readFileSync('src/relationships.html', 'utf8');

    expect(index).toContain('<a class="settings-link" href="./relationships.html">Source Relationships</a>');
    expect(index).toContain('<a href="./relationships.html">Source relationships</a>');
    expect(viteConfig).toContain('relationships');
    expect(page).toContain('id="relationships-main"');
    expect(page).toContain('id="source-search"');
  });

  it('never talks about the dataset or methodology — readers get relationships, not internals', () => {
    const page = readFileSync('src/relationships.html', 'utf8').toLowerCase();
    const script = readFileSync('src/relationships.js', 'utf8');
    // the page is about who outlets are and how they connect; allocation
    // mechanics, controls, and dataset framing belong in docs/, never here
    for (const banned of ['dataset', 'allocator', 'control', 'digest', 'methodolog']) {
      expect(page, `html contains "${banned}"`).not.toContain(banned);
    }
    // static content: no digest fetch at all
    expect(script).not.toContain('digest.json');
    expect(script).not.toContain('assignStoryGroups');
    expect(script).not.toContain('groupSourceOptions');
  });

  it('keeps researched profiles inside the curated source tree', () => {
    const missing = Object.keys(SOURCE_PROFILES).filter((host) => !treeHosts.has(host));
    expect(missing).toEqual([]);
  });

  it('gives every profile a kind plus at least one descriptive property', () => {
    Object.entries(SOURCE_PROFILES).forEach(([host, profile]) => {
      expect(profile.kind, host).toBeTruthy();
      const descriptive = profile.properties?.length ||
        profile.leaning || profile.watch?.length || profile.history ||
        profile.caution?.length || profile.links?.length;
      expect(descriptive, host).toBeTruthy();
    });
  });
});

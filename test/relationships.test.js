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

  it('requires multiple independent references for every trust flag', () => {
    // A flag is an accusation of compromised independence — one citation is
    // never enough evidence, no matter how trustworthy the citing outlet.
    Object.entries(SOURCE_PROFILES).forEach(([host, profile]) => {
      for (const flag of profile.flags || []) {
        expect(flag.label, `${host} flag label`).toBeTruthy();
        expect(flag.note, `${host} flag note`).toBeTruthy();
        expect(flag.links?.length, `${host} flag "${flag.label}" must cite 2+ independent references`).toBeGreaterThanOrEqual(2);
        for (const link of flag.links) {
          expect(link.label, host).toBeTruthy();
          expect(link.url, host).toMatch(/^https:\/\//);
        }
      }
    });
  });

  it('keeps state-directed outlets in the state-media family, not among public broadcasters', () => {
    const publicRoot = SOURCE_RELATION_TREE.find((root) => root.id === 'public-international');
    const publicHosts = new Set();
    const collect = (node) => {
      node.sources?.forEach((host) => publicHosts.add(host));
      node.children?.forEach(collect);
    };
    collect(publicRoot);
    for (const host of ['rt-english.com', 'tass.com', 'cgtn.com', 'news.cgtn.com', 'eng.belta.by', 'prensa-latina.cu', 'trtworld.com', 'aa.com.tr', 'uatv.ua', 'aljazeera.com']) {
      expect(publicHosts.has(host), `${host} must not sit among public-service media`).toBe(false);
    }
  });

  it('places RT within both the nationalist-media family and a russian group', () => {
    const stateRoot = SOURCE_RELATION_TREE.find((root) => root.id === 'state-media');
    expect(stateRoot).toBeTruthy();
    expect(stateRoot.label).toMatch(/nationalist/i);
    const russian = stateRoot.children.find((child) => /russia/i.test(child.label));
    expect(russian).toBeTruthy();
    expect(russian.sources).toContain('rt-english.com');
  });

  it('cross-files CGTN in both state media and China media so the also-links connect them', () => {
    const memberships = [];
    const walk = (node, path) => {
      const next = [...path, node.label];
      if (node.sources?.includes('cgtn.com')) memberships.push(next.join(' / '));
      node.children?.forEach((child) => walk(child, next));
    };
    SOURCE_RELATION_TREE.forEach((root) => walk(root, []));
    expect(memberships.length).toBeGreaterThanOrEqual(2);
  });

  it('profiles every state-media outlet', () => {
    const stateRoot = SOURCE_RELATION_TREE.find((root) => root.id === 'state-media');
    const hosts = new Set();
    const collect = (node) => {
      node.sources?.forEach((host) => hosts.add(host));
      node.children?.forEach(collect);
    };
    collect(stateRoot);
    const missing = [...hosts].filter((host) => !SOURCE_PROFILES[host]);
    expect(missing).toEqual([]);
  });
});

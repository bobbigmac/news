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

  it('places RT in a Russian state-controlled group', () => {
    const stateRoot = SOURCE_RELATION_TREE.find((root) => root.id === 'state-media');
    expect(stateRoot).toBeTruthy();
    expect(stateRoot.label).toMatch(/state-controlled|state-linked/i);
    const findNode = (node, predicate) => {
      if (predicate(node)) return node;
      for (const child of node.children || []) {
        const found = findNode(child, predicate);
        if (found) return found;
      }
      return null;
    };
    const russian = findNode(stateRoot, (node) => /russia/i.test(node.label));
    expect(russian).toBeTruthy();
    expect(russian.sources).toContain('rt-english.com');
  });

  it('separates direct control, state linkage, and state funding', () => {
    const stateRoot = SOURCE_RELATION_TREE.find((root) => root.id === 'state-media');
    const findNode = (node, id) => {
      if (node.id === id) return node;
      for (const child of node.children || []) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    };
    const collectHosts = (node, hosts = new Set()) => {
      node.sources?.forEach((host) => hosts.add(host));
      node.children?.forEach((child) => collectHosts(child, hosts));
      return hosts;
    };
    const direct = collectHosts(findNode(stateRoot, 'direct-state-control'));
    const linked = collectHosts(findNode(stateRoot, 'state-linked-agencies'));
    const funded = collectHosts(findNode(stateRoot, 'state-funded-networks'));

    for (const host of ['rt-english.com', 'tass.com', 'cgtn.com', 'news.cgtn.com', 'eng.belta.by', 'prensa-latina.cu', 'trtworld.com', 'uatv.ua']) {
      expect(direct.has(host), `${host} belongs in direct state control`).toBe(true);
      expect(linked.has(host), `${host} must not sit in state-linked agencies`).toBe(false);
      expect(funded.has(host), `${host} must not sit in state-funded networks`).toBe(false);
    }
    expect(linked.has('aa.com.tr')).toBe(true);
    expect(funded.has('aljazeera.com')).toBe(true);
    expect(direct.has('aa.com.tr')).toBe(false);
    expect(direct.has('aljazeera.com')).toBe(false);
    expect(linked.has('aljazeera.com')).toBe(false);
    expect(funded.has('aa.com.tr')).toBe(false);
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

  it('flags Al Jazeera and Anadolu as distinct state-influence cases', () => {
    const alJazeeraFlag = SOURCE_PROFILES['aljazeera.com'].flags?.[0];
    expect(alJazeeraFlag.label).toMatch(/state-funded/i);
    expect(alJazeeraFlag.note).toMatch(/not automatic equivalence|not.*equivalence/i);
    expect(alJazeeraFlag.note).toMatch(/criticising Qatari government policy/i);

    const anadoluFlag = SOURCE_PROFILES['aa.com.tr'].flags?.[0];
    expect(anadoluFlag.label).toMatch(/state-linked/i);
    expect(anadoluFlag.note).toContain('47.75%');
    expect(anadoluFlag.note).toContain('Presidency Directorate of Communications');
  });

  it('separates Fox News, Fox local stations, and News Corp print properties', () => {
    const findNode = (node, id) => {
      if (node.id === id) return node;
      for (const child of node.children || []) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    };
    const findInRoots = (id) => SOURCE_RELATION_TREE.map((root) => findNode(root, id)).find(Boolean);
    const foxNews = findInRoots('fox-news-media');
    const foxStations = findInRoots('fox-television-stations');
    const newsCorpPrint = findInRoots('news-corp-print');
    const affiliates = findInRoots('fox-affiliated-local');
    const nexstar = findInRoots('nexstar');

    expect(foxNews.sources).toEqual(['foxnews.com', 'foxbusiness.com', 'foxnation.com']);
    expect(newsCorpPrint.sources).toContain('nypost.com');
    expect(newsCorpPrint.sources).toContain('pagesix.com');
    expect(foxNews.sources).not.toContain('nypost.com');
    expect(foxNews.sources).not.toContain('pagesix.com');

    expect(foxStations.sources).toContain('fox5ny.com');
    expect(foxNews.sources).not.toContain('fox5ny.com');
    expect(affiliates.sources).toContain('fox2now.com');
    expect(affiliates.sources).not.toContain('fox5ny.com');
    for (const host of ['fox2now.com', 'fox40.com', 'fox59.com', 'fox5sandiego.com']) {
      expect(nexstar.sources, `${host} is Nexstar-owned`).toContain(host);
      expect(foxNews.sources, `${host} is not Fox News`).not.toContain(host);
    }
  });

  it('keeps commercial-publisher concerns proportional rather than disqualifying', () => {
    const foxFlag = SOURCE_PROFILES['foxnews.com'].flags?.find((flag) => /election claims/i.test(flag.label));
    expect(foxFlag.note).toContain('actual-malice element remained for trial');
    expect(foxFlag.note).toContain('does not invalidate every Fox report');

    const mailFlag = SOURCE_PROFILES['dailymail.com'].flags?.find((flag) => /complaint volume/i.test(flag.label));
    expect(mailFlag.note).toContain('491');
    expect(mailFlag.note).toContain('231');
    expect(mailFlag.note).toContain('not equivalent to 491 upheld complaints');

    const expressFlag = SOURCE_PROFILES['express.co.uk'].flags?.find((flag) => /in-remit complaint count/i.test(flag.label));
    expect(expressFlag.note).toContain('1,366');
    expect(expressFlag.note).toContain('not a claim that every complaint was valid');

    expect(SOURCE_PROFILES['nypost.com'].watch.join(' ')).toContain('separate publicly traded companies since 2013');
    expect(SOURCE_PROFILES['pagesix.com'].watch.join(' ')).toContain('not Fox News');
  });

  it('distinguishes institutional science releases from journals and editorial science news', () => {
    const findNode = (node, id) => {
      if (node.id === id) return node;
      for (const child of node.children || []) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    };
    const findInRoots = (id) => SOURCE_RELATION_TREE.map((root) => findNode(root, id)).find(Boolean);
    const releases = findInRoots('institutional-research-releases');
    const journals = findInRoots('science-journals');
    const popular = findInRoots('popular-science-news');

    expect(releases.sources).toEqual(['sciencedaily.com', 'futurity.org']);
    expect(journals.sources).toContain('nature.com');
    expect(journals.sources).not.toContain('sciencedaily.com');
    expect(popular.sources).toContain('sciencealert.com');
    expect(popular.sources).not.toContain('sciencedaily.com');

    const scienceDailyFlag = SOURCE_PROFILES['sciencedaily.com'].flags?.[0];
    expect(scienceDailyFlag.label).toMatch(/press material/i);
    expect(scienceDailyFlag.note).toContain('tries not to make substantive edits');
    expect(scienceDailyFlag.note).toContain('not proof that any individual article is false');

    const futurityFlag = SOURCE_PROFILES['futurity.org'].flags?.[0];
    expect(futurityFlag.note).toContain('content submitted by member universities');
    expect(futurityFlag.note).toContain('rather than independent science journalism');

    expect(SOURCE_PROFILES['nature.com'].watch.join(' ')).toContain('not itself peer-reviewed research');
    expect(SOURCE_PROFILES['phys.org'].watch.join(' ')).toContain('not the same thing as independent scientific verification');
  });
});

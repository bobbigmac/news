import { getFaviconSpriteClass } from './favicon-sprite.js';
import { allocateTreeGroups } from './group-tree.js';
import { BRANCH_PROFILES, SOURCE_PROFILES } from './source-profiles.js';
import { groupSourceOptions, OTHER_SOURCE_KEY } from './source-groups.js';
import { SOURCE_RELATION_TREE } from './source-tree.js';
import { assignStoryGroups } from './story-groups.js';
import { STORY_RELATION_TREE } from './story-tree.js';
import { prettifySourceKey, sourceKeyFromUrl } from './view-model.js';

const PROFILE_FIELD_LABELS = {
  kind: 'Type',
  ownership: 'Ownership',
  governance: 'Governance',
  leaning: 'Editorial context',
  history: 'History',
  model: 'Model',
  notes: 'Notes',
};
const PROFILE_LIST_LABELS = {
  properties: 'Properties',
  shared: 'Shared links',
  watch: 'Read carefully',
  caution: 'Read carefully',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendLinkList(container, links) {
  if (!links?.length) return;
  const list = el('ul', 'profile-links');
  for (const link of links) {
    const item = el('li');
    const anchor = el('a', '', link.label);
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    item.appendChild(anchor);
    list.appendChild(item);
  }
  container.appendChild(list);
}

function appendProfile(container, profile, emptyText) {
  if (!profile) {
    container.appendChild(el('p', 'profile-empty', emptyText));
    return;
  }
  const body = el('div', 'source-profile');

  for (const [field, label] of Object.entries(PROFILE_FIELD_LABELS)) {
    if (!profile[field]) continue;
    const row = el('p', 'profile-field');
    row.appendChild(el('strong', '', `${label}: `));
    row.appendChild(document.createTextNode(profile[field]));
    body.appendChild(row);
  }

  for (const [field, label] of Object.entries(PROFILE_LIST_LABELS)) {
    if (!profile[field]?.length) continue;
    const row = el('div', 'profile-field');
    row.appendChild(el('strong', '', label));
    const list = el('ul', 'profile-list');
    for (const value of profile[field]) list.appendChild(el('li', '', value));
    row.appendChild(list);
    body.appendChild(row);
  }

  appendLinkList(body, profile.links);
  container.appendChild(body);
}

function collectSources(digest) {
  const sources = new Map();
  for (const cluster of digest.clusters || []) {
    for (const story of cluster.stories || []) {
      const key = sourceKeyFromUrl(story.url);
      if (!key) continue;
      if (!sources.has(key)) {
        sources.set(key, {
          key,
          label: story.sourceName || prettifySourceKey(key),
          count: 0,
          clusterCount: 0,
        });
      }
      sources.get(key).count++;
    }
    const seen = new Set((cluster.stories || []).map(story => sourceKeyFromUrl(story.url)).filter(Boolean));
    for (const key of seen) {
      if (sources.has(key)) sources.get(key).clusterCount++;
    }
  }
  return [...sources.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function relationPaths(sourceKey, node, parentPath = []) {
  const path = [...parentPath, node.label];
  const matches = [];
  if ((node.sources || []).includes(sourceKey)) matches.push(path.join(' / '));
  for (const child of node.children || []) matches.push(...relationPaths(sourceKey, child, path));
  return matches;
}

function allRelationPaths(sourceKey) {
  return SOURCE_RELATION_TREE.flatMap(root => relationPaths(sourceKey, root));
}

function renderSourceIcon(container, key) {
  const spriteClass = getFaviconSpriteClass(key);
  if (spriteClass) {
    container.appendChild(el('span', `source-sprite ${spriteClass}`));
    return;
  }
  container.appendChild(el('span', 'relationship-letter', (key || '?').charAt(0).toUpperCase()));
}

function renderSourceCard(source) {
  const card = el('article', 'source-card');
  card.dataset.search = `${source.key} ${source.label} ${allRelationPaths(source.key).join(' ')}`.toLowerCase();

  const head = el('header', 'source-card-head');
  renderSourceIcon(head, source.key);
  const title = el('div', 'source-card-title');
  title.appendChild(el('h4', '', source.label));
  title.appendChild(el('code', 'source-key', source.key));
  head.appendChild(title);
  head.appendChild(el('span', 'story-count', `${source.count} stories`));
  card.appendChild(head);

  const memberships = allRelationPaths(source.key);
  if (memberships.length) {
    const list = el('ul', 'membership-list');
    for (const membership of memberships) list.appendChild(el('li', '', membership));
    card.appendChild(list);
  }

  appendProfile(card, SOURCE_PROFILES[source.key], 'Research note pending. The memberships above are the current curated relations.');
  return card;
}

function renderSourceGroup(group) {
  const isIndividual = !group.grouped;
  const section = el('section', `relation-group${isIndividual ? ' individual-source' : ''}`);
  const path = isIndividual ? 'Individual / Ungrouped' : group.path.join(' / ');
  section.dataset.search = `${group.key} ${group.label} ${path} ${(group.sourceKeys || []).join(' ')}`.toLowerCase();

  const head = el('header', 'relation-group-head');
  renderSourceIcon(head, group.icon || group.key);
  const title = el('div');
  title.appendChild(el('h3', '', group.label));
  title.appendChild(el('p', 'group-path', path));
  head.appendChild(title);
  head.appendChild(el('span', 'story-count', `${group.count} stories`));
  section.appendChild(head);

  appendProfile(
    section,
    BRANCH_PROFILES[group.rootId] || BRANCH_PROFILES[group.groupId],
    isIndividual
      ? 'This host has enough current volume for its own control, but no curated branch note yet.'
      : 'This allocated branch has no branch-level note yet.',
  );

  const details = el('details', 'source-members');
  details.appendChild(el('summary', '', `${group.sourceCount || 1} source${group.sourceCount === 1 ? '' : 's'} in this branch`));
  const members = el('div', 'source-member-list');
  for (const source of group.sources || [group]) members.appendChild(renderSourceCard(source));
  details.appendChild(members);
  section.appendChild(details);
  return section;
}

const storyNodeIndex = new Map();
const indexStoryNode = (node, parentPath = []) => {
  const path = [...parentPath, node.label];
  storyNodeIndex.set(node.id, { node, path });
  for (const child of node.children || []) indexStoryNode(child, path);
};
STORY_RELATION_TREE.forEach(root => indexStoryNode(root));

function renderStoryNode(node) {
  const item = el('li', 'story-node');
  const details = el('details', '', node.label);
  if ((node.children || []).length || (node.terms || []).length) {
    const summary = el('summary');
    summary.appendChild(el('strong', '', node.label));
    if (node.pivot) summary.appendChild(el('span', 'pivot-badge', 'pivot'));
    details.appendChild(summary);
  } else {
    details.replaceChildren(el('strong', '', node.label));
  }
  if (node.terms?.length) {
    const terms = el('p', 'story-terms', node.terms.join(' · '));
    details.appendChild(terms);
  }
  if (node.related?.length) {
    const related = el('ul', 'story-related');
    for (const link of node.related) {
      const target = storyNodeIndex.get(link.to);
      const item = el('li');
      item.appendChild(el('strong', '', `See also: ${target ? target.path.join(' / ') : link.to}`));
      if (link.note) item.appendChild(document.createTextNode(` — ${link.note}`));
      related.appendChild(item);
    }
    details.appendChild(related);
  }
  if (node.children?.length) {
    const list = el('ul', 'story-tree');
    for (const child of node.children) list.appendChild(renderStoryNode(child));
    details.appendChild(list);
  }
  item.appendChild(details);
  return item;
}

function renderStoryGroups(digest) {
  const container = document.getElementById('story-group-list');
  if (!container) return;
  const { groups } = assignStoryGroups(digest.clusters || []);
  container.replaceChildren();
  for (const group of groups) {
    const item = el('li', 'allocated-story-group');
    item.appendChild(el('strong', '', group.path.join(' / ')));
    item.appendChild(el('span', 'story-count', `${group.weight} clusters`));
    container.appendChild(item);
  }
}

function renderStoryTree() {
  const container = document.getElementById('story-tree');
  if (!container) return;
  container.replaceChildren();
  const list = el('ul', 'story-tree story-roots');
  for (const root of STORY_RELATION_TREE) list.appendChild(renderStoryNode(root));
  container.appendChild(list);
}

function bindSourceSearch() {
  const input = document.getElementById('source-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    for (const group of document.querySelectorAll('.relation-group')) {
      const cards = [...group.querySelectorAll('.source-card')];
      const matching = cards.filter(card => !query || card.dataset.search.includes(query));
      cards.forEach(card => card.classList.toggle('is-hidden', !matching.includes(card)));
      const groupMatches = !query || group.dataset.search.includes(query) || matching.length > 0;
      group.classList.toggle('is-hidden', !groupMatches);
      const details = group.querySelector('details');
      if (details) details.open = !!query && matching.length > 0;
    }
  });
}

async function init() {
  const status = document.getElementById('relationship-status');
  try {
    const response = await fetch('./digest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`digest.json returned ${response.status}`);
    const digest = await response.json();
    const sources = collectSources(digest);
    const grouped = groupSourceOptions(sources, {});
    const profiled = sources.filter(source => SOURCE_PROFILES[source.key]).length;

    const stats = document.getElementById('source-stats');
    stats.replaceChildren(
      el('span', '', `${sources.length} source hosts`),
      el('span', '', `${grouped.options.length} current controls`),
      el('span', '', `${grouped.otherSourceKeys.size} hosts in Other`),
      el('span', '', `${profiled} hosts with research notes`),
    );

    const groupsContainer = document.getElementById('source-groups');
    groupsContainer.replaceChildren(...grouped.options.map(renderSourceGroup));
    renderStoryGroups(digest);
    renderStoryTree();
    bindSourceSearch();
    status.textContent = '';
  } catch (error) {
    status.textContent = `Could not load digest data: ${error.message}`;
  }
}

init();

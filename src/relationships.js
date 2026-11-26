import { getFaviconSpriteClass } from './favicon-sprite.js';
import { BRANCH_PROFILES, SOURCE_PROFILES } from './source-profiles.js';
import { SOURCE_RELATION_TREE } from './source-tree.js';
import { prettifySourceKey } from './view-model.js';

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

// Cross-membership index: one outlet can sit in several families (a wire
// that's also a co-op, a broadcaster that's also a platform). Collected once
// so each outlet row can link to its other families' sections on the page.
const membershipsByHost = new Map();
function indexMemberships(node, path = []) {
  const nextPath = [...path, node.label];
  for (const host of node.sources || []) {
    if (!membershipsByHost.has(host)) membershipsByHost.set(host, []);
    membershipsByHost.get(host).push({ path: nextPath.join(' / '), label: node.label, anchor: anchorForPath(nextPath) });
  }
  for (const child of node.children || []) indexMemberships(child, nextPath);
}

function anchorForPath(path) {
  return 'rel-' + path.map(part => String(part).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).join('--');
}

function countDescendantHosts(node) {
  let count = (node.sources || []).length;
  for (const child of node.children || []) count += countDescendantHosts(child);
  return count;
}

for (const root of SOURCE_RELATION_TREE) indexMemberships(root);

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

function appendProfileBody(container, profile) {
  if (profile.flags?.length) {
    for (const flag of profile.flags) {
      const block = el('div', 'profile-flag');
      block.appendChild(el('strong', 'profile-flag-label', `⚑ ${flag.label}`));
      block.appendChild(el('p', 'profile-flag-note', flag.note));
      appendLinkList(block, flag.links);
      container.appendChild(block);
    }
  }
  for (const [field, label] of Object.entries(PROFILE_FIELD_LABELS)) {
    if (!profile[field]) continue;
    const row = el('p', 'profile-field');
    row.appendChild(el('strong', '', `${label}: `));
    row.appendChild(document.createTextNode(profile[field]));
    container.appendChild(row);
  }
  for (const [field, label] of Object.entries(PROFILE_LIST_LABELS)) {
    if (!profile[field]?.length) continue;
    const row = el('div', 'profile-field');
    row.appendChild(el('strong', '', label));
    const list = el('ul', 'profile-list');
    for (const value of profile[field]) list.appendChild(el('li', '', value));
    row.appendChild(list);
    container.appendChild(row);
  }
  appendLinkList(container, profile.links);
}

function renderSourceIcon(container, key) {
  const spriteClass = getFaviconSpriteClass(key);
  if (spriteClass) {
    container.appendChild(el('span', `source-sprite ${spriteClass}`));
    return;
  }
  container.appendChild(el('span', 'relationship-letter', (key || '?').charAt(0).toUpperCase()));
}

function renderOutletCard(host, currentPath) {
  const profile = SOURCE_PROFILES[host];
  const card = el(profile ? 'details' : 'div', 'source-card');
  const memberships = membershipsByHost.get(host) || [];
  const others = memberships.filter(m => m.path !== currentPath);
  const searchText = [host, prettifySourceKey(host), ...memberships.map(m => m.path)];
  if (profile) {
    for (const value of Object.values(profile)) {
      if (typeof value === 'string') searchText.push(value);
      else if (Array.isArray(value)) searchText.push(...value.filter(v => typeof v === 'string'));
    }
  }
  card.dataset.search = searchText.join(' ').toLowerCase().replace(/-/g, ' ');

  // Collapsed by default: icon + name is the whole visible row. The profile
  // only renders when the reader opens it, so thin rows cost one line each
  // and no space is wasted beside dense rows.
  const summary = el(profile ? 'summary' : 'div', 'source-card-head');
  renderSourceIcon(summary, host);
  const title = el('div', 'source-card-title');
  title.appendChild(el('h4', '', prettifySourceKey(host)));
  title.appendChild(el('code', 'source-key', host));
  summary.appendChild(title);
  if (profile?.flags?.length) {
    const flagRow = el('span', 'source-flag-row');
    for (const flag of profile.flags) {
      const chip = el('span', 'source-flag', flag.label);
      chip.setAttribute('role', 'img');
      chip.title = flag.note;
      flagRow.appendChild(chip);
    }
    summary.appendChild(flagRow);
  }
  card.appendChild(summary);

  if (others.length) {
    const also = el('p', 'also-member');
    also.appendChild(el('strong', '', 'Also: '));
    others.forEach((m, i) => {
      if (i) also.appendChild(document.createTextNode(' · '));
      const link = el('a', '', m.label);
      link.href = `#${m.anchor}`;
      also.appendChild(link);
    });
    card.appendChild(also);
  }

  if (profile) {
    const body = el('div', 'source-profile');
    appendProfileBody(body, profile);
    card.appendChild(body);
  }
  return card;
}

function renderBranchProfile(profile) {
  const note = el('div', 'branch-note');
  if (profile.summary) note.appendChild(el('p', 'branch-summary', profile.summary));
  if (profile.watch?.length) {
    const watch = el('ul', 'branch-watch');
    for (const item of profile.watch) watch.appendChild(el('li', '', item));
    note.appendChild(watch);
  }
  appendLinkList(note, profile.links);
  return note;
}

// Renders one tree node as a family section: its research note, its own
// outlets, then child families nested inside.
function renderFamily(node, path, searchContext = '') {
  const pathParts = [...path, node.label];
  const currentPath = pathParts.join(' / ');
  const section = el('section', 'relation-group');
  section.id = anchorForPath(pathParts);
  const hostList = node.sources || [];
  const ownContext = `${searchContext} ${node.id} ${node.label}`.replace(/[-/]/g, ' ');
  section.dataset.search = `${ownContext} ${hostList.join(' ')}`.toLowerCase();

  const head = el('header', 'relation-group-head');
  if (node.icon) renderSourceIcon(head, node.icon);
  const title = el('div');
  // A group whose label collides with its members' names (the BBC group whose
  // members are all BBC outlets) reads as a collection, not as one outlet:
  // "BBC Sources". The count makes the group nature explicit everywhere.
  const memberNames = hostList.map(h => prettifySourceKey(h).toLowerCase());
  const collides = memberNames.includes(String(node.label).toLowerCase())
    || (path.length && String(node.label).toLowerCase() === String(path[path.length - 1]).toLowerCase());
  const total = countDescendantHosts(node);
  const heading = el('h3', '', collides ? `${node.label} Sources` : node.label);
  if (total) heading.appendChild(el('span', 'group-count', String(total)));
  title.appendChild(heading);
  head.appendChild(title);
  section.appendChild(head);

  const profile = BRANCH_PROFILES[node.id];
  if (profile) section.appendChild(renderBranchProfile(profile));

  if (hostList.length) {
    const members = el('div', 'source-member-list');
    for (const host of hostList) members.appendChild(renderOutletCard(host, currentPath));
    section.appendChild(members);
  }

  for (const child of node.children || []) {
    section.appendChild(renderFamily(child, [...path, node.label], ownContext));
  }
  return section;
}

function renderAll() {
  const main = document.getElementById('relationships-main');
  const sections = [];
  for (const root of SOURCE_RELATION_TREE) {
    const section = el('section', 'relationship-section');
    const familyHead = el('div', 'family-head');
    familyHead.appendChild(el('h2', '', root.label));
    section.appendChild(familyHead);
    const rootProfile = BRANCH_PROFILES[root.id];
    if (rootProfile) section.appendChild(renderBranchProfile(rootProfile));

    const body = el('div', 'source-groups');
    if ((root.children || []).length) {
      for (const child of root.children) body.appendChild(renderFamily(child, [root.label], `${root.id} ${root.label}`.replace(/[-/]/g, ' ')));
    } else {
      body.appendChild(renderFamily(root, []));
    }
    section.appendChild(body);
    sections.push(section);
  }
  main.replaceChildren(...sections);
}

function bindSourceSearch() {
  const input = document.getElementById('source-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase().replace(/-/g, ' ');
    for (const group of document.querySelectorAll('.relation-group')) {
      const cards = [...group.querySelectorAll(':scope > .source-member-list > .source-card')];
      const selfMatches = !query || group.dataset.search.includes(query);
      const matching = cards.filter(card => selfMatches || card.dataset.search.includes(query));
      cards.forEach(card => {
        const show = matching.includes(card);
        card.classList.toggle('is-hidden', !show);
        // A row that matched the query opens so the match is visible in context.
        if (show && query && !selfMatches && card.dataset.search.includes(query)) card.open = true;
      });
      group.classList.toggle('is-hidden', !(selfMatches || matching.length > 0));
    }
    for (const section of document.querySelectorAll('.relationship-section')) {
      const visible = [...section.querySelectorAll('.relation-group')].some(group => !group.classList.contains('is-hidden'));
      section.classList.toggle('is-hidden', !visible);
    }
  });
}

renderAll();
bindSourceSearch();

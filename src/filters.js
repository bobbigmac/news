import { getFaviconSpriteClass } from './favicon-sprite.js';
import {
  clearCategoryInclude,
  clearSourceInclude,
  toggleCategoryInclude,
  toggleSourceInclude,
  ui,
} from './state.js';

// Volume buckets are derived from the actual control counts, not absolute
// numbers: a digest with thousands of stories and one with a hundred both
// split into readable tiers. Icons carry no per-source count badge — the
// exact count is in the tooltip, and each bucket cluster gets one label.
function bucketBounds(counts) {
  const max = counts[0] || 0;
  const bounds = [];
  let edge = Math.floor(max / 4);
  while (edge >= 4 && bounds.length < 3) {
    if (!bounds.length || edge < bounds[bounds.length - 1]) bounds.push(edge);
    edge = Math.floor(edge / 4);
  }
  return bounds;
}

function bucketIndex(count, bounds) {
  for (let i = 0; i < bounds.length; i++) {
    if (count >= bounds[i]) return i;
  }
  return bounds.length;
}

function bucketLabel(index, bounds) {
  if (index < bounds.length) return `${bounds[index]}+`;
  return 'few';
}

export function renderSourceBar(model) {
  const container = document.getElementById('source-toggles');
  if (!container) return;
  container.innerHTML = '';

  const sources = (model?.sourceOptions || []).filter(source => source.count > 0);
  const includeActive = model?.sourceIncludeActive === true;
  const bounds = bucketBounds(sources.map(source => source.count));
  let lastBucket = -1;

  // ALL sits before the first volume chip: the explicit "no filter" control.
  // It reads active when nothing is filtered and clicking it drops whatever
  // selection is set, so the reset path is visible before you need it.
  const all = document.createElement('button');
  all.type = 'button';
  all.className = 'source-all';
  all.textContent = 'ALL';
  all.classList.toggle('is-active', !includeActive);
  all.disabled = !includeActive;
  all.title = includeActive
    ? 'Clear the source selection — show everything again'
    : 'Showing everything — click any source icon to filter';
  all.setAttribute('aria-label', 'Show stories from all sources');
  all.setAttribute('aria-pressed', String(!includeActive));
  all.addEventListener('click', () => {
    clearSourceInclude();
    ui.refresh();
  });
  container.appendChild(all);

  for (const source of sources) {
    const bucket = bucketIndex(source.count, bounds);
    if (bounds.length && bucket !== lastBucket) {
      const chip = document.createElement('span');
      chip.className = 'source-bucket';
      chip.textContent = bucketLabel(bucket, bounds);
      chip.title = 'Source volume tier — icons are grouped by how many stories they currently hold';
      container.appendChild(chip);
      lastBucket = bucket;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'source-toggle';
    btn.dataset.source = source.key;
    const included = source.included === true;
    btn.classList.toggle('is-dimmed', includeActive && !included);
    btn.setAttribute('aria-pressed', String(included));
    btn.setAttribute(
      'aria-label',
      `${included ? 'Stop filtering to' : 'Show only'} ${source.label} (${source.count} stories)`,
    );
    btn.title = source.grouped
      ? `${source.path.join(' / ')} — ${source.count} stories across ${source.sourceCount} sources in the current pool`
      : `${source.label} — ${source.count} stories in the current pool`;

    const letter = document.createElement('span');
    letter.className = 'source-letter';
    letter.textContent = (source.label || source.key || '?').trim().charAt(0).toUpperCase() || '?';
    btn.appendChild(letter);

    const spriteClass = getFaviconSpriteClass(source.icon || source.key);
    if (spriteClass) {
      const icon = document.createElement('span');
      icon.className = `source-sprite ${spriteClass}`;
      icon.setAttribute('aria-hidden', 'true');
      btn.appendChild(icon);
    }

    btn.addEventListener('click', () => {
      toggleSourceInclude(source.key);
      ui.refresh();
    });

    container.appendChild(btn);
  }

}

export function renderCategoryFilterBar(model) {
  const container = document.getElementById('category-filters');
  if (!container) return;
  container.innerHTML = '';

  const row = container.closest('.category-filter-row');
  if (!model?.categoryRowEnabled) {
    container.classList.add('is-disabled');
    row?.classList.add('hidden');
    return;
  }
  container.classList.remove('is-disabled');
  row?.classList.remove('hidden');

  const categories = model.categoryOptions || [];
  const includeActive = model.categoryIncludeActive === true;

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'category-filter-toggle category-all-toggle';
  allBtn.classList.toggle('is-included', false);
  allBtn.classList.toggle('is-off', includeActive);
  allBtn.setAttribute('aria-pressed', String(!includeActive));
  allBtn.title = 'Show all categories';
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => {
    clearCategoryInclude();
    ui.refresh();
  });
  container.appendChild(allBtn);

  for (const category of categories) {
    const included = category.included === true;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-filter-toggle';
    btn.classList.toggle('is-included', included);
    btn.classList.toggle('is-off', includeActive && !included);
    btn.setAttribute('aria-pressed', String(included));
    btn.title = `${category.label} — ${category.storyCount} stories`;
    btn.textContent = category.label;

    btn.addEventListener('click', () => {
      toggleCategoryInclude(category.value);
      ui.refresh();
    });

    container.appendChild(btn);
  }
}

import { getFaviconSpriteClass } from './favicon-sprite.js';
import { saveSettings, setSourcesDisplay, state, ui } from './state.js';

export function renderSourceBar(model) {
  const container = document.getElementById('source-toggles');
  if (!container) return;
  container.innerHTML = '';

  const sources = (model?.sourceOptions || []).filter(source => source.count > 0);

  for (const source of sources) {
    const sourceKeys = source.preferenceKeys || source.sourceKeys || [source.key];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'source-toggle';
    btn.dataset.source = source.key;
    btn.classList.toggle('is-off', !source.displayed && !source.mixed);
    btn.classList.toggle('is-mixed', source.mixed === true);
    btn.setAttribute('aria-pressed', source.mixed ? 'mixed' : String(source.displayed));
    btn.setAttribute('aria-label', `${source.displayed || source.mixed ? 'Hide' : 'Show'} ${source.label} (${source.count} stories)`);
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

    const count = document.createElement('span');
    count.className = 'source-count';
    count.textContent = source.count;
    btn.appendChild(count);

    btn.addEventListener('click', () => {
      const display = !(source.displayed || source.mixed);
      setSourcesDisplay(sourceKeys, display, { explicitDisplay: display && source.otherMember === true });
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
  const allActive = categories.every(category => category.active);
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'category-filter-toggle category-all-toggle';
  allBtn.classList.toggle('is-off', !allActive);
  allBtn.setAttribute('aria-pressed', String(allActive));
  allBtn.title = 'Show all categories';
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => {
    state.settings.categoryDisplayFilters = {};
    saveSettings();
    ui.refresh();
  });
  container.appendChild(allBtn);

  for (const category of categories) {
    if (!category.active) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-filter-toggle';
    btn.setAttribute('aria-pressed', 'true');
    btn.title = `${category.label} — ${category.storyCount} stories`;
    btn.textContent = category.label;

    btn.addEventListener('click', () => {
      state.settings.categoryDisplayFilters[category.value] = false;
      saveSettings();
      ui.refresh();
    });

    container.appendChild(btn);
  }
}

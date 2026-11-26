import { FAVICON_SPRITE, getFaviconSpritePosition } from './favicon-sprite.js';
import { saveSettings, state, toggleSourceDisplay, ui } from './state.js';

export function renderSourceBar(model) {
  const container = document.getElementById('source-toggles');
  if (!container) return;
  container.innerHTML = '';

  const displaySize = 18;

  for (const source of model?.sourceOptions || []) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'source-toggle';
    btn.dataset.source = source.key;
    btn.classList.toggle('is-off', !source.displayed);
    btn.setAttribute('aria-pressed', String(source.displayed));
    btn.setAttribute('aria-label', `${source.displayed ? 'Hide' : 'Show'} ${source.label} (${source.count} stories)`);
    btn.title = `${source.label} — ${source.count} stories in the current pool`;

    const letter = document.createElement('span');
    letter.className = 'source-letter';
    letter.textContent = (source.label || source.key || '?').trim().charAt(0).toUpperCase() || '?';
    btn.appendChild(letter);

    const spriteIcon = getFaviconSpritePosition(source.key);
    if (spriteIcon) {
      // The spritesheet is rendered at 18px in the bar but stored larger so
      // favicons stay crisp on high-density displays.
      const scale = displaySize / FAVICON_SPRITE.tile;
      const icon = document.createElement('span');
      icon.className = 'source-sprite';
      icon.setAttribute('aria-hidden', 'true');
      icon.style.backgroundImage = `url("${FAVICON_SPRITE.url}")`;
      icon.style.backgroundSize = `${FAVICON_SPRITE.width * scale}px ${FAVICON_SPRITE.height * scale}px`;
      icon.style.backgroundPosition = `-${spriteIcon.x * scale}px -${spriteIcon.y * scale}px`;
      btn.appendChild(icon);
    }

    if (!source.displayed && source.count > 0) {
      const count = document.createElement('span');
      count.className = 'source-count';
      count.textContent = source.count;
      btn.appendChild(count);
    }

    btn.addEventListener('click', () => {
      toggleSourceDisplay(source.key);
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

  for (const category of model.categoryOptions || []) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-filter-toggle';
    btn.classList.toggle('is-off', !category.active);
    btn.setAttribute('aria-pressed', String(category.active));
    btn.title = `${category.label} — ${category.count} stories`;
    btn.textContent = category.label;

    btn.addEventListener('click', () => {
      if (state.settings.categoryDisplayFilters[category.value] === false) {
        delete state.settings.categoryDisplayFilters[category.value];
      } else {
        state.settings.categoryDisplayFilters[category.value] = false;
      }
      saveSettings();
      ui.refresh();
    });

    container.appendChild(btn);
  }
}

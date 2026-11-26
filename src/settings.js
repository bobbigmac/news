import {
  AGE_OPTIONS,
  applySettings,
  CAT_PREF_OPTIONS,
  collectSourcesFromDigest,
  COLUMN_OPTIONS,
  FONT_SIZE_OPTIONS,
  FONT_THEMES,
  getAllKnownCategories,
  getCatPref,
  IMAGE_OPTIONS,
  MARK_READ_OPTIONS,
  saveCatPrefs,
  saveReadState,
  saveSettings,
  setSourceFeedDisabled,
  SORT_OPTIONS,
  state,
  THEME_OPTIONS,
  ui,
} from './state.js';
import { canonicalCategory } from './view-model.js';
import { attachAlgoListeners, renderChangelog } from './changelog.js';

function makeCycleHandler(btn, options, currentValue, onChange) {
  const opt = options.find(o => o.value === currentValue) || options[0];
  btn.textContent = opt.label;

  btn.addEventListener('click', () => {
    const idx = options.findIndex(o => o.value === state.settings[onChange.key]);
    const next = options[(idx + 1) % options.length];
    state.settings[onChange.key] = next.value;
    btn.textContent = next.label;
    saveSettings();
    applySettings();
    ui.refresh();
  });
}

export function renderCategoryPrefs() {
  const container = document.getElementById('category-prefs');
  if (!container) return;

  const clusters = state.digest?.clusters || [];
  const categories = getAllKnownCategories(clusters);
  const countPool = state.viewModel?.inventoryPool || clusters;
  const storyCounts = {};
  for (const cluster of countPool) {
    const cat = canonicalCategory(cluster.category);
    storyCounts[cat] = (storyCounts[cat] || 0) + (cluster.stories || []).length;
  }

  container.innerHTML = '';
  for (const cat of categories) {
    const row = document.createElement('div');
    row.className = 'setting-row cat-pref-row';
    row.dataset.category = cat;

    const label = document.createElement('div');
    label.className = 'manage-label';
    label.innerHTML = `<span>${cat}</span><span class="manage-count">${storyCounts[cat] || 0} stories</span>`;

    const btn = document.createElement('button');
    btn.className = 'cycle-btn cat-pref-btn';
    btn.type = 'button';
    const current = getCatPref(cat);
    const opt = CAT_PREF_OPTIONS.find(o => o.value === current) || CAT_PREF_OPTIONS[1];
    btn.textContent = opt.label;
    btn.dataset.category = cat;

    btn.addEventListener('click', () => {
      const cur = state.catPrefs[cat] || 'normal';
      const idx = CAT_PREF_OPTIONS.findIndex(o => o.value === cur);
      const next = CAT_PREF_OPTIONS[(idx + 1) % CAT_PREF_OPTIONS.length];
      state.catPrefs[cat] = next.value;
      saveCatPrefs();
      btn.textContent = next.label;
      ui.refresh();
    });

    row.appendChild(label);
    row.appendChild(btn);
    container.appendChild(row);
  }
}

export function renderSourcePrefs() {
  const container = document.getElementById('source-prefs');
  if (!container || !state.digest) return;

  const digestSources = collectSourcesFromDigest(state.digest);
  const poolCounts = new Map((state.viewModel?.allSourceOptions || []).map(source => [source.key, source.count]));
  const sources = digestSources
    .map(source => ({
      ...source,
      count: poolCounts.get(source.key) || 0,
      disabled: state.disabledSources[source.key] === true,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  container.innerHTML = '';
  for (const source of sources) {
    const row = document.createElement('div');
    row.className = 'setting-row source-pref-row';
    row.dataset.source = source.key;

    const label = document.createElement('div');
    label.className = 'manage-label';
    label.innerHTML = `<span>${source.label}</span><span class="manage-count">${source.count} stories in pool</span>`;

    const btn = document.createElement('button');
    btn.className = 'cycle-btn cat-pref-btn';
    btn.type = 'button';
    btn.textContent = source.disabled ? 'Disabled' : 'Enabled';
    btn.classList.toggle('is-disabled-state', source.disabled);

    btn.addEventListener('click', () => {
      setSourceFeedDisabled(source.key, !source.disabled);
      ui.refresh();
      renderSourcePrefs();
    });

    row.appendChild(label);
    row.appendChild(btn);
    container.appendChild(row);
  }
}

export function initSettings() {
  const panel = document.getElementById('settings-panel');
  const toggle = document.getElementById('settings-toggle');
  const close = document.getElementById('settings-close');

  const fontBtn = document.getElementById('setting-font');
  const fontsizeBtn = document.getElementById('setting-fontsize');
  const columnsBtn = document.getElementById('setting-columns');
  const sortBtn = document.getElementById('setting-sort');
  const imagesBtn = document.getElementById('setting-images');
  const ageBtn = document.getElementById('setting-age');
  const themeBtn = document.getElementById('setting-theme');
  const expandAllCheck = document.getElementById('setting-expandall');
  const showUpdatedCheck = document.getElementById('setting-showupdated');
  const watchWordsInput = document.getElementById('setting-watchwords');
  const markReadBtn = document.getElementById('setting-markread');

  function syncControls() {
    const fontTheme = FONT_THEMES.find(f => f.value === state.settings.font) || FONT_THEMES[0];
    fontBtn.textContent = fontTheme.label;
    const fsOpt = FONT_SIZE_OPTIONS.find(o => o.value === state.settings.fontsize) || FONT_SIZE_OPTIONS[1];
    fontsizeBtn.textContent = fsOpt.label;
    const colOpt = COLUMN_OPTIONS.find(o => o.value === state.settings.columns) || COLUMN_OPTIONS[2];
    columnsBtn.textContent = colOpt.label;
    const sortOpt = SORT_OPTIONS.find(o => o.value === state.settings.sort) || SORT_OPTIONS[0];
    sortBtn.textContent = sortOpt.label;
    const imgOpt = IMAGE_OPTIONS.find(o => o.value === state.settings.images) || IMAGE_OPTIONS[1];
    imagesBtn.textContent = imgOpt.label;
    const ageOpt = AGE_OPTIONS.find(o => o.value === state.settings.ageLimit) || AGE_OPTIONS[1];
    ageBtn.textContent = ageOpt.label;
    const themeOpt = THEME_OPTIONS.find(o => o.value === state.settings.theme) || THEME_OPTIONS[0];
    themeBtn.textContent = themeOpt.label;
    const markReadOpt = MARK_READ_OPTIONS.find(o => o.value === state.settings.markRead) || MARK_READ_OPTIONS[0];
    if (markReadBtn) markReadBtn.textContent = markReadOpt.label;
    expandAllCheck.checked = state.settings.expandAll;
    showUpdatedCheck.checked = state.settings.showUpdated;
    watchWordsInput.value = state.settings.watchWords || '';
  }

  function updateCheckboxes() {
    state.settings.expandAll = expandAllCheck.checked;
    state.settings.showUpdated = showUpdatedCheck.checked;
    saveSettings();
    applySettings();
    ui.refresh();
  }

  makeCycleHandler(fontBtn, FONT_THEMES, state.settings.font, { key: 'font' });
  makeCycleHandler(fontsizeBtn, FONT_SIZE_OPTIONS, state.settings.fontsize, { key: 'fontsize' });
  makeCycleHandler(columnsBtn, COLUMN_OPTIONS, state.settings.columns, { key: 'columns' });
  makeCycleHandler(sortBtn, SORT_OPTIONS, state.settings.sort, { key: 'sort' });
  makeCycleHandler(imagesBtn, IMAGE_OPTIONS, state.settings.images, { key: 'images' });
  makeCycleHandler(ageBtn, AGE_OPTIONS, state.settings.ageLimit, { key: 'ageLimit' });
  makeCycleHandler(themeBtn, THEME_OPTIONS, state.settings.theme, { key: 'theme' });
  if (markReadBtn) makeCycleHandler(markReadBtn, MARK_READ_OPTIONS, state.settings.markRead, { key: 'markRead' });

  [expandAllCheck, showUpdatedCheck].forEach(el => el.addEventListener('change', updateCheckboxes));

  // Watch words — debounce input
  let watchTimer = null;
  watchWordsInput.addEventListener('input', () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      state.settings.watchWords = watchWordsInput.value;
      saveSettings();
      ui.refresh();
    }, 400);
  });

  toggle.addEventListener('click', () => panel.classList.toggle('hidden'));
  close.addEventListener('click', () => panel.classList.add('hidden'));

  // Manage categories panel
  const manageCatBtn = document.getElementById('manage-categories');
  const catPanel = document.getElementById('category-panel');
  const catClose = document.getElementById('category-close');
  if (manageCatBtn && catPanel) {
    manageCatBtn.addEventListener('click', () => {
      panel.classList.add('hidden');
      catPanel.classList.remove('hidden');
      renderCategoryPrefs();
    });
  }
  if (catClose) catClose.addEventListener('click', () => catPanel.classList.add('hidden'));

  // Manage sources panel — hard feed exclusions, unlike the temporary header filters.
  const manageSourceBtn = document.getElementById('manage-sources');
  const sourcePanel = document.getElementById('source-panel');
  const sourceClose = document.getElementById('source-close');
  if (manageSourceBtn && sourcePanel) {
    manageSourceBtn.addEventListener('click', () => {
      panel.classList.add('hidden');
      sourcePanel.classList.remove('hidden');
      renderSourcePrefs();
    });
  }
  if (sourceClose) sourceClose.addEventListener('click', () => sourcePanel.classList.add('hidden'));

  syncControls();
  applySettings();
  renderCategoryPrefs();
  renderSourcePrefs();

  // Changelog page
  const changelogBtn = document.getElementById('settings-changelog');
  const changelogPage = document.getElementById('changelog-page');
  const changelogClose = document.getElementById('changelog-close');
  const changelogBody = document.getElementById('changelog-body');

  changelogBtn.addEventListener('click', async () => {
    panel.classList.add('hidden');
    changelogPage.classList.remove('hidden');
    if (!changelogBody.children.length) {
      changelogBody.innerHTML = '<div class="loading">Loading...</div>';
      try {
        const res = await fetch('run-log.json');
        const log = res.ok ? await res.json() : [];
        window._lastLog = log;
        renderChangelog(log);
        attachAlgoListeners();
      } catch {
        changelogBody.innerHTML = '<div class="loading">No run history available.</div>';
      }
    }
  });
  changelogClose.addEventListener('click', () => changelogPage.classList.add('hidden'));

  const resetReadBtn = document.getElementById('reset-read-log');
  if (resetReadBtn) {
    resetReadBtn.addEventListener('click', () => {
      state.readState = {};
      saveReadState();
      document.querySelectorAll('.article.is-read').forEach(a => {
        a.classList.remove('is-read');
        a.style.setProperty('--read-progress', 0);
      });
      ui.refresh();
    });
  }
}

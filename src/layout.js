import Masonry from 'masonry-layout';
import { state } from './state.js';

export function getGridMetrics(sheet) {
  let cols = parseInt(state.settings?.columns, 10) || 2;
  if (window.innerWidth <= 768) cols = 1;
  else if (window.innerWidth <= 1024 && cols > 3) cols = 3;

  const gutter = 20;
  const style = getComputedStyle(sheet);
  const padL = parseFloat(style.paddingLeft) || 0;
  const padR = parseFloat(style.paddingRight) || 0;
  const contentWidth = sheet.clientWidth - padL - padR;
  const colWidth = (contentWidth - (cols - 1) * gutter) / cols;
  return { colWidth, gutter };
}

function sizeGridItems(items, colWidth) {
  items.forEach(item => {
    item.style.width = colWidth + 'px';
  });
}

export function bindImageLayout(scope) {
  scope.querySelectorAll('img').forEach(img => {
    if (!img.complete) {
      img.addEventListener('load', () => state.masonry?.layout());
      img.addEventListener('error', () => state.masonry?.layout());
    }
  });
}

export function initMasonry() {
  if (state.masonry) state.masonry.destroy();
  state.masonry = null;

  const sheet = document.getElementById('broadsheet');
  const items = [...sheet.querySelectorAll('.grid-item')];
  if (typeof Masonry === 'undefined' || !items.length) return;

  const { colWidth, gutter } = getGridMetrics(sheet);
  if (colWidth <= 0) return;

  sizeGridItems(items, colWidth);
  state.masonry = new Masonry(sheet, {
    itemSelector: '.grid-item',
    columnWidth: colWidth,
    gutter,
  });
  bindImageLayout(sheet);
}

export function appendGridItems(items) {
  if (!items.length) return;
  const sheet = document.getElementById('broadsheet');
  if (!state.masonry) return;

  const { colWidth } = getGridMetrics(sheet);
  sizeGridItems(items, colWidth);
  state.masonry.appended(items);
  items.forEach(item => bindImageLayout(item));
  state.masonry.layout();
}

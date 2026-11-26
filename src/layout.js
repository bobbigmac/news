import Masonry from 'masonry-layout';
import { state } from './state.js';

export function initMasonry() {
  if (state.masonry) state.masonry.destroy();
  const sheet = document.getElementById('broadsheet');
  if (typeof Masonry !== 'undefined' && sheet.querySelector('.grid-item')) {
    let cols = parseInt(state.settings?.columns, 10) || 2;
    if (window.innerWidth <= 768) cols = 1;
    else if (window.innerWidth <= 1024 && cols > 3) cols = 3;

    const gutter = 20;
    const style = getComputedStyle(sheet);
    const padL = parseFloat(style.paddingLeft) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    const contentWidth = sheet.clientWidth - padL - padR;
    const colWidth = (contentWidth - (cols - 1) * gutter) / cols;

    // Set explicit item widths so Masonry positions correctly
    sheet.querySelectorAll('.grid-item').forEach(item => {
      item.style.width = colWidth + 'px';
    });

    state.masonry = new Masonry(sheet, {
      itemSelector: '.grid-item',
      columnWidth: colWidth,
      gutter: gutter,
    });
    // Re-layout when images load (they change item heights)
    sheet.querySelectorAll('img').forEach(img => {
      if (!img.complete) {
        img.addEventListener('load', () => state.masonry?.layout());
        img.addEventListener('error', () => state.masonry?.layout());
      }
    });
  }
}

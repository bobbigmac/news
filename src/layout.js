// Stable-column feed layout.
//
// Items are assigned to a column exactly once — greedily, by estimated height,
// in feed order — and NEVER move afterwards. Columns are plain block flow, so
// images loading, summaries expanding, or hydration resizing simply make a
// column longer. No relayout passes, no absolute positioning, no column hops.
import { state } from './state.js';

const GUTTER = 20;

export function getColumnCount() {
  let cols = parseInt(state.settings?.columns, 10) || 2;
  if (window.innerWidth <= 768) cols = 1;
  else if (window.innerWidth <= 1024 && cols > 3) cols = 3;
  return cols;
}

export function getGridMetrics(sheet) {
  const cols = getColumnCount();
  const style = getComputedStyle(sheet);
  const padL = parseFloat(style.paddingLeft) || 0;
  const padR = parseFloat(style.paddingRight) || 0;
  const contentWidth = sheet.clientWidth - padL - padR;
  const colWidth = (contentWidth - (cols - 1) * GUTTER) / cols;
  return { colWidth, gutter: GUTTER, cols };
}

// Distribute items into column containers inside the sheet.
// heightHint(item) should return the best available height estimate (0 for
// hidden items); assignment is greedy-to-shortest in the order given.
export function layoutColumns(sheet, items, heightHint) {
  const cols = getColumnCount();
  const heights = new Array(cols).fill(0);
  const columns = [];
  for (let i = 0; i < cols; i++) {
    const col = document.createElement('div');
    col.className = 'feed-col';
    columns.push(col);
  }
  for (const item of items) {
    let target = 0;
    for (let i = 1; i < cols; i++) {
      if (heights[i] < heights[target]) target = i;
    }
    columns[target].appendChild(item);
    heights[target] += heightHint(item);
  }
  sheet.replaceChildren(...columns);
  return columns;
}

// Flow columns need no image-load relayout handling at all: an image loading
// simply grows its own column, and nothing else moves.

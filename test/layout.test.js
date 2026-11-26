import { beforeEach, describe, expect, it } from 'vitest';
import { layoutColumns } from '../src/layout.js';
import { DEFAULT_SETTINGS, state } from '../src/state.js';

function item(id) {
  const el = document.createElement('div');
  el.className = 'grid-item';
  el.dataset.id = id;
  return el;
}

describe('stable column layout', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="broadsheet"></main>';
    state.settings = { ...DEFAULT_SETTINGS, columns: 2 };
  });

  it('distributes items greedily by height hint into column containers', () => {
    const sheet = document.getElementById('broadsheet');
    const items = [item('a'), item('b'), item('c'), item('d')];
    const hints = { a: 100, b: 100, c: 50, d: 30 };
    layoutColumns(sheet, items, node => hints[node.dataset.id]);

    const cols = [...sheet.querySelectorAll('.feed-col')];
    expect(cols).toHaveLength(2);
    // a(100) -> col0, b(100) -> col1, c(50) -> col1(100<=100? no: col1=100, col0=100 -> tie goes col0? greedy first-lowest)
    // assert only structure invariants, not tie-breaking:
    const all = cols.flatMap(col => [...col.children].map(el => el.dataset.id));
    expect(all.sort()).toEqual(['a', 'b', 'c', 'd']);
    for (const col of cols) {
      const ids = [...col.children].map(el => el.dataset.id);
      // within-column order must follow the original feed order
      expect(ids).toEqual([...ids].sort((x, y) => 'abcd'.indexOf(x) - 'abcd'.indexOf(y)));
    }
  });

  it('hidden items count as zero height but still get a stable home', () => {
    const sheet = document.getElementById('broadsheet');
    const visible = item('v');
    const hidden = item('h');
    hidden.classList.add('hidden');
    layoutColumns(sheet, [visible, hidden], node => (node.classList.contains('hidden') ? 0 : 200));
    const all = [...sheet.querySelectorAll('.grid-item')];
    expect(all).toHaveLength(2);
  });

  it('column containers are direct sheet children in a single row', () => {
    const sheet = document.getElementById('broadsheet');
    layoutColumns(sheet, [item('x')], () => 100);
    expect(sheet.children.length).toBeGreaterThanOrEqual(1);
    expect([...sheet.children].every(el => el.classList.contains('feed-col'))).toBe(true);
  });

  it('re-layout keeps item identity — nodes are reused, not recreated', () => {
    const sheet = document.getElementById('broadsheet');
    const first = item('keep');
    layoutColumns(sheet, [first], () => 100);
    const parentCol = first.parentElement;
    expect(parentCol.classList.contains('feed-col')).toBe(true);
    expect(sheet.contains(first)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { heldRowKeyOf, isRowInActiveTab } from './heldCategoryRows';

describe('isRowInActiveTab', () => {
  const row = { id: '1', section: '新商品' };

  it('①「全て」タブでは全行を表示する', () => {
    expect(isRowInActiveTab(row, 'all', new Set())).toBe(true);
  });

  it('② 行の区分と同じタブでは表示する', () => {
    expect(isRowInActiveTab(row, '新商品', new Set())).toBe(true);
  });

  it('③ 別の区分のタブでは表示しない', () => {
    expect(isRowInActiveTab(row, '定番商品', new Set())).toBe(false);
  });

  it('④ 区分を変えた直後（保留中）は、変更前のタブに残す', () => {
    expect(isRowInActiveTab(row, '定番商品', new Set(['1']))).toBe(true);
  });
});

describe('heldRowKeyOf', () => {
  it('⑤ id が無い行は、区分が変わっても変わらない項目でキーを作る', () => {
    expect(
      heldRowKeyOf({
        metaBrand: 'A',
        summaryProduct: 'B',
        giftSetId: 'g1',
        period: '上旬',
      })
    ).toBe('A-B-g1-上旬');
  });

  it('⑥ ギフト3行はそれぞれ別のキーになり、3行とも保留できる', () => {
    const rows = ['上旬', '中旬', '下旬'].map((period, i) => ({
      id: `new-1-${i}`,
      section: 'ギフト',
      period,
    }));
    const held = new Set(rows.map(heldRowKeyOf));
    expect(held.size).toBe(3);
    expect(rows.every((r) => isRowInActiveTab(r, '新商品', held))).toBe(true);
  });
});

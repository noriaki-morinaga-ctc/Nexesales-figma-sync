import { describe, expect, it } from 'vitest';
import { matchesRow } from './planRowMatch';

describe('matchesRow', () => {
  it('更新する行に id があれば id で照合する', () => {
    expect(matchesRow({ id: 'a', summaryProduct: 'X' }, { id: 'a' })).toBe(
      true
    );
    expect(
      matchesRow(
        { id: 'b', summaryProduct: 'X' },
        { id: 'a', summaryProduct: 'X' }
      )
    ).toBe(false);
  });
  it('id が無ければサマリ商品名＋メタブランドで照合する', () => {
    const row = { summaryProduct: 'X', metaBrand: 'M' };
    expect(matchesRow(row, { summaryProduct: 'X', metaBrand: 'M' })).toBe(true);
    expect(matchesRow(row, { summaryProduct: 'X', metaBrand: 'N' })).toBe(
      false
    );
  });
});

import { describe, it, expect } from 'vitest';
import {
  summaryProductOptionCode,
  expenseSummaryProductOptionCode,
} from './summaryProductSearch';
import { matchesSearchQuery } from './searchNormalize';

describe('summaryProductOptionCode', () => {
  it('サマリ商品コード・メタブランド・容器容量Gを候補の2行目の表記にまとめる', () => {
    expect(summaryProductOptionCode('P1234', 'ブランドA', '350ml缶')).toBe(
      'P1234／ブランドA：350ml缶'
    );
  });

  it('サマリ商品コードで検索できる（大文字小文字・全角半角を区別しない）', () => {
    const code = summaryProductOptionCode('P1234', 'ブランドA', '350ml缶');
    expect(matchesSearchQuery(code, 'p1234')).toBe(true);
    expect(matchesSearchQuery(code, 'Ｐ１２３４')).toBe(true);
    expect(matchesSearchQuery(code, 'P9999')).toBe(false);
  });
});

describe('expenseSummaryProductOptionCode', () => {
  it('容器容量Gがあれば明細追加ペインと同じ表記にする', () => {
    expect(
      expenseSummaryProductOptionCode('P1234', 'ブランドA', '350ml缶')
    ).toBe('P1234／ブランドA：350ml缶');
  });

  it('容器容量Gが無い拡売費の商品はコードとメタブランドだけにする', () => {
    expect(expenseSummaryProductOptionCode('P1234', 'ブランドA')).toBe(
      'P1234／ブランドA'
    );
  });

  it('サマリ商品コードで検索できる', () => {
    expect(
      matchesSearchQuery(
        expenseSummaryProductOptionCode('P1234', 'ブランドA'),
        'p1234'
      )
    ).toBe(true);
  });
});

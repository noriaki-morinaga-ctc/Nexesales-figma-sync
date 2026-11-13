import { describe, it, expect } from 'vitest';
import {
  hasSummaryProduct,
  isMetaBrandEditable,
  clearExpenseSavedMarks,
} from './nonProductExpenseRow';
import type { NonProductExpenseData } from '@/app/types/nonProductExpense';

// テスト用の最小行データ（必須項目のみ埋める）
const row = (
  over: Partial<NonProductExpenseData> = {}
): NonProductExpenseData => ({
  metaBrand: '三ツ矢',
  summaryProduct: '',
  exp1PlannedAmount: 0,
  exp1PriorYearActual: null,
  exp1PostingMonth: '',
  exp1ManagementClass: '',
  exp1ManagementCode: '',
  exp1AccountItem: '',
  exp1CampaignClass: '',
  exp1CampaignCode: '',
  exp1Description: '',
  exp1Creator: '',
  ...over,
});

describe('hasSummaryProduct', () => {
  it('サマリ商品名が選択されていれば true', () => {
    expect(hasSummaryProduct(row({ summaryProduct: '三ツ矢サイダー' }))).toBe(
      true
    );
  });

  it('未選択（空文字）は false', () => {
    expect(hasSummaryProduct(row({ summaryProduct: '' }))).toBe(false);
  });

  it('「ー（指定なし）」は未選択扱いで false', () => {
    expect(hasSummaryProduct(row({ summaryProduct: '-' }))).toBe(false);
  });

  it('行が無ければ false', () => {
    expect(hasSummaryProduct(undefined)).toBe(false);
  });
});

describe('isMetaBrandEditable', () => {
  it('サマリ商品名が無い行は編集可', () => {
    expect(isMetaBrandEditable(row({ summaryProduct: '' }))).toBe(true);
  });

  it('サマリ商品名がある行は編集不可', () => {
    expect(isMetaBrandEditable(row({ summaryProduct: '三ツ矢サイダー' }))).toBe(
      false
    );
  });

  it('合計行は、サマリ商品名の有無に関わらず編集不可', () => {
    expect(
      isMetaBrandEditable(row({ isTotal: true, summaryProduct: '' }))
    ).toBe(false);
  });
});

describe('clearExpenseSavedMarks', () => {
  it('_copySource が付いた行から帯を外し、無い行はそのまま残す', () => {
    const plain = row({ no: 1 });
    const copied = row({ no: 2, _copySource: 'detail' });
    const result = clearExpenseSavedMarks([plain, copied], new Set());
    expect(result[0]).toBe(plain);
    expect(result[1]._copySource).toBeUndefined();
  });

  it('編集セルの強調セット（changedCells）を空にする', () => {
    const changedCells = new Set(['1::metaBrand', '2::exp1PlannedAmount']);
    clearExpenseSavedMarks([row({ no: 1 })], changedCells);
    expect(changedCells.size).toBe(0);
  });

  it('帯が無い行だけなら同じ配列参照を返す（余計な再描画を起こさない）', () => {
    const rows = [row({ no: 1 }), row({ no: 2 })];
    const result = clearExpenseSavedMarks(rows, new Set());
    expect(result).toBe(rows);
  });
});

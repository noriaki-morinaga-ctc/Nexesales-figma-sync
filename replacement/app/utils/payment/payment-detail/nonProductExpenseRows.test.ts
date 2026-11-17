import { describe, it, expect } from 'vitest';
import type { ExpenseRow } from '@/app/types/paymentDetail';
import { sortRowsForDisplay } from './nonProductExpenseRows';

// 並びの確認に要る項目だけを持つ行
const row = (lineNo: string | number, extra: Partial<ExpenseRow> = {}) =>
  ({ lineNo, ...extra }) as ExpenseRow;
const nos = (rows: ExpenseRow[]) => rows.map((r) => String(r.lineNo));

describe('sortRowsForDisplay（→ 02 §8「行の追加位置」・UX-112）', () => {
  it('明細行は No. の昇順、枝番行は親行の直下に並ぶ', () => {
    const rows = [row(2), row('1-2'), row(1), row('1-1')];
    expect(nos(sortRowsForDisplay(rows))).toEqual(['1', '1-1', '1-2', '2']);
  });

  it('明細追加・転記の行（最大 No.＋1）は最下行に追加した順で並ぶ', () => {
    const rows = [
      row(4, { _addedSeq: 2 }),
      row(1),
      row(2),
      row(3, { _addedSeq: 1 }),
    ];
    expect(nos(sortRowsForDisplay(rows))).toEqual(['1', '2', '3', '4']);
  });

  it('行コピーの行はコピー元の行（とその枝番行）のすぐ下に並ぶ', () => {
    const rows = [
      row(1),
      row('1-1'),
      row(2),
      row(3, { _addedSeq: 1, _copyOf: 'other:1' }),
    ];
    expect(nos(sortRowsForDisplay(rows))).toEqual(['1', '1-1', '3', '2']);
  });

  it('未承認NETの一覧が先、その他の一覧が後。合計行は各一覧の端に置く', () => {
    const rows = [
      row(1),
      row('', { isTotal: true }),
      row(1, { isNetUnapproved: true }),
      row('', { isGroup: true }),
    ];
    const sorted = sortRowsForDisplay(rows);
    expect(sorted[0].isNetUnapproved).toBe(true);
    expect(sorted[1].isGroup).toBe(true);
    expect(sorted[sorted.length - 1].isTotal).toBe(true);
  });
});

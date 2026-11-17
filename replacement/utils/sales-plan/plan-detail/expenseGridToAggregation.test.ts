import { describe, it, expect } from 'vitest';
import { toAggregationExpenses } from './expenseGridToAggregation';

// 2025/10 が対象年月 → index0 = 9
const CONTEXT = { targetMonthIdx0: 9 };

const row = (over: Record<string, unknown> = {}) => ({
  no: 1,
  metaBrand: '三ツ矢',
  summaryProduct: '',
  exp1PlannedAmount: 150000,
  exp1PostingMonth: '2025/10',
  exp1ManagementCode: 'RA001',
  exp1ManagementClass: '売上連動拡売費A口',
  ...over,
});

describe('toAggregationExpenses', () => {
  it('グリッド1行から集計ソース1件を作る', () => {
    expect(toAggregationExpenses([row()], CONTEXT)).toHaveLength(1);
  });

  it('管理区分を集計の費目（category）にする', () => {
    const [expense] = toAggregationExpenses([row()], CONTEXT);
    expect(expense.category).toBe('売上連動拡売費A口');
  });

  it('管理区分が空でも管理コードから復元する', () => {
    const [expense] = toAggregationExpenses(
      [row({ exp1ManagementClass: '', exp1ManagementCode: 'FB002' })],
      CONTEXT
    );
    expect(expense.category).toBe('拡売費(固定費)B口');
  });

  it('対象月基準：対象月の金額がグリッドの計画金額と一致する', () => {
    const [expense] = toAggregationExpenses([row()], CONTEXT);
    expect(expense.amountByTargetMonth).toHaveLength(12);
    expect(expense.amountByTargetMonth[9]).toBe(150000);
  });

  it('計上月＝対象月なら2系列は一致する', () => {
    const [expense] = toAggregationExpenses(
      [row({ exp1PostingMonth: '2025/10' })],
      CONTEXT
    );
    expect(expense.amountByPostingMonth).toEqual(expense.amountByTargetMonth);
  });

  it('計上月基準：計上月の金額がグリッドの計画金額と一致する', () => {
    const [expense] = toAggregationExpenses(
      [row({ exp1PostingMonth: '2025/11' })],
      CONTEXT
    );
    expect(expense.amountByPostingMonth[10]).toBe(150000);
    // 対象月基準では従来どおり10月に載る
    expect(expense.amountByTargetMonth[9]).toBe(150000);
  });

  it('年をまたぐ計上月（2026/01）も12か月で循環して1月に載る', () => {
    const [expense] = toAggregationExpenses(
      [row({ exp1PostingMonth: '2026/01' })],
      CONTEXT
    );
    expect(expense.amountByPostingMonth[0]).toBe(150000);
  });

  it('計上月が空なら対象月基準と同じ系列にする', () => {
    const [expense] = toAggregationExpenses(
      [row({ exp1PostingMonth: '' })],
      CONTEXT
    );
    expect(expense.amountByPostingMonth).toEqual(expense.amountByTargetMonth);
  });

  it('サマリ商品が指定されていればそのマスタから集計軸を引く', () => {
    const [expense] = toAggregationExpenses(
      [row({ summaryProduct: '十六茶2L6本', metaBrand: '十六茶' })],
      CONTEXT
    );
    expect(expense.metaBrand).toBe('十六茶');
    expect(expense.capacity).toBe('PET2L');
  });

  it('サマリ商品が未指定なら容器容量Gはその他になる', () => {
    const [expense] = toAggregationExpenses([row()], CONTEXT);
    expect(expense.metaBrand).toBe('三ツ矢');
    expect(expense.capacity).toBe('その他');
  });

  it('合計行（isTotal）は除外する', () => {
    expect(
      toAggregationExpenses([row(), { ...row(), isTotal: true }], CONTEXT)
    ).toHaveLength(1);
  });

  it('計画金額が無い行・管理区分を解決できない行は除外する', () => {
    expect(
      toAggregationExpenses([row({ exp1PlannedAmount: 0 })], CONTEXT)
    ).toHaveLength(0);
    expect(
      toAggregationExpenses(
        [row({ exp1ManagementClass: '', exp1ManagementCode: 'ZZ999' })],
        CONTEXT
      )
    ).toHaveLength(0);
  });

  it('Task 5 で追加した4区分も費目として扱える', () => {
    const codes = {
      LC001: 'ロケ補填',
      CL001: 'コラム料',
      LS001: 'リース料',
      EQ001: '販売器具費',
    };
    for (const [code, cls] of Object.entries(codes)) {
      const [expense] = toAggregationExpenses(
        [row({ exp1ManagementCode: code, exp1ManagementClass: '' })],
        CONTEXT
      );
      expect(expense.category, code).toBe(cls);
    }
  });

  it('空配列を渡すと空配列を返す', () => {
    expect(toAggregationExpenses([], CONTEXT)).toEqual([]);
  });
});

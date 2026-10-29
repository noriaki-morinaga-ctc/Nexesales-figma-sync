import { describe, it, expect } from 'vitest';
import { simulationManagementProfitOf } from './simulationManagementProfit';
import { toAggregationProducts } from './planGridToAggregation';
import { toAggregationExpenses } from './expenseGridToAggregation';
import { computeMonthsRange } from './aggregationCalc';
import { SUMMARY_PRODUCT_OPTIONS } from '../constants/productMasters';
import { parseFormulaNumber } from '../components/grid/gridCommon';
import type { PlanPattern } from './conditionUnitPrice';

// 計画詳細の集計エンジン（補足3-1）と同じ管理利益になることを、明細1行だけの集計で確かめる。
const master = SUMMARY_PRODUCT_OPTIONS[0];
const product = {
  metaBrand: master.metaBrand,
  containerCapacityG: master.containerCapacityG,
  summaryProduct: master.value,
  wholesaleMesh: '',
  quantity: '24',
  plan: '100',
  planPrice: '120',
};
const costUnitPrice = parseFormulaNumber(master.costOfSales);

// 計画詳細は拡売費を拡売費計画タブの行（管理区分つき）で持つため、同じ金額を1行ずつ渡す
const expenseRowsOf = (entries: Array<[string, number]>) =>
  entries.map(([cls, amount]) => ({
    summaryProduct: master.value,
    exp1ManagementClass: cls,
    exp1PlannedAmount: amount,
  }));

const engineOf = (
  planPattern: PlanPattern,
  expenses: Array<[string, number]>
) =>
  computeMonthsRange(
    {
      products: toAggregationProducts([product], {
        planPattern,
        targetMonthIdx0: 0,
      }),
      expenses: toAggregationExpenses(expenseRowsOf(expenses), {
        targetMonthIdx0: 0,
      }),
    },
    [0]
  );

describe('simulationManagementProfitOf（管理利益額＝売買差益−直接固定費）', () => {
  (['marginRateFixed', 'netFixed'] as const).forEach((planPattern) => {
    it(`拡売費(固定費)とロケ補填を含めて計画詳細の集計と同じ値になる（${planPattern}）`, () => {
      const engine = engineOf(planPattern, [
        ['拡売費(固定費)A口', 1000],
        ['ロケ補填', 300],
      ]);
      const result = simulationManagementProfitOf(
        {
          ...product,
          externalSales: String(engine.extSales),
          exp1ManagementClass: '拡売費(固定費)A口',
          exp1PlannedAmountBefore: '1000',
          exp2ManagementClass: 'ロケ補填',
          exp2PlannedAmountBefore: '300',
        },
        planPattern,
        costUnitPrice
      );
      // 0同士の一致で素通りしないよう、主要な中間項目が値を持つことも確かめる
      expect(engine.cost).toBeGreaterThan(0);
      expect(engine.centerFee).toBeGreaterThan(0);
      expect(result.sales).toBeCloseTo(engine.sales, 6);
      expect(result.cost).toBeCloseTo(engine.cost, 6);
      expect(result.centerFee).toBeCloseTo(engine.centerFee, 6);
      expect(result.locFill).toBe(300);
      expect(result.tradeProfit).toBeCloseTo(engine.tradeProfit, 6);
      expect(result.directFixed).toBeCloseTo(engine.directFixed, 6);
      expect(result.mgmtProfit).toBeCloseTo(engine.mgmtProfit, 6);
    });
  });

  it('自販機関連費は直接固定費に入り、売上連動拡売費は管理利益額に入らない', () => {
    const base = { ...product, externalSales: '100000' };
    const withoutExpense = simulationManagementProfitOf(
      base,
      'marginRateFixed',
      costUnitPrice
    );
    const withVending = simulationManagementProfitOf(
      {
        ...base,
        exp1ManagementClass: 'コラム料',
        exp1PlannedAmountBefore: '500',
      },
      'marginRateFixed',
      costUnitPrice
    );
    const withSalesLinked = simulationManagementProfitOf(
      {
        ...base,
        exp1ManagementClass: '売上連動拡売費A口',
        exp1PlannedAmountBefore: '500',
      },
      'marginRateFixed',
      costUnitPrice
    );
    expect(withVending.vendingRelated).toBe(500);
    expect(withVending.mgmtProfit).toBeCloseTo(
      withoutExpense.mgmtProfit - 500,
      6
    );
    expect(withSalesLinked.mgmtProfit).toBeCloseTo(
      withoutExpense.mgmtProfit,
      6
    );
  });

  it('管理区分が空でも管理コードの接頭辞から費目を判定する', () => {
    const result = simulationManagementProfitOf(
      {
        ...product,
        externalSales: '100000',
        exp1ManagementCode: 'FA0001',
        exp1PlannedAmountBefore: '700',
      },
      'marginRateFixed',
      costUnitPrice
    );
    // FA＝拡売費(固定費)A口
    expect(result.fixed).toBe(700);
  });
});

// 既定の集計ソース。
// 販売計画シミュレーションの集計（utils/simulationDetailAggregate）は、計画詳細と同じ
// ダミーデータから求めた構成比を使うため、画面のグリッド行ではなくこの既定ソースを参照する。
// 計画詳細の画面自体は、グリッド行から都度組み立てたソースを使う（page.tsx）。
import {
  REGULAR_PRODUCTS_DATA,
  NEW_PRODUCTS_DATA,
  PROMOTION_PRODUCTS_DATA,
  GIFT_PRODUCTS_DATA,
} from './salesPlanRetailMockData';
import { NON_PRODUCT_EXPENSE_ROWS } from './nonProductExpenseMockData';
import { toAggregationProducts } from '../utils/planGridToAggregation';
import { toAggregationExpenses } from '../utils/expenseGridToAggregation';
import type { AggregationSource } from './aggregationSourceData';

// 計画詳細の既定の対象年月 2025/10 → 月インデックス 9
export const DEFAULT_TARGET_MONTH_IDX0 = 9;

export const DEFAULT_AGGREGATION_SOURCE: AggregationSource = {
  products: toAggregationProducts(
    [
      ...REGULAR_PRODUCTS_DATA,
      ...NEW_PRODUCTS_DATA,
      ...PROMOTION_PRODUCTS_DATA,
      ...GIFT_PRODUCTS_DATA,
    ],
    {
      planPattern: 'marginRateFixed',
      targetMonthIdx0: DEFAULT_TARGET_MONTH_IDX0,
    }
  ),
  expenses: toAggregationExpenses(NON_PRODUCT_EXPENSE_ROWS, {
    targetMonthIdx0: DEFAULT_TARGET_MONTH_IDX0,
  }),
};

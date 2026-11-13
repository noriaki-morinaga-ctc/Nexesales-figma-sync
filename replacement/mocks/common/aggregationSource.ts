// 販売計画シミュレーション：構成比を求める元の集計ソースのモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 計画詳細(マージン率固定)と同じダミーデータから作る。実システムでは構成比を API から受け取る。
import { UNIT_PRICE_KBN } from '@/mocks/common/planBasicInfo';
import {
  REGULAR_PRODUCTS_DATA,
  NEW_PRODUCTS_DATA,
  PROMOTION_PRODUCTS_DATA,
  GIFT_PRODUCTS_DATA,
} from '@/mocks/common/salesPlanRetail';
import { NON_PRODUCT_EXPENSE_ROWS } from '@/mocks/common/nonProductExpense';
import { DEFAULT_TARGET_MONTH_IDX0 } from '@/app/constants/defaultAggregationSource';
import { toAggregationProducts } from '@/app/utils/sales-plan/plan-detail/planGridToAggregation';
import { toAggregationExpenses } from '@/app/utils/sales-plan/plan-detail/expenseGridToAggregation';
import { simulationRatiosOf } from '@/app/utils/sales-plan/simulation/simulationDetailAggregate';
import type { AggregationSource } from '@/app/types/aggregation';

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
      unitPriceKbn: UNIT_PRICE_KBN,
      targetMonthIdx0: DEFAULT_TARGET_MONTH_IDX0,
    }
  ),
  expenses: toAggregationExpenses(NON_PRODUCT_EXPENSE_ROWS, {
    targetMonthIdx0: DEFAULT_TARGET_MONTH_IDX0,
  }),
};

// 販売計画シミュレーションの構成比（シミュレーションの表に無い項目の按分に使う）
export const SIMULATION_RATIOS = simulationRatiosOf(DEFAULT_AGGREGATION_SOURCE);

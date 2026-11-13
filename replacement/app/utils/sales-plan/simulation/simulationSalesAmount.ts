// 販売計画シミュレーション明細の売上高 ─ 計画詳細の集計（補足3-1）と同じ定義で明細1行ごとに算出する。
//
//   売上高     ＝ 社外売上高 − 量経追加口 − 条件口
//   量経追加口 ＝ 社外売上高 × 量経追加口率（[マスタ]メタブランド別）
//   条件口     ＝ 条件口単価(補足4-2) × 入数 × 計画函数
//
// 量経追加口率・条件口単価は計画詳細（utils/sales-plan/plan-detail/planGridToAggregation → utils/sales-plan/common/aggregationCalc）と
// 同じマスタ・導出ロジックを使い、計画詳細の集計と値の求め方をそろえる。
import { parseFormulaNumber } from '@/app/components/grid/gridCommon';
import { toAxisMetaBrand } from '@/app/utils/sales-plan/common/aggregationAxisMapping';
import { volumeAddRateOf } from '@/app/utils/sales-plan/common/aggregationMasterDummy';
import {
  deriveConditionUnitPrice,
  DEFAULT_STORE_KEY,
  type PlanPattern,
} from '@/app/utils/sales-plan/common/conditionUnitPrice';

// 算出に必要な項目のみ参照する緩い行型（シミュレーション2画面の ProductData と構造互換）。
export interface SimulationSalesRow {
  metaBrand?: string;
  summaryProduct?: string;
  wholesaleMesh?: string;
  quantity?: string;
  plan?: string;
  // 社外売上高（算出済・3桁区切り文字列）
  externalSales?: string;
}

export interface SimulationSalesAmounts {
  volumeAdd: number; // 量経追加口
  condition: number; // 条件口（帳合料）
  sales: number; // 売上高
}

// 数値化。数値でない値は0にする（算出を壊さないため）。
const num = (value: unknown): number => {
  const parsed = parseFormulaNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function simulationSalesOf(
  row: SimulationSalesRow,
  planPattern: PlanPattern
): SimulationSalesAmounts {
  const externalSales = num(row.externalSales);
  const volumeAdd =
    externalSales * volumeAddRateOf(toAxisMetaBrand(row.metaBrand ?? ''));
  const conditionUnitPrice = deriveConditionUnitPrice({
    planPattern,
    summaryProduct: row.summaryProduct ?? '',
    wholesaleMesh: row.wholesaleMesh ?? '',
    storeKey: DEFAULT_STORE_KEY,
  }).value;
  const condition = conditionUnitPrice * num(row.quantity) * num(row.plan);
  return {
    volumeAdd,
    condition,
    sales: externalSales - volumeAdd - condition,
  };
}

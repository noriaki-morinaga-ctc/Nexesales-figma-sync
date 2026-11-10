// 販売計画シミュレーション明細の管理利益額 ─ 計画詳細の集計（補足3-1）と同じ式で明細1行ごとに算出する。
//
//   管理利益額 ＝ 売買差益 − 直接固定費
//   売買差益   ＝ 売上総利益 − 変動費
//   売上総利益 ＝ 売上高 − 売上原価
//   売上高     ＝ 社外売上高 − 量経追加口 − 条件口（simulationSalesOf）
//   売上原価   ＝ 売上原価単価(補足2-3) × 入数 × 計画函数
//   変動費     ＝ センターフィ ＋ ロケ補填
//   センターフィ ＝ センターフィ率の既定設定(補足4-1) × 算出基準（社外売上高／納品金額）
//   直接固定費 ＝ 拡売費(固定費) ＋ 自販機関連費
//
// ロケ補填・拡売費(固定費)・自販機関連費は、明細の拡売費①②（変更前の計画金額）を管理区分で振り分ける
// （計画詳細は拡売費計画タブの行を utils/sales-plan/plan-detail/expenseGridToAggregation で同じく管理区分により振り分ける）。
// 売上連動拡売費は計画詳細と同じく管理利益額の計算に含めない（売上値引として別集計される項目）。
import { parseFormulaNumber } from '../../../components/grid/gridCommon';
import { isPBProduct } from '../../../constants/aggregationAxisMapping';
import { DEFAULT_COMMON_RATE_SETTINGS } from '../../../constants/commonRateSettings';
import { managementClassFromCode } from '../../../constants/expenseRelations';
import { computeCommonRateAmount } from '../common/commonRateAmounts';
import type { PlanPattern } from '../common/conditionUnitPrice';
import {
  simulationSalesOf,
  type SimulationSalesAmounts,
  type SimulationSalesRow,
} from './simulationSalesAmount';

// 算出に必要な項目のみ参照する緩い行型（シミュレーション2画面の ProductData と構造互換）。
export interface SimulationProfitRow extends SimulationSalesRow {
  planPrice?: string; // 納価（納品金額＝センターフィの算出基準に使う）
  exp1PlannedAmountBefore?: string;
  exp1ManagementClass?: string;
  exp1ManagementCode?: string;
  exp2PlannedAmountBefore?: string;
  exp2ManagementClass?: string;
  exp2ManagementCode?: string;
}

export interface SimulationProfitAmounts extends SimulationSalesAmounts {
  cost: number; // 売上原価
  grossProfit: number; // 売上総利益
  centerFee: number; // センターフィ
  locFill: number; // ロケ補填
  variableCost: number; // 変動費
  tradeProfit: number; // 売買差益
  fixed: number; // 拡売費(固定費)
  vendingRelated: number; // 自販機関連費
  directFixed: number; // 直接固定費
  mgmtProfit: number; // 管理利益額
}

// 拡売費の管理区分 → 管理利益額の計算で使う費目（計画詳細の集計と同じ区分）。
const FIXED_CLASSES = [
  '拡売費(固定費)A口',
  '拡売費(固定費)B口',
  '拡売費(固定費)本社口',
];
const VENDING_CLASSES = ['コラム料', 'リース料', '販売器具費'];
const LOC_FILL_CLASS = 'ロケ補填';

// 数値化。数値でない値は0にする（算出を壊さないため）。
const num = (value: unknown): number => {
  const parsed = parseFormulaNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// 拡売費①②（変更前の計画金額）のうち、管理区分が classes に含まれるものの合計。
// 管理区分を保持していない行は管理コードの接頭辞から復元する（計画詳細と同じ扱い）。
const expenseAmountOf = (row: SimulationProfitRow, classes: string[]): number =>
  (['exp1', 'exp2'] as const).reduce((sum, prefix) => {
    const className =
      row[`${prefix}ManagementClass`] ||
      managementClassFromCode(row[`${prefix}ManagementCode`] ?? '');
    return classes.includes(className)
      ? sum + num(row[`${prefix}PlannedAmountBefore`])
      : sum;
  }, 0);

// costUnitPrice は画面ごとの商品マスタ解決（makeCostUnitPriceOf）で求めた売上原価単価を渡す。
export function simulationManagementProfitOf(
  row: SimulationProfitRow,
  planPattern: PlanPattern,
  costUnitPrice: number
): SimulationProfitAmounts {
  const salesAmounts = simulationSalesOf(row, planPattern);
  const quantityPlan = num(row.quantity) * num(row.plan);
  const externalSales = num(row.externalSales);

  const cost =
    (Number.isFinite(costUnitPrice) ? costUnitPrice : 0) * quantityPlan;
  const grossProfit = salesAmounts.sales - cost;

  // センターフィ：計画詳細と同じ既定設定・算出基準（PB商品を除く／含む）で求める
  const isPB = isPBProduct(row.metaBrand ?? '');
  const delivery = num(row.planPrice) * quantityPlan;
  const centerFee = computeCommonRateAmount(
    DEFAULT_COMMON_RATE_SETTINGS.centerFee,
    {
      extSalesAll: externalSales,
      extSalesExcludingPB: isPB ? 0 : externalSales,
      deliveryAll: delivery,
      deliveryExcludingPB: isPB ? 0 : delivery,
    }
  );
  const locFill = expenseAmountOf(row, [LOC_FILL_CLASS]);
  const variableCost = centerFee + locFill;
  const tradeProfit = grossProfit - variableCost;

  const fixed = expenseAmountOf(row, FIXED_CLASSES);
  const vendingRelated = expenseAmountOf(row, VENDING_CLASSES);
  const directFixed = fixed + vendingRelated;

  return {
    ...salesAmounts,
    cost,
    grossProfit,
    centerFee,
    locFill,
    variableCost,
    tradeProfit,
    fixed,
    vendingRelated,
    directFixed,
    mgmtProfit: tradeProfit - directFixed,
  };
}

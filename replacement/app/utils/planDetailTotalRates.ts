// 計画詳細（販売計画(詳細)タブ）の合計行に表示する率（課題1758）。
//
// 率は明細の率を単純平均せず、分子・分母をそれぞれ合算してから除算する（加重平均）。
// 集計表（補足3-1）の「率」の合算ルールと同じ考え方。分母が0のときは NaN を返し、
// 画面側は空値として「-」を表示する。
//
//   計画/前年実績比 ＝ Σ計画函数 ÷ Σ前年実績函数（新商品・ギフトは対象外＝明細でも表示しない）
//   マージン率   ＝ Σ(納価 − NET) × 入数 × 函数 ÷ Σ納価 × 入数 × 函数（納品金額）
//   値入率       ＝ Σ値入額 ÷ Σ売価 × 入数 × 函数（値入額 ＝ (売価 − 納価) × 入数 × 函数）
//   量経追加口率 ＝ Σ量経追加口 ÷ Σ社外売上高
//   売買差益率   ＝ Σ売買差益 ÷ Σ売上高
//
// 量経追加口・売上高・売買差益は、販売計画シミュレーションと同じく
// 計画詳細の集計（補足3-1）と同じ式で明細1行ごとに求める（simulationManagementProfitOf）。
// 明細表の合計行のため、拡売費計画タブの行（ロケ補填等）は含めない。
import { parseFormulaNumber } from '../components/grid/gridCommon';
import type { PlanPattern } from './conditionUnitPrice';
import {
  simulationManagementProfitOf,
  type SimulationProfitRow,
} from './simulationManagementProfit';

// 算出に必要な項目のみ参照する緩い行型（計画詳細2画面の ProductData と構造互換）。
export interface PlanDetailTotalRow extends SimulationProfitRow {
  productCategory?: string;
  prevYear?: string;
  net?: string;
  price?: string;
}

export interface PlanDetailTotalRates {
  ratio: number; // 計画/前年実績比（％）
  margin: number; // マージン率（％）
  discount: number; // 値入率（％）
  volumeAddRate: number; // 量経追加口率（％）
  profit: number; // 売買差益率（％）
}

// 分母が0（または対象行なし）のときは NaN。
const ratio = (numerator: number, denominator: number): number =>
  denominator !== 0 ? (numerator / denominator) * 100 : NaN;

// costUnitPriceOf は画面ごとの商品マスタ解決（makeCostUnitPriceOf）を渡す。
export function planDetailTotalRatesOf<R extends PlanDetailTotalRow>(
  rows: R[],
  planPattern: PlanPattern,
  costUnitPriceOf: (row: R) => number
): PlanDetailTotalRates {
  let ratioPlan = 0;
  let ratioPrevYear = 0;
  let marginNum = 0;
  let deliveryAmount = 0;
  let markupAmount = 0;
  let retailAmount = 0;
  let volumeAdd = 0;
  let externalSales = 0;
  let tradeProfit = 0;
  let sales = 0;

  rows.forEach((row) => {
    // 計画/前年実績比：明細でも比を出さない新商品・ギフトは除く
    if (row.productCategory !== '新商品' && row.productCategory !== 'ギフト') {
      ratioPlan += parseFormulaNumber(row.plan) || 0;
      ratioPrevYear += parseFormulaNumber(row.prevYear) || 0;
    }

    const quantityPlan =
      parseFormulaNumber(row.quantity) * parseFormulaNumber(row.plan);
    if (!Number.isFinite(quantityPlan)) return;
    const planPrice = parseFormulaNumber(row.planPrice);
    const net = parseFormulaNumber(row.net);
    const price = parseFormulaNumber(row.price);

    // マージン率：納価・NET の両方がある行だけを対象にする
    if (Number.isFinite(planPrice) && Number.isFinite(net)) {
      marginNum += (planPrice - net) * quantityPlan;
      deliveryAmount += planPrice * quantityPlan;
    }
    // 値入率：売価・納価の両方がある行だけを対象にする（値入額の列と同じ条件）
    if (Number.isFinite(price) && Number.isFinite(planPrice)) {
      markupAmount += (price - planPrice) * quantityPlan;
      retailAmount += price * quantityPlan;
    }

    const amounts = simulationManagementProfitOf(
      row,
      planPattern,
      costUnitPriceOf(row)
    );
    volumeAdd += amounts.volumeAdd;
    externalSales += parseFormulaNumber(row.externalSales) || 0;
    tradeProfit += amounts.tradeProfit;
    sales += amounts.sales;
  });

  return {
    ratio: ratio(ratioPlan, ratioPrevYear),
    margin: ratio(marginNum, deliveryAmount),
    discount: ratio(markupAmount, retailAmount),
    volumeAddRate: ratio(volumeAdd, externalSales),
    profit: ratio(tradeProfit, sales),
  };
}

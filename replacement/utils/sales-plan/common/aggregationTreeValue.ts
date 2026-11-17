// 表示項目ドリルダウン（AggregationItemTreeTable）へ渡す「計算結果」ユーティリティ ─ 課題0623
// 資料「補足3-1.販売計画表の集計の項目一覧」の計算式に基づく AggAmounts（aggregationCalc.ts が算出）を、
// ドリルダウン各ノード（aggregationTree.ts の itemId／key）へ対応づけ、
// 計画/実績・予算・予算比・前年・前年比 の各列値を生成する。
//
// 予算・前年は係数（RATE_SETTINGS）で導出し、比率は 補足3-1 準拠（計画/予算*100・計画/前年*100）。
import type { AggAmounts } from './aggregationCalc';
import { RATE_SETTINGS } from '@/constants/aggregationSourceData';
import type { AggTreeNodeRef } from '@/types/aggregation';
import { PLAN_DETAIL_DIGITS, formatPlanRate } from './planDetailNumberFormat';

export interface ItemValue {
  value: number;
  isRate: boolean;
  isQuantity: boolean;
  // 単価項目（売上高単価・売買差益函単価・管理利益函単価）か。
  // 単価は「円/函」であり集計金額ではないため、千円表示時も表示単位の除算を適用しない
  // （函数(isQuantity)と同じ扱い。Minor 4：千円表示で0円表示になっていた対応）。
  isUnitPrice: boolean;
}

// ノード（itemId／補助key）→ 補足3-1 の計算値。数値を直接使いたい呼び出し側（年間集計の
// 月マトリクス等）は aggItemValue を利用する。
export const aggItemValue = (
  a: AggAmounts,
  row: AggTreeNodeRef
): ItemValue | null => amountOf(a, row);

// ノード（itemId／補助key）→ 補足3-1 の計算値。
// key と itemId しか参照しないため、表示行（AggTreeRow）より広い AggTreeNodeRef を受け取る。
const amountOf = (a: AggAmounts, row: AggTreeNodeRef): ItemValue | null => {
  const amount = (value: number): ItemValue => ({
    value,
    isRate: false,
    isQuantity: false,
    isUnitPrice: false,
  });
  const rate = (value: number): ItemValue => ({
    value,
    isRate: true,
    isQuantity: false,
    isUnitPrice: false,
  });
  const unitPrice = (value: number): ItemValue => ({
    value,
    isRate: false,
    isQuantity: false,
    isUnitPrice: true,
  });

  // 資料の木にのみ存在する補助ノード（itemId 無し）
  if (row.key === 'volumeAdd.cfAmount') {
    // 量経追加口 -金額（CF込）＝ 量経追加口 ＋ センターフィ
    return amount(a.volumeAdd + a.centerFee);
  }

  switch (row.itemId) {
    case 1: // 函数（数量）
      return {
        value: a.func,
        isRate: false,
        isQuantity: true,
        isUnitPrice: false,
      };
    case 2: // 売上高 ＝ 社外売上高 − 量経追加口 − 条件口
      return amount(a.sales);
    case 3: // 社外売上高
      return amount(a.extSales);
    case 4: // 管理利益 ＝ 売買差益 − 直接固定費
      return amount(a.mgmtProfit);
    case 5: // 管理利益率 ＝ 管理利益 / 売上高
      return rate(a.mgmtProfitRate * 100);
    case 6: // 売上高単価 ＝ 社外売単価の集計の加重平均（社外売上高 ÷ Σ(入数×函数)）
      return unitPrice(a.salesUnitPrice);
    case 7: // 納品金額
      return amount(a.deliveryAmount);
    case 8: // 売上値引 -金額 ＝ 量経追加口(金額) ＋ 売上連動拡売費(金額)
      return amount(a.volumeAdd + a.salesLinked);
    case 9: // 売上値引 -率 ＝ 量経追加口(率) ＋ 売上連動拡売費(率)
      return rate((a.volumeAddRateAgg + a.salesLinkedRate) * 100);
    case 10: // 量経追加口 -金額
      return amount(a.volumeAdd);
    case 11: // 量経追加口 -率 ＝ 量経追加口 / 社外売上高
      return rate(a.volumeAddRateAgg * 100);
    case 12: // 量経追加口 -率（CF込）＝（量経追加口＋センターフィ）/ 社外売上高
      return rate(
        a.extSales ? ((a.volumeAdd + a.centerFee) / a.extSales) * 100 : 0
      );
    case 13: // 売上連動拡売費 -金額
      return amount(a.salesLinked);
    case 14: // 売上連動拡売費 -率 ＝ 売上連動拡売費 / 社外売上高
      return rate(a.salesLinkedRate * 100);
    case 15: // 条件口（帳合料）
      return amount(a.condition);
    case 16: // 売上原価 -金額
      return amount(a.cost);
    case 17: // 原価率 ＝ 売上原価 / 社外売上高
      return rate(a.extSales ? (a.cost / a.extSales) * 100 : 0);
    case 18: // 売上総利益 ＝ 売上高 − 売上原価
      return amount(a.netProfit);
    case 19: // 売上総利益率 ＝ 売上総利益 / 売上高
      return rate(a.sales ? (a.netProfit / a.sales) * 100 : 0);
    case 20: // 変動費（CF＋ロケ補填）
      return amount(a.variableCost);
    case 21: // センターフィ
      return amount(a.centerFee);
    case 22: // ロケ補填
      return amount(a.locFill);
    case 23: // 売買差益 ＝ 売上総利益 − 変動費
      return amount(a.tradeProfit);
    case 24: // 売買差益率 ＝ 売買差益 / 売上高
      return rate(a.tradeProfitRate * 100);
    case 25: // 売買差益函単価 ＝ 売買差益 / 函数
      return unitPrice(a.func ? a.tradeProfit / a.func : 0);
    case 26: // 直接固定費 ＝ 拡売費(固定費) ＋ 自販機関連費
      return amount(a.directFixed);
    case 27: // 拡売費(固定費)
      return amount(a.fixed);
    case 28: // 自販機関連費
      return amount(a.vendingRelated);
    case 29: // 管理利益函単価 ＝ 管理利益 / 函数
      return unitPrice(a.func ? a.mgmtProfit / a.func : 0);
    case 30: // 拡売費（売上連動拡売費 ＋ 直接固定費）
      return amount(a.promo);
    default:
      return null;
  }
};

// 率は小数点以下2桁を四捨五入し、小数点以下1桁・3桁区切りで表示する（集計グラフと同じ丸め）。
const fmtRate = (v: number) => formatPlanRate(v, PLAN_DETAIL_DIGITS.rate);

// AggAmounts（対象期間合計の計算結果）から、ドリルダウン用の valueFor を生成する。
// 予算＝計画×係数、前年＝計画×係数、予算比＝計画/予算*100、前年比＝計画/前年*100（補足3-1）。
// displayUnit='thousand' の場合、金額は 1000 で割り小数点以下を四捨五入して表示する（円⇔千円トグル追従）。
export const makeTreeValueFor =
  (a: AggAmounts, displayUnit: 'yen' | 'thousand' = 'yen') =>
  (row: AggTreeNodeRef, columnKey: string): string | number => {
    const info = amountOf(a, row);
    if (!info) return ''; // 計算対象外の項目は空表示
    const { value, isRate, isQuantity, isUnitPrice } = info;
    // 金額の表示整形（千円表示時は floor(v/1000)）。
    // 函数は数量（函）、単価（売上高単価・売買差益函単価・管理利益函単価）は
    // 「円/函」であり、いずれも集計金額（通貨の総額）ではないため表示単位の除算を適用しない
    // （Minor 4：単価は千円表示だと ¥525 のような値が 0 に丸まってしまうため）。
    const fmtAmount = (v: number) =>
      isQuantity || isUnitPrice
        ? Math.round(v).toLocaleString()
        : (displayUnit === 'thousand'
            ? Math.round(v / 1000)
            : Math.round(v)
          ).toLocaleString();
    const budget = value * RATE_SETTINGS.budgetFactor;
    const prevYear = value * RATE_SETTINGS.prevYearFactor;
    switch (columnKey) {
      case 'plan':
        return isRate ? fmtRate(value) : fmtAmount(value);
      case 'budget':
        return isRate ? fmtRate(budget) : fmtAmount(budget);
      case 'budgetRate':
        return budget ? fmtRate((value / budget) * 100) : '';
      case 'budgetDiff': // 予算差 ＝ 計画 − 予算
        return isRate ? fmtRate(value - budget) : fmtAmount(value - budget);
      case 'prevYear':
        return isRate ? fmtRate(prevYear) : fmtAmount(prevYear);
      case 'yoy':
        return prevYear ? fmtRate((value / prevYear) * 100) : '';
      case 'prevYearDiff': // 前年差 ＝ 計画 − 前年
        return isRate ? fmtRate(value - prevYear) : fmtAmount(value - prevYear);
      default:
        return '';
    }
  };

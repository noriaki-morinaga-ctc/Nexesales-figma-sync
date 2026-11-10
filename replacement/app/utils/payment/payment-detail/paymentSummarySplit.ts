// 支払詳細(追加口請求書有)の支払情報サマリ ─ 追加口分割の反映。
//
// 支払情報サマリには分割後の自部署負担分を反映する。販売計画は自部署分しか作っておらず、
// 計画との差異を正しく見るためである（→ 20260901_第33回 決定事項17）。
// 一方、追加口明細グリッドの値は分割前のまま（→ 決定事項15）のため、サマリだけを
// 「基準値 − 分割先へ出した分」で計算し直す。
// 画面では、サマリのモック値を「初期表示の分割を反映したあと」の基準値とみなし、
// 分割先へ出した分には初期表示からの増減（マイナスもあり得る）を渡す。
//
//   支払函数     ＝ 基準値 − 分割先へ出したケース（バラは入数でケース換算）
//   追加口金額   ＝ 基準値 − 分割先へ出した追加口金額
//   支払NET売上高・追加口率・マージン率・売上高・管理利益率 … 既存の計算式で再計算
//   管理利益額   ＝ 基準値 ＋ 売上高の増減（計算式が定義されていないため増減で近似 → 実装計画）
//   実販函数・納品金額・社外売上高・センターフィ・拡売費 … 変えない（分割の対象外）
//   販売計画書・前年実績 … 変えない。差・計画誤差率・前年比は列方向の式で再計算する
//
// 値はすべて数値で扱い、率は百分率（10.0% → 10）で持つ。表示の整形は呼び出し側で行う。
import { roundHalfAway, type SplitOutTotal } from './additionalEntrySplit';

// サマリの支払・実績情報列のうち、分割の再計算に使う値（すべて分割前）。
export interface SummaryPayBase {
  payFunc: number; // 支払函数
  addEntryAmount: number; // 追加口金額
  externalSales: number; // 社外売上高
  deliveryAmount: number; // 納品金額
  promoNetUnapproved: number; // 拡売費（NET未承認）
  promoLinked: number; // 拡売費（NET未承認以外）
  mgmtProfitAmount: number; // 管理利益額
}

// 分割後の支払・実績情報列の値（分割で変わる行のみ）。
export interface SummaryPayAfterSplit {
  payFunc: number;
  addEntryAmount: number;
  payNetSales: number; // 支払NET売上高
  addEntryRate: number; // 追加口率（%）
  marginRate: number; // マージン率（%）
  sales: number; // 売上高
  mgmtProfitAmount: number;
  mgmtProfitRate: number; // 管理利益率（%）
}

// 分割で変わる行のキー（サマリの行キーと同じ）。
export const SPLIT_AFFECTED_SUMMARY_KEYS: readonly (keyof SummaryPayAfterSplit)[] =
  [
    'payFunc',
    'addEntryAmount',
    'payNetSales',
    'addEntryRate',
    'marginRate',
    'sales',
    'mgmtProfitAmount',
    'mgmtProfitRate',
  ];

// 百分率（分母が 0 の場合は NaN。表示側で空欄にする）。
const percent = (numerator: number, denominator: number): number =>
  denominator === 0 ? NaN : (numerator / denominator) * 100;

// 支払NET売上高・売上高（既存の計算式 → ★支払画面集計修正 M8・M12）。
const payNetSalesOf = (b: SummaryPayBase, addEntryAmount: number) =>
  b.externalSales - addEntryAmount - b.promoNetUnapproved;
const salesOf = (b: SummaryPayBase, addEntryAmount: number) =>
  payNetSalesOf(b, addEntryAmount) - b.promoLinked;

// 分割後の支払・実績情報列を計算する。分割が無ければ（splitOut が 0）分割前と同じ値になる。
export const applySplitToSummary = (
  base: SummaryPayBase,
  splitOut: Pick<SplitOutTotal, 'caseEquivalent' | 'addAmount'>
): SummaryPayAfterSplit => {
  const addEntryAmount = base.addEntryAmount - splitOut.addAmount;
  const payNetSales = payNetSalesOf(base, addEntryAmount);
  const sales = salesOf(base, addEntryAmount);
  // 管理利益額は売上高の増減分だけ動かす（追加口の減少分だけ売上高・管理利益が増える）。
  const mgmtProfitAmount =
    base.mgmtProfitAmount + (sales - salesOf(base, base.addEntryAmount));
  return {
    payFunc: base.payFunc - roundHalfAway(splitOut.caseEquivalent),
    addEntryAmount,
    payNetSales,
    addEntryRate: percent(addEntryAmount, base.externalSales),
    marginRate: percent(base.deliveryAmount - payNetSales, base.deliveryAmount),
    sales,
    mgmtProfitAmount,
    mgmtProfitRate: percent(mgmtProfitAmount, sales),
  };
};

// 列方向の値（差・計画誤差率・前年比）。→ ★支払画面集計修正 の G／H／J 列。
//   差         ＝ 支払・実績情報 − 販売計画書（率の行は百分率のポイント差）
//   計画誤差率 ＝ 差 ÷ 支払・実績情報（%）
//   前年比     ＝ 支払・実績情報 ÷ 前年実績（%）
// 販売計画書・前年実績が無い（数値でない）場合は NaN（表示側で元の表示のままにする）。
export const derivedColumnsOf = (
  pay: number,
  plan: number,
  prev: number
): { diff: number; errRate: number; yoy: number } => {
  const diff = Number.isFinite(plan) ? pay - plan : NaN;
  return {
    diff,
    errRate: Number.isFinite(diff) ? percent(diff, pay) : NaN,
    yoy: Number.isFinite(prev) ? percent(pay, prev) : NaN,
  };
};

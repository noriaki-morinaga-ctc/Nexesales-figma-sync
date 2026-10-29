// 販売計画シミュレーション（集計）パターン別集計表向け ─ 詳細グリッド実集計ユーティリティ
// シミュレーション（詳細）グリッドの各明細行（ProductData 互換）を、パターンごとの
// 「集計確度選択（確定/A/B/C）」で絞り込んで合算し、表示項目ドリルダウン
// （AggregationItemTreeTable）へ渡す valueFor を生成する。
//
// 【全項目を表示するための算出方針】
// 詳細グリッドは補足2-1/2-2 の簡易P/L（社外売上高・NET売上高・管理利益額・拡売費①②）のみを
// 行単位で保持し、補足3-1 のフルP/L（量経追加口・条件口・売上原価・センターフィ・ロケ補填・
// 売買差益・直接固定費 等）は保持しない。そこで計画詳細（マージン率固定）と同じダミーデータ
// （aggregationSourceData）と計算式（aggregationCalc の computeForMonths）から、社外売上高に対する
// 各中間項目の構成比を求め、詳細グリッドの確度絞り込み後の実集計値へ適用してフルP/Lを再構成する。
//   ・函数／社外売上高／納品金額／拡売費①② … 詳細グリッドの実入力を集計（確度連動）
//   ・量経追加口／条件口／売上原価／ロケ補填 … 計画詳細ダミーデータ由来の対社外売上高比で按分
//   ・センターフィ … 社外売上高 × センターフィ率（RATE_SETTINGS.centerFeeRate）
//   ・売上連動拡売費／直接固定費 … 実拡売費①②合計を計画詳細の内訳比で按分
//   ・管理利益 … 補足3-1 の全チェーン（売買差益 − 直接固定費）で算出
// これにより全項目が値を持ち、かつ確度選択・詳細入力に連動して変化する。
// ※ 管理利益は補足3-1 のフル定義（計画詳細と同一）で算出するため、詳細グリッドの簡易
//   「管理利益額（＝社外売上高−拡売費①②）」とは値が異なる。

import type { AggTreeNodeRef } from '../constants/aggregationTree';
import type { AggAmounts } from './aggregationCalc';
import { computeMonthsRange } from './aggregationCalc';
import { RATE_SETTINGS } from '../constants/aggregationSourceData';
import { DEFAULT_AGGREGATION_SOURCE } from '../constants/defaultAggregationSource';
import { makeTreeValueFor } from './aggregationTreeValue';
import { managementClassFromCode } from '../constants/expenseRelations';

// 集計に必要な項目のみ参照する緩い行型（ProductData と構造互換）。
export interface SimulationDetailRow {
  probability?: string; // 確度（確定/A/B/C/反映済/不採用）
  _isHeader?: boolean; // 合計・グループ見出し行
  plan?: string; // 計画函数
  quantity?: string; // 入数
  planPrice?: string; // 納価
  externalSales?: string; // 社外売上高（算出済・3桁区切り文字列）
  managementProfitAmount?: string; // 管理利益額（算出済＝社外売上高−拡売費①②／簡易P/L）
  exp1PlannedAmountBefore?: string; // 拡売費①計画金額
  exp1ManagementClass?: string; // 拡売費①管理区分
  exp1ManagementCode?: string; // 拡売費①管理コード（管理区分が空のときの判定用）
  exp2PlannedAmountBefore?: string; // 拡売費②計画金額
  exp2ManagementClass?: string; // 拡売費②管理区分
  exp2ManagementCode?: string; // 拡売費②管理コード（管理区分が空のときの判定用）
}

// パターンごとの集計確度選択（確定/A/B/C）。
export interface ConfidenceSelection {
  fixed: boolean; // 確定
  a: boolean;
  b: boolean;
  c: boolean;
}

// 集計オプション（計画詳細の集計エリアと同じ切替）
export interface SimulationAggregateOptions {
  aOnlyPromo?: boolean; // 「A口のみ集計」
}

// 「A口のみ集計」の対象管理区分。計画詳細の集計（aggregationCalc の「A口のみ集計」）と同じ、
// 売上連動拡売費A口・拡売費(固定費)A口の2費目（共通対応方針P31。対象費目は計画詳細の結論に合わせる）。
export const A_ONLY_PROMO_CLASSES: readonly string[] = [
  '売上連動拡売費A口',
  '拡売費(固定費)A口',
];

// 管理区分（空なら管理コードの接頭辞）が「A口のみ集計」の対象か
export const isAOnlyPromoTarget = (cls?: string, code?: string): boolean =>
  A_ONLY_PROMO_CLASSES.includes(cls || managementClassFromCode(code ?? ''));

// 3桁区切り・符号付きの文字列を数値へ。空/NaN は 0。
const num = (v?: string): number => {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// 選択された確度ラベルの集合。
const selectedProbabilities = (sel: ConfidenceSelection): Set<string> => {
  const s = new Set<string>();
  if (sel.fixed) s.add('確定');
  if (sel.a) s.add('A');
  if (sel.b) s.add('B');
  if (sel.c) s.add('C');
  return s;
};

// 計画詳細（マージン率固定）と同じダミーデータ・計算式から求めた、対社外売上高の構成比。
// これを詳細グリッドの実集計値へ適用して中間項目を按分する（詳細グリッドが持たない項目の補完）。
const MOCK: AggAmounts = computeMonthsRange(
  DEFAULT_AGGREGATION_SOURCE,
  [...Array(12).keys()],
  {}
);
const ratioToExt = (part: number): number =>
  MOCK.extSales ? part / MOCK.extSales : 0;
const R_VOLUME_ADD = ratioToExt(MOCK.volumeAdd); // 量経追加口 / 社外売上高
const R_CONDITION = ratioToExt(MOCK.condition); // 条件口 / 社外売上高
const R_COST = ratioToExt(MOCK.cost); // 売上原価 / 社外売上高
const R_LOC_FILL = ratioToExt(MOCK.locFill); // ロケ補填 / 社外売上高
// 拡売費（売上連動＋直接固定）の内訳比率。実拡売費①②合計を同じ比率で按分する。
const PROMO_TOTAL = MOCK.salesLinked + MOCK.directFixed;
const SHARE_SALES_LINKED = PROMO_TOTAL ? MOCK.salesLinked / PROMO_TOTAL : 0;
const SHARE_VENDING_IN_FIXED = MOCK.directFixed
  ? MOCK.vendingRelated / MOCK.directFixed
  : 0;

// 選択確度で絞った明細行を合算し、補足3-1 のフルP/L（AggAmounts）を再構成する（テスト用に export）。
export const aggregateSimulationDetail = (
  rows: SimulationDetailRow[],
  sel: ConfidenceSelection,
  options: SimulationAggregateOptions = {}
): AggAmounts => {
  const probs = selectedProbabilities(sel);
  let func = 0;
  let extSales = 0;
  let deliveryAmount = 0;
  let promo = 0; // 実入力の拡売費①②合計
  for (const r of rows) {
    if (r._isHeader) continue; // 見出し・合計行は集計対象外
    if (!r.probability || !probs.has(r.probability)) continue; // 未選択確度は除外
    const fn = num(r.plan);
    func += fn;
    extSales += num(r.externalSales);
    // 納品金額＝納価×入数×函数（詳細グリッドの補足2-2 と同一導出）
    deliveryAmount += num(r.planPrice) * num(r.quantity) * fn;
    // 拡売費＝拡売費①＋②（詳細グリッドの実入力）。A口のみ集計時は対象管理区分の金額だけを合算する
    const exp1 = num(r.exp1PlannedAmountBefore);
    const exp2 = num(r.exp2PlannedAmountBefore);
    promo += options.aOnlyPromo
      ? (isAOnlyPromoTarget(r.exp1ManagementClass, r.exp1ManagementCode)
          ? exp1
          : 0) +
        (isAOnlyPromoTarget(r.exp2ManagementClass, r.exp2ManagementCode)
          ? exp2
          : 0)
      : exp1 + exp2;
  }

  // 詳細グリッドが持たない中間項目は、計画詳細のダミーデータ由来の構成比で按分（補足3-1 計算式）。
  const volumeAdd = extSales * R_VOLUME_ADD;
  const condition = extSales * R_CONDITION;
  const cost = extSales * R_COST;
  const sales = extSales - volumeAdd - condition; // 売上高＝社外売上高−量経追加口−条件口
  const netProfit = sales - cost; // 売上総利益＝売上高−売上原価
  const centerFee = extSales * RATE_SETTINGS.centerFeeRate; // センターフィ＝社外売上高×率
  const locFill = extSales * R_LOC_FILL;
  const variableCost = centerFee + locFill; // 変動費＝センターフィ＋ロケ補填
  const tradeProfit = netProfit - variableCost; // 売買差益＝売上総利益−変動費
  // 実入力の拡売費①②合計を、売上連動／直接固定（さらに固定費／自販機関連費）へ計画詳細比率で按分。
  const salesLinked = promo * SHARE_SALES_LINKED;
  const directFixed = promo - salesLinked;
  const vendingRelated = directFixed * SHARE_VENDING_IN_FIXED;
  const fixed = directFixed - vendingRelated;
  const mgmtProfit = tradeProfit - directFixed; // 管理利益＝売買差益−直接固定費（補足3-1）

  return {
    func,
    extSales,
    deliveryAmount,
    volumeAdd,
    condition,
    sales,
    cost,
    netProfit,
    // 口別（A/B/本社口）内訳は詳細グリッドに無いため計へ集約し、口別は 0。
    salesLinkedA: 0,
    salesLinkedB: 0,
    salesLinkedH: 0,
    salesLinked,
    centerFee,
    locFill,
    variableCost,
    tradeProfit,
    fixedA: 0,
    fixedB: 0,
    fixedH: 0,
    fixed,
    // 自販機関連費（コラム/リース/販売器具費）の内訳も無いため計へ集約。
    column: 0,
    lease: 0,
    equip: 0,
    vendingRelated,
    directFixed,
    mgmtProfit,
    promo: salesLinked + directFixed, // 拡売費（＝実入力の拡売費①②合計）
    // 年契基本分・取組強化マージン（補足4-1）はシミュレーション集計では扱わないため 0。
    // 詳細グリッドは3項目の設定条件を持たず、算出の分母（PB除く社外売上高等）も再現できない。
    annualContractAmount: 0,
    incentiveAmount: 0,
    salesUnitPrice: func ? (extSales - volumeAdd) / func : 0,
    mgmtProfitRate: sales ? mgmtProfit / sales : 0,
    tradeProfitRate: sales ? tradeProfit / sales : 0,
    volumeAddRateAgg: extSales ? volumeAdd / extSales : 0,
    salesLinkedRate: extSales ? salesLinked / extSales : 0,
  };
};

// 詳細グリッド行＋確度選択から、AggregationItemTreeTable 用の valueFor を生成する。
// 表示整形・予算/前年の係数導出は既存 makeTreeValueFor と共通化し、計画詳細（詳細タブ）と
// 同一の見え方・全項目表示にする。
export const makeSimulationTreeValueFor = (
  rows: SimulationDetailRow[],
  sel: ConfidenceSelection,
  displayUnit: 'yen' | 'thousand' = 'yen',
  options: SimulationAggregateOptions = {}
): ((row: AggTreeNodeRef, columnKey: string) => string | number) =>
  makeTreeValueFor(aggregateSimulationDetail(rows, sel, options), displayUnit);

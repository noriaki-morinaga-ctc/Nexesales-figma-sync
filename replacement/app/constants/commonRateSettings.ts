// センターフィ率・年契基本分・取組強化マージン率の設定 ─ 新_補足4-1「センターフィ等の共通項目」。
//
// 3項目は同じ設定条件（算出方式 × 集計対象 × PB商品を除く/含む × 指数 × 入力値）を持ち、
// 集計表への反映先だけが異なる（T5-06・T5-07・T5-08）。
// 設定条件と計算式は計画パターン（マージン率固定・NET入力／NET固定）によらず共通。
//
// 画面では計画詳細のツールバー「センターフィ率」「年契基本分」「取組強化マージン率」の
// 右ペインで設定する。本モックでは既定値を定数として保持する。

// 算出方式（補足4-1 の「社外売上高/納品金額/直接入力」）
export type CommonRateMethod = '社外売上高' | '納品金額' | '直接入力';

// 集計対象の指定（補足4-1 の「商流別/メタブランド別」）。直接入力では使わない。
export type CommonRateScope = '商流別' | 'メタブランド別';

export interface CommonRateSetting {
  method: CommonRateMethod;
  scope?: CommonRateScope;
  // PB商品を含めるか（率で算出する場合のみ使用。直接入力では使わない）
  includePB: boolean;
  // 指数(%)。社外売上高から算出する場合のみ乗じる。0〜1 の小数で保持する
  index?: number;
  // 入力値。率の場合は 0〜1 の小数、直接入力の場合は金額（円）
  value: number;
}

export interface CommonRateSettings {
  centerFee: CommonRateSetting; // センターフィ率
  annualContract: CommonRateSetting; // 年契基本分
  incentive: CommonRateSetting; // 取組強化マージン率
}

// 計算の分母となる集計値（PB除く／含むの2通りを社外売上高・納品金額それぞれで持つ）
export interface CommonRateBase {
  extSalesAll: number; // 全商品の 社外売単価×入数×函数 の集計
  extSalesExcludingPB: number; // PB商品を除いた同上
  deliveryAll: number; // 全商品の 納価×入数×函数 の集計
  deliveryExcludingPB: number; // PB商品を除いた同上
}

// 既定設定（画面のツールバー表示値と揃える）。
// センターフィ率 8.70%／年契基本分 8.70%／取組強化マージン率 8.70%。
export const DEFAULT_COMMON_RATE_SETTINGS: CommonRateSettings = {
  centerFee: {
    method: '社外売上高',
    scope: '商流別',
    includePB: false,
    index: 1,
    value: 0.087,
  },
  annualContract: {
    method: '社外売上高',
    scope: '商流別',
    includePB: false,
    index: 1,
    value: 0.087,
  },
  incentive: {
    method: '社外売上高',
    scope: '商流別',
    includePB: false,
    index: 1,
    value: 0.087,
  },
};

// 年契基本分・取組強化マージン率の集計表反映先（補足4-1「集計表反映先の条件指定」）。
// 実装（utils/aggregationCalc.ts の annualContractToA/B/H・salesLinkedB 算出）に
// ロジックとして直接埋め込まれているため定数としては参照されないが、
// 反映先の仕様は以下のとおり（値としては使わないドキュメント目的のコメント）。
//   ・年契基本分：A口のみ☑時＝売上連動拡売費B口／□時＝売上連動拡売費A口+B口+本社口
//     （拡売費の集計「A口のみ」チェックと連動する）
//   ・取組強化マージン率：常に売上連動拡売費B口（補足4-1 取組強化マージン率 No.1〜3）

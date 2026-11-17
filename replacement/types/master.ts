// マスタ（商品・コード名称・条件単価・経費の関係・施策区分・勘定科目・率設定）の型（型だけを書く → 04 §画面ディレクトリ構成「共通の型」）

// 商品マスター・サマリ商品ダミーデータ（販売計画表・シミュレーション・拡売費画面 共通）
// メタブランド／容器容量G／サマリ商品名／一般卸メッシュ等のダミーデータの
// 単一の情報源（Single Source of Truth）。
// 各画面（販売計画表・シミュレーション・年間計画・年間集計・拡売費）はこのモジュールを参照する。

// メタブランド・容器容量Gマスターの1件分
export interface MasterItem {
  code: string;
  name: string;
  value: string;
}

// 一般卸メッシュの1件分
export interface WholesaleMeshOption {
  value: string;
  metaBrand: string;
  containerCapacityG: string;
  quantity: string;
  currentEstimate: string;
  currentActual: string;
  prevYearActual: string;
  net: string;
  // 補足2-3の売上原価単価（支社受渡原価）
  costOfSales: string;
  // 補足2-2「社外売単価の導出方法」で使うマスタ値
  seihan: string;
  itemBaraPrice: string;
  opeChannel: boolean;
  opeBaraPrice: string;
  // 終売区分（NET固定・定番商品で一般卸メッシュ選択時に自動表示。未設定は非終売＝空）
  endSale?: string;
}

// サマリ商品名の1件分
export interface SummaryProductOption {
  value: string;
  metaBrand: string;
  containerCapacityG: string;
  wholesaleMesh: string;
  quantity: string;
  endSale: string;
  promotion: string;
  currentEstimate: string;
  currentActual: string;
  prevYearActual: string;
  net: string;
  deliveryPrice: string;
  margin: string;
  price: string;
  // 補足2-3「売上原価の導出方法」の売上原価単価。
  // 原価は「実原価」「支社受渡原価」の2軸を権限で切り替えるが（課題#0074）、
  // 本モックでは支社受渡原価のみを保持する。
  costOfSales: string;
  // 飲料商品マスタ_商品生産者バラ価格保証金抜（＝生販）
  seihan: string;
  // 補足2-2「社外売単価の導出方法」で使うマスタ値。
  // 飲料単価マスタ_アイテムバラ保証金抜き単価（空文字＝取得不可）
  itemBaraPrice: string;
  // 飲料商品マスタ_オペチャネル
  opeChannel: boolean;
  // 飲料商品マスタ_オペレータバラ保証金抜き価格
  opeBaraPrice: string;
  profitRate: string;
  discountRate: string;
  isNew: boolean;
  // 発売年月（'YYYY/MM'）。新商品（isNew=true）のみ保持する。
  // シミュレーションは対象期間が複数月にわたるため、「新商品かどうか」を
  // 対象年月を基準に判定する（isNewProductAt）。
  newFrom?: string;
}

// 拡売費画面のサマリ商品名（指定なし行を含む簡易版）
export interface ExpenseSummaryProductOption {
  value: string;
  label?: string;
  metaBrand: string;
  // 容器容量（コンボボックスの2行目「ブランド：容量」表示用）
  containerCapacityG?: string;
  isNew: boolean;
}

export interface CodeNameOption {
  code: string;
  name: string;
}

// No.4 商流マスタ：直送商流内部コード → 一次店・二次店・三次店、売上区分
export interface ChannelMasterRecord {
  tier1: string; // 一次店
  tier2: string; // 二次店
  tier3: string; // 三次店
  salesKbn: 'ドライ' | 'チルド';
}

// ── 区分／コードの自動補完（Grid・拡売費追加ペインで共用） ──────────────
// 補完結果は「接頭辞なしのキー」を持つパッチで返す。呼び出し側で exp1/exp2 を付けて適用する。
// キーを省略した項目は「現在値を維持する」意味になる（コードをクリアしても区分は残す既存挙動）。

export interface ExpenseCodePatch {
  ManagementCode?: string;
  ManagementClass?: string;
  AccountItem?: string;
  CampaignCode?: string;
  CampaignClass?: string;
}

// 商品区分・販促区分の選択肢定義（販促区分.xlsx 準拠）
// 商品区分ごとに表示する販促区分リストの単一の情報源（Single Source of Truth）。
// 各画面（販売計画表・年間計画・シミュレーション）はこのモジュールを参照する。

export interface SelectOption {
  value: string;
  label: string;
}

// 拡売費集計「種類別」の勘定科目マスタ。
//
// コード体系：5桁の 5xxxx。51000番台＝売上連動拡売費／52000番台＝拡売費(固定費)および
// その他の直接固定費（ロケ補填・コラム料・リース料・販売器具費）。
// 下2桁が 00 の 51000／52000 が区分計、下3桁目で口（A口＝x100／B口＝x200／本社口＝x300）を表す。
// キーは集計エンジン（utils/sales-plan/common/aggregationCalc の AggAmounts）の項目キーと一致させ、
// 集計値と勘定科目の対応がずれないようにする。

export interface PromotionAccountItem {
  code: string; // 勘定科目コード
  name: string; // 勘定科目名称
}

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

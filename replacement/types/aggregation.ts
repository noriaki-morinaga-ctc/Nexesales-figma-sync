// 集計（集計軸・表示項目・集計ツリー・集計元データ）の型（型だけを書く → 04 §画面ディレクトリ構成「共通の型」）
import type { FormulaTemplate } from '@/components/grid/gridCommon';

// 集計単位の種別（全体／メタブランド／容器容量G のみ）
export type AggregationUnit = 'all' | 'meta-brand' | 'container-capacity';

export interface AggregationUnitOption {
  value: AggregationUnit;
  label: string;
}

// 集計表の表示項目定義 ─ 課題0255/0288/0450
// 30項目を、各集計ビューごとに「常時表示／＋ボタンで表示可／非表示」で出し分けるための
// 単一の情報源（Single Source of Truth）。資料 XLSX「各シートの役割」シート（列E〜H）に準拠。
// 各集計画面（販売計画(集計)・シミュレーション集計・年間集計）はこのモジュールを参照する。
//
// 凡例：
//   'always'   … 〇 常時表示
//   'optional' … △ 「＋」ボタンで表示／非表示を切替可能
//   'hidden'   … × 非表示（BIで閲覧）
//
// ビュー：
//   monthlyChart  … ①各月 販売計画(集計) グラフ（初期表示）
//   monthlyDetail … ①各月 販売計画(集計) 詳細（ボタン切り替え）
//   simulation    … ②シミュレーションシート（補助機能）集計欄
//   annual        … ③年間集計シート
//
// 対象は手売りのみ（自販機は資料「表示項目（自販機）」が未確定のため別途）。

export type DisplayVisibility = 'always' | 'optional' | 'hidden';

export type AggregationView =
  | 'monthlyChart'
  | 'monthlyDetail'
  | 'simulation'
  | 'annual';

export interface AggregationDisplayItem {
  // 資料の項目No（1〜30）
  id: number;
  // 項目名
  label: string;
  // 今回追加した新規項目か（資料スライド4）
  isNew?: boolean;
  // 新規項目の計算式メモ（補足資料準拠）
  formula?: string;
  // 課題0450：条件口は全ビュー非表示だが、管理利益の算出では差し引く対象
  deductFromManagementProfit?: boolean;
  // ビューごとの表示判定
  visibility: Record<AggregationView, DisplayVisibility>;
}

// 将来、ASD管理者が×項目を〇/△へ変更できるようにするための上書き口（課題スライド4【相談】）。
// 現状は上書き無し。overrides を渡すと該当ビューの判定だけ差し替える。
export type DisplayOverrides = Partial<
  Record<number, Partial<Record<AggregationView, DisplayVisibility>>>
>;

// 集計対象から除外する組合せ（メタブランド value × 容器容量G value）─ 課題0290。
//
// 除外ペアの編集UIは features/sales-plan/shared/common/AggregationFilter が担当するが、型と判定関数は
// 集計エンジン（utils/sales-plan/common/aggregationCalc）も使うため、React に依存しない本モジュールへ置く。
export interface ExcludePair {
  brand: string;
  capacity: string;
}

export interface AggFormula extends FormulaTemplate {
  // ハイライト対象のツリーノードキー（＝ template 中の {key} の重複を除いたもの）。
  refKeys: string[];
}

// 販売計画(集計)の集計ソースの型定義。
//
// 集計値は販売計画(詳細)グリッドと拡売費計画グリッドの行から算出する
// （utils/sales-plan/plan-detail/planGridToAggregation・utils/sales-plan/plan-detail/expenseGridToAggregation が変換を担う）。
// グリッドに列が無い項目（社外売単価・条件口単価・原価単価・量経追加口率）は
// 補足2-2／2-3／4-2 の導出ロジックとダミーマスタ（constants/aggregationMasterDummy）が供給する。

// 月別系列（index0=1月 … index11=12月）
export type MonthlySeries = number[];

// ── 販売計画(詳細) 由来の商品ソース ─────────────────────────
export interface AggregationProduct {
  metaBrand: string; // 集計軸メタブランド
  capacity: string; // 集計軸容器容量G
  isPB: boolean; // PB商品か（補足4-1 のPB除外計算で使用）
  quantity: number; // 入数
  funcByMonth: MonthlySeries; // 月別 計画函数（1〜12月）
  extUnitPrice: number; // 社外売単価（補足2-2）
  deliveryPrice: number; // 納価
  costUnitPriceTransfer: number; // 支社受渡原価＝売上原価単価（補足2-3）
  conditionUnitPrice: number; // 条件口単価（補足4-2）
  volumeAddRate: number; // 量経追加口率（対社外売上高）
}

// ── 拡売費計画 由来の費用ソース ─────────────────────────
// 管理区分（expenseRelations の MANAGEMENT_CODE_PREFIX_TO_CLASS）と一致させる。
export type ExpenseCategory =
  | '売上連動拡売費A口'
  | '売上連動拡売費B口'
  | '売上連動拡売費本社口'
  | '拡売費(固定費)A口'
  | '拡売費(固定費)B口'
  | '拡売費(固定費)本社口'
  | 'ロケ補填'
  | 'コラム料'
  | 'リース料'
  | '販売器具費';

export interface AggregationExpense {
  metaBrand: string; // 集計軸メタブランド
  capacity: string; // 集計軸容器容量G
  category: ExpenseCategory; // 管理区分
  // 拡売費集計対象選択の「対象月」基準の月別計画金額
  amountByTargetMonth: MonthlySeries;
  // 拡売費集計対象選択の「計上月」基準の月別計画金額
  amountByPostingMonth: MonthlySeries;
}

// 集計エンジンへ渡すソース一式
export interface AggregationSource {
  products: AggregationProduct[];
  expenses: AggregationExpense[];
}

export interface AggTreeNode {
  // 木内で一意なキー（hierarchyPath の要素に使う）
  key: string;
  // 表示ラベル（資料の「金額」「率」「函単価」等の総称ラベルを含む）
  label: string;
  // 対応する 30項目マスタの id（数値・可視性の引き当て元）。補助ノードは未指定。
  itemId?: number;
  // itemId を持たない補助ノードの可視性（ビュー別）。省略時は親に追従。
  visibility?: Partial<Record<AggregationView, DisplayVisibility>>;
  // 項目のマウスオーバーで表示する注記（例：納品金額の NO_DELIVERY_PRICE_NOTE）
  note?: string;
  children?: AggTreeNode[];
}

// treeData 用のフラット行（描画側はこの配列を rowData に渡す）
export interface AggTreeRow {
  key: string;
  label: string;
  itemId?: number;
  level: number;
  hierarchyPath: string[];
  hasChildren: boolean;
  // 折りたたみ時に表示する直下の可視子ノード数
  descendantCount: number;
  // 項目のマウスオーバーで表示する注記
  note?: string;
}

// 木のノード参照（key / label / itemId のみ）。
// 計算式ツールチップの実値行のように、可視性に依らずノードの値だけを引きたい用途で使う。
// 表示行（AggTreeRow）とは別物で、level・hierarchyPath・hasChildren・descendantCount は持たない
// （これらは「可視な子」を前提にした表示専用の意味論のため、可視性を無視する用途に持たせない）。
export type AggTreeNodeRef = Pick<AggTreeRow, 'key' | 'label' | 'itemId'>;

export interface FlattenOptions {
  // △（optional）項目のうち、＋ボタンで表示ONにされている itemId 集合
  shownOptionalIds?: Set<number>;
  // itemId→ビュー別可視性を返す関数（呼び出し側で overrides 適用済みを渡せる）
  visibilityOf?: (itemId: number, view: AggregationView) => DisplayVisibility;
}

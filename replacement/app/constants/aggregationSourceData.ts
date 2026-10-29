// 販売計画(集計)の集計ソースの型定義。
//
// 集計値は販売計画(詳細)グリッドと拡売費計画グリッドの行から算出する
// （utils/planGridToAggregation・utils/expenseGridToAggregation が変換を担う）。
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

// 空のソース（グリッド行が未取得の初期描画で使用する）
export const EMPTY_AGGREGATION_SOURCE: AggregationSource = {
  products: [],
  expenses: [],
};

// ── 率・係数の設定 ─────────────────────────
// budgetFactor/prevYearFactor は、予算設定画面・前年同月実績の代替として用いる暫定値（モック）。
// centerFeeRate は補足4-1 のセンターフィ算出（constants/commonRateSettings）へ移したが、
// シミュレーション集計（utils/simulationDetailAggregate）が参照しているため残す。
export const RATE_SETTINGS = {
  centerFeeRate: 0.1, // センターフィ率（シミュレーション集計の簡易算出用）
  budgetFactor: 0.98, // 予算 ＝ 計画 × 係数（暫定）
  prevYearFactor: 0.9, // 前年実績 ＝ 計画 × 係数（暫定）
};

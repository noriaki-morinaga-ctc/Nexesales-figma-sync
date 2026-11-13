import type { AggregationSource } from '@/app/types/aggregation';

// 空のソース（グリッド行が未取得の初期描画で使用する）
export const EMPTY_AGGREGATION_SOURCE: AggregationSource = {
  products: [],
  expenses: [],
};

// ── 率・係数の設定 ─────────────────────────
// budgetFactor/prevYearFactor は、予算設定画面・前年同月実績の代替として用いる暫定値（モック）。
// centerFeeRate は補足4-1 のセンターフィ算出（constants/commonRateSettings）へ移したが、
// シミュレーション集計（utils/sales-plan/simulation/simulationDetailAggregate）が参照しているため残す。
export const RATE_SETTINGS = {
  centerFeeRate: 0.1, // センターフィ率（シミュレーション集計の簡易算出用）
  budgetFactor: 0.98, // 予算 ＝ 計画 × 係数（暫定）
  prevYearFactor: 0.9, // 前年実績 ＝ 計画 × 係数（暫定）
};

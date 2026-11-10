// 計画詳細の共通部品（components/shared/sales-plan/plan-detail/）で使う型。部品どうしが型のために参照し合わないよう、types/ に置く。

export interface MarginRate {
  tier1: string;
  tier3: string;
  rate: number;
}

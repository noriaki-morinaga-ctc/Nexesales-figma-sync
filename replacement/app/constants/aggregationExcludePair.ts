// 集計対象から除外する組合せ（メタブランド value × 容器容量G value）─ 課題0290。
//
// 除外ペアの編集UIは components/shared/sales-plan/common/AggregationFilter が担当するが、型と判定関数は
// 集計エンジン（utils/sales-plan/common/aggregationCalc）も使うため、React に依存しない本モジュールへ置く。
export interface ExcludePair {
  brand: string;
  capacity: string;
}

// 指定の組合せが除外対象か判定
export const isPairExcluded = (
  excludePairs: ExcludePair[],
  brand: string,
  capacity: string
): boolean =>
  excludePairs.some((p) => p.brand === brand && p.capacity === capacity);

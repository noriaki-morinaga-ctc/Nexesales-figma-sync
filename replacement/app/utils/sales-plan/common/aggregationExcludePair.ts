// aggregationExcludePair（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import type { ExcludePair } from '@/app/types/aggregation';

// 指定の組合せが除外対象か判定
export const isPairExcluded = (
  excludePairs: ExcludePair[],
  brand: string,
  capacity: string
): boolean =>
  excludePairs.some((p) => p.brand === brand && p.capacity === capacity);

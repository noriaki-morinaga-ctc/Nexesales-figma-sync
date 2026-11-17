// aggregationMasterDummy（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import {
  DEFAULT_VOLUME_ADD_RATE,
  SEASONAL_INDEX,
  VOLUME_ADD_RATE_BY_BRAND,
} from '@/constants/aggregationMasterDummy';

// グリッドの対象月の値を、季節指数で12か月へ展開する。
// 対象月の要素は必ず入力値そのもの（丸め誤差で動かさない）。
export const expandToMonths = (
  baseValue: number,
  targetMonthIdx0: number
): number[] => {
  const pivot = SEASONAL_INDEX[targetMonthIdx0] ?? 1;
  return SEASONAL_INDEX.map((factor, index) =>
    index === targetMonthIdx0
      ? baseValue
      : Math.round((baseValue * factor) / pivot)
  );
};

// 月別系列を指定月数だけ後ろへずらす（12か月で循環）。
// 拡売費の「対象月基準 → 計上月基準」の読み替えに使用する。
export const shiftMonths = (series: number[], shift: number): number[] =>
  series.map((_, index) => series[(((index - shift) % 12) + 12) % 12]);

// 集計軸メタブランドから量経追加口率を引く。未登録は既定率。
export const volumeAddRateOf = (axisMetaBrand: string): number =>
  VOLUME_ADD_RATE_BY_BRAND[axisMetaBrand] ?? DEFAULT_VOLUME_ADD_RATE;

// 販売計画シミュレーションの明細の数値の変換・整形（マージン率固定・NET固定の明細表で共通）
import {
  formatPlanRate,
  roundPlanNumber,
} from '@/app/utils/sales-plan/common/planDetailNumberFormat';

// 文字列 → 数値（カンマ・% を除く。空・数値でない値は NaN）
export const parseSimMetric = (str?: string): number => {
  if (str === undefined || str === null || String(str).trim() === '')
    return NaN;
  const n = parseFloat(String(str).replace(/[,%]/g, ''));
  return isNaN(n) ? NaN : n;
};

// 算出値の保持用整形。digits を渡した項目（計画詳細と同じ項目一覧の桁数）は
// 端数を四捨五入してその桁数に固定する。保持値のため桁区切りは付けない。
// digits 省略時は、整数はそのまま・小数を持つ場合のみ小数点以下2桁で表示する。
export const formatSimMetric = (
  num: number,
  options: { digits?: number; percent?: boolean } = {}
): string => {
  if (!isFinite(num)) return '';
  const { digits, percent } = options;
  if (digits !== undefined)
    return percent ? formatPlanRate(num, digits) : roundPlanNumber(num, digits);
  const body = Number.isInteger(num) ? String(num) : num.toFixed(2);
  return percent ? `${body}%` : body;
};

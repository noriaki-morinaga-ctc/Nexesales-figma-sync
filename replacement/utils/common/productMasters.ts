// productMasters（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import {
  NEW_PRODUCT_MONTHS,
  PERIOD_OPTIONS_MASTER,
  WHOLESALE_MESH_OPTIONS,
} from '@/constants/productMasters';

export const periodFromProductValue = (value: string): string => {
  const s = String(value ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return PERIOD_OPTIONS_MASTER[Math.abs(h) % PERIOD_OPTIONS_MASTER.length];
};

// 一般卸メッシュの候補（SingleCombobox用）。編集/コピーで選択済みの値（ギフト等マスタ未登録）が
// 候補に無い場合でもフォームに表示できるよう、先頭へ補完する。
export const wholesaleMeshOptions = (
  selected: string
): { value: string; label: string }[] => {
  const base = WHOLESALE_MESH_OPTIONS.map((o) => ({
    value: o.value,
    label: o.value,
  }));
  if (selected && !base.some((o) => o.value === selected)) {
    return [{ value: selected, label: selected }, ...base];
  }
  return base;
};

// 'YYYY/MM' を比較用の通し月数へ変換（不正値は null）。
const monthIndexOf = (yearMonth?: string): number | null => {
  const matched = String(yearMonth ?? '').match(/(\d{4})[/-](\d{1,2})/);
  if (!matched) return null;
  return Number(matched[1]) * 12 + Number(matched[2]);
};

// 指定した対象年月の時点で新商品に該当するか。
// 対象年月が未指定・発売年月を持たない商品は、マスタの isNew をそのまま返す。
export function isNewProductAt(
  product: { isNew: boolean; newFrom?: string },
  targetYearMonth?: string
): boolean {
  if (!product.isNew) return false;
  const from = monthIndexOf(product.newFrom);
  const target = monthIndexOf(targetYearMonth);
  if (from === null || target === null) return product.isNew;
  return target >= from && target < from + NEW_PRODUCT_MONTHS;
}

// aggregationAxisMapping（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import {
  AXIS_CAPACITIES,
  AXIS_META_BRANDS,
  AXIS_OTHER,
  CAPACITY_TO_AXIS,
  META_BRAND_TO_AXIS,
  WATER_CAPACITY_TO_AXIS,
} from '@/app/constants/aggregationAxisMapping';

// 商品マスタのメタブランド → 集計軸のメタブランド。未対応値は「その他」。
export const toAxisMetaBrand = (masterMetaBrand: string): string => {
  const mapped = META_BRAND_TO_AXIS[masterMetaBrand];
  if (mapped && AXIS_META_BRANDS.has(mapped)) return mapped;
  // 商品マスタと集計軸で同名の値はそのまま採用する
  if (AXIS_META_BRANDS.has(masterMetaBrand)) return masterMetaBrand;
  return AXIS_OTHER;
};

// 商品マスタの容器容量 → 集計軸の容器容量G。
// ギフト商品は容器容量によらず集計軸「ギフト」へ、水ブランドは水専用のGへ寄せる。
export const toAxisCapacity = (
  masterCapacity: string,
  masterMetaBrand: string,
  productCategory?: string
): string => {
  if (productCategory === 'ギフト') return 'ギフト';
  const water =
    toAxisMetaBrand(masterMetaBrand) === '水'
      ? WATER_CAPACITY_TO_AXIS[masterCapacity]
      : undefined;
  const mapped = water ?? CAPACITY_TO_AXIS[masterCapacity];
  if (mapped && AXIS_CAPACITIES.has(mapped)) return mapped;
  if (AXIS_CAPACITIES.has(masterCapacity)) return masterCapacity;
  return AXIS_OTHER;
};

// PB商品か（補足4-1 の「PB商品を除く／含む」判定に使用）。
// 商品マスタ側の値「PB商品」と集計軸側の値「PB」の両方を受け付ける。
export const isPBProduct = (masterMetaBrand: string): boolean =>
  masterMetaBrand === 'PB商品' || masterMetaBrand === 'PB';

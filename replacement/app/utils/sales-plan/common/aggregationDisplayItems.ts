// aggregationDisplayItems（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import type {
  AggregationDisplayItem,
  AggregationView,
  DisplayOverrides,
} from '@/app/types/aggregation';
import { AGGREGATION_DISPLAY_ITEMS } from '@/app/constants/aggregationDisplayItems';

export const getDisplayItems = (
  overrides?: DisplayOverrides
): AggregationDisplayItem[] => {
  if (!overrides) return AGGREGATION_DISPLAY_ITEMS;
  return AGGREGATION_DISPLAY_ITEMS.map((item) => {
    const ov = overrides[item.id];
    if (!ov) return item;
    return { ...item, visibility: { ...item.visibility, ...ov } };
  });
};

// 指定ビューで表示対象（常時＋＋ボタン）となる項目
export const getVisibleItems = (
  view: AggregationView,
  overrides?: DisplayOverrides
): AggregationDisplayItem[] =>
  getDisplayItems(overrides).filter((i) => i.visibility[view] !== 'hidden');

// 指定ビューで常時表示（〇）の項目
export const getAlwaysItems = (
  view: AggregationView,
  overrides?: DisplayOverrides
): AggregationDisplayItem[] =>
  getDisplayItems(overrides).filter((i) => i.visibility[view] === 'always');

// 指定ビューで「＋」ボタン切替対象（△）の項目
export const getOptionalItems = (
  view: AggregationView,
  overrides?: DisplayOverrides
): AggregationDisplayItem[] =>
  getDisplayItems(overrides).filter((i) => i.visibility[view] === 'optional');

// ラベルから項目を引く
export const getDisplayItemByLabel = (
  label: string
): AggregationDisplayItem | undefined =>
  AGGREGATION_DISPLAY_ITEMS.find((i) => i.label === label);

// id から項目ラベルを引く（ドリルダウン各ノード→計算結果の突き合わせに使用）
export const getDisplayItemLabelById = (id?: number): string | undefined =>
  id == null
    ? undefined
    : AGGREGATION_DISPLAY_ITEMS.find((i) => i.id === id)?.label;

// promotionCategoryHelpers（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import { getPromotionLabels } from '@/utils/sales-plan/common/promotionCategories';
import {
  GIFT_PROMOTION_CATEGORY,
  SPECIAL_PROMOTION_CATEGORY,
} from '@/constants/promotionCategoryHelpers';

export const promotionLabelsFor = (category: string): string[] =>
  getPromotionLabels(category);

export const promotionValueFor = (f: any): string => {
  if (f.category === SPECIAL_PROMOTION_CATEGORY)
    return SPECIAL_PROMOTION_CATEGORY;
  const v = String(f.promotion ?? '');
  if (f.category === GIFT_PROMOTION_CATEGORY && !v.trim())
    return GIFT_PROMOTION_CATEGORY;
  return v;
};

// 販促区分の必須判定（明細追加・編集・コピー共通）。
// 商品区分によらず必須。特殊商品は自動で「特殊商品」が入るため常に充足する。
export const promotionValid = (f: any): boolean =>
  promotionValueFor(f).trim() !== '';

// 特殊商品・ギフトは販促区分が区分名で固定のため、販促区分入力を非活性にする。
export const promotionFixed = (category: string): boolean =>
  category === SPECIAL_PROMOTION_CATEGORY ||
  category === GIFT_PROMOTION_CATEGORY;

// promotionCategories（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import { PROMOTION_LABELS_BY_CATEGORY } from '@/constants/promotionCategories';

// 指定した商品区分の販促区分ラベル配列を返す（未定義カテゴリは空配列）
export const getPromotionLabels = (category: string): string[] =>
  PROMOTION_LABELS_BY_CATEGORY[category] ?? [];

// 販促区分が選択可能な商品区分か（リストを持つか）
export const hasPromotionOptions = (category: string): boolean =>
  getPromotionLabels(category).length > 0;

// 販促区分・商品区分に関する共通ヘルパー。
// 販売計画表（マージン率固定／NET固定）・シミュレーション各画面で共有する単一ソース。
// 商品区分の選択肢（MARGIN／NET）は画面ごとに異なるため、依存する関数は引数で受け取る。
import { getPromotionLabels } from './promotionCategories';

// 商品区分ごとの販促区分の扱い。
// 特殊商品：選択肢データが無いため常に「特殊商品」に固定。
// 特殊商品・ギフトは販促区分を区分名のみに固定（SSOT の PROMOTION_LABELS_BY_CATEGORY 準拠）。
// ギフトは既定で「ギフト」を選択済みにする（promotionValueFor 参照）。
export const SPECIAL_PROMOTION_CATEGORY = '特殊商品';
export const GIFT_PROMOTION_CATEGORY = 'ギフト';

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

// 編集/コピー対象行の商品区分セレクト選択肢。
// ギフトは3行1セットのため、ギフト⇄他区分の変更を不可とする（対象行がギフトなら
// ギフト固定、非ギフトならギフトを除外）。区分を変えたい場合は削除→追加で対応。
// baseOptions は画面種別ごとの商品区分選択肢（マージン率固定＝MARGIN／NET固定＝NET）を渡す。
export const categoryOptionsForRow = (
  data: any,
  baseOptions: { value: string; label: string }[]
): { value: string; label: string }[] => {
  const isGift =
    data?.section === GIFT_PROMOTION_CATEGORY ||
    data?.productCategory === GIFT_PROMOTION_CATEGORY;
  return isGift
    ? [{ value: GIFT_PROMOTION_CATEGORY, label: GIFT_PROMOTION_CATEGORY }]
    : baseOptions.filter((o) => o.value !== GIFT_PROMOTION_CATEGORY);
};

// 特殊商品・ギフトは販促区分が区分名で固定のため、販促区分入力を非活性にする。
export const promotionFixed = (category: string): boolean =>
  category === SPECIAL_PROMOTION_CATEGORY ||
  category === GIFT_PROMOTION_CATEGORY;

// 対象行がギフトか（商品区分の変更禁止＝非活性の判定に使用）。
export const isGiftRow = (data: any): boolean =>
  data?.section === GIFT_PROMOTION_CATEGORY ||
  data?.productCategory === GIFT_PROMOTION_CATEGORY;

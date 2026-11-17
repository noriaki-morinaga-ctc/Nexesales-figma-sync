// 販促区分・商品区分に関する共通ヘルパー。
// 販売計画表（マージン率固定／NET固定）・シミュレーション各画面で共有する単一ソース。
// 商品区分の選択肢（MARGIN／NET）は画面ごとに異なるため、依存する関数は引数で受け取る。

// 商品区分ごとの販促区分の扱い。
// 特殊商品：選択肢データが無いため常に「特殊商品」に固定。
// 特殊商品・ギフトは販促区分を区分名のみに固定（SSOT の PROMOTION_LABELS_BY_CATEGORY 準拠）。
// ギフトは既定で「ギフト」を選択済みにする（promotionValueFor 参照）。
export const SPECIAL_PROMOTION_CATEGORY = '特殊商品';
export const GIFT_PROMOTION_CATEGORY = 'ギフト';

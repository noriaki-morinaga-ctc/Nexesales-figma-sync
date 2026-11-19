// サマリ商品コードの判定。値の一覧（constants/masterCodeNameOptions）が値を作るときに呼ぶため、
// 値の一覧を読み込む処理（utils/common/masterCodeNameOptions）とは分けて置く（import を循環させない → 03 import と export）。

/** ダミーのサマリ商品か（コード先頭が「D」。判定は暫定で、新商品・新価格用サマリ商品の設計で変わり得る。Q&A No.31） */
export const isDummySummaryProductCode = (code: string): boolean =>
  code.startsWith('D');

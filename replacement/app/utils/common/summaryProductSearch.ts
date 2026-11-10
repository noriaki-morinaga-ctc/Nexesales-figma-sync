// サマリ商品名の候補の2行目（検索対象）を作る（純粋関数）。
// コンボボックスは候補の label・code・value を検索対象にするため、
// code の先頭にサマリ商品コードを入れて、サマリ商品コードでも検索できるようにする。
export const summaryProductOptionCode = (
  productCode: string,
  metaBrand: string,
  containerCapacityG: string
): string => `${productCode}／${metaBrand}：${containerCapacityG}`;

// 拡売費追加ペインのサマリ商品名の候補の2行目（検索対象）を作る（純粋関数）。
// 明細追加ペインと同じくサマリ商品コードでも検索できるよう先頭にコードを入れる。
// 拡売費の商品は容器容量Gを持たないことがあるため、その場合はメタブランドまでにする。
export const expenseSummaryProductOptionCode = (
  productCode: string,
  metaBrand: string,
  containerCapacityG?: string
): string =>
  containerCapacityG
    ? summaryProductOptionCode(productCode, metaBrand, containerCapacityG)
    : `${productCode}／${metaBrand}`;

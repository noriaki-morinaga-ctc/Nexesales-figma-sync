// 計画詳細の明細行の照合（行の更新で、どの行を書き換えるかを決める）
// id を持つ行は id で、持たない行は従来どおりサマリ商品名＋メタブランドで照合する。
export const matchesRow = (
  item: { id?: unknown; summaryProduct?: unknown; metaBrand?: unknown },
  updatedData: { id?: unknown; summaryProduct?: unknown; metaBrand?: unknown }
): boolean =>
  updatedData.id != null
    ? item.id === updatedData.id
    : item.summaryProduct === updatedData.summaryProduct &&
      item.metaBrand === updatedData.metaBrand;

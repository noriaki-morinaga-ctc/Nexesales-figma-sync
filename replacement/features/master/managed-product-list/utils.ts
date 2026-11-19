// 管理対象商品一覧（master/managed-product-list）の処理

// 管理対象エリアが重複するかを判定する
// targetArea は '全国' または支社名のカンマ区切り（例：'中四国支社, 九州支社'）
// 全国は全支社を含むため、いずれかが全国なら常に重複とみなす
export const isAreaOverlapped = (areaA: string, areaB: string): boolean => {
  const parseAreas = (area: string) =>
    area
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

  const areasA = parseAreas(areaA);
  const areasB = parseAreas(areaB);

  if (areasA.includes('全国') || areasB.includes('全国')) {
    return true;
  }

  // 支社が1つでも一致すれば重複
  return areasA.some((area) => areasB.includes(area));
};

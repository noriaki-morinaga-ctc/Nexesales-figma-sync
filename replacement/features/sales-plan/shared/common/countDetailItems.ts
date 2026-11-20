// 販売計画の明細の件数を数える（切替に出す件数。UI/UX UX-118 → 02 §6「切替に件数を出す」）。
// ギフトは3行で1セット（giftSetId が同じ行）のため、セットごとに1件と数える。

interface DetailItemRow {
  section: string;
  giftSetId?: string;
}

// 商品区分の「全て」を表す値
const ALL_SECTIONS = 'all';

// section を渡すとその商品区分の件数、渡さないか 'all' なら全件数を返す
export function countDetailItems(
  rows: readonly DetailItemRow[],
  section?: string
): number {
  const countedGiftSets = new Set<string>();
  let count = 0;
  for (const row of rows) {
    if (section && section !== ALL_SECTIONS && row.section !== section) {
      continue;
    }
    if (row.giftSetId) {
      if (countedGiftSets.has(row.giftSetId)) continue;
      countedGiftSets.add(row.giftSetId);
    }
    count++;
  }
  return count;
}

// 商品区分の切替の選択肢に件数を付ける（value が 'all' の選択肢は全件数）
export function withDetailItemCounts<T extends string>(
  options: readonly { value: T; label: string }[],
  rows: readonly DetailItemRow[]
): { value: T; label: string; count: number }[] {
  return options.map((option) => ({
    ...option,
    count: countDetailItems(rows, option.value),
  }));
}

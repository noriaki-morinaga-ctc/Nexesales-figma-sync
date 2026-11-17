// 明細の表で、明細追加・コピーで足した行の表示位置を決める（純粋関数）。
// 新規追加・下ペインからのコピーは最下行、行コピーはコピー元の行の直下に置く
//（→ guidelines/02_component-rules.md §8「行の追加位置」・UI/UX UX-112）。
// 行を商品区分ごとの配列に分けて持ち、表示のときにまとめて並べ直す画面で使う。

/** 追加した行が持つ項目 */
export interface AddedRowLike {
  /** 追加した順（追加した行だけが持つ。既存の行は無し） */
  _addedSeq?: number;
  /** 行コピーで作った行の、コピー元のまとまりのキー（blockKeyOf の値） */
  _copyOf?: string;
}

/**
 * 既存の行の並びはそのままにして、追加した行を足す位置へ並べ直す。
 * - 追加した行は追加した順（_addedSeq の小さい順）に置いていく。
 * - _copyOf があり、そのまとまりが表に出ていれば、そのまとまりのすぐ下に入れる
 *   （同じ行を続けてコピーしたときは、新しいコピーがコピー元のすぐ下に来る）。
 * - それ以外（新規追加・下ペインからのコピー・コピー元が表に出ていない行コピー）は最下行に置く。
 * blockKeyOf は「一緒に動かす行のまとまり」のキー（ギフトの3行1セットなら giftSetId、ほかは行ID）。
 */
export function orderAddedRows<T extends AddedRowLike>(
  rows: T[],
  blockKeyOf: (row: T) => string
): T[] {
  const result = rows.filter((r) => r._addedSeq == null);
  // 追加した行を、まとまりごとに追加した順へ並べる（同じ順番のまとまりは元の並びのまま）
  const blocks = new Map<string, T[]>();
  rows
    .filter((r) => r._addedSeq != null)
    .forEach((r) => {
      const key = blockKeyOf(r);
      const block = blocks.get(key);
      if (block) block.push(r);
      else blocks.set(key, [r]);
    });
  const ordered = [...blocks.values()].sort(
    (a, b) => (a[0]._addedSeq ?? 0) - (b[0]._addedSeq ?? 0)
  );
  ordered.forEach((block) => {
    const copyOf = block[0]._copyOf;
    if (copyOf != null) {
      // コピー元のまとまりの最後の行の位置
      let last = -1;
      result.forEach((r, i) => {
        if (blockKeyOf(r) === copyOf) last = i;
      });
      if (last >= 0) {
        result.splice(last + 1, 0, ...block);
        return;
      }
    }
    result.push(...block);
  });
  return result;
}

/**
 * 行を配列のまま持つ表で、足した行を入れる（→ 02 §8「行の追加位置」・UI/UX UX-112）。
 * isSource を渡し、それに当たる行（コピー元）があればそのすぐ下に、無ければ最下行に入れる。
 * 新規追加・下ペインからのコピーは isSource を渡さない（最下行）。
 */
export function insertRowsAfter<T>(
  rows: T[],
  added: T[],
  isSource?: (row: T) => boolean
): T[] {
  const idx = isSource ? rows.findIndex(isSource) : -1;
  if (idx < 0) return [...rows, ...added];
  return [...rows.slice(0, idx + 1), ...added, ...rows.slice(idx + 1)];
}

/**
 * 計画の明細の行のまとまりのキー（orderAddedRows の blockKeyOf・行コピーの _copyOf に使う）。
 * ギフトは上旬・中旬・下旬の3行1セット（giftSetId）、ほかは行の id（無ければ区分・メタブランド・サマリ商品）。
 */
export const productRowBlockKey = (row: {
  giftSetId?: string;
  id?: string | number;
  section?: string;
  metaBrand?: string;
  summaryProduct?: string;
}): string =>
  row.giftSetId ??
  (row.id != null
    ? String(row.id)
    : `${row.section}-${row.metaBrand}-${row.summaryProduct}`);

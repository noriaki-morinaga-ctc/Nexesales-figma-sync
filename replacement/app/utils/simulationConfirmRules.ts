// シミュレーション明細の追加に関する排他ルール（手売り／卸 共通）
//
// 要件:
// 1. 追加制限 … 元の販売計画表（シミュレーション表の元行＝_addedSeq 無し）に
//    存在する商品（summaryProduct）は追加できない。同一商品の重複明細は元計画に対しては不可。
// 2. 重複追加可 … 同一計画は複数明細に追加できる（コピーで採番した _planKey を共有）。
//
// ※ かつて存在した「確定の排他」ルール（1計画につき確定は1明細のみ／同一商品の二重確定不可）は
//    廃止。確度はどの明細でも「確定」を選択可能とする（confirmBlockReason は常に null、
//    canSelectConfirm は常に true）。

// 排他判定に必要な行の最小構造（ProductData の部分集合）
export interface ConfirmRuleRow {
  id?: string;
  summaryProduct: string;
  probability?: string;
  _planKey?: string;
  _addedSeq?: number;
}

// 元の販売計画表（_addedSeq 無し行）に存在する商品名の集合。
export const originalProductNames = (rows: ConfirmRuleRow[]): Set<string> => {
  const names = new Set<string>();
  for (const row of rows) {
    if (row._addedSeq == null && row.summaryProduct) {
      names.add(row.summaryProduct);
    }
  }
  return names;
};

// 指定した商品が元の販売計画表に既に存在し、追加できないか。
export const isProductInOriginalPlan = (
  rows: ConfirmRuleRow[],
  summaryProduct: string
): boolean =>
  summaryProduct != null &&
  summaryProduct !== '' &&
  originalProductNames(rows).has(summaryProduct);

// 確定の排他ルールは廃止。確定をブロックする理由は無い（常に確定可能）。
export const confirmBlockReason = (
  _target: ConfirmRuleRow,
  _rows: ConfirmRuleRow[]
): string | null => null;

// 「確定」を選択肢に含めてよいか。排他ルール廃止により常に true。
export const canSelectConfirm = (
  _target: ConfirmRuleRow,
  _rows: ConfirmRuleRow[]
): boolean => true;

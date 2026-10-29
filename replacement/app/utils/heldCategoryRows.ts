// 商品区分タブの表示判定（純粋関数）。
// 表示中のタブで商品区分を変更した行は、変更直後に消えると利用者が混乱するため、
// 別の商品区分タブへ切り替えるまで表示中のタブに残す（計画詳細と同じ動き）。
export interface CategoryTabRow {
  id?: string | number;
  section?: string;
  metaBrand?: string;
  summaryProduct?: string;
  giftSetId?: string;
  period?: string;
}

// 保留する行の識別キー（id優先。区分が変わっても変わらない値で作る）
export const heldRowKeyOf = (row: CategoryTabRow): string =>
  String(
    row.id ??
      `${row.metaBrand}-${row.summaryProduct}-${row.giftSetId ?? ''}-${row.period ?? ''}`
  );

// 表示中のタブに属する行か（商品区分を変更して保留中の行を含む）
export const isRowInActiveTab = (
  row: CategoryTabRow,
  activeTab: string,
  heldKeys: ReadonlySet<string>
): boolean =>
  activeTab === 'all' ||
  row.section === activeTab ||
  heldKeys.has(heldRowKeyOf(row));

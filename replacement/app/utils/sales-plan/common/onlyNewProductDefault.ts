// 「新商品のみ表示」の初期状態を決める（純粋関数）。
// 戻り値 null は「利用者の操作を保つ（変更しない）」を表す。
// ・基準年月が必要な画面で未入力の間（disabled）は、基準の無い絞り込みを残さないためチェックなし
// ・新商品を初期で絞り込む画面では、商品区分が「新商品」ならチェックあり、それ以外はチェックなし
export const initialOnlyNew = (
  category: string,
  onlyNewByDefault: boolean,
  disabled: boolean
): boolean | null => {
  if (disabled) return false;
  if (!onlyNewByDefault) return null;
  return category === '新商品';
};

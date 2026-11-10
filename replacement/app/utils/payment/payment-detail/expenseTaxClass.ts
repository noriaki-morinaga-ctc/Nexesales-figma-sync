import { NET_UNAPPROVED_MGMT_CLASS_NAME } from './paymentSummaryAggregate';

// 管理区分に紐づく税区分（→ C79／補足1-5・1-6 拡売費明細 No.税区分）。
// 管理区分が1B3（値引き（売上連動））の明細は、税区分に紐づく値を入れて非活性とする。
// 税率の改定に備えて8%を画面に固定せず、本番は管理区分とPRIME消費税コードの紐づけ・
// 税率をマスタから引く（マスタの構成は課題No.1916、変更できる人は課題No.1850）。
// モックはその対応表を定数で持つ。
const TAX_CLASS_BY_MGMT_CLASS: Readonly<Record<string, string>> = {
  [NET_UNAPPROVED_MGMT_CLASS_NAME]: '課税8%:2',
};

// 管理区分に紐づく税区分（紐づく税区分が無い管理区分は undefined）。
export const linkedTaxClassOf = (mgmtClass?: string): string | undefined =>
  mgmtClass ? TAX_CLASS_BY_MGMT_CLASS[mgmtClass] : undefined;

// 管理区分に紐づく税区分があれば、明細の税区分をその値にする。
// 税区分を書き換えたときに true を返す（画面はそのセルを再描画する）。
export const applyLinkedTaxClass = (row: {
  mgmtClass?: string;
  taxClass?: string;
}): boolean => {
  const linked = linkedTaxClassOf(row.mgmtClass);
  if (!linked || row.taxClass === linked) return false;
  row.taxClass = linked;
  return true;
};

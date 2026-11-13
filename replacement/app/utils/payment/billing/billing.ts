// 請求（一覧・詳細）の処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import type { BillingDetailRow } from '@/app/types/billing';
import type { BillingDetailStatus } from '@/app/types/billing';
import {
  BILLING_DETAIL_LOCKED_STATUSES,
  NEW_BILLING_ROW_COUNT,
} from '@/app/constants/billing';

// 空の明細行。明細追加（請求詳細）と新規作成時の初期表示で共通に使う。
// 画面から追加する行は AIC が直接入力するため、データ元は常に「AIC入力」。
export const createEmptyBillingDetailRow = (
  id: string,
  invoiceNo = ''
): BillingDetailRow => ({
  id,
  dataSource: 'AIC入力',
  status: '支払画面未反映',
  expenseType: '追加口',
  expenseUnresolved: false,
  targetMonth: '',
  billAmount: null,
  payAmount: null,
  matchKbn: '',
  taxKbn: '2:課税8%',
  payTaxAmount: null,
  productName: '',
  itemName: '',
  perCase: null,
  billingUnit: '3:バラ',
  qty: null,
  unitPrice: null,
  slipNo: '',
  invoiceNo,
  customerCode: '',
  customerName: '',
  staffName: '',
  storeName: '',
  primaryStore: '',
  tertiaryStore: '',
  note: '',
});

// 明細のステータスが支払処理まで進んでいるか（行全体を参照専用にする判定）
export const isBillingDetailStatusLocked = (
  status: BillingDetailStatus | undefined
): boolean => !!status && BILLING_DETAIL_LOCKED_STATUSES.includes(status);

// 新規作成時の初期明細（空行を NEW_BILLING_ROW_COUNT 件）
export const createEmptyBillingDetailRows = (
  count: number = NEW_BILLING_ROW_COUNT
): BillingDetailRow[] =>
  Array.from({ length: count }, (_, index) =>
    createEmptyBillingDetailRow(`NEW-${index + 1}`)
  );

// 明細から⑤-1シートの集計項目を算出する（一覧・詳細で共通の導出）。
//
// 消費税額は集計しない。20260821_第31回 決定事項9〜11 により、税額の確認はBIへ寄せ、
// 新営業システム側では税の計算を行わないため、請求金額は税抜のまま消費税区分別に分けて示す。
// 「支払画面未反映分」も持たない（決定事項21：エラーをすべて解消してからでないと反映できず、
// 請求金額合計と未反映分合計は必ず一致するため概念自体をなくす）。
//
// 各項目の定義（→ 補足3-1 請求の合計項目）：
//   請求金額合計             ＝ 全明細の請求金額の合計（ステータスが空欄・商流未設定の明細を含む）
//   支払金額合計             ＝ 支払金額が入っている明細の支払金額の合計
//   差額(請求-支払)          ＝ 請求金額合計 － 支払金額合計
//                               （支払金額が空欄の明細は、請求金額だけが差額に入る）
//   確定(検印)済 支払金額合計 ＝ 支払処理検印済の明細の支払金額の合計
// 合計は小数第3位を四捨五入し、小数第2位まで持つ。
export const roundBillingAmount = (value: number): number =>
  Math.round(value * 100) / 100;

export const aggregateBillingDetailRows = (rows: BillingDetailRow[]) => {
  let billAmount = 0;
  let payAmount = 0;
  let sealedPayAmount = 0;
  // 消費税区分別の請求金額（税抜）。8%・10%を固定で持たず、区分をキーに集計する。
  const billAmountByTaxKbn: Record<string, number> = {};
  rows.forEach((row) => {
    const bill = row.billAmount ?? 0;
    billAmount += bill;
    billAmountByTaxKbn[row.taxKbn] =
      (billAmountByTaxKbn[row.taxKbn] ?? 0) + bill;
    if (row.payAmount == null) return;
    payAmount += row.payAmount;
    if (row.status === '支払処理検印済') sealedPayAmount += row.payAmount;
  });
  Object.keys(billAmountByTaxKbn).forEach((kbn) => {
    billAmountByTaxKbn[kbn] = roundBillingAmount(billAmountByTaxKbn[kbn]);
  });
  return {
    billAmount: roundBillingAmount(billAmount),
    payAmount: roundBillingAmount(payAmount),
    correction: roundBillingAmount(billAmount - payAmount),
    sealedPayAmount: roundBillingAmount(sealedPayAmount),
    billAmountByTaxKbn,
  };
};

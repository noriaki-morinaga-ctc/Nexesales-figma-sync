// paymentWithInvoiceMockData（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import type {
  AdditionalEntryData,
  ExpenseRow,
} from '@/app/types/paymentDetail';
import { toEntryNumber } from '@/app/utils/payment/payment-detail/additionalEntryRules';
import { createNetUnapprovedRow } from '@/app/utils/payment/payment-detail/nonProductExpenseRows';
import { netRowDataSourceOf } from '@/app/utils/payment/payment-detail/netUnapprovedLink';

// 追加口明細の拡売費金額（NET未承認）から、未承認NETの明細をサマリ商品ごとに作る。
//   支払金額 … 同じサマリ商品の追加口明細の拡売費金額（NET未承認）の合計
//   データ元 … 差を出した追加口明細のデータ元（自動振替＝請求EDI・AIC入力、
//              担当者が直した明細があれば手入力 → utils/payment/payment-detail/netUnapprovedLink の netRowDataSourceOf）
// 拡売費金額が0のサマリ商品は明細を作らない。並びは追加口明細の順。
export const createNetUnapprovedRows = (
  entryRows: readonly AdditionalEntryData[],
  billNoPrefix: string,
  billPage: string
): ExpenseRow[] => {
  const byProduct = new Map<
    string,
    { amount: number; sourceRows: AdditionalEntryData[] }
  >();
  for (const row of entryRows) {
    if (row.isTotal) continue;
    const amount = toEntryNumber(row.expAmount) ?? 0;
    if (amount === 0) continue;
    const current = byProduct.get(row.productName);
    byProduct.set(row.productName, {
      amount: (current?.amount ?? 0) + amount,
      sourceRows: [...(current?.sourceRows ?? []), row],
    });
  }
  return [...byProduct.entries()].map(([product, { amount, sourceRows }], i) =>
    createNetUnapprovedRow({
      lineNo: i + 1,
      product,
      payAmount: amount,
      ...netRowDataSourceOf(sourceRows),
      billNo: `${billNoPrefix}-${String(i + 1).padStart(3, '0')}`,
      billPage,
    })
  );
};

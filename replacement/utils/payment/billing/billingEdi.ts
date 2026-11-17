// 請求EDI取込の処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import type { ProductCodeType } from '@/types/billingEdi';

/** GTIN の先頭ゼロを除き、JAN の変換ルールへ合流できる形にする（8-04 EDI打合せ 決定2）。 */
export const normalizeProductCode = (
  productCodeOriginal: string,
  productCodeType: ProductCodeType | ''
): string =>
  productCodeType === 'GTIN'
    ? productCodeOriginal.replace(/^0+/, '')
    : productCodeOriginal;

/**
 * 商流販売店変換マスタのキー。請求元企業事業所コードがあれば①、無ければ②の組合せで1件を表す。
 * ①で見つからない場合に②へ読み替えることはしない。
 */
export const retailerKey = (
  providerCode: string,
  senderCode: string,
  officeCode: string,
  customerCode: string
): string =>
  officeCode
    ? `${providerCode}|office:${officeCode}|${customerCode}`
    : `${providerCode}|sender:${senderCode}|${customerCode}`;

// 対象月を導出する。対象期間（終了日）が属する月を採り、終了日が空欄なら
// 請求締日が属する月を採る。どちらも取れなければ空文字（＝導出不可）。
// （→ 20260804_第27回 決定事項8・宿題事項8／課題 No.1184・No.1286）
export const resolveTargetMonth = (
  periodTo: string,
  billingClosingDate: string
): string => {
  const monthOf = (date: string) =>
    /^\d{4}\/\d{2}\/\d{2}$/.test(date) ? date.slice(0, 7) : '';
  return monthOf(periodTo) || monthOf(billingClosingDate);
};

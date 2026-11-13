// 請求一覧：検索条件の選択肢のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/app/components/payment/billing-list/page.tsx。

import type {
  BillingCodeName,
  BillingCompanyOption,
  BillingOfficeOption,
} from '@/app/types/billing';
import { BILLING_LIST } from '@/mocks/common/billing';

// ── 検索条件の選択肢（請求一覧） ────────────────────────
// 選択肢は入力単位（BILLING_LIST）から作る。別に定数として持つと一覧の値とずれ、
// 「選んだのに一覧に出ない」状態になるため、実データを唯一の元にする。

// 提供企業。AIC入力分は提供企業を持たないため選択肢には現れない
//（→ 20261006_第37回 決定事項2・4）。
export const BILLING_PROVIDER_OPTIONS: BillingCodeName[] = Array.from(
  new Map(
    BILLING_LIST.filter((row) => row.providerCode).map((row) => [
      row.providerCode,
      { code: row.providerCode, name: row.providerName },
    ])
  ).values()
);

// 請求元企業。AIC入力分は請求元企業を持たないため選択肢には現れない（決定24）。
export const BILLING_COMPANY_OPTIONS: BillingCompanyOption[] = Array.from(
  new Map(
    BILLING_LIST.filter((row) => row.billCompanyCode).map((row) => [
      row.billCompanyCode,
      {
        code: row.billCompanyCode,
        name: row.billCompanyName,
        providerCode: row.providerCode,
      },
    ])
  ).values()
);

// 提供企業を選んだときに出す請求元企業の選択肢（連動フィルタ）。
// 提供企業が未選択なら全件。選んだ場合はその提供企業に属する請求元企業だけを返す。
export const billingCompanyOptionsOf = (
  providerCode: string
): BillingCompanyOption[] =>
  providerCode
    ? BILLING_COMPANY_OPTIONS.filter(
        (company) => company.providerCode === providerCode
      )
    : BILLING_COMPANY_OPTIONS;

// 請求元企業事業所。AIC入力分は事業所コードを持たず名称だけで識別するため（決定24）、
// 選択肢は名称ごとに1件にまとめる。コードを持つ入力単位があればコードも併せて示す。
export const BILLING_OFFICE_OPTIONS: BillingOfficeOption[] = Array.from(
  BILLING_LIST.reduce((acc, row) => {
    const current = acc.get(row.billOfficeName);
    // 同じ名称でコードの有無が混ざる場合は、コードを持つ側を採用する
    if (!current || (!current.code && row.billOfficeCode)) {
      acc.set(row.billOfficeName, {
        code: row.billOfficeCode,
        name: row.billOfficeName,
        companyCode: row.billCompanyCode,
        providerCode: row.providerCode,
      });
    }
    return acc;
  }, new Map<string, BillingOfficeOption>()).values()
);

// 請求元企業・提供企業を選んだときに出す事業所の選択肢（連動フィルタ）。
// 請求元企業を選んだ場合はその企業に属する事業所、請求元企業が未選択で提供企業を選んだ場合は
// その提供企業に属する事業所だけを返す。どちらも未選択なら全件。
export const billingOfficeOptionsOf = (
  companyCode: string,
  providerCode = ''
): BillingOfficeOption[] => {
  if (companyCode)
    return BILLING_OFFICE_OPTIONS.filter(
      (office) => office.companyCode === companyCode
    );
  if (providerCode)
    return BILLING_OFFICE_OPTIONS.filter(
      (office) => office.providerCode === providerCode
    );
  return BILLING_OFFICE_OPTIONS;
};

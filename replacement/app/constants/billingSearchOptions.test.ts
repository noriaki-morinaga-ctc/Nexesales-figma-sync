// 請求一覧の検索条件（請求元企業・請求元企業事業所）の選択肢を検証する。
// 選択肢は一覧の入力単位から作るため、「選んだのに一覧に出ない」状態にならないこと、
// 請求元企業を選ぶと事業所の候補が絞られること（連動フィルタ）を確かめる。
import { describe, it, expect } from 'vitest';
import {
  BILLING_COMPANY_OPTIONS,
  BILLING_OFFICE_OPTIONS,
  billingOfficeOptionsOf,
} from '@/mocks/payment/billing-list';
import { BILLING_LIST } from '@/mocks/common/billing';

describe('BILLING_COMPANY_OPTIONS', () => {
  it('選択肢のコードは必ず一覧のどれかの入力単位に一致する', () => {
    for (const company of BILLING_COMPANY_OPTIONS) {
      expect(
        BILLING_LIST.some((row) => row.billCompanyCode === company.code)
      ).toBe(true);
    }
  });

  it('請求元企業を持つ入力単位は、必ず選択肢から辿り着ける', () => {
    for (const row of BILLING_LIST.filter((r) => r.billCompanyCode)) {
      expect(
        BILLING_COMPANY_OPTIONS.some((c) => c.code === row.billCompanyCode)
      ).toBe(true);
    }
  });

  it('コードと名称の組は一覧の値と一致する（表示と絞り込み結果がずれない）', () => {
    for (const company of BILLING_COMPANY_OPTIONS) {
      const row = BILLING_LIST.find((r) => r.billCompanyCode === company.code);
      expect(row?.billCompanyName).toBe(company.name);
    }
  });

  it('AIC入力の入力単位は請求元企業を持たないため選択肢に現れない（決定24）', () => {
    expect(BILLING_COMPANY_OPTIONS.some((c) => c.code === '')).toBe(false);
  });
});

describe('BILLING_OFFICE_OPTIONS', () => {
  it('選択肢の名称は必ず一覧のどれかの入力単位に一致する', () => {
    for (const office of BILLING_OFFICE_OPTIONS) {
      expect(
        BILLING_LIST.some((row) => row.billOfficeName === office.name)
      ).toBe(true);
    }
  });

  it('すべての入力単位は事業所の選択肢から辿り着ける（AIC入力分を含む）', () => {
    for (const row of BILLING_LIST) {
      expect(
        BILLING_OFFICE_OPTIONS.some((o) => o.name === row.billOfficeName)
      ).toBe(true);
    }
  });

  it('同じ事業所名は1件にまとめる（重複した候補を出さない）', () => {
    const names = BILLING_OFFICE_OPTIONS.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('コードを持つ入力単位がある事業所は、その組のコードを持つ', () => {
    for (const office of BILLING_OFFICE_OPTIONS.filter((o) => o.code)) {
      const row = BILLING_LIST.find((r) => r.billOfficeCode === office.code);
      expect(row?.billOfficeName).toBe(office.name);
    }
  });
});

describe('billingOfficeOptionsOf（請求元企業と請求元企業事業所の連動）', () => {
  it('請求元企業が未選択なら事業所は全件が候補になる', () => {
    expect(billingOfficeOptionsOf('')).toEqual(BILLING_OFFICE_OPTIONS);
  });

  it('請求元企業を選ぶと、その企業に属する事業所だけが候補になる', () => {
    const company = BILLING_COMPANY_OPTIONS[0];
    const options = billingOfficeOptionsOf(company.code);
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThan(BILLING_OFFICE_OPTIONS.length);
    for (const office of options) {
      expect(office.companyCode).toBe(company.code);
    }
  });

  it('絞り込んだ候補で検索すると、必ず一覧に1件以上残る', () => {
    for (const company of BILLING_COMPANY_OPTIONS) {
      for (const office of billingOfficeOptionsOf(company.code)) {
        const hit = BILLING_LIST.filter(
          (row) =>
            row.billCompanyCode === company.code &&
            row.billOfficeName === office.name
        );
        expect(hit.length).toBeGreaterThan(0);
      }
    }
  });
});

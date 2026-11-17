// 請求詳細（AIC入力）の担当者は販売店で決まる。
// 販売店を候補（商流販売店変換マスタ）から選んだ明細は担当者を自動反映して非活性にし、
// 販売店が未選択・手入力の明細だけ、得意先名を手掛かりに画面で選べるようにする。
// その判定と選択肢の作り方を検証する。
import { describe, it, expect } from 'vitest';
import {
  BILLING_CUSTOMER_LINKS,
  billingStaffComboOptions,
  billingStoreComboOptions,
  billingStoreDisplayName,
} from '@/mocks/common/billing';
import { BILLING_STAFF_BY_STORE_NAME } from '@/mocks/payment/billing-detail-aic';
import { BILLING_UNSET_CUSTOMER_NAME } from '@/constants/billing';

describe('BILLING_STAFF_BY_STORE_NAME', () => {
  it('販売店の候補はすべて担当者を引ける（＝候補から選べば必ず自動反映される）', () => {
    for (const option of billingStoreComboOptions('storeName')) {
      expect(BILLING_STAFF_BY_STORE_NAME.get(option.value)).toBeTruthy();
    }
  });

  it('マスタの販売店（名称のみ）から担当者を引ける', () => {
    const link = BILLING_CUSTOMER_LINKS.find((c) => c.storeName);
    expect(link).toBeDefined();
    expect(
      BILLING_STAFF_BY_STORE_NAME.get(billingStoreDisplayName(link!.storeName))
    ).toBe(link!.staffName);
  });

  it('未選択（空欄）・候補に無い手入力の販売店は担当者を引けない（＝担当者を画面で選ぶ）', () => {
    expect(BILLING_STAFF_BY_STORE_NAME.has('')).toBe(false);
    expect(BILLING_STAFF_BY_STORE_NAME.has('候補に無い販売店')).toBe(false);
  });

  it('商流未設定（受け皿）の得意先は販売店を持たないため候補に含めない', () => {
    const unset = BILLING_CUSTOMER_LINKS.find(
      (c) => c.customerName === BILLING_UNSET_CUSTOMER_NAME
    );
    expect(unset?.storeName).toBe('');
    expect(
      Array.from(BILLING_STAFF_BY_STORE_NAME.values()).every(Boolean)
    ).toBe(true);
  });
});

describe('billingStaffComboOptions', () => {
  const options = billingStaffComboOptions();

  it('担当者は重複しない（同じ担当者が複数の得意先を持っても候補は1件）', () => {
    const values = options.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('担当者を持たない得意先（商流未設定の受け皿）は候補に出さない', () => {
    expect(options.every((o) => !!o.value)).toBe(true);
  });

  it('選択の手掛かりとして担当の得意先名をすべて添える', () => {
    for (const option of options) {
      const customerNames = BILLING_CUSTOMER_LINKS.filter(
        (c) => c.staffName === option.value
      ).map((c) => c.customerName);
      expect(customerNames.length).toBeGreaterThan(0);
      for (const name of customerNames) {
        expect(option.code).toContain(name);
      }
    }
  });

  it('販売店から自動反映される担当者は、すべて候補にも含まれる', () => {
    const values = new Set(options.map((o) => o.value));
    for (const staffName of BILLING_STAFF_BY_STORE_NAME.values()) {
      expect(values.has(staffName)).toBe(true);
    }
  });
});

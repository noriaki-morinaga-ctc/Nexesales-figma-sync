import { describe, it, expect } from 'vitest';
import { computeCommonRateAmount } from './commonRateAmounts';
import {
  DEFAULT_COMMON_RATE_SETTINGS,
  type CommonRateBase,
} from '../../../constants/commonRateSettings';

const base: CommonRateBase = {
  extSalesAll: 1000000,
  extSalesExcludingPB: 900000,
  deliveryAll: 800000,
  deliveryExcludingPB: 720000,
};

describe('computeCommonRateAmount（補足4-1）', () => {
  it('社外売上高・PB除く：集計 × 指数 × 入力値', () => {
    const amount = computeCommonRateAmount(
      {
        method: '社外売上高',
        scope: '商流別',
        includePB: false,
        index: 0.9,
        value: 0.1,
      },
      base
    );
    expect(amount).toBeCloseTo(900000 * 0.9 * 0.1, 6);
  });

  it('社外売上高・PB含む：全商品の集計を分母にする', () => {
    const amount = computeCommonRateAmount(
      {
        method: '社外売上高',
        scope: '商流別',
        includePB: true,
        index: 0.9,
        value: 0.1,
      },
      base
    );
    expect(amount).toBeCloseTo(1000000 * 0.9 * 0.1, 6);
  });

  it('納品金額・PB除く：指数は乗じない', () => {
    const amount = computeCommonRateAmount(
      {
        method: '納品金額',
        scope: '商流別',
        includePB: false,
        index: 0.9,
        value: 0.1,
      },
      base
    );
    expect(amount).toBeCloseTo(720000 * 0.1, 6);
  });

  it('納品金額・PB含む：全商品の集計を分母にする', () => {
    const amount = computeCommonRateAmount(
      {
        method: '納品金額',
        scope: 'メタブランド別',
        includePB: true,
        index: 1,
        value: 0.05,
      },
      base
    );
    expect(amount).toBeCloseTo(800000 * 0.05, 6);
  });

  it('直接入力：入力値をそのまま金額として返す（集計しない）', () => {
    const amount = computeCommonRateAmount(
      { method: '直接入力', includePB: false, index: 1, value: 123000 },
      base
    );
    expect(amount).toBe(123000);
  });

  it('指数未設定（undefined）は 1 として扱う', () => {
    const amount = computeCommonRateAmount(
      { method: '社外売上高', scope: '商流別', includePB: false, value: 0.1 },
      base
    );
    expect(amount).toBeCloseTo(900000 * 0.1, 6);
  });

  it('入力値0は金額0を返す', () => {
    const amount = computeCommonRateAmount(
      {
        method: '社外売上高',
        scope: '商流別',
        includePB: false,
        index: 1,
        value: 0,
      },
      base
    );
    expect(amount).toBe(0);
  });
});

describe('DEFAULT_COMMON_RATE_SETTINGS', () => {
  it('3項目すべてに既定設定がある', () => {
    expect(DEFAULT_COMMON_RATE_SETTINGS.centerFee).toBeDefined();
    expect(DEFAULT_COMMON_RATE_SETTINGS.annualContract).toBeDefined();
    expect(DEFAULT_COMMON_RATE_SETTINGS.incentive).toBeDefined();
  });

  it('既定設定で計算すると3項目とも正の金額になる', () => {
    // 既定設定: extSalesExcludingPB = 900000, index = 1, value = 0.087
    // 期待値: 900000 * 1 * 0.087 = 78300
    const centerFee = computeCommonRateAmount(
      DEFAULT_COMMON_RATE_SETTINGS.centerFee,
      base
    );
    expect(centerFee).toBe(78300);

    const annualContract = computeCommonRateAmount(
      DEFAULT_COMMON_RATE_SETTINGS.annualContract,
      base
    );
    expect(annualContract).toBe(78300);

    const incentive = computeCommonRateAmount(
      DEFAULT_COMMON_RATE_SETTINGS.incentive,
      base
    );
    expect(incentive).toBe(78300);
  });
});

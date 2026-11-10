import { describe, it, expect } from 'vitest';
import type {
  ValueFormatterParams,
  ValueParserParams,
} from 'ag-grid-community';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanAmountText,
  formatPlanRateText,
  roundPlanNumber,
  planAmountFormatter,
  planRateFormatter,
  planNumberParser,
  planCountFormatter,
  formatPlanCount,
  formatPlanCountText,
} from './planDetailNumberFormat';

// valueFormatter / valueParser には AG Grid の params のうち
// 本モジュールが参照するフィールドのみを渡す。
const fmtParams = (value: unknown, data: Record<string, unknown> = {}) =>
  ({ value, data }) as unknown as ValueFormatterParams;
const parseParams = (newValue: unknown, oldValue?: unknown) =>
  ({ newValue, oldValue }) as unknown as ValueParserParams;

describe('planAmountFormatter', () => {
  const price = planAmountFormatter(PLAN_DETAIL_DIGITS.price);
  const amount = planAmountFormatter(PLAN_DETAIL_DIGITS.amount);

  it('NET・納価は小数第2位に揃える', () => {
    expect(price(fmtParams('89.1'))).toBe('89.10');
    expect(price(fmtParams('95.365'))).toBe('95.37');
    expect(price(fmtParams(107))).toBe('107.00');
  });

  it('売価・社外売上高・売上原価は整数に揃える', () => {
    expect(amount(fmtParams('128.00'))).toBe('128');
    expect(amount(fmtParams('128.60'))).toBe('129');
    expect(amount(fmtParams('2,526,720'))).toBe('2,526,720');
  });

  it('空欄はハイフン、ヘッダー行は空文字にする', () => {
    expect(price(fmtParams(''))).toBe('-');
    expect(price(fmtParams(null))).toBe('-');
    expect(price(fmtParams('89.16', { _isHeader: true }))).toBe('');
  });

  it('数値として読めない値はそのまま表示する', () => {
    expect(price(fmtParams('未設定'))).toBe('未設定');
  });
});

describe('planRateFormatter', () => {
  const rate = planRateFormatter(PLAN_DETAIL_DIGITS.rate);
  const marginRate = planRateFormatter(PLAN_DETAIL_DIGITS.marginRate);
  const ratio = planRateFormatter(PLAN_DETAIL_DIGITS.ratio);

  it('値入率・量経追加口率・売買差益率は小数第1位％にする', () => {
    expect(rate(fmtParams('25.50%'))).toBe('25.5%');
    expect(rate(fmtParams('-700.00%'))).toBe('-700.0%');
    // 端数は四捨五入する
    expect(rate(fmtParams('20.06%'))).toBe('20.1%');
    expect(rate(fmtParams('20.05%'))).toBe('20.1%');
  });

  it('率も3桁区切りを付ける', () => {
    expect(rate(fmtParams('1234.56%'))).toBe('1,234.6%');
  });

  it('マージン率は小数第2位％にする', () => {
    expect(marginRate(fmtParams('6.5%'))).toBe('6.50%');
  });

  it('計画/前年実績比は小数第1位％にする', () => {
    expect(ratio(fmtParams('100.00%'))).toBe('100.0%');
  });

  it('空欄はハイフンにする', () => {
    expect(rate(fmtParams(''))).toBe('-');
  });
});

describe('planNumberParser', () => {
  const priceParser = planNumberParser(PLAN_DETAIL_DIGITS.price);
  const amountParser = planNumberParser(PLAN_DETAIL_DIGITS.amount);

  it('入力値を指定桁へ丸めて保持する', () => {
    expect(priceParser(parseParams('95.3'))).toBe('95.30');
    expect(priceParser(parseParams('95.365'))).toBe('95.37');
    expect(amountParser(parseParams('128.6'))).toBe('129');
  });

  it('桁区切り付きの入力も数値として扱う', () => {
    expect(amountParser(parseParams('1,280'))).toBe('1280');
  });

  it('空入力は空欄、数値以外の入力は編集前の値を維持する', () => {
    expect(priceParser(parseParams(''))).toBe('');
    expect(priceParser(parseParams('abc', '95.36'))).toBe('95.36');
  });
});

describe('明細追加ペイン向けの文字列整形', () => {
  it('金額は指定桁へ四捨五入し3桁区切りを付ける', () => {
    expect(formatPlanAmountText('89.1', PLAN_DETAIL_DIGITS.price)).toBe(
      '89.10'
    );
    expect(formatPlanAmountText('12345.6', PLAN_DETAIL_DIGITS.amount)).toBe(
      '12,346'
    );
  });

  it('率は指定桁へ四捨五入して％を付ける', () => {
    expect(formatPlanRateText('6.5%', PLAN_DETAIL_DIGITS.marginRate)).toBe(
      '6.50%'
    );
    expect(formatPlanRateText('25.55%', PLAN_DETAIL_DIGITS.rate)).toBe('25.6%');
  });

  it('空欄・数値以外はそのまま返す', () => {
    expect(formatPlanAmountText('', PLAN_DETAIL_DIGITS.price)).toBe('');
    expect(formatPlanRateText(undefined, PLAN_DETAIL_DIGITS.rate)).toBe('');
  });
});

describe('roundPlanNumber', () => {
  it('四捨五入した桁区切りなしの文字列を返す', () => {
    expect(roundPlanNumber(95.365, 2)).toBe('95.37');
    expect(roundPlanNumber(128.5, 0)).toBe('129');
    expect(roundPlanNumber(1234.567, 2)).toBe('1234.57');
  });
});

describe('planCountFormatter', () => {
  it('函数・入数に3桁区切りを付ける', () => {
    expect(planCountFormatter(fmtParams('20000'))).toBe('20,000');
    expect(planCountFormatter(fmtParams(319784))).toBe('319,784');
    expect(planCountFormatter(fmtParams('800'))).toBe('800');
  });

  it('小数は許容せず四捨五入して整数にする', () => {
    expect(planCountFormatter(fmtParams('1234.5'))).toBe('1,235');
    expect(planCountFormatter(fmtParams('1234.4'))).toBe('1,234');
    expect(planCountFormatter(fmtParams('1234.567'))).toBe('1,235');
    expect(planCountFormatter(fmtParams('1234.00'))).toBe('1,234');
  });

  it('桁区切り付きの文字列を渡しても二重にならない', () => {
    expect(planCountFormatter(fmtParams('50,756'))).toBe('50,756');
  });

  it('空欄はハイフン、ヘッダー行は空文字にする', () => {
    expect(planCountFormatter(fmtParams(''))).toBe('-');
    expect(planCountFormatter(fmtParams('12345', { _isHeader: true }))).toBe(
      ''
    );
  });
});

describe('formatPlanCount', () => {
  it('3桁区切り付きの整数を返す（小数は四捨五入）', () => {
    expect(formatPlanCount(1000)).toBe('1,000');
    expect(formatPlanCount(999)).toBe('999');
    expect(formatPlanCount(1000.5)).toBe('1,001');
  });
});

describe('formatPlanCountText', () => {
  it('文字列の函数・入数にも3桁区切りを付ける', () => {
    expect(formatPlanCountText('20000')).toBe('20,000');
    expect(formatPlanCountText('24')).toBe('24');
  });

  it('空欄・数値以外はそのまま返す', () => {
    expect(formatPlanCountText('')).toBe('');
    expect(formatPlanCountText(undefined)).toBe('');
  });
});

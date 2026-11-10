// 請求詳細（請求EDI取込／AIC入力）の単価系（数量×請求書記載単価・請求単価・
// 請求書記載単価）は、小数第2位まで（端数は四捨五入）で揃える。
import { describe, it, expect } from 'vitest';
import {
  BILLING_UNIT_PRICE_DIGITS,
  formatBillingUnitPrice,
  roundBillingNumber,
} from './billingNumberFormat';
import { BILLING_DETAIL_BY_DATA_SOURCE } from '../../../constants/billingMockData';

describe('roundBillingNumber', () => {
  it('小数第3位を四捨五入して第2位まで持つ', () => {
    expect(roundBillingNumber(30.951776)).toBe(30.95);
    expect(roundBillingNumber(10.075)).toBe(10.08);
    expect(roundBillingNumber(0.005)).toBe(0.01);
  });

  it('取消明細（数量・単価がマイナス）も0から遠ざける四捨五入になる', () => {
    // Math.round は -3830.5 → -3830 と0側へ寄るため、負数では四捨五入にならない
    expect(roundBillingNumber(-38.305)).toBe(-38.31);
    expect(roundBillingNumber(-0.005)).toBe(-0.01);
  });

  it('2進表現の誤差で桁上がりを落とさない（toFixed の既知の挙動を避ける）', () => {
    // (95.365).toFixed(2) は '95.36' になる
    expect(roundBillingNumber(95.365)).toBe(95.37);
    // 数量 × 請求単価 の浮動小数点誤差（149 × 10.07）
    expect(roundBillingNumber(149 * 10.07)).toBe(1500.43);
  });

  it('小数第2位までの値・整数はそのまま返す', () => {
    expect(roundBillingNumber(20.8)).toBe(20.8);
    expect(roundBillingNumber(2080)).toBe(2080);
    expect(roundBillingNumber(-766)).toBe(-766);
    expect(roundBillingNumber(0)).toBe(0);
  });
});

describe('formatBillingUnitPrice', () => {
  it('端数の無い値も0を補って小数第2位まで表示する', () => {
    expect(formatBillingUnitPrice(2080)).toBe('2,080.00');
    expect(formatBillingUnitPrice(20.8)).toBe('20.80');
    expect(formatBillingUnitPrice(3)).toBe('3.00');
  });

  it('3桁区切りを付ける', () => {
    expect(formatBillingUnitPrice(12060.34)).toBe('12,060.34');
    expect(formatBillingUnitPrice(-766)).toBe('-766.00');
  });

  it('小数第3位以下は四捨五入して表示する', () => {
    expect(formatBillingUnitPrice(30.951776)).toBe('30.95');
    expect(formatBillingUnitPrice(95.365)).toBe('95.37');
  });

  it('未入力（null／undefined）・数値でない値は空欄にする', () => {
    expect(formatBillingUnitPrice(null)).toBe('');
    expect(formatBillingUnitPrice(undefined)).toBe('');
    expect(formatBillingUnitPrice('')).toBe('');
    expect(formatBillingUnitPrice(NaN)).toBe('');
  });

  it('既定の桁は小数第2位', () => {
    expect(BILLING_UNIT_PRICE_DIGITS).toBe(2);
    expect(formatBillingUnitPrice(1.005)).toBe(
      formatBillingUnitPrice(1.005, BILLING_UNIT_PRICE_DIGITS)
    );
  });
});

// 画面に出るダミーデータ自体も小数第2位に収まっていることを担保する
//（桁が増えた明細を足すと表示と保持値がずれるため、追加時に気づけるようにする）。
describe('明細ダミーデータの単価系の桁', () => {
  const rows = Object.values(BILLING_DETAIL_BY_DATA_SOURCE).flat();
  // 小数第2位までに収まっているか（丸め前の生値で判定する）
  const withinTwoDigits = (value: number): boolean =>
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;

  it('請求書記載単価は小数第2位までで持つ', () => {
    const over = rows
      .filter((r) => r.unitPrice != null && !withinTwoDigits(r.unitPrice))
      .map((r) => `${r.id}=${r.unitPrice}`);
    expect(over).toEqual([]);
  });

  it('数量×請求書記載単価・請求単価は小数第2位までに丸まる', () => {
    for (const r of rows) {
      if (r.qty != null && r.unitPrice != null) {
        expect(withinTwoDigits(roundBillingNumber(r.qty * r.unitPrice))).toBe(
          true
        );
      }
      if (r.billAmount != null && r.qty) {
        expect(withinTwoDigits(roundBillingNumber(r.billAmount / r.qty))).toBe(
          true
        );
      }
    }
  });
});

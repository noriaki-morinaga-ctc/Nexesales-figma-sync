import { describe, it, expect } from 'vitest';
import {
  computeAmountBreakdown,
  createEmptyAmountBreakdown,
  diffSideOf,
  formatBreakdownAmount,
  sumAmountBreakdowns,
  type AmountBreakdownAccessors,
  type TaxRateColumn,
} from './paymentAmountBreakdown';
import type { DataSource } from '@/app/constants/dataSource';

interface Row {
  bill: number | null;
  pay: number | null;
  tax: TaxRateColumn | null;
  source: DataSource | null;
}

const ACCESSORS: AmountBreakdownAccessors<Row> = {
  bill: (r) => r.bill,
  pay: (r) => r.pay,
  taxColumn: (r) => r.tax,
  dataSource: (r) => r.source,
};

describe('computeAmountBreakdown', () => {
  it('合計＝税率別の和＝データ元別の和になる', () => {
    const b = computeAmountBreakdown<Row>(
      [
        { bill: 1000, pay: 900, tax: '8%', source: '請求EDI' },
        { bill: 500, pay: 500, tax: '10%', source: '手入力' },
        { bill: 200, pay: 300, tax: 'その他(5%)', source: 'AIC入力' },
      ],
      ACCESSORS
    );
    expect(b.bill.total).toBe(1700);
    expect(b.pay.total).toBe(1700);
    expect(b.bill.byTax).toEqual({
      '10%': 500,
      '8%': 1000,
      'その他(5%)': 200,
      'その他(非課税)': 0,
    });
    expect(b.pay.bySource).toEqual({
      請求EDI: 900,
      AIC入力: 300,
      手入力: 500,
    });
  });

  it('請求金額が未設定の行は0として数え、差額はマイナスになる', () => {
    const b = computeAmountBreakdown<Row>(
      [{ bill: null, pay: 250000, tax: '8%', source: '請求EDI' }],
      ACCESSORS
    );
    expect(b.bill.total).toBe(0);
    const diff = diffSideOf(b);
    expect(diff.total).toBe(-250000);
    expect(diff.byTax['8%']).toBe(-250000);
    expect(diff.bySource.請求EDI).toBe(-250000);
  });
});

describe('sumAmountBreakdowns', () => {
  it('セルごとに足す', () => {
    const a = computeAmountBreakdown<Row>(
      [{ bill: 100, pay: 90, tax: '8%', source: '請求EDI' }],
      ACCESSORS
    );
    const c = computeAmountBreakdown<Row>(
      [{ bill: 50, pay: 50, tax: '10%', source: '手入力' }],
      ACCESSORS
    );
    const sum = sumAmountBreakdowns([a, c, createEmptyAmountBreakdown()]);
    expect(sum.bill.total).toBe(150);
    expect(sum.pay.byTax['8%']).toBe(90);
    expect(sum.pay.byTax['10%']).toBe(50);
    expect(diffSideOf(sum).total).toBe(10);
  });
});

describe('formatBreakdownAmount', () => {
  it('Excel の表示形式に合わせる（0は「-」、マイナスは括弧）', () => {
    expect(formatBreakdownAmount(6099263)).toBe('6,099,263');
    expect(formatBreakdownAmount(0)).toBe('-');
    expect(formatBreakdownAmount(-10537)).toBe('(10,537)');
  });

  it('負の値を「-」符号で表示できる（0は「-」のまま）', () => {
    expect(formatBreakdownAmount(-10537, 'minus')).toBe('-10,537');
    expect(formatBreakdownAmount(6099263, 'minus')).toBe('6,099,263');
    expect(formatBreakdownAmount(0, 'minus')).toBe('-');
  });
});

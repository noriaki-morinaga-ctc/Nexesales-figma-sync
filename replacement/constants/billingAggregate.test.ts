import { describe, it, expect } from 'vitest';
import { aggregateBillingDetailRows } from '@/utils/payment/billing/billing';
import {
  BILLING_DETAIL_BY_DATA_SOURCE,
  BILLING_LIST,
} from '@/mocks/common/billing';
import { createEmptyBillingDetailRow } from '@/utils/payment/billing/billing';
import type { BillingDetailRow, BillingDetailStatus } from '@/types/billing';

// 補足3-1 請求の合計項目の具体例を作るための明細（ステータス・請求金額・支払金額だけを持つ）。
const rowOf = (
  id: string,
  status: BillingDetailStatus,
  billAmount: number | null,
  payAmount: number | null
): BillingDetailRow => ({
  ...createEmptyBillingDetailRow(id),
  status,
  billAmount,
  payAmount,
});

describe('aggregateBillingDetailRows（補足3-1 の定義）', () => {
  it('例1：差額(請求-支払)＝請求金額合計－支払金額合計', () => {
    const totals = aggregateBillingDetailRows([
      rowOf('1', '支払処理検印済', 300, 300),
      rowOf('2', '支払処理検印済', 250, 230),
      rowOf('3', '支払処理申請中', 200, 200),
      rowOf('4', '支払画面反映済', 150, 150),
      rowOf('5', '支払画面反映済', 100, 100),
    ]);
    expect(totals.billAmount).toBe(1000);
    expect(totals.payAmount).toBe(980);
    expect(totals.correction).toBe(20);
    expect(totals.sealedPayAmount).toBe(530);
  });

  it('例2：支払金額が空欄の明細は請求金額だけが差額に入る', () => {
    const totals = aggregateBillingDetailRows([
      rowOf('1', '支払画面未反映', 400, null),
      rowOf('2', '支払画面未反映', 300, null),
      rowOf('3', '商流未設定', 100, null),
    ]);
    expect(totals.billAmount).toBe(800);
    expect(totals.payAmount).toBe(0);
    expect(totals.correction).toBe(800);
    expect(totals.sealedPayAmount).toBe(0);
  });

  it('請求EDI のモック明細：全明細が支払画面へ反映済のため差額は 0', () => {
    const totals = aggregateBillingDetailRows(
      BILLING_DETAIL_BY_DATA_SOURCE['EDI']
    );
    expect(totals.billAmount).toBe(19907);
    expect(totals.payAmount).toBe(19907);
    expect(totals.correction).toBe(0);
    // 支払処理検印済の明細（797＋102＋3,619＋270－766）
    expect(totals.sealedPayAmount).toBe(4022);
    expect(totals.billAmountByTaxKbn).toEqual({ '2:課税8%': 19907 });
  });

  it('請求EDI のモック明細で支払金額を空欄にした明細は、請求金額だけが差額に入る', () => {
    // 検算で不一致だった形（No.1・2・9・10 に支払金額が無い）を再現する
    const rows = BILLING_DETAIL_BY_DATA_SOURCE['EDI'].map((row) =>
      ['D470-01', 'D470-02', 'D470-09', 'D470-10'].includes(row.id)
        ? { ...row, payAmount: null }
        : row
    );
    const totals = aggregateBillingDetailRows(rows);
    expect(totals.billAmount).toBe(19907);
    expect(totals.payAmount).toBe(16816);
    expect(totals.correction).toBe(3091);
  });

  it('AIC入力 のモック明細：支払金額が無いため差額は請求金額合計と同じ', () => {
    const totals = aggregateBillingDetailRows(
      BILLING_DETAIL_BY_DATA_SOURCE['AIC入力']
    );
    expect(totals.payAmount).toBe(0);
    expect(totals.correction).toBe(totals.billAmount);
  });

  it('差額は小数第3位を四捨五入して小数第2位まで持つ', () => {
    const totals = aggregateBillingDetailRows([
      rowOf('1', '支払画面反映済', 10.105, 0.1),
      rowOf('2', '支払画面未反映', 0.004, null),
    ]);
    expect(totals.correction).toBe(10.01);
  });
});

describe('BILLING_LIST（請求一覧の合計の列）', () => {
  it('どの行も 差額(請求-支払)＝請求金額合計－支払金額合計', () => {
    for (const row of BILLING_LIST) {
      expect(row.correction, row.id).toBeCloseTo(
        row.billAmount - row.payAmount,
        2
      );
    }
  });

  it('明細を持つ入力単位は、一覧の値が詳細の合計サマリーバーと同じ', () => {
    const edi = BILLING_LIST.find((r) => r.id === 'BILL-EDI-001');
    const aic = BILLING_LIST.find((r) => r.id === 'BILL-AIC-001');
    const pick = (t: ReturnType<typeof aggregateBillingDetailRows>) => ({
      billAmount: t.billAmount,
      payAmount: t.payAmount,
      correction: t.correction,
      sealedPayAmount: t.sealedPayAmount,
    });
    expect(edi).toMatchObject(
      pick(aggregateBillingDetailRows(BILLING_DETAIL_BY_DATA_SOURCE['EDI']))
    );
    expect(aic).toMatchObject(
      pick(aggregateBillingDetailRows(BILLING_DETAIL_BY_DATA_SOURCE['AIC入力']))
    );
  });

  it('確定(検印)済は支払金額合計を超えない', () => {
    for (const row of BILLING_LIST) {
      expect(row.sealedPayAmount, row.id).toBeLessThanOrEqual(row.payAmount);
    }
  });
});

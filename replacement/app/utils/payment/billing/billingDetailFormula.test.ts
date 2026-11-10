// 請求詳細（請求EDI取込／AIC入力）の算出項目と、計算式セルのツールチップ。
// 支払詳細（請求書有）の追加口グリッドと同じく「式 ＝ 実値 ＝ 結果」を出す。
import { describe, it, expect } from 'vitest';
import {
  BILLING_AMOUNT_MISMATCH_THRESHOLD,
  billingAmountGapOf,
  billingBaseQtyOf,
  billingCalcAmountOf,
  billingDiffOf,
  billingFormulaTooltipOf,
  billingUnitPriceOf,
  isBillingAmountMismatch,
} from './billingDetailFormula';
import {
  BILLING_DETAIL_BY_DATA_SOURCE,
  createEmptyBillingDetailRow,
  type BillingDetailRow,
} from '../../../constants/billingMockData';

// 検証用の明細行（必要な項目だけ差し替える）
const rowOf = (over: Partial<BillingDetailRow>): BillingDetailRow => ({
  ...createEmptyBillingDetailRow('T-1'),
  ...over,
});

describe('算出項目', () => {
  it('数量×請求書記載単価は小数第2位まで四捨五入する', () => {
    expect(billingCalcAmountOf(rowOf({ qty: 149, unitPrice: 10.07 }))).toBe(
      1500.43
    );
  });

  it('請求単価は 請求金額 ÷ 数量 を小数第2位まで四捨五入する', () => {
    expect(billingUnitPriceOf(rowOf({ billAmount: 12195, qty: 394 }))).toBe(
      30.95
    );
  });

  it('ケース請求の明細は 請求金額 ÷ 数量 ÷ 入数 でバラ単価にする（課題 No.1283）', () => {
    const row = rowOf({
      billAmount: 11693,
      qty: 60,
      perCase: 24,
      billingUnit: '1:ケース',
    });
    // 11,693 ÷ 60 ÷ 24 ＝ 8.1201… → 8.12
    expect(billingBaseQtyOf(row)).toBe(1440);
    expect(billingUnitPriceOf(row)).toBe(8.12);
  });

  it('ケース請求の 数量×請求書記載単価 は 数量 × 入数 × 単価 で求める', () => {
    const row = rowOf({
      qty: 60,
      perCase: 24,
      unitPrice: 8.12,
      billingUnit: '1:ケース',
    });
    expect(billingCalcAmountOf(row)).toBe(11692.8);
  });

  it('バラ請求の明細は入数を掛けない（数量がすでにバラ本数のため）', () => {
    const row = rowOf({
      billAmount: 1490,
      qty: 149,
      perCase: 6,
      billingUnit: '3:バラ',
    });
    expect(billingBaseQtyOf(row)).toBe(149);
    expect(billingUnitPriceOf(row)).toBe(10);
  });

  it('入数を持たない明細はケース請求でも数量をそのまま使う', () => {
    const row = rowOf({
      billAmount: 1200,
      qty: 10,
      perCase: null,
      billingUnit: '1:ケース',
    });
    expect(billingBaseQtyOf(row)).toBe(10);
    expect(billingUnitPriceOf(row)).toBe(120);
  });

  it('差額（請求-支払）は 請求金額 − 支払金額', () => {
    expect(billingDiffOf(rowOf({ billAmount: 1490, payAmount: 1200 }))).toBe(
      290
    );
  });

  it('算出元が未入力の項目は空欄（null）にする', () => {
    expect(billingCalcAmountOf(rowOf({ qty: 10, unitPrice: null }))).toBeNull();
    expect(
      billingUnitPriceOf(rowOf({ billAmount: 100, qty: null }))
    ).toBeNull();
    // 数量0は0除算になるため空欄
    expect(billingUnitPriceOf(rowOf({ billAmount: 100, qty: 0 }))).toBeNull();
    expect(
      billingDiffOf(rowOf({ billAmount: 100, payAmount: null }))
    ).toBeNull();
    expect(billingCalcAmountOf(undefined)).toBeNull();
  });
});

describe('請求金額と数量×請求書記載単価のずれ', () => {
  it('1円以上のずれを不一致とみなす', () => {
    // 16 × 78.7 = 1,259.20 に対し請求金額 1,258 → ずれ 1.20
    const row = rowOf({ qty: 16, unitPrice: 78.7, billAmount: 1258 });
    expect(billingAmountGapOf(row)).toBe(1.2);
    expect(isBillingAmountMismatch(row)).toBe(true);
  });

  it('1円未満のずれ（卸側の端数処理）は不一致にしない', () => {
    // 100 × 20.8 = 2,080 に対し請求金額 2,079.5 → ずれ 0.50
    const row = rowOf({ qty: 100, unitPrice: 20.8, billAmount: 2079.5 });
    expect(billingAmountGapOf(row)).toBe(0.5);
    expect(isBillingAmountMismatch(row)).toBe(false);
  });

  it('ちょうど1円のずれは不一致に含める（しきい値は以上）', () => {
    const row = rowOf({ qty: 100, unitPrice: 20.8, billAmount: 2079 });
    expect(billingAmountGapOf(row)).toBe(BILLING_AMOUNT_MISMATCH_THRESHOLD);
    expect(isBillingAmountMismatch(row)).toBe(true);
  });

  it('算出元が未入力なら判定しない', () => {
    expect(isBillingAmountMismatch(rowOf({ qty: null, billAmount: 100 }))).toBe(
      false
    );
  });
});

describe('計算式ツールチップ', () => {
  // 149 × 10.07 = 1,500.43／請求金額 1,500 → ずれ 0.43（1円未満＝一致とみなす）。
  // ずれのある行は式の末尾に理由が付くため、ここでは一致する行で式だけを見る。
  const row = rowOf({
    qty: 149,
    unitPrice: 10.07,
    billAmount: 1500,
    payAmount: 1200,
  });

  it('数量×請求書記載単価は式・実値・結果を出す', () => {
    expect(billingFormulaTooltipOf('calcAmount', row)).toBe(
      '数量×請求書記載単価 ＝ 数量 × 請求書記載単価\n＝ 149 × 10.07 ＝ 1,500.43'
    );
  });

  it('請求単価は式・実値・結果を出す', () => {
    expect(billingFormulaTooltipOf('calcUnitPrice', row)).toBe(
      '請求単価（逆算） ＝ 請求金額 ÷ 数量\n＝ 1,500.00 ÷ 149 ＝ 10.07'
    );
  });

  it('差額（請求-支払）は式・実値・結果を出す', () => {
    expect(billingFormulaTooltipOf('diff', row)).toBe(
      '差額（請求-支払）＝ 請求金額 − 支払金額\n＝ 1,500.00 − 1,200.00 ＝ 300.00'
    );
  });

  it('算出元が未入力の箇所は「未入力」と書き、どこが埋まっていないか分かるようにする', () => {
    expect(billingFormulaTooltipOf('calcAmount', rowOf({ qty: 10 }))).toContain(
      '＝ 10 × 未入力 ＝ 未入力'
    );
  });

  it('計算式が無い列は null を返す（呼び出し側でセル値を出す）', () => {
    expect(billingFormulaTooltipOf('productName', row)).toBeNull();
    expect(billingFormulaTooltipOf(undefined, row)).toBeNull();
    expect(billingFormulaTooltipOf('calcAmount', undefined)).toBeNull();
  });

  it('ずれが無い明細では請求金額にツールチップを出さない', () => {
    expect(billingFormulaTooltipOf('billAmount', row)).toBeNull();
  });

  it('1円以上ずれている明細は請求金額・数量×請求書記載単価の両方に理由を出す', () => {
    const gapRow = rowOf({ qty: 16, unitPrice: 78.7, billAmount: 1258 });
    const note =
      '請求金額 1,258.00 と 数量×請求書記載単価 1,259.20 が 1.20 ずれています（1円以上の差）。\n' +
      '内容を確認して請求金額を修正してください。';
    // 請求金額は入力値のため式は無く、ずれの説明だけを出す
    expect(billingFormulaTooltipOf('billAmount', gapRow)).toBe(note);
    // 数量×請求書記載単価は計算式に続けてずれの説明を足す
    const calc = billingFormulaTooltipOf('calcAmount', gapRow);
    expect(calc).toContain('＝ 16 × 78.70 ＝ 1,259.20');
    expect(calc).toContain(note);
  });
});

describe('明細ダミーデータ', () => {
  const rows = Object.values(BILLING_DETAIL_BY_DATA_SOURCE).flat();

  it('赤字表示（1円以上のずれ）の明細は必ず理由のツールチップが出る', () => {
    const mismatched = rows.filter(isBillingAmountMismatch);
    // 画面で赤字になる明細が無いとこの確認が素通りするため、存在すること自体も確かめる
    expect(mismatched.length).toBeGreaterThan(0);
    for (const row of mismatched) {
      expect(billingFormulaTooltipOf('billAmount', row)).toContain(
        'ずれています'
      );
      expect(billingFormulaTooltipOf('calcAmount', row)).toContain(
        'ずれています'
      );
    }
  });

  it('算出元がそろった明細は計算式ツールチップに「未入力」が出ない', () => {
    for (const row of rows) {
      if (row.qty != null && row.unitPrice != null) {
        expect(billingFormulaTooltipOf('calcAmount', row)).not.toContain(
          '未入力'
        );
      }
    }
  });
});

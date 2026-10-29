import { describe, it, expect } from 'vitest';
import {
  applySplitToSummary,
  derivedColumnsOf,
  type SummaryPayBase,
} from './paymentSummarySplit';

// 支払情報サマリのモック値（AggregationPane の支払・実績情報列）。
const BASE: SummaryPayBase = {
  payFunc: 5890,
  addEntryAmount: 6904200,
  externalSales: 16492000,
  deliveryAmount: 10602000,
  promoNetUnapproved: 45998,
  promoLinked: 100000,
  mgmtProfitAmount: 2379334,
};

const NO_SPLIT = { caseEquivalent: 0, addAmount: 0 };

describe('applySplitToSummary', () => {
  it('分割が無ければモックの表示値と一致する（既存の計算式と整合している）', () => {
    const r = applySplitToSummary(BASE, NO_SPLIT);
    expect(r.payFunc).toBe(5890);
    expect(r.addEntryAmount).toBe(6904200);
    expect(r.payNetSales).toBe(9541802);
    expect(r.sales).toBe(9441802);
    expect(r.mgmtProfitAmount).toBe(2379334);
    expect(r.addEntryRate.toFixed(1)).toBe('41.9');
    expect(r.marginRate.toFixed(1)).toBe('10.0');
    expect(r.mgmtProfitRate.toFixed(1)).toBe('25.2');
  });

  it('支払函数・追加口金額から分割先へ出した分を引く', () => {
    const r = applySplitToSummary(BASE, {
      caseEquivalent: 457,
      addAmount: 667807,
    });
    expect(r.payFunc).toBe(5890 - 457);
    expect(r.addEntryAmount).toBe(6904200 - 667807);
  });

  it('支払NET売上高・売上高・管理利益額は追加口の減少分だけ増える', () => {
    const r = applySplitToSummary(BASE, {
      caseEquivalent: 0,
      addAmount: 100000,
    });
    expect(r.payNetSales).toBe(9541802 + 100000);
    expect(r.sales).toBe(9441802 + 100000);
    expect(r.mgmtProfitAmount).toBe(2379334 + 100000);
  });

  it('率は既存の計算式で計算し直す', () => {
    const r = applySplitToSummary(BASE, {
      caseEquivalent: 0,
      addAmount: 100000,
    });
    // 追加口率 ＝ 追加口金額 ÷ 社外売上高
    expect(r.addEntryRate).toBeCloseTo((6804200 / 16492000) * 100, 10);
    // マージン率 ＝（納品金額 − 支払NET売上高）÷ 納品金額
    expect(r.marginRate).toBeCloseTo(
      ((10602000 - 9641802) / 10602000) * 100,
      10
    );
    // 管理利益率 ＝ 管理利益額 ÷ 売上高
    expect(r.mgmtProfitRate).toBeCloseTo((2479334 / 9541802) * 100, 10);
  });

  it('分割先へ出した分が初期表示より減った（マイナスの増減）場合は自部署負担分が増える', () => {
    const r = applySplitToSummary(BASE, {
      caseEquivalent: -60,
      addAmount: -102240,
    });
    expect(r.payFunc).toBe(5890 + 60);
    expect(r.addEntryAmount).toBe(6904200 + 102240);
    expect(r.sales).toBe(9441802 - 102240);
  });

  it('ケース換算に端数があれば四捨五入して引く', () => {
    expect(
      applySplitToSummary(BASE, { caseEquivalent: 10.5, addAmount: 0 }).payFunc
    ).toBe(5879);
  });

  it('分母が 0 の率は NaN（表示側で空欄）', () => {
    const r = applySplitToSummary(
      { ...BASE, externalSales: 0, deliveryAmount: 0 },
      NO_SPLIT
    );
    expect(Number.isNaN(r.addEntryRate)).toBe(true);
    expect(Number.isNaN(r.marginRate)).toBe(true);
  });
});

describe('derivedColumnsOf', () => {
  it('差・計画誤差率・前年比を列方向の式で計算する（モックの支払函数の行と一致）', () => {
    // 支払函数：支払 5,890／計画 5,920／前年 5,857 → 差 -30、誤差率 -0.5%、前年比 100.6%
    const r = derivedColumnsOf(5890, 5920, 5857);
    expect(r.diff).toBe(-30);
    expect(r.errRate.toFixed(1)).toBe('-0.5');
    expect(r.yoy.toFixed(1)).toBe('100.6');
  });

  it('率の行は百分率のポイント差になる', () => {
    // 追加口率：41.86% − 42.14% ＝ -0.28 ポイント
    expect(derivedColumnsOf(41.86, 42.14, 42.9).diff).toBeCloseTo(-0.28, 10);
  });

  it('販売計画書・前年実績が無ければ NaN', () => {
    const r = derivedColumnsOf(45998, NaN, NaN);
    expect(Number.isNaN(r.diff)).toBe(true);
    expect(Number.isNaN(r.errRate)).toBe(true);
    expect(Number.isNaN(r.yoy)).toBe(true);
  });
});

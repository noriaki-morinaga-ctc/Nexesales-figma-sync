import { describe, it, expect } from 'vitest';
import {
  budgetRateColor,
  diffTextColor,
  previousYearRateColor,
} from './aggregationCardColors';

describe('budgetRateColor', () => {
  it('通常項目は 95%以上＝緑／85%以上＝黄／それ未満＝赤', () => {
    expect(budgetRateColor(120).bar).toBe('bg-emerald-500');
    expect(budgetRateColor(95).bar).toBe('bg-emerald-500');
    expect(budgetRateColor(94.9).bar).toBe('bg-amber-500');
    expect(budgetRateColor(85).bar).toBe('bg-amber-500');
    expect(budgetRateColor(84.9).bar).toBe('bg-red-500');
  });

  it('コスト項目（拡売費）は 100%以下＝緑／100%超＝赤', () => {
    expect(budgetRateColor(50, true).bar).toBe('bg-emerald-500');
    expect(budgetRateColor(100, true).bar).toBe('bg-emerald-500');
    expect(budgetRateColor(100.1, true).bar).toBe('bg-red-500');
    expect(budgetRateColor(700, true).bar).toBe('bg-red-500');
  });

  it('コスト項目では通常項目が黄になる帯も緑または赤に振り分ける', () => {
    // 通常項目なら 85〜95% は黄だが、コスト項目は 100%以下のため緑
    expect(budgetRateColor(90).bar).toBe('bg-amber-500');
    expect(budgetRateColor(90, true).bar).toBe('bg-emerald-500');
  });

  it('率が算出できない場合（NaN・Infinity）は赤にする', () => {
    expect(budgetRateColor(Number.NaN).bar).toBe('bg-red-500');
    expect(budgetRateColor(Number.NaN, true).bar).toBe('bg-red-500');
    expect(budgetRateColor(Number.POSITIVE_INFINITY, true).bar).toBe(
      'bg-red-500'
    );
  });

  it('棒グラフと率テキストの色は対になる', () => {
    expect(budgetRateColor(120).text).toBe('text-emerald-600');
    expect(budgetRateColor(90).text).toBe('text-amber-600');
    expect(budgetRateColor(10).text).toBe('text-red-600');
    expect(budgetRateColor(101, true).text).toBe('text-red-600');
  });
});

describe('diffTextColor', () => {
  it('通常項目はプラス＝青／マイナス＝赤', () => {
    expect(diffTextColor(140)).toBe('text-blue-600');
    expect(diffTextColor(-140)).toBe('text-red-600');
  });

  it('コスト項目（拡売費）は色だけ反転する（プラス＝赤／マイナス＝青）', () => {
    expect(diffTextColor(140, true)).toBe('text-red-600');
    expect(diffTextColor(-140, true)).toBe('text-blue-600');
  });
});

describe('previousYearRateColor', () => {
  it('通常項目は 100%以上＝緑／90%以上＝黄／それ未満＝赤', () => {
    expect(previousYearRateColor(100).bar).toBe('bg-emerald-500');
    expect(previousYearRateColor(99.9).bar).toBe('bg-amber-500');
    expect(previousYearRateColor(90).bar).toBe('bg-amber-500');
    expect(previousYearRateColor(89.9).bar).toBe('bg-red-500');
  });

  it('コスト項目（拡売費）は 100%以下＝緑／100%超＝赤', () => {
    expect(previousYearRateColor(89.9, true).bar).toBe('bg-emerald-500');
    expect(previousYearRateColor(100, true).bar).toBe('bg-emerald-500');
    expect(previousYearRateColor(111.1, true).bar).toBe('bg-red-500');
  });
});

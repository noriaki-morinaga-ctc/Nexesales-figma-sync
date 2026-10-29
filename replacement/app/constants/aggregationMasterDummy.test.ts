import { describe, it, expect } from 'vitest';
import {
  SEASONAL_INDEX,
  expandToMonths,
  shiftMonths,
  volumeAddRateOf,
  DEFAULT_VOLUME_ADD_RATE,
  ACTUAL_COST_FACTOR,
} from './aggregationMasterDummy';

describe('SEASONAL_INDEX', () => {
  it('12か月分あり、すべて正の数', () => {
    expect(SEASONAL_INDEX).toHaveLength(12);
    for (const v of SEASONAL_INDEX) expect(v).toBeGreaterThan(0);
  });
});

describe('expandToMonths', () => {
  it('対象月の要素はグリッドの入力値と完全に一致する', () => {
    for (let i = 0; i < 12; i += 1) {
      expect(expandToMonths(800, i)[i]).toBe(800);
    }
  });

  it('12か月分を返し、すべて整数', () => {
    const series = expandToMonths(800, 9);
    expect(series).toHaveLength(12);
    for (const v of series) expect(Number.isInteger(v)).toBe(true);
  });

  it('0を渡すと全月0になる', () => {
    expect(expandToMonths(0, 9)).toEqual(Array(12).fill(0));
  });

  it('季節指数の大小関係が保たれる（8月 > 2月）', () => {
    const series = expandToMonths(1000, 9);
    expect(series[7]).toBeGreaterThan(series[1]);
  });
});

describe('shiftMonths', () => {
  it('指定月数だけ後ろへずらし、12か月で循環する', () => {
    const src = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    expect(shiftMonths(src, 1)[1]).toBe(0);
    expect(shiftMonths(src, 1)[0]).toBe(11);
    expect(shiftMonths(src, 0)).toEqual(src);
  });

  it('負のずらし幅も循環する', () => {
    const src = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    expect(shiftMonths(src, -1)[0]).toBe(1);
    expect(shiftMonths(src, -1)[11]).toBe(0);
  });
});

describe('volumeAddRateOf', () => {
  it('未登録のメタブランドは既定率を返す', () => {
    expect(volumeAddRateOf('未登録')).toBe(DEFAULT_VOLUME_ADD_RATE);
  });

  it('すべての率は0以上1未満', () => {
    for (const brand of ['三ツ矢', 'ワンダ', '十六茶', '未登録']) {
      const rate = volumeAddRateOf(brand);
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThan(1);
    }
  });

  it.each([
    ['三ツ矢', 0.07],
    ['ワンダ', 0.06],
    ['ウィルキンソン', 0.07],
    ['十六茶', 0.065],
    ['水', 0.05],
    ['カルピスコンク', 0.08],
    ['カルピスストレート', 0.075],
    ['モンスター', 0.09],
    ['ヘルスケア', 0.055],
    ['PB', 0.03],
    ['和紅茶', 0.06],
    ['その他', 0.06],
  ])(
    '集計軸メタブランドの量経追加口率テーブルエントリを正確に返す：%s → %f',
    (brand, expectedRate) => {
      expect(volumeAddRateOf(brand)).toBe(expectedRate);
    }
  );
});

describe('ACTUAL_COST_FACTOR', () => {
  it('実原価は支社受渡原価より安い想定の係数', () => {
    expect(ACTUAL_COST_FACTOR).toBeGreaterThan(0);
    expect(ACTUAL_COST_FACTOR).toBeLessThan(1);
  });

  it('実原価係数の正確な値は0.94', () => {
    expect(ACTUAL_COST_FACTOR).toBe(0.94);
  });
});

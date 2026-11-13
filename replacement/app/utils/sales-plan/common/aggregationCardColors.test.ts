import { describe, it, expect } from 'vitest';
import { KPI_RATE_COLORS, kpiRateColor } from './aggregationCardColors';

const { good, warn, bad } = KPI_RATE_COLORS;

describe('kpiRateColor', () => {
  it('通常項目は 100%以上＝紺／90%以上＝オレンジ／90%未満＝赤', () => {
    expect(kpiRateColor(120)).toBe(good);
    expect(kpiRateColor(100)).toBe(good);
    expect(kpiRateColor(99.9)).toBe(warn);
    expect(kpiRateColor(90)).toBe(warn);
    expect(kpiRateColor(89.9)).toBe(bad);
  });

  it('コスト項目（拡売費）は向きを逆にし、100%以下＝紺／110%以下＝オレンジ／110%超＝赤', () => {
    expect(kpiRateColor(50, true)).toBe(good);
    expect(kpiRateColor(100, true)).toBe(good);
    expect(kpiRateColor(100.1, true)).toBe(warn);
    expect(kpiRateColor(110, true)).toBe(warn);
    expect(kpiRateColor(110.1, true)).toBe(bad);
  });

  it('率が算出できない場合（NaN・Infinity）は赤にする', () => {
    expect(kpiRateColor(Number.NaN)).toBe(bad);
    expect(kpiRateColor(Number.NaN, true)).toBe(bad);
    expect(kpiRateColor(Number.POSITIVE_INFINITY, true)).toBe(bad);
  });
});

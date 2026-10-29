import { describe, it, expect } from 'vitest';
import {
  alignToPeriod,
  isInPeriod,
  monthNumberOf,
  monthIndex0Of,
  yearAroundRange,
  withYear,
} from './yearMonth';

describe('monthNumberOf', () => {
  it('ゼロ埋めあり・なしのどちらも解釈する', () => {
    expect(monthNumberOf('2025/10')).toBe(10);
    expect(monthNumberOf('2025/07')).toBe(7);
    expect(monthNumberOf('2025/7')).toBe(7);
  });

  it('1月と12月の境界を解釈する', () => {
    expect(monthNumberOf('2025/01')).toBe(1);
    expect(monthNumberOf('2025/12')).toBe(12);
  });

  it('範囲外・不正値は null を返す', () => {
    expect(monthNumberOf('2025/00')).toBeNull();
    expect(monthNumberOf('2025/13')).toBeNull();
    expect(monthNumberOf('')).toBeNull();
    expect(monthNumberOf('2025-10')).toBeNull();
    expect(monthNumberOf('２０２５/１０')).toBeNull();
  });
});

describe('monthIndex0Of', () => {
  it('1月=0、12月=11 を返す', () => {
    expect(monthIndex0Of('2025/01')).toBe(0);
    expect(monthIndex0Of('2025/10')).toBe(9);
    expect(monthIndex0Of('2025/12')).toBe(11);
  });

  it('不正値は null を返す（呼び出し側が既定値を決める）', () => {
    expect(monthIndex0Of('')).toBeNull();
    expect(monthIndex0Of('2025/13')).toBeNull();
  });
});

describe('yearAroundRange', () => {
  it('基準年月から前後1年（1年前の同月〜1年後の同月）を返す', () => {
    expect(yearAroundRange('2025/10')).toEqual({
      min: '2024/10',
      max: '2026/10',
    });
  });

  it('年をまたぐ基準年月でも1年前・1年後の同月を返す', () => {
    expect(yearAroundRange('2025/01')).toEqual({
      min: '2024/01',
      max: '2026/01',
    });
  });

  it('未設定・不正な基準年月は範囲なしを返す', () => {
    expect(yearAroundRange('')).toEqual({ min: undefined, max: undefined });
    expect(yearAroundRange('2025/13')).toEqual({
      min: undefined,
      max: undefined,
    });
  });
});

describe('withYear', () => {
  it('月はそのままに年を置き換える', () => {
    expect(withYear('2025/11', 2026)).toBe('2026/11');
    expect(withYear('2025/1', 2026)).toBe('2026/01');
  });

  it('不正値はそのまま返す', () => {
    expect(withYear('', 2026)).toBe('');
    expect(withYear('2025/13', 2026)).toBe('2025/13');
  });
});

describe('isInPeriod', () => {
  it('from・to の両端を含めて判定する', () => {
    expect(isInPeriod('2026/01', '2026/01', '2026/12')).toBe(true);
    expect(isInPeriod('2026/12', '2026/01', '2026/12')).toBe(true);
    expect(isInPeriod('2025/12', '2026/01', '2026/12')).toBe(false);
    expect(isInPeriod('2027/01', '2026/01', '2026/12')).toBe(false);
  });

  it('未設定の側は制限しない', () => {
    expect(isInPeriod('2020/01', '', '2026/12')).toBe(true);
    expect(isInPeriod('2030/01', '2026/01', undefined)).toBe(true);
  });
});

describe('alignToPeriod', () => {
  it('同じ月で期間内の最初の年月に寄せる', () => {
    expect(alignToPeriod('2025/11', '2026/01', '2026/12')).toBe('2026/11');
    expect(alignToPeriod('2024/03', '2026/04', '2027/12')).toBe('2027/03');
  });

  it('期間内に同じ月がなければ from を返す', () => {
    expect(alignToPeriod('2025/11', '2026/01', '2026/06')).toBe('2026/01');
  });

  it('対象年月が不正なら from を返す', () => {
    expect(alignToPeriod('', '2026/01', '2026/12')).toBe('2026/01');
  });
});

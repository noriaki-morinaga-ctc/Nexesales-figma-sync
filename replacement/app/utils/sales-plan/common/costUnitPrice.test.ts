import { describe, it, expect } from 'vitest';
import {
  ACTUAL_COST_VIEWER_DEPARTMENTS,
  CURRENT_USER_DEPARTMENT,
  canViewActualCost,
  resolveCostAxis,
  costUnitPriceOfAxis,
  COST_AXIS_LABELS,
} from './costUnitPrice';

describe('canViewActualCost', () => {
  it('補足2-3 FR-0074-08 の想定部署は閲覧できる', () => {
    for (const dept of ACTUAL_COST_VIEWER_DEPARTMENTS) {
      expect(canViewActualCost(dept), dept).toBe(true);
    }
  });

  it('5つの許可部署が正確に定義されている', () => {
    expect(ACTUAL_COST_VIEWER_DEPARTMENTS).toHaveLength(5);
    expect(canViewActualCost('本社 営業統括部統括企画G')).toBe(true);
    expect(canViewActualCost('本社 広域流通部CVS第一G')).toBe(true);
    expect(canViewActualCost('本社 広域流通部CVS第二G')).toBe(true);
    expect(canViewActualCost('本社 広域流通部CVS第三G')).toBe(true);
    expect(canViewActualCost('本社 e-コマース部')).toBe(true);
  });

  it('想定外の部署は閲覧できない', () => {
    expect(canViewActualCost('本社 経営企画部')).toBe(false);
    expect(canViewActualCost('')).toBe(false);
  });

  it('引数省略時はログインユーザーの部署で判定する', () => {
    expect(canViewActualCost()).toBe(
      canViewActualCost(CURRENT_USER_DEPARTMENT)
    );
  });
});

describe('resolveCostAxis', () => {
  it('権限ありなら要求どおりの軸を返す', () => {
    const dept = ACTUAL_COST_VIEWER_DEPARTMENTS[0];
    expect(resolveCostAxis('actual', dept)).toBe('actual');
    expect(resolveCostAxis('transfer', dept)).toBe('transfer');
  });

  it('権限なしなら実原価を要求されても支社受渡原価へ倒す', () => {
    expect(resolveCostAxis('actual', '本社 経営企画部')).toBe('transfer');
    expect(resolveCostAxis('transfer', '本社 経営企画部')).toBe('transfer');
  });

  it('権限のない部署では実原価を要求しても支社受渡原価の単価が返る', () => {
    const axis = resolveCostAxis('actual', '本社 経営企画部');
    expect(axis).toBe('transfer');
    expect(costUnitPriceOfAxis(70, axis)).toBe(70);
  });
});

describe('costUnitPriceOfAxis', () => {
  it('支社受渡原価はマスタ値をそのまま返す', () => {
    expect(costUnitPriceOfAxis(70, 'transfer')).toBe(70);
  });

  it('実原価は係数を乗じた値を返す', () => {
    expect(costUnitPriceOfAxis(70, 'actual')).toBeCloseTo(65.8, 6);
  });

  it('数値でない値は0として扱う（マスタが引けない行）', () => {
    expect(costUnitPriceOfAxis(NaN, 'transfer')).toBe(0);
    expect(costUnitPriceOfAxis(NaN, 'actual')).toBe(0);
  });
});

describe('COST_AXIS_LABELS', () => {
  it('両方の軸に画面表示用の日本語ラベルがある', () => {
    expect(COST_AXIS_LABELS.transfer).toBe('支社受渡原価');
    expect(COST_AXIS_LABELS.actual).toBe('実原価');
  });
});

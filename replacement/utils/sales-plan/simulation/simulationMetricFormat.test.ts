import { describe, expect, it } from 'vitest';
import { formatSimMetric, parseSimMetric } from './simulationMetricFormat';

describe('parseSimMetric', () => {
  it('カンマ・% を除いて数値にする', () => {
    expect(parseSimMetric('1,234.5')).toBe(1234.5);
    expect(parseSimMetric('12.5%')).toBe(12.5);
  });
  it('空・数値でない値は NaN', () => {
    expect(parseSimMetric(undefined)).toBeNaN();
    expect(parseSimMetric('  ')).toBeNaN();
    expect(parseSimMetric('abc')).toBeNaN();
  });
});

describe('formatSimMetric', () => {
  it('桁の指定が無いときは、整数はそのまま・小数は2桁', () => {
    expect(formatSimMetric(10)).toBe('10');
    expect(formatSimMetric(10.456)).toBe('10.46');
    expect(formatSimMetric(10.456, { percent: true })).toBe('10.46%');
  });
  it('有限でない値は空文字', () => {
    expect(formatSimMetric(NaN)).toBe('');
    expect(formatSimMetric(Infinity)).toBe('');
  });
});

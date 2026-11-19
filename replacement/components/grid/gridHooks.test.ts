import { describe, expect, it } from 'vitest';
import { toComparableCellValue } from './gridHooks';

describe('toComparableCellValue', () => {
  it('カンマ・%・空白を除いて数値の文字にそろえる', () => {
    expect(toComparableCellValue('35,000')).toBe('35000');
    expect(toComparableCellValue('110.0%')).toBe('110');
    expect(toComparableCellValue(' 1 200 ')).toBe('1200');
  });

  it('数値にできない文字はそのまま（英字の s を消さない）', () => {
    expect(toComparableCellValue('sales')).toBe('sales');
    expect(toComparableCellValue('1s')).toBe('1s');
  });

  it('空・null はそのまま', () => {
    expect(toComparableCellValue('')).toBe('');
    expect(toComparableCellValue(null)).toBeNull();
  });
});

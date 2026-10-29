import { describe, it, expect } from 'vitest';
import {
  NEW_PRODUCT_MONTHS,
  SUMMARY_PRODUCT_OPTIONS,
  isNewProductAt,
} from './productMasters';

describe('isNewProductAt（対象年月時点の新商品判定）', () => {
  const product = { isNew: true, newFrom: '2025/04' };

  it('発売年月から NEW_PRODUCT_MONTHS か月間は新商品', () => {
    expect(NEW_PRODUCT_MONTHS).toBe(12);
    expect(isNewProductAt(product, '2025/04')).toBe(true);
    expect(isNewProductAt(product, '2025/12')).toBe(true);
    expect(isNewProductAt(product, '2026/03')).toBe(true);
  });

  it('発売年月より前・新商品期間を過ぎた年月は新商品ではない', () => {
    expect(isNewProductAt(product, '2025/03')).toBe(false);
    expect(isNewProductAt(product, '2026/04')).toBe(false);
  });

  it('新商品フラグが無い商品は対象年月によらず false', () => {
    expect(
      isNewProductAt({ isNew: false, newFrom: '2025/04' }, '2025/05')
    ).toBe(false);
  });

  it('対象年月・発売年月が無い場合はマスタの新商品フラグをそのまま使う', () => {
    expect(isNewProductAt(product, '')).toBe(true);
    expect(isNewProductAt({ isNew: true }, '2025/05')).toBe(true);
    expect(isNewProductAt({ isNew: false }, '')).toBe(false);
  });

  it('マスタの新商品はすべて発売年月を持つ', () => {
    const missing = SUMMARY_PRODUCT_OPTIONS.filter(
      (p) => p.isNew && !p.newFrom
    );
    expect(missing).toEqual([]);
  });

  it('対象年月によって新商品の候補が変わる', () => {
    const at = (month: string) =>
      SUMMARY_PRODUCT_OPTIONS.filter((p) => isNewProductAt(p, month)).length;
    expect(at('2025/06')).toBeGreaterThan(0);
    expect(at('2025/06')).not.toBe(at('2026/06'));
  });
});

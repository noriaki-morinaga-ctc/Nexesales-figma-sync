import { describe, it, expect } from 'vitest';
import {
  markManualEdit,
  originDataSourceOf,
  type DataSourceRow,
} from './paymentDataSource';

describe('markManualEdit（手で直した明細は手入力）', () => {
  it.each(['請求EDI', 'AIC入力'] as const)(
    '%s の明細は手入力になり、元のデータ元を残す',
    (source) => {
      const row: DataSourceRow = { dataSource: source };
      expect(markManualEdit(row)).toBe(true);
      expect(row.dataSource).toBe('手入力');
      expect(row.originDataSource).toBe(source);
      // 活性は元のデータ元のまま
      expect(originDataSourceOf(row)).toBe(source);
    }
  );

  it('もう一度直しても元のデータ元は変わらない（値を戻しても手入力のまま）', () => {
    const row: DataSourceRow = { dataSource: '請求EDI' };
    markManualEdit(row);
    expect(markManualEdit(row)).toBe(false);
    expect(row).toEqual({ dataSource: '手入力', originDataSource: '請求EDI' });
  });

  it('手入力の明細とデータ元を持たない行は変えない', () => {
    const manual: DataSourceRow = { dataSource: '手入力' };
    expect(markManualEdit(manual)).toBe(false);
    expect(manual).toEqual({ dataSource: '手入力' });
    const none: DataSourceRow = {};
    expect(markManualEdit(none)).toBe(false);
    expect(none).toEqual({});
  });
});

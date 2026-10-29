import { describe, it, expect } from 'vitest';
import {
  expenseSummaryProductComboOptions,
  productCodeFromValue,
  summaryProductComboOptions,
} from './comboFieldOptions';
import { EXPENSE_SUMMARY_PRODUCT_OPTIONS } from './productMasters';
import { matchesSearchQuery } from '../utils/searchNormalize';

// SingleCombobox と同じ条件（名称・コード・値のいずれかに部分一致）で候補を絞り込む。
const search = (
  options: ReturnType<typeof expenseSummaryProductComboOptions>,
  query: string
) =>
  options.filter(
    (o) =>
      matchesSearchQuery(o.label, query) ||
      matchesSearchQuery(o.code, query) ||
      matchesSearchQuery(o.value, query)
  );

describe('expenseSummaryProductComboOptions（拡売費の明細追加ペインのサマリ商品）', () => {
  const options = expenseSummaryProductComboOptions();
  const products = options.filter((o) => o.value !== '-');

  it('商品マスタの並びどおりに全件を出す', () => {
    expect(options.map((o) => o.value)).toEqual(
      EXPENSE_SUMMARY_PRODUCT_OPTIONS.map((o) => o.value)
    );
  });

  it('2行目は「拡売費グリッドと同じ商品コード／メタブランド：容器容量G」', () => {
    const gridCodes = new Map(
      summaryProductComboOptions(products.map((o) => o.value)).map((o) => [
        o.value,
        o.code,
      ])
    );
    for (const o of products) {
      const master = EXPENSE_SUMMARY_PRODUCT_OPTIONS.find(
        (m) => m.value === o.value
      );
      const code = productCodeFromValue(o.value);
      expect(gridCodes.get(o.value)).toBe(`商品コード: ${code}`);
      expect(o.code).toBe(
        master?.containerCapacityG
          ? `${code}／${master.metaBrand}：${master.containerCapacityG}`
          : `${code}／${master?.metaBrand}`
      );
    }
  });

  it('商品コードで検索するとその商品が当たる', () => {
    const target = products[1];
    const code = productCodeFromValue(target.value);
    expect(search(options, code).map((o) => o.value)).toContain(target.value);
  });

  it('商品コードは全角・小文字で入力しても当たる', () => {
    const target = products[0];
    const code = productCodeFromValue(target.value)
      .toLowerCase()
      .replace(/[0-9a-z]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) + 0xfee0)
      );
    expect(search(options, code).map((o) => o.value)).toContain(target.value);
  });

  it('未選択（ー（指定なし））は商品コードを持たない', () => {
    const none = options.find((o) => o.value === '-');
    expect(none?.label).toBe('ー（指定なし）');
    expect(none?.code).toBeUndefined();
  });

  it('新商品には NEW バッジを付ける', () => {
    for (const master of EXPENSE_SUMMARY_PRODUCT_OPTIONS) {
      const o = options.find((x) => x.value === master.value);
      expect(o?.badge).toBe(master.isNew ? 'NEW' : undefined);
    }
  });
});

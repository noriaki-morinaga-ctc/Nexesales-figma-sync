import { describe, it, expect } from 'vitest';
import { entrySummaryProductComboOptions } from './entrySummaryProductOptions';
import { SUMMARY_PRODUCT_ENTRY_REFERENCE } from './DetailTable';
import { SUMMARY_PRODUCT_VALUES } from '../../../../constants/productMasters';
import { productCodeFromValue } from '../../../../constants/comboFieldOptions';
import { matchesSearchQuery } from '../../../../utils/common/searchNormalize';

// SingleCombobox と同じ条件（名称・コード・値のいずれかに部分一致）で候補を絞り込む。
const search = (query: string) =>
  entrySummaryProductComboOptions()
    .filter(
      (o) =>
        matchesSearchQuery(o.label, query) ||
        matchesSearchQuery(o.code, query) ||
        matchesSearchQuery(o.value, query)
    )
    .map((o) => o.value);

const entryCodeOf = (value: string) =>
  SUMMARY_PRODUCT_ENTRY_REFERENCE[value]?.productCode ?? '';

describe('entrySummaryProductComboOptions（追加口の明細追加ペインのサマリ商品）', () => {
  it('商品マスタのサマリ商品を全件出す', () => {
    expect(entrySummaryProductComboOptions().map((o) => o.value)).toEqual(
      SUMMARY_PRODUCT_VALUES
    );
  });

  it('8桁のサマリ商品コードを持つ商品は、そのコードで検索できる', () => {
    const withCode = SUMMARY_PRODUCT_VALUES.filter((v) => entryCodeOf(v));
    expect(withCode.length).toBeGreaterThan(0);
    for (const value of withCode) {
      expect(search(entryCodeOf(value))).toContain(value);
    }
  });

  it('8桁のコードを持たない商品は、拡売費一覧と同じ商品コードで検索できる', () => {
    const withoutCode = SUMMARY_PRODUCT_VALUES.filter((v) => !entryCodeOf(v));
    expect(withoutCode.length).toBeGreaterThan(0);
    for (const value of withoutCode) {
      expect(search(productCodeFromValue(value))).toContain(value);
    }
  });

  it('2行目は「コード／メタブランド…」の体裁で、先頭のコードは8桁優先・無ければ拡売費一覧と同じ商品コード', () => {
    for (const o of entrySummaryProductComboOptions()) {
      const code = entryCodeOf(o.value) || productCodeFromValue(o.value);
      expect(o.code?.startsWith(`${code}／`)).toBe(true);
    }
  });
});

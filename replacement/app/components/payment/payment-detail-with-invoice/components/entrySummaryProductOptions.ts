// 追加口の明細追加ペインのサマリ商品名の選択肢
//（名称(上)・「コード／メタブランド：容器容量G」(下)）。
// 2行目の先頭に商品コードを持たせ、商品名・商品コードのどちらでも検索できるようにする
//（計画詳細の明細追加ペイン・拡売費追加ペインと同じ体裁）。
// 商品コードは、追加口一覧と同じ8桁のサマリ商品コードを持つ商品はそのコード
//（ペインの「サマリ商品コード」欄に出る値）とし、持たない商品は拡売費一覧の
// サマリ商品列と同じ商品コードで補う。
import type { SingleComboboxOption } from '../../../ui/single-combobox';
import {
  SUMMARY_PRODUCT_VALUES,
  SUMMARY_PRODUCT_BY_VALUE,
} from '../../../../constants/productMasters';
import { productCodeFromValue } from '../../../../constants/comboFieldOptions';
import { expenseSummaryProductOptionCode } from '../../../../utils/common/summaryProductSearch';
import { SUMMARY_PRODUCT_ENTRY_REFERENCE } from './DetailTable';

export const entrySummaryProductComboOptions = (): SingleComboboxOption[] =>
  SUMMARY_PRODUCT_VALUES.map((value) => {
    const master = SUMMARY_PRODUCT_BY_VALUE.get(value);
    return {
      value,
      label: value,
      code: expenseSummaryProductOptionCode(
        SUMMARY_PRODUCT_ENTRY_REFERENCE[value]?.productCode ||
          productCodeFromValue(value),
        master?.metaBrand ?? '',
        master?.containerCapacityG
      ),
      badge: master?.isNew ? 'NEW' : undefined,
    };
  });

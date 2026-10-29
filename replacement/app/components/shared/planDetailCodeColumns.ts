import type { ColDef } from 'ag-grid-community';
import {
  containerCapacityCodeOf,
  metaBrandCodeOf,
  productCategoryCodeOf,
  productCodeFromValue,
  promotionCodeOf,
  wholesaleMeshCodeOf,
} from '../../constants/comboFieldOptions';

// 計画詳細(NET固定)・計画詳細(マージン率固定・NET入力)の販売計画(詳細)グリッドで使うコード列。
// PJルール（6/4 共通セッション 決定事項15・16）により、コード値・区分値を持つ項目は
// 名称とは別の列でコード値・区分値を保持する。初期状態の表示/非表示は基本設計で
// 業務側が項目ごとに決めるため、ここでは既定を非表示とし、列メニューから表示できるようにする。

type CellStyleFn = NonNullable<ColDef['cellStyle']>;

// 合計行・区切り行はコードを表示しない
const isSummaryRow = (params: any): boolean =>
  !!params.node?.rowPinned ||
  !!params.data?._isHeader ||
  params.data?.metaBrand === '合計';

const codeColumn = (
  headerName: string,
  field: string,
  getCode: (data: any) => string,
  cellStyle: CellStyleFn
): ColDef => ({
  headerName,
  field,
  width: 130,
  hide: true,
  editable: false,
  cellClass: 'ag-cell-left',
  cellStyle,
  valueGetter: (params: any) =>
    isSummaryRow(params) ? '' : getCode(params.data ?? {}),
});

interface PlanDetailCodeColumnOptions {
  // サマリ商品を持たない行か（NET固定の定番商品は一般卸メッシュ粒度のため「-」表示）
  isWithoutSummaryProduct?: (data: any) => boolean;
}

export const planDetailCodeColumns = (
  cellStyle: CellStyleFn,
  options: PlanDetailCodeColumnOptions = {}
) => ({
  metaBrandCode: codeColumn(
    'メタブランドコード',
    'metaBrandCode',
    (d) => metaBrandCodeOf(d.metaBrand),
    cellStyle
  ),
  containerCapacityCode: codeColumn(
    '容器容量Gコード',
    'containerCapacityGCode',
    (d) => containerCapacityCodeOf(d.containerCapacityG),
    cellStyle
  ),
  summaryProductCode: codeColumn(
    'サマリ商品コード',
    'summaryProductCode',
    // サマリ商品名を「-」で表示する行（サマリ商品を持たない行）はコードも出さない
    (d) => {
      const name = String(d.summaryProduct ?? '').trim();
      if (!name || name === '-' || options.isWithoutSummaryProduct?.(d)) {
        return '';
      }
      return productCodeFromValue(name);
    },
    cellStyle
  ),
  wholesaleMeshCode: codeColumn(
    '一般卸メッシュコード',
    'wholesaleMeshCode',
    (d) => wholesaleMeshCodeOf(d.wholesaleMesh),
    cellStyle
  ),
  productCategoryCode: codeColumn(
    '商品区分コード',
    'productCategoryCode',
    (d) => productCategoryCodeOf(d.productCategory),
    cellStyle
  ),
  promotionCode: codeColumn(
    '販促区分コード',
    'promotionCode',
    (d) => promotionCodeOf(d),
    cellStyle
  ),
});

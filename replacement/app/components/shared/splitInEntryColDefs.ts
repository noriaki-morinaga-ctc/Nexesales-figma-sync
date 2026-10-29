import type { ColDef, ColGroupDef } from 'ag-grid-community';
import { GRID_COLORS, withHeaderTooltips } from '../grid';
import type { SplitInEntryRow } from '../../constants/additionalEntrySplitMockData';

// 参照専用セルの共通スタイル（灰背景）と右寄せ版。
const SPLIT_RO_STYLE = { backgroundColor: GRID_COLORS.readonly } as const;
const SPLIT_RO_RIGHT_STYLE = {
  backgroundColor: GRID_COLORS.readonly,
  textAlign: 'right' as const,
};

// 分割（IN）の追加口一覧の列定義（他部署から当部署へ分割された追加口明細・全列参照専用）。
// 分割元（部署・営業担当者・支払No・支払回数・明細No）で、どの明細から配られたかを追えるようにする
//（→ 20260901_第33回 決定事項1、課題1079）。上部に「状態」「分割元」は出さない（→ 決定事項21）。
// 分割元グループの見出しは拡売費一覧（分割元グループ）の呼び方にそろえる。
// 支払詳細(追加口請求書有)・支払詳細(追加口請求書無)の分割（IN）追加口タブで共用する。
const formatNumberCell = (p: { value: unknown }) =>
  typeof p.value === 'number' ? p.value.toLocaleString('ja-JP') : '';
export const SPLIT_IN_ENTRY_COL_DEFS: (
  | ColDef<SplitInEntryRow>
  | ColGroupDef<SplitInEntryRow>
)[] = withHeaderTooltips([
  {
    headerName: 'No.',
    field: 'lineNo',
    width: 70,
    // 先頭列は grid.css で中央寄せ強制のため、左寄せクラスを付与（→ グリッド左寄せ規約）
    cellClass: 'ag-cell-left-pinned',
    cellStyle: SPLIT_RO_STYLE,
  },
  {
    headerName: '分割元',
    children: [
      {
        headerName: '部署',
        field: 'srcDept',
        width: 200,
        cellStyle: SPLIT_RO_STYLE,
      },
      {
        headerName: '営業担当者',
        field: 'srcStaff',
        width: 160,
        cellStyle: SPLIT_RO_STYLE,
      },
      {
        headerName: '支払No',
        field: 'srcPaymentNo',
        width: 130,
        cellStyle: SPLIT_RO_STYLE,
      },
      {
        headerName: '支払回数',
        field: 'srcPaymentCount',
        width: 100,
        cellStyle: SPLIT_RO_RIGHT_STYLE,
      },
      {
        headerName: '明細No',
        field: 'srcLineNo',
        width: 100,
        cellStyle: SPLIT_RO_RIGHT_STYLE,
      },
    ],
  },
  {
    headerName: 'データ元',
    field: 'dataSource',
    width: 110,
    cellStyle: SPLIT_RO_STYLE,
  },
  {
    headerName: 'サマリ商品コード',
    field: 'productCode',
    width: 140,
    cellStyle: SPLIT_RO_STYLE,
  },
  {
    headerName: 'サマリ商品名',
    field: 'productName',
    width: 260,
    cellStyle: SPLIT_RO_STYLE,
  },
  {
    headerName: '入数',
    field: 'capacity',
    width: 80,
    valueFormatter: formatNumberCell,
    cellStyle: SPLIT_RO_RIGHT_STYLE,
  },
  {
    headerName: 'ケース',
    field: 'cases',
    width: 90,
    valueFormatter: formatNumberCell,
    cellStyle: SPLIT_RO_RIGHT_STYLE,
  },
  {
    headerName: 'バラ',
    field: 'loose',
    width: 80,
    valueFormatter: formatNumberCell,
    cellStyle: SPLIT_RO_RIGHT_STYLE,
  },
  {
    headerName: '追加口バラ単価',
    field: 'addUnit',
    width: 130,
    valueFormatter: formatNumberCell,
    cellStyle: SPLIT_RO_RIGHT_STYLE,
  },
  {
    headerName: '追加口金額',
    field: 'addAmount',
    width: 130,
    valueFormatter: formatNumberCell,
    cellStyle: SPLIT_RO_RIGHT_STYLE,
  },
  {
    headerName: '支払NET（追加口分）',
    field: 'addNet',
    width: 160,
    valueFormatter: formatNumberCell,
    cellStyle: SPLIT_RO_RIGHT_STYLE,
  },
  {
    headerName: '請求書番号',
    field: 'billDetailNo',
    width: 130,
    cellStyle: SPLIT_RO_STYLE,
  },
]);

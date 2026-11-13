import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef } from 'ag-grid-community';

import {
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  formatEmptyAsDash,
  gridFilterContextMenuItems,
  useGridColumnState,
  GRID_NUMBER_TEXT_FILTER,
  GRID_MONTH_TEXT_FILTER,
  CopyRowCellRenderer,
} from '@/app/components/grid';
import {
  PLAN_DETAIL_DIGITS,
  planAmountFormatter,
  planRateFormatter,
} from '@/app/utils/sales-plan/common/planDetailNumberFormat';
import { FORM_LABEL_CLASS } from '@/styles/commonStyles';
import { PROMOTION_NONE_LABEL } from '@/app/constants/promotionCategories';
import type { ProductData } from '@/app/types/simulation';

interface SimulationReferenceTableProps {
  // 参照表に表示する行（自計画の参照候補）
  rows: ProductData[];
  // 行を明細（元の表）へ取り込む（コピーボタン押下時）
  onCopyRow: (row: ProductData) => void;
  // 一般卸メッシュ列の表示有無（量販は非表示・卸は表示）
  showWholesaleMesh?: boolean;
  // 対象期間＝シミュレーション（詳細）の対象期間（YYYY/MM）。本ペインでは変更できない。
  // 下ペインで別の期間を表示しても、コピーした明細が詳細に表示されず利用者が混乱するため
  // 詳細の対象期間に従わせる（Figma C04：10/15 ASD回答）。
  fromPeriod: string;
  toPeriod: string;
}

export function SimulationReferenceTable({
  rows,
  onCopyRow,
  showWholesaleMesh = false,
  fromPeriod,
  toPeriod,
}: SimulationReferenceTableProps) {
  // 参照表は基準値（変更前）のみを1列で表示する。
  // 変更後・増減はシミュレーション固有の値のため参照表では表示しない。
  const makeReferenceCol = (m: {
    field: string;
    header: string;
    width: number;
    // 項目一覧の小数桁（NET・納価=2／売価=0／マージン率=2%）。省略時は従来表示。
    decimals?: number;
    isPercent?: boolean;
  }): ColDef<ProductData> => ({
    headerName: m.header,
    field: `${m.field}Before` as ColDef<ProductData>['field'],
    ...GRID_NUMBER_TEXT_FILTER,
    width: m.width,
    cellClass: 'ag-cell-right',
    valueFormatter:
      m.decimals === undefined
        ? formatEmptyAsDash
        : m.isPercent
          ? planRateFormatter(m.decimals)
          : planAmountFormatter(m.decimals),
  });

  const columnDefs: (ColDef<ProductData> | ColGroupDef<ProductData>)[] =
    useMemo(
      () => [
        {
          headerName: '',
          // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
          suppressColumnsToolPanel: true,
          colId: 'actions',
          width: 72,
          sortable: false,
          filter: false,
          suppressHeaderMenuButton: true,
          cellRenderer: CopyRowCellRenderer,
          cellRendererParams: { label: '明細へコピー' },
        },
        // ▼ シミュレーション(詳細)と同一の列構成（企画・確度のみ非表示）
        {
          headerName: '対象年月',
          field: 'targetMonth',
          ...GRID_MONTH_TEXT_FILTER,
          width: 104,
          // 対象年月はカレンダー（年月）入力のため左寄せ
          cellClass: 'ag-cell-left',
        },
        {
          headerName: '商品区分',
          field: 'productCategory',
          width: 88,
          cellClass: 'ag-cell-left',
          filter: true,
        },
        {
          headerName: '販促区分',
          field: 'promotion',
          width: 144,
          cellClass: 'ag-cell-left',
          valueFormatter: (params) =>
            params.data?.productCategory === '特殊商品'
              ? PROMOTION_NONE_LABEL
              : formatEmptyAsDash(params),
        },
        {
          headerName: 'メタブランド',
          field: 'metaBrand',
          width: 112,
          cellClass: 'ag-cell-left',
          filter: true,
        },
        {
          headerName: '容器容量G',
          field: 'containerCapacityG',
          width: 112,
          cellClass: 'ag-cell-left',
          filter: true,
        },
        // サマリ商品名は量販・卸の両方で表示する
        {
          headerName: 'サマリ商品',
          field: 'summaryProduct',
          width: 264,
          cellClass: 'ag-cell-left',
          filter: true,
        },
        // 一般卸メッシュは卸版のみ、サマリ商品名の右隣に表示する
        ...(showWholesaleMesh
          ? [
              {
                headerName: '一般卸メッシュ',
                field: 'wholesaleMesh',
                width: 192,
                cellClass: 'ag-cell-left',
                filter: true,
              } as ColDef<ProductData>,
            ]
          : []),
        {
          headerName: '入数',
          field: 'quantity',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 68,
          cellClass: 'ag-cell-right',
        },
        makeReferenceCol({
          field: 'plan',
          header: '計画函数',
          width: 80,
        }),
        makeReferenceCol({
          field: 'net',
          header: 'NET',
          width: 84,
          decimals: PLAN_DETAIL_DIGITS.price,
        }),
        makeReferenceCol({
          field: 'planPrice',
          header: '納価',
          width: 80,
          decimals: PLAN_DETAIL_DIGITS.price,
        }),
        makeReferenceCol({
          field: 'price',
          header: '売価',
          width: 80,
          decimals: PLAN_DETAIL_DIGITS.amount,
        }),
        makeReferenceCol({
          field: 'margin',
          header: 'マージン率',
          width: 88,
          decimals: PLAN_DETAIL_DIGITS.marginRate,
          isPercent: true,
        }),
        {
          headerName: '値入率',
          field: 'discount',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 80,
          cellClass: 'ag-cell-right',
          // 値入率＝小数第1位（％）
          valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.rate),
        },
        {
          headerName: '管理利益額',
          field: 'managementProfitAmount',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 96,
          cellClass: 'ag-cell-right',
          // 管理利益額＝整数
          valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
        },
        {
          headerName: '管理利益率',
          field: 'managementProfitRate',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 96,
          cellClass: 'ag-cell-right',
        },
        {
          headerName: '売上高',
          field: 'netSales',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 96,
          cellClass: 'ag-cell-right',
          // 売上高＝整数
          valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
        },
        {
          headerName: '社外売上高',
          field: 'externalSales',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 96,
          cellClass: 'ag-cell-right',
          // 社外売上高＝整数
          valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
        },
        // 拡売費①②は表示しない（コピー実行時に空欄＝「ー」で取り込むため）
      ],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [showWholesaleMesh]
    );

  // 列状態（列幅・並び順・ソート・固定・表示）を localStorage へ保存／復元する（計画詳細の参照表と同じ）。
  // 一般卸メッシュ列の有無で列構成が変わるため、マージン率固定と NET固定で保存キーを分ける。
  const gridColumnStateProps = useGridColumnState(
    showWholesaleMesh
      ? 'SimW.referenceTable.columnState.v1'
      : 'Sim.referenceTable.columnState.v1'
  );

  // 表示行を対象期間（from～to）で絞り込む（明細の対象年月で判定）。
  // 'YYYY/MM' はゼロ埋め前提で辞書順＝時系列順のため文字列比較で範囲判定できる。
  const rowData = useMemo(() => {
    if (!fromPeriod || !toPeriod) return rows;
    return rows.filter(
      (row) =>
        !!row.targetMonth &&
        row.targetMonth >= fromPeriod &&
        row.targetMonth <= toPeriod
    );
  }, [rows, fromPeriod, toPeriod]);

  // 参照表は読取専用（編集不可）。フィルター・並べ替えのみ許可する。
  const defaultColDef: ColDef = useMemo(
    () => ({
      ...GRID_DEFAULT_COL_DEF,
      editable: false,
      resizable: true,
      sortable: true,
      filter: true,
    }),
    []
  );

  return (
    // 下ペインの高さに合わせて伸び縮みする（下限を付けない。下ペインは初めて開いたときに明細5行分の高さになる → 02 BottomPane）
    <div className="reference-grid flex min-h-0 w-full flex-1 flex-col">
      {/* 対象期間（シミュレーション（詳細）の対象期間をテキストで表示） */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`${FORM_LABEL_CLASS} whitespace-nowrap px-2 py-1`}>
          対象期間
        </span>
        <span className="text-sm text-gray-900">
          {fromPeriod}〜{toPeriod}
        </span>
        <span className="text-xs text-gray-500">
          （シミュレーション（詳細）の対象期間）
        </span>
      </div>

      <style>{`
        .reference-grid .ag-cell-right { text-align: right; }
        .reference-grid .ag-cell-center { text-align: center; }
        .reference-grid .ag-cell-left { text-align: left; }
      `}</style>
      <div className="min-h-0 w-full flex-1">
        <AgGridReact
          {...GRID_BASE_PROPS}
          {...gridColumnStateProps}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getContextMenuItems={gridFilterContextMenuItems}
          statusBar={GRID_STATUS_BAR}
          context={{ onCopyRow }}
          // 行のダブルクリックでも明細へコピーする（コピーボタンと同じ動作）
          onRowDoubleClicked={(params) => params.data && onCopyRow(params.data)}
          ensureDomOrder={true}
          // 行IDを固定し、コピーで rowData が変わっても差分更新にする
          // （全行再生成を避け、表内のスクロール位置を維持する）
          getRowId={(params) => `${params.data.section}-${params.data.id}`}
        />
      </div>
    </div>
  );
}

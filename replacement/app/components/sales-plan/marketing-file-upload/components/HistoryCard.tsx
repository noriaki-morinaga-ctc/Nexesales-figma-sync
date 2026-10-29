import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react';
import type {
  ColDef,
  GetRowIdParams,
  RowSelectionOptions,
  SelectionChangedEvent,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { FileText, Inbox } from 'lucide-react';
import {
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  useGridColumnState,
  GRID_DATE_TEXT_FILTER,
} from '../../../grid';
import type { UploadHistoryItem } from '../marketingFileUploadTypes';
import {
  formatDateTime,
  formatYearMonthRange,
} from '../marketingFileUploadUtils';
import {
  CARD_ICON_CLASS,
  EMPTY_STATE_CLASS,
  WHITE_CARD_CLASS,
} from '../marketingFileUploadStyles';
import { CardHeader } from './CardHeader';
import { StatusBadge } from './StatusBadge';

interface HistoryCardProps {
  history: UploadHistoryItem[];
  selectedUploadId: string | null;
  onSelectHistory: (uploadId: string) => void;
}

// 列状態（列幅・並び順・ソート）の保存キー。列構成を変えたらバージョンを上げる（→ 02 §7）
const COLUMN_STATE_KEY = 'marketingFileUpload.history.columnState.v2';

// 行IDはアップロードID（rowData 差し替え後も選択行を維持するため）
const getRowId = (params: GetRowIdParams<UploadHistoryItem>) =>
  params.data.uploadId;

// 行クリックで1行選択（公式 rowSelection）。クリックでの選択解除はさせない
const ROW_SELECTION: RowSelectionOptions = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: 'enableSelection',
};

// ステータス列（バッジを中央表示）
function StatusCellRenderer(p: CustomCellRendererProps<UploadHistoryItem>) {
  if (!p.data) return null;
  return (
    <div className="flex items-center justify-center h-full">
      <StatusBadge status={p.data.status} />
    </div>
  );
}

// エラー件数の表示（エラー＝件数／完了＝0／処理中＝-）
const formatErrorCount = (
  params: ValueFormatterParams<UploadHistoryItem, number>
): string => {
  const item = params.data;
  if (!item) return '-';
  if (item.status === 'ERROR') return (params.value ?? 0).toLocaleString();
  if (item.status === 'COMPLETED') return '0';
  return '-';
};

// 右：アップロード履歴カード（グリッド内で縦スクロール）
export function HistoryCard({
  history,
  selectedUploadId,
  onSelectHistory,
}: HistoryCardProps) {
  const gridRef = useRef<AgGridReact<UploadHistoryItem>>(null);

  // 列状態の保存／復元（共通フック）。列ごとに明示幅を持つため自動サイズ調整は行わない
  const gridColumnStateProps = useGridColumnState(COLUMN_STATE_KEY, {
    autoSize: false,
  });

  const columnDefs = useMemo<ColDef<UploadHistoryItem>[]>(
    () => [
      {
        // 対象年月。ファイル内の明細の対象年月（単月は YYYY/MM、複数月は最小～最大）
        colId: 'targetYearMonthRange',
        headerName: '対象年月',
        width: 180,
        valueGetter: (params: ValueGetterParams<UploadHistoryItem>) =>
          params.data
            ? formatYearMonthRange(
                params.data.targetYearMonthFrom,
                params.data.targetYearMonthTo
              )
            : '',
        valueFormatter: (params: ValueFormatterParams<UploadHistoryItem>) =>
          params.value || '-',
        // 先頭列は grid.css のチェックボックス列向け規則で中央寄せになるため、
        // 先頭データ列用の ag-cell-left で左寄せに戻す
        cellClass: 'ag-cell-left',
      },
      {
        field: 'uploadedAt',
        ...GRID_DATE_TEXT_FILTER,
        headerName: '登録日時',
        width: 160,
        valueFormatter: (params: ValueFormatterParams<UploadHistoryItem>) =>
          formatDateTime(params.value ?? ''),
        cellClass: 'cell-left',
      },
      {
        field: 'uploadTargetName',
        headerName: 'アップロード対象',
        width: 180,
        cellClass: 'cell-left',
      },
      {
        field: 'fileName',
        headerName: 'ファイル名',
        flex: 1,
        minWidth: 200,
        cellClass: 'cell-left',
      },
      {
        field: 'uploadedBy',
        headerName: '登録者',
        width: 140,
        cellClass: 'cell-left',
      },
      {
        field: 'status',
        headerName: 'ステータス',
        width: 140,
        cellRenderer: StatusCellRenderer,
        cellClass: 'cell-center',
      },
      {
        field: 'errorCount',
        headerName: 'エラー件数',
        width: 120,
        valueFormatter: formatErrorCount,
        cellClass: 'cell-right',
      },
    ],
    []
  );

  // 画面側の選択状態（selectedUploadId）をグリッドの選択行へ反映する
  const syncSelection = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    if (!selectedUploadId) {
      api.deselectAll();
      return;
    }
    const node = api.getRowNode(selectedUploadId);
    if (node && !node.isSelected()) node.setSelected(true, true);
  }, [selectedUploadId]);

  useEffect(() => {
    syncSelection();
  }, [syncSelection]);

  // グリッドで選択された行を画面側の選択状態へ反映する
  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<UploadHistoryItem>) => {
      const [selectedRow] = event.api.getSelectedRows();
      if (selectedRow) onSelectHistory(selectedRow.uploadId);
    },
    [onSelectHistory]
  );

  return (
    <section className={`${WHITE_CARD_CLASS} min-h-0`}>
      <CardHeader
        icon={<FileText className={CARD_ICON_CLASS} aria-hidden="true" />}
        title="アップロード履歴"
        right={`全 ${history.length} 件`}
      />
      {history.length === 0 ? (
        <div className={EMPTY_STATE_CLASS}>
          <Inbox className="h-8 w-8 mb-2" aria-hidden="true" />
          <p className="text-sm">表示する履歴がありません</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <AgGridReact<UploadHistoryItem>
            ref={gridRef}
            rowData={history}
            columnDefs={columnDefs}
            defaultColDef={GRID_DEFAULT_COL_DEF}
            domLayout="normal"
            getRowId={getRowId}
            rowSelection={ROW_SELECTION}
            onSelectionChanged={handleSelectionChanged}
            // rowData 差し替え・初回描画時にも選択行を同期する
            onFirstDataRendered={syncSelection}
            onRowDataUpdated={syncSelection}
            // 共通基本プロパティ（Enter縦移動・セル範囲選択等／grid/）
            {...GRID_BASE_PROPS}
            // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
            {...gridColumnStateProps}
            statusBar={GRID_STATUS_BAR}
          />
        </div>
      )}
    </section>
  );
}

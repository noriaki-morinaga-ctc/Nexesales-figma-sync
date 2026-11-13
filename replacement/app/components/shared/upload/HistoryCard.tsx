import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react';
import type {
  ColDef,
  GetRowIdParams,
  RowSelectionOptions,
  SelectionChangedEvent,
  ValueFormatterParams,
} from 'ag-grid-community';
import { FileText, Inbox } from 'lucide-react';
import {
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  useGridColumnState,
  GRID_DATE_TEXT_FILTER,
} from '@/app/components/grid';
import type { UploadResultItem } from './uploadTypes';
import { formatDateTime } from './uploadUtils';
import {
  CARD_ICON_CLASS,
  EMPTY_STATE_CLASS,
  WHITE_CARD_CLASS,
} from './uploadStyles';
import { CardHeader } from './CardHeader';
import { StatusBadge } from './StatusBadge';

// アップロード履歴の1件分のうち、履歴カードが使う項目（各画面の履歴の型が持つ）
export interface UploadHistoryBase extends UploadResultItem {
  uploadId: string; // アップロードID
  uploadTargetName: string; // 対象データ（表示名）
  fileName: string; // ファイル名
  uploadedAt: string; // 登録日時（ISO形式）
  uploadedBy: string; // 登録者
  errorCount: number; // エラー件数
}

interface HistoryCardProps<T extends UploadHistoryBase> {
  history: T[];
  selectedUploadId: string | null;
  onSelectHistory: (uploadId: string) => void;
  // 列状態（列幅・並び順・ソート）の保存キー。画面ごとに一意にする。列構成を変えたらバージョンを上げる（→ 02 §7）
  columnStateKey: string;
  // 先頭の「対象」の列（予算参照登録＝対象年度／ファイルアップロード＝対象年月）。
  // 列定義を作り直さないよう、画面のモジュール直下の定数を渡す（→ 02 §7.1）
  targetColumnDef: ColDef<T>;
}

// 行IDはアップロードID（rowData 差し替え後も選択行を維持するため）
const getRowId = <T extends UploadHistoryBase>(params: GetRowIdParams<T>) =>
  params.data.uploadId;

// 行クリックで1行選択（公式 rowSelection）。クリックでの選択解除はさせない
const ROW_SELECTION: RowSelectionOptions = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: 'enableSelection',
};

// ステータス列（バッジを中央表示）
function StatusCellRenderer(p: CustomCellRendererProps<UploadHistoryBase>) {
  if (!p.data) return null;
  return (
    <div className="flex items-center justify-center h-full">
      <StatusBadge status={p.data.status} />
    </div>
  );
}

// エラー件数の表示（エラー＝件数／完了＝0／処理中＝-）
const formatErrorCount = (
  params: ValueFormatterParams<UploadHistoryBase, number>
): string => {
  const item = params.data;
  if (!item) return '-';
  if (item.status === 'ERROR') return (params.value ?? 0).toLocaleString();
  if (item.status === 'COMPLETED') return '0';
  return '-';
};

// 右：アップロード履歴カード（グリッド内で縦スクロール）
export function HistoryCard<T extends UploadHistoryBase>({
  history,
  selectedUploadId,
  onSelectHistory,
  columnStateKey,
  targetColumnDef,
}: HistoryCardProps<T>) {
  const gridRef = useRef<AgGridReact<T>>(null);

  // 列状態の保存／復元（共通フック）
  const gridColumnStateProps = useGridColumnState(columnStateKey);

  const columnDefs = useMemo<ColDef<T>[]>(
    () => [
      {
        ...targetColumnDef,
        // 先頭列は grid.css のチェックボックス列向け規則で中央寄せになるため、
        // 先頭データ列用の ag-cell-left で左寄せに戻す
        cellClass: 'ag-cell-left',
      },
      // 履歴の共通の列。T は UploadHistoryBase を広げた型で、AG Grid の field の型は T の項目名に限られるため、
      // 共通の項目だけを持つ ColDef<UploadHistoryBase> で書いて T の列として並べる
      ...([
        {
          field: 'uploadedAt',
          ...GRID_DATE_TEXT_FILTER,
          headerName: '登録日時',
          width: 128,
          valueFormatter: (params: ValueFormatterParams<UploadHistoryBase>) =>
            formatDateTime(params.value ?? ''),
          cellClass: 'cell-left',
        },
        {
          field: 'uploadTargetName',
          headerName: 'アップロード対象',
          width: 144,
          cellClass: 'cell-left',
        },
        {
          field: 'fileName',
          headerName: 'ファイル名',
          flex: 1,
          suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
          minWidth: 160,
          cellClass: 'cell-left',
        },
        {
          field: 'uploadedBy',
          headerName: '登録者',
          width: 112,
          cellClass: 'cell-left',
        },
        {
          field: 'status',
          headerName: 'ステータス',
          width: 112,
          cellRenderer: StatusCellRenderer,
          cellClass: 'cell-center',
        },
        {
          field: 'errorCount',
          headerName: 'エラー件数',
          width: 96,
          valueFormatter: formatErrorCount,
          cellClass: 'cell-right',
        },
      ] as ColDef<UploadHistoryBase>[] as unknown as ColDef<T>[]),
    ],
    [targetColumnDef]
  );

  // 画面側の選択状態（selectedUploadId）をグリッドの選択行へ反映する
  const handleSyncSelection = useCallback(() => {
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
    handleSyncSelection();
  }, [handleSyncSelection]);

  // グリッドで選択された行を画面側の選択状態へ反映する
  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<T>) => {
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
          <AgGridReact<T>
            ref={gridRef}
            rowData={history}
            columnDefs={columnDefs}
            defaultColDef={GRID_DEFAULT_COL_DEF}
            domLayout="normal"
            getRowId={getRowId}
            rowSelection={ROW_SELECTION}
            onSelectionChanged={handleSelectionChanged}
            // rowData 差し替え・初回描画時にも選択行を同期する
            onFirstDataRendered={handleSyncSelection}
            onRowDataUpdated={handleSyncSelection}
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

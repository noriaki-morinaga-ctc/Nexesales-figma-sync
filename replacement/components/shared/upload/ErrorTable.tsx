import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GetRowIdParams } from 'ag-grid-community';
import { Hash } from 'lucide-react';
import {
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  useGridColumnState,
} from '@/components/grid';
import type { UploadErrorItem } from './uploadTypes';

interface ErrorTableProps {
  errors: UploadErrorItem[];
  // 列状態（列幅・並び順・ソート）の保存キー。画面ごとに一意にする。列構成を変えたらバージョンを上げる（→ 02 §7）
  columnStateKey: string;
}

// 行ID（→ 画面設計標準 4.7）。1行に複数エラーがあり得るため、行番号＋エラー内容で一意にする
const getRowId = (params: GetRowIdParams<UploadErrorItem>) =>
  `${params.data.rowNumber}-${params.data.errorMessage}`;

// エラー明細グリッド
export function ErrorTable({ errors, columnStateKey }: ErrorTableProps) {
  // 列状態の保存／復元（共通フック）
  const gridColumnStateProps = useGridColumnState(columnStateKey);

  const columnDefs = useMemo<ColDef<UploadErrorItem>[]>(
    () => [
      {
        field: 'rowNumber',
        headerName: '行番号',
        width: 96,
        // 数値のため右寄せ（※先頭列は grid.css の先頭列規則が優先される。報告参照）
        cellClass: 'cell-right',
      },
      {
        field: 'errorMessage',
        headerName: 'エラー内容',
        flex: 1,
        suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
        minWidth: 160,
        cellClass: 'cell-left text-red-700',
      },
    ],
    []
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 pt-2 pb-1 flex items-center gap-2 shrink-0">
        <Hash className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <h3 className="text-xs font-bold text-gray-900">エラー明細</h3>
        <span className="text-xs text-gray-500">({errors.length} 件)</span>
      </div>
      <div className="flex-1 min-h-0 border-t border-gray-200">
        <AgGridReact<UploadErrorItem>
          rowData={errors}
          columnDefs={columnDefs}
          defaultColDef={GRID_DEFAULT_COL_DEF}
          getRowId={getRowId}
          domLayout="normal"
          // 共通基本プロパティ（Enter縦移動・セル範囲選択等／grid/）
          {...GRID_BASE_PROPS}
          // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
          {...gridColumnStateProps}
          statusBar={GRID_STATUS_BAR}
        />
      </div>
    </div>
  );
}

// 支払詳細(追加口請求書有)の追加口分割 ─ ステップ1「分割先商流販売店の選択」。
//
// 下ペイン（BottomPane）の本文。当該支払の販売店に紐づく商流販売店を一覧にし、
// 分割先にする商流販売店にチェックを付ける。自部署は一覧に出さない（配ったあとの残りが自部署負担分）。
// 初期チェックは保存済みの分割先、無ければ前月に分割した商流販売店とし、担当者は前月との差分だけを
// チェックの付け外しで直せばよい（→ 20260901_第33回 決定事項4）。
// 表示件数の上限は設けない（→ 実装計画 暫定仕様）。絞り込みは右クリックメニューのフィルターで行う。
//
// 選択状態は親が持つ（selectedIds）。［前月設定に戻す］［選択をすべて解除］など親からの変更も
// グリッドのチェックへ反映するため、グリッドは selectedIds に合わせてチェックを付け直す。
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GetRowIdParams,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_STATUS_BAR,
  gridFilterContextMenuItems,
  useGridColumnState,
  GRID_EMPTY_TEXT,
} from '../../../grid';
import type { SplitDestination } from '../../../../constants/additionalEntrySplitMockData';

interface SplitDestinationSelectPaneProps {
  // 分割先候補の商流販売店（自部署を除く）
  candidates: SplitDestination[];
  // 選択中の分割先（SplitDestination.id）
  selectedIds: string[];
  // 前月に分割した分割先（「前月分割」列の表示に使う）
  prevMonthIds: string[];
  // 参照のみ（申請後の支払回）。チェックを変更できない（→ 第33回 決定事項16）
  readOnly?: boolean;
  // チェックの変更通知（グリッド上の操作のみ。親からの変更では呼ばない）
  onSelectionChange: (ids: string[]) => void;
}

export function SplitDestinationSelectPane({
  candidates,
  selectedIds,
  prevMonthIds,
  readOnly = false,
  onSelectionChange,
}: SplitDestinationSelectPaneProps) {
  const gridRef = useRef<AgGridReact<SplitDestination>>(null);

  const prevMonthIdSet = useMemo(() => new Set(prevMonthIds), [prevMonthIds]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // グリッドのチェックを selectedIds に合わせる。グリッド上の操作による変更と区別するため、
  // ここでの変更は source が 'api' になり、handleSelectionChanged では通知しない。
  const syncSelection = useCallback(() => {
    const api = gridRef.current?.api;
    // 参照のみのときは行選択を使わない（「選択」列で表示する）
    if (!api || readOnly) return;
    const ids = new Set(selectedIds);
    api.forEachNode((node) => {
      const shouldSelect = !!node.data && ids.has(node.data.id);
      if (node.isSelected() !== shouldSelect) node.setSelected(shouldSelect);
    });
  }, [selectedIds, readOnly]);

  useEffect(() => {
    syncSelection();
  }, [syncSelection]);

  // グリッド生成時にも初期チェックを付ける。列状態の復元の後に実行されるよう、
  // useGridColumnState の onGridReady へ連結する（最新の syncSelection を ref 経由で呼ぶ）。
  const syncSelectionRef = useRef(syncSelection);
  syncSelectionRef.current = syncSelection;
  const handleGridReady = useCallback(
    (_event: GridReadyEvent<SplitDestination>) => syncSelectionRef.current(),
    []
  );

  // 列幅・並び順・ソートの永続化。
  const gridColumnStateProps = useGridColumnState(
    '支払詳細C.追加口分割.分割先選択.columnState.v1',
    { onGridReady: handleGridReady }
  );

  const handleSelectionChanged = (
    event: SelectionChangedEvent<SplitDestination>
  ) => {
    if (event.source === 'api') return;
    // 一覧の並び（候補の並び）の順で通知し、ステップ2の列の並びをそろえる。
    const selected = new Set(event.api.getSelectedRows().map((r) => r.id));
    onSelectionChange(
      candidates.filter((c) => selected.has(c.id)).map((c) => c.id)
    );
  };

  const getRowId = useCallback(
    (params: GetRowIdParams<SplitDestination>) => params.data.id,
    []
  );

  // 列の呼び方と並び順は親画面（支払詳細の基本情報）にそろえ、コードと名称の2列ずつで並べる。
  // 同じ販売店・一次店でも三次店まで見ないと商流販売店を判別できないため、三次店名称は広めに取る。
  const columnDefs = useMemo<ColDef<SplitDestination>[]>(
    () => [
      // 参照のみのときは行選択を使わず、選択済みの分割先を非活性のチェックで示す
      //（AG Grid は選択不可の行へ setSelected できず、選択済みの分割先を表示できないため）。
      ...(readOnly
        ? [
            {
              headerName: '選択',
              colId: 'selectedReadOnly',
              width: 70,
              cellClass: 'cell-center',
              sortable: false,
              valueGetter: (p: { data?: SplitDestination }) =>
                !!p.data && selectedIdSet.has(p.data.id),
              cellRenderer: (p: { value: boolean }) => (
                <input
                  type="checkbox"
                  checked={p.value}
                  disabled
                  readOnly
                  aria-label={p.value ? '分割先（選択済み）' : '分割先ではない'}
                />
              ),
            },
          ]
        : []),
      { headerName: '販売店コード', field: 'storeCode', width: 110 },
      { headerName: '販売店名称', field: 'storeName', width: 140 },
      { headerName: '三次店コード', field: 'tertiaryCode', width: 110 },
      { headerName: '三次店名称', field: 'tertiaryName', width: 280 },
      { headerName: '一次店コード', field: 'primaryCode', width: 110 },
      { headerName: '一次店名称', field: 'primaryName', width: 200 },
      { headerName: '部署コード', field: 'deptCode', width: 100 },
      { headerName: '部署名称', field: 'deptName', width: 170 },
      { headerName: '担当者コード', field: 'staffCode', width: 110 },
      { headerName: '担当者名', field: 'staffName', width: 110 },
      {
        headerName: '計画ケース',
        field: 'planCases',
        width: 110,
        type: 'rightAligned',
        valueFormatter: (p) =>
          typeof p.value === 'number'
            ? p.value.toLocaleString()
            : GRID_EMPTY_TEXT,
      },
      {
        headerName: '前月分割',
        colId: 'prevMonth',
        width: 100,
        cellClass: 'cell-center',
        valueGetter: (p) =>
          p.data && prevMonthIdSet.has(p.data.id) ? '有' : GRID_EMPTY_TEXT,
      },
    ],
    [prevMonthIdSet, readOnly, selectedIdSet]
  );

  const defaultColDef = useMemo<ColDef<SplitDestination>>(
    () => ({ ...GRID_DEFAULT_COL_DEF, editable: false }),
    []
  );

  // 行選択（チェックボックス列）。参照のみのときは行選択を使わない（上の「選択」列で表示）。
  const rowSelection = useMemo(
    () =>
      readOnly
        ? undefined
        : {
            mode: 'multiRow' as const,
            checkboxes: true,
            headerCheckbox: true,
            // 行のどこをクリックしてもチェックを付け外しできる（Ctrl 不要。公式：
            // enableClickSelection＋enableSelectionWithoutKeys）。
            enableClickSelection: true,
            enableSelectionWithoutKeys: true,
          },
    [readOnly]
  );

  return (
    <div className="flex h-full flex-col">
      <p className="px-4 pb-2 text-sm text-gray-700">
        {readOnly
          ? '申請後のため、分割先は変更できません。［次へ］で分割の内容を確認できます。'
          : // チェックを付けた商流販売店が分割先であることを主に書く（→ 要件書 BI612 へのコメント C91）
            'チェックを付けた商流販売店が分割先になります（初期表示は前月の分割先）。チェックを外した商流販売店は分割先から外れ、入力済みのケース・バラは自部署負担分に含めて計算し直します。分割先を選んだら［次へ］を押してください。'}
      </p>
      <div className="min-h-0 flex-1 px-4 pb-2">
        <div className="h-full w-full">
          <AgGridReact<SplitDestination>
            ref={gridRef}
            rowData={candidates}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={getRowId}
            getContextMenuItems={gridFilterContextMenuItems}
            rowSelection={rowSelection}
            selectionColumnDef={{
              width: 50,
              resizable: false,
              suppressMovable: true,
              suppressHeaderMenuButton: true,
            }}
            onSelectionChanged={handleSelectionChanged}
            statusBar={GRID_STATUS_BAR}
            {...gridColumnStateProps}
            {...GRID_BASE_PROPS}
          />
        </div>
      </div>
    </div>
  );
}

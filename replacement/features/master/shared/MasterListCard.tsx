// 型1 マスタメンテ画面の一覧カード（AG Grid）。
// ・コード列を左、名称列を右に分けて表示し、サロゲートキーは出さない（マスタ画面標準化 p.7、10/2 決定2、Q&A No.34⑤）
// ・世代管理のマスタは最新世代に集約し、最左の展開列で全世代を表示する（p.12、Q&A No.34⑥。AG Grid Tree Data）
// ・操作列は編集と削除（論理削除）を標準とし、コピー・無効化はマスタごとに要否を指定する（p.9、Q&A No.34④）
// ・参照のみのユーザーには更新系ボタンを非活性で表示する（10/2 決定6）
// ・全件ダウンロードは右クリックのエクスポート（共通メニュー）。専用ボタンは設けない（10/2 決定1）
// ・一括UL対象のマスタには「アップロード用シートDL」ボタンを設ける（10/2 決定1・6）
// 2026-10-30 画面設計標準 ver0.3・guidelines（10/28〜29）への準拠：
// ・一覧カードは共通部品 CollapsibleCard（fillParent＋下限 23.75rem）で、ボタンは headerActions（→ 05 一覧画面の型）
// ・行ID（getRowId）は参照を安定させる、0件の文言は共通ロケール、空欄はグレーの「-」（→ 02 §7・§8）
// ・列フィルタは値の型で 1 列 1 種類（日時の列は GRID_DATE_TEXT_FILTER）（→ 02 §7 列フィルタの種類）
// ・先頭列が数値の列は右寄せ（Q&A QM-027。grid.css の .ag-cell-right）
// 2026-10-30（2回目）Q&A の回答への対応：
// ・変更できる項目が無いマスタ（主キーと無効化フラグだけ）は編集アイコンと行ダブルクリックの更新を設けない（QM-033。masterUtils.hasUpdate）
// ・長い文字の列（複数行・40 文字以上）は列幅を抑えて省略表示し、ツールチップで全文を出す（QM-034。共通の tooltipValueGetter＋whenTruncated）

import { useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  RowClassParams,
  RowDoubleClickedEvent,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Ban, Copy, Download, Plus, SquarePen, Trash2 } from 'lucide-react';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import {
  GRID_BASE_PROPS,
  GRID_DATE_TEXT_FILTER,
  GRID_DEFAULT_COL_DEF,
  GRID_EMPTY_TEXT,
  GRID_MONTH_TEXT_FILTER,
  GRID_STATUS_BAR,
  useGridColumnState,
  withHeaderTooltips,
} from '@/components/grid';
import type {
  MasterFieldDef,
  MasterGridRow,
  MasterScreenDef,
} from './masterTypes';
import {
  formatNumber,
  hasUpdate,
  isWideField,
  optionName,
} from './masterUtils';

/** 操作列のセルレンダラーへ渡すコールバック（グリッドの context 経由） */
interface MasterGridContext {
  canEdit: boolean;
  /** 更新ペインを設ける画面か（変更できる項目が無いマスタは編集アイコンを出さない） */
  hasUpdate: boolean;
  def: MasterScreenDef;
  onEdit: (row: MasterGridRow) => void;
  onCopy: (row: MasterGridRow) => void;
  onDelete: (row: MasterGridRow) => void;
  onInactivate: (row: MasterGridRow) => void;
}

// 操作列のアイコンボタン（活性＝青、非活性＝グレー）。非表示にはしない（10/2 決定6）
const ACTION_BUTTON_CLASS =
  'inline-flex items-center justify-center rounded p-1 text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent';

// 行ID（画面設計標準 4.7）。モジュール直下で参照を安定させる（→ 02 §8 行ID）
const getRowId = (p: GetRowIdParams<MasterGridRow>): string => p.data.id;

// 長い文字の列（複数行・40 文字以上）の列幅（px）。列幅で省略し、マウスオーバーで全文を表示する。初期表示の自動列幅調整の対象にしない
const LONG_TEXT_COLUMN_WIDTH = 192;
const longTextColumn = (field: MasterFieldDef) => ({
  width: field.gridWidth ?? LONG_TEXT_COLUMN_WIDTH,
  suppressAutoSize: true,
});

/** 操作列：編集（標準）／コピー／無効化／削除（標準） */
const ActionsCellRenderer = (
  props: ICellRendererParams<MasterGridRow, unknown, MasterGridContext>
) => {
  const { data, context } = props;
  if (!data) return null;
  const disabled = !context.canEdit;
  return (
    <div className="flex h-full items-center justify-center gap-1">
      {context.hasUpdate && (
        <button
          type="button"
          className={ACTION_BUTTON_CLASS}
          aria-label="編集"
          title="編集"
          disabled={disabled}
          onClick={() => context.onEdit(data)}
        >
          <SquarePen className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {context.def.copyAction && (
        <button
          type="button"
          className={ACTION_BUTTON_CLASS}
          aria-label="コピー"
          title="コピーして登録"
          disabled={disabled}
          onClick={() => context.onCopy(data)}
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {context.def.inactivation && (
        <button
          type="button"
          className={ACTION_BUTTON_CLASS}
          aria-label="無効化"
          title={data.inactive ? '無効化済み' : '無効化'}
          disabled={disabled || data.inactive === true}
          onClick={() => context.onInactivate(data)}
        >
          <Ban className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className={`${ACTION_BUTTON_CLASS} text-red-600 hover:bg-red-50`}
        aria-label="削除"
        title="削除"
        disabled={disabled}
        onClick={() => context.onDelete(data)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

/** 項目定義から一覧の列定義を作る（combo はコード列と名称列の2列に分ける） */
const columnsForField = (field: MasterFieldDef): ColDef<MasterGridRow>[] => {
  const width = field.gridWidth ? { width: field.gridWidth } : {};
  switch (field.kind) {
    case 'combo':
      return [
        {
          headerName: field.codeLabel ?? `${field.label}コード`,
          field: field.key,
          cellClass: 'cell-left',
          ...width,
        },
        {
          headerName: field.nameLabel ?? `${field.label}名称`,
          colId: `${field.key}Name`,
          // 値が無いときは emptyLabel（例：「指定なし」）。無ければ共通の「-」
          valueGetter: (p: ValueGetterParams<MasterGridRow>) =>
            p.data ? optionName(field, p.data[field.key]) : '',
          cellClass: 'cell-left',
        },
      ];
    case 'select':
      return [
        {
          headerName: field.label,
          colId: `${field.key}Name`,
          valueGetter: (p: ValueGetterParams<MasterGridRow>) =>
            p.data ? optionName(field, p.data[field.key]) : '',
          cellClass: 'cell-left',
          ...width,
        },
      ];
    case 'number':
      return [
        {
          headerName: field.unit
            ? `${field.label}（${field.unit}）`
            : field.label,
          field: field.key,
          cellClass: 'cell-right',
          // 値は数値型（数値フィルタ）。表示の整形だけ行い、空は共通の「-」
          valueFormatter: (p: ValueFormatterParams<MasterGridRow>) =>
            formatNumber(field, p.value) || GRID_EMPTY_TEXT,
          ...width,
        },
      ];
    case 'month':
      return [
        {
          headerName: field.label,
          field: field.key,
          cellClass: 'cell-left',
          // 年月（YYYY/MM）の文字列は年月フィルタ
          ...GRID_MONTH_TEXT_FILTER,
          ...width,
        },
      ];
    case 'date':
      return [
        {
          headerName: field.label,
          field: field.key,
          cellClass: 'cell-left',
          // 年月日（YYYY/MM/DD）の文字列は日付フィルタ
          ...GRID_DATE_TEXT_FILTER,
          ...width,
        },
      ];
    case 'textarea':
      return [
        {
          headerName: field.label,
          field: field.key,
          cellClass: 'cell-left',
          ...longTextColumn(field),
        },
      ];
    default:
      return [
        {
          headerName: field.label,
          field: field.key,
          cellClass: 'cell-left',
          ...(isWideField(field) ? longTextColumn(field) : width),
        },
      ];
  }
};

interface MasterListCardProps {
  def: MasterScreenDef;
  rows: MasterGridRow[];
  canEdit: boolean;
  onCreate: () => void;
  onEdit: (row: MasterGridRow) => void;
  onCopy: (row: MasterGridRow) => void;
  onDelete: (row: MasterGridRow) => void;
  onInactivate: (row: MasterGridRow) => void;
  onDownloadUploadSheet: () => void;
}

export function MasterListCard({
  def,
  rows,
  canEdit,
  onCreate,
  onEdit,
  onCopy,
  onDelete,
  onInactivate,
  onDownloadUploadSheet,
}: MasterListCardProps) {
  // 列状態（列幅・並び順・ソート）は利用者ごとに保存する（画面設計標準 4.2 ⑤）。
  // 列構成を変えたらバージョンを上げる（→ 02 §7）。v2：展開列の専用化・コード→名称の統一（10/21）
  const gridColumnStateProps = useGridColumnState(
    `master.${def.routeId}.columnState.v2`
  );

  const generation = def.generation;

  const columnDefs = useMemo<ColDef<MasterGridRow>[]>(() => {
    const cols: ColDef<MasterGridRow>[] = [];
    // 項目は定義順に並べ、combo はコード列・名称列の順に出す（展開列は別の専用列）
    def.fields
      .filter((f) => !f.hideInGrid)
      .forEach((f) => {
        const fieldCols = columnsForField(f);
        // 既定の並び順（昇順）。未指定は列定義の順＝業務キーの昇順
        if (def.defaultSortKey === f.key) fieldCols[0].sort = 'asc';
        cols.push(...fieldCols);
      });
    // 先頭列は grid.css の「1列目は中央寄せ」規則の対象になるため、寄せを明示する（→ 02 §7。数値は右寄せ＝Q&A QM-027）
    if (!generation && cols[0]) {
      if (cols[0].cellClass === 'cell-left')
        cols[0] = { ...cols[0], cellClass: 'cell-left ag-cell-left' };
      if (cols[0].cellClass === 'cell-right')
        cols[0] = { ...cols[0], cellClass: 'cell-right ag-cell-right' };
    }
    if (def.inactivation) {
      cols.push({
        headerName: '無効化',
        colId: 'inactive',
        valueGetter: (p: ValueGetterParams<MasterGridRow>) =>
          p.data?.inactive ? '無効' : '',
        // 文字列のため左寄せ（→ 02 §7「横寄せはセルの内容で決める」）。見出しが切れないよう下限幅を持つ
        cellClass: 'cell-left',
        width: 72,
        minWidth: 72,
      });
    }
    // システム共通項目（作成者・最終更新者と日時）。個別の変更履歴は設けない（7/30 決定7）。日時の列は日付フィルタ
    cols.push(
      { headerName: '作成者', field: 'createdBy', cellClass: 'cell-left' },
      {
        headerName: '作成日時',
        field: 'createdAt',
        cellClass: 'cell-left',
        ...GRID_DATE_TEXT_FILTER,
      },
      { headerName: '最終更新者', field: 'updatedBy', cellClass: 'cell-left' },
      {
        headerName: '更新日時',
        field: 'updatedAt',
        cellClass: 'cell-left',
        ...GRID_DATE_TEXT_FILTER,
      }
    );
    cols.push({
      headerName: '操作',
      colId: 'actions',
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      resizable: false,
      // ボタン 1 つ 36px（削除は常に、編集は更新ペインのある画面、コピー・無効化はマスタごと）
      width:
        34 +
        36 *
          [true, hasUpdate(def), def.copyAction, def.inactivation].filter(
            Boolean
          ).length,
      // 右端に固定（固定するのは操作列だけ → 02 §7「列の固定」）
      pinned: 'right',
      lockPinned: true,
      lockPosition: 'right',
      suppressMovable: true,
    });
    return withHeaderTooltips(cols);
  }, [def, generation]);

  // 世代管理の展開列（最左の専用列。最新世代の行に過去の世代を束ね、▶ だけを表示する）。
  // まとめる単位は業務キー（適用開始・終了年月日を除く PK）で、名称やコードは展開列に出さない
  const autoGroupColumnDef = useMemo<ColDef<MasterGridRow> | undefined>(() => {
    if (!generation) return undefined;
    return {
      headerName: '',
      // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
      suppressColumnsToolPanel: true,
      headerTooltip: '世代の展開',
      colId: 'generationToggle',
      valueGetter: () => '',
      width: 45,
      minWidth: 45,
      maxWidth: 45,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      lockPosition: 'left',
      lockPinned: true,
      suppressHeaderMenuButton: true,
      cellRendererParams: { suppressCount: true },
    };
  }, [generation]);

  const gridContext = useMemo<MasterGridContext>(
    () => ({
      canEdit,
      hasUpdate: hasUpdate(def),
      def,
      onEdit,
      onCopy,
      onDelete,
      onInactivate,
    }),
    [canEdit, def, onEdit, onCopy, onDelete, onInactivate]
  );

  // 過去の世代と無効化済みの行はグレーの文字で表示する（grid.css の .master-row-muted）
  const rowClassRules = useMemo(
    () => ({
      'master-row-muted': (p: RowClassParams<MasterGridRow>) =>
        p.data?.isLatestGeneration === false || p.data?.inactive === true,
    }),
    []
  );

  // 権限の切替は context 経由のため、操作列のセルを描き直して活性／非活性を反映する
  const gridRef = useRef<AgGridReact<MasterGridRow>>(null);
  useEffect(() => {
    gridRef.current?.api?.refreshCells({ columns: ['actions'], force: true });
  }, [canEdit]);

  const handleRowDoubleClicked = (e: RowDoubleClickedEvent<MasterGridRow>) => {
    // 行のダブルクリックでも編集ペインを開く（画面設計標準 3.2「一覧の操作」）。更新ペインの無い画面は開かない
    if (e.data && canEdit && hasUpdate(def)) onEdit(e.data);
  };

  // 一覧カード：残りの高さいっぱいに広げ、グリッドの中だけをスクロールさせる（→ 05 一覧画面の型）。
  // ボタンは行選択と連動しないため右端の headerActions に置く（→ 05 グリッド上部ツールバー）
  return (
    <CollapsibleCard
      title={`${def.entityLabel}一覧`}
      fillParent
      className="data-[state=open]:min-h-95"
      contentClassName="p-2 flex flex-col flex-1 min-h-0"
      headerActions={
        <>
          {def.bulkUpload && (
            <button
              type="button"
              onClick={onDownloadUploadSheet}
              className="btn-toolbar-outline"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              アップロード用シートDL
            </button>
          )}
          <button
            type="button"
            onClick={onCreate}
            className="btn-toolbar-outline"
            disabled={!canEdit}
            aria-label={`${def.entityLabel}登録`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {def.entityLabel}登録
          </button>
        </>
      }
    >
      <div className="flex-1 min-h-0 w-full">
        <AgGridReact<MasterGridRow>
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={GRID_DEFAULT_COL_DEF}
          domLayout="normal"
          getRowId={getRowId}
          context={gridContext}
          rowClassRules={rowClassRules}
          // 世代管理：Tree Data で最新世代（親）に過去の世代（子）を束ねる
          treeData={Boolean(generation)}
          getDataPath={
            generation ? (d: MasterGridRow) => d.treePath : undefined
          }
          groupDefaultExpanded={0}
          autoGroupColumnDef={autoGroupColumnDef}
          onRowDoubleClicked={handleRowDoubleClicked}
          statusBar={GRID_STATUS_BAR}
          // 共通基本プロパティ（Enter縦移動・セル範囲選択等／grid/）
          {...GRID_BASE_PROPS}
          // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
          {...gridColumnStateProps}
        />
      </div>
    </CollapsibleCard>
  );
}

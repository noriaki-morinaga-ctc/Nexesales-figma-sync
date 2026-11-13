import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GetRowIdParams, IRowNode } from 'ag-grid-community';

import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  GRID_COLORS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_NUMBER_FILTER,
  GRID_EMPTY_TEXT,
} from '@/app/components/grid';
import { SingleComboboxCellEditor } from '@/app/components/ui/single-combobox-cell-editor';
import { ASSIGN_OPTIONS } from '@/mocks/common/billingEdi';
import { ASSIGN_TARGET_BY_FIELD } from '@/app/constants/billingEdi';
import type {
  BillingEdiDetailRow,
  BillingEdiErrorSummary,
} from '@/app/types/billingEdi';
import {
  formatTargetOffices,
  targetCountOf,
  targetOfficesOf,
} from '@/app/utils/payment/billing/billingEdiImport';

// 変換後の値の表示文言（コードから選択肢のラベルを引く）
const assignedLabel = (summary: BillingEdiErrorSummary): string => {
  const target = ASSIGN_TARGET_BY_FIELD[summary.field];
  if (!target || !summary.assignedValue) return '';
  return (
    ASSIGN_OPTIONS[target].find((o) => o.value === summary.assignedValue)
      ?.label ?? summary.assignedValue
  );
};

// 参照専用セルの共通スタイル（灰）。入力できるのは変換エラーの「変換後の値」だけ
const RO_STYLE = { backgroundColor: GRID_COLORS.readonly } as const;

// 行ID（AG Grid 公式 getRowId）。モジュール直下に置いて参照を固定する（→ 02 §7.1）
const getErrorRowId = (params: GetRowIdParams<BillingEdiErrorSummary>) =>
  params.data.id;

interface ErrorListProps {
  rowData: BillingEdiErrorSummary[];
  // 対象の請求元事業所を数えるために明細を受け取る（決定14の取込可否の単位）
  details: BillingEdiDetailRow[];
  // チェックした行（再取込の対象）。同一の変換エラーが多数の明細に及ぶため、
  // 1件ずつではなくまとめて再取込できるようにする（決定18）
  onSelectionChange: (summaries: BillingEdiErrorSummary[]) => void;
  // 「変換後の値」をセルで登録したときの通知
  onAssign: (summaryId: string, assignedValue: string) => void;
  // 行を選ぶと、請求EDI明細をそのエラーの対象明細だけに絞り込む（同じ行を再度選ぶと解除）
  onSelect: (summary: BillingEdiErrorSummary | null) => void;
  selectedId: string | null;
  // 「未実施・未解消のみ表示」のチェック状態。ONのとき状態＝解消の行を表示しない
  hideResolved: boolean;
}

export function ErrorList({
  rowData,
  details,
  onSelectionChange,
  onAssign,
  onSelect,
  selectedId,
  hideResolved,
}: ErrorListProps) {
  const gridRef = useRef<AgGridReact<BillingEdiErrorSummary>>(null);

  // 外部フィルタ（公式 isExternalFilterPresent／doesExternalFilterPass）で解消済みを隠す。
  // コールバックは参照を固定し、最新のチェック状態は ref から読む（→ 02 §7.1）
  const hideResolvedRef = useRef(hideResolved);
  useEffect(() => {
    hideResolvedRef.current = hideResolved;
    gridRef.current?.api?.onFilterChanged();
  }, [hideResolved]);
  const isExternalFilterPresent = useCallback(
    () => hideResolvedRef.current,
    []
  );
  const doesExternalFilterPass = useCallback(
    (node: IRowNode<BillingEdiErrorSummary>) =>
      node.data?.resolveState !== '解消',
    []
  );

  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）。
  // 変換エラー専用だった構成を、形式エラーも含むエラーサマリへ作り替え（v3）、
  // 再取込の単位をエラーサマリ1件としたことで 状態・操作 の2列を追加（v4）、
  // オンライン取込に伴い状態を3値化し「変換後の値」列を追加したため v5 とする。
  // v6：影響範囲を廃止し対象事業所に置き換え（決定14）。
  // v7：行ごとの再取込ボタン（操作列）を廃止し、チェックボックス選択に変更（決定18）。
  // v8：補助項目を廃止し（請求EDI明細で確認できる）、対象明細をエラー明細件数へ改称。
  // v9：種別（商品／商流）を廃止。区分とエラー項目から判別でき、データ不正では常に空欄だったため。
  const gridColumnStateProps = useGridColumnState(
    'billingEdiImport.errorSummaryColumnState.v9'
  );

  // エラーサマリ1件ごとの対象事業所（「コード:名称」）。明細から引き当てて数える。
  const officesById = useMemo(
    () =>
      new Map(
        rowData.map((summary) => [
          summary.id,
          targetOfficesOf(details, summary),
        ])
      ),
    [rowData, details]
  );

  // エラーサマリ1件ごとの対象明細件数。対象明細の定義（matchesErrorSummary）から
  // 導出し、行押下で絞り込んだ結果と必ず一致させる。
  const targetCountById = useMemo(
    () =>
      new Map(
        rowData.map((summary) => [summary.id, targetCountOf(details, summary)])
      ),
    [rowData, details]
  );

  // エラーサマリの列定義（同じ原因の明細をまとめた作業単位）。
  // 「エラー項目」が何で、その「値」が何だったか、変換・検証に併せて使う「補助項目」は
  // 何かを持つ。項目ごとに構成が違うため、値は汎用の コード／名称 の2列で受ける。
  //   商流販売店       … 値=組合せのうち欠けているコード / 名称=事業所名または得意先名
  //   商品コード       … 値=商品コード(4-8) / 名称=商品名(5-3) / 補助=商品コード使用区分(4-9)
  //   形式エラー       … 値=連携生値 / 名称=なし / 補助=定義や検算に使う項目
  // 商流販売店は値に事業所が含まれるため対象事業所は1件、商品コード・形式エラーは
  // 事業所をまたぐことがあるため複数件になる（決定18の一括修正が成り立つ単位）。
  // 修正先は、マスタの登録内容によって直す先が1つに定まらない（複数マスタにまたがる）
  // ことがあるため列に持たせず、ユーザーの判断に委ねる。
  const columnDefs: ColDef<BillingEdiErrorSummary>[] = useMemo(
    () => [
      // 再取込はチェックボックスで対象を選び、フッターのボタンでまとめて実行する（決定18）
      {
        // 取込はオンラインのため、再取込を押した時点で解消／未解消が確定する
        headerName: '状態',
        field: 'resolveState',
        width: 88,
        cellClass: 'cell-left',
        cellStyle: (params) =>
          params.value === '未解消'
            ? { color: GRID_COLORS.overText }
            : undefined,
      },
      {
        headerName: '区分',
        field: 'category',
        width: 136,
        cellClass: 'cell-left',
      },
      {
        headerName: 'エラー項目',
        field: 'field',
        width: 136,
        cellClass: 'cell-left',
      },
      {
        headerName: '値(コード)',
        field: 'valueCode',
        width: 128,
        cellClass: 'cell-left',
      },
      {
        headerName: '値(名称)',
        field: 'valueName',
        width: 152,
        cellClass: 'cell-left',
      },
      {
        // 変換エラーのみ、そのコードの変換先をマスタから登録できる（＝応急処置）。
        // 値が入っていればその値を適用して再変換し、無ければマスタから再変換する。
        headerName: '変換後の値',
        field: 'assignedValue',
        width: 176,
        cellClass: 'cell-left',
        // 規約例外（変更ハイライトなし）：変換後の値は入力するとすぐ登録され（onAssign）、保存前の差分が無いため
        editable: (params) =>
          !!params.data &&
          params.data.category === '変換マスタ未登録' &&
          params.data.resolveState !== '解消',
        cellEditorPopup: true,
        // 選択肢はエラー項目ごとに変わる（事業所コード→事業所マスタ 等）。
        // cellEditorParams は静的オブジェクトしか受け付けないため、行ごとに
        // 選択肢を差し替える公式APIの cellEditorSelector を使う。
        cellEditorSelector: (params) => ({
          component: SingleComboboxCellEditor,
          params: {
            comboOptions: params.data
              ? (ASSIGN_OPTIONS[ASSIGN_TARGET_BY_FIELD[params.data.field]] ??
                [])
              : [],
            placeholder: 'マスタから選択',
            width: '22rem',
          },
        }),
        valueFormatter: (params) =>
          params.data
            ? assignedLabel(params.data) || GRID_EMPTY_TEXT
            : GRID_EMPTY_TEXT,
        cellStyle: (params) => {
          if (!params.data) return RO_STYLE;
          if (
            params.data.category !== '変換マスタ未登録' ||
            params.data.resolveState === '解消'
          ) {
            return RO_STYLE;
          }
          return { backgroundColor: GRID_COLORS.editable };
        },
      },
      // 補助項目（変換・検証に併せて使う項目）は請求EDI明細で確認できるため列にしない
      {
        // 決定14により取込可否は請求元事業所単位で決まるため、影響範囲に代えて
        // どの事業所が取り込めていないかを示す。複数の事業所にまたがるエラー
        //（商品コード・形式エラー）は件数でまとめ、内訳はツールチップで確認する。
        headerName: '対象事業所',
        colId: 'targetOffices',
        width: 160,
        cellClass: 'cell-left',
        valueGetter: (params) =>
          params.data
            ? formatTargetOffices(officesById.get(params.data.id) ?? [])
            : '',
        tooltipValueGetter: (params) =>
          params.data ? (officesById.get(params.data.id) ?? []).join(', ') : '',
      },
      {
        headerName: 'エラー内容',
        field: 'reason',
        flex: 1,
        suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
        minWidth: 144,
        cellClass: 'cell-left',
      },
      {
        // 基本情報の「エラー事業所数」は請求元事業所の数。こちらはエラー1件あたりの
        // 件数で、1明細に複数のエラーが付くため全行の合計とは一致しない
        headerName: 'エラー明細件数',
        colId: 'targetCount',
        ...GRID_NUMBER_FILTER,
        width: 120,
        cellClass: 'cell-right',
        valueGetter: (params) =>
          params.data ? (targetCountById.get(params.data.id) ?? 0) : 0,
        valueFormatter: (params) => `${params.value ?? 0} 件`,
      },
    ],
    [officesById, targetCountById]
  );

  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  return (
    <div className="min-h-0 w-full flex-1">
      <AgGridReact<BillingEdiErrorSummary>
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefsWithTooltip}
        defaultColDef={GRID_DEFAULT_COL_DEF}
        getContextMenuItems={gridFilterContextMenuItems}
        domLayout="normal"
        getRowId={getErrorRowId}
        onCellValueChanged={(event) => {
          if (event.column.getColId() !== 'assignedValue' || !event.data)
            return;
          onAssign(event.data.id, String(event.newValue ?? ''));
        }}
        stopEditingWhenCellsLoseFocus={true}
        rowSelection={{
          // チェックした行がまとめて再取込の対象になる（決定18）。
          // 行クリックは請求EDI明細の絞り込みに使うため、クリックでは選択しない。
          mode: 'multiRow',
          // 解消済みのエラーは再取込の対象にできないため、チェックボックス自体を表示しない
          checkboxes: (params) => params.data?.resolveState !== '解消',
          headerCheckbox: true,
          enableClickSelection: false,
          // 表示を消すだけではヘッダーの全選択やAPI経由で選択され得るため、選択自体も禁止する
          isRowSelectable: (node) => node.data?.resolveState !== '解消',
        }}
        // 選択列は他画面（計画一覧・未償却案件請求一覧 等）と同じ構成にそろえる。
        // セル中央配置で、隣の「状態」列と区別できるようにする。
        // 幅は AG Grid が選択セルに持たせる最小幅（60px）に合わせる。
        // 50px にするとセルが列からはみ出し、隣の「状態」列に重なって見える
        selectionColumnDef={{
          width: 48,
          resizable: false,
          suppressMovable: true,
          suppressHeaderMenuButton: true,
          cellClass: 'cell-center',
        }}
        onSelectionChanged={(event) =>
          onSelectionChange(event.api.getSelectedRows())
        }
        isExternalFilterPresent={isExternalFilterPresent}
        doesExternalFilterPass={doesExternalFilterPass}
        onRowClicked={(event) => {
          if (!event.data) return;
          // 同じ行をもう一度選んだら絞り込みを解除する
          onSelect(event.data.id === selectedId ? null : event.data);
        }}
        {...GRID_BASE_PROPS}
        {...gridColumnStateProps}
        statusBar={GRID_STATUS_BAR}
      />
    </div>
  );
}

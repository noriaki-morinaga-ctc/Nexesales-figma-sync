import { useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type {
  ColDef,
  GetRowIdParams,
  RowDoubleClickedEvent,
} from 'ag-grid-community';
import { CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react';

import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_COLORS,
  GRID_DATE_TEXT_FILTER,
  GRID_NUMBER_FILTER,
  GRID_EMPTY_TEXT,
  StatusIconCellRenderer,
} from '../../../grid';
import { BUTTON_STYLES } from '../../../../../styles/commonStyles';
import type {
  BillingEdiImportRow,
  BillingEdiStatus,
} from '../../../../constants/billingEdiMockData';
import {
  countErrorOffices,
  formatPayeeName,
  formatRowErrorCategories,
  formatRowOwners,
  hasNoDetail,
} from '../../../../utils/payment/billing/billingEdiImport';

// ステータスごとのアイコン・色設定
const STATUS_CONFIG: Record<
  BillingEdiStatus,
  { icon: typeof CheckCircle; className: string }
> = {
  正常: { icon: CheckCircle, className: 'text-green-600' },
  エラー: { icon: AlertTriangle, className: 'text-red-600' },
  再取込指示済: { icon: RotateCcw, className: 'text-orange-500' },
};

// グリッドの context 型（セルレンダラーから呼ぶコールバック）
interface ResultListGridContext {
  onDetail: (row: BillingEdiImportRow) => void;
}

// 詳細ボタンレンダラー。配下を持たない行は非活性にする。
//   ・システムエラー（形式不正・受信失敗・二重取込）＝ファイル全体が取込不可
//   ・卸会社が特定できない（請求元企業コードが変換マスタに無い）＝配下を卸会社に紐づけられない
const DetailButtonRenderer = (
  props: CustomCellRendererProps<BillingEdiImportRow>
) => {
  if (!props.data) {
    return null;
  }
  const row = props.data;
  const handleClick = () => {
    const context = props.context as ResultListGridContext;
    if (props.data) {
      context.onDetail(props.data);
    }
  };
  if (hasNoDetail(row)) {
    return (
      <button
        className={`${BUTTON_STYLES.outline} h-7 cursor-not-allowed rounded px-2 text-sm whitespace-nowrap opacity-50`}
        disabled
        title={
          row.isSystemError
            ? 'ファイル全体が取込不可のため内訳がありません'
            : '卸会社を特定できないため内訳がありません'
        }
      >
        詳細
      </button>
    );
  }
  return (
    <button
      className={`${BUTTON_STYLES.outline} h-7 px-2 rounded text-sm whitespace-nowrap transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none`}
      onClick={handleClick}
    >
      詳細
    </button>
  );
};

// 行IDは取込行の id（再取込・修正で rowData を差し替えても同じ行として扱う。→ 画面設計標準 4.7）
const getRowId = (params: GetRowIdParams<BillingEdiImportRow>) =>
  params.data.id;

interface ResultListProps {
  rowData: BillingEdiImportRow[];
  onDetail: (row: BillingEdiImportRow) => void;
}

export function ResultList({ rowData, onDetail }: ResultListProps) {
  const gridRef = useRef<AgGridReact<BillingEdiImportRow>>(null);

  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
  // 列構成の変更（請求元・対象年月・請求金額・エラー内容の削除、最終処理日時の追加、
  // 操作列を最左へ移動）に伴い v2 へ、列幅の明示指定に伴い v3 へ更新。
  // v4：エラー種別ほかの列を追加し「支払先」を「卸会社」へ改称。
  // v5：オンライン取込に合わせ「最終処理日時」を「再取込日時」へ、
  //     変換/形式の件数・再取込状況を「未実施」「未解消」に置き換え。
  // v6：再取込の 日時／未実施／未解消 を列グループ「再取込」にまとめた。
  // v7：請求書数・伝票数・明細数を削除し、担当者・対応状況・エラー事業所数を追加（決定10・14・16）。
  // v8：「卸会社」を「卸店名（請求元）」へ改称、
  // v9：再取込の列グループを廃止し、再取込日時／未実施／未解消の3列（移動不可）にした。
  // v10：未実施／未解消の件数の単位をエラーサマリから請求元事業所へそろえた。
  // v11：「未実施」「未解消」だけでは対応状況の値と同じ語になり実態と合わないため、
  //     「再取込未実施 事業所数」「再取込後 未解消 事業所数」へ改称し列幅を広げた。
  //     あわせて「再取込日時」を「再取込日時（最新）」とした。
  // 「卸店名（請求元）」を「請求元企業」へ改称した（見出しのみの変更で colId は変わらないため版は据え置き）。
  // v12：「再取込未実施 事業所数」「再取込後 未解消 事業所数」を削除し、
  //     「エラー事業所数」を現時点の件数に変えた（→ 4.レイアウト AK89 スレッド 加藤 2026-09-14）。
  // v13：「対応状況」列を削除した（→ 請求EDI取込結果詳細 4.レイアウト AJ45 スレッド 加藤 2026-10-13）。
  // 旧キーの保存状態には新しい列が含まれず、復元すると列順・表示が崩れるため。
  //
  // 列幅は自動調整し、余りは請求元企業列（flex:1・自動調整から外す）に吸わせて
  // 右端の空きをなくす。
  const gridColumnStateProps = useGridColumnState(
    'billingEdiImport.listColumnState.v13'
  );

  // AG Grid列定義（1行＝請求元企業 × 受信日時＝1回の受信ファイル）
  // 操作列を最左に置き、表示倍率100%で横スクロールが出ない8列に収める。
  // 請求元企業以外は内容に合わせた固定幅、請求元企業が残り幅をすべて吸収する。
  const columnDefs: ColDef<BillingEdiImportRow>[] = useMemo(
    () => [
      {
        headerName: '操作',
        colId: 'detail',
        width: 72,
        cellRenderer: DetailButtonRenderer,
        sortable: false,
        filter: false,
        suppressMovable: true,
        resizable: false,
        cellClass: 'cell-left',
      },
      {
        headerName: '受信日時',
        field: 'receivedAt',
        ...GRID_DATE_TEXT_FILTER,
        width: 120,
        cellClass: 'cell-left',
      },
      {
        headerName: '請求元企業',
        colId: 'payeeName',
        // 余り幅を吸収して右端の空きをなくす（卸会社名は長さがまちまちのため）
        flex: 1,
        suppressAutoSize: true, // 残りの幅に広げる列のため自動調整から外す（flex を保つ）
        minWidth: 176,
        cellClass: 'cell-left',
        valueGetter: (params) =>
          params.data ? formatPayeeName(params.data) : '',
      },
      // 請求書数・伝票数・明細数は業務上使用しないため削除した（決定16 2026-08-18）
      {
        headerName: 'ステータス',
        field: 'status',
        width: 116,
        cellRenderer: StatusIconCellRenderer,
        cellRendererParams: { statusConfig: STATUS_CONFIG },
        cellClass: 'cell-left',
      },
      {
        // 誰が対応するかを判断するための種別（システム管理／マスタ修正／卸へ照会）
        headerName: 'エラー種別',
        colId: 'errorCategories',
        width: 176,
        cellClass: 'cell-left',
        valueGetter: (params) =>
          params.data ? formatRowErrorCategories(params.data) : '',
        valueFormatter: (params) => params.value || GRID_EMPTY_TEXT,
        cellStyle: (params) =>
          params.value ? { color: GRID_COLORS.overText } : undefined,
      },
      {
        // エラー種別ごとの対応部署（決定10）。マスタで設定した値をそのまま出し、
        // 対応の進行に応じて付け替えることはしない。値は人ではなく部署のため
        // 「担当者」から改称した（→ 請求EDI取込結果詳細 4.レイアウト AK59 スレッド 芳賀 2026-10-11）
        headerName: '対応部署',
        colId: 'owners',
        width: 144,
        cellClass: 'cell-left',
        valueGetter: (params) =>
          params.data ? formatRowOwners(params.data) : '',
        valueFormatter: (params) => params.value || GRID_EMPTY_TEXT,
      },
      // 対応状況（担当者が着手しているか）は廃止した（→ 請求EDI取込結果詳細
      // 4.レイアウト AJ45 スレッド 加藤 2026-10-13）
      {
        // 取込可否は請求元事業所単位で決まるため、件数も明細単位ではなく
        // 請求元事業所単位で数える（決定14・16）。
        // 知りたいのは「あと何件エラーが残っているか」なので、再取込で解消した分は
        // 含めず現時点の件数を出す（→ 4.レイアウト AK89 スレッド 加藤 2026-09-14）
        headerName: 'エラー事業所数',
        colId: 'errorOfficeCount',
        ...GRID_NUMBER_FILTER,
        width: 120,
        cellClass: 'cell-right',
        valueGetter: (params) =>
          params.data ? countErrorOffices(params.data) : 0,
        valueFormatter: (params) =>
          params.value ? String(params.value) : GRID_EMPTY_TEXT,
        cellStyle: (params) =>
          params.value ? { color: GRID_COLORS.overText } : undefined,
      },
      {
        // 取込・再取込はオンラインのため、実行した時点の日時が入る。
        // 複数回実行した場合は最新の日時を表示する（→ 本コメントスレッド返信 渡邊 2026-08-18）。
        headerName: '再取込日時（最新）',
        field: 'reimportedAt',
        ...GRID_DATE_TEXT_FILTER,
        headerTooltip:
          '再取込を最後に実行した日時。一度も実行していない場合は「-」。受信日時は最初に受け取った日時',
        width: 144,
        suppressMovable: true,
        cellClass: 'cell-left',
        valueFormatter: (params) =>
          params.value ? params.value : GRID_EMPTY_TEXT,
      },
    ],
    []
  );

  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  // 行のダブルクリックで詳細へ移動する（詳細ボタンと同じ。画面設計標準 3.2）。
  // 詳細ボタンが非活性の行（配下を持たない行）は移動しない。本グリッドに編集可能セルは無い
  const handleRowDoubleClicked = useCallback(
    (event: RowDoubleClickedEvent<BillingEdiImportRow>) => {
      if (event.data && !hasNoDetail(event.data)) onDetail(event.data);
    },
    [onDetail]
  );

  return (
    <div className="billing-edi-list-grid flex-1 min-h-0 w-full">
      <AgGridReact<BillingEdiImportRow>
        ref={gridRef}
        rowData={rowData}
        getRowId={getRowId}
        columnDefs={columnDefsWithTooltip}
        defaultColDef={GRID_DEFAULT_COL_DEF}
        getContextMenuItems={gridFilterContextMenuItems}
        domLayout="normal"
        animateRows={true}
        context={{ onDetail } satisfies ResultListGridContext}
        onRowDoubleClicked={handleRowDoubleClicked}
        {...GRID_BASE_PROPS}
        {...gridColumnStateProps}
        statusBar={GRID_STATUS_BAR}
      />
    </div>
  );
}

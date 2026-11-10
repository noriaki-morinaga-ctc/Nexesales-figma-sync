// 支払詳細(引用)画面用：PaymentPlanSelectionPane をベースに作成
import { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GetRowIdParams } from 'ag-grid-community';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_STATUS_BAR,
  gridFilterContextMenuItems,
  GRID_NUMBER_TEXT_FILTER,
  GRID_EMPTY_TEXT,
  useGridColumnState,
} from '../../../grid';
import { MonthYearPicker } from '../../../ui/month-year-picker';
// 引用基本情報の既定値（対象年月は 'YYYY/MM' 形式）。親から値が渡らない場合のフォールバック。
import { DEFAULT_QUOTE_BASIC_INFO } from '../../../../utils/payment/quote/quoteBasicInfo';

// 支払明細に紐づける計画明細データ（Excel 選択エリア）
interface PlanDetailRow {
  id: string; // 行ID（getRowId に使う内部値。列としては表示しない）
  status: string; // ステータス
  product: string; // 対象商品
  planAmount: number | string; // 計画金額
  payAmount: number | string; // 支払金額
  mgmtClass: string; // 管理区分
  mgmtCode: string; // 管理コード
  summary1: string; // 摘要1
}

const PLAN_DETAIL_ROWS: PlanDetailRow[] = [
  {
    id: 'plan-1',
    status: '計画紐づけ未実施',
    product: '全ブランド',
    planAmount: 200000,
    payAmount: '',
    mgmtClass: 'その他',
    mgmtCode: '0000 Xxx',
    summary1: 'アプリエントリー費',
  },
  {
    id: 'plan-2',
    status: '計画紐づけ実施済',
    product: '三ツ矢',
    planAmount: 600000,
    payAmount: 566000,
    mgmtClass: '試飲会費用',
    mgmtCode: '0000 Xxx',
    summary1: '試飲会費用　30店日',
  },
  {
    id: 'plan-3',
    status: '計画紐づけ実施済',
    product: '全ブランド',
    planAmount: 1200000,
    payAmount: 1142338,
    mgmtClass: '年契・短契（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '年契引当　3－6月分',
  },
  {
    id: 'plan-4',
    status: '計画紐づけ実施済',
    product: 'ワンダ　極　微糖　Ｂ缶３７０ ①',
    planAmount: 180000,
    payAmount: 177000,
    mgmtClass: 'チャネル対策条件（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '①ポイント10P',
  },
  {
    id: 'plan-5',
    status: '計画紐づけ実施済',
    product: '「ドトール」カフェ・オ・レＰＥＴ４８０ ①',
    planAmount: 120000,
    payAmount: 123420,
    mgmtClass: 'チャネル対策条件（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '①ポイント10P',
  },
  {
    id: 'plan-6',
    status: '計画紐づけ実施済',
    product: '「ドトール」ブラックＰＥＴ４８０ ①',
    planAmount: 80000,
    payAmount: 67660,
    mgmtClass: 'チャネル対策条件（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '①ポイント10P',
  },
  {
    id: 'plan-7',
    status: '計画紐づけ実施済',
    product: 'ワンダ極ブラックＢ缶４００ ①',
    planAmount: 0,
    payAmount: 88220,
    mgmtClass: 'チャネル対策条件（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '①ポイント10P',
  },
  {
    id: 'plan-8',
    status: '計画紐づけ未実施',
    product: '「三ツ矢」特濃オレンジＰＥＴ５００ ①',
    planAmount: 180000,
    payAmount: '',
    mgmtClass: '値引き（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '',
  },
  {
    id: 'plan-9',
    status: '計画紐づけ未実施',
    product: '「三ツ矢」特濃オレンジＰＥＴ５００ ②',
    planAmount: 50000,
    payAmount: '',
    mgmtClass: 'チラシ代',
    mgmtCode: '0000 Xxx',
    summary1: '',
  },
  {
    id: 'plan-10',
    status: '計画紐づけ未実施',
    product: '「三ツ矢」ビターレモンＰＥＴ５００ ①',
    planAmount: 120000,
    payAmount: '',
    mgmtClass: '値引き（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '',
  },
  {
    id: 'plan-11',
    status: '計画紐づけ未実施',
    product: 'カルピス　キウイ　P490 ①',
    planAmount: 100000,
    payAmount: '',
    mgmtClass: '値引き（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '',
  },
  {
    id: 'plan-12',
    status: '計画紐づけ実施済',
    product: '三ツ矢サイダー1.5L ①',
    planAmount: 120000,
    payAmount: '',
    mgmtClass: '値引き（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '①ポイント10P、②チラシ代',
  },
  {
    id: 'plan-13',
    status: '計画紐づけ未実施',
    product: '三ツ矢サイダー1.5L ②',
    planAmount: 100000,
    payAmount: '',
    mgmtClass: 'チラシ代',
    mgmtCode: '0000 Xxx',
    summary1: '①ポイント10P、②チラシ代',
  },
  {
    id: 'plan-14',
    status: '計画紐づけ未実施',
    product: '十六茶ＰＥＴ２Ｌ ①',
    planAmount: 100000,
    payAmount: '',
    mgmtClass: 'チラシ代',
    mgmtCode: '0000 Xxx',
    summary1: '',
  },
  {
    id: 'plan-15',
    status: '計画紐づけ未実施',
    product: '三ツ矢サイダー５００ ①',
    planAmount: 150000,
    payAmount: '',
    mgmtClass: '値引き（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '①アプリ▲10円',
  },
  {
    id: 'plan-16',
    status: '計画紐づけ未実施',
    product: '十六茶ＰＥＴ６３０ ①',
    planAmount: 120000,
    payAmount: '',
    mgmtClass: '値引き（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '①アプリ▲10円',
  },
  {
    id: 'plan-17',
    status: '計画紐づけ未実施',
    product: 'ウィルキンソンタンサン５００ ①',
    planAmount: 100000,
    payAmount: '',
    mgmtClass: '値引き（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '①アプリ▲10円',
  },
  {
    id: 'plan-18',
    status: '計画紐づけ未実施',
    product: 'カルピスウォーター５００ ①',
    planAmount: 120000,
    payAmount: '',
    mgmtClass: '値引き（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '①アプリ▲10円',
  },
  {
    id: 'plan-19',
    status: '計画紐づけ未実施',
    product: '颯６２０ ①',
    planAmount: 100000,
    payAmount: '',
    mgmtClass: '値引き（売上連動）',
    mgmtCode: '0000 Xxx',
    summary1: '①アプリ▲10円',
  },
];

// 数値表示（カンマ区切り、空は「-」）
const numFmt = (params: { value: unknown }) => {
  const v = params.value;
  if (v === '' || v === null || v === undefined) return GRID_EMPTY_TEXT;
  if (typeof v === 'number') return v.toLocaleString();
  return String(v);
};

// 行IDは計画明細の id（→ 画面設計標準 4.7）
const getRowId = (params: GetRowIdParams<PlanDetailRow>) => params.data.id;

interface PlanSelectionPaneProps {
  // 列状態（列幅・並び・ソート）の保存キー（画面ごとに一意 → 02 §7）
  columnStateKey: string;
  // 紐づけ対象として選択された行を親へ通知
  onSelect?: (data: PlanDetailRow) => void;
  // 対象年月の初期値（'YYYY/MM'）。基本情報の対象年月を親から受け取る。
  initialTargetMonth?: string;
}

export function QuotePlanSelectionPane({
  columnStateKey,
  onSelect,
  initialTargetMonth,
}: PlanSelectionPaneProps) {
  const gridRef = useRef<AgGridReact>(null);
  // 初期値は基本情報の対象年月。検索条件としては残し、変更も可能とする。
  const [targetMonth, setTargetMonth] = useState(
    initialTargetMonth ?? DEFAULT_QUOTE_BASIC_INFO.targetMonth
  );
  // 「計画紐づけ実施済」の行を表示するか（トグル）。既定は表示。
  const [isLinkedShown, setIsLinkedShown] = useState(true);

  // チェック行を親へ通知する。ボタンによる一括通知は廃止し、
  // チェック操作の時点で即時に支払明細へ反映する。
  const handleSelectionChanged = () => {
    const selected = gridRef.current?.api?.getSelectedRows() ?? [];
    if (selected.length === 0) return;
    selected.forEach((row) => onSelect?.(row as PlanDetailRow));
  };

  const rows = useMemo(
    () =>
      isLinkedShown
        ? PLAN_DETAIL_ROWS
        : PLAN_DETAIL_ROWS.filter((r) => r.status !== '計画紐づけ実施済'),
    [isLinkedShown]
  );

  const columnDefs: ColDef[] = useMemo(
    () => [
      { headerName: 'ステータス', field: 'status', width: 120 },
      {
        headerName: '対象商品',
        field: 'product',
        width: 192,
      },
      {
        headerName: '計画金額',
        field: 'planAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 88,
        valueFormatter: numFmt,
        cellClass: 'cell-right',
      },
      {
        headerName: '支払金額',
        field: 'payAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 88,
        valueFormatter: numFmt,
        cellClass: 'cell-right',
      },
      {
        headerName: '管理区分',
        field: 'mgmtClass',
        width: 160,
      },
      {
        headerName: '管理コード',
        field: 'mgmtCode',
        width: 96,
      },
      { headerName: '摘要1', field: 'summary1', width: 160 },
    ],
    []
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      // 共通の既定列定義（grid/）。ソート/リサイズ/フィルター、ヘッダーの…メニュー・
      // フィルターボタン非表示、tooltip を内包。フィルターは右クリックメニューから開く。
      ...GRID_DEFAULT_COL_DEF,
      cellDataType: false,
    }),
    []
  );

  // 列幅・並び・ソートの状態を保存／復元する（→ 02 §7 列状態の永続化）
  const planGridColumnStateProps = useGridColumnState(columnStateKey);
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 絞り込み条件 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold text-gray-900 whitespace-nowrap">
            計上年月
          </label>
          <MonthYearPicker
            value={targetMonth}
            onChange={setTargetMonth}
            clearable
          />
        </div>

        {/* 「計画紐づけ実施済」の表示／非表示トグル（販売計画(集計)のタブボタンと同テーマ） */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold text-gray-900 whitespace-nowrap">
            計画紐づけ実施済
          </label>
          <div className="flex border-2 border-blue-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setIsLinkedShown(true)}
              className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
                isLinkedShown
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              表示
            </button>
            <div className="w-px bg-blue-600" />
            <button
              onClick={() => setIsLinkedShown(false)}
              className={`px-4 py-1 h-8 whitespace-nowrap text-sm font-medium transition-colors ${
                !isLinkedShown
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              非表示
            </button>
          </div>
        </div>
      </div>

      {/* 計画明細テーブル */}
      <div
        className="plan-selection-grid flex-1 min-h-100"
        style={{ width: '100%' }}
      >
        {/* 支払申請一覧参照と同様：ヘッダーの全選択チェックボックスに左パディング（左寄せ） */}
        <style>{`
          .plan-selection-grid .ag-header-cell[aria-colindex="1"],
          .plan-selection-grid .ag-header-cell.ag-selection-checkbox-header {
            justify-content: flex-start;
            padding-left: 1.4rem;
          }
        `}</style>
        <AgGridReact
          {...planGridColumnStateProps}
          ref={gridRef}
          rowData={rows}
          getRowId={getRowId}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getContextMenuItems={gridFilterContextMenuItems}
          suppressMovableColumns={true}
          ensureDomOrder={true}
          onSelectionChanged={handleSelectionChanged}
          // 支払申請一覧参照のチェックボックス列と同一設定
          rowSelection={{
            mode: 'multiRow',
            checkboxes: true,
            headerCheckbox: true,
            enableClickSelection: false,
          }}
          selectionColumnDef={{
            width: 40,
            resizable: false,
            suppressMovable: true,
            suppressHeaderMenuButton: true,
          }}
          statusBar={GRID_STATUS_BAR}
          {...GRID_BASE_PROPS}
        />
      </div>
    </div>
  );
}

import { toast } from 'sonner';
import { Check, Plus, Search } from 'lucide-react';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  GetRowIdParams,
  RowDoubleClickedEvent,
  GridReadyEvent,
} from 'ag-grid-community';

import { SearchRangeField } from '@/components/ui/search-range-field';
import { CopyableArea } from '@/components/ui/copyable-area';
import {
  MultiCombobox,
  type MultiComboboxOption,
} from '@/components/ui/multi-combobox';
import {
  useOrgCascadeSearch,
  toOrgComboOptions,
} from '@/components/ui/use-org-cascade-search';
import type { OrgCascadeConfig } from '@/utils/common/orgCascade';
import type { OrgLevel } from '@/types/organization';
import {
  BUTTON_STYLES,
  BUTTON_BASE,
  SEARCH_GRID_CLASS,
  SEARCH_LABEL_CLASS,
} from '@/styles/commonStyles';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { SearchClearButton } from '@/components/ui/search-clear-button';
import {
  buildSearchSummary,
  formatSummaryRange,
  formatSummaryValues,
} from '@/components/ui/search-summary';
import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_MASTER_DETAIL_ICONS,
  GRID_BASE_PROPS,
  withHeaderTooltips,
} from '@/components/grid';
import { ScreenTitle } from '@/components/ui/screen-title';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAppNavigation } from '@/components/ui/use-app-navigation';
import { generateSampleData } from '@/mocks/sales-plan/plan-list';
import { VENDING_PATTERN } from './constants';
import type { SalesPlanData, StoreDetail } from './planList.types';
import { usePlanListGridExtras } from './usePlanListGridExtras';
import { buildPlanListColumnDefs } from './utilsColumns';

// 検索条件のステータス・チャネルの選択肢（未選択＝条件なし。「全て」は持たない）
const STATUS_OPTIONS: MultiComboboxOption[] = [
  '未申請',
  '承認待ち',
  '差戻し',
  '承認済み',
  '確定',
  '未承認確定',
].map((v) => ({ value: v, label: v }));
const CHANNEL_OPTIONS: MultiComboboxOption[] = [
  { value: 'national-sm', label: '全国/SM' },
  { value: 'national-dgs', label: '全国/Dgs' },
  { value: 'national-cvs', label: '全国CVS' },
  { value: 'managed-cvs', label: '管理CVS' },
  { value: 'national-mailorder', label: '全国/通販' },
  { value: 'other', label: 'その他販売店' },
];
// 組織項目の連動フィルタリング（事業場→部署→末端組織→作成者）
const ORG_CASCADE_CONFIG: OrgCascadeConfig = {
  levels: ['office', 'department', 'terminalOrg', 'salesRep'],
  labels: {
    office: '事業場',
    department: '部署',
    terminalOrg: '末端組織',
    salesRep: '作成者',
  },
  units: { salesRep: '名' },
};

// 行ID（→ 画面設計標準 4.7）。いずれも一意かつ編集しない値を使う。
//  ・計画一覧／商品販売計画登録：行データの id
//  ・計画一覧の展開行（三次店・一次店の組み合わせ）：同じ計画内で重複しない三次店
const getPlanRowId = (params: GetRowIdParams<SalesPlanData>) => params.data.id;
const getStoreDetailRowId = (params: GetRowIdParams<StoreDetail>) =>
  params.data.tertiaryStore;

interface PlanListProps {
  // true の場合、作成パターンフィルターを「自販機」のみに設定して表示する（自販機モード）
  jihanki?: boolean;
}

// 一括承認の対象となるステータス。この行だけチェックボックスを活性にする。
const BULK_APPROVAL_TARGET_STATUS = '承認待ち';

// 一括承認の対象行か（チェックボックスの活性／非活性の判定に共用）
const isBulkApprovalTarget = (data?: SalesPlanData): boolean =>
  data?.status === BULK_APPROVAL_TARGET_STATUS;

export default function PlanList({ jihanki = false }: PlanListProps) {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // AG Grid参照
  const gridRef = useRef<any>(null);
  // 右クリックのフィルタ解除・セルのコピーのボタン（試作 → ./usePlanListGridExtras）
  const gridExtras = usePlanListGridExtras(jihanki);

  // 作成パターンフィルターを jihanki に応じて設定する。
  // ・jihanki=true ：Set Filter を「自販機」のみに設定
  // ・jihanki=false／未指定：作成パターンフィルターを解除（全件表示）
  const applyJihankiFilter = useCallback(
    (api: GridReadyEvent['api']) => {
      if (jihanki) {
        api
          .setColumnFilterModel('tradeSystem', {
            filterType: 'set',
            values: [VENDING_PATTERN],
          })
          .then(() => api.onFilterChanged());
      } else {
        api
          .setColumnFilterModel('tradeSystem', null)
          .then(() => api.onFilterChanged());
      }
    },
    [jihanki]
  );

  // jihanki の変化（マウント後の切替）にも追従してフィルターを再適用する。
  useEffect(() => {
    const api = gridRef.current?.api;
    if (api) applyJihankiFilter(api);
  }, [applyJihankiFilter]);

  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）。
  // 返り値を <AgGridReact> に spread するだけで永続化が有効になる。
  // ※三次店企業カラム追加に伴い、旧保存状態（列順）を無効化するためキーを v2 へ更新。
  // ※実績登録ボタン追加に伴うボタン列の幅再調整のため v3 へ更新。
  // ※ボタン名称短縮（計画／実績）に伴うボタン列の幅再調整のため v4 へ更新。
  // ※実績登録(アライアンス品)・実績登録(アライアンス品以外)カラム追加に伴い v5 へ更新。
  // ※末端組織カラム追加・担当エリアの列位置変更に伴い v6 へ更新。
  // ※詳細ボタン列の廃止・計画書番号／実績番号のリンク列の追加に伴い v7 へ更新。
  // ※列のグループ（基本情報・得意先・組織・手売り・自販機）とコードの列の追加に伴い v8 へ更新（UX-116）。
  // ※計画一覧と実績一覧で同じキーを使い、個人設定を別々に保持しない（決定事項No.767）。
  // ※ onGridReady はフック側が返すため、画面独自の初期処理（jihanki フィルター適用）は
  //   options.onGridReady で渡す（列状態復元の後に連結実行される）。
  const gridColumnStateProps = useGridColumnState(
    'salesPlanList.columnState.v8',
    {
      onGridReady: (event) => applyJihankiFilter(event.api),
    }
  );

  // 検索条件の状態管理
  const [targetYearMonthStart, setTargetYearMonthStart] = useState('2026/01');
  const [targetYearMonthEnd, setTargetYearMonthEnd] = useState('2026/12');
  // ステータス・チャネルは複数選択（未選択＝条件なし）
  const [status, setStatus] = useState<string[]>([]);
  const [channel, setChannel] = useState<string[]>([]);
  // 組織項目（事業場→部署→末端組織→作成者）は連動フィルタリングする（→ utils/common/orgCascade.ts）。
  // 末端組織＝採算組織第6階層。初期値はログインユーザーの所属・本人
  const org = useOrgCascadeSearch(ORG_CASCADE_CONFIG, {
    office: ['hokkaido'],
    department: ['hokkaido-sales-1'],
    terminalOrg: ['sapporo-1'],
    salesRep: ['yamada-taro'],
  });

  // 検索条件の複数選択の項目（ラベル＋マルチコンボボックス）
  const renderMultiField = (
    id: string,
    label: string,
    options: MultiComboboxOption[],
    value: string[],
    onChange: (value: string[]) => void,
    unit?: string
  ) => (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className={SEARCH_LABEL_CLASS}>
        {label}
      </label>
      <MultiCombobox
        id={id}
        className="flex-1"
        options={options}
        value={value}
        onChange={onChange}
        unit={unit}
      />
    </div>
  );
  // 組織項目（選択肢は上位の選択値で絞り込み、選ぶと上位へ自動で追加する）
  const renderOrgField = (id: string, level: OrgLevel) =>
    renderMultiField(
      id,
      ORG_CASCADE_CONFIG.labels[level] ?? '',
      toOrgComboOptions(org.options(level), 'codeName'),
      org.values(level),
      (v) => org.change(level, v),
      ORG_CASCADE_CONFIG.units?.[level]
    );

  // 一括承認機能の状態管理
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isBulkApprovalDialogOpen, setIsBulkApprovalDialogOpen] =
    useState(false);

  const [rowData] = useState<SalesPlanData[]>(generateSampleData);

  // 検索条件をクリア（決定事項No.774・No.783）。
  // 対象年月を含む全ての検索条件をクリアする（選択肢のある項目は未選択＝指定なし、対象年月は空欄）。
  // 初期値（ログインユーザーの所属・本人等）には戻さない。グリッドの列フィルタ・ソートには作用させない。
  // 検索条件カードを折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）
  const searchSummary = buildSearchSummary([
    {
      label: '対象年月',
      value: formatSummaryRange(targetYearMonthStart, targetYearMonthEnd),
    },
    { label: 'ステータス', value: formatSummaryValues(status, STATUS_OPTIONS) },
    { label: 'チャネル', value: formatSummaryValues(channel, CHANNEL_OPTIONS) },
    ...org.summaryItems('codeName'),
  ]);

  const handleClear = () => {
    setTargetYearMonthStart('');
    setTargetYearMonthEnd('');
    setStatus([]);
    setChannel([]);
    org.reset();
  };

  // 行データから遷移先メニューIDを決定する
  const resolveMenuTarget = (data: SalesPlanData): string => {
    // 作成パターンが自販機の場合は計画詳細（自販機）画面へ遷移
    if (data.tradeSystem === VENDING_PATTERN) return 'plan-detail-vending';
    // 作成パターンがNET固定の場合は販売計画表(NET固定)画面へ遷移
    if (data.tradeSystem === 'NET固定') return 'plan-detail-net-fixed';
    // 作成パターンが「商流販売店に紐づかない」の場合は販売計画表(商流紐づけなし)画面へ遷移
    if (data.tradeSystem === '商流販売店に紐づかない')
      return 'promotion-cost-plan-unlinked';
    // それ以外（マージン率固定／NET入力）は販売計画表(マージン率固定・NET入力)へ遷移
    return 'plan-detail-margin-rate-fixed';
  };

  // 計画書番号のリンク押下時：作成パターンに応じた計画詳細画面へ遷移
  const handleSelect = (data: SalesPlanData) => {
    navigate(resolveMenuTarget(data));
  };

  // 実績番号のリンク押下時：販売実績詳細画面へ遷移
  const handleActualResults = () => {
    navigate('sales-actual-detail');
  };

  // 行をどこでもダブルクリックすると該当の計画詳細画面へ遷移
  // （計画書番号のリンクと同じ。計画一覧・実績一覧のどちらから開いても同じ遷移先：決定事項No.768）
  const handleRowDoubleClicked = (
    event: RowDoubleClickedEvent<SalesPlanData>
  ) => {
    if (event.data) {
      navigate(resolveMenuTarget(event.data));
    }
  };

  // 一括承認ボタンクリック処理
  const handleBulkApproval = () => {
    setIsBulkApprovalDialogOpen(true);
  };

  // 一括承認実行処理
  const handleConfirmBulkApproval = () => {
    setIsBulkApprovalDialogOpen(false);
    // 処理した件数を完了トーストで知らせる（画面設計標準 4.2 ⑦。完了はモーダルにしない → 3.6）
    const approvedCount = selectedRows.size;
    // AG Gridの選択を解除
    if (gridRef.current) {
      gridRef.current.api.deselectAll();
    }
    setSelectedRows(new Set());
    toast.success(`${approvedCount}件の一括承認が完了しました。`);
  };

  // Master Detail用の設定
  const detailCellRendererParams = useMemo(
    () => ({
      detailGridOptions: {
        columnDefs: [
          {
            headerName: '三次店',
            field: 'tertiaryStore',
            flex: 1,
            cellClass: 'cell-left',
          },
          {
            headerName: '一次店',
            field: 'primaryStore',
            flex: 1,
            cellClass: 'cell-left',
          },
        ],
        defaultColDef: {
          resizable: true,
        },
        getRowId: getStoreDetailRowId,
        domLayout: 'autoHeight',
      },
      getDetailRowData: (params: any) => {
        // 全ての組み合わせ（代表含む全件）を表示
        if (params.data.storeDetails && params.data.storeDetails.length > 1) {
          params.successCallback(params.data.storeDetails);
        } else {
          params.successCallback([]);
        }
      },
    }),
    []
  );

  // 複数の三次店・一次店組み合わせがある場合のみ展開可能にする
  const isRowMaster = useCallback((dataItem: SalesPlanData) => {
    return !!dataItem.storeDetails && dataItem.storeDetails.length > 1;
  }, []);

  // AG Grid列定義（→ ./utilsColumns）。リンクの遷移先は計画一覧・実績一覧で同じ（決定事項No.768）
  const columnDefs = useMemo(
    () =>
      buildPlanListColumnDefs({
        onPlanClick: handleSelect,
        onActualClick: handleActualResults,
      }),
    // 遷移は navigate だけに依存する（jihanki には依存しない）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義の再作成を抑止するため）
    [navigate]
  );

  // ヘッダーが省略表示された場合にマウスオーバーで全文表示するため、
  // 各列に headerTooltip（=headerName）を付与する（共通ヘルパー・grid/）
  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  return (
    // ページ自体はスクロールさせず、下端の計画一覧カード内のグリッドだけをスクロールさせる。
    // 高さの固定値をやめて「タイトル・検索条件を引いた残り」をグリッドへ割り当て、
    // 横スクロールバーが画面外へ押し出されないようにする（支払一覧と同じ構成）。
    // 画面が低く下限 23.75rem を割り込む場合は、はみ出した分だけメイン領域側がスクロールする。
    <div className="min-w-300 h-full flex flex-col">
      <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title={jihanki ? '実績一覧' : '計画一覧'} />

        {/* 検索条件カード（計画詳細と同じ折り畳みカードで開閉可能にする） */}
        {/* 検索条件の値は Ctrl+C／右クリック「コピー」で表示中の値をコピーできる（CopyableArea → 02 §15） */}
        <CopyableArea className="shrink-0">
          <CollapsibleCard
            title={
              <span className="flex items-center gap-2">
                <Search className="h-5 w-5 text-gray-700" />
                検索条件
              </span>
            }
            // 画面が低くてもグリッドに押しつぶされないよう縮めない（足りない分は画面側がスクロールする）
            className="shrink-0"
            // クリアボタンはヘッダーバーに置き、専用の行を使わない（検索はリアルタイムのため検索ボタンは廃止）
            headerActions={<SearchClearButton onClick={handleClear} />}
            collapsedSummary={searchSummary}
          >
            <div className="px-4 py-1.5">
              {/* 1行目: 対象年月(開始～終了)、ステータス（5列グリッドで整列） */}
              <div className={`${SEARCH_GRID_CLASS} mb-2.5`}>
                {/* 対象年月（開始～終了）: 開始～終了をセットで1項目分に置く（共通部品 SearchRangeField・部品は compact → 05） */}
                <SearchRangeField
                  label="対象年月"
                  groupLabel="検索対象年月の範囲"
                  start={
                    <MonthYearPicker
                      className="w-full"
                      compact
                      value={targetYearMonthStart}
                      onChange={setTargetYearMonthStart}
                      required={false}
                      max={targetYearMonthEnd || undefined}
                      clearable
                    />
                  }
                  end={
                    <MonthYearPicker
                      className="w-full"
                      compact
                      value={targetYearMonthEnd}
                      onChange={setTargetYearMonthEnd}
                      required={false}
                      min={targetYearMonthStart || undefined}
                      clearable
                    />
                  }
                />

                {renderMultiField(
                  'salesPlanStatus',
                  'ステータス',
                  STATUS_OPTIONS,
                  status,
                  setStatus
                )}
              </div>

              {/* 2行目: チャネル、事業場、部署、末端組織、作成者（5列グリッドで整列。
                  組織系は 事業場→部署→末端組織→作成者 の階層順に並べる） */}
              <div className={SEARCH_GRID_CLASS}>
                {renderMultiField(
                  'salesPlanChannel',
                  'チャネル',
                  CHANNEL_OPTIONS,
                  channel,
                  setChannel
                )}
                {renderOrgField('salesPlanOffice', 'office')}
                {renderOrgField('salesPlanDepartment', 'department')}
                {renderOrgField('salesPlanTerminalOrg', 'terminalOrg')}
                {renderOrgField('salesPlanSalesRep', 'salesRep')}
              </div>
            </div>
          </CollapsibleCard>
        </CopyableArea>

        {/* 計画一覧テーブル（計画詳細と同じ折り畳みカード）。
            計画追加ボタンはヘッダーバー（headerActions）、一括承認はタイトルのすぐ右（titleActions）へ配置。
            jihanki（実績登録モード）ではボタンを出さず、ヘッダー全体が開閉トリガーになる。
            タイトルも jihanki=true では「販売実績一覧」を表示する。
            fillParent でページの余り高さいっぱいまで広げ、折り畳み時は下限を外してヘッダーのみの高さへ戻す。 */}
        <CollapsibleCard
          title={jihanki ? '実績一覧' : '計画一覧'}
          fillParent
          className="data-[state=open]:min-h-95"
          // 一括承認はグリッドのチェックボックスと連動するため、タイトルのすぐ右に置く
          titleActions={
            !jihanki && (
              <button
                onClick={handleBulkApproval}
                disabled={selectedRows.size === 0}
                className={`flex items-center gap-1 px-2 py-1 whitespace-nowrap text-sm ${BUTTON_BASE} ${
                  selectedRows.size === 0
                    ? BUTTON_STYLES.disabled
                    : BUTTON_STYLES.approve
                }`}
                aria-label="一括承認"
              >
                <Check className="h-4 w-4" />
                一括承認
              </button>
            )
          }
          headerActions={
            !jihanki && (
              <>
                <button
                  onClick={() => navigate('promotion-cost-plan-unlinked')}
                  className={`flex items-center gap-1 px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none whitespace-nowrap text-sm ${BUTTON_STYLES.outline} ${BUTTON_BASE}`}
                  aria-label="商流販売店紐づけなし計画追加"
                >
                  <Plus className="h-4 w-4" />
                  商流販売店紐づけなし計画追加
                </button>
              </>
            )
          }
          contentClassName="p-2 flex flex-col flex-1 min-h-0"
        >
          {/* 当グリッド専用スタイル：ヘッダーの全選択チェックボックスの位置、明細行の背景 */}
          <style>{`
            /* 全選択のチェックボックスは、明細のチェックボックスと縦にそろうよう
               列の中央に置く（明細側は grid.css で中央配置）。grid.css の
               「ヘッダーチェックボックス - 左寄せ配置」を、全選択があるセルだけ上書きする
               （実績一覧のようにチェックボックス列が無いときの先頭列の見出しは変えない）。 */
            .sales-plan-list-grid .ag-header-cell[aria-colindex="1"]:has(.ag-header-select-all) {
              justify-content: center;
              padding: 0;
            }
            /* 見出し文字の枠（空）と全選択の空ラベルが幅を取り、チェックボックスが左に寄るため隠す */
            .sales-plan-list-grid .ag-header-cell[aria-colindex="1"]:has(.ag-header-select-all) .ag-header-cell-comp-wrapper,
            .sales-plan-list-grid .ag-header-select-all .ag-checkbox-label {
              display: none;
            }
            /* 全選択の部品自体はセル幅いっぱいに広がるため、その中でチェックボックスを中央に置く */
            .sales-plan-list-grid .ag-header-cell[aria-colindex="1"]:has(.ag-header-select-all) .ag-header-select-all {
              justify-content: center;
            }
            .sales-plan-list-grid .ag-details-row {
              background-color: var(--grid-detail-row-bg);
            }
            .sales-plan-list-grid .ag-details-grid .ag-cell {
              padding-left: 0.5rem;
            }
            /* headerClass="header-wrap-pre-line" を付けた列のヘッダーを、
               headerName の \\n の位置で改行して表示する
               （既定の white-space: nowrap では \\n が空白として扱われ改行されない）。
               行高はグローバルCSSの line-height: 2rem を上書きして詰める。 */
            .sales-plan-list-grid .header-wrap-pre-line .ag-header-cell-text {
              white-space: pre-line;
              line-height: 1.3;
            }
          `}</style>
          {/* グリッドはカード内の残り高さを埋める（min-h-0 が無いと flex 子要素が縮まない） */}
          <div className="sales-plan-list-grid flex-1 min-h-0 w-full">
            <AgGridReact<SalesPlanData>
              ref={gridRef}
              rowData={rowData}
              columnDefs={columnDefsWithTooltip}
              defaultColDef={GRID_DEFAULT_COL_DEF}
              getRowId={getPlanRowId}
              domLayout="normal"
              animateRows={true}
              // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
              {...GRID_BASE_PROPS}
              rowSelection={{
                mode: 'multiRow',
                // jihanki（実績登録モード）ではチェックボックスを非表示にする
                checkboxes: !jihanki,
                headerCheckbox: !jihanki,
                enableClickSelection: false,
                // 一括承認の対象はステータスが「承認待ち」の行のみ。
                // それ以外の行はチェックボックスを非活性にする。
                isRowSelectable: (node) => isBulkApprovalTarget(node.data),
              }}
              // 列の固定はシステム側でしない（ユーザーに委ねる。10/20手売りセッション）
              selectionColumnDef={{
                width: 40,
                resizable: false,
                suppressMovable: true,
                suppressHeaderMenuButton: true,
                // 選択できない行はセル全体を灰色で塗りつぶす（配色は grid.css）
                cellClass: (params) =>
                  isBulkApprovalTarget(params.data)
                    ? undefined
                    : 'cell-selection-disabled',
              }}
              onSelectionChanged={(event) =>
                setSelectedRows(
                  new Set(
                    event.api.getSelectedNodes().map((n) => n.data?.id || '')
                  )
                )
              }
              onRowDoubleClicked={handleRowDoubleClicked}
              masterDetail={true}
              // 開閉アイコンは閉じている時∨・開いている時∧（折り畳みカードと統一）
              icons={GRID_MASTER_DETAIL_ICONS}
              detailCellRendererParams={detailCellRendererParams}
              isRowMaster={isRowMaster}
              detailRowAutoHeight={true}
              // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
              {...gridColumnStateProps}
              statusBar={GRID_STATUS_BAR}
              {...gridExtras.gridProps}
            />
            {gridExtras.overlay}
          </div>
        </CollapsibleCard>
      </div>

      {/* 一括承認確認ダイアログ */}
      <ConfirmDialog
        open={isBulkApprovalDialogOpen}
        onOpenChange={setIsBulkApprovalDialogOpen}
        title="確認"
        description={
          <>
            選択された{selectedRows.size}
            件の販売計画を一括承認しますか？
          </>
        }
        confirmLabel="一括承認"
        onConfirm={handleConfirmBulkApproval}
      />
    </div>
  );
}

import { FileText, CheckCircle, Search } from 'lucide-react';
import { useState, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GetRowIdParams,
  RowDoubleClickedEvent,
} from 'ag-grid-community';

import { SearchRangeField } from '../../ui/search-range-field';
import { CopyableArea } from '../../ui/copyable-area';
import {
  MultiCombobox,
  type MultiComboboxOption,
} from '../../ui/multi-combobox';
import {
  useOrgCascadeSearch,
  toOrgComboOptions,
} from '../../ui/use-org-cascade-search';
import type { OrgCascadeConfig } from '../../../utils/common/orgCascade';
import {
  SEARCH_GRID_CLASS,
  SEARCH_LABEL_CLASS,
} from '../../../../styles/commonStyles';
import { MonthYearPicker } from '../../ui/month-year-picker';
import { CollapsibleCard } from '../../ui/collapsible-card';
import { SearchClearButton } from '../../ui/search-clear-button';
import {
  buildSearchSummary,
  formatSummaryRange,
  formatSummaryValues,
} from '../../ui/search-summary';
import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  GRID_EMPTY_TEXT,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_MONTH_TEXT_FILTER,
} from '../../grid';
import { ScreenTitle } from '../../ui/screen-title';

interface SalesPlanData {
  id: string;
  targetMonth: string;
  monthlyPlanNo: string;
  applicationStatus: string;
  status: string;
  channel: string;
  area: string;
  officeCode: string;
  office: string;
  retailerCode: string;
  retailer: string;
  tertiaryStoreCode: string;
  tertiaryStore: string;
  primaryStoreCode: string;
  primaryStore: string;
  departmentCode: string;
  department: string;
  salesRepCode: string;
  salesRep: string;
  tradeSystem: string;
}

// 行ID（→ 画面設計標準 4.7）。計画一覧・商品販売計画登録とも行データの id（一意・編集しない）を使う
const getPlanRowId = (params: GetRowIdParams<SalesPlanData>) => params.data.id;

interface ManagedProductPlanListProps {
  onMenuChange?: (menuId: string) => void;
  onSelectPlan?: (data: SalesPlanData) => void;
}

// 検索条件の組織項目の値と一覧データのコードの対応（value＝検索条件の値／code・name＝一覧データのコード・名称）。
// 検索条件の選択肢は組織階層マスタ（constants/orgHierarchy.ts）から作り、一覧の絞り込みは本定義のコードで照合する。
// 本定義に無い値（マスタにだけある値）は、どの行にも一致しない。
interface SearchOption {
  value: string;
  code: string;
  name: string;
}

const OFFICE_OPTIONS: SearchOption[] = [
  { value: 'hokkaido', code: 'HK01-01', name: '北海道支社' },
  { value: 'tohoku', code: 'TH01-01', name: '東北支社' },
  { value: 'shutoken', code: 'MF01-01', name: '首都圏支社' },
  { value: 'kinki', code: 'KK01-01', name: '近畿圏支社' },
  { value: 'shikoku', code: 'SK01-01', name: '四国支社' },
  { value: 'kyushu', code: 'KS01-01', name: '九州支社' },
];

const DEPARTMENT_OPTIONS: SearchOption[] = [
  { value: 'hokkaido-sales-1', code: 'D1101', name: '北海道営業一部' },
  { value: 'tohoku-sales-1', code: 'D1201', name: '東北営業一部' },
  { value: 'shutoken-sales-1', code: 'D1301', name: '首都圏営業一部' },
  { value: 'kinki-sales-1', code: 'D1401', name: '近畿圏営業一部' },
  { value: 'shikoku-sales-1', code: 'D1501', name: '四国営業一部' },
  { value: 'kyushu-sales-1', code: 'D1601', name: '九州営業一部' },
];

const SALES_REP_OPTIONS: SearchOption[] = [
  { value: 'yamada-taro', code: 'E00101', name: '山田 太郎' },
  { value: 'sato-hanako', code: 'E00102', name: '佐藤 花子' },
  { value: 'suzuki-ichiro', code: 'E00103', name: '鈴木 一郎' },
  { value: 'tanaka-misaki', code: 'E00104', name: '田中 美咲' },
  { value: 'takahashi-kenta', code: 'E00105', name: '高橋 健太' },
];

// 検索条件の値 → 照合用のコード（該当なしは undefined）
const findOptionCode = (
  options: SearchOption[],
  value: string
): string | undefined => options.find((o) => o.value === value)?.code;

// 組織項目の絞り込み：未選択＝条件なし。複数選択はいずれかのコードに一致すれば対象
const matchesOrgCode = (
  options: SearchOption[],
  selected: string[],
  rowCode: string
): boolean =>
  selected.length === 0 ||
  selected.some((v) => findOptionCode(options, v) === rowCode);

// 検索条件のステータスの選択肢（未選択＝条件なし。「全て」「ー」は持たない）
const STATUS_OPTIONS: MultiComboboxOption[] = ['登録', '未登録'].map((v) => ({
  value: v,
  label: v,
}));

// 未選択を表す空配列（参照を固定する）
const NO_SELECTION: string[] = [];

// 組織項目の連動フィルタリング（事業場→部署→作成者。末端組織は持たない）
const ORG_CASCADE_CONFIG: OrgCascadeConfig = {
  levels: ['office', 'department', 'salesRep'],
  labels: { office: '事業場', department: '部署', salesRep: '作成者' },
};

// 文字列のデータ列のセルの寄せ。先頭列は grid.css で中央寄せが強制されるため、
// 列を移動してどの列が先頭になっても ag-cell-left で左寄せに戻す
const DATA_CELL_CLASS = ['cell-left', 'ag-cell-left'];

// ステータスごとのアイコン・色設定（販売計画一覧参照と同じ方式）
const STATUS_CONFIG: Record<
  string,
  { icon: typeof FileText; className: string }
> = {
  登録: { icon: CheckCircle, className: 'text-green-600' },
  未登録: { icon: FileText, className: 'text-gray-400' },
};

export default function ManagedProductPlanList({
  onMenuChange,
  onSelectPlan,
}: ManagedProductPlanListProps) {
  // AG Grid参照
  const gridRef = useRef<any>(null);

  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
  // ※flex指定による全幅フィット化に伴い、旧保存幅を無効化するためキーを v2 へ更新。
  // ※コード列（販売店/事業場/三次店/一次店/部署/作成者）追加に伴い v3 へ更新
  //   （旧保存状態のままだと新列が末尾に回るため）。
  // ※商品販売計画No を対象年月の右へ移動したため v4 へ更新
  //   （旧保存状態のままだと移動前の並び順で復元されるため）。
  // ※詳細ボタン列の廃止・商品販売計画Noのリンク化・列の並び順変更に伴い v5 へ更新。
  const gridColumnStateProps = useGridColumnState(
    'productSalesPlanList.columnState.v5'
  );

  const [targetYearMonthStart, setTargetYearMonthStart] = useState('2026/01');
  const [targetYearMonthEnd, setTargetYearMonthEnd] = useState('2026/12');
  // ステータスは複数選択（未選択＝条件なし）
  const [status, setStatus] = useState<string[]>([]);
  // 組織項目（事業場→部署→作成者）は連動フィルタリングする（→ utils/common/orgCascade.ts）
  // 初期値はログインユーザーの所属・本人（上位の配下にない値は「コード:名称」で表示できないため階層をそろえる）
  const org = useOrgCascadeSearch(ORG_CASCADE_CONFIG, {
    office: ['hokkaido'],
    department: ['hokkaido-sales-1'],
    salesRep: ['yamada-taro'],
  });
  // 未選択時も同じ配列を返し、一覧の絞り込み（useMemo）を毎回やり直さないようにする
  const stableValues = (values: string[]) =>
    values.length === 0 ? NO_SELECTION : values;
  const office = stableValues(org.values('office'));
  const department = stableValues(org.values('department'));
  const salesRep = stableValues(org.values('salesRep'));

  const generateSampleData = (): SalesPlanData[] => {
    const data: SalesPlanData[] = [];
    const applicationStatuses = [
      '未登録',
      '未申請',
      '部支店長承認待ち',
      '承認済',
    ];
    const statuses = ['登録', '未登録'];
    const channels = ['-'];
    const areas = ['-'];
    // 事業場・部署・作成者のコード／名称は検索条件の選択肢（*_OPTIONS）と揃える
    const offices = ['北海道支社', '首都圏支社', '東北支社', '近畿圏支社'];
    // 各コードは名称配列と同じ並び（同じインデックスで名称と対応させる）
    const officeCodes = ['HK01-01', 'MF01-01', 'TH01-01', 'KK01-01'];
    const retailers = [
      'セブン-イレブン',
      'ファミリーマート',
      'ローソン',
      'イオン',
    ];
    const retailerCodes = ['30200740', '30200741', '30200742', '30200743'];
    const tertiaryStores = [
      '国分北海道株式会社経営FC',
      '三菱食品株式会社広島FC',
      '伊藤忠食品株式会社東北支社',
      '日本アクセス株式会社首都圏支社',
    ];
    const tertiaryStoreCodes = ['10754882', '10754883', '10754884', '10754885'];
    const primaryStores = [
      '国分6社通販',
      '三菱食品株式会社北見営業所',
      '伊藤忠食品札幌支店',
      '日本アクセス仙台営業所',
    ];
    const primaryStoreCodes = ['10010075', '10010076', '10010077', '10010078'];
    const departments = [
      '北海道営業一部',
      '東北営業一部',
      '首都圏営業一部',
      '近畿圏営業一部',
      '四国営業一部',
      '九州営業一部',
    ];
    const departmentCodes = [
      'D1101',
      'D1201',
      'D1301',
      'D1401',
      'D1501',
      'D1601',
    ];
    const salesReps = [
      '山田 太郎',
      '佐藤 花子',
      '鈴木 一郎',
      '田中 美咲',
      '高橋 健太',
    ];
    const salesRepCodes = ['E00101', 'E00102', 'E00103', 'E00104', 'E00105'];
    const tradeSystems = ['オペ'];

    const generateRandomMonth = (): string => {
      const year = 2026;
      const month = Math.floor(Math.random() * 15) + 1;
      if (month <= 12) {
        return `${year}${String(month).padStart(2, '0')}`;
      } else {
        return `2027${String(month - 12).padStart(2, '0')}`;
      }
    };

    const generateRandomPlanNo = (): string => {
      const randomNum = Math.floor(Math.random() * 900000) + 100000;
      return `A26${randomNum}`;
    };

    for (let i = 1; i <= 100; i++) {
      data.push({
        id: String(i),
        targetMonth: generateRandomMonth(),
        monthlyPlanNo: generateRandomPlanNo(),
        applicationStatus: applicationStatuses[i % applicationStatuses.length],
        status: statuses[i % statuses.length],
        channel: channels[i % channels.length],
        area: areas[i % areas.length],
        officeCode: officeCodes[i % officeCodes.length],
        office: offices[i % offices.length],
        retailerCode: retailerCodes[i % retailerCodes.length],
        retailer: retailers[i % retailers.length],
        tertiaryStoreCode: tertiaryStoreCodes[i % tertiaryStoreCodes.length],
        tertiaryStore: tertiaryStores[i % tertiaryStores.length],
        primaryStoreCode: primaryStoreCodes[i % primaryStoreCodes.length],
        primaryStore: primaryStores[i % primaryStores.length],
        departmentCode: departmentCodes[i % departmentCodes.length],
        department: departments[i % departments.length],
        salesRepCode: salesRepCodes[i % salesRepCodes.length],
        salesRep: salesReps[i % salesReps.length],
        tradeSystem: tradeSystems[i % tradeSystems.length],
      });
    }
    // 検索条件の初期値（北海道支社・北海道営業一部・山田 太郎、対象年月2026/01〜2026/12）に
    // 必ず一致するダミー行。初期表示で明細が0件にならないよう、対象年月を固定する
    const initialConditionRows: SalesPlanData[] = [
      { targetMonth: '202604', status: '登録', storeIndex: 0 },
      { targetMonth: '202605', status: '未登録', storeIndex: 1 },
    ].map(({ targetMonth, status: rowStatus, storeIndex }, index) => ({
      id: `initial-${index + 1}`,
      targetMonth,
      monthlyPlanNo: generateRandomPlanNo(),
      applicationStatus: applicationStatuses[0],
      status: rowStatus,
      channel: channels[0],
      area: areas[0],
      officeCode: officeCodes[0],
      office: offices[0],
      retailerCode: retailerCodes[storeIndex],
      retailer: retailers[storeIndex],
      tertiaryStoreCode: tertiaryStoreCodes[storeIndex],
      tertiaryStore: tertiaryStores[storeIndex],
      primaryStoreCode: primaryStoreCodes[storeIndex],
      primaryStore: primaryStores[storeIndex],
      departmentCode: departmentCodes[0],
      department: departments[0],
      salesRepCode: salesRepCodes[0],
      salesRep: salesReps[0],
      tradeSystem: tradeSystems[0],
    }));
    return [...initialConditionRows, ...data];
  };

  const [rowData] = useState<SalesPlanData[]>(generateSampleData());

  // 検索条件で絞り込んだ一覧。検索ボタンは持たず、条件を変えた時点で
  // リアルタイムに反映する（管理対象商品一覧(マスタ)と同じ方式）。
  const filteredData = useMemo(() => {
    // 対象年月は 'YYYY/MM'、データは 'YYYYMM' のため区切りを外して比較する
    const searchStart = targetYearMonthStart.replace('/', '');
    const searchEnd = targetYearMonthEnd.replace('/', '');

    return rowData.filter((row) => {
      // 対象年月（開始～終了。指定されている側のみ判定）
      if (searchStart && row.targetMonth < searchStart) return false;
      if (searchEnd && row.targetMonth > searchEnd) return false;

      // ステータス
      if (status.length > 0 && !status.includes(row.status)) return false;

      // 事業場・部署・作成者（いずれかの選択値に一致すれば対象）
      if (!matchesOrgCode(OFFICE_OPTIONS, office, row.officeCode)) {
        return false;
      }
      if (!matchesOrgCode(DEPARTMENT_OPTIONS, department, row.departmentCode)) {
        return false;
      }
      if (!matchesOrgCode(SALES_REP_OPTIONS, salesRep, row.salesRepCode)) {
        return false;
      }

      return true;
    });
  }, [
    rowData,
    targetYearMonthStart,
    targetYearMonthEnd,
    status,
    office,
    department,
    salesRep,
  ]);

  // 検索条件をクリア。
  // 対象年月は2026/01〜2026/12に戻す。
  // ステータス・事業場・部署・作成者は未選択（指定なし）にする（決定事項No.774・No.783）
  // 検索条件カードを折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）
  const searchSummary = buildSearchSummary([
    {
      label: '対象年月',
      value: formatSummaryRange(targetYearMonthStart, targetYearMonthEnd),
    },
    { label: 'ステータス', value: formatSummaryValues(status, STATUS_OPTIONS) },
    ...org.summaryItems('codeName'),
  ]);

  const handleClear = () => {
    setTargetYearMonthStart('2026/01');
    setTargetYearMonthEnd('2026/12');
    setStatus([]);
    org.reset();
  };

  const handleSelect = (data: SalesPlanData) => {
    if (onSelectPlan) {
      onSelectPlan(data);
    }
    if (onMenuChange) {
      onMenuChange('managed-product-plan-detail');
    }
  };

  // 行をどこでもダブルクリックすると商品販売計画Noのリンクと同じ処理を実行（販売計画一覧と同挙動）
  const handleRowDoubleClicked = (
    event: RowDoubleClickedEvent<SalesPlanData>
  ) => {
    if (event.data) {
      handleSelect(event.data);
    }
  };

  // 商品販売計画Noのリンク。詳細ボタンの列は設けず、このリンクで計画詳細へ遷移する（計画一覧と同じ方式）
  const PlanNoLinkRenderer = (props: any) => {
    if (!props.value) return null;
    return (
      <button
        type="button"
        className="cursor-pointer text-blue-600 hover:underline focus:ring-2 focus:ring-blue-500 focus:outline-none"
        onClick={() => handleSelect(props.data)}
      >
        {props.value}
      </button>
    );
  };

  // ステータスセルレンダラー（アイコン＋文言・販売計画一覧参照と同じ方式）
  const StatusRenderer = (props: any) => {
    const config = STATUS_CONFIG[props.value];
    if (!config) {
      return <span className="text-gray-900">{props.value}</span>;
    }
    const Icon = config.icon;
    return (
      <div className="flex items-center gap-1">
        <Icon className={`h-5 w-5 ${config.className}`} />
        <span className="text-gray-900">{props.value}</span>
      </div>
    );
  };

  const columnDefs: ColDef<SalesPlanData>[] = useMemo(
    () => [
      // データ列は flex で残り幅を分配し、右端に空白列が出ないようにする
      {
        headerName: '商品販売計画No',
        field: 'monthlyPlanNo',
        cellRenderer: PlanNoLinkRenderer,
        flex: 1.2,
        minWidth: 112,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: '対象年月',
        field: 'targetMonth',
        ...GRID_MONTH_TEXT_FILTER,
        flex: 1,
        minWidth: 88,
        cellClass: DATA_CELL_CLASS,
        // データは 'YYYYMM'（検索条件との比較・ソート用）のまま保持し、表示のみ 'YYYY/MM' にする
        valueFormatter: (params) => {
          const value = params.value as string | undefined;
          return value && value.length === 6
            ? `${value.slice(0, 4)}/${value.slice(4)}`
            : value || GRID_EMPTY_TEXT;
        },
      },
      {
        headerName: '販売店コード',
        field: 'retailerCode',
        flex: 1,
        minWidth: 96,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: '販売店名称',
        field: 'retailer',
        flex: 1.5,
        minWidth: 104,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: 'ステータス',
        field: 'status',
        cellRenderer: StatusRenderer,
        flex: 1,
        minWidth: 96,
        // ステータスはアイコン＋文言のため左寄せ（他の一覧画面と同じ。→ 02 §7）
        cellClass: 'cell-left',
      },
      {
        headerName: '三次店コード',
        field: 'tertiaryStoreCode',
        flex: 1,
        minWidth: 96,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: '三次店名称',
        field: 'tertiaryStore',
        flex: 2,
        minWidth: 144,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: '一次店コード',
        field: 'primaryStoreCode',
        flex: 1,
        minWidth: 96,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: '一次店名称',
        field: 'primaryStore',
        flex: 2,
        minWidth: 144,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: '事業場コード',
        field: 'officeCode',
        flex: 1,
        minWidth: 96,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: '事業場名称',
        field: 'office',
        flex: 1,
        minWidth: 88,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: '部署コード',
        field: 'departmentCode',
        flex: 1,
        minWidth: 88,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: '部署名称',
        field: 'department',
        flex: 1.3,
        minWidth: 104,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: '作成者コード',
        field: 'salesRepCode',
        flex: 1,
        minWidth: 96,
        cellClass: DATA_CELL_CLASS,
      },
      {
        headerName: '作成者名称',
        field: 'salesRep',
        flex: 1.2,
        minWidth: 96,
        cellClass: DATA_CELL_CLASS,
      },
    ],
    // リンクのレンダラーは onMenuChange を閉じ込めるため依存に含める（計画一覧と同じ）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義の再生成を抑止するため）
    [onMenuChange]
  );

  // ヘッダーが省略表示された場合にマウスオーバーで全文表示するため、
  // 各列に headerTooltip（=headerName）を付与する（共通ヘルパー・grid/）
  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  return (
    // ページ自体はスクロールさせず、下端の一覧カード内のグリッドだけをスクロールさせる。
    // 高さの固定値をやめて「タイトル・検索条件を引いた残り」をグリッドへ割り当て、
    // 横スクロールバーが画面外へ押し出されないようにする（支払一覧と同じ構成）。
    // 画面が低く下限 23.75rem を割り込む場合は、はみ出した分だけメイン領域側がスクロールする。
    <div className="min-w-300 h-full flex flex-col">
      <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="計画一覧(管理対象商品)" />

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
              {/* 1行目: 対象年月(開始～終了)、ステータス（計画一覧と同じ5列グリッドで整列 → SEARCH_GRID_CLASS） */}
              <div className={`${SEARCH_GRID_CLASS} mb-2.5`}>
                {/* 対象年月（開始～終了）: 2列分。開始は1列目・終了は2列目の入力欄の幅いっぱいに置き、「～」は2列目のラベルの位置に置く（共通部品 SearchRangeField → 05） */}
                <SearchRangeField
                  label="対象年月"
                  groupLabel="検索対象年月の範囲"
                  start={
                    <MonthYearPicker
                      className="w-full"
                      value={targetYearMonthStart}
                      onChange={setTargetYearMonthStart}
                      max={targetYearMonthEnd}
                      required={false}
                      clearable
                    />
                  }
                  end={
                    <MonthYearPicker
                      className="w-full"
                      value={targetYearMonthEnd}
                      onChange={setTargetYearMonthEnd}
                      min={targetYearMonthStart}
                      required={false}
                      clearable
                    />
                  }
                />

                {/* ステータス */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="managedPlanStatus"
                    className={SEARCH_LABEL_CLASS}
                  >
                    ステータス
                  </label>
                  <MultiCombobox
                    id="managedPlanStatus"
                    className="flex-1 min-w-0"
                    options={STATUS_OPTIONS}
                    value={status}
                    onChange={setStatus}
                  />
                </div>
              </div>

              {/* 2行目: 事業場、部署、作成者（5列グリッドで整列） */}
              <div className={SEARCH_GRID_CLASS}>
                {/* 事業場 */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="managedPlanOffice"
                    className={SEARCH_LABEL_CLASS}
                  >
                    事業場
                  </label>
                  <MultiCombobox
                    id="managedPlanOffice"
                    className="flex-1 min-w-0"
                    options={toOrgComboOptions(
                      org.options('office'),
                      'codeName'
                    )}
                    value={office}
                    onChange={(v) => org.change('office', v)}
                  />
                </div>

                {/* 部署 */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="managedPlanDepartment"
                    className={SEARCH_LABEL_CLASS}
                  >
                    部署
                  </label>
                  <MultiCombobox
                    id="managedPlanDepartment"
                    className="flex-1 min-w-0"
                    options={toOrgComboOptions(
                      org.options('department'),
                      'codeName'
                    )}
                    value={department}
                    onChange={(v) => org.change('department', v)}
                  />
                </div>

                {/* 作成者 */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="managedPlanSalesRep"
                    className={SEARCH_LABEL_CLASS}
                  >
                    作成者
                  </label>
                  <MultiCombobox
                    id="managedPlanSalesRep"
                    className="flex-1 min-w-0"
                    options={toOrgComboOptions(
                      org.options('salesRep'),
                      'codeName'
                    )}
                    value={salesRep}
                    onChange={(v) => org.change('salesRep', v)}
                    unit="名"
                  />
                </div>
              </div>
            </div>
          </CollapsibleCard>
        </CopyableArea>

        {/* 商品販売計画一覧テーブル（計画詳細と同じ折り畳みカード）。
            fillParent でページの余り高さいっぱいまで広げ、折り畳み時は下限を外してヘッダーのみの高さへ戻す。 */}
        <CollapsibleCard
          title="計画一覧(管理対象商品)"
          fillParent
          className="data-[state=open]:min-h-95"
          contentClassName="p-2 flex flex-col flex-1 min-h-0"
        >
          {/* グリッドはカード内の残り高さを埋める（min-h-0 が無いと flex 子要素が縮まない） */}
          <div className="flex-1 min-h-0 w-full">
            <AgGridReact<SalesPlanData>
              ref={gridRef}
              rowData={filteredData}
              columnDefs={columnDefsWithTooltip}
              defaultColDef={GRID_DEFAULT_COL_DEF}
              getRowId={getPlanRowId}
              getContextMenuItems={gridFilterContextMenuItems}
              domLayout="normal"
              animateRows={true}
              onRowDoubleClicked={handleRowDoubleClicked}
              // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
              {...GRID_BASE_PROPS}
              // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
              {...gridColumnStateProps}
              statusBar={GRID_STATUS_BAR}
            />
          </div>
        </CollapsibleCard>
      </div>
    </div>
  );
}

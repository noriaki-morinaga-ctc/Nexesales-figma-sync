import { toast } from 'sonner';
import {
  FileText,
  AlertCircle,
  Clock,
  Check,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Undo2,
  XIcon,
  Plus,
  Search,
} from 'lucide-react';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { CopyableArea } from '../../ui/copyable-area';
import { valueOrEmpty } from '../../ui/empty-value';
import {
  MultiCombobox,
  type MultiComboboxOption,
} from '../../ui/multi-combobox';
import {
  useOrgCascadeSearch,
  toOrgComboOptions,
} from '../../ui/use-org-cascade-search';
import type { OrgCascadeConfig } from '../../../utils/orgCascade';
import type { OrgLevel } from '../../../constants/orgHierarchy';
import { Button } from '../../ui/button';
import {
  BUTTON_STYLES,
  BUTTON_BASE,
  SEARCH_GRID_CLASS,
  SEARCH_LABEL_CLASS,
} from '../../../../styles/commonStyles';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GetRowIdParams,
  RowDoubleClickedEvent,
  GridReadyEvent,
} from 'ag-grid-community';
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
  GRID_MASTER_DETAIL_ICONS,
  GRID_BASE_PROPS,
  GRID_EMPTY_TEXT,
  GRID_COLORS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_MONTH_TEXT_FILTER,
} from '../../grid';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import { ScreenTitle } from '../../ui/screen-title';

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

interface StoreDetail {
  tertiaryStore: string;
  primaryStore: string;
}

interface SalesPlanData {
  id: string;
  targetMonth: string;
  monthlyPlanNo: string; // 計画書番号
  actualNo?: string; // 実績番号（採番されている自販機の計画だけ値を持つ）
  applicationStatus: string;
  status: string;
  channel: string;
  area: string;
  office: string;
  retailer: string;
  tertiaryStoreCompany: string; // 三次店企業（その他企業のみ値を持ち、それ以外は「ー」）
  tertiaryStore: string;
  primaryStore: string;
  department: string;
  terminalOrg: string; // 末端組織（＝採算組織第6階層。組織階層は 事業場→部署→末端組織→作成者）
  salesRep: string;
  inputProductGranularity: string; // 商品粒度
  tradeSystem: string; // 作成パターン（マージン率固定／NET入力／NET固定／自販機／商流販売店に紐づかない）
  storeDetails?: StoreDetail[]; // 三次店・一次店の組み合わせ
  isNoLink?: boolean; // 商流紐づけなし計画（計画表ボタンで商流紐づけなし画面へ遷移）
}

interface ProductPlanData {
  id: string;
  productCategory: string;
  summaryProduct: string;
  externalSales: number;
  caseUnitPrice: number;
  bottleUnitPrice: number;
  referenceProduct: string;
  referenceCases: number;
  targetCases: number;
  plannedCases: number;
  monthlyProgressRate: number;
  monthlyActual: number;
}

// 行ID（→ 画面設計標準 4.7）。いずれも一意かつ編集しない値を使う。
//  ・計画一覧／商品販売計画登録：行データの id
//  ・計画一覧の展開行（三次店・一次店の組み合わせ）：同じ計画内で重複しない三次店
const getPlanRowId = (params: GetRowIdParams<SalesPlanData>) => params.data.id;
const getProductPlanRowId = (params: GetRowIdParams<ProductPlanData>) =>
  params.data.id;
const getStoreDetailRowId = (params: GetRowIdParams<StoreDetail>) =>
  params.data.tertiaryStore;

interface PlanListProps {
  onMenuChange?: (menuId: string) => void;
  // true の場合、作成パターンフィルターを「自販機」のみに設定して表示する（自販機モード）
  jihanki?: boolean;
}

// 作成パターンの「自販機」（旧「オペ」。決定事項No.779で「自販機」に統一）
const VENDING_PATTERN = '自販機';

// ステータスごとのアイコン・色設定（支払申請一覧参照と同じ方式）
const STATUS_CONFIG: Record<
  string,
  { icon: typeof FileText; className: string }
> = {
  未申請: { icon: AlertCircle, className: 'text-orange-500' },
  承認待ち: { icon: Clock, className: 'text-blue-500' },
  // 差戻しは未申請（オレンジ）と見分けるため赤にする（UI/UX UX-011）
  差戻し: { icon: Undo2, className: 'text-red-600' },
  承認済み: { icon: CheckCircle, className: 'text-green-600' },
  確定: { icon: CheckCircle2, className: 'text-green-600' },
  未承認確定: { icon: AlertTriangle, className: 'text-yellow-600' },
};

// 一括承認の対象となるステータス。この行だけチェックボックスを活性にする。
const BULK_APPROVAL_TARGET_STATUS = '承認待ち';

// 一括承認の対象行か（チェックボックスの活性／非活性の判定に共用）
const isBulkApprovalTarget = (data?: SalesPlanData): boolean =>
  data?.status === BULK_APPROVAL_TARGET_STATUS;

// 作成パターン=自販機行の実績登録(アライアンス品)の状況を対象年月から決定する。
// 202601～202604は「登録済」、それ以外（202605以降など）は「未登録」。
const resolveHqActualStatus = (targetMonth: string): string =>
  targetMonth >= '202601' && targetMonth <= '202604' ? '登録済' : '未登録';

// 作成パターン=自販機行の実績登録(アライアンス品以外)の状況を対象年月から決定する。
// 202601～202603・202605は「登録済」、202604・202606は「未登録(一部)」、その他は「未登録」。
const resolveOpeActualStatus = (targetMonth: string): string => {
  if (targetMonth >= '202601' && targetMonth <= '202603') return '登録済';
  if (targetMonth === '202604') return '未登録(一部)';
  if (targetMonth === '202605') return '登録済';
  if (targetMonth === '202606') return '未登録(一部)';
  return '未登録';
};

export default function PlanList({
  onMenuChange,
  jihanki = false,
}: PlanListProps) {
  // AG Grid参照
  const gridRef = useRef<any>(null);

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
    if (api) {
      applyJihankiFilter(api);
    }
  }, [applyJihankiFilter]);

  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）。
  // 返り値を <AgGridReact> に spread するだけで永続化が有効になる。
  // ※三次店企業カラム追加に伴い、旧保存状態（列順）を無効化するためキーを v2 へ更新。
  // ※実績登録ボタン追加に伴うボタン列の幅再調整のため v3 へ更新。
  // ※ボタン名称短縮（計画／実績）に伴うボタン列の幅再調整のため v4 へ更新。
  // ※実績登録(アライアンス品)・実績登録(アライアンス品以外)カラム追加に伴い v5 へ更新。
  // ※末端組織カラム追加・担当エリアの列位置変更に伴い v6 へ更新。
  // ※詳細ボタン列の廃止・計画書番号／実績番号のリンク列の追加に伴い v7 へ更新。
  // ※計画一覧と実績一覧で同じキーを使い、個人設定を別々に保持しない（決定事項No.767）。
  // ※ onGridReady はフック側が返すため、画面独自の初期処理（jihanki フィルター適用）は
  //   options.onGridReady で渡す（列状態復元の後に連結実行される）。
  const gridColumnStateProps = useGridColumnState(
    'salesPlanList.columnState.v7',
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
  // 組織項目（事業場→部署→末端組織→作成者）は連動フィルタリングする（→ utils/orgCascade.ts）。
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

  // 商品販売計画登録モーダルの状態管理
  const [isProductPlanModalOpen, setIsProductPlanModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [productPlanData, setProductPlanData] = useState<ProductPlanData[]>([]);

  // 一括承認機能の状態管理
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isBulkApprovalDialogOpen, setIsBulkApprovalDialogOpen] =
    useState(false);

  // サンプルデータ（100件）
  const generateSampleData = (): SalesPlanData[] => {
    const data: SalesPlanData[] = [];
    const applicationStatuses = [
      '未登録',
      '未申請',
      '部支店長承認待ち',
      '承認済',
    ];
    const statuses = [
      '未申請',
      '承認待ち',
      '差戻し',
      '承認済み',
      '確定',
      '未承認確定',
    ];
    const channels = [
      '全国/SM',
      '全国/Dgs',
      '全国CVS',
      '管理CVS',
      '全国/通販',
      'その他販売店',
    ];
    const areas = ['道央', '道南', '道北', '道東'];
    const offices = ['北海道支社', '首都圏支社', '東北支社', '関西支社'];
    const retailers = [
      'セブン-イレブン',
      'ファミリーマート',
      'ローソン',
      'イオン',
    ];
    const tertiaryStores = [
      '国分北海道株式会社経営FC',
      '三菱食品株式会社広島FC',
      '伊藤忠食品株式会社東北支社',
      '日本アクセス株式会社首都圏支社',
    ];
    const primaryStores = [
      '国分6社通販',
      '三菱食品株式会社北見営業所',
      '伊藤忠食品札幌支店',
      '日本アクセス仙台営業所',
    ];
    const departments = [
      '北海道営業一部',
      '東北営業一部',
      '首都圏営業一部',
      '近畿圏営業一部',
      '四国営業一部',
      '九州営業一部',
    ];
    // 末端組織（＝採算組織第6階層。部署配下の営業所単位）
    const terminalOrgs = [
      '札幌第一営業所',
      '札幌第二営業所',
      '仙台営業所',
      '東京第一営業所',
      '大阪営業所',
    ];
    const salesReps = [
      '山田 太郎',
      '佐藤 花子',
      '鈴木 一郎',
      '田中 美咲',
      '高橋 健太',
    ];
    const inputProductGranularities = ['サマリ商品', '一般卸メッシュ（卸）'];
    // 「自販機」は自販機（計画一覧（自販機）統合分）の作成パターン。
    // 自販機行はチャネル・担当エリア・商品粒度を持たない（一覧では「-」表示）。
    const tradeSystems = [
      'マージン率固定',
      'NET入力',
      'NET固定',
      VENDING_PATTERN,
    ];

    // 対象年月を202601~202703でランダムに生成
    const generateRandomMonth = (): string => {
      const year = 2026;
      const month = Math.floor(Math.random() * 15) + 1; // 1~15（2026年1月~2027年3月）
      if (month <= 12) {
        return `${year}${String(month).padStart(2, '0')}`;
      } else {
        return `2027${String(month - 12).padStart(2, '0')}`;
      }
    };

    // 月次販売計画書Noをランダム生成（A26100502形式）
    const generateRandomPlanNo = (): string => {
      const randomNum = Math.floor(Math.random() * 900000) + 100000; // 100000~999999
      return `A26${randomNum}`;
    };

    // 実績番号をランダム生成（ダミー。桁・形式は未確定のため計画書番号と同じ9桁とする）
    const generateRandomActualNo = (): string => {
      const randomNum = Math.floor(Math.random() * 900000) + 100000; // 100000~999999
      return `J26${randomNum}`;
    };

    for (let i = 1; i <= 100; i++) {
      const targetMonth = generateRandomMonth();
      const retailer = retailers[i % retailers.length];
      const tertiaryStore = tertiaryStores[i % tertiaryStores.length];
      const primaryStore = primaryStores[i % primaryStores.length];

      // 三次店・一次店の組み合わせデータを条件に応じて追加
      let storeDetails: StoreDetail[] | undefined = undefined;

      // 対象年月202603 & ファミリーマート
      if (targetMonth === '202603' && retailer === 'ファミリーマート') {
        storeDetails = [
          {
            tertiaryStore: 'ファミリーマート渋谷店',
            primaryStore: '伊藤忠商事',
          },
          {
            tertiaryStore: 'ファミリーマート新宿店',
            primaryStore: '三菱商事',
          },
          {
            tertiaryStore: 'ファミリーマート池袋店',
            primaryStore: '日本アクセス',
          },
          {
            tertiaryStore: 'ファミリーマート品川店',
            primaryStore: '菱食',
          },
          {
            tertiaryStore: 'ファミリーマート六本木店',
            primaryStore: '三井物産',
          },
        ];
      }

      // 対象年月202611 & ローソン
      if (targetMonth === '202611' && retailer === 'ローソン') {
        storeDetails = [
          {
            tertiaryStore: 'ローソン丸の内店',
            primaryStore: '伊藤忠商事',
          },
          {
            tertiaryStore: 'ローソン銀座店',
            primaryStore: '三菱商事',
          },
          {
            tertiaryStore: 'ローソン秋葉原店',
            primaryStore: '日本アクセス',
          },
          {
            tertiaryStore: 'ローソン上野店',
            primaryStore: '菱食',
          },
          {
            tertiaryStore: 'ローソン浅草店',
            primaryStore: '三井物産',
          },
        ];
      }

      const tradeSystem = tradeSystems[i % tradeSystems.length];
      // 自販機はチャネル・担当エリア・商品粒度を持たない
      const isVending = tradeSystem === VENDING_PATTERN;

      // 対象年月≦202606・販売店イオン・作成パターン自販機 のデータはステータスを「確定」にする
      const rowStatus =
        targetMonth <= '202606' && retailer === 'イオン' && isVending
          ? '確定'
          : statuses[i % statuses.length];

      // 実績番号は、実績を登録できる自販機の計画（ステータスが確定・未承認確定）だけ採番済みとする
      const hasActualNo =
        isVending && (rowStatus === '確定' || rowStatus === '未承認確定');

      data.push({
        id: String(i),
        targetMonth,
        monthlyPlanNo: generateRandomPlanNo(),
        actualNo: hasActualNo ? generateRandomActualNo() : undefined,
        applicationStatus: applicationStatuses[i % applicationStatuses.length],
        status: rowStatus,
        channel: isVending ? '' : channels[i % channels.length],
        area: isVending ? '' : areas[i % areas.length],
        office: offices[i % offices.length],
        retailer,
        // 三次店企業は「その他企業」の販売店のみ値を持つ。通常行は値なし（グレーの「-」表示）
        tertiaryStoreCompany: '',
        tertiaryStore,
        primaryStore,
        department: departments[i % departments.length],
        terminalOrg: terminalOrgs[i % terminalOrgs.length],
        salesRep: salesReps[i % salesReps.length],
        inputProductGranularity: isVending
          ? ''
          : inputProductGranularities[i % inputProductGranularities.length],
        tradeSystem,
        storeDetails,
      });
    }
    // 商流紐づけなし計画のダミー行（計画表ボタンで販売計画表(商流紐づけなし)へ遷移）
    const noLinkDummyRows: SalesPlanData[] = [
      {
        id: 'nolink-1',
        targetMonth: '202510',
        monthlyPlanNo: generateRandomPlanNo(),
        applicationStatus: applicationStatuses[0],
        status: statuses[0],
        channel: '全国/SM',
        area: '道央',
        office: offices[0],
        retailer: '【ダミー】イオンリテール',
        tertiaryStoreCompany: '',
        tertiaryStore: '【ダミー】イオン東北ＲＤＣ',
        primaryStore: '【ダミー】三菱食品株式会社（イオン）',
        department: departments[0],
        terminalOrg: terminalOrgs[0],
        salesRep: salesReps[0],
        inputProductGranularity: '',
        tradeSystem: '商流販売店に紐づかない',
        isNoLink: true,
      },
      {
        id: 'nolink-2',
        targetMonth: '202510',
        monthlyPlanNo: generateRandomPlanNo(),
        applicationStatus: applicationStatuses[0],
        status: statuses[0],
        channel: '全国CVS',
        area: '道南',
        office: offices[0],
        retailer: '【ダミー】セブン-イレブン',
        tertiaryStoreCompany: '',
        tertiaryStore: '【ダミー】セブン-イレブン仙台ＲＤＣ',
        primaryStore: '【ダミー】加藤産業株式会社',
        department: departments[0],
        terminalOrg: terminalOrgs[0],
        salesRep: salesReps[0],
        inputProductGranularity: '',
        tradeSystem: '商流販売店に紐づかない',
        isNoLink: true,
      },
      {
        id: 'nolink-3',
        targetMonth: '202510',
        monthlyPlanNo: generateRandomPlanNo(),
        applicationStatus: applicationStatuses[0],
        status: statuses[0],
        channel: '全国/Dgs',
        area: '道北',
        office: offices[0],
        retailer: '【ダミー】ウエルシア',
        tertiaryStoreCompany: '',
        tertiaryStore: '【ダミー】ウエルシア東日本ＤＣ',
        primaryStore: '【ダミー】伊藤忠食品株式会社',
        department: departments[0],
        terminalOrg: terminalOrgs[0],
        salesRep: salesReps[0],
        inputProductGranularity: '',
        tradeSystem: '商流販売店に紐づかない',
        isNoLink: true,
      },
    ];
    // 販売店「その他企業」のダミー行（三次店企業に値を持つ唯一のケース）
    const otherCompanyDummyRows: SalesPlanData[] = [
      {
        id: 'other-1',
        targetMonth: '202510',
        monthlyPlanNo: generateRandomPlanNo(),
        applicationStatus: applicationStatuses[0],
        status: statuses[0],
        channel: 'その他販売店',
        area: '道央',
        office: offices[0],
        retailer: 'その他企業',
        tertiaryStoreCompany: '三菱食品株式会社',
        tertiaryStore: '三菱食品株式会社首都圏支社',
        primaryStore: '三菱食品株式会社北見営業所',
        department: departments[0],
        terminalOrg: terminalOrgs[0],
        salesRep: salesReps[0],
        inputProductGranularity: 'サマリ商品',
        tradeSystem: 'NET固定',
      },
      {
        id: 'other-2',
        targetMonth: '202511',
        monthlyPlanNo: generateRandomPlanNo(),
        applicationStatus: applicationStatuses[1 % applicationStatuses.length],
        status: statuses[1 % statuses.length],
        channel: 'その他販売店',
        area: '道南',
        office: offices[1 % offices.length],
        retailer: 'その他企業',
        tertiaryStoreCompany: '伊藤忠食品株式会社',
        tertiaryStore: '伊藤忠食品株式会社東北支社',
        primaryStore: '伊藤忠食品札幌支店',
        department: departments[1 % departments.length],
        terminalOrg: terminalOrgs[1 % terminalOrgs.length],
        salesRep: salesReps[1 % salesReps.length],
        inputProductGranularity: 'サマリ商品',
        tradeSystem: 'NET固定',
      },
      {
        id: 'other-3',
        targetMonth: '202512',
        monthlyPlanNo: generateRandomPlanNo(),
        applicationStatus: applicationStatuses[2 % applicationStatuses.length],
        status: statuses[2 % statuses.length],
        channel: 'その他販売店',
        area: '道北',
        office: offices[2 % offices.length],
        retailer: 'その他企業',
        tertiaryStoreCompany: '日本アクセス株式会社',
        tertiaryStore: '日本アクセス株式会社首都圏支社',
        primaryStore: '日本アクセス仙台営業所',
        department: departments[2 % departments.length],
        terminalOrg: terminalOrgs[2 % terminalOrgs.length],
        salesRep: salesReps[2 % salesReps.length],
        inputProductGranularity: 'サマリ商品',
        tradeSystem: 'NET固定',
      },
    ];
    return [...otherCompanyDummyRows, ...noLinkDummyRows, ...data];
  };

  const [rowData] = useState<SalesPlanData[]>(generateSampleData());

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
    if (onMenuChange) {
      onMenuChange(resolveMenuTarget(data));
    }
  };

  // 実績番号のリンク押下時：販売実績詳細画面へ遷移
  const handleActualResults = () => {
    if (onMenuChange) {
      onMenuChange('sales-actual-detail');
    }
  };

  // 行をどこでもダブルクリックすると該当の計画詳細画面へ遷移
  // （計画書番号のリンクと同じ。計画一覧・実績一覧のどちらから開いても同じ遷移先：決定事項No.768）
  const handleRowDoubleClicked = (
    event: RowDoubleClickedEvent<SalesPlanData>
  ) => {
    if (event.data && onMenuChange) {
      onMenuChange(resolveMenuTarget(event.data));
    }
  };

  // 商品販売計画登録の登録処理
  const handleProductPlanRegister = () => {
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmRegister = () => {
    setIsConfirmDialogOpen(false);
    setIsProductPlanModalOpen(false);
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

  // 商品販売計画のカラム定義
  const productPlanColumnDefs: ColDef<ProductPlanData>[] = useMemo(
    () => [
      {
        headerName: '商品区分',
        field: 'productCategory',
        width: 120,
        cellClass: 'cell-left',
        cellStyle: {
          backgroundColor: '#f7f7f7',
        },
      },
      {
        headerName: 'サマリ商品',
        field: 'summaryProduct',
        width: 350,
        cellClass: 'cell-left',
        cellStyle: {
          backgroundColor: '#f7f7f7',
        },
      },
      {
        headerName: '社外売上高(千円)',
        field: 'externalSales',
        width: 150,
        cellClass: 'cell-right',
        cellStyle: {
          backgroundColor: '#f7f7f7',
        },
        valueFormatter: (params) =>
          params.value?.toLocaleString() || GRID_EMPTY_TEXT,
      },
      {
        headerName: '函単価(円)',
        field: 'caseUnitPrice',
        width: 130,
        cellClass: 'cell-right',
        cellStyle: {
          backgroundColor: '#f7f7f7',
        },
        valueFormatter: (params) =>
          params.value?.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) || GRID_EMPTY_TEXT,
      },
      {
        headerName: '1本あたり単価(円)',
        field: 'bottleUnitPrice',
        width: 160,
        cellClass: 'cell-right',
        cellStyle: {
          backgroundColor: '#f7f7f7',
        },
        valueFormatter: (params) =>
          params.value?.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) || GRID_EMPTY_TEXT,
      },
      {
        headerName: '参考商品',
        field: 'referenceProduct',
        width: 300,
        cellClass: 'cell-left',
        cellStyle: {
          backgroundColor: '#f7f7f7',
        },
      },
      {
        headerName: '参考函数',
        field: 'referenceCases',
        width: 120,
        cellClass: 'cell-right',
        cellStyle: {
          backgroundColor: '#f7f7f7',
        },
        valueFormatter: (params) =>
          params.value?.toLocaleString() || GRID_EMPTY_TEXT,
      },
      {
        headerName: '目標函数',
        field: 'targetCases',
        width: 120,
        cellClass: 'cell-right',
        cellStyle: {
          backgroundColor: '#f7f7f7',
        },
        valueFormatter: (params) =>
          params.value?.toLocaleString() || GRID_EMPTY_TEXT,
      },
      {
        headerName: '計画函数',
        field: 'plannedCases',
        width: 120,
        editable: true,
        cellClass: 'cell-right',
        cellStyle: {
          backgroundColor: 'white',
        },
        valueFormatter: (params) =>
          params.value?.toLocaleString() || GRID_EMPTY_TEXT,
        valueParser: (params) =>
          parseInt(params.newValue.replace(/,/g, '')) || 0,
        onCellValueChanged: (params) => {
          const updatedData = productPlanData.map((item) =>
            item.id === params.data.id
              ? { ...item, plannedCases: params.newValue }
              : item
          );
          setProductPlanData(updatedData);
        },
      },
      {
        headerName: '当月進捗率',
        field: 'monthlyProgressRate',
        width: 130,
        cellClass: 'cell-right',
        cellStyle: {
          backgroundColor: '#f7f7f7',
        },
        valueFormatter: (params) =>
          params.value != null
            ? `${params.value.toFixed(1)}%`
            : GRID_EMPTY_TEXT,
      },
      {
        headerName: '当月実績',
        field: 'monthlyActual',
        width: 120,
        cellClass: 'cell-right',
        cellStyle: {
          backgroundColor: '#f7f7f7',
        },
        valueFormatter: (params) =>
          params.value?.toLocaleString() || GRID_EMPTY_TEXT,
      },
    ],
    [productPlanData]
  );

  // 計画書番号のリンク。ステータスに関わらず常にリンクとする（決定事項No.785）。
  // 詳細ボタンの列は設けず、このリンクで計画詳細へ遷移する（決定事項No.768）。
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

  // 実績番号のリンク。採番されている行だけリンクとし、採番されていない行は空欄（決定事項No.785）。
  const ActualNoLinkRenderer = (props: any) => {
    if (!props.value) return null;
    return (
      <button
        type="button"
        className="cursor-pointer text-blue-600 hover:underline focus:ring-2 focus:ring-blue-500 focus:outline-none"
        onClick={() => handleActualResults()}
      >
        {props.value}
      </button>
    );
  };

  // ステータスセルレンダラー（アイコン＋文言・支払申請一覧参照と同じ方式）
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

  // 実績登録状況セルレンダラー（アイコン＋文言）
  // 「未登録」「一部未」は AlertCircle、「登録済」は CheckCircle。
  // 対象外（「-」など）はアイコンなしで文言のみ表示（「-」はグレー）。
  const ActualStatusRenderer = (props: any) => {
    const value = props.value;
    if (value === '未登録' || value === '未登録(一部)') {
      return (
        <div className="flex items-center gap-1">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          <span className="text-gray-900">{value}</span>
        </div>
      );
    }
    if (value === '登録済') {
      return (
        <div className="flex items-center gap-1">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-gray-900">{value}</span>
        </div>
      );
    }
    return <span className="text-gray-900">{valueOrEmpty(value)}</span>;
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
    return dataItem.storeDetails && dataItem.storeDetails.length > 1;
  }, []);

  // AG Grid列定義
  const columnDefs: ColDef<SalesPlanData>[] = useMemo(
    () => [
      {
        // 計画書番号（旧「月次販売計画書No」。決定事項No.776）。押下で計画詳細へ遷移
        headerName: '計画書番号',
        field: 'monthlyPlanNo',
        cellRenderer: PlanNoLinkRenderer,
        // 実績一覧（チェックボックス非表示）では先頭列になり grid.css で中央寄せが
        // 強制されるため、ag-cell-left で左寄せに戻す
        cellClass: ['cell-left', 'ag-cell-left'],
      },
      {
        // 実績番号。押下で販売実績詳細へ遷移（決定事項No.768）
        headerName: '実績番号',
        field: 'actualNo',
        cellRenderer: ActualNoLinkRenderer,
        cellClass: 'cell-left',
      },
      {
        headerName: '対象年月',
        field: 'targetMonth',
        ...GRID_MONTH_TEXT_FILTER,
        cellClass: 'cell-left',
      },
      {
        headerName: '販売店',
        field: 'retailer',
        cellClass: 'cell-left',
      },
      {
        headerName: 'ステータス',
        field: 'status',
        cellRenderer: StatusRenderer,
        // ステータスバッジ（アイコン）は中央寄せ
        cellClass: 'cell-center',
      },
      {
        headerName: 'チャネル',
        field: 'channel',
        // 自販機はチャネルを持たないため「-」表示
        valueGetter: (params) =>
          params.data?.tradeSystem === VENDING_PATTERN
            ? GRID_EMPTY_TEXT
            : params.data?.channel || '',
        cellClass: 'cell-left',
      },
      {
        headerName: '事業場',
        field: 'office',
        cellClass: 'cell-left',
      },
      {
        headerName: '三次店企業',
        field: 'tertiaryStoreCompany',
        // 値が無いときは共通の既定列設定がグレーの「-」を表示する
        valueGetter: (params) => params.data?.tertiaryStoreCompany || '',
        cellClass: 'cell-left',
      },
      {
        headerName: '担当エリア',
        field: 'area',
        // 自販機は担当エリアを持たないため「-」表示
        valueGetter: (params) =>
          params.data?.tradeSystem === VENDING_PATTERN
            ? GRID_EMPTY_TEXT
            : params.data?.area || '',
        cellClass: 'cell-left',
      },
      {
        headerName: '三次店',
        field: 'tertiaryStore',
        valueGetter: (params) => {
          // storeDetailsがある場合は代表（1件目）を表示
          if (
            params.data?.storeDetails &&
            params.data.storeDetails.length > 0
          ) {
            return params.data.storeDetails[0].tertiaryStore;
          }
          return params.data?.tertiaryStore || '';
        },
        // 複数の三次店・一次店の組み合わせを持つ行はここから展開する
        cellRenderer: 'agGroupCellRenderer',
        cellClass: 'cell-left',
      },
      {
        headerName: '一次店',
        field: 'primaryStore',
        valueGetter: (params) => {
          // storeDetailsがある場合は代表（1件目）を表示
          if (
            params.data?.storeDetails &&
            params.data.storeDetails.length > 0
          ) {
            return params.data.storeDetails[0].primaryStore;
          }
          return params.data?.primaryStore || '';
        },
        // 複数の三次店・一次店の組み合わせを持つ行はここから展開する
        cellRenderer: 'agGroupCellRenderer',
        cellClass: 'cell-left',
      },
      {
        headerName: '部署',
        field: 'department',
        cellClass: 'cell-left',
      },
      {
        // 末端組織＝採算組織第6階層（事業場→部署→末端組織→作成者 の階層順に並べる）
        headerName: '末端組織',
        field: 'terminalOrg',
        cellClass: 'cell-left',
      },
      {
        headerName: '作成者',
        field: 'salesRep',
        cellClass: 'cell-left',
      },
      {
        headerName: '商品粒度',
        field: 'inputProductGranularity',
        // 自販機は商品粒度を持たないため「-」表示
        valueGetter: (params) =>
          params.data?.tradeSystem === VENDING_PATTERN
            ? GRID_EMPTY_TEXT
            : params.data?.inputProductGranularity || '',
        cellClass: 'cell-left',
      },
      {
        headerName: '作成パターン',
        field: 'tradeSystem',
        // jihanki モード時に setFilterModel({filterType:'set'}) が確実に一致するよう
        // Set Filter を明示（Enterpriseの既定だが型を固定して曖昧さを排除）
        filter: 'agSetColumnFilter',
        cellClass: 'cell-left',
      },
      {
        headerName: '実績登録\n(アライアンス品)',
        // ヘッダーを headerName の \n の位置で2段表示にする。
        // 折り返しと高さ調整は AG Grid 公式の wrapHeaderText / autoHeaderHeight、
        // 改行位置の固定は headerClass 経由の white-space: pre-line（下の <style>）で行う。
        headerClass: 'header-wrap-pre-line',
        wrapHeaderText: true,
        autoHeaderHeight: true,
        // 表示値は「未登録」「済」の二択。自販機行は対象年月で判定、
        // それ以外（自販機以外）は対象外のため「-」表示
        valueGetter: (params) =>
          params.data?.tradeSystem === VENDING_PATTERN
            ? resolveHqActualStatus(params.data?.targetMonth ?? '')
            : GRID_EMPTY_TEXT,
        // 自販機行かつ対象年月202605のセルは背景をアラート色にする
        cellStyle: (params) =>
          params.data?.tradeSystem === VENDING_PATTERN &&
          params.data?.targetMonth === '202605'
            ? { backgroundColor: GRID_COLORS.alertRowBg }
            : null,
        cellRenderer: ActualStatusRenderer,
        // ステータスバッジ（アイコン）は中央寄せ
        cellClass: 'cell-center',
      },
      {
        headerName: '実績登録\n(アライアンス品以外)',
        headerClass: 'header-wrap-pre-line',
        wrapHeaderText: true,
        autoHeaderHeight: true,
        // 表示値は「未登録」「未登録(一部)」「済」の三択。自販機行は対象年月で判定、
        // それ以外（自販機以外）は対象外のため「-」表示
        valueGetter: (params) =>
          params.data?.tradeSystem === VENDING_PATTERN
            ? resolveOpeActualStatus(params.data?.targetMonth ?? '')
            : GRID_EMPTY_TEXT,
        // 自販機行かつ対象年月202604のセルは背景をアラート色にする
        cellStyle: (params) =>
          params.data?.tradeSystem === VENDING_PATTERN &&
          params.data?.targetMonth === '202604'
            ? { backgroundColor: GRID_COLORS.alertRowBg }
            : null,
        cellRenderer: ActualStatusRenderer,
        // ステータスバッジ（アイコン）は中央寄せ
        cellClass: 'cell-center',
      },
    ],
    // リンクのレンダラーは onMenuChange を閉じ込めるため依存に含める。
    // （計画一覧・実績一覧で列の構成・リンクの遷移先は同じため jihanki には依存しない）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
    [onMenuChange]
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
    <div className="min-w-[75rem] h-full flex flex-col">
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
                {/* 対象年月（開始～終了）: 2列分。終了月が2列目の縦の線をまたがないよう、
                    開始は1列目・終了は2列目の入力欄の左の線にそろえ、「～」は開始と終了の真ん中に置く。
                    終了側の幅＝2列分の半分－（列の間隔の半分 0.625rem＋ラベル幅 5.625rem＋間隔 0.5rem） */}
                <div className="col-span-2 flex items-center gap-2">
                  <label className={SEARCH_LABEL_CLASS}>対象年月</label>
                  <MonthYearPicker
                    value={targetYearMonthStart}
                    onChange={setTargetYearMonthStart}
                    required={false}
                    clearable
                  />
                  <span className="flex-1 text-center text-sm text-gray-700">
                    ～
                  </span>
                  <div className="flex shrink-0 w-[calc(50%-6.75rem)]">
                    <MonthYearPicker
                      value={targetYearMonthEnd}
                      onChange={setTargetYearMonthEnd}
                      required={false}
                      clearable
                    />
                  </div>
                </div>

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
            計画追加・一括承認ボタンはヘッダーバー（headerActions）へ配置。
            jihanki（実績登録モード）ではボタンを出さず、ヘッダー全体が開閉トリガーになる。
            タイトルも jihanki=true では「販売実績一覧」を表示する。
            fillParent でページの余り高さいっぱいまで広げ、折り畳み時は下限を外してヘッダーのみの高さへ戻す。 */}
        <CollapsibleCard
          title={jihanki ? '実績一覧' : '計画一覧'}
          fillParent
          className="data-[state=open]:min-h-[23.75rem]"
          // 一括承認はグリッドのチェックボックスと連動するため、タイトルのすぐ右に置く
          titleActions={
            !jihanki && (
              <button
                onClick={handleBulkApproval}
                disabled={selectedRows.size === 0}
                className={`px-2 py-1 whitespace-nowrap text-sm ${BUTTON_BASE} ${
                  selectedRows.size === 0
                    ? BUTTON_STYLES.disabled
                    : BUTTON_STYLES.approve
                }`}
                aria-label="一括承認"
              >
                <Check className="h-4 w-4 inline-block mr-1" />
                一括承認
              </button>
            )
          }
          headerActions={
            !jihanki && (
              <>
                <button
                  onClick={() => onMenuChange?.('promotion-cost-plan-unlinked')}
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
              text-align: center;
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
              getContextMenuItems={gridFilterContextMenuItems}
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
                width: 50,
                resizable: false,
                suppressMovable: true,
                suppressHeaderMenuButton: true,
                // 選択できない行はセル全体を灰色で塗りつぶす（配色は grid.css）
                cellClass: (params) =>
                  isBulkApprovalTarget(params.data)
                    ? undefined
                    : 'cell-selection-disabled',
              }}
              onSelectionChanged={(event) => {
                const selectedNodes = event.api.getSelectedNodes();
                const selectedIds = selectedNodes.map(
                  (node) => node.data?.id || ''
                );
                setSelectedRows(new Set(selectedIds));
              }}
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
            />
          </div>
        </CollapsibleCard>
      </div>

      {/* 商品販売計画登録モーダル */}
      <Dialog
        open={isProductPlanModalOpen}
        onOpenChange={setIsProductPlanModalOpen}
      >
        <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw] md:max-w-[80vw] lg:max-w-[80vw] xl:max-w-[80vw] max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-xl font-bold">
              商品販売計画登録
            </DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6">
            {/* ヘッダー部 */}
            <div className="space-y-2 border-b pb-4">
              {/* 1行目 */}
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="flex gap-2">
                  <span className="font-bold text-gray-700">販売計画書No</span>
                  <span>B26906490</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-gray-700">対象年度</span>
                  <span>2026年</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-gray-700">対象月</span>
                  <span>5月</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-gray-700">ステータス</span>
                  <span>未登録</span>
                </div>
              </div>

              {/* 2行目 */}
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="flex gap-2">
                  <span className="font-bold text-gray-700">事業場</span>
                  <span>首都圏支社</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-gray-700">部署</span>
                  <span>首都圏営業一部</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-gray-700">営業担当者</span>
                  <span>鈴木 一郎</span>
                </div>
                <div></div>
              </div>

              {/* 3行目 */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex gap-2">
                  <span className="font-bold text-gray-700">販売店</span>
                  <span>ジャパンビバレッジ東日本</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-gray-700">三次店</span>
                  <span>国分北海道株式会社経営FC</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-gray-700">一次店</span>
                  <span>国分6社通販</span>
                </div>
              </div>
            </div>

            {/* ボディー部（テーブル） */}
            <div className="border rounded mt-4">
              <div className="h-[23rem] w-full">
                <AgGridReact<ProductPlanData>
                  rowData={productPlanData}
                  columnDefs={withHeaderTooltips(productPlanColumnDefs)}
                  defaultColDef={GRID_DEFAULT_COL_DEF}
                  getRowId={getProductPlanRowId}
                  getContextMenuItems={gridFilterContextMenuItems}
                  domLayout="normal"
                  animateRows={true}
                  {...GRID_BASE_PROPS}
                  statusBar={GRID_STATUS_BAR}
                />
              </div>
            </div>

            {/* フッター部 */}
            <DialogFooter className="flex justify-end mt-4">
              <Button
                onClick={handleProductPlanRegister}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                登録
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 登録確認ダイアログ */}
      <AlertDialog
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
      >
        <AlertDialogContent>
          {/* ×ボタン */}
          <button
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
            onClick={() => setIsConfirmDialogOpen(false)}
            aria-label="閉じる"
          >
            <XIcon className="size-6" />
            <span className="sr-only">Close</span>
          </button>

          <AlertDialogHeader>
            <AlertDialogTitle>登録確認</AlertDialogTitle>
            <AlertDialogDescription>
              商品販売計画を登録してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirmRegister}>
              登録
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 一括承認確認ダイアログ */}
      <AlertDialog
        open={isBulkApprovalDialogOpen}
        onOpenChange={setIsBulkApprovalDialogOpen}
      >
        <AlertDialogContent>
          {/* ×ボタン */}
          <button
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
            onClick={() => setIsBulkApprovalDialogOpen(false)}
            aria-label="閉じる"
          >
            <XIcon className="size-6" />
            <span className="sr-only">Close</span>
          </button>

          <AlertDialogHeader>
            <AlertDialogTitle>確認</AlertDialogTitle>
            <AlertDialogDescription>
              選択された{selectedRows.size}
              件の販売計画を一括承認しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-blue-500 hover:bg-blue-600 text-white py-5 rounded-lg"
              onClick={handleConfirmBulkApproval}
            >
              一括承認
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

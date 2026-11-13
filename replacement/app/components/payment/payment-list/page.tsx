import {
  FileText,
  AlertCircle,
  Clock,
  Undo2,
  CheckCircle,
  Ban,
  Search,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type {
  ColDef,
  CellDoubleClickedEvent,
  GetRowIdParams,
} from 'ag-grid-community';

import { SearchRangeField } from '@/app/components/ui/search-range-field';
import { CopyableArea } from '@/app/components/ui/copyable-area';
import { SingleCombobox } from '@/app/components/ui/single-combobox';
import { MultiCombobox } from '@/app/components/ui/multi-combobox';
import {
  useOrgCascadeSearch,
  toOrgComboOptions,
} from '@/app/components/ui/use-org-cascade-search';
import type { OrgCascadeConfig } from '@/app/utils/common/orgCascade';
import type { OrgLevel } from '@/app/types/organization';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_MASTER_DETAIL_ICONS,
  GRID_BASE_PROPS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_NO_FILTER_COLUMN_TYPES,
  GRID_MONTH_TEXT_FILTER,
  GRID_EMPTY_TEXT,
  StatusIconCellRenderer,
} from '@/app/components/grid';
import { MonthYearPicker } from '@/app/components/ui/month-year-picker';
import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { SearchClearButton } from '@/app/components/ui/search-clear-button';
import {
  buildSearchSummary,
  formatSummaryRange,
  formatSummaryValue,
} from '@/app/components/ui/search-summary';
import {
  FORM_LABEL_CLASS,
  BUTTON_STYLES,
  SEARCH_GRID_CLASS,
  SEARCH_LABEL_CLASS,
} from '@/styles/commonStyles';
import {
  RETAILER_OPTIONS,
  PRIMARY_STORE_OPTIONS,
  TERTIARY_STORE_OPTIONS,
  STATUS_FILTER_OPTIONS,
} from '@/app/constants/paymentListSearchOptions';
import { storeOptionsForRetailer } from '@/app/utils/payment/payment-list/paymentListSearchOptions';
import {
  VOUCHER_TYPE,
  VOUCHER_TYPE_ALL,
  STATUS_FILTER_ALL,
  STATUS_FILTER_EXCLUDING_NO_PAYMENT,
  formatRepresentative,
  matchesPaymentListFilter,
} from '@/app/utils/payment/payment-list/paymentApplicationList';
import { ScreenTitle } from '@/app/components/ui/screen-title';
import { useAppNavigation } from '@/app/components/ui/use-app-navigation';

// 検索条件の初期値（クリアボタンで戻す値）
const INITIAL_DATE_BASIS = 'accounting'; // 計上年月
const INITIAL_YEAR_MONTH_START = '2026/01';
const INITIAL_YEAR_MONTH_END = '2026/12';
// ステータス：支払無し以外（支払無しは初期の検索条件では出さない。課題No.0949）
const INITIAL_STATUS = STATUS_FILTER_EXCLUDING_NO_PAYMENT;
// 組織項目（事業場→部署→末端組織→営業担当者）：ログインユーザーの所属・本人
// ステータス・伝票種別の未選択は「指定なし」と表示し、「全て」の選択肢は持たない（→ 02 §9）。
// 検索条件の値は従来どおり未選択を STATUS_FILTER_ALL／VOUCHER_TYPE_ALL で持つ（絞り込みの意味は変えない）
const STATUS_SEARCH_OPTIONS = STATUS_FILTER_OPTIONS.filter(
  (option) => option.value !== STATUS_FILTER_ALL
);
// 伝票種別の選択肢（検索条件と、折り畳んだときの要約で共用）
const VOUCHER_TYPE_OPTIONS = [
  { value: VOUCHER_TYPE.payment, label: '支払' },
  { value: VOUCHER_TYPE.deptTransfer, label: '振替' },
];
const INITIAL_ORG: Partial<Record<OrgLevel, string[]>> = {
  office: ['hokkaido'],
  department: ['hokkaido-sales-1'],
  terminalOrg: ['sapporo-1'],
  salesRep: ['yamada-taro'],
};
const INITIAL_VOUCHER_TYPE = VOUCHER_TYPE_ALL; // 伝票種別：指定なし（絞らない）
// 販売店・一次店・三次店：未選択（絞らない）
const INITIAL_RETAILER = '';
const INITIAL_PRIMARY_STORE = '';
const INITIAL_TERTIARY_STORE = '';

// 組織項目の連動フィルタリング（事業場→部署→末端組織→営業担当者。→ utils/common/orgCascade.ts）
const ORG_CASCADE_CONFIG: OrgCascadeConfig = {
  levels: ['office', 'department', 'terminalOrg', 'salesRep'],
  labels: {
    office: '事業場',
    department: '部署',
    terminalOrg: '末端組織',
    salesRep: '営業担当者',
  },
  units: { salesRep: '名' },
};

// ステータスごとのアイコン・色設定。
// 支払無し＝当月は支払が発生しない伝票。未申請⇔支払無しの切替は支払詳細画面のフッターで行う
// （9/4 ASD結論：一覧の「支払無し」「未申請」ボタンと備考は削除）。
// 未申請／支払無し／承認待ち／承認差戻し／検印待ち／検印差戻し／検印済 の7種。支払・振替で共通。
// 登録元（EDI／AIC 等）はステータスから外し別属性とする。支払データは割振・引取後に伝票化されて
// 一覧に載るため、登場時点の登録元差（EDI由来／AIC由来）は「未申請」に畳まれる。
const STATUS_CONFIG: Record<
  string,
  { icon: typeof FileText; className: string }
> = {
  // 未申請は全画面でオレンジの「！」に統一する（UI/UX UX-012）
  未申請: { icon: AlertCircle, className: 'text-orange-500' },
  支払無し: { icon: Ban, className: 'text-gray-500' },
  承認待ち: { icon: Clock, className: 'text-blue-500' },
  // 差戻しは全画面で赤（未申請と見分ける。UI/UX UX-011）
  承認差戻し: { icon: Undo2, className: 'text-red-600' },
  検印待ち: { icon: Clock, className: 'text-blue-500' },
  検印差戻し: { icon: Undo2, className: 'text-red-600' },
  検印済: { icon: CheckCircle, className: 'text-green-600' },
};

// 支払で取りうるステータス（サンプルデータ生成用）。
const PAYMENT_STATUSES = [
  '未申請',
  '支払無し',
  '承認待ち',
  '承認差戻し',
  '検印待ち',
  '検印差戻し',
  '検印済',
];

// 伝票種別＝支払の行から遷移する支払詳細画面（モック）。
// 商流販売店による画面出し分けは未実装のため、行ごとにこの順で巡回させて
// 3画面すべてを一覧から開けるようにする。
const PAYMENT_DETAIL_MENU_IDS = [
  'payment-detail-vending', // 支払詳細(自販機)
  'payment-detail-with-invoice', // 支払詳細(追加口請求書有)
  'payment-detail-without-invoice', // 支払詳細(追加口請求書無)
];

// 商流販売店に紐づかない支払の行・「＋商流販売店紐づけなし支払追加」から遷移する画面
const PAYMENT_DETAIL_UNLINKED_MENU_ID = 'payment-detail-unlinked';

// 伝票種別＝振替の行・「＋振替追加」から遷移する画面
const TRANSFER_DETAIL_MENU_ID = 'transfer-detail';

// 分割・振替の相手方1件分（行を展開したアコーディオンに表示する明細）。
// 一覧の伝票Noだけでは「どの支払から来たのか／誰に確認すればよいのか」が分からないため、
// 相手方の伝票No・支払回数・組織・担当者をセットで持たせる（7/28 第24回 共通 宿題事項6）。
interface SplitTransferRelation {
  id: string; // 行ID（展開グリッドの getRowId に使う内部値。展開元の行の中で一意）
  kind: '分割' | '振替';
  // IN＝他部署から分割・振替されてきた側（相手は分割元／振替元）
  // OUT＝他部署へ分割・振替した側（相手は分割先／振替先）
  direction: 'IN' | 'OUT';
  // 相手方の伝票No。分割は伝票Noが採番されないため空＝「-」表示
  voucherNo: string;
  // 相手方の支払回数。振替先・分割先は支払が未発生のため null＝「-」表示
  paymentCount: number | null;
  officeName: string; // 相手方の事業場名称
  departmentName: string; // 相手方の部署名称
  personName: string; // 相手方の担当者名称（確認先）
}

interface PaymentApplicationData {
  id: string;
  // 識別・状態の列
  // 支払No（伝票種別＝支払）／振替No（伝票種別＝振替）。内部管理番号で、卸から来る請求番号とは別物
  voucherNo: string;
  paymentCount: number | null; // 支払回数（支払No単位に1,2,3…。振替は持たないため null）
  voucherType: string; // 伝票種別（支払／振替）
  // 商流販売店に紐づかない支払か（支払詳細(商流販売店紐づけなし)で作成する支払）。
  // 詳細ボタンの遷移先と、末端組織の表示有無に使う。振替は false。
  isUnlinked: boolean;
  status: string; // ステータス
  // 未着請求書。請求書が届いていない支払か（有／無）。
  // 振替は請求書を持たないため null＝「-」表示。
  hasUnarrivedInvoice: boolean | null;
  // ①対象期間
  accountingMonth: string; // 計上年月
  targetMonth: string; // 対象年月
  // ②商流特定（振替は振替元が複数支払にまたがり多値になるため空文字＝「-」表示）
  payeeCode: string; // 支払先コード（8桁）
  payeeName: string; // 支払先名称
  retailerCode: string; // 販売店コード（8桁）
  retailer: string; // 販売店名称
  tertiaryStoreCode: string; // 三次店コード（8桁）
  tertiaryStore: string; // 三次店名称
  primaryStoreCode: string; // 一次店コード（8桁）
  primaryStore: string; // 一次店名称
  salesRepCode: string; // 営業担当者コード（7桁）
  salesRep: string; // 営業担当者名称
  // ③金額
  paymentAmount: number; // 支払金額(税抜)。振替は伝票合計
  // ④販売計画
  // 販売計画書No。振替・計画無し支払は空配列＝「-」表示。
  monthlyRetailerPlanNo: string[];
  // ⑥担当組織（商流販売店の担当組織＝販売計画作成者）。
  // 振替は部署間の付替え伝票で商流販売店を持たないため空文字＝「-」表示。
  officeCode: string; // 事業場コード（8桁）
  office: string; // 事業場名称
  departmentCode: string; // 部署コード（8桁）
  department: string; // 部署名称
  // 末端組織（部署配下の最下位組織）。商流販売店紐づけなしの支払のみ値を持つ。
  // 他（振替を含む）は空文字＝「-」表示。
  terminalOrgCode: string; // 末端組織コード（8桁）
  terminalOrgName: string; // 末端組織名称
  applicantCode: string; // 申請者コード（7桁）
  applicantName: string; // 申請者名称
  applicationDate: string; // 申請日
  // 申請事業場／申請部署＝実際に伝票を入力した組織。通常は事業場・部署と同じだが、
  // 代行入力（他組織が代わって起票する）では事業場・部署と異なる値になる。
  applicantOfficeCode: string; // 申請事業場コード（8桁）
  applicantOfficeName: string; // 申請事業場名称
  applicantDeptCode: string; // 申請部署コード（8桁）
  applicantDeptName: string; // 申請部署名称
  // 申請末端組織＝支払申請者の末端組織（申請事業場・申請部署と同じ組織の最下位組織）
  applicantTerminalOrgCode: string; // 申請末端組織コード（8桁）
  applicantTerminalOrgName: string; // 申請末端組織名称
  // ⑦振替
  sourceVoucherNos: string[]; // 振替元の支払No（振替のみ。複数可）
  transferFromDepts: { code: string; name: string }[]; // 振替元部署（振替のみ。複数可）
  transferToDepts: { code: string; name: string }[]; // 振替先部署（振替のみ。複数可）
  // 分割・振替の相手方（行の展開＝アコーディオンで表示する）。該当がなければ空配列。
  splitTransferRelations: SplitTransferRelation[];
}

// 相手方の明細に行ID（展開元の行の中での連番）を付ける（→ 画面設計標準 4.7）
const withRelationIds = (
  relations: Omit<SplitTransferRelation, 'id'>[]
): SplitTransferRelation[] =>
  relations.map((relation, index) => ({ ...relation, id: `rel-${index + 1}` }));

// 行IDは一覧の行の id（生成時の連番で一意）、展開グリッドは相手方の明細の id（→ 画面設計標準 4.7）
const getRowId = (params: GetRowIdParams<PaymentApplicationData>) =>
  params.data.id;
const getRelationRowId = (params: GetRowIdParams<SplitTransferRelation>) =>
  params.data.id;

// グリッドの context 型（セルレンダラーから呼ぶコールバックを受け渡す）
interface PaymentListGridContext {
  onDetail: (data: PaymentApplicationData) => void;
}

// 詳細ボタンレンダラー（クリック時の処理は context 経由で呼ぶ）。
// ※引用は支払一覧では行わない（8/14 手売りセッション決定事項1〜4により、
//   支払詳細画面の支払回数追加の隣の引用ボタン→引用明細選択の下ペインへ一本化）。
// ※「支払無し」「未申請」の切替ボタンは置かない（9/4 ASD結論。切替は支払詳細画面のフッターで行う）。
// 再生成によるグリッド再描画を避けるためモジュールスコープに定義する。
const DetailButtonRenderer = (
  props: CustomCellRendererProps<PaymentApplicationData>
) => {
  const context = props.context as PaymentListGridContext;
  // 詳細ボタン押下処理
  const handleDetailClick = () => {
    if (props.data) {
      context.onDetail(props.data);
    }
  };
  return (
    <button
      className={`${BUTTON_STYLES.outline} h-8 flex-shrink-0 px-2 py-0.5 rounded-full font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm whitespace-nowrap`}
      onClick={handleDetailClick}
    >
      詳細
    </button>
  );
};

// 伝票種別ごとのタグ配色（支払＝通常の支払伝票／振替＝検印後の部署間付替え）。
// ボタンと誤認されないよう、枠線なし・角丸小の淡色タグ（塗り）にする。
const VOUCHER_TYPE_CONFIG: Record<string, string> = {
  [VOUCHER_TYPE.payment]: 'bg-gray-100 text-gray-800',
  [VOUCHER_TYPE.deptTransfer]: 'bg-amber-100 text-amber-800',
};

// 伝票種別セルレンダラー（支払・振替をタグ表示）
const VoucherTypeRenderer = (
  props: CustomCellRendererProps<PaymentApplicationData>
) => {
  const cls = VOUCHER_TYPE_CONFIG[props.value];
  if (!cls) {
    // 想定外の種別（未設定を含む）はタグにせず「-」で表示する
    return <span className="text-gray-400">{GRID_EMPTY_TEXT}</span>;
  }
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {props.value}
    </span>
  );
};

// 分割・振替の相手方の区分名（アコーディオンの「区分」列）。
// IN（他部署から来た側）から見た相手は「元」、OUT（他部署へ出した側）から見た相手は「先」。
const relationCategory = (relation: SplitTransferRelation): string =>
  `${relation.kind}${relation.direction === 'IN' ? '元' : '先'}`;

// 分割・振替セルの表示文言。
// 色分けは凡例が分かりにくくなるため用いず、文字で「分割」「振替」を示す（7/24 第23回 共通 決定事項1）。
// 他部署から来た側（IN）と他部署へ出した側（OUT）を1列で見分けられるよう、IN／OUT を添える
// （分割・振替に関する全画面共通の表現。7/24 第23回 共通 決定事項11）。
// 伝票種別＝振替の行は伝票そのものが振替のため、展開すると出る相手方（振替元・振替先）を示す。
const splitTransferText = (row?: PaymentApplicationData): string => {
  if (!row) {
    return GRID_EMPTY_TEXT;
  }
  if (row.voucherType === VOUCHER_TYPE.deptTransfer) {
    const categories = row.splitTransferRelations.map(relationCategory);
    const shownCategories = ['振替元', '振替先'].filter((category) =>
      categories.includes(category)
    );
    return shownCategories.length > 0
      ? shownCategories.join('・')
      : GRID_EMPTY_TEXT;
  }
  // 表示順は分割→振替、同じ種別では IN→OUT に揃える（行ごとに順序が変わらないようにする）
  const order = ['分割(IN)', '分割(OUT)', '振替(IN)', '振替(OUT)'];
  const marks = new Set(
    row.splitTransferRelations.map((r) => `${r.kind}(${r.direction})`)
  );
  const shown = order.filter((label) => marks.has(label));
  return shown.length > 0 ? shown.join('・') : GRID_EMPTY_TEXT;
};

// 分割・振替セルレンダラー（展開アイコンの内側に置く文言）。
const SplitTransferRenderer = (
  props: CustomCellRendererProps<PaymentApplicationData>
) => {
  const text = splitTransferText(props.data);
  if (text === GRID_EMPTY_TEXT) {
    return <span className="text-gray-400">{GRID_EMPTY_TEXT}</span>;
  }
  return <span className="text-gray-900">{text}</span>;
};

// 有無タグのセルレンダラー（該当する行のみタグ表示、他は「-」）。
// 未着請求書のように有無が分かればよい属性列で使う。
// 値が false／null（振替行など対象を持たない行）はいずれも「-」になる。
const PresenceTagRenderer = (
  props: CustomCellRendererProps<PaymentApplicationData>
) => {
  if (!props.value) {
    return <span className="text-gray-400">{GRID_EMPTY_TEXT}</span>;
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
      有
    </span>
  );
};

// 空文字（振替行の商流系・担当組織系）を「-」で表示する。
// AG Grid の ValueFormatterFunc に直接渡さず値だけを受け取る素の関数にして、
// 各列で `valueFormatter: (params) => dashIfEmpty(params.value)` と呼び出す（型の噛み合わせを避けるため）。
const dashIfEmpty = (value: unknown): string =>
  value ? String(value) : GRID_EMPTY_TEXT;

export default function PaymentList() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）。
  // 返り値を <AgGridReact> に spread するだけで永続化が有効になる。
  // 備考・販売計画選択・他部門受領の列削除と振替元部署の列追加で列構成が変わるため、
  // キーを v21 に更新して自動列幅調整（fitCellContents）をやり直す
  // （v20 以前の保存状態は破棄される）。
  const gridColumnStateProps = useGridColumnState(
    'paymentApplicationList.columnState.v21'
  );

  // 検索条件の状態管理
  const [dateBasis, setDateBasis] = useState(INITIAL_DATE_BASIS);
  const [yearMonthStart, setYearMonthStart] = useState(
    INITIAL_YEAR_MONTH_START
  );
  const [yearMonthEnd, setYearMonthEnd] = useState(INITIAL_YEAR_MONTH_END);
  const [status, setStatus] = useState(INITIAL_STATUS);
  // 組織項目は複数選択・連動フィルタリング（未選択＝条件なし）
  const org = useOrgCascadeSearch(ORG_CASCADE_CONFIG, INITIAL_ORG);
  // 伝票種別（指定なし／支払／振替）の絞り込み
  const [voucherType, setVoucherType] = useState(INITIAL_VOUCHER_TYPE);
  // 販売店・一次店・三次店（各コード・''＝絞らない）。
  // 商流販売店は1項目では表せないため3項目に分ける（業務機能要件レビュー指摘）。
  const [retailer, setRetailer] = useState(INITIAL_RETAILER);
  const [primaryStore, setPrimaryStore] = useState(INITIAL_PRIMARY_STORE);
  const [tertiaryStore, setTertiaryStore] = useState(INITIAL_TERTIARY_STORE);

  // 一次店・三次店の候補。販売店を選ぶと、その販売店の商流にある店だけに絞る。
  const primaryStoreOptions = useMemo(
    () => storeOptionsForRetailer(PRIMARY_STORE_OPTIONS, retailer),
    [retailer]
  );
  const tertiaryStoreOptions = useMemo(
    () => storeOptionsForRetailer(TERTIARY_STORE_OPTIONS, retailer),
    [retailer]
  );

  // 販売店の変更処理。選択中の一次店・三次店が候補から外れたら未選択に戻す。
  const handleRetailerChange = (value: string) => {
    setRetailer(value);
    const primaryCandidates = storeOptionsForRetailer(
      PRIMARY_STORE_OPTIONS,
      value
    );
    if (!primaryCandidates.some((option) => option.value === primaryStore)) {
      setPrimaryStore(INITIAL_PRIMARY_STORE);
    }
    const tertiaryCandidates = storeOptionsForRetailer(
      TERTIARY_STORE_OPTIONS,
      value
    );
    if (!tertiaryCandidates.some((option) => option.value === tertiaryStore)) {
      setTertiaryStore(INITIAL_TERTIARY_STORE);
    }
  };

  // サンプルデータ（仮データ・後ほど正式データを指定予定）
  const generateSampleData = (): PaymentApplicationData[] => {
    const offices = ['北海道支社', '東北支社', '首都圏支社', '近畿圏支社'];
    // 事業場コード（8桁・各事業場に対応）
    const officeCodes = ['10000621', '10000622', '10000623', '10000624'];
    const departments = [
      '北海道営業一部',
      '東北営業一部',
      '首都圏営業一部',
      '近畿圏営業一部',
    ];
    // 部署コード（8桁・各部署に対応）
    const departmentCodes = ['10002984', '10002985', '10002986', '10002987'];
    const salesReps = ['山田 太郎', '佐藤 花子', '鈴木 一郎', '田中 美咲'];
    // 営業担当者コード（7桁・各担当者に対応）
    const salesRepCodes = ['5172733', '5172734', '5172735', '5172736'];
    const payees = [
      { code: '10234671', name: '国分株式会社' },
      { code: '10234672', name: '三菱食品株式会社' },
      { code: '10234673', name: '伊藤忠食品株式会社' },
      { code: '10234674', name: '日本アクセス株式会社' },
    ];
    const retailers = [
      'セブン-イレブン',
      'ファミリーマート',
      'ローソン',
      'イオン',
    ];
    // 販売店コード（8桁・各販売店に対応）
    const retailerCodes = ['30200740', '30200741', '30200742', '30200743'];
    const tertiaryStores = [
      '国分北海道株式会社経営FC',
      '三菱食品株式会社広島FC',
      '伊藤忠食品株式会社東北支社',
      '日本アクセス株式会社首都圏支社',
    ];
    // 三次店コード（8桁・各三次店に対応）
    const tertiaryStoreCodes = ['10754882', '10754883', '10754884', '10754885'];
    const primaryStores = [
      '国分6社通販',
      '三菱食品株式会社北見営業所',
      '伊藤忠食品札幌支店',
      '日本アクセス仙台営業所',
    ];
    // 一次店コード（8桁・各一次店に対応）
    const primaryStoreCodes = ['10010075', '10010076', '10010077', '10010078'];
    // 末端組織（部署配下の最下位組織）。末端組織・申請末端組織の双方で同じマスタを使う。
    // ※末端組織は商流販売店紐づけなしの支払でのみ設定する（他は空＝「-」）。
    //   申請末端組織は申請者の組織（申請事業場・申請部署と同じ index）から全行に設定する。
    const terminalOrgCodes = ['10005001', '10005002', '10005003', '10005004'];
    const terminalOrgNames = [
      '札幌第一営業所',
      '札幌第二営業所',
      '仙台営業所',
      '東京第一営業所',
    ];

    // 支払Noと振替Noは別系列とする（伝票種別が支払なら支払No、振替なら振替No）。
    // 振替Noは実採番仕様が未定のため、対応する支払Noの連番を流用し接頭辞のみ変えたダミー。
    const toNo = (n: number) => `S26${String(100000 + n).padStart(6, '0')}`;
    const toTransferNo = (n: number) =>
      `F26${String(100000 + n).padStart(6, '0')}`;
    // 販売計画書No（支払のみ。振替は「-」）
    const toPlanNo = (n: number) => `A26${String(200000 + n).padStart(6, '0')}`;

    // 伝票定義。
    // ・支払：counts＝支払回数の数（1,2,3…と連番で行を持つ）、split＝申請時に分割したか。
    // ・振替：sourceNos＝振替元の支払No（複数可）、toDepts＝振替先部署の索引（複数可）、
    //   transferStatus＝振替のステータス（支払と同じ6種から取る）。
    // ・分割しても支払Noは採番されないため一覧に行としては現れず、分割・振替有無で判別する。
    // ・振替は検印後にしか行えないため、振替元の支払は検印済になる。
    const vouchers: {
      no: number;
      type: string;
      counts?: number;
      split?: boolean;
      sourceNos?: number[];
      toDepts?: number[];
      /** 申請者が振替元・振替先のどちら側か（振替のみ） */
      applicantSide?: 'source' | 'destination';
      transferStatus?: string;
      /**
       * 商流販売店紐づけなしの支払（支払詳細(商流販売店紐づけなし)で作成。末端組織まで持つ）。
       * モックでは計画無しの支払とし、販売計画書Noを持たせない。
       */
      unlinked?: boolean;
      /** 遅延請求。計上年月が対象年月の翌々月になる（通常は翌月） */
      lateBilling?: boolean;
    }[] = [
      { no: 1, type: VOUCHER_TYPE.payment, counts: 2, split: true },
      { no: 2, type: VOUCHER_TYPE.payment, counts: 1 },
      { no: 3, type: VOUCHER_TYPE.payment, counts: 2, lateBilling: true },
      { no: 4, type: VOUCHER_TYPE.payment, counts: 1, split: true },
      { no: 5, type: VOUCHER_TYPE.payment, counts: 3, lateBilling: true },
      { no: 6, type: VOUCHER_TYPE.payment, counts: 1 },
      { no: 7, type: VOUCHER_TYPE.payment, counts: 1 }, // 振替14の元
      { no: 8, type: VOUCHER_TYPE.payment, counts: 1 }, // 振替16の元
      { no: 9, type: VOUCHER_TYPE.payment, counts: 2 }, // 振替16の元
      { no: 11, type: VOUCHER_TYPE.payment, counts: 1, split: true },
      { no: 12, type: VOUCHER_TYPE.payment, counts: 2 },
      { no: 13, type: VOUCHER_TYPE.payment, counts: 1 },
      // 商流販売店紐づけなしの支払（計画無し。末端組織まで持ち、計画に紐づかない）
      { no: 10, type: VOUCHER_TYPE.payment, counts: 1, unlinked: true },
      // 1つの支払から複数部署へ振り替えるケース（振替元の担当者が申請）
      // 振替元 no.7 の部署（index 2）から、index 0・1 の2部署へ振り替える
      {
        no: 14,
        type: VOUCHER_TYPE.deptTransfer,
        sourceNos: [7],
        toDepts: [0, 1],
        applicantSide: 'source',
        transferStatus: '承認待ち',
      },
      // 複数の支払の明細から1つの部署へ振り替えるケース（振替先の担当者が申請）
      // 振替元 no.8（部署index 3）・no.9（部署index 0）から、index 2 の部署へ引き取る
      {
        no: 16,
        type: VOUCHER_TYPE.deptTransfer,
        sourceNos: [8, 9],
        toDepts: [2],
        applicantSide: 'destination',
        transferStatus: '検印済',
      },
    ];

    // 支払の部署・事業場は vouchers 配列上の位置で決まる（下の forEach の vi）。
    // 振替の申請者部署を振替元から導くため、支払Noから同じ index を引けるようにする。
    const deptIndexOf = (voucherNo: number) =>
      vouchers.findIndex((x) => x.no === voucherNo) % departmentCodes.length;

    // 振替元となった支払No（振替は検印後にしか行えないため検印済にする）
    const transferredNos = new Set(vouchers.flatMap((v) => v.sourceNos ?? []));

    // 分割・振替の相手方（アコーディオン表示用）を組み立てるための索引。
    // 事業場・部署・営業担当者は vouchers 配列上の位置で決まるため、位置から相手方の組織を引く。
    const orgOf = (index: number) => ({
      officeName: offices[index % offices.length],
      departmentName: departments[index % departments.length],
      personName: salesReps[index % salesReps.length],
    });
    // 支払Noから vouchers 配列上の位置を引く（振替元の支払の組織を辿るため）
    const voucherIndexOf = (voucherNo: number) =>
      vouchers.findIndex((x) => x.no === voucherNo);
    // 受領元（IN）に割り当てる支払伝票の位置。振替伝票は受領元にならないため除く。
    const paymentIndexes = vouchers
      .map((x, i) => (x.type === VOUCHER_TYPE.payment ? i : -1))
      .filter((i) => i >= 0);

    // 申請事業場／申請部署＝実際に伝票を入力した組織。通常は申請者部署と同じだが、
    // 代行入力（他組織が代わって起票する）では別組織になる。モックでは採番の元になる
    // 連番が5の倍数の伝票を代行入力とし、申請者部署の次の組織が起票したものとする。
    const applicantOrgIndexOf = (deptIndex: number, voucherNo: number) =>
      voucherNo % 5 === 0
        ? (deptIndex + 1) % departmentCodes.length
        : deptIndex;

    // 2026年基準の月をオフセット付きで YYYY/MM に変換する（年跨ぎを処理）。
    const yearMonth = (baseMonth1: number, add: number) => {
      const zero = 2026 * 12 + (baseMonth1 - 1) + add;
      const y = Math.floor(zero / 12);
      const m = (zero % 12) + 1;
      return `${y}/${String(m).padStart(2, '0')}`;
    };

    const data: PaymentApplicationData[] = [];
    let id = 0;
    vouchers.forEach((v, vi) => {
      // 対象年月＝実績の月。計上年月＝対象年月の翌月（基本）、遅延請求は翌々月。
      const targetMonthNum = (vi % 12) + 1;
      const targetMonth = yearMonth(targetMonthNum, 0);
      const accountingMonth = yearMonth(targetMonthNum, v.lateBilling ? 2 : 1);
      const isTransfer = v.type === VOUCHER_TYPE.deptTransfer;
      // 支払のステータス：振替元になったものは検印済、それ以外は各種を巡回
      const status = isTransfer
        ? (v.transferStatus as string)
        : transferredNos.has(v.no)
          ? '検印済'
          : PAYMENT_STATUSES[vi % PAYMENT_STATUSES.length];

      if (isTransfer) {
        id += 1;
        const toDepts = (v.toDepts ?? []).map((d) => ({
          code: departmentCodes[d],
          name: departments[d],
        }));
        // 振替元部署（振替元の支払の部署）。複数の支払が同じ部署なら1件にまとめる。
        const fromDeptIndexes = Array.from(
          new Set((v.sourceNos ?? []).map(deptIndexOf))
        );
        const fromDepts = fromDeptIndexes.map((d) => ({
          code: departmentCodes[d],
          name: departments[d],
        }));
        // 申請者部署。振替元・振替先のどちらの担当者も申請しうる（前提8）。
        // 事業場と部署は同じ index で対応するため、両方をこの index から引く。
        const applicantDeptIndex =
          v.applicantSide === 'source'
            ? deptIndexOf((v.sourceNos ?? [])[0])
            : (v.toDepts ?? [])[0];
        data.push({
          id: String(id),
          voucherNo: toTransferNo(v.no), // 振替は振替No
          paymentCount: null, // 振替は支払回数を持たない
          voucherType: v.type,
          isUnlinked: false,
          status,
          hasUnarrivedInvoice: null, // 振替は請求書を持たないため「-」
          accountingMonth,
          targetMonth,
          // 商流系：振替元が複数支払にまたがり多値になるため一覧では持たない
          payeeCode: '',
          payeeName: '',
          retailerCode: '',
          retailer: '',
          tertiaryStoreCode: '',
          tertiaryStore: '',
          primaryStoreCode: '',
          primaryStore: '',
          salesRepCode: '',
          salesRep: '',
          paymentAmount: (v.no * 10000 + 5678) % 1000000,
          // 販売計画書No：振替詳細画面に計画を表示しないため、一覧でも持たない（「-」）
          monthlyRetailerPlanNo: [],
          // 担当組織（商流販売店の担当組織）：振替は商流販売店を持たないため「-」
          officeCode: '',
          office: '',
          departmentCode: '',
          department: '',
          terminalOrgCode: '',
          terminalOrgName: '',
          applicantCode: salesRepCodes[applicantDeptIndex],
          applicantName: salesReps[applicantDeptIndex],
          applicationDate: `${accountingMonth}/15`,
          applicantOfficeCode:
            officeCodes[applicantOrgIndexOf(applicantDeptIndex, v.no)],
          applicantOfficeName:
            offices[applicantOrgIndexOf(applicantDeptIndex, v.no)],
          applicantDeptCode:
            departmentCodes[applicantOrgIndexOf(applicantDeptIndex, v.no)],
          applicantDeptName:
            departments[applicantOrgIndexOf(applicantDeptIndex, v.no)],
          applicantTerminalOrgCode:
            terminalOrgCodes[applicantOrgIndexOf(applicantDeptIndex, v.no)],
          applicantTerminalOrgName:
            terminalOrgNames[applicantOrgIndexOf(applicantDeptIndex, v.no)],
          sourceVoucherNos: (v.sourceNos ?? []).map(toNo),
          transferFromDepts: fromDepts,
          transferToDepts: toDepts,
          // 振替伝票を展開すると、振替元（どの支払から）と振替先（どの部署へ）を並べて出す。
          // 支払Noだけでは内容が分からないため、支払回数・部署・担当者名まで持たせる。
          splitTransferRelations: withRelationIds([
            ...(v.sourceNos ?? []).map((sourceNo) => {
              const sourceIndex = voucherIndexOf(sourceNo);
              return {
                kind: '振替' as const,
                direction: 'IN' as const,
                voucherNo: toNo(sourceNo),
                // 振替は明細単位で行うため、振替元の最終の支払回数を対象とする
                paymentCount: vouchers[sourceIndex].counts ?? 1,
                ...orgOf(sourceIndex),
              };
            }),
            ...(v.toDepts ?? []).map((deptIndex) => ({
              kind: '振替' as const,
              direction: 'OUT' as const,
              // 振替先は支払がまだ発生していないため伝票No・支払回数を持たない
              voucherNo: '',
              paymentCount: null,
              ...orgOf(deptIndex),
            })),
          ]),
        });
        return;
      }

      // 分割・振替の状態（伝票単位で決まるため支払回数のループ前に確定させる）
      // 検印済（振替元を含む）は分割できないため、分割有にはならない
      const isSplitRow = Boolean(v.split) && status !== '検印済';
      // 他部門へ振り替えた側（＝振替伝票の振替元として使われた支払）
      const isTransferSourceRow = transferredNos.has(v.no);
      // 他部門から分割/振替された経費を受領した支払（モック）。振替元(検印済)は対象外。
      // vi%4===0（北海道営業一部＋セブン-イレブン）と vi%4===2（首都圏営業一部＋ローソン）を
      // 受領あり（分割・振替の IN）にして、複数の組織・商流の行に IN が出るようにする。
      const hasTransferredIn =
        !isTransferSourceRow && (vi % 4 === 2 || vi % 4 === 0);

      // 分割・振替の相手方（アコーディオン表示用）。
      // OUT＝この支払から他部署へ出した先、IN＝他部署から受け取った元。
      // 分割・振替は支払回数ごとの明細に対して行うため、支払回数は展開元の行と同じ値を持たせる。
      const relationsOf = (
        paymentCount: number
      ): Omit<SplitTransferRelation, 'id'>[] => {
        const relations: Omit<SplitTransferRelation, 'id'>[] = [];
        if (isSplitRow) {
          // 分割は伝票Noが採番されないため、相手方の伝票Noは持たない
          relations.push({
            kind: '分割',
            direction: 'OUT',
            voucherNo: '',
            paymentCount,
            ...orgOf(vi + 1),
          });
        }
        if (isTransferSourceRow) {
          // 振替伝票を辿り、どの振替伝票でどの部署へ渡したのかを出す
          vouchers
            .filter((t) => (t.sourceNos ?? []).includes(v.no))
            .forEach((t) => {
              (t.toDepts ?? []).forEach((deptIndex) => {
                relations.push({
                  kind: '振替',
                  direction: 'OUT',
                  voucherNo: toTransferNo(t.no),
                  paymentCount,
                  ...orgOf(deptIndex),
                });
              });
            });
        }
        if (hasTransferredIn) {
          // 受領元（モック）。vi%4===0 は分割で、vi%4===2 は振替で受け取ったものとする。
          const sourceIndex = paymentIndexes[(vi + 2) % paymentIndexes.length];
          relations.push({
            kind: vi % 4 === 0 ? '分割' : '振替',
            direction: 'IN',
            voucherNo: toNo(vouchers[sourceIndex].no),
            paymentCount,
            ...orgOf(sourceIndex),
          });
        }
        return relations;
      };

      // 伝票No 単位に支払回数を 1,2,3… と連番で持たせる（飛び値にしない）
      for (let c = 1; c <= (v.counts ?? 1); c++) {
        id += 1;
        data.push({
          id: String(id),
          voucherNo: toNo(v.no),
          paymentCount: c,
          voucherType: v.type,
          isUnlinked: Boolean(v.unlinked),
          status,
          // 未着請求書（モック）。3伝票に1件を「有」にして有／無の両方を並べる。
          hasUnarrivedInvoice: vi % 3 === 0,
          accountingMonth,
          targetMonth,
          payeeCode: payees[vi % payees.length].code,
          payeeName: payees[vi % payees.length].name,
          retailerCode: retailerCodes[vi % retailerCodes.length],
          retailer: retailers[vi % retailers.length],
          tertiaryStoreCode: tertiaryStoreCodes[vi % tertiaryStoreCodes.length],
          tertiaryStore: tertiaryStores[vi % tertiaryStores.length],
          primaryStoreCode: primaryStoreCodes[vi % primaryStoreCodes.length],
          primaryStore: primaryStores[vi % primaryStores.length],
          salesRepCode: salesRepCodes[vi % salesRepCodes.length],
          salesRep: salesReps[vi % salesReps.length],
          paymentAmount: (v.no * 10000 + c * 1234) % 1000000,
          // 計画無し支払は計画に紐づかないため販売計画書Noを空にする
          monthlyRetailerPlanNo: v.unlinked ? [] : [toPlanNo(v.no)],
          officeCode: officeCodes[vi % officeCodes.length],
          office: offices[vi % offices.length],
          departmentCode: departmentCodes[vi % departmentCodes.length],
          department: departments[vi % departments.length],
          // 末端組織は商流販売店紐づけなしの支払のみ値を持つ（他は空＝「-」）
          terminalOrgCode: v.unlinked
            ? terminalOrgCodes[vi % terminalOrgCodes.length]
            : '',
          terminalOrgName: v.unlinked
            ? terminalOrgNames[vi % terminalOrgNames.length]
            : '',
          // 支払の申請者は当該商流の営業担当者
          applicantCode: salesRepCodes[vi % salesRepCodes.length],
          applicantName: salesReps[vi % salesReps.length],
          applicationDate: `${accountingMonth}/15`,
          applicantOfficeCode:
            officeCodes[applicantOrgIndexOf(vi % officeCodes.length, v.no)],
          applicantOfficeName:
            offices[applicantOrgIndexOf(vi % offices.length, v.no)],
          applicantDeptCode:
            departmentCodes[
              applicantOrgIndexOf(vi % departmentCodes.length, v.no)
            ],
          applicantDeptName:
            departments[applicantOrgIndexOf(vi % departmentCodes.length, v.no)],
          // 申請末端組織＝申請者の末端組織（申請事業場・申請部署と同じ組織から引く）
          applicantTerminalOrgCode:
            terminalOrgCodes[
              applicantOrgIndexOf(vi % terminalOrgCodes.length, v.no)
            ],
          applicantTerminalOrgName:
            terminalOrgNames[
              applicantOrgIndexOf(vi % terminalOrgNames.length, v.no)
            ],
          sourceVoucherNos: [],
          transferFromDepts: [],
          transferToDepts: [],
          splitTransferRelations: withRelationIds(relationsOf(c)),
        });
      }
    });
    return data;
  };

  const [allRowData] = useState<PaymentApplicationData[]>(generateSampleData());

  // 行ごとの詳細ボタン遷移先（行ID→メニューID）。
  // 振替は振替詳細へ、商流販売店紐づけなしの支払は支払詳細(商流販売店紐づけなし)へ。
  // 他の支払は PAYMENT_DETAIL_MENU_IDS を順に巡回させ、一覧から3画面すべてが開けるようにする。
  const detailMenuIdByRowId = useMemo(() => {
    const menuIds = new Map<string, string>();
    let paymentIndex = 0; // 支払行の連番
    allRowData.forEach((row) => {
      if (row.voucherType === VOUCHER_TYPE.deptTransfer) {
        menuIds.set(row.id, TRANSFER_DETAIL_MENU_ID);
        return;
      }
      if (row.isUnlinked) {
        menuIds.set(row.id, PAYMENT_DETAIL_UNLINKED_MENU_ID);
        return;
      }
      menuIds.set(
        row.id,
        PAYMENT_DETAIL_MENU_IDS[paymentIndex++ % PAYMENT_DETAIL_MENU_IDS.length]
      );
    });
    return menuIds;
  }, [allRowData]);

  // 検索条件に応じて明細を絞り込む（検索ボタンなし＝入力に応じてリアルタイムに反映）。
  // ※事業場・部署・末端組織・営業担当者は表示件数を保つため現状は絞り込み対象外（UIのみ）。
  const rowData = useMemo(() => {
    return allRowData.filter((row) =>
      matchesPaymentListFilter(row, {
        dateBasis: dateBasis as 'accounting' | 'target',
        yearMonthStart,
        yearMonthEnd,
        status,
        voucherType,
        retailer,
        primaryStore,
        tertiaryStore,
      })
    );
  }, [
    allRowData,
    dateBasis,
    yearMonthStart,
    yearMonthEnd,
    status,
    voucherType,
    retailer,
    primaryStore,
    tertiaryStore,
  ]);

  // クリアボタン押下処理（検索条件を初期値に戻す）。
  // 組織項目は未選択（指定なし）にする（決定事項No.774・No.783）
  // 検索条件カードを折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）
  const searchSummary = buildSearchSummary([
    {
      label: dateBasis === 'accounting' ? '計上年月' : '対象年月',
      value: formatSummaryRange(yearMonthStart, yearMonthEnd),
    },
    ...org.summaryItems('codeName'),
    {
      label: 'ステータス',
      value:
        status === STATUS_FILTER_ALL
          ? ''
          : formatSummaryValue(status, STATUS_SEARCH_OPTIONS),
    },
    {
      label: '伝票種別',
      value:
        voucherType === VOUCHER_TYPE_ALL
          ? ''
          : formatSummaryValue(voucherType, VOUCHER_TYPE_OPTIONS),
    },
    { label: '販売店', value: formatSummaryValue(retailer, RETAILER_OPTIONS) },
    {
      label: '一次店',
      value: formatSummaryValue(primaryStore, primaryStoreOptions),
    },
    {
      label: '三次店',
      value: formatSummaryValue(tertiaryStore, tertiaryStoreOptions),
    },
  ]);

  const handleClear = () => {
    setDateBasis(INITIAL_DATE_BASIS);
    setYearMonthStart(INITIAL_YEAR_MONTH_START);
    setYearMonthEnd(INITIAL_YEAR_MONTH_END);
    setStatus(INITIAL_STATUS);
    org.reset();
    setVoucherType(INITIAL_VOUCHER_TYPE);
    setRetailer(INITIAL_RETAILER);
    setPrimaryStore(INITIAL_PRIMARY_STORE);
    setTertiaryStore(INITIAL_TERTIARY_STORE);
  };

  // 詳細ボタン押下処理（行ごとの遷移先へ移動する）。
  // TODO: 選択行（data）の内容を遷移先へ引き継ぐ。支払の画面出し分けは
  //       本来は商流販売店で決まるが、未実装のため行単位の巡回で代替している。
  const handleDetail = (data: PaymentApplicationData) => {
    navigate(detailMenuIdByRowId.get(data.id) ?? PAYMENT_DETAIL_MENU_IDS[0]);
  };

  // セルのダブルクリック処理（行内のどこでも詳細ボタンと同じ画面へ遷移する）。
  // 一覧は参照専用（編集可能セルなし）のため、全セルを遷移の対象とする。
  const handleCellDoubleClicked = (
    event: CellDoubleClickedEvent<PaymentApplicationData>
  ) => {
    if (event.data) {
      handleDetail(event.data);
    }
  };

  // ＋振替追加ボタン押下処理（振替詳細画面へ遷移する。振替元の選択は振替詳細側で行う）
  const handleAddTransfer = () => {
    navigate(TRANSFER_DETAIL_MENU_ID);
  };

  // ＋商流販売店紐づけなし支払追加ボタン押下処理（支払詳細(商流販売店紐づけなし)へ遷移する）
  const handleAddNoLinkPayment = () => {
    navigate(PAYMENT_DETAIL_UNLINKED_MENU_ID);
  };

  // 分割・振替のアコーディオン（AG Grid の Master Detail。計画一覧の販売店展開と同じ方式）。
  // 一覧では「分割・振替」列で有無だけを示し、行を展開すると相手方の明細を表示する。
  // 一覧の列を増やさずに、振替元から見た振替先／振替先から見た振替元の双方を同じ場所で確認できる。
  const detailCellRendererParams = useMemo(
    () => ({
      detailGridOptions: {
        columnDefs: [
          {
            headerName: '区分',
            colId: 'relationCategory',
            valueGetter: (params: { data?: SplitTransferRelation }) =>
              params.data ? relationCategory(params.data) : '',
            width: 88,
            cellClass: 'cell-left',
          },
          {
            headerName: '伝票No',
            field: 'voucherNo',
            width: 120,
            cellClass: 'cell-left',
            valueFormatter: (params: { value: unknown }) =>
              dashIfEmpty(params.value),
          },
          {
            headerName: '支払回数',
            field: 'paymentCount',
            width: 88,
            cellClass: 'cell-left',
            valueFormatter: (params: { value: unknown }) =>
              dashIfEmpty(params.value),
          },
          {
            headerName: '事業場',
            field: 'officeName',
            flex: 1,
            cellClass: 'cell-left',
          },
          {
            headerName: '部署',
            field: 'departmentName',
            flex: 1,
            cellClass: 'cell-left',
          },
          {
            headerName: '営業担当者',
            field: 'personName',
            flex: 1,
            cellClass: 'cell-left',
          },
        ],
        // ヘッダーの見た目（列メニュー非表示・省略時のtooltip）を一覧側と揃える。
        // 明細は数行のため、フィルターは持たせない。
        defaultColDef: { ...GRID_DEFAULT_COL_DEF, filter: false },
        // filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
        columnTypes: GRID_NO_FILTER_COLUMN_TYPES,
        domLayout: 'autoHeight',
        getRowId: getRelationRowId,
      },
      getDetailRowData: (params: {
        data: PaymentApplicationData;
        successCallback: (rows: SplitTransferRelation[]) => void;
      }) => {
        params.successCallback(params.data.splitTransferRelations);
      },
    }),
    []
  );

  // 分割・振替の相手方を持つ行だけ展開できるようにする
  const isRowMaster = useCallback(
    (data: PaymentApplicationData) => data.splitTransferRelations.length > 0,
    []
  );

  // AG Grid列定義。
  // 左端5列（詳細・伝票種別・支払No/振替No・支払回数・ステータス）は識別と状態の列。
  // 未着請求書はステータスの右隣に置き、状態系の項目を隣接させる。
  // 支払No＋支払回数が行の識別キー（承認・検印は支払回数単位）のため隣接させる。
  // 以降は業務の進行順に並べる。振替行では②商流特定・④販売計画・⑥担当組織が「-」になり、
  // ⑤分割・振替には展開すると出る相手方（振替元・振替先）を表示する。
  const columnDefs: ColDef<PaymentApplicationData>[] = useMemo(
    () => [
      // ── 識別・状態の列 ──
      {
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        // 操作列（行のデータを持たない）のため field ではなく colId
        colId: 'detail',
        cellRenderer: DetailButtonRenderer,
        sortable: false,
        filter: false,
        suppressMovable: true,
        resizable: false,
        cellClass: 'cell-left',
        // 詳細ボタン1つ分の幅
        width: 64,
      },
      {
        headerName: '伝票種別',
        field: 'voucherType',
        cellRenderer: VoucherTypeRenderer,
        cellClass: 'cell-left',
      },
      {
        // 伝票種別が支払なら支払No、振替なら振替Noが入るため両方を併記する
        headerName: '支払No/振替No',
        field: 'voucherNo',
        cellClass: 'cell-left',
      },
      {
        headerName: '支払回数',
        field: 'paymentCount',
        cellClass: 'cell-right',
        // 振替は支払回数を持たないため「-」
        valueFormatter: (params) =>
          params.value === null ? GRID_EMPTY_TEXT : String(params.value),
      },
      {
        headerName: 'ステータス',
        field: 'status',
        cellRenderer: StatusIconCellRenderer,
        cellRendererParams: { statusConfig: STATUS_CONFIG },
        cellClass: 'cell-left',
      },
      // ── 未着請求書（ステータスの右隣。振替は「-」） ──
      {
        headerName: '未着請求書',
        // colId は列状態（列幅・並び順）の保存キーになるため据え置く
        colId: 'unarrivedInvoice',
        field: 'hasUnarrivedInvoice',
        // 有無タグ表示（有＝タグ、無・振替＝「-」）
        cellRenderer: PresenceTagRenderer,
        cellClass: 'cell-left',
      },
      // ── ①対象期間 ──
      {
        headerName: '計上年月',
        field: 'accountingMonth',
        ...GRID_MONTH_TEXT_FILTER,
        cellClass: 'cell-left',
      },
      {
        headerName: '対象年月',
        field: 'targetMonth',
        ...GRID_MONTH_TEXT_FILTER,
        cellClass: 'cell-left',
      },
      // ── ②商流特定（振替は「-」） ──
      {
        headerName: '支払先コード',
        field: 'payeeCode',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '支払先名称',
        field: 'payeeName',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '販売店コード',
        field: 'retailerCode',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '販売店名称',
        field: 'retailer',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '三次店コード',
        field: 'tertiaryStoreCode',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '三次店名称',
        field: 'tertiaryStore',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '一次店コード',
        field: 'primaryStoreCode',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '一次店名称',
        field: 'primaryStore',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '営業担当者コード',
        field: 'salesRepCode',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '営業担当者名称',
        field: 'salesRep',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      // ── ③金額 ──
      {
        headerName: '支払金額(税抜)',
        field: 'paymentAmount',
        cellClass: 'cell-right',
        valueFormatter: (params) =>
          params.value?.toLocaleString() || GRID_EMPTY_TEXT,
      },
      // ── ④販売計画 ──
      // ※販売計画選択（計画紐づけ）の列は置かない（8/18 第30回 決定事項1：支払時の計画紐づけは廃止）
      {
        // 振替は振替詳細画面に計画を表示しないため「-」。計画無し支払も「-」。
        headerName: '販売計画書No',
        field: 'monthlyRetailerPlanNo',
        cellClass: 'cell-left',
        valueFormatter: (params) => formatRepresentative(params.value ?? []),
      },
      // ── ⑤分割・振替 ──
      {
        headerName: '分割・振替',
        colId: 'splitTransfer',
        // 展開アイコン（アコーディオン）の内側に文言を出す。押すと相手方の明細が開く。
        cellRenderer: 'agGroupCellRenderer',
        cellRendererParams: { innerRenderer: SplitTransferRenderer },
        cellClass: 'cell-left',
        // 展開アイコン＋「分割(OUT)・振替(IN)」が収まる幅を確保する
        minWidth: 152,
        // 列フィルタ・ソートはセルの文言で効かせる
        valueGetter: (params) => splitTransferText(params.data),
      },
      // ※他部門受領の列は置かない（9/4 ASD結論。分割・振替の IN で判別できるため）
      // ── ⑥担当組織（商流販売店の担当組織。振替は「-」）・申請 ──
      {
        headerName: '事業場コード',
        field: 'officeCode',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '事業場名称',
        field: 'office',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '部署コード',
        field: 'departmentCode',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '部署名称',
        field: 'department',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      // 末端組織は商流販売店紐づけなしの支払のみ値あり。他（振替を含む）は「-」
      {
        headerName: '末端組織コード',
        field: 'terminalOrgCode',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '末端組織名称',
        field: 'terminalOrgName',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '申請者コード',
        field: 'applicantCode',
        cellClass: 'cell-left',
      },
      {
        headerName: '申請者名称',
        field: 'applicantName',
        cellClass: 'cell-left',
      },
      {
        headerName: '申請日',
        field: 'applicationDate',
        cellClass: 'cell-left',
      },
      // 申請組織は上位から順（事業場→部署→末端組織）に並べ、右端の⑦振替へつなげる
      {
        headerName: '申請事業場コード',
        field: 'applicantOfficeCode',
        cellClass: 'cell-left',
      },
      {
        headerName: '申請事業場名称',
        field: 'applicantOfficeName',
        cellClass: 'cell-left',
      },
      {
        headerName: '申請部署コード',
        field: 'applicantDeptCode',
        cellClass: 'cell-left',
      },
      {
        headerName: '申請部署名称',
        field: 'applicantDeptName',
        cellClass: 'cell-left',
      },
      {
        headerName: '申請末端組織コード',
        field: 'applicantTerminalOrgCode',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      {
        headerName: '申請末端組織名称',
        field: 'applicantTerminalOrgName',
        cellClass: 'cell-left',
        valueFormatter: (params) => dashIfEmpty(params.value),
      },
      // ── ⑦振替 ──
      {
        headerName: '振替元支払No',
        field: 'sourceVoucherNos',
        cellClass: 'cell-left',
        // 振替は複数の振替元（支払No）を束ねるため代表1件＋「他N件」。支払は「-」
        valueFormatter: (params) => formatRepresentative(params.value ?? []),
      },
      {
        headerName: '振替元部署コード',
        field: 'transferFromDepts',
        colId: 'transferFromDeptCode',
        cellClass: 'cell-left',
        // 振替元が複数部署にまたがる場合は代表1件＋「他N件」。支払は「-」
        valueFormatter: (params) =>
          formatRepresentative(
            ((params.value ?? []) as { code: string }[]).map((d) => d.code)
          ),
      },
      {
        headerName: '振替元部署名称',
        field: 'transferFromDepts',
        colId: 'transferFromDeptName',
        cellClass: 'cell-left',
        valueFormatter: (params) =>
          formatRepresentative(
            ((params.value ?? []) as { name: string }[]).map((d) => d.name)
          ),
      },
      {
        headerName: '振替先部署コード',
        field: 'transferToDepts',
        colId: 'transferToDeptCode',
        cellClass: 'cell-left',
        // 振替先が複数の場合は代表1件＋「他N件」
        valueFormatter: (params) =>
          formatRepresentative(
            ((params.value ?? []) as { code: string }[]).map((d) => d.code)
          ),
      },
      {
        headerName: '振替先部署名称',
        field: 'transferToDepts',
        colId: 'transferToDeptName',
        cellClass: 'cell-left',
        valueFormatter: (params) =>
          formatRepresentative(
            ((params.value ?? []) as { name: string }[]).map((d) => d.name)
          ),
      },
    ],
    []
  );

  // ヘッダーが省略表示された場合にマウスオーバーで全文表示するため、
  // 各列に headerTooltip（=headerName）を付与する（共通ヘルパー・grid/）
  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  return (
    // ページ自体はスクロールさせず、下端の支払一覧カードだけがスクロールする構成にする。
    // 横スクロールバーがグリッド下端＝画面外へ押し出されるのを防ぐため、
    // 高さの固定値をやめて「タイトル・検索条件を引いた残り」をグリッドへ割り当てる。
    // h-full でメイン領域と同じ高さに固定する（子の高さを確定させ、グリッドの 100% 指定を効かせる）。
    // 画面が低く下限 23.75rem を割り込む場合は、はみ出した分だけメイン領域側がスクロールする。
    <div className="min-w-300 h-full flex flex-col">
      <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="支払一覧" />

        {/* 検索条件カード（支払詳細と同じ折り畳みカードで開閉可能にする） */}
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
            // クリアボタンはヘッダーバーに置き、専用の行を使わない（計画一覧と同一体裁）
            headerActions={<SearchClearButton onClick={handleClear} />}
            collapsedSummary={searchSummary}
          >
            <div className="px-4 py-1.5">
              {/* 計上年月・対象年月 ラジオボタン（年月の基準・上段に独立配置） */}
              {/* pl-[6.125rem]: ラジオを、下の検索条件の入力欄の左の線（ラベル幅 5.625rem＋間隔 0.5rem）に合わせる */}
              <RadioGroup
                value={dateBasis}
                onValueChange={setDateBasis}
                className="flex flex-row items-center gap-4 mb-2.5 pl-[6.125rem]"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem
                    value="accounting"
                    id="date-basis-accounting"
                  />
                  <label
                    htmlFor="date-basis-accounting"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap cursor-pointer`}
                  >
                    計上年月
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="target" id="date-basis-target" />
                  <label
                    htmlFor="date-basis-target"
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap cursor-pointer`}
                  >
                    対象年月
                  </label>
                </div>
              </RadioGroup>

              {/* 検索条件フィールド。計画一覧と同じ5列グリッド（→ SEARCH_GRID_CLASS）に置き、
                  画面が違っても同じ画面幅なら項目の幅・縦の線をそろえる。カテゴリは行で分ける：
                    1行目＝期間系（年月範囲）／2行目＝組織系（事業場・部署・末端組織・営業担当者）／
                    3行目＝ステータス系＋区分系（ステータス・伝票種別）／4行目＝商流系（販売店・一次店・三次店）。
                  各行の先頭の項目に col-start-1 を付けて行を折り返す。 */}
              <div className={SEARCH_GRID_CLASS}>
                {/* 期間系: 年月 [開始]～[終了]。ラベルは「年月」1つだけ置き、
                    開始～終了をセットで1項目分に置く（共通部品 SearchRangeField・部品は compact → 05）。範囲はグループにして名前を付ける */}
                <SearchRangeField
                  label="年月"
                  groupLabel="検索対象年月の範囲"
                  start={
                    <MonthYearPicker
                      className="w-full"
                      compact
                      value={yearMonthStart}
                      onChange={setYearMonthStart}
                      required={false}
                      max={yearMonthEnd || undefined}
                      clearable
                    />
                  }
                  end={
                    <MonthYearPicker
                      className="w-full"
                      compact
                      value={yearMonthEnd}
                      onChange={setYearMonthEnd}
                      required={false}
                      min={yearMonthStart || undefined}
                      clearable
                    />
                  }
                />

                {/* 組織系（列1〜4）: 事業場／部署／末端組織／営業担当者（組織階層順）。
                    複数選択で、上位・下位の選択肢を連動させる（→ utils/common/orgCascade.ts） */}
                <div className="flex items-center gap-2 col-start-1">
                  <label htmlFor="search-office" className={SEARCH_LABEL_CLASS}>
                    事業場
                  </label>
                  <MultiCombobox
                    id="search-office"
                    className="flex-1 min-w-0"
                    options={toOrgComboOptions(
                      org.options('office'),
                      'codeName'
                    )}
                    value={org.values('office')}
                    onChange={(v) => org.change('office', v)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-department"
                    className={SEARCH_LABEL_CLASS}
                  >
                    部署
                  </label>
                  <MultiCombobox
                    id="search-department"
                    className="flex-1 min-w-0"
                    options={toOrgComboOptions(
                      org.options('department'),
                      'codeName'
                    )}
                    value={org.values('department')}
                    onChange={(v) => org.change('department', v)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-terminal-org"
                    className={SEARCH_LABEL_CLASS}
                  >
                    末端組織
                  </label>
                  <MultiCombobox
                    id="search-terminal-org"
                    className="flex-1 min-w-0"
                    options={toOrgComboOptions(
                      org.options('terminalOrg'),
                      'codeName'
                    )}
                    value={org.values('terminalOrg')}
                    onChange={(v) => org.change('terminalOrg', v)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-sales-rep"
                    className={SEARCH_LABEL_CLASS}
                  >
                    営業担当者
                  </label>
                  <MultiCombobox
                    id="search-sales-rep"
                    className="flex-1 min-w-0"
                    options={toOrgComboOptions(
                      org.options('salesRep'),
                      'codeName'
                    )}
                    value={org.values('salesRep')}
                    onChange={(v) => org.change('salesRep', v)}
                    unit="名"
                  />
                </div>

                {/* ステータス系＋区分系（列1〜2・同じ行）: ステータス／伝票種別。
                    いずれも単一選択のプルダウンで、既存条件と AND で効かせる。
                    ステータスの初期値は「支払無し以外」（未選択＝「指定なし」にすると支払無しも出る）。
                    ※販売計画選択ステータスは置かない（8/18 第30回 決定事項1：支払時の計画紐づけは廃止）。 */}
                <div className="flex items-center gap-2 col-start-1">
                  <label htmlFor="search-status" className={SEARCH_LABEL_CLASS}>
                    ステータス
                  </label>
                  <SingleCombobox
                    id="search-status"
                    className="flex-1 min-w-0"
                    options={STATUS_SEARCH_OPTIONS}
                    value={status === STATUS_FILTER_ALL ? '' : status}
                    onChange={(v) => setStatus(v || STATUS_FILTER_ALL)}
                    placeholder="指定なし"
                    clearable
                    searchable={false}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-voucher-type"
                    className={SEARCH_LABEL_CLASS}
                  >
                    伝票種別
                  </label>
                  <SingleCombobox
                    id="search-voucher-type"
                    className="flex-1 min-w-0"
                    options={VOUCHER_TYPE_OPTIONS}
                    value={voucherType === VOUCHER_TYPE_ALL ? '' : voucherType}
                    onChange={(v) => setVoucherType(v || VOUCHER_TYPE_ALL)}
                    placeholder="指定なし"
                    clearable
                    searchable={false}
                  />
                </div>

                {/* 商流系（列1〜3）: 販売店／一次店／三次店。いずれも既存条件と AND。
                    販売店を選ぶと一次店・三次店の候補をその販売店の商流に絞る。
                    ※他部門受領ありは置かない（9/4 ASD結論） */}
                <div className="flex items-center gap-2 col-start-1">
                  <label
                    htmlFor="search-retailer"
                    className={SEARCH_LABEL_CLASS}
                  >
                    販売店
                  </label>
                  <div className="flex-1 min-w-0">
                    <SingleCombobox
                      id="search-retailer"
                      options={RETAILER_OPTIONS}
                      value={retailer}
                      onChange={handleRetailerChange}
                      placeholder="指定なし"
                      clearable
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-primary-store"
                    className={SEARCH_LABEL_CLASS}
                  >
                    一次店
                  </label>
                  <div className="flex-1 min-w-0">
                    <SingleCombobox
                      id="search-primary-store"
                      options={primaryStoreOptions}
                      value={primaryStore}
                      onChange={setPrimaryStore}
                      placeholder="指定なし"
                      clearable
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-tertiary-store"
                    className={SEARCH_LABEL_CLASS}
                  >
                    三次店
                  </label>
                  <div className="flex-1 min-w-0">
                    <SingleCombobox
                      id="search-tertiary-store"
                      options={tertiaryStoreOptions}
                      value={tertiaryStore}
                      onChange={setTertiaryStore}
                      placeholder="指定なし"
                      clearable
                    />
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleCard>
        </CopyableArea>

        {/* 支払申請一覧テーブル（支払詳細と同じ折り畳みカード）。
            fillParent でページの余り高さいっぱいまで広げ、スクロールはカード内の
            グリッドだけに閉じる。これで AG Grid の横スクロールバーとステータスバーが
            常に画面内に出るため、検索条件へ戻ってもスクロールバーが消えない。
            画面が低い環境の下限 23.75rem は維持し、折り畳み時は下限を外して
            ヘッダーのみの高さへ戻す。
            ＋振替追加・＋商流販売店紐づけなし支払追加はヘッダーバー（headerActions）へ配置。 */}
        <CollapsibleCard
          title="支払一覧"
          fillParent
          className="data-[state=open]:min-h-95"
          headerActions={
            <>
              {/* ＋振替追加（振替詳細画面へ遷移） */}
              <button
                onClick={handleAddTransfer}
                className="btn-toolbar-outline"
                aria-label="＋振替追加"
              >
                ＋振替追加
              </button>
              {/* ＋商流販売店紐づけなし支払追加（支払詳細(商流販売店紐づけなし)へ遷移） */}
              <button
                onClick={handleAddNoLinkPayment}
                className="btn-toolbar-outline"
                aria-label="＋商流販売店紐づけなし支払追加"
              >
                ＋商流販売店紐づけなし支払追加
              </button>
            </>
          }
          contentClassName="p-2 flex flex-col flex-1 min-h-0"
        >
          {/* グリッドはカード内の残り高さを埋める（min-h-0 が無いと flex 子要素が縮まない） */}
          <div className="flex-1 min-h-0 w-full">
            <AgGridReact<PaymentApplicationData>
              rowData={rowData}
              getRowId={getRowId}
              columnDefs={columnDefsWithTooltip}
              defaultColDef={GRID_DEFAULT_COL_DEF}
              getContextMenuItems={gridFilterContextMenuItems}
              domLayout="normal"
              animateRows={true}
              // セルレンダラーへ渡すコールバック（詳細ボタンの遷移処理）
              context={
                {
                  onDetail: handleDetail,
                } satisfies PaymentListGridContext
              }
              // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
              {...GRID_BASE_PROPS}
              // 行のどこでもダブルクリックすると詳細ボタンと同じ画面へ遷移する
              onCellDoubleClicked={handleCellDoubleClicked}
              // 分割・振替の相手方を行の展開で見せる（アコーディオン）
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
    </div>
  );
}

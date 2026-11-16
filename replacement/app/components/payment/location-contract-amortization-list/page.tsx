import {
  FileText,
  AlertCircle,
  History,
  Clock,
  Undo2,
  CheckCircle,
  Search,
  Check,
  Stamp,
  Send,
  Save,
  Trash2,
  CornerUpLeft,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type { ColDef, ColGroupDef } from 'ag-grid-community';

import { SearchRangeField } from '@/app/components/ui/search-range-field';
import { CopyableArea } from '@/app/components/ui/copyable-area';
import { Button } from '@/app/components/ui/button';
import {
  SingleCombobox,
  type SingleComboboxOption,
} from '@/app/components/ui/single-combobox';
import { MultiCombobox } from '@/app/components/ui/multi-combobox';
import {
  useOrgCascadeSearch,
  toOrgComboOptions,
} from '@/app/components/ui/use-org-cascade-search';
import type { OrgCascadeConfig } from '@/app/utils/common/orgCascade';
import type { OrgLevel } from '@/app/types/organization';
import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  gridFilterContextMenuItems,
  GRID_MONTH_TEXT_FILTER,
  GRID_EMPTY_TEXT,
  formatEmptyAsDash,
  StatusIconCellRenderer,
} from '@/app/components/grid';
import { MonthYearPicker } from '@/app/components/ui/month-year-picker';
import { Input } from '@/app/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Label } from '@/app/components/ui/label';
import { RightPane } from '@/app/components/ui/right-pane';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/app/components/ui/tabs';
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
  CARD_TITLE_CLASS,
  SEARCH_GRID_CLASS,
  SEARCH_LABEL_CLASS,
  TEXT_INPUT_CLASS,
} from '@/styles/commonStyles';
import { ScreenTitle } from '@/app/components/ui/screen-title';
import { DateMonthYearPicker } from '@/app/components/ui/date-month-year-picker';
import { useAppNavigation } from '@/app/components/ui/use-app-navigation';

// 検索条件の初期値（クリアボタンで戻す値）
const INITIAL_ACCRUAL_DATE_START = '2026/01/01';
const INITIAL_ACCRUAL_DATE_END = '2026/12/31';
const INITIAL_AMORT_PERIOD_START = '2026/01/01';
const INITIAL_AMORT_PERIOD_END = '2027/12/31';
// 選択項目の未選択（''）＝条件なし（「指定なし」）。「全て」の選択肢は持たない（→ 02 §9）
const INITIAL_CONTRACT_STATUS = '';
const INITIAL_STATUS = '';
// 事業場・部署・営業担当者（ログインユーザーの所属・本人）
const INITIAL_ORG: Partial<Record<OrgLevel, string[]>> = {
  office: ['hokkaido'],
  department: ['hokkaido-sales-1'],
  salesRep: ['yamada-taro'],
};
// 申請事業場・申請部署・申請者（申請時に確定する組織情報。選択肢は事業場等と共用）
const INITIAL_APPLICANT_ORG: Partial<Record<OrgLevel, string[]>> = {
  office: ['hokkaido'],
  department: ['hokkaido-sales-1'],
  salesRep: ['yamada-taro'],
};
// 販売店・三次店・一次店も契約状況・解約ステータスと同じく未選択（「指定なし」）を初期値にする。
const INITIAL_RETAILER = '';
const INITIAL_TERTIARY_STORE = '';
const INITIAL_PRIMARY_STORE = '';
// 摘要1（社内用）はキーワード入力のため空文字が初期値。
const INITIAL_NOTE1 = '';

// 事業場・部署・営業担当者／申請事業場・申請部署・申請者は複数選択で、
// それぞれの組で上位・下位の選択肢を連動させる（→ utils/common/orgCascade.ts。末端組織は持たない）。
// 選択肢は組織階層マスタ（constants/orgHierarchy.ts）から作り、
// 候補は2行表示（上段＝名称／下段＝コード）で名称・コードのどちらでも検索できる（→ 02 §9「選択肢の形」）。
const ORG_CASCADE_CONFIG: OrgCascadeConfig = {
  levels: ['office', 'department', 'salesRep'],
  labels: { office: '事業場', department: '部署', salesRep: '営業担当者' },
  units: { salesRep: '名' },
};
const APPLICANT_ORG_CASCADE_CONFIG: OrgCascadeConfig = {
  levels: ['office', 'department', 'salesRep'],
  labels: {
    office: '申請事業場',
    department: '申請部署',
    salesRep: '申請者',
  },
  units: { salesRep: '名' },
};

// 販売店・三次店・一次店の選択肢（事業場等と同じく「名称＋コード」の2行表示・両行検索）。
// 名称は一覧の各列に表示する値と同じものを使う（サンプルデータの生成でも共用する）。
const RETAILER_OPTIONS: SingleComboboxOption[] = [
  { value: 'seven-eleven', label: 'セブン-イレブン', code: '30200740' },
  { value: 'familymart', label: 'ファミリーマート', code: '30200741' },
  { value: 'lawson', label: 'ローソン', code: '30200742' },
  { value: 'aeon', label: 'イオン', code: '30200743' },
];
const TERTIARY_STORE_OPTIONS: SingleComboboxOption[] = [
  {
    value: 'kokubu-hokkaido',
    label: '国分北海道株式会社経営FC',
    code: '10754882',
  },
  {
    value: 'mitsubishi-hiroshima',
    label: '三菱食品株式会社広島FC',
    code: '10754883',
  },
  {
    value: 'itochu-tohoku',
    label: '伊藤忠食品株式会社東北支社',
    code: '10754884',
  },
  {
    value: 'nihon-access-shutoken',
    label: '日本アクセス株式会社首都圏支社',
    code: '10754885',
  },
];
const PRIMARY_STORE_OPTIONS: SingleComboboxOption[] = [
  { value: 'kokubu-6sha', label: '国分6社通販', code: '10010075' },
  {
    value: 'mitsubishi-kitami',
    label: '三菱食品株式会社北見営業所',
    code: '10010076',
  },
  { value: 'itochu-sapporo', label: '伊藤忠食品札幌支店', code: '10010077' },
  {
    value: 'nihon-access-sendai',
    label: '日本アクセス仙台営業所',
    code: '10010078',
  },
];

// 契約状況の選択肢（検索条件・一覧で共用）
const CONTRACT_STATUS_OPTIONS = [
  '契約中',
  '解約処理中',
  '解約処理済み',
  '契約満了',
];
// 解約ステータスの選択肢（検索条件・一覧で共用）。
// 差戻しは差戻し元の段階で分ける（承認待ちでの差戻し＝承認差戻し／検印待ちでの差戻し＝検印差戻し）。
const STATUS_OPTIONS = [
  '未申請',
  '承認待ち',
  '承認差戻し',
  '検印待ち',
  '検印差戻し',
  '検印済み',
];

// 承認者＝申請者を想定するサンプル行の連番の範囲。
// CRMコードは `CRM(1000 + 連番)` のため CRM1017〜CRM1020 が対象。
const APPLICANT_ROW_SEQ_FROM = 17;
const APPLICANT_ROW_SEQ_TO = 20;

// 解約ステータスを「未申請」で表示するサンプル行の連番。
// CRMコードは `CRM(1000 + 連番)` のため CRM1001・CRM1005・CRM1009 が対象。
const UNAPPLIED_ROW_SEQS = [1, 5, 9];

// 解約情報ペインのタブ（解約情報／コメント履歴を切り替えて表示する）
const CANCEL_PANE_TABS = [
  { value: 'info', label: '解約情報', icon: FileText },
  { value: 'history', label: 'コメント履歴', icon: History },
] as const;

type CancelPaneTab = (typeof CANCEL_PANE_TABS)[number]['value'];

// コメント履歴（モック）。解約申請〜承認のやり取りを新しい順に表示する。
// status は「その操作の後の解約ステータス」。支払詳細のコメント履歴
//（shared/common/CommentHistoryPane）と同じく、承認・検印の流れを履歴で追えるようにする。
// 差戻しは戻された段階をステータス（承認差戻し／検印差戻し）で区別する。
const CANCELLATION_COMMENT_HISTORY = [
  {
    action: '承認',
    status: '検印待ち',
    date: '2026/03/12 14:20:31',
    user: '◇山　〇郎',
    text: '',
  },
  {
    action: '申請',
    status: '承認待ち',
    date: '2026/03/12 10:05:48',
    user: '河〇　雅◇',
    text: '回収予定日を修正のうえ再申請しました',
  },
  {
    action: '差戻し',
    status: '承認差戻し',
    date: '2026/03/11 17:42:09',
    user: '◇山　〇郎',
    text: '回収予定日が請求内容と整合していないため確認すること',
  },
  {
    action: '申請',
    status: '承認待ち',
    date: '2026/03/11 09:15:22',
    user: '河〇　雅◇',
    text: '解約に伴う精算です。ご確認をお願いします',
  },
];

// 施策区分・施策コード（設置場所契約料一覧と同じ選択肢）。グリッドの表示のみに使う。
const MEASURE_CATEGORY_OPTIONS = [
  '01:本社拡売費',
  '02:支社拡売費',
  '99:その他',
];
const MEASURE_CODE_OPTIONS = [
  '001:新商品導入施策',
  '002:店頭販促施策',
  '003:価格訴求施策',
  '004:季節キャンペーン',
  '005:エリア限定施策',
];

// 解約情報ペインの選択肢
// 請求先（支払詳細(自販機)の支払先と同じ選択肢）
const BILLING_DEST_OPTIONS = [
  '1001584:AAA営業本部商品部',
  '1001585:BBB営業本部商品部',
  '1001586:CCC営業本部商品部',
];
// 請求先の検索付きドロップダウン用の選択肢。
// 保存値は "コード:名称" のまま（value）保持し、label=名称 / code=コード に分けて
// 2行表示（上段=名称・下段=コード）にする（→ 02 §9「選択肢の形」）。
const BILLING_DEST_COMBO_OPTIONS: SingleComboboxOption[] =
  BILLING_DEST_OPTIONS.map((opt) => {
    const i = opt.indexOf(':');
    return i === -1
      ? { value: opt, label: opt }
      : { value: opt, label: opt.slice(i + 1), code: opt.slice(0, i) };
  });
// 請求の有無（解約に伴う請求を行うかどうか）
const BILLING_FLAG_OPTIONS = ['有', '無'];
// 請求の有無の初期値（解約情報ペインを新規に開いたときに選択済みにする）
const DEFAULT_BILLING_FLAG = BILLING_FLAG_OPTIONS[0]; // 有

// 回収方法。解約時点で回収方法が決まっていない場合があるため「指定無し」を用意する
// （ラジオボタンは標準操作で選択解除できないため、未入力は「指定無し」で表す）。
// 「指定無し」は回収方法マスタのコードを持たない画面上の選択肢のためコードを付けない。
const COLLECTION_METHOD_OPTIONS = ['1:振込', '2:口座振替', '指定無し'];
// 回収方法の初期値（解約情報ペインを新規に開いたときに選択済みにする）
const DEFAULT_COLLECTION_METHOD = COLLECTION_METHOD_OPTIONS[0]; // 1:振込

// 解約ステータスごとのアイコン・色設定
const STATUS_CONFIG: Record<
  string,
  { icon: typeof FileText; className: string }
> = {
  // 未申請は全画面でオレンジの「！」に統一する（UI/UX UX-012）
  未申請: { icon: AlertCircle, className: 'text-orange-500' },
  承認待ち: { icon: Clock, className: 'text-blue-500' },
  // 差戻しは全画面で赤（未申請と見分ける。UI/UX UX-011）
  承認差戻し: { icon: Undo2, className: 'text-red-600' },
  検印差戻し: { icon: Undo2, className: 'text-red-600' },
  検印待ち: { icon: Stamp, className: 'text-blue-500' },
  検印済み: { icon: CheckCircle, className: 'text-green-600' },
};

// ロケ契約(償却)一覧の1行データ
interface AmortizationListData {
  id: string;
  retailer: string; // 販売店
  status: string; // 解約ステータス
  contractStatus: string; // 契約状況
  accrualDate: string; // 発生日(計上開始初月)
  paymentAmount: number; // 前払金額 (円)
  amortizedTotal: number; // 償却累計額 (円)
  measureCategory: string; // 施策区分（"コード:名称"。コード列・名称列に分けて表示）
  measureCode: string; // 施策コード（"コード:名称"。コード列・名称列に分けて表示）
  note1: string; // 摘要1（社内用）
  amortStartDate: string; // 償却期間開始
  amortEndDate: string; // 償却期間終了
  crmCode: string; // CRMコード
  tertiaryStore: string; // 三次店
  primaryStore: string; // 一次店
  // 支払No・支払回数・明細No。当該ロケ契約の前払金を計上した支払明細を特定する項目
  // （支払No＋支払回数＋明細Noの3つで1明細が定まる。支払詳細の「分割元」グループと同じ組み合わせ）。
  paymentNo: string; // 支払No
  paymentCount: number; // 支払回数
  detailNo: number; // 明細No
  mgmtCategory: string; // 管理区分（コード）
  mgmtCategoryName: string; // 管理区分名称
  mgmtCode: string; // 管理コード（コード）
  mgmtCodeName: string; // 管理コード名称
  office: string; // 事業場
  department: string; // 部署
  salesRep: string; // 営業担当者
  applicantOffice: string; // 申請事業場
  applicantDepartment: string; // 申請部署
  applicant: string; // 申請者
  // 承認者＝申請者（自分が申請した行）。自分の申請は承認できないため、承認待ちのときは
  // 承認者向けの「承認」「差戻し」に代えて申請者向けの「引戻し」ボタンを表示する。
  isApplicant?: boolean;
  // 解約情報（グリッド右端の「解約情報」グループ）
  cancellationDate: string; // 解約日
  // 計上月。回収予定日はこの年月から算出するため、解約情報で入力する
  //（→ 20260818_第31回_自販機 決定事項2・3／課題 No.0960）。
  postingMonth: string; // YYYY/MM
  billingFlag: string; // 請求（有／無）
  billingTo: string; // 請求先
  billingAmount: number | null; // 請求金額 (円)。未入力は null（グリッドでもブランク表示）
  billingContent: string; // 請求内容
  collectionMethod: string; // 回収方法
  collectionScheduledDate: string; // 回収予定日
}

// 解約ステータスを更新する操作（いずれも解約情報ペインのボタンで確定する）
type StatusAction = 'apply' | 'withdraw' | 'approve' | 'seal' | 'reject';

// 差戻し後の解約ステータス。差戻し元の解約ステータス（表示値）で分ける。
// ここに無い解約ステータスからの差戻しは想定しない（差戻しボタン自体を表示しない）。
const REJECTED_STATUS_BY_SOURCE: Record<string, string> = {
  承認待ち: '承認差戻し',
  検印待ち: '検印差戻し',
};

// 差戻しの解約ステータス（承認差戻し・検印差戻し）。差戻し先が増えても追従するよう
// REJECTED_STATUS_BY_SOURCE から導出する。
const REJECTED_STATUSES: string[] = Object.values(REJECTED_STATUS_BY_SOURCE);

// 各操作の確定時に対象行へ適用する値。操作ごとの分岐をここへ集約し、
// 解約情報ペインのボタンから参照する。
// 差戻しのみ差戻し元で結果が変わるため、ここではなく REJECTED_STATUS_BY_SOURCE で決める。
const STATUS_ACTION_NEXT_VALUES: Record<
  Exclude<StatusAction, 'reject'>,
  Partial<AmortizationListData>
> = {
  apply: { status: '承認待ち' },
  // 引戻し：申請者が自分の申請を引き戻す操作（承認待ち → 未申請）。
  withdraw: { status: '未申請' },
  approve: { status: '検印待ち' },
  // 検印：承認の次段階（最終確定）。ここで契約状況を「解約処理済み」にして解約を完了させる。
  seal: { status: '検印済み', contractStatus: '解約処理済み' },
};

// 解約情報ペインのフッターボタン。配列の並び順が画面左からの並び順
// （右端＝保存。右から順に 保存・申請・引戻し・承認・検印・差戻し・取消）。
const CANCEL_PANE_BUTTONS = [
  {
    key: 'cancelReverse',
    label: '取消',
    icon: Trash2,
    style: 'btn-action-red',
  },
  {
    key: 'reject',
    label: '差戻し',
    icon: CornerUpLeft,
    style: 'btn-action-red',
  },
  { key: 'seal', label: '検印', icon: Stamp, style: 'btn-action-green' },
  { key: 'approve', label: '承認', icon: Check, style: 'btn-action-green' },
  {
    key: 'withdraw',
    label: '引戻し',
    icon: CornerUpLeft,
    style: 'btn-action-outline-blue',
  },
  { key: 'apply', label: '申請', icon: Send, style: 'btn-action-green' },
  { key: 'save', label: '保存', icon: Save, style: 'btn-action-blue' },
] as const satisfies readonly {
  key: string;
  label: string;
  icon: typeof FileText;
  style: string;
}[];

type CancelPaneButtonKey = (typeof CANCEL_PANE_BUTTONS)[number]['key'];

// 解約ステータス（表示値）ごとの、解約情報ペインに表示するボタンと活性にするボタン。
// visible に無いボタンは非表示、visible にあって enabled に無いボタンは非活性で表示する。
const CANCEL_PANE_BUTTON_RULES: Record<
  string,
  { visible: CancelPaneButtonKey[]; enabled: CancelPaneButtonKey[] }
> = {
  // 契約中（解約ステータスなし）：解約情報を入力して保存・申請できる
  [GRID_EMPTY_TEXT]: {
    visible: ['cancelReverse', 'withdraw', 'apply', 'save'],
    enabled: ['save', 'apply'],
  },
  未申請: {
    visible: ['cancelReverse', 'withdraw', 'apply', 'save'],
    enabled: ['cancelReverse', 'apply', 'save'],
  },
  承認待ち: { visible: ['reject', 'approve'], enabled: ['reject', 'approve'] },
  承認差戻し: {
    visible: ['cancelReverse', 'withdraw', 'apply', 'save'],
    enabled: ['cancelReverse', 'apply', 'save'],
  },
  検印差戻し: {
    visible: ['cancelReverse', 'withdraw', 'apply', 'save'],
    enabled: ['cancelReverse', 'apply', 'save'],
  },
  検印待ち: { visible: ['reject', 'seal'], enabled: ['reject', 'seal'] },
};

// 承認者＝申請者の行（CRM1017〜CRM1020）は自分の申請を承認できないため、
// 承認待ちのときは承認・差戻しに代えて引戻し・取消を表示する。
// 申請・保存は申請済みで実行できないが、ボタンの並びを他ステータスと揃えるため
// 非活性で表示する（visible にあって enabled に無い＝非活性表示）。
// ここに無い解約ステータスは CANCEL_PANE_BUTTON_RULES の共通ルールに従う。
const APPLICANT_CANCEL_PANE_BUTTON_RULES: Record<
  string,
  { visible: CancelPaneButtonKey[]; enabled: CancelPaneButtonKey[] }
> = {
  承認待ち: {
    visible: ['cancelReverse', 'withdraw', 'apply', 'save'],
    enabled: ['cancelReverse', 'withdraw'],
  },
};

// ルールが無い解約ステータス（検印済み等）は契約中と同じ扱いにする。
const DEFAULT_CANCEL_PANE_BUTTON_RULE =
  CANCEL_PANE_BUTTON_RULES[GRID_EMPTY_TEXT];

// 解約情報ペインの参照専用項目（解約申請事業場・解約申請部署・解約申請者）。
// デモの表示値は行の申請事業場・申請部署・申請者と同じ値を使う。
const CANCEL_APPLICANT_FIELDS = [
  { label: '解約申請事業場', field: 'applicantOffice' },
  { label: '解約申請部署', field: 'applicantDepartment' },
  { label: '解約申請者', field: 'applicant' },
] as const satisfies readonly {
  label: string;
  field: keyof AmortizationListData;
}[];

// グリッドの context 型（セルレンダラーから呼ぶコールバックを受け渡す）
interface AmortizationListGridContext {
  onCancel: (data: AmortizationListData) => void;
  /** 支払No の押下。行データを受け取り、当該明細の支払詳細画面へ遷移する。 */
  onOpenPaymentDetail: (data: AmortizationListData) => void;
}

// 「解約情報」グループ各列の値を表示する行か判定する。
// 契約状況が「解約処理中」「解約処理済み」の行のみ表示し、「契約中」「契約満了」の行はブランクにする。
const showsCancellationInfo = (data?: AmortizationListData): boolean =>
  data?.contractStatus === '解約処理中' ||
  data?.contractStatus === '解約処理済み';

// "コード:名称" 形式から名称部分のみを取り出す（グリッド表示でコードを省く用途）。
const nameOnly = (v?: string): string => {
  if (!v) return '';
  const i = v.indexOf(':');
  return i === -1 ? v : v.slice(i + 1);
};

// "コード:名称" 形式からコード部分のみを取り出す。
// 施策区分・施策コードはコード列と名称列に分けて表示するため、名称側は nameOnly と併用する。
const codeOnly = (v?: string): string => {
  if (!v) return '';
  const i = v.indexOf(':');
  return i === -1 ? v : v.slice(0, i);
};

// 解約ステータス列の表示値を契約状況から決定する（解約ステータス列の valueGetter・操作ボタン列で共用）。
// 契約満了/契約中 → 「-」／解約処理済み → "検印済み"（検印で解約が完了するため）／
// それ以外（解約処理中等）は行の status を表示。
const effectiveDisplayStatus = (data?: AmortizationListData): string => {
  const cs = data?.contractStatus;
  if (cs === '契約満了' || cs === '契約中') return GRID_EMPTY_TEXT;
  if (cs === '解約処理済み') return '検印済み';
  return data?.status ?? '';
};

interface PaneReadOnlyBoxProps {
  value: string;
  className?: string;
}

// 入力不可のとき、入力コントロールを出さない項目（日付選択）の表示。
// 他ペインの非活性表示（bg-gray-100／border-gray-200／text-gray-500）に合わせる。
function PaneReadOnlyBox({ value, className = '' }: PaneReadOnlyBoxProps) {
  return (
    <div
      className={`h-8 flex items-center rounded-md border border-gray-200 bg-gray-100 px-3 text-sm text-gray-500 ${className}`}
    >
      {value}
    </div>
  );
}

// 入力不可の入力欄（Input）のクラス。他ペインの読み取り専用欄と同じ配色にする。
const PANE_READONLY_INPUT_CLASS = 'bg-gray-100';

interface DateCalendarInputProps {
  value: string;
  onChange: (v: string) => void;
  // 入力欄の幅（既定 w-36。検索条件では列の幅いっぱいにするため w-full を渡す）
  className?: string;
  // 検索条件の範囲指定（SearchRangeField）で1項目分に開始・終了を並べるときの詰めた形
  // （共通の年月日の部品の compact と同じ。カレンダーのアイコンなし・×はマウスを乗せたとき・×にフォーカスがあるときだけ → UX-058）
  compact?: boolean;
}

// 解約情報ペイン・検索条件の日付入力（YYYY/MM/DD）。共通部品 DateMonthYearPicker で、
// カレンダーで選ぶほかに打ち込むこともできる（→ 02 §14・UX-067）。未入力（ブランク）を許容し、×で空に戻せる。
function DateCalendarInput({
  value,
  onChange,
  // 幅は部品の既定（×付きは w-40）。w-36 に縮めると日付と×が重なり「2026/12/31」が切れる（→ UI/UX UX-092）
  className,
  compact = false,
}: DateCalendarInputProps) {
  return (
    <DateMonthYearPicker
      value={value}
      onChange={onChange}
      clearable
      compact={compact}
      className={className}
    />
  );
}

// 支払No セルのレンダラー。当該ロケ契約の前払金を計上した支払明細の
// 支払詳細画面へのリンクとして表示する。
// 遷移先で表示する明細は支払No＋支払回数＋明細Noで定まるため、行データごと context へ渡す
// （現時点は支払詳細(自販機)の固定表示。本実装で行の内容に応じた表示へ切り替える）。
const PaymentNoRenderer = (
  props: CustomCellRendererProps<AmortizationListData>
) => {
  const data = props.data;
  if (!data) return null;
  const context = props.context as AmortizationListGridContext;
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto p-0 text-blue-700"
      onClick={() => context.onOpenPaymentDetail(data)}
      aria-label={`支払No ${data.paymentNo} の支払詳細を開く`}
    >
      {data.paymentNo}
    </Button>
  );
};

// 操作ボタンセルレンダラー。押下で解約情報ペインを開くボタンのみを表示する
// （ペイン側のボタンが解約ステータスに応じて申請・承認等の操作を担う）。
// 解約ステータスが「-」（契約中＝これから解約する行）は白地・青枠でボタン名「解約」、
// それ以外（解約手続き中の行）は承認ボタンと同じ塗り緑でボタン名「参照」にする
// （どちらもアイコンは付けない）。
// 契約状況が「契約満了」「解約処理済み」の行は解約の操作対象外のため、ボタンに代えて
// 「-」を表示する（他列の対象外表示と同じ記号でそろえる）。
// クリックは context 経由のコールバックで呼ぶ。
// 再生成によるグリッド再描画を避けるためモジュールスコープに定義する。
const CancellationButtonRenderer = (
  props: CustomCellRendererProps<AmortizationListData>
) => {
  const data = props.data;
  if (!data) return null;
  if (
    data.contractStatus === '契約満了' ||
    data.contractStatus === '解約処理済み'
  ) {
    return <span className="text-gray-400">{GRID_EMPTY_TEXT}</span>;
  }
  const context = props.context as AmortizationListGridContext;
  // 契約中（解約ステータス「-」）はこれから解約する行なので青枠＋「解約」、
  // 解約手続き中の行は入力済みの解約情報を見る操作のため塗り緑＋「参照」。
  const isBeforeCancellation = effectiveDisplayStatus(data) === GRID_EMPTY_TEXT;
  const colorClass = isBeforeCancellation
    ? BUTTON_STYLES.outline
    : BUTTON_STYLES.approve;
  const label = isBeforeCancellation ? '解約' : '参照';
  // セルは flex にしない（→ 02 §7）。縦中央寄せはレンダラーのルートで行う
  return (
    <div className="flex h-full items-center justify-center">
      <button
        className={`${colorClass} h-7 flex-shrink-0 rounded-full px-3 py-0.5 text-sm font-medium whitespace-nowrap transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none`}
        onClick={() => context.onCancel(data)}
      >
        {label}
      </button>
    </div>
  );
};

// ヘッダーが省略表示された場合にマウスオーバーで全文表示するため、
// 各列（グループ列の子も含む）に headerTooltip（=headerName）を再帰付与する。
type AmortColDef =
  | ColDef<AmortizationListData>
  | ColGroupDef<AmortizationListData>;
const addHeaderTooltips = (cols: AmortColDef[]): AmortColDef[] =>
  cols.map((col) => {
    const headerTooltip =
      typeof col.headerName === 'string' ? col.headerName : undefined;
    if ('children' in col) {
      return {
        ...col,
        headerTooltip,
        children: addHeaderTooltips(col.children as AmortColDef[]),
      };
    }
    return { ...col, headerTooltip };
  });

export default function LocationContractAmortizationList() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）。
  // ※ 列の追加・削除・並び順・固定（pinned）を変更したときは、利用者のブラウザに
  //   残った旧構成の列状態が復元されて表示が崩れるのを防ぐため、キー末尾の
  //   バージョン（現在 v20）を上げること。列名の変更のみなら更新は不要。
  const gridColumnStateProps = useGridColumnState(
    'locationContractAmortizationList.columnState.v20'
  );

  // 検索条件の状態管理
  const [accrualDateStart, setAccrualDateStart] = useState(
    INITIAL_ACCRUAL_DATE_START
  );
  const [accrualDateEnd, setAccrualDateEnd] = useState(
    INITIAL_ACCRUAL_DATE_END
  );
  // 償却期間（開始年月日 ～ 終了年月日）
  const [amortPeriodStart, setAmortPeriodStart] = useState(
    INITIAL_AMORT_PERIOD_START
  );
  const [amortPeriodEnd, setAmortPeriodEnd] = useState(
    INITIAL_AMORT_PERIOD_END
  );
  const [contractStatus, setContractStatus] = useState(INITIAL_CONTRACT_STATUS);
  const [status, setStatus] = useState(INITIAL_STATUS);
  // 組織項目（事業場→部署→営業担当者／申請事業場→申請部署→申請者）は複数選択・連動フィルタリング
  // （未選択＝条件なし）。※現状は一覧の絞り込みには使わない（UIのみ）
  const org = useOrgCascadeSearch(ORG_CASCADE_CONFIG, INITIAL_ORG);
  const applicantOrg = useOrgCascadeSearch(
    APPLICANT_ORG_CASCADE_CONFIG,
    INITIAL_APPLICANT_ORG
  );
  const [retailer, setRetailer] = useState(INITIAL_RETAILER);
  const [tertiaryStore, setTertiaryStore] = useState(INITIAL_TERTIARY_STORE);
  const [primaryStore, setPrimaryStore] = useState(INITIAL_PRIMARY_STORE);
  const [note1, setNote1] = useState(INITIAL_NOTE1);

  // サンプルデータ（仮データ・後ほど正式データを指定予定）
  const generateSampleData = (): AmortizationListData[] => {
    const offices = ['北海道支社', '東北支社', '首都圏支社', '近畿圏支社'];
    const departments = [
      '北海道営業一部',
      '東北営業一部',
      '首都圏営業一部',
      '近畿圏営業一部',
    ];
    const salesReps = ['山田 太郎', '佐藤 花子', '鈴木 一郎', '田中 美咲'];
    // 販売店・三次店・一次店は検索条件のドロップダウンと同じ名称を使う（選択肢を単一ソースにする）。
    const retailers = RETAILER_OPTIONS.map((o) => o.label);
    const tertiaryStores = TERTIARY_STORE_OPTIONS.map((o) => o.label);
    const primaryStores = PRIMARY_STORE_OPTIONS.map((o) => o.label);
    // 管理コード（コード:名称）。行ごとに循環して割り当てる。
    const mgmtCodes = [
      { code: '10010', name: '本社' },
      { code: '10020', name: '支社Ａ　自販機部門' },
      { code: '10180', name: '支社Ｂ自販機（共通）' },
      { code: '10210', name: '支社Ｂ開発（開拓）' },
    ];
    const data: AmortizationListData[] = [];
    for (let i = 1; i <= 20; i++) {
      const month = ((i % 12) + 1).toString().padStart(2, '0');
      // 承認者＝申請者を想定した行（引戻しの動きを確認するため解約ステータスを「承認待ち」で固定する）。
      // 契約状況は通常の循環値のままとし、CRM1017＝解約処理中／CRM1018＝解約処理済み／
      // CRM1019＝契約満了／CRM1020＝契約中 を表示する。
      const isApplicant =
        i >= APPLICANT_ROW_SEQ_FROM && i <= APPLICANT_ROW_SEQ_TO;
      const contractStatus =
        CONTRACT_STATUS_OPTIONS[i % CONTRACT_STATUS_OPTIONS.length];
      const paymentAmount = (i * 12345) % 1000000;
      // 解約処理中かつ UNAPPLIED_ROW_SEQS の行は「未申請」、それ以外は通常の循環値。
      const status = isApplicant
        ? '承認待ち'
        : contractStatus === '解約処理中' && UNAPPLIED_ROW_SEQS.includes(i)
          ? '未申請'
          : STATUS_OPTIONS[i % STATUS_OPTIONS.length];
      data.push({
        id: String(i),
        retailer: retailers[i % retailers.length],
        status,
        contractStatus,
        accrualDate: `2026/${month}/01`,
        paymentAmount,
        // デモ用の償却累計額：契約満了は全額償却済み、それ以外は前払金額の60%とする。
        amortizedTotal:
          contractStatus === '契約満了'
            ? paymentAmount
            : Math.round(paymentAmount * 0.6),
        measureCategory:
          MEASURE_CATEGORY_OPTIONS[i % MEASURE_CATEGORY_OPTIONS.length],
        measureCode: MEASURE_CODE_OPTIONS[i % MEASURE_CODE_OPTIONS.length],
        note1: `ロケ契約料前払い ${i} 件目`,
        amortStartDate: `2026/${month}/01`,
        amortEndDate: `2027/${month}/01`,
        crmCode: `CRM${String(1000 + i)}`,
        tertiaryStore: tertiaryStores[i % tertiaryStores.length],
        primaryStore: primaryStores[i % primaryStores.length],
        // 支払No は支払詳細画面のダミー値と同じ「C2400NTO＋連番」形式（全10桁。
        // 連番は下2桁で、1桁の行は頭を0で埋める）。
        // 支払回数・明細No は行ごとに循環させたダミー値。
        paymentNo: `C2400NTO${String(i).padStart(2, '0')}`,
        paymentCount: ((i - 1) % 3) + 1,
        detailNo: ((i - 1) % 5) + 1,
        mgmtCategory: '604',
        mgmtCategoryName: 'ロケ契約料他前払い金(償却)',
        mgmtCode: mgmtCodes[i % mgmtCodes.length].code,
        mgmtCodeName: mgmtCodes[i % mgmtCodes.length].name,
        office: offices[i % offices.length],
        department: departments[i % departments.length],
        salesRep: salesReps[i % salesReps.length],
        // 申請時の組織情報は事業場・部署・営業担当者と同じ値を表示する
        applicantOffice: offices[i % offices.length],
        applicantDepartment: departments[i % departments.length],
        applicant: salesReps[i % salesReps.length],
        isApplicant,
        cancellationDate: `2026/${month}/15`,
        postingMonth: `2026/${month}`,
        billingFlag: DEFAULT_BILLING_FLAG,
        billingTo: BILLING_DEST_OPTIONS[i % BILLING_DEST_OPTIONS.length],
        billingAmount: (i * 6789) % 1000000,
        billingContent: `ロケ契約解約精算`,
        collectionMethod:
          COLLECTION_METHOD_OPTIONS[i % COLLECTION_METHOD_OPTIONS.length],
        collectionScheduledDate: `2026/${month}/28`,
      });
    }
    return data;
  };

  const [rowData, setRowData] =
    useState<AmortizationListData[]>(generateSampleData());

  // 解約情報ペイン（右スライド）の開閉・対象行・入力値
  const [isCancelPaneOpen, setIsCancelPaneOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cxDate, setCxDate] = useState(''); // 解約日
  const [cxPostingMonth, setCxPostingMonth] = useState(''); // 計上月
  const [cxBillingFlag, setCxBillingFlag] = useState(DEFAULT_BILLING_FLAG); // 請求
  const [cxBillingTo, setCxBillingTo] = useState(''); // 請求先
  const [cxBillingAmount, setCxBillingAmount] = useState(''); // 請求金額
  const [cxBillingContent, setCxBillingContent] = useState(''); // 請求内容
  const [cxCollectionMethod, setCxCollectionMethod] = useState(''); // 回収方法
  const [cxCollectionDate, setCxCollectionDate] = useState(''); // 回収予定日
  const [cxComment, setCxComment] = useState(''); // コメント（差戻し理由など）

  // 解約情報ペイン内のタブ（解約情報／コメント履歴）。ペインを開くたびに解約情報へ戻す。
  const [cancelPaneTab, setCancelPaneTab] = useState<CancelPaneTab>('info');

  // クリアボタン押下処理（検索条件を初期値に戻す）。
  // 組織項目は未選択（指定なし）にする（決定事項No.774・No.783）
  // 検索条件カードを折り畳んだときに見出しの行へ出す要約（値が入っている項目だけ。UI/UX UX-024）
  const searchSummary = buildSearchSummary([
    {
      label: '発生日',
      value: formatSummaryRange(accrualDateStart, accrualDateEnd),
    },
    {
      label: '償却期間',
      value: formatSummaryRange(amortPeriodStart, amortPeriodEnd),
    },
    { label: '契約状況', value: contractStatus },
    { label: '解約ステータス', value: status },
    { label: '販売店', value: formatSummaryValue(retailer, RETAILER_OPTIONS) },
    {
      label: '三次店',
      value: formatSummaryValue(tertiaryStore, TERTIARY_STORE_OPTIONS),
    },
    {
      label: '一次店',
      value: formatSummaryValue(primaryStore, PRIMARY_STORE_OPTIONS),
    },
    { label: '摘要1（社内用）', value: note1 },
    ...org.summaryItems(),
    ...applicantOrg.summaryItems(),
  ]);

  const handleClear = () => {
    setAccrualDateStart(INITIAL_ACCRUAL_DATE_START);
    setAccrualDateEnd(INITIAL_ACCRUAL_DATE_END);
    setAmortPeriodStart(INITIAL_AMORT_PERIOD_START);
    setAmortPeriodEnd(INITIAL_AMORT_PERIOD_END);
    setContractStatus(INITIAL_CONTRACT_STATUS);
    setStatus(INITIAL_STATUS);
    org.reset();
    applicantOrg.reset();
    setRetailer(INITIAL_RETAILER);
    setTertiaryStore(INITIAL_TERTIARY_STORE);
    setPrimaryStore(INITIAL_PRIMARY_STORE);
    setNote1(INITIAL_NOTE1);
  };

  // 解約情報ペインを閉じる（ペインの✕・保存・取消・解約ステータス操作で共用）。
  const handleCloseCancelPane = () => {
    setIsCancelPaneOpen(false);
  };

  // 解約情報ペインの操作ボタン（申請・引戻し・承認・検印・差戻し）押下：
  // その場で対象行の解約ステータスを更新してペインを閉じる（コメントはペインの入力欄で受け付ける）。
  const handleCancelPaneStatusAction = (action: StatusAction) => {
    if (cancelTargetId == null) return;
    // 解約ステータス＝「-」（契約中）からの申請は、入力内容の反映と契約状況の更新
    // （＝保存と同じ処理）を行ってから申請する。これで「未申請」からの申請と同じ結果になる。
    const baseValues =
      action === 'apply' && cancelTargetStatus === GRID_EMPTY_TEXT
        ? cancelFormValues()
        : {};
    // 差戻しは差戻し元の解約ステータスで結果が分かれる
    // （承認待ち → 承認差戻し／検印待ち → 検印差戻し）。
    const nextValues =
      action === 'reject'
        ? { status: REJECTED_STATUS_BY_SOURCE[cancelTargetStatus] }
        : STATUS_ACTION_NEXT_VALUES[action];
    setRowData((prev) =>
      prev.map((row) =>
        row.id === cancelTargetId
          ? { ...row, ...baseValues, ...nextValues }
          : row
      )
    );
    handleCloseCancelPane();
  };

  // 解約情報ペインのフッターボタンの表示・活性ルール。対象行の解約ステータスで決まり、
  // 承認者＝申請者の行（CRM1017〜CRM1020）は専用ルールを優先する。
  const cancelTargetRow = rowData.find((row) => row.id === cancelTargetId);
  const cancelTargetStatus = effectiveDisplayStatus(cancelTargetRow);
  const cancelPaneButtonRule =
    (cancelTargetRow?.isApplicant
      ? APPLICANT_CANCEL_PANE_BUTTON_RULES[cancelTargetStatus]
      : undefined) ??
    CANCEL_PANE_BUTTON_RULES[cancelTargetStatus] ??
    DEFAULT_CANCEL_PANE_BUTTON_RULE;

  // 解約情報ペインの入力項目（コメント欄を除く）を編集できる解約ステータス。
  // 「-」（契約中）・未申請＝申請前、差戻し（承認差戻し・検印差戻し）＝再申請に向けて修正できる。
  // それ以外（承認待ち・検印待ち・検印済み）は申請済みのため入力不可にする。
  const cancelFieldsDisabled = !(
    cancelTargetStatus === GRID_EMPTY_TEXT ||
    cancelTargetStatus === '未申請' ||
    REJECTED_STATUSES.includes(cancelTargetStatus)
  );

  // 解約情報ペインのフッターボタン押下の振り分け（保存・取消・解約ステータス操作）。
  const handleCancelPaneButtonClick = (key: CancelPaneButtonKey) => {
    if (key === 'save') return handleCancelSubmit();
    if (key === 'cancelReverse') return handleCancelReverse();
    return handleCancelPaneStatusAction(key);
  };

  // 支払No 押下：当該ロケ契約の前払金を計上した支払明細の支払詳細画面へ遷移する。
  // 本来は行の支払No・支払回数・明細Noで表示する明細を特定するが、現時点は
  // 支払詳細(自販機)の固定表示のため引数は使わない（本実装で遷移先へ引き継ぐ）。
  const handleOpenPaymentDetail = (_data: AmortizationListData) => {
    navigate('payment-detail-vending');
  };

  // 解約情報ボタン押下：解約情報ペインを開く（タブは常に「解約情報」から表示する）。
  // 解約情報が表示される行（解約処理中／解約処理済み）のみ現在値をプリセットし、
  // それ以外（契約中）はブランクで開く。
  // ただし請求金額（＝前払金額－償却累計額）と回収方法（振込）は初期値を入れる。
  // 保存済みの行では保存値をそのまま復元する。請求金額はブランク保存（null）も
  // 入力値のひとつなので、初期値へ戻さずブランクのまま開く。
  const handleCancel = (data: AmortizationListData) => {
    const hasInfo = showsCancellationInfo(data);
    // 請求金額の初期値：未償却残＝前払金額－償却累計額（マイナスにはしない）
    const unamortizedAmount = Math.max(
      (data.paymentAmount ?? 0) - (data.amortizedTotal ?? 0),
      0
    );
    setCancelTargetId(data.id);
    setCxDate(hasInfo ? (data.cancellationDate ?? '') : '');
    setCxPostingMonth(hasInfo ? (data.postingMonth ?? '') : '');
    setCxBillingFlag(
      hasInfo && data.billingFlag ? data.billingFlag : DEFAULT_BILLING_FLAG
    );
    setCxBillingTo(hasInfo ? (data.billingTo ?? '') : '');
    setCxBillingAmount(
      hasInfo
        ? (data.billingAmount?.toLocaleString() ?? '')
        : unamortizedAmount.toLocaleString()
    );
    setCxBillingContent(hasInfo ? (data.billingContent ?? '') : '');
    setCxCollectionMethod(
      hasInfo && data.collectionMethod
        ? data.collectionMethod
        : DEFAULT_COLLECTION_METHOD
    );
    setCxCollectionDate(hasInfo ? (data.collectionScheduledDate ?? '') : '');
    setCxComment(''); // コメントは毎回入力するためブランクで開く
    setCancelPaneTab('info'); // 開くたびに解約情報タブから表示する
    setIsCancelPaneOpen(true);
  };

  // 解約情報ペインの入力内容を対象行へ反映する値。契約状況を「解約処理中」にすることで
  // 解約情報の各セルが表示される。
  // 解約ステータスは、差戻し（承認差戻し・検印差戻し）の行は保存で変えずそのまま据え置き、
  // それ以外（契約中・未申請）は「未申請」にする。
  // 請求有無＝無の場合は請求先〜回収予定日を非表示にしているため、空にして反映する。
  const cancelFormValues = (): Partial<AmortizationListData> => {
    const hasBilling = cxBillingFlag === '有';
    return {
      contractStatus: '解約処理中',
      status: REJECTED_STATUSES.includes(cancelTargetStatus)
        ? cancelTargetStatus
        : '未申請',
      cancellationDate: cxDate,
      postingMonth: cxPostingMonth,
      billingFlag: cxBillingFlag,
      billingTo: hasBilling ? cxBillingTo : '',
      // 未入力はブランクのまま保持する（0円として扱わない）
      billingAmount:
        !hasBilling || cxBillingAmount.trim() === ''
          ? null
          : Number(cxBillingAmount.replace(/,/g, '')) || 0,
      billingContent: hasBilling ? cxBillingContent : '',
      collectionMethod: hasBilling ? cxCollectionMethod : '',
      collectionScheduledDate: hasBilling ? cxCollectionDate : '',
    };
  };

  // 解約情報ペインの「保存」押下：入力内容を対象行の解約情報の各セルへ反映する
  // （これにより解約情報の各セルが表示され、以降は解約ステータスに応じたボタンが並ぶ）。
  const handleCancelSubmit = () => {
    if (cancelTargetId == null) return;
    setRowData((prev) =>
      prev.map((row) =>
        row.id === cancelTargetId ? { ...row, ...cancelFormValues() } : row
      )
    );
    handleCloseCancelPane();
  };

  // 解約情報ペインの「取消」押下：対象行の契約状況を「契約中」に戻す
  // （契約状況が契約中になると解約ステータスは自動的に「-」になる）。
  const handleCancelReverse = () => {
    if (cancelTargetId == null) return;
    setRowData((prev) =>
      prev.map((row) =>
        row.id === cancelTargetId ? { ...row, contractStatus: '契約中' } : row
      )
    );
    handleCloseCancelPane();
  };

  // AG Grid列定義
  const columnDefs: AmortColDef[] = useMemo(
    () => [
      {
        headerName: '販売店',
        field: 'retailer',
        cellClass: 'cell-left',
        // 横スクロール時も左端に固定表示する
        lockPinned: true,
        lockPosition: 'left',
      },
      {
        headerName: '三次店',
        field: 'tertiaryStore',
        cellClass: 'cell-left',
      },
      {
        headerName: '一次店',
        field: 'primaryStore',
        cellClass: 'cell-left',
      },
      // 支払No・支払回数・明細No：当該ロケ契約の前払金を計上した支払明細を特定する3項目。
      {
        headerName: '支払No',
        field: 'paymentNo',
        cellClass: 'cell-left',
        cellRenderer: PaymentNoRenderer,
      },
      {
        headerName: '支払回数',
        field: 'paymentCount',
        cellClass: 'cell-right',
      },
      {
        headerName: '明細No',
        field: 'detailNo',
        cellClass: 'cell-right',
      },
      // 管理区分・管理コードの4列は解約情報グループ配下の各列と同様、列定義は残したまま
      // 非表示（hide）にする。列メニューの列選択から表示へ戻せる。
      {
        headerName: '管理区分',
        field: 'mgmtCategory',
        cellClass: 'cell-left',
        hide: true,
      },
      {
        headerName: '管理区分名称',
        field: 'mgmtCategoryName',
        cellClass: 'cell-left',
        hide: true,
      },
      {
        headerName: '管理コード',
        field: 'mgmtCode',
        cellClass: 'cell-left',
        hide: true,
      },
      {
        headerName: '管理コード名称',
        field: 'mgmtCodeName',
        cellClass: 'cell-left',
        hide: true,
      },
      {
        headerName: '発生日',
        field: 'accrualDate',
        cellClass: 'cell-left',
      },
      {
        headerName: '前払金額 (円)',
        field: 'paymentAmount',
        cellClass: 'cell-right',
        valueFormatter: (params) =>
          params.value?.toLocaleString() || GRID_EMPTY_TEXT,
      },
      {
        headerName: '償却累計額 (円)',
        field: 'amortizedTotal',
        cellClass: 'cell-right',
        valueFormatter: (params) =>
          params.value?.toLocaleString() || GRID_EMPTY_TEXT,
      },
      // 施策区分・施策コードは "コード:名称" の1値を、コード列と名称列に分けて表示する。
      {
        headerName: '施策区分',
        colId: 'measureCategoryCode',
        field: 'measureCategory',
        cellClass: 'cell-left',
        valueFormatter: (params) => codeOnly(params.value) || GRID_EMPTY_TEXT,
      },
      {
        headerName: '施策区分名称',
        colId: 'measureCategoryName',
        field: 'measureCategory',
        cellClass: 'cell-left',
        valueFormatter: (params) => nameOnly(params.value) || GRID_EMPTY_TEXT,
      },
      {
        headerName: '施策コード',
        colId: 'measureCodeCode',
        field: 'measureCode',
        cellClass: 'cell-left',
        valueFormatter: (params) => codeOnly(params.value) || GRID_EMPTY_TEXT,
      },
      {
        headerName: '施策コード名称',
        colId: 'measureCodeName',
        field: 'measureCode',
        cellClass: 'cell-left',
        valueFormatter: (params) => nameOnly(params.value) || GRID_EMPTY_TEXT,
      },
      {
        headerName: '摘要1（社内用）',
        field: 'note1',
        cellClass: 'cell-left',
        // 長文は「…」で省略表示し、マウスオーバーでツールチップに全文を表示する
        tooltipField: 'note1',
      },
      {
        headerName: '償却期間開始',
        field: 'amortStartDate',
        cellClass: 'cell-left',
      },
      {
        headerName: '償却期間終了',
        field: 'amortEndDate',
        cellClass: 'cell-left',
      },
      {
        headerName: 'CRMコード',
        field: 'crmCode',
        cellClass: 'cell-left',
      },
      {
        headerName: '契約状況',
        field: 'contractStatus',
        cellClass: 'cell-left',
      },
      {
        headerName: '解約ステータス',
        field: 'status',
        cellRenderer: StatusIconCellRenderer,
        cellRendererParams: { statusConfig: STATUS_CONFIG },
        cellClass: 'cell-left',
        // 表示値は契約状況から決定する（操作ボタン列と共用のヘルパー）。
        valueGetter: (params) => effectiveDisplayStatus(params.data),
      },
      {
        headerName: '事業場',
        field: 'office',
        cellClass: 'cell-left',
      },
      {
        headerName: '部署',
        field: 'department',
        cellClass: 'cell-left',
      },
      {
        headerName: '営業担当者',
        field: 'salesRep',
        cellClass: 'cell-left',
      },
      {
        headerName: '申請事業場',
        field: 'applicantOffice',
        cellClass: 'cell-left',
      },
      {
        headerName: '申請部署',
        field: 'applicantDepartment',
        cellClass: 'cell-left',
      },
      {
        headerName: '申請者',
        field: 'applicant',
        cellClass: 'cell-left',
      },
      // 解約情報グループ（グリッド右端・2階層ヘッダーでまとめる）
      {
        headerName: '解約情報',
        children: [
          // 解約情報の各列は表示のみ（編集不可）。解約情報ペインで入力した内容を表示する。
          // 契約状況が契約中・契約満了の行は「-」。
          // ※ 全列を非表示（hide）にしているため、グループヘッダーごとグリッドには表示されない。
          {
            headerName: '解約日',
            field: 'cancellationDate',
            cellClass: 'cell-left',
            hide: true,
            valueFormatter: (params) =>
              showsCancellationInfo(params.data)
                ? formatEmptyAsDash(params)
                : GRID_EMPTY_TEXT,
          },
          {
            // 回収予定日の算出元（→ 20260818_第31回_自販機 決定事項2・3）。
            headerName: '計上月',
            field: 'postingMonth',
            ...GRID_MONTH_TEXT_FILTER,
            cellClass: 'cell-left',
            hide: true,
            valueFormatter: (params) =>
              showsCancellationInfo(params.data)
                ? formatEmptyAsDash(params)
                : GRID_EMPTY_TEXT,
          },
          {
            // 請求有無（解約に伴う請求の有無。解約情報ペインのラジオボタンで選ぶ）
            headerName: '請求有無',
            field: 'billingFlag',
            cellClass: 'cell-left',
            hide: true,
            valueFormatter: (params) =>
              showsCancellationInfo(params.data)
                ? formatEmptyAsDash(params)
                : GRID_EMPTY_TEXT,
          },
          {
            headerName: '請求先',
            field: 'billingTo',
            cellClass: 'cell-left',
            hide: true,
            // コードは表示せず名称のみ表示
            valueFormatter: (params) =>
              showsCancellationInfo(params.data)
                ? nameOnly(params.value) || GRID_EMPTY_TEXT
                : GRID_EMPTY_TEXT,
          },
          {
            headerName: '請求金額 (円)',
            field: 'billingAmount',
            cellClass: 'cell-right',
            hide: true,
            valueFormatter: (params) =>
              showsCancellationInfo(params.data)
                ? params.value?.toLocaleString() || GRID_EMPTY_TEXT
                : GRID_EMPTY_TEXT,
          },
          {
            headerName: '請求内容',
            field: 'billingContent',
            cellClass: 'cell-left',
            hide: true,
            valueFormatter: (params) =>
              showsCancellationInfo(params.data)
                ? formatEmptyAsDash(params)
                : GRID_EMPTY_TEXT,
          },
          {
            headerName: '回収方法',
            field: 'collectionMethod',
            cellClass: 'cell-left',
            hide: true,
            // コードは表示せず名称のみ表示
            valueFormatter: (params) =>
              showsCancellationInfo(params.data)
                ? nameOnly(params.value) || GRID_EMPTY_TEXT
                : GRID_EMPTY_TEXT,
          },
          {
            headerName: '回収予定日',
            field: 'collectionScheduledDate',
            cellClass: 'cell-left',
            hide: true,
            valueFormatter: (params) =>
              showsCancellationInfo(params.data)
                ? formatEmptyAsDash(params)
                : GRID_EMPTY_TEXT,
          },
          // 解約申請事業場・解約申請部署・解約申請者。デモの表示値は申請事業場・申請部署・
          // 申請者と同じ列を参照するため、列の並び順を保存できるよう colId を明示する
          //（同じ field を持つ列が複数あると自動採番の colId が安定しないため）。
          {
            headerName: '解約申請事業場',
            colId: 'cancelApplicantOffice',
            field: 'applicantOffice',
            cellClass: 'cell-left',
            hide: true,
            valueFormatter: (params) =>
              showsCancellationInfo(params.data)
                ? formatEmptyAsDash(params)
                : GRID_EMPTY_TEXT,
          },
          {
            headerName: '解約申請部署',
            colId: 'cancelApplicantDepartment',
            field: 'applicantDepartment',
            cellClass: 'cell-left',
            hide: true,
            valueFormatter: (params) =>
              showsCancellationInfo(params.data)
                ? formatEmptyAsDash(params)
                : GRID_EMPTY_TEXT,
          },
          {
            headerName: '解約申請者',
            colId: 'cancelApplicant',
            field: 'applicant',
            cellClass: 'cell-left',
            hide: true,
            valueFormatter: (params) =>
              showsCancellationInfo(params.data)
                ? formatEmptyAsDash(params)
                : GRID_EMPTY_TEXT,
          },
        ],
      },
      // 操作ボタン列（右端固定）。表示するボタンは行の状態に応じてレンダラー側で決定する。
      {
        headerName: '解約',
        colId: 'cancel',
        cellRenderer: CancellationButtonRenderer,
        // 常に右端に固定し、他列より後ろへ移動できないようにする
        pinned: 'right',
        lockPinned: true,
        lockPosition: 'right',
        sortable: false,
        filter: false,
        suppressMovable: true,
        resizable: false,
        // ボタン名が2文字（解約／参照）のため、ボタンとヘッダーが収まる最小限の幅にする
        width: 64,
        minWidth: 64,
        maxWidth: 64,
        suppressSizeToFit: true,
        cellClass: 'cell-center',
        cellStyle: {
          padding: '0',
        },
      },
    ],
    []
  );

  const columnDefsWithTooltip = useMemo(
    () => addHeaderTooltips(columnDefs),
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
        <ScreenTitle title="ロケ契約(償却)一覧" />

        {/* 検索条件カード（詳細画面と同じ折り畳みカードで開閉可能にする） */}
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
              {/* 検索条件フィールド。計画一覧と同じ5列グリッド（→ SEARCH_GRID_CLASS）に置き、
                  画面が違っても同じ画面幅なら項目の幅・縦の線をそろえる（各セル＝ラベル＋入力欄）。
                  1行目＝発生日・償却期間・契約状況（範囲指定は開始～終了をセットで1項目分）／2行目＝解約ステータス・販売店・三次店・一次店・摘要１／
                  3行目＝事業場・部署・営業担当者／4行目＝申請事業場・申請部署・申請者 */}
              <div className={SEARCH_GRID_CLASS}>
                {/* 1行目1列目: 発生日（開始 ～ 終了）。年月日（YYYY/MM/DD）で範囲指定する。
                    開始～終了をセットで1項目分に置く（共通部品 SearchRangeField・部品は compact → 05）。
                    カレンダーの操作は解約情報ペインの解約日と揃えるため、
                    同じ DateCalendarInput を使う（未指定で絞り込まないので×でクリアできる）。 */}
                <SearchRangeField
                  wide
                  label="発生日"
                  groupLabel="検索発生日の範囲"
                  start={
                    <DateCalendarInput
                      className="w-full"
                      compact
                      value={accrualDateStart}
                      onChange={setAccrualDateStart}
                    />
                  }
                  end={
                    <DateCalendarInput
                      className="w-full"
                      compact
                      value={accrualDateEnd}
                      onChange={setAccrualDateEnd}
                    />
                  }
                />

                {/* 1行目2列目: 償却期間（開始年月日 ～ 終了年月日）。年月日（YYYY/MM/DD）で範囲指定する。
                    発生日と同じく、解約日と揃えた DateCalendarInput を使う。 */}
                <SearchRangeField
                  wide
                  label="償却期間"
                  groupLabel="検索償却期間の範囲"
                  start={
                    <DateCalendarInput
                      className="w-full"
                      compact
                      value={amortPeriodStart}
                      onChange={setAmortPeriodStart}
                    />
                  }
                  end={
                    <DateCalendarInput
                      className="w-full"
                      compact
                      value={amortPeriodEnd}
                      onChange={setAmortPeriodEnd}
                    />
                  }
                />

                {/* 1行目3列目: 契約状況 */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="search-contract-status"
                    className={SEARCH_LABEL_CLASS}
                  >
                    契約状況
                  </label>
                  <SingleCombobox
                    id="search-contract-status"
                    className="flex-1 min-w-0"
                    options={CONTRACT_STATUS_OPTIONS.map((opt) => ({
                      value: opt,
                      label: opt,
                    }))}
                    value={contractStatus}
                    onChange={setContractStatus}
                    placeholder="指定なし"
                    clearable
                    searchable={false}
                  />
                </div>

                {/* 2行目1列目: 解約ステータス（col-start-1 で2行目の先頭から並べる） */}
                <div className="flex items-center gap-2 col-start-1">
                  <label htmlFor="search-status" className={SEARCH_LABEL_CLASS}>
                    解約ステータス
                  </label>
                  <SingleCombobox
                    id="search-status"
                    className="flex-1 min-w-0"
                    options={STATUS_OPTIONS.map((opt) => ({
                      value: opt,
                      label: opt,
                    }))}
                    value={status}
                    onChange={setStatus}
                    placeholder="指定なし"
                    clearable
                    searchable={false}
                  />
                </div>

                {/* 2行目2列目: 販売店 */}
                {/* SingleCombobox は id/aria-label 非対応のためグループ化して名前付け */}
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-labelledby="label-retailer"
                >
                  <label
                    htmlFor="search-retailer"
                    id="label-retailer"
                    className={SEARCH_LABEL_CLASS}
                  >
                    販売店
                  </label>
                  <div className="flex-1 min-w-0">
                    <SingleCombobox
                      id="search-retailer"
                      options={RETAILER_OPTIONS}
                      value={retailer}
                      onChange={setRetailer}
                      placeholder="指定なし"
                      clearable
                    />
                  </div>
                </div>

                {/* 2行目3列目: 三次店 */}
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-labelledby="label-tertiary-store"
                >
                  <label
                    htmlFor="search-tertiary-store"
                    id="label-tertiary-store"
                    className={SEARCH_LABEL_CLASS}
                  >
                    三次店
                  </label>
                  <div className="flex-1 min-w-0">
                    <SingleCombobox
                      id="search-tertiary-store"
                      options={TERTIARY_STORE_OPTIONS}
                      value={tertiaryStore}
                      onChange={setTertiaryStore}
                      placeholder="指定なし"
                      clearable
                    />
                  </div>
                </div>

                {/* 2行目4列目: 一次店 */}
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-labelledby="label-primary-store"
                >
                  <label
                    htmlFor="search-primary-store"
                    id="label-primary-store"
                    className={SEARCH_LABEL_CLASS}
                  >
                    一次店
                  </label>
                  <div className="flex-1 min-w-0">
                    <SingleCombobox
                      id="search-primary-store"
                      options={PRIMARY_STORE_OPTIONS}
                      value={primaryStore}
                      onChange={setPrimaryStore}
                      placeholder="指定なし"
                      clearable
                    />
                  </div>
                </div>

                {/* 2行目5列目: 摘要1（社内用）（キーワード入力） */}
                <div className="flex items-center gap-2">
                  <label htmlFor="search-note1" className={SEARCH_LABEL_CLASS}>
                    摘要1（社内用）
                  </label>
                  <Input
                    id="search-note1"
                    className={`${TEXT_INPUT_CLASS} flex-1 min-w-0`}
                    value={note1}
                    onChange={(e) => setNote1(e.target.value)}
                  />
                </div>

                {/* 3行目1列目: 事業場 */}
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-labelledby="label-office"
                >
                  <label
                    id="label-office"
                    htmlFor="search-office"
                    className={SEARCH_LABEL_CLASS}
                  >
                    事業場
                  </label>
                  <div className="flex-1 min-w-0">
                    <MultiCombobox
                      id="search-office"
                      options={toOrgComboOptions(
                        org.options('office'),
                        'nameCode'
                      )}
                      value={org.values('office')}
                      onChange={(v) => org.change('office', v)}
                    />
                  </div>
                </div>

                {/* 3行目2列目: 部署 */}
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-labelledby="label-department"
                >
                  <label
                    id="label-department"
                    htmlFor="search-department"
                    className={SEARCH_LABEL_CLASS}
                  >
                    部署
                  </label>
                  <div className="flex-1 min-w-0">
                    <MultiCombobox
                      id="search-department"
                      options={toOrgComboOptions(
                        org.options('department'),
                        'nameCode'
                      )}
                      value={org.values('department')}
                      onChange={(v) => org.change('department', v)}
                    />
                  </div>
                </div>

                {/* 3行目3列目: 営業担当者 */}
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-labelledby="label-sales-rep"
                >
                  <label
                    id="label-sales-rep"
                    htmlFor="search-sales-rep"
                    className={SEARCH_LABEL_CLASS}
                  >
                    営業担当者
                  </label>
                  <div className="flex-1 min-w-0">
                    <MultiCombobox
                      id="search-sales-rep"
                      options={toOrgComboOptions(
                        org.options('salesRep'),
                        'nameCode'
                      )}
                      value={org.values('salesRep')}
                      onChange={(v) => org.change('salesRep', v)}
                      unit="名"
                    />
                  </div>
                </div>

                {/* 4行目1列目: 申請事業場（col-start-1 で4行目の先頭から並べる） */}
                <div
                  className="flex items-center gap-2 col-start-1"
                  role="group"
                  aria-labelledby="label-applicant-office"
                >
                  <label
                    id="label-applicant-office"
                    htmlFor="search-applicant-office"
                    className={SEARCH_LABEL_CLASS}
                  >
                    申請事業場
                  </label>
                  <div className="flex-1 min-w-0">
                    <MultiCombobox
                      id="search-applicant-office"
                      options={toOrgComboOptions(
                        applicantOrg.options('office'),
                        'nameCode'
                      )}
                      value={applicantOrg.values('office')}
                      onChange={(v) => applicantOrg.change('office', v)}
                    />
                  </div>
                </div>

                {/* 4行目2列目: 申請部署 */}
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-labelledby="label-applicant-department"
                >
                  <label
                    id="label-applicant-department"
                    htmlFor="search-applicant-department"
                    className={SEARCH_LABEL_CLASS}
                  >
                    申請部署
                  </label>
                  <div className="flex-1 min-w-0">
                    <MultiCombobox
                      id="search-applicant-department"
                      options={toOrgComboOptions(
                        applicantOrg.options('department'),
                        'nameCode'
                      )}
                      value={applicantOrg.values('department')}
                      onChange={(v) => applicantOrg.change('department', v)}
                    />
                  </div>
                </div>

                {/* 4行目3列目: 申請者 */}
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-labelledby="label-applicant"
                >
                  <label
                    id="label-applicant"
                    htmlFor="search-applicant"
                    className={SEARCH_LABEL_CLASS}
                  >
                    申請者
                  </label>
                  <div className="flex-1 min-w-0">
                    <MultiCombobox
                      id="search-applicant"
                      options={toOrgComboOptions(
                        applicantOrg.options('salesRep'),
                        'nameCode'
                      )}
                      value={applicantOrg.values('salesRep')}
                      onChange={(v) => applicantOrg.change('salesRep', v)}
                      unit="名"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleCard>
        </CopyableArea>

        {/* ロケ契約(償却)一覧テーブル（詳細画面と同じ折り畳みカード）。
            fillParent でページの余り高さいっぱいまで広げ、折り畳み時は下限を外してヘッダーのみの高さへ戻す。 */}
        <CollapsibleCard
          title="ロケ契約(償却)一覧"
          fillParent
          className="data-[state=open]:min-h-95"
          contentClassName="p-2 flex flex-col flex-1 min-h-0"
        >
          {/* 当グリッド専用スタイル：1列目が実データ列（販売店）のため、共通の
              「1列目（aria-colindex='1'）中央寄せ」を解除し、標準の左寄せに戻す。
              ※ このスタイルは当コンポーネント表示時のみDOMに存在し、同じ
                 payment-list-grid を使う他画面（別ページ・非マウント）には影響しない。 */}
          <style>{`
            .payment-list-grid .ag-cell[aria-colindex='1'] {
              display: block;
              text-align: left;
              padding-left: 0.5rem;
            }
            .payment-list-grid .ag-cell[aria-colindex='1'] > * {
              display: block;
              height: auto;
            }
            .payment-list-grid .ag-header-cell[aria-colindex='1'],
            .payment-list-grid .ag-header-cell[aria-colindex='1'] > * {
              justify-content: flex-start;
            }
          `}</style>
          <div className="payment-list-grid flex-1 min-h-0 w-full">
            <AgGridReact<AmortizationListData>
              rowData={rowData}
              columnDefs={columnDefsWithTooltip}
              defaultColDef={GRID_DEFAULT_COL_DEF}
              getContextMenuItems={gridFilterContextMenuItems}
              domLayout="normal"
              animateRows={true}
              // 行を id で識別し、行更新時の再描画を安定化する
              getRowId={(params) => params.data.id}
              // 操作ボタンレンダラーへ渡すコールバック（解約情報ペインを開く）
              context={
                {
                  onCancel: handleCancel,
                  onOpenPaymentDetail: handleOpenPaymentDetail,
                } satisfies AmortizationListGridContext
              }
              // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
              {...GRID_BASE_PROPS}
              // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
              {...gridColumnStateProps}
              statusBar={GRID_STATUS_BAR}
            />
          </div>
        </CollapsibleCard>

        {/* 解約情報ペイン（右スライド）。グリッドの解約情報ボタンで開き、「保存」押下で入力内容を対象行へ反映する。
            ペイン内はタブで「解約情報」と「コメント履歴」を切り替える。 */}
        <RightPane
          open={isCancelPaneOpen}
          onClose={handleCloseCancelPane}
          title="解約情報"
          initialWidth={30}
          // フッターの縦余白を画面下部の固定フッター（px-6 py-2）と揃える
          // （RightPane の既定 py-4 を上書きする）。
          footerClassName="py-2"
          footer={
            /* 計画詳細(自販機)・支払詳細画面のフッターと同じ btn-action 系ボタン。
               ボタン間隔も同じ gap-3 にする。表示・活性は解約ステータスごとの
               CANCEL_PANE_BUTTON_RULES に従う
               （並び順は右から 保存・申請・引戻し・承認・検印・差戻し・取消）。 */
            <div className="flex flex-wrap items-center justify-end gap-3">
              {CANCEL_PANE_BUTTONS.filter((btn) =>
                cancelPaneButtonRule.visible.includes(btn.key)
              ).map((btn) => {
                const Icon = btn.icon;
                const disabled = !cancelPaneButtonRule.enabled.includes(
                  btn.key
                );
                return (
                  <button
                    key={btn.key}
                    className={`btn-action-base ${btn.style}`}
                    disabled={disabled}
                    onClick={() => handleCancelPaneButtonClick(btn.key)}
                    aria-label={btn.label}
                  >
                    <Icon className="h-4 w-4" />
                    {btn.label}
                  </button>
                );
              })}
            </div>
          }
        >
          {/* タブ切替（解約情報／コメント履歴）。フッターの操作ボタンはどちらのタブでも共通に使う。 */}
          <Tabs
            value={cancelPaneTab}
            onValueChange={(value) => setCancelPaneTab(value as CancelPaneTab)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-transparent p-0 h-auto gap-1">
              {CANCEL_PANE_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* 解約情報タブ：解約日・計上月〜コメント入力欄 */}
            <TabsContent value="info">
              <div className="flex flex-col gap-3">
                {/* 解約日 */}
                <div className="flex items-center gap-2">
                  <label
                    className={`${FORM_LABEL_CLASS} whitespace-nowrap w-28 text-right`}
                  >
                    解約日
                  </label>
                  {cancelFieldsDisabled ? (
                    <PaneReadOnlyBox value={cxDate} className="w-40" />
                  ) : (
                    <DateCalendarInput value={cxDate} onChange={setCxDate} />
                  )}
                </div>

                {/* 計上月。回収予定日の算出元となるため解約情報で入力する
                    （→ 20260818_第31回_自販機 決定事項2・3／課題 No.0960）。
                    日ではなく年月を選ぶ項目のため、共通の年月ピッカーを使う。 */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="cx-posting-month"
                    className={`${FORM_LABEL_CLASS} w-28 text-right whitespace-nowrap`}
                  >
                    計上月
                  </label>
                  {cancelFieldsDisabled ? (
                    <PaneReadOnlyBox value={cxPostingMonth} className="w-32" />
                  ) : (
                    // 既定幅（w-28）だと×ボタン表示時に「YYYY/MM」が見切れるため
                    // 1段階広げる（年月は年月日より短いので w-36 までは要らない）。
                    <MonthYearPicker
                      id="cx-posting-month"
                      value={cxPostingMonth}
                      onChange={setCxPostingMonth}
                      clearable
                      className="w-32"
                    />
                  )}
                </div>

                {/* 請求有無（解約に伴う請求の有無。選択肢が少数のためラジオボタンで選ぶ） */}
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-labelledby="label-cx-billing-flag"
                >
                  <label
                    id="label-cx-billing-flag"
                    className={`${FORM_LABEL_CLASS} w-28 text-right whitespace-nowrap`}
                  >
                    請求有無
                  </label>
                  <RadioGroup
                    value={cxBillingFlag}
                    onValueChange={setCxBillingFlag}
                    disabled={cancelFieldsDisabled}
                    className="flex h-9.5 flex-1 items-center gap-4"
                  >
                    {BILLING_FLAG_OPTIONS.map((opt, idx) => (
                      <div key={opt} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={opt}
                          id={`cx-billing-flag-${idx}`}
                        />
                        <Label
                          htmlFor={`cx-billing-flag-${idx}`}
                          className="text-sm whitespace-nowrap text-gray-900"
                        >
                          {opt}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* 請求先〜回収予定日は請求有無＝有の場合のみ表示する
                    （無の場合は請求を行わないため非表示にする）。 */}
                {cxBillingFlag === '有' && (
                  <>
                    {/* 請求先（支払詳細の支払先と同じ選択肢） */}
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="cx-billing-to"
                        className={`${FORM_LABEL_CLASS} whitespace-nowrap w-28 text-right`}
                      >
                        請求先
                      </label>
                      <div className="flex-1">
                        <SingleCombobox
                          id="cx-billing-to"
                          options={BILLING_DEST_COMBO_OPTIONS}
                          value={cxBillingTo}
                          onChange={setCxBillingTo}
                          placeholder="コード または 名称で検索..."
                          disabled={cancelFieldsDisabled}
                          clearable
                        />
                      </div>
                    </div>

                    {/* 請求金額 */}
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="cx-billing-amount"
                        className={`${FORM_LABEL_CLASS} whitespace-nowrap w-28 text-right`}
                      >
                        請求金額
                      </label>
                      <Input
                        id="cx-billing-amount"
                        className={`${TEXT_INPUT_CLASS} w-36 text-right ${cancelFieldsDisabled ? PANE_READONLY_INPUT_CLASS : ''}`}
                        value={cxBillingAmount}
                        readOnly={cancelFieldsDisabled}
                        tabIndex={cancelFieldsDisabled ? -1 : undefined}
                        onChange={(e) => {
                          // 数字のみ抽出し、3桁ごとにカンマ区切りで表示する
                          const digits = e.target.value.replace(/[^\d]/g, '');
                          setCxBillingAmount(
                            digits === '' ? '' : Number(digits).toLocaleString()
                          );
                        }}
                      />
                    </div>

                    {/* 請求内容。入力欄の下に説明を添えるため、この行だけ入力欄と説明を
                    縦に並べる。項目名は入力欄の高さ（h-9.5＝2.375rem）の中央に合わせる。 */}
                    <div className="flex items-start gap-2">
                      <label
                        htmlFor="cx-billing-content"
                        className={`${FORM_LABEL_CLASS} flex h-9.5 w-28 items-center justify-end whitespace-nowrap`}
                      >
                        請求内容
                      </label>
                      <div className="flex flex-1 flex-col gap-1">
                        <Input
                          id="cx-billing-content"
                          className={`${TEXT_INPUT_CLASS} ${cancelFieldsDisabled ? PANE_READONLY_INPUT_CLASS : ''}`}
                          value={cxBillingContent}
                          readOnly={cancelFieldsDisabled}
                          tabIndex={cancelFieldsDisabled ? -1 : undefined}
                          onChange={(e) => setCxBillingContent(e.target.value)}
                          aria-describedby="cx-billing-content-note"
                        />
                        {/* 入力内容がそのまま請求書へ印字されることを知らせる補足テキスト */}
                        <span
                          id="cx-billing-content-note"
                          className="text-xs text-gray-700"
                        >
                          ※請求書に入力内容が印字されます。
                        </span>
                      </div>
                    </div>

                    {/* 回収方法（選択肢が少数のためラジオボタンで選ぶ。未入力は「指定無し」） */}
                    <div
                      className="flex items-center gap-2"
                      role="group"
                      aria-labelledby="label-cx-collection-method"
                    >
                      <label
                        id="label-cx-collection-method"
                        className={`${FORM_LABEL_CLASS} whitespace-nowrap w-28 text-right`}
                      >
                        回収方法
                      </label>
                      <RadioGroup
                        value={cxCollectionMethod}
                        onValueChange={setCxCollectionMethod}
                        disabled={cancelFieldsDisabled}
                        className="flex h-9.5 flex-1 items-center gap-4"
                      >
                        {COLLECTION_METHOD_OPTIONS.map((opt, idx) => (
                          <div key={opt} className="flex items-center gap-2">
                            <RadioGroupItem
                              value={opt}
                              id={`cx-collection-method-${idx}`}
                            />
                            <Label
                              htmlFor={`cx-collection-method-${idx}`}
                              className="text-sm whitespace-nowrap text-gray-900"
                            >
                              {opt}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    {/* 回収予定日 */}
                    <div className="flex items-center gap-2">
                      <label
                        className={`${FORM_LABEL_CLASS} whitespace-nowrap w-28 text-right`}
                      >
                        回収予定日
                      </label>
                      {cancelFieldsDisabled ? (
                        <PaneReadOnlyBox
                          value={cxCollectionDate}
                          className="w-40"
                        />
                      ) : (
                        <DateCalendarInput
                          value={cxCollectionDate}
                          onChange={setCxCollectionDate}
                        />
                      )}
                    </div>
                  </>
                )}

                {/* 解約申請事業場・解約申請部署・解約申請者。解約を申請した組織・申請者を
                    表示するだけの参照専用項目のため、解約ステータスによらず常に入力不可にする。 */}
                {CANCEL_APPLICANT_FIELDS.map((field) => (
                  <div key={field.label} className="flex items-center gap-2">
                    <label
                      className={`${FORM_LABEL_CLASS} whitespace-nowrap w-28 text-right`}
                    >
                      {field.label}
                    </label>
                    <PaneReadOnlyBox
                      value={cancelTargetRow?.[field.field] ?? ''}
                      className="w-56"
                    />
                  </div>
                ))}

                {/* コメント（申請・差戻しの理由などを入力する。区切り線で上の入力項目と分ける） */}
                <div className="flex flex-col gap-2 border-t border-gray-200 pt-4">
                  <h3 className={CARD_TITLE_CLASS}>コメント</h3>
                  <textarea
                    id="cx-comment"
                    value={cxComment}
                    onChange={(e) => setCxComment(e.target.value)}
                    placeholder="コメントを入力（差戻し理由など）"
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm resize-y focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
              </div>
            </TabsContent>

            {/* コメント履歴タブ：解約申請〜承認のやり取りを新しい順に表示する */}
            <TabsContent value="history">
              <div className="space-y-3">
                {CANCELLATION_COMMENT_HISTORY.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 p-4 rounded-lg space-y-2 border border-gray-200"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-900">
                        {item.action}
                      </span>
                      <span className="text-sm text-gray-600">{item.date}</span>
                      <span className="text-sm text-gray-900">{item.user}</span>
                      {/* 操作の後の解約ステータス。支払詳細のコメント履歴と同一体裁。 */}
                      <span className="ml-auto rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs whitespace-nowrap text-gray-700">
                        ステータス：{item.status}
                      </span>
                    </div>
                    {item.text && (
                      <div className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                        {item.text}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </RightPane>
      </div>
    </div>
  );
}

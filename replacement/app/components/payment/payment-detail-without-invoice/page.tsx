// 支払詳細(追加口請求書無)。支払詳細(追加口請求書有)を正としてコピーし、
// 業務機能要件_手売り_支払_52 と 55 の差分（下記）のみを当てている。
//   - 支払情報サマリ：表示項目は支払詳細(追加口請求書有)を基本とし、拡売費(NET未承認)・マージン率・
//     センターフィ率・センターフィ額は持たない（本画面ではセンターフィを扱わない）
//   - 追加口：請求書有の追加口明細から請求書に関わる列と入力用の列を外し、全項目を参照のみとする
//     （→ 課題 No.1534。アンマッチ区分・差異理由はＢパターンでは発生しないため持たない）
//   - 合計表（追加口・拡売費・支払情報）：請求書有と同じ形（支払情報のセンターフィは持たない）。
//     追加口は請求書を受領しないため請求・差額の行を「-」とする。マイナスは「-」符号で表示する。
//     データ元別の列は AIC入力・手入力（本画面は EDI を持たない）。追加口明細はデータ元の区分を
//     持たないため、追加口の金額はデータ元別の列に入れない
//   - 拡売費のデータ元は AIC入力／手入力の2パターン
//   - 拡売費：未承認NET／その他の区分を持たない単一一覧
//   - 支払情報サマリの分割（IN）：拡売費・追加口タブで一覧を切り替える（支払詳細(追加口請求書有)と同じ）
//   - 支払情報サマリの振替（IN）：追加口の一覧は持たず、拡売費の一覧だけを出す
//   - 明細追加（追加口）は持たない（引用は支払詳細(追加口請求書有)と同じ）
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { toast } from 'sonner';
import {
  Save,
  Send,
  Check,
  Undo2,
  ArrowRight,
  Ban,
  Megaphone,
  PlusCircle,
  CornerUpLeft,
  Stamp,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ColGroupDef } from 'ag-grid-community';

import { Button } from '../../ui/button';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  GRID_COLORS,
  withHeaderTooltips,
  useGridColumnState,
  GRID_NO_FILTER_COLUMN_TYPES,
  GRID_EMPTY_TEXT,
} from '../../grid';
import {
  AdditionalPaymentBasicInfoPane,
  BASIC_INFO,
} from '../../shared/payment/payment-detail/AdditionalPaymentBasicInfoPane';
import { SPLIT_IN_ENTRY_ROWS } from '../../../constants/additionalEntrySplitMockData';
import { SPLIT_IN_ENTRY_COL_DEFS } from '../../shared/payment/payment-detail/splitInEntryColDefs';
import {
  PaymentDetailPane,
  PAYMENT_DETAIL_STATUS,
  createPaymentDetailValues,
  createQuotePaymentDetailValues,
  createEmptyPaymentDetailValues,
  type PaymentDetailPaneValues,
} from './components/PaymentDetailPane';
import { AggregationPane } from './components/AggregationPane';
import { aggregateSummaryDetails } from '../../../utils/payment/payment-detail/paymentSummaryAggregate';
import {
  DetailTable,
  type DetailTableHandle,
  type EntryRow,
} from './components/DetailTable';
import {
  createEmptyAmountBreakdown,
  type AmountBreakdown,
} from '../../../utils/payment/payment-detail/paymentAmountBreakdown';
import { buildWithoutInvoicePaymentItems } from '../../../utils/payment/payment-detail/paymentBreakdownItems';
import { paymentFooterActionStateOf } from '../../../utils/payment/payment-detail/paymentFooterActions';
import {
  WITHOUT_INVOICE_DEFAULT_ROUND,
  WITHOUT_INVOICE_PAYMENT_ROUNDS,
  createWithoutInvoiceEntryRows,
  createWithoutInvoiceExpenseRows,
} from '../../../constants/paymentWithoutInvoiceMockData';
import {
  PaymentNonProductExpensePane,
  createEmptyExpenseRows,
  createQuotedExpenseRows,
  type PaymentNonProductExpensePaneHandle,
  type ExpenseRow,
} from '../../shared/payment/payment-detail/PaymentNonProductExpensePane';
// 支払回数の切替・追加（支払詳細の各画面で共通）。
import { usePaymentRounds } from '../../shared/payment/payment-detail/usePaymentRounds';
import { PaymentRoundConfirmDialog } from '../../shared/payment/payment-detail/PaymentRoundConfirmDialog';
import {
  ALL_PLAN_AREA_CODES,
  PaymentPlanSelectionPane,
  PlanAreaField,
} from '../../shared/payment/payment-detail/PaymentPlanSelectionPane';
import {
  QuoteSelectionPane,
  QUOTE_TARGET_MONTH_FROM,
  QUOTE_TARGET_MONTH_TO,
  QUOTE_PAYEE_ALL,
  QUOTE_PAYEE_OPTIONS,
  type QuoteSelectionPaneHandle,
  QUOTE_SELECTION_CONFIG,
} from './components/quoteSelectionConfig';
// 下ペイン共通フッタのボタンで使用する共通スタイル。
import {
  BUTTON_STYLES,
  BUTTON_BASE,
  FORM_LABEL_CLASS,
  FORM_VALUE_CLASS,
  CARD_CLASS,
} from '../../../../styles/commonStyles';

// ★分割機能：画面から見えないよう一時的にコメントアウト（復旧時はコメントを外す）
// // 分割情報（費用負担部署）編集ペインの選択肢と入力部品。
// import { COST_BEARING_DEPT_OPTIONS } from '../../../constants/costBearingDeptMaster';
// import { SingleCombobox } from '../../ui/single-combobox';
import { SingleCombobox } from '../../ui/single-combobox';

import {
  AllocationPane,
  type AllocationPaneHandle,
  type AllocationPaneSource,
} from '../../shared/payment/payment-detail/AllocationPane';
import { RightPane } from '../../ui/right-pane';
import { CommentHistoryPane } from '../../shared/common/CommentHistoryPane';
import {
  AddExpensePane,
  type AddExpensePaneHandle,
} from './components/AddExpensePane';
import { BottomPane } from '../../ui/bottom-pane';
import { MonthYearPicker } from '../../ui/month-year-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';

import {
  campaignClassCode,
  managementClassCode,
  managementCodeName,
} from '../../../constants/paymentComboFieldOptions';
import { campaignClassFromCode } from '../../../constants/expenseRelations';
import { swapNameCode } from '../../../utils/common/nameCode';
import { ScreenTitle } from '../../ui/screen-title';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import type { ExpenseBasicInfo } from '../../../types/paymentDetail';

// ── モックデータ ────────────────────────────────────────────

// 拡売費一覧の商流・組織列（販売店〜担当者）に表示する基本情報の値。
// 基本情報は「コード:名称」で保持するが、分割の枝番行で選択できる候補
//（商流／組織マスタ）は「名称:コード」のため、表記を揃えて渡す。
const EXPENSE_BASIC_INFO: ExpenseBasicInfo = {
  primaryStore: swapNameCode(BASIC_INFO.primaryStore),
  tertiaryStore: swapNameCode(BASIC_INFO.tertiaryStore),
  store: swapNameCode(BASIC_INFO.store),
  // 費用負担部署＝基本情報の「部署」
  dept: swapNameCode(BASIC_INFO.dept),
  // 担当者＝基本情報の「営業担当者」（複数はカンマ区切りのまま表示する）
  staff: BASIC_INFO.staff.split(',').map(swapNameCode).join(','),
};

// 支払No.（タブ見出し用。支払詳細(自販機)のタブ1タイトルと同形式）。
// 値は基本情報（SearchPane）の「支払明細書No」と揃える。

// 「他部門から分割された経費明細」タブの1行分の型（参照専用・拡売費構成に準拠）
interface SplitFromOtherRow {
  no: number; // No.
  billName: string; // 卸からの請求名称（分割元の明細の値）
  planExpContent: string; // メタブランド（メタブランド名）
  product: string; // サマリ商品名
  payAmount: number; // 支払金額
  planAmount: number | string; // 計画金額（計画が紐づかない行は空白）
  mgmtClass: string; // 管理区分（コード）
  mgmtClassName: string; // 管理区分名称
  mgmtCode: string; // 管理コード（コード）
  mgmtCodeName: string; // 管理コード名称
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  // 以下は拡売費一覧のみが持つ項目（追加口一覧では未使用）。
  measureClass?: string; // 施策区分（区分値）
  measureClassName?: string; // 施策区分名称
  measureCode?: string; // 施策コード（コード）
  measureCodeName?: string; // 施策コード名称
  // 分割元グループ（分割元の支払明細を特定する項目）
  srcPaymentNo?: string; // 分割元の支払No
  srcPaymentCount?: number; // 分割元の支払回数
  srcDetailNo?: number; // 分割元の明細No
  srcDept?: string; // 分割元の部署
  srcStaff?: string; // 分割元の営業担当者
}

// 他部門で分割され当部門に計上された拡売費のモック（参照専用）。
const SPLIT_FROM_OTHER_ROWS: SplitFromOtherRow[] = [
  {
    no: 1,
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    payAmount: 20000,
    planAmount: 20000,
    mgmtClass: '1B6',
    mgmtClassName: 'チャネル対策条件（売上連動）',
    mgmtCode: '99999',
    mgmtCodeName: '量販経費追加スーパー',
    summary1: '東日本支社より分割',
    summary2: 'アプリ20%相当の販促値引（社外）',
  },
  {
    no: 2,
    billName: 'アサヒ飲料 三ツ矢サイダー ＰＥＴ５００',
    planExpContent: '三ツ矢サイダー 夏季拡売',
    product: '三ツ矢サイダー500mL24本',
    payAmount: 10000,
    planAmount: 12000,
    mgmtClass: '681',
    mgmtClassName: 'その他',
    mgmtCode: '99999',
    mgmtCodeName: '量販経費追加スーパー',
    summary1: '中部支社より分割',
    summary2: '',
  },
];

// 「他部門から分割された経費明細」タブの拡売費一覧のデータ。
// 2〜4列目（卸からの請求名称・メタブランド・サマリ商品名）は、
// その他一覧の No.=1 行の値を設定する（他列はコピー元 SPLIT_FROM_OTHER_ROWS のまま）。
// 施策区分／施策コード・分割元（支払No〜営業担当者）は拡売費一覧のみの項目（ダミー）。
const SPLIT_FROM_OTHER_EXPENSE_EXTRAS: Pick<
  SplitFromOtherRow,
  | 'measureClass'
  | 'measureClassName'
  | 'measureCode'
  | 'measureCodeName'
  | 'srcPaymentNo'
  | 'srcPaymentCount'
  | 'srcDetailNo'
  | 'srcDept'
  | 'srcStaff'
>[] = [
  {
    measureClass: '20',
    measureClassName: '販売促進',
    measureCode: 'SP001',
    measureCodeName: '店頭値引き支援',
    srcPaymentNo: 'C2400NTO1',
    srcPaymentCount: 1,
    srcDetailNo: 3,
    srcDept: '首都圏営業第一部:10002985',
    srcStaff: 'アサヒ　花子:5172734',
  },
  {
    measureClass: '30',
    measureClassName: 'スポット',
    measureCode: 'SS002',
    measureCodeName: 'スポットサンプリング',
    srcPaymentNo: 'C2400NTO2',
    srcPaymentCount: 2,
    srcDetailNo: 1,
    srcDept: '中部営業部:10003002',
    srcStaff: 'アサヒ　次郎:5172735',
  },
];

const SPLIT_FROM_OTHER_EXPENSE_ROWS: SplitFromOtherRow[] = [
  ...SPLIT_FROM_OTHER_ROWS.map((r, i) => ({
    ...r,
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    ...(SPLIT_FROM_OTHER_EXPENSE_EXTRAS[i] ?? {}),
  })),
  // 計画が紐づかない明細（ダミー）。計画金額は空白で表示する。
  {
    no: 3,
    billName: 'アサヒ飲料 三ツ矢サイダー ＰＥＴ５００ 夏季拡売',
    planExpContent: '三ツ矢サイダー 夏季拡売キャンペーン',
    product: '三ツ矢サイダー500mL24本',
    payAmount: 30000,
    // 計画が紐づかない行は計画金額を空白にする。
    planAmount: '',
    mgmtClass: '1B6',
    mgmtClassName: 'チャネル対策条件（売上連動）',
    mgmtCode: '99999',
    mgmtCodeName: '量販経費追加スーパー',
    summary1: '関西支社より分割',
    summary2: '夏季拡売の販促値引（社外）',
    measureClass: '10',
    measureClassName: '新規導入',
    measureCode: 'SN001',
    measureCodeName: '新商品導入キャンペーン',
    srcPaymentNo: 'C2400NTO5',
    srcPaymentCount: 1,
    srcDetailNo: 2,
    srcDept: '関西第1営業部:10003001',
    srcStaff: 'アサヒ　美咲:5172736',
  },
  {
    no: 4,
    billName: 'アサヒ飲料 十六茶 ６００ＭＬＰ 店頭施策',
    planExpContent: '十六茶 店頭定番販促',
    product: '十六茶630mL24本',
    payAmount: 18000,
    // 計画が紐づかない行は計画金額を空白にする。
    planAmount: '',
    mgmtClass: '681',
    mgmtClassName: 'その他',
    mgmtCode: '99999',
    mgmtCodeName: '量販経費追加スーパー',
    summary1: '九州支社より分割',
    summary2: '',
    measureClass: '40',
    measureClassName: 'リピート',
    measureCode: 'SR002',
    measureCodeName: 'リピート展示会',
    srcPaymentNo: 'C2400NTO6',
    srcPaymentCount: 2,
    srcDetailNo: 4,
    srcDept: '中部営業部:10003002',
    srcStaff: 'アサヒ　次郎:5172735',
  },
];

// 振替（IN）の拡売費一覧データ。分割（IN）と同じ内容だが、グリッドを別々に管理するため
// 行データも複製して保持する（一方の変更が他方へ波及しないようにする）。
const TRANSFER_FROM_OTHER_EXPENSE_ROWS: SplitFromOtherRow[] =
  SPLIT_FROM_OTHER_EXPENSE_ROWS.map((r) => ({ ...r }));

// 整数の3桁区切り整形（金額列・サマリー用）。
const formatInt = (v: number): string =>
  Number.isFinite(v) ? Math.round(v).toLocaleString('ja-JP') : '';

// 参照専用セルの共通スタイル（灰背景）と右寄せ版。
const SPLIT_RO_STYLE = { backgroundColor: GRID_COLORS.readonly } as const;
const SPLIT_RO_RIGHT_STYLE = {
  backgroundColor: GRID_COLORS.readonly,
  textAlign: 'right' as const,
};

// タブ2サマリーバーの表示項目（合計金額）を行データから組み立てる。
// 参照元（支払詳細(自販機)）に準拠。追加口・拡売費それぞれの一覧データで集計する。
// 計画金額の合計は、分割（IN）・振替（IN）とも表示しない。
const buildSplitSummaryItems = (amounts: number[]) => [
  {
    label: '合計金額',
    value: formatInt(amounts.reduce((s, a) => s + a, 0)),
    emphasize: true,
  },
];

// 「他部門から分割（振替）された経費明細」タブの拡売費一覧（下の一覧）用の列定義。
// 先頭は追加口一覧と同じく No.／メタブランド／サマリ商品名の順に並べる。
// 以降は追加口一覧と列構成が異なり、施策区分／施策コードと分割元（振替元）グループを持ち、
// 支払金額は「分割金額（振替金額）」として表示する。
// 分割（IN）／振替（IN）で見出しの「分割」を「振替」に読み替えるため、ラベルを引数に取る。
const buildSplitFromOtherExpenseColDefs = (
  label: '分割' | '振替'
): (ColDef<SplitFromOtherRow> | ColGroupDef<SplitFromOtherRow>)[] =>
  withHeaderTooltips([
    {
      headerName: 'No.',
      field: 'no',
      width: 56,
      // 先頭列は grid.css で中央寄せ強制のため、左寄せクラスを付与（→ グリッド左寄せ規約）
      cellClass: 'ag-cell-left-pinned',
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: 'メタブランド',
      field: 'planExpContent',
      width: 192,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: 'サマリ商品',
      field: 'product',
      width: 176,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: `${label}金額`,
      field: 'payAmount',
      width: 96,
      valueFormatter: (p) => formatInt(p.value as number) || GRID_EMPTY_TEXT,
      cellStyle: SPLIT_RO_RIGHT_STYLE,
    },
    {
      headerName: '管理区分',
      field: 'mgmtClass',
      width: 104,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '管理区分名称',
      field: 'mgmtClassName',
      width: 160,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '管理コード',
      field: 'mgmtCode',
      width: 104,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '管理コード名称',
      field: 'mgmtCodeName',
      width: 160,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '施策区分',
      field: 'measureClass',
      width: 104,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '施策区分名称',
      field: 'measureClassName',
      width: 160,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '施策コード',
      field: 'measureCode',
      width: 104,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '施策コード名称',
      field: 'measureCodeName',
      width: 160,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '摘要1（社内用）',
      field: 'summary1',
      width: 160,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '摘要2（社外用）',
      field: 'summary2',
      width: 160,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      // 分割元（振替元）グループ：分割元（振替元）の支払明細を特定する項目。
      headerName: `${label}元`,
      children: [
        {
          headerName: '支払No',
          field: 'srcPaymentNo',
          width: 104,
          cellStyle: SPLIT_RO_STYLE,
        },
        {
          headerName: '支払回数',
          field: 'srcPaymentCount',
          width: 80,
          cellStyle: SPLIT_RO_RIGHT_STYLE,
        },
        {
          headerName: '明細No',
          field: 'srcDetailNo',
          width: 80,
          cellStyle: SPLIT_RO_RIGHT_STYLE,
        },
        {
          headerName: '部署',
          field: 'srcDept',
          width: 160,
          cellStyle: SPLIT_RO_STYLE,
        },
        {
          headerName: '営業担当者',
          field: 'srcStaff',
          width: 128,
          cellStyle: SPLIT_RO_STYLE,
        },
      ],
    },
  ]);

// 分割（IN）／振替（IN）それぞれの拡売費一覧の列定義。
const SPLIT_FROM_OTHER_EXPENSE_COL_DEFS =
  buildSplitFromOtherExpenseColDefs('分割');
const TRANSFER_FROM_OTHER_EXPENSE_COL_DEFS =
  buildSplitFromOtherExpenseColDefs('振替');

// タブ2グリッドの既定列定義（参照専用：ソート・フィルター・列移動を無効化）。
const SPLIT_FROM_OTHER_DEFAULT_COL_DEF: ColDef = {
  ...GRID_DEFAULT_COL_DEF,
  editable: false,
  sortable: false,
  filter: false,
  suppressMovable: true,
};

// 明細追加ペインの対象（追加口／拡売費）。null は閉じている状態。
type AddDetailTarget = 'entry' | 'expense' | null;

// 支払回数の選択肢（プルダウンの表示順）。
const PAYMENT_ROUND_OPTIONS = WITHOUT_INVOICE_PAYMENT_ROUNDS;

// 支払回数1回分のデータセット（支払情報＋追加口＋拡売費）。
// 支払回数プルダウンで回を切り替えると、この単位で表示を差し替える。
interface PaymentRoundDataSet {
  paymentInfo: PaymentDetailPaneValues; // 支払情報の入力値
  entryRows: EntryRow[]; // 追加口の明細行
  expenseRows: ExpenseRow[]; // 拡売費の明細行
}

// 1回分のデータセットを新規生成する（回ごとに中身の異なるモック明細 → constants/paymentWithoutInvoiceMockData）。
// 支払回数1＝追加口と拡売費（AIC入力・手入力）、2・3＝拡売費（AIC入力・手入力）。
// 2・3回目は追加口の明細を持たない。
const createRoundDataSet = (round: string): PaymentRoundDataSet => ({
  paymentInfo: createPaymentDetailValues(round),
  entryRows: createWithoutInvoiceEntryRows(round),
  expenseRows: createWithoutInvoiceExpenseRows(round),
});

// 支払回数の選択肢の数だけデータセットを用意する。
const createRoundDataSets = (): Record<string, PaymentRoundDataSet> =>
  Object.fromEntries(
    PAYMENT_ROUND_OPTIONS.map((round) => [round, createRoundDataSet(round)])
  );

// 引用で追加する支払回のデータセット。
// 支払情報は支払回数「1」とは別の内容を初期表示し、追加口は明細0件とする。
// 拡売費には引用明細選択で引用した明細を初期表示する。
const createQuoteRoundDataSet = (
  expenseRows: ExpenseRow[]
): PaymentRoundDataSet => ({
  paymentInfo: createQuotePaymentDetailValues(),
  entryRows: [],
  expenseRows,
});

// 「＋支払回数追加」で追加する支払回のデータセット。
// 支払情報は入力前のブランク、追加口は明細0件、拡売費はグループ合計行だけの空一覧とする。
const createEmptyRoundDataSet = (): PaymentRoundDataSet => ({
  paymentInfo: createEmptyPaymentDetailValues(),
  entryRows: [],
  expenseRows: createEmptyExpenseRows(),
});

interface PaymentDetailWithoutInvoiceProps {
  // 画面切替（基本情報の販売計画書No リンクから計画詳細へ遷移する）。
  onMenuChange?: (menuId: string) => void;
}

export default function PaymentDetailWithoutInvoice({
  onMenuChange,
}: PaymentDetailWithoutInvoiceProps) {
  const [isCommentHistoryPaneShown, setIsCommentHistoryPaneShown] =
    useState(false);
  // フッターのコメント入力（差戻し理由など。支払詳細(その他)と同様）
  const [commentInput, setCommentInput] = useState('');
  // 支払無し（当月は支払が発生しない伝票）。支払一覧と同じく未申請との間を
  // 行き来する（→ 20260724_第23回_共通 決定事項8）。支払全体の備考は持たないため、
  // 理由はフッターのコメント欄へ書く。
  const [isNoPayment, setIsNoPayment] = useState(false);
  // 拡売費計画引用（下ペイン）
  const [isPlanSelectionPaneShown, setIsPlanSelectionPaneShown] =
    useState(false);
  // 拡売費計画引用の担当エリア（複数選択）。初期は全担当エリアを選択した状態。
  const [planAreas, setPlanAreas] = useState<string[]>(ALL_PLAN_AREA_CODES);
  // 費用振替 画面（下ペイン）。拡売費一覧の操作メニュー「振替」から開く。
  const [isAllocatePaneShown, setIsAllocatePaneShown] = useState(false);
  // 振替対象行から反映する振替元情報。
  const [allocateSource, setAllocateSource] = useState<
    AllocationPaneSource | undefined
  >(undefined);
  // 支払情報サマリ右端のトグル（詳細／分割／振替）。
  //   詳細＝支払No.（支払明細情報・追加口・拡売費）、分割・振替＝他部門から分割された経費明細。
  const [summaryTab, setSummaryTab] = useState<'詳細' | '分割' | '振替'>(
    '詳細'
  );
  // 支払回数ごとのデータセット（支払情報・追加口・拡売費）。
  // 保持するのは回ごとの初期表示内容のみで、入力中の編集は退避しない
  //（切替時に破棄されるため。→ 20260804_第26回 決定事項23・24）。
  const [roundDataSets, setRoundDataSets] =
    useState<Record<string, PaymentRoundDataSet>>(createRoundDataSets);

  // 支払回数（支払詳細(自販機)と同様、タブバーと支払明細情報の間に配置）。
  // 切替・追加の挙動は支払詳細(商流販売店紐づけなし)と共通のフックで扱う。
  const rounds = usePaymentRounds({
    initialOptions: PAYMENT_ROUND_OPTIONS,
    // 既定で表示する支払回数は3回目（モックのため）。拡売費にデータ元の違う明細（AIC入力・手入力）が
    // 混在する回を開いた時点で見せるためで、業務の決まりではない（→ WITHOUT_INVOICE_DEFAULT_ROUND）。
    initialRound: WITHOUT_INVOICE_DEFAULT_ROUND,
    // 追加した回は空の支払情報・追加口・拡売費から始める。
    // 引用で追加した回は、直後に引用した明細を持つデータセットで上書きする。
    onRoundAdded: (round) =>
      setRoundDataSets((prev) => ({
        ...prev,
        [round]: createEmptyRoundDataSet(),
      })),
  });
  const invoiceCount = rounds.round;
  const activeRound = roundDataSets[invoiceCount];

  // 支払情報カードの合計表の元になる、表示中の支払回の合計表（追加口計・拡売費計）。
  // 各カードが集計して通知する（回の切替で各カードが作り直され、その回の値を通知し直す）。
  const [entryBreakdown, setEntryBreakdown] = useState<AmountBreakdown>(
    createEmptyAmountBreakdown
  );
  const [expenseBreakdown, setExpenseBreakdown] = useState<AmountBreakdown>(
    createEmptyAmountBreakdown
  );
  // 支払情報カードの合計表。税抜金額計＝追加口計＋拡売費計（セルごとに足す）。
  // 本画面はセンターフィを扱わないため、請求書有にあるセンターフィの項目は持たない。
  // 追加口は請求書を受領しないため、請求・差額の行を「-」で表示する。
  // 税抜金額計の請求は、請求のある拡売費計の請求だけを足した値になる。
  // 支払情報エリアの下に税率ごとの合計金額（税抜）を出す（→ 20260710_第16回 決定事項12）。
  const paymentBreakdownItems = useMemo(
    () =>
      buildWithoutInvoicePaymentItems({
        entry: entryBreakdown,
        expense: expenseBreakdown,
      }),
    [entryBreakdown, expenseBreakdown]
  );

  // フッターのボタンの活性（常に表示し、ステータスで活性を決める → 要件 55・52 のフッター）。
  // 支払無しを押した回は、ステータスを「支払無し」として扱う。
  const footerActions = paymentFooterActionStateOf(
    isNoPayment ? '支払無し' : (activeRound?.paymentInfo.status ?? '')
  );

  // 引用明細選択 画面（下ペイン）。支払情報引用ボタンから開く。
  const [isQuoteSelectionPaneShown, setIsQuoteSelectionPaneShown] =
    useState(false);
  // 親画面に未保存の入力があるか。支払情報引用ボタン押下時に保存を促すために持つ
  //（→ 20260814_第28回 決定事項6）。
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // 未保存のまま支払情報引用ボタンを押した場合に出す、保存を促すポップアップ。
  const [isQuoteUnsavedOpen, setIsQuoteUnsavedOpen] = useState(false);
  // 対象年月は From-To で指定する。「前月分」に限定せず任意の月から引用できる
  //（→ 20260814_第28回 決定事項2）。
  const [quoteMonthFrom, setQuoteMonthFrom] = useState(QUOTE_TARGET_MONTH_FROM);
  const [quoteMonthTo, setQuoteMonthTo] = useState(QUOTE_TARGET_MONTH_TO);
  // 支払先の絞り込み（→ 20260728_第24回_共通 決定事項20）。
  const [quotePayee, setQuotePayee] = useState(QUOTE_PAYEE_ALL);

  // 下ペイン（販売計画選択・引用明細選択・費用振替）を開いているか。
  // いずれも画面の縦半分を使うプッシュ式のため、開いたら親画面側は拡売費一覧を先頭に見せる。
  const isBottomPaneOpen =
    isPlanSelectionPaneShown ||
    isQuoteSelectionPaneShown ||
    isAllocatePaneShown;

  // 下ペインを開いたら、拡売費一覧のグリッドが画面内スクロール領域の先頭
  //（ヘッダーメニュー直下）へ来るようスクロールする。下ペインが画面の下半分を使うため、
  // 親画面（拡売費一覧）が上半分・下ペインが下半分の並びになる
  //（→ 20260821_第31回 決定事項1。計画詳細の「拡売費計画(コピー元)」ペインと同じ挙動）。
  // scrollIntoView は main/ドキュメントまで動かして sticky ヘッダーの表示を乱すため使わず、
  // 最も近いスクロール可能な祖先だけを動かす。
  useEffect(() => {
    if (!isBottomPaneOpen) return;
    // ペインの展開（高さ・押し上げのトランジション）が終わってからスクロールする
    const id = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('.expense-grid');
      if (!el) return; // 拡売費カードを折り畳んでいる場合は何もしない
      let scroller: HTMLElement | null = el.parentElement;
      while (scroller) {
        const overflowY = window.getComputedStyle(scroller).overflowY;
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          scroller.scrollHeight > scroller.clientHeight
        ) {
          break;
        }
        scroller = scroller.parentElement;
      }
      if (!scroller) return;
      const delta =
        el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollBy({ top: delta, behavior: 'smooth' });
    }, 350);
    return () => window.clearTimeout(id);
  }, [isBottomPaneOpen]);

  // 明細系右ペインの状態管理。
  // 明細追加ペインは追加口・拡売費で項目が異なるため、どちらを開いているかを持つ。
  const [addDetailTarget, setAddDetailTarget] = useState<AddDetailTarget>(null);
  // ★分割機能：画面から見えないよう一時的にコメントアウト（復旧時はコメントを外す）
  // // 分割情報（費用負担部署）編集ペイン（明細追加ペインの複製）の表示状態。
  // const [showSplitDeptEditPane, setShowSplitDeptEditPane] = useState(false);
  // // 同ペインの費用負担部署。自部署は基本情報の部署で固定（非活性）、
  // // 他部署は「費用負担部署追加」で1件ずつ増やせる（他部署1・2…）。
  // const [splitDeptEditOtherValues, setSplitDeptEditOtherValues] = useState<
  // string[]
  // >(DEFAULT_BRANCH_SPLIT_DEPTS);
  // 明細追加ペイン操作用（ペイン下部の「追加」ボタンから呼ぶ）。
  // 追加口の明細追加は請求書の反映漏れを補う機能のため、請求書を受領しない本画面では持たない。
  const addExpensePaneRef = useRef<AddExpensePaneHandle>(null);

  // 販売計画(詳細)コピー用
  const detailTableRef = useRef<DetailTableHandle>(null);
  // 拡売費一覧（その他への転記・削除）操作用
  const expenseTableRef = useRef<PaymentNonProductExpensePaneHandle>(null);

  // 表示中の支払回の拡売費明細（拡売費カードが持つ最新の行）。
  // 拡売費カードは行の追加・削除を自身の状態で持つため、合計表の通知に合わせて受け取る。
  // 他の支払回は支払回ごとのデータセット（roundDataSets）の明細を使う。
  const [activeExpenseRows, setActiveExpenseRows] = useState<{
    round: string;
    rows: ExpenseRow[];
  } | null>(null);
  // 拡売費カードからの合計表の通知。合計表に加えて、支払情報サマリの集計に使う明細も受け取る。
  const handleExpenseBreakdownChange = useCallback(
    (breakdown: AmountBreakdown) => {
      setExpenseBreakdown(breakdown);
      const rows = expenseTableRef.current?.getRows();
      if (rows) setActiveExpenseRows({ round: invoiceCount, rows: [...rows] });
    },
    [invoiceCount]
  );
  // 支払情報サマリの支払の行（支払函数・追加口金額・拡売費（NET未承認以外））。全支払回数の明細から
  // 集計する（→ 補足3-2 支払情報サマリの集計）。拡売費明細は行オブジェクトが直接書き換わり、
  // 編集のたびに合計表の通知で再描画されるため、メモ化せず描画のたびに求め直す。
  const summaryDetailTotals = aggregateSummaryDetails(
    Object.entries(roundDataSets).map(([round, dataSet]) => ({
      entryRows: dataSet.entryRows,
      expenseRows:
        activeExpenseRows?.round === round
          ? activeExpenseRows.rows
          : dataSet.expenseRows,
    })),
    'without-invoice'
  );
  // フッタの「保存」「申請」押下：拡売費一覧の明細を管理区分に応じた一覧へ移動する。
  // 未承認NET拡売費は管理区分「1B3／値引き（売上連動）」の明細だけを表示する一覧のため、
  //   未承認NET → その他 ：管理区分を 1B3 から変更した明細
  //   その他   → 未承認NET：管理区分を 1B3 へ変更した明細
  // をそれぞれ移す（No. は移動先の一覧の続きで自動採番される）。
  const handleSaveOrApply = () => {
    expenseTableRef.current?.relistByMgmtClass();
    // 保存・申請したら、拡売費一覧のコピー・明細追加の帯を外す（帯のみ。編集セルの強調は対象外）。
    expenseTableRef.current?.clearSavedMarks();
    // 保存・申請で未保存の状態を解消する（→ 20260814_第28回 決定事項6）。
    setHasUnsavedChanges(false);
  };

  // 支払情報引用ボタン押下：引用明細選択ペイン（下ペイン）を開くだけとする。
  // 支払回数の追加は、引用する明細を確定する「引用」で行う（handleQuoteApply）。
  const handleQuote = () => {
    const isOpen = isQuoteSelectionPaneShown;
    closeAllRightPanes();
    if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
    // 未保存の入力があるときは、下ペインを表示する前に保存を促す。
    // ポップアップからは保存を実行せず、閉じたうえで画面の保存ボタンを押してもらう
    //（保存の経路を2つにしないため → 20260814_第28回 決定事項6）。
    if (hasUnsavedChanges) {
      setIsQuoteUnsavedOpen(true);
      return;
    }
    setIsQuoteSelectionPaneShown(true);
  };

  // 引用明細選択の「引用」押下：支払回を1つ増やし（確認は挟まない）、
  // 引用した明細を持つ新しい回を表示してペインを閉じる。
  const handleQuoteApply = (quotedRows: ExpenseRow[]) => {
    const nextRound = rounds.addRoundNow();
    setRoundDataSets((prev) => ({
      ...prev,
      [nextRound]: createQuoteRoundDataSet(quotedRows),
    }));
    setIsQuoteSelectionPaneShown(false);
    toast.success(`支払回数「${nextRound}」へ支払明細を引用しました。`);
  };
  // 引用明細選択ペイン操作用（ペインタイトル右の「引用」から呼ぶ）。
  const quotePaneRef = useRef<QuoteSelectionPaneHandle>(null);
  // 費用振替ペイン操作用（ペインタイトル右の「振替内容を反映」から呼ぶ）。
  const allocatePaneRef = useRef<AllocationPaneHandle>(null);
  // すべての右ペインを閉じるヘルパー関数
  const closeAllRightPanes = () => {
    setIsCommentHistoryPaneShown(false);
    setIsPlanSelectionPaneShown(false);
    setIsAllocatePaneShown(false);
    setAddDetailTarget(null);
    setIsQuoteSelectionPaneShown(false);
    // ★分割機能：画面から見えないよう一時的にコメントアウト（復旧時はコメントを外す）
    // setShowSplitDeptEditPane(false);
  };

  // ★分割機能：画面から見えないよう一時的にコメントアウト（復旧時はコメントを外す）
  // // 分割情報（費用負担部署）編集ペインを開く（追加口ヘッダーのボタンから呼ぶ）。
  // const handleOpenSplitDeptEdit = () => {
  // const isOpen = showSplitDeptEditPane;
  // closeAllRightPanes();
  // if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
  // setShowSplitDeptEditPane(true);
  // };

  // ★分割機能：画面から見えないよう一時的にコメントアウト（復旧時はコメントを外す）
  // // 分割情報（費用負担部署）編集ペインのクリア：入力項目を初期値へ戻す。
  // const handleClearSplitDeptEditForm = () => {
  // // 自部署は追加口グリッドの親行の部署で固定のため、クリア対象は他部署のみ。
  // // 追加口グリッドの枝番行も初期構成（1件・既定の部署）へ戻る。
  // setSplitDeptEditOtherValues(DEFAULT_BRANCH_SPLIT_DEPTS);
  // };

  // ★分割機能：画面から見えないよう一時的にコメントアウト（復旧時はコメントを外す）
  // // 費用負担部署追加：他部署の入力欄を1件増やす。
  // const handleAddSplitDeptEditOther = () => {
  // setSplitDeptEditOtherValues((prev) => [...prev, '']);
  // };

  // ★分割機能：画面から見えないよう一時的にコメントアウト（復旧時はコメントを外す）
  // // 費用負担部署の削除：他部署の入力欄を1件取り除く。
  // const handleRemoveSplitDeptEditOther = (index: number) => {
  // setSplitDeptEditOtherValues((prev) => prev.filter((_, i) => i !== index));
  // };

  // ★分割機能：画面から見えないよう一時的にコメントアウト（復旧時はコメントを外す）
  // // 他部署の選択値を更新する（index 指定）。
  // const handleChangeSplitDeptEditOther = (index: number, value: string) => {
  // setSplitDeptEditOtherValues((prev) =>
  // prev.map((v, i) => (i === index ? value : v))
  // );
  // };

  // 明細追加ペインの追加実行。
  //   追加後もペインは閉じず、入力欄を空に戻して続けて登録できる（初期化は各ペインの submit が行う）。
  //   不要になったら×でペインを閉じる（→ 9/24 第25回 共通 決定事項4：連続追加ボタンは廃止）
  const handleAddDetailSubmit = () => {
    addExpensePaneRef.current?.submit();
  };

  // 明細追加ペインのフッタ。
  // ボタンは「追加」のみ（追加後もペインは開いたまま。×で閉じる）。
  const addDetailFooter = (
    <div className="flex items-center justify-end gap-3">
      <Button
        type="button"
        className="bg-blue-600 hover:bg-blue-700"
        onClick={handleAddDetailSubmit}
      >
        追加
      </Button>
    </div>
  );

  // 明細追加ペインを開く（追加口／拡売費で本文を出し分ける）。
  const handleOpenAddDetail = (target: AddDetailTarget) => {
    const isOpen = addDetailTarget === target;
    closeAllRightPanes();
    if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
    setAddDetailTarget(target);
  };

  // 拡売費計画引用ペインを開く。
  // 「選択」で計画明細の項目を設定する対象は拡売費一覧のチェックボックス列で選ぶため、
  // 当ペインへ明細は渡さない。
  const handleOpenPlanSelection = () => {
    const isOpen = isPlanSelectionPaneShown;
    closeAllRightPanes();
    if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
    setIsPlanSelectionPaneShown(true);
  };

  // 費用振替ペイン（振替画面）を開く。拡売費一覧の操作メニュー「振替」から呼ばれ、
  // 対象行の情報を振替元情報として反映する。
  const handleOpenTransfer = (row: {
    lineNo?: number | string;
    product?: string;
    payAmount?: number | string;
    mgmtClass?: string;
    mgmtClassName?: string;
    mgmtCode?: string;
    mgmtCodeName?: string;
    measureClass?: string;
    measureCode?: string;
  }) => {
    const isOpen = isAllocatePaneShown;
    closeAllRightPanes();
    if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
    const toNum = (v: number | string | undefined): number | undefined => {
      if (v == null) return undefined;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
      return Number.isFinite(n) ? n : undefined;
    };
    setAllocateSource({
      // 対象年月〜営業担当者は基本情報（SearchPane）の値を参照。
      targetPeriod: BASIC_INFO.targetMonth,
      primaryStore: BASIC_INFO.primaryStore,
      tertiaryStore: BASIC_INFO.tertiaryStore,
      store: BASIC_INFO.store,
      office: BASIC_INFO.office,
      dept: BASIC_INFO.dept,
      staff: BASIC_INFO.staff,
      // ステータスは支払明細情報（PaymentDetailPane）の値を参照。
      status: PAYMENT_DETAIL_STATUS,
      // 対象商品・支払金額は振替対象行から反映。
      product: row.product,
      payAmount: toNum(row.payAmount),
      // 管理区分・管理コード・施策区分・施策コードは振替対象行から反映（コード列・名称列に分割）。
      // 拡売費行は管理区分＝名称／管理コード＝コードを保持するため、
      // 分割元情報の区分値・名称は名称／コードから導出する。
      mgmtClass: managementClassCode(row.mgmtClass ?? ''),
      mgmtClassName: row.mgmtClass,
      mgmtCode: row.mgmtCode,
      mgmtCodeName: managementCodeName(row.mgmtCode ?? ''),
      measureClass: campaignClassCode(row.measureClass ?? ''),
      measureClassName: row.measureClass,
      measureCode: row.measureCode,
      measureCodeName: campaignClassFromCode(row.measureCode ?? ''),
    });
    setIsAllocatePaneShown(true);
  };

  // 分割情報（費用負担部署）編集ペインの本文。入力項目は「費用負担部署（自部署）」のみとする。
  // 選択肢は追加口グリッドの分割情報（費用負担部署）と同じ費用負担部署マスタを使う。
  // ★分割機能：画面から見えないよう一時的にコメントアウト（復旧時はコメントを外す）
  // const splitDeptEditPaneContent = (
  // <div className="flex flex-col h-full">
  // <div className="flex-1 overflow-y-auto bg-white p-4">
  // {/* 入力項目は縦に並べる（自部署の下に他部署①） */}
  // <div className="grid grid-cols-1 gap-4">
  // <div className="space-y-1.5">
  // <Label
  // htmlFor="split-dept-edit-own"
  // className="text-sm font-medium text-gray-700"
  // >
  // 費用負担部署（自部署）
  // </Label>
  // {/* 自部署は追加口グリッドの親行の費用負担部署（＝分割元）を表示する。固定のため非活性。
  // 他部署の削除ボタンと同じ幅の余白を右に置き、入力欄の横幅を揃える。 */}
  // <div className="flex items-center gap-2">
  // <div className="flex-1">
  // <SingleCombobox
  // id="split-dept-edit-own"
  // options={[
  // { value: PARENT_SPLIT_DEPT, label: PARENT_SPLIT_DEPT },
  // ]}
  // value={PARENT_SPLIT_DEPT}
  // onChange={() => {}}
  // disabled
  // />
  // </div>
  // <span aria-hidden className="h-6 w-6 shrink-0" />
  // </div>
  // </div>

  // {splitDeptEditOtherValues.map((value, index) => (
  // <div key={index} className="space-y-1.5">
  // <Label
  // htmlFor={`split-dept-edit-other-${index + 1}`}
  // className="text-sm font-medium text-gray-700"
  // >
  // 費用負担部署（他部署{index + 1}）
  // </Label>
  // {/* 入力欄の右に当該項目の削除ボタンを置く */}
  // <div className="flex items-center gap-2">
  // <div className="flex-1">
  // <SingleCombobox
  // id={`split-dept-edit-other-${index + 1}`}
  // options={COST_BEARING_DEPT_OPTIONS}
  // value={value}
  // onChange={(v) => handleChangeSplitDeptEditOther(index, v)}
  // placeholder="費用負担部署を選択／検索"
  // clearable
  // />
  // </div>
  // <button
  // type="button"
  // onClick={() => handleRemoveSplitDeptEditOther(index)}
  // className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
  // aria-label={`費用負担部署（他部署${index + 1}）を削除`}
  // title="削除"
  // >
  // <Trash2 className="h-4 w-4" />
  // </button>
  // </div>
  // </div>
  // ))}

  // {/* 費用負担部署追加：他部署の入力欄を1件増やす */}
  // <div>
  // <button
  // type="button"
  // className="btn-toolbar-outline"
  // onClick={handleAddSplitDeptEditOther}
  // aria-label="費用負担部署追加"
  // >
  // ＋費用負担部署追加
  // </button>
  // </div>
  // </div>
  // </div>
  // </div>
  // );

  // 列幅・並び順・ソートの永続化（グリッドごとに一意の storageKey）。
  // 分割（IN）の追加口一覧（振替（IN）は追加口を持たない）。
  const splitAddColumnStateProps = useGridColumnState(
    '支払詳細B.他部門分割明細.追加口.columnState.v1'
  );
  // 列構成の変更（操作列・計画紐づけ・計画なし・計画漏れの削除、
  // および先頭への No.／メタブランド追加）に伴い、保存済み列状態を破棄するため版数を上げる。
  // v5→v6：計画金額列（planAmount）を削除。
  const splitExpColumnStateProps = useGridColumnState(
    '支払詳細B.他部門分割明細.拡売費.columnState.v6'
  );
  // 振替（IN）は分割（IN）と別グリッドのため、列状態も別キーで保存する。
  // v4→v5：計画金額列（planAmount）を削除。
  const transferExpColumnStateProps = useGridColumnState(
    '支払詳細B.他部門振替明細.拡売費.columnState.v5'
  );

  // 「他部門から分割された経費明細」の一覧（追加口／拡売費）1件分を描画する。
  // 合計金額サマリーバーは渡された行データから集計し、グリッド高さは
  // 支払情報サマリカードのリサイズハンドルで調整した縦幅（gridHeight）に合わせる。
  // 行の型は一覧ごとに異なる（拡売費＝SplitFromOtherRow、分割（IN）の追加口＝
  // SplitInEntryRow）ため、金額と行キーの取り出し方を引数で受け取る。
  const renderSplitFromOtherList = <T,>(
    rows: T[],
    colDefs: (ColDef<T> | ColGroupDef<T>)[],
    rowIdPrefix: string,
    gridHeight: number,
    columnStateProps: Record<string, unknown>,
    amountOf: (row: T) => number,
    rowKeyOf: (row: T) => number | string
  ) => (
    <div className={`${CARD_CLASS} overflow-hidden`}>
      {/* 合計金額サマリーバー（当一覧のデータを集計）。
          幅は固定せず、表示内容（見出し・金額）が収まる長さにする。 */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
          <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
            合計金額
          </span>
          <div className="flex items-stretch divide-x divide-gray-200">
            {buildSplitSummaryItems(rows.map(amountOf)).map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-end px-3 min-w-0"
              >
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {item.label}
                </span>
                <span
                  className={`text-sm font-bold whitespace-nowrap ${
                    item.emphasize ? 'text-blue-700' : 'text-gray-900'
                  }`}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="expense-item-grid w-full px-3 pb-3 pt-0"
        style={{ height: gridHeight }}
      >
        <AgGridReact<T>
          rowData={rows}
          columnDefs={colDefs}
          defaultColDef={SPLIT_FROM_OTHER_DEFAULT_COL_DEF}
          // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
          columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
          getRowId={(params) => `${rowIdPrefix}-${rowKeyOf(params.data)}`}
          statusBar={GRID_STATUS_BAR}
          {...GRID_BASE_PROPS}
          {...columnStateProps}
        />
      </div>
    </div>
  );

  // 分割・振替 選択時に支払情報サマリカード内へ表示する「他部門から分割された経費明細」一覧
  // （参照専用グリッド・支払詳細(自販機)と同形式）。
  // 分割（IN）は拡売費・追加口タブで表示する一覧を切り替える（支払詳細(追加口請求書有)と同じ）。
  // 振替（IN）は追加口を持たないため、拡売費タブだけを出し、タブを横幅いっぱいに伸ばす。
  // 分割（IN）／振替（IN）で別々のグリッドを表示する（行データ・列状態・行IDを分けて管理する）。
  // タブの選択状態を分割（IN）と振替（IN）で持ち越さないよう、Tabs は key で作り直す。
  const splitFromOtherContent = (
    gridHeight: number,
    tab: '分割' | '振替' = '分割'
  ) => {
    const isTransfer = tab === '振替';
    // 追加口タブを出すか（分割（IN）のみ）。
    const hasAdditionalTab = !isTransfer;
    const expenseRows = isTransfer
      ? TRANSFER_FROM_OTHER_EXPENSE_ROWS
      : SPLIT_FROM_OTHER_EXPENSE_ROWS;
    const expenseColumnState = isTransfer
      ? transferExpColumnStateProps
      : splitExpColumnStateProps;
    const expenseColDefs = isTransfer
      ? TRANSFER_FROM_OTHER_EXPENSE_COL_DEFS
      : SPLIT_FROM_OTHER_EXPENSE_COL_DEFS;
    const rowIdPrefix = isTransfer ? 'trn' : 'spl';
    return (
      <Tabs key={tab} defaultValue="expense" className="w-full">
        <TabsList
          className={`grid w-full ${
            hasAdditionalTab ? 'grid-cols-2' : 'grid-cols-1'
          } mb-4 bg-transparent p-0 h-auto gap-1`}
        >
          <TabsTrigger
            value="expense"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
          >
            <Megaphone className="w-4 h-4" />
            <span className="font-medium">拡売費</span>
          </TabsTrigger>
          {hasAdditionalTab && (
            <TabsTrigger
              value="additional"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="font-medium">追加口</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="expense">
          {renderSplitFromOtherList(
            expenseRows,
            expenseColDefs,
            `${rowIdPrefix}-exp`,
            gridHeight,
            expenseColumnState,
            (r) => r.payAmount,
            (r) => r.no
          )}
        </TabsContent>

        {hasAdditionalTab && (
          <TabsContent value="additional">
            {/* 追加口：他部署から分割された追加口明細（支払詳細(追加口請求書有)と同じ固定のモック行） */}
            {renderSplitFromOtherList(
              SPLIT_IN_ENTRY_ROWS,
              SPLIT_IN_ENTRY_COL_DEFS,
              `${rowIdPrefix}-add`,
              gridHeight,
              splitAddColumnStateProps,
              (r) => r.addAmount,
              (r) => r.lineNo
            )}
          </TabsContent>
        )}
      </Tabs>
    );
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-100">
      {/* 左ペイン：メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* スクロール可能エリア */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-300">
            <div className="px-6 pt-3 pb-2">
              {/* 画面名はヘッダー（システム名の右）に表示する */}
              <ScreenTitle title="支払詳細(追加口請求書無)" />

              {/* 販売計画条件エリア */}
              <section aria-labelledby="search-heading">
                <h2 id="search-heading" className="sr-only">
                  検索条件
                </h2>
                <AdditionalPaymentBasicInfoPane onMenuChange={onMenuChange} />
              </section>

              {/* 支払情報サマリエリア */}
              <section aria-labelledby="aggregation-heading" className="mb-6">
                <h2 id="aggregation-heading" className="sr-only">
                  支払情報サマリ
                </h2>
                <AggregationPane
                  summaryTab={summaryTab}
                  onSummaryTabChange={setSummaryTab}
                  splitContent={splitFromOtherContent}
                  detailTotals={summaryDetailTotals}
                />
              </section>

              {/* 支払明細情報・追加口・拡売費（本体・常時表示）。
                  分割・振替 選択時の「他部門から分割された経費明細」一覧は
                  支払情報サマリカード内（splitContent）へ移設した。 */}
              <div className="w-full mt-2 space-y-0">
                {/* 支払回数（支払詳細(自販機)と同様、タブバーと支払明細情報の間に配置） */}
                <div className="mb-2 flex items-center gap-2">
                  <label
                    htmlFor="invoice-count"
                    className="w-36 text-right text-sm font-bold whitespace-nowrap text-blue-900"
                  >
                    支払回数
                  </label>
                  {/* 回を選ぶと、その回に紐づくデータセット（支払情報・追加口・拡売費）へ表示を切り替える */}
                  <SingleCombobox
                    id="invoice-count"
                    className="w-20"
                    options={[
                      ...rounds.options.map((round) => ({
                        value: round,
                        label: round,
                      })),
                    ]}
                    value={invoiceCount}
                    onChange={rounds.selectRound}
                    placeholder="選択"
                    searchable={false}
                  />
                  {/* 支払回数追加（支払回数プルダウンの右・左に全角2文字程度の空白） */}
                  <button
                    type="button"
                    className="btn-toolbar-outline ml-8"
                    onClick={rounds.requestAddRound}
                    aria-label="支払回数追加"
                  >
                    ＋支払回数追加
                  </button>
                  {/* 支払情報引用（支払回数追加ボタンの右に配置）。
                      押下で引用明細選択ペイン（下ペイン）のみを開く。
                      支払回数の追加は同ペインの「引用」で行う。 */}
                  <button
                    type="button"
                    className="btn-toolbar-outline"
                    onClick={handleQuote}
                    aria-label="支払情報引用"
                  >
                    支払情報引用
                  </button>
                </div>

                {/* 支払明細情報エリア */}
                <section aria-labelledby="payment-detail-heading">
                  <h2 id="payment-detail-heading" className="sr-only">
                    支払情報
                  </h2>
                  {/* key に支払回数を含め、回の切替でその回のデータセットを初期値として再構築する */}
                  <PaymentDetailPane
                    key={`payment-detail-${invoiceCount}`}
                    initialValues={activeRound?.paymentInfo}
                    breakdownItems={paymentBreakdownItems}
                    onStatusClick={() => {
                      const isOpen = isCommentHistoryPaneShown;
                      closeAllRightPanes();
                      if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
                      setIsCommentHistoryPaneShown(true);
                    }}
                  />
                </section>

                {/* 追加口一覧（独立カード） */}
                <section
                  className="mb-4"
                  aria-labelledby="additional-entry-heading"
                >
                  <h2 id="additional-entry-heading" className="sr-only">
                    追加口
                  </h2>
                  <DetailTable
                    key={`detail-table-${invoiceCount}`}
                    ref={detailTableRef}
                    initialRows={activeRound?.entryRows}
                    onBreakdownChange={setEntryBreakdown}
                  />
                </section>

                {/* 拡売費一覧（独立カード） */}
                <section className="mb-4" aria-labelledby="expense-heading">
                  <h2 id="expense-heading" className="sr-only">
                    拡売費
                  </h2>
                  <PaymentNonProductExpensePane
                    key={`non-product-expense-${invoiceCount}`}
                    ref={expenseTableRef}
                    // 請求書を受領しない画面のため、未承認NET／その他の区分を持たない
                    // 単一の一覧とする。
                    variant="without-invoice"
                    initialRows={activeRound?.expenseRows}
                    onOpenPlanSelection={handleOpenPlanSelection}
                    onOpenTransfer={handleOpenTransfer}
                    // 明細行（親行）の商流・組織列に表示する基本情報の値。
                    // 分割の枝番行で選択できる候補（商流／組織マスタ）と表記を
                    // 揃えるため「名称:コード」へ変換して渡す。
                    basicInfo={EXPENSE_BASIC_INFO}
                    onOpenAddExpense={() => handleOpenAddDetail('expense')}
                    // 明細を編集したら未保存とし、引用ボタン押下時に保存を促す。
                    onEdited={() => setHasUnsavedChanges(true)}
                    onBreakdownChange={handleExpenseBreakdownChange}
                    // コピー・明細追加した行を左端の帯で示し、凡例を出す
                    //（一番下に追加されても分かるようにする。販売計画側の表現を踏襲）。
                    showCopySourceBand
                  />
                </section>
              </div>
            </div>
          </div>
        </div>

        {/* 下ペイン：拡売費計画引用。
            プッシュ式：親画面に被さらず中身を押し上げるため、選択エリアと支払明細を同時に視認できる。 */}
        <BottomPane
          open={isPlanSelectionPaneShown}
          onClose={() => setIsPlanSelectionPaneShown(false)}
          title="拡売費計画引用"
          description="拡売費明細へ引用する拡売費計画の明細を選択します"
          // 拡売費明細と拡売費計画引用の表示領域が半分ずつになるよう自動調整する
          //（→ 20260821_第31回 決定事項1）。
          initialHeightRatio={0.5}
          minHeight={18}
          // 先頭の担当エリア選択へ自動フォーカスすると候補が開いてしまうため、ペイン自体へ。
          focusPaneOnOpen
          // 説明文の代わりに、タイトル直下（固定ヘッダー内）へ対象年月・担当エリアを配置。
          // ヘッダーはスクロールしないため常に見える。
          // 一覧には、当ペインで選択した担当エリアと基本情報の対象年月・販売店・
          // 部署(第5階層)をキーに取得した拡売費計画を表示する（モックは担当エリアのみで絞り込む）。
          headerContent={
            <div className="flex flex-wrap items-center gap-4">
              {/* 対象年月（テキストラベル・変更不可）。
                  基本情報（SearchPane）と同じ年月を表示する。 */}
              <div className="flex items-center gap-2">
                <span className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
                  対象年月
                </span>
                <span
                  className={`${FORM_VALUE_CLASS} h-8 flex items-center whitespace-nowrap`}
                >
                  {BASIC_INFO.targetMonth}
                </span>
              </div>
              {/* 担当エリア（複数選択）。支払は担当エリアを持たず、販売店×部署(第5階層)
                  だけで取得すると別担当エリアの計画も含まれるため、取得対象を選べるようにする。 */}
              <PlanAreaField value={planAreas} onChange={setPlanAreas} />
            </div>
          }
        >
          <PaymentPlanSelectionPane
            // 計画情報の「選択」押下：拡売費一覧でチェックした明細へ、当該計画明細の
            // 「管理区分」〜「摘要2（社外用）」を設定する。
            // 設定後も連続して操作できるようペインは開いたままにする。
            onApplyPlanFields={(fields) =>
              expenseTableRef.current?.setPlanFields(fields)
            }
            // ヘッダーで選択した担当エリアの計画明細だけを表示する。
            areaCodes={planAreas}
          />
        </BottomPane>

        {/* 下ペイン：引用明細選択 画面（支払回数右の「引用」ボタンから開く）。
            引用で追加した支払回へ引用する支払明細を選択する。 */}
        <BottomPane
          open={isQuoteSelectionPaneShown}
          onClose={() => setIsQuoteSelectionPaneShown(false)}
          title="引用明細選択"
          headerActions={
            // 引用：ラジオで選んだ伝票の明細を当該支払回へ引用する
            //（当ペインの確定操作）。分割先明細の「分割内容を反映」と同じ位置・
            //  同じテーマ（タイトル行右端・塗り青）。
            <button
              type="button"
              className={`${BUTTON_STYLES.primary} ${BUTTON_BASE} inline-flex h-7 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap`}
              onClick={() => quotePaneRef.current?.apply()}
              aria-label="引用"
            >
              引用
            </button>
          }
          // 説明文の代わりに、タイトル直下（固定ヘッダー内）へ検索条件
          //（対象年月 From-To・支払先）を配置する。
          // ヘッダーはスクロールしないため常に見える。
          headerContent={
            <div className="flex flex-wrap items-center gap-4">
              {/* 対象年月（From-To）。2か月に1度・四半期に1度の支払もあるため、
                  前月に限定せず任意の月から引用できるようにする
                  （→ 20260814_第28回 決定事項2）。 */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="quote-target-month-from"
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
                >
                  対象年月
                </label>
                <MonthYearPicker
                  id="quote-target-month-from"
                  value={quoteMonthFrom}
                  onChange={setQuoteMonthFrom}
                  max={quoteMonthTo || undefined}
                  clearable
                />
                <span className="text-sm text-gray-700">〜</span>
                <MonthYearPicker
                  id="quote-target-month-to"
                  value={quoteMonthTo}
                  onChange={setQuoteMonthTo}
                  min={quoteMonthFrom || undefined}
                  clearable
                />
              </div>

              {/* 支払先（→ 20260728_第24回_共通 決定事項20） */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="quote-payee"
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap`}
                >
                  支払先
                </label>
                <SingleCombobox
                  id="quote-payee"
                  className="w-72"
                  options={[
                    ...QUOTE_PAYEE_OPTIONS.map((payee) => ({
                      value: payee,
                      label: payee,
                    })),
                  ]}
                  value={quotePayee}
                  onChange={setQuotePayee}
                  placeholder="指定なし"
                  clearable
                  searchable={false}
                />
              </div>
            </div>
          }
          // 親画面（拡売費一覧）と当ペインの表示領域が半分ずつになるよう自動調整する。
          initialHeightRatio={0.5}
          minHeight={22}
          maxHeight={52}
        >
          <QuoteSelectionPane
            config={QUOTE_SELECTION_CONFIG}
            ref={quotePaneRef}
            basicInfo={EXPENSE_BASIC_INFO}
            monthFrom={quoteMonthFrom}
            monthTo={quoteMonthTo}
            payee={quotePayee}
            onApply={(quotedRows) => {
              // ラジオで選んだ伝票の明細すべてを、新しく追加する支払回の
              // 拡売費一覧（その他）へコピーする。
              // 引用元の「明細No」は拡売費一覧の「No.」（lineNo）に対応させ、
              // 「卸からの請求名称」〜「請求書ページ」の各列をそのまま引き継ぐ。
              // 枝番行（明細No「X-N」）は拡売費一覧の分割先行として引用する。
              //   ・分割列を「分割先」にし、分割先グループの各列（商流・費用負担部署・
              //     担当者）を引き継ぐ。
              //   ・拡売費一覧の分割先グループは管理区分・管理コード・施策区分・
              //     施策コード・摘要を行自身の値から、分割金額を支払金額（payAmount）
              //     から表示するため、それらへ引用元の分割先グループの値を設定する。
              //   ・継承表示する列（卸からの請求名称〜請求書ページ）は拡売費一覧側で
              //     親行の値を参照するため、引用元の値をそのまま渡す。
              const rows = createQuotedExpenseRows(
                quotedRows.map((row) => ({
                  lineNo: row.detailNo,
                  billName: row.billName,
                  billNote: row.billNote,
                  planExpContent: row.planExpContent,
                  product: row.product,
                  payAmount: row.isBranch
                    ? (row.splitAmount ?? '')
                    : row.payAmount,
                  // 引用した時点では拡売費計画から引用した情報を引き継がないため計画金額は0円とする
                  //（→ 20260814_第28回 決定事項4）。
                  planAmount: 0,
                  taxClass: row.taxClass,
                  mgmtClass: row.isBranch
                    ? (row.splitMgmtClass ?? '')
                    : row.mgmtClass,
                  mgmtCode: row.isBranch
                    ? (row.splitMgmtCode ?? '')
                    : row.mgmtCode,
                  measureClass: row.isBranch
                    ? (row.splitMeasureClass ?? '')
                    : row.measureClass,
                  measureCode: row.isBranch
                    ? (row.splitMeasureCode ?? '')
                    : row.measureCode,
                  summary1: row.isBranch
                    ? (row.splitSummary1 ?? '')
                    : row.summary1,
                  summary2: row.isBranch
                    ? (row.splitSummary2 ?? '')
                    : row.summary2,
                  planDiff: row.planDiff,
                  matchType: '',
                  billNo: row.billNo,
                  billPage: row.billPage,
                  costSplit: row.isBranch ? '分割先' : '',
                  splitPrimaryStore: row.splitPrimaryStore ?? '',
                  splitTertiaryStore: row.splitTertiaryStore ?? '',
                  splitStore: row.splitStore ?? '',
                  splitDept: row.splitDept ?? '',
                  splitStaff: row.splitStaff ?? '',
                }))
              );
              // 支払回数を1つ増やし、引用した明細を持つ新しい回を開く。
              handleQuoteApply(rows);
            }}
          />
        </BottomPane>

        {/* 下ペイン：費用振替 画面（拡売費一覧の操作メニュー「振替」から開く）。 */}
        <BottomPane
          open={isAllocatePaneShown}
          onClose={() => setIsAllocatePaneShown(false)}
          title="費用振替"
          headerActions={
            // 振替内容を反映：編集中の振替先明細を拡売費一覧へ反映する（当ペインの確定操作）。
            // 分割先明細の「分割内容を反映」と同じ位置・同じテーマ（タイトル行右端・塗り青）。
            <button
              type="button"
              className={`${BUTTON_STYLES.primary} ${BUTTON_BASE} inline-flex h-7 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap`}
              onClick={() => allocatePaneRef.current?.register()}
              aria-label="振替内容を反映"
            >
              振替内容を反映
            </button>
          }
          // 親画面（拡売費一覧）と当ペインの表示領域が半分ずつになるよう自動調整する。
          initialHeightRatio={0.5}
          minHeight={30}
          maxHeight={52}
        >
          <AllocationPane
            ref={allocatePaneRef}
            source={allocateSource}
            onConfirm={() => {
              setIsAllocatePaneShown(false);
            }}
          />
        </BottomPane>

        {/* フッターエリア（固定） */}
        <div
          data-screen-footer
          className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10 mt-4 min-w-300"
        >
          <div className="flex flex-wrap gap-3 justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                className="btn-action-base btn-action-outline"
                aria-label="一覧へ戻る"
              >
                <Undo2 className="h-4 w-4" />
                一覧へ戻る
              </button>
              {/* 次の伝票へ：一覧の次の支払伝票へ送るためのボタン（支払詳細(自販機)と同じ）。
                  現時点では画面遷移は行わない（表示のみ）。 */}
              <button
                type="button"
                className="btn-action-base btn-action-outline"
                aria-label="次の伝票へ"
              >
                <ArrowRight className="h-4 w-4" />
                次の伝票へ
              </button>
              {/* 支払無し：当月は支払が発生しない伝票にする。理由はコメント欄へ書く
                  （→ 20260724_第23回_共通 決定事項8）。押下でステータスが
                  未申請⇔支払無しの間を行き来する（支払一覧のボタンと同じ扱い）。 */}
              <button
                type="button"
                onClick={() => setIsNoPayment((prev) => !prev)}
                disabled={!footerActions.noPayment}
                className="btn-action-base btn-action-outline"
                aria-label={isNoPayment ? '支払無しを解除' : '支払無しにする'}
                title="当月は支払が発生しない伝票にします。理由は画面下部のコメントへ入力してください"
              >
                <Ban className="h-4 w-4" />
                {isNoPayment ? '支払無しを解除' : '支払無し'}
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              {/* コメント欄（支払詳細(その他)と同一の複数行テキストエリア） */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <label
                  htmlFor="payment-c-comment"
                  className="text-sm text-gray-600 whitespace-nowrap"
                >
                  コメント
                </label>
                <textarea
                  id="payment-c-comment"
                  value={commentInput}
                  disabled={!footerActions.comment}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="コメントを入力（差戻し理由など）"
                  rows={2}
                  className="h-10 w-full min-w-40 max-w-128 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                />
              </div>
              <button
                className="btn-action-base btn-action-red"
                aria-label="差戻し"
                disabled={!footerActions.sendBack}
              >
                <CornerUpLeft className="h-4 w-4" />
                差戻し
              </button>
              <button
                className="btn-action-base btn-action-green"
                aria-label="承認"
                disabled={!footerActions.approve}
              >
                <Check className="h-4 w-4" />
                承認
              </button>
              <button
                className="btn-action-base btn-action-green"
                aria-label="検印"
                disabled={!footerActions.seal}
              >
                <Stamp className="h-4 w-4" />
                検印
              </button>
              <button
                className="btn-action-base btn-action-outline-blue"
                aria-label="引戻し"
                disabled={!footerActions.retrieve}
              >
                <CornerUpLeft className="h-4 w-4" />
                引戻し
              </button>
              <button
                className="btn-action-base btn-action-green"
                aria-label="申請"
                onClick={handleSaveOrApply}
                disabled={!footerActions.apply}
              >
                <Send className="h-4 w-4" />
                申請
              </button>
              <button
                className="btn-action-base btn-action-blue"
                aria-label="保存"
                onClick={handleSaveOrApply}
                disabled={!footerActions.save}
              >
                <Save className="h-4 w-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 支払回数の切替・追加の確認ポップアップ（支払詳細の各画面で共通）。
          「はい」で入力中の内容を破棄し、対象の回を再マウントして表示する
          （→ 20260804_第26回 決定事項23・24）。 */}
      <PaymentRoundConfirmDialog
        pending={rounds.pending}
        onConfirm={rounds.confirmPending}
        onCancel={rounds.cancelPending}
      />

      {/* 未保存のまま引用ボタンを押した場合のポップアップ。
          保存はこのポップアップからは行わず、閉じたうえで画面の保存ボタンを押してもらう
          （保存の経路を2つにしないため → 20260814_第28回 決定事項6）。 */}
      <ConfirmDialog
        open={isQuoteUnsavedOpen}
        onOpenChange={setIsQuoteUnsavedOpen}
        title="保存の確認"
        description="保存していない入力があります。引用する前に「保存」を押して保存してください。"
        confirmLabel="閉じる"
        onConfirm={() => setIsQuoteUnsavedOpen(false)}
        acknowledgeOnly
      />

      {/* 右ペイン：明細追加（拡売費）。項目・活性/非活性は拡売費一覧の列にそろえる。 */}
      <RightPane
        open={addDetailTarget === 'expense'}
        onClose={() => setAddDetailTarget(null)}
        title="明細追加 - 拡売費"
        description="その他拡売費の明細を追加します"
        footer={addDetailFooter}
      >
        <AddExpensePane
          ref={addExpensePaneRef}
          basicInfo={EXPENSE_BASIC_INFO}
          onAdd={(values) => expenseTableRef.current?.addManualRow(values)}
        />
      </RightPane>

      {/* ★分割機能：画面から見えないよう一時的にコメントアウト（復旧時はコメントを外す）
          右ペイン：分割情報（費用負担部署）編集（明細追加ペインの複製）
          <RightPane
            open={showSplitDeptEditPane}
            onClose={() => setShowSplitDeptEditPane(false)}
            title="分割情報（費用負担部署）編集"
            description="分割情報（費用負担部署）を編集します"
            footer={
              クリア：入力項目を初期値へ戻す（ペインは開いたまま連続入力できる）。
              検索条件のクリアボタンと同テーマ（アウトライン＋RotateCcw アイコン）。
              <Button
                type="button"
                variant="outline"
                className="rounded-lg border-gray-400 text-gray-700 hover:bg-gray-50"
                onClick={handleClearSplitDeptEditForm}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                クリア
              </Button>
            }
          >
            {splitDeptEditPaneContent}
          </RightPane>
      */}

      {/* 右ペイン：コメント履歴（支払詳細の各画面で共通） */}
      <CommentHistoryPane
        open={isCommentHistoryPaneShown}
        onClose={() => setIsCommentHistoryPaneShown(false)}
      />
    </div>
  );
}

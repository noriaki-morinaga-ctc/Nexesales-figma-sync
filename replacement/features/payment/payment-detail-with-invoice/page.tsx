// Todo：朴：C追加口・拡売費支払モック修正中
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
  PlusCircle,
  Megaphone,
  CornerUpLeft,
  Stamp,
  ArrowLeft,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ColGroupDef } from 'ag-grid-community';

import { Button } from '@/components/ui/button';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  GRID_COLORS,
  withHeaderTooltips,
  useGridColumnState,
  GRID_NO_FILTER_COLUMN_TYPES,
  GRID_EMPTY_TEXT,
} from '@/components/grid';
import {
  AdditionalPaymentBasicInfoPane,
  BASIC_INFO,
} from '@/features/payment/shared/payment-detail/AdditionalPaymentBasicInfoPane';
import {
  PREV_MONTH_SPLIT,
  SPLIT_DESTINATION_CANDIDATES,
} from '@/mocks/payment/payment-detail-with-invoice/additionalEntrySplit';
import { SPLIT_IN_ENTRY_ROWS } from '@/mocks/common/additionalEntrySplit';
import type { AdditionalEntrySplitState } from '@/types/paymentDetail';
import { SPLIT_IN_ENTRY_COL_DEFS } from '@/features/payment/shared/payment-detail/splitInEntryColDefs';
import { SplitDestinationSelectPane } from './components/SplitDestinationSelectPane';
import {
  AdditionalEntrySplitPane,
  type AdditionalEntrySplitPaneHandle,
} from './components/AdditionalEntrySplitPane';
import {
  hasAnySplit,
  isSplitEditable,
  type SplitAllocation,
} from '@/utils/payment/payment-detail/additionalEntrySplit';
import {
  PaymentDetailPane,
  PAYMENT_DETAIL_STATUS,
  createPaymentDetailValues,
  createUnappliedPaymentDetailValues,
  createQuotePaymentDetailValues,
  createEmptyPaymentDetailValues,
  type PaymentDetailPaneValues,
} from './components/PaymentDetailPane';
import { AggregationPane } from './components/AggregationPane';
import {
  aggregateSummaryDetails,
  totalSplitOut,
} from '@/utils/payment/payment-detail/paymentSummaryAggregate';
import { DetailTable } from './components/DetailTable';
import {
  createEmptyAmountBreakdown,
  type AmountBreakdown,
} from '@/utils/payment/payment-detail/paymentAmountBreakdown';
import {
  buildWithInvoicePaymentItems,
  computeBilledCenterFeeBreakdown,
  type BilledCenterFeeRow,
} from '@/utils/payment/payment-detail/paymentBreakdownItems';
import { computeEntryCenterFeeTotal } from '@/utils/payment/payment-detail/additionalEntryRules';
import {
  paymentFooterActionStateOf,
  NO_PAYMENT_TITLE,
} from '@/utils/payment/payment-detail/paymentFooterActions';
import type { NetUnapprovedLink } from '@/utils/payment/payment-detail/netUnapprovedLink';
import {
  WITH_INVOICE_DEFAULT_ROUND,
  WITH_INVOICE_PAYMENT_ROUNDS,
  WITH_INVOICE_ROUND_BILLING_METHODS,
  createWithInvoiceBilledCenterFeeRows,
  createWithInvoiceEntryRows,
  createWithInvoiceExpenseRows,
} from '@/mocks/payment/payment-detail-with-invoice/paymentDetail';
import { PaymentNonProductExpensePane } from '@/features/payment/shared/payment-detail/PaymentNonProductExpensePane';
import {
  createEmptyExpenseRows,
  createQuotedExpenseRows,
} from '@/utils/payment/payment-detail/nonProductExpenseRows';
import type {
  PaymentNonProductExpensePaneHandle,
  ExpenseRow,
  AdditionalEntryData,
  ExpenseBasicInfo,
} from '@/types/paymentDetail';
// 支払回数の切替・追加（支払詳細の各画面で共通）。
import { usePaymentRounds } from '@/features/payment/shared/payment-detail/usePaymentRounds';
import { PaymentRoundConfirmDialog } from '@/features/payment/shared/payment-detail/PaymentRoundConfirmDialog';
import type {
  DetailTableHandle,
  EntryBreakdowns,
} from './components/DetailTable';
import {
  ALL_PLAN_AREA_CODES,
  PaymentPlanSelectionPane,
  PlanAreaField,
} from '@/features/payment/shared/payment-detail/PaymentPlanSelectionPane';
import {
  QuoteSelectionPane,
  QUOTE_TARGET_MONTH_FROM,
  QUOTE_TARGET_MONTH_TO,
  QUOTE_PAYEE_ALL,
  QUOTE_PAYEE_OPTIONS,
  type QuoteSelectionPaneHandle,
  QUOTE_SELECTION_CONFIG,
} from './constants';
// 下ペイン共通フッタのボタンで使用する共通スタイル。
import {
  BUTTON_STYLES,
  BUTTON_BASE,
  FORM_LABEL_CLASS,
  FORM_VALUE_CLASS,
  CARD_CLASS,
} from '@/styles/commonStyles';

import {
  AllocationPane,
  type AllocationPaneHandle,
  type AllocationPaneSource,
} from '@/features/payment/shared/payment-detail/AllocationPane';
import { RightPane } from '@/components/ui/right-pane';
import { CommentHistoryPane } from '@/components/shared/common/CommentHistoryPane';
import {
  AddEntryPane,
  type AddEntryPaneHandle,
} from './components/AddEntryPane';
import {
  AddExpensePane,
  type AddExpensePaneHandle,
} from './components/AddExpensePane';
import { BottomPane } from '@/components/ui/bottom-pane';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { SingleCombobox } from '@/components/ui/single-combobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  campaignClassCode,
  managementClassCode,
  managementCodeName,
} from '@/utils/payment/payment-detail/paymentComboFieldOptions';
import { campaignClassFromCode } from '@/utils/common/expenseRelations';
import { ScreenTitle } from '@/components/ui/screen-title';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PaymentRoundBar } from '@/features/payment/shared/payment-detail/PaymentRoundBar';
import { FooterCommentField } from '@/components/shared/common/FooterCommentField';

// ── モックデータ ────────────────────────────────────────────

// 拡売費一覧の商流・組織列（販売店〜担当者）に表示する基本情報の値。
// 基本情報も分割の枝番行で選択できる候補（商流／組織マスタ）も「コード:名称」（→ 02 §9-1・UX-114）。
const EXPENSE_BASIC_INFO: ExpenseBasicInfo = {
  primaryStore: BASIC_INFO.primaryStore,
  tertiaryStore: BASIC_INFO.tertiaryStore,
  store: BASIC_INFO.store,
  // 費用負担部署＝基本情報の「部署」
  dept: BASIC_INFO.dept,
  // 担当者＝基本情報の「営業担当者」（複数はカンマ区切りのまま表示する）
  staff: BASIC_INFO.staff,
};

// 支払No.（タブ見出し用。支払詳細(自販機)のタブ1タイトルと同形式）。
// 値は基本情報（SearchPane）の「支払明細書No」と揃える。

// 「他部門から分割された経費明細」タブの1行分の型（参照専用・拡売費構成に準拠）
interface SplitFromOtherRow {
  no: number; // No.
  billName: string; // 卸からの請求名称（請求EDIから連携された商品名）
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
    srcDept: '10002985:首都圏営業第一部',
    srcStaff: '5172734:アサヒ　花子',
  },
  {
    measureClass: '30',
    measureClassName: 'スポット',
    measureCode: 'SS002',
    measureCodeName: 'スポットサンプリング',
    srcPaymentNo: 'C2400NTO2',
    srcPaymentCount: 2,
    srcDetailNo: 1,
    srcDept: '10003002:中部営業部',
    srcStaff: '5172735:アサヒ　次郎',
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
    srcDept: '10003001:関西第1営業部',
    srcStaff: '5172736:アサヒ　美咲',
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
    srcDept: '10003002:中部営業部',
    srcStaff: '5172735:アサヒ　次郎',
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
  // 参照専用の一覧だが、見出しクリックでの並べ替えは行える（他の明細一覧と同様）。
  sortable: true,
  filter: false,
  suppressMovable: true,
};

// 明細追加ペインの対象（追加口／拡売費）。null は閉じている状態。
type AddDetailTarget = 'entry' | 'expense' | null;

// 支払回数の選択肢（プルダウンの表示順）。
const PAYMENT_ROUND_OPTIONS = WITH_INVOICE_PAYMENT_ROUNDS;

// 支払回数1回分のデータセット（支払情報＋追加口＋拡売費）。
// 支払回数プルダウンで回を切り替えると、この単位で表示を差し替える。
interface PaymentRoundDataSet {
  paymentInfo: PaymentDetailPaneValues; // 支払情報の入力値
  entryRows: AdditionalEntryData[]; // 追加口の明細行
  expenseRows: ExpenseRow[]; // 拡売費の明細行
  // 請求詳細から反映したセンターフィの明細（画面に出さず裏で持ち、合計表のセンターフィにだけ使う）。
  billedCenterFeeRows: BilledCenterFeeRow[];
}

// 申請前（未申請）で始める支払回。追加口分割を編集できる状態を確認するための回
//（他の回は承認待ち＝申請後のため、分割は参照のみで開く → 第33回 決定事項16）。
const UNAPPLIED_ROUND = '2';

// 1回分のデータセットを新規生成する（回ごとに中身の異なるモック明細 → src/mocks/payment/payment-detail-with-invoice/paymentDetail）。
// 支払回数1＝請求EDI・手入力、2＝AIC入力・手入力、3＝請求EDI・AIC入力・手入力の明細。
// 拡売費の未承認NETの明細は、同じ回の追加口明細の拡売費金額（NET未承認）から作る。
const createRoundDataSet = (round: string): PaymentRoundDataSet => {
  const entryRows = createWithInvoiceEntryRows(round);
  const paymentInfo =
    round === UNAPPLIED_ROUND
      ? createUnappliedPaymentDetailValues()
      : createPaymentDetailValues();
  return {
    paymentInfo: {
      ...paymentInfo,
      billingMethod:
        WITH_INVOICE_ROUND_BILLING_METHODS[round] ?? paymentInfo.billingMethod,
    },
    entryRows,
    expenseRows: createWithInvoiceExpenseRows(round, entryRows),
    billedCenterFeeRows: createWithInvoiceBilledCenterFeeRows(round),
  };
};

// 支払回数の選択肢の数だけデータセットを用意する。
const createRoundDataSets = (): Record<string, PaymentRoundDataSet> =>
  Object.fromEntries(
    PAYMENT_ROUND_OPTIONS.map((round) => [round, createRoundDataSet(round)])
  );

// 支払回ごとの追加口分割の初期状態。分割は支払回数ごとに独立して持つ。
// 支払回数「1」は申請済みの支払（基本情報の「分割有」）のため、前月と同じ分割を設定済みとする。
// それ以外の回は分割なしで始める（保持が無い回は分割なしとして扱う）。
const createInitialSplitByRound = (): Record<
  string,
  AdditionalEntrySplitState
> => ({
  '1': {
    destIds: [...PREV_MONTH_SPLIT.destIds],
    allocations: PREV_MONTH_SPLIT.allocations.map((a) => ({ ...a })),
  },
});

// 引用で追加する支払回のデータセット。
// 支払情報は支払回数「1」とは別の内容を初期表示し、追加口は明細0件とする。
// 拡売費（その他拡売費）には引用明細選択で引用した明細を初期表示する。
const createQuoteRoundDataSet = (
  expenseRows: ExpenseRow[]
): PaymentRoundDataSet => ({
  paymentInfo: createQuotePaymentDetailValues(),
  entryRows: [],
  expenseRows,
  billedCenterFeeRows: [],
});

// 「＋支払回数追加」で追加する支払回のデータセット。
// 支払情報は入力前のブランク、追加口は明細0件、拡売費はグループ合計行だけの空一覧とする。
const createEmptyRoundDataSet = (): PaymentRoundDataSet => ({
  paymentInfo: createEmptyPaymentDetailValues(),
  entryRows: [],
  expenseRows: createEmptyExpenseRows(),
  billedCenterFeeRows: [],
});

// 追加口分割ペインの自部署負担分の見出しに出す情報（基本情報の部署・先頭の営業担当者・三次店）。
// 基本情報は「コード:名称」で保持しているため、名称部分を取り出す。
const nameOfCodeName = (value: string): string =>
  value.includes(':') ? value.slice(value.indexOf(':') + 1) : value;
const SPLIT_SELF_INFO = {
  deptName: nameOfCodeName(BASIC_INFO.dept),
  staffName: nameOfCodeName(BASIC_INFO.staff.split(',')[0] ?? ''),
  tertiaryName: nameOfCodeName(BASIC_INFO.tertiaryStore),
  primaryName: nameOfCodeName(BASIC_INFO.primaryStore),
};

// 下ペインを開いたあと、selector の要素を画面内スクロール領域の先頭へスクロールする。
// ペインの展開（高さ・押し上げのトランジション）が終わってから動かす。
// scrollIntoView は main/ドキュメントまで動かして sticky ヘッダーの表示を乱すため使わず、
// 最も近いスクロール可能な祖先だけを動かす。戻り値はタイマーの解除（useEffect のクリーンアップ）。
const scrollToTopAfterPaneOpen = (selector: string): (() => void) => {
  const id = window.setTimeout(() => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return; // 対象のカードを折り畳んでいる場合などは何もしない
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
};

export default function PaymentDetailWithInvoice() {
  // 追加口一覧から連動する「未承認NET拡売費」データ（拡売費一覧へ渡す）
  // 支払回数つき。拡売費カードは表示中の支払回数の値だけを当てる（→ utils/payment/payment-detail/netUnapprovedLink）。
  const [netUnapproved, setNetUnapproved] = useState<
    NetUnapprovedLink | undefined
  >(undefined);
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
    // 既定で表示する支払回数は3回目（モックのため）。データ元の違う明細（請求EDI・AIC入力・手入力）が
    // 混在する回を開いた時点で見せるためで、業務の決まりではない（→ WITH_INVOICE_DEFAULT_ROUND）。
    initialRound: WITH_INVOICE_DEFAULT_ROUND,
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
  // 追加口カードからの未承認NETの連動データに、表示中の支払回数を付けて拡売費カードへ渡す。
  // 支払回数を切り替えた直後に前の回の値が残っていても、拡売費カードは別の回の値を当てない。
  const handleNetUnapprovedChange = useCallback(
    (link: NetUnapprovedLink) =>
      setNetUnapproved({ ...link, round: invoiceCount }),
    [invoiceCount]
  );

  // 支払情報カードの合計表の元になる、表示中の支払回の合計表（追加口計・拡売費計）。
  // 各カードが集計して通知する（回の切替で各カードが作り直され、その回の値を通知し直す）。
  const [entryBreakdowns, setEntryBreakdowns] = useState<EntryBreakdowns>(
    () => ({
      entry: createEmptyAmountBreakdown(),
      centerFeeAmount: 0,
    })
  );
  const [expenseBreakdown, setExpenseBreakdown] = useState<AmountBreakdown>(
    createEmptyAmountBreakdown
  );
  // 支払情報サマリの「センターフィ額」（支払・実績情報）へ渡す、支払回ごとのセンターフィ額。
  // サマリは支払回数をまたいで加算するため回ごとに持ち、表示中の回は追加口カードの通知で更新する。
  const [centerFeeByRound, setCenterFeeByRound] = useState<
    Record<string, number>
  >(() =>
    Object.fromEntries(
      Object.entries(createRoundDataSets()).map(([round, dataSet]) => [
        round,
        computeEntryCenterFeeTotal(dataSet.entryRows),
      ])
    )
  );
  const summaryCenterFeeAmount = useMemo(
    () =>
      Object.values(centerFeeByRound).reduce(
        (sum: number, v: number) => sum + v,
        0
      ),
    [centerFeeByRound]
  );
  // 追加口カードからの通知。カードの effect が依存するため参照を支払回ごとに固定する。
  const handleEntryBreakdownChange = useCallback(
    (breakdowns: EntryBreakdowns) => {
      setEntryBreakdowns(breakdowns);
      setCenterFeeByRound((prev) => ({
        ...prev,
        [invoiceCount]: breakdowns.centerFeeAmount,
      }));
    },
    [invoiceCount]
  );
  // 合計表のセンターフィ（表示中の支払回）。請求詳細のセンターフィ（裏で持つ明細）をサマリ商品ごとに
  // 合算し、請求・支払とも同じ値で出す。支払情報サマリのセンターフィ額（追加口明細から求める）とは別の値。
  const activeBilledCenterFeeRows = activeRound?.billedCenterFeeRows;
  const centerFeeBreakdown = useMemo(
    () => computeBilledCenterFeeBreakdown(activeBilledCenterFeeRows ?? []),
    [activeBilledCenterFeeRows]
  );
  // 支払情報カードの合計表。税抜金額計＝追加口計＋センターフィ＋拡売費計（セルごとに足す）。
  // 未承認NET分は追加口計と拡売費計の両方に含まれるが、別軸の支払のため二重計上としない
  //（追加口金額＝販売数に対する支払、拡売費金額＝広告宣伝に対する支払）。
  // 支払情報エリアの下に税率ごとの合計金額（税抜）を出す（→ 20260710_第16回 決定事項12）。
  const paymentBreakdownItems = useMemo(
    () =>
      buildWithInvoicePaymentItems({
        entry: entryBreakdowns.entry,
        centerFee: centerFeeBreakdown,
        expense: expenseBreakdown,
      }),
    [entryBreakdowns, centerFeeBreakdown, expenseBreakdown]
  );

  // 追加口分割の状態（支払回数ごと）。［設定］で当該回の値を更新する（→ Step 6）。
  const [splitByRound, setSplitByRound] = useState<
    Record<string, AdditionalEntrySplitState>
  >(createInitialSplitByRound);
  const activeSplit = splitByRound[invoiceCount];
  // 支払情報サマリへ渡す、分割先へ出した分の合計（全支払回）。サマリは支払回数をまたいで
  // 加算するため、全回の分割を合計する（→ 第33回 決定事項17）。
  // 追加口明細はグリッドの編集で行オブジェクトが直接書き換わる（分割先の金額は追加口バラ単価に
  // 連動する）ため、メモ化せず描画のたびに求め直す。
  const summarySplitOut = totalSplitOut(
    splitByRound,
    Object.fromEntries(
      Object.entries(roundDataSets).map(([round, dataSet]) => [
        round,
        dataSet.entryRows,
      ])
    )
  );
  const activeHasSplit = !!activeSplit && hasAnySplit(activeSplit.allocations);
  // フッターのボタンの活性（常に表示し、ステータスで活性を決める → 要件 55・52 のフッター）。
  // 支払無しを押した回は、ステータスを「支払無し」として扱う。
  const footerActions = paymentFooterActionStateOf(
    isNoPayment ? '支払無し' : (activeRound?.paymentInfo.status ?? '')
  );
  // 表示中の支払回で分割を編集できるか（申請前・差戻しのみ。→ 第33回 決定事項16）。
  const isActiveSplitEditable = isSplitEditable(
    activeRound?.paymentInfo.status ?? ''
  );
  // 追加口分割の下ペイン（分割先商流販売店の選択 → 追加口分割）を開いているか。
  const [isSplitPaneShown, setIsSplitPaneShown] = useState(false);
  // 下ペインのステップ（1＝分割先商流販売店の選択、2＝追加口分割）。
  const [splitStep, setSplitStep] = useState<1 | 2>(1);
  // ペインで選択中の分割先（［設定］までは当該回の分割状態には反映しない）。
  const [splitDraftDestIds, setSplitDraftDestIds] = useState<string[]>([]);
  // ペインで入力中のケース・バラ。ステップ1へ戻っても入力を保持し、再度［次へ］で引き継ぐ。
  // チェックを外した分割先の入力は、ステップ2では使わない（＝自部署負担分に戻る）。
  const [splitDraftAllocations, setSplitDraftAllocations] = useState<
    SplitAllocation[]
  >([]);
  const splitPaneRef = useRef<AdditionalEntrySplitPaneHandle>(null);
  // ステップ2の列に並べる分割先（候補の並び順）。
  const splitDraftDestinations = useMemo(
    () =>
      SPLIT_DESTINATION_CANDIDATES.filter((c) =>
        splitDraftDestIds.includes(c.id)
      ),
    [splitDraftDestIds]
  );
  // 分割は支払回数ごとに独立しているため、回を切り替えたらペインを閉じる
  //（別の回の内容を表示したまま入力させない）。
  useEffect(() => {
    setIsSplitPaneShown(false);
  }, [invoiceCount]);

  // 引用明細選択 画面（下ペイン）。引用ボタンから開く。
  const [isQuoteSelectionPaneShown, setIsQuoteSelectionPaneShown] =
    useState(false);
  // 親画面に未保存の入力があるか。引用ボタン押下時に保存を促すために持つ
  //（→ 20260814_第28回 決定事項6）。
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // 未保存のまま引用ボタンを押した場合に出す、保存を促すポップアップ。
  const [isQuoteUnsavedOpen, setIsQuoteUnsavedOpen] = useState(false);
  // 引用明細選択の検索条件（対象年月 From-To・支払先）。
  // ペインタイトル直下の固定ヘッダーに配置するため、親で保持する。
  // 引用元の伝票は一覧の伝票行のラジオで選ぶため、親では state を持たない。
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

  // 下ペインを開いたら、関係する一覧が画面内スクロール領域の先頭
  //（ヘッダーメニュー直下）へ来るようスクロールする。下ペインが画面の下半分を使うため、
  // 親画面（一覧）が上半分・下ペインが下半分の並びになる
  //（→ 20260821_第31回 決定事項1。計画詳細の「拡売費計画(コピー元)」ペインと同じ挙動）。
  //   ・販売計画選択・引用明細選択・費用振替 … 拡売費一覧
  //   ・追加口分割                          … 追加口カード
  useEffect(() => {
    if (!isBottomPaneOpen) return;
    return scrollToTopAfterPaneOpen('.expense-grid');
  }, [isBottomPaneOpen]);

  useEffect(() => {
    if (!isSplitPaneShown) return;
    return scrollToTopAfterPaneOpen(
      '[aria-labelledby="additional-entry-heading"]'
    );
  }, [isSplitPaneShown]);

  // 明細系右ペインの状態管理。
  // 明細追加ペインは追加口・拡売費で項目が異なるため、どちらを開いているかを持つ。
  const [addDetailTarget, setAddDetailTarget] = useState<AddDetailTarget>(null);
  // 明細追加ペイン操作用（ペイン下部の「追加」ボタンから呼ぶ）。
  const addEntryPaneRef = useRef<AddEntryPaneHandle>(null);
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
  // 支払情報サマリの支払の行（支払函数・追加口金額・拡売費）。全支払回数の明細から集計する
  //（→ 補足3-2 支払情報サマリの集計）。追加口明細は行オブジェクトが直接書き換わり、
  // 編集のたびに合計表の通知で再描画されるため、メモ化せず描画のたびに求め直す。
  const summaryDetailTotals = aggregateSummaryDetails(
    Object.entries(roundDataSets).map(([round, dataSet]) => ({
      entryRows: dataSet.entryRows,
      expenseRows:
        activeExpenseRows?.round === round
          ? activeExpenseRows.rows
          : dataSet.expenseRows,
    })),
    'with-invoice'
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

  // 引用ボタン押下：引用明細選択ペイン（下ペイン）を開くだけとする。
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

  // 引用明細選択の「引用」押下：
  //   1. 現在の最大回数＋1 の支払回数を選択肢に追加して表示する（確認は挟まない）。
  //   2. 追加した回のデータセットを引用した明細で上書きする
  //      （支払情報は引用用の初期値、追加口は明細0件、拡売費は引用した明細）。
  //   3. 引用明細選択ペインを閉じる。
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
  // 追加口の「拡売費処理／に移動」で移した明細の行データ（キー＝移動時の追加口No.）。
  // 拡売費一覧の「追加口処理」で元の明細をそのまま戻すために保持する。
  const movedEntryRowsRef = useRef(new Map<string, AdditionalEntryData>());

  // 追加口の「拡売費処理／に移動」ボタン押下に応じて、拡売費一覧（その他）の行を増減する。
  //   '拡売費処理' → その他一覧の最下部に当該行（同名項目を引き継ぐ）を追加。
  //   '-'          → 当該追加口行番に紐づく拡売費行を削除（戻し処理）。
  const handleExpProcessChange = (row: AdditionalEntryData, value: string) => {
    if (value === '拡売費処理') {
      // 追加口一覧から外れた明細の分割入力は消す（分割の対象は追加口明細のみ）。
      setSplitByRound((prev) => {
        const current = prev[invoiceCount];
        if (!current) return prev;
        return {
          ...prev,
          [invoiceCount]: {
            ...current,
            allocations: current.allocations.filter(
              (a) => String(a.lineNo) !== String(row.lineNo)
            ),
          },
        };
      });
      // 「追加口処理」で元に戻せるよう、移動した明細の行データを退避する。
      movedEntryRowsRef.current.set(String(row.lineNo), row);
      expenseTableRef.current?.addFromAddition({
        sourceLineNo: row.lineNo,
        product: row.productName,
        // 拡売費の請求金額は追加口の請求情報の金額（＝請求書に記載された金額）を引き継ぐ。
        billAmount: row.amount,
        payAmount: row.payAmount,
        // データ元・摘要1・摘要2は同名の項目のためそのまま引き継ぐ。
        dataSource: row.dataSource,
        originDataSource: row.originDataSource,
        summary1: row.summary1,
        summary2: row.summary,
        // 拡売費の消費税は課税10%を初期値とする（追加口は課税8%）。
        // 消費税コード・名称はPRIMEのものを使い、拡売費はS始まり・追加口はF始まりとする
        //（→ 20260724_第23回_共通 決定事項10。コードの採番はPRIMEマスタのため基本設計で定める）。
        taxClass: '1:課税10%',
        // 照合支払区分・請求書情報は追加口明細の値を引き継ぐ。
        // 請求書番号は追加口明細・拡売費明細で同じ項目（保持するフィールド名のみ異なる）。
        matchType: row.matchType,
        billNo: row.billDetailNo,
        billPage: row.billPage,
      });
    } else {
      expenseTableRef.current?.removeBySource(row.lineNo);
    }
  };

  // 拡売費一覧の「追加口処理」ボタン押下時：当該明細を追加口一覧へ移す。
  //   ・追加口から「拡売費処理／に移動」で移してきた明細（sourceLineNo あり）は、
  //     移動時に退避した行データをそのまま追加口一覧の最終行へ戻し、拡売費一覧から取り除く。
  //   ・拡売費一覧で作られた明細は追加口一覧に元の行が無いため、入力値から1行作って追加する。
  const handleRevertToAddition = (expRow: {
    sourceLineNo?: number | string;
    product?: string;
    billAmount?: number | string;
    payAmount?: number | string;
    matchType?: string;
    summary1?: string;
    summary2?: string;
    billNo?: string;
    billPage?: string;
  }) => {
    if (expRow.sourceLineNo != null && expRow.sourceLineNo !== '') {
      const key = String(expRow.sourceLineNo);
      const movedRow = movedEntryRowsRef.current.get(key);
      if (movedRow) {
        movedEntryRowsRef.current.delete(key);
        detailTableRef.current?.restoreEntry(movedRow);
      }
      expenseTableRef.current?.removeBySource(expRow.sourceLineNo);
      return;
    }
    detailTableRef.current?.addFromExpense({
      productName: String(expRow.product ?? ''),
      billAmount: expRow.billAmount ?? '',
      payAmount: expRow.payAmount ?? '',
      matchType: expRow.matchType,
      summary1: expRow.summary1,
      summary2: expRow.summary2,
      // 請求書番号・請求書ページは拡売費明細の値を追加口明細へ引き継ぐ
      //（追加口明細では billDetailNo／billPage が同じ項目にあたる）。
      billNo: expRow.billNo,
      billPage: expRow.billPage,
    });
  };

  // すべての右ペインを閉じるヘルパー関数
  const closeAllRightPanes = () => {
    setIsCommentHistoryPaneShown(false);
    setIsPlanSelectionPaneShown(false);
    setIsAllocatePaneShown(false);
    setAddDetailTarget(null);
    setIsQuoteSelectionPaneShown(false);
    setIsSplitPaneShown(false);
  };

  // 追加口分割の下ペインを開く（追加口カードの［追加口分割］から呼ぶ）。
  // 申請後の支払回も開けるが、参照のみで開く（→ 第33回 決定事項16）。
  // 分割先の初期チェックは、当該回に保存済みの分割があればその分割先、無ければ前月の分割先
  //（→ 第33回 決定事項4）。前月から引き継ぐのは分割先のチェックだけとする。
  const handleOpenSplit = () => {
    const isOpen = isSplitPaneShown;
    closeAllRightPanes();
    if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
    // ケース・バラの初期値は、保存済みの分割があればその値、無ければ0とする。
    // 明細は業務KEYを持たず No. は表示順の連番のため、前月の明細と紐づけられない
    //（→ 課題0869）。前月のケース・バラは引き継がない。
    const source =
      activeSplit && activeSplit.destIds.length > 0
        ? activeSplit
        : { destIds: PREV_MONTH_SPLIT.destIds, allocations: [] };
    setSplitDraftDestIds([...source.destIds]);
    setSplitDraftAllocations(source.allocations.map((a) => ({ ...a })));
    setSplitStep(1);
    setIsSplitPaneShown(true);
  };

  // ［設定］：ペインの入力を当該支払回の分割に反映する。
  //   ・DB へは書き込まず、親画面の状態に反映するだけ。DB への書き込みは親画面の
  //     保存・申請で行う（→ 第33回 決定事項13）。保存せずに離脱すれば破棄される
  //   ・分割先に明細が出るのは分割元を申請したとき（→ 決定事項5。モックでは分割（IN）は固定行）
  //   ・全て 0 なら「分割なし」に戻る（hasAnySplit）
  //   ・追加口明細グリッドの値は変えない。支払情報サマリは分割後の自部署負担分になる（→ 決定事項15・17）
  const handleApplySplit = () => {
    const allocations = splitPaneRef.current?.getAllocations();
    if (!allocations) return;
    setSplitByRound((prev) => ({
      ...prev,
      [invoiceCount]: { destIds: [...splitDraftDestIds], allocations },
    }));
    setHasUnsavedChanges(true);
    setIsSplitPaneShown(false);
    toast.success(
      hasAnySplit(allocations)
        ? '追加口の分割を反映しました。保存または申請で確定します。'
        : '追加口の分割を取りやめました（全量が自部署負担分）。保存または申請で確定します。'
    );
  };

  // 明細追加ペインの追加実行。
  //   追加後もペインは閉じず、入力欄を空に戻して続けて登録できる（初期化は各ペインの submit が行う）。
  //   不要になったら×でペインを閉じる（→ 9/24 第25回 共通 決定事項4：連続追加ボタンは廃止）
  const handleAddDetailSubmit = () => {
    if (addDetailTarget === 'entry') addEntryPaneRef.current?.submit();
    else addExpensePaneRef.current?.submit();
  };

  // 明細追加ペインのフッタ（追加口・拡売費で共通）。
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

  // 列幅・並び順・ソートの永続化（グリッドごとに一意の storageKey）。
  // v2→v3：拡売費No列を削除した。
  // v3→v4：分割（IN）の追加口一覧を追加口の明細項目＋分割元の列構成に作り直した。
  const splitAddColumnStateProps = useGridColumnState(
    '支払詳細C.他部門分割明細.追加口.columnState.v4'
  );
  // 列構成の変更（操作列・計画紐づけ・計画なし・計画漏れの削除）に伴い、
  // 保存済み列状態を破棄するため版数を上げる。
  // v4→v5：計画金額列（planAmount）を削除。
  // v5→v6：先頭に No.／メタブランド列を追加（追加口一覧と並びをそろえた）。
  const splitExpColumnStateProps = useGridColumnState(
    '支払詳細C.他部門分割明細.拡売費.columnState.v6'
  );
  // 振替（IN）は分割（IN）と別グリッドのため、列状態も別キーで保存する。
  // v3→v4：計画金額列（planAmount）を削除。
  // v4→v5：先頭に No.／メタブランド列を追加（追加口一覧と並びをそろえた）。
  const transferExpColumnStateProps = useGridColumnState(
    '支払詳細C.他部門振替明細.拡売費.columnState.v5'
  );

  // 「他部門から分割された経費明細」の一覧（追加口／拡売費）1件分を描画する。
  // 合計金額サマリーバーは渡された行データから集計し、グリッド高さは
  // 支払情報サマリカードのリサイズハンドルで調整した縦幅（gridHeight）に合わせる。
  // 行の型は一覧ごとに異なる（拡売費・振替の追加口＝SplitFromOtherRow、分割（IN）の追加口＝
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
  // 分割（IN）は拡売費・追加口タブで表示する一覧を切り替える（販売計画(集計)のグラフタブと同形式）。
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
            {/* 追加口：他部署から分割された追加口明細（固定のモック行 → 実装計画 決定事項2） */}
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
              <ScreenTitle title="支払詳細(追加口請求書有)" />

              {/* 販売計画条件エリア */}
              <section aria-labelledby="search-heading">
                <h2 id="search-heading" className="sr-only">
                  検索条件
                </h2>
                <AdditionalPaymentBasicInfoPane />
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
                  splitOut={summarySplitOut}
                  centerFeePayAmount={summaryCenterFeeAmount}
                />
              </section>

              {/* 支払明細情報・追加口・拡売費（本体・常時表示）。
                  分割・振替 選択時の「他部門から分割された経費明細」一覧は
                  支払情報サマリカード内（splitContent）へ移設した。 */}
              <div className="w-full mt-2 space-y-0">
                {/* 支払回数（共通部品。項目名は下のカードの支払先に縦にそろえる → UX-113） */}
                <div className="mb-2">
                  <PaymentRoundBar
                    roundOptions={rounds.options}
                    invoiceCount={invoiceCount}
                    onSelectRound={rounds.selectRound}
                    onAddRound={rounds.requestAddRound}
                    onQuotePaymentInfo={handleQuote}
                  />
                </div>

                {/* 支払明細情報エリア（PaymentDetailWithInvoiceから直接表示） */}
                <section aria-labelledby="payment-detail-heading">
                  <h2 id="payment-detail-heading" className="sr-only">
                    支払情報
                  </h2>
                  {/* key に支払回数を含め、回の切替でその回のデータセットを初期値として再構築する */}
                  <PaymentDetailPane
                    key={`payment-detail-${invoiceCount}`}
                    initialValues={activeRound?.paymentInfo}
                    breakdownItems={paymentBreakdownItems}
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
                    onOpenAddDetail={() => handleOpenAddDetail('entry')}
                    onOpenSplit={handleOpenSplit}
                    hasSplit={activeHasSplit}
                    onNetUnapprovedChange={handleNetUnapprovedChange}
                    onExpProcessChange={handleExpProcessChange}
                    onBreakdownChange={handleEntryBreakdownChange}
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
                    initialRows={activeRound?.expenseRows}
                    onOpenPlanSelection={handleOpenPlanSelection}
                    onOpenTransfer={handleOpenTransfer}
                    onRevertToAddition={handleRevertToAddition}
                    netUnapproved={netUnapproved}
                    round={invoiceCount}
                    // 明細行（親行）の商流・組織列に表示する基本情報の値。
                    // 分割の枝番行で選択できる候補（商流／組織マスタ）と同じ「コード:名称」。
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

        {/* 下ペイン：追加口分割（ステップ1 分割先商流販売店の選択 → ステップ2 追加口分割）。
            上半分に追加口カードを残したまま、明細を見ながら配分を決められる。 */}
        <BottomPane
          open={isSplitPaneShown}
          onClose={() => setIsSplitPaneShown(false)}
          title={
            splitStep === 1
              ? '追加口分割 － 分割先商流販売店の選択'
              : '追加口分割 － ケース・バラ入力'
          }
          // 対象年月・支払No・販売店などは押し出し式で見えている親画面で確認できるため出さず、
          // 手順と参照のみの表示だけを置く（→ 要件書 AF795 へのコメント C44・第24回 共通 決定事項7）。
          headerContent={
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                ステップ {splitStep}／2
              </span>
              {/* 申請後の支払回は参照のみで開く（→ 第33回 決定事項16） */}
              {!isActiveSplitEditable && (
                <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
                  参照のみ（申請後のため変更できません）
                </span>
              )}
            </div>
          }
          footer={
            splitStep === 1 ? (
              <div className="flex w-full items-center gap-2">
                {/* 申請後の支払回は参照のみのため、常に表示したうえで非活性にする。 */}
                <button
                  type="button"
                  className="btn-toolbar-outline"
                  disabled={!isActiveSplitEditable}
                  onClick={() =>
                    setSplitDraftDestIds([...PREV_MONTH_SPLIT.destIds])
                  }
                >
                  前月設定に戻す
                </button>
                <button
                  type="button"
                  className="btn-toolbar-outline"
                  disabled={!isActiveSplitEditable}
                  onClick={() => setSplitDraftDestIds([])}
                >
                  選択をすべて解除
                </button>
                <span className="ml-auto text-sm text-gray-600">
                  選択中：{splitDraftDestIds.length}件
                </span>
                <button
                  type="button"
                  className="btn-action-base btn-action-blue"
                  onClick={() => setSplitStep(2)}
                >
                  次へ
                </button>
              </div>
            ) : (
              <div className="flex w-full items-center gap-2">
                {isActiveSplitEditable && (
                  <button
                    type="button"
                    className="btn-toolbar-outline"
                    onClick={() => splitPaneRef.current?.clear()}
                  >
                    入力をクリア
                  </button>
                )}
                <button
                  type="button"
                  className="btn-action-base btn-action-outline ml-auto"
                  onClick={() => {
                    // 入力中の値を保持してステップ1へ戻る
                    const current = splitPaneRef.current?.getAllocations();
                    if (current) setSplitDraftAllocations(current);
                    setSplitStep(1);
                  }}
                >
                  戻る
                </button>
                {/* 設定：分割の内容を親画面へ反映する（申請前・差戻しのみ）。
                    自部署負担分がマイナスでも押せる（→ 第33回 決定事項11） */}
                {isActiveSplitEditable && (
                  <button
                    type="button"
                    className="btn-action-base btn-action-blue"
                    onClick={handleApplySplit}
                  >
                    設定
                  </button>
                )}
              </div>
            )
          }
        >
          {splitStep === 1 ? (
            <SplitDestinationSelectPane
              candidates={SPLIT_DESTINATION_CANDIDATES}
              selectedIds={splitDraftDestIds}
              prevMonthIds={PREV_MONTH_SPLIT.destIds}
              readOnly={!isActiveSplitEditable}
              onSelectionChange={setSplitDraftDestIds}
            />
          ) : (
            <AdditionalEntrySplitPane
              ref={splitPaneRef}
              entries={activeRound?.entryRows ?? []}
              destinations={splitDraftDestinations}
              initialAllocations={splitDraftAllocations}
              self={SPLIT_SELF_INFO}
              readOnly={!isActiveSplitEditable}
            />
          )}
        </BottomPane>

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
                <ArrowLeft className="h-4 w-4" />
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
                title={NO_PAYMENT_TITLE.comment}
              >
                <Ban className="h-4 w-4" />
                {isNoPayment ? '支払無しを解除' : '支払無し'}
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              {/* コメント欄（支払詳細(その他)と同一の複数行テキストエリア） */}
              <FooterCommentField
                id="payment-c-comment"
                value={commentInput}
                onChange={setCommentInput}
                disabled={!footerActions.comment}
                onOpenHistory={() => {
                  const isOpen = isCommentHistoryPaneShown;
                  closeAllRightPanes();
                  if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
                  setIsCommentHistoryPaneShown(true);
                }}
              />
              <button
                className="btn-action-base btn-action-red"
                aria-label="差戻し"
                disabled={!footerActions.sendBack}
              >
                <Undo2 className="h-4 w-4" />
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

      {/* 右ペイン：明細追加（追加口）。項目・活性/非活性は追加口一覧の列にそろえる。 */}
      {/* フッタは追加口・拡売費で共通（「追加」のみ。追加後も開いたまま、×で閉じる）。 */}
      <RightPane
        open={addDetailTarget === 'entry'}
        onClose={() => setAddDetailTarget(null)}
        title="明細追加 - 追加口"
        description="追加口の明細を追加します"
        footer={addDetailFooter}
      >
        <AddEntryPane
          ref={addEntryPaneRef}
          onAdd={(values) => detailTableRef.current?.addManualRow(values)}
        />
      </RightPane>

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

      {/* 右ペイン：コメント履歴（支払詳細の各画面で共通） */}
      <CommentHistoryPane
        open={isCommentHistoryPaneShown}
        onClose={() => setIsCommentHistoryPaneShown(false)}
      />
    </div>
  );
}

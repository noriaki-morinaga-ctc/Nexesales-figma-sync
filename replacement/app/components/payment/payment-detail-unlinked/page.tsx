// 支払詳細(商流販売店紐づけなし)画面
// 商流販売店に紐づかない支払（②商流のみ／③販売店のみ／④末端組織）を扱う。
// 作成単位は 一次店 × 三次店 × 販売店 × 末端組織（権限整理 P4）。追加口を持たず拡売費のみ
// （権限整理 P9-11）。基本情報のパターン＋作成単位で拡売費計画（ヘッダ）が定まり、
// 下ペインで拡売費計画明細を紐づけると支払明細へ自動転記される（RFP 197・200〜202）。
// 計画を作成していないイレギュラーは明細追加＋計画欄手入力で対応する（RFP 203）。
import React, { useState, useRef } from 'react';
import {
  Ban,
  Save,
  Send,
  Check,
  Upload,
  Undo2,
  ArrowRight,
  CornerUpLeft,
  Stamp,
  Plus,
  Copy,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ColGroupDef } from 'ag-grid-community';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  GRID_COLORS,
  withHeaderTooltips,
  GRID_NO_FILTER_COLUMN_TYPES,
  GRID_EMPTY_TEXT,
  useGridColumnState,
} from '@/app/components/grid';
// 管理区分の「名称→区分値」導出（拡売費明細・支払情報サマリと共通）。
import { managementClassCode } from '@/app/utils/payment/payment-detail/paymentComboFieldOptions';
import { SearchPane, TARGET_MONTH } from './components/SearchPane';
import { DUMMY_STORE_LABEL } from './utils';
import { PaymentDetailPane } from './components/PaymentDetailPane';
import {
  AggregationPane,
  type SummarySourceRow,
} from './components/AggregationPane';
import { PaymentNonProductExpensePane } from '@/app/components/shared/payment/payment-detail/PaymentNonProductExpensePane';
import { createExpenseRows } from '@/mocks/payment/payment-detail-unlinked';
import {
  createEmptyExpenseRows,
  createQuotedExpenseRows,
} from '@/app/utils/payment/payment-detail/nonProductExpenseRows';
import type {
  ExpenseRow,
  PaymentNonProductExpensePaneHandle,
  ExpenseFormValues,
  ExpenseBasicInfo,
} from '@/app/types/paymentDetail';
// 支払回数の切替・追加（支払詳細の各画面で共通）。
import { usePaymentRounds } from '@/app/components/shared/payment/payment-detail/usePaymentRounds';
import { PaymentRoundConfirmDialog } from '@/app/components/shared/payment/payment-detail/PaymentRoundConfirmDialog';

// 支払回数の選択肢の初期値（＋支払回数追加で最大回数＋1を末尾へ足す）。
const INVOICE_COUNT_OPTIONS = ['1', '2', '3'];
import { CommentHistoryPane } from '@/app/components/shared/common/CommentHistoryPane';
import { BottomPane } from '@/app/components/ui/bottom-pane';
import { PaymentPlanSelectionPane } from '@/app/components/shared/payment/payment-detail/PaymentPlanSelectionPane';
import {
  QuoteSelectionPane,
  QUOTE_TARGET_MONTH_FROM,
  QUOTE_TARGET_MONTH_TO,
  QUOTE_PAYEE_ALL,
  QUOTE_PAYEE_OPTIONS,
  type QuoteSelectionPaneHandle,
  QUOTE_SELECTION_CONFIG,
} from './constants';
import { MonthYearPicker } from '@/app/components/ui/month-year-picker';
import {
  BUTTON_BASE,
  BUTTON_STYLES,
  FORM_LABEL_CLASS,
  TEXT_INPUT_CLASS,
  CARD_CLASS,
} from '@/styles/commonStyles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { SingleCombobox } from '@/app/components/ui/single-combobox';
import { ScreenTitle } from '@/app/components/ui/screen-title';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import { useAppNavigation } from '@/app/components/ui/use-app-navigation';
import { FooterCommentField } from '@/app/components/shared/common/FooterCommentField';
import { PAYMENT_DETAIL_STATUS } from './constants';
import {
  paymentFooterActionStateOf,
  NO_PAYMENT_TITLE,
} from '@/app/utils/payment/payment-detail/paymentFooterActions';

// 拡売費一覧の明細行（親行）の商流・組織列に表示する、画面の基本情報の値。
// 本画面は商流販売店に紐づかない支払のため、一次店・三次店・販売店はダミーコードを表示する。
const EXPENSE_BASIC_INFO: ExpenseBasicInfo = {
  primaryStore: DUMMY_STORE_LABEL,
  tertiaryStore: DUMMY_STORE_LABEL,
  store: DUMMY_STORE_LABEL,
  // 費用負担部署＝基本情報の「部署」、担当者＝基本情報の「営業担当者」。
  dept: '首都圏営業第二部:10002990',
  staff: '山田　太郎:5172733',
};

// 明細追加で足す空の明細（各項目は追加後にグリッド上で入力する）。
const EMPTY_EXPENSE_FORM: ExpenseFormValues = {
  billName: '',
  billNote: '',
  planExpContent: '',
  product: '',
  billAmount: '',
  payAmount: '',
  matchType: '',
  mgmtClass: '',
  mgmtCode: '',
  measureClass: '',
  measureCode: '',
  summary1: '',
  summary2: '',
  taxClass: '',
};

// 支払情報サマリ（管理項目別合計値）の集計元。
// 拡売費一覧（共通コンポーネント）の既定明細を、集計に必要な項目へ読み替えて渡す。
const EXPENSE_SUMMARY_ROWS: SummarySourceRow[] = createExpenseRows().map(
  (row) => ({
    isGroup: row.isGroup,
    isTotal: row.isTotal,
    costSplit: row.costSplit,
    payAmount: row.payAmount,
    mgmtClassName: row.mgmtClass,
    splitDept: row.splitDept,
  })
);

// 「他部門から分割（振替）された経費明細」の1行分の型（参照専用・拡売費構成に準拠）
// 列構成は支払詳細(追加口請求書有)の支払情報サマリの拡売費一覧に合わせる。
interface SplitFromOtherRow {
  no: number; // No.
  planExpContent: string; // メタブランド（メタブランド名）
  product: string; // サマリ商品名
  payAmount: number; // 分割金額／振替金額
  // 管理区分は名称のみを保持し、区分値は名称から導出して表示する（拡売費明細と同じ持ち方）。
  mgmtClassName: string; // 管理区分名称
  mgmtCode: string; // 管理コード（コード）
  mgmtCodeName: string; // 管理コード名称
  measureClass: string; // 施策区分（区分値）
  measureClassName: string; // 施策区分名称
  measureCode: string; // 施策コード（コード）
  measureCodeName: string; // 施策コード名称
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  // 分割元／振替元グループ（分割元の支払明細を特定する項目）
  srcPaymentNo: string; // 分割元の支払No
  srcPaymentCount: number; // 分割元の支払回数
  srcDetailNo: number; // 分割元の明細No
  srcDept: string; // 分割元の部署
  srcStaff: string; // 分割元の営業担当者
}

// 他部門で分割され当部門に計上された拡売費のモック（参照専用）。
const SPLIT_FROM_OTHER_ROWS: SplitFromOtherRow[] = [
  {
    no: 1,
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット６ＰＮ',
    payAmount: 20000,
    mgmtClassName: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    mgmtCodeName: '店頭定番販促',
    measureClass: '10',
    measureClassName: '新規導入',
    measureCode: 'SN001',
    measureCodeName: '新商品導入キャンペーン',
    summary1: '東日本支社より分割',
    summary2: 'アプリ20%相当の販促値引（社外）',
    srcPaymentNo: 'C2400NTO1',
    srcPaymentCount: 1,
    srcDetailNo: 1,
    srcDept: '首都圏営業第二部:10002990',
    srcStaff: 'アサヒ　太郎:5172733',
  },
  {
    no: 2,
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダーＰＥＴ５００',
    payAmount: 10000,
    mgmtClassName: '拡売費(固定費)A口',
    mgmtCode: 'FA001',
    mgmtCodeName: '什器設置費',
    measureClass: '20',
    measureClassName: '販売促進',
    measureCode: 'SP001',
    measureCodeName: '店頭販促キャンペーン',
    summary1: '中部支社より分割',
    summary2: '',
    srcPaymentNo: 'C2400NTO2',
    srcPaymentCount: 1,
    srcDetailNo: 2,
    srcDept: '中部第1営業部:10003002',
    srcStaff: 'アサヒ　次郎:5172735',
  },
];

// 整数の3桁区切り整形（金額列・サマリー用）。
const formatInt = (v: number): string =>
  Number.isFinite(v) ? Math.round(v).toLocaleString('ja-JP') : '';

// 参照専用セルの共通スタイル（灰背景）と右寄せ版。
const SPLIT_RO_STYLE = { backgroundColor: GRID_COLORS.readonly } as const;
const SPLIT_RO_RIGHT_STYLE = {
  backgroundColor: GRID_COLORS.readonly,
  textAlign: 'right' as const,
};

// 合計サマリーバーの表示項目（支払金額の総合計）。拡売費一覧と同形式。
const SPLIT_SUMMARY_ITEMS = [
  {
    label: '支払金額',
    value: formatInt(
      SPLIT_FROM_OTHER_ROWS.reduce((s, r) => s + r.payAmount, 0)
    ),
  },
];

// 「他部門から分割（振替）された経費明細」のグリッド列定義（参照専用・全列グレー背景）。
// 列構成は支払詳細(追加口請求書有)の支払情報サマリの拡売費一覧に準拠し、
// 先頭は No.／メタブランド／サマリ商品名 の順に並べる。
// ただし本画面は販売計画に紐づかない支払のため、計画金額列・計画選択の操作列は持たない。
// label：分割（IN）／振替（IN）で列名の「分割」「振替」を切り替える。
const buildSplitFromOtherColDefs = (
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
      // 管理区分（区分値）。行は名称（mgmtClassName）を保持し、区分値は名称から導出表示する。
      headerName: '管理区分',
      colId: 'mgmtClassCode',
      field: 'mgmtClassName',
      width: 104,
      valueFormatter: (p) =>
        managementClassCode(p.value as string) || GRID_EMPTY_TEXT,
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
      // 分割元（振替元）グループ：当明細の分割元となった支払明細を特定する項目。
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

// 分割（IN）／振替（IN）それぞれの列定義。
const SPLIT_FROM_OTHER_COL_DEFS = buildSplitFromOtherColDefs('分割');
const TRANSFER_FROM_OTHER_COL_DEFS = buildSplitFromOtherColDefs('振替');

// 当一覧の既定列定義（参照専用：ソート・フィルター・列移動を無効化）。
const SPLIT_FROM_OTHER_DEFAULT_COL_DEF: ColDef = {
  ...GRID_DEFAULT_COL_DEF,
  editable: false,
  sortable: false,
  filter: false,
  suppressMovable: true,
};

// 振替（IN）の一覧データ。分割（IN）と同じ内容だが、グリッドを別々に管理するため
// 行データも複製して保持する（一方の変更が他方へ波及しないようにする）。
const TRANSFER_FROM_OTHER_ROWS: SplitFromOtherRow[] = SPLIT_FROM_OTHER_ROWS.map(
  (r) => ({ ...r })
);

// 支払確認ダイアログで扱うアクション種別（PaymentDetailOther と同一方式。検印を追加）
type ConfirmAction =
  | 'apply'
  | 'withdraw'
  | 'approve'
  | 'seal'
  | 'reject'
  | null;

// 支払確認ダイアログのメッセージ（不変のためモジュール定数として保持・レンダー毎の再生成を避ける）
const CONFIRM_MESSAGE_MAP: Record<
  Exclude<ConfirmAction, null>,
  {
    title: string;
    description: string;
    toast: string;
    button: string;
    buttonClass: string;
  }
> = {
  apply: {
    title: '申請の確認',
    description: '拡売費支払データを申請します。よろしいですか？',
    toast: '申請が完了しました。',
    button: '申請',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  withdraw: {
    title: '引戻しの確認',
    description: '拡売費支払データを引戻しします。よろしいですか？',
    toast: '引戻しが完了しました。',
    button: '引戻し',
    buttonClass:
      'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50',
  },
  approve: {
    title: '承認の確認',
    description: '拡売費支払データを承認します。よろしいですか？',
    toast: '承認が完了しました。',
    button: '承認',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  seal: {
    title: '検印の確認',
    description: '拡売費支払データを検印します。よろしいですか？',
    toast: '検印が完了しました。',
    button: '検印',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  reject: {
    title: '差戻しの確認',
    description: '拡売費支払データを差戻しします。よろしいですか？',
    toast: '差戻しが完了しました。',
    button: '差戻し',
    buttonClass: 'bg-red-500 hover:bg-red-600',
  },
};
// ── モックデータ ────────────────────────────────────────────

export default function PaymentDetailUnlinked() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // フッターの操作確認ダイアログ（PaymentDetailOther と同一方式）
  // フッターのコメント欄の入力値
  const [commentInput, setCommentInput] = useState('');
  const [isBackDialogOpen, setIsBackDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isImportDialogShown, setIsImportDialogShown] = useState(false);
  const [isCommentHistoryPaneShown, setIsCommentHistoryPaneShown] =
    useState(false);
  // 支払情報サマリ右端のトグル（詳細／分割／振替）。既定は詳細（管理項目別合計値）。
  //   詳細＝拡売費の管理区分別の集計表（→ 20260804_第26回_共通 決定事項19）。
  //   分割・振替＝他部門から分割（振替）された経費明細。
  const [summaryTab, setSummaryTab] = useState<'詳細' | '分割' | '振替'>(
    '詳細'
  );

  // 支払回数（PaymentDetailWithInvoice と同様、支払情報カードの上に配置）。
  // 切替・追加の挙動は支払詳細の各画面で共通のフックが持つ
  // （最大回数＋1・切替時の確認・入力中の内容の破棄。→ 20260804_第26回 決定事項23・24）。
  // 破棄は支払情報・拡売費へ key={invoiceCount} を付けた再マウントで行う。
  const rounds = usePaymentRounds({ initialOptions: INVOICE_COUNT_OPTIONS });
  const invoiceCount = rounds.round;

  // 表示中の支払回数が追加で作成したものか（真っさらな入力画面にする）
  const isNewInvoiceRound = rounds.isNewRound;

  // 分割（IN）／振替（IN）選択時に支払情報サマリカード内へ表示する
  // 列幅・並び・ソートの状態を保存／復元する（→ 02 §7 列状態の永続化）。分割・振替は別グリッドのため保存先も分ける
  const splitFromOtherColumnStateProps = useGridColumnState(
    '支払詳細C紐づけなし.他部門から分割.columnState'
  );
  const transferFromOtherColumnStateProps = useGridColumnState(
    '支払詳細C紐づけなし.他部門から振替.columnState'
  );

  // 「他部門から分割（振替）された経費明細」一覧（参照専用グリッド）。
  // 本画面は追加口を持たないため拡売費の一覧のみを表示する。
  // 分割・振替は同じ内容だが行データ・行IDを分けて別グリッドとして管理する。
  const splitFromOtherContent = (
    gridHeight: number,
    tab: '分割' | '振替' = '分割'
  ) => {
    const isTransfer = tab === '振替';
    const rows = isTransfer ? TRANSFER_FROM_OTHER_ROWS : SPLIT_FROM_OTHER_ROWS;
    const colDefs = isTransfer
      ? TRANSFER_FROM_OTHER_COL_DEFS
      : SPLIT_FROM_OTHER_COL_DEFS;
    const rowIdPrefix = isTransfer ? 'trn-exp' : 'spl-exp';
    return (
      <div className={`${CARD_CLASS} overflow-hidden`}>
        <div className="px-3 pt-3">
          <h3 className="text-base font-bold text-gray-900">拡売費</h3>
        </div>
        {/* 合計サマリーバー（拡売費一覧と同形式・支払金額の総合計） */}
        <div className="px-3 pt-2 pb-2">
          <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {/* 合計ラベル（全高・左揃え） */}
            <div className="flex shrink-0 items-center border-r border-gray-200 px-4 text-left text-sm font-bold whitespace-nowrap text-gray-900">
              合計
            </div>
            {/* 総合計（支払金額） */}
            {SPLIT_SUMMARY_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex min-w-42 flex-col items-end justify-center border-r border-gray-200 px-3 py-1 last:border-r-0"
              >
                <span className="text-xs whitespace-nowrap text-gray-500">
                  {item.label}
                </span>
                <span className="text-sm font-bold whitespace-nowrap text-blue-700">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="expense-item-grid w-full px-3 pt-0 pb-3"
          style={{ height: gridHeight }}
        >
          <AgGridReact
            {...(isTransfer
              ? transferFromOtherColumnStateProps
              : splitFromOtherColumnStateProps)}
            rowData={rows}
            columnDefs={colDefs}
            defaultColDef={SPLIT_FROM_OTHER_DEFAULT_COL_DEF}
            // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
            columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
            getRowId={(params) => `${rowIdPrefix}-${params.data.no}`}
            statusBar={GRID_STATUS_BAR}
            {...GRID_BASE_PROPS}
          />
        </div>
      </div>
    );
  };

  // 保存（確認ダイアログなし・トースト通知のみ）
  const handleSave = () => {
    // TODO: 拡売費支払データの保存処理（API連携・未実装）
    toast.success('保存が完了しました。');
  };

  // 戻る確定 → 支払申請一覧参照画面へ遷移
  const handleBackConfirm = () => {
    setIsBackDialogOpen(false);
    navigate('payment-list');
  };

  // 支払確認ダイアログの確定（申請／引戻し／承認／検印／差戻し共通）
  const handleConfirmAction = () => {
    if (!confirmAction) return;
    const { toast: toastMessage } = CONFIRM_MESSAGE_MAP[confirmAction];
    // TODO: 拡売費支払データの申請/承認/検印/差戻し処理（API連携・未実装）
    toast.success(toastMessage);
    setConfirmAction(null);
  };

  // 拡売費系右ペインの状態管理（削除はグリッド側の確認ダイアログで処理）

  // すべての右ペインを閉じるヘルパー関数
  // 販売計画選択（下ペイン）。本画面は商流販売店に紐づかない支払を扱うが、
  // 計画パターン②〜④も選択の対象に含める（→ 20260821_第31回 決定事項6）。
  // 支払無し（当月は支払が発生しない伝票）。支払一覧と同じく未申請との間を
  // 行き来する。理由は画面下部のコメント欄へ書く（本画面は支払情報に備考が無いため）。
  const [isNoPayment, setIsNoPayment] = useState(false);
  // フッターのボタンの活性（支払詳細(追加口請求書有・無)と同じくステータスで決める。UI/UX UX-072）。
  // 支払無しを押した回は、ステータスを「支払無し」として扱う。
  const footerActions = paymentFooterActionStateOf(
    isNoPayment ? '支払無し' : PAYMENT_DETAIL_STATUS
  );
  const [isPlanSelectionPaneShown, setIsPlanSelectionPaneShown] =
    useState(false);
  // 拡売費一覧（明細の追加・計画項目の設定）操作用。
  const expenseTableRef = useRef<PaymentNonProductExpensePaneHandle>(null);

  // 引用明細選択（下ペイン）。「支払情報引用」ボタンから開き、選んだ伝票の明細を
  // 新しい支払回へ引用する（支払詳細(追加口請求書有)と同じ流れ）。
  const [isQuoteSelectionPaneShown, setIsQuoteSelectionPaneShown] =
    useState(false);
  // 引用明細選択ペイン操作用（ペインタイトル右の「引用」から呼ぶ）。
  const quotePaneRef = useRef<QuoteSelectionPaneHandle>(null);
  // 引用明細選択の検索条件（対象年月 From-To・支払先）。
  const [quoteMonthFrom, setQuoteMonthFrom] = useState(QUOTE_TARGET_MONTH_FROM);
  const [quoteMonthTo, setQuoteMonthTo] = useState(QUOTE_TARGET_MONTH_TO);
  const [quotePayee, setQuotePayee] = useState(QUOTE_PAYEE_ALL);
  // 引用で追加した支払回の拡売費明細（支払回数ごとに保持する）。
  const [quotedExpenseRows, setQuotedExpenseRows] = useState<
    Record<string, ExpenseRow[]>
  >({});

  // 「支払情報引用」押下：引用明細選択ペイン（下ペイン）のみを開く。
  // 支払回数の追加は同ペインの「引用」で行う。
  const handleQuote = () => {
    const isOpen = isQuoteSelectionPaneShown;
    closeAllRightPanes();
    setIsPlanSelectionPaneShown(false);
    if (isOpen) {
      setIsQuoteSelectionPaneShown(false);
      return; // 開くボタン再押下で閉じる（トグル）
    }
    setIsQuoteSelectionPaneShown(true);
  };

  // 「引用」：支払回数を1つ増やし（確認は挟まない）、
  // 引用した明細を持つ回を表示する。
  const handleQuoteApply = (rows: ExpenseRow[]) => {
    const nextCount = rounds.addRoundNow();
    setQuotedExpenseRows((prev) => ({ ...prev, [nextCount]: rows }));
    setIsQuoteSelectionPaneShown(false);
    toast.success(`支払回数「${nextCount}」へ支払明細を引用しました。`);
  };

  // 販売計画選択ペイン（支払明細に紐づける計画明細 選択エリア）を開く。
  // 「選択」で計画明細の項目を設定する対象は拡売費一覧のチェックボックス列で選ぶため、
  // 当ペインへ明細は渡さない。
  const handleOpenPlanSelection = () => {
    const isOpen = isPlanSelectionPaneShown;
    closeAllRightPanes();
    if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
    setIsPlanSelectionPaneShown(true);
  };

  // 明細追加：本画面は入力ペインを設けず、空の明細を一覧の最終行へ1行足す
  //（追加した行はグリッド上で直接入力する）。
  const handleAddExpense = () => {
    expenseTableRef.current?.addManualRow(EMPTY_EXPENSE_FORM);
  };

  const closeAllRightPanes = () => {
    setIsCommentHistoryPaneShown(false);
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
              <ScreenTitle title="支払詳細(商流販売店紐づけなし)" />

              {/* 販売計画条件エリア */}
              <section aria-labelledby="search-heading">
                <h2 id="search-heading" className="sr-only">
                  検索条件
                </h2>
                <SearchPane onImport={() => setIsImportDialogShown(true)} />
              </section>

              {/* 支払情報サマリ（支払詳細(追加口請求書有)の支払情報サマリと同構成）。
                  基本情報と支払回数の間に配置する。 */}
              <section className="mt-2" aria-labelledby="summary-heading">
                <h2 id="summary-heading" className="sr-only">
                  支払情報サマリ
                </h2>
                <AggregationPane
                  summaryTab={summaryTab}
                  onSummaryTabChange={setSummaryTab}
                  expenseRows={EXPENSE_SUMMARY_ROWS}
                  chargeFromRows={SPLIT_FROM_OTHER_ROWS}
                  splitContent={splitFromOtherContent}
                />
              </section>

              {/* 支払回数・支払情報・拡売費（タブは持たず直接表示する） */}
              <div className="w-full space-y-0">
                {/* 支払回数（PaymentDetailWithInvoice と同様、支払情報カードの上に配置） */}
                <div className="mb-2 flex items-center gap-2">
                  <label
                    htmlFor="invoice-count"
                    className="w-36 text-right text-sm font-bold whitespace-nowrap text-blue-900"
                  >
                    支払回数
                  </label>
                  <SingleCombobox
                    id="invoice-count"
                    className="w-20"
                    options={[
                      ...rounds.options.map((n) => ({ value: n, label: n })),
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
                    aria-label="支払回数追加"
                    onClick={rounds.requestAddRound}
                  >
                    <Plus className="h-4 w-4" />
                    支払回数追加
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
                    <Copy className="h-4 w-4" />
                    支払情報引用
                  </button>
                </div>

                {/* 支払情報エリア（PaymentDetailUnlinkedから直接表示） */}
                <section aria-labelledby="payment-detail-heading">
                  <h2 id="payment-detail-heading" className="sr-only">
                    支払情報
                  </h2>
                  {/* key に支払回数を与え、切替時に再マウントして入力内容を破棄する
                      （画面をリフレッシュして当該回の入力画面を表示する。→ 決定事項23）。 */}
                  <PaymentDetailPane
                    key={invoiceCount}
                    isNewRound={isNewInvoiceRound}
                    onStatusClick={() => {
                      const isOpen = isCommentHistoryPaneShown;
                      closeAllRightPanes();
                      if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
                      setIsCommentHistoryPaneShown(true);
                    }}
                  />
                </section>

                {/* 拡売費一覧（独立カード） */}
                <section className="mb-4" aria-labelledby="expense-heading">
                  <h2 id="expense-heading" className="sr-only">
                    拡売費
                  </h2>
                  {/* 支払情報と同じく支払回数を key にして再マウントする */}
                  <PaymentNonProductExpensePane
                    key={invoiceCount}
                    ref={expenseTableRef}
                    // 請求書を受領しない画面のため、未承認NET／その他の区分を持たない
                    // 単一の一覧とする。
                    variant="no-store-link"
                    // ＋支払回数追加で作成した回は明細を持たない状態から始める
                    //（→ 20260804_第26回 決定事項23）。
                    initialRows={
                      quotedExpenseRows[invoiceCount] ??
                      (isNewInvoiceRound
                        ? createEmptyExpenseRows()
                        : createExpenseRows())
                    }
                    onOpenPlanSelection={handleOpenPlanSelection}
                    basicInfo={EXPENSE_BASIC_INFO}
                    onOpenAddExpense={handleAddExpense}
                    // コピー・明細追加した行を左端の帯で示し、凡例を出す
                    //（一番下に追加されても分かるようにする。他の支払詳細画面と同じ）。
                    showCopySourceBand
                  />
                </section>
              </div>
            </div>
          </div>
        </div>

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
                onClick={() => setIsBackDialogOpen(true)}
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
                title={NO_PAYMENT_TITLE.comment}
              >
                <Ban className="h-4 w-4" />
                {isNoPayment ? '支払無しを解除' : '支払無し'}
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              <FooterCommentField
                id="payment-unlinked-comment"
                value={commentInput}
                onChange={setCommentInput}
                disabled={!footerActions.comment}
              />
              <button
                className="btn-action-base btn-action-red"
                aria-label="差戻し"
                onClick={() => setConfirmAction('reject')}
                disabled={!footerActions.sendBack}
              >
                <CornerUpLeft className="h-4 w-4" />
                差戻し
              </button>
              <button
                className="btn-action-base btn-action-green"
                aria-label="承認"
                onClick={() => setConfirmAction('approve')}
                disabled={!footerActions.approve}
              >
                <Check className="h-4 w-4" />
                承認
              </button>
              <button
                className="btn-action-base btn-action-green"
                aria-label="検印"
                onClick={() => setConfirmAction('seal')}
                disabled={!footerActions.seal}
              >
                <Stamp className="h-4 w-4" />
                検印
              </button>
              <button
                className="btn-action-base btn-action-outline-blue"
                aria-label="引戻し"
                onClick={() => setConfirmAction('withdraw')}
                disabled={!footerActions.retrieve}
              >
                <CornerUpLeft className="h-4 w-4" />
                引戻し
              </button>
              <button
                className="btn-action-base btn-action-green"
                aria-label="申請"
                onClick={() => setConfirmAction('apply')}
                disabled={!footerActions.apply}
              >
                <Send className="h-4 w-4" />
                申請
              </button>
              <button
                className="btn-action-base btn-action-blue"
                aria-label="保存"
                onClick={handleSave}
                disabled={!footerActions.save}
              >
                <Save className="h-4 w-4" />
                保存
              </button>
            </div>
          </div>
        </div>

        {/* 戻る確認ダイアログ（PaymentDetailOther と同一） */}
        <ConfirmDialog
          open={isBackDialogOpen}
          onOpenChange={setIsBackDialogOpen}
          title="画面遷移の確認"
          description="支払申請一覧参照画面へ戻ります。編集中の内容は保存されません。よろしいですか？"
          confirmLabel="移動"
          onConfirm={handleBackConfirm}
        />

        {/* 支払回数の切替・追加の確認ダイアログ（支払詳細の各画面で共通）。
            保存は支払回数1回ごとのため、切替時は入力中の内容が破棄される
            （→ 20260804_第26回 決定事項23・24）。 */}
        <PaymentRoundConfirmDialog
          pending={rounds.pending}
          onConfirm={rounds.confirmPending}
          onCancel={rounds.cancelPending}
        />

        {/* 支払確認ダイアログ（申請／引戻し／承認／検印／差戻し共通・PaymentDetailOther と同一） */}
        <ConfirmDialog
          open={confirmAction !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null);
          }}
          title={confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].title : ''}
          description={
            confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].description : ''
          }
          confirmLabel={
            confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].button : ''
          }
          confirmClassName={`${
            confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].buttonClass : ''
          } text-white rounded-lg`}
          onConfirm={handleConfirmAction}
        />

        {/* 計画書インポートダイアログ */}
        <Dialog
          open={isImportDialogShown}
          onOpenChange={setIsImportDialogShown}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>計画書インポート</DialogTitle>
              <DialogDescription>
                販売計画表Excelファイルをアップロードします。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right col-span-4">
                  アップロードファイル
                </Label>
                <Input
                  type="file"
                  className={`${TEXT_INPUT_CLASS} col-span-4`}
                  accept=".xlsx"
                />
              </div>
              <div className="text-sm text-gray-500 col-span-4">
                ファイル形式: 販売計画表_yyyyMMddHHmmss.xlsx
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsImportDialogShown(false)}>
                <Upload className="h-4 w-4" />
                計画書インポート
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 右ペイン：コメント履歴（支払詳細の各画面で共通） */}
      <CommentHistoryPane
        open={isCommentHistoryPaneShown}
        onClose={() => setIsCommentHistoryPaneShown(false)}
      />

      {/* 下ペイン：拡売費計画引用。拡売費一覧の「拡売費計画引用」ボタンから開き、
          「選択」で管理区分・管理コード等を一覧でチェックした明細へ設定する。
          プッシュ式：親画面に被さらず中身を押し上げるため、選択エリアと支払明細を
          同時に視認できる。拡売費明細と拡売費計画引用の表示領域が半分ずつになるよう
          自動調整する（→ 20260821_第31回 決定事項1・6）。
          一覧には、基本情報の対象年月・一次店・三次店・販売店・末端組織(第6階層)を
          キーに取得した拡売費計画を表示する（モックでは絞り込まない）。
          担当エリアの選択は置かない（支払詳細(追加口請求書有／無)のみ）。 */}
      <BottomPane
        open={isPlanSelectionPaneShown}
        onClose={() => setIsPlanSelectionPaneShown(false)}
        title="拡売費計画引用"
        description="支払明細に紐づける計画明細を選択します"
        initialHeightRatio={0.5}
        minHeight={18}
        headerContent={
          <div className="flex flex-wrap items-center gap-4">
            {/* 対象年月（テキストラベル・変更不可）。基本情報と同じ年月を表示する。 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold whitespace-nowrap text-blue-900">
                対象年月
              </span>
              <span className="flex h-8 items-center text-sm whitespace-nowrap text-gray-900">
                {TARGET_MONTH}
              </span>
            </div>
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
                // 引用した時点では販売計画と紐づいていないため計画金額は0円とする
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
    </div>
  );
}

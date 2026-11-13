// 支払詳細(引用)画面
// PaymentDetailWithInvoice（支払詳細(マージン率固定・NET入力)）をベースに、追加口エリア（追加口一覧テーブル
// と、そこから開く明細追加・編集・削除・コピー／年契基本分／センターフィ／取組強化マージンの
// 各右ペイン）を除外した、拡売費のみを扱う画面。
import { useState } from 'react';
import {
  Save,
  Send,
  Check,
  Upload,
  ReceiptJapaneseYen,
  Import,
  CornerUpLeft,
  Stamp,
  Undo2,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/app/components/ui/tabs';
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
import { QuoteBasicInfoPane } from '@/app/components/shared/payment/quote/QuoteBasicInfoPane';
import { QuotePaymentDetailPane } from '@/app/components/shared/payment/quote/QuotePaymentDetailPane';
import {
  QuoteNonProductExpensePane,
  type NonProductExpenseData,
} from '@/app/components/shared/payment/quote/QuoteNonProductExpensePane';
import { QuotePlanSelectionPane } from '@/app/components/shared/payment/quote/QuotePlanSelectionPane';
import { RightPane } from '@/app/components/ui/right-pane';
import { BottomPane } from '@/app/components/ui/bottom-pane';
import { NumericInput } from '@/app/components/ui/numeric-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { TEXT_INPUT_CLASS, CARD_CLASS } from '@/styles/commonStyles';
import { Label } from '@/app/components/ui/label';

import { SingleCombobox } from '@/app/components/ui/single-combobox';
import { MATCH_PAYMENT_TYPE_OPTIONS } from '@/app/constants/matchPaymentType';
import { DateMonthYearPicker } from '@/app/components/ui/date-month-year-picker';

import type { ExpenseRow } from '@/app/components/shared/payment/quote/QuoteNonProductExpensePane';
import { ScreenTitle } from '@/app/components/ui/screen-title';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import {
  campaignClassComboOptions,
  campaignCodeComboOptions,
} from '@/app/constants/comboFieldOptions';
import { useAppNavigation } from '@/app/components/ui/use-app-navigation';
import {
  DEFAULT_QUOTE_BASIC_INFO,
  QUOTE_STORE_OPTIONS,
} from '@/mocks/common/quoteBasicInfo';
import { FooterCommentField } from '@/app/components/shared/common/FooterCommentField';

// 照合支払区分の選択肢（右ペイン用）。
const MATCH_TYPE_PANE_OPTIONS = MATCH_PAYMENT_TYPE_OPTIONS.map((v) => ({
  value: v,
  label: v,
}));

// 支払No.（タブ見出し用。支払詳細(自販機)のタブ1タイトルと同形式）。
// 値は基本情報（SearchPane）の「支払明細書No」と揃える。
const PAYMENT_NO = 'C2400NTO4';

// 「他部門から分割された経費明細」タブの1行分の型（参照専用・拡売費構成に準拠）
interface SplitFromOtherRow {
  no: number; // No.
  billName: string; // 卸からの請求名称
  planExpContent: string; // 販売計画に記載の拡売費内容
  product: string; // 商品
  payAmount: number; // 支払金額（税抜）
  planAmount: number; // 計画金額
  taxRate: number; // 税率（0.1 / 0.08 等）
  taxClass: string; // 税区分
  mgmtClass: string; // 管理区分（用途）
  mgmtCode: string; // 管理コード（投資責任）
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
}

// 他部門で分割され当部門に計上された拡売費のモック（参照専用）。
const SPLIT_FROM_OTHER_ROWS: SplitFromOtherRow[] = [
  {
    no: 1,
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    planExpContent: 'ワンダ モーニングショット アプリ20%キャンペーン',
    product: 'ワンダモーニングショット６ＰＮ',
    payAmount: 20000,
    planAmount: 20000,
    taxRate: 0.08,
    taxClass: '2:課税8%',
    mgmtClass: '1B6 チャネル対策条件（売上連動）',
    mgmtCode: '99999 量販経費追加スーパー',
    summary1: '東日本支社より分割',
    summary2: 'アプリ20%相当の販促値引（社外）',
  },
  {
    no: 2,
    billName: 'アサヒ飲料 三ツ矢サイダー ＰＥＴ５００',
    planExpContent: '三ツ矢サイダー 夏季拡売',
    product: '三ツ矢サイダーＰＥＴ５００',
    payAmount: 10000,
    planAmount: 12000,
    taxRate: 0.1,
    taxClass: '1:課税10%',
    mgmtClass: '681 その他',
    mgmtCode: '99999 量販経費追加スーパー',
    summary1: '中部支社より分割',
    summary2: '',
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

// タブ2サマリーバーの表示項目（支払金額・計画金額の総合計）。支払No.タブの拡売費一覧と同形式。
const SPLIT_SUMMARY_ITEMS = [
  {
    label: '支払金額',
    value: formatInt(
      SPLIT_FROM_OTHER_ROWS.reduce((s, r) => s + r.payAmount, 0)
    ),
  },
  {
    label: '計画金額',
    value: formatInt(
      SPLIT_FROM_OTHER_ROWS.reduce((s, r) => s + r.planAmount, 0)
    ),
  },
];

// 「他部門から分割された経費明細」タブのグリッド列定義（参照専用・全列グレー背景）。
// 列構成は拡売費（NonProductExpensePane）に準拠し、操作列・分割ボタン列は持たない。
const SPLIT_FROM_OTHER_COL_DEFS: ColDef<SplitFromOtherRow>[] =
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
      headerName: '卸からの請求名称',
      field: 'billName',
      width: 192,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '販売計画に記載の拡売費内容',
      field: 'planExpContent',
      width: 192,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '商品',
      field: 'product',
      width: 176,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '支払金額',
      field: 'payAmount',
      width: 96,
      valueFormatter: (p) => formatInt(p.value as number) || GRID_EMPTY_TEXT,
      cellStyle: SPLIT_RO_RIGHT_STYLE,
    },
    {
      headerName: '計画金額',
      field: 'planAmount',
      width: 96,
      valueFormatter: (p) => formatInt(p.value as number) || GRID_EMPTY_TEXT,
      cellStyle: SPLIT_RO_RIGHT_STYLE,
    },
    {
      headerName: '税区分',
      field: 'taxClass',
      width: 72,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '管理区分（用途）',
      field: 'mgmtClass',
      width: 160,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '管理コード（投資責任）',
      field: 'mgmtCode',
      width: 160,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '摘要1',
      field: 'summary1',
      width: 160,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '摘要2',
      field: 'summary2',
      width: 160,
      cellStyle: SPLIT_RO_STYLE,
    },
  ]);

// タブ2グリッドの既定列定義（参照専用：ソート・フィルター・列移動を無効化）。
const SPLIT_FROM_OTHER_DEFAULT_COL_DEF: ColDef = {
  ...GRID_DEFAULT_COL_DEF,
  editable: false,
  sortable: false,
  filter: false,
  suppressMovable: true,
};

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

// コメント履歴のモックデータ
const COMMENT_HISTORY_DATA = [
  {
    actionType: '承認',
    datetime: '2025/02/21 12:47:05',
    userName: '◇山　〇郎',
    comment: '',
  },
  {
    actionType: '販売計画申請承認',
    datetime: '2025/02/21 9:30:45',
    userName: '河〇　雅◇',
    comment: '函数計画を前年販売実績120%となるように修正。',
  },
  {
    actionType: '保存',
    datetime: '2025/02/21 9:20:45',
    userName: '河〇　雅◇',
    comment: '函数計画を前年販売実績120%となるように修正。',
  },
  {
    actionType: '計画差戻し',
    datetime: '2025/02/20 18:47:05',
    userName: '◇山　〇郎',
    comment: '函数計画を前年販売実績120%となるよう更新すること。',
  },
  {
    actionType: '販売計画申請承認',
    datetime: '2025/02/20 16:14:25',
    userName: '河〇　雅◇',
    comment: '販促NETは競合対策提示条件。',
  },
  {
    actionType: '保存',
    datetime: '2025/02/20 15:54:45',
    userName: '河〇　雅◇',
    comment: '販促NETは競合対策提示条件。',
  },
];

// 税区分の選択肢（拡売費グリッドと同じ）
const EXPENSE_TAX_CLASS_OPTIONS = [
  '1:課税10%',
  '2:課税8%',
  '3:その他(5%)',
  '4:その他(非課税)',
].map((v) => ({ value: v }));

// 整数のみ許可（小数部は切り捨て、数字以外は除去）。支払金額の入力に使用。
const toIntegerString = (v: string) => v.split('.')[0].replace(/[^0-9]/g, '');

// 拡売費編集ペインのフォーム値（拡売費グリッドの編集可能項目に対応）
type ExpenseEditFormValues = {
  billName: string; // 卸からの請求名称
  payAmount: string; // 支払金額
  taxClass: string; // 税区分
  measureClass: string; // 施策区分
  measureCode: string; // 施策コード
  approvalNo: string; // 稟議決裁番号
  approvalDate: string; // 稟議決裁日
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  accountAmount: string; // 勘定科目別金額
  matchType: string; // 照合支払区分
};

const EMPTY_EXPENSE_EDIT_FORM: ExpenseEditFormValues = {
  billName: '',
  payAmount: '',
  taxClass: '',
  measureClass: '',
  measureCode: '',
  approvalNo: '',
  approvalDate: '',
  summary1: '',
  summary2: '',
  accountAmount: '',
  matchType: '',
};

// 税区分の選択肢（値をそのまま表示名にする。SingleCombobox は表示名が必須）
const TAX_CLASS_COMBO_OPTIONS = EXPENSE_TAX_CLASS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.value,
}));

export default function PaymentDetailQuote() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // 追加口一覧から連動する「未承認NET拡売費」データ（拡売費一覧へ渡す）
  const [netUnapproved] = useState<{
    total: number;
    byProduct: Record<string, number>;
  }>({ total: 0, byProduct: {} });
  // フッターの操作確認ダイアログ（PaymentDetailOther と同一方式）
  // フッターのコメント欄の入力値
  const [commentInput, setCommentInput] = useState('');
  const [isBackDialogOpen, setIsBackDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isImportDialogShown, setIsImportDialogShown] = useState(false);
  const [isCommentHistoryPaneShown, setIsCommentHistoryPaneShown] =
    useState(false);
  // 支払明細に紐づける計画明細 選択エリア（下ペイン）
  const [isPlanSelectionPaneShown, setIsPlanSelectionPaneShown] =
    useState(false);
  // 支払明細情報の上のタブ（支払No. / 他部門から分割された経費明細）。支払詳細(自販機)・PaymentDetailWithInvoice と同形式。
  const [activeDetailTab, setActiveDetailTab] = useState('payment-detail');

  // 支払回数（PaymentDetailWithInvoice と同様、支払明細情報カードの上に配置）
  const [invoiceCount, setInvoiceCount] = useState('1');

  // 支払回数追加ボタン：支払回数を +1 する
  const handleAddInvoiceCount = () => {
    setInvoiceCount((prev) => String(Number(prev) + 1));
  };

  // 支払回数の選択肢（最低1〜3、インクリメントで増えた値も選択肢に含める）
  const invoiceCountOptions = Array.from(
    { length: Math.max(Number(invoiceCount), 3) },
    (_, i) => String(i + 1)
  );

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

  // 拡売費編集・コピーフォーム（いずれも拡売費グリッドの編集可能項目を扱う）
  const [editExpenseForm, setEditExpenseForm] = useState<ExpenseEditFormValues>(
    EMPTY_EXPENSE_EDIT_FORM
  );
  const [copyEditForm, setCopyEditForm] = useState<ExpenseEditFormValues>(
    EMPTY_EXPENSE_EDIT_FORM
  );

  // 拡売費系右ペインの状態管理（削除はグリッド側の確認ダイアログで処理）
  const [isEditExpensePaneShown, setIsEditExpensePaneShown] = useState(false);
  const [isCopyExpensePaneShown, setIsCopyExpensePaneShown] = useState(false);
  const [pendingCopyExpenseRow, setPendingCopyExpenseRow] =
    useState<NonProductExpenseData | null>(null);

  // すべての右ペインを閉じるヘルパー関数
  const closeAllRightPanes = () => {
    setIsCommentHistoryPaneShown(false);
    setIsPlanSelectionPaneShown(false);
    setIsEditExpensePaneShown(false);
    setIsCopyExpensePaneShown(false);
  };

  // 販売計画選択ペイン（支払明細に紐づける計画明細 選択エリア）を開く
  const handleOpenPlanSelection = () => {
    const isOpen = isPlanSelectionPaneShown;
    closeAllRightPanes();
    if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
    setIsPlanSelectionPaneShown(true);
  };

  // 拡売費コピーペインを開く（拡売費グリッドの明細行の編集可能項目を編集する）
  const handleOpenCopyExpense = (row: ExpenseRow) => {
    const isOpen = isCopyExpensePaneShown;
    closeAllRightPanes();
    if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
    const toStr = (v: string | number) =>
      v === '' || v == null ? '' : String(v);
    setCopyEditForm({
      billName: toStr(row.billName),
      payAmount: toStr(row.payAmount),
      taxClass: toStr(row.taxClass),
      measureClass: toStr(row.measureClass),
      measureCode: toStr(row.measureCode),
      approvalNo: toStr(row.approvalNo),
      approvalDate: toStr(row.approvalDate),
      summary1: toStr(row.summary1),
      summary2: toStr(row.summary2),
      accountAmount: toStr(row.accountAmount),
      matchType: toStr(row.matchType),
    });
    setIsCopyExpensePaneShown(true);
  };

  // 拡売費編集ペインを開く（拡売費グリッドの明細行の編集可能項目を編集する）
  const handleOpenEditExpense = (row: ExpenseRow) => {
    const isOpen = isEditExpensePaneShown;
    closeAllRightPanes();
    if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
    const toStr = (v: string | number) =>
      v === '' || v == null ? '' : String(v);
    setEditExpenseForm({
      billName: toStr(row.billName),
      payAmount: toStr(row.payAmount),
      taxClass: toStr(row.taxClass),
      measureClass: toStr(row.measureClass),
      measureCode: toStr(row.measureCode),
      approvalNo: toStr(row.approvalNo),
      approvalDate: toStr(row.approvalDate),
      summary1: toStr(row.summary1),
      summary2: toStr(row.summary2),
      accountAmount: toStr(row.accountAmount),
      matchType: toStr(row.matchType),
    });
    setIsEditExpensePaneShown(true);
  };

  // エクスポート：Excel への出力は未実装のため、案内のトーストだけ出す。
  // TODO: 実装するときは、商品の明細・商品外の拡売費・基本情報の条件を Excel に出力する
  //       （以前は定義の無い exportSalesPlanToExcel を呼んでいて、押すとエラーになっていた）。
  const handleExport = () => {
    toast.info('エクスポートは準備中です。');
  };

  // 列幅・並び・ソートの状態を保存／復元する（→ 02 §7 列状態の永続化）
  const detailGridColumnStateProps = useGridColumnState(
    '支払詳細(見積).明細.columnState'
  );
  return (
    <div className="flex h-full w-full overflow-hidden bg-neutral-100">
      {/* 左ペイン：メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* スクロール可能エリア */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-300">
            <div className="px-6 pt-3 pb-2">
              {/* 画面名はヘッダー（システム名の右）に表示する */}
              <ScreenTitle title="支払詳細(引用)" />

              {/* 販売計画条件エリア */}
              <section aria-labelledby="search-heading">
                <h2 id="search-heading" className="sr-only">
                  検索条件
                </h2>
                <QuoteBasicInfoPane
                  storesEditable
                  onExport={handleExport}
                  basicInfo={DEFAULT_QUOTE_BASIC_INFO}
                  storeOptions={QUOTE_STORE_OPTIONS}
                />
              </section>

              {/* 支払明細情報の上のタブ（支払No. / 他部門から分割された経費明細）。
                  支払詳細(自販機)・PaymentDetailWithInvoice と同形式。タブ1に支払回数・支払明細情報・拡売費を
                  まとめ、タブ2に他部門から分割された経費明細（参照専用グリッド）を表示する。 */}
              <Tabs
                value={activeDetailTab}
                onValueChange={setActiveDetailTab}
                className="w-full mt-2"
              >
                <TabsList className="grid w-full grid-cols-2 bg-transparent p-0 h-auto gap-1 mb-2">
                  <TabsTrigger
                    value="payment-detail"
                    className="flex items-center justify-center gap-2 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded px-4 py-3"
                  >
                    <ReceiptJapaneseYen className="h-4 w-4" />
                    <span className="font-medium">支払No：{PAYMENT_NO}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="split-from-other"
                    className="flex items-center justify-center gap-2 bg-gray-100 border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-b-blue-600 text-gray-600 transition-colors rounded px-4 py-3"
                  >
                    <Import className="h-4 w-4" />
                    <span className="font-medium">
                      他部門から分割された経費明細
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="payment-detail" className="space-y-0">
                  {/* 支払回数（PaymentDetailWithInvoice と同様、支払明細情報カードの上に配置） */}
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
                        ...invoiceCountOptions.map((n) => ({
                          value: n,
                          label: n,
                        })),
                      ]}
                      value={invoiceCount}
                      onChange={setInvoiceCount}
                      placeholder="選択"
                      searchable={false}
                    />
                    {/* 支払回数追加（支払回数プルダウンの右・左に全角2文字程度の空白） */}
                    <button
                      type="button"
                      className="btn-toolbar-outline ml-8"
                      aria-label="支払回数追加"
                      onClick={handleAddInvoiceCount}
                    >
                      ＋支払回数追加
                    </button>
                  </div>

                  {/* 支払明細情報エリア（PaymentDetailQuoteから直接表示） */}
                  <section aria-labelledby="payment-detail-heading">
                    <h2 id="payment-detail-heading" className="sr-only">
                      支払明細情報
                    </h2>
                    <QuotePaymentDetailPane
                      status="承認待ち"
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
                    <QuoteNonProductExpensePane
                      columnStateKey="支払詳細(見積).商品外経費.columnState"
                      onOpenEditExpense={handleOpenEditExpense}
                      onOpenCopyExpense={handleOpenCopyExpense}
                      pendingCopyRow={pendingCopyExpenseRow}
                      onCopyComplete={() => setPendingCopyExpenseRow(null)}
                      onOpenPlanSelection={handleOpenPlanSelection}
                      netUnapproved={netUnapproved}
                    />
                  </section>
                </TabsContent>

                {/* タブ2：他部門から分割された経費明細（参照専用グリッド・支払詳細(自販機)と同形式）。
                    NoLink は追加口を持たないため、拡売費の一覧のみ表示する。 */}
                <TabsContent
                  value="split-from-other"
                  className="flex flex-col gap-4"
                >
                  {/* 拡売費（参照専用一覧） */}
                  <div className={`${CARD_CLASS} overflow-hidden`}>
                    <div className="px-3 pt-3">
                      <h3 className="text-base font-bold text-gray-900">
                        拡売費
                      </h3>
                    </div>
                    {/* 合計サマリーバー（支払No.タブの拡売費一覧と同形式・支払金額／計画金額の総合計） */}
                    <div className="px-3 pt-2 pb-2">
                      <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                        {/* 合計ラベル（全高・左揃え） */}
                        <div className="flex shrink-0 items-center border-r border-gray-200 px-4 text-left text-sm font-bold text-gray-900 whitespace-nowrap">
                          合計
                        </div>
                        {/* 総合計（支払金額／計画金額） */}
                        {SPLIT_SUMMARY_ITEMS.map((item) => (
                          <div
                            key={item.label}
                            className="flex flex-col items-end justify-center border-r border-gray-200 px-3 py-1 last:border-r-0 min-w-42"
                          >
                            <span className="text-xs text-gray-500 whitespace-nowrap">
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
                      className="expense-item-grid w-full px-3 pb-3 pt-0"
                      style={{ height: '22.5rem' }}
                    >
                      <AgGridReact
                        {...detailGridColumnStateProps}
                        rowData={SPLIT_FROM_OTHER_ROWS}
                        columnDefs={SPLIT_FROM_OTHER_COL_DEFS}
                        defaultColDef={SPLIT_FROM_OTHER_DEFAULT_COL_DEF}
                        // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                        columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                        getRowId={(params) => `exp-${params.data.no}`}
                        statusBar={GRID_STATUS_BAR}
                        {...GRID_BASE_PROPS}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* 下ペイン：支払明細に紐づける計画明細 選択エリア。
            プッシュ式：親画面に被さらず中身を押し上げるため、選択エリアと支払明細を同時に視認できる。 */}
        <BottomPane
          open={isPlanSelectionPaneShown}
          onClose={() => setIsPlanSelectionPaneShown(false)}
          title="支払明細に紐づける計画明細 選択エリア"
          description="支払明細に紐づける計画明細を選択します"
          initialHeight={28}
          minHeight={18}
          maxHeight={48}
        >
          <QuotePlanSelectionPane
            initialTargetMonth={DEFAULT_QUOTE_BASIC_INFO.targetMonth}
            columnStateKey="支払詳細(見積).計画明細選択.columnState"
            onSelect={() => {
              // TODO: 選択された計画明細を支払明細に紐づける（未実装）
              // 連続してチェック操作を行えるようペインは開いたままにする。
            }}
          />
        </BottomPane>

        {/* フッターエリア（固定） */}
        <div
          data-screen-footer
          className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10 mt-4 min-w-300"
        >
          <div className="flex flex-wrap gap-3 justify-between">
            <div>
              <button
                className="btn-action-base btn-action-outline"
                aria-label="一覧へ戻る"
                onClick={() => setIsBackDialogOpen(true)}
              >
                <Undo2 className="h-4 w-4" />
                一覧へ戻る
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              <FooterCommentField
                id="payment-quote-comment"
                value={commentInput}
                onChange={setCommentInput}
              />
              <button
                className="btn-action-base btn-action-red"
                aria-label="差戻し"
                onClick={() => setConfirmAction('reject')}
              >
                <CornerUpLeft className="h-4 w-4" />
                差戻し
              </button>
              <button
                className="btn-action-base btn-action-green"
                aria-label="承認"
                onClick={() => setConfirmAction('approve')}
              >
                <Check className="h-4 w-4" />
                承認
              </button>
              <button
                className="btn-action-base btn-action-green"
                aria-label="検印"
                onClick={() => setConfirmAction('seal')}
              >
                <Stamp className="h-4 w-4" />
                検印
              </button>
              <button
                className="btn-action-base btn-action-outline-blue"
                aria-label="引戻し"
                onClick={() => setConfirmAction('withdraw')}
              >
                <CornerUpLeft className="h-4 w-4" />
                引戻し
              </button>
              <button
                className="btn-action-base btn-action-green"
                aria-label="申請"
                onClick={() => setConfirmAction('apply')}
              >
                <Send className="h-4 w-4" />
                申請
              </button>
              <button
                className="btn-action-base btn-action-blue"
                aria-label="保存"
                onClick={handleSave}
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

      {/* 右ペイン：拡売費編集（拡売費グリッドの編集可能項目） */}
      <RightPane
        open={isEditExpensePaneShown}
        onClose={() => setIsEditExpensePaneShown(false)}
        title="拡売費編集"
        description="明細を編集します"
        footer={
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setIsEditExpensePaneShown(false)}
          >
            更新
          </Button>
        }
      >
        {(() => {
          const f = editExpenseForm;
          const setF = setEditExpenseForm;
          return (
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
              {/* 卸からの請求名称（全幅） */}
              <div className="space-y-1.5 @md:col-span-2 @2xl:col-span-3">
                <Label className="text-sm font-medium text-gray-700">
                  卸からの請求名称
                </Label>
                <Input
                  value={f.billName}
                  onChange={(e) =>
                    setF((p) => ({ ...p, billName: e.target.value }))
                  }
                  placeholder="卸からの請求名称を入力"
                  className={`${TEXT_INPUT_CLASS} w-full`}
                />
              </div>

              {/* 支払金額 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  支払金額
                </Label>
                <NumericInput
                  value={f.payAmount}
                  step="1"
                  onChange={(e) =>
                    setF((p) => ({
                      ...p,
                      payAmount: toIntegerString(e.target.value),
                    }))
                  }
                  placeholder="例: 150000"
                  className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 勘定科目別金額 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  勘定科目別金額
                </Label>
                <NumericInput
                  value={f.accountAmount}
                  step="1"
                  onChange={(e) =>
                    setF((p) => ({
                      ...p,
                      accountAmount: toIntegerString(e.target.value),
                    }))
                  }
                  placeholder="例: 150000"
                  className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 税区分 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  税区分
                </Label>
                <SingleCombobox
                  options={TAX_CLASS_COMBO_OPTIONS}
                  value={f.taxClass}
                  onChange={(v) => setF((p) => ({ ...p, taxClass: v }))}
                  placeholder="税区分を選択"
                />
              </div>

              {/* 施策区分 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  施策区分
                </Label>
                <SingleCombobox
                  options={campaignClassComboOptions()}
                  value={f.measureClass}
                  onChange={(v) => setF((p) => ({ ...p, measureClass: v }))}
                  placeholder="施策区分を選択"
                />
              </div>

              {/* 施策コード */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  施策コード
                </Label>
                <SingleCombobox
                  options={campaignCodeComboOptions()}
                  value={f.measureCode}
                  onChange={(v) => setF((p) => ({ ...p, measureCode: v }))}
                  placeholder="施策コードを選択"
                />
              </div>

              {/* 稟議決裁番号 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  稟議決裁番号
                </Label>
                <Input
                  value={f.approvalNo}
                  onChange={(e) =>
                    setF((p) => ({ ...p, approvalNo: e.target.value }))
                  }
                  placeholder="稟議決裁番号を入力"
                  className={`${TEXT_INPUT_CLASS} w-full`}
                />
              </div>

              {/* 稟議決裁日（拡売費グリッドと同じ年月日ピッカー） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  稟議決裁日
                </Label>
                <DateMonthYearPicker
                  value={f.approvalDate}
                  onChange={(v) => setF((p) => ({ ...p, approvalDate: v }))}
                  clearable
                  className="w-full"
                />
              </div>

              {/* 摘要1（社内用） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  摘要1（社内用）
                </Label>
                <Input
                  value={f.summary1}
                  onChange={(e) =>
                    setF((p) => ({ ...p, summary1: e.target.value }))
                  }
                  placeholder="摘要1を入力"
                  className={`${TEXT_INPUT_CLASS} w-full`}
                />
              </div>

              {/* 摘要2（社外用） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  摘要2（社外用）
                </Label>
                <Input
                  value={f.summary2}
                  onChange={(e) =>
                    setF((p) => ({ ...p, summary2: e.target.value }))
                  }
                  placeholder="摘要2を入力"
                  className={`${TEXT_INPUT_CLASS} w-full`}
                />
              </div>

              {/* 照合支払区分（差異理由の廃止に伴い追加 → 20260821_第31回 決定事項4） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  照合支払区分
                </Label>
                <SingleCombobox
                  options={MATCH_TYPE_PANE_OPTIONS}
                  value={f.matchType}
                  onChange={(v) => setF((p) => ({ ...p, matchType: v }))}
                  placeholder="照合支払区分を選択"
                  className="w-full"
                />
              </div>
            </div>
          );
        })()}
      </RightPane>

      {/* 右ペイン：拡売費コピー（拡売費グリッドの編集可能項目・更新ペインと同一） */}
      <RightPane
        open={isCopyExpensePaneShown}
        onClose={() => setIsCopyExpensePaneShown(false)}
        title="拡売費コピー"
        description="拡売費をコピーします"
        footer={
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setIsCopyExpensePaneShown(false)}
          >
            確定
          </Button>
        }
      >
        {(() => {
          const f = copyEditForm;
          const setF = setCopyEditForm;
          return (
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
              {/* 卸からの請求名称（全幅） */}
              <div className="space-y-1.5 @md:col-span-2 @2xl:col-span-3">
                <Label className="text-sm font-medium text-gray-700">
                  卸からの請求名称
                </Label>
                <Input
                  value={f.billName}
                  onChange={(e) =>
                    setF((p) => ({ ...p, billName: e.target.value }))
                  }
                  placeholder="卸からの請求名称を入力"
                  className={`${TEXT_INPUT_CLASS} w-full`}
                />
              </div>

              {/* 支払金額 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  支払金額
                </Label>
                <NumericInput
                  value={f.payAmount}
                  step="1"
                  onChange={(e) =>
                    setF((p) => ({
                      ...p,
                      payAmount: toIntegerString(e.target.value),
                    }))
                  }
                  placeholder="例: 150000"
                  className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 勘定科目別金額 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  勘定科目別金額
                </Label>
                <NumericInput
                  value={f.accountAmount}
                  step="1"
                  onChange={(e) =>
                    setF((p) => ({
                      ...p,
                      accountAmount: toIntegerString(e.target.value),
                    }))
                  }
                  placeholder="例: 150000"
                  className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 税区分 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  税区分
                </Label>
                <SingleCombobox
                  options={TAX_CLASS_COMBO_OPTIONS}
                  value={f.taxClass}
                  onChange={(v) => setF((p) => ({ ...p, taxClass: v }))}
                  placeholder="税区分を選択"
                />
              </div>

              {/* 施策区分 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  施策区分
                </Label>
                <SingleCombobox
                  options={campaignClassComboOptions()}
                  value={f.measureClass}
                  onChange={(v) => setF((p) => ({ ...p, measureClass: v }))}
                  placeholder="施策区分を選択"
                />
              </div>

              {/* 施策コード */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  施策コード
                </Label>
                <SingleCombobox
                  options={campaignCodeComboOptions()}
                  value={f.measureCode}
                  onChange={(v) => setF((p) => ({ ...p, measureCode: v }))}
                  placeholder="施策コードを選択"
                />
              </div>

              {/* 稟議決裁番号 */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  稟議決裁番号
                </Label>
                <Input
                  value={f.approvalNo}
                  onChange={(e) =>
                    setF((p) => ({ ...p, approvalNo: e.target.value }))
                  }
                  placeholder="稟議決裁番号を入力"
                  className={`${TEXT_INPUT_CLASS} w-full`}
                />
              </div>

              {/* 稟議決裁日（拡売費グリッドと同じ年月日ピッカー） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  稟議決裁日
                </Label>
                <DateMonthYearPicker
                  value={f.approvalDate}
                  onChange={(v) => setF((p) => ({ ...p, approvalDate: v }))}
                  clearable
                  className="w-full"
                />
              </div>

              {/* 摘要1（社内用） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  摘要1（社内用）
                </Label>
                <Input
                  value={f.summary1}
                  onChange={(e) =>
                    setF((p) => ({ ...p, summary1: e.target.value }))
                  }
                  placeholder="摘要1を入力"
                  className={`${TEXT_INPUT_CLASS} w-full`}
                />
              </div>

              {/* 摘要2（社外用） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  摘要2（社外用）
                </Label>
                <Input
                  value={f.summary2}
                  onChange={(e) =>
                    setF((p) => ({ ...p, summary2: e.target.value }))
                  }
                  placeholder="摘要2を入力"
                  className={`${TEXT_INPUT_CLASS} w-full`}
                />
              </div>

              {/* 照合支払区分（差異理由の廃止に伴い追加 → 20260821_第31回 決定事項4） */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  照合支払区分
                </Label>
                <SingleCombobox
                  options={MATCH_TYPE_PANE_OPTIONS}
                  value={f.matchType}
                  onChange={(v) => setF((p) => ({ ...p, matchType: v }))}
                  placeholder="照合支払区分を選択"
                  className="w-full"
                />
              </div>
            </div>
          );
        })()}
      </RightPane>

      {/* 右ペイン：コメント履歴 */}
      <RightPane
        open={isCommentHistoryPaneShown}
        onClose={() => setIsCommentHistoryPaneShown(false)}
        title="コメント履歴"
        description=""
      >
        <div className="space-y-3">
          {COMMENT_HISTORY_DATA.map((item, index) => (
            <div
              key={index}
              className="bg-gray-50 p-4 rounded-lg space-y-2 border border-gray-200"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">
                  {item.actionType}
                </span>
                <span className="text-sm text-gray-600">{item.datetime}</span>
                <span className="text-sm text-gray-900">{item.userName}</span>
              </div>
              {item.comment && (
                <div className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                  {item.comment}
                </div>
              )}
            </div>
          ))}
        </div>
      </RightPane>
    </div>
  );
}

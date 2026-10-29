// 支払詳細(引用)画面
// PaymentDetailWithInvoice（支払詳細(マージン率固定・NET入力)）をベースに、追加口エリア（追加口一覧テーブル
// と、そこから開く明細追加・編集・削除・コピー／年契基本分／センターフィ／取組強化マージンの
// 各右ペイン）を除外した、拡売費のみを扱う画面。
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '../../ui/button';
import {
  Save,
  Send,
  Check,
  X,
  Upload,
  ChevronDown,
  ReceiptJapaneseYen,
  Import,
  CornerUpLeft,
  Stamp,
  Undo2,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  GRID_COLORS,
  withHeaderTooltips,
  GRID_NO_FILTER_COLUMN_TYPES,
  GRID_EMPTY_TEXT,
} from '../../grid';
import { SearchPane } from './components/SearchPane';
import { PaymentDetailPane } from './components/PaymentDetailPane';
import { AggregationPane } from './components/AggregationPane';
import {
  NonProductExpensePane,
  type NonProductExpenseData,
} from './components/NonProductExpensePane';
import { PlanSelectionPane } from './components/PlanSelectionPane';
import { RightPane } from '../../ui/right-pane';
import { BottomPane } from '../../ui/bottom-pane';
import { NumericInput } from '../../ui/numeric-input';
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
  AlertDialogCancel,
} from '../../ui/alert-dialog';
import { toast } from 'sonner';
import { Input } from '../../ui/input';
import { TEXT_INPUT_CLASS } from '../../../../styles/commonStyles';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { SingleCombobox } from '../../ui/single-combobox';
import { MATCH_PAYMENT_TYPE_OPTIONS } from '../../../constants/matchPaymentType';
import { DateMonthYearPicker } from '../../ui/date-month-year-picker';

import {
  EXPENSE_CAMPAIGN_CLASS_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
} from '../../../constants/expenseRelations';
import type { ExpenseRow } from './components/NonProductExpensePane';
import type { QuoteBasicInfo } from '../../../utils/quoteBasicInfo';
import { ScreenTitle } from '../../ui/screen-title';

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
      width: 70,
      // 先頭列は grid.css で中央寄せ強制のため、左寄せクラスを付与（→ グリッド左寄せ規約）
      cellClass: 'ag-cell-left-pinned',
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '卸からの請求名称',
      field: 'billName',
      width: 240,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '販売計画に記載の拡売費内容',
      field: 'planExpContent',
      width: 240,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '商品',
      field: 'product',
      width: 220,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '支払金額',
      field: 'payAmount',
      width: 120,
      valueFormatter: (p) => formatInt(p.value as number) || GRID_EMPTY_TEXT,
      cellStyle: SPLIT_RO_RIGHT_STYLE,
    },
    {
      headerName: '計画金額',
      field: 'planAmount',
      width: 120,
      valueFormatter: (p) => formatInt(p.value as number) || GRID_EMPTY_TEXT,
      cellStyle: SPLIT_RO_RIGHT_STYLE,
    },
    {
      headerName: '税区分',
      field: 'taxClass',
      width: 90,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '管理区分（用途）',
      field: 'mgmtClass',
      width: 200,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '管理コード（投資責任）',
      field: 'mgmtCode',
      width: 200,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '摘要1',
      field: 'summary1',
      width: 200,
      cellStyle: SPLIT_RO_STYLE,
    },
    {
      headerName: '摘要2',
      field: 'summary2',
      width: 200,
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

function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = '選択または入力...',
  hasError,
}: {
  options: { value: string; label?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasError?: boolean;
}) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      options.filter((opt) =>
        (opt.label ?? opt.value)
          .toLowerCase()
          .includes(inputValue.toLowerCase())
      ),
    [options, inputValue]
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center border rounded-md bg-white shadow-sm transition-colors ${
          hasError
            ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-500'
            : 'border-gray-400 focus-within:ring-2 focus-within:ring-blue-500'
        }`}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm bg-transparent outline-none min-w-0"
        />
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="px-2 text-gray-500 hover:text-gray-700 flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 border border-gray-200 rounded-md bg-white shadow-lg max-h-48 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">候補なし</div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setInputValue(opt.label ?? opt.value);
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                  value === opt.value ? 'bg-blue-100 font-medium' : ''
                }`}
              >
                {opt.label ?? opt.value}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface PaymentDetailQuoteEntryProps {
  // メニュー遷移（フッターの「一覧へ戻る」等で使用）
  onMenuChange?: (menuId: string) => void;
  // 支払一覧の引用ペインで入力された基本情報（基本情報エリアのプリフィル用）
  basicInfo?: QuoteBasicInfo;
}

export default function PaymentDetailQuoteEntry({
  onMenuChange,
  basicInfo,
}: PaymentDetailQuoteEntryProps) {
  // 追加口一覧から連動する「未承認NET拡売費」データ（拡売費一覧へ渡す）
  const [netUnapproved] = useState<{
    total: number;
    byProduct: Record<string, number>;
  }>({ total: 0, byProduct: {} });
  // フッターの操作確認ダイアログ（PaymentDetailOther と同一方式）
  const [isBackDialogOpen, setIsBackDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCommentHistoryPane, setShowCommentHistoryPane] = useState(false);
  // 支払明細に紐づける計画明細 選択エリア（下ペイン）
  const [showPlanSelectionPane, setShowPlanSelectionPane] = useState(false);
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
    onMenuChange?.('payment-list');
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
  const [showEditExpensePane, setShowEditExpensePane] = useState(false);
  const [showCopyExpensePane, setShowCopyExpensePane] = useState(false);
  const [pendingCopyExpenseRow, setPendingCopyExpenseRow] =
    useState<NonProductExpenseData | null>(null);

  // すべての右ペインを閉じるヘルパー関数
  const closeAllRightPanes = () => {
    setShowCommentHistoryPane(false);
    setShowPlanSelectionPane(false);
    setShowEditExpensePane(false);
    setShowCopyExpensePane(false);
  };

  // 販売計画選択ペイン（支払明細に紐づける計画明細 選択エリア）を開く
  const handleOpenPlanSelection = () => {
    const isOpen = showPlanSelectionPane;
    closeAllRightPanes();
    if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
    setShowPlanSelectionPane(true);
  };

  // 拡売費コピーペインを開く（拡売費グリッドの明細行の編集可能項目を編集する）
  const handleOpenCopyExpense = (row: ExpenseRow) => {
    const isOpen = showCopyExpensePane;
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
    setShowCopyExpensePane(true);
  };

  // 拡売費編集ペインを開く（拡売費グリッドの明細行の編集可能項目を編集する）
  const handleOpenEditExpense = (row: ExpenseRow) => {
    const isOpen = showEditExpensePane;
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
    setShowEditExpensePane(true);
  };

  // ダミーデータ生成（実際のアプリではAPIから取得）
  const generateDummyProductData = () => {
    const brands = ['三ツ矢', 'カルピス', 'ウィルキンソン', '十六茶', 'ワンダ'];
    const promotionTypes = ['定番・EDLP', '新商品', '特殊商品', 'ギフト'];
    const data = [];

    for (let i = 0; i < 20; i++) {
      data.push({
        promotionType: promotionTypes[i % 4],
        metaBrand: brands[i % 5],
        summaryProductName: `${brands[i % 5]}商品${i + 1}`,
        generalMesh: `M${100000 + i}`,
        endSale: i % 10 === 0 ? '終売' : '',
        quantity: [8, 12, 24, 30][i % 4],
        planBoxes: [800, 500, 300, 200][i % 4],
        currentEstimate: [800, 480, 290, 190][i % 4],
        currentActual: [445, 250, 150, 100][i % 4],
        prevYearActual: [800, 500, 300, 200][i % 4],
        planVsPrevYear: [100.0, 96.0, 96.7, 95.0][i % 4],
        net: [62.13, 58.5, 50.0, 36.68][i % 4],
        deliveryPrice: [55.0, 52.0, 45.0, 33.0][i % 4],
        sellingPrice: [120, 115, 100, 80][i % 4],
        marginRate: [11.2, 10.5, 9.8, 9.0][i % 4],
        markupRate: [54.2, 54.8, 55.0, 58.8][i % 4],
        seihan: [11000, 14000, 10500, 8800][i % 4],
        ukewatashi: [10500, 13500, 10000, 8400][i % 4],
        profitRate: [23.1, 18.5, 23.1, 8.5][i % 4],
        exp1Amount: i % 3 === 0 ? 50000 : 0,
        exp1PostingMonth: i % 3 === 0 ? 10 : 0,
        exp1DeliveryMonth: i % 3 === 0 ? 10 : 0,
        exp1ManagementClass: i % 3 === 0 ? '販促費' : '',
        exp1ManagementCode: i % 3 === 0 ? 'A001' : '',
        exp1Description: i % 3 === 0 ? '新商品導入費' : '',
        exp2Amount: 0,
        exp2PostingMonth: 0,
        exp2DeliveryMonth: 0,
        exp2ManagementClass: '',
        exp2ManagementCode: '',
        exp2Description: '',
      });
    }
    return data;
  };

  const generateDummyNonProductExpenseData = () => {
    return [
      {
        metaBrand: '三ツ矢',
        accountItem: '販促費',
        managementClass: '拡売費A',
        managementCode: 'A001',
        description: '店頭POP費用',
        amount: 150000,
        postingMonth: '2025-10',
      },
      {
        metaBrand: 'カルピス',
        accountItem: '広告費',
        managementClass: '拡売費B',
        managementCode: 'B002',
        description: 'TV-CM放映費',
        amount: 300000,
        postingMonth: '2025-10',
      },
      {
        metaBrand: 'ウィルキンソン',
        accountItem: '販促費',
        managementClass: '拡売費A',
        managementCode: 'A003',
        description: 'サンプリング費用',
        amount: 200000,
        postingMonth: '2025-10',
      },
    ];
  };

  const handleExport = (
    includeSeihanPrice: boolean,
    includeUkewatashiPrice: boolean
  ) => {
    const productData = generateDummyProductData();
    const nonProductExpenseData = generateDummyNonProductExpenseData();

    const searchConditions = {
      targetYear: '2025年',
      targetMonth: '10月',
      status: '全て',
      applicationStatus: '未申請',
      businessLocation: '首都圏本部',
      department: '首都圏営業第二部',
      manager: 'アサヒ　早苗',
      area: '首都圏',
      tradingSystem: 'マージン率固定',
      salesPerson: 'アサヒ　太郎',
      channel: '全国SM',
      retailer: 'イオンリテール',
      firstTier1: '三菱食品株式会社（イオン）',
      firstTier2: '加藤産業株式会社　仙台支店イオンＲＤＣ',
      firstTier3: '伊藤忠食品株式会社　仙台支店',
      copyTargetMonth: '2025年9月',
      centerFeeRate: 3.0,
      fixedMarginRate: 11.0,
    };

    const options = {
      includeSeihanPrice,
      includeUkewatashiPrice,
    };

    exportSalesPlanToExcel(
      productData,
      nonProductExpenseData,
      searchConditions,
      options
    );
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#f5f5f5]">
      {/* 左ペイン：メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* スクロール可能エリア */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-[75rem]">
            <div className="px-6 pt-3 pb-2">
              {/* 画面名はヘッダー（システム名の右）に表示する */}
              <ScreenTitle title="支払詳細(引用)" />

              {/* 販売計画条件エリア */}
              <section aria-labelledby="search-heading">
                <h2 id="search-heading" className="sr-only">
                  検索条件
                </h2>
                <SearchPane
                  onImport={() => setShowImportDialog(true)}
                  onExport={() => handleExport(true, true)}
                  onQuoteExport={() => handleExport(true, true)}
                  basicInfo={basicInfo}
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

                  {/* 支払明細情報エリア（PaymentDetailQuoteEntryから直接表示） */}
                  <section aria-labelledby="payment-detail-heading">
                    <h2 id="payment-detail-heading" className="sr-only">
                      支払明細情報
                    </h2>
                    <PaymentDetailPane
                      onStatusClick={() => {
                        const isOpen = showCommentHistoryPane;
                        closeAllRightPanes();
                        if (isOpen) return; // 開くボタン再押下で閉じる（トグル）
                        setShowCommentHistoryPane(true);
                      }}
                    />
                  </section>

                  {/* 拡売費一覧（独立カード） */}
                  <section className="mb-4" aria-labelledby="expense-heading">
                    <h2 id="expense-heading" className="sr-only">
                      拡売費
                    </h2>
                    <NonProductExpensePane
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
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-md">
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
                            className="flex flex-col items-end justify-center border-r border-gray-200 px-3 py-1 last:border-r-0 min-w-[10.5rem]"
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
          open={showPlanSelectionPane}
          onClose={() => setShowPlanSelectionPane(false)}
          title="支払明細に紐づける計画明細 選択エリア"
          description="支払明細に紐づける計画明細を選択します"
          initialHeight={28}
          minHeight={18}
          maxHeight={48}
        >
          <PlanSelectionPane
            // 対象年月の初期値は引用元から引き継いだ基本情報の対象年月。
            initialTargetMonth={basicInfo?.targetMonth}
            onSelect={(data) => {
              // TODO: 選択された計画明細を支払明細に紐づける（未実装）
              // 連続してチェック操作を行えるようペインは開いたままにする。
              console.log('計画明細を選択:', data);
            }}
          />
        </BottomPane>

        {/* フッターエリア（固定） */}
        <div
          data-screen-footer
          className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10 mt-4 min-w-[75rem]"
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
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <label className="text-sm text-gray-700 whitespace-nowrap font-medium">
                  コメント
                </label>
                <Input
                  type="text"
                  placeholder="コメントを入力"
                  className={`${TEXT_INPUT_CLASS} w-full min-w-[10rem] max-w-[32rem]`}
                />
              </div>
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
        <AlertDialog open={isBackDialogOpen} onOpenChange={setIsBackDialogOpen}>
          <AlertDialogContent>
            {/* ×ボタン */}
            <button
              className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
              onClick={() => setIsBackDialogOpen(false)}
              aria-label="閉じる"
            >
              <X className="size-6" />
              <span className="sr-only">Close</span>
            </button>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold text-gray-900">
                画面遷移の確認
              </AlertDialogTitle>
              <AlertDialogDescription>
                支払申請一覧参照画面へ戻ります。編集中の内容は保存されません。よろしいですか？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                onClick={handleBackConfirm}
              >
                移動
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 支払確認ダイアログ（申請／引戻し／承認／検印／差戻し共通・PaymentDetailOther と同一） */}
        <AlertDialog
          open={confirmAction !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null);
          }}
        >
          <AlertDialogContent>
            {/* ×ボタン */}
            <button
              className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
              onClick={() => setConfirmAction(null)}
              aria-label="閉じる"
            >
              <X className="size-6" />
              <span className="sr-only">Close</span>
            </button>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold text-gray-900">
                {confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].title : ''}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction
                  ? CONFIRM_MESSAGE_MAP[confirmAction].description
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                className={`${
                  confirmAction
                    ? CONFIRM_MESSAGE_MAP[confirmAction].buttonClass
                    : ''
                } text-white rounded-lg`}
                onClick={handleConfirmAction}
              >
                {confirmAction ? CONFIRM_MESSAGE_MAP[confirmAction].button : ''}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 計画書インポートダイアログ */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
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
              <Button onClick={() => setShowImportDialog(false)}>
                <Upload className="h-[1rem] w-[1rem]" />
                計画書インポート
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 右ペイン：拡売費編集（拡売費グリッドの編集可能項目） */}
      <RightPane
        open={showEditExpensePane}
        onClose={() => setShowEditExpensePane(false)}
        title="拡売費編集"
        description="明細を編集します"
        footer={
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowEditExpensePane(false)}
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
                <SearchableCombobox
                  options={EXPENSE_TAX_CLASS_OPTIONS}
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
                <SearchableCombobox
                  options={EXPENSE_CAMPAIGN_CLASS_OPTIONS}
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
                <SearchableCombobox
                  options={EXPENSE_CAMPAIGN_CODE_OPTIONS}
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
        open={showCopyExpensePane}
        onClose={() => setShowCopyExpensePane(false)}
        title="拡売費コピー"
        description="拡売費をコピーします"
        footer={
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowCopyExpensePane(false)}
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
                <SearchableCombobox
                  options={EXPENSE_TAX_CLASS_OPTIONS}
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
                <SearchableCombobox
                  options={EXPENSE_CAMPAIGN_CLASS_OPTIONS}
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
                <SearchableCombobox
                  options={EXPENSE_CAMPAIGN_CODE_OPTIONS}
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
        open={showCommentHistoryPane}
        onClose={() => setShowCommentHistoryPane(false)}
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

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  CalendarIcon,
  X,
  Save,
  Send,
  Trash2,
  Check,
  SquarePen,
  Copy,
  Upload,
  Undo2,
  CornerUpLeft,
  ArrowLeft,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { CustomCellEditorProps } from 'ag-grid-react';
import {
  ColDef,
  ICellRendererParams,
  SuppressKeyboardEventParams,
  CellValueChangedEvent,
} from 'ag-grid-community';
import { format, parse } from 'date-fns';
import { ja } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  viewportGridHeight,
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  GRID_COLORS,
  useRevealNewRows,
  GRID_NUMBER_TEXT_FILTER,
  GRID_EMPTY_TEXT,
} from '@/components/grid';
import { RequiredBadge } from '@/components/ui/required-badge';
import {
  SingleCombobox,
  type SingleComboboxOption,
} from '@/components/ui/single-combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TEXT_INPUT_CLASS,
  CARD_CLASS,
  SEARCH_GRID_CLASS,
  SEARCH_LABEL_CLASS,
} from '@/styles/commonStyles';
import { Label } from '@/components/ui/label';
import { DateMonthYearPicker } from '@/components/ui/date-month-year-picker';
import { DateMonthYearCellEditor } from '@/components/ui/date-month-year-cell-editor';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RightPane } from '@/components/ui/right-pane';
import { BottomPane } from '@/components/ui/bottom-pane';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { PaymentPlanSelectionPane } from '@/features/payment/shared/payment-detail/PaymentPlanSelectionPane';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { ScreenTitle } from '@/components/ui/screen-title';
import { useAppNavigation } from '@/components/ui/use-app-navigation';
import { insertRowsAfter } from '@/utils/common/addedRowOrder';
import { FooterCommentField } from '@/components/shared/common/FooterCommentField';

// 支払確認ダイアログで扱うアクション種別
type ConfirmAction = 'apply' | 'withdraw' | 'approve' | 'reject' | null;

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
  reject: {
    title: '差戻しの確認',
    description: '拡売費支払データを差戻しします。よろしいですか？',
    toast: '差戻しが完了しました。',
    button: '差戻し',
    buttonClass: 'bg-red-500 hover:bg-red-600',
  },
};

// 拡売費明細の1行を表す型
interface ExpansionExpenseData {
  id: string; // 内部識別子
  product: string; // 商品（読み取り専用・販売計画選択で設定）
  planAmount: string; // 計画金額（読み取り専用・販売計画選択で設定）
  paymentAmount: string; // 支払金額（テキストボックス）
  taxCategory: string; // 税区分（1:課税10% / 2:課税8% / 3:その他(5%) / 4:その他(非課税)。コード:名称）
  wholesaleBillName: string; // 卸からの請求名称（テキストボックス）
  planExpenseContent: string; // 販売計画に記載の拡売費内容（読み取り専用）
  managementCategory: string; // 管理区分（"コード:名称"）
  managementCode: string; // 管理コード（"コード:名称"）
  measureCategory: string; // 施策区分（"コード:名称"）
  measureCode: string; // 施策コード（"コード:名称"）
  approvalNumber: string; // 稟議決裁番号（テキストボックス）
  approvalDate: string; // 稟議決裁日（日付テキストボックス）
  note1: string; // 摘要1（社内用）
  note2: string; // 摘要2（社外用）
  accountAmount: string; // 勘定科目別金額（テキストボックス）
  differenceReason: string; // 差異理由（テキストボックス）
  invoiceNumber: string; // 請求書番号（テキストボックス）
  invoicePage: string; // 請求書ページ（テキストボックス・①02など）
}

// プルダウン選択肢（支払申請承認画面と同じ）
const MANAGEMENT_CATEGORY_OPTIONS = [
  '330:ロケ運転費',
  '760:オペ協力金',
  '662:その他',
  '683:空缶処理費',
  '601:ロケ契約料 他前払い金 （償却）',
];

// 管理区分は "コード:名称"（例 "330:ロケ運転費"）の1値で保持する。
// 表示はコード列・名称列の2列に分けるため、値からコード／名称を取り出すヘルパー。
const splitCategoryCode = (v?: string) => {
  if (!v) return '';
  const i = v.indexOf(':');
  return i === -1 ? v : v.slice(0, i);
};
const splitCategoryName = (v?: string) => {
  if (!v) return '';
  const i = v.indexOf(':');
  return i === -1 ? '' : v.slice(i + 1);
};

// "コード:名称" 文字列を SingleCombobox の選択肢へ変換するヘルパー。
// グリッドのセル編集用は名称＋コードの2行表示、右ペイン用は "コード:名称" の1行表示。
const toComboOption = (opt: string) => ({
  value: opt,
  label: splitCategoryName(opt),
  code: splitCategoryCode(opt),
});
const toPaneOption = (opt: string) => ({ value: opt, label: opt });

// 管理区分の選択肢（グリッド用／右ペイン用）。
const MANAGEMENT_CATEGORY_COMBO_OPTIONS =
  MANAGEMENT_CATEGORY_OPTIONS.map(toComboOption);
const MANAGEMENT_CATEGORY_PANE_OPTIONS =
  MANAGEMENT_CATEGORY_OPTIONS.map(toPaneOption);

// "コード:名称" の項目をグリッドで「コード列／名称列」に分割編集するための汎用セルエディタ。
// 選択肢は cellEditorParams.comboOptions で受け取る（単一選択の検索ボックス・popup表示）。
// AG Grid 35 のリアクティブ方式：props.onValueChange で確定値をプロキシへ反映してから stopEditing。
const ComboCellEditor = (
  props: CustomCellEditorProps & {
    comboOptions: SingleComboboxOption[];
    clearable?: boolean;
  }
) => {
  return (
    <div className="p-1" style={{ width: '22rem' }}>
      <SingleCombobox
        options={props.comboOptions}
        value={(props.value as string) ?? ''}
        clearable={props.clearable}
        onChange={(v) => {
          props.onValueChange(v); // 確定値をプロキシへ反映（同期更新）
          props.stopEditing(); // 選択で編集確定
        }}
        autoOpen
        // ポップアップエディタ内ではポータルにすると外側クリック扱いになり
        // 選択前に編集確定してしまうため、インライン描画にする。
        usePortal={false}
        placeholder="コード または 名称で検索..."
      />
    </div>
  );
};

// 編集中の Enter / ↑ / ↓ は AG Grid に処理させず、検索ボックス側のキー操作に委ねる。
const suppressEditNavKeys = (params: SuppressKeyboardEventParams) =>
  !!params.editing &&
  ['Enter', 'ArrowUp', 'ArrowDown'].includes(params.event.key);

const MANAGEMENT_CODE_OPTIONS = [
  '99999:ロケ運転費',
  '10020:支社',
  '10010:本社',
];

// 税区分の選択肢（支払申請承認画面と同じ）。税率は税率別の税抜内訳の集計に使用する。
const TAX_CATEGORY_OPTIONS = [
  '1:課税10%',
  '2:課税8%',
  '3:その他(5%)',
  '4:その他(非課税)',
];

// 税区分→税率（数値）。税率別の税抜内訳の集計に使用する。
const TAX_RATE_NUM_BY_CATEGORY: Record<string, number> = {
  '1:課税10%': 0.1,
  '2:課税8%': 0.08,
  '3:その他(5%)': 0.05,
  '4:その他(非課税)': 0,
};

// 税率が0より大きい税区分（サマリーバーの税率別内訳に並べる対象）。
// 8%・10%を固定で持たず、税率マスタの定義から導出する。
const TAXABLE_CATEGORIES = TAX_CATEGORY_OPTIONS.filter(
  (category) => (TAX_RATE_NUM_BY_CATEGORY[category] ?? 0) > 0
);

// 税率（0.1）を表示用のラベル（10%）へ整形する。
const formatTaxRateLabel = (rate: number): string =>
  `${Math.round(rate * 1000) / 10}%`;

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

const PAYMENT_DESTINATION_OPTIONS = [
  '1001584:AAA営業本部商品部',
  '1001585:BBB営業本部商品部',
  '1001586:CCC営業本部商品部',
];

// 管理コード・施策区分・施策コードの選択肢（グリッド用／右ペイン用）。
const MANAGEMENT_CODE_COMBO_OPTIONS =
  MANAGEMENT_CODE_OPTIONS.map(toComboOption);
const MANAGEMENT_CODE_PANE_OPTIONS = MANAGEMENT_CODE_OPTIONS.map(toPaneOption);
const MEASURE_CATEGORY_COMBO_OPTIONS =
  MEASURE_CATEGORY_OPTIONS.map(toComboOption);
const MEASURE_CATEGORY_PANE_OPTIONS =
  MEASURE_CATEGORY_OPTIONS.map(toPaneOption);
const MEASURE_CODE_COMBO_OPTIONS = MEASURE_CODE_OPTIONS.map(toComboOption);
const MEASURE_CODE_PANE_OPTIONS = MEASURE_CODE_OPTIONS.map(toPaneOption);
const PAYMENT_DESTINATION_PANE_OPTIONS =
  PAYMENT_DESTINATION_OPTIONS.map(toPaneOption);

// カンマ付き文字列を数値へ変換
const parseNumber = (str: string): number => {
  if (!str) return 0;
  const num = parseFloat(str.replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

// 数値を3桁区切り文字列へ変換
const formatNumber = (num: number): string => Math.round(num).toLocaleString();

// 計画差異（支払金額 − 計画金額）を算出する
const calcPlanDifference = (
  paymentAmount?: string,
  planAmount?: string
): number => parseNumber(paymentAmount ?? '') - parseNumber(planAmount ?? '');

// 初期データ（モック）
const INITIAL_DATA: ExpansionExpenseData[] = [
  {
    id: '1',
    product: '三ツ矢サイダー 500ml',
    planAmount: '500,000',
    paymentAmount: '480,000',
    taxCategory: '1:課税10%',
    wholesaleBillName: '店頭POP費用',
    planExpenseContent: '新商品導入時の店頭販促',
    managementCategory: '330:ロケ運転費',
    managementCode: '10010:本社',
    measureCategory: '01:本社拡売費',
    measureCode: '001:新商品導入施策',
    approvalNumber: 'RG2025-0012',
    approvalDate: '2025/05/10',
    note1: '社内：5月分拡売費',
    note2: '社外：店頭販促費',
    accountAmount: '480,000',
    differenceReason: '',
    invoiceNumber: 'INV-0001',
    invoicePage: '①02',
  },
  {
    id: '2',
    product: 'カルピスウォーター 470ml',
    planAmount: '300,000',
    paymentAmount: '320,000',
    taxCategory: '2:課税8%',
    wholesaleBillName: 'サンプリング費用',
    planExpenseContent: '季節キャンペーンの試飲販促',
    managementCategory: '760:オペ協力金',
    managementCode: '10020:支社',
    measureCategory: '02:支社拡売費',
    measureCode: '004:季節キャンペーン',
    approvalNumber: 'RG2025-0018',
    approvalDate: '2025/05/12',
    note1: '社内：季節施策',
    note2: '社外：試飲販促費',
    accountAmount: '320,000',
    differenceReason: '計画より販促規模を拡大したため',
    invoiceNumber: 'INV-0002',
    invoicePage: '①03',
  },
];

// 明細操作ペインのモード
type PaneMode = 'add' | 'update' | 'copy' | null;

// インライン編集セルの背景色は共通配色 GRID_COLORS に集約（hex 直書きしない・02 §10.1）
const EDITABLE_CELL_BG = GRID_COLORS.editable; // 編集可：白
const NON_EDITABLE_CELL_BG = GRID_COLORS.readonly; // 編集不可：灰（#e8e8e8・全画面共通）

// 販売計画選択ボタンのセルレンダラー（コンソール出力）
const PlanSelectButtonCellRenderer = (props: ICellRendererParams) => {
  if (!props.data) return null;
  const { onSelectPlan } = props.context;
  return (
    <div className="flex items-center justify-center h-full">
      <button
        className="px-3 py-1 rounded-full bg-white text-blue-600 border-2 border-blue-600 font-medium hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm whitespace-nowrap"
        onClick={() => onSelectPlan(props.data)}
        aria-label="販売計画選択"
      >
        選択
      </button>
    </div>
  );
};

// 費用分割ボタンのセルレンダラー（コンソール出力）
const CostSplitButtonCellRenderer = (props: ICellRendererParams) => {
  if (!props.data) return null;
  const { onSplitCost } = props.context;
  return (
    <div className="flex items-center justify-center h-full">
      <button
        className="px-3 py-1 rounded-full bg-white text-blue-600 border-2 border-blue-600 font-medium hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm whitespace-nowrap"
        onClick={() => onSplitCost(props.data)}
        aria-label="費用分割"
      >
        分割
      </button>
    </div>
  );
};

// 行アクション（編集・コピー・削除）のレンダラー
const ActionsCellRenderer = (props: ICellRendererParams) => {
  if (!props.data) return null;
  const { onEditRow, onCopyRow, onDeleteRow } = props.context;
  return (
    <div className="flex items-center justify-center gap-1 h-full">
      <button
        onClick={() => onEditRow(props.data)}
        className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
        aria-label="編集"
        title="編集"
      >
        <SquarePen className="w-4 h-4" />
      </button>
      <button
        onClick={() => onCopyRow(props.data)}
        className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors focus:ring-2 focus:ring-green-500 focus:outline-none"
        aria-label="コピー"
        title="コピー"
      >
        <Copy className="w-4 h-4" />
      </button>
      <button
        onClick={() => onDeleteRow(props.data)}
        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none"
        aria-label="削除"
        title="削除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

export default function PaymentDetailOther() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // フォーム状態管理（ヘッダーエリア：支払申請承認画面と同一項目）
  const [invoiceCount, setInvoiceCount] = useState('1');
  const [paymentDestination, setPaymentDestination] =
    useState('1001584:AAA営業本部商品部');
  const [note, setNote] = useState('');

  // ヘッダーの折り畳み状態（基本情報／支払明細情報。既定は展開）
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(true);
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(true);

  // コメント入力（差戻し理由など。フッター・支払申請承認を参考）
  const [commentInput, setCommentInput] = useState('');
  // コメント履歴（支払申請承認と同じ表示・共通 RightPane）
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [commentHistory] = useState([
    {
      action: '承認',
      date: '2025/02/21 12:47:05',
      user: '◇山　〇郎',
      text: '',
    },
    {
      action: '申請',
      date: '2025/02/21 9:30:45',
      user: '河〇　雅◇',
      text: '経費負担部署を修正しました',
    },
    {
      action: '保存',
      date: '2025/02/21 9:20:45',
      user: '河〇　雅◇',
      text: '',
    },
    {
      action: '差戻し',
      date: '2025/02/20 18:47:05',
      user: '◇山　〇郎',
      text: '経費負担部署に間違いが無いか確認すること',
    },
    {
      action: '申請',
      date: '2025/02/21 10:30:15',
      user: '河〇　雅◇',
      text: '承認お願いします',
    },
  ]);

  // 拡売費支払予定日
  const [paymentScheduleDate, setPaymentScheduleDate] = useState<Date>(
    new Date(2025, 4, 31)
  );
  const [paymentScheduleDateInput, setPaymentScheduleDateInput] = useState(
    format(new Date(2025, 4, 31), 'yyyy/MM/dd')
  );
  const [isPaymentDateOpen, setIsPaymentDateOpen] = useState(false);

  // 発生日
  const [occurrenceDate, setOccurrenceDate] = useState<Date>(
    new Date(2025, 4, 15)
  );
  const [occurrenceDateInput, setOccurrenceDateInput] = useState(
    format(new Date(2025, 4, 15), 'yyyy/MM/dd')
  );
  const [isOccurrenceDateOpen, setIsOccurrenceDateOpen] = useState(false);

  // 戻る確認ダイアログ
  const [isBackDialogOpen, setIsBackDialogOpen] = useState(false);
  // 支払確認ダイアログ
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  // 日付文字列をパースする
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const formats = ['yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy/M/d'];
    for (const fmt of formats) {
      try {
        const parsed = parse(dateStr, fmt, new Date());
        if (!isNaN(parsed.getTime())) return parsed;
      } catch {
        // 次のフォーマットを試行
      }
    }
    return null;
  };

  const handlePaymentDateSelect = (date: Date | undefined) => {
    if (date) {
      setPaymentScheduleDate(date);
      setPaymentScheduleDateInput(format(date, 'yyyy/MM/dd', { locale: ja }));
      setIsPaymentDateOpen(false);
    }
  };

  const handlePaymentDateInputChange = (value: string) => {
    setPaymentScheduleDateInput(value);
    const parsed = parseDate(value);
    if (parsed) setPaymentScheduleDate(parsed);
  };

  const handleOccurrenceDateSelect = (date: Date | undefined) => {
    if (date) {
      setOccurrenceDate(date);
      setOccurrenceDateInput(format(date, 'yyyy/MM/dd', { locale: ja }));
      setIsOccurrenceDateOpen(false);
    }
  };

  const handleOccurrenceDateInputChange = (value: string) => {
    setOccurrenceDateInput(value);
    const parsed = parseDate(value);
    if (parsed) setOccurrenceDate(parsed);
  };

  // 保存
  const handleSave = () => {
    // TODO: 拡売費支払データの保存処理（API連携・未実装）
    toast.success('保存が完了しました。');
  };

  // 戻る確定 → 支払申請一覧参照画面へ遷移
  const handleBackConfirm = () => {
    setIsBackDialogOpen(false);
    navigate('payment-list');
  };

  // 支払確認ダイアログの確定
  const handleConfirmAction = () => {
    if (!confirmAction) return;
    const { toast: toastMessage } = CONFIRM_MESSAGE_MAP[confirmAction];
    // TODO: 拡売費支払データの申請/承認/差戻し処理（API連携・未実装）
    toast.success(toastMessage);
    setConfirmAction(null);
  };

  // ヘッダー項目（テキストラベル）の共通描画
  const renderLabelField = (label: string, value: string) => (
    <div className="flex items-center gap-2">
      <label className={SEARCH_LABEL_CLASS}>{label}</label>
      <span className="h-8 flex items-center text-sm text-gray-900">
        {value}
      </span>
    </div>
  );

  // ===== 拡売費明細 =====
  // 合計計算・保存用の明細データ（全変更＝セル編集も構造変更も反映）。
  const [expenseData, setExpenseData] =
    useState<ExpansionExpenseData[]>(INITIAL_DATA);
  // グリッド表示用の行データ（構造変更＝行の増減・ペイン更新でのみ差し替える）。
  const [gridRowData, setGridRowData] =
    useState<ExpansionExpenseData[]>(INITIAL_DATA);

  // 拡売費明細グリッドのAPI参照
  const gridRef = useRef<AgGridReact>(null);

  // コピー・追加で増えた行を見つけやすくする（行全体をフラッシュし可視域へ送る）。
  // 追加処理が親側にあり markRows を差し込めないため、行数の増加から自動検出する。
  const reveal = useRevealNewRows({ autoDetect: true });

  // 画面初期表示時、先頭の入力項目（支払回数）へフォーカスを当てる。
  // 支払回数は SingleCombobox（id はトリガーのボタンに付く）のため、付与済みの id で取得して focus する。
  // 描画確定後に実行するため requestAnimationFrame で1フレーム遅延する。
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.getElementById('invoice-count')?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // 明細操作ペイン（サイドシート）の状態
  const [paneMode, setPaneMode] = useState<PaneMode>(null);
  const [formData, setFormData] = useState<Partial<ExpansionExpenseData>>({});

  // 削除確認ダイアログの状態
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpansionExpenseData | null>(
    null
  );

  // 支払明細に紐づける計画明細 選択エリア（下ペイン）の表示状態
  const [showPlanSelectionPane, setShowPlanSelectionPane] = useState(false);

  // 新規IDを採番する
  const generateId = useCallback(
    () =>
      (
        expenseData.reduce(
          (max, item) => Math.max(max, Number(item.id) || 0),
          0
        ) + 1
      ).toString(),
    [expenseData]
  );

  // 空のフォームを生成する
  const createEmptyForm = useCallback(
    (): Partial<ExpansionExpenseData> => ({
      product: '',
      planAmount: '',
      paymentAmount: '',
      taxCategory: '1:課税10%',
      wholesaleBillName: '',
      planExpenseContent: '',
      managementCategory: '',
      managementCode: '',
      measureCategory: '',
      measureCode: '',
      approvalNumber: '',
      approvalDate: '',
      note1: '',
      note2: '',
      accountAmount: '',
      differenceReason: '',
      invoiceNumber: '',
      invoicePage: '',
    }),
    []
  );

  // ペインを閉じる
  const closePane = useCallback(() => {
    setPaneMode(null);
    setFormData({});
  }, []);

  // 明細追加ボタン
  const handleAddClick = useCallback(() => {
    setFormData(createEmptyForm());
    setPaneMode('add');
  }, [createEmptyForm]);

  // 添付資料登録ボタン
  const handleRegisterAttachment = useCallback(() => {
    // TODO: 添付資料登録画面を表示する（未実装）
  }, []);

  // 明細編集（行アクション）
  const handleEditRow = useCallback((row: ExpansionExpenseData) => {
    setFormData({ ...row });
    setPaneMode('update');
  }, []);

  // 明細コピー（行アクション）
  const handleCopyRow = useCallback((row: ExpansionExpenseData) => {
    setFormData({ ...row });
    setPaneMode('copy');
  }, []);

  // 明細削除（行アクション）
  const handleDeleteRow = useCallback((row: ExpansionExpenseData) => {
    setDeleteTarget(row);
    setIsDeleteDialogOpen(true);
  }, []);

  // 販売計画選択（グリッド内セル）。
  // C追加口・拡売費と同じ「支払明細に紐づける計画明細 選択エリア」（下ペイン）を表示する。
  const handleSelectPlan = useCallback((_row: ExpansionExpenseData) => {
    // TODO: 紐づけ対象の支払明細(_row)を使った計画明細選択処理（未実装）
    setShowPlanSelectionPane(true);
  }, []);

  // 費用分割（グリッド内セル）
  const handleSplitCost = useCallback((_row: ExpansionExpenseData) => {
    // TODO: 費用分割画面を表示する（_row 対象・未実装）
  }, []);

  // フォーム項目の変更
  const handleFieldChange = useCallback(
    (field: keyof ExpansionExpenseData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // ペインの保存処理
  const handlePaneSubmit = useCallback(() => {
    if (paneMode === 'add' || paneMode === 'copy') {
      // 追加は拡売費明細の最下行、コピーはコピー元の行（formData.id）のすぐ下に入れる（→ 02 §8「行の追加位置」・UX-112）
      const newItem: ExpansionExpenseData = {
        ...createEmptyForm(),
        ...formData,
        id: generateId(),
      } as ExpansionExpenseData;
      // 構造変更なのでグリッド行データも差し替える（最新の expenseData を基点にして
      // セル編集値も引き継ぐ）。
      const sourceId = paneMode === 'copy' ? formData.id : undefined;
      const next = insertRowsAfter(
        expenseData,
        [newItem],
        sourceId == null ? undefined : (r) => r.id === sourceId
      );
      setExpenseData(next);
      setGridRowData(next);
      toast.success(
        paneMode === 'add' ? '明細を追加しました。' : '明細をコピーしました。'
      );
    } else if (paneMode === 'update') {
      // 更新は対象明細を更新する
      const next = expenseData.map((item) =>
        item.id === formData.id
          ? ({ ...item, ...formData } as ExpansionExpenseData)
          : item
      );
      setExpenseData(next);
      setGridRowData(next);
      toast.success('明細を更新しました。');
    }
    closePane();
  }, [paneMode, formData, expenseData, createEmptyForm, generateId, closePane]);

  // 連続追加：明細を追加した後もペインを閉じず、フォームを初期化して次の入力に備える
  const handleContinuousAdd = useCallback(() => {
    const newItem: ExpansionExpenseData = {
      ...createEmptyForm(),
      ...formData,
      id: generateId(),
    } as ExpansionExpenseData;
    // 構造変更なのでグリッド行データも差し替える。
    // 明細の最下行に追加する（→ 02 §8「行の追加位置」・UX-112）
    const next = [...expenseData, newItem];
    setExpenseData(next);
    setGridRowData(next);
    toast.success('明細を追加しました。続けて入力できます。');
    setFormData(createEmptyForm());
  }, [formData, expenseData, createEmptyForm, generateId]);

  // 削除の確定
  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    // 構造変更なのでグリッド行データも差し替える。
    const next = expenseData.filter((item) => item.id !== deleteTarget.id);
    setExpenseData(next);
    setGridRowData(next);
    setIsDeleteDialogOpen(false);
    setDeleteTarget(null);
    toast.success('明細を削除しました。');
  }, [deleteTarget, expenseData]);

  // インライン編集で変更されたセルを明細データに反映する
  const handleCellValueChanged = useCallback(
    (params: CellValueChangedEvent) => {
      setExpenseData((prev) =>
        prev.map((item) =>
          item.id === params.data.id
            ? ({ ...item, ...params.data } as ExpansionExpenseData)
            : item
        )
      );
    },
    []
  );

  // 拡売費明細グリッドの列定義
  const columnDefs: ColDef[] = useMemo(
    () => [
      // 販売計画選択（選択ボタン・コンソール出力）
      {
        headerName: '販売計画選択',
        field: 'planSelect',
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: PlanSelectButtonCellRenderer,
        // 中央寄せはレンダラー側（flex items-center justify-center h-full）で行う
        // （02 §7：セルに display:flex 禁止）
      },
      // 商品（読み取り専用）
      {
        headerName: '商品',
        field: 'product',
        editable: false,
        cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
      },
      // 計画金額（読み取り専用）
      {
        headerName: '計画金額',
        field: 'planAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        editable: false,
        cellClass: 'cell-right',
        cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
      },
      // 支払金額（テキストボックス）
      {
        headerName: '支払金額',
        field: 'paymentAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellClass: 'cell-right',
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 税区分（支払申請承認画面と同じ）
      {
        headerName: '税区分',
        field: 'taxCategory',
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: TAX_CATEGORY_OPTIONS },
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 卸からの請求名称（テキストボックス）
      {
        headerName: '卸からの請求名称',
        field: 'wholesaleBillName',
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 販売計画に記載の拡売費内容（読み取り専用）
      {
        headerName: '販売計画に記載の拡売費内容',
        field: 'planExpenseContent',
        editable: false,
        cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
      },
      // 分割（選択ボタン・コンソール出力）
      {
        headerName: '分割',
        field: 'costSplit',
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: CostSplitButtonCellRenderer,
        // 中央寄せはレンダラー側（flex items-center justify-center h-full）で行う
        // （02 §7：セルに display:flex 禁止）
      },
      // 管理区分（"コード:名称" をコード列／名称列の2列に分割。支払申請承認画面と同じ）
      {
        headerName: '管理区分',
        colId: 'managementCategoryCode',
        field: 'managementCategory',
        valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: { comboOptions: MANAGEMENT_CATEGORY_COMBO_OPTIONS },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        // 名称列もコンボボックスで編集可能。コード列と同じ field を参照するため、
        // どちらを編集しても managementCategory が更新され区分／名称が同期する。
        headerName: '管理区分名称',
        colId: 'managementCategoryName',
        field: 'managementCategory',
        valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: { comboOptions: MANAGEMENT_CATEGORY_COMBO_OPTIONS },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 管理コード（支払申請承認画面と同じ）
      {
        headerName: '管理コード',
        colId: 'managementCodeCode',
        field: 'managementCode',
        valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: { comboOptions: MANAGEMENT_CODE_COMBO_OPTIONS },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        // 名称列もコンボボックスで編集可能。コード列と同じ field を参照するため同期する。
        headerName: '管理コード名称',
        colId: 'managementCodeName',
        field: 'managementCode',
        valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: { comboOptions: MANAGEMENT_CODE_COMBO_OPTIONS },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 施策区分（支払申請承認画面と同じ）
      {
        headerName: '施策区分',
        colId: 'measureCategoryCode',
        field: 'measureCategory',
        valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: {
          comboOptions: MEASURE_CATEGORY_COMBO_OPTIONS,
          clearable: true,
        },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        // 名称列もコンボボックスで編集可能。コード列と同じ field を参照するため同期する。
        headerName: '施策区分名称',
        colId: 'measureCategoryName',
        field: 'measureCategory',
        valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: {
          comboOptions: MEASURE_CATEGORY_COMBO_OPTIONS,
          clearable: true,
        },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 施策コード（支払申請承認画面と同じ）
      {
        headerName: '施策コード',
        colId: 'measureCodeCode',
        field: 'measureCode',
        valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: {
          comboOptions: MEASURE_CODE_COMBO_OPTIONS,
          clearable: true,
        },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      {
        // 名称列もコンボボックスで編集可能。コード列と同じ field を参照するため同期する。
        headerName: '施策コード名称',
        colId: 'measureCodeName',
        field: 'measureCode',
        valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
        editable: true,
        cellEditor: ComboCellEditor,
        cellEditorParams: {
          comboOptions: MEASURE_CODE_COMBO_OPTIONS,
          clearable: true,
        },
        cellEditorPopup: true,
        suppressKeyboardEvent: suppressEditNavKeys,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 稟議決裁番号（テキストボックス）
      {
        headerName: '稟議決裁番号',
        field: 'approvalNumber',
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 稟議決裁日（カレンダー年月日入力・C追加口/拡売費と同じ部品）
      {
        headerName: '稟議決裁日',
        field: 'approvalDate',
        editable: true,
        cellEditor: DateMonthYearCellEditor,
        cellEditorPopup: true,
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 摘要1（社内用）（テキストボックス）
      {
        headerName: '摘要1（社内用）',
        field: 'note1',
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 摘要2（社外用）（テキストボックス）
      {
        headerName: '摘要2（社外用）',
        field: 'note2',
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 勘定科目別金額（テキストボックス）
      {
        headerName: '勘定科目別金額',
        field: 'accountAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellClass: 'cell-right',
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 税額は支払画面に表示しない（税抜のみを扱う → 20260710_第16回 決定事項12）。
      // 計画差異（読み取り専用・支払金額−計画金額）
      {
        headerName: '計画差異',
        field: 'planDifference',
        ...GRID_NUMBER_TEXT_FILTER,
        editable: false,
        valueGetter: (params) =>
          params.data
            ? formatNumber(
                calcPlanDifference(
                  params.data.paymentAmount,
                  params.data.planAmount
                )
              )
            : '',
        cellClass: 'cell-right',
        cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
      },
      // 差異理由（テキストボックス）
      {
        headerName: '差異理由',
        field: 'differenceReason',
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 請求書番号（テキストボックス）
      {
        headerName: '請求書番号',
        field: 'invoiceNumber',
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 請求書ページ（テキストボックス・①02など）
      {
        headerName: '請求書ページ',
        field: 'invoicePage',
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellStyle: { backgroundColor: EDITABLE_CELL_BG },
      },
      // 行アクション（編集・コピー・削除）
      {
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        field: 'actions',
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        resizable: false,
        editable: false,
        cellRenderer: ActionsCellRenderer,
        // 中央寄せはレンダラー側（flex items-center justify-center h-full）で行う
        // （02 §7：セルに display:flex 禁止）
      },
    ],
    []
  );

  // 拡売費明細グリッドの列状態（列幅・並び順・ソート）の保存／復元（共通フック）。
  // 列は明示幅を持たず、保存済み状態が無い初回は内容フィット（autoSize 既定 true）で自動調整する。
  // ※ 保存済み列幅をリセットして自動調整を有効化するため key を v2 に更新。
  const expenseGridColumnStateProps = useGridColumnState(
    'expansionPayment.expenseDetail.columnState.v4'
  );

  // 合計金額サマリーバー（支払申請承認画面と同じ・経費項目別合計値とは別）。
  // 支払画面は税抜のみを扱うため、税抜合計と税率別の税抜内訳だけを集計する
  // （消費税額・税込合計は表示しない → 20260710_第16回 決定事項12）。
  const totalSummary = useMemo(() => {
    // 計画金額の合計
    const planAmount = expenseData.reduce(
      (sum, item) => sum + parseNumber(item.planAmount),
      0
    );
    // 税抜合計（支払金額の合計）
    const exclTax = expenseData.reduce(
      (sum, item) => sum + parseNumber(item.paymentAmount),
      0
    );
    // 税率別の税抜内訳。税率は TAX_RATE_NUM_BY_CATEGORY を単一ソースとし、
    // 8%・10%を固定で持たず、税率マスタに定義された課税区分をそのまま並べる。
    const byRate = TAXABLE_CATEGORIES.map((category) => ({
      label: `${formatTaxRateLabel(TAX_RATE_NUM_BY_CATEGORY[category])}税抜対象`,
      value: formatNumber(
        expenseData
          .filter((item) => item.taxCategory === category)
          .reduce((sum, item) => sum + parseNumber(item.paymentAmount), 0)
      ),
    }));

    return {
      planAmount: formatNumber(planAmount),
      exclTax: formatNumber(exclTax),
      byRate,
    };
  }, [expenseData]);

  // サマリーバーの表示項目（計画合計金額・支払合計金額を強調し、税率別の税抜内訳を並べる）
  const summaryItems = useMemo(
    () => [
      {
        label: '計画合計金額',
        value: totalSummary.planAmount,
        emphasize: true,
      },
      {
        label: '支払合計金額',
        value: totalSummary.exclTax,
        emphasize: true,
      },
      ...totalSummary.byRate.map((item) => ({ ...item, emphasize: false })),
    ],
    [totalSummary]
  );

  // ヘッダーが省略表示された場合にマウスオーバーで全文表示するため、
  // 各列に headerTooltip（=headerName）を付与する（共通ヘルパー・grid/）
  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(columnDefs),
    [columnDefs]
  );

  // ペインのタイトル
  const paneTitle = useMemo(() => {
    switch (paneMode) {
      case 'add':
        return '明細追加';
      case 'update':
        return '明細更新';
      case 'copy':
        return '明細コピー';
      default:
        return '';
    }
  }, [paneMode]);

  return (
    <div className="min-w-[75rem]">
      <div className="px-6 pt-3 pb-0">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="支払詳細(その他)" />

        {/* 基本情報エリア（支払申請承認画面と同じ折り畳みカード） */}
        <CollapsibleCard
          title="基本情報"
          open={isBasicInfoOpen}
          onOpenChange={setIsBasicInfoOpen}
        >
          <div className="p-4">
            {/* 1行目: 対象年月 / 販売計画書No */}
            <div
              className={`${SEARCH_GRID_CLASS} mb-2.5 items-center pb-2.5 border-b border-gray-300`}
            >
              {renderLabelField('対象年月', '2025年5月')}
              {renderLabelField('販売計画書No', 'D2420TK08')}
              <div className="col-span-2" />
            </div>

            {/* 計上年月 / 支払明細書No */}
            <div
              className={`${SEARCH_GRID_CLASS} mb-2.5 pb-2.5 border-b border-gray-300`}
            >
              {renderLabelField('計上年月', '2025年6月')}
              {renderLabelField('支払明細書No', 'C2400NTO2')}
              <div className="col-span-2" />
            </div>

            {/* 販売店 / 三次店 / 一次店 */}
            <div
              className={`${SEARCH_GRID_CLASS} mb-2.5 pb-2.5 border-b border-gray-300`}
            >
              {renderLabelField('販売店', '21100677:XXX九州')}
              {renderLabelField('三次店', '10863223:YYY九州')}
              {renderLabelField('一次店', '10888030:ZZZ九州支店')}
              <div />
            </div>

            {/* 事業場 / 部署 / 営業担当者（基本情報の最終行・下ボーダーなし） */}
            <div className={`${SEARCH_GRID_CLASS} mb-2`}>
              {renderLabelField('事業場', '10000623:首都圏支社')}
              {renderLabelField('部署', '10002990:首都圏営業二部')}
              {renderLabelField('営業担当者', '5172733:アサヒ太郎')}
              <div />
            </div>
          </div>
        </CollapsibleCard>

        {/* 支払明細情報エリア（支払申請承認画面と同じ折り畳みカード） */}
        <CollapsibleCard
          title="支払明細情報"
          open={isPaymentDetailOpen}
          onOpenChange={setIsPaymentDetailOpen}
        >
          <div className="p-4">
            {/* 1行目: 支払回数 / 支払先 */}
            <div className="grid grid-cols-4 gap-3 mb-2.5 pb-2.5 border-b border-gray-300">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="invoice-count"
                  className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right"
                >
                  支払回数
                </label>
                <SingleCombobox
                  id="invoice-count"
                  className="w-20"
                  options={[
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                  ]}
                  value={invoiceCount}
                  onChange={setInvoiceCount}
                  placeholder="選択"
                  searchable={false}
                />
              </div>
              {/* 支払先（単一選択・コード/名称で検索・2列分結合） */}
              <div className="flex items-center gap-2 col-span-2">
                <label
                  htmlFor="payment-destination"
                  className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right"
                >
                  支払先
                  <RequiredBadge />
                </label>
                <div className="w-64">
                  <SingleCombobox
                    id="payment-destination"
                    ariaRequired
                    options={PAYMENT_DESTINATION_PANE_OPTIONS}
                    value={paymentDestination}
                    onChange={setPaymentDestination}
                    placeholder="コード または 名称で検索..."
                  />
                </div>
              </div>
              <div />
            </div>

            {/* 2行目: 発生日 / 拡売費支払予定日 / ステータス */}
            <div className="grid grid-cols-4 gap-3 mb-2.5 pb-2.5 border-b border-gray-300">
              {/* 発生日（カレンダー付） */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="occurrence-date"
                  className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right"
                >
                  発生日
                  <RequiredBadge />
                </label>
                <div className="w-[9.375rem] relative">
                  <Input
                    id="occurrence-date"
                    aria-required="true"
                    className={`${TEXT_INPUT_CLASS} text-gray-900 pr-9 w-full`}
                    value={occurrenceDateInput}
                    onChange={(e) =>
                      handleOccurrenceDateInputChange(e.target.value)
                    }
                    placeholder="yyyy/MM/dd"
                  />
                  <Popover
                    open={isOccurrenceDateOpen}
                    onOpenChange={setIsOccurrenceDateOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                        aria-label="発生日カレンダーを開く"
                        title="カレンダーを開く"
                        onClick={() =>
                          setIsOccurrenceDateOpen(!isOccurrenceDateOpen)
                        }
                      >
                        <CalendarIcon className="h-4 w-4 text-gray-500" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={occurrenceDate}
                        onSelect={handleOccurrenceDateSelect}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* 拡売費支払予定日（カレンダー付） */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="payment-schedule-date"
                  className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 flex items-center justify-end shrink-0"
                >
                  拡売費支払予定日
                  <RequiredBadge />
                </label>
                <div className="w-[9.375rem] relative">
                  <Input
                    id="payment-schedule-date"
                    aria-required="true"
                    className={`${TEXT_INPUT_CLASS} text-gray-900 pr-9 w-full`}
                    value={paymentScheduleDateInput}
                    onChange={(e) =>
                      handlePaymentDateInputChange(e.target.value)
                    }
                    placeholder="yyyy/MM/dd"
                  />
                  <Popover
                    open={isPaymentDateOpen}
                    onOpenChange={setIsPaymentDateOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                        aria-label="拡売費支払予定日カレンダーを開く"
                        title="カレンダーを開く"
                        onClick={() => setIsPaymentDateOpen(!isPaymentDateOpen)}
                      >
                        <CalendarIcon className="h-4 w-4 text-gray-500" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={paymentScheduleDate}
                        onSelect={handlePaymentDateSelect}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* ステータス（コメント履歴はフッターのコメント欄の「履歴」から開く。UI/UX UX-107） */}
              <div className="flex items-center gap-2 col-span-2">
                <label className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right">
                  ステータス
                </label>
                <span className="h-8 flex items-center text-sm text-gray-900">
                  登録（担当者承認待ち）
                </span>
              </div>
            </div>

            {/* 備考 */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="note"
                className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right"
              >
                備考
              </label>
              <Input
                id="note"
                className={`${TEXT_INPUT_CLASS} flex-1 text-gray-900`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </CollapsibleCard>
      </div>

      {/* 拡売費グリッド（合計金額グリッド＋拡売費明細グリッド） */}
      <div className="w-full px-6 pt-0 pb-2">
        {/* グローバルCSSの「先頭列を中央寄せ」を本画面のデータ先頭列では左寄せに上書きする */}
        <style>{`
          .expansion-detail-grid .ag-cell[aria-colindex="1"] {
            justify-content: flex-start;
            padding-left: var(--ag-cell-horizontal-padding);
            padding-right: var(--ag-cell-horizontal-padding);
          }
          .expansion-detail-grid .ag-cell[aria-colindex="1"] > * {
            justify-content: flex-start;
          }
          /* ホバーは共通（grid.css）の上下の青い線と左端の青い帯。セルの背景（白・灰）は変えない（UX-117） */
        `}</style>

        {/* 拡売費明細グリッドエリア */}
        <div className={`${CARD_CLASS} overflow-hidden`}>
          {/* 合計金額サマリーバー（支払申請承認画面と同じ）＋明細操作（添付資料登録・明細追加） */}
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <div className="flex w-[70%] items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
              <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                合計金額
              </span>
              <div className="flex flex-1 items-stretch divide-x divide-gray-200">
                {summaryItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-1 flex-col items-end px-3 min-w-0"
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

            {/* 添付資料登録＋明細追加（右端・グリッド寄せで下揃え） */}
            <div className="ml-auto self-end flex items-center gap-2">
              <button
                className="btn-toolbar-outline"
                onClick={handleRegisterAttachment}
                aria-label="添付資料登録"
              >
                <Upload className="h-4 w-4" />
                添付資料登録
              </button>
              <button
                className="btn-toolbar-outline"
                onClick={handleAddClick}
                aria-label="＋明細追加"
              >
                ＋明細追加
              </button>
            </div>
          </div>

          <div
            className="expansion-detail-grid w-full px-3 pb-3 pt-0"
            style={{ height: viewportGridHeight(8), minHeight: '25rem' }}
          >
            <AgGridReact
              onRowDataUpdated={reveal.onRowDataUpdated}
              ref={gridRef}
              rowData={gridRowData}
              columnDefs={columnDefsWithTooltip}
              defaultColDef={GRID_DEFAULT_COL_DEF}
              // 行番号列を左端に表示（AG Grid公式 Row Numbers 機能）
              rowNumbers={true}
              getContextMenuItems={gridFilterContextMenuItems}
              getRowId={(params) => params.data.id}
              onCellValueChanged={handleCellValueChanged}
              // 稟議決裁日のカレンダー（DateMonthYearCellEditor＝ポータル描画）は、
              // セル外クリック扱いで選択前に編集確定されるため stopEditingWhenCellsLoseFocus は
              // 付けない（C追加口・拡売費と同条件）。確定はエディタ側の onValueChange/stopEditing で行う。
              statusBar={GRID_STATUS_BAR}
              // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
              {...expenseGridColumnStateProps}
              // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
              {...GRID_BASE_PROPS}
              context={{
                onSelectPlan: handleSelectPlan,
                onSplitCost: handleSplitCost,
                onEditRow: handleEditRow,
                onCopyRow: handleCopyRow,
                onDeleteRow: handleDeleteRow,
              }}
            />
          </div>
        </div>

        {/* 明細操作ペイン（右スライドペイン・共通 RightPane） */}
        <RightPane
          open={paneMode !== null}
          onClose={closePane}
          title={paneTitle}
          description="拡売費明細項目を入力してください。"
          initialWidth={32}
          minWidth={20}
          maxWidth={48}
          footer={
            <div className="flex gap-3">
              {/* 連続追加：明細追加時のみ表示。押下してもペインは閉じず続けて入力できる */}
              {paneMode === 'add' && (
                <Button
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 py-5 rounded-lg"
                  onClick={handleContinuousAdd}
                >
                  連続追加
                </Button>
              )}
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white py-5 rounded-lg"
                onClick={handlePaneSubmit}
              >
                {paneMode === 'update'
                  ? '更新'
                  : paneMode === 'copy'
                    ? 'コピー'
                    : '追加'}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            {/* 入力項目グリッド：ペイン幅に応じて 1→2→3 カラムへ段組み（コンテナクエリ） */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
              {/* 支払金額 */}
              <div className="space-y-2">
                <Label htmlFor="pane-payment-amount">
                  支払金額
                  <RequiredBadge />
                </Label>
                <Input
                  id="pane-payment-amount"
                  aria-required="true"
                  className={`${TEXT_INPUT_CLASS} text-right`}
                  value={formData.paymentAmount || ''}
                  onChange={(e) =>
                    handleFieldChange('paymentAmount', e.target.value)
                  }
                />
              </div>

              {/* 税区分 */}
              <div className="space-y-2">
                <Label htmlFor="pane-tax-category">
                  税区分
                  <RequiredBadge />
                </Label>
                <SingleCombobox
                  id="pane-tax-category"
                  ariaRequired
                  options={[
                    ...TAX_CATEGORY_OPTIONS.map((opt) => ({
                      value: opt,
                      label: opt,
                    })),
                  ]}
                  value={formData.taxCategory || '1:課税10%'}
                  onChange={(v) => handleFieldChange('taxCategory', v)}
                  placeholder="選択してください"
                  searchable={false}
                />
              </div>

              {/* 卸からの請求名称 */}
              <div className="space-y-2 @md:col-span-2 @2xl:col-span-3">
                <Label htmlFor="pane-wholesale-bill-name">
                  卸からの請求名称
                </Label>
                <Input
                  id="pane-wholesale-bill-name"
                  className={TEXT_INPUT_CLASS}
                  value={formData.wholesaleBillName || ''}
                  onChange={(e) =>
                    handleFieldChange('wholesaleBillName', e.target.value)
                  }
                />
              </div>

              {/* 管理区分・管理コード */}
              <div className="space-y-2">
                <Label htmlFor="pane-mgmt-category">管理区分</Label>
                <SingleCombobox
                  id="pane-mgmt-category"
                  options={MANAGEMENT_CATEGORY_PANE_OPTIONS}
                  value={formData.managementCategory || ''}
                  onChange={(v) => handleFieldChange('managementCategory', v)}
                  placeholder="コード または 名称で検索..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pane-mgmt-code">管理コード</Label>
                <SingleCombobox
                  id="pane-mgmt-code"
                  options={MANAGEMENT_CODE_PANE_OPTIONS}
                  value={formData.managementCode || ''}
                  onChange={(v) => handleFieldChange('managementCode', v)}
                  placeholder="コード または 名称で検索..."
                />
              </div>

              {/* 施策区分・施策コード */}
              <div className="space-y-2">
                <Label htmlFor="pane-measure-category">施策区分</Label>
                <SingleCombobox
                  id="pane-measure-category"
                  options={MEASURE_CATEGORY_PANE_OPTIONS}
                  value={formData.measureCategory || ''}
                  onChange={(v) => handleFieldChange('measureCategory', v)}
                  placeholder="コード または 名称で検索..."
                  clearable
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pane-measure-code">施策コード</Label>
                <SingleCombobox
                  id="pane-measure-code"
                  options={MEASURE_CODE_PANE_OPTIONS}
                  value={formData.measureCode || ''}
                  onChange={(v) => handleFieldChange('measureCode', v)}
                  placeholder="コード または 名称で検索..."
                  clearable
                />
              </div>

              {/* 稟議決裁番号・稟議決裁日 */}
              <div className="space-y-2">
                <Label htmlFor="pane-approval-number">稟議決裁番号</Label>
                <Input
                  id="pane-approval-number"
                  className={TEXT_INPUT_CLASS}
                  value={formData.approvalNumber || ''}
                  onChange={(e) =>
                    handleFieldChange('approvalNumber', e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pane-approval-date">稟議決裁日</Label>
                <DateMonthYearPicker
                  className="w-full"
                  value={formData.approvalDate || ''}
                  onChange={(v) => handleFieldChange('approvalDate', v)}
                />
              </div>

              {/* 勘定科目別金額 */}
              <div className="space-y-2">
                <Label htmlFor="pane-account-amount">勘定科目別金額</Label>
                <Input
                  id="pane-account-amount"
                  className={`${TEXT_INPUT_CLASS} text-right`}
                  value={formData.accountAmount || ''}
                  onChange={(e) =>
                    handleFieldChange('accountAmount', e.target.value)
                  }
                />
              </div>

              {/* 計画差異（読み取り専用・自動計算）。税額は支払画面に表示しない */}
              <div className="space-y-2">
                <Label htmlFor="pane-plan-difference">計画差異</Label>
                <Input
                  id="pane-plan-difference"
                  className={`${TEXT_INPUT_CLASS} bg-gray-100 text-right`}
                  value={formatNumber(
                    calcPlanDifference(
                      formData.paymentAmount,
                      formData.planAmount
                    )
                  )}
                  readOnly
                  tabIndex={-1}
                />
              </div>

              {/* 差異理由 */}
              <div className="space-y-2 @md:col-span-2 @2xl:col-span-3">
                <Label htmlFor="pane-difference-reason">差異理由</Label>
                <Input
                  id="pane-difference-reason"
                  className={TEXT_INPUT_CLASS}
                  value={formData.differenceReason || ''}
                  onChange={(e) =>
                    handleFieldChange('differenceReason', e.target.value)
                  }
                />
              </div>

              {/* 摘要１・摘要２ */}
              <div className="space-y-2">
                <Label htmlFor="pane-note1">摘要1（社内用）</Label>
                <Input
                  id="pane-note1"
                  className={TEXT_INPUT_CLASS}
                  value={formData.note1 || ''}
                  onChange={(e) => handleFieldChange('note1', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pane-note2">摘要2（社外用）</Label>
                <Input
                  id="pane-note2"
                  className={TEXT_INPUT_CLASS}
                  value={formData.note2 || ''}
                  onChange={(e) => handleFieldChange('note2', e.target.value)}
                />
              </div>

              {/* 請求書番号・請求書ページ */}
              <div className="space-y-2">
                <Label htmlFor="pane-invoice-number">請求書番号</Label>
                <Input
                  id="pane-invoice-number"
                  className={TEXT_INPUT_CLASS}
                  value={formData.invoiceNumber || ''}
                  onChange={(e) =>
                    handleFieldChange('invoiceNumber', e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pane-invoice-page">請求書ページ</Label>
                <Input
                  id="pane-invoice-page"
                  className={TEXT_INPUT_CLASS}
                  value={formData.invoicePage || ''}
                  onChange={(e) =>
                    handleFieldChange('invoicePage', e.target.value)
                  }
                  placeholder="①02 など"
                />
              </div>
            </div>
          </div>
        </RightPane>

        {/* コメント履歴ペイン（支払申請承認と同一スタイル・共通 RightPane） */}
        <RightPane
          open={commentPanelOpen}
          onClose={() => setCommentPanelOpen(false)}
          title="コメント履歴"
          description=""
        >
          <div className="space-y-3">
            {commentHistory.map((item, idx) => (
              <div
                key={idx}
                className="bg-gray-50 p-4 rounded-lg space-y-2 border border-gray-200"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">{item.action}</span>
                  <span className="text-sm text-gray-600">{item.date}</span>
                  <span className="text-sm text-gray-900">{item.user}</span>
                </div>
                {item.text && (
                  <div className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                    {item.text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </RightPane>

        {/* 明細削除確認ダイアログ */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>明細削除</DialogTitle>
              <DialogDescription>
                選択した明細を削除してもよろしいですか？
              </DialogDescription>
            </DialogHeader>
            {deleteTarget && (
              <div className="py-4">
                <p className="text-sm text-gray-600">
                  <strong>商品:</strong> {deleteTarget.product || '（未設定）'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>支払金額:</strong> {deleteTarget.paymentAmount}
                </p>
              </div>
            )}
            <DialogFooter>
              {/* キャンセルは廃止し、右上×（DialogContent標準）で閉じる操作に統一 */}
              <Button
                variant="destructive"
                className="rounded-lg"
                onClick={handleConfirmDelete}
              >
                削除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 下ペイン：支払明細に紐づける計画明細 選択エリア（C追加口・拡売費と同じ）。
          プッシュ式：親画面に被さらず中身を押し上げるため、選択エリアと拡売費明細を同時に視認できる。 */}
      <BottomPane
        open={showPlanSelectionPane}
        onClose={() => setShowPlanSelectionPane(false)}
        title="支払明細に紐づける計画明細 選択エリア"
        description="支払明細に紐づける計画明細を選択します"
        initialHeight={28}
        minHeight={18}
        maxHeight={48}
      >
        <PaymentPlanSelectionPane
          onSelect={() => {
            // TODO: 選択された計画明細を支払明細に紐づける（未実装）
            setShowPlanSelectionPane(false);
          }}
        />
      </BottomPane>

      {/* フッターエリア（固定・支払申請承認画面と同一項目） */}
      <div
        data-screen-footer
        className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10 mt-4 min-w-[75rem]"
      >
        <div className="flex flex-wrap gap-3 justify-between">
          <div>
            <button
              className="btn-action-base btn-action-outline"
              onClick={() => setIsBackDialogOpen(true)}
              aria-label="一覧へ戻る"
            >
              <ArrowLeft className="h-4 w-4" />
              一覧へ戻る
            </button>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
            {/* コメント欄（差戻しボタンの左・支払申請承認を参考） */}
            <FooterCommentField
              id="expansion-comment"
              value={commentInput}
              onChange={setCommentInput}
              onOpenHistory={() => setCommentPanelOpen(true)}
            />
            <button
              className="btn-action-base btn-action-red"
              onClick={() => setConfirmAction('reject')}
              aria-label="差戻し"
            >
              <Undo2 className="h-4 w-4" />
              差戻し
            </button>
            <button
              className="btn-action-base btn-action-green"
              onClick={() => setConfirmAction('approve')}
              aria-label="承認"
            >
              <Check className="h-4 w-4" />
              承認
            </button>
            <button
              className="btn-action-base btn-action-outline-blue"
              onClick={() => setConfirmAction('withdraw')}
              aria-label="引戻し"
            >
              <CornerUpLeft className="h-4 w-4" />
              引戻し
            </button>
            <button
              className="btn-action-base btn-action-green"
              onClick={() => setConfirmAction('apply')}
              aria-label="申請"
            >
              <Send className="h-4 w-4" />
              申請
            </button>
            <button
              className="btn-action-base btn-action-blue"
              onClick={handleSave}
              aria-label="保存"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 戻る確認ダイアログ */}
      <AlertDialog open={isBackDialogOpen} onOpenChange={setIsBackDialogOpen}>
        <AlertDialogContent>
          {/* ×ボタン（ログアウト確認ダイアログと同一スタイル） */}
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

      {/* 支払確認ダイアログ（申請／引戻し／承認／差戻し共通） */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          {/* ×ボタン（ログアウト確認ダイアログと同一スタイル） */}
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
    </div>
  );
}

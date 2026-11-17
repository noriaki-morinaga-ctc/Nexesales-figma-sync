import { useState, useMemo, useCallback, useRef } from 'react';
import {
  X,
  Send,
  Trash2,
  Check,
  SquarePen,
  Copy,
  FolderSearch,
  Save,
  ChevronDown,
  CornerUpLeft,
  Undo2,
  ReceiptText,
  ArrowLeft,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { CustomCellEditorProps } from 'ag-grid-react';
import {
  ColDef,
  ICellRendererParams,
  SuppressKeyboardEventParams,
} from 'ag-grid-community';
import {
  useGridColumnState,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  withHeaderTooltips,
  gridFilterContextMenuItems,
  useRevealNewRows,
  GRID_NUMBER_TEXT_FILTER,
  GRID_EMPTY_TEXT,
} from '@/app/components/grid';
import { RequiredBadge } from '@/app/components/ui/required-badge';
import {
  SingleCombobox,
  type SingleComboboxOption,
} from '@/app/components/ui/single-combobox';
import { DateMonthYearCellEditor } from '@/app/components/ui/date-month-year-cell-editor';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { TEXT_INPUT_CLASS, CARD_CLASS } from '@/styles/commonStyles';
import { Label } from '@/app/components/ui/label';
import { RightPane } from '@/app/components/ui/right-pane';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/app/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ScreenTitle } from '@/app/components/ui/screen-title';
import { useAppNavigation } from '@/app/components/ui/use-app-navigation';
import { insertRowsAfter } from '@/app/utils/common/addedRowOrder';
import { FooterCommentField } from '@/app/components/shared/common/FooterCommentField';

// 確認ダイアログで扱うアクション種別（支払申請承認に準拠）
type ConfirmAction =
  | 'save'
  | 'apply'
  | 'reject'
  | 'withdrawPlan'
  | 'approve'
  | null;

// ロケ契約料（償却）の1明細を表す型
interface LocationContractItem {
  id: string; // 内部識別子
  managementCategory: string; // 管理区分（"コード:名称"）
  managementCode: string; // 管理コード（"コード:名称"）
  accountItem: string; // 勘定科目
  amount: string; // 金額(円)
  payee: string; // 支払先（"コード:名称"）
  taxCategory: string; // 税区分（1:課税10% など）
  status: string; // ステータス（未申請／申請中／承認待ち／承認済／差戻し など）
  occurrenceDate: string; // 発生日（契約開始日）
  amortizationStart: string; // 償却期間開始
  amortizationEnd: string; // 償却期間終了
  measureCategory: string; // 施策区分（"コード:名称"）
  measureCode: string; // 施策コード（"コード:名称"）
  crmCode: string; // CRMコード
  note1: string; // 摘要1
  note2: string; // 摘要2
  // ===== 分割（分割元／分割先）関連 =====
  splitStatus?: string; // 分割状況（〇 / 分割済 / 空）
  splitRole?: 'source' | 'dest'; // 分割セットでの役割（分割元／分割先）
  splitGroupId?: string; // 同一分割セットを束ねるキー（＝分割元の id）
  splitDestName?: string; // 分割先の計上先（分割先行のみ）
  splitDestDept?: string; // 分割先の費用負担部署（分割先行のみ）
}

// 分割先（分割明細）の行か判定する。分割先は表示のみの非活性行で編集・操作不可。
const isSplitDestRow = (data?: { splitRole?: string }): boolean =>
  data?.splitRole === 'dest';

// 分割済（分割元）の行か判定する。金額は分割先で管理するため分割元の金額は読み取り専用。
const isSplitDoneRow = (data?: { splitStatus?: string }): boolean =>
  data?.splitStatus === '分割済';

// 読み取り専用にする行か（分割先）。
const isReadOnlyRow = (data?: { splitRole?: string }): boolean =>
  isSplitDestRow(data);

// 読み取り専用にすべき行（分割先）を編集不可にする。
// editable: true の列を行単位の判定関数へ置き換える。
const lockReadOnlyRows = (cols: ColDef[]): ColDef[] =>
  cols.map((col) =>
    col.editable === true
      ? { ...col, editable: (params) => !isReadOnlyRow(params.data) }
      : col
  );

// 管理区分は "コード:名称"（例 "601:ロケ契約料他前払い金(償却)"）の1値で保持する。
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

// プルダウン選択肢
const MANAGEMENT_CATEGORY_OPTIONS = [
  '601:ロケ契約料他前払い金(償却)',
  '330:ロケ運転費',
  '760:オペ協力金',
  '662:その他',
];
// 管理コードの選択肢。支払詳細(PaymentDetailVending)の管理コードと揃える。
const MANAGEMENT_CODE_OPTIONS = [
  '10010:本社',
  '10020:支社Ａ　自販機部門',
  '10180:支社Ｂ自販機（共通）',
  '10210:支社Ｂ開発（開拓）',
];
const PAYMENT_DESTINATION_OPTIONS = [
  '1001584:AAA営業本部商品部',
  '1001585:BBB営業本部商品部',
  '1001586:CCC営業本部商品部',
];
// 税区分の選択肢。
const TAX_CATEGORY_OPTIONS = [
  '1:課税10%',
  '2:課税8%',
  '3:その他(5%)',
  '4:その他(非課税)',
];
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
const CRM_CODE_OPTIONS = [
  'CRM001:首都圏キャンペーン',
  'CRM002:新規顧客開拓',
  'CRM003:既存顧客深耕',
  'CRM004:リピート促進',
  'CRM005:エリア限定販促',
];

// 選択肢（グリッド用＝コード/名称2行表示／右ペイン用＝"コード:名称"1行表示）
const MANAGEMENT_CATEGORY_COMBO_OPTIONS =
  MANAGEMENT_CATEGORY_OPTIONS.map(toComboOption);
const MANAGEMENT_CATEGORY_PANE_OPTIONS =
  MANAGEMENT_CATEGORY_OPTIONS.map(toPaneOption);
const MANAGEMENT_CODE_COMBO_OPTIONS =
  MANAGEMENT_CODE_OPTIONS.map(toComboOption);
const MANAGEMENT_CODE_PANE_OPTIONS = MANAGEMENT_CODE_OPTIONS.map(toPaneOption);
const PAYMENT_DESTINATION_COMBO_OPTIONS =
  PAYMENT_DESTINATION_OPTIONS.map(toComboOption);
const PAYMENT_DESTINATION_PANE_OPTIONS =
  PAYMENT_DESTINATION_OPTIONS.map(toPaneOption);
const MEASURE_CATEGORY_COMBO_OPTIONS =
  MEASURE_CATEGORY_OPTIONS.map(toComboOption);
const MEASURE_CATEGORY_PANE_OPTIONS =
  MEASURE_CATEGORY_OPTIONS.map(toPaneOption);
const MEASURE_CODE_COMBO_OPTIONS = MEASURE_CODE_OPTIONS.map(toComboOption);
const MEASURE_CODE_PANE_OPTIONS = MEASURE_CODE_OPTIONS.map(toPaneOption);
const CRM_CODE_COMBO_OPTIONS = CRM_CODE_OPTIONS.map(toComboOption);

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

// AG Grid valueFormatter：金額をカンマ区切り（桁区切り）で表示する（空欄は「-」）。
const formatAmountCell = (params: { value?: unknown }): string => {
  const v = params.value;
  if (v === null || v === undefined || v === '') return GRID_EMPTY_TEXT;
  const num = Number(String(v).replace(/,/g, ''));
  return Number.isNaN(num) ? String(v) : num.toLocaleString();
};

// AG Grid valueFormatter：日付を yyyy/MM/dd 形式にゼロ埋めして表示する（空欄は「-」、不正値はそのまま）。
const formatDateCell = (params: { value?: unknown }): string => {
  const v = params.value;
  if (v === null || v === undefined || v === '') return GRID_EMPTY_TEXT;
  const parts = String(v).split('/');
  if (parts.length !== 3) return String(v);
  const [y, m, d] = parts;
  return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
};

// 初期データ
const INITIAL_DATA: LocationContractItem[] = [
  {
    id: '1',
    managementCategory: '601:ロケ契約料他前払い金(償却)',
    managementCode: '10010:本社',
    accountItem: '前払費用',
    amount: '120,000',
    payee: '1001584:AAA営業本部商品部',
    taxCategory: '1:課税10%',
    status: '未申請',
    occurrenceDate: '2025/7/30',
    amortizationStart: '2025/7/1',
    amortizationEnd: '2028/6/30',
    measureCategory: '01:本社拡売費',
    measureCode: '001:新商品導入施策',
    crmCode: 'CRM001:首都圏キャンペーン',
    note1: '新商品導入に伴うロケ契約料の前払い計上',
    note2: '首都圏エリア重点店舗向け',
  },
  {
    id: '2',
    managementCategory: '601:ロケ契約料他前払い金(償却)',
    managementCode: '10020:支社Ａ　自販機部門',
    accountItem: '支払手数料',
    amount: '98,500',
    payee: '1001585:BBB営業本部商品部',
    taxCategory: '2:課税8%',
    status: '申請中',
    occurrenceDate: '2025/8/15',
    amortizationStart: '2025/8/1',
    amortizationEnd: '2027/7/31',
    measureCategory: '02:支社拡売費',
    measureCode: '002:店頭販促施策',
    crmCode: 'CRM002:新規顧客開拓',
    note1: '店頭販促施策の支社負担分',
    note2: '四半期キャンペーン対応',
  },
  {
    id: '3',
    managementCategory: '601:ロケ契約料他前払い金(償却)',
    managementCode: '10210:支社Ｂ開発（開拓）',
    accountItem: '販売促進費',
    amount: '210,000',
    payee: '1001586:CCC営業本部商品部',
    taxCategory: '1:課税10%',
    status: '承認待ち',
    occurrenceDate: '2025/9/5',
    amortizationStart: '2025/9/1',
    amortizationEnd: '2028/8/31',
    measureCategory: '99:その他',
    measureCode: '003:価格訴求施策',
    crmCode: 'CRM003:既存顧客深耕',
    note1:
      '価格訴求施策に伴う販促費用の長期償却対象。複数店舗での展開を予定しているため摘要が長め。',
    note2: '既存顧客向けの継続的な深耕施策として実施',
  },
  {
    id: '4',
    managementCategory: '601:ロケ契約料他前払い金(償却)',
    managementCode: '10180:支社Ｂ自販機（共通）',
    accountItem: '地代家賃',
    amount: '75,000',
    payee: '1001584:AAA営業本部商品部',
    taxCategory: '3:その他(5%)',
    status: '承認済(契約中)',
    occurrenceDate: '2025/10/10',
    amortizationStart: '2025/10/1',
    amortizationEnd: '2026/9/30',
    measureCategory: '01:本社拡売費',
    measureCode: '004:季節キャンペーン',
    crmCode: 'CRM004:リピート促進',
    note1: '季節キャンペーン用ロケの地代家賃',
    note2: '年末商戦向け短期契約',
  },
  {
    id: '5',
    managementCategory: '601:ロケ契約料他前払い金(償却)',
    managementCode: '10020:支社Ａ　自販機部門',
    accountItem: '前払費用',
    amount: '156,000',
    payee: '1001585:BBB営業本部商品部',
    taxCategory: '4:その他(非課税)',
    status: '差戻し',
    occurrenceDate: '2025/11/20',
    amortizationStart: '2025/11/1',
    amortizationEnd: '2027/10/31',
    measureCategory: '02:支社拡売費',
    measureCode: '005:エリア限定施策',
    crmCode: 'CRM005:エリア限定販促',
    note1: 'エリア限定施策の前払費用',
    note2: '特定地域での限定販促として計上、対象エリアは順次拡大予定',
  },
];

// コメント履歴（販売計画表(マージン率固定・NET入力)を踏襲）
const COMMENT_HISTORY: {
  actionType: string; // 操作種別（保存／申請／承認／取下 など）
  datetime: string; // 操作日時
  userName: string; // 操作者
  comment: string; // コメント本文（空の場合あり）
}[] = [
  {
    actionType: '承認',
    datetime: '2026/06/21 12:47:05',
    userName: '◇山　〇郎',
    comment: '',
  },
  {
    actionType: '申請',
    datetime: '2026/06/21 9:30:45',
    userName: '河〇　雅◇',
    comment: 'ロケ契約料の償却期間を契約書記載のとおり修正のうえ申請します。',
  },
  {
    actionType: '保存',
    datetime: '2026/06/21 9:20:45',
    userName: '河〇　雅◇',
    comment: '施策コードと摘要を最新の販促計画に合わせて更新。',
  },
  {
    actionType: '取下',
    datetime: '2026/06/20 18:47:05',
    userName: '◇山　〇郎',
    comment:
      '償却開始月に誤りがあるため取下げます。再確認のうえ再申請してください。',
  },
];

// 解約ボタン（グリッド内セル）。押下時はグリッドのcontext経由でメッセージを表示する。
const CancellationButtonCellRenderer = (props: ICellRendererParams) => {
  if (!props.data) return null;
  if (isSplitDestRow(props.data)) return null;
  const { onCancellation } = props.context;

  return (
    <div className="flex items-center justify-center h-full">
      <button
        type="button"
        className="px-3 py-1 rounded-full bg-white text-red-600 border-2 border-red-500 font-medium hover:bg-red-50 transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none text-sm whitespace-nowrap"
        onClick={() => onCancellation?.()}
        aria-label="解約"
      >
        解約
      </button>
    </div>
  );
};

// 行アクション（更新・コピー・削除）のレンダラー（支払申請承認に準拠）
const ActionsCellRenderer = (props: ICellRendererParams) => {
  if (!props.data) return null;
  // 分割先の行は更新・コピー・削除ボタンを表示しない
  if (isSplitDestRow(props.data)) return null;
  const { onEditRow, onCopyRow, onDeleteRow } = props.context;

  return (
    <div className="flex items-center justify-center gap-1 h-full">
      <button
        onClick={() => onEditRow(props.data)}
        className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
        aria-label="更新"
        title="更新"
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

// 明細操作ペインのモード
type PaneMode = 'add' | 'update' | 'copy' | 'split' | null;

// インライン編集セルの背景色（支払申請承認に準拠）
const EDITABLE_CELL_BG = '#ffffff'; // 編集可能：白
const NON_EDITABLE_CELL_BG = '#e8e8e8'; // 編集不可：グレー（少し濃いめ）

export default function LocationContractFeeList() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // ヘッダーエリア（基本情報）の折り畳み状態（既定は展開）
  const [isHeaderOpen, setIsHeaderOpen] = useState(true);
  // コメント履歴ペインの表示状態（販売計画表(マージン率固定・NET入力)を踏襲）
  const [showCommentHistoryPane, setShowCommentHistoryPane] = useState(false);

  // 戻る確認ダイアログ
  const [isBackDialogOpen, setIsBackDialogOpen] = useState(false);
  // 申請／引戻し／承認の確認ダイアログ
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  // フッターのコメント入力値（自販機販売計画表のフッターに準拠）
  const [commentInput, setCommentInput] = useState('');

  // ロケ契約明細データ
  const [contractData, setContractData] =
    useState<LocationContractItem[]>(INITIAL_DATA);

  // 明細グリッドのAPI参照
  const gridRef = useRef<any>(null);

  // 明細操作ペイン（サイドシート）の状態
  const [paneMode, setPaneMode] = useState<PaneMode>(null);
  const [formData, setFormData] = useState<Partial<LocationContractItem>>({});
  // 分割ペイン用の入力値（計上先・費用負担部署・分割金額）
  const [splitDest, setSplitDest] = useState('');
  const [splitDept, setSplitDept] = useState('');
  const [splitAmount, setSplitAmount] = useState('');

  // 削除確認ダイアログの状態
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LocationContractItem | null>(
    null
  );

  // 新規IDを採番する
  const generateId = useCallback(
    () =>
      (
        contractData.reduce(
          (max, item) => Math.max(max, Number(item.id) || 0),
          0
        ) + 1
      ).toString(),
    [contractData]
  );

  // 空のフォームを生成する
  const createEmptyForm = useCallback(
    (): Partial<LocationContractItem> => ({
      managementCategory: '601:ロケ契約料他前払い金(償却)',
      managementCode: '',
      accountItem: '',
      amount: '',
      payee: '',
      taxCategory: '1:課税10%',
      status: '未申請',
      occurrenceDate: '',
      amortizationStart: '',
      amortizationEnd: '',
      measureCategory: '',
      measureCode: '',
      crmCode: '',
      note1: '',
      note2: '',
    }),
    []
  );

  // ペインを閉じる
  const closePane = useCallback(() => {
    setPaneMode(null);
    setFormData({});
    setSplitDest('');
    setSplitDept('');
    setSplitAmount('');
  }, []);

  // 明細追加ボタン
  const handleAddClick = useCallback(() => {
    setFormData(createEmptyForm());
    setPaneMode('add');
  }, [createEmptyForm]);

  // 根拠資料格納ボタン
  const handleStoreEvidence = useCallback(() => {
    // TODO: 根拠資料格納画面を表示する（★廃止の画面のため未実装）
  }, []);

  // 明細更新（行アクション）
  const handleEditRow = useCallback((row: LocationContractItem) => {
    setFormData({ ...row });
    setPaneMode('update');
  }, []);

  // 明細コピー（行アクション）
  const handleCopyRow = useCallback((row: LocationContractItem) => {
    setFormData({ ...row });
    setPaneMode('copy');
  }, []);

  // 分割ボタン（グリッド内セル）
  const handleSplitRow = useCallback((row: LocationContractItem) => {
    setFormData({ ...row });
    setSplitDest('');
    setSplitDept('');
    setSplitAmount('');
    setPaneMode('split');
  }, []);

  // 明細削除（行アクション）
  const handleDeleteRow = useCallback((row: LocationContractItem) => {
    setDeleteTarget(row);
    setIsDeleteDialogOpen(true);
  }, []);

  // 解約（グリッド内セル）→ 未償却案件請求一覧（請求画面）へ遷移する
  const handleCancellation = useCallback(() => {
    navigate('unamortized-project-billing-list');
  }, [navigate]);

  // フォーム項目の変更
  const handleFieldChange = useCallback(
    (field: keyof LocationContractItem, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // ペインの保存処理
  const handlePaneSubmit = useCallback(() => {
    if (paneMode === 'add' || paneMode === 'copy') {
      // 追加は明細の最下行、コピーはコピー元の行（formData.id）のすぐ下に入れる（→ 02 §8「行の追加位置」・UX-112）
      const newItem: LocationContractItem = {
        ...createEmptyForm(),
        ...formData,
        id: generateId(),
        splitStatus: '',
      } as LocationContractItem;
      const sourceId = paneMode === 'copy' ? formData.id : undefined;
      setContractData((prev) =>
        insertRowsAfter(
          prev,
          [newItem],
          sourceId == null ? undefined : (r) => r.id === sourceId
        )
      );
      toast.success(
        paneMode === 'add' ? '明細を追加しました。' : '明細をコピーしました。'
      );
    } else if (paneMode === 'update') {
      // 更新は対象明細を更新する
      setContractData((prev) =>
        prev.map((item) =>
          item.id === formData.id
            ? ({ ...item, ...formData } as LocationContractItem)
            : item
        )
      );
      toast.success('明細を更新しました。');
    } else if (paneMode === 'split') {
      // 分割は対象明細の分割状況に〇を表示する
      setContractData((prev) =>
        prev.map((item) =>
          item.id === formData.id ? { ...item, splitStatus: '〇' } : item
        )
      );
      toast.success('明細を分割しました。');
    }
    closePane();
  }, [paneMode, formData, createEmptyForm, generateId, closePane]);

  // 連続追加：明細を追加した後もペインを閉じず、フォームを初期化して次の入力に備える
  const handleContinuousAdd = useCallback(() => {
    const newItem: LocationContractItem = {
      ...createEmptyForm(),
      ...formData,
      id: generateId(),
      splitStatus: '',
    } as LocationContractItem;
    // 明細の最下行に追加する（→ 02 §8「行の追加位置」・UX-112）
    setContractData((prev) => [...prev, newItem]);
    toast.success('明細を追加しました。続けて入力できます。');
    setFormData(createEmptyForm());
  }, [formData, createEmptyForm, generateId]);

  // 削除の確定
  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    setContractData((prev) =>
      prev.filter((item) => item.id !== deleteTarget.id)
    );
    setIsDeleteDialogOpen(false);
    setDeleteTarget(null);
    toast.success('明細を削除しました。');
  }, [deleteTarget]);

  // インライン編集で変更されたセルを明細データに反映する
  const handleCellValueChanged = useCallback((params: any) => {
    setContractData((prev) =>
      prev.map((item) =>
        item.id === params.data.id
          ? ({ ...item, ...params.data } as LocationContractItem)
          : item
      )
    );
  }, []);

  // 戻る確定 → 支払申請一覧参照画面へ遷移
  const handleBackConfirm = useCallback(() => {
    setIsBackDialogOpen(false);
    navigate('payment-list');
  }, [navigate]);

  // 申請／引戻し／承認の確認ダイアログのメッセージ
  const confirmMessageMap: Record<
    Exclude<ConfirmAction, null>,
    {
      title: string;
      description: string;
      toast: string;
      button: string;
      buttonClass: string;
    }
  > = {
    save: {
      title: '保存の確認',
      description: 'ロケ契約料（償却）データを保存します。よろしいですか？',
      toast: '保存しました。',
      button: '保存',
      buttonClass: 'bg-blue-500 hover:bg-blue-600',
    },
    apply: {
      title: '申請の確認',
      description: 'ロケ契約料（償却）データを申請します。よろしいですか？',
      toast: '申請が完了しました。',
      button: '申請',
      buttonClass: 'bg-green-500 hover:bg-green-600',
    },
    reject: {
      title: '差戻しの確認',
      description: 'ロケ契約料（償却）データを差戻します。よろしいですか？',
      toast: '差戻しが完了しました。',
      button: '差戻し',
      buttonClass: 'bg-red-500 hover:bg-red-600',
    },
    withdrawPlan: {
      title: '引戻しの確認',
      description:
        '申請したロケ契約料（償却）データを引き戻します。よろしいですか？',
      toast: 'データを引き戻しました。',
      button: '引戻し',
      buttonClass:
        'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50',
    },
    approve: {
      title: '承認の確認',
      description: 'ロケ契約料（償却）データを承認します。よろしいですか？',
      toast: '承認が完了しました。',
      button: '承認',
      buttonClass: 'bg-green-500 hover:bg-green-600',
    },
  };

  // 確認ダイアログの確定
  const handleConfirmAction = () => {
    if (!confirmAction) return;
    const { toast: toastMessage } = confirmMessageMap[confirmAction];
    toast.success(toastMessage);
    setConfirmAction(null);
  };

  // ヘッダー項目（テキストラベル）の共通描画（支払申請承認に準拠）
  const renderLabelField = (label: string, value: string) => (
    <div className="flex items-center gap-2">
      <label className="text-sm text-blue-900 whitespace-nowrap font-bold w-36 text-right">
        {label}
      </label>
      <span className="h-8 flex items-center text-sm text-gray-900">
        {value}
      </span>
    </div>
  );

  // ===== ロケ契約明細グリッドの列定義 =====
  // 管理区分／管理コード／施策区分／施策コードは "コード:名称" を「コード列／名称列」の
  // 2列に分けて表示する。コード列の編集で検索付きリッチセレクトが開き、ペアが切り替わる。
  const columnDefs: ColDef[] = useMemo(
    () =>
      [
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
          headerName: '管理区分名称',
          colId: 'managementCategoryName',
          field: 'managementCategory',
          valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
          editable: false,
          cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
        },
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
          headerName: '管理コード名称',
          colId: 'managementCodeName',
          field: 'managementCode',
          valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
          editable: false,
          cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
        },
        {
          headerName: '支払金額(円)',
          field: 'amount',
          ...GRID_NUMBER_TEXT_FILTER,
          // 金額はカンマ区切りで表示する（標準準拠）。
          valueFormatter: formatAmountCell,
          // 分割済（分割元）・分割先の金額は編集不可にする
          editable: (params) =>
            !isReadOnlyRow(params.data) && !isSplitDoneRow(params.data),
          cellEditor: 'agTextCellEditor',
          cellStyle: (params) => ({
            backgroundColor:
              isReadOnlyRow(params.data) || isSplitDoneRow(params.data)
                ? NON_EDITABLE_CELL_BG
                : EDITABLE_CELL_BG,
            textAlign: 'right',
          }),
        },
        {
          headerName: '税区分',
          field: 'taxCategory',
          editable: true,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: { values: TAX_CATEGORY_OPTIONS },
          cellStyle: { backgroundColor: EDITABLE_CELL_BG },
        },
        {
          headerName: '支払先',
          field: 'payee',
          editable: true,
          cellEditor: ComboCellEditor,
          cellEditorParams: { comboOptions: PAYMENT_DESTINATION_COMBO_OPTIONS },
          cellEditorPopup: true,
          suppressKeyboardEvent: suppressEditNavKeys,
          cellStyle: { backgroundColor: EDITABLE_CELL_BG },
        },
        {
          headerName: 'ステータス',
          field: 'status',
          editable: false,
          cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
        },
        {
          headerName: '発生日（契約開始日）',
          field: 'occurrenceDate',
          editable: true,
          cellEditor: DateMonthYearCellEditor,
          cellEditorPopup: true,
          // 日付は yyyy/MM/dd 形式で表示する（標準準拠）。
          valueFormatter: formatDateCell,
          cellStyle: { backgroundColor: EDITABLE_CELL_BG, textAlign: 'right' },
        },
        {
          headerName: '償却期間開始',
          field: 'amortizationStart',
          editable: true,
          cellEditor: DateMonthYearCellEditor,
          cellEditorPopup: true,
          // 日付は yyyy/MM/dd 形式で表示する（標準準拠）。
          valueFormatter: formatDateCell,
          cellStyle: { backgroundColor: EDITABLE_CELL_BG, textAlign: 'right' },
        },
        {
          headerName: '償却期間終了',
          field: 'amortizationEnd',
          editable: true,
          cellEditor: DateMonthYearCellEditor,
          cellEditorPopup: true,
          // 日付は yyyy/MM/dd 形式で表示する（標準準拠）。
          valueFormatter: formatDateCell,
          cellStyle: { backgroundColor: EDITABLE_CELL_BG, textAlign: 'right' },
        },
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
          headerName: '施策区分名称',
          colId: 'measureCategoryName',
          field: 'measureCategory',
          valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
          editable: false,
          cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
        },
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
          headerName: '施策コード名称',
          colId: 'measureCodeName',
          field: 'measureCode',
          valueFormatter: (p) => splitCategoryName(p.value) || GRID_EMPTY_TEXT,
          editable: false,
          cellStyle: { backgroundColor: NON_EDITABLE_CELL_BG },
        },
        {
          headerName: 'CRMコード',
          colId: 'crmCodeCode',
          field: 'crmCode',
          valueFormatter: (p) => splitCategoryCode(p.value) || GRID_EMPTY_TEXT,
          editable: true,
          cellEditor: ComboCellEditor,
          cellEditorParams: {
            comboOptions: CRM_CODE_COMBO_OPTIONS,
            clearable: true,
          },
          cellEditorPopup: true,
          suppressKeyboardEvent: suppressEditNavKeys,
          cellStyle: { backgroundColor: EDITABLE_CELL_BG },
        },
        {
          headerName: '摘要1（社内用）',
          field: 'note1',
          editable: true,
          cellEditor: 'agTextCellEditor',
          // 長文は「…」で省略表示し、マウスオーバーでツールチップに全文を表示する
          tooltipField: 'note1',
          cellStyle: {
            backgroundColor: EDITABLE_CELL_BG,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          },
        },
        {
          headerName: '摘要2（社外用）',
          field: 'note2',
          editable: true,
          cellEditor: 'agTextCellEditor',
          // 長文は「…」で省略表示し、マウスオーバーでツールチップに全文を表示する
          tooltipField: 'note2',
          cellStyle: {
            backgroundColor: EDITABLE_CELL_BG,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          },
        },
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
          cellStyle: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          },
        },
        {
          headerName: '解約',
          field: 'cancellation',
          pinned: 'right',
          lockPinned: true,
          sortable: false,
          filter: false,
          editable: false,
          cellRenderer: CancellationButtonCellRenderer,
          cellStyle: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          },
        },
      ] as ColDef[],
    []
  );

  // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
  // ※ 勘定科目列を削除し列構成が変わったため key を v2 に更新（旧 localStorage の列順・列幅復元を避ける）。
  // ※ 税区分列を金額の右へ移動し列順が変わったため key を v3 に更新。

  // コピー・追加で増えた行を見つけやすくする（行全体をフラッシュし可視域へ送る）。
  // 追加処理が親側にあり markRows を差し込めないため、行数の増加から自動検出する。
  const reveal = useRevealNewRows({ autoDetect: true });

  const gridColumnStateProps = useGridColumnState(
    'locationContract.columnState.v3'
  );

  // ヘッダーが省略表示された場合にマウスオーバーで全文表示するため、
  // 各列に headerTooltip（=headerName）を付与する（共通ヘルパー・grid/）
  const columnDefsWithTooltip = useMemo(
    () => withHeaderTooltips(lockReadOnlyRows(columnDefs)),
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
      case 'split':
        return '明細分割';
      default:
        return '';
    }
  }, [paneMode]);

  return (
    // 画面全体を縦フレックスにし、コンテンツと固定フッターの間の
    // スペーサー（flex-1）で余白を吸収して、固定フッターをウィンドウ底部
    // （＝main の下端）に張り付ける。コンテンツが短い場合でもフッターが
    // 底部に固定され、長い場合は sticky で追従する。
    <div className="min-w-[75rem] flex min-h-full flex-col">
      <div className="px-6 pt-3 pb-0">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="ロケ契約料一覧" />

        {/* 基本情報カード（開閉可能・支払申請承認に準拠） */}
        <Collapsible
          open={isHeaderOpen}
          onOpenChange={setIsHeaderOpen}
          className={`${CARD_CLASS} overflow-hidden mb-3`}
        >
          {/* ヘッダーバー：左に「基本情報」（開閉）、反対側（右）に開閉アイコン */}
          <div className="bg-white px-3 py-3 card-header-accent flex w-full items-center justify-between">
            <CollapsibleTrigger className="flex flex-1 items-center text-left hover:opacity-80 transition-opacity outline-none focus:outline-none focus-visible:outline-none focus:ring-0">
              <span className="text-gray-900 font-bold text-base">
                基本情報
              </span>
            </CollapsibleTrigger>
            {/* コメント履歴はフッターのコメント欄の「履歴」から開く（UI/UX UX-107） */}
            <div className="flex items-center gap-3">
              <CollapsibleTrigger
                className="outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                aria-label="基本情報の開閉"
              >
                <ChevronDown
                  className={`h-5 w-5 text-gray-500 transition-transform ${isHeaderOpen ? 'rotate-180' : ''}`}
                />
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent>
            <div className="p-4">
              {/* 対象年度 / 対象月 / 計画No. */}
              <div className="grid grid-cols-4 gap-3 mb-2.5 items-center pb-2.5 border-b border-gray-300">
                {renderLabelField('対象年度', '2026')}
                {renderLabelField('対象月', '7')}
                {renderLabelField('計画No.', '')}
                <div />
              </div>

              {/* 販売店 / 三次店 / 一次店 */}
              <div className="grid grid-cols-4 gap-3 mb-2.5 pb-2.5 border-b border-gray-300">
                {renderLabelField('販売店', '▲▲')}
                {renderLabelField('三次店', 'A支店')}
                {renderLabelField('一次店', '峠台A')}
                <div />
              </div>

              {/* 事業場 / 部署 / 営業担当者 */}
              <div className="grid grid-cols-4 gap-3 mb-2 items-center">
                {renderLabelField('事業場', '首都圏')}
                {renderLabelField('部署', '首都圏営業第一')}
                {renderLabelField('営業担当者', 'xxxxxx')}
                <div />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ロケ契約明細グリッド */}
      <div className="w-full px-6 pt-0 pb-2">
        {/* グローバルCSSの「先頭列を中央寄せ」を本画面のデータ先頭列（管理区分）では左寄せに上書きする。
            最左はチェックボックス列のため aria-colindex ではなく col-id で対象列を指定する。
            行ホバー時はテーマの行ハイライト色を見せるためセル背景を透明にする。
            分割先の行（読み取り専用）はグレー背景で1行全体表示する。 */}
        <style>{`
          .lc-item-grid .ag-cell[col-id="managementCategoryCode"] {
            justify-content: flex-start;
            padding-left: var(--ag-cell-horizontal-padding);
            padding-right: var(--ag-cell-horizontal-padding);
          }
          .lc-item-grid .ag-cell[col-id="managementCategoryCode"] > * {
            justify-content: flex-start;
          }
          .lc-item-grid .ag-row-hover .ag-cell {
            background-color: transparent !important;
          }
          .lc-item-grid .ag-row.lc-split-dest .ag-cell {
            background-color: #e8e8e8 !important;
          }
          /* 最左の選択（チェックボックス）列を、各データ行ともセル中央に配置する。 */
          .lc-item-grid .ag-cell[aria-colindex="1"] {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
          }
          .lc-item-grid .ag-cell[aria-colindex="1"] .ag-selection-checkbox,
          .lc-item-grid .ag-cell[aria-colindex="1"] .ag-checkbox,
          .lc-item-grid .ag-cell[aria-colindex="1"] .ag-checkbox-input-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
          }
          /* ヘッダーの全選択チェックボックス列。AG Grid のバージョンにより
             aria-colindex が付かない場合があるため、チェックボックスを内包する
             ヘッダーセルを :has() で確実に対象化し、内側の comp-wrapper と
             チェックボックスを全幅・中央寄せにする（テーマ既定を上書きするため !important）。 */
          .lc-item-grid .ag-header-cell:has(.ag-header-select-all) .ag-header-cell-comp-wrapper {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            height: 100% !important;
          }
          .lc-item-grid .ag-header-cell:has(.ag-header-select-all) .ag-header-select-all {
            margin: 0 !important;
          }
        `}</style>

        {/* ロケ契約明細エリア */}
        <div className={`${CARD_CLASS} overflow-hidden`}>
          {/* 根拠資料格納・根拠資料確認（左端）／明細追加（右端） */}
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            {/* 根拠資料格納（左端） */}
            <button
              className="bg-white text-blue-600 px-2 py-1 rounded-lg border-2 border-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap text-sm flex items-center gap-1"
              onClick={handleStoreEvidence}
              aria-label="根拠資料格納"
            >
              <ReceiptText className="h-4 w-4" />
              根拠資料格納
            </button>
            {/* 根拠資料確認（その右隣・動作なし） */}
            <button
              className="bg-white text-blue-600 px-2 py-1 rounded-lg border-2 border-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap text-sm flex items-center gap-1"
              aria-label="根拠資料確認"
            >
              <FolderSearch className="h-4 w-4" />
              根拠資料確認
            </button>

            <div className="ml-auto self-end flex items-center gap-2">
              <button
                className="bg-white text-blue-600 px-2 py-1 rounded-lg border-2 border-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap text-sm"
                onClick={handleAddClick}
                aria-label="＋明細追加"
              >
                ＋明細追加
              </button>
            </div>
          </div>

          <div
            className="lc-item-grid w-full px-3 pb-3 pt-0"
            style={{ height: '22.5rem' }}
          >
            <AgGridReact
              onRowDataUpdated={reveal.onRowDataUpdated}
              ref={gridRef}
              rowData={contractData}
              columnDefs={columnDefsWithTooltip}
              defaultColDef={GRID_DEFAULT_COL_DEF}
              // 最左にチェックボックス列を表示（支払申請一覧参照に準拠）
              rowSelection={{
                mode: 'multiRow',
                checkboxes: true,
                headerCheckbox: true,
                enableClickSelection: false,
              }}
              selectionColumnDef={{
                pinned: 'left',
                width: 40,
                resizable: false,
                suppressMovable: true,
                suppressHeaderMenuButton: true,
                // チェックボックスをセルの中央に配置する
                cellStyle: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              }}
              // 分割先：グレー背景（非活性行）
              rowClassRules={{
                'lc-split-dest': (params) => isSplitDestRow(params.data),
              }}
              getContextMenuItems={gridFilterContextMenuItems}
              getRowId={(params) => params.data.id}
              onCellValueChanged={handleCellValueChanged}
              stopEditingWhenCellsLoseFocus={true}
              statusBar={GRID_STATUS_BAR}
              // 列状態（列幅・並び順・ソート）の保存／復元（共通フック）
              {...gridColumnStateProps}
              // 共通基本プロパティ（Enter縦移動・テキスト選択／grid/）
              {...GRID_BASE_PROPS}
              context={{
                onSplitRow: handleSplitRow,
                onEditRow: handleEditRow,
                onCopyRow: handleCopyRow,
                onDeleteRow: handleDeleteRow,
                onCancellation: handleCancellation,
              }}
            />
          </div>
        </div>

        {/* コメント履歴ペイン（右スライドペイン・販売計画表(マージン率固定・NET入力)を踏襲） */}
        <RightPane
          open={showCommentHistoryPane}
          onClose={() => setShowCommentHistoryPane(false)}
          title="コメント履歴"
          description=""
        >
          <div className="space-y-3">
            {COMMENT_HISTORY.map((item, index) => (
              <div
                key={index}
                className="bg-gray-50 p-4 rounded-lg space-y-2 border border-gray-200"
              >
                <div className="flex flex-wrap items-center gap-2">
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

        {/* 明細操作ペイン（右スライドペイン・共通 RightPane） */}
        <RightPane
          open={paneMode !== null}
          onClose={closePane}
          title={paneTitle}
          description={
            paneMode === 'split'
              ? '金額を分割します。確定すると分割状況に〇が表示されます。'
              : '明細項目を入力してください。'
          }
          initialWidth={32}
          minWidth={20}
          maxWidth={48}
          footer={
            <div className="flex gap-3">
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
                  : paneMode === 'split'
                    ? '分割'
                    : paneMode === 'copy'
                      ? 'コピー'
                      : '追加'}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            {/* 追加・更新・コピー：全項目を表示（分割ペインは別レイアウト） */}
            {paneMode !== 'split' && (
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
                {/* 管理区分 */}
                <div className="space-y-2">
                  <Label>
                    管理区分
                    <RequiredBadge />
                  </Label>
                  <SingleCombobox
                    options={MANAGEMENT_CATEGORY_PANE_OPTIONS}
                    value={formData.managementCategory || ''}
                    onChange={(v) => handleFieldChange('managementCategory', v)}
                    placeholder="コード または 名称で検索..."
                  />
                </div>

                {/* 管理コード */}
                <div className="space-y-2">
                  <Label>
                    管理コード
                    <RequiredBadge />
                  </Label>
                  <SingleCombobox
                    options={MANAGEMENT_CODE_PANE_OPTIONS}
                    value={formData.managementCode || ''}
                    onChange={(v) => handleFieldChange('managementCode', v)}
                    placeholder="コード または 名称で検索..."
                  />
                </div>

                {/* 支払金額 */}
                <div className="space-y-2">
                  <Label>
                    支払金額(円)
                    <RequiredBadge />
                  </Label>
                  <Input
                    className={TEXT_INPUT_CLASS}
                    value={formData.amount || ''}
                    onChange={(e) =>
                      handleFieldChange('amount', e.target.value)
                    }
                  />
                </div>

                {/* 税区分（金額の右側） */}
                <div className="space-y-2">
                  <Label>
                    税区分
                    <RequiredBadge />
                  </Label>
                  <SingleCombobox
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

                {/* 支払先 */}
                <div className="space-y-2">
                  <Label>
                    支払先
                    <RequiredBadge />
                  </Label>
                  <SingleCombobox
                    options={PAYMENT_DESTINATION_PANE_OPTIONS}
                    value={formData.payee || ''}
                    onChange={(v) => handleFieldChange('payee', v)}
                    placeholder="コード または 名称で検索..."
                  />
                </div>

                {/* 発生日（契約開始日） */}
                <div className="space-y-2">
                  <Label>
                    発生日（契約開始日）
                    <RequiredBadge />
                  </Label>
                  <Input
                    className={TEXT_INPUT_CLASS}
                    value={formData.occurrenceDate || ''}
                    onChange={(e) =>
                      handleFieldChange('occurrenceDate', e.target.value)
                    }
                    placeholder="yyyy/MM/dd"
                  />
                </div>

                {/* 償却期間開始 */}
                <div className="space-y-2">
                  <Label>
                    償却期間開始
                    <RequiredBadge />
                  </Label>
                  <Input
                    className={TEXT_INPUT_CLASS}
                    value={formData.amortizationStart || ''}
                    onChange={(e) =>
                      handleFieldChange('amortizationStart', e.target.value)
                    }
                    placeholder="yyyy/MM/dd"
                  />
                </div>

                {/* 償却期間終了 */}
                <div className="space-y-2">
                  <Label>
                    償却期間終了
                    <RequiredBadge />
                  </Label>
                  <Input
                    className={TEXT_INPUT_CLASS}
                    value={formData.amortizationEnd || ''}
                    onChange={(e) =>
                      handleFieldChange('amortizationEnd', e.target.value)
                    }
                    placeholder="yyyy/MM/dd"
                  />
                </div>

                {/* 施策区分 */}
                <div className="space-y-2">
                  <Label>施策区分</Label>
                  <SingleCombobox
                    options={MEASURE_CATEGORY_PANE_OPTIONS}
                    value={formData.measureCategory || ''}
                    onChange={(v) => handleFieldChange('measureCategory', v)}
                    placeholder="コード または 名称で検索..."
                    clearable
                  />
                </div>

                {/* 施策コード */}
                <div className="space-y-2">
                  <Label>施策コード</Label>
                  <SingleCombobox
                    options={MEASURE_CODE_PANE_OPTIONS}
                    value={formData.measureCode || ''}
                    onChange={(v) => handleFieldChange('measureCode', v)}
                    placeholder="コード または 名称で検索..."
                    clearable
                  />
                </div>

                {/* CRMコード（手入力） */}
                <div className="space-y-2">
                  <Label>CRMコード</Label>
                  <Input
                    className={TEXT_INPUT_CLASS}
                    value={formData.crmCode || ''}
                    onChange={(e) =>
                      handleFieldChange('crmCode', e.target.value)
                    }
                  />
                </div>

                {/* 摘要1（社内用）（行を分けるため全幅） */}
                <div className="space-y-2 @md:col-span-2 @2xl:col-span-3">
                  <Label>
                    摘要1（社内用）
                    <RequiredBadge />
                  </Label>
                  <Input
                    className={TEXT_INPUT_CLASS}
                    value={formData.note1 || ''}
                    onChange={(e) => handleFieldChange('note1', e.target.value)}
                  />
                </div>

                {/* 摘要2（社外用）（行を分けるため全幅） */}
                <div className="space-y-2 @md:col-span-2 @2xl:col-span-3">
                  <Label>
                    摘要2（社外用）
                    <RequiredBadge />
                  </Label>
                  <Input
                    className={TEXT_INPUT_CLASS}
                    value={formData.note2 || ''}
                    onChange={(e) => handleFieldChange('note2', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* 分割ペイン専用：管理区分・管理コードは入力不可、計上先・費用負担部署・分割金額は必須 */}
            {paneMode === 'split' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
                  {/* 管理区分（入力不可） */}
                  <div className="space-y-2">
                    <Label>管理区分</Label>
                    <SingleCombobox
                      options={MANAGEMENT_CATEGORY_PANE_OPTIONS}
                      value={formData.managementCategory || ''}
                      onChange={() => {}}
                      placeholder=""
                      disabled
                    />
                  </div>

                  {/* 管理コード（入力不可） */}
                  <div className="space-y-2">
                    <Label>管理コード</Label>
                    <SingleCombobox
                      options={MANAGEMENT_CODE_PANE_OPTIONS}
                      value={formData.managementCode || ''}
                      onChange={() => {}}
                      placeholder=""
                      disabled
                    />
                  </div>

                  {/* 金額（入力不可） */}
                  <div className="space-y-2">
                    <Label>金額(円)</Label>
                    <Input
                      className={`${TEXT_INPUT_CLASS} bg-gray-100`}
                      value={formData.amount || ''}
                      readOnly
                      tabIndex={-1}
                    />
                  </div>
                </div>

                {/* 必須項目（計上先・費用負担部署・分割金額） */}
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label>
                      計上先
                      <RequiredBadge />
                    </Label>
                    <Input
                      className={TEXT_INPUT_CLASS}
                      value={splitDest}
                      onChange={(e) => setSplitDest(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      費用負担部署
                      <RequiredBadge />
                    </Label>
                    <Input
                      className={TEXT_INPUT_CLASS}
                      value={splitDept}
                      onChange={(e) => setSplitDept(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      分割金額(円)
                      <RequiredBadge />
                    </Label>
                    <Input
                      className={TEXT_INPUT_CLASS}
                      value={splitAmount}
                      onChange={(e) => setSplitAmount(e.target.value)}
                    />
                  </div>
                </div>

                {/* 分割案内（読み取り専用の案内テキスト） */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700">
                  分割金額を入力し「分割」を押すと、入力した計上先・費用負担部署で分割明細が作成され、分割状況に〇が表示されます。
                </div>
              </div>
            )}
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
                  <strong>管理区分:</strong>{' '}
                  {splitCategoryName(deleteTarget.managementCategory) ||
                    '（未設定）'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>金額(円):</strong> {deleteTarget.amount}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="destructive"
                className="rounded-lg"
                onClick={confirmDelete}
              >
                削除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* コンテンツとフッターの間の余白を吸収し、フッターをウィンドウ底部へ押し下げるスペーサー */}
      <div className="flex-1" aria-hidden="true" />

      {/* 固定フッター（計画詳細画面に準拠：高さ h-9 の btn-action-base。ルートで min-w-[75rem] 済みのため mt-4/min-w は付けない） */}
      <div className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10">
        <div className="flex flex-wrap gap-3 justify-between">
          <div>
            {/* 一覧へ戻る（取消し系・白地グレー枠） */}
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
            <FooterCommentField
              id="location-contract-comment"
              value={commentInput}
              onChange={setCommentInput}
              onOpenHistory={() => setShowCommentHistoryPane(true)}
            />
            {/* 差戻し（データ削除系・塗り赤） */}
            <button
              className="btn-action-base btn-action-red"
              onClick={() => setConfirmAction('reject')}
              aria-label="差戻し"
            >
              <Undo2 className="h-4 w-4" />
              差戻し
            </button>
            {/* 承認（承認ワークフロー系・塗り緑） */}
            <button
              className="btn-action-base btn-action-green"
              onClick={() => setConfirmAction('approve')}
              aria-label="承認"
            >
              <Check className="h-4 w-4" />
              承認
            </button>
            {/* 引戻し（承認ワークフロー系・塗り緑） */}
            <button
              className="btn-action-base btn-action-outline-blue"
              onClick={() => setConfirmAction('withdrawPlan')}
              aria-label="引戻し"
            >
              <CornerUpLeft className="h-4 w-4" />
              引戻し
            </button>
            {/* 申請（承認ワークフロー系・塗り緑） */}
            <button
              className="btn-action-base btn-action-green"
              onClick={() => setConfirmAction('apply')}
              aria-label="申請"
            >
              <Send className="h-4 w-4" />
              申請
            </button>
            {/* 保存（確定系・塗り青） */}
            <button
              className="btn-action-base btn-action-blue"
              onClick={() => setConfirmAction('save')}
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

      {/* 申請／引戻し／承認の確認ダイアログ（共通） */}
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
              {confirmAction ? confirmMessageMap[confirmAction].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction
                ? confirmMessageMap[confirmAction].description
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className={`${
                confirmAction
                  ? confirmMessageMap[confirmAction].buttonClass
                  : ''
              } text-white rounded-lg`}
              onClick={handleConfirmAction}
            >
              {confirmAction ? confirmMessageMap[confirmAction].button : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

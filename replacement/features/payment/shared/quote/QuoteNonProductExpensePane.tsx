// 支払詳細(引用)画面用：PaymentNonProductExpensePane をベースに作成
import { useMemo, useRef, useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ICellRendererParams,
  CellValueChangedEvent,
  CellMouseOverEvent,
  GetRowIdParams,
} from 'ag-grid-community';
import {
  Upload,
  Plus,
  Split,
  SquarePen,
  Copy,
  Trash2,
  EllipsisVertical,
} from 'lucide-react';

import {
  viewportGridHeight,
  GRID_DEFAULT_COL_DEF,
  GRID_BASE_PROPS,
  GRID_STATUS_BAR,
  GRID_COLORS,
  changedCellStyle,
  gridFilterContextMenuItems,
  useRevealNewRows,
  useChangedCells,
  GRID_NUMBER_TEXT_FILTER,
  GRID_DATE_TEXT_FILTER,
  GRID_EMPTY_TEXT,
  useGridColumnState,
  asCellStyle,
} from '@/components/grid';
import { SingleComboboxCellEditor } from '@/components/ui/single-combobox-cell-editor';
import { MATCH_PAYMENT_TYPE_OPTIONS } from '@/constants/matchPaymentType';
import { DateMonthYearCellEditor } from '@/components/ui/date-month-year-cell-editor';
import {
  campaignClassComboOptions,
  campaignCodeComboOptions,
} from '@/constants/comboFieldOptions';
import {
  CARD_TITLE_CLASS,
  TEXT_INPUT_CLASS,
  BUTTON_STYLES,
  BUTTON_BASE,
  CARD_CLASS,
} from '@/styles/commonStyles';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { RightPane } from '@/components/ui/right-pane';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { RequiredBadge } from '@/components/ui/required-badge';
import { SingleCombobox } from '@/components/ui/single-combobox';

// 旧データ型（支払詳細(見積)・(見積入力)の既存右ペインとの互換のため維持）
interface NonProductExpenseData {
  isTotal?: boolean;
  metaBrand: string;
  summaryProduct: string;
  accountItem: string;
  managementClass: string;
  managementCode: string;
  description: string;
  plannedAmount: number;
  priorYearActual: number;
  postingMonth: string;
}

export type { NonProductExpenseData };

// 拡売費明細データ（Excel「拡売費」表）
export interface ExpenseRow {
  // 行ID（getRowId に使う内部値。行番は削除後に同じ番号で採番し直されるため別に持つ）
  id: string;
  isGroup?: boolean; // グループ合計行
  isTotal?: boolean; // 総合計行
  lineNo: number | string; // 行番
  billName: string; // 卸からの請求名称
  planExpContent: string; // 販売計画に記載の拡売費内容
  product: string; // 商品
  // 請求金額（請求書に記載された金額）。請求－支払差額の計算元。
  billAmount?: number | string;
  payAmount: number | string; // 支払金額
  planAmount: number | string; // 計画金額
  taxRate: number | string; // 税率
  taxClass: string; // 税区分
  costSplit: string; // 費用分割（ボタン以外のテキスト：※分割先情報 等）
  mgmtClass: string; // 管理区分（用途）
  mgmtCode: string; // 管理コード（投資責任）
  measureClass: string; // 施策区分
  measureCode: string; // 施策コード
  approvalNo: string; // 稟議決裁番号
  approvalDate: string; // 稟議決裁日
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  accountAmount: number | string; // 勘定科目別金額
  planDiff: number | string; // 計画差異
  matchType: string; // 照合支払区分
  billNo: string; // 請求書番号
  billPage: string; // 請求書ページ
  selectable?: boolean; // 販売計画選択ボタンを表示するか
  showCostSplit?: boolean; // 費用分割ボタンを表示するか
  isNetUnapproved?: boolean; // 未承認NET拡売費の明細行（追加口のO列と連動）
}

interface NonProductExpensePaneProps {
  // 列状態（列幅・並び・ソート）の保存キー（画面ごとに一意 → 02 §7）
  columnStateKey: string;
  // 編集・コピーペインは拡売費グリッドの編集可能項目を扱うため、明細行（ExpenseRow）をそのまま渡す
  onOpenEditExpense?: (data: ExpenseRow) => void;
  onOpenCopyExpense?: (data: ExpenseRow) => void;
  pendingCopyRow?: NonProductExpenseData | null;
  onCopyComplete?: () => void;
  // 販売計画選択ボタン押下（支払明細に紐づける計画明細 選択エリアを右ペインで表示）
  onOpenPlanSelection?: (data: ExpenseRow) => void;
  // 「追加口へ戻す」ボタン押下
  onRevertToAddition?: (data: ExpenseRow) => void;
  // 追加口一覧から連動する「未承認NET拡売費」データ（O列合計・商品名別O列）
  netUnapproved?: { total: number; byProduct: Record<string, number> };
}

// 販売計画選択ボタンセル
const PlanSelectCellRenderer = (props: ICellRendererParams) => {
  if (props.data.isTotal || !props.data.selectable) {
    return null;
  }
  const { onSelectPlan } = props.context;
  return (
    <div className="flex items-center justify-center h-full">
      <button
        onClick={() => onSelectPlan(props.data)}
        className="bg-white text-blue-600 px-2 py-0.5 rounded border border-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap text-xs"
      >
        販売計画選択
      </button>
    </div>
  );
};

// 費用分割ボタンセル（ボタン非表示行はテキスト値〔※分割先情報 等〕を表示）
const CostSplitCellRenderer = (props: ICellRendererParams) => {
  const row = props.data as ExpenseRow | undefined;
  if (!row || row.isGroup || row.isTotal) return null;
  // 子番号（「親番号-子番号」）を持つ分割先行が存在する親行は「分割済」を表示する。
  const lineNo = String(row.lineNo ?? '');
  if (lineNo && !lineNo.includes('-')) {
    const prefix = `${lineNo}-`;
    let hasChild = false;
    props.api.forEachNode((n: any) => {
      if (String(n.data?.lineNo ?? '').startsWith(prefix)) hasChild = true;
    });
    if (hasChild) return <span>分割済</span>;
  }
  // 費用分割ボタンはアクション列へ移動。この列は分割先情報テキストのみ表示する。
  return props.value ? <span>{props.value}</span> : null;
};

// 行アクション（費用分割・編集・コピー・削除）を三点リーダー（ケバブメニュー）に
// まとめたレンダラー（PaymentDetailVending を参考）。
// グループ合計行・総合計行・未承認NET明細（追加口連動）には表示しない。
const ActionsCellRenderer = (props: ICellRendererParams) => {
  const row = props.data as ExpenseRow | undefined;
  if (!row || row.isGroup || row.isTotal || row.isNetUnapproved) return null;
  const { onSplitCost, onEditRow, onCopyRow, onDeleteRow } = props.context;
  return (
    <div className="flex items-center justify-center h-full">
      {/* modal={false}：閉じる際に body の pointer-events をロックさせず、
          非モーダルの費用分割ペイン（RightPane）が正しく開くようにする */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-100 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
            aria-label="操作メニュー"
            title="操作"
          >
            <EllipsisVertical className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* 費用分割（分割可能な明細行のみ表示） */}
          {row.showCostSplit && (
            <DropdownMenuItem
              onClick={() => onSplitCost?.(row)}
              className="text-blue-600 focus:text-blue-600"
            >
              <Split className="w-4 h-4 text-blue-600" />
              費用分割
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => onEditRow?.(row)}
            className="text-blue-600 focus:text-blue-600"
          >
            <SquarePen className="w-4 h-4 text-blue-600" />
            編集
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onCopyRow?.(row)}
            className="text-green-600 focus:text-green-600"
          >
            <Copy className="w-4 h-4 text-green-600" />
            コピー
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDeleteRow?.(row)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// 整数のみ許可（小数部は切り捨て、数字以外は除去）。分割金額の入力に使用。
const toIntegerString = (v: string) => v.split('.')[0].replace(/[^0-9]/g, '');

// 請求－支払差額（請求金額 − 支払金額）。どちらも数値でない行は空白を返す。
// 20260821_第31回 決定事項4 により、拡売費明細にも追加口明細と同じ差額列を持たせる。
const billPayDiffOf = (row: ExpenseRow | undefined): number | '' => {
  if (!row || row.isGroup || row.isTotal) return '';
  const bill = toNum(row.billAmount);
  const pay = toNum(row.payAmount);
  if (bill === null || pay === null) return '';
  return bill - pay;
};

// 照合支払区分の選択肢（追加口明細と共通の定数を使う）。
const MATCH_TYPE_COMBO_OPTIONS = MATCH_PAYMENT_TYPE_OPTIONS.map((v) => ({
  value: v,
  label: v,
}));

// 空セル既定値（各行はこれを基にした差分のみ記述）
const BLANK: ExpenseRow = {
  id: '',
  lineNo: '',
  billName: '',
  planExpContent: '',
  product: '',
  billAmount: '',
  payAmount: '',
  planAmount: '',
  taxRate: '',
  taxClass: '',
  costSplit: '',
  mgmtClass: '',
  mgmtCode: '',
  measureClass: '',
  measureCode: '',
  approvalNo: '',
  approvalDate: '',
  summary1: '',
  summary2: '',
  accountAmount: '',
  planDiff: '',
  matchType: '',
  billNo: '',
  billPage: '',
};

// 税区分の選択肢（PaymentDetailVending と同様。agSelectCellEditor で選択）
const TAX_CATEGORY_OPTIONS = [
  '1:課税10%',
  '2:課税8%',
  '3:その他(5%)',
  '4:その他(非課税)',
];

const EXPENSE_ROWS: ExpenseRow[] = [
  // ── その他拡売費 ──────────────────────────────
  {
    ...BLANK,
    id: 'exp-1',
    lineNo: 1,
    selectable: true,
    billName: 'ワンダ モーニングショット ６Ｐ アプリ20',
    planExpContent: 'ワンダ モーニングショット ６Ｐ アプリ20',
    product: 'ワンダモーニングショット６ＰＮ',
    billAmount: 57433,
    payAmount: 57433,
    planAmount: 56000,
    taxRate: 0.08,
    taxClass: '1:課税10%',
    showCostSplit: true,
    mgmtClass: '1B6 チャネル対策条件（売上連動）',
    mgmtCode: '99999 量販経費追加スーパー',
    approvalNo: '12345',
    approvalDate: '2025/7/29',
    planDiff: 1433,
    billPage: '①02',
  },
  // 費用分割先（ワンダ モーニングショットの分割明細。行番は「親番号-子番号」）
  {
    ...BLANK,
    id: 'exp-1-1',
    lineNo: '1-1',
    billAmount: 20000,
    payAmount: 20000,
    taxClass: '1:課税10%',
    costSplit: '計上先：卸、費用負担部署：本社',
  },
  {
    ...BLANK,
    id: 'exp-1-2',
    lineNo: '1-2',
    billAmount: 10000,
    payAmount: 10000,
    taxClass: '1:課税10%',
    costSplit: '計上先：卸、費用負担部署：首都圏営業第一部',
  },
  {
    ...BLANK,
    id: 'exp-2',
    lineNo: 2,
    selectable: true,
    billName: 'アプリエントリー費',
    planExpContent: 'アプリエントリー費',
    product: '-',
    billAmount: 200,
    payAmount: 200,
    planAmount: 200,
    taxRate: 0.1,
    taxClass: '1:課税10%',
    showCostSplit: true,
    mgmtClass: '681 その他',
    mgmtCode: '99999 量販経費追加スーパー',
    planDiff: 0,
    billPage: '①02',
  },
  {
    ...BLANK,
    id: 'exp-3',
    lineNo: 3,
    selectable: true,
    billName: '試飲会費用　30店日',
    planExpContent: '試飲会費用　30店日',
    product: '-',
    billAmount: 800,
    payAmount: 600,
    planAmount: 0,
    taxRate: 0.1,
    taxClass: '1:課税10%',
    showCostSplit: true,
    mgmtClass: '651 試飲会費用',
    mgmtCode: '99999 量販経費追加スーパー',
    planDiff: 600,
    matchType: '2:条件違い',
    billPage: '①02',
  },
  {
    ...BLANK,
    id: 'exp-4',
    lineNo: 4,
    selectable: true,
    showCostSplit: true,
    planDiff: 0,
    billPage: '①02',
  },
  {
    ...BLANK,
    id: 'exp-5',
    lineNo: 5,
    selectable: true,
    showCostSplit: true,
    // 追加口の行番15（三ツ矢サイダーＰＥＴ５００）に合わせて設定
    product: '三ツ矢サイダーＰＥＴ５００',
    billAmount: 0,
    payAmount: 0,
    billPage: '①02',
  },
];

// 数値表示（カンマ区切り、小数1桁まで、空は「-」、文字列はそのまま）
const numFmt = (params: { value: unknown }) => {
  const v = params.value;
  if (v === '' || v === null || v === undefined) return GRID_EMPTY_TEXT;
  if (typeof v === 'number') {
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
};

// 整数表示（小数点以下を四捨五入、カンマ区切り、空は「-」、文字列はそのまま）
const intFmt = (params: { value: unknown }) => {
  const v = params.value;
  if (v === '' || v === null || v === undefined) return GRID_EMPTY_TEXT;
  if (typeof v === 'number') {
    return Math.round(v).toLocaleString();
  }
  return String(v);
};

// 値を数値化する（カンマ区切り文字列も可）。数値化できなければ null。
const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === '' || v === null || v === undefined || v === '-') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

// 明細行の派生項目を Excel「拡売費」表の数式に従って再計算する。
//   計画差異X = 支払金額G − 計画金額H（未承認NET明細は 0 固定）
const recalcExpenseRow = (row: ExpenseRow): void => {
  if (row.isGroup || row.isTotal) return;
  const pay = toNum(row.payAmount);
  const plan = toNum(row.planAmount);
  if (row.isNetUnapproved) {
    row.planDiff = 0;
  } else if (pay !== null && plan !== null) {
    row.planDiff = pay - plan;
  }
};

// ツールチップ用に値を桁区切り文字列へ整形する（数値化できなければそのまま）。
const fmtN = (v: unknown): string => {
  const n = toNum(v);
  return n === null ? String(v ?? '') : n.toLocaleString();
};

// 計算式が設定された列（派生項目）の定義。
//   refs    : ハイライト対象の参照元フィールド（当該行内）。
//   tooltip : 当該行データから計算式テキスト（式＋実値）を生成する。
// Excel「拡売費」表の数式（recalcExpenseRow 参照）に対応する。
const FORMULA_DEFS: Record<
  string,
  {
    refs: (row: ExpenseRow) => string[];
    tooltip: (row: ExpenseRow) => string;
  }
> = {
  // 計画差異X = 支払金額G − 計画金額H（未承認NET明細は 0 固定）
  planDiff: {
    refs: (r) => (r.isNetUnapproved ? [] : ['payAmount', 'planAmount']),
    tooltip: (r) =>
      r.isNetUnapproved
        ? '計画差異 ＝ 0（未承認NET拡売費明細）'
        : `計画差異 ＝ 支払金額 − 計画金額 ＝ ${fmtN(r.payAmount)} − ${fmtN(r.planAmount)}`,
  },
};

// 当該セルが計算式セルか判定する。グループ合計行・総合計行は対象外。
const isFormulaCell = (field: string | undefined, row: ExpenseRow) =>
  !!field && !row.isGroup && !row.isTotal && !!FORMULA_DEFS[field];

// 拡売費一覧の数式を一括適用する。
//  ・未承認NET拡売費合計（グループ）＝追加口O列合計（net.total）
//  ・未承認NET明細の支払金額＝追加口の該当商品のO列（net.byProduct[商品名]）
//  ・各明細の税額・計画差異を再計算
//  ・その他拡売費合計（グループ）＝その他明細の支払金額合計
//  ・総合計（ピン留め）＝未承認NET合計 + その他合計、計画金額＝明細の計画金額合計
const applyExpenseFormulas = (
  api: any,
  net?: { total: number; byProduct: Record<string, number> }
): ExpenseSummary => {
  api.forEachNode((node: any) => {
    const d = node.data as ExpenseRow | undefined;
    if (!d || d.isTotal) return;
    if (d.isGroup) {
      if (d.product === '未承認NET拡売費合計') d.payAmount = net?.total ?? 0;
      return;
    }
    if (d.isNetUnapproved) {
      d.payAmount = net?.byProduct?.[String(d.product)] ?? 0;
    }
    recalcExpenseRow(d);
  });

  // その他拡売費合計＝その他明細（未承認NET以外の明細・分割含む）の支払金額合計
  // 総合計の計画金額＝全明細の計画金額合計
  let otherTotal = 0;
  let planTotal = 0;
  api.forEachNode((node: any) => {
    const d = node.data as ExpenseRow | undefined;
    if (!d || d.isGroup || d.isTotal) return;
    planTotal += toNum(d.planAmount) ?? 0;
    if (!d.isNetUnapproved) otherTotal += toNum(d.payAmount) ?? 0;
  });
  api.forEachNode((node: any) => {
    const d = node.data as ExpenseRow | undefined;
    if (d?.isGroup && d.product === 'その他拡売費合計')
      d.payAmount = otherTotal;
  });

  // 総合計＝未承認NET拡売費合計 + その他拡売費合計
  const grandTotal = (net?.total ?? 0) + otherTotal;
  api.refreshCells({ force: true });

  // タイトル下の合計サマリーバー用に総合計（支払金額・計画金額）を返す
  return { grandPay: grandTotal, grandPlan: planTotal };
};

// 拡売費ヘッダー下の合計サマリーバーの表示値（支払金額・計画金額の総合計）。
type ExpenseSummary = {
  grandPay: number; // 支払金額の合計
  grandPlan: number; // 計画金額の合計
};

// サマリーバー用の数値整形。支払金額は整数、計画金額は小数（最大2桁）。
const fmtPay = (n: number): string => Math.round(n).toLocaleString();
const fmtPlan = (n: number): string =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });

// サマリーバーの初期値（初回描画後は applyExpenseFormulas が再集計して上書き）。
// 未承認NET連動データが未取得の状態（net.total = 0）と同じ計算で明細から求める。
const INITIAL_SUMMARY: ExpenseSummary = EXPENSE_ROWS.reduce(
  (acc, d) => {
    if (d.isGroup || d.isTotal) return acc;
    acc.grandPlan += toNum(d.planAmount) ?? 0;
    if (!d.isNetUnapproved) acc.grandPay += toNum(d.payAmount) ?? 0;
    return acc;
  },
  { grandPay: 0, grandPlan: 0 }
);

// 行IDは行の id（初期行は行番から、追加・分割行は採番した値。→ 画面設計標準 4.7）
const getRowId = (params: GetRowIdParams<ExpenseRow>) => params.data.id;

export function QuoteNonProductExpensePane({
  columnStateKey,
  onOpenEditExpense,
  onOpenCopyExpense,
  onOpenPlanSelection,
  onRevertToAddition,
  netUnapproved,
}: NonProductExpensePaneProps) {
  const [rows] = useState<ExpenseRow[]>(EXPENSE_ROWS);

  // ヘッダー下の合計サマリーバー（支払金額・計画金額の総合計）。
  const [summary, setSummary] = useState<ExpenseSummary>(INITIAL_SUMMARY);

  // 費用分割ペイン（PaymentDetailVending の分割機能を踏襲）。
  // 分割元行を保持し、計上先・費用負担部署・分割金額を入力して分割先行を追加する。
  const [isSplitPaneShown, setIsSplitPaneShown] = useState(false);
  const [splitDest, setSplitDest] = useState('');
  const [splitDept, setSplitDept] = useState('');
  const [splitAmount, setSplitAmount] = useState('');
  const [splitTaxClass, setSplitTaxClass] = useState(TAX_CATEGORY_OPTIONS[0]);
  const splitSourceRef = useRef<ExpenseRow | null>(null);

  // 明細削除確認ダイアログ（PaymentDetailVending の削除ダイアログを踏襲）。
  const [isDeleteDialogShown, setIsDeleteDialogShown] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);

  // AG Grid API（数式の一括適用用）と、最新の未承認NET連動データ。
  const gridApiRef = useRef<any>(null);
  // 追加・分割で作る行の id の連番（初期行の id と重ならないよう接頭辞を分ける）
  const addedRowSeqRef = useRef(0);

  // コピー・追加で増えた行を見つけやすくする（行全体をフラッシュし可視域へ送る）。
  // 追加処理が親側にあり markRows を差し込めないため、行数の増加から自動検出する。
  const reveal = useRevealNewRows({ autoDetect: true });
  const netRef = useRef(netUnapproved);

  // 追加口一覧からの連動データが変わったら、拡売費一覧の数式を再適用する。
  useEffect(() => {
    netRef.current = netUnapproved;
    if (gridApiRef.current) {
      setSummary(applyExpenseFormulas(gridApiRef.current, netUnapproved));
    }
  }, [netUnapproved]);

  // 計算式セルにマウスオーバー中、計算に使われる参照元セル（`field::rowId`）の集合。
  // ref で保持し cellClassRules から最新値を参照、変更時に refreshCells で枠線を反映する。
  const hoverRefsRef = useRef<Set<string>>(new Set());
  const setHoverRefs = (keys: string[]) => {
    const next = new Set(keys);
    const cur = hoverRefsRef.current;
    // 同一集合なら再描画しない（マウス移動中の無駄な再描画を抑止）
    if (cur.size === next.size && [...next].every((k) => cur.has(k))) return;
    hoverRefsRef.current = next;
    gridApiRef.current?.refreshCells({ force: true });
  };

  // 計算式セルにマウスオーバーしたら、計算に使われる参照元セルをハイライト対象にする。
  const handleCellMouseOver = (e: CellMouseOverEvent) => {
    const field = e.colDef?.field;
    const row = e.data as ExpenseRow | undefined;
    if (!field || !row || !isFormulaCell(field, row)) {
      setHoverRefs([]);
      return;
    }
    const rowId = e.node?.id ?? '';
    setHoverRefs(FORMULA_DEFS[field].refs(row).map((f) => `${f}::${rowId}`));
  };

  // セルから外れたらハイライトを解除する。
  const handleCellMouseOut = () => setHoverRefs([]);

  // 編集セルの変更ハイライト（薄い黄背景＋オレンジ枠）の追跡・判定（共通フック → 02 §7.2）。
  // 合計行＝ピン留め行は対象外。
  const { isCellChanged, trackCellChange } = useChangedCells();

  // セル編集時に変更状態を記録し（元値に戻したら強調解除）、当該セルを再描画して強調を反映する。
  const handleCellValueChanged = (params: CellValueChangedEvent) => {
    trackCellChange(params);

    // 入力値の変更に伴い、各行の派生項目（税額・計画差異）とグループ小計・
    // 総合計を Excel「拡売費」表の数式に従って再計算する。
    setSummary(applyExpenseFormulas(params.api, netRef.current));

    params.api.refreshCells({
      rowNodes: [params.node],
      force: true,
    });
  };

  // グループ合計行（未承認NET拡売費合計・その他拡売費合計）・総合計行＋非活性セルのスタイル。
  // 合計行は薄い青（gridStyles の total）、通常データ行（非活性列）は灰（readonly）。
  const groupStyle = asCellStyle((params: any) =>
    params.data?.isGroup || params.data?.isTotal
      ? { fontWeight: 'bold', backgroundColor: GRID_COLORS.total }
      : { backgroundColor: GRID_COLORS.readonly }
  );

  const rightStyle = asCellStyle((params: any) => ({
    ...groupStyle(params),
    textAlign: 'right' as const,
  }));

  // 操作ウィジェット列（追加口へ戻す・販売計画選択・費用分割）用：データ行は白背景。
  // 合計行（グループ合計・総合計）は薄い青。
  const widgetStyle = asCellStyle((params: any) =>
    params.data?.isGroup || params.data?.isTotal
      ? { fontWeight: 'bold', backgroundColor: GRID_COLORS.total }
      : { backgroundColor: GRID_COLORS.editable }
  );

  // 手入力可能セル（数値・右寄せ）。データ行は白（editable）、
  // 入力変更セルは薄い黄背景＋オレンジ枠（gridStyles の changedCellStyle）。
  const inputCellStyle = asCellStyle((params: any) => {
    if (params.data?.isGroup || params.data?.isTotal) return groupStyle(params);
    return isCellChanged(params)
      ? changedCellStyle({ textAlign: 'right' as const })
      : { backgroundColor: GRID_COLORS.editable, textAlign: 'right' as const };
  });

  // 手入力可能セル（テキスト・左寄せ）。データ行は白（editable）、
  // 入力変更セルは薄い黄背景＋オレンジ枠（gridStyles の changedCellStyle）。
  const inputTextStyle = asCellStyle((params: any) => {
    if (params.data?.isGroup || params.data?.isTotal) return groupStyle(params);
    return isCellChanged(params)
      ? changedCellStyle()
      : { backgroundColor: GRID_COLORS.editable };
  });

  // 編集可否（グループ合計行・総合計行は編集不可）。
  const editableExceptSummary = (params: any) =>
    !params.data?.isGroup && !params.data?.isTotal;

  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        // 請求金額：請求書に記載された金額。参照専用（非活性）。
        // 「請求－支払差額」の計算元として持たせる（→ 20260821_第31回 決定事項4）。
        headerName: '請求金額',
        field: 'billAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 96,
        valueFormatter: numFmt,
        cellStyle: rightStyle,
        editable: false,
      },
      {
        headerName: '行番',
        field: 'lineNo',
        width: 56,
        // 横寄せは共通クラスで指定する（→ 02 §6 セルの寄せ）
        cellClass: 'cell-center',
        cellStyle: (p: any) => ({ ...groupStyle(p) }),
      },
      {
        headerName: '卸からの請求名称',
        field: 'billName',
        width: 192,
        editable: editableExceptSummary,
        cellStyle: inputTextStyle,
      },
      {
        headerName: '販売計画選択',
        field: 'planSelect',
        width: 104,
        cellRenderer: PlanSelectCellRenderer,
        sortable: false,
        filter: false,
        cellStyle: widgetStyle,
      },
      {
        headerName: '販売計画に記載の拡売費内容',
        field: 'planExpContent',
        width: 192,
        cellStyle: groupStyle,
      },
      {
        headerName: '商品',
        field: 'product',
        width: 176,
        cellStyle: groupStyle,
      },
      {
        headerName: '支払金額',
        field: 'payAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 96,
        valueFormatter: intFmt,
        cellStyle: inputCellStyle,
        editable: editableExceptSummary,
      },
      {
        // 請求－支払差額（請求金額 − 支払金額）。追加口明細と同じ位置づけの参照専用列。
        // 20260821_第31回 決定事項4 により、拡売費明細の「差異理由」を廃止して追加した。
        headerName: '請求－支払差額',
        colId: 'billPayDiff',
        field: 'billPayDiff',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 104,
        valueGetter: (p: any) =>
          billPayDiffOf(p.data as ExpenseRow | undefined),
        valueFormatter: numFmt,
        cellStyle: rightStyle,
        editable: false,
      },
      {
        // 照合支払区分（活性）。追加口明細と同じ選択肢を使う。
        headerName: '照合支払区分',
        field: 'matchType',
        width: 104,
        cellStyle: inputTextStyle,
        editable: editableExceptSummary,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          comboOptions: MATCH_TYPE_COMBO_OPTIONS,
          placeholder: '照合支払区分を選択',
        },
      },
      {
        headerName: '計画金額',
        field: 'planAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 96,
        valueFormatter: numFmt,
        cellStyle: rightStyle,
      },
      {
        headerName: '税区分',
        field: 'taxClass',
        width: 72,
        editable: editableExceptSummary,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: TAX_CATEGORY_OPTIONS },
        cellStyle: inputTextStyle,
      },
      {
        headerName: '分割状況',
        field: 'costSplit',
        width: 88,
        editable: false,
        cellRenderer: CostSplitCellRenderer,
        sortable: false,
        filter: false,
        cellStyle: groupStyle,
      },
      {
        headerName: '管理区分（用途）',
        field: 'mgmtClass',
        width: 160,
        cellStyle: groupStyle,
      },
      {
        headerName: '管理コード（投資責任）',
        field: 'mgmtCode',
        width: 160,
        cellStyle: groupStyle,
      },
      {
        headerName: '施策区分',
        field: 'measureClass',
        width: 96,
        cellStyle: inputTextStyle,
        editable: editableExceptSummary,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          // 名称（上）・施策区分（下）の2行で、両方の行で絞り込める共通の選択肢
          comboOptions: campaignClassComboOptions(),
          placeholder: '施策区分を選択',
        },
      },
      {
        headerName: '施策コード',
        field: 'measureCode',
        width: 96,
        cellStyle: inputTextStyle,
        editable: editableExceptSummary,
        cellEditor: SingleComboboxCellEditor,
        cellEditorPopup: true,
        cellEditorParams: {
          // コード（上）・施策コード名称（下）の2行で、両方の行で絞り込める共通の選択肢
          comboOptions: campaignCodeComboOptions(),
          placeholder: '施策コードを選択',
        },
      },
      {
        headerName: '稟議決裁番号',
        field: 'approvalNo',
        width: 96,
        cellStyle: inputTextStyle,
        editable: editableExceptSummary,
      },
      {
        headerName: '稟議決裁日',
        field: 'approvalDate',
        ...GRID_DATE_TEXT_FILTER,
        width: 96,
        cellStyle: inputTextStyle,
        editable: editableExceptSummary,
        cellEditor: DateMonthYearCellEditor,
        // 任意項目のため×でクリアできるようにする
        cellEditorParams: { clearable: true },
        cellEditorPopup: true,
      },
      {
        headerName: '摘要1（社内用）',
        field: 'summary1',
        width: 128,
        cellStyle: inputTextStyle,
        editable: editableExceptSummary,
      },
      {
        headerName: '摘要2（社外用）',
        field: 'summary2',
        width: 128,
        cellStyle: inputTextStyle,
        editable: editableExceptSummary,
      },
      {
        headerName: '勘定科目別金額',
        field: 'accountAmount',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 104,
        valueFormatter: numFmt,
        cellStyle: inputCellStyle,
        editable: editableExceptSummary,
      },
      {
        headerName: '計画差異',
        field: 'planDiff',
        ...GRID_NUMBER_TEXT_FILTER,
        width: 88,
        valueFormatter: numFmt,
        cellStyle: rightStyle,
      },
      {
        headerName: '請求書番号',
        field: 'billNo',
        width: 104,
        cellStyle: groupStyle,
      },
      {
        headerName: '請求書ページ',
        field: 'billPage',
        width: 88,
        // 横寄せは共通クラスで指定する（→ 02 §6 セルの寄せ）
        cellClass: 'cell-center',
        cellStyle: (p: any) => ({ ...groupStyle(p) }),
      },
      {
        headerName: '販売促進金摘要コード設定有無',
        field: 'promoSummaryCode',
        width: 160,
        // 明細行は「設定なし」を表示（グループ合計行・総合計行は対象外）
        valueGetter: (p: any) =>
          p.data?.isGroup || p.data?.isTotal ? '' : '設定なし',
        // 横寄せは共通クラスで指定する（→ 02 §6 セルの寄せ）
        cellClass: 'cell-center',
        cellStyle: (p: any) => ({ ...groupStyle(p) }),
      },
      // 行アクション（編集・コピー・削除）を最右列に固定表示
      {
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        colId: 'actions',
        width: 56,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 列定義は最初の描画で1回だけ作る（作り直すと列幅・並びが戻る）。中のセルの書式の関数が読むのは描画で変わらない値（変更ハイライトの判定・ref・モジュールの関数）だけ
    []
  );

  const defaultColDef: ColDef = useMemo(
    () => ({
      // 共通の既定列定義（grid/）。ソート/リサイズ/フィルター、ヘッダーの…メニュー・
      // フィルターボタン非表示、tooltip を内包。フィルターは右クリックメニューから開く。
      ...GRID_DEFAULT_COL_DEF,
      // 合計行・グループ行の文字列が数値型と推論されるのを防ぐ
      cellDataType: false,
      // 計算式セルは計算式テキストを、それ以外は従来どおりセル値をツールチップ表示する。
      tooltipValueGetter: (params) => {
        // セルのツールチップでは colDef は列（ColDef）。列グループ（ColGroupDef）は来ない
        const field = (params.colDef as ColDef).field;
        const row = params.data as ExpenseRow | undefined;
        if (field && row && isFormulaCell(field, row)) {
          return FORMULA_DEFS[field].tooltip(row);
        }
        return params.value ?? '';
      },
      // マウスオーバー中の計算式セルの参照元セル（`field::rowId`）に枠線を付ける。
      cellClassRules: {
        // 共通の決まり（値が無いセルを灰色の「-」にする cell-empty など）を引き継ぐ（→ UI/UX UX-080）
        ...GRID_DEFAULT_COL_DEF.cellClassRules,
        'formula-ref-highlight': (params) => {
          // セルのツールチップでは colDef は列（ColDef）。列グループ（ColGroupDef）は来ない
          const field = (params.colDef as ColDef).field;
          const rowId = params.node?.id ?? '';
          return !!field && hoverRefsRef.current.has(`${field}::${rowId}`);
        },
      },
    }),
    []
  );

  // 費用分割ボタン押下：対象行を分割元として費用分割ペインを開く
  const handleOpenSplit = (row: ExpenseRow) => {
    splitSourceRef.current = row;
    setSplitDest('');
    setSplitDept('');
    setSplitAmount('');
    // 税区分の初期値は分割元の値（未設定なら先頭の選択肢）
    setSplitTaxClass(String(row.taxClass) || TAX_CATEGORY_OPTIONS[0]);
    setIsSplitPaneShown(true);
  };

  // 費用分割の確定：分割元行の直下（既存の分割先行の後）へ分割先行を1行追加する。
  // 分割先行の行番は「親番号-子番号」形式（子番号は分割元ごとに1から採番）。
  const handleSplitSubmit = () => {
    const api = gridApiRef.current;
    const source = splitSourceRef.current;
    if (!api || !source) return;
    const nodes: any[] = [];
    api.forEachNode((n: any) => nodes.push(n));
    const srcIdx = nodes.findIndex((n) => n.data === source);
    // 分割元の直下に続く既存の分割先行（行番「親番号-子番号」）を走査し、
    // 挿入位置（最後の分割先行の直後）と子番号の最大値を求める。
    const parentNo = String(source.lineNo ?? '');
    const childPrefix = `${parentNo}-`;
    let insertAt = srcIdx + 1;
    let maxChild = 0;
    while (insertAt < nodes.length) {
      const ln = String(nodes[insertAt].data?.lineNo ?? '');
      if (!ln.startsWith(childPrefix)) break;
      const child = Number(ln.slice(childPrefix.length));
      if (Number.isFinite(child)) maxChild = Math.max(maxChild, child);
      insertAt++;
    }
    const destRow: ExpenseRow = {
      ...BLANK,
      id: `exp-added-${++addedRowSeqRef.current}`,
      lineNo: `${parentNo}-${maxChild + 1}`,
      payAmount: Number(splitAmount) || 0,
      taxClass: splitTaxClass,
      costSplit: `計上先：${splitDest}、費用負担部署：${splitDept}`,
    };
    api.applyTransaction({
      add: [destRow],
      addIndex: srcIdx < 0 ? undefined : insertAt,
    });
    setSummary(applyExpenseFormulas(api, netRef.current));
    setIsSplitPaneShown(false);
  };

  // 削除ボタン押下：対象行を保持して削除確認ダイアログを開く
  const handleOpenDelete = (row: ExpenseRow) => {
    setDeleteTarget(row);
    setIsDeleteDialogShown(true);
  };

  // 削除確定：対象行をグリッドから削除し、合計を再計算する
  const handleConfirmDelete = () => {
    const api = gridApiRef.current;
    if (api && deleteTarget) {
      api.applyTransaction({ remove: [deleteTarget] });
      setSummary(applyExpenseFormulas(api, netRef.current));
    }
    setIsDeleteDialogShown(false);
    setDeleteTarget(null);
  };

  const gridContext = {
    onSelectPlan: (data: ExpenseRow) => onOpenPlanSelection?.(data),
    onSplitCost: (data: ExpenseRow) => handleOpenSplit(data),
    onRevert: (data: ExpenseRow) => onRevertToAddition?.(data),
    // 行アクション：編集・コピーは右ペイン、削除は確認ダイアログを開く。
    // 編集は拡売費グリッドの編集可能項目を扱うため明細行をそのまま渡す
    onEditRow: (data: ExpenseRow) => onOpenEditExpense?.(data),
    onCopyRow: (data: ExpenseRow) => onOpenCopyExpense?.(data),
    onDeleteRow: (data: ExpenseRow) => handleOpenDelete(data),
    // 行追加：拡売費明細行を明細の最下行に1行追加する（→ 02 §8「行の追加位置」・UX-112）
    onAddRow: () => {
      const api = gridApiRef.current;
      if (!api) return;
      // 既存明細の最大行番 + 1 を採番する（「分割」等の非数値行は除外）
      let maxLineNo = 0;
      api.forEachNode((node: any) => {
        if (node.data?.isTotal || node.data?.isGroup) return;
        const n = Number(node.data?.lineNo);
        if (Number.isFinite(n)) maxLineNo = Math.max(maxLineNo, n);
      });
      const newRow: ExpenseRow = {
        ...BLANK,
        id: `exp-added-${++addedRowSeqRef.current}`,
        selectable: true,
        showCostSplit: true,
        lineNo: maxLineNo + 1,
      };
      api.applyTransaction({ add: [newRow] });
      setSummary(applyExpenseFormulas(api, netRef.current));
    },
  };

  // ヘッダー下の合計サマリーバーの表示値（支払金額・計画金額の総合計）。
  const summaryTotals = useMemo(
    () => [
      { label: '支払金額', value: fmtPay(summary.grandPay) },
      { label: '計画金額', value: fmtPlan(summary.grandPlan) },
    ],
    [summary]
  );

  // 列幅・並び・ソートの状態を保存／復元する（→ 02 §7 列状態の永続化）
  const expenseGridColumnStateProps = useGridColumnState(columnStateKey, {
    // グリッド独自の初期化は、フックが列の状態を復元した後に呼ぶ
    onGridReady: (p) => {
      gridApiRef.current = p.api;
      // 初期表示時に数式を一括適用する。
      setSummary(applyExpenseFormulas(p.api, netRef.current));
    },
  });
  return (
    <div className={`${CARD_CLASS} p-4`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={CARD_TITLE_CLASS}>拡売費</h2>
        <div className="flex items-center gap-2">
          <button
            className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} flex items-center gap-2 px-3 py-1 whitespace-nowrap text-sm`}
            aria-label="添付資料登録"
          >
            {/* onClick={onImport} */}
            <Upload className="h-4 w-4" />
            添付資料登録
          </button>
          <button
            className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} flex items-center gap-2 px-3 py-1 whitespace-nowrap text-sm`}
            aria-label="明細追加"
            onClick={() => gridContext.onAddRow()}
          >
            <Plus className="h-4 w-4" />
            明細追加
          </button>
        </div>
      </div>

      {/* 合計サマリーバー（支払金額・計画金額の総合計） */}
      <div className="mb-4">
        <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {/* 合計ラベル（全高・左揃え） */}
          <div className="flex shrink-0 items-center border-r border-gray-200 px-4 text-left text-sm font-bold text-gray-900 whitespace-nowrap">
            合計
          </div>
          {/* 総合計（支払金額／計画金額） */}
          {summaryTotals.map((item) => (
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

      {/* 1920x1080 のPCでグリッドが画面いっぱいに収まる高さ（カード見出し等は
          スクロールアウトしてよい方針）。minHeight は小さい画面での下限。 */}
      <div
        className="expense-grid"
        style={{
          height: viewportGridHeight(10),
          minHeight: '25rem',
          width: '100%',
        }}
      >
        {/* 罫線・ヘッダ背景・行高は共通テーマ（GRID_THEME）に委譲。 */}
        <style>{`
          /* 計算式セルにホバー中、計算に使われる参照元セルの枠線ハイライト */
          .expense-grid .ag-cell.formula-ref-highlight {
            box-shadow: inset 0 0 0 2px var(--grid-source-highlight-border);
          }
        `}</style>
        <AgGridReact
          {...expenseGridColumnStateProps}
          onRowDataUpdated={reveal.onRowDataUpdated}
          rowData={rows}
          getRowId={getRowId}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
          tooltipShowMode="standard"
          getContextMenuItems={gridFilterContextMenuItems}
          onCellValueChanged={handleCellValueChanged}
          onCellMouseOver={handleCellMouseOver}
          onCellMouseOut={handleCellMouseOut}
          context={gridContext}
          suppressMovableColumns={true}
          ensureDomOrder={true}
          statusBar={GRID_STATUS_BAR}
          {...GRID_BASE_PROPS}
        />
      </div>

      {/* 費用分割ペイン（PaymentDetailVending の分割機能を踏襲） */}
      <RightPane
        open={isSplitPaneShown}
        onClose={() => setIsSplitPaneShown(false)}
        title="費用分割"
        description="拡売費明細を分割します"
        footer={
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleSplitSubmit}
          >
            分割
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2">
          {/* 計上先 */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              計上先 <RequiredBadge />
            </Label>
            <Input
              aria-required="true"
              value={splitDest}
              onChange={(e) => setSplitDest(e.target.value)}
              placeholder="計上先を入力"
              className={`${TEXT_INPUT_CLASS} w-full`}
            />
          </div>

          {/* 費用負担部署 */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              費用負担部署 <RequiredBadge />
            </Label>
            <Input
              aria-required="true"
              value={splitDept}
              onChange={(e) => setSplitDept(e.target.value)}
              placeholder="費用負担部署を入力"
              className={`${TEXT_INPUT_CLASS} w-full`}
            />
          </div>

          {/* 分割金額 */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              分割金額(円) <RequiredBadge />
            </Label>
            <NumericInput
              aria-required="true"
              value={splitAmount}
              step="1"
              onChange={(e) => setSplitAmount(toIntegerString(e.target.value))}
              placeholder="例: 20000"
              className="w-full bg-white border-gray-400 shadow-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 税区分 */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">税区分</Label>
            <SingleCombobox
              className="w-full"
              options={[
                ...TAX_CATEGORY_OPTIONS.map((opt) => ({
                  value: opt,
                  label: opt,
                })),
              ]}
              value={splitTaxClass}
              onChange={setSplitTaxClass}
              placeholder="税区分を選択"
              searchable={false}
            />
          </div>
        </div>
      </RightPane>

      {/* 明細削除確認ダイアログ（PaymentDetailVending の削除ダイアログを踏襲） */}
      <Dialog open={isDeleteDialogShown} onOpenChange={setIsDeleteDialogShown}>
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
                <strong>卸からの請求名称:</strong>{' '}
                {String(deleteTarget.billName) || '（未設定）'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>支払金額(円):</strong>{' '}
                {Number.isFinite(Number(deleteTarget.payAmount))
                  ? Number(deleteTarget.payAmount).toLocaleString('en-US')
                  : String(deleteTarget.payAmount)}
              </p>
            </div>
          )}
          <DialogFooter>
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
  );
}

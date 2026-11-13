import { RefreshCw } from 'lucide-react';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  CellClassParams,
  CellValueChangedEvent,
  GetRowIdParams,
  GridApi,
} from 'ag-grid-community';

import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { NumericInput } from '@/app/components/ui/numeric-input';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import { CommentHistoryPane } from '@/app/components/shared/common/CommentHistoryPane';
import { AggregationPane } from './components/AggregationPane';
import { BasicInfoCard } from './components/BasicInfoCard';
import { PlanDetailFooter } from './components/PlanDetailFooter';
import {
  GRID_BASE_PROPS,
  GRID_COLORS,
  GRID_DEFAULT_COL_DEF,
  GRID_WRAP_HEADER_COL_DEF,
  revertNonNumericValueParser,
  isEmptyCellDisplay,
  GRID_EMPTY_TEXT,
  useGridColumnState,
  readSavedColumnState,
  saveGridColumnState,
  GRID_NO_FILTER_COLUMN_TYPES,
  useChangedCells,
  withComparableCellValues,
  gridHeaderStyle,
  FloatingFormulaTooltip,
  type FloatingFormulaTooltipValue,
} from '@/app/components/grid';
import { FORM_LABEL_CLASS, TEXT_INPUT_CLASS } from '@/styles/commonStyles';
import { ScreenTitle } from '@/app/components/ui/screen-title';
import { valueOrEmpty } from '@/app/components/ui/empty-value';
import {
  PREV_YEAR_SHIPPING_WORKING_DAYS,
  SALES_PLAN_BASELINE_ROWS,
  createSalesPlanInitialRows,
} from '@/mocks/sales-plan/plan-detail-vending/salesPlan';
import {
  EXPENSE_BASELINE,
  createExpensePlanInitialRows,
} from '@/mocks/sales-plan/plan-detail-vending/expense';
import { createCommentHistory } from '@/mocks/sales-plan/plan-detail-vending/commentHistory';
import {
  EXPENSE_RECALC_ROW_ORDER,
  EXPENSE_CROSS_GRID_REF_MAP,
  CLICK_HIGHLIGHT_BORDER,
  REF_HIGHLIGHT_BORDER,
  DEP_HIGHLIGHT_BORDER,
  REF_HIGHLIGHT_STYLE,
  ACTUAL_MODE_TOOLTIP,
  DIFF_MODE_TOOLTIP,
} from './constants';
import {
  bfs,
  calcHeaderDiff,
  computeHeaderDependents,
  computeHeaderRefs,
  computeSalesPlanCol1,
  computeSalesPlanCol6,
  excelRefToCellId,
  expenseExcelRefToCellId,
  expenseFormulaDesc,
  formatDecimal1,
  getRowStyle,
  isCellTrigger,
  isHighlightTrigger,
  parseFormulaReferences,
} from './utils';
import { buildSalesPlanColumnDefs } from './utilsSalesPlanColumns';
import { buildExpensePlanColumnDefs } from './utilsExpensePlanColumns';
import { ScreenLinkButton } from '@/app/components/shared/common/ScreenLinkButton';
import { FormulaGuideToggle } from '@/app/components/shared/common/FormulaGuideToggle';
import { HeaderDivider } from '@/app/components/shared/common/HeaderDivider';
import { SegmentToggle } from '@/app/components/shared/common/SegmentToggle';
import { useAppNavigation } from '@/app/components/ui/use-app-navigation';

// 値の全角「－」（比較対象なし等の目印として値に持つ）は、表示だけ半角「-」にそろえる
// （画面設計標準 3.11。グレーは defaultColDef の cellClassRules 'cell-empty'）。
const toHalfWidthDash = (text: string): string =>
  text === '－' ? GRID_EMPTY_TEXT : text;
// 共通の既定列設定のルールを流用する：値が無いセルの「-」をグレーにする（cell-empty）と、
// 値を変えたセルを薄い黄＋オレンジ枠にする（ag-cell-changed。判定はグリッドの context.isCellChanged → 02 §7.2）
const CELL_CLASS_RULES = {
  // 比の列（前月比など）は値を持たず、cellRenderer が計算式（`${field}_formula`）から
  // 比を計算して表示するため、計算式のあるセルは値が空でもグレー（cell-empty）にしない
  'cell-empty': (p: CellClassParams) =>
    !p.data?.[`${p.colDef?.field ?? ''}_formula`] && isEmptyCellDisplay(p),
  'ag-cell-changed': GRID_DEFAULT_COL_DEF.cellClassRules!['ag-cell-changed'],
};

// 列状態（列幅・列の表示/非表示）の保存キー。画面・グリッドごとに一意にする。
// 列構成を変えたら末尾のバージョンを上げる（旧状態だと新列が末尾に回るため）。
// ※ 初回アクセスの自動列幅調整は「保存済みの列設定が無いこと」を条件に実行するため、
//   既定の列幅を変えたときもバージョンを上げて旧設定を破棄する。
const SALES_PLAN_COLUMN_STATE_KEY = 'salesPlanVending.salesPlan.columnState.v8';
const EXPENSE_PLAN_COLUMN_STATE_KEY =
  'salesPlanVending.expensePlan.columnState.v3';

// 販売計画グリッドの初期非表示列（＝全社設定）。列定義側で hide: true を宣言しており、
// ヘッダー右クリックの「列設定をリセット」でもこの状態へ戻る。
// 初回表示時は「全列を表示した状態で自動列幅調整 → これらを非表示に戻す」ことで、
// 後から再表示したときにも第三階層タイトルが折り返さない幅を確保しておく。
const SALES_PLAN_INITIAL_HIDDEN_COLS = [
  'col21',
  'col2',
  'col4',
  'col22',
  'col23',
  'col24',
  'col7',
  'col9',
  'col10',
  'col20',
];

// 販売計画・経費計画グリッドの行ID（→ 画面設計標準 4.7）。行区分名 category は
// 各グリッドの全行で一意かつ編集しない。固定上段（単位行）は pinned- を付けて区別する。
const getPlanRowId = (params: GetRowIdParams) =>
  params.rowPinned
    ? `pinned-${params.data.category}`
    : String(params.data.category);

// 列の表示/非表示イベント（columnVisible）のうち、利用者が列選択UIで操作したものを表す
// 発生元（AG Grid の ColumnEventType）。列状態の復元や画面側の applyColumnState は
// 発生元が 'api' で、これを自動サイズ調整の契機にすると保存済みの列幅を上書きしてしまう。
const COLUMN_SELECT_SOURCES = new Set([
  'columnMenu', // 列メニューの列選択
  'contextMenu', // ヘッダー右クリックメニュー
  'toolPanelUi', // 列ツールパネル
  'uiColumnDragged', // ツールパネルからのドラッグ
]);

// 初期非表示列をまとめて表示／非表示にする列状態（applyColumnState の state 用）。
const salesPlanHiddenColsState = (hide: boolean) =>
  SALES_PLAN_INITIAL_HIDDEN_COLS.map((colId) => ({ colId, hide }));

// 販売計画/経費計画グリッドに共通する AG Grid 表示上書き CSS を生成する。
// prefix はグリッドのラッパー class（'sales-plan-grid' / 'expense-plan-grid'）。
// px は使わず rem に統一する（枠線 1px 例外を除く）。グリッド固有のルール
// （合計行・col17 白背景／転置後の行インデックス別インデント等）は各 <style> 側に置く。
const gridOverrideStyles = (prefix: string) => `
  /* （見出しの背景色・文字色は共通テーマ GRID_THEME に委ねる → 02 §7「ヘッダーの配色」・UI/UX UX-031） */
  .${prefix} .ag-header-cell-menu-button { display: none !important; }
  /* データ行は themeBalham 本来の表示を継承し、レイアウト（横余白）のみ指定する。 */
  .${prefix} .ag-cell { padding: 0 0.5rem; transition: background-color 0.2s ease; }
  /* ホバー：手売りと同じく、編集可(白)・編集不可(灰)・合計(薄青)のセルも含め行全体を薄青にする（→ UI/UX UX-082）。 */
  .${prefix} .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell { background-color: var(--grid-row-hover) !important; }
  .${prefix} .ag-cell-left-pinned { background-color: inherit !important; }
  .${prefix} .ag-cell-right { text-align: right; justify-content: flex-end; }
  .${prefix} .ag-cell-left { text-align: left !important; justify-content: flex-start !important; display: flex !important; align-items: center !important; }
  .${prefix} .ag-cell-left .ag-cell-wrapper { justify-content: flex-start !important; text-align: left !important; }
  .${prefix} .ag-cell-left .ag-cell-value { text-align: left !important; justify-content: flex-start !important; }
  /* カテゴリー列（最初の列）を強制的に左寄せ（padding は各グリッド固有ルールで指定）。 */
  .${prefix} .ag-cell[col-id="category"] { text-align: left !important; justify-content: flex-start !important; }
  .${prefix} .ag-cell[col-id="category"] .ag-cell-wrapper { justify-content: flex-start !important; }
  .${prefix} .ag-row:not(.ag-row-pinned) .ag-cell[col-id="category"] { text-align: left !important; justify-content: flex-start !important; }
  /* 固定上段（単位の行）の太字・下罫線。
     ※ AG Grid が固定行へ付与するクラスは ag-row-pinned。ag-row-pinned-top は
        存在せず、指定が効かないため使わない。
     ※ 行の背景はセル側（下の .ag-floating-top .ag-cell）がテーマのヘッダー色で
        塗り潰すため指定しない（実績登録の同じ行と指定を揃える）。 */
  .${prefix} .ag-row-pinned { font-weight: bold; border-bottom: 0.125rem solid var(--grid-pinned-row-border); }
  /* 単位の行（固定上段）を themeBalham のヘッダー用変数に束ねる。 */
  .${prefix} .ag-floating-top .ag-cell { background-color: var(--ag-header-background-color) !important; color: var(--ag-header-text-color, var(--ag-header-foreground-color)); font-weight: var(--ag-header-font-weight, 600); }
  /* ヘッダーテキストの折り返しを有効化 */
  .${prefix} .ag-header-cell-text { white-space: normal !important; line-height: 1.3 !important; word-break: break-word !important; }
  .${prefix} .ag-header-group-cell-label { white-space: normal !important; line-height: 1.3 !important; word-break: break-word !important; }
  .${prefix} .ag-header-cell-label { white-space: normal !important; line-height: 1.3 !important; word-break: break-word !important; }
`;

// マウスオーバー時のツールチップ（画面設計標準準拠）を列定義へ付与するヘルパー。
// ・ヘッダー：列幅で省略された見出しを全文表示（AG Grid公式 headerTooltip）。
// ・セル：常に表示しているセルの文字を出す（数式が設定されたセルでも、書式を通した表示の値）。
//   数式はクリック時の数式ガイド（浮遊表示）でのみ表示するため、各列の数式getterは
//   formulaSink（field → getter）へ退避し、クリックハンドラから参照する。
const headerTooltipOf = (col: any) =>
  typeof col.headerName === 'string' && col.headerName
    ? col.headerName
    : col.headerTooltip;

function addStandardCellTooltips(
  cols: any[],
  sharedFormulaGetter?: (params: any) => string | null,
  formulaSink?: Map<string, (params: any) => string | null>
): any[] {
  return cols.map((col) => {
    if (col.children) {
      return {
        ...col,
        headerTooltip: headerTooltipOf(col),
        children: addStandardCellTooltips(
          col.children,
          sharedFormulaGetter,
          formulaSink
        ),
      };
    }
    // 各列の数式getter（無ければ共有の数式getter）をクリック時の数式ガイド用に退避。
    const formulaGetter = col.tooltipValueGetter ?? sharedFormulaGetter ?? null;
    if (formulaSink && formulaGetter && col.field) {
      formulaSink.set(col.field, formulaGetter);
    }
    return {
      ...col,
      headerTooltip: headerTooltipOf(col),
      // ホバー時は常に表示しているセルの文字を出す（標準準拠）。数式の有無・数式ガイドの状態に依らない。
      // 計算した生の値（例：172.41666…）ではなく、書式を通した表示の値（例：172）を出す（→ UI/UX UX-083）。
      tooltipValueGetter: (params: any) => {
        if (params.valueFormatted != null) return String(params.valueFormatted);
        // 比の列など、描画（cellRenderer）で「小数第1位＋%」に整えて出す値は同じ形にそろえる
        //（AG Grid はツールチップの文字をセルを描くときに求めるため、表示の文字は読めない）
        if (
          typeof params.value === 'string' &&
          /^-?[\d,.]+%$/.test(params.value)
        ) {
          const n = parseFloat(params.value.replace(/[,%]/g, ''));
          if (!isNaN(n)) return formatDecimal1(n) + '%';
        }
        // 列の書式が無いときは defaultColDef の書式（params.colDef は既定とまとめた列定義）を使う
        const formatter = col.valueFormatter ?? params.colDef?.valueFormatter;
        if (typeof formatter === 'function') {
          const text = formatter(params);
          if (text != null) return String(text);
        }
        return params.value != null ? String(params.value) : '';
      },
    };
  });
}

// ※ 下の2つは定数のため部品の外に置く（列定義の useMemo から参照しても依存に入れなくてよい）
// 販売計画差分表示の基準データ（image-3.png のスナップショット）
// 数値型は数字、"－"のセルは文字列 "－"
const salesPlanBaselineData = SALES_PLAN_BASELINE_ROWS;

// 経費計画差分表示の基準データ（image-4.png のスナップショット）
// rowIndex は expensePlanData の行インデックスに対応
// ※ データ種の区切り行（1=営業経費／14=自販機関係費）は値を持たないため基準データも持たない
// 転置後の rowIndex は expensePlanData の行（経費項目）に対応
// フィールドは各列（catPlan=計画金額, catHonsha=本社, ... catZennenHi=前年同月比）
const expenseBaselineData = EXPENSE_BASELINE;

export default function PlanDetailVending() {
  // 画面の切り替え（→ ui/use-app-navigation）
  const navigate = useAppNavigation();
  // 「一覧へ戻る」押下時の確認ダイアログ表示状態
  const [isBackConfirmShown, setIsBackConfirmShown] = useState(false);
  const [isSalesPlanOpen, setIsSalesPlanOpen] = useState(true);
  const [isExpensePlanOpen, setIsExpensePlanOpen] = useState(true);

  const [highlightedCells, setHighlightedCells] = useState<string[]>([]);
  const highlightedCellsRef = useRef<string[]>([]);
  const gridRef = useRef<any>(null);
  // 数式ガイド
  const [isFormulaGuideShown, setIsFormulaGuideShown] = useState(false);
  const showFormulaGuideRef = useRef(false);
  // クリックした起点セル（青で強調）。販売/経費どちらのグリッドかも保持する。
  const [clickedCell, setClickedCell] = useState<{
    grid: 'sales' | 'expense';
    cellKey: string;
  } | null>(null);
  const clickedCellRef = useRef<{
    grid: 'sales' | 'expense';
    cellKey: string;
  } | null>(null);
  // クリック時に表示する浮遊ツールチップ
  const [formulaTooltip, setFormulaTooltip] =
    useState<FloatingFormulaTooltipValue | null>(null);

  const [expenseHighlightedCells, setExpenseHighlightedCells] = useState<
    string[]
  >([]);
  const expenseHighlightedCellsRef = useRef<string[]>([]);
  const expenseGridRef = useRef<any>(null);
  // 計画金額行（row 0）の計算済み値キャッシュ（比行 cellRenderer が参照）
  const expenseRow0Cache = useRef<Record<string, number>>({});
  // 経費計画：依存セルのオレンジハイライト（起点セル変化時に影響を受けるセル）
  const [expenseDependentHighlights, setExpenseDependentHighlights] = useState<
    string[]
  >([]);
  const expenseDependentHighlightsRef = useRef<string[]>([]);
  // 販売計画：依存セルのオレンジハイライト
  const [salesDependentHighlights, setSalesDependentHighlights] = useState<
    string[]
  >([]);
  const salesDependentHighlightsRef = useRef<string[]>([]);
  // グリッド外のヘッダー項目のオレンジハイライト
  const [headerDependentHighlights, setHeaderDependentHighlights] = useState<
    Set<string>
  >(new Set());
  // グリッド外のヘッダー項目の緑ハイライト（クリックしたセルの数式が参照している項目）。
  // グリッド内の参照セルは highlightedCells（セルID）で扱うが、ヘッダー項目はセルIDを
  // 持たないため別枠で保持する。
  const [headerRefHighlights, setHeaderRefHighlights] = useState<Set<string>>(
    new Set()
  );

  // 実数/差分表示切り替え
  const [isDiffMode, setIsDiffMode] = useState(false);

  // コメント機能
  const [isCommentPanelOpen, setIsCommentPanelOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  // コメント履歴ペインのモックデータ（販売計画の流れ：未申請 → 承認待ち → 差戻し → 承認待ち → 承認済み → 確定）。
  // actionType は行った操作、status はその操作の後の計画ステータス。共通部品 CommentHistoryPane で表示する（UI/UX UX-075）。
  const [commentHistory] = useState(createCommentHistory);
  const isDiffModeRef = useRef(false);

  // 値を変えたセルの強調（薄い黄＋オレンジ枠。元の値に戻したら解除 → 02 §7.2）。グリッドごとに1つ。
  // 数式で計算し直したセルは対象外（利用者が編集したセルだけ）。
  // ※ 保存の処理はまだ無いため、保存確定時の resetChangedCells は保存を作るときに入れる。
  const salesPlanChanged = useChangedCells();
  const expensePlanChanged = useChangedCells();
  const salesPlanGridContext = useMemo(
    () => ({ isCellChanged: salesPlanChanged.isCellChanged }),
    [salesPlanChanged.isCellChanged]
  );
  const expensePlanGridContext = useMemo(
    () => ({ isCellChanged: expensePlanChanged.isCellChanged }),
    [expensePlanChanged.isCellChanged]
  );
  // 編集の確定（元に戻す・やり直しを含む）で変更を記録し、そのセルの強調を描き直す。
  // 列ごとの onCellValueChanged（再計算）は列定義側でそのまま動く。
  const handleSalesPlanCellValueChanged = useCallback(
    (e: CellValueChangedEvent) => {
      salesPlanChanged.trackCellChange(withComparableCellValues(e));
      e.api.refreshCells({
        rowNodes: [e.node],
        columns: [e.column],
        force: true,
      });
    },
    [salesPlanChanged]
  );
  const handleExpensePlanCellValueChanged = useCallback(
    (e: CellValueChangedEvent) => {
      expensePlanChanged.trackCellChange(withComparableCellValues(e));
      e.api.refreshCells({
        rowNodes: [e.node],
        columns: [e.column],
        force: true,
      });
    },
    [expensePlanChanged]
  );

  // 列状態（列幅・列の表示/非表示）の保存／復元（共通フック）。
  // 初回表示のみ既定の列設定（全社設定）を onFirstDataRendered で適用するため、
  // フック側の自動列幅調整（autoSizeStrategy）は使わない。
  const salesPlanColumnStateProps = useGridColumnState(
    SALES_PLAN_COLUMN_STATE_KEY,
    { autoSize: false }
  );
  const expensePlanColumnStateProps = useGridColumnState(
    EXPENSE_PLAN_COLUMN_STATE_KEY,
    { autoSize: false }
  );

  // 既定（全社設定）の列レイアウトを適用して保存する。
  // 初回アクセス時と、AG Grid の「列設定をリセット」実行後の両方から呼び、
  // どちらも「全列を自動サイズ調整した状態」にそろえる。
  // ※ リセットは列定義どおりの幅（colDef.width）と表示/非表示に戻すだけで、
  //   自動サイズ調整は行われないため、ここで明示的に掛け直す。
  const applySalesPlanDefaultLayout = useCallback((api: GridApi) => {
    // 列の幅は値に合わせて自動調整する（skipHeader=true。長い見出しは wrapHeaderText で折り返すため
    // 見出しの幅は数えない。基準 OS 150%＝幅 1280px でも横幅に入りきるように → UX-062）。
    // 1. 初期非表示列も一時的に表示して自動調整する（後から再表示したときの幅を確保しておくため）。
    api.applyColumnState({
      state: salesPlanHiddenColsState(false),
      applyOrder: false,
    });
    api.autoSizeAllColumns(true);
    // 2. 初期非表示列を隠す（＝列定義の hide: true と同じ状態に戻す）
    api.applyColumnState({
      state: salesPlanHiddenColsState(true),
      applyOrder: false,
    });
    // 3. 非表示を反映した状態で再度自動調整する（可視列だけが対象。非表示列は 1. の幅が保持される）。
    api.autoSizeAllColumns(true);
    // 確定した既定の列設定を保存する。以降はこれを起点に、
    // ユーザーの列幅変更・列の表示/非表示が引き継がれる。
    saveGridColumnState(SALES_PLAN_COLUMN_STATE_KEY, api);
  }, []);

  // 経費計画グリッドの既定レイアウト（初期非表示列は無いため自動調整のみ）。
  const applyExpensePlanDefaultLayout = useCallback((api: GridApi) => {
    api.autoSizeAllColumns(true);
    saveGridColumnState(EXPENSE_PLAN_COLUMN_STATE_KEY, api);
  }, []);

  // highlightedCellsが更新されたらrefを更新してセルを再描画（columnDefsを再生成しない）
  useEffect(() => {
    highlightedCellsRef.current = highlightedCells;
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ force: true });
    }
  }, [highlightedCells]);

  // expenseHighlightedCellsが更新されたらrefを更新して経費グリッドを再描画
  useEffect(() => {
    expenseHighlightedCellsRef.current = expenseHighlightedCells;
    if (expenseGridRef.current?.api) {
      expenseGridRef.current.api.refreshCells({ force: true });
    }
  }, [expenseHighlightedCells]);

  // 依存セルハイライトが更新されたらrefを同期して経費グリッドを再描画
  useEffect(() => {
    expenseDependentHighlightsRef.current = expenseDependentHighlights;
    if (expenseGridRef.current?.api) {
      expenseGridRef.current.api.refreshCells({ force: true });
    }
  }, [expenseDependentHighlights]);

  // 販売計画 依存セルハイライト
  useEffect(() => {
    salesDependentHighlightsRef.current = salesDependentHighlights;
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ force: true });
    }
  }, [salesDependentHighlights]);

  // クリック起点セル（青）が更新されたらrefを同期し、両グリッドを再描画
  useEffect(() => {
    clickedCellRef.current = clickedCell;
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ force: true });
    }
    if (expenseGridRef.current?.api) {
      expenseGridRef.current.api.refreshCells({ force: true });
    }
  }, [clickedCell]);

  // 数式ガイドトグル：refを同期し、OFF時はハイライト・ツールチップをクリア
  useEffect(() => {
    showFormulaGuideRef.current = isFormulaGuideShown;
    if (!isFormulaGuideShown) {
      setHighlightedCells([]);
      setExpenseHighlightedCells([]);
      setExpenseDependentHighlights([]);
      setSalesDependentHighlights([]);
      setHeaderDependentHighlights(new Set());
      setHeaderRefHighlights(new Set());
      setClickedCell(null);
      setFormulaTooltip(null);
    }
  }, [isFormulaGuideShown]);

  // isDiffModeが切り替わったらrefを同期して両グリッドを再描画
  useEffect(() => {
    isDiffModeRef.current = isDiffMode;
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ force: true });
    }
    if (expenseGridRef.current?.api) {
      expenseGridRef.current.api.refreshCells({ force: true });
    }
  }, [isDiffMode]);

  // グリッド上部に表示する出荷稼働日関連の計算値
  // 販売計画表の全ての数式セルを再計算する関数（指定された順序で実行）
  const recalculateSalesPlan = () => {
    if (!gridRef.current?.api) return;

    const api = gridRef.current.api;

    // 1. 出荷稼働日の前年比（col16）- 商流販売店計行のみ
    const row0 = api.getDisplayedRowAtIndex(0);
    if (row0) {
      api.refreshCells({
        rowNodes: [row0],
        columns: ['col16'],
        force: true,
      });
    }

    // 2. 商流販売店計行以外の専用機PM/提携機PC（col11）
    for (let i = 1; i <= 5; i++) {
      const row = api.getDisplayedRowAtIndex(i);
      if (row) {
        api.refreshCells({
          rowNodes: [row],
          columns: ['col11'],
          force: true,
        });
      }
    }

    // 3. 商流販売店計行以外の稼働台数(コラム)（col14）
    for (let i = 1; i <= 5; i++) {
      const row = api.getDisplayedRowAtIndex(i);
      if (row) {
        api.refreshCells({
          rowNodes: [row],
          columns: ['col14'],
          force: true,
        });
      }
    }

    // 4. 商流販売店計行以外の合計本数（col10）
    for (let i = 1; i <= 5; i++) {
      const row = api.getDisplayedRowAtIndex(i);
      if (row) {
        api.refreshCells({
          rowNodes: [row],
          columns: ['col10'],
          force: true,
        });
      }
    }

    // 5. 商流販売店計行以外の合計函数（col6）
    for (let i = 1; i <= 5; i++) {
      const row = api.getDisplayedRowAtIndex(i);
      if (row) {
        api.refreshCells({
          rowNodes: [row],
          columns: ['col6'],
          force: true,
        });
      }
    }

    // 6. 商流販売店計行の合計函数（col6）
    if (row0) {
      api.refreshCells({
        rowNodes: [row0],
        columns: ['col6'],
        force: true,
      });
    }

    // 7. 商流販売店計行以外の当月計画（col1）
    for (let i = 1; i <= 5; i++) {
      const row = api.getDisplayedRowAtIndex(i);
      if (row) {
        api.refreshCells({
          rowNodes: [row],
          columns: ['col1'],
          force: true,
        });
      }
    }

    // 8. 商流販売店計行以外の社外売上実績の前年比（col3）
    for (let i = 1; i <= 5; i++) {
      const row = api.getDisplayedRowAtIndex(i);
      if (row) {
        api.refreshCells({
          rowNodes: [row],
          columns: ['col3'],
          force: true,
        });
      }
    }

    // 9. 商流販売店計行以外の合計函数（計画）の前年比（col8）
    for (let i = 1; i <= 5; i++) {
      const row = api.getDisplayedRowAtIndex(i);
      if (row) {
        api.refreshCells({
          rowNodes: [row],
          columns: ['col8'],
          force: true,
        });
      }
    }

    // 10. 商流販売店計行の当月計画（col1）
    if (row0) {
      api.refreshCells({
        rowNodes: [row0],
        columns: ['col1'],
        force: true,
      });
    }

    // 11. 商流販売店計行の社外売上実績の前年比（col3）
    if (row0) {
      api.refreshCells({
        rowNodes: [row0],
        columns: ['col3'],
        force: true,
      });
    }

    // 12. 商流販売店計行の合計函数（計画）の前年比（col8）
    if (row0) {
      api.refreshCells({
        rowNodes: [row0],
        columns: ['col8'],
        force: true,
      });
    }

    // 13. 当月実績進捗率（col19）- 全行
    for (let i = 0; i <= 5; i++) {
      const row = api.getDisplayedRowAtIndex(i);
      if (row) {
        api.refreshCells({
          rowNodes: [row],
          columns: ['col19'],
          force: true,
        });
      }
    }

    // その他の列も再計算（必要に応じて）
    api.refreshCells({ force: true });
  };

  const recalculateExpensePlan = () => {
    if (!expenseGridRef.current?.api) return;

    const api = expenseGridRef.current.api;

    // 1. 指定された行順（依存関係順）でセルを再計算する。
    // valueGetter は生データと販売計画から計算済み値を直接算出するため計算結果自体は
    // 順序非依存だが、依存元→依存先の順で確定させるため EXPENSE_RECALC_ROW_ORDER に従う。
    EXPENSE_RECALC_ROW_ORDER.forEach((idx) => {
      const node = api.getDisplayedRowAtIndex(idx);
      if (node) api.refreshCells({ rowNodes: [node], force: true });
    });

    // 2. 計画金額列（catPlan）の計算済み値を rowIndex キーでキャッシュ
    //    （比列 cellRenderer が分子として参照する。レンダラー内で
    //     api.getCellValue を呼ぶと無限ループになるためレンダラー外で取得）
    const cache: Record<number, number> = {};
    expensePlanDataRef.current.forEach((row: any, idx: number) => {
      // 空の親行はスキップ。ただし条件口（showAsValue）は値を持つのでキャッシュする
      if (row?.isParent && !row?.showAsValue) return;
      const node = api.getDisplayedRowAtIndex(idx);
      if (!node) return;
      const raw = api.getCellValue({
        rowNode: node,
        colKey: 'catPlan',
      });
      cache[idx] = parseFloat(String(raw ?? '0').replace(/[,%]/g, '')) || 0;
    });
    expenseRow0Cache.current = cache;

    // 3. 比列（前月比・予算比・前年同月比）をキャッシュ確定後に再描画
    api.refreshCells({
      columns: ['catZengetsuHi', 'catYosanHi', 'catZennenHi'],
      force: true,
    });
  };

  // 販売計画表と経費計画表の両方を再計算する関数
  // 重要: 販売計画表を先に再計算してから経費計画表を再計算する
  const recalculateAll = () => {
    // 1. 販売計画表を再計算（商流販売店計の当月計画を確定）
    recalculateSalesPlan();

    // 2. 経費計画表を指定された順序で再計算
    recalculateExpensePlan();
  };

  // 率ボックス（オペ条件口率/帳合料率）を起点にした依存先（オレンジ）の強調。
  // 起点（率ボックス）自身は強調せず、依存先（当該行の計画金額以降）を表示する。
  // 参照のみの率は AG Grid のセルクリック経由、編集可の率（帳合料率）は
  // 入力欄の onClick から直接呼ぶ（入力欄はクリックを stopPropagation するため）。
  const highlightRateDependents = (rowIndex: number) => {
    if (!showFormulaGuideRef.current) return;
    setHighlightedCells([]);
    setSalesDependentHighlights([]);
    setHeaderDependentHighlights(new Set());
    setHeaderRefHighlights(new Set());
    setExpenseHighlightedCells([]);
    setFormulaTooltip(null);
    // 率自身には数式が無いため参照セル（緑）は出さない。
    const { expense } = computeExpenseDependentsFrom(`${rowIndex}-catPlan`);
    setExpenseDependentHighlights([`${rowIndex}-catPlan`, ...expense]);
  };

  // 経費計画セルクリック時のハンドラー
  const onExpenseCellClicked = (params: any) => {
    const field = params.colDef?.field;
    const rowIndex = params.node?.rowIndex ?? -1;
    const formulaField = field + '_formula';

    // 数式ガイドOFF時：何もせず終了
    if (!showFormulaGuideRef.current) {
      return;
    }

    // 率ボックス（オペ条件口率＝参照のみ／帳合料率＝入力可）クリック時：
    // 通常のセルクリック処理で強調がクリアされないよう、ここで処理して return する。
    // 率ボックスはグリッドセルではないため、クリック起点（青）はクリアする。
    if ((params.event?.target as HTMLElement)?.dataset?.rateBox === 'true') {
      setClickedCell(null);
      highlightRateDependents(rowIndex);
      return;
    }

    // 全ハイライトを一旦リセット（セル選択時は常にクリアしてから再計算）
    setHighlightedCells([]);
    setSalesDependentHighlights([]);
    setHeaderDependentHighlights(new Set());
    setHeaderRefHighlights(new Set());

    // クリックした起点セルを青で強調（固定上段は対象外）
    setClickedCell(
      !params.node?.rowPinned && field
        ? { grid: 'expense', cellKey: `${rowIndex}-${field}` }
        : null
    );

    // ── 依存セルのオレンジハイライト（差分/実数共通）──────────────
    // 転置後の起点セル：
    //   計画金額列の入力セル（オペ金銭口=5, ロケ運転費=7, ロケ率=8,
    //     コラム料=16, リース料=17, 販売器具費=18）
    //   拠点列のその他経費入力セル（オペ協力金=9〜前払金：ロケ契約中=14）
    //   実績列（前月実績/予算/前年同月実績）の各セル
    const BRANCH_FIELDS = [
      'catHonsha',
      'catShishaA',
      'catShishaBKyotsu',
      'catShishaBKaitaku',
    ];
    const ACTUAL_FIELDS = [
      'catZengetsuJisseki',
      'catYosan',
      'catZennenJisseki',
    ];
    // 固定上段（単位の行）は起点セルから除外する
    const isTriggerCell =
      !params.node?.rowPinned &&
      // オペ金銭口/オペ条件口(手出票)(=5)・ロケ運転費率(=8) は入力値のため起点に含める。
      // 帳合料(=4) の計画金額は帳合料率から算出する値のため起点から除外する
      // （起点は率のセル）。
      // 604…(=12)・ロケ契約見込(=13)・ロケ契約中(=14) の計画金額も拠点列の合計で算出する値の
      // ため起点から除外する（起点は拠点列のセル）。
      // データ種の区切り行（営業経費=1・自販機関係費=15）は値を持たないため除外する。
      // コラム料(=16)・リース料(=17)・販売器具費(=18) は入力値のため起点に含める。
      ((field === 'catPlan' && [5, 7, 8, 16, 17, 18].includes(rowIndex)) ||
        // 拠点列（本社〜支社B開発）は、ロケ契約見込(13)・ロケ契約中(14) も対象に含める
        // （ロケ契約中は参照表示だが、前払金(償却)と経費金額合計の算出元になるため）。
        // 604…(12) の拠点列は子行から算出する値のため起点から除外する。
        (BRANCH_FIELDS.includes(field) &&
          [9, 10, 11, 13, 14].includes(rowIndex)) ||
        (ACTUAL_FIELDS.includes(field) &&
          // 経費金額合計(0) は算出値のため起点から除外。
          // ロケ運転費(7) の実績列は数式を持たない固定値のため起点に含める
          //（ロケ運転費率(8)・経費金額合計(0) の実績列の算出元になる）。
          rowIndex !== 0 &&
          // データ種の区切り行（営業経費=1）は値を持たないため除外する
          //（自販機関係費=15 は下の isParent 判定で除外される）。
          rowIndex !== 1 &&
          // オペ金銭口/オペ条件口(手出票)(5) は入力値のため、前月実績・前年同月実績を
          // 起点にする（予算は従来どおり起点にしない）。
          !(rowIndex === 5 && field === 'catYosan') &&
          // 604…：ロケ契約見込(13)・ロケ契約中(14) は前月実績〜前年同月比が
          // "－"（比較対象なし）のため起点から除外する。
          ![13, 14].includes(rowIndex) &&
          // 条件口(2)・条件口率(6)・ロケ運転費率(8) の実績列は、他のセルから算出する
          // 値のため起点から除外する（起点は算出元のセル）。
          ![2, 6, 8].includes(rowIndex) &&
          !(params.data?.isParent && !params.data?.showAsValue)));

    // 起点セル（isTriggerCell）は依存先（オレンジ）と参照する販売計画セル（緑）を
    // 表示する。参照セルの緑は下の数式ブロックで消えないよう salesRefsFromTrigger に保持する。
    let salesRefsFromTrigger: string[] = [];
    if (isTriggerCell) {
      const { expense, salesRefs } = computeExpenseDependentsFrom(
        `${rowIndex}-${field}`
      );
      setExpenseDependentHighlights(expense);
      salesRefsFromTrigger = salesRefs;
    } else {
      setExpenseDependentHighlights([]);
    }
    // ─────────────────────────────────────────────────────────────

    // クリック時の数式ガイド（浮遊表示）。数式が設定されたセルのみ数式を表示する。
    const colField = params.colDef?.field;
    const formulaFn = colField
      ? expenseFormulaGetterByField.current.get(colField)
      : undefined;
    const tooltipText = formulaFn ? formulaFn(params) : null;
    if (tooltipText) {
      const cellEl = (params.event?.target as HTMLElement)?.closest('.ag-cell');
      const rect = cellEl?.getBoundingClientRect();
      if (rect) {
        setFormulaTooltip({
          text: tooltipText,
          x: rect.left,
          y: rect.bottom + window.scrollY + 4,
        });
      }
    } else {
      setFormulaTooltip(null);
    }

    // 参照する販売計画セル（緑）を決定する。緑は「起点セル自身が参照している元」を
    // 示すため、計画金額・実績列では下記の対応表だけを使い、salesRefsFromTrigger は
    // 用いない。salesRefsFromTrigger は依存先の数式が参照するセルまで集めるので、
    // 例えばオペ金銭口の計画金額（入力値）でも、依存先の条件口率が
    // 商流販売店計[当月計画] を分母にする分まで緑になってしまう。
    //   計画金額＝オペ条件口(3)・帳合料(4)・条件口率(6)・ロケ運転費(7) が当月計画(0-col1)、
    //   予算＝条件口率(6)・ロケ運転費率(8) が商流販売店計[予算](0-col21)、
    //   前年同月実績＝同じ2行が商流販売店計[前年実績](0-col2)。
    // 拠点列など、上記以外の起点セルは従来どおり salesRefsFromTrigger を用いる。
    const SALES_REF_BY_CELL: Record<string, Record<number, string>> = {
      catPlan: { 3: '0-col1', 4: '0-col1', 6: '0-col1', 7: '0-col1' },
      catYosan: { 6: '0-col21', 8: '0-col21' },
      catZennenJisseki: { 6: '0-col2', 8: '0-col2' },
      catZengetsuJisseki: {},
    };
    // 対応表の緑は「そのセルの数式が参照している元」を示すため、数式が残っている
    // ときだけ表示する。ロケ運転費(7) の計画金額のように手入力で数式をクリアした
    // セルは、参照元（商流販売店計[当月計画]）の緑も出さない
    // （率ボックスの緑が消えるのと同じ挙動に揃える）。
    const salesRefs = Object.prototype.hasOwnProperty.call(
      SALES_REF_BY_CELL,
      field
    )
      ? params.data?.[formulaField]
        ? [SALES_REF_BY_CELL[field][rowIndex]].filter(Boolean)
        : []
      : salesRefsFromTrigger;

    if (params.data[formulaField]) {
      const formula = params.data[formulaField];
      const refs = parseFormulaReferences(formula);
      const cellIds: string[] = [];
      refs.forEach((ref) => {
        const cellId = expenseExcelRefToCellId(ref);
        if (cellId) {
          cellIds.push(`${cellId.rowIndex}-${cellId.colId}`);
        }
      });
      // 計画金額の数式が率（exp_col16/exp_col17）を参照する行は、
      // 項目名右の率ボックスも参照セル（緑）として強調する
      const rateRowData = params.data;
      if (
        field === 'catPlan' &&
        rateRowData?.rateField &&
        formula.includes(rateRowData.rateField)
      ) {
        cellIds.push(`${rowIndex}-${rateRowData.rateField}`);
      }
      setExpenseHighlightedCells(cellIds);
      setHighlightedCells(salesRefs);
    } else {
      setExpenseHighlightedCells([]);
      setHighlightedCells(salesRefs);
    }
  };

  // 販売計画の逆依存マップを構築して BFS で依存セルを返す共通関数
  // 経費計画の逆依存マップを構築するヘルパー
  const buildExpenseReverseMap = () => {
    const reverseMap = new Map<string, Set<string>>();
    expensePlanDataRef.current.forEach((rowData: any, ri: number) => {
      Object.entries(rowData).forEach(([key, val]) => {
        if (!key.endsWith('_formula') || !val) return;
        const targetField = key.slice(0, -'_formula'.length);
        const refs = parseFormulaReferences(String(val));
        refs.forEach((ref) => {
          const cellId = expenseExcelRefToCellId(ref);
          if (!cellId) return;
          const srcKey = `${cellId.rowIndex}-${cellId.colId}`;
          if (!reverseMap.has(srcKey)) reverseMap.set(srcKey, new Set());
          reverseMap.get(srcKey)!.add(`${ri}-${targetField}`);
        });
      });
    });
    return reverseMap;
  };

  // 経費計画内で販売計画のセルを参照している数式セルを収集（クロスグリッド入口）。
  // affectedSales を渡した場合は、その販売計画セルを参照している入口のみに絞る。
  const getExpenseCrossGridEntries = (affectedSales?: Set<string>) => {
    const entries: string[] = [];
    expensePlanDataRef.current.forEach((rowData: any, ri: number) => {
      Object.keys(rowData).forEach((key) => {
        if (!key.endsWith('_formula') || !rowData[key]) return;
        const formula = String(rowData[key]);
        const matched = Object.entries(EXPENSE_CROSS_GRID_REF_MAP).some(
          ([token, salesId]) =>
            formula.includes(token) &&
            (!affectedSales || affectedSales.has(salesId))
        );
        if (matched) {
          entries.push(`${ri}-${key.slice(0, -'_formula'.length)}`);
        }
      });
    });
    return entries;
  };

  /**
   * 販売計画の起点セルから依存セルを計算し、経費計画への波及も含めて返す。
   * returns { sales: 販売計画内依存セル[], expense: 経費計画内依存セル[], salesRefs: 販売計画の参照セル[] }
   */
  const computeSalesDependentsFrom = (
    startKey: string
  ): { sales: string[]; expense: string[] } => {
    // 販売計画の逆依存マップ
    const salesReverseMap = new Map<string, Set<string>>();
    salesPlanDataRef.current.forEach((rowData: any, ri: number) => {
      Object.entries(rowData).forEach(([key, val]) => {
        if (!key.endsWith('_formula') || !val) return;
        const targetField = key.slice(0, -'_formula'.length);
        parseFormulaReferences(String(val)).forEach((ref) => {
          const cellId = excelRefToCellId(ref);
          if (!cellId) return;
          const srcKey = `${cellId.rowIndex}-${cellId.colId}`;
          if (!salesReverseMap.has(srcKey))
            salesReverseMap.set(srcKey, new Set());
          salesReverseMap.get(srcKey)!.add(`${ri}-${targetField}`);
        });
      });
    });

    const salesVisited = bfs([startKey], salesReverseMap);
    salesVisited.delete(startKey); // 起点自身は除く

    // 影響を受けた販売計画セル（起点含む）が、経費計画のクロスグリッド参照
    //（当月計画=0-col1 / 予算金額=0-col21 / 前年実績金額=0-col2）に該当する場合、
    // その参照を入口として経費計画への波及を計算する。
    const affectedSales = new Set<string>(salesVisited);
    affectedSales.add(startKey);
    let expenseVisited = new Set<string>();
    const expenseReverseMap = buildExpenseReverseMap();
    const crossEntries = getExpenseCrossGridEntries(affectedSales);
    if (crossEntries.length > 0) {
      expenseVisited = bfs(crossEntries, expenseReverseMap);
    }

    return {
      sales: Array.from(salesVisited),
      expense: Array.from(expenseVisited),
    };
  };

  /**
   * 経費計画の起点セルから依存セルを計算し、参照している販売計画セルも返す。
   * returns { expense: 経費計画内依存セル[], salesRefs: 販売計画の参照セル[] }
   */
  const computeExpenseDependentsFrom = (
    startKey: string
  ): { expense: string[]; salesRefs: string[] } => {
    const expenseReverseMap = buildExpenseReverseMap();
    const expenseVisited = bfs([startKey], expenseReverseMap);
    expenseVisited.delete(startKey);

    // 依存セルの数式が参照している販売計画のセルを収集（緑で表示）
    const salesRefs = new Set<string>();
    expensePlanDataRef.current.forEach((rowData: any, ri: number) => {
      Object.keys(rowData).forEach((key) => {
        if (!key.endsWith('_formula') || !rowData[key]) return;
        const targetField = key.slice(0, -'_formula'.length);
        if (!expenseVisited.has(`${ri}-${targetField}`)) return;
        const formula = String(rowData[key]);
        Object.entries(EXPENSE_CROSS_GRID_REF_MAP).forEach(
          ([token, salesId]) => {
            if (formula.includes(token)) salesRefs.add(salesId);
          }
        );
      });
    });

    return {
      expense: Array.from(expenseVisited),
      salesRefs: Array.from(salesRefs),
    };
  };

  const onCellClicked = (params: any) => {
    const field = params.colDef?.field;
    const rowIndex = params.node?.rowIndex ?? -1;
    const formulaField = field + '_formula';

    // 数式ガイドOFF時：何もせず終了
    if (!showFormulaGuideRef.current) {
      return;
    }

    // 全ハイライトを一旦リセット（セル選択時は常にクリアしてから再計算）
    setExpenseHighlightedCells([]);
    setSalesDependentHighlights([]);
    setExpenseDependentHighlights([]);
    setHeaderDependentHighlights(new Set());
    setHeaderRefHighlights(new Set());

    // クリックした起点セルを青で強調（固定上段は対象外）
    setClickedCell(
      !params.node?.rowPinned && field
        ? { grid: 'sales', cellKey: `${rowIndex}-${field}` }
        : null
    );

    // ── 依存セルのオレンジハイライト（差分/実数共通・販売計画 + 経費計画への波及）──
    // 固定上段（単位の行）は起点セルから除外する
    if (!params.node?.rowPinned && isHighlightTrigger(rowIndex, field)) {
      const { sales, expense } = computeSalesDependentsFrom(
        `${rowIndex}-${field}`
      );
      setSalesDependentHighlights(sales);
      setExpenseDependentHighlights(expense);
      setHeaderDependentHighlights(
        computeHeaderDependents(`${rowIndex}-${field}`, sales)
      );
    }
    // ──────────────────────────────────────────────────────────────

    // ── 参照元ヘッダー項目の緑ハイライト ──
    // グリッド内の参照セル（highlightedCells）と同時に、グリッド外のヘッダー項目
    // （出荷稼働日前年比 等）も参照元として緑で強調する。
    if (!params.node?.rowPinned) {
      setHeaderRefHighlights(computeHeaderRefs(rowIndex, field));
    }

    // クリック時の数式ガイド（浮遊表示）。数式が設定されたセルのみ数式を表示する。
    const colField = params.colDef?.field;
    const formulaFn = colField
      ? salesFormulaGetterByField.current.get(colField)
      : undefined;
    const tooltipText = formulaFn ? formulaFn(params) : null;
    if (tooltipText) {
      const cellEl = (params.event?.target as HTMLElement)?.closest('.ag-cell');
      const rect = cellEl?.getBoundingClientRect();
      if (rect) {
        setFormulaTooltip({
          text: tooltipText,
          x: rect.left,
          y: rect.bottom + window.scrollY + 4,
        });
      }
    } else {
      setFormulaTooltip(null);
    }

    // 数式がある場合は参照セルを強調表示。
    // 緑は「クリックしたセルが参照している元」を示すため、販売計画のセルから
    // 経費計画のセルを緑にすることはない（波及先はオレンジの依存で表す）。
    if (params.data[formulaField]) {
      const formula = params.data[formulaField];
      const refs = parseFormulaReferences(formula);
      const cellIds: string[] = [];
      refs.forEach((ref) => {
        const cellId = excelRefToCellId(ref);
        if (cellId) cellIds.push(`${cellId.rowIndex}-${cellId.colId}`);
      });
      setHighlightedCells(cellIds);
    } else {
      setHighlightedCells([]);
    }
  };

  // グリッド上部の表示欄（出荷稼働日前年比・社外売上高/当月進捗率）クリック時に、
  // 数式を浮遊ツールチップで表示し、数式が参照するセルを緑で強調表示する。
  // AG Grid セルではないため onCellClicked を通らず、専用ハンドラで処理する。
  const onHeaderValueClick = (
    e: any,
    formulaText: string,
    refCells: string[]
  ) => {
    if (!showFormulaGuideRef.current) return;
    // ルート div の「セル外クリックでツールチップを消す」処理を抑止
    e.stopPropagation();
    // 依存(オレンジ)系の強調はクリアし、参照(緑)を表示。
    // グリッドセル外のため、クリック起点（青）もクリアする。
    setExpenseHighlightedCells([]);
    setSalesDependentHighlights([]);
    setExpenseDependentHighlights([]);
    setHeaderDependentHighlights(new Set());
    setHeaderRefHighlights(new Set());
    setClickedCell(null);
    setHighlightedCells(refCells);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFormulaTooltip({
      text: formulaText,
      x: rect.left,
      y: rect.bottom + window.scrollY + 4,
    });
  };

  // 出荷稼働日(0-col17)クリック時：依存セルを強調する（入力欄・表示欄で共通）
  const onShukkaWorkingDaysClick = () => {
    if (!showFormulaGuideRef.current) return;
    setHighlightedCells([]);
    setExpenseHighlightedCells([]);
    // 入力欄/表示欄いずれもグリッドセルではないため、クリック起点（青）はクリアする。
    setClickedCell(null);
    const { sales, expense } = computeSalesDependentsFrom('0-col17');
    setSalesDependentHighlights(sales);
    setExpenseDependentHighlights(expense);
    setHeaderDependentHighlights(computeHeaderDependents('0-col17', sales));
  };

  // 前年出荷稼働日(0-col27)クリック時：依存セルを強調する。
  // 出荷稼働日前年比の分母のため、前年比とその先（専用機PM/提携機PC 等）へ波及する。
  const onPrevYearShukkaWorkingDaysClick = () => {
    if (!showFormulaGuideRef.current) return;
    setHighlightedCells([]);
    setExpenseHighlightedCells([]);
    // グリッドセルではないため、クリック起点（青）はクリアする。
    setClickedCell(null);
    const { sales, expense } = computeSalesDependentsFrom('0-col27');
    setSalesDependentHighlights(sales);
    setExpenseDependentHighlights(expense);
    setHeaderDependentHighlights(computeHeaderDependents('0-col27', sales));
  };

  // セルに設定された数式（=Z5*N5*Q2 等）を解釈して値を求める。
  // 対応するのは乗算だけの式で、項はセル参照（列文字＋Excel行番号）か数値。
  // 参照先の値は colMap（excelRefToCellId）で列へ解決し、グリッドの行から読む。
  //  ・"%" 付きの値（比率）は 100 で割って小数として掛ける
  //  ・出荷稼働日前年比（col16）は表示専用のため、出荷稼働日 ÷ 前年出荷稼働日 で求める
  // 数値でない項（"-" 等）が混ざる場合は計算せず null を返す。
  const evalSalesMultiplyFormula = (
    formula: string,
    api: any
  ): number | null => {
    const body = String(formula ?? '').replace(/^=/, '');
    if (!body || !/^[A-Z0-9.*]+$/.test(body)) return null;
    let result = 1;
    for (const term of body.split('*')) {
      const ref = term.match(/^([A-Z]+)(\d+)$/);
      if (!ref) {
        // 数値リテラル
        const literal = parseFloat(term);
        if (!Number.isFinite(literal)) return null;
        result *= literal;
        continue;
      }
      const cell = excelRefToCellId(term);
      if (!cell) return null;
      const rowData =
        api?.getDisplayedRowAtIndex(cell.rowIndex)?.data ??
        salesPlanDataRef.current[cell.rowIndex];
      if (!rowData) return null;
      // 出荷稼働日前年比は保持値を持たないため、その場で算出する
      if (cell.colId === 'col16') {
        const days = parseFloat(String(rowData.col17 ?? '').replace(/,/g, ''));
        if (!Number.isFinite(days)) return null;
        result *= days / PREV_YEAR_SHIPPING_WORKING_DAYS;
        continue;
      }
      const rawValue = String(rowData[cell.colId] ?? '');
      const num = parseFloat(rawValue.replace(/,/g, ''));
      if (!Number.isFinite(num)) return null;
      result *= rawValue.includes('%') ? num / 100 : num;
    }
    return result;
  };

  // 販売計画データ
  const [salesPlanData, setSalesPlanData] = useState(
    createSalesPlanInitialRows
  );

  // データref（useMemo内のコールバックが常に最新データを参照するため）
  const salesPlanDataRef = useRef(salesPlanData);
  salesPlanDataRef.current = salesPlanData;

  /**
   * 販売計画表の商流販売店計（row 0）の当月計画（col1）を計算する共通関数。
   * salesPlanDataRef.current を直接参照するため、グリッド描画状態に依存しない。
   */

  const shukkaWorkingDays = useMemo(() => {
    const v = salesPlanData[0]?.col17;
    const current = v != null ? String(v) : '';
    if (!isDiffMode)
      return { text: current, color: GRID_COLORS.neutralText, isInput: true };
    const num = parseFloat(String(v || '0').replace(/,/g, ''));
    if (isNaN(num))
      return {
        text: current,
        color: GRID_COLORS.neutralText,
        isInput: false,
      };
    return { ...calcHeaderDiff(num, 20), isInput: false };
  }, [salesPlanData, isDiffMode]);

  // 前年出荷稼働日。実数表示は 19、差分表示は基準値 19 との差（＝±0）を出す。
  // 基準値の直書きは 出荷稼働日(20)・出荷稼働日前年比(105.3) と同じ扱いにそろえる。
  // 前年出荷稼働日。実数表示は PREV_YEAR_SHIPPING_WORKING_DAYS の値、
  // 差分表示は同じ値を基準にした差を出す（現状は表示値＝基準値のため ±0）。
  const prevYearShukkaWorkingDays = useMemo(() => {
    const current = PREV_YEAR_SHIPPING_WORKING_DAYS;
    if (!isDiffMode)
      return { text: String(current), color: GRID_COLORS.neutralText };
    return calcHeaderDiff(current, PREV_YEAR_SHIPPING_WORKING_DAYS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDiffMode]);

  const shukkaYoyRatio = useMemo(() => {
    const col17 = parseFloat(
      String(salesPlanData[0]?.col17 || '0').replace(/,/g, '')
    );
    if (isNaN(col17) || col17 === 0)
      return { text: '－', color: GRID_COLORS.neutralText };
    // 小数第1位まで表示（小数第2位を四捨五入）。差分も同様。
    const current = (col17 / PREV_YEAR_SHIPPING_WORKING_DAYS) * 100;
    if (!isDiffMode)
      return {
        text: formatDecimal1(current) + '%',
        color: GRID_COLORS.neutralText,
      };
    return calcHeaderDiff(current, 105.3, true, true);
  }, [salesPlanData, isDiffMode]);

  // 出荷稼働日前年比の参照セル（緑強調）。決め打ちにせず、セルに設定した数式
  // （col16_formula）のセル参照から求めるため、数式を変えれば強調対象も追従する。
  const shukkaYoyRefCells = useMemo(
    () =>
      parseFormulaReferences(String(salesPlanData[0]?.col16_formula ?? ''))
        .map((ref) => excelRefToCellId(ref))
        .filter((cell): cell is { rowIndex: number; colId: string } => !!cell)
        .map((cell) => `${cell.rowIndex}-${cell.colId}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [salesPlanData]
  );

  const progressRate = useMemo(() => {
    const row0 = salesPlanData[0];
    if (!row0 || !row0.col5_formula) {
      const text = String(row0?.col5 ?? GRID_EMPTY_TEXT);
      return { text, color: GRID_COLORS.neutralText };
    }
    // 商流販売店計の当月函数(col4) ÷ 商流販売店計の合計函数(col6) × 100
    const col4 = parseFloat(String(row0.col4 || '0').replace(/,/g, '')) || 0;
    const col6Total = computeSalesPlanCol6(salesPlanData);
    // 小数第1位まで表示（小数第2位を四捨五入）。差分も同様。
    const current = col6Total === 0 ? 0 : (col4 / col6Total) * 100;
    if (!isDiffMode)
      return {
        text: formatDecimal1(current) + '%',
        color: GRID_COLORS.neutralText,
      };
    return calcHeaderDiff(current, 41.7, true, true);
  }, [salesPlanData, isDiffMode]);

  // 単位行（4行目）のデータ。税抜き・税込みの表記は出さない（金額は税抜きのみのため）。
  // 率の列は値に「%」が付くため単位を出さない（二重の表示をなくす → UI/UX UX-079）。
  const unitRowData = useMemo(
    () => [
      {
        category: '単位',
        col1: '円',
        col2: '円',
        col3: '',
        col4: '函',
        col5: '',
        col6: '函',
        col7: '函',
        col8: '',
        col9: '本',
        col10: '本',
        col11: '本',
        col25: '本',
        col12: '',
        col13: '',
        col14: '台/コラム',
        col26: '台/コラム',
        col15: '台/コラム',
        col16: '',
        col17: '日',
        col18: '円',
        col19: '',
        col20: '円',
        col21: '円',
        col22: '',
        col23: '函',
        col24: '',
      },
    ],
    []
  );

  // 経費計画データ（転置：行=経費項目、列=計画金額/拠点/前月/予算/前年同月）
  // 列フィールド: catPlan=計画金額, catHonsha=本社, catShishaA=支社A,
  //   catShishaBKyotsu=支社B共通, catShishaBKaitaku=支社B開拓,
  //   catZengetsuJisseki=前月実績, catZengetsuHi=前月比, catYosan=予算,
  //   catYosanHi=予算比, catZennenJisseki=前年同月実績, catZennenHi=前年同月比
  const [expensePlanData, setExpensePlanData] = useState(
    createExpensePlanInitialRows
  );

  const expensePlanDataRef = useRef(expensePlanData);
  expensePlanDataRef.current = expensePlanData;

  // 経費計画の注記行データ（単位は各行の「単位」列に移動）。税抜きの表記・率の「％」は出さない（→ UX-079）
  const expenseUnitRowData = useMemo(
    () => [
      {
        category: '単位',
        unit: '',
        catPlan: '円',
        catHonsha: '円',
        catShishaA: '円',
        catShishaBKyotsu: '円',
        catShishaBKaitaku: '円',
        catZengetsuJisseki: '円',
        catZengetsuHi: '',
        catYosan: '円',
        catYosanHi: '',
        catZennenJisseki: '円',
        catZennenHi: '',
      },
    ],
    []
  );

  // セルの編集可否を判定する関数
  const isCellEditable = (rowIndex: number, field: string) => {
    if (isDiffModeRef.current) return false; // 差分表示中は全セル編集不可
    return isCellTrigger(rowIndex, field);
  };

  // 経費計画のセルの編集可否を判定する関数
  const isExpenseCellEditable = (rowIndex: number, field: string) => {
    if (isDiffModeRef.current) return false; // 差分表示中は全セル編集不可
    // 空の親行は編集不可。ただし showAsValue（値を持つ親行）は対象列で編集可
    const rowData = expensePlanDataRef.current[rowIndex];
    if (rowData?.isParent && !rowData?.showAsValue) return false;

    // 計画金額列（catPlan）の入力セル：
    //   オペ金銭口(5)・ロケ運転費(7)・コラム料(16)・販売器具費(18)
    //   ※ロケ運転費(7)は入力可。入力後は数式をクリアして入力値を採用する。
    if (field === 'catPlan' && [5, 7, 16, 18].includes(rowIndex)) return true;
    // 拠点列（本社・支社A・支社B共通・支社B開拓）のその他経費入力セル：
    //   オペ協力金(9)・その他一時金(10)・ロケ契約料(11)・前払金：ロケ契約見込(13)
    //   ※前払金(償却)(12)・前払金：ロケ契約中(14) は参照表示のため入力不可。
    if (
      (field === 'catHonsha' ||
        field === 'catShishaA' ||
        field === 'catShishaBKyotsu' ||
        field === 'catShishaBKaitaku') &&
      [9, 10, 11, 13].includes(rowIndex)
    )
      return true;
    return false;
  };

  // 経費計画のセルスタイルを取得する関数
  // 寄せは defaultColDef の cellClass（cell-right／上段固定行は cell-center）で指定する（→ 02 §6 セルの寄せ）
  const getExpenseCellStyle = (params: any) => {
    if (params.node?.rowPinned === 'top') {
      return {
        backgroundColor: GRID_COLORS.readonly,
      };
    }
    const rowIndex = params.node?.rowIndex ?? -1;
    const field = params.colDef?.field;
    const isEditable = isExpenseCellEditable(rowIndex, field);

    // 参照セルとして強調表示されているかチェック
    const cellKey = `${rowIndex}-${field}`;
    const isHighlighted = expenseHighlightedCellsRef.current.includes(cellKey);
    const isDependent = expenseDependentHighlightsRef.current.includes(cellKey);
    const isClicked =
      clickedCellRef.current?.grid === 'expense' &&
      clickedCellRef.current?.cellKey === cellKey;

    // 経費金額合計行（rowIndex === 0）は合計スタイル（合計色＋太字）。
    // 編集可能セルは白背景、クリック/依存/参照ハイライトは優先する。
    if (rowIndex === 0) {
      // 強調（青/緑/オレンジ）は枠線だけで示し、背景は元の配色を保つ。
      const bg = isEditable ? GRID_COLORS.editable : GRID_COLORS.total;
      return {
        backgroundColor: bg,
        fontWeight: 'bold',
        cursor: isEditable ? 'pointer' : 'default',
        border: isClicked
          ? CLICK_HIGHLIGHT_BORDER
          : isDependent
            ? DEP_HIGHLIGHT_BORDER
            : isHighlighted
              ? REF_HIGHLIGHT_BORDER
              : undefined,
      };
    }

    // 親行の場合は薄いグレーの背景色（ただし条件口=showAsValue は
    // 経費金額合計行と同じ通常背景にする）
    const isParent = params.data?.isParent;
    let bgColor: string = isEditable
      ? GRID_COLORS.editable
      : GRID_COLORS.readonly;
    // 親行も標準の編集不可色（灰）に統一する
    if (isParent && !params.data?.showAsValue) bgColor = GRID_COLORS.readonly;
    // データ種の区切り（見出し）行は共通の区切り行色。太字にはしない（→ 02 §7）
    if (params.data?.isGroupHeaderRow) bgColor = GRID_COLORS.sectionRowBg;
    // 強調（青/緑/オレンジ）は枠線だけで示すため、背景は上書きしない。

    return {
      backgroundColor: bgColor,
      cursor: isEditable ? 'pointer' : 'default',
      border: isClicked
        ? CLICK_HIGHLIGHT_BORDER
        : isDependent
          ? DEP_HIGHLIGHT_BORDER
          : isHighlighted
            ? REF_HIGHLIGHT_BORDER
            : undefined,
    };
  };

  // セルのスタイルを取得する関数（編集可能なセルは白背景）
  // 寄せは defaultColDef の cellClass（cell-right／上段固定行は cell-center）で指定する（→ 02 §6 セルの寄せ）
  const getCellStyle = (params: any) => {
    if (params.node?.rowPinned === 'top') {
      return {
        backgroundColor: GRID_COLORS.readonly,
      };
    }
    const rowIndex = params.node?.rowIndex ?? -1;
    const field = params.colDef?.field;
    const isEditable = isCellEditable(rowIndex, field);

    // 参照セルとして強調表示されているかチェック
    const cellKey = `${rowIndex}-${field}`;
    const isHighlighted = highlightedCellsRef.current.includes(cellKey);
    const isDependent = salesDependentHighlightsRef.current.includes(cellKey);
    const isClicked =
      clickedCellRef.current?.grid === 'sales' &&
      clickedCellRef.current?.cellKey === cellKey;

    // 合計行（rowIndex === 0）の場合は合計色の背景（ただし編集可能セルは白背景）
    if (rowIndex === 0) {
      // 強調（青/緑/オレンジ）は枠線だけで示し、背景は元の配色を保つ。
      const bg = isEditable ? GRID_COLORS.editable : GRID_COLORS.total;
      return {
        backgroundColor: bg,
        fontWeight: 'bold',
        cursor: isEditable ? 'pointer' : 'default',
        border: isClicked
          ? CLICK_HIGHLIGHT_BORDER
          : isDependent
            ? DEP_HIGHLIGHT_BORDER
            : isHighlighted
              ? REF_HIGHLIGHT_BORDER
              : undefined,
      };
    }

    // 強調（青/緑/オレンジ）は枠線だけで示し、背景は元の配色を保つ。
    const bg = isEditable ? GRID_COLORS.editable : GRID_COLORS.readonly;
    return {
      backgroundColor: bg,
      cursor: isEditable ? 'pointer' : 'default',
      border: isClicked
        ? CLICK_HIGHLIGHT_BORDER
        : isDependent
          ? DEP_HIGHLIGHT_BORDER
          : isHighlighted
            ? REF_HIGHLIGHT_BORDER
            : undefined,
    };
  };

  // AG Grid用のカラム定義（3レベルヘッダー）
  // 列の定義は最初の描画で1回だけ作る（作り直さない。セルの値・強調は ref から読む）。
  const [salesPlanColumnDefs] = useState(() =>
    buildSalesPlanColumnDefs({
      highlightedCellsRef,
      gridRef,
      recalculateSalesPlan,
      recalculateAll,
      evalSalesMultiplyFormula,
      setSalesPlanData,
      salesPlanDataRef,
      isCellEditable,
      getCellStyle,
    })
  );

  // 販売計画グリッド専用 defaultColDef（差分表示 cellRenderer を含む）
  const salesPlanDefaultColDef = useMemo(
    () => ({
      // 編集できない列の見出しをグレーにする（GRID_DEFAULT_COL_DEF を引き継がないため明示。→ grid/gridCommon）
      headerStyle: gridHeaderStyle,
      // 長い見出しは2行に折り返し、列の幅は値に合わせる（基準 OS 150%＝幅 1280px でも横幅に入りきるように → 02 §7・UX-062）
      ...GRID_WRAP_HEADER_COL_DEF,
      sortable: false,
      resizable: true,
      filter: false,
      suppressMenu: true,
      // 数値のセルに数字以外を入れたら元の値へ戻す（手売りと同じ → 02 §7「入力値のチェック」・UX-089）
      valueParser: revertNonNumericValueParser,
      // 数値の列は右寄せ、上段に固定した単位の行は中央（ラベルの列は列ごとに上書き → 02 §6 セルの寄せ）
      cellClass: (params: any) =>
        params.node?.rowPinned === 'top' ? 'cell-center' : 'cell-right',
      cellClassRules: CELL_CLASS_RULES,
      cellRenderer: (params: any) => {
        // ピン行（単位行）はそのまま表示
        if (params.node?.rowPinned) {
          return (
            params.valueFormatted ??
            (params.value != null ? String(params.value) : '')
          );
        }
        const formatted: string =
          params.valueFormatted ??
          (params.value != null ? String(params.value) : '');
        const rowIndex: number = params.node?.rowIndex ?? -1;
        const field: string = params.colDef?.field ?? '';

        // 差分モード以外・対象外行・カテゴリ列はそのまま
        if (
          !isDiffModeRef.current ||
          rowIndex < 0 ||
          rowIndex > 5 ||
          !field ||
          field === 'category'
        ) {
          return toHalfWidthDash(formatted);
        }

        // 現在値が "－" ならそのまま（表示は半角「-」）
        if (formatted === '－' || formatted === '' || formatted == null)
          return toHalfWidthDash(formatted);

        // ベースライン取得
        const baseline = salesPlanBaselineData[rowIndex] as Record<string, any>;
        const baselineVal = baseline?.[field];

        // ベースラインが "－" または未定義なら実値をそのまま表示
        if (
          baselineVal === '－' ||
          baselineVal === null ||
          baselineVal === undefined
        )
          return formatted;

        // 現在値を数値に変換
        const isPercentage =
          typeof formatted === 'string' && formatted.includes('%');
        let currentNum: number;
        if (typeof params.value === 'number') {
          currentNum = params.value;
        } else {
          currentNum = parseFloat(
            String(formatted).replace(/[%,+]/g, '').replace(/▲/g, '-')
          );
        }

        // ベースライン値を数値に変換
        const baselineNum: number =
          typeof baselineVal === 'number'
            ? baselineVal
            : parseFloat(
                String(baselineVal).replace(/[%,+]/g, '').replace(/▲/g, '-')
              );

        if (isNaN(currentNum) || isNaN(baselineNum)) return formatted;

        const diff = currentNum - baselineNum;
        // 小数第1位まで表示する列:
        //   col11(専用機PM/提携機PC)・col9(平均入数)、
        //   および比率(%)列 col3/col8(前年比)・col22/col24(予算比)・
        //   col12(PM/PC商談見込)・col13(直近変動率)
        const ONE_DECIMAL_FIELDS = new Set([
          'col11',
          'col9',
          'col3',
          'col8',
          'col22',
          'col24',
          'col12',
          'col13',
        ]);
        const isOneDecimal = ONE_DECIMAL_FIELDS.has(field);
        const rounded = isOneDecimal
          ? Math.round(diff * 10) / 10
          : Math.round(diff);
        const absDiff = Math.abs(rounded);
        const fmtDiff = (n: number) =>
          isOneDecimal
            ? n.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })
            : n.toLocaleString();

        if (rounded === 0)
          return isPercentage
            ? isOneDecimal
              ? '±0.0%'
              : '±0%'
            : isOneDecimal
              ? '±0.0'
              : '±0';
        if (rounded > 0) {
          const display = `+${fmtDiff(rounded)}${isPercentage ? '%' : ''}`;
          return (
            <span style={{ color: GRID_COLORS.increaseText }}>{display}</span>
          );
        }
        const display = `▲${fmtDiff(absDiff)}${isPercentage ? '%' : ''}`;
        return (
          <span style={{ color: GRID_COLORS.decreaseText }}>{display}</span>
        );
      },
    }),
    []
  );

  // 経費計画グリッド専用 defaultColDef（差分表示 cellRenderer を含む）
  const expensePlanDefaultColDef = useMemo(
    () => ({
      // 編集できない列の見出しをグレーにする（GRID_DEFAULT_COL_DEF を引き継がないため明示。→ grid/gridCommon）
      headerStyle: gridHeaderStyle,
      // 長い見出しは2行に折り返し、列の幅は値に合わせる（基準 OS 150%＝幅 1280px でも横幅に入りきるように → 02 §7・UX-062）
      ...GRID_WRAP_HEADER_COL_DEF,
      sortable: false,
      resizable: true,
      filter: false,
      suppressMenu: true,
      // 数値のセルに数字以外を入れたら元の値へ戻す（手売りと同じ → 02 §7「入力値のチェック」・UX-089）
      valueParser: revertNonNumericValueParser,
      // 数値の列は右寄せ、上段に固定した単位の行は中央（ラベルの列は列ごとに上書き → 02 §6 セルの寄せ）
      cellClass: (params: any) =>
        params.node?.rowPinned === 'top' ? 'cell-center' : 'cell-right',
      cellClassRules: CELL_CLASS_RULES,
      cellRenderer: (params: any) => {
        if (params.node?.rowPinned) {
          return (
            params.valueFormatted ??
            (params.value != null ? String(params.value) : '')
          );
        }
        const rowIndex: number = params.node?.rowIndex ?? -1;
        const field: string = params.colDef?.field ?? '';

        // 親行は空表示（ただし showAsValue 行=条件口は値を表示）
        if (params.data?.isParent && !params.data?.showAsValue) return '';
        // ── 比列（前月比/予算比/前年同月比）: 数式を計算してパーセント表示 ──
        const RATIO_COLS = new Set([
          'catZengetsuHi',
          'catYosanHi',
          'catZennenHi',
        ]);
        if (RATIO_COLS.has(field) && params.api) {
          const formula: string = params.data?.[`${field}_formula`] ?? '';
          if (formula) {
            const refs = parseFormulaReferences(formula);
            if (refs.length >= 2) {
              const cell1 = expenseExcelRefToCellId(refs[0]);
              const cell2 = expenseExcelRefToCellId(refs[1]);
              if (cell1 && cell2) {
                const row1 = params.api.getDisplayedRowAtIndex(cell1.rowIndex);
                const row2 = params.api.getDisplayedRowAtIndex(cell2.rowIndex);
                if (row1 && row2) {
                  // cellRenderer 内で api.getValue を呼ぶと無限ループになるため、
                  // 計画金額は catPlan キャッシュ、実績列(前月/予算/前年同月)は
                  // computeExpenseActual で都度算出（計算行は生データが null のため）。
                  const ACTUAL = new Set([
                    'catZengetsuJisseki',
                    'catYosan',
                    'catZennenJisseki',
                  ]);
                  const cellVal = (cell: {
                    rowIndex: number;
                    colId: string;
                  }) => {
                    if (cell.colId === 'catPlan') {
                      return expenseRow0Cache.current[cell.rowIndex] ?? 0;
                    }
                    if (ACTUAL.has(cell.colId)) {
                      return computeExpenseActual(cell.rowIndex, cell.colId);
                    }
                    const rowNode = params.api.getDisplayedRowAtIndex(
                      cell.rowIndex
                    );
                    return (
                      parseFloat(
                        String(rowNode?.data?.[cell.colId] ?? '0').replace(
                          /[,%]/g,
                          ''
                        )
                      ) || 0
                    );
                  };
                  const v1 = cellVal(cell1);
                  const v2 = cellVal(cell2);
                  // 小数第2位以下は表示直前に四捨五入。計算値(computedVal)は
                  // 差分算出のため丸めず保持する。
                  let computedVal: number;
                  if (formula.includes('/')) {
                    // 分母（実績）が0の場合は比率を0として扱い 0.0% を表示する
                    if (v2 === 0)
                      return isDiffModeRef.current ? '±0.0%' : '0.0%';
                    // 計画 ÷ 実績
                    computedVal = (v1 / v2) * 100;
                  } else {
                    // 差引き（率の差分：条件口率・ロケ運転費率の =B−G 形式）
                    computedVal = v1 - v2;
                  }

                  if (!isDiffModeRef.current) {
                    return formatDecimal1(computedVal) + '%';
                  }

                  // 差分表示: 計算値とベースラインを比較（小数第1位まで）
                  const baseline = expenseBaselineData[rowIndex];
                  const baselineNum = baseline
                    ? parseFloat(
                        String(baseline[field] ?? '0')
                          .replace(/[%,+]/g, '')
                          .replace(/▲/g, '-')
                      )
                    : 0;
                  const rawDiff = isNaN(baselineNum)
                    ? computedVal
                    : computedVal - baselineNum;
                  const diff = Math.round(rawDiff * 10) / 10;
                  const absDiff = Math.abs(diff);
                  if (diff === 0) return '±0.0%';
                  if (diff > 0)
                    return (
                      <span
                        style={{ color: GRID_COLORS.increaseText }}
                      >{`+${formatDecimal1(diff)}%`}</span>
                    );
                  return (
                    <span
                      style={{ color: GRID_COLORS.decreaseText }}
                    >{`▲${formatDecimal1(absDiff)}%`}</span>
                  );
                }
              }
            }
          }
          return toHalfWidthDash(String(params.data?.[field] ?? ''));
        }
        // ────────────────────────────────────────────────────────────

        const formatted: string =
          params.valueFormatted ??
          (params.value != null ? String(params.value) : '');

        // 差分対象列: 計画金額・拠点(本社/支社)・実績(前月/予算/前年同月)
        const targetCols = new Set([
          'catPlan',
          'catHonsha',
          'catShishaA',
          'catShishaBKyotsu',
          'catShishaBKaitaku',
          'catZengetsuJisseki',
          'catYosan',
          'catZennenJisseki',
        ]);
        if (!isDiffModeRef.current || !targetCols.has(field)) {
          return toHalfWidthDash(formatted);
        }

        // 現在値が "－" ならそのまま（表示は半角「-」）
        if (formatted === '－' || formatted === '' || formatted == null)
          return toHalfWidthDash(formatted);

        // ベースライン取得
        const baseline = expenseBaselineData[rowIndex];
        if (!baseline) return formatted;
        const baselineVal = baseline[field];

        // ベースラインが "－" または未定義なら実値をそのまま表示
        if (
          baselineVal === '－' ||
          baselineVal === null ||
          baselineVal === undefined
        )
          return formatted;

        // 現在値を数値に変換
        const isPercentage =
          typeof formatted === 'string' && formatted.includes('%');
        let currentNum: number;
        if (typeof params.value === 'number') {
          currentNum = params.value;
        } else {
          currentNum = parseFloat(
            String(formatted).replace(/[%,+]/g, '').replace(/▲/g, '-')
          );
        }

        // ベースライン値を数値に変換
        const baselineNum: number =
          typeof baselineVal === 'number'
            ? baselineVal
            : parseFloat(
                String(baselineVal).replace(/[%,+]/g, '').replace(/▲/g, '-')
              );

        if (isNaN(currentNum) || isNaN(baselineNum)) return formatted;

        const diff = currentNum - baselineNum;
        const rounded = Math.round(diff);
        const absDiff = Math.abs(rounded);

        if (rounded === 0) return isPercentage ? '±0%' : '±0';
        if (rounded > 0) {
          const display = isPercentage
            ? `+${rounded}%`
            : `+${rounded.toLocaleString()}`;
          return (
            <span style={{ color: GRID_COLORS.increaseText }}>{display}</span>
          );
        }
        const display = isPercentage
          ? `▲${absDiff}%`
          : `▲${absDiff.toLocaleString()}`;
        return (
          <span style={{ color: GRID_COLORS.decreaseText }}>{display}</span>
        );
      },
      // ツールチップ（ヘッダー全文＋セル値、数式ガイドON時は数式優先）は
      // expensePlanColumnDefsWithTooltips（addStandardCellTooltips）で列ごとに付与する。
    }),
    []
  );

  // 計画金額列（catPlan）の計算済み値を生データと販売計画から直接算出
  const computeCatPlanValues = (api: any): Record<number, number> => {
    const num = (v: any) =>
      parseFloat(String(v ?? '0').replace(/[,%]/g, '')) || 0;
    const rateOf = (v: any, def: string) => {
      const r = num(v ?? def);
      return r > 1 ? r / 100 : r;
    };
    const getData = (idx: number) =>
      api?.getDisplayedRowAtIndex(idx)?.data ??
      expensePlanDataRef.current[idx] ??
      {};
    const sales = computeSalesPlanCol1(salesPlanDataRef.current);
    // 条件口（オペ条件口=3, 帳合料=4, オペ金銭口=5）
    const opeJoken = Math.round(sales * rateOf(getData(3).exp_col16, '21%'));
    const chogai = Math.round(sales * rateOf(getData(4).exp_col17, '3%'));
    const opeKinsen = num(getData(5).catPlan);
    const gokei = opeJoken + chogai + opeKinsen;
    const jokenRate = sales === 0 ? 0 : Math.round((gokei / sales) * 100);
    // ロケ運転費金額（ロケ運転費=7、ロケ率=8）。手入力で数式クリア済みなら生値
    const locRow = getData(7);
    const locRate = rateOf(getData(8).catPlan, '0%');
    const locAmount = locRow.catPlan_formula
      ? Math.round(sales * locRate)
      : num(locRow.catPlan);
    // その他経費（拠点列の合算）：オペ協力金=9〜前払金(ロケ契約中)=14
    // ※ 行インデックスはデータ種の区切り行（1=営業経費／15=自販機関係費）を含む。
    const sumBranch = (idx: number) => {
      const d = getData(idx);
      return (
        num(d.catHonsha) +
        num(d.catShishaA) +
        num(d.catShishaBKyotsu) +
        num(d.catShishaBKaitaku)
      );
    };
    const ope = sumBranch(9);
    const ichiji = sumBranch(10);
    const locKeiyaku = sumBranch(11);
    const maebarai = sumBranch(13);
    const maebaraiKeiyakuChu = sumBranch(14);
    // 前払金(償却)(12) ＝ 自行の拠点列の合計。拠点列自体が
    // ロケ契約中(14) + ロケ契約見込(13) のため、子行の合計と一致する
    //（生データは null のため sumBranch(12) ではなく子行から求める）。
    const maebaraiSyokyaku = maebaraiKeiyakuChu + maebarai;
    const koramu = num(getData(16).catPlan);
    const lease = num(getData(17).catPlan);
    const kigu = num(getData(18).catPlan);
    // 前払金(償却)(12) が子行(13・14)の小計のため、合計には 12 のみを加える
    const keihiTotal =
      gokei +
      locAmount +
      ope +
      ichiji +
      locKeiyaku +
      maebaraiSyokyaku +
      koramu +
      lease +
      kigu;
    return {
      0: keihiTotal, // 経費金額合計
      2: gokei, // 条件口（合計）
      3: opeJoken, // オペ条件口
      4: chogai, // 帳合料
      6: jokenRate, // 条件口率
      7: locAmount, // ロケ運転費 金額
      9: ope, // オペ協力金
      10: ichiji, // その他一時金
      11: locKeiyaku, // ロケ契約料
      12: maebaraiSyokyaku, // 前払金（償却）
      13: maebarai, // 前払金（ロケ契約見込）
      14: maebaraiKeiyakuChu, // 前払金（ロケ契約中）
    };
  };

  // 実績列（前月実績・予算・前年同月実績）の設定数式に基づく計算値を返す。
  // 計算行（経費金額合計=0・条件口=2・条件口率=6・ロケ運転費=7）は数式で算出し、
  // それ以外の行は生データ（入力値）を返す。分母が0になる比率は0を返す（0%表示）。
  // キャッシュに依存せず都度算出するため、比 cellRenderer からも安全に呼べる
  //（レンダラー内で api.getCellValue を呼ばないため無限ループにならない）。
  const computeExpenseActual = (rowIndex: number, field: string): number => {
    const num = (v: any) =>
      parseFloat(String(v ?? '0').replace(/[,%]/g, '')) || 0;
    const data = expensePlanDataRef.current;
    const raw = (i: number) => num((data[i] as any)?.[field]);
    const sales0: any = salesPlanDataRef.current?.[0] ?? {};
    // 各列の売上ベース：前月実績=前月社外売上高(180,000,000)、
    // 予算=商流販売店計の予算金額(col21)、前年同月実績=前年実績金額(col2)
    const salesBase =
      field === 'catZengetsuJisseki'
        ? 180000000
        : field === 'catYosan'
          ? num(sales0.col21)
          : num(sales0.col2);
    // 条件口(2)＝オペ条件口(3)+帳合料(4)+オペ金銭口(5)
    const joken = () => raw(3) + raw(4) + raw(5);
    switch (rowIndex) {
      case 2:
        return joken();
      case 0:
        // 経費金額合計＝条件口 + ロケ運転費(7・固定値) + オペ協力金〜販売器具費(9〜18)
        // ※ 区切り行（15=自販機関係費）は値を持たないため加算対象に含めない。
        // ※ 前払金(償却)(12) は子行(13・14)の小計行のため、12 のみを加える。
        return (
          joken() +
          raw(7) +
          raw(9) +
          raw(10) +
          raw(11) +
          raw(12) +
          raw(16) +
          raw(17) +
          raw(18)
        );
      case 6:
        // 条件口率＝条件口 ÷ 各列売上ベース ×100（分母0は0%）
        return salesBase === 0 ? 0 : Math.round((joken() / salesBase) * 100);
      case 8:
        // ロケ運転費率の前月実績＝ロケ運転費(前月実績 G9) ÷ 前月の社外売上高(180,000,000) ×100
        if (field === 'catZengetsuJisseki') {
          return Math.round((raw(7) / 180000000) * 100);
        }
        // 予算＝ロケ運転費(予算 I9) ÷ 商流販売店計の予算金額(col21)、
        // 前年同月実績＝ロケ運転費(前年 K9) ÷ 商流販売店計の前年実績金額(col2)
        // いずれも ×100（分母0は0%）
        return salesBase === 0 ? 0 : Math.round((raw(7) / salesBase) * 100);
      default:
        // ロケ運転費(7) を含むその他の行は生データ（固定値/入力値）を返す
        return raw(rowIndex);
    }
  };

  // 経費計画用のカラム定義（転置：行=経費項目、列=拠点/区分の2レベルヘッダー）
  // 列の定義は最初の描画で1回だけ作る（作り直さない。セルの値・強調は ref から読む）。
  const [expensePlanColumnDefs] = useState(() =>
    buildExpensePlanColumnDefs({
      expenseHighlightedCellsRef,
      isDiffModeRef,
      expenseBaselineData,
      recalculateExpensePlan,
      setExpensePlanData,
      expensePlanDataRef,
      isExpenseCellEditable,
      getExpenseCellStyle,
      computeCatPlanValues,
      computeExpenseActual,
    })
  );

  // マウスオーバー時のツールチップ（画面設計標準準拠）を付与した列定義。
  // ホバーは常にセル値を表示し、数式はクリック時の数式ガイドでのみ表示する。
  // そのため各列の数式getterを下記 Map（field → getter）へ退避し、クリックハンドラから参照する。
  const salesFormulaGetterByField = useRef<
    Map<string, (params: any) => string | null>
  >(new Map());
  const expenseFormulaGetterByField = useRef<
    Map<string, (params: any) => string | null>
  >(new Map());

  // 販売計画グリッドは各列に数式getterがあるためそのまま退避し、
  // 経費計画グリッドは数式getterが集約関数（expenseFormulaDesc）側にあるため共有getterを渡す。
  const salesPlanColumnDefsWithTooltips = useMemo(() => {
    salesFormulaGetterByField.current = new Map();
    return addStandardCellTooltips(
      salesPlanColumnDefs,
      undefined,
      salesFormulaGetterByField.current
    );
  }, [salesPlanColumnDefs]);
  const expensePlanColumnDefsWithTooltips = useMemo(() => {
    expenseFormulaGetterByField.current = new Map();
    return addStandardCellTooltips(
      expensePlanColumnDefs,
      (params: any) => {
        const field = params.colDef?.field;
        if (!field || params.node?.rowPinned) return null;
        return expenseFormulaDesc(
          params.node?.rowIndex ?? -1,
          field,
          params.data
        );
      },
      expenseFormulaGetterByField.current
    );
  }, [expensePlanColumnDefs]);

  // 数式ガイドの色分け凡例と切替ボタン。販売計画・経費計画の各カードのタイトル部
  // （既存ボタンの左）へ同じものを置く。状態（showFormulaGuide）を共有しているため、
  // どちらのボタンで切り替えても両カードが連動する。
  // 凡例は色相に加え実線/破線でも参照・依存を区別する（→ 06 色以外の手がかり）。
  // 数式ガイドの ON/OFF（共通部品。ON のときは凡例も出す → 02 §6・UX-063）
  const formulaGuideActions = (
    <FormulaGuideToggle
      shown={isFormulaGuideShown}
      onChange={setIsFormulaGuideShown}
    />
  );

  return (
    <div
      className="min-w-300"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.ag-cell'))
          setFormulaTooltip(null);
      }}
    >
      {/* 浮遊数式ツールチップ（共通部品。式・実値の各行は折り返さない） */}
      <FloatingFormulaTooltip tooltip={formulaTooltip} />
      <div className="px-6 pt-3 pb-3">
        {/* 画面名はヘッダー（システム名の右）に表示する。
            数式ガイドの操作は販売計画・経費計画の各カードへ置く。 */}
        <ScreenTitle title="計画詳細(自販機)" />

        {/* 計画詳細セクション */}
        <BasicInfoCard
          onCommentHistoryToggle={() => setIsCommentPanelOpen((v) => !v)}
          // 計画詳細(管理対象商品)へ移るボタンは、専用の行を作らず基本情報の見出しの行の右端に置く。
          // 操作ボタンと見分けられる共通部品にする（→ 02 §6・UX-059・UX-060）
          headerActions={
            <ScreenLinkButton>計画詳細(管理対象商品)</ScreenLinkButton>
          }
        />

        {/* 販売計画(集計)：自販機専用版（a3ec0f8時点の集計コンポーネントを固定） */}
        <AggregationPane />

        {/* 販売計画と経費計画を配置 */}
        <div className="flex flex-col gap-4">
          {/* 販売計画セクション */}
          <CollapsibleCard
            title="販売計画"
            open={isSalesPlanOpen}
            onOpenChange={setIsSalesPlanOpen}
            headerActions={
              <>
                {formulaGuideActions}
                <HeaderDivider />
                <button type="button" className="btn-toolbar-outline">
                  <RefreshCw className="h-4 w-4" />
                  販売計画自動更新
                </button>
                <HeaderDivider />
                {/* 実数／差分表示の切替（共通部品 SegmentToggle → 02 §6） */}
                <SegmentToggle
                  ariaLabel="表示値"
                  options={[
                    {
                      value: 'actual',
                      label: '実数表示',
                      title: ACTUAL_MODE_TOOLTIP,
                    },
                    {
                      value: 'diff',
                      label: '差分表示',
                      title: DIFF_MODE_TOOLTIP,
                    },
                  ]}
                  value={isDiffMode ? 'diff' : 'actual'}
                  onChange={(v) => setIsDiffMode(v === 'diff')}
                />
              </>
            }
          >
            <div className="p-2">
              {/* 出荷稼働日・前年比・進捗率 入力/表示欄 */}
              <div className="flex items-center gap-10 mb-3 px-1">
                <div className="flex items-center gap-2">
                  <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
                    出荷稼働日
                  </label>
                  {shukkaWorkingDays.isInput ? (
                    <>
                      <NumericInput
                        maxFractionDigits={0}
                        aria-label="出荷稼働日"
                        value={shukkaWorkingDays.text}
                        onChange={(e) => {
                          const newData = [...salesPlanData];
                          newData[0] = {
                            ...newData[0],
                            col17: e.target.value,
                          };
                          setSalesPlanData(newData);
                          setTimeout(() => recalculateSalesPlan(), 0);
                        }}
                        onClick={onShukkaWorkingDaysClick}
                        style={
                          highlightedCells.includes('0-col17')
                            ? REF_HIGHLIGHT_STYLE
                            : undefined
                        }
                        className={`${TEXT_INPUT_CLASS} w-20 text-right`}
                      />
                      <span className="text-xs text-gray-500">日</span>
                    </>
                  ) : (
                    <>
                      <div
                        className="min-w-12 h-8 px-1 text-sm text-right flex items-center justify-end border-2 border-transparent rounded cursor-pointer font-bold"
                        style={{
                          color: shukkaWorkingDays.color,
                          ...(highlightedCells.includes('0-col17')
                            ? REF_HIGHLIGHT_STYLE
                            : {}),
                        }}
                        onClick={onShukkaWorkingDaysClick}
                      >
                        {shukkaWorkingDays.text}
                      </div>
                      {/* 差分表示でも単位「日」を表示する */}
                      <span className="text-xs text-gray-500">日</span>
                    </>
                  )}
                </div>
                {/* 前年出荷稼働日：出荷稼働日前年比の分母にあたる参照値。
                    入力できない表示専用の値のため、入力欄の形（枠・グレーの地）にせず文字だけで出す
                    （枠は数式ガイドの強調用に透明で確保する。→ 05「表示専用の値は入力欄の形にしない」・UX-053）。 */}
                <div className="flex items-center gap-2">
                  <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
                    前年出荷稼働日
                  </label>
                  <div
                    className="min-w-12 h-8 px-1 text-sm text-right flex items-center justify-end border-2 border-transparent rounded cursor-pointer"
                    onClick={onPrevYearShukkaWorkingDaysClick}
                    style={{
                      color: prevYearShukkaWorkingDays.color,
                      // 出荷稼働日前年比の数式（=R2/AB2）の参照元として緑で強調する。
                      ...(highlightedCells.includes('0-col27')
                        ? REF_HIGHLIGHT_STYLE
                        : {}),
                    }}
                  >
                    {prevYearShukkaWorkingDays.text}
                  </div>
                  <span className="text-xs text-gray-500">日</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
                    出荷稼働日前年比
                  </label>
                  <div
                    className="min-w-12 h-8 px-1 text-sm text-right flex items-center justify-end border-2 border-transparent rounded cursor-pointer"
                    onClick={(e) =>
                      onHeaderValueClick(
                        e,
                        '数式: 出荷稼働日 ÷ 前年出荷稼働日',
                        shukkaYoyRefCells
                      )
                    }
                    style={{
                      color: shukkaYoyRatio.color,
                      // 参照元（緑）を優先し、無ければ依存（オレンジ）を適用する。
                      // 専用機PM/提携機PC のセルをクリックすると当項目が参照元になる。
                      ...(headerRefHighlights.has('shukkaYoyRatio')
                        ? REF_HIGHLIGHT_STYLE
                        : headerDependentHighlights.has('shukkaYoyRatio')
                          ? { border: DEP_HIGHLIGHT_BORDER }
                          : {}),
                    }}
                  >
                    {valueOrEmpty(shukkaYoyRatio.text)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={`${FORM_LABEL_CLASS} whitespace-nowrap`}>
                    売上函数：当月進捗率
                  </label>
                  <div
                    className="min-w-12 h-8 px-1 text-sm text-right flex items-center justify-end border-2 border-transparent rounded cursor-pointer"
                    onClick={(e) =>
                      onHeaderValueClick(
                        e,
                        '数式: 商流販売店計の当月函数 ÷ 商流販売店計の合計函数',
                        ['0-col4', '0-col6']
                      )
                    }
                    style={{
                      color: progressRate.color,
                      ...(headerDependentHighlights.has('progressRate')
                        ? { border: DEP_HIGHLIGHT_BORDER }
                        : {}),
                    }}
                  >
                    {valueOrEmpty(progressRate.text)}
                  </div>
                </div>
              </div>
              <div className="sales-plan-grid" style={{ width: '100%' }}>
                <style>{`
                  ${gridOverrideStyles('sales-plan-grid')}
                  /* ── 販売計画固有ルール ── */
                  /* カテゴリ列（行タイトル）の左インデント */
                  .sales-plan-grid .ag-cell[col-id="category"] { padding-left: 0.5rem !important; }
                  .sales-plan-grid .ag-row:not(.ag-row-pinned) .ag-cell[col-id="category"] { padding-left: 0.5rem !important; }
                  /* 商流販売店計行（合計行）の背景・太字 */
                  .sales-plan-grid .ag-row[row-index="0"]:not(.ag-row-pinned) { background-color: ${GRID_COLORS.total}; font-weight: bold; }
                  /* 商流販売店計行の稼働日数欄(col17)は白背景（インラインで制御するため !important なし） */
                  .sales-plan-grid .ag-row[row-index="0"]:not(.ag-row-pinned) .ag-cell[col-id="col17"] { background-color: var(--grid-editable); }
                  /* アライアンス品契約状況変動に伴う追加売上金額(col20) のヘッダーを
                     headerName の \\n の位置で改行する。
                     ※ 共通スタイル gridOverrideStyles が .ag-header-cell-text へ
                        white-space: normal !important（\\n を空白として扱う）を指定しているため、
                        打ち消すには !important が必須。付けないと改行位置が列幅任せになる。
                     対象は col-id で当該列に限定し、他列の折り返しには影響させない。 */
                  .sales-plan-grid .ag-header-cell[col-id="col20"] .ag-header-cell-text {
                    white-space: pre-line !important;
                  }
                `}</style>
                {/* 規約例外（集計表）：商品の区分ごとの行が決まっている計画表のため、件数表示（statusBar）は付けない */}
                <AgGridReact
                  className="grid-summary-table"
                  {...salesPlanColumnStateProps}
                  // 共通基本プロパティ（Enter縦移動・Excelライク編集・テキスト選択・
                  // Undo/Redo・列仮想化抑止）。singleClickEdit を持たないため編集は
                  // ダブルクリック／F2／直接入力で開始（標準準拠。Enterは移動のみ）。
                  {...GRID_BASE_PROPS}
                  ref={gridRef}
                  rowData={salesPlanData}
                  context={salesPlanGridContext}
                  onCellValueChanged={handleSalesPlanCellValueChanged}
                  columnDefs={salesPlanColumnDefsWithTooltips}
                  defaultColDef={salesPlanDefaultColDef}
                  // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                  columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                  pinnedTopRowData={unitRowData}
                  getRowId={getPlanRowId}
                  getRowStyle={getRowStyle}
                  // 列は見出しをドラッグして入れ替えられる（計画・支払の明細で同じ → 02 §7「列の入れ替え」・UX-086）
                  stopEditingWhenCellsLoseFocus={true}
                  tooltipShowDelay={300}
                  tooltipHideDelay={10000}
                  // 数式ガイドはシングルクリックのまま維持（ガイドON時のみ動作）。
                  onCellClicked={onCellClicked}
                  // ヘッダー右クリックの「列設定をリセット」（AG Grid 公式 resetColumns）は
                  // 列定義どおりの幅・表示に戻すだけなので、初回アクセス時と同じ
                  // 自動サイズ調整済みの状態へそろえ直す。
                  // リセット直後は列の再描画中のため、次のタスクで適用する。
                  onColumnsReset={(e) => {
                    setTimeout(() => applySalesPlanDefaultLayout(e.api), 0);
                  }}
                  // 列選択（列メニュー）で表示にした列は、列定義の幅のままだと
                  // タイトルや値が見切れるため、内容に合わせて自動サイズ調整する。
                  // 表示直後は当列がまだ描画されていないため、次のタスクで実行する。
                  // ※ 共通フックの列状態保存も引き続き動かす（spread が上書きされるため明示的に呼ぶ）。
                  onColumnVisible={(e) => {
                    salesPlanColumnStateProps.onColumnVisible?.(e);
                    // 列状態の復元（発生元 'api'）では調整しない。調整すると保存済みの
                    // 列幅が自動サイズ調整の幅で上書きされ、幅が記憶されなくなる。
                    if (!COLUMN_SELECT_SOURCES.has(e.source)) return;
                    if (!e.visible || !e.columns?.length) return;
                    const shownCols = e.columns;
                    setTimeout(() => {
                      e.api.autoSizeColumns(shownCols, false);
                      saveGridColumnState(SALES_PLAN_COLUMN_STATE_KEY, e.api);
                    }, 0);
                  }}
                  onFirstDataRendered={(e) => {
                    // 保存済みの列設定が無い＝初回表示のときだけ、既定（全社設定）の
                    // 列幅を確定させて保存する。2回目以降は useGridColumnState が
                    // onGridReady で保存済みの列幅・列の表示/非表示を復元済みのため、
                    // 自動列幅調整も初期非表示列の再適用も行わない。
                    if (!readSavedColumnState(SALES_PLAN_COLUMN_STATE_KEY)) {
                      setTimeout(() => applySalesPlanDefaultLayout(e.api), 100);
                    }
                    // 初期表示時にも再計算する。経費グリッドが先に描画された
                    // 場合は経費側の onFirstDataRendered 実行時点で販売グリッド
                    // api が未準備のため販売計画の再計算が行われない。販売
                    // グリッド描画時にもここで recalculateAll を呼ぶことで、
                    // 描画順に依存せず初期表示時の再計算を確定させる。
                    recalculateAll();
                  }}
                  domLayout="autoHeight"
                />
              </div>
            </div>
          </CollapsibleCard>

          {/* 経費計画セクション */}
          <CollapsibleCard
            title="経費計画"
            open={isExpensePlanOpen}
            onOpenChange={setIsExpensePlanOpen}
            headerActions={
              <>
                {formulaGuideActions}
                <HeaderDivider />
                <button type="button" className="btn-toolbar-outline">
                  <RefreshCw className="h-4 w-4" />
                  経費計画自動更新
                </button>
                <HeaderDivider />
                {/* 実数／差分表示の切替（共通部品 SegmentToggle → 02 §6） */}
                <SegmentToggle
                  ariaLabel="表示値"
                  options={[
                    {
                      value: 'actual',
                      label: '実数表示',
                      title: ACTUAL_MODE_TOOLTIP,
                    },
                    {
                      value: 'diff',
                      label: '差分表示',
                      title: DIFF_MODE_TOOLTIP,
                    },
                  ]}
                  value={isDiffMode ? 'diff' : 'actual'}
                  onChange={(v) => setIsDiffMode(v === 'diff')}
                />
              </>
            }
          >
            <div className="p-2">
              {/* 経費計画グリッド。行数が固定（経費項目＋データ種の区切り行）のため、
                  AG Grid 公式の domLayout="autoHeight" でグリッドの内容高さに合わせ、
                  カード下部に余白が出ないようにする（高さは指定しない）。 */}
              <div className="expense-plan-grid w-full">
                <style>{`
                  ${gridOverrideStyles('expense-plan-grid')}
                  /* 経費項目の字下げは列定義の cellStyle（utilsExpensePlanColumns）で、
                     区切り行の配下を1段・その子行を2段にする（→ 02 §7。UX-052） */
                  /* レート行(オペ条件口=3/帳合料=4 等)の率テキストボックスをセル右端へ
                     寄せるため、category 列の cell-wrapper / cell-value を幅いっぱいに広げる
                     （既定では内容幅に縮むため ml-auto が効かない） */
                  .expense-plan-grid .ag-cell[col-id="category"] .ag-cell-wrapper,
                  .expense-plan-grid .ag-cell[col-id="category"] .ag-cell-value {
                    width: 100%;
                    flex: 1 1 auto;
                  }
                  /* 管理コード別グループの拠点列（本社・支社A・支社B共通・支社B開拓）の
                     ヘッダーを「管理コード／名称」の2段表示にする。
                     headerName の \\n の位置で必ず改行させるため white-space を pre-line にする。
                     ※ 共通スタイル gridOverrideStyles が .ag-header-cell-text へ
                        white-space: normal !important（\\n を空白として扱う）を指定しているため、
                        打ち消すには !important が必須。付けないと改行されない。
                     対象は col-id で拠点列に限定し、他列の折り返しには影響させない。 */
                  .expense-plan-grid
                    .ag-header-cell[col-id='catHonsha']
                    .ag-header-cell-text,
                  .expense-plan-grid
                    .ag-header-cell[col-id='catShishaA']
                    .ag-header-cell-text,
                  .expense-plan-grid
                    .ag-header-cell[col-id='catShishaBKyotsu']
                    .ag-header-cell-text,
                  .expense-plan-grid
                    .ag-header-cell[col-id='catShishaBKaitaku']
                    .ag-header-cell-text {
                    white-space: pre-line !important;
                  }
                `}</style>
                {/* 規約例外（集計表）：経費項目ごとの行が決まっている計画表のため、件数表示（statusBar）は付けない */}
                <AgGridReact
                  className="grid-summary-table"
                  {...expensePlanColumnStateProps}
                  // 共通基本プロパティ（Enter縦移動・Excelライク編集・テキスト選択・
                  // Undo/Redo・列仮想化抑止）。singleClickEdit を持たないため編集は
                  // ダブルクリック／F2／直接入力で開始（標準準拠。Enterは移動のみ）。
                  {...GRID_BASE_PROPS}
                  ref={expenseGridRef}
                  rowData={expensePlanData}
                  context={expensePlanGridContext}
                  onCellValueChanged={handleExpensePlanCellValueChanged}
                  columnDefs={expensePlanColumnDefsWithTooltips}
                  defaultColDef={expensePlanDefaultColDef}
                  // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                  columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                  pinnedTopRowData={expenseUnitRowData}
                  getRowId={getPlanRowId}
                  // 列は見出しをドラッグして入れ替えられる（計画・支払の明細で同じ → 02 §7「列の入れ替え」・UX-086）
                  stopEditingWhenCellsLoseFocus={true}
                  // カードの高さをグリッドの内容高さに合わせる（行数固定のため）
                  domLayout="autoHeight"
                  tooltipShowDelay={300}
                  tooltipHideDelay={10000}
                  // 数式ガイドはシングルクリックのまま維持（ガイドON時のみ動作）。
                  onCellClicked={onExpenseCellClicked}
                  // 「列設定をリセット」後も初回アクセス時と同じ自動サイズ調整済みの
                  // 状態へそろえ直す（販売計画グリッドと同じ扱い）。
                  onColumnsReset={(e) => {
                    setTimeout(() => applyExpensePlanDefaultLayout(e.api), 0);
                  }}
                  // 列選択で表示にした列を自動サイズ調整する（販売計画グリッドと同じ扱い）。
                  onColumnVisible={(e) => {
                    expensePlanColumnStateProps.onColumnVisible?.(e);
                    // 列状態の復元（発生元 'api'）では調整しない。調整すると保存済みの
                    // 列幅が自動サイズ調整の幅で上書きされ、幅が記憶されなくなる。
                    if (!COLUMN_SELECT_SOURCES.has(e.source)) return;
                    if (!e.visible || !e.columns?.length) return;
                    const shownCols = e.columns;
                    setTimeout(() => {
                      e.api.autoSizeColumns(shownCols, false);
                      saveGridColumnState(EXPENSE_PLAN_COLUMN_STATE_KEY, e.api);
                    }, 0);
                  }}
                  onFirstDataRendered={(e) => {
                    // 初回表示（保存済みの列設定が無い）のときだけ自動列幅調整し、
                    // その結果を既定の列設定として保存する。2回目以降は
                    // useGridColumnState が保存済みの列幅・列選択を復元する。
                    if (!readSavedColumnState(EXPENSE_PLAN_COLUMN_STATE_KEY)) {
                      setTimeout(
                        () => applyExpensePlanDefaultLayout(e.api),
                        100
                      );
                    }
                    // 初期表示時に一度再計算し、比行（前月比・予算比・
                    // 前年同月比）が参照する計画金額行のキャッシュ
                    // （expenseRow0Cache）を初期化する。これが無いと
                    // 初回はキャッシュが空のまま分子が 0 になり、比行が
                    // 一律 0% で表示される。
                    recalculateAll();
                  }}
                />
              </div>
            </div>
          </CollapsibleCard>
        </div>
      </div>

      {/* 固定フッター（一覧へ戻る・コメント・差戻し／承認／引戻し／申請／保存） */}
      <PlanDetailFooter
        commentInput={commentInput}
        onCommentInputChange={setCommentInput}
        onBack={() => setIsBackConfirmShown(true)}
      />

      {/* コメント履歴右ペイン（共通部品 CommentHistoryPane。手売りの計画詳細・支払詳細と同じ形 → 02 §6） */}
      <CommentHistoryPane
        open={isCommentPanelOpen}
        onClose={() => setIsCommentPanelOpen(false)}
        items={commentHistory}
      />

      {/* 戻る（画面移動）の確認: 入力中データの破棄を確認する */}
      <ConfirmDialog
        open={isBackConfirmShown}
        title="画面移動の確認"
        confirmLabel="移動"
        description="入力中のデータが破棄されます。本当によろしいですか？"
        onConfirm={() => {
          setIsBackConfirmShown(false);
          navigate('plan-list');
        }}
        onCancel={() => setIsBackConfirmShown(false)}
      />
    </div>
  );
}

import { CollapsibleCard } from '../../ui/collapsible-card';
import { Save, Send, Check, Undo2, History, CornerUpLeft } from 'lucide-react';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { RightPane } from '../../ui/right-pane';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { GetRowIdParams, GridApi } from 'ag-grid-community';
import { AggregationPane } from './components/AggregationPane';
import {
  GRID_COLORS,
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  GRID_EMPTY_TEXT,
  useGridColumnState,
  readSavedColumnState,
  saveGridColumnState,
  GRID_NO_FILTER_COLUMN_TYPES,
} from '../../grid';
import { FORM_LABEL_CLASS } from '../../../../styles/commonStyles';
import {
  PLAN_BASIC_INFO_LABEL_WIDTH,
  PlanBasicInfoField,
  PlanBasicInfoRow,
  PlanBasicInfoSpacer,
} from '../../ui/plan-basic-info';
import { MonthStripPicker } from '../../ui/month-strip-picker';
import { Switch } from '../../ui/switch';
import {
  BASIC_INFO_CREATOR,
  BASIC_INFO_DEALER,
  BASIC_INFO_DEPARTMENT,
  BASIC_INFO_OFFICE,
  BASIC_INFO_STATUS,
} from '../../../constants/planBasicInfoMockData';
import {
  STORE_TIER_LIST,
  firstStoreCode,
  thirdStoreCode,
} from '../../../constants/storeTierMockData';
import { joinCodeName } from '../../../utils/nameCode';
import { ScreenTitle } from '../../ui/screen-title';
import { valueOrEmpty } from '../../ui/empty-value';

// 値の全角「－」（比較対象なし等の目印として値に持つ）は、表示だけ半角「-」にそろえる
// （画面設計標準 3.11。グレーは defaultColDef の cellClassRules 'cell-empty'）。
const toHalfWidthDash = (text: string): string =>
  text === '－' ? GRID_EMPTY_TEXT : text;
// 値が無いセルの「-」をグレーにする（共通の既定列設定のルールを流用）
const EMPTY_CELL_CLASS_RULES = {
  'cell-empty': GRID_DEFAULT_COL_DEF.cellClassRules!['cell-empty'],
};

// 基本情報に表示する三次店/一次店。本画面では販売店・三次店・一次店がいずれも一意（1件）の
// ため、計画詳細(マージン率固定・NET入力)と同じ参照元（storeTierMockData）の先頭を使う。
const BASIC_INFO_STORE_TIER = STORE_TIER_LIST[0];

// 「販売計画No.」だけは既定幅（PlanBasicInfoField の PLAN_BASIC_INFO_LABEL_WIDTH
// ＝5.3125rem）に収まらないため、この項目に限り幅を広げる。他項目は既定幅のままにして、
// 基準画面 計画詳細(マージン率固定・NET入力)と同じ値の開始位置で5列を縦に揃える。
const BASIC_INFO_LABEL_WIDTH_WIDE = 'w-28';

// 一次店の列幅。取引先名（例「T1001:三菱食品株式会社（イオン）」）が既定の1列幅
// （5列等幅）に収まらないため2列分を占有させる。三次店は1列幅に収まるので既定のまま。
const BASIC_INFO_FIRST_STORE_COL_SPAN = 'col-span-2';

// 基本情報の対象年月の初期値（旧表示「対象年度=2026年／対象月=7月」に対応）。
const BASIC_INFO_INITIAL_YEAR_MONTH = '2026/07';

// 前年同月の出荷稼働日（日）。販売計画カードの表示欄と、出荷稼働日前年比
// （出荷稼働日 ÷ 前年出荷稼働日）の計算で共用する。
const PREV_YEAR_SHIPPING_WORKING_DAYS = 19;

// 販売計画No. のダミー値。計画一覧（PlanList）が生成する月次販売計画書No と
// 同じ「A + 年下2桁 + 連番6桁」形式に合わせる。
const BASIC_INFO_SALES_PLAN_NO = 'A26100502';

// 列状態（列幅・列の表示/非表示）の保存キー。画面・グリッドごとに一意にする。
// 列構成を変えたら末尾のバージョンを上げる（旧状態だと新列が末尾に回るため）。
// ※ 初回アクセスの自動列幅調整は「保存済みの列設定が無いこと」を条件に実行するため、
//   既定の列幅を変えたときもバージョンを上げて旧設定を破棄する。
const SALES_PLAN_COLUMN_STATE_KEY = 'salesPlanVending.salesPlan.columnState.v7';
const EXPENSE_PLAN_COLUMN_STATE_KEY =
  'salesPlanVending.expensePlan.columnState.v2';

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

// 指定した桁数で四捨五入する汎用関数
const round = (value: number, decimals: number = 0): number => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

// 比率(%)を小数第1位まで表示する文字列に整形（小数第2位を四捨五入）。
// 計算結果・表示の共通整形に用いる（末尾の "%" は呼び出し側で付与）。
const formatDecimal1 = (value: number): string =>
  (Math.round(value * 10) / 10).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

// 数式ガイドのセル強調スタイル（色は GRID_COLORS へ集約・枠線は border-width-thick=0.125rem）
// クリック＝青実線／参照セル＝緑実線／依存セル＝オレンジ破線で、色相（緑/オレンジ）に
// 依存せず線種でも区別できるようにする（赤緑色覚での混同を避けるユニバーサルデザイン対応。
// → 06 §「色以外の手がかり」）
const CLICK_HIGHLIGHT_BORDER = `0.125rem solid ${GRID_COLORS.clickHighlightBorder}`; // クリックセル（青・実線枠）
const REF_HIGHLIGHT_BORDER = `0.125rem solid ${GRID_COLORS.refHighlightBorder}`; // 参照セル（緑・実線枠）
const DEP_HIGHLIGHT_BORDER = `0.125rem dashed ${GRID_COLORS.dependentBorder}`; // 依存セル（オレンジ・破線枠）
// グリッド外（出荷稼働日欄等）で使う参照セル強調（緑枠のみ・背景は塗らない）
const REF_HIGHLIGHT_STYLE = {
  border: REF_HIGHLIGHT_BORDER,
};

// 販売計画/経費計画グリッドに共通する AG Grid 表示上書き CSS を生成する。
// prefix はグリッドのラッパー class（'sales-plan-grid' / 'expense-plan-grid'）。
// px は使わず rem に統一する（枠線 1px 例外を除く）。グリッド固有のルール
// （合計行・col17 白背景／転置後の行インデックス別インデント等）は各 <style> 側に置く。
const gridOverrideStyles = (prefix: string) => `
  /* 1階層目（最上位グループ行）のみ従来の灰背景を維持。2階層目以降は themeBalham 継承。 */
  .${prefix} .ag-header-row-column-group:first-child { background-color: var(--grid-header-bg); }
  .${prefix} .ag-header-cell-label { justify-content: center; }
  .${prefix} .ag-header-cell-menu-button { display: none !important; }
  /* データ行は themeBalham 本来の表示を継承し、レイアウト（横余白）のみ指定する。 */
  .${prefix} .ag-cell { padding: 0 0.5rem; transition: background-color 0.2s ease; }
  /* ホバー：行全体を薄青でハイライト。編集可(白)/編集不可(灰)/合計(薄青)は元背景を維持。 */
  .${prefix} .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell { background-color: var(--grid-row-hover) !important; }
  .${prefix} .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell[style*="background-color: rgb(255, 255, 255)"] { background-color: var(--grid-editable) !important; }
  .${prefix} .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell[style*="background-color: rgb(243, 244, 246)"] { background-color: var(--grid-actual-value) !important; }
  .${prefix} .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell[style*="background-color: rgb(219, 234, 254)"] { background-color: var(--grid-total) !important; }
  .${prefix} .ag-cell-left-pinned { background-color: inherit !important; }
  .${prefix} .ag-cell-right { text-align: right; justify-content: flex-end; }
  .${prefix} .ag-cell-left { text-align: left !important; justify-content: flex-start !important; display: flex !important; align-items: center !important; }
  .${prefix} .ag-cell-left .ag-cell-wrapper { justify-content: flex-start !important; text-align: left !important; }
  .${prefix} .ag-cell-left .ag-cell-value { text-align: left !important; justify-content: flex-start !important; }
  /* カテゴリー列（最初の列）を強制的に左寄せ（padding は各グリッド固有ルールで指定）。 */
  .${prefix} .ag-cell[col-id="category"] { text-align: left !important; justify-content: flex-start !important; }
  .${prefix} .ag-cell[col-id="category"] .ag-cell-wrapper { justify-content: flex-start !important; }
  .${prefix} .ag-row:not(.ag-row-pinned) .ag-cell[col-id="category"] { text-align: left !important; justify-content: flex-start !important; }
  /* 固定上段（（金額は税抜き）行）の太字・下罫線。
     ※ AG Grid が固定行へ付与するクラスは ag-row-pinned。ag-row-pinned-top は
        存在せず、指定が効かないため使わない。
     ※ 行の背景はセル側（下の .ag-floating-top .ag-cell）がテーマのヘッダー色で
        塗り潰すため指定しない（実績登録の同じ行と指定を揃える）。 */
  .${prefix} .ag-row-pinned { font-weight: bold; border-bottom: 0.125rem solid var(--grid-pinned-row-border); }
  /* （金額は税抜き）行（固定上段）を themeBalham のヘッダー用変数に束ねる。 */
  .${prefix} .ag-floating-top .ag-cell { background-color: var(--ag-header-background-color) !important; color: var(--ag-header-text-color, var(--ag-header-foreground-color)); font-weight: var(--ag-header-font-weight, 600); }
  /* ヘッダーテキストの折り返しを有効化 */
  .${prefix} .ag-header-cell-text { white-space: normal !important; line-height: 1.3 !important; word-break: break-word !important; }
  .${prefix} .ag-header-group-cell-label { white-space: normal !important; line-height: 1.3 !important; word-break: break-word !important; }
  .${prefix} .ag-header-cell-label { white-space: normal !important; line-height: 1.3 !important; word-break: break-word !important; }
`;

// 数式を表示するカスタムセルエディタ
const FormulaEditor = (props: any) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 編集開始時に数式または値を設定
    const fieldName = props.colDef?.field + '_formula';
    if (props.data[fieldName]) {
      setValue(props.data[fieldName]);
    } else {
      setValue(props.value || '');
    }

    // フォーカスを設定
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 0);
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          props.stopEditing();
        } else if (e.key === 'Escape') {
          props.stopEditing(true);
        }
      }}
      className="w-full h-full border-none outline-none px-1 text-sm text-right"
    />
  );
};

// マウスオーバー時のツールチップ（画面設計標準準拠）を列定義へ付与するヘルパー。
// ・ヘッダー：列幅で省略された見出しを全文表示（AG Grid公式 headerTooltip）。
// ・セル：常にセル値を表示する（数式が設定されたセルでもセル値）。
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
      // ホバー時は常にセル値を表示（標準準拠）。数式の有無・数式ガイドの状態に依らない。
      tooltipValueGetter: (params: any) =>
        params.value != null ? String(params.value) : '',
    };
  });
}

interface PlanDetailVendingProps {
  // 一覧等への画面遷移コールバック
  onMenuChange?: (menuId: string) => void;
}

export default function PlanDetailVending({
  onMenuChange,
}: PlanDetailVendingProps = {}) {
  // 「一覧へ戻る」押下時の確認ダイアログ表示状態
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  // 基本情報の対象年月（月ストリップ）。基準画面 計画詳細(マージン率固定・NET入力)と同様、
  // 画面内で保持する（本画面では表示専用でグリッドへは連動しない）。
  const [targetYearMonth, setTargetYearMonth] = useState(
    BASIC_INFO_INITIAL_YEAR_MONTH
  );
  const [isSalesPlanOpen, setIsSalesPlanOpen] = useState(true);
  const [isExpensePlanOpen, setIsExpensePlanOpen] = useState(true);

  const [highlightedCells, setHighlightedCells] = useState<string[]>([]);
  const highlightedCellsRef = useRef<string[]>([]);
  const gridRef = useRef<any>(null);
  // 数式ガイド
  const [showFormulaGuide, setShowFormulaGuide] = useState(false);
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
  const [formulaTooltip, setFormulaTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

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
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  // コメント履歴ペインのモックデータ。
  // 販売計画の実際の流れ（未申請 → 承認待ち → 差戻し → 承認待ち → 承認済み → 確定）を
  // 1件ずつたどれるようにし、ペインの表示順に合わせて新しい順（日時の降順）で並べる。
  // ※もう一つの終了ステータス「未承認確定」はシステムが自動実行するもので、
  //   確定とは排他のためこの履歴には含めない（発生時は承認者・コメントを持たない）。
  // action は行った操作、status はその操作の後の計画ステータス。支払詳細の
  // コメント履歴（shared/CommentHistoryPane）と同じ持ち方・同じ体裁で表示する。
  const [commentHistory] = useState([
    {
      action: '確定',
      status: '確定',
      date: '2025/02/21 14:05:10',
      user: '◇山　〇郎',
      text: '内容を確認のうえ確定。',
    },
    {
      action: '承認',
      status: '承認済み',
      date: '2025/02/21 12:47:05',
      user: '◇山　〇郎',
      text: '',
    },
    {
      action: '申請',
      status: '承認待ち',
      date: '2025/02/21 9:30:45',
      user: '河〇　雅◇',
      text: '函数計画を前年販売実績120%となるように修正しました',
    },
    {
      action: '差戻し',
      status: '差戻し',
      date: '2025/02/20 18:47:05',
      user: '◇山　〇郎',
      text: '函数計画を前年販売実績120%となるよう更新すること',
    },
    {
      action: '申請',
      status: '承認待ち',
      date: '2025/02/20 16:14:25',
      user: '河〇　雅◇',
      text: '販促NETは競合対策提示条件。',
    },
    {
      action: '保存',
      status: '未申請',
      date: '2025/02/20 15:54:45',
      user: '河〇　雅◇',
      text: '販促NETは競合対策提示条件。',
    },
  ]);
  const isDiffModeRef = useRef(false);

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
    // 1. 初期非表示列も一時的に表示して自動調整する。これらを
    //    後から再表示したときに第三階層タイトルが折り返さない
    //    幅を確保しておくため。
    api.applyColumnState({
      state: salesPlanHiddenColsState(false),
      applyOrder: false,
    });
    api.autoSizeAllColumns(false);
    // 2. 初期非表示列を隠す（＝列定義の hide: true と同じ状態に戻す）
    api.applyColumnState({
      state: salesPlanHiddenColsState(true),
      applyOrder: false,
    });
    // 3. 非表示を反映した状態で再度自動調整する。
    //    可視列のみが対象になるため、各グループの可視列が
    //    第二階層タイトル（当月実績・函単価 等）の幅に
    //    合わせて広がり、タイトルが折り返さなくなる
    //    （skipHeader=false でヘッダー/グループヘッダー幅も加味）。
    //    非表示列は対象外なので 1. の幅が保持される。
    api.autoSizeAllColumns(false);
    // 確定した既定の列設定を保存する。以降はこれを起点に、
    // ユーザーの列幅変更・列の表示/非表示が引き継がれる。
    saveGridColumnState(SALES_PLAN_COLUMN_STATE_KEY, api);
  }, []);

  // 経費計画グリッドの既定レイアウト（初期非表示列は無いため自動調整のみ）。
  const applyExpensePlanDefaultLayout = useCallback((api: GridApi) => {
    api.autoSizeAllColumns(false);
    saveGridColumnState(EXPENSE_PLAN_COLUMN_STATE_KEY, api);
  }, []);

  // 販売計画差分表示の基準データ（image-3.png のスナップショット）
  // 数値型は数字、"－"のセルは文字列 "－"
  const salesPlanBaselineData = [
    // row 0: 商流販売店計
    {
      col1: 192525984,
      col2: 190000000,
      col3: 101.3,
      col4: 40000,
      col5: 42,
      col6: 95880,
      col7: 42790,
      col8: 224.1,
      col9: '－',
      col10: '－',
      col11: '－',
      col25: '－',
      col12: '－',
      col13: '－',
      col14: '－',
      col26: '－',
      col15: '－',
      col16: 105,
      col17: 20,
      col18: '－',
      col19: 100,
      col20: '－',
      col21: 0,
      col22: 0,
      col23: 0,
      col24: 0,
    },
    // row 1: 専用機
    {
      col1: 185812000,
      col2: '176000000',
      col3: '105.6',
      col4: '－',
      col5: '－',
      col6: 92906,
      col7: 40000,
      col8: '232.3',
      col9: 25,
      col10: 2322650,
      col11: 1133,
      col25: 950,
      col12: 110,
      col13: 103,
      col14: 2050,
      col26: 2000,
      col15: 50,
      col16: '－',
      col17: '－',
      col18: 2000,
      col19: '－',
      col20: '－',
      col21: 0,
      col22: 0,
      col23: 0,
      col24: 0,
    },
    // row 2: 提携機
    {
      col1: 1954000,
      col2: 3625000,
      col3: 53.9,
      col4: '－',
      col5: '－',
      col6: 651,
      col7: 500,
      col8: 130.3,
      col9: 24,
      col10: 15632,
      col11: 14.2,
      col25: 15.0,
      col12: 100,
      col13: 90,
      col14: 1100,
      col26: 1000,
      col15: 100,
      col16: '－',
      col17: '－',
      col18: 3000,
      col19: '－',
      col20: '－',
      col21: 0,
      col22: 0,
      col23: 0,
      col24: 0,
    },
    // row 3: アライアンス品（本社入力）
    {
      col1: 384984,
      col2: 612000,
      col3: 62.9,
      col4: '－',
      col5: '－',
      col6: 172,
      col7: 160,
      col8: '107.8',
      col9: 24,
      col10: 4138,
      col11: 26.5,
      col25: '21.0',
      col12: '－',
      col13: 120,
      col14: 156,
      col26: '－',
      col15: '－',
      col16: '－',
      col17: '－',
      col18: 2232,
      col19: '－',
      col20: 150,
      col21: 0,
      col22: 0,
      col23: 0,
      col24: 0,
    },
    // row 4: その他（手売り）
    {
      col1: 375000,
      col2: 300000,
      col3: 125,
      col4: '－',
      col5: '－',
      col6: 150,
      col7: 130,
      col8: 115.4,
      col9: '－',
      col10: '－',
      col11: '－',
      col25: '－',
      col12: '－',
      col13: '－',
      col14: '－',
      col26: '－',
      col15: '－',
      col16: '－',
      col17: '－',
      col18: 2500,
      col19: '－',
      col20: '－',
      col21: 0,
      col22: 0,
      col23: 0,
      col24: 0,
    },
    // row 5: 出荷実販差
    {
      col1: 4000000,
      col2: 9763000,
      col3: 41,
      col4: '－',
      col5: '－',
      col6: 2000,
      col7: 2000,
      col8: 100,
      col9: '－',
      col10: 0,
      col11: '－',
      col25: '－',
      col12: '－',
      col13: '－',
      col14: '－',
      col26: '－',
      col15: '－',
      col16: '－',
      col17: '－',
      col18: 2000,
      col19: '－',
      col20: '－',
      col21: '－',
      col22: '－',
      col23: '－',
      col24: '－',
    },
    // row 7: 前月実績
    {
      col1: 0,
      col2: 0,
      col3: 0,
      col4: 0,
      col5: 0,
      col6: 0,
      col7: 0,
      col8: 0,
      col9: 0,
      col10: 0,
      col11: 0,
      col25: 0,
      col12: 0,
      col13: 0,
      col14: 0,
      col26: 0,
      col15: 0,
      col16: 0,
      col17: 0,
      col18: 0,
      col19: 0,
      col20: 0,
      col21: 0,
      col22: 0,
      col23: 0,
      col24: 0,
    },
    // row 8: 前月比
    {
      col1: 0,
      col2: 0,
      col3: 0,
      col4: 0,
      col5: 0,
      col6: 0,
      col7: 0,
      col8: 0,
      col9: 0,
      col10: 0,
      col11: 0,
      col25: 0,
      col12: 0,
      col13: 0,
      col14: 0,
      col26: 0,
      col15: 0,
      col16: 0,
      col17: 0,
      col18: 0,
      col19: 0,
      col20: 0,
      col21: 0,
      col22: 0,
      col23: 0,
      col24: 0,
    },
    // row 10: 予算
    {
      col1: 0,
      col2: 0,
      col3: 0,
      col4: 0,
      col5: 0,
      col6: 0,
      col7: 0,
      col8: 0,
      col9: 0,
      col10: 0,
      col11: 0,
      col25: 0,
      col12: 0,
      col13: 0,
      col14: 0,
      col26: 0,
      col15: 0,
      col16: 0,
      col17: 0,
      col18: 0,
      col19: 0,
      col20: 0,
      col21: 0,
      col22: 0,
      col23: 0,
      col24: 0,
    },
    // row 11: 予算比
    {
      col1: 0,
      col2: 0,
      col3: 0,
      col4: 0,
      col5: 0,
      col6: 0,
      col7: 0,
      col8: 0,
      col9: 0,
      col10: 0,
      col11: 0,
      col25: 0,
      col12: 0,
      col13: 0,
      col14: 0,
      col26: 0,
      col15: 0,
      col16: 0,
      col17: 0,
      col18: 0,
      col19: 0,
      col20: 0,
      col21: 0,
      col22: 0,
      col23: 0,
      col24: 0,
    },
    // row 13: 前年同月実績
    {
      col1: 0,
      col2: 0,
      col3: 0,
      col4: 0,
      col5: 0,
      col6: 0,
      col7: 0,
      col8: 0,
      col9: 0,
      col10: 0,
      col11: 0,
      col25: 0,
      col12: 0,
      col13: 0,
      col14: 0,
      col26: 0,
      col15: 0,
      col16: 0,
      col17: 0,
      col18: 0,
      col19: 0,
      col20: 0,
      col21: 0,
      col22: 0,
      col23: 0,
      col24: 0,
    },
    // row 14: 前年同月比
    {
      col1: 0,
      col2: 0,
      col3: 0,
      col4: 0,
      col5: 0,
      col6: 0,
      col7: 0,
      col8: 0,
      col9: 0,
      col10: 0,
      col11: 0,
      col25: 0,
      col12: 0,
      col13: 0,
      col14: 0,
      col26: 0,
      col15: 0,
      col16: 0,
      col17: 0,
      col18: 0,
      col19: 0,
      col20: 0,
      col21: 0,
      col22: 0,
      col23: 0,
      col24: 0,
    },
  ];

  // 経費計画差分表示の基準データ（image-4.png のスナップショット）
  // rowIndex は expensePlanData の行インデックスに対応
  // ※ データ種の区切り行（1=営業経費／14=自販機関係費）は値を持たないため基準データも持たない
  // 転置後の rowIndex は expensePlanData の行（経費項目）に対応
  // フィールドは各列（catPlan=計画金額, catHonsha=本社, ... catZennenHi=前年同月比）
  const expenseBaselineData: Record<number, Record<string, any>> = {
    // 経費金額合計
    0: {
      catPlan: 84123174,
      // 拠点列は オペ協力金(9)〜前払金(償却)(12) の合算
      //（12 は子行 13・14 の小計のため、13・14 は含めない）
      catHonsha: 220000,
      catShishaA: 230000,
      catShishaBKyotsu: 150000,
      catShishaBKaitaku: 50000,
      catZengetsuJisseki: 80428000,
      catZengetsuHi: 104.6,
      catYosan: 0,
      catYosanHi: 0,
      catZennenJisseki: 76812500,
      catZennenHi: 109.5,
    },
    // 条件口（合計）
    2: {
      catPlan: 46208237,
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: 45003000,
      catZengetsuHi: 102.7,
      catYosan: 0,
      catYosanHi: 0,
      catZennenJisseki: 39502500,
      catZennenHi: 117,
    },
    // オペ条件口
    3: {
      catPlan: 40430457,
      // オペ条件口率（exp_col16）の差分基準値
      exp_col16: '21%',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: 40000000,
      catZengetsuHi: 101.1,
      // 予算・予算比は計画の対象外のため差分の基準も "－"（差分を出さない）
      catYosan: '－',
      catYosanHi: '－',
      catZennenJisseki: 35000000,
      catZennenHi: 115.5,
    },
    // 帳合料
    4: {
      catPlan: 5775780,
      // 帳合料率（exp_col17）の差分基準値
      exp_col17: '3%',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: 5000000,
      catZengetsuHi: 115.5,
      // 予算・予算比は計画の対象外のため差分の基準も "－"（差分を出さない）
      catYosan: '－',
      catYosanHi: '－',
      catZennenJisseki: 4500000,
      catZennenHi: 128.4,
    },
    // オペ金銭口/オペ条件口(手出票)
    5: {
      catPlan: 2000,
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: 3000,
      catZengetsuHi: 66.7,
      // 予算・予算比は計画の対象外のため差分の基準も "－"（差分を出さない）
      catYosan: '－',
      catYosanHi: '－',
      catZennenJisseki: 2500,
      catZennenHi: 80,
    },
    // 条件口率
    6: {
      catPlan: 24,
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: 25,
      catZengetsuHi: 96,
      catYosan: 0,
      catYosanHi: 0,
      catZennenJisseki: 21,
      catZennenHi: 114.3,
    },
    // ロケ運転費（金額）
    7: {
      catPlan: 36579937,
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: 34200000,
      catZengetsuHi: 107,
      catYosan: 0,
      catYosanHi: 0,
      catZennenJisseki: 36100000,
      catZennenHi: 101.3,
    },
    // ロケ運転費率
    8: {
      catPlan: 19,
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: 19,
      catZengetsuHi: 100,
      catYosan: 0,
      catYosanHi: 0,
      catZennenJisseki: 19,
      catZennenHi: 100,
    },
    // オペ協力金
    9: {
      catPlan: 90000,
      catHonsha: 0,
      catShishaA: 90000,
      catShishaBKyotsu: 0,
      catShishaBKaitaku: 0,
      catZengetsuJisseki: 100000,
      catZengetsuHi: 90,
      catYosan: 0,
      catYosanHi: 0,
      catZennenJisseki: 70000,
      catZennenHi: 128.6,
    },
    // その他一時金
    10: {
      catPlan: 90000,
      catHonsha: 20000,
      catShishaA: 30000,
      catShishaBKyotsu: 40000,
      catShishaBKaitaku: 0,
      catZengetsuJisseki: 120000,
      catZengetsuHi: 75,
      catYosan: 0,
      catYosanHi: 0,
      catZennenJisseki: 60000,
      catZennenHi: 150,
    },
    // ロケ契約料
    11: {
      catPlan: 0,
      catHonsha: 0,
      catShishaA: 0,
      catShishaBKyotsu: 0,
      catShishaBKaitaku: 0,
      catZengetsuJisseki: 10000,
      catZengetsuHi: 0,
      catYosan: 0,
      catYosanHi: 0,
      catZennenJisseki: 20000,
      catZennenHi: 0,
    },
    // ロケ契約料他前払い金(償却)＝ロケ契約中(14) + ロケ契約見込(13) の小計
    12: {
      catPlan: 470000,
      catHonsha: 200000,
      catShishaA: 110000,
      catShishaBKyotsu: 110000,
      catShishaBKaitaku: 50000,
      catZengetsuJisseki: '400000',
      catZengetsuHi: '117.5',
      catYosan: '0',
      catYosanHi: '0',
      catZennenJisseki: '500000',
      catZennenHi: '94',
    },
    // ロケ契約料他前払い金(償却)：ロケ契約見込
    13: {
      catPlan: 20000,
      catHonsha: 0,
      catShishaA: 10000,
      catShishaBKyotsu: 10000,
      catShishaBKaitaku: 0,
      // 前月実績〜前年同月比は差分を出さないため基準も "－"
      catZengetsuJisseki: '－',
      catZengetsuHi: '－',
      catYosan: '－',
      catYosanHi: '－',
      catZennenJisseki: '－',
      catZennenHi: '－',
    },
    // ロケ契約料他前払い金(償却)：ロケ契約中
    14: {
      catPlan: 450000,
      catHonsha: 200000,
      catShishaA: 100000,
      catShishaBKyotsu: 100000,
      catShishaBKaitaku: 50000,
      // 前月実績〜前年同月比は差分を出さないため基準も "－"
      catZengetsuJisseki: '－',
      catZengetsuHi: '－',
      catYosan: '－',
      catYosanHi: '－',
      catZennenJisseki: '－',
      catZennenHi: '－',
    },
    // コラム料
    16: {
      catPlan: 35000,
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: 25000,
      catZengetsuHi: 140,
      catYosan: 0,
      catYosanHi: 0,
      catZennenJisseki: 40000,
      catZennenHi: 87.5,
    },
    // リース料
    17: {
      catPlan: 400000,
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: 350000,
      catZengetsuHi: 114.3,
      catYosan: 0,
      catYosanHi: 0,
      catZennenJisseki: 320000,
      catZennenHi: 125,
    },
    // 販売器具費
    18: {
      catPlan: 250000,
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: 220000,
      catZengetsuHi: 113.6,
      catYosan: 0,
      catYosanHi: 0,
      catZennenJisseki: 200000,
      catZennenHi: 125,
    },
  };

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
    showFormulaGuideRef.current = showFormulaGuide;
    if (!showFormulaGuide) {
      setHighlightedCells([]);
      setExpenseHighlightedCells([]);
      setExpenseDependentHighlights([]);
      setSalesDependentHighlights([]);
      setHeaderDependentHighlights(new Set());
      setHeaderRefHighlights(new Set());
      setClickedCell(null);
      setFormulaTooltip(null);
    }
  }, [showFormulaGuide]);

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

  // 経費計画表の数値をカンマ区切りで整形するヘルパー（"－"等は変換しない）
  const formatExpenseNumber = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str === '－' || str === '' || str === 'xx') return str;
    const num = parseFloat(str.replace(/,/g, ''));
    if (isNaN(num)) return str;
    return Math.round(num).toLocaleString();
  };

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

  // 経費計画表の全ての数式セルを再計算する関数（指定された順序で実行）
  // 経費計画のセル値変化時の再計算順序（依存関係順・行インデックス）：
  // ※ 行インデックスはデータ種の区切り行（1=営業経費／15=自販機関係費）を含む。
  //   区切り行は値を持たないため再計算の対象に含めない。
  // オペ条件口(3)→帳合料(4)→オペ金銭口/オペ条件口 手出票(5)→条件口(2)→
  // 条件口率(6)→ロケ運転費率(8)→ロケ運転費(7)→オペ協力金(9)→その他一時費用(10)→
  // ロケ契約料(11)→ロケ契約見込(13)→ロケ契約中(14)→前払い金 償却(12・子行の小計)→
  // コラム料(16)→リース料(17)→販売器具費(18)→経費金額合計(0)
  const EXPENSE_RECALC_ROW_ORDER = [
    3, 4, 5, 2, 6, 8, 7, 9, 10, 11, 13, 14, 12, 16, 17, 18, 0,
  ];

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

  // 列文字 → 数値インデックス（A=1, B=2, ... Z=26, AA=27 ...）
  const colLetterToIndex = (col: string): number => {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 64);
    }
    return index;
  };

  // 数値インデックス → 列文字
  const indexToColLetter = (index: number): string => {
    let col = '';
    while (index > 0) {
      const rem = (index - 1) % 26;
      col = String.fromCharCode(65 + rem) + col;
      index = Math.floor((index - 1) / 26);
    }
    return col;
  };

  // Excel形式のセル参照（例：B2、C3、B3:B7、H2:N2）をパースする関数
  // 同一列範囲・同一行範囲・矩形範囲すべてに対応
  const parseFormulaReferences = (formula: string): string[] => {
    if (!formula) return [];

    const allRefs: string[] = [];

    // 範囲表記（例：B3:B7、H2:N2、H3:K6）を検出して展開
    const rangeMatches = formula.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/g);
    if (rangeMatches) {
      rangeMatches.forEach((range) => {
        const parts = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (parts) {
          const startColIdx = colLetterToIndex(parts[1]);
          const startRow = parseInt(parts[2], 10);
          const endColIdx = colLetterToIndex(parts[3]);
          const endRow = parseInt(parts[4], 10);
          for (let c = startColIdx; c <= endColIdx; c++) {
            for (let r = startRow; r <= endRow; r++) {
              allRefs.push(`${indexToColLetter(c)}${r}`);
            }
          }
        }
      });
    }

    // 単独のセル参照（例：B2、C3）を検出（範囲表記以外）
    const formulaWithoutRanges = formula.replace(/[A-Z]+\d+:[A-Z]+\d+/g, '');
    const singleMatches = formulaWithoutRanges.match(/[A-Z]+\d+/g);
    if (singleMatches) {
      allRefs.push(...singleMatches);
    }

    return allRefs;
  };

  // Excel形式のセル参照をAG Gridの行・カラムIDに変換
  const excelRefToCellId = (
    ref: string
  ): { rowIndex: number; colId: string } | null => {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;

    const col = match[1];
    const row = parseInt(match[2], 10);

    // 列の対応付け（B=col1, C=col2, など）
    const colMap: Record<string, string> = {
      A: 'category',
      B: 'col1',
      C: 'col2',
      D: 'col3',
      E: 'col4',
      F: 'col5',
      G: 'col6',
      H: 'col7',
      I: 'col8',
      J: 'col9',
      K: 'col10',
      L: 'col11',
      M: 'col12',
      N: 'col13',
      O: 'col14',
      P: 'col15',
      Q: 'col16',
      R: 'col17',
      S: 'col18',
      T: 'col19',
      U: 'col20',
      V: 'col21',
      W: 'col22',
      X: 'col23',
      Y: 'col24',
      Z: 'col25',
      AA: 'col26',
      AB: 'col27',
    };

    const colId = colMap[col];
    if (!colId) return null;

    // 行番号の変換（Excel行2 = AG Grid rowIndex 0）
    const rowIndex = row - 2;

    return { rowIndex, colId };
  };

  // 経費計画グリッド用のExcelセル参照 → AG Grid ID変換（経費表のカラム対応）
  const expenseExcelRefToCellId = (
    ref: string
  ): { rowIndex: number; colId: string } | null => {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    const col = match[1];
    const row = parseInt(match[2], 10);
    // 転置後のカラム対応（行=経費項目、列=拠点/区分）
    const colMap: Record<string, string> = {
      A: 'category',
      B: 'catPlan', // 計画金額
      C: 'catHonsha', // 本社
      D: 'catShishaA', // 支社A　自販機部門
      E: 'catShishaBKyotsu', // 支社B　自販機(共通)
      F: 'catShishaBKaitaku', // 支社B　開発(開拓)
      G: 'catZengetsuJisseki', // 前月実績
      H: 'catZengetsuHi', // 前月比
      I: 'catYosan', // 予算
      J: 'catYosanHi', // 予算比
      K: 'catZennenJisseki', // 前年同月実績
      L: 'catZennenHi', // 前年同月比
    };
    const colId = colMap[col];
    if (!colId) return null;
    const rowIndex = row - 2; // Excel行2 = rowIndex 0
    return { rowIndex, colId };
  };

  // 数式説明文用：拠点列名・比率列の分母名
  const EXPENSE_BRANCH_NAMES: Record<string, string> = {
    catHonsha: '本社',
    catShishaA: '支社A',
    catShishaBKyotsu: '支社B共通',
    catShishaBKaitaku: '支社B開拓',
  };
  const EXPENSE_RATIO_BASE: Record<string, string> = {
    catZengetsuHi: '前月実績',
    catYosanHi: '予算',
    catZennenHi: '前年同月実績',
  };

  // 経費計画の数式を、項目名ベースの説明文として返す
  // （販売計画表と同様の tooltipValueGetter ロジック）。数式が無いセルは null。
  const expenseFormulaDesc = (
    rowIndex: number,
    field: string,
    data: any
  ): string | null => {
    if (!data?.[`${field}_formula`]) return null;
    // 比率列（前月比/予算比/前年同月比）
    if (EXPENSE_RATIO_BASE[field]) {
      const op = String(data[`${field}_formula`]).includes('/') ? '÷' : '−';
      return `数式: 計画金額 ${op} ${EXPENSE_RATIO_BASE[field]}`;
    }
    // 拠点列（前払金(償却)行=12 は子行の合計、経費金額合計行=0 はその他経費の合算）
    if (EXPENSE_BRANCH_NAMES[field]) {
      if (rowIndex === 12) {
        return `数式: ロケ契約中 + ロケ契約見込（${EXPENSE_BRANCH_NAMES[field]}）`;
      }
      return `数式: オペ協力金 + その他一時費用 + ロケ契約料 + ロケ契約料他前払い金(償却)（${EXPENSE_BRANCH_NAMES[field]}）`;
    }
    // 経費金額合計行（rowIndex 0）の前月実績・予算・前年同月実績は計画金額と同じ集計式を表示
    if (
      rowIndex === 0 &&
      (field === 'catZengetsuJisseki' ||
        field === 'catYosan' ||
        field === 'catZennenJisseki')
    ) {
      return '数式: 条件口 + ロケ運転費 + その他経費（オペ協力金・一時費用・ロケ契約料等）の合計';
    }
    // 条件口行（rowIndex 2）の前月実績・予算・前年同月実績は計画金額と同じ集計式を表示
    if (
      rowIndex === 2 &&
      (field === 'catZengetsuJisseki' || field === 'catZennenJisseki')
    ) {
      return '数式: オペ条件口 + 帳合料 + オペ金銭口/オペ条件口(手出票)';
    }
    // 条件口率行（rowIndex 6）の予算＝条件口 ÷ 商流販売店計の予算金額
    if (rowIndex === 6 && field === 'catYosan') {
      return '数式: 条件口 ÷ 商流販売店計の予算';
    }
    // 条件口率行（rowIndex 6）の前年同月実績＝条件口 ÷ 商流販売店計の前年実績
    if (rowIndex === 6 && field === 'catZennenJisseki') {
      return '数式: 条件口 ÷ 商流販売店計の前年実績';
    }
    // 条件口率行（rowIndex 6）の前月実績＝条件口 ÷ 前月の社外売上高
    if (rowIndex === 6 && field === 'catZengetsuJisseki') {
      return '数式: 条件口 ÷ 前月の社外売上高';
    }
    // ロケ運転費行（rowIndex 7）の実績は数式を削除し固定値のため数式表示なし
    // ロケ運転費率行（rowIndex 8）の前月実績＝ロケ運転費 ÷ 前月の社外売上高
    if (rowIndex === 8 && field === 'catZengetsuJisseki') {
      return '数式: ロケ運転費 ÷ 前月の社外売上高';
    }
    // ロケ運転費率行（rowIndex 8）の予算＝ロケ運転費 ÷ 商流販売店計の予算
    if (rowIndex === 8 && field === 'catYosan') {
      return '数式: ロケ運転費 ÷ 商流販売店計の予算';
    }
    // ロケ運転費率行（rowIndex 8）の前年同月実績＝ロケ運転費 ÷ 商流販売店計の前年実績
    if (rowIndex === 8 && field === 'catZennenJisseki') {
      return '数式: ロケ運転費 ÷ 商流販売店計の前年実績';
    }
    // 計画金額列
    if (field === 'catPlan') {
      switch (rowIndex) {
        case 0:
          return '数式: 条件口 + ロケ運転費 + その他経費（オペ協力金・一時費用・ロケ契約料等）の合計';
        case 2:
          return '数式: オペ条件口 + 帳合料 + オペ金銭口/オペ条件口(手出票)';
        case 3:
          return '数式: 商流販売店計の当月計画 × オペ条件口率';
        case 4:
          return '数式: 商流販売店計の当月計画 × 帳合料率';
        case 6:
          return '数式: 条件口 ÷ 商流販売店計の当月計画';
        case 7:
          return '数式: 商流販売店計の当月計画 × ロケ運転費率';
        case 9:
        case 10:
        case 11:
        case 12:
        case 13:
        case 14:
          return '数式: 本社 + 支社A + 支社B共通 + 支社B開拓';
      }
    }
    return null;
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
    const JISSEKI_FIELDS = [
      'catZengetsuJisseki',
      'catYosan',
      'catZennenJisseki',
    ];
    // 固定上段（（金額は税抜き）行）は起点セルから除外する
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
        (JISSEKI_FIELDS.includes(field) &&
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

  // セルクリック時のハンドラー
  // ヘッダー項目が影響を受けるかを判定する共通関数
  const computeHeaderDependents = (
    startKey: string,
    visited: string[]
  ): Set<string> => {
    const headers = new Set<string>();
    const all = new Set([startKey, ...visited]);

    // 出荷稼働日前年比 = 出荷稼働日 ÷ 前年出荷稼働日 → そのいずれかが起点のとき影響を受ける
    if (all.has('0-col17') || all.has('0-col27')) {
      headers.add('shukkaYoyRatio');
    }

    // 社外売上高/当月進捗率 = col4/col6Total*100 → col4 or col6(rows1-5) が依存セットに含まれるとき
    const affectsProgress =
      all.has('0-col4') || [1, 2, 3, 4, 5].some((ri) => all.has(`${ri}-col6`));
    if (affectsProgress) headers.add('progressRate');

    return headers;
  };

  // クリックしたセルの数式が参照しているグリッド外ヘッダー項目を返す（緑ハイライト用）。
  // 専用機PM/提携機PC（col11）は「前年PM/PC × 出荷稼働日前年比 × 直近変動率 …」の数式のため、
  // グリッド内の参照セルに加えて出荷稼働日前年比も参照元として強調する。
  const computeHeaderRefs = (rowIndex: number, field?: string): Set<string> => {
    const headers = new Set<string>();
    if (field === 'col11' && [1, 2, 3].includes(rowIndex)) {
      headers.add('shukkaYoyRatio');
    }
    return headers;
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

  // 経費計画の数式が参照する販売計画セルのクロスグリッド参照トークン → 販売計画セルID
  // （商流販売店計 row0：当月計画=col1 / 予算金額=col21 / 前年実績金額=col2）
  const EXPENSE_CROSS_GRID_REF_MAP: Record<string, string> = {
    '商流販売店計[当月計画]': '0-col1',
    '販売計画[当月計画]': '0-col1',
    '商流販売店計[予算]': '0-col21',
    '商流販売店計[前年実績]': '0-col2',
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

  // BFS ユーティリティ
  const bfs = (
    startKeys: string[],
    reverseMap: Map<string, Set<string>>
  ): Set<string> => {
    const visited = new Set<string>();
    const queue = [...startKeys];
    startKeys.forEach((k) => visited.add(k));
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const deps = reverseMap.get(cur);
      if (!deps) continue;
      deps.forEach((dep) => {
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push(dep);
        }
      });
    }
    return visited;
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
    // 固定上段（（金額は税抜き）行）は起点セルから除外する
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
  const [salesPlanData, setSalesPlanData] = useState([
    {
      category: '商流販売店計',
      col1: null,
      col1_formula: '=SUM(B3:B7)', // 数式を保持
      col2: '190,000,000',
      col3: null,
      col3_formula: '=B2/C2', // 数式を保持
      col4: '40,000',
      col5: null,
      col5_formula: '=E2/G2', // 数式を保持
      col6: null,
      col6_formula: '=SUM(G3:G7)', // 数式を保持
      col7: '42,790',
      col8: null,
      col8_formula: '=G2/H2', // 数式を保持
      col9: '－',
      col10: '－',
      col11: '－',
      col25: '－',
      col12: '－',
      col13: '－',
      col14: '－',
      col26: '－',
      col15: '－',
      col16: null,
      // 数式を保持。分母は前年出荷稼働日（col27＝AB列）を参照する。
      // 数値を直接書くと数式ガイドの参照セルとして拾えず、前年出荷稼働日が
      // 緑強調されないため、セル参照の形にしている。
      col16_formula: '=R2/AB2',
      col17: '20',
      // 前年出荷稼働日。カードの表示欄と同じ値を持たせ、数式の参照先にする。
      col27: PREV_YEAR_SHIPPING_WORKING_DAYS,
      col18: '－',
      col19: '100%',
      col20: '－',
      col21: '0',
      col22: null,
      col22_formula: '=B2/V2', // 数式を保持
      col23: '0',
      col24: null,
      col24_formula: '=G2/X2', // 数式を保持
    },
    {
      category: '専用機',
      col1: null,
      col1_formula: '=G3*S3', // 数式を保持
      col2: '176,000,000',
      col3: null,
      col3_formula: '=B3/C3', // 数式を保持
      col4: '－',
      col5: '－',
      col6: null,
      col6_formula: '=K3/J3', // 数式を保持
      col7: '40,000',
      col8: null,
      col8_formula: '=G3/H3', // 数式を保持
      col9: '25.0',
      col10: null,
      col10_formula: '=L3*O3', // 数式を保持
      col11: null,
      col11_formula: '=Z3*N3*M3*Q2', // 数式を保持
      col25: '950',
      col12: '110%',
      col13: '103%',
      col14: null,
      col14_formula: '=AA3+P3', // 数式を保持
      col26: '2,000',
      col15: '50',
      col16: '－',
      col17: '－',
      col18: null,
      col18_formula: '=2000*T2', // 数式を保持
      col19: '－',
      col20: '－',
      col21: '0',
      col22: null,
      col22_formula: '=B3/V3', // 数式を保持
      col23: '0',
      col24: null,
      col24_formula: '=G3/X3', // 数式を保持
    },
    {
      category: '提携機',
      col1: null,
      col1_formula: '=G4*S4', // 数式を保持
      col2: '3,625,000',
      col3: null,
      col3_formula: '=B4/C4', // 数式を保持
      col4: '－',
      col5: '－',
      col6: null,
      col6_formula: '=K4/J4', // 数式を保持
      col7: '500',
      col8: null,
      col8_formula: '=G4/H4', // 数式を保持
      col9: '24.0',
      col10: null,
      col10_formula: '=L4*O4', // 数式を保持
      col11: null,
      col11_formula: '=Z4*N4*M4*Q2', // 数式を保持
      col25: '15.0',
      col12: '100%',
      col13: '90%',
      col14: null,
      col14_formula: '=AA4+P4', // 数式を保持
      col26: '1,000',
      col15: '100',
      col16: '－',
      col17: '－',
      col18: null,
      col18_formula: '=3000*T2', // 数式を保持
      col19: '－',
      col20: '－',
      col21: '0',
      col22: null,
      col22_formula: '=B4/V4', // 数式を保持
      col23: '0',
      col24: null,
      col24_formula: '=G4/X4', // 数式を保持
    },
    {
      category: 'アライアンス品（本社入力）',
      col1: null,
      col1_formula: '=G5*S5+U5', // 数式を保持
      col2: '612,000',
      col3: null,
      col3_formula: '=B5/C5', // 数式を保持
      col4: '－',
      col5: '－',
      col6: null,
      col6_formula: '=K5/J5', // 数式を保持
      col7: '160',
      col8: null,
      col8_formula: '=G5/H5', // 数式を保持
      col9: '24.0',
      col10: null,
      col10_formula: '=L5*O5', // 数式を保持
      col11: null,
      col11_formula: '=Z5*N5*Q2', // 数式を保持
      col25: '21',
      col12: '－',
      col13: '120%',
      col14: '156',
      col26: '－',
      col15: '－',
      col16: '－',
      col17: '－',
      col18: null,
      col18_formula: '=2232*T2', // 数式を保持
      col19: '－',
      col20: '150',
      col21: '0',
      col22: null,
      col22_formula: '=B5/V5', // 数式を保持
      col23: '0',
      col24: null,
      col24_formula: '=G5/X5', // 数式を保持
    },
    {
      category: 'その他（手売り）',
      col1: null,
      col1_formula: '=G6*S6', // 数式を保持
      col2: '300,000',
      col3: null,
      col3_formula: '=B6/C6', // 数式を保持
      col4: '－',
      col5: '－',
      col6: '150',
      col7: '130',
      col8: null,
      col8_formula: '=G6/H6', // 数式を保持
      col9: '－',
      col10: '－',
      col11: '－',
      col25: '－',
      col12: '－',
      col13: '－',
      col14: '－',
      col26: '－',
      col15: '－',
      col16: '－',
      col17: '－',
      col18: null,
      col18_formula: '=2500*T2', // 数式を保持
      col19: '－',
      col20: '－',
      col21: '0',
      col22: null,
      col22_formula: '=B6/V6', // 数式を保持
      col23: '0',
      col24: null,
      col24_formula: '=G6/X6', // 数式を保持
    },
    {
      category: '出荷実販差',
      col1: null,
      col1_formula: '=G7*S7', // 数式を保持
      col2: '9,763,000',
      col3: null,
      col3_formula: '=B7/C7', // 数式を保持
      col4: '－',
      col5: '－',
      col6: '2,000',
      col7: '2,000',
      col8: null,
      col8_formula: '=G7/H7', // 数式を保持
      col9: '－',
      col10: '－',
      col11: '－',
      col25: '－',
      col12: '－',
      col13: '－',
      col14: '－',
      col26: '－',
      col15: '－',
      col16: '－',
      col17: '－',
      col18: null,
      col18_formula: '=2000*T2', // 数式を保持
      col19: '－',
      col20: '－',
      col21: '－',
      col22: '－',
      col23: '－',
      col24: '－',
    },
  ]);

  // データref（useMemo内のコールバックが常に最新データを参照するため）
  const salesPlanDataRef = useRef(salesPlanData);
  salesPlanDataRef.current = salesPlanData;

  /**
   * 販売計画表の商流販売店計（row 0）の当月計画（col1）を計算する共通関数。
   * salesPlanDataRef.current を直接参照するため、グリッド描画状態に依存しない。
   */
  // 単価(col18)の値を求める共通関数。数式(=base*T2)がある行は
  // 「基準函単価(base) × 商流販売店計の価格改定率(row0 col19)」を計算し、
  // 手入力で数式が無い行は入力値(col18)をそのまま返す。
  // 当月計画(col1 = 合計函数 × 単価)など、グリッド外からも同じ単価を参照するため共通化。
  const computeSalesCol18 = (rowData: any, row0Data: any): number => {
    if (rowData?.col18_formula) {
      const m = String(rowData.col18_formula).match(/=\s*([\d.]+)\s*\*/);
      const base = m ? parseFloat(m[1]) : 0;
      const rateRaw = parseFloat(
        String(row0Data?.col19 ?? '0').replace(/[%,]/g, '')
      );
      const rate = isNaN(rateRaw) ? 0 : rateRaw / 100;
      return Math.round(base * rate);
    }
    return parseFloat(String(rowData?.col18 ?? '0').replace(/,/g, '')) || 0;
  };

  const computeSalesPlanCol1 = (salesData: any[]): number => {
    const row0 = salesData[0];
    if (!row0) return 0;
    if (!row0.col1_formula) {
      return parseFloat(String(row0.col1 || '0').replace(/,/g, '')) || 0;
    }
    const col17 = parseFloat(String(row0.col17 || '0').replace(/,/g, ''));
    const col16Ratio = isNaN(col17)
      ? 0
      : col17 / PREV_YEAR_SHIPPING_WORKING_DAYS;
    let total = 0;
    for (let i = 1; i <= 5; i++) {
      const d = salesData[i];
      if (!d) continue;
      if (d.col1_formula) {
        let col6: number;
        if (d.col6_formula && i >= 1 && i <= 3) {
          const c13 =
            parseFloat(String(d.col13 || '0').replace(/[%,]/g, '')) / 100;
          const c12 =
            i === 3
              ? 1
              : parseFloat(String(d.col12 || '0').replace(/[%,]/g, '')) / 100;
          const c15 = parseFloat(
            String(d.col15 || '0')
              .replace(/[%,+]/g, '')
              .replace(/▲/g, '-')
          );
          const c9 = parseFloat(String(d.col9 || '0').replace(/,/g, ''));
          if (c9 === 0) {
            col6 = 0;
          } else {
            let c11 = 0,
              c14 = 0;
            if (i === 1) {
              c11 = 950 * c13 * c12 * col16Ratio;
              c14 = round(2000 + c15, 0);
            } else if (i === 2) {
              c11 = 15 * c13 * c12 * col16Ratio;
              c14 = round(1000 + c15, 0);
            } else {
              c11 = 21 * c13 * col16Ratio;
              c14 = parseFloat(String(d.col14 || '0').replace(/,/g, '')) || 0;
            }
            col6 = round(c11 * c14, 0) / c9;
          }
        } else {
          col6 = parseFloat(String(d.col6 || '0').replace(/,/g, '')) || 0;
        }
        // 単価(col18)は数式値（base × 価格改定率）を用いる
        const c18 = computeSalesCol18(d, salesData[0]);
        const c20 = parseFloat(String(d.col20 || '0').replace(/,/g, '')) || 0;
        total += i === 3 ? col6 * c18 + c20 : col6 * c18;
      } else {
        total += parseFloat(String(d.col1 || '0').replace(/,/g, '')) || 0;
      }
    }
    return total;
  };

  // 差分表示用ヘルパー: { text, color } を返す
  const calcHeaderDiff = (
    current: number,
    baseline: number,
    isPercent = false,
    oneDecimal = false
  ): { text: string; color: string } => {
    const diff = oneDecimal
      ? Math.round((current - baseline) * 10) / 10
      : Math.round(current - baseline);
    const fmt = (n: number) => (oneDecimal ? formatDecimal1(n) : String(n));
    if (diff === 0)
      return {
        text: isPercent
          ? oneDecimal
            ? '±0.0%'
            : '±0%'
          : oneDecimal
            ? '±0.0'
            : '±0',
        color: '#374151',
      };
    if (diff > 0)
      return {
        text: isPercent ? `+${fmt(diff)}%` : `+${fmt(diff)}`,
        color: GRID_COLORS.increaseText,
      };
    return {
      text: isPercent ? `▲${fmt(Math.abs(diff))}%` : `▲${fmt(Math.abs(diff))}`,
      color: GRID_COLORS.decreaseText,
    };
  };

  const shukkaWorkingDays = useMemo(() => {
    const v = salesPlanData[0]?.col17;
    const current = v != null ? String(v) : '';
    if (!isDiffMode) return { text: current, color: '#374151', isInput: true };
    const num = parseFloat(String(v || '0').replace(/,/g, ''));
    if (isNaN(num))
      return {
        text: current,
        color: '#374151',
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
    if (!isDiffMode) return { text: String(current), color: '#374151' };
    return calcHeaderDiff(current, PREV_YEAR_SHIPPING_WORKING_DAYS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDiffMode]);

  const shukkaYoyRatio = useMemo(() => {
    const col17 = parseFloat(
      String(salesPlanData[0]?.col17 || '0').replace(/,/g, '')
    );
    if (isNaN(col17) || col17 === 0) return { text: '－', color: '#374151' };
    // 小数第1位まで表示（小数第2位を四捨五入）。差分も同様。
    const current = (col17 / PREV_YEAR_SHIPPING_WORKING_DAYS) * 100;
    if (!isDiffMode)
      return { text: formatDecimal1(current) + '%', color: '#374151' };
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

  // 商流販売店計（row 0）の合計函数（col6）= 子行(専用機〜出荷実販差)の col6 合計。
  // グリッド外（valueGetter 以外）から「商流販売店計の合計函数」を参照するための共通関数。
  const computeSalesPlanCol6 = (salesData: any[]): number => {
    const r0 = salesData[0];
    const col17 = parseFloat(String(r0?.col17 || '0').replace(/,/g, '')) || 0;
    const col16 = col17 / PREV_YEAR_SHIPPING_WORKING_DAYS;
    let col6Total = 0;
    for (let i = 1; i <= 5; i++) {
      const row = salesData[i];
      if (!row) continue;
      if (row.col6_formula && i >= 1 && i <= 3) {
        const col13 =
          parseFloat(String(row.col13 || '0').replace(/[%,]/g, '')) / 100;
        const col12 =
          i === 3
            ? 1
            : parseFloat(String(row.col12 || '0').replace(/[%,]/g, '')) / 100;
        const col15 = parseFloat(
          String(row.col15 || '0')
            .replace(/[%,+]/g, '')
            .replace(/▲/g, '-')
        );
        const col9 = parseFloat(String(row.col9 || '0').replace(/,/g, ''));
        if (col9 !== 0) {
          let col11 = 0,
            col14 = 0;
          if (i === 1) {
            col11 = 950 * col13 * col12 * col16;
            col14 = round(2000 + col15, 0);
          } else if (i === 2) {
            col11 = 15 * col13 * col12 * col16;
            col14 = round(1000 + col15, 0);
          } else if (i === 3) {
            col11 = 21 * col13 * col16;
            col14 = parseFloat(String(row.col14 || '0').replace(/,/g, '')) || 0;
          }
          col6Total += round(col11 * col14, 0) / col9;
        }
      } else {
        col6Total += parseFloat(String(row.col6 || '0').replace(/,/g, '')) || 0;
      }
    }
    return col6Total;
  };

  const progressRate = useMemo(() => {
    const row0 = salesPlanData[0];
    if (!row0 || !row0.col5_formula) {
      const text = String(row0?.col5 ?? '－');
      return { text, color: '#374151' };
    }
    // 商流販売店計の当月函数(col4) ÷ 商流販売店計の合計函数(col6) × 100
    const col4 = parseFloat(String(row0.col4 || '0').replace(/,/g, '')) || 0;
    const col6Total = computeSalesPlanCol6(salesPlanData);
    // 小数第1位まで表示（小数第2位を四捨五入）。差分も同様。
    const current = col6Total === 0 ? 0 : (col4 / col6Total) * 100;
    if (!isDiffMode)
      return { text: formatDecimal1(current) + '%', color: '#374151' };
    return calcHeaderDiff(current, 41.7, true, true);
  }, [salesPlanData, isDiffMode]);

  // 単位行（4行目）のデータ
  const unitRowData = useMemo(
    () => [
      {
        category: '（金額は税抜き）',
        col1: '円',
        col2: '円',
        col3: '％',
        col4: '函',
        col5: '％',
        col6: '函',
        col7: '函',
        col8: '％',
        col9: '本',
        col10: '本',
        col11: '本',
        col25: '本',
        col12: '％',
        col13: '％',
        col14: '台/コラム',
        col26: '台/コラム',
        col15: '台/コラム',
        col16: '％',
        col17: '日',
        col18: '円',
        col19: '％',
        col20: '円',
        col21: '円',
        col22: '％',
        col23: '函',
        col24: '％',
      },
    ],
    []
  );

  // 経費計画データ（転置：行=経費項目、列=計画金額/拠点/前月/予算/前年同月）
  // 列フィールド: catPlan=計画金額, catHonsha=本社, catShishaA=支社A,
  //   catShishaBKyotsu=支社B共通, catShishaBKaitaku=支社B開拓,
  //   catZengetsuJisseki=前月実績, catZengetsuHi=前月比, catYosan=予算,
  //   catYosanHi=予算比, catZennenJisseki=前年同月実績, catZennenHi=前年同月比
  const [expensePlanData, setExpensePlanData] = useState([
    {
      // 経費金額合計（Excel2）= 条件口合計 + ロケ運転費金額 + その他経費
      category: '経費金額合計',
      unit: '円',
      catPlan: null,
      // 604…(14) は ロケ契約見込(15)・ロケ契約中(16) の小計行のため、集計範囲は 14 まで
      // とし子行(15・16)は含めない（条件口(4) とその配下 5〜7 の扱いと同じ）。
      catPlan_formula: '=B4+B9+SUM(B11:B14)+SUM(B18:B20)',
      catHonsha: null,
      catHonsha_formula: '=SUM(C11:C14)',
      catShishaA: null,
      catShishaA_formula: '=SUM(D11:D14)',
      catShishaBKyotsu: null,
      catShishaBKyotsu_formula: '=SUM(E11:E14)',
      catShishaBKaitaku: null,
      catShishaBKaitaku_formula: '=SUM(F11:F14)',
      // 前月実績＝前月実績列の 条件口 + ロケ運転費 + オペ協力金〜販売器具費 の合計。
      catZengetsuJisseki: null,
      catZengetsuJisseki_formula: '=G4+G9+SUM(G11:G14)+SUM(G18:G20)',
      catZengetsuHi: '0%',
      catZengetsuHi_formula: '=B2/G2',
      // 予算＝予算列の 条件口 + ロケ運転費 + オペ協力金〜販売器具費 の合計。
      catYosan: null,
      catYosan_formula: '=I4+I9+SUM(I11:I14)+SUM(I18:I20)',
      catYosanHi: '0%',
      catYosanHi_formula: '=B2/I2',
      // 前年同月実績＝前年同月実績列の 条件口 + ロケ運転費 + オペ協力金〜販売器具費 の合計。
      catZennenJisseki: null,
      catZennenJisseki_formula: '=K4+K9+SUM(K11:K14)+SUM(K18:K20)',
      catZennenHi: '0%',
      catZennenHi_formula: '=B2/K2',
    },
    {
      // データ種の区切り（見出し行）：条件口〜ロケ契約料他前払い金(償却)
      // 値は持たず、経費項目名だけを表示する（isParent により各列は空表示）。
      category: '営業経費',
      unit: '',
      catPlan: null,
      catHonsha: null,
      catShishaA: null,
      catShishaBKyotsu: null,
      catShishaBKaitaku: null,
      catZengetsuJisseki: null,
      catZengetsuHi: null,
      catYosan: null,
      catYosanHi: null,
      catZennenJisseki: null,
      catZennenHi: null,
      isParent: true,
      isGroupHeaderRow: true,
    },
    {
      // 条件口（グループ親・条件口合計を表示）= Excel4
      category: '条件口',
      unit: '円',
      catPlan: null,
      catPlan_formula: '=B5+B6+B7',
      catPlan_base: '0',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      // 前月実績＝前月実績列の オペ条件口 + 帳合料 + オペ金銭口 の合計
      catZengetsuJisseki: null,
      catZengetsuJisseki_formula: '=G5+G6+G7',
      catZengetsuHi: '0%',
      catZengetsuHi_formula: '=B4/G4',
      // 予算＝予算列の オペ条件口 + 帳合料 + オペ金銭口 の合計。
      // 値は computeExpenseActual で算出するため、数式は保持しない
      // （保持すると数式ガイドで数式が表示され、参照セルも強調されるため）。
      catYosan: null,
      catYosanHi: '0%',
      catYosanHi_formula: '=B4/I4',
      // 前年同月実績＝前年同月実績列の オペ条件口 + 帳合料 + オペ金銭口 の合計
      catZennenJisseki: null,
      catZennenJisseki_formula: '=K5+K6+K7',
      catZennenHi: '0%',
      catZennenHi_formula: '=B4/K4',
      isParent: true,
      showAsValue: true,
    },
    {
      // オペ条件口（Excel5）= 当月計画 × オペ条件口率(exp_col16)
      category: '121:オペ条件口',
      unit: '円',
      catPlan: null,
      catPlan_formula: '=商流販売店計[当月計画]*exp_col16',
      exp_col16: '21%',
      rateField: 'exp_col16',
      rateLabel: 'オペ条件口率',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: '40,000,000',
      catZengetsuHi: null,
      catZengetsuHi_formula: '=B5/G5',
      // 予算・予算比は計画の対象外のため、表示・差分の基準とも "－" にする
      catYosan: '－',
      catYosanHi: '－',
      catZennenJisseki: '35,000,000',
      catZennenHi: null,
      catZennenHi_formula: '=B5/K5',
      isChild: true,
    },
    {
      // 帳合料（Excel6）= 当月計画 × 帳合料率(exp_col17)
      category: '120:帳合料',
      unit: '円',
      catPlan: null,
      catPlan_formula: '=商流販売店計[当月計画]*exp_col17',
      exp_col17: '3%',
      rateField: 'exp_col17',
      rateLabel: '帳合料率',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: '5,000,000',
      catZengetsuHi: null,
      catZengetsuHi_formula: '=B6/G6',
      // 予算・予算比は計画の対象外のため、表示・差分の基準とも "－" にする
      catYosan: '－',
      catYosanHi: '－',
      catZennenJisseki: '4,500,000',
      catZennenHi: null,
      catZennenHi_formula: '=B6/K6',
      isChild: true,
    },
    {
      // オペ金銭口/オペ条件口(手出票)（Excel7・入力）
      category: '122:オペ金銭口/127:オペ条件口(手出票)',
      unit: '円',
      catPlan: '2,000',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: '3,000',
      catZengetsuHi: null,
      catZengetsuHi_formula: '=B7/G7',
      // 予算・予算比は計画の対象外のため、表示・差分の基準とも "－" にする
      catYosan: '－',
      catYosanHi: '－',
      catZennenJisseki: '2,500',
      catZennenHi: null,
      catZennenHi_formula: '=B7/K7',
      isChild: true,
    },
    {
      // 条件口率（Excel8）= 条件口合計 ÷ 当月計画
      category: '条件口率',
      unit: '％',
      catPlan: null,
      catPlan_formula: '=B4/商流販売店計[当月計画]',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      // 前月実績＝前月実績列の 条件口 ÷ 前月の社外売上高
      catZengetsuJisseki: null,
      catZengetsuJisseki_formula: '=G4/180000000',
      catZengetsuHi: null,
      catZengetsuHi_formula: '=B8/G8',
      // 予算＝予算列の 条件口 ÷ 販売計画の商流販売店計の予算金額
      catYosan: null,
      catYosan_formula: '=I4/商流販売店計[予算]',
      catYosanHi: null,
      catYosanHi_formula: '=B8/I8',
      // 前年同月実績＝前年同月実績列の 条件口 ÷ 販売計画の商流販売店計の前年実績金額
      catZennenJisseki: null,
      catZennenJisseki_formula: '=K4/商流販売店計[前年実績]',
      catZennenHi: null,
      catZennenHi_formula: '=B8/K8',
      isChild: true,
    },
    {
      // ロケ運転費（グループ親・ロケ運転費金額を表示）= Excel9
      category: '33S:ロケ運転費',
      unit: '円',
      catPlan: null,
      catPlan_formula: '=商流販売店計[当月計画]*B10',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      // 前月実績・予算・前年同月実績は数式を削除し固定値を採用
      catZengetsuJisseki: 34200000,
      catZengetsuHi: '0%',
      catZengetsuHi_formula: '=B9/G9',
      catYosan: 0,
      catYosanHi: null,
      catYosanHi_formula: '=B9/I9',
      catZennenJisseki: 36100000,
      catZennenHi: null,
      catZennenHi_formula: '=B9/K9',
      isParent: true,
      showAsValue: true,
    },
    {
      // ロケ運転費率（Excel10・入力）
      category: 'ロケ運転費率',
      unit: '％',
      catPlan: '19%',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      // 前月実績＝ロケ運転費(前月実績 G8) ÷ 前月の社外売上高(180,000,000)
      catZengetsuJisseki: null,
      catZengetsuJisseki_formula: '=G9/180000000',
      catZengetsuHi: '0%',
      catZengetsuHi_formula: '=B10/G10',
      // 予算＝ロケ運転費(予算 I8) ÷ 商流販売店計の予算金額
      catYosan: null,
      catYosan_formula: '=I9/商流販売店計[予算]',
      catYosanHi: '0%',
      catYosanHi_formula: '=B10/I10',
      // 前年同月実績＝ロケ運転費(前年同月実績 K8) ÷ 商流販売店計の前年実績金額
      catZennenJisseki: null,
      catZennenJisseki_formula: '=K9/商流販売店計[前年実績]',
      catZennenHi: '0%',
      catZennenHi_formula: '=B10/K10',
      isChild: true,
    },
    {
      // オペ協力金（Excel11）計画金額=拠点合算、拠点列=入力
      category: '69D:オペ協力金',
      unit: '円',
      catPlan: null,
      catPlan_formula: '=SUM(C11:F11)',
      catHonsha: '0',
      catShishaA: '90,000',
      catShishaBKyotsu: '0',
      catShishaBKaitaku: '0',
      catZengetsuJisseki: '100,000',
      catZengetsuHi: null,
      catZengetsuHi_formula: '=B11/G11',
      catYosan: '0',
      catYosanHi: '0%',
      catYosanHi_formula: '=B11/I11',
      catZennenJisseki: '70,000',
      catZennenHi: null,
      catZennenHi_formula: '=B11/K11',
      isParent: true,
      showAsValue: true,
    },
    {
      // その他一時金（Excel12）
      category: '69F:その他一時費用',
      unit: '円',
      catPlan: null,
      catPlan_formula: '=SUM(C12:F12)',
      catHonsha: '20,000',
      catShishaA: '30,000',
      catShishaBKyotsu: '40,000',
      catShishaBKaitaku: '0',
      catZengetsuJisseki: '120,000',
      catZengetsuHi: null,
      catZengetsuHi_formula: '=B12/G12',
      catYosan: '0',
      catYosanHi: '0%',
      catYosanHi_formula: '=B12/I12',
      catZennenJisseki: '60,000',
      catZennenHi: null,
      catZennenHi_formula: '=B12/K12',
      isParent: true,
      showAsValue: true,
    },
    {
      // ロケ契約料（Excel13）
      category: '69E:ロケ契約料',
      unit: '円',
      catPlan: null,
      catPlan_formula: '=SUM(C13:F13)',
      catHonsha: '0',
      catShishaA: '0',
      catShishaBKyotsu: '0',
      catShishaBKaitaku: '0',
      catZengetsuJisseki: '10,000',
      catZengetsuHi: null,
      catZengetsuHi_formula: '=B13/G13',
      catYosan: '0',
      catYosanHi: '0%',
      catYosanHi_formula: '=B13/I13',
      catZennenJisseki: '20,000',
      catZennenHi: null,
      catZennenHi_formula: '=B13/K13',
      isParent: true,
      showAsValue: true,
    },
    {
      // ロケ契約料他前払い金(償却)（Excel14）。
      // 配下の ロケ契約中(Excel16)・ロケ契約見込(Excel15) の小計行のため入力不可
      // （編集可否は isExpenseCellEditable が一元管理しており、登録しない行は入力不可）。
      // 拠点列は子行の合計、計画金額は自行の拠点列の合計を数式で求める
      //（他の拠点合計行と同じ形。結果は子行の計画金額の合計と一致する）。
      // 実績列は固定値を参照表示する。
      category: '604:ロケ契約料他前払い金(償却)',
      unit: '円',
      catPlan: null,
      catPlan_formula: '=SUM(C14:F14)',
      catHonsha: null,
      catHonsha_formula: '=C16+C15',
      catShishaA: null,
      catShishaA_formula: '=D16+D15',
      catShishaBKyotsu: null,
      catShishaBKyotsu_formula: '=E16+E15',
      catShishaBKaitaku: null,
      catShishaBKaitaku_formula: '=F16+F15',
      catZengetsuJisseki: '400,000',
      catZengetsuHi: null,
      catZengetsuHi_formula: '=B14/G14',
      catYosan: '0',
      catYosanHi: '0%',
      catYosanHi_formula: '=B14/I14',
      catZennenJisseki: '500,000',
      catZennenHi: null,
      catZennenHi_formula: '=B14/K14',
      isParent: true,
      showAsValue: true,
    },
    {
      // ロケ契約料他前払い金(償却)：ロケ契約見込（Excel15）
      category: 'ロケ契約見込',
      unit: '円',
      catPlan: null,
      catPlan_formula: '=SUM(C15:F15)',
      catHonsha: '0',
      catShishaA: '10,000',
      catShishaBKyotsu: '10,000',
      catShishaBKaitaku: '0',
      // 前月実績〜前年同月比は比較対象が無いため、表示・差分の基準とも "－" にする。
      // 比列は数式を持たせず固定値を表示させる（数式があると計算値が出てしまうため）。
      catZengetsuJisseki: '－',
      catZengetsuHi: '－',
      catYosan: '－',
      catYosanHi: '－',
      catZennenJisseki: '－',
      catZennenHi: '－',
      // 604:ロケ契約料他前払い金(償却)(12) の配下のため子項目として字下げする
      isChild: true,
    },
    {
      // ロケ契約料他前払い金(償却)：ロケ契約中（Excel16）。
      // 契約済み分の償却額を参照表示する行のため入力不可
      // （編集可否は isExpenseCellEditable が一元管理しており、登録しない行は入力不可）。
      category: 'ロケ契約中',
      unit: '円',
      catPlan: null,
      catPlan_formula: '=SUM(C16:F16)',
      catHonsha: '200,000',
      catShishaA: '100,000',
      catShishaBKyotsu: '100,000',
      catShishaBKaitaku: '50,000',
      // 前月実績〜前年同月比は比較対象が無いため、表示・差分の基準とも "－" にする。
      // 比列は数式を持たせず固定値を表示させる（数式があると計算値が出てしまうため）。
      catZengetsuJisseki: '－',
      catZengetsuHi: '－',
      catYosan: '－',
      catYosanHi: '－',
      catZennenJisseki: '－',
      catZennenHi: '－',
      // 604:ロケ契約料他前払い金(償却)(12) の配下のため子項目として字下げする
      isChild: true,
    },
    {
      // データ種の区切り（見出し行）：コラム料〜販売器具費
      // 値は持たず、経費項目名だけを表示する（isParent により各列は空表示）。
      category: '自販機関係費',
      unit: '',
      catPlan: null,
      catHonsha: null,
      catShishaA: null,
      catShishaBKyotsu: null,
      catShishaBKaitaku: null,
      catZengetsuJisseki: null,
      catZengetsuHi: null,
      catYosan: null,
      catYosanHi: null,
      catZennenJisseki: null,
      catZennenHi: null,
      isParent: true,
      isGroupHeaderRow: true,
    },
    {
      // 自販機コラム料（Excel18・入力）
      category: 'V7P:自販機コラム料',
      unit: '円',
      catPlan: '35,000',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: '25,000',
      catZengetsuHi: null,
      catZengetsuHi_formula: '=B18/G18',
      catYosan: '0',
      catYosanHi: '0%',
      catYosanHi_formula: '=B18/I18',
      catZennenJisseki: '40,000',
      catZennenHi: null,
      catZennenHi_formula: '=B18/K18',
      isParent: true,
      showAsValue: true,
    },
    {
      // 自販機リース料（Excel19・入力）
      category: '880:自販機リース料',
      unit: '円',
      catPlan: '400,000',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: '350,000',
      catZengetsuHi: null,
      catZengetsuHi_formula: '=B19/G19',
      catYosan: '0',
      catYosanHi: '0%',
      catYosanHi_formula: '=B19/I19',
      catZennenJisseki: '320,000',
      catZennenHi: null,
      catZennenHi_formula: '=B19/K19',
      isParent: true,
      showAsValue: true,
    },
    {
      // 販売器具移設費（Excel20・入力）
      category: '89H:販売器具移設費',
      unit: '円',
      catPlan: '250,000',
      catHonsha: '－',
      catShishaA: '－',
      catShishaBKyotsu: '－',
      catShishaBKaitaku: '－',
      catZengetsuJisseki: '220,000',
      catZengetsuHi: null,
      catZengetsuHi_formula: '=B20/G20',
      catYosan: '0',
      catYosanHi: '0%',
      catYosanHi_formula: '=B20/I20',
      catZennenJisseki: '200,000',
      catZennenHi: null,
      catZennenHi_formula: '=B20/K20',
      isParent: true,
      showAsValue: true,
    },
  ]);

  const expensePlanDataRef = useRef(expensePlanData);
  expensePlanDataRef.current = expensePlanData;

  // 経費計画の注記行データ（単位は各行の「単位」列に移動）
  const expenseUnitRowData = useMemo(
    () => [
      {
        category: '（金額は税抜き）',
        unit: '',
        catPlan: '円',
        catHonsha: '円',
        catShishaA: '円',
        catShishaBKyotsu: '円',
        catShishaBKaitaku: '円',
        catZengetsuJisseki: '円',
        catZengetsuHi: '％',
        catYosan: '円',
        catYosanHi: '％',
        catZennenJisseki: '円',
        catZennenHi: '％',
      },
    ],
    []
  );

  // セルの編集可否を判定する関数
  const isCellEditable = (rowIndex: number, field: string) => {
    if (isDiffModeRef.current) return false; // 差分表示中は全セル編集不可
    return isCellTrigger(rowIndex, field);
  };

  // 差分/実数表示に関わらず「編集可能セル」かどうかを返す（ハイライト起点判定用）
  const isCellTrigger = (rowIndex: number, field: string) => {
    if (rowIndex === 0 && field === 'col17') return true;
    if (
      rowIndex === 1 &&
      (field === 'col12' || field === 'col15' || field === 'col18')
    )
      return true;
    if (
      rowIndex === 2 &&
      (field === 'col12' || field === 'col15' || field === 'col18')
    )
      return true;
    if (rowIndex === 4 && (field === 'col6' || field === 'col18')) return true;
    if (rowIndex === 5 && (field === 'col6' || field === 'col18')) return true;
    return false;
  };

  // ハイライト起点（クリックで、数式の参照を順次辿って依存セルを強調表示する
  // 対象）の判定。編集可否(isCellTrigger)とは別管理にし、編集可否は変えない。
  // 以下の入力列を起点に追加する。
  // 注: 合計函数(col6)は「入力可能なセル」(その他/手売り=行4・出荷実販差=行5)のみ
  //     を起点にするため、ここには含めず isCellTrigger 側（行4,5 の col6）に任せる。
  //     行0〜3 の col6 は計算セルなので起点から除外される。
  const HIGHLIGHT_TRIGGER_FIELDS = new Set([
    'col21', // 社外売上高_予算
    'col2', // 社外売上高_前年実績
    'col4', // 当月函数
    'col23', // 予算_函数
    'col7', // 前年函数
    'col9', // 平均入数
    'col13', // 直近変動率
    'col20', // アライアンス品契約状況変動に伴う追加売上金額
    'col19', // 価格改定率
    'col25', // 前年PM/PC（専用機PM/提携機PC の算出元）
    'col26', // 直近台数(コラム)（稼働台数(コラム) の算出元）
  ]);
  const isHighlightTrigger = (rowIndex: number, field: string) => {
    if (isCellTrigger(rowIndex, field)) return true;
    // アライアンス品（rowIndex 3）の函単価（col18）を起点に追加
    if (rowIndex === 3 && field === 'col18') return true;
    if (rowIndex < 0 || rowIndex > 5) return false;
    return HIGHLIGHT_TRIGGER_FIELDS.has(field);
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
  const getExpenseCellStyle = (
    params: any,
    alignment: 'left' | 'right' | 'center' = 'right'
  ) => {
    if (params.node?.rowPinned === 'top') {
      return {
        backgroundColor: GRID_COLORS.readonly,
        // 固定上段（単位・税抜き注記行）も AG Grid 標準の text-sm(0.875rem) に統一
        fontSize: '0.875rem',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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

    const justifyContent =
      alignment === 'left'
        ? 'flex-start'
        : alignment === 'right'
          ? 'flex-end'
          : 'center';

    // 経費金額合計行（rowIndex === 0）は合計スタイル（合計色＋太字）。
    // 編集可能セルは白背景、クリック/依存/参照ハイライトは優先する。
    if (rowIndex === 0) {
      // 強調（青/緑/オレンジ）は枠線だけで示し、背景は元の配色を保つ。
      const bg = isEditable ? GRID_COLORS.editable : GRID_COLORS.total;
      return {
        backgroundColor: bg,
        fontWeight: 'bold',
        fontSize: '0.875rem',
        lineHeight: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent,
        textAlign: alignment,
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
    let bgColor = isEditable ? GRID_COLORS.editable : GRID_COLORS.readonly;
    // 親行も標準の編集不可色（灰）に統一する
    if (isParent && !params.data?.showAsValue) bgColor = GRID_COLORS.readonly;
    // データ種の区切り（見出し）行は共通の区切り行色。太字にはしない（→ 02 §7）
    if (params.data?.isGroupHeaderRow) bgColor = GRID_COLORS.sectionRowBg;
    // 強調（青/緑/オレンジ）は枠線だけで示すため、背景は上書きしない。

    return {
      backgroundColor: bgColor,
      fontSize: '0.875rem',
      lineHeight: '2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent,
      textAlign: alignment,
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
  const getCellStyle = (
    params: any,
    alignment: 'left' | 'right' | 'center' = 'right'
  ) => {
    if (params.node?.rowPinned === 'top') {
      return {
        backgroundColor: GRID_COLORS.readonly,
        // 固定上段（単位・税抜き注記行）も AG Grid 標準の text-sm(0.875rem) に統一
        fontSize: '0.875rem',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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

    const justifyContent =
      alignment === 'left'
        ? 'flex-start'
        : alignment === 'right'
          ? 'flex-end'
          : 'center';

    // 合計行（rowIndex === 0）の場合は合計色の背景（ただし編集可能セルは白背景）
    if (rowIndex === 0) {
      // 強調（青/緑/オレンジ）は枠線だけで示し、背景は元の配色を保つ。
      const bg = isEditable ? GRID_COLORS.editable : GRID_COLORS.total;
      return {
        backgroundColor: bg,
        fontWeight: 'bold',
        fontSize: '0.875rem',
        lineHeight: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent,
        textAlign: alignment,
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
      fontSize: '0.875rem',
      lineHeight: '2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent,
      textAlign: alignment,
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
  const salesPlanColumnDefs = useMemo(
    () => [
      {
        headerName: '',
        field: 'category',
        width: 200,
        lockPosition: true,
        headerClass: 'ag-header-cell-left',
        cellClass: (params) => {
          if (params.node?.rowPinned === 'top') {
            return '';
          }
          return 'ag-cell-left';
        },
        cellStyle: (params) => {
          if (params.node?.rowPinned === 'top') {
            return {
              backgroundColor: GRID_COLORS.readonly,
              // 固定上段（税抜き注記行）も AG Grid 標準の text-sm(0.875rem) に統一
              fontSize: '0.875rem',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            };
          }
          const rowIndex = params.node?.rowIndex ?? -1;

          // 参照セルとして強調表示されているかチェック
          const cellKey = `${rowIndex}-category`;
          const isHighlighted = highlightedCellsRef.current.includes(cellKey);

          // 合計行（rowIndex === 0）の場合は合計色の背景
          if (rowIndex === 0) {
            return {
              backgroundColor: GRID_COLORS.total,
              fontWeight: 'bold',
              fontSize: '0.875rem',
              lineHeight: '2rem',
              paddingLeft: '0.5rem',
              border: isHighlighted ? REF_HIGHLIGHT_BORDER : undefined,
            };
          }
          return {
            backgroundColor: GRID_COLORS.readonly,
            // 合計行以外の行タイトルは太字にしない（太字は合計行のみ／標準準拠）
            fontWeight: 'normal',
            fontSize: '0.875rem',
            lineHeight: '2rem',
            paddingLeft: '0.5rem',
            border: isHighlighted ? REF_HIGHLIGHT_BORDER : undefined,
          };
        },
      },
      {
        headerName: '社外売上高（計画）',
        children: [
          {
            headerName: '当月計画',
            field: 'col1',
            width: 80,
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col1'),
            cellEditor: FormulaEditor,
            tooltipValueGetter: (params) => {
              if (params.data.col1_formula) {
                const rowIndex = params.node?.rowIndex ?? -1;
                if (rowIndex === 0)
                  return '数式: 専用機 + 提携機 + アライアンス品（本社入力） + その他（手売り） + 出荷実販差';
                if (rowIndex === 3)
                  return '数式: 合計函数 × 函単価 + アライアンス品契約状況変動に伴う追加売上金額';
                if (rowIndex >= 1 && rowIndex <= 5)
                  return '数式: 合計函数 × 函単価';
              }
              return null;
            },
            valueGetter: (params) => {
              // 商流販売店計行（rowIndex === 0）の数式: SUM(B3:B7)
              if (params.data.col1_formula && params.node?.rowIndex === 0) {
                return computeSalesPlanCol1(salesPlanDataRef.current);
              }
              // 専用機行（rowIndex === 1）・提携機行（rowIndex === 2）の数式: =G*S
              if (
                params.data.col1_formula &&
                (params.node?.rowIndex === 1 || params.node?.rowIndex === 2)
              ) {
                // col6(合計函数)は col6 列の valueGetter を単一の計算元と
                // して参照する（K/J の再計算をここで重複させない）
                const col6 =
                  parseFloat(
                    String(params.getValue('col6') ?? '0').replace(/[,%]/g, '')
                  ) || 0;
                // 単価(col18)は col18 列の valueGetter（base × 価格改定率）を参照する
                const col18 = parseFloat(
                  String(params.getValue('col18') ?? '0').replace(/[,%]/g, '')
                );
                const result = !isNaN(col6) && !isNaN(col18) ? col6 * col18 : 0;

                return result;
              }
              // アライアンス品行（rowIndex === 3）の数式: =G5*S5+U5
              if (params.data.col1_formula && params.node?.rowIndex === 3) {
                // col6(合計函数)は col6 列の valueGetter を単一の計算元と
                // して参照する（K/J の再計算をここで重複させない）
                const col6 =
                  parseFloat(
                    String(params.getValue('col6') ?? '0').replace(/[,%]/g, '')
                  ) || 0;
                // 単価(col18)は col18 列の valueGetter（base × 価格改定率）を参照する
                const col18 = parseFloat(
                  String(params.getValue('col18') ?? '0').replace(/[,%]/g, '')
                );
                const col20 =
                  parseFloat(
                    String(params.data.col20 || '0').replace(/,/g, '')
                  ) || 0;
                const result =
                  !isNaN(col6) && !isNaN(col18) ? col6 * col18 + col20 : 0;

                return result;
              }
              // その他行（rowIndex === 4）・出荷実販差行（rowIndex === 5）の数式: =G*S
              if (
                params.data.col1_formula &&
                (params.node?.rowIndex === 4 || params.node?.rowIndex === 5)
              ) {
                const col6 = parseFloat(
                  String(params.data.col6 || '0').replace(/,/g, '')
                );
                // 単価(col18)は col18 列の valueGetter（base × 価格改定率）を参照する
                const col18 = parseFloat(
                  String(params.getValue('col18') ?? '0').replace(/[,%]/g, '')
                );
                const result = !isNaN(col6) && !isNaN(col18) ? col6 * col18 : 0;

                return result;
              }
              return params.data.col1;
            },
            valueFormatter: (params) => {
              // 数式が設定されているセルはすべて計算結果を整数に四捨五入して表示
              if (
                params.data.col1_formula &&
                typeof params.value === 'number'
              ) {
                return Math.round(params.value).toLocaleString();
              }
              if (typeof params.value === 'number') {
                return params.value.toLocaleString();
              }
              return params.value;
            },
            valueSetter: (params) => {
              // 数式が入力された場合の処理
              const newValue = params.newValue;
              if (newValue && newValue.startsWith('=')) {
                params.data.col1_formula = newValue;
                // 数式は保存するが、表示は計算値を使用
                return true;
              }
              params.data.col1 = newValue;
              return true;
            },
            cellStyle: (params) => getCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = salesPlanDataRef.current.map((row, idx) =>
                idx === params.node.rowIndex ? { ...row, ...params.data } : row
              );
              setSalesPlanData(newData);
              // 他の行が変更された場合、数式を含む行を再計算
              params.api.refreshCells({
                rowNodes: [params.api.getDisplayedRowAtIndex(0)!],
                force: true,
              });
              // 専用機行のcol1も再計算（col6やcol18に依存）
              const row1 = params.api.getDisplayedRowAtIndex(1);
              if (row1) {
                params.api.refreshCells({
                  rowNodes: [row1],
                  force: true,
                });
              }
              // 提携機行のcol1とcol3も再計算
              const row2 = params.api.getDisplayedRowAtIndex(2);
              if (row2) {
                params.api.refreshCells({
                  rowNodes: [row2],
                  force: true,
                });
              }
            },
          },
          {
            headerName: '予算',
            children: [
              {
                headerName: '金額',
                field: 'col21',
                width: 80,
                hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
                editable: false,
                cellStyle: (params) => getCellStyle(params, 'right'),
              },
              {
                headerName: '予算比',
                field: 'col22',
                width: 70,
                hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
                editable: false,
                tooltipValueGetter: (params) => {
                  if (params.data.col22_formula) {
                    const rowIndex = params.node?.rowIndex ?? -1;
                    if (rowIndex >= 0 && rowIndex <= 5)
                      return '数式: 当月計画 ÷ 予算';
                  }
                  return null;
                },
                // 予算比 = 当月計画(col1) ÷ 予算(col21) × 100
                valueGetter: (params) => {
                  const rowIndex = params.node?.rowIndex ?? -1;
                  if (
                    params.data.col22_formula &&
                    rowIndex >= 0 &&
                    rowIndex <= 5
                  ) {
                    const col1 =
                      parseFloat(
                        String(params.getValue('col1') ?? '0').replace(
                          /[,%]/g,
                          ''
                        )
                      ) || 0;
                    const col21 = parseFloat(
                      String(params.data.col21 ?? '0').replace(/[,%]/g, '')
                    );
                    if (!isNaN(col21) && col21 !== 0) {
                      return (col1 / col21) * 100;
                    }
                    return 0;
                  }
                  return params.data.col22;
                },
                valueFormatter: (params) => {
                  const rowIndex = params.node?.rowIndex ?? -1;
                  if (
                    params.data.col22_formula &&
                    rowIndex >= 0 &&
                    rowIndex <= 5 &&
                    typeof params.value === 'number'
                  ) {
                    return formatDecimal1(params.value) + '%';
                  }
                  return params.value;
                },
                cellStyle: (params) => getCellStyle(params, 'right'),
              },
            ],
          },
          {
            headerName: '前年実績',
            children: [
              {
                headerName: '金額',
                field: 'col2',
                width: 80,
                hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col2'),
                cellEditor: FormulaEditor,
                tooltipValueGetter: (params) => {
                  if (params.data.col2_formula) {
                    const rowIndex = params.node?.rowIndex ?? -1;
                    if (rowIndex === 0)
                      return '数式: 専用機 + 提携機 + アライアンス品（本社入力） + その他（手売り） + 出荷実販差';
                  }
                  return null;
                },
                valueGetter: (params) => {
                  // 数式がある場合は計算結果を表示
                  if (params.data.col2_formula && params.node?.rowIndex === 0) {
                    let sum = 0;
                    // rowIndex 1-5の合計を計算
                    for (let i = 1; i <= 5; i++) {
                      const rowNode = params.api.getDisplayedRowAtIndex(i);
                      if (rowNode && rowNode.data.col2) {
                        const value = String(rowNode.data.col2).replace(
                          /,/g,
                          ''
                        );
                        const num = parseFloat(value);
                        if (!isNaN(num)) {
                          sum += num;
                        }
                      }
                    }
                    return sum.toLocaleString();
                  }
                  return params.data.col2;
                },
                valueSetter: (params) => {
                  // 数式が入力された場合の処理
                  const newValue = params.newValue;
                  if (newValue && newValue.startsWith('=')) {
                    params.data.col2_formula = newValue;
                    // 数式は保存するが、表示は計算値を使用
                    return true;
                  }
                  params.data.col2 = newValue;
                  return true;
                },
                cellStyle: (params) => getCellStyle(params, 'right'),
                onCellValueChanged: (params) => {
                  const newData = [...salesPlanDataRef.current];
                  newData[params.node.rowIndex] = params.data;
                  setSalesPlanData(newData);
                  // 他の行が変更された場合、数式を含む行を再計算
                  params.api.refreshCells({
                    rowNodes: [params.api.getDisplayedRowAtIndex(0)!],
                    force: true,
                  });
                  // 専用機行も再計算
                  const row1 = params.api.getDisplayedRowAtIndex(1);
                  if (row1) {
                    params.api.refreshCells({
                      rowNodes: [row1],
                      force: true,
                    });
                  }
                  // 提携機行も再計算
                  const row2 = params.api.getDisplayedRowAtIndex(2);
                  if (row2) {
                    params.api.refreshCells({
                      rowNodes: [row2],
                      force: true,
                    });
                  }
                },
              },
              {
                headerName: '前年比',
                field: 'col3',
                width: 70,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col3'),
                cellEditor: FormulaEditor,
                tooltipValueGetter: (params) => {
                  if (params.data.col3_formula) {
                    return '数式: 当月計画 ÷ 前年実績';
                  }
                  return null;
                },
                valueGetter: (params) => {
                  // 数式がある場合は計算結果を表示（rowIndex 0-5 全対応）
                  if (
                    params.data.col3_formula &&
                    (params.node?.rowIndex === 0 ||
                      params.node?.rowIndex === 1 ||
                      params.node?.rowIndex === 2 ||
                      params.node?.rowIndex === 3 ||
                      params.node?.rowIndex === 4 ||
                      params.node?.rowIndex === 5)
                  ) {
                    // col1(当月計画)は col1 列の valueGetter を単一の計算元
                    // として参照する（ここで再計算しない）
                    const col1Num =
                      parseFloat(
                        String(params.getValue('col1') ?? '0').replace(
                          /[,%]/g,
                          ''
                        )
                      ) || 0;

                    const col2Num = parseFloat(
                      String(params.data.col2 || '0').replace(/,/g, '')
                    );
                    if (!isNaN(col1Num) && !isNaN(col2Num) && col2Num !== 0) {
                      return (col1Num / col2Num) * 100;
                    }
                    return 0;
                  }
                  return params.data.col3;
                },
                valueFormatter: (params) => {
                  // col3（割り算あり）: 小数第1位まで表示（小数第2位を四捨五入）
                  if (
                    params.data.col3_formula &&
                    (params.node?.rowIndex === 0 ||
                      params.node?.rowIndex === 1 ||
                      params.node?.rowIndex === 2 ||
                      params.node?.rowIndex === 3 ||
                      params.node?.rowIndex === 4 ||
                      params.node?.rowIndex === 5)
                  ) {
                    const value = params.value;
                    if (typeof value === 'number') {
                      return formatDecimal1(value) + '%';
                    }
                  }
                  return params.value;
                },
                valueSetter: (params) => {
                  // 数式が入力された場合の処理
                  const newValue = params.newValue;
                  if (newValue && newValue.startsWith('=')) {
                    params.data.col3_formula = newValue;
                    // 数式は保存するが、表示は計算値を使用
                    return true;
                  }
                  params.data.col3 = newValue;
                  return true;
                },
                cellStyle: (params) => getCellStyle(params, 'right'),
                onCellValueChanged: (params) => {
                  const newData = [...salesPlanDataRef.current];
                  newData[params.node.rowIndex] = params.data;
                  setSalesPlanData(newData);
                  // col1やcol2が変更された場合、数式を含む行を再計算
                  params.api.refreshCells({
                    rowNodes: [params.api.getDisplayedRowAtIndex(0)!],
                    force: true,
                  });
                  // 専用機行も再計算
                  const row1 = params.api.getDisplayedRowAtIndex(1);
                  if (row1) {
                    params.api.refreshCells({
                      rowNodes: [row1],
                      force: true,
                    });
                  }
                },
              },
            ],
          },
        ],
      },
      {
        // 売上函数（第一階層）。当月実績(col4)を第二・第三階層を結合した
        // 単一リーフ列として表示する
        headerName: '売上函数',
        children: [
          {
            headerName: '当月実績',
            field: 'col4',
            width: 80,
            hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col4'),
            cellStyle: (params) => getCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...salesPlanDataRef.current];
              newData[params.node.rowIndex] = params.data;
              setSalesPlanData(newData);
            },
          },
        ],
      },
      {
        headerName: '合計函数（計画）',
        children: [
          {
            headerName: '合計函数',
            field: 'col6',
            width: 80,
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col6'),
            cellEditorSelector: (params) => {
              // rows 4,5 は通常テキスト入力（FormulaEditorを使わない）
              if (params.node?.rowIndex === 4 || params.node?.rowIndex === 5) {
                return { component: 'agTextCellEditor' };
              }
              return { component: FormulaEditor };
            },
            tooltipValueGetter: (params) => {
              if (params.data.col6_formula) {
                const rowIndex = params.node?.rowIndex ?? -1;
                if (rowIndex === 0)
                  return '数式: 専用機 + 提携機 + アライアンス品（本社入力） + その他（手売り） + 出荷実販差';
                if (rowIndex >= 1 && rowIndex <= 3)
                  return '数式: 合計本数 ÷ 平均入数';
              }
              return null;
            },
            valueGetter: (params) => {
              // その他行（rowIndex === 4）・出荷実販差行（rowIndex === 5）は直接入力セル
              if (params.node?.rowIndex === 4 || params.node?.rowIndex === 5) {
                return params.data.col6;
              }
              // 商流販売店計行（rowIndex === 0）の数式: 各行のcol6を合算
              if (params.data.col6_formula && params.node?.rowIndex === 0) {
                // 各子行(専用機/提携機/アライアンス品/その他/出荷実販差)の
                // col6(合計函数)は、各行の col6 valueGetter を単一の計算元と
                // して参照する（ここで K/J を再計算しない）
                let sum = 0;
                for (let i = 1; i <= 5; i++) {
                  const rowNode = params.api.getDisplayedRowAtIndex(i);
                  if (!rowNode) continue;
                  const childCol6 = parseFloat(
                    String(
                      params.api.getCellValue({
                        rowNode,
                        colKey: 'col6',
                      }) ?? '0'
                    ).replace(/[,%]/g, '')
                  );
                  if (!isNaN(childCol6)) sum += childCol6;
                }
                return sum;
              }
              // 専用機/提携機/アライアンス品行（rowIndex 1-3）の数式:
              // =K/J (col10 / col9)。col10(合計本数)は col10 列の valueGetter
              // を単一の計算元として参照する（col11×col14 を再計算しない）
              if (
                params.data.col6_formula &&
                (params.node?.rowIndex ?? -1) >= 1 &&
                (params.node?.rowIndex ?? -1) <= 3
              ) {
                const col10 = parseFloat(
                  String(params.getValue('col10') ?? '0').replace(/[,%]/g, '')
                );
                const num9 = parseFloat(
                  String(params.data.col9 || '0').replace(/,/g, '')
                );
                if (!isNaN(col10) && !isNaN(num9) && num9 !== 0) {
                  return col10 / num9;
                }
                return 0;
              }
              return params.data.col6;
            },
            valueFormatter: (params) => {
              if (
                params.data.col6_formula &&
                (params.node?.rowIndex === 0 ||
                  params.node?.rowIndex === 1 ||
                  params.node?.rowIndex === 2 ||
                  params.node?.rowIndex === 3)
              ) {
                const value = params.value;
                if (typeof value === 'number') {
                  return Math.round(value).toLocaleString();
                }
              }
              return params.value;
            },
            valueSetter: (params) => {
              const rowIndex = params.node?.rowIndex ?? -1;
              const newValue = params.newValue;
              // rows 4,5 は直接入力セル: 常にcol6に保存し数式は不要
              if (rowIndex === 4 || rowIndex === 5) {
                params.data.col6 = newValue;
                params.data.col6_formula = undefined;
                return true;
              }
              if (newValue && newValue.startsWith('=')) {
                params.data.col6_formula = newValue;
                return true;
              }
              params.data.col6 = newValue;
              return true;
            },
            cellStyle: (params) => getCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...salesPlanDataRef.current];
              newData[params.node.rowIndex] = {
                ...params.data,
              };
              setSalesPlanData(newData);
              // 販売計画表と経費計画表の全ての数式セルを再計算
              recalculateAll();
            },
          },
          {
            headerName: '予算',
            children: [
              {
                headerName: '函数',
                field: 'col23',
                width: 80,
                hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
                editable: false,
                cellStyle: (params) => getCellStyle(params, 'right'),
              },
              {
                headerName: '予算比',
                field: 'col24',
                width: 70,
                hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
                editable: false,
                tooltipValueGetter: (params) => {
                  if (params.data.col24_formula) {
                    const rowIndex = params.node?.rowIndex ?? -1;
                    if (rowIndex >= 0 && rowIndex <= 5)
                      return '数式: 合計函数 ÷ 予算函数';
                  }
                  return null;
                },
                // 予算比 = 合計函数(col6) ÷ 予算函数(col23) × 100
                valueGetter: (params) => {
                  const rowIndex = params.node?.rowIndex ?? -1;
                  if (
                    params.data.col24_formula &&
                    rowIndex >= 0 &&
                    rowIndex <= 5
                  ) {
                    const col6 =
                      parseFloat(
                        String(params.getValue('col6') ?? '0').replace(
                          /[,%]/g,
                          ''
                        )
                      ) || 0;
                    const col23 = parseFloat(
                      String(params.data.col23 ?? '0').replace(/[,%]/g, '')
                    );
                    if (!isNaN(col23) && col23 !== 0) {
                      return (col6 / col23) * 100;
                    }
                    return 0;
                  }
                  return params.data.col24;
                },
                valueFormatter: (params) => {
                  const rowIndex = params.node?.rowIndex ?? -1;
                  if (
                    params.data.col24_formula &&
                    rowIndex >= 0 &&
                    rowIndex <= 5 &&
                    typeof params.value === 'number'
                  ) {
                    return formatDecimal1(params.value) + '%';
                  }
                  return params.value;
                },
                cellStyle: (params) => getCellStyle(params, 'right'),
              },
            ],
          },
          {
            headerName: '前年実績',
            children: [
              {
                headerName: '前年函数',
                field: 'col7',
                width: 80,
                hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col7'),
                valueGetter: (params) => {
                  if (params.data.col7_formula && params.node?.rowIndex === 0) {
                    let sum = 0;
                    for (let i = 1; i <= 5; i++) {
                      const rowNode = params.api.getDisplayedRowAtIndex(i);
                      if (rowNode && rowNode.data.col7) {
                        const value = String(rowNode.data.col7).replace(
                          /,/g,
                          ''
                        );
                        const num = parseFloat(value);
                        if (!isNaN(num)) {
                          sum += num;
                        }
                      }
                    }
                    return sum.toLocaleString();
                  }
                  return params.data.col7;
                },
                valueSetter: (params) => {
                  const newValue = params.newValue;
                  if (newValue && newValue.startsWith('=')) {
                    params.data.col7_formula = newValue;
                    return true;
                  }
                  params.data.col7 = newValue;
                  return true;
                },
                cellStyle: (params) => getCellStyle(params, 'right'),
                onCellValueChanged: (params) => {
                  const newData = [...salesPlanDataRef.current];
                  newData[params.node.rowIndex] = params.data;
                  setSalesPlanData(newData);
                  if (gridRef.current?.api) {
                    gridRef.current.api.refreshCells({
                      rowNodes: [
                        gridRef.current.api.getDisplayedRowAtIndex(0)!,
                      ],
                      force: true,
                    });
                  }
                  // 専用機行・提携機行のcol7が変更された場合、各行のcol8を再計算
                  if (
                    (params.node?.rowIndex === 1 ||
                      params.node?.rowIndex === 2) &&
                    gridRef.current?.api
                  ) {
                    gridRef.current.api.refreshCells({
                      rowNodes: [params.node],
                      force: true,
                    });
                  }
                },
              },
              {
                headerName: '前年比',
                field: 'col8',
                width: 70,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col8'),
                cellEditor: FormulaEditor,
                tooltipValueGetter: (params) => {
                  if (params.data.col8_formula) {
                    return '数式: 合計函数 ÷ 前年函数';
                  }
                  return null;
                },
                valueGetter: (params) => {
                  // rowIndex 0-5 全対応: G/H
                  if (
                    params.data.col8_formula &&
                    (params.node?.rowIndex === 0 ||
                      params.node?.rowIndex === 1 ||
                      params.node?.rowIndex === 2 ||
                      params.node?.rowIndex === 3 ||
                      params.node?.rowIndex === 4 ||
                      params.node?.rowIndex === 5)
                  ) {
                    // col6(合計函数)は col6 列の valueGetter を単一の計算元
                    // として参照する（ここで再計算しない）
                    const col6Value =
                      parseFloat(
                        String(params.getValue('col6') ?? '0').replace(
                          /[,%]/g,
                          ''
                        )
                      ) || 0;

                    const col7Value = parseFloat(
                      String(params.data.col7 || '0').replace(/,/g, '')
                    );
                    if (
                      !isNaN(col6Value) &&
                      !isNaN(col7Value) &&
                      col7Value !== 0
                    ) {
                      return (col6Value / col7Value) * 100;
                    }
                    return 0;
                  }
                  return params.data.col8;
                },
                valueFormatter: (params) => {
                  if (
                    params.data.col8_formula &&
                    (params.node?.rowIndex === 0 ||
                      params.node?.rowIndex === 1 ||
                      params.node?.rowIndex === 2 ||
                      params.node?.rowIndex === 3 ||
                      params.node?.rowIndex === 4 ||
                      params.node?.rowIndex === 5)
                  ) {
                    const value = params.value;
                    if (typeof value === 'number') {
                      return formatDecimal1(value) + '%';
                    }
                  }
                  return params.value;
                },
                valueSetter: (params) => {
                  const newValue = params.newValue;
                  if (newValue && newValue.startsWith('=')) {
                    params.data.col8_formula = newValue;
                    return true;
                  }
                  params.data.col8 = newValue;
                  return true;
                },
                cellStyle: (params) => getCellStyle(params, 'right'),
                onCellValueChanged: (params) => {
                  const newData = [...salesPlanDataRef.current];
                  newData[params.node.rowIndex] = params.data;
                  setSalesPlanData(newData);
                  if (gridRef.current?.api) {
                    gridRef.current.api.refreshCells({
                      rowNodes: [
                        gridRef.current.api.getDisplayedRowAtIndex(0)!,
                      ],
                      force: true,
                    });
                  }
                },
              },
            ],
          },
        ],
      },
      {
        headerName: '算出項目（計画）',
        children: [
          {
            headerName: '平均入数',
            field: 'col9',
            width: 80,
            hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col9'),
            valueFormatter: (params) => {
              if (params.node?.rowPinned) return params.value;
              const v = params.value;
              if (v == null || v === '' || v === '－') return v;
              const num = parseFloat(String(v).replace(/,/g, ''));
              if (isNaN(num)) return v;
              return num.toFixed(1);
            },
            cellStyle: (params) => getCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = salesPlanDataRef.current.map((row, idx) =>
                idx === params.node.rowIndex ? { ...row, ...params.data } : row
              );
              setSalesPlanData(newData);
              // 専用機行のcol9が変更された場合、専用機行のcol6を再計算
              if (params.node?.rowIndex === 1 && gridRef.current?.api) {
                gridRef.current.api.refreshCells({
                  rowNodes: [params.node],
                  force: true,
                });
              }
              // 提携機行のcol9が変更された場合、提携機行のcol6を再計算
              if (params.node?.rowIndex === 2 && gridRef.current?.api) {
                gridRef.current.api.refreshCells({
                  rowNodes: [params.node],
                  force: true,
                });
              }
            },
          },
          {
            headerName: '合計本数',
            field: 'col10',
            width: 80,
            hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col10'),
            cellEditor: FormulaEditor,
            tooltipValueGetter: (params) => {
              if (params.data.col10_formula) {
                const rowIndex = params.node?.rowIndex ?? -1;
                if (rowIndex >= 1 && rowIndex <= 3)
                  return '数式: 専用機PM/提携機PC × 稼働台数(コラム)';
              }
              return null;
            },
            valueGetter: (params) => {
              // 商流販売店計行（rowIndex === 0）の数式: 各行のcol10を合算
              if (params.data.col10_formula && params.node?.rowIndex === 0) {
                // 各子行の col10 は、各行の col10 valueGetter を単一の計算
                // 元として参照する（ここで col11×col14 等を再計算しない）
                let sum = 0;
                for (let i = 1; i <= 5; i++) {
                  const rowNode = params.api.getDisplayedRowAtIndex(i);
                  if (!rowNode) continue;
                  const childCol10 = parseFloat(
                    String(
                      params.api.getCellValue({
                        rowNode,
                        colKey: 'col10',
                      }) ?? '0'
                    ).replace(/[,%]/g, '')
                  );
                  if (!isNaN(childCol10)) sum += childCol10;
                }
                return sum;
              }
              // 専用機/提携機/アライアンス品行（rowIndex 1-3）の数式:
              // =L*O (col11 × col14)。col11・col14 とも各列の valueGetter を
              // 単一の計算元として参照する（col16 等を再計算しない）
              if (
                params.data.col10_formula &&
                (params.node?.rowIndex ?? -1) >= 1 &&
                (params.node?.rowIndex ?? -1) <= 3
              ) {
                const col11 =
                  parseFloat(
                    String(params.getValue('col11') ?? '0').replace(/[,%]/g, '')
                  ) || 0;
                const col14 =
                  parseFloat(
                    String(params.getValue('col14') ?? '0').replace(/[,%]/g, '')
                  ) || 0;
                return round(col11 * col14, 0);
              }
              // 出荷実販差行（rowIndex === 5）の数式: =G7*J2 → col6(rowIndex5) * col9(rowIndex0)
              if (params.data.col10_formula && params.node?.rowIndex === 5) {
                const col6Value = String(params.data.col6 || '0').replace(
                  /,/g,
                  ''
                );
                const num1 = parseFloat(col6Value);
                const row0 = params.api.getDisplayedRowAtIndex(0);
                const col9Row0Value = row0
                  ? String(row0.data.col9 || '0').replace(/,/g, '')
                  : '0';
                const num2 = parseFloat(col9Row0Value);
                if (!isNaN(num1) && !isNaN(num2)) {
                  const result = round(num1 * num2, 0);

                  return result;
                }
                return 0;
              }
              return params.data.col10;
            },
            valueFormatter: (params) => {
              if (typeof params.value === 'number') {
                return params.value.toLocaleString();
              }
              return params.value;
            },
            valueSetter: (params) => {
              const newValue = params.newValue;
              if (newValue && newValue.startsWith('=')) {
                params.data.col10_formula = newValue;
                return true;
              }
              params.data.col10 = newValue;
              return true;
            },
            cellStyle: (params) => getCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = salesPlanDataRef.current.map((row, idx) =>
                idx === params.node.rowIndex ? { ...row, ...params.data } : row
              );
              setSalesPlanData(newData);
              if (gridRef.current?.api) {
                gridRef.current.api.refreshCells({
                  rowNodes: [gridRef.current.api.getDisplayedRowAtIndex(0)!],
                  force: true,
                });
              }
              // 専用機行のcol10が変更された場合、専用機行のcol6とcol10を再計算
              if (params.node?.rowIndex === 1) {
                gridRef.current.api.refreshCells({
                  rowNodes: [params.node],
                  force: true,
                });
              }
              // 提携機行のcol10が変更された場合、提携機行のcol6を再計算
              if (params.node?.rowIndex === 2) {
                gridRef.current.api.refreshCells({
                  rowNodes: [params.node],
                  force: true,
                });
              }
            },
          },
          // 専用機PM/提携機PC と PM/PC商談見込 は、第二階層「専用機PM/提携機PC」の配下へ置く。
          {
            headerName: '専用機PM/提携機PC',
            children: [
              {
                headerName: '専用機PM/提携機PC',
                field: 'col11',
                width: 110,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col11'),
                cellEditor: FormulaEditor,
                tooltipValueGetter: (params) => {
                  if (params.data.col11_formula) {
                    const rowIndex = params.node?.rowIndex ?? -1;
                    if (rowIndex === 1)
                      return '数式: 前年PM × 出荷稼働日前年比 × 直近変動率 × PM商談見込';
                    if (rowIndex === 2)
                      return '数式: 前年PC × 出荷稼働日前年比 × 直近変動率 × PC商談見込';
                    if (rowIndex === 3)
                      return '数式: 前年PM × 出荷稼働日前年比 × 直近変動率';
                  }
                  return null;
                },
                valueGetter: (params) => {
                  const rowIndex = params.node?.rowIndex ?? -1;

                  // セルに設定された数式（専用機 =Z3*N3*M3*Q2／提携機 =Z4*N4*M4*Q2／
                  // アライアンス品 =Z5*N5*Q2 等）をそのまま解釈して計算する。
                  // 値はフル精度で返し、表示の小数1桁は valueFormatter で行う
                  // （col10 等が col11 を参照しても誤差が出ないようにするため）。
                  if (params.data.col11_formula && rowIndex >= 1) {
                    const value = evalSalesMultiplyFormula(
                      params.data.col11_formula,
                      params.api
                    );
                    return value ?? 0;
                  }

                  return params.data.col11 || 0;
                },
                valueFormatter: (params) => {
                  const rowIndex = params.node?.rowIndex ?? -1;
                  // 数式セルは小数点1桁で表示
                  if (
                    params.data.col11_formula &&
                    (rowIndex === 1 || rowIndex === 2 || rowIndex === 3)
                  ) {
                    if (typeof params.value === 'number') {
                      return params.value.toLocaleString(undefined, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      });
                    }
                  }
                  return params.value;
                },
                valueSetter: (params) => {
                  const newValue = params.newValue;
                  if (newValue && newValue.startsWith('=')) {
                    params.data.col11_formula = newValue;
                    return true;
                  }
                  params.data.col11 = newValue;
                  return true;
                },
                cellStyle: (params) => getCellStyle(params, 'right'),
                onCellValueChanged: (params) => {
                  const newData = salesPlanDataRef.current.map((row, idx) =>
                    idx === params.node.rowIndex
                      ? { ...row, ...params.data }
                      : row
                  );
                  setSalesPlanData(newData);
                  if (gridRef.current?.api) {
                    gridRef.current.api.refreshCells({
                      rowNodes: [
                        gridRef.current.api.getDisplayedRowAtIndex(1)!,
                      ],
                      force: true,
                    });
                    // 提携機行のcol11も再計算
                    gridRef.current.api.refreshCells({
                      rowNodes: [
                        gridRef.current.api.getDisplayedRowAtIndex(2)!,
                      ],
                      force: true,
                    });
                  }
                },
              },
              {
                // 前年同月の専用機PM/提携機PC。計画値の比較対象として並べる参照表示の列。
                // 編集可否は isCellEditable が一元管理しており、当列は対象外＝入力不可。
                headerName: '前年PM/PC',
                field: 'col25',
                width: 100,
                // col11 と同じ小数第1位まで表示。"－"・空は素通し。
                valueFormatter: (params) => {
                  const v = params.value;
                  if (v == null || v === '' || v === '－') return v ?? '';
                  const num = parseFloat(String(v).replace(/,/g, ''));
                  if (isNaN(num)) return v;
                  return formatDecimal1(num);
                },
                cellStyle: (params) => getCellStyle(params, 'right'),
              },
              {
                headerName: 'PM/PC商談見込',
                field: 'col12',
                width: 100,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col12'),
                // 比率(%)を小数第1位まで表示（小数第2位を四捨五入）。"－"・空は素通し
                valueFormatter: (params) => {
                  const v = params.value;
                  if (v == null || v === '' || v === '－') return v ?? '';
                  const num = parseFloat(String(v).replace(/[%,]/g, ''));
                  if (isNaN(num)) return v;
                  return formatDecimal1(num) + '%';
                },
                cellStyle: (params) => getCellStyle(params, 'right'),
                onCellValueChanged: (params) => {
                  const newData = salesPlanDataRef.current.map((row, idx) =>
                    idx === params.node.rowIndex
                      ? { ...row, ...params.data }
                      : row
                  );
                  setSalesPlanData(newData);
                  // 販売計画表と経費計画表の全ての数式セルを再計算
                  recalculateAll();
                },
              },
            ],
          },
          {
            headerName: '直近変動率',
            field: 'col13',
            width: 90,
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col13'),
            // 比率(%)を小数第1位まで表示（小数第2位を四捨五入）。"－"・空は素通し
            valueFormatter: (params) => {
              const v = params.value;
              if (v == null || v === '' || v === '－') return v ?? '';
              const num = parseFloat(String(v).replace(/[%,]/g, ''));
              if (isNaN(num)) return v;
              return formatDecimal1(num) + '%';
            },
            cellStyle: (params) => getCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = salesPlanDataRef.current.map((row, idx) =>
                idx === params.node.rowIndex ? { ...row, ...params.data } : row
              );
              setSalesPlanData(newData);
              // 専用機行のcol13が変更された場合、専用機行のcol11を再計算
              if (params.node?.rowIndex === 1 && gridRef.current?.api) {
                gridRef.current.api.refreshCells({
                  rowNodes: [params.node],
                  force: true,
                });
              }
              // 提携機行のcol13が変更された場合、提携機行のcol11を再計算
              if (params.node?.rowIndex === 2 && gridRef.current?.api) {
                gridRef.current.api.refreshCells({
                  rowNodes: [params.node],
                  force: true,
                });
              }
            },
          },
          // 稼働台数(コラム) と 台/コラム商談見込 は、第二階層「稼働台数(コラム)」の配下へ置く。
          {
            headerName: '稼働台数(コラム)',
            children: [
              {
                headerName: '稼働台数(コラム)',
                field: 'col14',
                width: 100,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col14'),
                cellEditor: FormulaEditor,
                tooltipValueGetter: (params) => {
                  if (params.data.col14_formula) {
                    const rowIndex = params.node?.rowIndex ?? -1;
                    if (rowIndex === 1)
                      return '数式: 前月末台数 + 商談見込台数';
                    if (rowIndex === 2)
                      return '数式: 直近コラム数 + 商談見込コラム数';
                  }
                  return null;
                },
                valueGetter: (params) => {
                  // 専用機行（rowIndex === 1）の数式: =AA3+P3
                  // 直近台数は 直近台数(コラム) 列（col26＝AA列）のセル値を使う。
                  if (
                    params.data.col14_formula &&
                    params.node?.rowIndex === 1
                  ) {
                    const col26Num = parseFloat(
                      String(params.data.col26 ?? '').replace(/,/g, '')
                    );
                    const col15Value = String(params.data.col15 || '0')
                      .replace(/[%,+]/g, '')
                      .replace(/▲/g, '-');
                    const num = parseFloat(col15Value);
                    if (!isNaN(col26Num) && !isNaN(num)) {
                      const result = round(col26Num + num, 0);

                      return result;
                    }

                    return 0;
                  }
                  // 提携機行（rowIndex === 2）の数式: =AA4+P4
                  // 直近台数は 直近台数(コラム) 列（col26＝AA列）のセル値を使う。
                  if (
                    params.data.col14_formula &&
                    params.node?.rowIndex === 2
                  ) {
                    const col26Num = parseFloat(
                      String(params.data.col26 ?? '').replace(/,/g, '')
                    );
                    const col15Value = String(params.data.col15 || '0')
                      .replace(/[%,+]/g, '')
                      .replace(/▲/g, '-');
                    const num = parseFloat(col15Value);
                    if (!isNaN(col26Num) && !isNaN(num)) {
                      const result = round(col26Num + num, 0);

                      return result;
                    }

                    return 0;
                  }

                  return params.data.col14;
                },
                valueFormatter: (params) => {
                  const rowIndex = params.node?.rowIndex ?? -1;
                  if (
                    params.data.col14_formula &&
                    (rowIndex === 1 || rowIndex === 2)
                  ) {
                    if (typeof params.value === 'number') {
                      return params.value.toLocaleString();
                    }
                  }
                  return params.value;
                },
                valueSetter: (params) => {
                  const newValue = params.newValue;
                  if (newValue && newValue.startsWith('=')) {
                    params.data.col14_formula = newValue;
                    return true;
                  }
                  params.data.col14 = newValue;
                  return true;
                },
                cellStyle: (params) => getCellStyle(params, 'right'),
                onCellValueChanged: (params) => {
                  const newData = salesPlanDataRef.current.map((row, idx) =>
                    idx === params.node.rowIndex
                      ? { ...row, ...params.data }
                      : row
                  );
                  setSalesPlanData(newData);
                  if (gridRef.current?.api) {
                    gridRef.current.api.refreshCells({
                      rowNodes: [
                        gridRef.current.api.getDisplayedRowAtIndex(1)!,
                      ],
                      force: true,
                    });
                    // 提携機行のcol14も再計算
                    gridRef.current.api.refreshCells({
                      rowNodes: [
                        gridRef.current.api.getDisplayedRowAtIndex(2)!,
                      ],
                      force: true,
                    });
                  }
                },
              },
              {
                // 稼働台数(コラム) の算出元になる直近の台数（コラム数）。
                // 稼働台数(コラム) ＝ 直近台数(コラム) ＋ 台/コラム商談見込 の関係で並べる。
                // 編集可否は isCellEditable が一元管理しており、当列は対象外＝入力不可。
                headerName: '直近台数(コラム)',
                field: 'col26',
                width: 120,
                // 台数（コラム数）は整数で3桁区切り表示。"－"・空は素通し。
                valueFormatter: (params) => {
                  const v = params.value;
                  if (v == null || v === '' || v === '－') return v ?? '';
                  const num = parseFloat(String(v).replace(/,/g, ''));
                  if (isNaN(num)) return v;
                  return Math.round(num).toLocaleString();
                },
                cellStyle: (params) => getCellStyle(params, 'right'),
              },
              {
                headerName: '台/コラム商談見込',
                field: 'col15',
                width: 120,
                editable: (params) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col15'),
                cellStyle: (params) => getCellStyle(params, 'right'),
                valueFormatter: (params) => {
                  const val = params.value;
                  if (
                    val === null ||
                    val === undefined ||
                    val === '－' ||
                    val === ''
                  )
                    return val ?? '';
                  const numStr = String(val)
                    .replace(/[+,]/g, '')
                    .replace(/▲/g, '-');
                  const num = parseFloat(numStr);
                  if (isNaN(num)) return String(val);
                  if (num > 0) return `+${num.toLocaleString()}`;
                  if (num < 0) return `▲${Math.abs(num).toLocaleString()}`;
                  return '0';
                },
                valueSetter: (params) => {
                  const raw = String(params.newValue ?? '').trim();
                  if (raw.startsWith('▲')) {
                    const num = parseFloat(raw.slice(1).replace(/[,+]/g, ''));
                    params.data.col15 = isNaN(num) ? '0' : String(-num);
                  } else if (raw.startsWith('+')) {
                    const num = parseFloat(raw.slice(1).replace(/,/g, ''));
                    params.data.col15 = isNaN(num) ? '0' : String(num);
                  } else {
                    const num = parseFloat(raw.replace(/,/g, ''));
                    params.data.col15 = isNaN(num) ? raw : String(num);
                  }
                  return true;
                },
                onCellValueChanged: (params) => {
                  const newData = salesPlanDataRef.current.map((row, idx) =>
                    idx === params.node.rowIndex
                      ? { ...row, ...params.data }
                      : row
                  );
                  setSalesPlanData(newData);
                  // 販売計画表と経費計画表の全ての数式セルを再計算
                  recalculateAll();
                },
              },
            ],
          },
          {
            // 函単価グループは単価1列のみのため、第2・第3階層を結合した
            // 単一リーフ列（函単価）として表示する
            headerName: '函単価',
            field: 'col18',
            width: 80,
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col18'),
            // 専用機/提携機/アライアンス品/その他(手売り)/出荷実販差 行
            // （rowIndex 1〜5）の単価は「函単価(数式内の基準額) ×
            // 商流販売店計の価格改定率(row0 col19)」を計算して表示する。
            // 手入力で数式が消えている場合は入力値を表示。
            valueGetter: (params) => {
              const rowIndex = params.node?.rowIndex ?? -1;
              if (params.data.col18_formula && rowIndex >= 1 && rowIndex <= 5) {
                // 単価 = 基準函単価 × 商流販売店計(row0)の価格改定率
                const row0 = params.api?.getDisplayedRowAtIndex(0);
                return computeSalesCol18(params.data, row0?.data);
              }
              return params.data.col18;
            },
            valueFormatter: (params) => {
              const v = params.value;
              if (v === null || v === undefined || v === '') return v ?? '';
              const num = parseFloat(String(v).replace(/,/g, ''));
              return isNaN(num) ? String(v) : num.toLocaleString();
            },
            valueSetter: (params) => {
              // 手入力時は数式を一時クリアして入力値を保持
              // （経費計画表のロケ運転費の計画金額(rowIndex 7)と同じ挙動）
              params.data.col18 = params.newValue;
              params.data.col18_formula = null;
              return true;
            },
            cellStyle: (params) => getCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = [...salesPlanDataRef.current];
              newData[params.node.rowIndex] = params.data;
              setSalesPlanData(newData);
              // 全ての数式セルを再計算
              recalculateSalesPlan();
            },
          },
          {
            // ヘッダーは headerName の \n の位置で2段に改行する。
            // 折り返しと高さ調整は AG Grid 公式の wrapHeaderText / autoHeaderHeight で行う
            // （見出しの高さは共通テーマの1行分のため、autoHeaderHeight が無いと見切れる）。
            // \n を改行として描画させる white-space の指定は下の <style> 側。
            // 幅は最長行（1段目＝13文字）が収まる値にする。狭いと pre-line でも
            // 折り返しが入り、指定した位置以外でも改行されてしまうため。
            headerName: 'アライアンス品契約状況変動\nに伴う追加売上金額',
            field: 'col20',
            wrapHeaderText: true,
            autoHeaderHeight: true,
            width: 210,
            hide: true, // 初期非表示（→ SALES_PLAN_INITIAL_HIDDEN_COLS）
            editable: (params) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col20'),
            cellStyle: (params) => getCellStyle(params, 'right'),
            onCellValueChanged: (params) => {
              const newData = salesPlanDataRef.current.map((row, idx) =>
                idx === params.node.rowIndex ? { ...row, ...params.data } : row
              );
              setSalesPlanData(newData);
            },
          },
        ],
      },
    ],
    []
  );

  // 販売計画グリッド専用 defaultColDef（差分表示 cellRenderer を含む）
  const salesPlanDefaultColDef = useMemo(
    () => ({
      sortable: false,
      resizable: true,
      filter: false,
      suppressMovable: true,
      suppressMenu: true,
      cellClassRules: EMPTY_CELL_CLASS_RULES,
      cellStyle: {
        fontSize: '0.875rem',
        lineHeight: '2rem',
        display: 'flex',
        alignItems: 'center',
      },
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
      sortable: false,
      resizable: true,
      filter: false,
      suppressMovable: true,
      suppressMenu: true,
      cellClassRules: EMPTY_CELL_CLASS_RULES,
      cellStyle: {
        fontSize: '0.875rem',
        lineHeight: '2rem',
        display: 'flex',
        alignItems: 'center',
      },
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

  // 行のスタイルを取得する関数
  const getRowStyle = (params: any) => {
    // 合計行（rowIndex === 0）の場合
    if (!params.node?.rowPinned && params.node?.rowIndex === 0) {
      return {
        backgroundColor: GRID_COLORS.total,
        fontWeight: 'bold',
      };
    }
    return undefined;
  };

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
  const expensePlanColumnDefs = useMemo(() => {
    const num = (v: any) =>
      parseFloat(String(v ?? '0').replace(/[,%]/g, '')) || 0;

    const onBranchChanged = (params: any) => {
      const newData = expensePlanDataRef.current.map((row, idx) =>
        idx === params.node.rowIndex ? { ...row, ...params.data } : row
      );
      setExpensePlanData(newData);
      recalculateExpensePlan();
    };

    // 拠点列の算出値を返す。
    //   604:ロケ契約料他前払い金(償却)(12) ＝ ロケ契約中(14) + ロケ契約見込(13)
    //   経費金額合計(0) ＝ オペ協力金(9)〜前払金(償却)(12) の合算
    //     （12 は小計行のため、その子 13・14 は二重計上を避けて含めない）
    const branchValue = (api: any, rowIndex: number, field: string): number => {
      const rawAt = (i: number) => {
        const node = api?.getDisplayedRowAtIndex(i);
        const data = node?.data ?? expensePlanDataRef.current[i];
        return num((data as any)?.[field]);
      };
      if (rowIndex === 12) return rawAt(14) + rawAt(13);
      if (rowIndex === 0) {
        return rawAt(9) + rawAt(10) + rawAt(11) + branchValue(api, 12, field);
      }
      return rawAt(rowIndex);
    };

    // 拠点列（本社/支社）：その他経費は入力、経費金額合計行(0)は当該列の合算。
    // ヘッダーは「管理コード（改行）名称」の2段表示。折り返しと高さ調整は AG Grid 公式の
    // wrapHeaderText / autoHeaderHeight で行い、改行位置は headerName の \n で固定する
    // （\n を有効にする white-space の指定は下の <style> 側）。
    const branchCol = (field: string, headerName: string) => ({
      headerName,
      field,
      wrapHeaderText: true,
      autoHeaderHeight: true,
      width: 110,
      editable: (params: any) =>
        isExpenseCellEditable(params.node?.rowIndex ?? -1, field),
      valueGetter: (params: any) => {
        // 固定上段（単位行）は生値をそのまま表示
        if (params.node?.rowPinned) return params.data[field];
        if (params.data?.isParent && !params.data?.showAsValue) return '';
        const r = params.node?.rowIndex ?? -1;
        // 経費金額合計(0)・前払金(償却)(12) は算出行のため合算値を返す
        if (r === 0 || r === 12) return branchValue(params.api, r, field);
        return params.data[field];
      },
      valueFormatter: (params: any) => formatExpenseNumber(params.value),
      cellStyle: (params: any) => getExpenseCellStyle(params, 'right'),
      onCellValueChanged: onBranchChanged,
    });

    // 実績/予算列（読み取り専用）
    const plainCol = (field: string, headerName: string, width = 120) => ({
      headerName,
      field,
      width,
      editable: false,
      valueGetter: (params: any) => {
        if (params.node?.rowPinned) return params.data[field];
        if (params.data?.isParent && !params.data?.showAsValue) return '';
        const r = params.node?.rowIndex ?? -1;
        // 計算行（経費金額合計=0・条件口=2・条件口率=6・ロケ運転費率=8）の
        // 前月実績・予算・前年同月実績は、設定数式に基づく計算値を表示する。
        // ロケ運転費(7)は数式を削除し固定値のため生データをそのまま表示する。
        if (
          (r === 0 || r === 2 || r === 6 || r === 8) &&
          (field === 'catZengetsuJisseki' ||
            field === 'catYosan' ||
            field === 'catZennenJisseki')
        ) {
          return computeExpenseActual(r, field);
        }
        return params.data[field];
      },
      valueFormatter: (params: any) => {
        // 条件口率(6)・ロケ運転費率(8) は率行のため % 付きで表示。
        // 小数第1位まで表示（小数第2位を四捨五入）。
        const r = params.node?.rowIndex ?? -1;
        if ((r === 6 || r === 8) && !params.node?.rowPinned) {
          const v = params.value;
          if (v === null || v === undefined || v === '' || v === '－')
            return v ?? '';
          const n = parseFloat(String(v).replace(/[,%]/g, ''));
          return isNaN(n) ? String(v) : formatDecimal1(n) + '%';
        }
        return formatExpenseNumber(params.value);
      },
      cellStyle: (params: any) => getExpenseCellStyle(params, 'right'),
    });

    // 比列（cellRenderer が比率を算出）
    const ratioCol = (field: string, headerName: string, width = 100) => ({
      headerName,
      field,
      width,
      editable: false,
      valueGetter: (params: any) =>
        params.data?.isParent && !params.data?.showAsValue
          ? ''
          : params.data[field],
      cellStyle: (params: any) => getExpenseCellStyle(params, 'right'),
    });

    return [
      {
        // 経費項目ラベル
        headerName: '経費項目',
        field: 'category',
        width: 240,
        lockPosition: true,
        headerClass: 'ag-header-cell-left',
        cellClass: (params: any) =>
          params.node?.rowPinned === 'top' ? '' : 'ag-cell-left',
        cellStyle: (params: any) => {
          if (params.node?.rowPinned === 'top') {
            return {
              backgroundColor: GRID_COLORS.readonly,
              // 固定上段（税抜き注記行）も AG Grid 標準の text-sm(0.875rem) に統一
              fontSize: '0.875rem',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            };
          }
          const rowIndex = params.node?.rowIndex ?? -1;
          const rowData = params.data;
          const paddingLeft = rowData?.isChild ? '1.5rem' : '0.5rem';
          const cellKey = `${rowIndex}-category`;
          const isHighlighted =
            expenseHighlightedCellsRef.current.includes(cellKey);
          return {
            // 経費金額合計行（rowIndex === 0）のみ合計色。その他の行タイトルは
            // 合計ではない通常（編集不可＝灰）背景にする。
            backgroundColor:
              rowIndex === 0
                ? GRID_COLORS.total
                : rowData?.isGroupHeaderRow
                  ? GRID_COLORS.sectionRowBg
                  : GRID_COLORS.readonly,
            // 太字は合計行（経費金額合計＝rowIndex 0）のみ（標準準拠）
            fontWeight: rowIndex === 0 ? 'bold' : 'normal',
            fontSize: '0.875rem',
            lineHeight: '2rem',
            paddingLeft,
            border: isHighlighted ? REF_HIGHLIGHT_BORDER : undefined,
          };
        },
        cellRenderer: (params: any) => {
          const label = params.value != null ? String(params.value) : '';
          if (params.node?.rowPinned) return label;
          const data = params.data;
          // レート行（オペ条件口=exp_col16 等）は項目名の右に
          // 参照用のレート（オペ条件口率）を編集可能なテキストボックスで表示
          if (data?.rateField) {
            const rate = data[data.rateField] ?? '';
            const rowIndex = params.node?.rowIndex ?? -1;
            // レート(オペ条件口率・帳合料率)を小数第1位まで % 付きで表示。
            // "－"・空・非数値は素通し。
            const formatRate = (v: any): string => {
              if (v == null || v === '' || v === '－') return v ?? '';
              const n = parseFloat(String(v).replace(/[%,]/g, ''));
              return isNaN(n) ? String(v) : formatDecimal1(n) + '%';
            };
            const rateDisplay = formatRate(rate);

            // 差分表示モード: レート（現在値 − 基準値）を表示する。
            // 基準値は expenseBaselineData[rowIndex][rateField] に持つ。
            if (isDiffModeRef.current) {
              const parseRate = (v: any) =>
                parseFloat(
                  String(v ?? '')
                    .replace(/[%,+]/g, '')
                    .replace(/▲/g, '-')
                );
              const baseRaw = expenseBaselineData[rowIndex]?.[data.rateField];
              const cur = parseRate(rate);
              const base = parseRate(baseRaw);
              // 現在値／基準値が数値でない場合は項目名のみ表示
              if (baseRaw === undefined || isNaN(cur) || isNaN(base)) {
                return <span>{label}</span>;
              }
              // 小数第1位まで表示（小数第2位を四捨五入）
              const diff = Math.round((cur - base) * 10) / 10;
              const diffText =
                diff === 0
                  ? '±0.0%'
                  : diff > 0
                    ? `+${formatDecimal1(diff)}%`
                    : `▲${formatDecimal1(Math.abs(diff))}%`;
              const diffColor =
                diff > 0
                  ? GRID_COLORS.increaseText
                  : diff < 0
                    ? GRID_COLORS.decreaseText
                    : '#374151';
              return (
                <span
                  style={{
                    // セル幅いっぱいに広げ、差分表示を marginLeft:auto でセル右端へ寄せる
                    // （category 列の cell-wrapper/value は下部 style で幅100%に拡張）。
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      color: diffColor,
                    }}
                  >
                    {diffText}
                  </span>
                </span>
              );
            }

            const rateKey = `${rowIndex}-${data.rateField}`;
            // 緑＝参照セル（その行の計画金額数式から参照される）
            const isRefHi =
              expenseHighlightedCellsRef.current.includes(rateKey);
            // 帳合料率(exp_col17) は入力可。他のレート（オペ条件口率 等）は参照のみ。
            const isRateEditable = data.rateField === 'exp_col17';
            // 入力確定（フォーカスアウト）時に値を反映して再計算する。
            const commitRate = (v: string) => {
              // 表示整形（小数第1位）による見かけの差異は無視し、
              // 数値として変化があるときだけ確定・再計算する。
              const nv = parseFloat(String(v).replace(/[%,]/g, ''));
              const cur = parseFloat(String(rate).replace(/[%,]/g, ''));
              if (isNaN(nv) ? v === rate : nv === cur) return;
              const newData = expensePlanDataRef.current.map((row, idx) =>
                idx === rowIndex ? { ...row, [data.rateField]: v } : row
              );
              setExpensePlanData(newData);
              recalculateExpensePlan();
            };
            return (
              <span
                style={{
                  // セル幅いっぱいに広げ、入力ボックスを ml-auto でセル右端へ寄せる
                  // （category 列の cell-wrapper/value は下部 style で幅100%に拡張）。
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <span>{label}</span>
                <input
                  type="text"
                  {...(isRateEditable
                    ? {
                        // 入力中の再レンダリングでフォーカスが外れないよう非制御入力にし、
                        // 外部値が変わったら key で再初期化、確定は onBlur で行う。
                        key: rateDisplay,
                        defaultValue: rateDisplay,
                        // 参照のみの率ボックスと同様に、クリック時は AG Grid の
                        // セルクリック（onExpenseCellClicked）で依存先（オレンジ）を
                        // 強調する。そのため data-rate-box を付け、クリックは
                        // 伝播させる（伝播を止めると強調されない）。
                        // 強調処理は編集を開始しないため、入力・フォーカスは妨げない。
                        'data-rate-box': 'true',
                        onMouseDown: (e: any) => e.stopPropagation(),
                        onBlur: (e: any) => commitRate(e.target.value),
                      }
                    : {
                        value: rateDisplay,
                        readOnly: true,
                        tabIndex: -1,
                        'data-rate-box': 'true',
                      })}
                  title={data.rateLabel}
                  aria-label={data.rateLabel}
                  className={`ml-auto w-12 h-5 text-xs font-medium text-right text-blue-600 rounded-sm px-1 ${
                    isRateEditable ? 'cursor-text' : 'cursor-pointer'
                  }`}
                  style={{
                    border: isRefHi
                      ? REF_HIGHLIGHT_BORDER
                      : `1px solid ${GRID_COLORS.existingFuncBorder}`,
                    backgroundColor: isRateEditable
                      ? GRID_COLORS.editable
                      : GRID_COLORS.readonly,
                  }}
                />
              </span>
            );
          }
          return label;
        },
      },
      {
        // 計画金額
        headerName: '計画金額',
        field: 'catPlan',
        width: 120,
        editable: (params: any) =>
          isExpenseCellEditable(params.node?.rowIndex ?? -1, 'catPlan'),
        valueGetter: (params: any) => {
          // 固定上段（単位行）は生値をそのまま表示
          if (params.node?.rowPinned) return params.data.catPlan;
          if (params.data?.isParent && !params.data?.showAsValue) return '';
          const r = params.node?.rowIndex ?? -1;
          // ロケ運転費金額(7) は手入力で数式クリア済みなら生値
          if (r === 7 && !params.data?.catPlan_formula) {
            return params.data.catPlan;
          }
          const computed = computeCatPlanValues(params.api);
          if (r in computed) return computed[r];
          return params.data.catPlan;
        },
        valueSetter: (params: any) => {
          params.data.catPlan = params.newValue;
          // ロケ運転費(7)は入力後、数式を適用せず入力値を採用する。
          // 数式を undefined にすると valueGetter/computeCatPlanValues が
          // 生の入力値を使用する（後続の {...row, ...params.data} で上書き反映）。
          if ((params.node?.rowIndex ?? -1) === 7) {
            params.data.catPlan_formula = undefined;
          }
          return true;
        },
        valueFormatter: (params: any) => {
          if (params.data?.isParent && !params.data?.showAsValue) return '';
          const r = params.node?.rowIndex ?? -1;
          if (r === 6) {
            // 条件口率：計算値（数値）は小数第1位まで % 付きで表示
            return typeof params.value === 'number'
              ? formatDecimal1(params.value) + '%'
              : (params.value ?? '');
          }
          if (r === 8) {
            // ロケ運転費率（生値 "19%"）を小数第1位まで % 付きで表示
            const v = params.value;
            if (v == null || v === '' || v === '－') return v ?? '';
            const n = parseFloat(String(v).replace(/[,%]/g, ''));
            return isNaN(n) ? String(v) : formatDecimal1(n) + '%';
          }
          return formatExpenseNumber(params.value);
        },
        cellStyle: (params: any) => getExpenseCellStyle(params, 'right'),
        onCellValueChanged: (params: any) => {
          const newData = expensePlanDataRef.current.map((row, idx) =>
            idx === params.node.rowIndex ? { ...row, ...params.data } : row
          );
          setExpensePlanData(newData);
          recalculateExpensePlan();
        },
      },
      {
        headerName: '管理コード別',
        children: [
          branchCol('catHonsha', '10010\n本社'),
          branchCol('catShishaA', '10020\n支社A　自販機部門'),
          branchCol('catShishaBKyotsu', '10180\n支社B　自販機(共通)'),
          branchCol('catShishaBKaitaku', '10210\n支社B　開発(開拓)'),
        ],
      },
      {
        headerName: '前月',
        children: [
          plainCol('catZengetsuJisseki', '前月実績'),
          ratioCol('catZengetsuHi', '前月比'),
        ],
      },
      {
        headerName: '予算',
        children: [
          plainCol('catYosan', '予算'),
          ratioCol('catYosanHi', '予算比'),
        ],
      },
      {
        headerName: '前年同月',
        children: [
          plainCol('catZennenJisseki', '前年同月実績'),
          ratioCol('catZennenHi', '前年同月比'),
        ],
      },
    ];
  }, []);

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
  const formulaGuideActions = (
    <>
      {showFormulaGuide && (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded-sm border-2 border-solid border-blue-500" />
            選択セル
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded-sm border-2 border-solid border-green-500" />
            参照セル
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded-sm border-2 border-dashed border-orange-500" />
            影響セル
          </span>
        </div>
      )}
      {/* 右隣のボタン（自動更新）とは全角4文字分（text-sm 0.875rem ×4 ＝3.5rem）空ける。
          ヘッダーの gap-2（0.5rem）と mr-12（3rem）の合計で確保する。 */}
      {/* 数式ガイドの ON/OFF。切替は共通部品 Switch（shadcn）を使い、画面ごとに
          トグルの見た目を自作しない。つまみの左右＝形／配色／ON・OFF の文言の
          3つで状態を示す（→ 06 色以外の手がかり）。 */}
      <span className="mr-12 flex h-8 items-center gap-2">
        <Switch
          id="formula-guide"
          checked={showFormulaGuide}
          onCheckedChange={setShowFormulaGuide}
          className="h-5 w-9 data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
          aria-label="数式ガイドを切り替える"
        />
        <label
          htmlFor="formula-guide"
          className={`cursor-pointer text-sm font-medium whitespace-nowrap ${
            showFormulaGuide ? 'text-green-700' : 'text-gray-500'
          }`}
        >
          数式ガイド {showFormulaGuide ? 'ON' : 'OFF'}
        </label>
      </span>
    </>
  );

  return (
    <div
      className="min-w-[75rem]"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.ag-cell'))
          setFormulaTooltip(null);
      }}
    >
      {/* 浮遊数式ツールチップ（表示位置のみ動的値のため inline、他は Tailwind） */}
      {formulaTooltip && (
        <div
          className="fixed z-[9999] bg-gray-800 text-gray-50 text-xs py-1.5 px-2.5 rounded-md max-w-[22.5rem] shadow-lg pointer-events-none whitespace-pre-wrap leading-normal"
          style={{
            left: formulaTooltip.x,
            top: formulaTooltip.y - window.scrollY,
          }}
        >
          {formulaTooltip.text}
        </div>
      )}
      <div className="px-6 pt-3 pb-3">
        {/* 画面名はヘッダー（システム名の右）に表示する。右端に計画詳細(管理対象商品)への遷移ボタンを置く。
            数式ガイドの操作は販売計画・経費計画の各カードへ置く。 */}
        <ScreenTitle title="計画詳細" />
        <div className="px-3 py-1.5">
          <div className="flex items-center justify-end">
            {/* ボタンの体裁は各カードの自動更新ボタンと同じ共通クラスを使う */}
            <button className="btn-toolbar-outline">
              計画詳細(管理対象商品)
            </button>
          </div>
        </div>

        {/* 計画詳細セクション */}
        <CollapsibleCard
          title="基本情報"
          open={isOpen}
          onOpenChange={setIsOpen}
          className="mb-6"
        >
          {/* 項目・行構成・表示体裁を計画詳細(マージン率固定・NET入力)へ統一する。
              等幅5列グリッド（PlanBasicInfoRow）で各行の項目を縦に揃え、コードを持つ項目は
              同画面と同じ参照元から「コード:名称」で表示する。
              本画面固有の「販売計画No.」のみ、基準画面の空き列（2行目3列目）へ残す。
              計画書インポート／計画書エクスポート／見積書エクスポートは本画面では扱わないため、
              カードヘッダーのボタンは持たない。 */}
          <div className="p-4">
            {/* 1行目: 対象年月（月ストリップ）とステータス。
                月ストリップの必要幅から対象年月を col-span-4 とし、ステータスを5列目に
                固定することで、2行目以降の列位置と縦に揃う（基準画面と同一）。 */}
            <PlanBasicInfoRow>
              <div className="col-span-4 flex items-center gap-2">
                <label
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap ${PLAN_BASIC_INFO_LABEL_WIDTH} px-2 py-1 text-right`}
                >
                  対象年月
                </label>
                <div className="min-w-0">
                  <MonthStripPicker
                    value={targetYearMonth}
                    onChange={setTargetYearMonth}
                  />
                </div>
              </div>

              <PlanBasicInfoField
                label="ステータス"
                value={BASIC_INFO_STATUS}
                trailing={
                  // 5列表示では列幅が狭くなるため、2xl 未満はアイコンのみ表示にして
                  // 必要幅を縮める（読み上げ名は aria-label で維持）。
                  <button
                    type="button"
                    onClick={() => setCommentPanelOpen((v) => !v)}
                    className="flex items-center gap-1 bg-white text-blue-600 px-2 py-1 rounded-lg border-2 border-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors whitespace-nowrap text-xs"
                    aria-label="コメント履歴"
                  >
                    <History className="h-[0.875rem] w-[0.875rem]" />
                    <span className="hidden 2xl:inline">コメント履歴</span>
                  </button>
                }
              />
            </PlanBasicInfoRow>

            {/* 2行目: 本画面固有の販売計画No.。
                持たない項目（基準画面の「取引制度」「チャネル」）は列を空けず左へ詰める。 */}
            <PlanBasicInfoRow>
              <PlanBasicInfoField
                label="販売計画No."
                value={BASIC_INFO_SALES_PLAN_NO}
                labelWidthClass={BASIC_INFO_LABEL_WIDTH_WIDE}
              />
              <PlanBasicInfoSpacer />
              <PlanBasicInfoSpacer />
              <PlanBasicInfoSpacer />
              <PlanBasicInfoSpacer />
            </PlanBasicInfoRow>

            {/* 3行目: 事業場・部署・作成者。
                持たない項目（基準画面の「担当エリア」「三次店企業」）は列を空けず左へ詰める。 */}
            <PlanBasicInfoRow>
              <PlanBasicInfoField
                label="事業場"
                value={joinCodeName(
                  BASIC_INFO_OFFICE.code,
                  BASIC_INFO_OFFICE.name
                )}
              />
              <PlanBasicInfoField
                label="部署"
                value={joinCodeName(
                  BASIC_INFO_DEPARTMENT.code,
                  BASIC_INFO_DEPARTMENT.name
                )}
              />
              <PlanBasicInfoField
                label="作成者"
                value={joinCodeName(
                  BASIC_INFO_CREATOR.code,
                  BASIC_INFO_CREATOR.name
                )}
              />
              <PlanBasicInfoSpacer />
              <PlanBasicInfoSpacer />
            </PlanBasicInfoRow>

            {/* 4行目: 販売店・三次店・一次店（最終行のため下区切り罫線なし）。
                いずれも一意（1件）のため参照専用値として左から順に詰めて並べる。
                一次店のみ取引先名が1列幅に収まらないため2列分を占有させる。 */}
            <PlanBasicInfoRow divider={false}>
              <PlanBasicInfoField
                label="販売店"
                value={joinCodeName(
                  BASIC_INFO_DEALER.code,
                  BASIC_INFO_DEALER.name
                )}
              />
              <PlanBasicInfoField
                label="三次店"
                value={joinCodeName(
                  thirdStoreCode(BASIC_INFO_STORE_TIER.third),
                  BASIC_INFO_STORE_TIER.third
                )}
              />
              <PlanBasicInfoField
                label="一次店"
                value={joinCodeName(
                  firstStoreCode(BASIC_INFO_STORE_TIER.first),
                  BASIC_INFO_STORE_TIER.first
                )}
                colSpanClass={BASIC_INFO_FIRST_STORE_COL_SPAN}
              />
            </PlanBasicInfoRow>
          </div>
        </CollapsibleCard>

        {/* 販売計画(集計)：自販機専用版（a3ec0f8時点の集計コンポーネントを固定） */}
        <AggregationPane
          hideAggregationUnit={true}
          expansionCostLabel="拡売費集計対象選択"
        />

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
                <button className="btn-toolbar-outline">
                  販売計画自動更新
                </button>
                {/* 実数／差分表示トグル。左隣のボタン（自動更新）とは全角2文字分
                    （text-sm 0.875rem ×2 ＝1.75rem）空ける。ヘッダーの gap-2（0.5rem）と
                    ml-5（1.25rem）の合計で確保する。 */}
                <div className="ml-5 flex rounded-lg border-2 border-blue-600 overflow-hidden">
                  <button
                    onClick={() => setIsDiffMode(false)}
                    className={`px-3 py-1 text-sm whitespace-nowrap transition-colors ${
                      !isDiffMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    実数表示
                  </button>
                  <button
                    onClick={() => setIsDiffMode(true)}
                    className={`px-3 py-1 text-sm whitespace-nowrap transition-colors border-l-2 border-blue-600 ${
                      isDiffMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    差分表示
                  </button>
                </div>
              </>
            }
          >
            <div className="p-2">
              {/* 出荷稼働日・前年比・進捗率 入力/表示欄 */}
              <div className="flex items-center gap-10 mb-3 px-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold text-gray-700 whitespace-nowrap">
                    出荷稼働日
                  </label>
                  {shukkaWorkingDays.isInput ? (
                    <>
                      <input
                        type="number"
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
                        className="w-20 h-8 border border-gray-300 rounded px-2 text-sm text-right bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <span className="text-xs text-gray-500">日</span>
                    </>
                  ) : (
                    <>
                      <div
                        className="w-20 h-8 border border-gray-200 rounded px-2 text-sm text-right bg-gray-50 flex items-center justify-end font-bold cursor-pointer"
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
                    入力不可のため、編集不可セルと同じ配色で表示のみ行う。 */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold text-gray-700 whitespace-nowrap">
                    前年出荷稼働日
                  </label>
                  <div
                    className="w-20 h-8 rounded px-2 text-sm text-right flex items-center justify-end border border-gray-300 cursor-pointer"
                    onClick={onPrevYearShukkaWorkingDaysClick}
                    style={{
                      backgroundColor: GRID_COLORS.readonly,
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
                  <label className="text-sm font-bold text-gray-700 whitespace-nowrap">
                    出荷稼働日前年比
                  </label>
                  <div
                    className="w-20 h-8 rounded px-2 text-sm text-right flex items-center justify-end cursor-pointer border border-gray-300"
                    onClick={(e) =>
                      onHeaderValueClick(
                        e,
                        '数式: 出荷稼働日 ÷ 前年出荷稼働日',
                        shukkaYoyRefCells
                      )
                    }
                    style={{
                      // 数式で算出する表示専用の値のため、編集不可セルと同じ配色にする
                      // （hex 直書きを避け共通トークンを参照・→ 02 §10.1）。
                      backgroundColor: GRID_COLORS.readonly,
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
                  <label className="text-sm font-bold text-gray-700 whitespace-nowrap">
                    売上函数:当月進捗率
                  </label>
                  <div
                    className="w-20 h-8 rounded px-2 text-sm text-right flex items-center justify-end cursor-pointer border border-gray-300"
                    onClick={(e) =>
                      onHeaderValueClick(
                        e,
                        '数式: 商流販売店計の当月函数 ÷ 商流販売店計の合計函数',
                        ['0-col4', '0-col6']
                      )
                    }
                    style={{
                      // 出荷稼働日前年比と同じく編集不可セルの配色にする。
                      backgroundColor: GRID_COLORS.readonly,
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
                  /* カテゴリ列ヘッダーの左寄せ */
                  .sales-plan-grid .ag-header-cell-left .ag-header-cell-label { justify-content: flex-start !important; }
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
                    text-align: center;
                  }
                `}</style>
                <AgGridReact
                  {...salesPlanColumnStateProps}
                  // 共通基本プロパティ（Enter縦移動・Excelライク編集・テキスト選択・
                  // Undo/Redo・列仮想化抑止）。singleClickEdit を持たないため編集は
                  // ダブルクリック／F2／直接入力で開始（標準準拠。Enterは移動のみ）。
                  {...GRID_BASE_PROPS}
                  ref={gridRef}
                  rowData={salesPlanData}
                  columnDefs={salesPlanColumnDefsWithTooltips}
                  defaultColDef={salesPlanDefaultColDef}
                  // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                  columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                  pinnedTopRowData={unitRowData}
                  getRowId={getPlanRowId}
                  getRowStyle={getRowStyle}
                  suppressMovableColumns={true}
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
                <button className="btn-toolbar-outline">
                  経費計画自動更新
                </button>
                {/* 実数／差分表示トグル（販売計画と連動）。左隣のボタン（自動更新）とは
                    全角2文字分（text-sm 0.875rem ×2 ＝1.75rem）空ける。ヘッダーの
                    gap-2（0.5rem）と ml-5（1.25rem）の合計で確保する。 */}
                <div className="ml-5 flex rounded-lg border-2 border-blue-600 overflow-hidden">
                  <button
                    onClick={() => setIsDiffMode(false)}
                    className={`px-3 py-1 text-sm whitespace-nowrap transition-colors ${
                      !isDiffMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    実数表示
                  </button>
                  <button
                    onClick={() => setIsDiffMode(true)}
                    className={`px-3 py-1 text-sm whitespace-nowrap transition-colors border-l-2 border-blue-600 ${
                      isDiffMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    差分表示
                  </button>
                </div>
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
                  /* ── 経費計画固有ルール（転置後の行インデックス別インデント） ── */
                  /* 経費金額合計(0)・データ種の区切り行(1・15)・条件口(2)・
                     ロケ運転費(7)・親行表示のその他経費(9〜12・16〜18) は 0.5rem */
                  .expense-plan-grid .ag-row[row-index="0"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="1"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="2"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="7"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="9"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="10"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="11"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="12"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="15"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="16"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="17"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="18"] .ag-cell[col-id="category"] {
                    padding-left: 0.5rem !important;
                  }
                  /* 子項目（条件口・ロケ運転費・前払い金(償却)の配下：
                     3,4,5,6,8,13,14）は 1.5rem */
                  .expense-plan-grid .ag-row[row-index="3"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="4"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="5"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="6"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="8"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="13"] .ag-cell[col-id="category"],
                  .expense-plan-grid .ag-row[row-index="14"] .ag-cell[col-id="category"] {
                    padding-left: 1.5rem !important;
                  }
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
                    text-align: center;
                  }
                `}</style>
                <AgGridReact
                  {...expensePlanColumnStateProps}
                  // 共通基本プロパティ（Enter縦移動・Excelライク編集・テキスト選択・
                  // Undo/Redo・列仮想化抑止）。singleClickEdit を持たないため編集は
                  // ダブルクリック／F2／直接入力で開始（標準準拠。Enterは移動のみ）。
                  {...GRID_BASE_PROPS}
                  ref={expenseGridRef}
                  rowData={expensePlanData}
                  columnDefs={expensePlanColumnDefsWithTooltips}
                  defaultColDef={expensePlanDefaultColDef}
                  // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                  columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                  pinnedTopRowData={expenseUnitRowData}
                  getRowId={getPlanRowId}
                  suppressMovableColumns={true}
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

      {/* 固定フッター - ボタン。
          主要アクションは shadcn Button ではなくネイティブ button ＋ globals.css の
          共通クラス（btn-action-base ＋ 配色クラス）で組む。高さ・角丸・フォーカス
          リング・アイコンとの余白（gap）はクラス側が持つため直書きしない
          （→ 02 §6・§6「共通スタイルクラスを優先使用」）。
          配色は 取消/差戻し=赤・承認/引戻し/申請=緑・保存=青・戻る=アウトライン
          （支払詳細(自販機)のフッターと同一）。 */}
      <div className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10">
        <div className="flex flex-wrap gap-3 justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-action-base btn-action-outline"
              onClick={() => setShowBackConfirm(true)}
              aria-label="一覧へ戻る"
            >
              <Undo2 className="h-4 w-4" />
              一覧へ戻る
            </button>
          </div>
          {/* コメント欄は伸縮させず、ボタン群とともに右詰めにする（支払詳細(自販機)と同一）。 */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <label
                htmlFor="approval-comment"
                className="text-sm text-gray-600 whitespace-nowrap"
              >
                コメント
              </label>
              <textarea
                id="approval-comment"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="コメントを入力（差戻し理由など）"
                rows={2}
                className="h-10 w-[24rem] min-w-[10rem] max-w-[32rem] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
              />
            </div>
            <button
              className="btn-action-base btn-action-red"
              aria-label="差戻し"
            >
              <CornerUpLeft className="h-4 w-4" />
              差戻し
            </button>
            <button
              className="btn-action-base btn-action-green"
              aria-label="承認"
            >
              <Check className="h-4 w-4" />
              承認
            </button>
            <button
              className="btn-action-base btn-action-outline-blue"
              aria-label="引戻し"
            >
              <CornerUpLeft className="h-4 w-4" />
              引戻し
            </button>
            <button
              className="btn-action-base btn-action-green"
              aria-label="申請"
            >
              <Send className="h-4 w-4" />
              申請
            </button>
            <button
              className="btn-action-base btn-action-blue"
              aria-label="保存"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
      </div>

      {/* コメント履歴右ペイン（共通 RightPane：販売計画表(商流紐づけなし)と同一スタイル） */}
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-gray-900">{item.action}</span>
                <span className="text-sm text-gray-600">{item.date}</span>
                <span className="text-sm text-gray-900">{item.user}</span>
                {/* 操作の後の計画ステータス。支払詳細のコメント履歴と同一体裁。 */}
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
      </RightPane>

      {/* 戻る（画面移動）の確認: 入力中データの破棄を確認する */}
      <ConfirmDialog
        open={showBackConfirm}
        title="画面移動の確認"
        confirmLabel="移動"
        description="入力中のデータが破棄されます。本当によろしいですか？"
        onConfirm={() => {
          setShowBackConfirm(false);
          onMenuChange?.('plan-list');
        }}
        onCancel={() => setShowBackConfirm(false)}
      />
    </div>
  );
}

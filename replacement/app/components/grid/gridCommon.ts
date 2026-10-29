import type {
  ColDef,
  ColGroupDef,
  ValueFormatterParams,
  TabToNextCellParams,
  CellPosition,
  CellEditingStoppedEvent,
  CellKeyDownEvent,
  FullWidthCellKeyDownEvent,
  GridApi,
  Column,
  SuppressKeyboardEventParams,
  GetContextMenuItemsParams,
  MenuItemDef,
  DataTypeDefinitions,
  FilterOpenedEvent,
} from 'ag-grid-community';
import { themeBalham } from 'ag-grid-community';
import { toast } from 'sonner';
import {
  GridDisplayedRowsStatusPanel,
  YearMonthFilterInput,
} from './gridComponents';
import { GRID_COLORS } from '../../../styles/gridStyles';
import { AG_GRID_LOCALE_JA } from './gridLocale';
import { exportGridAllRows } from './gridExportAll';
import { EditableComboboxCellEditor } from '../ui/editable-combobox-cell-editor';
import { SingleComboboxCellEditor } from '../ui/single-combobox-cell-editor';

// ── グリッド共通テーマ（全画面共通）───────────────────────────────
// 高さ・余白・フォント・背景をテーマ側に集約し、各画面のグリッドで共有する。
// App.tsx の provideGlobalGridOptions に theme として登録しているため、
// グリッド側で theme= を指定しない場合はこのテーマが自動適用される。
// 公式 Theming API（props の headerHeight/rowHeight は指定せずここで一元管理）。
export const GRID_THEME = themeBalham.withParams({
  headerHeight: '1.75rem', // ヘッダー高さ 28px
  rowHeight: '2.25rem', // 明細行高さ 36px（行内ボタン2remを全表示できる高さ）
  spacing: '0.25rem', // セル内余白を圧縮（4px）
  fontSize: '0.875rem', // 14px（text-sm を維持）
  fontFamily: '"メイリオ", "Meiryo", sans-serif', // 全グリッド共通フォント（デザイントークン準拠）
  oddRowBackgroundColor: GRID_COLORS.background, // 明細の背景を全て白（奇数行の縞模様を無効化）
  backgroundColor: GRID_COLORS.background, // グリッド背景も白
  rowHoverColor: GRID_COLORS.rowHover, // 行ホバー色（gridStyles に集約）
  // 罫線（全グリッド共通）。セル結合（rowSpan）時も列区切りを明示できるよう
  // 縦罫線（columnBorder）を有効化し、罫線色を薄いグレーに統一する。
  borderColor: GRID_COLORS.gridLine,
  columnBorder: true, // 列間の縦罫線
  rowBorder: true, // 行間の横罫線
});

// ── フィルターUIを右クリックのコンテキストメニューに集約（全グリッド共通）──
// 使い方（必ず以下2点をセットで使用する）:
//   1) defaultColDef に GRID_FILTER_COLDEF を spread する（GRID_DEFAULT_COL_DEF が内包）。
//   2) <AgGridReact getContextMenuItems={gridFilterContextMenuItems} /> を指定する。
// これにより、ヘッダーのフィルター／列メニューボタンは非表示になり、
// フィルターは「セル右クリック → フィルター」から開く（いずれもAG Grid公式API）。
// ── 列フィルタの種類（画面設計標準 4.3。1列につき1種類）────────────────
// 列の値の型（cellDataType。未指定は AG Grid が先頭行の値から推定）でフィルタを決める。
//   ・数値（金額・数量・率）              … 数値フィルタ（範囲・以上／以下）
//   ・日付（Date／YYYY-MM-DD／YYYY/MM/DD） … 日付フィルタ
//   ・文字（区分・ステータス・コード等）   … 選択式（Enterprise の既定 agSetColumnFilter）
//   ・候補が1,000件を超えうる名称の列      … 列定義に ...GRID_TEXT_FILTER を指定する
// 公式の dataTypeDefinitions の columnTypes で型ごとの列タイプを当てる（App.tsx でグローバル登録）。
// 列タイプは defaultColDef より優先されるため、defaultColDef で filter: false にしたグリッドは
// GRID_NO_FILTER_COLUMN_TYPES を columnTypes に渡して、型によるフィルタの追加を止める。
// 数値フィルタ。型の推定を止めた数値の列などで、列定義に ...GRID_NUMBER_FILTER と書く
// （入力欄の×は全グリッド共通で付く → attachFilterInputClearButtons）
export const GRID_NUMBER_FILTER: Pick<ColDef, 'filter'> = {
  filter: 'agNumberColumnFilter',
};

// テキストフィルタ。候補が1,000件を超えうる名称の列で、列定義に ...GRID_TEXT_FILTER と書く
export const GRID_TEXT_FILTER: Pick<ColDef, 'filter'> = {
  filter: 'agTextColumnFilter',
};

// ── 数値・テキストフィルタの入力欄の×（クリア）─────────────────────────
// 年月フィルタ（GRID_MONTH_TEXT_FILTER）と同じく、入力欄の右端に×を出して押すと値を空にする。
// AG Grid 標準の入力欄には×を出す設定が無いため、フィルタを開いた時の公式イベント filterOpened で
// 入力欄（.ag-filter-filter）に×ボタンを添える。値を空にした後は input イベントを送り、
// 絞り込みの反映は AG Grid 標準の入力処理に任せる。×の表示・非表示は CSS（:placeholder-shown）で
// 値の有無に合わせる（grid.css .grid-filter-input-clear）。日付・選択式フィルタの入力欄には付けない。
const FILTER_INPUT_SELECTOR = '.ag-filter-filter input.ag-input-field-input';
const FILTER_INPUT_CLEAR_CLASS = 'grid-filter-input-clear';
// lucide-react の X と同じ形
const X_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
const observedFilterRoots = new WeakSet<HTMLElement>();

const addInputClearButton = (input: HTMLInputElement) => {
  const wrapper = input.parentElement;
  if (!wrapper || wrapper.querySelector(`.${FILTER_INPUT_CLEAR_CLASS}`)) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = FILTER_INPUT_CLEAR_CLASS;
  button.setAttribute('aria-label', '入力をクリア');
  button.innerHTML = X_ICON_SVG;
  // 入力欄からフォーカスを奪わない（年月部品の×と同じ）
  button.addEventListener('mousedown', (e) => e.preventDefault());
  button.addEventListener('click', () => {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  wrapper.appendChild(button);
};

export function attachFilterInputClearButtons(event: FilterOpenedEvent) {
  const root = event.eGui;
  const scan = () =>
    root
      .querySelectorAll<HTMLInputElement>(FILTER_INPUT_SELECTOR)
      .forEach(addInputClearButton);
  scan();
  // 条件の追加（2つ目の条件・範囲内の2つ目の欄）で増える入力欄にも付ける
  if (!observedFilterRoots.has(root)) {
    observedFilterRoots.add(root);
    new MutationObserver(scan).observe(root, {
      childList: true,
      subtree: true,
    });
  }
}

export const GRID_COLUMN_TYPES: Record<string, ColDef> = {
  gridNumberFilter: GRID_NUMBER_FILTER,
  gridDateFilter: { filter: 'agDateColumnFilter' },
};

// フィルタを持たないグリッド（defaultColDef で filter: false）用。型による列タイプを空にする
export const GRID_NO_FILTER_COLUMN_TYPES: Record<string, ColDef> = {
  gridNumberFilter: {},
  gridDateFilter: {},
};

// YYYY/MM/DD の文字列（画面の日付の持ち方）
const SLASH_DATE_PATTERN = /^(\d{4})\/(\d{2})\/(\d{2})$/;
const toSlashDate = (date: Date) =>
  `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

export const GRID_DATA_TYPE_DEFINITIONS: DataTypeDefinitions = {
  number: {
    baseDataType: 'number',
    extendsDataType: 'number',
    columnTypes: 'gridNumberFilter',
  },
  date: {
    baseDataType: 'date',
    extendsDataType: 'date',
    columnTypes: 'gridDateFilter',
  },
  dateString: {
    baseDataType: 'dateString',
    extendsDataType: 'dateString',
    columnTypes: 'gridDateFilter',
  },
  // YYYY/MM/DD の文字列を日付として扱う（推定で日付の列と判定させる）
  slashDateString: {
    baseDataType: 'dateString',
    extendsDataType: 'dateString',
    columnTypes: 'gridDateFilter',
    dataTypeMatcher: (value: unknown) =>
      typeof value === 'string' && SLASH_DATE_PATTERN.test(value),
    dateParser: (value: string | undefined) => {
      const m = value ? SLASH_DATE_PATTERN.exec(value) : null;
      return m
        ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
        : undefined;
    },
    dateFormatter: (value: Date | undefined) =>
      value ? toSlashDate(value) : undefined,
  },
};

// 値を文字列で持つ数値の列（"1,234"・"12.5%"・"800" 等）用の数値フィルタ。
// 数値フィルタは数値を前提にするため、絞り込みのときだけ文字列を数値へ変換する（表示・編集の値は変えない）。
// cellDataType: false や文字列の値で型が数値と判定されない列に付ける（列定義で ...GRID_NUMBER_TEXT_FILTER）。
export const parseNumberText = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  // 先頭の▲・△はマイナスとして扱う（例：「▲120」＝-120）
  const text = value
    .replace(/[,¥￥%％\s]|千円|円|函|件/g, '')
    .replace(/^[▲△]/, '-');
  if (text === '' || text === '-' || text === '－') return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
};
export const GRID_NUMBER_TEXT_FILTER: Pick<
  ColDef,
  'filter' | 'filterValueGetter'
> = {
  ...GRID_NUMBER_FILTER,
  filterValueGetter: (params) =>
    parseNumberText(params.getValue(params.column.getColId())),
};

// 値を文字列で持つ年月・日付の列（"2026/02"・"202510"・"2026/02/15"・"2026/02/15 10:30" 等）用の日付フィルタ。
// 年月は月初の日付として絞り込む（表示・編集の値は変えない）。
export const parseDateText = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return null;
  // 時刻付き（"2026/02/15 10:30" 等）は日付の部分で絞り込む
  const m =
    /^(\d{4})[/-]?(\d{1,2})(?:[/-](\d{1,2}))?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(
      value.trim()
    );
  return m
    ? new Date(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1)
    : null;
};
export const GRID_DATE_TEXT_FILTER: Pick<
  ColDef,
  'filter' | 'filterValueGetter'
> = {
  filter: 'agDateColumnFilter',
  filterValueGetter: (params) =>
    parseDateText(params.getValue(params.column.getColId())),
};

// 年月の列（"2026/02"・"202510" 等。日を持たない）用の日付フィルタ。
// 入力欄を共通の年月部品（YearMonthFilterInput）に差し替え、年と月だけを選ばせる（×でクリア）。
// 公式の colDef.dateComponent を使う。日付・日時の列は GRID_DATE_TEXT_FILTER を使う。
export const GRID_MONTH_TEXT_FILTER: Pick<
  ColDef,
  'filter' | 'filterValueGetter' | 'dateComponent'
> = {
  ...GRID_DATE_TEXT_FILTER,
  dateComponent: YearMonthFilterInput,
};

export const GRID_FILTER_COLDEF: Pick<
  ColDef,
  'suppressHeaderMenuButton' | 'suppressHeaderFilterButton'
> = {
  // ヘッダーの列メニュー（ハンバーガー）ボタンを非表示（列固定等は右クリックで開ける）
  suppressHeaderMenuButton: true,
  // ヘッダーのフィルター（じょうご）ボタンを非表示（フィルターは右クリックで開く）
  suppressHeaderFilterButton: true,
};

// 標準の「エクスポート」サブメニュー（'csvExport'／'excelExport' に展開される）を、
// 全件エクスポートに差し替えたサブメニューへ置き換える（→ gridExportAll）。
// 標準のエクスポートは無限スクロール時に読み込み済みの行しか出力できないため、
// 全画面共通で「画面の絞り込み・並び替えを反映した全件」を出す実装に統一する。
function exportAllSubMenu(params: GetContextMenuItemsParams): MenuItemDef {
  const runExport = (format: 'csv' | 'excel') => {
    void exportGridAllRows(params.api, params.context, format).catch(() =>
      toast.error('エクスポートに失敗しました')
    );
  };
  return {
    name: AG_GRID_LOCALE_JA.export,
    icon: '<span class="ag-icon ag-icon-save"></span>',
    subMenu: [
      {
        name: AG_GRID_LOCALE_JA.csvExport,
        icon: '<span class="ag-icon ag-icon-csv"></span>',
        action: () => runExport('csv'),
      },
      {
        name: AG_GRID_LOCALE_JA.excelExport,
        icon: '<span class="ag-icon ag-icon-excel"></span>',
        action: () => runExport('excel'),
      },
    ],
  };
}

// コンテキストメニュー先頭に「フィルタ」を追加する共通 getContextMenuItems。
// フィルター可能な列でのみ表示し、対象列のフィルターを開く（公式 api.showColumnFilter）。
// ラベルは共通日本語ロケール（gridLocale.ts）の表記に合わせ「フィルタ」とする。
// あわせて標準の「エクスポート」を全件エクスポートへ差し替える（全画面共通仕様）。
export function gridFilterContextMenuItems(
  params: GetContextMenuItemsParams
): (string | MenuItemDef)[] {
  const defaultItems = (params.defaultItems ?? []) as (string | MenuItemDef)[];
  // 標準項目 'export' を全件エクスポート版に差し替える。
  // 切り取り・貼り付けはセルを編集できるグリッド（シングル画面）だけに出す（画面設計標準 4.1）。
  // 参照専用のグリッド（コレクション画面の一覧等）では値を変えられないため出さない。
  const editable = hasEditableColumn(params.api);
  const items = defaultItems
    .filter((item) => editable || (item !== 'cut' && item !== 'paste'))
    .map((item) => (item === 'export' ? exportAllSubMenu(params) : item));
  const colId = params.column?.getColId();
  // フィルター不可の列（操作列など filter:false）ではフィルタ項目を出さない
  if (!colId || !params.column?.isFilterAllowed()) {
    return items;
  }
  const filterItem: MenuItemDef = {
    name: 'フィルタ',
    icon: '<span class="ag-icon ag-icon-filter"></span>',
    action: () => params.api.showColumnFilter(colId),
  };
  return [filterItem, ...items];
}

// ポップアップ型コンボ（SingleComboboxCellEditor／EditableComboboxCellEditor）編集中の Enter／↑／↓ を
// AG Grid の既定処理から抑止し、エディタ自身に委ねる共通ヘルパー。
// ※AG Grid は編集中の Enter を先取りして stopEditing（＝エディタの現在値＝元の値で確定）する。
//   これを抑止しないと、キーボードでハイライトした候補が確定されず「Enterで選んでも値が変わらない」
//   事象になる（マウスクリック選択は競合しないため正常）。↑／↓ も候補移動をエディタに委ねる。
export const suppressEditNavKeys = (
  params: SuppressKeyboardEventParams
): boolean =>
  !!params.editing &&
  ['Enter', 'ArrowUp', 'ArrowDown'].includes(params.event.key);

// 空白セルのプレースホルダ（画面設計標準）。
// 値が無い（null / undefined / 空文字）データセルには、ハイフン「-」を表示する。
export const GRID_EMPTY_TEXT = '-';

// 空白セルを「-」に整形する共通 valueFormatter（画面設計標準 3.11・4.2 ⑥）。
// GRID_DEFAULT_COL_DEF に組み込み済み（列で独自の valueFormatter を持つ列は、その中で GRID_EMPTY_TEXT を返す）。
// ・ヘッダー行（_isHeader）はラベル等の特殊行のため対象外（従来表示を維持）。
// ・値があるセルはそのまま文字列表示する（数値の桁区切り等は列側の valueFormatter が優先）。
// 値が無いセルか（null・undefined・空文字・画面の「-」「－」）。ヘッダー行（_isHeader）は対象外
export function isEmptyCellValue(params: {
  value?: unknown;
  data?: any;
}): boolean {
  if (params.data?._isHeader) return false;
  const value = params.value;
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && ['', '-', '－'].includes(value.trim()))
  );
}

export function formatEmptyAsDash(params: ValueFormatterParams): string {
  if (params.data?._isHeader) return '';
  // 全角「－」で持つ値も半角「-」にそろえる
  if (isEmptyCellValue(params)) return GRID_EMPTY_TEXT;
  return String(params.value);
}

// 各グリッドで重複していた共通設定を集約するモジュール（全グリッド共通）。
// テーマ／ロケール／列状態は別ファイル、本ファイルは defaultColDef・statusBar・
// 基本プロパティ・ヘッダーtooltip付与の定型を提供する。

// defaultColDef の共通基本形。画面独自の指定がある場合は
// `{ ...GRID_DEFAULT_COL_DEF, /* 画面独自 */ }` で上書きする。
// ※ ヘッダーのフィルター／列メニューボタンは非表示（GRID_FILTER_COLDEF を内包）。
//   フィルターを使うグリッドは <AgGridReact getContextMenuItems={gridFilterContextMenuItems} />
//   をセットで指定し、セル右クリックからフィルターを開けるようにすること。
export const GRID_DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  resizable: true,
  filter: true,
  // 列のドラッグ入れ替えを許可（並び順は useGridColumnState で保存／復元）
  suppressMovable: false,
  // ヘッダーの列メニュー／フィルターボタンを非表示（フィルターは右クリックで開く）
  ...GRID_FILTER_COLDEF,
  // 列幅で省略表示された値を、マウスオーバーで全文表示（AG Grid公式tooltip）。
  // 省略されていないときは出さない（グローバルの tooltipShowMode: 'whenTruncated'。画面設計標準 4.2 ⑥）
  tooltipValueGetter: (params) => params.value ?? '',
  // 数値エディタ（agNumberCellEditor）で ↑↓ キーによる値の増減を止める（画面設計標準 4.6。
  // ホイールは installNumberInputWheelGuard で止める）。列で cellEditorParams を書いても残る（オブジェクトは統合される）
  cellEditorParams: { preventStepping: true },
  // コンボ（SingleComboboxCellEditor／EditableComboboxCellEditor）編集中の
  // キーボード確定を有効化する。
  // 対象列（cellEditor が一致する編集中セル）のみ Enter／↑／↓ を抑止し、
  // 他エディタ・非編集セルは AG Grid の既定動作のまま（＝影響なし）。
  // 列側で独自の suppressKeyboardEvent を持つ列（例: ComboCellEditor 系）はそちらが優先される。
  suppressKeyboardEvent: (params) =>
    (params.colDef?.cellEditor === SingleComboboxCellEditor ||
      params.colDef?.cellEditor === EditableComboboxCellEditor) &&
    suppressEditNavKeys(params),
  // 編集で値が変わったセルを黄色ハイライト（→ 02 §7.2）。色は grid.css の
  // `.ag-cell.ag-cell-changed`。変更判定は各グリッドの context.isCellChanged（useChangedCells）。
  // 読取専用グリッドは isCellChanged 未設定のため常に false（＝副作用なし）。
  // ※画面独自に defaultColDef.cellClassRules を指定する場合は、本ルールをマージすること。
  cellClassRules: {
    'ag-cell-changed': (p: any) => !!p.context?.isCellChanged?.(p),
    // 値が無いセルの「-」をグレーにする（画面設計標準 3.11・4.2 ⑥。色は grid.css .ag-cell.cell-empty）
    'cell-empty': (p: any) => isEmptyCellValue(p),
  },
  // 値が無いセルはグレーの半角「-」を表示する（列で独自の valueFormatter を持つ列はそちらが優先）
  valueFormatter: formatEmptyAsDash,
};

// ── 明細グリッドの既定の縦幅（画面をまたいで統一）─────────────────
// 基準は 支払詳細(自販機) の「支払明細情報」カード本体の高さ。
//   既定＝「画面高 － 上部の固定領域(8.75rem)」の 3/4、下限＝18.75rem。
// 画面高から算出するため、画面サイズが変わっても同じ見え方（比率）を保てる。
// ※支払詳細(自販機) は画面固有の定数で同じ値を持つ（当該画面のリサイズ処理と一体のため）。
//   本定数を変更する場合は、そちらの DETAIL_CARD_* も合わせること。
export const DETAIL_GRID_HEIGHT_OFFSET_REM = 8.75;
export const DETAIL_GRID_HEIGHT_RATIO = 0.75;
export const DETAIL_GRID_MIN_HEIGHT_REM = 18.75;

// 上記の既定高さ（px）。inline style の height へ渡す JS 動的計算値として使う。
export const detailGridInitialHeight = (): number =>
  Math.max(
    DETAIL_GRID_MIN_HEIGHT_REM * 16,
    (window.innerHeight - DETAIL_GRID_HEIGHT_OFFSET_REM * 16) *
      DETAIL_GRID_HEIGHT_RATIO
  );

// 上記の既定高さ（CSS）。リサイズハンドルを持たず、CSS だけで高さを決めるグリッド用。
export const DETAIL_GRID_HEIGHT_CSS = `max(${DETAIL_GRID_MIN_HEIGHT_REM}rem, (100vh - ${DETAIL_GRID_HEIGHT_OFFSET_REM}rem) * ${DETAIL_GRID_HEIGHT_RATIO})`;

// 行の展開（masterDetail＝アコーディオン）の開閉アイコン。折り畳みカード（CollapsibleCard）と同じく
// 閉じている時は下向き（∨）、開いている時は上向き（∧）にする（AG Grid 既定の ▶／▼ を差し替え）。
// グリッドの icons に渡す。集計ツリー（treeData）の開閉は階層の表示のため対象外（既定の ▶／▼ のまま）。
export const GRID_MASTER_DETAIL_ICONS = {
  groupContracted:
    '<span class="ag-icon ag-icon-chevron-down" unselectable="on" role="presentation"></span>',
  groupExpanded:
    '<span class="ag-icon ag-icon-chevron-up" unselectable="on" role="presentation"></span>',
};

// 件数表示パネル（左下）の共通 statusBar 設定。
// 「表示中：○-○件 / 全○件」と、行選択のあるグリッドでは「選択中：○件」を表示する（GridDisplayedRowsStatusPanel）。
export const GRID_STATUS_BAR = {
  statusPanels: [
    {
      statusPanel: GridDisplayedRowsStatusPanel,
      align: 'left' as const,
    },
  ],
};

// グリッドの端で Tab した時に、フォーカスをグリッド外（Tab方向の次／前のフォーカス可能要素）へ移す。
// AG Grid の tabToNextCell は null を返してもセルに留まるため（グリッド外へは抜けない）、
// DOM上のフォーカス可能要素を自前で探して移動させる（＝グリッド直後のフッタ等へ抜けられるようにする）。
function focusOutsideGrid(backwards: boolean): void {
  const active = document.activeElement as HTMLElement | null;
  const gridRoot = active?.closest('.ag-root-wrapper') as HTMLElement | null;
  if (!gridRoot) return;

  // ドキュメント内の表示中フォーカス可能要素（グリッド内は除外）。querySelectorAll はDOM順で返す。
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const outside = Array.from(
    document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => el.offsetParent !== null && !gridRoot.contains(el));

  // グリッドの前後（DOM順）で、移動方向に最も近い要素へフォーカスする。
  const target = backwards
    ? outside
        .filter(
          (el) =>
            gridRoot.compareDocumentPosition(el) &
            Node.DOCUMENT_POSITION_PRECEDING
        )
        .at(-1)
    : outside.find(
        (el) =>
          gridRoot.compareDocumentPosition(el) &
          Node.DOCUMENT_POSITION_FOLLOWING
      );
  target?.focus();
}

// 編集可能列を1つでも持つグリッドか（＝参照専用グリッドでないか）を判定する。
// 参照専用グリッドでは「活性セルのみへ移動」の補正を行わず、AG Grid の既定動作に委ねる。
function hasEditableColumn(api: GridApi): boolean {
  return api.getAllDisplayedColumns().some((c) => !!c.getColDef().editable);
}

// Tab／Shift+Tab を「活性（編集可能）セルのみ」へ移動する共通コールバック（移動のみ＝編集は開始しない）。
// ・公式コールバック tabToNextCell を使用。既定の移動先から Tab 方向（backwards で逆）へ走査し、
//   最初の編集可能セルを返す（行末／行頭で行送り）。
// ・移動先は選択状態に留める。編集開始は F2／直接入力／ダブルクリック（AG Grid標準）に委ねる。
//   Excel と同じ「Tabは選択移動・編集は明示操作」の操作体系に揃えるため（Enterも同方針＝移動のみ）。
// ・編集可否は公式 column.isCellEditable(rowNode) で判定（editable の boolean／関数いずれも対応、
//   非編集行（ヘッダー行等）も自動でスキップ）。
// ・グリッドの端（これ以上編集可能セルが無い）に達したら、セルに留めずグリッド外（フッタ等）へ
//   フォーカスを抜けさせる（focusOutsideGrid）。これによりTabがグリッド内に閉じ込められない。
function tabToNextEditableCell(
  params: TabToNextCellParams
): CellPosition | null {
  const { nextCellPosition, backwards, api } = params;

  // nextCellPosition が無い＝グリッドの端（次/前にセルが無い）。グリッド外へ抜ける。
  if (!nextCellPosition) {
    api.stopEditing();
    setTimeout(() => focusOutsideGrid(!!backwards), 0);
    return null;
  }

  const cols = api.getAllDisplayedColumns();
  const rowCount = api.getDisplayedRowCount();
  if (cols.length === 0 || rowCount === 0) return nextCellPosition;

  // 編集可能セルを持たない参照専用グリッドは、既定のセル移動（全セルを順に巡回）に
  // フォールバックする（端では上の !nextCellPosition 分岐でグリッド外へ抜ける）。
  if (!hasEditableColumn(api)) return nextCellPosition;

  const step = backwards ? -1 : 1;
  let colIdx = cols.findIndex(
    (c) => c.getColId() === nextCellPosition.column.getColId()
  );
  let rowIdx = nextCellPosition.rowIndex;

  for (let guard = 0; guard < cols.length * rowCount; guard++) {
    const col = cols[colIdx];
    const rowNode = api.getDisplayedRowAtIndex(rowIdx);
    if (col && rowNode && col.isCellEditable(rowNode)) {
      // 移動のみ（移動先の編集開始はしない）。編集は F2／直接入力／ダブルクリックで開始する。
      return { rowIndex: rowIdx, column: col, rowPinned: null };
    }
    colIdx += step;
    if (colIdx >= cols.length) {
      colIdx = 0;
      rowIdx += 1;
    } else if (colIdx < 0) {
      colIdx = cols.length - 1;
      rowIdx -= 1;
    }
    if (rowIdx < 0 || rowIdx >= rowCount) break; // 端に達したら走査終了
  }
  // 走査しても編集可能セルが無い → セルに留めずグリッド外（フッタ等）へ抜ける。
  api.stopEditing();
  setTimeout(() => focusOutsideGrid(!!backwards), 0);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Enterの「下の“活性”セルへ移動」を全グリッド共通で担保する仕組み（2系統）。
//
// (1) 選択セル（非編集）の Enter ＝ 移動のみ（編集は開始しない）。
//   公式 enterNavigatesVertically: true が真下（Shift+Enterは真上）へ移動する。ただし移動先の
//   編集可否を見ない（AG Grid の移動可否判定は行ノードの有無のみ）ため非活性セルにも着地する。
//   さらにこの縦移動は内部で navigateToNextCell を allowUserOverride=false で呼ぶため、
//   公式コールバック navigateToNextCell では補正できない。
//   → 公式の移動後に発火する onCellKeyDown（AG Grid はキー処理の後に本イベントを dispatch）で
//     着地先を判定し、非活性なら同方向の最初の活性セルへ寄せる（handleGridCellKeyDown）。
//
// (2) 編集中の Enter（確定）＝ 確定して下の活性セルへ移動。
//   テキスト系エディタ（agTextCellEditor 等）は Enter がグリッドへ届くため公式
//   enterNavigatesVerticallyAfterEdit で真下のセルへ移動する。一方、select系（agSelectCellEditor）や
//   自作 combo系（SingleCombobox の popup）は Enter をエディタ内部で消費し stopEditing() を
//   自前で呼ぶため、公式プロパティ（キーボードイベント時のみ発火）が働かず移動しない。
//   さらに公式の移動は「真下のセル」に着地し、非活性（編集不可）セルもスキップしない。
//   → エディタ種別に依存せず、onCellEditingStopped で「編集した列の“次の活性セル”」を
//     公式 API で算出して setFocusedCell する（handleGridCellEditingStopped）。
//
// 共通方針：Tab の tabToNextEditableCell と同じ「活性のみ」に揃える。
//   ・非活性（編集不可）行はスキップして、移動方向で最初に編集可能なセルへ移動する。
//   ・移動方向に活性セルが無い場合は元のセルに留める（非活性セルへは着地させない）。
//   ・移動先が既にフォーカス済み（公式が正しい活性セルへ動かした後）の場合は何もしない＝二重移動しない。
//   ・参照専用グリッド（編集可能列が無い）は補正せず公式の移動に委ねる（hasEditableColumn）。
// ・直近キーは document のキャプチャ段階で拾う（select が Enter を消費しても検知できる）。
// ・編集開始時に直近キーをリセットし、開始Enterを確定と誤検知しない。
// ・移動のみ（移動先の編集開始はしない）。マウス選択（Enter以外）では移動しない。

// 直近に押下されたキー。GRID_BASE_PROPS を使う全グリッドで共有する。
let lastKeyDownKey: string | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      lastKeyDownKey = e.key;
    },
    true // キャプチャ段階：エディタがイベントを止めても拾える
  );
}

// 指定行から指定方向（step: 1=下／-1=上）へ走査し、当該列が編集可能（活性）な最初の
// 表示行インデックスを返す（無ければ null）。
// 編集可否は公式 column.isCellEditable(rowNode) で判定（editable の boolean／関数いずれも対応）。
function firstEditableRowInDirection(
  api: GridApi,
  fromRowIndex: number,
  column: Column,
  step: 1 | -1
): number | null {
  const rowCount = api.getDisplayedRowCount();
  for (let r = fromRowIndex + step; r >= 0 && r < rowCount; r += step) {
    const rowNode = api.getDisplayedRowAtIndex(r);
    if (rowNode && column.isCellEditable(rowNode)) return r;
  }
  return null;
}

// 選択セル（非編集）のEnter縦移動を「活性セルのみ」へ補正する（→ 上記(1)）。
// 公式の移動が済んだ後に発火する cellKeyDown で着地先を判定するため、公式の移動結果をそのまま活かせる。
// ※編集確定のEnterでも本イベントは発火するが、その場合は handleGridCellEditingStopped の補完が
//   先に走って活性セルへ着地済みのため、下の「既に活性なら何もしない」判定で対象外になる（二重移動しない）。
const handleGridCellKeyDown = (
  e: CellKeyDownEvent | FullWidthCellKeyDownEvent
): void => {
  const event = e.event as KeyboardEvent | null | undefined;
  // Enter以外・フル幅行（column を持たない＝着地させるセルが無い）は対象外。
  if (!event || event.key !== 'Enter' || !('column' in e)) return;
  const { api, rowIndex: fromRowIndex } = e;
  // 参照専用グリッドは公式の移動に委ねる（Tab の tabToNextEditableCell と同方針）。
  if (!hasEditableColumn(api)) return;
  const step: 1 | -1 = event.shiftKey ? -1 : 1; // Shift+Enter は上方向
  // 公式の縦移動（および確定Enterの補完）が済んだ後のフォーカス位置で判定する。
  setTimeout(() => {
    const focused = api.getFocusedCell();
    if (!focused) return;
    const rowNode = api.getDisplayedRowAtIndex(focused.rowIndex);
    // 既に活性セルへ着地している＝補正不要（公式の移動先が活性／確定Enterの補完済み）。
    if (rowNode && focused.column.isCellEditable(rowNode)) return;
    // 非活性に着地した → 同方向で最初の活性セルへ寄せる。無ければ移動元に留める。
    const targetRow = firstEditableRowInDirection(
      api,
      focused.rowIndex,
      focused.column,
      step
    );
    const destRow = targetRow ?? fromRowIndex;
    if (destRow != null) api.setFocusedCell(destRow, focused.column);
  }, 0);
};

// 編集開始：開始Enterを確定と誤検知しないよう直近キーをリセット。
const handleGridCellEditingStarted = (): void => {
  lastKeyDownKey = null;
};

// 編集確定：Enter確定時に、編集列の「次の活性セル」へフォーカスを移す（非活性はスキップ）。
const handleGridCellEditingStopped = (e: CellEditingStoppedEvent): void => {
  const wasEnter = lastKeyDownKey === 'Enter';
  lastKeyDownKey = null;
  if (!wasEnter || e.rowIndex == null || !e.column) return;
  const { api, rowIndex, column } = e;
  // stopEditing 直後はフォーカスが元セルへ戻る／公式移動が済むため、次タスクで判定する。
  setTimeout(() => {
    // 下方向の次の活性セル。無ければ元の編集セルに留める（非活性セルへは着地させない）。
    const targetRow = firstEditableRowInDirection(api, rowIndex, column, 1);
    const destRow = targetRow != null ? targetRow : rowIndex;
    // 公式が既に目的の活性セルへ移動済みなら二重移動しない。
    const focused = api.getFocusedCell();
    const alreadyThere =
      !!focused &&
      focused.rowIndex === destRow &&
      focused.column.getColId() === column.getColId();
    if (!alreadyThere) {
      api.setFocusedCell(destRow, column);
    }
  }, 0);
};

// 全グリッド共通の基本プロパティ（<AgGridReact> に spread して使用）。
// Excelライクなキー操作とセル範囲選択（コピー／切り取り／貼り付け）を有効化する。
// Enter操作：
// ・選択セルで Enter → 下の“活性”セルへ移動（enterNavigatesVertically: true）。**編集は開始しない**。
//   Shift+Enter は上方向。公式は真下/真上に着地し非活性もスキップしないため、共通 onCellKeyDown で
//   活性セルへ補正する。
// ・編集中に Enter → 確定して下の活性セルへ移動（enterNavigatesVerticallyAfterEdit: true ＋ 共通補完）。
// Tab操作：活性セルのみへ移動し、移動先は選択状態に留める（編集は開始しない＝Enterと同方針）。
// ＝ Enter／Tab とも「移動と編集開始を分ける」Excel互換の操作体系。
//   編集開始は F2／直接入力／ダブルクリック（AG Grid標準）に委ねる。
export const GRID_BASE_PROPS = {
  enterNavigatesVertically: true, // 選択セルのEnterは編集開始せず縦移動
  enterNavigatesVerticallyAfterEdit: true, // 編集確定後は下のセルへ移動（テキスト系）
  // 公式の縦移動は非活性セルもスキップしないため、Enter移動の着地先を活性セルへ補正する。
  // （画面独自に onCellKeyDown を渡すと上書きされる点に注意）
  onCellKeyDown: handleGridCellKeyDown,
  // select系／自作combo系は公式が効かないため、Enter確定時のみ共通で下移動を補完する。
  // （画面独自に onCellEditingStarted／onCellEditingStopped を渡すと上書きされる点に注意）
  onCellEditingStarted: handleGridCellEditingStarted,
  onCellEditingStopped: handleGridCellEditingStopped,
  // セル範囲選択（ドラッグ／Shift+クリック／Ctrl+A）とクリップボード連携を全グリッド共通で有効化。
  // Ctrl+C＝範囲コピー／Ctrl+X＝範囲切り取り／Ctrl+V＝範囲貼り付け（AG Grid Enterprise 公式機能）。
  // ※ enableCellTextSelection（セル内テキストの部分ドラッグ選択）とは排他。公式実装で
  //   enableCellTextSelection: true の間は Ctrl+C／Ctrl+X が無効化されるため、範囲コピー優先で
  //   本設定を採用する。セル値のコピーは範囲選択＋Ctrl+C／右クリック「コピー」で行う。
  // ※ フィルハンドル（handle: { mode: 'fill' }＝範囲右下ドラッグの連続入力）は意図しない
  //   一括書き換えを避けるため有効化しない（範囲ハンドル mode: 'range' も同様に付けない）。
  cellSelection: true,
  tabToNextCell: tabToNextEditableCell, // Tab=活性セルのみへ移動（移動のみ・編集は開始しない）
  // セル編集の Undo／Redo（Ctrl+Z／Ctrl+Y）。AG Grid公式機能を全グリッド共通で有効化。
  // ※ AG Grid は rowData の参照が変わると Undo履歴をクリアするため、Undoを機能させたい
  //   編集グリッドは「セル編集で rowData を差し替えない（同一配列を維持）」ことが前提。
  //   rowData を毎回差し替えるグリッド・読み取り専用グリッドでは無効化されるだけで副作用は無い。
  undoRedoCellEditing: true,
  undoRedoCellEditingLimit: 20, // 履歴の保持段数
  // 列の仮想化を無効化（全列を常時描画）。AG Gridの自動サイズ調整（autoSizeStrategy／
  // 右クリック「すべての列を自動サイズ調整」）は描画済みセルを実測するため、仮想化で
  // 画面外の未描画列があると幅が調整されない。全列を描画して全列に効くようにする（公式プロパティ）。
  suppressColumnVirtualisation: true,
};

// 各列に headerTooltip（=headerName）を付与する共通ヘルパー。
// ヘッダーが列幅で省略表示された場合に、マウスオーバーで全文表示する（公式 headerTooltip）。
export function withHeaderTooltips<TData>(
  colDefs: (ColDef<TData> | ColGroupDef<TData>)[]
): (ColDef<TData> | ColGroupDef<TData>)[] {
  return colDefs.map((col) => {
    const headerTooltip =
      typeof col.headerName === 'string' ? col.headerName : undefined;
    // 列グループは配下の子列にも同じ付与を行う（グループだけに付けると子のtooltipが落ちる）
    if ('children' in col && Array.isArray(col.children)) {
      return {
        ...col,
        headerTooltip,
        children: withHeaderTooltips<TData>(col.children),
      };
    }
    return { ...col, headerTooltip };
  });
}

// ── 計算式ツールチップ ───────────────────────────────────────────
// 計算式ツールチップの組み立てと、計算式セルの数値パース／整形。
// 明細表（計画詳細・販売計画シミュレーション）と集計表（AggregationItemTreeTable）で共有する。

// 計算式テンプレート。
//   `{token}` … 画面内にある算出元（実値を代入できる）
//   素のテキスト … 画面外の算出元（実値を代入できない）
// 例:
//   { template: '({price} − {planPrice}) ÷ {price} × 100%' }
//   { template: '当月実績 ÷ 当月実績反映日数 × 当月日数', valueLine: false }
export interface FormulaTemplate {
  template: string;
  // 実値行（2行目）を出すか。画面外の算出元を含む式では false を指定する。既定は true。
  valueLine?: boolean;
}

const TOKEN_PATTERN = /\{([^}]+)\}/g;

// テンプレート中の `{token}` を出現順に列挙する。
export function formulaTokens(template: string): string[] {
  return [...template.matchAll(TOKEN_PATTERN)].map((m) => m[1]);
}

// 「式」と「実値を代入した式」の2行を組み立てる。
// 2行目は valueLine !== false かつ全トークンの値が引けるときだけ付ける。
export function formulaTooltip(
  tpl: FormulaTemplate,
  labelOf: (token: string) => string,
  valueOf: (token: string) => string | null,
  result: string
): string {
  const expression = tpl.template.replace(TOKEN_PATTERN, (_, token) =>
    labelOf(token)
  );
  const tokens = formulaTokens(tpl.template);
  if (tpl.valueLine === false || tokens.length === 0) return expression;

  const values = tokens.map(valueOf);
  if (values.some((v) => v == null || v === '')) return expression;

  let index = 0;
  const substituted = tpl.template.replace(
    TOKEN_PATTERN,
    () => values[index++] as string
  );
  return `${expression}\n= ${substituted} = ${result}`;
}

// 表示値（'2,526,720' / '12.27%' / '¥131.60' / '▲1,234'）を数値へ戻す。
// 数値として解釈できないものは NaN を返す。
export function parseFormulaNumber(v: unknown): number {
  if (v == null || v === '') return NaN;
  const raw = String(v).trim();
  const negative = raw.startsWith('▲') || raw.startsWith('△');
  const cleaned = raw.replace(/[▲△,¥￥%\s]/g, '');
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return NaN;
  return negative ? -n : n;
}

// 計算式ツールチップ用の数値整形（3桁区切り）。
// fractionDigits を渡すとその桁数に固定し、省略時は小数2桁まで表示する。
export function formatFormulaNumber(
  n: number,
  fractionDigits?: number
): string {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('ja-JP', {
    minimumFractionDigits: fractionDigits ?? 0,
    maximumFractionDigits: fractionDigits ?? 2,
  });
}

// 数値の入力欄（セル編集・フィルタ）で、マウスホイールによる値の増減を止める（画面設計標準 4.6）。
// ブラウザの number 入力はフォーカス中のホイールで値が変わるが、AG Grid に止める設定が無いため
// 画面全体で1回だけ wheel を監視して止める（App.tsx で呼ぶ）。グリッド外の入力欄には影響しない。
let numberWheelGuardInstalled = false;
export function installNumberInputWheelGuard() {
  if (numberWheelGuardInstalled || typeof document === 'undefined') return;
  numberWheelGuardInstalled = true;
  document.addEventListener(
    'wheel',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement &&
        target.type === 'number' &&
        target === document.activeElement &&
        target.closest('.ag-root-wrapper, .ag-popup')
      ) {
        e.preventDefault();
      }
    },
    { passive: false, capture: true }
  );
}

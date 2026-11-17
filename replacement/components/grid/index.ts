// AG Grid 共通モジュールのバレル。同階層の各画面からは "./grid" の1パスで参照する。
// 共通仕様は責務ごとに以下5ファイルへ集約している：
//   gridCommon（設定/テーマ/フィルタ/計算式テキストの整形）・gridStyles（色/スタイル。実体は src/styles/gridStyles.ts）
//   gridLocale（ロケール）・gridHooks（フック）・GridComponents（表示部品）・GridCellRenderers（共通セル部品）
// ※ 計算式ツールチップ系（formulaTooltip 等）は本バレルからは公開せず、
//   利用側が './grid/gridCommon' を直接 import する。
// ※ 集計ツリー系（treeData props・△項目フック・項目名セル）は利用元が
//   AggregationItemTreeTable のみのため、同コンポーネント内に持つ。
export {
  GRID_THEME,
  GRID_FILTER_COLDEF,
  GRID_COLUMN_TYPES,
  GRID_NO_FILTER_COLUMN_TYPES,
  GRID_DATA_TYPE_DEFINITIONS,
  GRID_NUMBER_FILTER,
  GRID_TEXT_FILTER,
  GRID_NUMBER_TEXT_FILTER,
  GRID_DATE_TEXT_FILTER,
  GRID_MONTH_TEXT_FILTER,
  gridFilterContextMenuItems,
  attachFilterInputClearButtons,
  installNumberInputWheelGuard,
  GRID_DEFAULT_COL_DEF,
  GRID_WRAP_HEADER_COL_DEF,
  revertNonNumericValueParser,
  gridHeaderStyle,
  withGridHeaderStyle,
  GRID_STATUS_BAR,
  GRID_MASTER_DETAIL_ICONS,
  DETAIL_GRID_HEIGHT_OFFSET_REM,
  DETAIL_GRID_HEIGHT_RATIO,
  DETAIL_GRID_MIN_HEIGHT_REM,
  detailGridInitialHeight,
  GRID_BASE_PROPS,
  GRID_EMPTY_TEXT,
  formatEmptyAsDash,
  isEmptyCellDisplay,
  withHeaderTooltips,
  withSpanSafeHeaderHeight,
  suppressEditNavKeys,
  asCellStyle,
  CELL_CHANGED_CLASS_RULE,
  asRowStyle,
} from './gridCommon';
// 全件エクスポートの実体（exportGridAllRows）は共通コンテキストメニュー
//（gridCommon の gridFilterContextMenuItems）からのみ呼ぶため、本バレルでは公開しない。
// 画面が使うのは、サーバーから全件取得する場合に context.exportAll へ渡す型のみ。
export type {
  GridExportAllSource,
  GridExportAllFetchParams,
} from './gridExportAll';
export { useRevealNewRows } from './useRevealNewRows';
export { viewportGridHeight } from './gridHeight';
export type {
  UseRevealNewRows,
  UseRevealNewRowsOptions,
  RevealRowKey,
} from './useRevealNewRows';
export { AG_GRID_LOCALE_JA } from './gridLocale';
// 全画面共通の設定（起動時に1回だけ呼ぶ。→ gridSetup）
export { setupAgGrid } from './gridSetup';
export {
  GRID_COLORS,
  rowKindColor,
  rowKindBg,
  editableBg,
  rateCellStyle,
  rateOverTextColor,
  changedCellStyle,
  existingFuncCellStyle,
  requiredEmptyCellStyle,
  COPY_SOURCE_COLORS,
  copySourceLeftBorder,
} from '@/styles/gridStyles';
export type { RowKind, CopySource } from '@/styles/gridStyles';
export {
  useChangedCells,
  withComparableCellValues,
  toComparableCellValue,
  useGridColumnState,
  readSavedColumnState,
  saveGridColumnState,
  useFormulaSourceHighlight,
  useLinkedCellUndo,
} from './gridHooks';
export type {
  UseChangedCells,
  FormulaDef,
  FormulaDefs,
  FormulaSourceHighlightOptions,
  LinkedCellUndoConfig,
} from './gridHooks';
export {
  CopySourceLegend,
  CellColorLegend,
  GridDisplayedRowsStatusPanel,
  HiddenColumnsNotice,
  RowActionMenu,
} from './GridComponents';
export type { CellColorLegendItem } from './GridComponents';
export {
  StatusIconCellRenderer,
  CopyRowCellRenderer,
  CopyDeleteCellRenderer,
} from './GridCellRenderers';
export type { StatusIconConfig } from './GridCellRenderers';
export { FloatingFormulaTooltip } from './FloatingFormulaTooltip';
export type { FloatingFormulaTooltipValue } from './FloatingFormulaTooltip';

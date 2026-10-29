import type { CellStyle } from 'ag-grid-community';

// グリッドセルの共通カラー方針（画面設計標準 準拠）。
// グリッドの色の値は本ファイルだけに書く（全画面共通の正）。grid.css は applyGridColorVariables が
// 登録する CSS 変数（--grid-…）で同じ色を参照し、hex を直書きしない。
// 「【NEXTSALES】画面設計標準.pptx」スライド15/21/24 の配色をここに集約し、
// 各画面のグリッド cellStyle から本ヘルパーを呼ぶことで全画面の配色を統一する。
// （inline style は原則禁止だが、AG Grid の cellStyle コールバックは設計標準で許可）
export const GRID_COLORS = {
  editable: '#ffffff', // 編集可セル：白
  readonly: '#e8e8e8', // 編集不可セル：灰（全画面共通）
  inheritedText: '#9ca3af', // 継承表示（親行の値をそのまま参照表示する等）：薄いグレー文字
  total: '#dbeafe', // 合計・集計行：薄い青
  planValue: '#ffffff', // 計画値：白系
  actualValue: '#f3f4f6', // 実績値：灰系（計画値と区別）
  changedBg: '#fef9c3', // 入力変更セル背景：薄い黄
  // 下ペインの「選択内容を反映」等で値が入ったセルの背景：薄い水色。
  // 入力変更（薄い黄）と区別し、どのセルに反映されたかをその場で分かるようにする。
  appliedBg: '#e0f2fe',
  // 別の一覧から移ってきた明細のセル背景：薄い紫。
  // 支払詳細(追加口請求書有) の「追加口処理」「拡売費処理」のように、2つの一覧の間で
  // 明細を移す操作で使う。入力変更（薄い黄）・下ペインからの反映（薄い水色）と区別し、
  // どの明細が切り替わったのかを一覧上で見分けられるようにする。
  transferredBg: '#ede9fe',
  changedBorder: '#fdba74', // 入力変更セル枠：落ち着いたオレンジ（画面設計標準）
  overText: '#dc2626', // 100%超過：赤字
  // 増減（差分）列の文字色。増加分（プラス）＝青字／減少分（マイナス）＝赤字。
  // （販売計画表（自販機）経費計画の ＋青／▲・−赤 表現を標準とする）
  increaseText: '#2563eb', // 増減の増加分（プラス）：青字
  decreaseText: '#dc2626', // 増減の減少分（マイナス）：赤字
  // 既存の函数値（実績反映セル）。合計/集計の薄青フィル(total)と色が被らないよう、
  // 背景塗りではなく「セル枠」で表現する（existingFuncCellStyle を使用）。
  existingFuncBorder: '#93c5fd', // 既存函数値セルの枠線：落ち着いた薄青
  // 計算式（派生）セルにホバー中、その算出元セルを示す強調枠（濃い青）。
  // 実体は grid.css の `.ag-cell.formula-ref-highlight`（--grid-source-highlight-border で参照）。
  sourceHighlightBorder: '#2563eb', // 算出元セルの強調枠：濃い青
  // 列グループの区切り線：薄い青。まとまった列グループ（例：追加口分割の自部署負担分／分割先ごとの
  // ケース・バラ・金額）の境目を、通常の縦罫線（gridLine）より太く示す。
  groupDivider: '#93c5fd',
  // 通常の罫線色：薄いグレー。GRID_THEME（gridCommon.ts）の borderColor にも使う。
  // 見出しの段の間を短い線で区切る場合など、テーマの罫線と同じ色で描くときに使う。
  gridLine: '#e5e7eb',
  // 行ハイライト（1行全体）。CSSクラスによる行強調で使用する。
  // データ種の区切り（見出し）行：グレー。値を持たない見出し行の背景に使う。
  // 編集不可セル（readonly）より一段濃くして「行の集まりの境目」を示す。
  // ※ 太字は合計行のみとする設計標準に合わせ、見出し行は太字にしない。
  sectionRowBg: '#d1d5db',
  alertRowBg: '#fecaca', // 警告行（計画差異が大きい等）：赤系
  overBilledBg: '#fca5a5', // 超過行（計画NET−請求NETの超過等）：濃いめの赤系
  localeContractRowBg: '#dcfce7', // 読み取り専用の特例行（ロケ契約料等）：緑系
  // 行ホバー背景：薄い青。GRID_THEME（gridCommon.ts）の rowHoverColor（公式Theming API）と、
  // grid.css の inline背景セル用 !important 上書き（--grid-row-hover で参照）の両方で使う。
  rowHover: '#f0f9ff',
  // 数式ガイド：クリック（起点）セルの強調。青背景＋青「実線」枠。
  // 背景は合計行(total)と同色だが、青実線枠と用途（クリック時のみ表示）で区別する。
  clickHighlightBg: '#dbeafe', // クリックセル背景：薄い青
  clickHighlightBorder: '#3b82f6', // クリックセル枠：青（実線）
  // 数式ガイド：参照セル（算出元）の強調。緑背景＋緑「実線」枠。
  // 依存セルとは色相に加え線種（実線/破線）でも区別する（赤緑色覚配慮＝呼び出し側で指定）。
  refHighlightBg: '#bbf7d0', // 参照セル背景：薄い緑
  refHighlightBorder: '#22c55e', // 参照セル枠：緑（実線）
  // 数式ガイド：依存セル（起点セルの変更で影響を受ける先）の強調。オレンジ背景＋オレンジ「破線」枠。
  dependentBg: '#fed7aa', // 依存セル背景：薄いオレンジ
  dependentBorder: '#f97316', // 依存セル枠：オレンジ（破線）
  // 必須項目が未入力のセルの強調。赤「破線」枠＋赤字（背景は塗らない）。
  // 「未保存の差分（changedBg/Border＝黄背景＋オレンジ実線枠）」とは用途が異なるため、
  // 色・線種・背景の有無で分ける。数式ガイドの依存セル（オレンジ破線）とは背景の有無で区別する。
  requiredEmptyBorder: '#dc2626', // 必須未入力セルの枠・文字：赤（破線）
  // 固定上段（単位・税抜き注記行＝pinnedTopRowData）とデータ行の境目に引く罫線。
  // テーマの行罫線（borderColor＝gridLine）より濃くして「ヘッダー相当の行の終わり」を示す。
  pinnedRowBorder: '#9ca3af',
  // ── 画面独自の <style>・cellStyle で使う色（以前は各画面に hex を直書きしていたもの）──
  background: '#ffffff', // グリッド・セルの既定の背景：白（GRID_THEME の backgroundColor）
  headerBg: '#f3f4f6', // 見出し（列見出し・列グループ見出し）を塗る画面の背景：薄いグレー
  headerAccentBorder: '#2563eb', // 見出しの下に引く強調線：青（年間合計・拡売費合計）
  strongDivider: '#d1d5db', // 濃いめの区切り線（項目の境目・四半期の境目・見出しの縦線）
  editingBg: '#fef08a', // 編集中のセルの背景：黄
  editingBorder: '#fbbf24', // 編集中のセルの枠：濃い黄
  rejectedBg: '#f3f4f6', // 不採用行の背景：readonly より薄い灰（変更できる行と区別）
  treeLevel1Bg: '#f9fafb', // 集計ツリーの2階層目のラベル列：ごく薄いグレー
  treeLevel2Bg: '#f3f4f6', // 集計ツリーの3階層目のラベル列：薄いグレー
  detailRowBg: '#f9fafb', // 展開した詳細行（masterDetail）の背景：ごく薄いグレー
} as const;

// ── コピー由来（行の追加経路）を示す左端カラーバー ──────────────
// 明細グリッドに追加された行が「どの操作でコピー／追加されたか」を、
// 左端の列（No. 等）のセルの左ボーダー帯で示す（全画面で同一カラーに統一）。
// 行背景色は反映済/不採用などの状態表示に使う画面があるため、
// 痕跡表現は背景ではなく左ボーダーに寄せて衝突を避ける。
export const COPY_SOURCE_COLORS = {
  reference: '#2563eb', // 拡売費計画(コピー元)＝参照ペインからのコピー：青
  detail: '#16a34a', // グリッドのコピーアイコンによる行コピー：緑
  new: '#ea580c', // 明細追加（新規行）：オレンジ
} as const;

export type CopySource = keyof typeof COPY_SOURCE_COLORS;

// GRID_COLORS・COPY_SOURCE_COLORS を CSS 変数として :root に登録する（grid.css が参照する）。
// 変数名はキーをケバブケースにしたもの（例：changedBg → --grid-changed-bg、
// COPY_SOURCE_COLORS.new → --grid-copy-new）。main.tsx で描画前に1回呼ぶ。
const GRID_COLOR_STYLE_ID = 'grid-color-variables';
export function applyGridColorVariables(): void {
  if (document.getElementById(GRID_COLOR_STYLE_ID)) return;
  const toKebab = (key: string) =>
    key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const declarations = [
    ...Object.entries(GRID_COLORS).map(
      ([key, color]) => `--grid-${toKebab(key)}: ${color};`
    ),
    ...Object.entries(COPY_SOURCE_COLORS).map(
      ([key, color]) => `--grid-copy-${toKebab(key)}: ${color};`
    ),
  ];
  const style = document.createElement('style');
  style.id = GRID_COLOR_STYLE_ID;
  style.textContent = `:root { ${declarations.join(' ')} }`;
  document.head.appendChild(style);
}

// コピー由来に応じた左ボーダー帯の cellStyle 断片を返す。
// 左端の列の cellStyle にスプレッド合成して使う（未設定時は空＝帯なし）。
export function copySourceLeftBorder(
  copySource?: CopySource | null
): CellStyle {
  if (!copySource) return {};
  return { borderLeft: `0.25rem solid ${COPY_SOURCE_COLORS[copySource]}` };
}

// 行種別（計画／実績／合計）に対応する背景色を返す。
export type RowKind = 'plan' | 'actual' | 'total';

export function rowKindColor(kind: RowKind): string {
  switch (kind) {
    case 'total':
      return GRID_COLORS.total;
    case 'actual':
      return GRID_COLORS.actualValue;
    case 'plan':
    default:
      return GRID_COLORS.planValue;
  }
}

// 行種別に応じた背景色の cellStyle を返す（base に追加スタイルをマージ可能）。
export function rowKindBg(kind: RowKind, base: CellStyle = {}): CellStyle {
  return { backgroundColor: rowKindColor(kind), ...base };
}

// 編集可否に応じた背景色（編集可=白 / 編集不可=灰）の cellStyle を返す。
export function editableBg(editable: boolean, base: CellStyle = {}): CellStyle {
  return {
    backgroundColor: editable ? GRID_COLORS.editable : GRID_COLORS.readonly,
    ...base,
  };
}

// 率（％）セル用。100%（=100）超過なら文字色を赤にした cellStyle を返す。
// value は％値（例: 105 で 105%）。base に背景色等を渡してマージできる。
export function rateCellStyle(value: unknown, base: CellStyle = {}): CellStyle {
  // '20.0%' のような％付き文字列・カンマ区切りも許容（parseFloat で数値化）
  const num =
    typeof value === 'number'
      ? value
      : parseFloat(String(value ?? '').replace(/,/g, ''));
  const isOver = Number.isFinite(num) && num > 100;
  return isOver ? { ...base, color: GRID_COLORS.overText } : { ...base };
}

// 入力変更セルの強調スタイル（薄い黄背景＋オレンジ枠）。一覧上のみで使用。
export function changedCellStyle(base: CellStyle = {}): CellStyle {
  return {
    backgroundColor: GRID_COLORS.changedBg,
    borderColor: GRID_COLORS.changedBorder,
    borderWidth: '1px',
    borderStyle: 'solid',
    ...base,
  };
}

// 必須項目が未入力のセルの強調（赤の破線枠＋赤字）。
// 背景は塗らず base（通常は編集可＝白）をそのまま活かすことで、
// 「未保存の差分（changedCellStyle＝黄背景＋オレンジ実線枠）」と重ならないようにする。
// 文字色も赤にするのは、未選択時に表示される「ー」自体を手がかりとし、
// 色相のみで区別させないため（guidelines/06_accessibility.md）。
export function requiredEmptyCellStyle(base: CellStyle = {}): CellStyle {
  return {
    ...base,
    borderColor: GRID_COLORS.requiredEmptyBorder,
    borderWidth: '1px',
    borderStyle: 'dashed',
    color: GRID_COLORS.requiredEmptyBorder,
  };
}

// 既存の函数値（実績反映セル）の強調。合計/集計行の薄青フィル(total)と
// 区別するため、背景は塗らず内側の枠線（inset box-shadow）でマークする。
// base に背景色（通常は planValue=白）を渡してマージできる。
export function existingFuncCellStyle(base: CellStyle = {}): CellStyle {
  return {
    ...base,
    boxShadow: `inset 0 0 0 2px ${GRID_COLORS.existingFuncBorder}`,
  };
}

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
  inheritedText: '#4b5563', // 継承表示（親行の値をそのまま参照表示する等）：グレー文字（gray-600。編集不可の灰のセルの上でもコントラスト 4.5:1 以上 → 06）
  total: '#dbeafe', // 合計・集計行：薄い青
  planValue: '#ffffff', // 計画値：白系
  actualValue: '#f3f4f6', // 実績値：灰系（計画値と区別）
  changedBg: '#fefce8', // 入力変更セル背景：薄い黄（yellow-50。枠は付けない＝UX-035）
  // 下ペインの「選択内容を反映」等で値が入ったセルの背景：薄い水色。
  // 入力変更（薄い黄）と区別し、どのセルに反映されたかをその場で分かるようにする。
  appliedBg: '#e0f2fe',
  // 別の一覧から移ってきた明細のセル背景：薄い紫。
  // 支払詳細(追加口請求書有) の「追加口処理」「拡売費処理」のように、2つの一覧の間で
  // 明細を移す操作で使う。入力変更（薄い黄）・下ペインからの反映（薄い水色）と区別し、
  // どの明細が切り替わったのかを一覧上で見分けられるようにする。
  transferredBg: '#ede9fe',
  overText: '#b91c1c', // 100%超過：赤字（red-700。編集不可の灰のセルの上でもコントラスト 4.5:1 以上 → 06）
  // 比率の 100%超過で、経費以外の項目（函数・売上高・利益など。超えるのが良いこと）の文字色：青字
  // （blue-700。灰のセルの上でもコントラスト 4.5:1 以上 → 06。経費の項目は overText の赤。UX-096）
  overTextGood: '#1d4ed8',
  // 増減（差分）列の文字色。増加分（プラス）＝青字／減少分（マイナス）＝赤字。
  // （販売計画表（自販機）経費計画の ＋青／▲・−赤 表現を標準とする）
  increaseText: '#2563eb', // 増減の増加分（プラス）：青字
  decreaseText: '#b91c1c', // 増減の減少分（マイナス）：赤字（red-700 → 06）
  neutralText: '#374151', // 増減なし（±0）・実数表示の文字：濃いグレー
  // 入力できるプルダウンのセルの右端の印（▼）：グレー（gray-500。白地で約4.8:1・灰のセルでも 3:1 以上。UX-103）
  pulldownMark: '#6b7280',
  // 計画詳細(自販機)の率の入力欄の枠（実績セルの印ではない）。
  existingFuncBorder: '#93c5fd', // 落ち着いた薄青
  // 実績セル（実績が反映された月のセル）の印。枠は付けず、セルの左上に小さな三角を出す
  // （existingFuncCellStyle を使う。UX-045）。
  actualMark: '#2563eb', // 実績セルの印（左上の三角）：青（blue-600）
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
  // 期限超過のセルの背景：薄い赤（grid.css の .cell-overdue。UI/UX UX-028 → 02 §7「期限超過の表示」）
  overdueBg: '#fecaca',
  overBilledBg: '#fca5a5', // 超過行（計画NET−請求NETの超過等）：濃いめの赤系
  localeContractRowBg: '#dcfce7', // 読み取り専用の特例行（ロケ契約料等）：緑系
  // 行ホバー背景：薄い青。GRID_THEME（gridCommon.ts）の rowHoverColor（公式Theming API）と、
  // grid.css の inline背景セル用 !important 上書き（--grid-row-hover で参照）の両方で使う。
  rowHover: '#f0f9ff',
  // ヘッダー（列見出し）：薄い青の背景・紺の文字・列の区切りは上下を空けた薄いグレーの線
  // （UI/UX分科会 決定事項21＝宮澤案。GRID_THEME の headerBackgroundColor 等で使う。UX-031）
  headerBackground: '#eaf0fb',
  headerText: '#14275e',
  headerColumnDivider: '#aeb9ca',
  // 編集できる列があるグリッドの、編集できない列・列グループの見出し：グレーの背景・グレーの文字
  // （編集できる列の見出しは上の薄い青＋紺のまま。gridHeaderStyle で使う。UX-050）
  headerReadonlyBackground: '#f3f4f6', // gray-100
  headerReadonlyText: '#4b5563', // gray-600（背景の上でコントラスト 4.5:1 以上 → 06）
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
  // 「未保存の差分（changedBg＝薄い黄の背景だけ・枠なし）」とは用途が異なるため、
  // 色・線種・背景の有無で分ける。数式ガイドの依存セル（オレンジ破線）とは背景の有無で区別する。
  requiredEmptyBorder: '#b91c1c', // 必須未入力セルの枠・文字：赤（破線。red-700 → 06）
  // 固定上段（単位・税抜き注記行＝pinnedTopRowData）とデータ行の境目に引く罫線。
  // テーマの行罫線（borderColor＝gridLine）より濃くして「ヘッダー相当の行の終わり」を示す。
  pinnedRowBorder: '#9ca3af',
  // ── 画面独自の <style>・cellStyle で使う色（以前は各画面に hex を直書きしていたもの）──
  background: '#ffffff', // グリッド・セルの既定の背景：白（GRID_THEME の backgroundColor）
  strongDivider: '#d1d5db', // 濃いめの区切り線（項目の境目・四半期の境目・見出しの縦線）
  editingBg: '#fef08a', // 編集中のセルの背景：黄
  editingBorder: '#fbbf24', // 編集中のセルの枠：濃い黄
  rejectedBg: '#f3f4f6', // 不採用行の背景：readonly より薄い灰（変更できる行と区別）
  treeLevel1Bg: '#f9fafb', // 集計ツリーの2階層目のラベル列：ごく薄いグレー
  treeLevel2Bg: '#f3f4f6', // 集計ツリーの3階層目のラベル列：薄いグレー
  detailRowBg: '#f9fafb', // 展開した詳細行（masterDetail）の背景：ごく薄いグレー
  displayOnlyBg: '#f7f7f7', // 一覧の明細グリッドの表示専用の列：ごく薄いグレー
  mutedText: '#888888', // 合計行の項目名を目立たせない文字：グレー
  salesCategoryBg: '#D9F2FF', // 販売計画の区分（見出し列）：薄い水色
  paymentCategoryBg: '#CFEFD6', // 支払の区分（見出し列）：薄い緑
  salesHeaderBg: '#1e90ff', // 販売計画の集計表（TOP）の見出し：青
  paymentHeaderBg: '#32cd32', // 支払の集計表（TOP）の見出し：緑
  unifiedBorder: '#cfcfcf', // 枠と行の区切りを太線でそろえる表（grid-unified）の線：グレー
  checkboxBorder: '#6b7280', // 選べるチェックボックス（未チェック）の枠：濃いグレー
  checkboxDisabledBorder: '#d1d5db', // 選べないチェックボックスの枠：薄いグレー
  selectionDisabledBg: '#f7f7f7', // 選べない行のチェックボックス列：ごく薄いグレー
  highlightBorderBg: '#eff6ff', // 強調枠を付けたセルの背景：ごく薄い青
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

// 追加・コピーした行を1秒強調する色（左端の帯の色を薄くした色 → 02 §8「行の追加位置」・UX-112）。
// 共通フック useRevealNewRows が行に付ける data-reveal-source と grid.css で使う。
export const COPY_SOURCE_FLASH_COLORS = {
  reference: '#dbeafe', // 青（blue-100）
  detail: '#dcfce7', // 緑（green-100）
  new: '#ffedd5', // オレンジ（orange-100）
} as const satisfies Record<CopySource, string>;

// GRID_COLORS・COPY_SOURCE_COLORS・COPY_SOURCE_FLASH_COLORS を CSS 変数として :root に登録する（grid.css が参照する）。
// 変数名はキーをケバブケースにしたもの（例：changedBg → --grid-changed-bg、
// COPY_SOURCE_COLORS.new → --grid-copy-new、COPY_SOURCE_FLASH_COLORS.new → --grid-copy-flash-new）。main.tsx で描画前に1回呼ぶ。
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
    ...Object.entries(COPY_SOURCE_FLASH_COLORS).map(
      ([key, color]) => `--grid-copy-flash-${toKebab(key)}: ${color};`
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

// 比率（予算比・前年比など。％値）が 100%（=100）を超えたときの文字色（UI/UX UX-096）。
// 経費の項目（量経追加口・拡売費・売上原価・変動費・売上値引）は赤（overText）、
// それ以外の項目（函数・売上高・利益など）は青（overTextGood）。超えていなければ undefined（既定の黒）。
// value は％値（例: 105 で 105%）。'20.0%' のような％付き文字列・カンマ区切りも許容（parseFloat で数値化）。
export function rateOverTextColor(
  value: unknown,
  isExpense: boolean
): string | undefined {
  const num =
    typeof value === 'number'
      ? value
      : parseFloat(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(num) || num <= 100) return undefined;
  return isExpense ? GRID_COLORS.overText : GRID_COLORS.overTextGood;
}

// 率（％）セル用。100%（=100）超過なら文字色を付けた cellStyle を返す（色は rateOverTextColor）。
// isExpense：経費の項目の列か（既定 false＝青）。base に背景色等を渡してマージできる。
export function rateCellStyle(
  value: unknown,
  base: CellStyle = {},
  isExpense = false
): CellStyle {
  const color = rateOverTextColor(value, isExpense);
  return color ? { ...base, color } : { ...base };
}

// 入力変更セルの強調スタイル（薄い黄の背景だけ。枠は付けない）。一覧上のみで使用。
export function changedCellStyle(base: CellStyle = {}): CellStyle {
  return {
    backgroundColor: GRID_COLORS.changedBg,
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

// 実績セル（実績が反映された月のセル）の印。枠は付けず、セルの左上に小さな青い三角を出す
// （背景のグラデーションで描く。三角の一辺 0.625rem。→ 02 §7「実績セルの印」・UX-045）。
// base に背景色（通常は planValue=白・readonly=灰）を渡してマージできる（背景色はそのまま残る）。
export function existingFuncCellStyle(base: CellStyle = {}): CellStyle {
  return {
    ...base,
    backgroundImage: `linear-gradient(135deg, ${GRID_COLORS.actualMark} 50%, transparent 50%)`,
    backgroundSize: '0.625rem 0.625rem',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'left top',
  };
}

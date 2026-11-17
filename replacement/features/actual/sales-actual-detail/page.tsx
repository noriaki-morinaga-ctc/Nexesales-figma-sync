import { Save, ArrowLeft } from 'lucide-react';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GetRowIdParams,
  type CellValueChangedEvent,
  type ValueFormatterParams,
} from 'ag-grid-community';

import {
  GRID_COLORS,
  GRID_BASE_PROPS,
  GRID_DEFAULT_COL_DEF,
  formatEmptyAsDash,
  useGridColumnState,
  GRID_NO_FILTER_COLUMN_TYPES,
  useChangedCells,
  withComparableCellValues,
  gridHeaderStyle,
  FloatingFormulaTooltip,
  type FloatingFormulaTooltipValue,
} from '@/components/grid';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { SEARCH_LABEL_CLASS } from '@/styles/commonStyles';
import {
  PlanBasicInfoField,
  PlanBasicInfoRow,
  PlanBasicInfoSpacer,
} from '@/components/ui/plan-basic-info';
import { MonthStripPicker } from '@/components/ui/month-strip-picker';
import {
  BASIC_INFO_CREATOR,
  BASIC_INFO_DEALER,
  BASIC_INFO_DEPARTMENT,
  BASIC_INFO_OFFICE,
  PLAN_NO_DATA_MONTHS,
} from '@/mocks/common/planBasicInfo';
import {
  STORE_TIER_LIST,
  firstStoreCode,
  thirdStoreCode,
} from '@/mocks/common/storeTier';
import { joinCodeName } from '@/utils/common/nameCode';
import { FormulaGuideToggle } from '@/components/shared/common/FormulaGuideToggle';
import { ScreenTitle } from '@/components/ui/screen-title';

// 基本情報に表示する一次店/三次店。販売計画(自販機)と同じ参照元（src/mocks/common/storeTier）
// の先頭ペアを用いる。
const BASIC_INFO_STORE_TIER = STORE_TIER_LIST[0];

// 基本情報の対象年月の初期値（旧表示「対象年度=2026年／対象月=7月」に対応）。
// 計画詳細(自販機)の基本情報と同じ値・同じ形式（YYYY/MM）にする。
const BASIC_INFO_INITIAL_YEAR_MONTH = '2026/07';

// 販売計画グリッドの行ID（→ 画面設計標準 4.7）。行区分名 category は全行で一意かつ編集しない。
// 固定上段（単位行）は pinned- を付けてメイン行と区別する。
const getSalesPlanRowId = (params: GetRowIdParams) =>
  params.rowPinned
    ? `pinned-${params.data.category}`
    : String(params.data.category);

// 固定上段（単位の行＝pinnedTopRowData）のセルスタイル。
// 背景は下の <style> の .ag-floating-top .ag-cell がテーマのヘッダー色で上書きする
// （インライン指定はその上書き前のフォールバック）。
// 文字サイズは共通テーマ GRID_THEME の 0.875rem を継承するため指定しない。
// 横寄せは cellClass（CATEGORY_CELL_CLASS／numericCellClass）で指定する（→ 02 §7）。
const UNIT_ROW_CELL_STYLE = {
  backgroundColor: GRID_COLORS.readonly,
} as const;

// セルの横寄せ（→ 02 §7「横寄せはセルの内容で決める」／grid.css の共通クラス）。
//  ・行タイトル（文字列）＝左寄せ。固定上段（単位の行）も同じ左寄せに揃える。
//  ・数値列＝右寄せ。ただし固定上段は単位表記のため中央寄せにする。
// 行タイトル列は先頭列（aria-colindex=1）のため、grid.css のチェックボックス
// 中央寄せ規則（display:flex／justify-content:center／padding:0）が効いてしまう。
// 解除用の `ag-cell-left` を併記して左寄せへ戻す（grid.css の同規則コメント参照）。
const CATEGORY_CELL_CLASS = 'cell-left ag-cell-left';
const numericCellClass = (params: any) =>
  params.node?.rowPinned === 'top' ? 'cell-center' : 'cell-right';

// 数式ガイドのセル強調スタイル（青=クリック／緑=参照先／オレンジ=依存先）。
// 色・線種は PlanDetailVending と揃えるため共有トークン GRID_COLORS を参照する。
// 参照(緑)＝実線・依存(オレンジ)＝破線とし、色相（緑/オレンジ）に依存せず線種でも
// 区別できるようにする（赤緑色覚での混同を避けるユニバーサルデザイン対応。
// → 06 §「色以外の手がかり」）。枠線は px 禁止のため rem（0.125rem=2px）で統一。
// 強調は枠線だけで示し、背景は元のセルの配色を保つ（背景は塗らない）。
const HL_CLICK_BORDER = `0.125rem solid ${GRID_COLORS.clickHighlightBorder}`; // クリックセル枠：青（実線）
const HL_REF_BORDER = `0.125rem solid ${GRID_COLORS.refHighlightBorder}`; // 参照セル枠：緑（実線）
const HL_AFFECT_BORDER = `0.125rem dashed ${GRID_COLORS.dependentBorder}`; // 依存セル枠：オレンジ（破線）

// ===== 数式ガイド（関連セル強調表示）の共通ロジック =====
//  ・各セルの計算式は SALES_FORMULAS に関数で定義する（実値計算と強調表示の単一の源）。
//  ・グリーン強調＝クリックしたセルの計算式が参照するセル。計算式を記録用 getter で
//    実行し、参照セルを自動抽出する（別途参照表を保守する必要はない）。
//  ・オレンジ強調＝クリックしたセル（＝起点）に依存するセル群（数式の逆依存を
//    BFS で収集）。オレンジは「起点」として個別指定したセル
//    （SALES_HIGHLIGHT_TRIGGERS）をクリックしたときのみ表示する。

// 数値をパースする関数（カンマ・％を除去して数値化）
const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').replace(/％/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// 数値をフォーマットする関数（四捨五入＋カンマ区切り）
const formatNumber = (value: number): string => {
  return Math.round(value).toLocaleString();
};

// 小数第1位までフォーマットする関数（小数第2位以下を四捨五入＋カンマ区切り）
const formatDecimal1 = (value: number): string => {
  return (Math.round(value * 10) / 10).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
};

// 当月計画額（計画比の分母）
const MONTHLY_PLAN_AMOUNT = 200000000;

// 前年同月の商流販売店計の当月実績額（商流販売店計 前年比の分母）
const PREV_YEAR_SALES_TOTAL_AMOUNT = 166666666;

// 前年同月の専用機の当月実績額（専用機 前年比の分母）
const PREV_YEAR_SPECIAL_MACHINE_AMOUNT = 162814274;

// 専用機の当月計画額（専用機 計画比の分母）
const SPECIAL_MACHINE_PLAN_AMOUNT = 217085698;

// 提携機の当月計画額（提携機 計画比の分母）
const PARTNER_MACHINE_PLAN_AMOUNT = 2181818;

// 前年同月の提携機の当月実績額（提携機 前年比の分母）
const PREV_YEAR_PARTNER_MACHINE_AMOUNT = 1846153;

// その他（手売り）の当月計画額（その他手売り 計画比の分母）
const OTHER_HANDSELL_PLAN_AMOUNT = 47619;

// 前年同月のその他（手売り）の当月実績額（その他手売り 前年比の分母）
const PREV_YEAR_OTHER_HANDSELL_AMOUNT = 41666;

// ===== 数式定義（単一の源：計算とグリーン強調の両方に使用） =====
// キー = セルID（"rowIndex-field"）、値 = 計算式の関数。
// 引数 g(参照セルID) で参照セルの数値を取得する。
// この関数は (1) 実値の再計算（handleCellChange）と
// (2) グリーン強調の参照セル抽出（extractFormulaRefs）の両方で共用される。
// → 数式を1か所に書くだけで、参照セルの強調も自動で連動する（Excel 表記の別表は不要）。
const SALES_FORMULAS: Record<
  string,
  (g: (cellId: string) => number) => string
> = {
  // 商流販売店計 入数 ＝ 本数 ÷ 函数（小数第1位まで。函数0なら現状維持）
  '0-col24': (g) =>
    g('0-col23') !== 0
      ? formatDecimal1(g('0-col25') / g('0-col23'))
      : formatDecimal1(g('0-col24')),
  // 計画比 ＝ 当月実績額 ÷ 当月計画
  '0-col21': (g) =>
    formatDecimal1((g('0-col20') / MONTHLY_PLAN_AMOUNT) * 100) + '%',
  // 前年比 ＝ 当月実績額 ÷ 前年同月の商流販売店計の当月実績額
  '0-col22': (g) =>
    formatDecimal1((g('0-col20') / PREV_YEAR_SALES_TOTAL_AMOUNT) * 100) + '%',
  // 商流販売店計 函単価 ＝ 当月実績額 ÷ 函数（整数に四捨五入。函数0なら現状維持）
  '0-col28': (g) =>
    g('0-col23') !== 0
      ? formatNumber(g('0-col20') / g('0-col23'))
      : formatNumber(g('0-col28')),
  // 実販 函数 ＝ 商流販売店計 － 出荷実販差 ＋ 前月出荷実販差
  '1-col23': (g) => formatNumber(g('0-col23') - g('5-col23') + g('6-col23')),
  // 実販 当月実績額 ＝ 函数 × 函単価
  '1-col20': (g) => formatNumber(g('1-col23') * g('1-col28')),
  // 実販 入数 ＝ 商流販売店計の入数
  '1-col24': (g) => formatDecimal1(g('0-col24')),
  // 実販 本数 ＝ 函数 × 入数
  '1-col25': (g) => formatNumber(g('1-col23') * g('1-col24')),
  // 実販 函単価 ＝ 商流販売店計の函単価
  '1-col28': (g) => formatNumber(g('0-col28')),
  // 専用機 当月実績額 ＝ 実販 － 提携機 － その他手売り － アライアンス品
  '2-col20': (g) =>
    formatNumber(g('1-col20') - g('3-col20') - g('4-col20') - g('7-col20')),
  // 専用機 函数 ＝ 実販 － 提携機 － その他手売り － アライアンス品
  '2-col23': (g) =>
    formatNumber(g('1-col23') - g('3-col23') - g('4-col23') - g('7-col23')),
  // 専用機 本数 ＝ 実販 － 提携機 － その他手売り － アライアンス品
  '2-col25': (g) =>
    formatNumber(g('1-col25') - g('3-col25') - g('4-col25') - g('7-col25')),
  // 専用機 入数 ＝ 本数 ÷ 函数（小数第1位まで。函数0なら現状維持）
  '2-col24': (g) =>
    g('2-col23') !== 0
      ? formatDecimal1(g('2-col25') / g('2-col23'))
      : formatDecimal1(g('2-col24')),
  // 専用機PM ＝ 本数 ÷ 稼働台数（整数に四捨五入。稼働台数0なら現状維持）
  '2-col26': (g) =>
    g('2-col27') !== 0
      ? formatNumber(g('2-col25') / g('2-col27'))
      : formatNumber(g('2-col26')),
  // 専用機 函単価 ＝ 当月実績額 ÷ 函数（整数に四捨五入。函数0なら現状維持）
  '2-col28': (g) =>
    g('2-col23') !== 0
      ? formatNumber(g('2-col20') / g('2-col23'))
      : formatNumber(g('2-col28')),
  // 専用機 前年比 ＝ 当月実績額 ÷ 前年同月の専用機の当月実績額
  '2-col22': (g) =>
    formatDecimal1((g('2-col20') / PREV_YEAR_SPECIAL_MACHINE_AMOUNT) * 100) +
    '%',
  // 専用機 計画比 ＝ 当月実績額 ÷ 専用機の当月計画
  '2-col21': (g) =>
    formatDecimal1((g('2-col20') / SPECIAL_MACHINE_PLAN_AMOUNT) * 100) + '%',
  // 提携機 函数 ＝ 本数 ÷ 入数（整数に四捨五入。入数0なら現状維持）
  '3-col23': (g) =>
    g('3-col24') !== 0
      ? formatNumber(g('3-col25') / g('3-col24'))
      : formatNumber(g('3-col23')),
  // 提携機PC ＝ 本数 ÷ 稼働台数（整数に四捨五入。稼働台数0なら現状維持）
  '3-col26': (g) =>
    g('3-col27') !== 0
      ? formatNumber(g('3-col25') / g('3-col27'))
      : formatNumber(g('3-col26')),
  // 提携機 当月実績額 ＝ 函数 × 函単価
  '3-col20': (g) => formatNumber(g('3-col23') * g('3-col28')),
  // 提携機 計画比 ＝ 当月実績額 ÷ 提携機の当月計画
  '3-col21': (g) =>
    formatDecimal1((g('3-col20') / PARTNER_MACHINE_PLAN_AMOUNT) * 100) + '%',
  // 提携機 前年比 ＝ 当月実績額 ÷ 前年同月の提携機の当月実績額
  '3-col22': (g) =>
    formatDecimal1((g('3-col20') / PREV_YEAR_PARTNER_MACHINE_AMOUNT) * 100) +
    '%',
  // その他（手売り） 当月実績額 ＝ 函数 × 函単価
  '4-col20': (g) => formatNumber(g('4-col23') * g('4-col28')),
  // その他（手売り） 入数 ＝ 商流販売店計の入数
  '4-col24': (g) => formatDecimal1(g('0-col24')),
  // その他（手売り） 本数 ＝ 函数 × 入数
  '4-col25': (g) => formatNumber(g('4-col23') * g('4-col24')),
  // その他（手売り） 計画比 ＝ 当月実績額 ÷ その他手売りの当月計画
  '4-col21': (g) =>
    formatDecimal1((g('4-col20') / OTHER_HANDSELL_PLAN_AMOUNT) * 100) + '%',
  // その他（手売り） 前年比 ＝ 当月実績額 ÷ 前年同月のその他手売りの当月実績額
  '4-col22': (g) =>
    formatDecimal1((g('4-col20') / PREV_YEAR_OTHER_HANDSELL_AMOUNT) * 100) +
    '%',
  // 出荷実販差 当月実績額 ＝ 函数 × 函単価
  '5-col20': (g) => formatNumber(g('5-col23') * g('5-col28')),
  // 出荷実販差 入数 ＝ 商流販売店計の入数
  '5-col24': (g) => formatDecimal1(g('0-col24')),
  // 出荷実販差 本数 ＝ 函数 × 入数
  '5-col25': (g) => formatNumber(g('5-col23') * g('5-col24')),
  // アライアンス品 函数 ＝ 本数 ÷ 入数（整数に四捨五入。入数0なら現状維持）
  '7-col23': (g) =>
    g('7-col24') !== 0
      ? formatNumber(g('7-col25') / g('7-col24'))
      : formatNumber(g('7-col23')),
  // アライアンス品PM/PC ＝ 本数 ÷ 稼働台数（整数に四捨五入。稼働台数0なら現状維持）
  '7-col26': (g) =>
    g('7-col27') !== 0
      ? formatNumber(g('7-col25') / g('7-col27'))
      : formatNumber(g('7-col26')),
  // アライアンス品 当月実績額 ＝ 函数 × 函単価
  '7-col20': (g) => formatNumber(g('7-col23') * g('7-col28')),
};

// 数式関数を記録用 getter で実行し、参照されたセルID（グリーン強調対象）を自動抽出する。
const extractFormulaRefs = (
  fn: (g: (cellId: string) => number) => string
): string[] => {
  const refs = new Set<string>();
  const recordingGet = (cellId: string): number => {
    refs.add(cellId);
    return 1; // 参照抽出が目的のためダミー値（ゼロ除算回避）
  };
  try {
    fn(recordingGet);
  } catch {
    // 抽出時の計算エラーは無視（参照セルの収集のみが目的）
  }
  return Array.from(refs);
};

// クリックしたセルの計算式が参照するセル（グリーン強調対象）を返す。
const getSalesFormulaReferences = (cellId: string): string[] => {
  const fn = SALES_FORMULAS[cellId];
  return fn ? extractFormulaRefs(fn) : [];
};

// ===== オレンジ強調の起点セル（個別指定） =====
// ここに登録したセル（"rowIndex-field"）をクリックしたときのみ、そのセルに
// 依存するセル群（数式の逆依存）をオレンジで強調表示する。起点を増やす場合はここに追記する。
const SALES_HIGHLIGHT_TRIGGERS = new Set<string>([
  // 専用機/提携機/アライアンス品の 稼働台数。
  // クリックすると、これらを参照する 専用機PM/提携機PC(col26) がオレンジ強調される。
  '2-col27',
  '3-col27',
  '7-col27',
  // 商流販売店計/提携機/アライアンス品の 本数。
  // クリックすると、これらを参照するセル群（入数・函数・PM/PC・専用機本数 等）がオレンジ強調される。
  '0-col25',
  '3-col25',
  '7-col25',
  // 提携機/アライアンス品の 入数。
  // クリックすると、これらを参照する 函数(col23) 等がオレンジ強調される。
  '3-col24',
  '7-col24',
  // 商流販売店計/その他手売り/出荷実販差/前月出荷実販差の 函数。
  // クリックすると、これらを参照するセル群（実販函数・入数・本数・実績額 等）がオレンジ強調される。
  '0-col23',
  '4-col23',
  '5-col23',
  '6-col23',
  // ※ 前月出荷実販差の 入数(6-col24)・本数(6-col25)・実績額(6-col20) は起点にしない。
  //   同行で他セルから参照されるのは 函数(6-col23＝実販函数の算出に使う)だけで、
  //   これら3セルを参照する数式が無く、クリックしてもオレンジ強調が出ないため
  //   （前月からの繰越値であり、当月の数式に組み込まない）。
  // 商流販売店計の 実績額。
  // クリックすると、これを参照する 計画比(0-col21)・前年比(0-col22) がオレンジ強調される。
  '0-col20',
  // 提携機/その他手売り/出荷実販差/アライアンス品の 函単価。
  // クリックすると、これらを参照する 当月実績額(col20＝函数×函単価) 等がオレンジ強調される。
  '3-col28',
  '4-col28',
  '5-col28',
  '7-col28',
]);

// 数式定義から逆依存マップ（参照先セル → そのセルを参照する数式セル群）を構築。
const buildSalesReverseMap = (): Map<string, Set<string>> => {
  const reverseMap = new Map<string, Set<string>>();
  Object.entries(SALES_FORMULAS).forEach(([targetCellId, fn]) => {
    extractFormulaRefs(fn).forEach((refCellId) => {
      if (!reverseMap.has(refCellId)) reverseMap.set(refCellId, new Set());
      reverseMap.get(refCellId)!.add(targetCellId);
    });
  });
  return reverseMap;
};
const SALES_REVERSE_MAP = buildSalesReverseMap();

// BFS：起点セルから逆依存を辿り、依存するセル群（起点自身を除く）を返す。
const computeSalesDependentsFrom = (startCellId: string): string[] => {
  const visited = new Set<string>([startCellId]);
  const queue = [startCellId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const deps = SALES_REVERSE_MAP.get(cur);
    if (!deps) continue;
    deps.forEach((dep) => {
      if (!visited.has(dep)) {
        visited.add(dep);
        queue.push(dep);
      }
    });
  }
  visited.delete(startCellId);
  return Array.from(visited);
};

export default function SalesActualDetail() {
  const [isOpen, setIsOpen] = useState(true);
  // 基本情報の対象年月（月ストリップ）。計画詳細(自販機)と同様、画面内で保持する
  // （本画面では表示専用でグリッドへは連動しない）。
  const [targetYearMonth, setTargetYearMonth] = useState(
    BASIC_INFO_INITIAL_YEAR_MONTH
  );
  const [isSalesPlanOpen, setIsSalesPlanOpen] = useState(true);
  const [clickedCell, setClickedCell] = useState<{
    rowIndex: number;
    field: string;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] =
    useState<FloatingFormulaTooltipValue | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<{
    references: string[]; // このセルが参照するセル（グリーン）
    affects: string[]; // このセルが影響を与えるセル（オレンジ）
  }>({ references: [], affects: [] });

  // 数式ガイド（数式表示）モード。ON のときのみセルクリックで強調表示・数式表示を行う。
  const [isFormulaGuideShown, setIsFormulaGuideShown] = useState(false);

  // AG Grid の cellStyle は React の再描画では再評価されないため、強調表示の
  // 判定値は ref 経由で参照し、変更時に refreshCells で明示的に再描画する。
  const showFormulaGuideRef = useRef(false);
  const clickedCellRef = useRef<{ rowIndex: number; field: string } | null>(
    null
  );
  const highlightedCellsRef = useRef<{
    references: string[];
    affects: string[];
  }>({ references: [], affects: [] });

  const gridApiRef = useRef<any>(null);

  // 列状態（列幅・並び順・ソート・固定・表示）の localStorage 永続化（共通フック）。
  // 保存済み状態が無い初回のみ内容フィット（autoSizeStrategy）する。
  // 数式ガイドの refreshCells 用に onGridReady で API を保持する。
  const gridColumnStateProps = useGridColumnState(
    'actualResultsRegistration.salesPlan.columnState.v1',
    {
      onGridReady: (params: any) => {
        gridApiRef.current = params.api;
      },
    }
  );

  // 数式ガイド OFF 時は選択中セル・ツールチップ・強調表示をクリアする。
  useEffect(() => {
    showFormulaGuideRef.current = isFormulaGuideShown;
    if (
      !isFormulaGuideShown &&
      (clickedCell ||
        tooltipPosition ||
        highlightedCells.references.length > 0 ||
        highlightedCells.affects.length > 0)
    ) {
      setClickedCell(null);
      setTooltipPosition(null);
      setHighlightedCells({ references: [], affects: [] });
    }
    // 数式ガイドの ON→OFF 切替時のみクリアする意図のため、他の値は依存に含めない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFormulaGuideShown]);

  // 強調表示の状態を ref に同期し、グリッドのセルを再描画する。
  useEffect(() => {
    clickedCellRef.current = clickedCell;
    highlightedCellsRef.current = highlightedCells;
    gridApiRef.current?.refreshCells({ force: true });
  }, [clickedCell, highlightedCells]);

  // グリッドのセル以外をクリックしたら、ツールチップと強調表示をクリアする。
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.ag-cell')) {
        setTooltipPosition(null);
        setClickedCell(null);
        setHighlightedCells({ references: [], affects: [] });
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // ツールチップマップ（行インデックス、列フィールド）
  const tooltipMap: { [key: string]: string } = {
    '0-col21': '数式: 当月実績 ÷ 当月計画',
    '0-col22': '数式: 当月実績 ÷ 前年同月実績',
    '0-col24': '数式: 本数 ÷ 函数',
    '0-col28': '数式: 当月実績額 ÷ 函数',
    '1-col20': '数式: 函数 × 函単価',
    '1-col23': '数式: 商流販売店計 － 出荷実販差 ＋ 前月出荷実販差',
    '1-col24': '数式: 商流販売店計の入数',
    '1-col25': '数式: 函数 × 入数',
    '1-col28': '数式: 函単価(販売流通店計)',
    '2-col20': '数式: 実販 － 提携機 － その他(手売り) － アライアンス品',
    '2-col21': '数式: 当月実績 ÷ 当月計画',
    '2-col22': '数式: 当月実績 ÷ 前年同月実績',
    '2-col23': '数式: 実販 － 提携機 － その他(手売り) － アライアンス品',
    '2-col24': '数式: 本数 ÷ 函数',
    '2-col25': '数式: 実販 － 提携機 － その他(手売り) － アライアンス品',
    '2-col26': '数式: 本数 ÷ 稼働台数（コラム）',
    '2-col28': '数式: 当月実績額 ÷ 函数',
    '3-col20': '数式: 函数 × 函単価',
    '3-col21': '数式: 当月実績 ÷ 当月計画',
    '3-col22': '数式: 当月実績 ÷ 前年同月実績',
    '3-col23': '数式: 本数 ÷ 入数',
    '3-col26': '数式: 本数 ÷ 稼働台数（コラム）',
    // 提携機の稼働台数(コラム)・函単価はファイルアップロードでも登録されるが、
    // 画面で手入力した値を優先する（→ 20260609_第7回_自販機／本スレッド返信 宮澤 2026-08-19）。
    '3-col27': '提携機実績（アップロード値より手入力値を優先します）',
    '3-col28': '提携機実績（アップロード値より手入力値を優先します）',
    // アライアンス品も提携機と同じくアップロード対象のため、手入力値を優先する。
    '7-col27': 'アライアンス品実績（アップロード値より手入力値を優先します）',
    '7-col28': 'アライアンス品実績（アップロード値より手入力値を優先します）',
    '4-col20': '数式: 函数 × 函単価',
    '4-col21': '数式: 当月実績 ÷ 当月計画',
    '4-col22': '数式: 当月実績 ÷ 前年同月実績',
    '4-col24': '数式: 商流販売店計の入数',
    '4-col25': '数式: 函数 × 入数',
    '5-col20': '数式: 函数 × 函単価',
    '5-col24': '数式: 商流販売店計の入数',
    '5-col25': '数式: 函数 × 入数',
    '7-col20': '数式: 函数 × 函単価',
    '7-col23': '数式: 本数 ÷ 入数',
    '7-col26': '数式: 本数 ÷ 稼働台数（コラム）',
  };

  // 数式の説明をセルのネイティブツールチップとして返す（一部の列の tooltipValueGetter で使用）。
  const getTooltip = (params: any) => {
    const rowIndex = params.node?.rowIndex ?? -1;
    const field = params.colDef?.field;
    const key = `${rowIndex}-${field}`;
    return tooltipMap[key] || '';
  };

  // セルクリックハンドラー（数式ガイド ON のときのみ動作）。
  //  ・グリーン＝クリックしたセルの計算式（SALES_FORMULAS）が参照するセル（自動抽出）。
  //  ・オレンジ＝起点（SALES_HIGHLIGHT_TRIGGERS）クリック時のみ、依存セル群。
  //  ・ツールチップ＝数式の説明（tooltipMap）。
  const handleCellClick = (params: any) => {
    if (!showFormulaGuideRef.current) return;

    const rowIndex = params.node?.rowIndex ?? -1;
    const field = params.colDef?.field;
    if (rowIndex < 0 || !field || params.node?.rowPinned) return;
    const key = `${rowIndex}-${field}`;

    // 同じセルを再クリックした場合は強調表示・ツールチップをクリアする。
    if (clickedCell?.rowIndex === rowIndex && clickedCell?.field === field) {
      setClickedCell(null);
      setTooltipPosition(null);
      setHighlightedCells({ references: [], affects: [] });
      return;
    }

    setClickedCell({ rowIndex, field });

    // グリーン：クリックしたセルの計算式が参照するセル（計算式から自動抽出）。
    const references = getSalesFormulaReferences(key);

    // オレンジ：起点セル（個別指定）クリック時のみ、依存セル群を強調表示する。
    const affects = SALES_HIGHLIGHT_TRIGGERS.has(key)
      ? computeSalesDependentsFrom(key)
      : [];

    setHighlightedCells({ references, affects });

    // 数式（説明）をツールチップ表示（「販売・経費計画申請承認」と同じ位置・スタイル：
    // セルの直下・左寄せ）。説明未定義のセルは非表示。
    const tooltipText = tooltipMap[key] || '';
    const cellEl = params.event?.target?.closest?.('.ag-cell');
    const rect = cellEl?.getBoundingClientRect?.();
    if (tooltipText && rect) {
      setTooltipPosition({
        x: rect.left,
        y: rect.bottom + window.scrollY + 4,
        text: tooltipText,
      });
    } else {
      setTooltipPosition(null);
    }
  };

  // セル変更時の自動計算関数
  const handleCellChange = (params: any) => {
    const newData = [...salesPlanData];
    const rowIndex = params.node.rowIndex;

    // 新しい値を反映
    newData[rowIndex] = { ...params.data };

    // セルID の計算式（SALES_FORMULAS）を現在の newData から評価して反映する。
    // 強調表示と同じ定義を使うため、計算と参照セルの強調が常に一致する。
    const applyFormula = (cellId: string) => {
      const fn = SALES_FORMULAS[cellId];
      if (!fn) return;
      const [rowStr, field] = cellId.split('-');
      const get = (refId: string): number => {
        const [r, f] = refId.split('-');
        return parseNumber((newData[Number(r)] as Record<string, string>)[f]);
      };
      (newData[Number(rowStr)] as Record<string, string>)[field] = fn(get);
    };

    // 以下の recalcRowN は「どの行のどのセルを、どの順で再計算するか」だけを定義する。
    // 計算式そのものは SALES_FORMULAS に一元化してあるため、ここでは重複して書かない
    // （行内コメントは colNN が示す項目名のみ）。

    // 商流販売店計行（rowIndex === 0）の計算
    const recalcRow0 = () => {
      applyFormula('0-col21'); // 計画比
      applyFormula('0-col22'); // 前年比
      applyFormula('0-col24'); // 入数
      applyFormula('0-col28'); // 函単価
    };

    // 実販行（rowIndex === 1）の計算
    const recalcRow1 = () => {
      applyFormula('1-col23'); // 函数
      applyFormula('1-col24'); // 入数
      applyFormula('1-col25'); // 本数
      applyFormula('1-col28'); // 函単価
      applyFormula('1-col20'); // 当月実績額
    };

    // 専用機行（rowIndex === 2）の計算
    const recalcRow2 = () => {
      applyFormula('2-col20'); // 当月実績額
      applyFormula('2-col21'); // 計画比
      applyFormula('2-col22'); // 前年比
      applyFormula('2-col23'); // 函数
      applyFormula('2-col25'); // 本数
      applyFormula('2-col24'); // 入数（本数・函数の確定後に計算する）
      applyFormula('2-col26'); // 専用機PM
      applyFormula('2-col28'); // 函単価
    };

    // 提携機行（rowIndex === 3）の計算
    const recalcRow3 = () => {
      applyFormula('3-col23'); // 函数
      applyFormula('3-col26'); // 提携機PC
      applyFormula('3-col20'); // 当月実績額
      applyFormula('3-col21'); // 計画比
      applyFormula('3-col22'); // 前年比
    };

    // その他（手売り）行（rowIndex === 4）の計算
    const recalcRow4 = () => {
      applyFormula('4-col24'); // 入数
      applyFormula('4-col25'); // 本数
      applyFormula('4-col20'); // 当月実績額
      applyFormula('4-col21'); // 計画比
      applyFormula('4-col22'); // 前年比
    };

    // 出荷実販差行（rowIndex === 5）の計算
    const recalcRow5 = () => {
      applyFormula('5-col24'); // 入数
      applyFormula('5-col25'); // 本数
      applyFormula('5-col20'); // 当月実績額
    };

    // アライアンス品行（rowIndex === 7）の計算
    const recalcRow7 = () => {
      applyFormula('7-col23'); // 函数
      applyFormula('7-col26'); // PM/PC
      applyFormula('7-col20'); // 当月実績額
    };

    // 全ての行を再計算（参照関係の順に呼ぶ：実販は出荷実販差・アライアンス品の確定後、
    // 専用機は実販・提携機・その他手売りの確定後でなければ正しい値にならない）。
    recalcRow0();
    recalcRow7();
    recalcRow5();
    recalcRow1();
    recalcRow3();
    recalcRow4();
    recalcRow2();

    setSalesPlanData(newData);
  };

  // 販売計画データ
  const [salesPlanData, setSalesPlanData] = useState([
    {
      category: '商流販売店計',
      col20: '200,000,000',
      col21: '100.0%',
      col22: '120.0%',
      col23: '100,000',
      col24: '25.0',
      col25: '2,500,000',
      col26: '',
      col27: '',
      col28: '2,000',
    },
    {
      category: '実販',
      col20: '198,000,000',
      col21: '',
      col22: '',
      col23: '99,000',
      col24: '25.0',
      col25: '2,475,000',
      col26: '',
      col27: '',
      col28: '2,000',
    },
    {
      category: '専用機',
      col20: '195,377,140',
      col21: '90.0%',
      col22: '120.0%',
      col23: '98,051',
      col24: '25.0',
      col25: '2,451,378',
      col26: '817',
      col27: '3,000',
      col28: '1,993',
    },
    {
      category: '提携機',
      col20: '2,400,000',
      col21: '110.0%',
      col22: '130.0%',
      col23: '800',
      col24: '25.0',
      col25: '20,000',
      col26: '7',
      col27: '3,000',
      col28: '3,000',
    },
    {
      category: 'その他（手売り）',
      col20: '50,000',
      col21: '105.0%',
      col22: '120.0%',
      col23: '20',
      col24: '25.0',
      col25: '500',
      col26: '',
      col27: '',
      col28: '2,500',
    },
    {
      category: '出荷実販差',
      col20: '6,300,000',
      col21: '',
      col22: '',
      col23: '3,000',
      col24: '25.0',
      col25: '75,000',
      col26: '',
      col27: '',
      col28: '2,100',
    },
    {
      category: '前月出荷実販差',
      col20: '4,200,000',
      col21: '',
      col22: '',
      col23: '2,000',
      col24: '25.0',
      col25: '50,000',
      col26: '',
      col27: '',
      col28: '',
    },
    {
      category: 'アライアンス品',
      col20: '172,860',
      col21: '',
      col22: '',
      col23: '129',
      col24: '24.2',
      col25: '3,122',
      col26: '20',
      col27: '156',
      col28: '1,340',
    },
  ]);

  // 単位行（グリッド最上部に固定表示する pinnedTopRowData）のデータ
  const unitRowData = useMemo(
    () => [
      {
        category: '単位',
        col20: '円',
        col21: '',
        col22: '',
        col23: '函',
        col24: '本',
        col25: '本',
        col26: '本',
        col27: '台/コラム',
        col28: '円',
      },
    ],
    []
  );

  // セルの編集可否を判定する関数
  const isCellEditable = (rowIndex: number, field: string) => {
    // 提携機行（rowIndex === 3）：入数、本数、稼働台数(コラム)、函単価
    if (
      rowIndex === 3 &&
      (field === 'col24' ||
        field === 'col25' ||
        field === 'col27' ||
        field === 'col28')
    )
      return true;
    // その他（手売り）行（rowIndex === 4）：函数、函単価
    if (rowIndex === 4 && (field === 'col23' || field === 'col28')) return true;
    // 出荷実販差行（rowIndex === 5）：函数、函単価
    if (rowIndex === 5 && (field === 'col23' || field === 'col28')) return true;
    return false;
  };

  // 強調セルの背景。強調は枠線だけで示すため、通常時と同じ配色を返す。
  // 独自 cellStyle を持つ列は強調時に早期 return するため、そこで使う。
  const formulaHighlightBg = (rowIndex: number, isEditable: boolean) =>
    rowIndex === 0
      ? GRID_COLORS.total
      : isEditable
        ? GRID_COLORS.editable
        : GRID_COLORS.readonly;

  // 数式ガイドの強調色（青=クリック／緑=参照先／オレンジ=影響先）を返す。
  // 独自 cellStyle を持つ列でも getCellStyle と同じ強調を適用するための共通関数。
  // 該当しない場合は null を返す。
  const getFormulaHighlight = (
    rowIndex: number,
    field: string
  ): { border: string } | null => {
    if (!showFormulaGuideRef.current) return null;
    const cellKey = `${rowIndex}-${field}`;
    if (
      clickedCellRef.current?.rowIndex === rowIndex &&
      clickedCellRef.current?.field === field
    ) {
      return { border: HL_CLICK_BORDER };
    }
    if (highlightedCellsRef.current.references.includes(cellKey)) {
      return { border: HL_REF_BORDER };
    }
    if (highlightedCellsRef.current.affects.includes(cellKey)) {
      return { border: HL_AFFECT_BORDER };
    }
    return null;
  };

  // セルのスタイルを取得する関数（編集可能なセルは白背景）。
  // 横寄せは cellClass（cell-left / cell-right / cell-center）で指定するため、
  // ここでは背景・枠線・太さ・カーソルのみを返す（→ 02 §7）。
  const getCellStyle = (params: any) => {
    if (params.node?.rowPinned === 'top') {
      return UNIT_ROW_CELL_STYLE;
    }
    const rowIndex = params.node?.rowIndex ?? -1;
    const field = params.colDef?.field;
    const cellKey = `${rowIndex}-${field}`;
    const isEditable = isCellEditable(rowIndex, field);
    // 数式ガイド ON のときのみ強調表示（選択中=青／参照元=緑／影響先=オレンジ）。
    const isClicked =
      showFormulaGuideRef.current &&
      clickedCellRef.current?.rowIndex === rowIndex &&
      clickedCellRef.current?.field === field;
    const isReference =
      showFormulaGuideRef.current &&
      highlightedCellsRef.current.references.includes(cellKey);
    const isAffected =
      showFormulaGuideRef.current &&
      highlightedCellsRef.current.affects.includes(cellKey);

    // 背景色と枠線の決定。
    // 「販売・経費計画申請承認」の合計行と同じロジック：編集可能セルは白、
    // 非編集セルは合計行(rowIndex 0)＝合計色、それ以外＝readonly。
    // 強調では背景を変えないため再代入しない。
    const backgroundColor = isEditable
      ? GRID_COLORS.editable
      : rowIndex === 0
        ? GRID_COLORS.total
        : GRID_COLORS.readonly;
    let border = 'none';

    // 強調は枠線だけで示し、背景は元のセルの配色を保つ。
    if (isClicked) {
      border = HL_CLICK_BORDER; // 青（クリックされたセル・実線）
    } else if (isReference) {
      border = HL_REF_BORDER; // 緑（このセルが参照するセル・実線）
    } else if (isAffected) {
      border = HL_AFFECT_BORDER; // オレンジ（このセルが影響を与えるセル・破線）
    }

    // 合計行（rowIndex === 0）：合計色の背景（ただし編集可能セルは白背景）。
    // 「販売・経費計画申請承認」の合計行と同じロジック。
    if (rowIndex === 0) {
      const row0BgColor = isEditable ? GRID_COLORS.editable : GRID_COLORS.total;

      return {
        backgroundColor: row0BgColor,
        fontWeight: 'bold',
        cursor: isEditable ? 'pointer' : 'default',
        border,
      };
    }

    return {
      backgroundColor,
      cursor: isEditable ? 'pointer' : 'default',
      border,
    };
  };

  // AG Grid用のカラム定義（3レベルヘッダー）
  // 「売上高」「条件口(合計)」「原価」「原価率」は項目として設けない。
  // 販売実績詳細では入力値だけを持ち、これらの集計・計算項目はBIで確認する
  //（→ ASD自販機チーム結論 2026-08-20）。
  // 「条件口」グループ（オペ条件口・帳合料・オペ金銭口/オペ条件口(手出票)）も
  // 同様に項目として設けない。いずれも数式ガイドの参照・依存には含まれていないため、
  // 削除しても強調表示のロジックには影響しない。
  const salesPlanColumnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: '',
        // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
        suppressColumnsToolPanel: true,
        field: 'category',
        width: 144,
        lockPosition: true,
        // 行タイトル（文字列）は左寄せ。横余白は共通クラス側（padding-left: 0.5rem）。
        cellClass: CATEGORY_CELL_CLASS,
        cellStyle: (params) => {
          if (params.node?.rowPinned === 'top') {
            return UNIT_ROW_CELL_STYLE;
          }
          const rowIndex = params.node?.rowIndex ?? -1;
          // 合計行（rowIndex === 0＝商流販売店計）は合計色の背景＋太字。
          // それ以外の行タイトルは太字にしない（太字は合計行のみ／→ 02 §7）。
          return {
            backgroundColor:
              rowIndex === 0 ? GRID_COLORS.total : GRID_COLORS.readonly,
            fontWeight: rowIndex === 0 ? 'bold' : 'normal',
          };
        },
      },
      {
        headerName: '社外売上高',
        children: [
          {
            headerName: '当月実績',
            children: [
              {
                headerName: '実績額',
                field: 'col20',
                cellClass: numericCellClass,
                minWidth: 96,
                editable: (params: any) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col20'),
                cellStyle: (params: any) => {
                  const baseStyle = getCellStyle(params);
                  const value = params.value || '';
                  const rowIndex = params.node?.rowIndex ?? -1;

                  // 値が無い（「-」表示）場合はより薄い灰色背景。
                  // ただし合計行（rowIndex 0）はハイフンでも合計色を維持する（合計行標準）。
                  if (rowIndex !== 0 && (!value || value.trim() === '－')) {
                    return {
                      ...baseStyle,
                      backgroundColor: GRID_COLORS.readonly,
                      cursor: 'default',
                    };
                  }

                  return baseStyle;
                },
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '計画比',
                field: 'col21',
                cellClass: numericCellClass,
                minWidth: 72,
                editable: (params: any) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col21'),
                cellStyle: (params: any) => {
                  if (params.node?.rowPinned === 'top') {
                    return UNIT_ROW_CELL_STYLE;
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col21');

                  // 数式ガイドの強調（クリック=青／参照先=緑／影響先=オレンジ）を優先適用
                  const highlight = getFormulaHighlight(rowIndex, 'col21');
                  if (highlight) {
                    return {
                      backgroundColor: formulaHighlightBg(rowIndex, isEditable),
                      border: highlight.border,
                      fontWeight: rowIndex === 0 ? 'bold' : 'normal',
                      cursor: 'pointer',
                    };
                  }

                  // 合計行（rowIndex === 0）の場合は薄い灰色の背景
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: GRID_COLORS.total,
                      fontWeight: 'bold',
                      cursor: isEditable ? 'pointer' : 'default',
                    };
                  }

                  // 出荷実販差行より下（rowIndex >= 5）は非編集背景
                  if (rowIndex >= 5) {
                    return {
                      backgroundColor: GRID_COLORS.readonly,
                      cursor: 'default',
                    };
                  }

                  // 通常の背景
                  return {
                    backgroundColor: GRID_COLORS.readonly,
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '前年比',
                field: 'col22',
                cellClass: numericCellClass,
                minWidth: 72,
                editable: (params: any) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col22'),
                cellStyle: (params: any) => {
                  if (params.node?.rowPinned === 'top') {
                    return UNIT_ROW_CELL_STYLE;
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col22');

                  // 数式ガイドの強調（クリック=青／参照先=緑／影響先=オレンジ）を優先適用
                  const highlight = getFormulaHighlight(rowIndex, 'col22');
                  if (highlight) {
                    return {
                      backgroundColor: formulaHighlightBg(rowIndex, isEditable),
                      border: highlight.border,
                      fontWeight: rowIndex === 0 ? 'bold' : 'normal',
                      cursor: 'pointer',
                    };
                  }

                  // 合計行（rowIndex === 0）の場合は薄い灰色の背景
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: GRID_COLORS.total,
                      fontWeight: 'bold',
                      cursor: isEditable ? 'pointer' : 'default',
                    };
                  }

                  // 出荷実販差行より下（rowIndex >= 5）は非編集背景
                  if (rowIndex >= 5) {
                    return {
                      backgroundColor: GRID_COLORS.readonly,
                      cursor: 'default',
                    };
                  }

                  // 通常の背景
                  return {
                    backgroundColor: GRID_COLORS.readonly,
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
            ],
          },
          {
            headerName: '函数',
            children: [
              {
                headerName: '函数',
                field: 'col23',
                cellClass: numericCellClass,
                minWidth: 80,
                editable: (params: any) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col23'),
                cellStyle: (params: any) => getCellStyle(params),
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '入数',
                field: 'col24',
                cellClass: numericCellClass,
                minWidth: 72,
                editable: (params: any) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col24'),
                cellStyle: (params: any) => {
                  if (params.node?.rowPinned === 'top') {
                    return UNIT_ROW_CELL_STYLE;
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col24');

                  // 数式ガイドの強調（クリック=青／参照先=緑／影響先=オレンジ）を優先適用
                  const highlight = getFormulaHighlight(rowIndex, 'col24');
                  if (highlight) {
                    return {
                      backgroundColor: formulaHighlightBg(rowIndex, isEditable),
                      border: highlight.border,
                      fontWeight: rowIndex === 0 ? 'bold' : 'normal',
                      cursor: 'pointer',
                    };
                  }

                  // その他（手売り）行は非編集背景
                  if (rowIndex === 4) {
                    return {
                      backgroundColor: GRID_COLORS.readonly,
                      cursor: 'default',
                    };
                  }

                  // 合計行（rowIndex === 0）の場合は薄い灰色の背景
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: GRID_COLORS.total,
                      fontWeight: 'bold',
                      cursor: isEditable ? 'pointer' : 'default',
                    };
                  }

                  return {
                    backgroundColor: isEditable
                      ? GRID_COLORS.editable
                      : GRID_COLORS.readonly,
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '本数',
                field: 'col25',
                cellClass: numericCellClass,
                minWidth: 72,
                editable: (params: any) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col25'),
                cellStyle: (params: any) => {
                  if (params.node?.rowPinned === 'top') {
                    return UNIT_ROW_CELL_STYLE;
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col25');

                  // 数式ガイドの強調（クリック=青／参照先=緑／影響先=オレンジ）を優先適用
                  const highlight = getFormulaHighlight(rowIndex, 'col25');
                  if (highlight) {
                    return {
                      backgroundColor: formulaHighlightBg(rowIndex, isEditable),
                      border: highlight.border,
                      fontWeight: rowIndex === 0 ? 'bold' : 'normal',
                      cursor: 'pointer',
                    };
                  }

                  // その他（手売り）行、アライアンス品行は非編集背景
                  if (rowIndex === 4 || rowIndex === 7) {
                    return {
                      backgroundColor: GRID_COLORS.readonly,
                      cursor: 'default',
                    };
                  }

                  // 合計行（rowIndex === 0）の場合は薄い灰色の背景
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: GRID_COLORS.total,
                      fontWeight: 'bold',
                      cursor: isEditable ? 'pointer' : 'default',
                    };
                  }

                  return {
                    backgroundColor: isEditable
                      ? GRID_COLORS.editable
                      : GRID_COLORS.readonly,
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '専用機PM/提携機PC',
                field: 'col26',
                cellClass: numericCellClass,
                minWidth: 136,
                editable: (params: any) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col26'),
                cellStyle: (params: any) => {
                  if (params.node?.rowPinned === 'top') {
                    return UNIT_ROW_CELL_STYLE;
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col26');

                  // 数式ガイドの強調（クリック=青／参照先=緑／影響先=オレンジ）を優先適用
                  const highlight = getFormulaHighlight(rowIndex, 'col26');
                  if (highlight) {
                    return {
                      backgroundColor: formulaHighlightBg(rowIndex, isEditable),
                      border: highlight.border,
                      fontWeight: rowIndex === 0 ? 'bold' : 'normal',
                      cursor: 'pointer',
                    };
                  }

                  // 商流販売店計行は太字の薄灰色
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: GRID_COLORS.total,
                      cursor: 'default',
                      fontWeight: 'bold',
                    };
                  }
                  // 実販、その他（手売り）、出荷実販差、前月出荷実販差行は非編集背景
                  if (
                    rowIndex === 1 ||
                    rowIndex === 4 ||
                    rowIndex === 5 ||
                    rowIndex === 6
                  ) {
                    return {
                      backgroundColor: GRID_COLORS.readonly,
                      cursor: 'default',
                    };
                  }

                  return {
                    backgroundColor: isEditable
                      ? GRID_COLORS.editable
                      : GRID_COLORS.readonly,
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
              {
                headerName: '稼働台数（コラム）',
                field: 'col27',
                cellClass: numericCellClass,
                minWidth: 128,
                editable: (params: any) =>
                  !params.node?.rowPinned &&
                  isCellEditable(params.node?.rowIndex ?? -1, 'col27'),
                tooltipValueGetter: getTooltip,
                cellStyle: (params: any) => {
                  if (params.node?.rowPinned === 'top') {
                    return UNIT_ROW_CELL_STYLE;
                  }
                  const rowIndex = params.node?.rowIndex ?? -1;
                  const isEditable = isCellEditable(rowIndex, 'col27');

                  // 数式ガイドの強調（クリック=青／参照先=緑／影響先=オレンジ）を優先適用
                  const highlight = getFormulaHighlight(rowIndex, 'col27');
                  if (highlight) {
                    return {
                      backgroundColor: formulaHighlightBg(rowIndex, isEditable),
                      border: highlight.border,
                      fontWeight: rowIndex === 0 ? 'bold' : 'normal',
                      cursor: 'pointer',
                    };
                  }

                  // 商流販売店計行は太字の薄灰色
                  if (rowIndex === 0) {
                    return {
                      backgroundColor: GRID_COLORS.total,
                      cursor: 'default',
                      fontWeight: 'bold',
                    };
                  }
                  // 実販、その他（手売り）、出荷実販差、前月出荷実販差行は非編集背景
                  if (
                    rowIndex === 1 ||
                    rowIndex === 4 ||
                    rowIndex === 5 ||
                    rowIndex === 6
                  ) {
                    return {
                      backgroundColor: GRID_COLORS.readonly,
                      cursor: 'default',
                    };
                  }

                  return {
                    backgroundColor: isEditable
                      ? GRID_COLORS.editable
                      : GRID_COLORS.readonly,
                    cursor: isEditable ? 'pointer' : 'default',
                  };
                },
                onCellValueChanged: handleCellChange,
              },
            ],
          },
          {
            headerName: '函単価',
            field: 'col28',
            cellClass: numericCellClass,
            minWidth: 72,
            editable: (params: any) =>
              !params.node?.rowPinned &&
              isCellEditable(params.node?.rowIndex ?? -1, 'col28'),
            tooltipValueGetter: getTooltip,
            cellStyle: (params: any) => {
              if (params.node?.rowPinned === 'top') {
                return UNIT_ROW_CELL_STYLE;
              }
              const rowIndex = params.node?.rowIndex ?? -1;
              const isEditable = isCellEditable(rowIndex, 'col28');

              // 数式ガイドの強調（クリック=青／参照先=緑／影響先=オレンジ）を優先適用
              const highlight = getFormulaHighlight(rowIndex, 'col28');
              if (highlight) {
                return {
                  backgroundColor: formulaHighlightBg(rowIndex, isEditable),
                  border: highlight.border,
                  fontWeight: rowIndex === 0 ? 'bold' : 'normal',
                  cursor: 'pointer',
                };
              }

              // 前月出荷実販差行は非編集背景
              if (rowIndex === 6) {
                return {
                  backgroundColor: GRID_COLORS.readonly,
                  cursor: 'default',
                };
              }

              // 合計行（rowIndex === 0）の場合は薄い灰色の背景
              if (rowIndex === 0) {
                return {
                  backgroundColor: GRID_COLORS.total,
                  fontWeight: 'bold',
                  cursor: isEditable ? 'pointer' : 'default',
                };
              }

              return {
                backgroundColor: isEditable
                  ? GRID_COLORS.editable
                  : GRID_COLORS.readonly,
                cursor: isEditable ? 'pointer' : 'default',
              };
            },
            onCellValueChanged: handleCellChange,
          },
        ],
      },
    ],
    // 列定義は再描画トリガとなる state のみ依存に含める（関数参照は意図的に除外）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [salesPlanData, clickedCell, highlightedCells]
  );

  // 文字サイズ・行の高さ・縦中央寄せは共通テーマ GRID_THEME（0.875rem）に一任し、
  // defaultColDef に cellStyle を置かない。列側の cellStyle は defaultColDef の
  // cellStyle を「マージではなく置換」するため、ここに寄せ・文字サイズを持たせると
  // 列ごとの指定漏れで表示が揺れる（→ 02 §7）。
  // ソート・フィルターは、数式ガイドが行インデックス固定を前提とするため無効のまま。
  // 販売実績の明細：値を変えたセルの強調（薄い黄＋オレンジ枠。元の値に戻したら解除 → 02 §7.2）。
  // 利用者が編集したセルだけが対象（計算し直したセルは対象外）。
  const salesActualChanged = useChangedCells();
  const salesActualGridContext = useMemo(
    () => ({ isCellChanged: salesActualChanged.isCellChanged }),
    [salesActualChanged.isCellChanged]
  );
  const handleSalesActualCellValueChanged = useCallback(
    (e: CellValueChangedEvent) => {
      salesActualChanged.trackCellChange(withComparableCellValues(e));
      e.api.refreshCells({
        rowNodes: [e.node],
        columns: [e.column],
        force: true,
      });
    },
    [salesActualChanged]
  );
  const defaultColDef = useMemo(
    () => ({
      // 編集できない列の見出しをグレーにする（GRID_DEFAULT_COL_DEF を引き継がないため明示。→ grid/gridCommon）
      headerStyle: gridHeaderStyle,
      sortable: false,
      resizable: true,
      filter: false,
      suppressMovable: true,
      suppressSizeToFit: false,
      suppressHeaderMenuButton: true,
      // 値が無いセルはグレーの半角「-」を表示する（共通の既定列設定と同じ。画面設計標準 3.11）。
      // 単位の行（固定上段）は単位の無い列を空欄のままにする（→ UI/UX UX-079）
      valueFormatter: (params: ValueFormatterParams) =>
        params.node?.rowPinned
          ? String(params.value ?? '')
          : formatEmptyAsDash(params),
      cellClassRules: {
        'cell-empty': GRID_DEFAULT_COL_DEF.cellClassRules!['cell-empty'],
        // 値を変えたセルの強調（判定はグリッドの context.isCellChanged → 02 §7.2）
        'ag-cell-changed':
          GRID_DEFAULT_COL_DEF.cellClassRules!['ag-cell-changed'],
      },
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
  };

  return (
    // 画面全体を縦フレックスにし、コンテンツと固定フッターの間の
    // スペーサー（flex-1）で余白を吸収して、固定フッターをウィンドウ底部
    // （＝main の下端）に張り付ける。コンテンツが短い場合でもフッターが
    // 底部に固定され、長い場合は sticky で追従する。
    <div className="min-w-300 flex min-h-full flex-col">
      <div className="px-6 pt-3 pb-3">
        {/* 画面名はヘッダー（システム名の右）に表示する */}
        <ScreenTitle title="販売実績詳細" />

        {/* 基本情報セクション（折り畳みカードは共通部品 CollapsibleCard に統一） */}
        <CollapsibleCard
          title="基本情報"
          open={isOpen}
          onOpenChange={setIsOpen}
          className="mb-6"
        >
          {/* 項目構成は従来どおり。表示体裁は販売計画(自販機)の基本情報へ統一し、
              等幅5列グリッド（PlanBasicInfoRow）で各行の項目を縦に揃える。
              コードを持つ項目は同画面と同じ参照元から「コード:名称」で表示する。 */}
          <div className="p-4">
            {/* 1行目: 対象年月（月ストリップ）とステータス。
                計画詳細(自販機)の基本情報と同じく、月ストリップの必要幅から
                対象年月を col-span-4 とし、ステータスを5列目に固定することで
                2行目以降の列位置と縦に揃う。 */}
            <PlanBasicInfoRow>
              <div className="col-span-4 flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>対象年月</label>
                <div className="min-w-0">
                  <MonthStripPicker
                    disabledMonths={PLAN_NO_DATA_MONTHS}
                    value={targetYearMonth}
                    onChange={setTargetYearMonth}
                  />
                </div>
              </div>

              <PlanBasicInfoField label="ステータス" value="未登録" />
            </PlanBasicInfoRow>

            {/* 2行目: 販売計画No.（対象年月が1行目を占有するため2行目へ移す）。
                計画詳細(自販機)の「販売計画No.」と同じく単独行に置き、3行目以降の
                項目が1列目から始まる並び（＝値が折り返さない列幅）を保つ。 */}
            <PlanBasicInfoRow>
              <PlanBasicInfoField label="販売計画No." />
              <PlanBasicInfoSpacer />
              <PlanBasicInfoSpacer />
              <PlanBasicInfoSpacer />
              <PlanBasicInfoSpacer />
            </PlanBasicInfoRow>

            {/* 3行目 */}
            <PlanBasicInfoRow>
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
              />
              <PlanBasicInfoSpacer />
              <PlanBasicInfoSpacer />
            </PlanBasicInfoRow>

            {/* 4行目（最終行のため下区切り罫線なし） */}
            <PlanBasicInfoRow divider={false}>
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
          </div>
        </CollapsibleCard>

        {/* 販売実績を配置 */}
        <div className="flex flex-col gap-4">
          {/* 販売実績一覧セクション */}
          <CollapsibleCard
            title="販売実績"
            open={isSalesPlanOpen}
            onOpenChange={setIsSalesPlanOpen}
            headerActions={
              <>
                {/* 数式ガイドの ON/OFF（共通部品。ON のときは凡例も出す → 02 §6・UX-063） */}
                <FormulaGuideToggle
                  shown={isFormulaGuideShown}
                  onChange={setIsFormulaGuideShown}
                />
              </>
            }
          >
            <div className="p-4">
              <div className="sales-plan-grid overflow-x-auto w-full">
                <style>{`
                    /* ヘッダー・データ行は共通テーマ(GRID_THEME / themeBalham)本来の
                       表示（背景・文字色・行/列罫線・縞模様・選択色・行ホバー色）を
                       継承する。独自の header 背景／罫線／zebra／ホバー色は上書きせず、
                       レイアウト（横余白）のみ指定する。
                       ※ ヘッダーの寄せは grid.css の共通指定（左寄せ）に委ねる。
                       ※ セルの横寄せは cellClass（grid.css の cell-left /
                          cell-right / cell-center）で指定し、ここでは指定しない
                          （セルへの display:flex は標準の省略表示を壊すため → 02 §7）。 */

                    /* セルの横余白は共通クラス（cell-left / cell-right の 0.5rem）と
                       同値に揃える。背景色の変化はなめらかに遷移させる。 */
                    .sales-plan-grid .ag-cell {
                      padding: 0 0.5rem;
                      transition: background-color 0.2s ease;
                    }

                    /* 左固定列は行の背景をそのまま継承する（固定列だけ背景が浮かないように）。 */
                    .sales-plan-grid .ag-cell-left-pinned {
                      background-color: inherit !important;
                    }

                    /* 固定上段（単位の行）の太字・下罫線。計画詳細(自販機)の
                       販売計画グリッドと同じ指定に揃える。
                       ※ AG Grid が固定行へ付与するクラスは ag-row-pinned。
                          ag-row-pinned-top は存在せず、指定が効かないため使わない。 */
                    .sales-plan-grid .ag-row-pinned {
                      font-weight: bold;
                      border-bottom: 0.125rem solid ${GRID_COLORS.pinnedRowBorder};
                    }

                    /* 固定上段（単位の行＝floating top）の背景・文字色・太さを
                       themeBalham のヘッダー用変数に束ねる。インラインの cellStyle 背景を
                       上書きするため !important。「販売・経費計画申請承認」の固定上段と
                       同じ標準準拠。 */
                    .sales-plan-grid .ag-floating-top .ag-cell {
                      background-color: var(--ag-header-background-color) !important;
                      color: var(--ag-header-text-color, var(--ag-header-foreground-color));
                      font-weight: var(--ag-header-font-weight, 600);
                    }

                    /* 商流販売店計行（rowIndex 0）の背景・太字は cellStyle / getRowStyle
                       側で合計色(GRID_COLORS.total)として付与するため、ここでは
                       太字のみを指定する（合計行標準準拠）。 */
                    .sales-plan-grid .ag-row[row-index="0"]:not(.ag-row-pinned) {
                      font-weight: bold;
                    }
                  `}</style>
                {/* 規約例外（集計表）：実績額・計画比・前年比の行が決まっている集計表のため、件数表示（statusBar）は付けない */}
                <AgGridReact
                  className="grid-summary-table"
                  rowData={salesPlanData}
                  context={salesActualGridContext}
                  onCellValueChanged={handleSalesActualCellValueChanged}
                  columnDefs={salesPlanColumnDefs}
                  defaultColDef={defaultColDef}
                  // defaultColDef で filter: false のため、型によるフィルタの追加を止める（→ grid/gridCommon）
                  columnTypes={GRID_NO_FILTER_COLUMN_TYPES}
                  pinnedTopRowData={unitRowData}
                  getRowId={getSalesPlanRowId}
                  getRowStyle={getRowStyle}
                  // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
                  tooltipShowMode="standard"
                  suppressMovableColumns={true}
                  stopEditingWhenCellsLoseFocus={true}
                  domLayout="autoHeight"
                  // 数式ガイドはシングルクリックのまま維持（ガイドON時のみ動作）。
                  onCellClicked={handleCellClick}
                  // 共通基本プロパティ（Enter縦移動・Excelライク編集・テキスト選択・列仮想化抑止）。
                  // singleClickEdit を持たないため編集はダブルクリック／F2／直接入力で開始（標準準拠。Enterは移動のみ）。
                  {...GRID_BASE_PROPS}
                  {...gridColumnStateProps}
                />
              </div>
            </div>
          </CollapsibleCard>
        </div>
      </div>

      {/* コンテンツとフッターの間の余白を吸収し、フッターをウィンドウ底部へ押し下げるスペーサー */}
      <div className="flex-1" aria-hidden="true" />

      {/* 固定フッター - ボタン。
          主要アクションは shadcn Button ではなくネイティブ button ＋ globals.css の
          共通クラス（btn-action-base ＋ 配色クラス）で組む。高さ・角丸・フォーカス
          リング・アイコンとの余白（gap）はクラス側が持つため直書きしない
          （→ 02 §6・§6「共通スタイルクラスを優先使用」）。
          配色は 登録（保存系）=青・一覧へ戻る=アウトラインとし、計画詳細(自販機)・
          支払詳細(自販機)のフッターと揃える。 */}
      <div className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10">
        <div className="flex flex-wrap gap-3 justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-action-base btn-action-outline"
              aria-label="一覧へ戻る"
            >
              <ArrowLeft className="h-4 w-4" />
              一覧へ戻る
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-action-base btn-action-blue"
              aria-label="登録"
            >
              <Save className="h-4 w-4" />
              登録
            </button>
          </div>
        </div>
      </div>

      {/* 数式ガイドの浮遊ツールチップ（共通部品。式・実値の各行は折り返さない） */}
      <FloatingFormulaTooltip tooltip={tooltipPosition} />
    </div>
  );
}

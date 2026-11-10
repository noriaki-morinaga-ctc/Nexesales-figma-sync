import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ColGroupDef,
  GetRowIdParams,
  ICellRendererParams,
} from 'ag-grid-community';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { MonthPicker } from '../../../ui/month-picker';
import {
  GRID_BASE_PROPS,
  GRID_COLORS,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
} from '../../../grid';
import {
  computeMonth,
  displayOf,
  type AggAmounts,
  type AggFilter,
} from '../../../../utils/sales-plan/common/aggregationCalc';
import type { AggregationSource } from '../../../../constants/aggregationSourceData';
import { isActualReflectedMonth } from '../../../../constants/actualMonths';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanRate,
} from '../../../../utils/sales-plan/common/planDetailNumberFormat';
import { managementClassCodeOf } from '../../../../constants/comboFieldOptions';
import { promotionAccountLabel } from '../../../../constants/promotionAccountItems';

// 種類別セルの表示ラベルを組み立てる（CategoryCellRenderer が pre-line で改行表示）。
//   1行目：勘定科目（コード＋名称）… インデントなし
//   2行目：管理区分（区分値＋名称）… 全角1文字インデント
// 階層が一目で分かるよう行頭を字下げする。white-space: pre-line は半角スペースを
// 行頭で除去するため、除去されない全角スペース（U+3000）でインデントする。
// 集計単位は「勘定科目＋管理区分」までとし、管理区分に属する管理コード
// （RA001 店頭販売販促・RA002 チラシ協賛A 等）はラベルに列挙しない。
// 管理コード単位の内訳は拡売費計画Grid（PlanNonProductExpensePane）で確認する。
// 管理区分はその拡売費計画Grid と同じマスタ（comboFieldOptions）を
// 参照するため、値の二重管理は発生しない。
// 管理区分を持たない行（拡売費（合計）・区分計・ロケ補填〜販売器具費）は勘定科目のみの1行表示。
const LABEL_INDENT = '　'; // 全角スペース（pre-line で行頭が詰められないため）

const buildCategoryLabel = (
  accountItem: string,
  managementClass?: string
): string => {
  if (!managementClass) return accountItem;
  const classLine = `${LABEL_INDENT}${managementClassCodeOf(managementClass)} ${managementClass}`;
  return [accountItem, classLine].join('\n');
};

// ── 月キー定義 ─────────────────────────────────────────────────────────────
const MONTH_KEYS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;
type MonthKey = (typeof MONTH_KEYS)[number];

// ── データ型 ───────────────────────────────────────────────────────────────
interface PromotionCostsAggregationData {
  category: string;
  description: string;
  subItem: string;
  jan: number | string | null;
  feb: number | string | null;
  mar: number | string | null;
  apr: number | string | null;
  may: number | string | null;
  jun: number | string | null;
  jul: number | string | null;
  aug: number | string | null;
  sep: number | string | null;
  oct: number | string | null;
  nov: number | string | null;
  dec: number | string | null;
  isPercentage?: boolean;
  isFirstInGroup?: boolean;
  groupRowSpan?: number;
  groupName?: string;
  // 集計制御
  groupType?: 'sales-linked' | 'non-linked';
  isAggregate?: boolean;
  aggregateType?: 'total' | 'sales-linked' | 'non-linked';
  // 種類別のドリルダウン階層（0=合計 / 1=区分計 / 2=明細）。インデント表示に使用。
  drillLevel?: number;
  // ドリルダウン制御：予算・前年実績は親ラベル行（展開で「額」「率」の子行を表示）
  isDrillParent?: boolean; // 予算・前年実績（クリックで開閉する親ラベル行）
  expandKey?: string; // 親行の識別キー（予算 / 前年実績）
  childOf?: string; // 子行（額 / 率）が属する親の expandKey
  displayLabel?: string; // サブ項目セルの表示名（額 / 率 など）。未指定時は subItem を表示
  isDiffRow?: boolean; // 差（計画実績−予算/前年実績金額）の行。マイナスは△＋赤で表示する
  isGroupHeaderRow?: boolean; // 親ラベル行（データなし＝セルは空欄・計算対象外）
  // 種類別の項目階層（年間集計と同じ折りたたみ表示）。区分計（51000／52000）の下に口明細をぶら下げる。
  itemParent?: string; // 親項目の groupName（口明細 → 区分計）
  itemHasChildren?: boolean; // 子項目（口明細）を持つ項目か
  itemChildCount?: number; // 直下の子項目数（折りたたみ時に件数表示）
}

// 行ID（→ 画面設計標準 4.7）。種類別（groupName＝勘定科目コード付きラベル）は項目ごとに一意、
// サブ項目（計画／実績・予算・予算差 等）は項目内で一意のため、その組み合わせで一意にする。
// ただし項目の先頭行は結合行数（groupRowSpan）も含める。AG Grid の rowSpan はセルの生成時にしか
// 評価されないため、開閉で可視行数が変わったときは先頭行を作り直させて結合を正しく保つ。
const getRowId = (params: GetRowIdParams<PromotionCostsAggregationData>) => {
  const { groupName, subItem, isFirstInGroup, groupRowSpan } = params.data;
  const baseId = `${groupName}::${subItem}`;
  return isFirstInGroup ? `${baseId}::span${groupRowSpan ?? 1}` : baseId;
};

// ── 集計ヘルパー関数 ────────────────────────────────────────────────────────

const sumDetailRows = (
  api: any,
  aggType: 'total' | 'sales-linked' | 'non-linked',
  subItem: string,
  monthKey: string
): number => {
  let sum = 0;
  api.forEachNode((node: any) => {
    const row = node.data as PromotionCostsAggregationData;
    if (!row || row.isAggregate) return;
    if (aggType !== 'total' && row.groupType !== aggType) return;
    if (row.subItem !== subItem) return;
    const val = (row as any)[monthKey];
    if (typeof val === 'number') sum += val;
  });
  return sum;
};

const getGroupValue = (
  api: any,
  groupName: string,
  subItem: string,
  monthKey: string
): number => {
  let result = 0;
  api.forEachNode((node: any) => {
    const row = node.data as PromotionCostsAggregationData;
    if (!row || row.isAggregate) return;
    if (row.groupName !== groupName || row.subItem !== subItem) return;
    const val = (row as any)[monthKey];
    if (typeof val === 'number') result += val;
  });
  return result;
};

const computeRatio = (
  numerator: number,
  denominator: number
): number | string => {
  if (!denominator || denominator === 0) return '-';
  return (numerator / denominator) * 100;
};

/**
 * 予算（直接保持値）の集計行の月値を取得する。
 * 売上連動・売上非連動は data に保持。拡売費（total）は二者の和。
 */
const getAggBudgetValue = (
  api: any,
  aggType: 'total' | 'sales-linked' | 'non-linked',
  monthKey: string
): number => {
  if (aggType !== 'total') return 0; // 非 total は data[monthKey] を直接使用
  let total = 0;
  api.forEachNode((node: any) => {
    const row = node.data as PromotionCostsAggregationData;
    if (!row || !row.isAggregate) return;
    if (row.subItem !== '予算') return;
    if (
      row.aggregateType !== 'sales-linked' &&
      row.aggregateType !== 'non-linked'
    )
      return;
    const val = (row as any)[monthKey];
    if (typeof val === 'number') total += val;
  });
  return total;
};

const computeMonthValue = (
  data: PromotionCostsAggregationData,
  api: any,
  monthKey: string
): number | string | null => {
  if (!data || !api) return null;
  // 親ラベル行（予算/前年実績）はデータを持たないため空欄（計算対象外）
  if (data.isGroupHeaderRow) return null;
  const subItem = data.subItem;
  const isRatio = subItem === '前年比' || subItem === '予算比';

  if (isRatio) {
    const numSubItem = '計画／実績';
    let num: number;
    let den: number;
    if (data.isAggregate) {
      num = sumDetailRows(api, data.aggregateType!, numSubItem, monthKey);
      if (subItem === '前年比') {
        den = sumDetailRows(api, data.aggregateType!, '前年実績', monthKey);
      } else {
        // 予算比: 分母は同じgroupNameの予算行から取得
        if (data.aggregateType === 'total') {
          den = getAggBudgetValue(api, 'total', monthKey);
        } else {
          // 売上連動・売上非連動の場合、予算行から値を取得
          let budgetValue = 0;
          api.forEachNode((node: any) => {
            const row = node.data as PromotionCostsAggregationData;
            if (!row || !row.isAggregate) return;
            if (row.groupName !== data.groupName || row.subItem !== '予算')
              return;
            const val = (row as any)[monthKey];
            if (typeof val === 'number') budgetValue = val;
          });
          den = budgetValue;
        }
      }
    } else {
      num = getGroupValue(api, data.groupName!, numSubItem, monthKey);
      den =
        subItem === '前年比'
          ? getGroupValue(api, data.groupName!, '前年実績', monthKey)
          : getGroupValue(api, data.groupName!, '予算', monthKey);
    }
    return computeRatio(num, den);
  }

  if (data.isAggregate) {
    // 予算行は直接保持（total のみ集計行から合算）
    if (subItem === '予算') {
      if (data.aggregateType === 'total')
        return getAggBudgetValue(api, 'total', monthKey);
      return (data as any)[monthKey]; // 売上連動・売上非連動は data に格納済み
    }
    return sumDetailRows(api, data.aggregateType!, subItem, monthKey);
  }

  return (data as any)[monthKey];
};

const computeRangeValue = (
  data: PromotionCostsAggregationData,
  api: any,
  monthRange: readonly string[]
): number | string | null => {
  if (!data || !api) return null;
  // 親ラベル行（予算/前年実績）はデータを持たないため空欄（計算対象外）
  if (data.isGroupHeaderRow) return null;
  const subItem = data.subItem;
  const isRatio = subItem === '前年比' || subItem === '予算比';

  const sumRange = (si: string, isAgg: boolean, typeOrGroup: string): number =>
    monthRange.reduce((s, m) => {
      if (isAgg) return s + sumDetailRows(api, typeOrGroup as any, si, m);
      else return s + getGroupValue(api, typeOrGroup, si, m);
    }, 0);

  const sumAggBudgetRange = (
    aggType: 'total' | 'sales-linked' | 'non-linked'
  ): number =>
    monthRange.reduce((s, m) => {
      if (aggType === 'total') return s + getAggBudgetValue(api, 'total', m);
      // 売上連動・売上非連動の場合、予算行から値を取得
      let budgetValue = 0;
      api.forEachNode((node: any) => {
        const row = node.data as PromotionCostsAggregationData;
        if (!row || !row.isAggregate) return;
        if (row.aggregateType !== aggType || row.subItem !== '予算') return;
        const val = (row as any)[m];
        if (typeof val === 'number') budgetValue = val;
      });
      return s + budgetValue;
    }, 0);

  if (isRatio) {
    let num: number;
    let den: number;
    if (data.isAggregate) {
      num = sumRange('計画／実績', true, data.aggregateType!);
      if (subItem === '前年比') {
        den = sumRange('前年実績', true, data.aggregateType!);
      } else {
        den = sumAggBudgetRange(data.aggregateType!);
      }
    } else {
      num = sumRange('計画／実績', false, data.groupName!);
      den =
        subItem === '前年比'
          ? sumRange('前年実績', false, data.groupName!)
          : sumRange('予算', false, data.groupName!);
    }
    return computeRatio(num, den);
  }

  if (data.isAggregate) {
    if (subItem === '予算') return sumAggBudgetRange(data.aggregateType!);
    return sumRange(subItem, true, data.aggregateType!);
  }

  return monthRange.reduce((s, m) => {
    const val = (data as any)[m];
    return s + (typeof val === 'number' ? val : 0);
  }, 0);
};

// ── ハイライト対象キー生成ヘルパー ─────────────────────────────────────────
// キー形式: "{colId}_{rowIndex}"
// colId は月列: "jan"/"feb"/.., 集計列: "cumulative"/"annual"/"firstHalf"/"secondHalf"

type HighlightKey = string; // "{colId}_{rowIndex}"

/**
 * グリッド上の rowIndex を groupName で引く。
 * subItem 一致の行インデックスを返す（isAggregate で絞れる）。
 */
const findRowIndex = (
  api: any,
  groupName: string,
  subItem: string,
  isAggregate: boolean
): number => {
  let found = -1;
  api.forEachNode((node: any) => {
    const row = node.data as PromotionCostsAggregationData;
    if (!row) return;
    if (
      row.groupName === groupName &&
      row.subItem === subItem &&
      !!row.isAggregate === isAggregate
    ) {
      found = node.rowIndex;
    }
  });
  return found;
};

// 数値セルの文字色。赤字は「差率（予算比／前年比）行の100%超過」のときのみ返し、
// それ以外は undefined（＝テーマ既定の黒字）。計画／実績・予算・前年実績・差の各行は、
// 選択実績セル（青枠）でもマイナス値でも常に黒字とする。
// 色は hex 直書きせず共通の GRID_COLORS.overText を使用する。
const rateOverTextColor = (
  data: PromotionCostsAggregationData | undefined,
  value: unknown
): string | undefined => {
  const subItem = data?.subItem || '';
  const isRatioRow = subItem === '予算比' || subItem === '前年比';
  return isRatioRow && typeof value === 'number' && value > 100
    ? GRID_COLORS.overText
    : undefined;
};

// セルレンダラへ AG Grid の context で渡す開閉状態。
// 列定義（columnDefs）を作り直さずに chevron の向き・件数表示を追従させるために使う
//（作り直すと列幅が定義値に戻り、自動幅調整までの一瞬だけ表が横に伸びて見えるため）。
interface PromotionCostGridContext {
  expandedItems: Set<string>;
  expandedRows: Set<string>;
  toggleItem: (itemName: string) => void;
}

// ── コンポーネント ─────────────────────────────────────────────────────────
interface PromotionCostTotalTabProps {
  /** 親から表示単位を制御する場合に渡す（指定時は内部の表示単位トグルを非表示にする） */
  displayUnit?: 'yen' | 'thousand';
  /** 集計単位フィルタ（メタブランド①×容器容量G②＋除外ペア）。集計値の計算に使用。 */
  aggFilter?: AggFilter;
  /** 集計ソース（販売計画(詳細)・拡売費計画グリッド由来）。集計値の算出元。 */
  source: AggregationSource;
  /**
   * 集計の基準月（'1'〜'12'）。親の基本情報の対象年月に連動させる場合に渡す。
   * 指定時は内部の累計月選択を出さず、この月で「○月」「○月迄累計」を集計する。
   */
  targetMonth?: string;
}

export function PromotionCostTotalTab({
  displayUnit: displayUnitProp,
  aggFilter = {},
  source,
  targetMonth,
}: PromotionCostTotalTabProps) {
  const [internalMonth, setSelectedMonth] = useState('7');
  const selectedMonth = targetMonth ?? internalMonth;
  const [internalDisplayUnit, setInternalDisplayUnit] = useState<'円' | '千円'>(
    '円'
  );
  // 親から displayUnit（'yen'|'thousand'）が渡された場合は制御モード（内部トグルは非表示）
  const displayUnit: '円' | '千円' =
    displayUnitProp === undefined
      ? internalDisplayUnit
      : displayUnitProp === 'yen'
        ? '円'
        : '千円';

  // 数値がセルからはみ出さないよう、各列を内容に合わせて自動幅調整する。
  const gridRef = useRef<any>(null);
  const handleAutoSizeColumns = useCallback(() => {
    const api = gridRef.current?.api;
    if (api) api.autoSizeAllColumns(false);
  }, []);
  const [columnVisibility] = useState({
    cumulative: true,
    annual: true,
    firstHalf: true,
    secondHalf: true,
    jan: true,
    feb: true,
    mar: true,
    apr: true,
    may: true,
    jun: true,
    jul: true,
    aug: true,
    sep: true,
    oct: true,
    nov: true,
    dec: true,
  });

  // ── ⑤ ハイライト状態 ────────────────────────────────────────────────────
  const [highlightTargets, setHighlightTargets] = useState<HighlightKey[]>([]);

  // ドリルダウン展開状態：`${groupName}::${expandKey}`（予算 / 前年実績）。既定は折りたたみ。
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleDrillRow = useCallback((groupName: string, expandKey: string) => {
    const key = `${groupName}::${expandKey}`;
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  // 種類別の項目階層の展開状態（展開中の区分計の groupName）。年間集計と同じく既定は折りたたみ。
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const toggleItem = useCallback((itemName: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  }, []);

  const rowData = useMemo<PromotionCostsAggregationData[]>(() => {
    const MONTH_KEYS_ARR = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ] as const;
    const nullMonths: Record<string, null> = {
      jan: null,
      feb: null,
      mar: null,
      apr: null,
      may: null,
      jun: null,
      jul: null,
      aug: null,
      sep: null,
      oct: null,
      nov: null,
      dec: null,
    };

    // 各月の計算エンジン値（集計単位フィルタ適用）。集計項目xlsx「拡売費集計」準拠。
    const monthAmounts = MONTH_KEYS_ARR.map((_, i) =>
      computeMonth(source, i + 1, aggFilter)
    );
    const series = (fn: (i: number) => number): Record<string, number> => {
      const o: Record<string, number> = {};
      MONTH_KEYS_ARR.forEach((m, i) => (o[m] = fn(i)));
      return o;
    };

    // 予算を持つのは拡売費（合計）と区分計（51000 売上連動／52000 固定費）だけ。
    // 口別の明細（51100・51200・51300・52100・52200・52300）と
    // ロケ補填〜販売器具費（52400・52500・52600・52700）は
    // 予算が存在しない粒度のため、サブ項目の予算・予算差・予算比の行を出さない。
    const BUDGET_KEYS: ReadonlySet<keyof AggAmounts> = new Set([
      'promo',
      'salesLinked',
      'fixed',
    ]);

    // 1拡売費項目（金額）について 計画/実績・予算(→予算比/金額)・前年実績(→前年比/金額) の行を作る。
    // hasBudget=false の行は予算系3行（予算・予算差・予算比）を生成しない。
    const buildGroup = (
      category: string,
      key: keyof AggAmounts,
      drillLevel: number = 1,
      hasBudget: boolean = true
    ): PromotionCostsAggregationData[] => {
      const d = (i: number) => displayOf(monthAmounts[i][key], false);
      const plan = series((i) => d(i).plan);
      const budget = series((i) => d(i).budget);
      const prev = series((i) => d(i).prevYear);
      // 表示整数化：formatNumber の金額規則（千円=四捨五入 /1000／円=四捨五入）と同一。
      // 金額は円・千円いずれの表示単位でも整数表示にする（年間集計タブと同じ規則）。
      const displayAmount = (v: number) =>
        displayUnit === '千円' ? Math.round(v / 1000) : Math.round(v);
      // 差（計画実績 − 予算/前年実績）。
      // 「各項を表示と同じ規則で整数化してから引く」ことで、画面の計画実績 − 画面の予算/前年実績
      // と常に一致させる（丸めてから引く方式。端数処理由来の±1を解消）。
      // 差行は既に表示単位のため、formatNumber 側では再度 /1000 しない（isDiffRow 分岐）。
      const budgetDiff = series(
        (i) => displayAmount(d(i).plan) - displayAmount(d(i).budget)
      );
      const prevDiff = series(
        (i) => displayAmount(d(i).plan) - displayAmount(d(i).prevYear)
      );
      const groupName = category;
      const rows: PromotionCostsAggregationData[] = [
        {
          category,
          description: '',
          subItem: '計画／実績',
          ...plan,
          isFirstInGroup: true,
          groupRowSpan: 5,
          groupName,
        },
        {
          category: '',
          description: '',
          subItem: '予算',
          ...budget,
          groupName,
          isDrillParent: true,
          expandKey: '予算',
          displayLabel: '予算',
        },
        // 差（子行）。既存の予算比の手前に配置し、負値は△＋赤（フォーマッタ/配色側）。
        {
          category: '',
          description: '',
          subItem: '予算差',
          ...budgetDiff,
          groupName,
          childOf: '予算',
          displayLabel: '予算差',
          isDiffRow: true,
        } as PromotionCostsAggregationData,
        {
          category: '',
          description: '',
          subItem: '予算比',
          ...nullMonths,
          isPercentage: true,
          groupName,
          childOf: '予算',
          // 「予算比」表記（計算式は計画実績÷予算のまま）。
          displayLabel: '予算比',
        },
        {
          category: '',
          description: '',
          subItem: '前年実績',
          ...prev,
          groupName,
          isDrillParent: true,
          expandKey: '前年実績',
          displayLabel: '前年実績',
        },
        {
          category: '',
          description: '',
          subItem: '前年差',
          ...prevDiff,
          groupName,
          childOf: '前年実績',
          displayLabel: '前年差',
          isDiffRow: true,
        } as PromotionCostsAggregationData,
        {
          category: '',
          description: '',
          subItem: '前年比',
          ...nullMonths,
          isPercentage: true,
          groupName,
          childOf: '前年実績',
          displayLabel: '前年比',
        },
      ];
      // 予算を持たない行は予算（親）・予算差・予算比の3行をまとめて除外する。
      // 子行は childOf で親を指すため、親と同じ判定で取り漏らさない。
      const visibleRows = hasBudget
        ? rows
        : rows.filter((r) => r.subItem !== '予算' && r.childOf !== '予算');
      // ドリルダウン階層を全行に付与（種類別セルのインデントに使用）
      return visibleRows.map((r) => ({ ...r, drillLevel }));
    };

    // 種類別の表示ラベルは buildCategoryLabel で組み立てる（勘定科目／管理区分）。
    // 勘定科目は constants/promotionAccountItems、管理区分は
    // constants/comboFieldOptions を参照する（画面側に値を持たない）。
    // drillLevel: 0=拡売費合計 / 1=区分計（売上連動・固定費・ロケ補填等）/ 2=口明細
    // 第2引数の集計キーは promotionAccountItems のキーと共通（集計値と勘定科目の対応を保つ）。
    // itemParent: 口明細の親となる区分計の集計キー（51000／52000 のドリルダウンに使用）。
    const group = (
      key: keyof AggAmounts,
      drillLevel: number,
      managementClass?: string,
      itemParent?: keyof AggAmounts
    ) =>
      buildGroup(
        buildCategoryLabel(promotionAccountLabel(key), managementClass),
        key,
        drillLevel,
        BUDGET_KEYS.has(key)
      ).map((r) =>
        itemParent ? { ...r, itemParent: promotionAccountLabel(itemParent) } : r
      );

    const rows = [
      ...group('promo', 0),
      ...group('salesLinked', 1),
      ...group('salesLinkedA', 2, '売上連動拡売費A口', 'salesLinked'),
      ...group('salesLinkedB', 2, '売上連動拡売費B口', 'salesLinked'),
      ...group('salesLinkedH', 2, '売上連動拡売費本社口', 'salesLinked'),
      ...group('fixed', 1),
      ...group('fixedA', 2, '拡売費(固定費)A口', 'fixed'),
      ...group('fixedB', 2, '拡売費(固定費)B口', 'fixed'),
      ...group('fixedH', 2, '拡売費(固定費)本社口', 'fixed'),
      ...group('locFill', 1),
      ...group('column', 1),
      ...group('lease', 1),
      ...group('equip', 1),
    ];
    // 区分計（51000／52000）に子項目の有無と件数を付与する（開閉ボタン・件数表示に使用）
    const childNames = (name: string) =>
      new Set(
        rows.filter((r) => r.itemParent === name).map((r) => r.groupName)
      );
    return rows.map((r) => {
      const cc = childNames(r.groupName ?? '').size;
      return cc > 0 ? { ...r, itemHasChildren: true, itemChildCount: cc } : r;
    });
    // 差（金額）は表示単位で整数化してから引くため displayUnit に依存する
  }, [source, aggFilter, displayUnit]);

  // ドリルダウン展開状態に応じた表示行。折りたたみ中の区分計の口明細・子行（予算比/前年比）を除外し、
  // ブロック先頭（isFirstInGroup＝計画／実績）区切りで rowSpan（可視行数）を再計算する。
  const displayRows = useMemo<PromotionCostsAggregationData[]>(() => {
    const visible = rowData
      .filter((r) => {
        // 項目階層：親の区分計が折りたたみ中なら口明細を非表示
        if (r.itemParent && !expandedItems.has(r.itemParent)) return false;
        return r.childOf
          ? expandedRows.has(`${r.groupName}::${r.childOf}`)
          : true;
      })
      .map((r) => ({ ...r }));
    // ブロック先頭（isFirstInGroup）から次の先頭までの可視行数を groupRowSpan に設定
    for (let i = 0; i < visible.length; i++) {
      if (visible[i].isFirstInGroup) {
        let span = 1;
        let j = i + 1;
        while (j < visible.length && !visible[j].isFirstInGroup) {
          span++;
          j++;
        }
        visible[i].groupRowSpan = span;
      } else {
        visible[i].groupRowSpan = 1;
      }
    }
    return visible;
  }, [rowData, expandedRows, expandedItems]);

  // セルレンダラに渡す開閉状態（AG Grid 標準の context）。開閉時は displayRows の変化で
  // 下の refreshCells({ force: true }) が走り、各セルがこの最新の context で再描画される。
  const gridContext = useMemo<PromotionCostGridContext>(
    () => ({ expandedItems, expandedRows, toggleItem }),
    [expandedItems, expandedRows, toggleItem]
  );

  // 表示行・表示単位（円/千円）が変わるたびに、セルを強制再描画してから列幅を再調整する。
  // 表示単位の切替は rowData と columnDefs（valueFormatter）を同時に差し替えるため、
  // refreshCells を明示しないと AG Grid が旧フォーマッタの結果を再利用し、
  // 表示が1操作分遅れる（円を押すと千円表示のままになる）。
  useEffect(() => {
    const id = setTimeout(() => {
      gridRef.current?.api?.refreshCells({ force: true });
      handleAutoSizeColumns();
    }, 0);
    return () => clearTimeout(id);
  }, [displayRows, displayUnit, handleAutoSizeColumns]);

  // 計算用：折りたたみ中の子行（額/率）も含む全行を走査する擬似 API。
  // グリッドの api.forEachNode は表示中の行のみ走査するため、ドリルダウン折りたたみ時に
  // 予算額・前年実績額・率（=計画/予算 等）の集計が 0 になるのを防ぐ。
  const fullDataApi = useMemo(
    () => ({
      forEachNode: (
        cb: (node: { data: PromotionCostsAggregationData }) => void
      ) => rowData.forEach((d) => cb({ data: d })),
    }),
    [rowData]
  );

  // 差（金額）行の各列の値。その列に含まれる月の「生値合計」を表示規則（千円=四捨五入 /1000／
  // 円=四捨五入）で丸めてから引く。計画実績・予算/前年実績セルも同じ生値合計→表示時丸めで
  // 表示されるため、差(列) == 画面表示の計画実績(列) − 予算/前年実績(列) が円・千円とも常に一致する。
  const promoDiffValue = (
    data: PromotionCostsAggregationData,
    months: readonly string[]
  ): number => {
    const roundBy = (v: number) =>
      displayUnit === '千円' ? Math.round(v / 1000) : Math.round(v);
    const other = data.subItem === '予算差' ? '予算' : '前年実績';
    const planSum = months.reduce(
      (s, m) =>
        s + getGroupValue(fullDataApi, data.groupName!, '計画／実績', m),
      0
    );
    const otherSum = months.reduce(
      (s, m) => s + getGroupValue(fullDataApi, data.groupName!, other, m),
      0
    );
    return roundBy(planSum) - roundBy(otherSum);
  };

  // ── フォーマット ──────────────────────────────────────────────────────────
  const formatNumber = (
    value: number | string | null,
    isPercentage: boolean = false,
    isDiffRow: boolean = false
  ): string => {
    if (value === null) return '';
    if (value === '-') return '-';
    const num = value as number;
    // 率は小数点以下2桁を四捨五入し、小数点以下1桁・3桁区切りで表示する
    //（グラフ・詳細・年間集計タブと同じ丸め＝販売計画(集計)全体で桁を揃える）。
    if (isPercentage) return formatPlanRate(num, PLAN_DETAIL_DIGITS.rate);
    // 差行は rowData 側で既に表示単位（円/千円）へ整数化済みのため、ここでは再変換しない。
    // （表示単位で整数化してから引いた値なので、画面の計画実績 − 予算/前年実績 と一致する）
    // 表示単位が千円の場合は下3桁を削除（四捨五入）。円は四捨五入して整数にする。
    const displayValue = isDiffRow
      ? num
      : displayUnit === '千円'
        ? Math.round(num / 1000)
        : Math.round(num);
    // 差行の負値は「△1,000」表記（絶対値＋△）。色付けは cellStyle 側で行う。
    if (isDiffRow && num < 0) {
      return `△${Math.round(Math.abs(displayValue)).toLocaleString('ja-JP')}`;
    }
    // 金額は円・千円とも整数表示（3桁区切り）。
    return Math.round(displayValue).toLocaleString('ja-JP');
  };

  // ── ⑪ 補助関数: 計算式セル判定 ────────────────────────────────────────────
  /**
   * 計算式が存在するセルかどうかを判定する。
   * クリックイベント・ツールチップ両方で使用。
   */
  const isFormulaCell = useCallback(
    (
      data: PromotionCostsAggregationData,
      colType: 'cumulative' | 'annual' | 'firstHalf' | 'secondHalf' | MonthKey
    ): boolean => {
      if (!data) return false;
      // 親ラベル行（予算/前年実績）はデータなし＝計算式セルではない
      if (data.isGroupHeaderRow) return false;
      const subItem = data.subItem;
      const isRatio = subItem === '前年比' || subItem === '予算比';
      const isDiff = subItem === '予算差' || subItem === '前年差';

      // 比率行・差行は常に計算式セル（算出元は計画／実績と予算/前年実績）
      if (isRatio || isDiff) return true;

      const isValueRow = ['計画／実績', '予算', '前年実績'].includes(subItem);
      if (!isValueRow) return false;

      // 集計列（累計・年間・上期・下期）は全グループで計算式セル
      if (
        colType !== 'cumulative' &&
        colType !== 'annual' &&
        colType !== 'firstHalf' &&
        colType !== 'secondHalf'
      ) {
        // 月列の場合
        // 拡売費（total）の計画/実績・予算・前年実績の月列は計算式セル
        if (data.isAggregate && data.aggregateType === 'total') return true;
        // その他の集計行・明細行の月列は計算式なし（④ 空ツールチップ対象）
        return false;
      }

      return true;
    },
    []
  );

  // ── ⑪ 補助関数: ハイライト対象キー生成 ──────────────────────────────────
  const getFormulaTargets = useCallback(
    (
      data: PromotionCostsAggregationData,
      colType: 'cumulative' | 'annual' | 'firstHalf' | 'secondHalf' | MonthKey,
      api: any
    ): HighlightKey[] => {
      if (!data || !api) return [];
      const subItem = data.subItem;
      const groupName = data.groupName ?? '';
      const isValueRow = ['計画／実績', '予算', '前年実績'].includes(subItem);

      const keys: HighlightKey[] = [];

      // ─ 集計列: 上期・下期・1月〜N月 ──────────────────────────────────────
      if (colType === 'annual' && isValueRow) {
        const rowIdx = findRowIndex(
          api,
          groupName,
          subItem,
          !!data.isAggregate
        );
        if (rowIdx >= 0) {
          keys.push(`firstHalf_${rowIdx}`);
          keys.push(`secondHalf_${rowIdx}`);
        }
        return keys;
      }

      if (colType === 'firstHalf' && isValueRow) {
        const rowIdx = findRowIndex(
          api,
          groupName,
          subItem,
          !!data.isAggregate
        );
        if (rowIdx >= 0) {
          const firstHalfKeys: MonthKey[] = [
            'jan',
            'feb',
            'mar',
            'apr',
            'may',
            'jun',
          ];
          firstHalfKeys.forEach((mk) => keys.push(`${mk}_${rowIdx}`));
        }
        return keys;
      }

      if (colType === 'secondHalf' && isValueRow) {
        const rowIdx = findRowIndex(
          api,
          groupName,
          subItem,
          !!data.isAggregate
        );
        if (rowIdx >= 0) {
          const secondHalfKeys: MonthKey[] = [
            'jul',
            'aug',
            'sep',
            'oct',
            'nov',
            'dec',
          ];
          secondHalfKeys.forEach((mk) => keys.push(`${mk}_${rowIdx}`));
        }
        return keys;
      }

      if (colType === 'cumulative' && isValueRow) {
        const selectedMonthNum = parseInt(selectedMonth);
        const rowIdx = findRowIndex(
          api,
          groupName,
          subItem,
          !!data.isAggregate
        );
        if (rowIdx >= 0) {
          MONTH_KEYS.slice(0, selectedMonthNum).forEach((mk) =>
            keys.push(`${mk}_${rowIdx}`)
          );
        }
        return keys;
      }

      // ─ 比率行・差行 ───────────────────────────────────────────────────────
      // どちらも算出元は「計画／実績」と「予算 or 前年実績」の同一列セル。
      if (subItem === '前年比' || subItem === '前年差') {
        const planIdx = findRowIndex(
          api,
          groupName,
          '計画／実績',
          !!data.isAggregate
        );
        const prevIdx = findRowIndex(
          api,
          groupName,
          '前年実績',
          !!data.isAggregate
        );
        if (planIdx >= 0) keys.push(`${colType}_${planIdx}`);
        if (prevIdx >= 0) keys.push(`${colType}_${prevIdx}`);
        return keys;
      }

      if (subItem === '予算比' || subItem === '予算差') {
        const planIdx = findRowIndex(
          api,
          groupName,
          '計画／実績',
          !!data.isAggregate
        );
        const budgetIdx = findRowIndex(
          api,
          groupName,
          '予算',
          !!data.isAggregate
        );
        if (planIdx >= 0) keys.push(`${colType}_${planIdx}`);
        if (budgetIdx >= 0) keys.push(`${colType}_${budgetIdx}`);
        return keys;
      }

      // ─ 拡売費（total）の月別セル → 売上連動・売上非連動の同subItem同月セル ──
      if (data.isAggregate && data.aggregateType === 'total' && isValueRow) {
        const linkedIdx = findRowIndex(api, '売上連動拡売費', subItem, true);
        const nonLinkedIdx = findRowIndex(
          api,
          '売上非連動拡売費（固定費）',
          subItem,
          true
        );
        if (linkedIdx >= 0) keys.push(`${colType}_${linkedIdx}`);
        if (nonLinkedIdx >= 0) keys.push(`${colType}_${nonLinkedIdx}`);
        return keys;
      }

      // ─ 売上連動・売上非連動の月別セル ──────────────────────────────────────
      if (
        data.isAggregate &&
        data.aggregateType !== 'total' &&
        MONTH_KEYS.includes(colType as MonthKey)
      ) {
        const monthKey = colType as MonthKey;

        // 計画／実績または前年実績: 明細行の同subItem・同月セルをハイライト
        if (subItem === '計画／実績' || subItem === '前年実績') {
          api.forEachNode((node: any) => {
            const row = node.data as PromotionCostsAggregationData;
            if (!row || row.isAggregate) return;
            if (row.groupType !== data.aggregateType) return;
            if (row.subItem !== subItem) return;
            const val = (row as any)[monthKey];
            if (typeof val === 'number' && val !== 0) {
              keys.push(`${monthKey}_${node.rowIndex}`);
            }
          });
          return keys;
        }

        // 予算比: 計画／実績と予算のセルをハイライト
        if (subItem === '予算比') {
          const planIdx = findRowIndex(api, groupName, '計画／実績', true);
          const budgetIdx = findRowIndex(api, groupName, '予算', true);
          if (planIdx >= 0) keys.push(`${monthKey}_${planIdx}`);
          if (budgetIdx >= 0) keys.push(`${monthKey}_${budgetIdx}`);
          return keys;
        }

        // 前年比: 計画／実績と前年実績のセルをハイライト
        if (subItem === '前年比') {
          const planIdx = findRowIndex(api, groupName, '計画／実績', true);
          const prevIdx = findRowIndex(api, groupName, '前年実績', true);
          if (planIdx >= 0) keys.push(`${monthKey}_${planIdx}`);
          if (prevIdx >= 0) keys.push(`${monthKey}_${prevIdx}`);
          return keys;
        }
      }

      return [];
    },
    [selectedMonth]
  );

  // ── セルレンダラー ─────────────────────────────────────────────────────────
  const CategoryCellRenderer = (params: ICellRendererParams) => {
    if (params.data?.isFirstInGroup) {
      return (
        // 勘定科目／管理区分の最大2行表記。文字サイズは年間集計と統一（text-sm＝14px）。
        // 規約例外（2行ラベル）：2行ラベルを行高に収めるため、行間を leading-tight（1.25）とする。
        <div className="flex h-full items-center whitespace-pre-line wrap-anywhere font-normal text-sm leading-tight">
          {params.value}
        </div>
      );
    }
    return null;
  };

  // 種類別セル：年間集計と同じく、子項目（口明細）を持つ区分計（51000／52000）に開閉ボタンと
  // 折りたたみ時の件数を表示する。子項目を持たない行は同幅のスペーサで文字位置をそろえる。
  const ItemCellRenderer = (params: ICellRendererParams) => {
    if (!params.data?.isFirstInGroup) return null;
    const data = params.data as PromotionCostsAggregationData;
    const hasChildren = !!data.itemHasChildren;
    const itemName = data.groupName || '';
    const { expandedItems, toggleItem } =
      params.context as PromotionCostGridContext;
    const expanded = expandedItems.has(itemName);
    const showCount =
      hasChildren && !expanded && (data.itemChildCount ?? 0) > 0;
    return (
      // 勘定科目／管理区分の最大2行表記。文字サイズは年間集計と統一（text-sm＝14px）。
      // 規約例外（2行ラベル）：2行ラベルを行高に収めるため、行間を leading-tight（1.25）とする。
      <div className="flex h-full items-center whitespace-pre-line wrap-anywhere text-sm leading-tight">
        {hasChildren ? (
          <button
            type="button"
            className="flex items-center rounded border-0 bg-transparent px-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={(e) => {
              e.stopPropagation();
              toggleItem(itemName);
            }}
            aria-label={expanded ? '折りたたむ' : '展開する'}
            title={expanded ? '折りたたむ' : '展開する'}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="inline-block w-6 shrink-0" />
        )}
        <span>
          {params.value}
          {showCount && (
            <span className="ml-1 text-gray-500">({data.itemChildCount})</span>
          )}
        </span>
      </div>
    );
  };

  // サブ項目セル：予算・前年実績は開閉アイコン付きの親行、率（予算比/前年比）は子行としてインデント表示。
  // 予算を持たない行（BUDGET_KEYS 以外）は予算親行そのものが存在しない。
  const SubItemCellRenderer = (params: ICellRendererParams) => {
    const data = params.data;
    const isParent = data?.isDrillParent;
    const isChild = !!data?.childOf;
    const { expandedRows } = params.context as PromotionCostGridContext;
    const expanded =
      isParent && expandedRows.has(`${data.groupName}::${data.expandKey}`);

    if (isParent) {
      return (
        <div className="flex h-full cursor-pointer items-center gap-0.5 select-none">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          <span>{data?.displayLabel ?? params.value}</span>
        </div>
      );
    }

    return (
      // 子行（額/率）は親の下に1段インデントして表示
      <div className={`flex h-full items-center ${isChild ? 'pl-5' : ''}`}>
        {data?.displayLabel ?? params.value}
      </div>
    );
  };

  // 青枠（実績セル）の判定。青枠は「実績が反映されたセル」を示すため、累計月選択ではなく
  // 実績反映月（モックでは1月〜5月固定＝ACTUAL_REFLECTED_MONTHS）を基準にする。
  // 表示のみの判定であり、各セルの値（計算式）には一切関与しない。
  const shouldHighlight = (
    subItem: string,
    columnType: string,
    monthField?: string
  ) => {
    // ドリルダウン前の親行（予算・前年実績の金額）を含む全値行を対象にする。
    // 差（予算差／前年差）も計画実績由来の値のため、他行と同じく実績セル枠の対象とする。
    const targetItems = [
      '計画／実績',
      '予算',
      '予算比',
      '予算差',
      '前年実績',
      '前年比',
      '前年差',
    ];
    if (!targetItems.includes(subItem)) return false;
    // 月列（累計月選択の単月列を含む）：実績反映月（1月〜5月）のみ青枠
    if (columnType === 'month') return isActualReflectedMonth(monthField);
    // 累計・年間・上期・下期・年計は複数月の集計値のため実績セルとしない
    return false;
  };

  // ⑧ cellClassRules: highlightTargets に含まれるセルに青枠を付ける
  const cellClassRules = useMemo(
    () => ({
      'highlight-border': (params: any) => {
        const colId =
          params.colDef?.colId ??
          params.colDef?.field ??
          params.colDef?.headerName ??
          '';
        const rowIndex = params.node?.rowIndex;
        if (rowIndex == null) return false;
        return highlightTargets.includes(`${colId}_${rowIndex}`);
      },
    }),
    [highlightTargets]
  );

  const getDataCellStyle = (
    params: any,
    isImportant: boolean = false,
    columnType: string = '',
    monthField?: string
  ) => {
    const rowIndex = params.node?.rowIndex || 0;
    const stripeColor = GRID_COLORS.background;
    const subItem = params.data?.subItem || '';
    const highlight = shouldHighlight(subItem, columnType, monthField);
    return {
      backgroundColor: stripeColor,
      // 赤字は差率行の100%超過のみ（選択実績セルは青枠のみで表現し文字色は変えない）。
      color: rateOverTextColor(params.data, params.value),
      textAlign: 'right',
      paddingRight: '0.75rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      fontWeight: 'normal',
      // 販売計画(詳細)に合わせ区切り線を1px GRID_COLORS.gridLineに統一
      borderBottom: `1px solid ${GRID_COLORS.gridLine}`,
      // 実績反映済み（函数/計算式）セルは、年間計画の1〜5月セルと同様に
      // 薄青フィルではなく existingFuncBorder 色の内側枠線で表現する
      boxShadow: highlight
        ? `inset 0 0 0 0.125rem ${GRID_COLORS.existingFuncBorder}`
        : undefined,
    };
  };

  // ── ⑥ セルクリック処理 ───────────────────────────────────────────────────
  // ハイライト解除。既に空なら同じ参照を返して再レンダーさせない。
  // 毎回新しい [] を入れると cellClassRules → columnDefs が作り直され、列幅が定義値に
  // 戻って（自動幅調整までの一瞬）表が横に伸びて見える（開閉ボタンのクリックでも発生する）。
  const clearHighlight = useCallback(() => {
    setHighlightTargets((prev) => (prev.length === 0 ? prev : []));
  }, []);

  const handleCellClicked = useCallback(
    (params: any) => {
      const data = params.data as PromotionCostsAggregationData;
      if (!data) return;

      // 開閉ボタン由来のクリックはボタン側の onClick で開閉済みのため無視する。
      // AG Grid はセルDOMへネイティブの click リスナーを張り、React は #root で受けるため
      // ボタン側の stopPropagation ではここを止められない（除外しないと2回トグルして打ち消される）。
      if ((params.event?.target as HTMLElement | null)?.closest?.('button'))
        return;

      // 区分計（51000／52000）の名称セルクリックで口明細を開閉（年間集計と同じくボタン以外でも開閉可）
      if (
        params.colDef?.field === 'category' &&
        data.isFirstInGroup &&
        data.itemHasChildren &&
        data.groupName
      ) {
        toggleItem(data.groupName);
        return;
      }

      // ドリル親行は行クリックで展開/折りたたみ（chevron以外でも開閉可能にする）
      if (
        data.isDrillParent &&
        data.groupName != null &&
        data.expandKey != null
      ) {
        toggleDrillRow(data.groupName, data.expandKey);
        return;
      }

      // colId を月キーまたは集計列タイプに解決
      const colId: string = params.colDef?.colId ?? params.colDef?.field ?? '';
      let colType:
        | 'cumulative'
        | 'annual'
        | 'firstHalf'
        | 'secondHalf'
        | MonthKey
        | null = null;

      if (MONTH_KEYS.includes(colId as MonthKey)) colType = colId as MonthKey;
      else if (colId === 'cumulative') colType = 'cumulative';
      else if (colId === 'annual') colType = 'annual';
      else if (colId === 'firstHalf') colType = 'firstHalf';
      else if (colId === 'secondHalf') colType = 'secondHalf';

      if (!colType) {
        clearHighlight();
        return;
      }

      // ⑩ ハイライト対象判定
      // 売上連動・売上非連動の月別セルで、計画／実績・前年実績・予算比・前年比の場合はハイライト有効
      if (
        data.isAggregate &&
        data.aggregateType !== 'total' &&
        MONTH_KEYS.includes(colType as MonthKey)
      ) {
        // 計画／実績、前年実績、予算比、前年比のみハイライト
        const highlightableSubItems = [
          '計画／実績',
          '前年実績',
          '予算比',
          '前年比',
        ];
        if (!highlightableSubItems.includes(data.subItem)) {
          clearHighlight();
          return;
        }
      } else if (!isFormulaCell(data, colType)) {
        clearHighlight();
        return;
      }

      const targets = getFormulaTargets(data, colType, params.api);
      setHighlightTargets(targets);
    },
    [
      isFormulaCell,
      getFormulaTargets,
      toggleDrillRow,
      toggleItem,
      clearHighlight,
    ]
  );

  // ── 列定義 ────────────────────────────────────────────────────────────────
  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(() => {
    const selectedMonthNum = parseInt(selectedMonth);
    const cumulativeMonths = MONTH_KEYS.slice(0, selectedMonthNum);
    const firstHalfMonths = MONTH_KEYS.slice(0, 6);
    const secondHalfMonths = MONTH_KEYS.slice(6, 12);
    const annualMonths = MONTH_KEYS;

    const makeMonthValueGetter = (monthKey: MonthKey) => (params: any) => {
      if (!params.data) return null;
      // 差（金額）行は列の生値合計を丸めてから引く（月列も画面の計画−予算と一致）
      if (params.data.isDiffRow) return promoDiffValue(params.data, [monthKey]);
      // 全行（折りたたみ中の子行含む）を走査する fullDataApi で集計する
      return computeMonthValue(params.data, fullDataApi, monthKey);
    };

    const makeRangeValueGetter =
      (monthRange: readonly string[]) => (params: any) => {
        if (!params.data) return null;
        // 差（金額）行は列の生値合計を丸めてから引く（累計/年間/上期/下期も一致）
        if (params.data.isDiffRow)
          return promoDiffValue(params.data, monthRange);
        return computeRangeValue(params.data, fullDataApi, monthRange);
      };

    return [
      {
        headerName: '項目',
        children: [
          {
            headerName: '種類別',
            field: 'category',
            width: 216,
            lockPinned: true,
            suppressAutoSize: true,
            cellRenderer: ItemCellRenderer,
            rowSpan: (params) =>
              params.data?.isFirstInGroup ? params.data?.groupRowSpan || 1 : 1,
            cellStyle: (params) => {
              const rowIndex = params.node?.rowIndex || 0;
              const stripeColor = GRID_COLORS.background;
              // ドリルダウン階層に応じて1文字ずつインデントを追加
              // 0=拡売費合計 / 1=区分計（売上連動・固定費・ロケ補填等）/ 2=口明細
              const drillLevel = params.data?.drillLevel ?? 0;
              return {
                backgroundColor: stripeColor,
                // Excelの結合セルと同様、内側の行罫線は入れず外周のみに罫線を入れる
                fontWeight: 'normal',
                textAlign: 'left',
                // 左寄せ＋ドリルダウン階層ごとに1文字インデント（先頭の開閉ボタン／スペーサ分の余白は cellRenderer 側で確保）
                // grid.css の1列目中央寄せルールを上書きするため明示
                justifyContent: 'flex-start',
                paddingLeft: `${drillLevel}em`,
                borderBottom: `1px solid ${GRID_COLORS.gridLine}`,
                display: 'flex',
                alignItems: 'center',
              };
            },
          },
          {
            // 種類別列と同様にrowSpanで結合表示し、1行テキストで編集可能（背景は白）
            headerName: '備考',
            field: 'description',
            width: 128,
            lockPinned: true,
            suppressAutoSize: true,
            editable: true,
            cellEditor: 'agTextCellEditor',
            cellRenderer: CategoryCellRenderer,
            rowSpan: (params) =>
              params.data?.isFirstInGroup ? params.data?.groupRowSpan || 1 : 1,
            cellStyle: (params) => {
              const rowIndex = params.node?.rowIndex || 0;
              const stripeColor = GRID_COLORS.background;
              return {
                // 種類別列と同じストライプ背景を適用
                backgroundColor: stripeColor,
                // Excelの結合セルと同様、内側の行罫線は入れず外周のみに罫線を入れる
                textAlign: 'left',
                paddingLeft: '0.5rem',
                borderBottom: `1px solid ${GRID_COLORS.gridLine}`,
                display: 'flex',
                alignItems: 'center',
              };
            },
          },
          {
            headerName: 'サブ項目',
            field: 'subItem',
            width: 88,
            lockPinned: true,
            suppressAutoSize: true,
            cellRenderer: SubItemCellRenderer,
            cellStyle: (params) => {
              const rowIndex = params.node?.rowIndex || 0;
              const stripeColor = GRID_COLORS.background;
              const value = params.value || '';
              const boldItems = [
                '計画／実績',
                '予算',
                '前年実績',
                '予算比',
                '前年比',
              ];
              const isBold = boldItems.includes(value);
              return {
                backgroundColor: stripeColor,
                textAlign: 'left',
                paddingLeft: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                fontWeight: 'normal',
                // 販売計画(詳細)に合わせ区切り線を1px GRID_COLORS.gridLineに統一
                borderBottom: `1px solid ${GRID_COLORS.gridLine}`,
              };
            },
          },
        ],
      },
      // ── 累計列の左隣：累計月選択で選択した月の単月（既存の月別列と同じ値）──
      {
        headerName: `${selectedMonth}月`,
        colId: 'selectedMonthSingle',
        width: 80,
        valueGetter: makeMonthValueGetter(MONTH_KEYS[selectedMonthNum - 1]),
        valueFormatter: (p) =>
          formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
        cellClassRules,
        cellStyle: (p) =>
          getDataCellStyle(p, false, 'month', MONTH_KEYS[selectedMonthNum - 1]),
      },
      // ── 累計 ────────────────────────────────────────────────────────────
      {
        headerName: `${selectedMonth}月迄累計`,
        colId: 'cumulative',
        width: 96,
        hide: !columnVisibility.cumulative,
        valueGetter: makeRangeValueGetter(cumulativeMonths),
        valueFormatter: (params) =>
          formatNumber(
            params.value,
            params.data?.isPercentage,
            params.data?.isDiffRow
          ),
        cellClassRules,
        cellStyle: (params) => {
          const rowIndex = params.node?.rowIndex || 0;
          const stripeColor = GRID_COLORS.background;
          const highlight = shouldHighlight(
            params.data?.subItem || '',
            'cumulative'
          );
          return {
            backgroundColor: stripeColor,
            // 赤字は差率行の100%超過のみ（選択実績セルは青枠のみで表現し文字色は変えない）。
            color: rateOverTextColor(params.data, params.value),
            textAlign: 'right',
            paddingRight: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            fontWeight: 'normal',
            borderBottom: `1px solid ${GRID_COLORS.gridLine}`,
            // 実績反映済み（函数/計算式）セルは existingFuncBorder 色の内側枠線で表現
            boxShadow: highlight
              ? `inset 0 0 0 0.125rem ${GRID_COLORS.existingFuncBorder}`
              : undefined,
          };
        },
      },
      // ── 年間 ────────────────────────────────────────────────────────────
      {
        headerName: '年間',
        colId: 'annual',
        width: 96,
        hide: !columnVisibility.annual,
        valueGetter: makeRangeValueGetter(annualMonths),
        valueFormatter: (params) =>
          formatNumber(
            params.value,
            params.data?.isPercentage,
            params.data?.isDiffRow
          ),
        cellClassRules,
        cellStyle: (params) => getDataCellStyle(params, true, 'annual'),
      },
      // ── 上期 ────────────────────────────────────────────────────────────
      {
        headerName: '上期',
        colId: 'firstHalf',
        width: 92,
        hide: !columnVisibility.firstHalf,
        valueGetter: makeRangeValueGetter(firstHalfMonths),
        valueFormatter: (params) =>
          formatNumber(
            params.value,
            params.data?.isPercentage,
            params.data?.isDiffRow
          ),
        cellClassRules,
        cellStyle: (params) => getDataCellStyle(params, false, 'firstHalf'),
      },
      // ── 下期 ────────────────────────────────────────────────────────────
      {
        headerName: '下期',
        colId: 'secondHalf',
        width: 92,
        hide: !columnVisibility.secondHalf,
        valueGetter: makeRangeValueGetter(secondHalfMonths),
        valueFormatter: (params) =>
          formatNumber(
            params.value,
            params.data?.isPercentage,
            params.data?.isDiffRow
          ),
        cellClassRules,
        cellStyle: (params) => getDataCellStyle(params, false, 'secondHalf'),
      },
      // ── 月別（1〜12月）：AG Grid 列グループの開閉トグルで表示/非表示する ──
      // グループヘッダの「<（折りたたみ）/ >（展開）」で月別列をまとめて表示/非表示できる。
      {
        headerName: '月別（1〜12月）',
        groupId: 'monthsGroup',
        openByDefault: true,
        marryChildren: true,
        children: [
          // 折りたたみ時に表示する空欄列。columnGroupShow:'closed' の子列が
          // 1つ以上ないとグループの開閉トグル（< / >）が出ないため列自体は残し、
          // ヘッダー・値とも表示しない（折りたたみ時は何も見せない）。
          {
            colId: 'monthsTotal',
            headerName: '',
            width: 88,
            columnGroupShow: 'closed',
            valueGetter: () => null,
            valueFormatter: () => '',
            cellStyle: (p) => getDataCellStyle(p, true, 'yearTotal'),
          } as ColDef,
          {
            headerName: '1月',
            colId: 'jan',
            width: 72,
            hide: !columnVisibility.jan,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('jan'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'jan'),
          },
          {
            headerName: '2月',
            colId: 'feb',
            width: 72,
            hide: !columnVisibility.feb,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('feb'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'feb'),
          },
          {
            headerName: '3月',
            colId: 'mar',
            width: 72,
            hide: !columnVisibility.mar,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('mar'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'mar'),
          },
          {
            headerName: '4月',
            colId: 'apr',
            width: 72,
            hide: !columnVisibility.apr,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('apr'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'apr'),
          },
          {
            headerName: '5月',
            colId: 'may',
            width: 72,
            hide: !columnVisibility.may,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('may'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'may'),
          },
          {
            headerName: '6月',
            colId: 'jun',
            width: 72,
            hide: !columnVisibility.jun,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('jun'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'jun'),
          },
          {
            headerName: '7月',
            colId: 'jul',
            width: 72,
            hide: !columnVisibility.jul,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('jul'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'jul'),
          },
          {
            headerName: '8月',
            colId: 'aug',
            width: 72,
            hide: !columnVisibility.aug,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('aug'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'aug'),
          },
          {
            headerName: '9月',
            colId: 'sep',
            width: 72,
            hide: !columnVisibility.sep,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('sep'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'sep'),
          },
          {
            headerName: '10月',
            colId: 'oct',
            width: 72,
            hide: !columnVisibility.oct,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('oct'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'oct'),
          },
          {
            headerName: '11月',
            colId: 'nov',
            width: 72,
            hide: !columnVisibility.nov,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('nov'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'nov'),
          },
          {
            headerName: '12月',
            colId: 'dec',
            width: 72,
            hide: !columnVisibility.dec,
            columnGroupShow: 'open',
            valueGetter: makeMonthValueGetter('dec'),
            valueFormatter: (p) =>
              formatNumber(p.value, p.data?.isPercentage, p.data?.isDiffRow),
            cellClassRules,
            cellStyle: (p) => getDataCellStyle(p, false, 'month', 'dec'),
          },
        ],
      },
    ];
  }, [
    selectedMonth,
    columnVisibility,
    cellClassRules,
    displayUnit,
    fullDataApi,
    // 開閉状態（expandedItems / expandedRows）は依存に含めない。セルレンダラは
    // params.context から読むため、列定義を作り直さなくても chevron が追従する。
  ]);

  const defaultColDef = useMemo(
    () => ({
      sortable: false,
      resizable: true,
      filter: true,
      suppressMovable: true,
      // ヘッダーのフィルター／列メニューボタンを非表示（販売計画詳細と統一）
      suppressHeaderMenuButton: true,
      suppressHeaderFilterButton: true,
      // マウスオーバーは画面設計標準（列幅で省略された値の全文表示）に従い、共通の tooltip を使う。
      // 計算式の表示は行わない（第1回手売りセッション 決定事項36）。
      tooltipValueGetter: GRID_DEFAULT_COL_DEF.tooltipValueGetter,
    }),
    []
  );

  return (
    <div className="p-4 overflow-hidden flex flex-col h-full">
      <div className="flex flex-row items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          {/* 基準月を親から渡された場合は選択させない。対象月は基本情報の対象年月で選んでおり
              グリッドの列見出しでも分かるため、「対象月：X月」は表示しない（第1回手売りセッション 決定事項11） */}
          {targetMonth === undefined && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-blue-900 whitespace-nowrap font-bold">
                累計月選択
              </label>
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
            </div>
          )}

          {/* 月別（1〜12月）の表示/非表示は AG Grid 列グループ「月別（1〜12月）」の
              ヘッダにある折りたたみ/展開トグル（< / >）で行う（専用ボタンは廃止）。 */}

          {/* 表示単位トグル（親から制御される場合は非表示） */}
          {displayUnitProp === undefined && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-blue-900 whitespace-nowrap font-bold">
                表示単位
              </label>
              <div className="inline-flex rounded-md border border-gray-300 overflow-hidden h-8">
                <button
                  onClick={() => setInternalDisplayUnit('円')}
                  className={`px-4 text-sm font-medium transition-colors ${
                    displayUnit === '円'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  円
                </button>
                <button
                  onClick={() => setInternalDisplayUnit('千円')}
                  className={`px-4 text-sm font-medium transition-colors ${
                    displayUnit === '千円'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  千円
                </button>
              </div>
            </div>
          )}

          {/* 凡例：選択実績セル（表内と同じ「外枠ブルー」で表現／年間集計と統一）。
              並び順は「サンプル → 説明」で年間集計と揃える */}
          <div className="flex items-center gap-1 text-sm">
            <span
              className="text-black px-2 py-1 font-medium"
              style={{
                boxShadow: `inset 0 0 0 0.125rem ${GRID_COLORS.existingFuncBorder}`,
              }}
            >
              XXX,XXX
            </span>
            <span className="text-black bg-white px-2 py-1">
              ：選択実績セル
            </span>
          </div>

          {/* 赤字の凡例（差率行の100%超過セル）。文字色は hex 直書きせず、
              セル本体と同じ GRID_COLORS.overText を使用する */}
          <div className="flex items-center gap-1 text-sm">
            <span
              className="bg-white px-2 py-1 font-medium"
              style={{ color: GRID_COLORS.overText }}
            >
              XXX.XX%
            </span>
            <span className="text-black bg-white px-2 py-1">
              ：100%超過セル
            </span>
          </div>
        </div>
      </div>

      <div className="py-0 w-full flex-1 overflow-hidden">
        <div
          className="annual-total-grid"
          style={{ height: '100%', width: '100%' }}
        >
          <style>{`
            /* （見出しの背景色・文字色は共通テーマ GRID_THEME に委ねる → 02 §7「ヘッダーの配色」・UI/UX UX-031）
               ヘッダーと明細の間に青い強調線は引かない */
            .annual-total-grid .ag-header-cell {
              padding: 8px 4px;
            }
            /* 見出しの寄せは grid.css の共通指定（左寄せ）に委ねる */
            .annual-total-grid .ag-header-group-cell {
              font-weight: 700;
              border-right: 1px solid var(--grid-grid-line);
              display: flex;
              align-items: center;
            }
            .annual-total-grid .ag-cell {
              border-bottom: 1px solid var(--grid-grid-line);
              padding: 4px 8px;
            }
            .annual-total-grid .ag-row { border: none; }
            .annual-total-grid .ag-row-even,
            .annual-total-grid .ag-row-odd { background-color: transparent; }
            .annual-total-grid .ag-row-hover .ag-cell { background-color: var(--grid-row-hover) !important; }
            .annual-total-grid .ag-root-wrapper { border: 1px solid var(--grid-grid-line); border-radius: 4px; }
            .annual-total-grid .ag-pinned-left-header { box-shadow: none; z-index: 1; }
            .annual-total-grid .ag-pinned-left-cols-container { box-shadow: none; z-index: 1; }
            .annual-total-grid .ag-header-cell.ag-header-cell-last-left-pinned { border-right: 1px solid var(--grid-grid-line) !important; }
            /* ⑨ ハイライトボーダー */
            .annual-total-grid .ag-cell.highlight-border {
              border: 2px solid var(--grid-click-highlight-border) !important;
              background-color: var(--grid-highlight-border-bg) !important;
            }
          `}</style>
          {/* theme は指定せず、App.tsx の provideGlobalGridOptions で登録した
              共通テーマ(GRID_THEME / themeBalham)を継承する（販売計画(詳細)と統一） */}
          {/* 規約例外（集計表）：行と列が決まっている集計表のため、列の状態の保存（useGridColumnState）は付けない */}
          <AgGridReact
            {...GRID_BASE_PROPS}
            ref={gridRef}
            rowData={displayRows}
            getRowId={getRowId}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            statusBar={GRID_STATUS_BAR}
            suppressMovableColumns={true}
            suppressRowTransform={true}
            suppressHorizontalScroll={false}
            alwaysShowHorizontalScroll={true}
            onGridReady={handleAutoSizeColumns}
            context={gridContext}
            onCellClicked={handleCellClicked}
          />
        </div>
      </div>
    </div>
  );
}

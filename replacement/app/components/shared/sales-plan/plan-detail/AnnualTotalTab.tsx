import React, {
  useMemo,
  useCallback,
  useState,
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
import { ChevronRight, ChevronDown, Plus, Minus } from 'lucide-react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { MonthPicker } from '@/app/components/ui/month-picker';
import {
  GRID_BASE_PROPS,
  GRID_COLORS,
  existingFuncCellStyle,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  asCellStyle,
  useGridColumnState,
  readSavedColumnState,
  gridHeaderStyle,
  rateOverTextColor,
} from '@/app/components/grid';

// 予算比・前年比の行の 100%超過の文字色（経費の項目は赤・それ以外は青。#20 の依頼で
// 第1回手売りセッション 決定事項12「100%超過も赤字にしない」から変更。UX-096）。それ以外の行は undefined（黒）。
const ratioRowTextColor = (
  data: { subItem?: string; isExpenseItem?: boolean } | undefined,
  value: unknown
): string | undefined =>
  data?.subItem === '予算比' || data?.subItem === '前年比'
    ? rateOverTextColor(value, !!data.isExpenseItem)
    : undefined;
import {
  computeMonth,
  displayOf,
  type AggAmounts,
  type AggFilter,
} from '@/app/utils/sales-plan/common/aggregationCalc';
import { RATE_SETTINGS } from '@/app/constants/aggregationSourceData';
import type { AggregationSource } from '@/app/types/aggregation';
import { isActualReflectedMonth } from '@/app/utils/sales-plan/common/actualMonths';
import {
  NO_DELIVERY_PRICE_NOTE,
  SALES_UNIT_PRICE_LABEL,
} from '@/app/constants/aggregationTree';
import {
  AGG_ITEM_CELL_CLASS,
  AGG_ITEM_CONTENT_CLASS,
  AGG_ITEM_TOGGLE_CLASS,
  ANNUAL_ITEM_COL_WIDTH,
  aggItemFilterValue,
  aggRowBorderBottom,
  isAggPrimaryRow,
} from './aggregationTableStyle';

// 項目のマウスオーバーで表示する注記（項目名→注記。課題1815）。
const ITEM_NOTES: Record<string, string> = {
  納品金額: NO_DELIVERY_PRICE_NOTE,
};
import {
  PLAN_DETAIL_DIGITS,
  formatPlanRate,
} from '@/app/utils/sales-plan/common/planDetailNumberFormat';
import { SegmentToggle } from '@/app/components/shared/common/SegmentToggle';

// 拡売費の項目名。算出内訳（売上連動拡売費＋直接固定費）を併記し、項目セルで2行に改行表示する
// （GroupCellRenderer が white-space: pre-line のため \n で改行される）。
// 項目階層の親指定・算出元ハイライト対象の判定にも同じ文字列を使うため定数で共有する。
const PROMO_ITEM_NAME = '拡売費\n(売上連動拡売費＋直接固定費)';

interface AnnualTotalData {
  group: string;
  subItem: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  isPercentage?: boolean;
  isUnitExempt?: boolean; // 表示単位切替（円/千円）の対象外。函数は数量のため 1/1000 しない
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean; // 項目内の最終行（項目境界の下罫線を引く行）
  isExpenseItem?: boolean; // 経費の項目の行（予算比・前年比の 100%超過を赤、それ以外は青。UX-096）
  groupRowSpan?: number;
  groupName?: string; // グループ名を全行に保持
  // ドリルダウン制御：予算・前年実績は親ラベル行（展開で「額」「率」の子行を表示）
  isDrillParent?: boolean; // 予算・前年実績（クリックで開閉する親ラベル行）
  expandKey?: string; // 親行の識別キー（予算 / 前年実績）
  childOf?: string; // 子行（額 / 率）が属する親の expandKey
  displayLabel?: string; // サブ項目セルの表示名（額 / 率 など）。未指定時は subItem を表示
  isDiffRow?: boolean; // 差（計画実績−予算/前年実績金額）の行。マイナスは△＋赤で表示する
  // 差（金額）行の生値。集計列（累計/年間/上期/下期/Q/年計）を「列の生値合計を表示規則で丸めてから引く」で
  // 算出するために保持する。diffPlanRaw=計画実績の生値、diffOtherRaw=予算 or 前年実績の生値（月フィールド）。
  diffPlanRaw?: Record<string, number>;
  diffOtherRaw?: Record<string, number>;
  diffExempt?: boolean; // 差の項目が表示単位切替の対象外（函数など）か。集計列の丸め規則に使用。
  // 差率（予算比/前年比）行の生値。集計列を「Σ計画／実績 ÷ Σ予算(前年実績) × 100」で算出するために保持する。
  // 月次の％を合計すると期間比率にならないため（例：7か月分で686%）、必ずこの生値から再計算する。
  ratioNumRaw?: Record<string, number>; // 分子＝計画／実績
  ratioDenRaw?: Record<string, number>; // 分母＝予算 or 前年実績
  // 率項目（管理利益率など）の生値。集計列を「Σ分子 ÷ Σ分母 × 100」で算出するために保持する。
  // 月次%を合計しても期間の率にならないため（管理利益率(年間)＝管理利益額(年間) ÷ 売上高(年間)）、
  // 累計/年間/上期/下期/四半期は必ずこの生値から再計算する。
  aggNumRaw?: Record<string, number>; // 分子＝率の算出元金額（管理利益率なら管理利益額）
  aggDenRaw?: Record<string, number>; // 分母＝率の算出元金額（管理利益率なら売上高）
  aggNumLabel?: string; // 分子の項目名（ツールチップの計算式表示用）
  aggDenLabel?: string; // 分母の項目名（ツールチップの計算式表示用）
  isGroupHeaderRow?: boolean; // 親ラベル行（データなし＝セルは空欄表示）
  // 項目階層ドリルダウン（資料「各項目_折りたたみ表示」準拠）：項目自体の親子関係。
  itemLevel?: number; // 項目のネスト階層（0=最上位）。項目列のインデントに使用。
  itemParent?: string; // 親項目名（最上位は undefined）。折りたたみ判定に使用。
  itemHasChildren?: boolean; // 子項目を持つ（chevron 表示対象）
  itemChildCount?: number; // 直下の子項目数（折りたたみ時に件数表示）
}

// 行ID（→ 画面設計標準 4.7）。項目名（groupName）は項目ごとに一意、サブ項目（計画／実績・予算・
// 予算差 等）は項目内で一意のため、その組み合わせで一意にする。
// ただし項目の先頭行は結合行数（groupRowSpan）も含める。AG Grid の rowSpan はセルの生成時にしか
// 評価されないため、開閉で可視行数が変わったときは先頭行を作り直させて結合を正しく保つ。
const getRowId = (params: GetRowIdParams<AnnualTotalData>) => {
  const { groupName, subItem, isFirstInGroup, groupRowSpan } = params.data;
  const baseId = `${groupName}::${subItem}`;
  return isFirstInGroup ? `${baseId}::span${groupRowSpan ?? 1}` : baseId;
};

// セルレンダラへ AG Grid の context で渡す開閉状態。
// 列定義（columnDefs）を作り直さずに chevron の向き・件数表示を追従させるために使う
//（作り直すと列幅が定義値に戻り、自動幅調整までの一瞬だけ表が横に伸びて見えるため）。
interface AnnualTotalGridContext {
  expandedItems: Set<string>;
  expandedRows: Set<string>;
  toggleItem: (itemName: string) => void;
}

interface AnnualTotalTabProps {
  // 列の状態（幅・並び・表示）を保存する localStorage のキー（画面ごとに一意 → 02 §7「列状態の永続化」）
  columnStateKey: string;
  isWholesaleContext?: boolean;
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

export function AnnualTotalTab({
  columnStateKey,
  isWholesaleContext = false,
  displayUnit: displayUnitProp,
  aggFilter = {},
  source,
  targetMonth,
}: AnnualTotalTabProps) {
  const [internalMonth, setSelectedMonth] = useState('7');
  const selectedMonth = targetMonth ?? internalMonth;
  // 補助項目（△）の表示トグル（資料「各項目_折りたたみ表示」準拠・年間ビュー）。
  // 既定は非表示。＋ボタンで量経追加口/率・売上連動拡売費/率を表示する。
  const [isOptionalShown, setIsOptionalShown] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({
    cumulative: true,
    annual: true,
    firstHalf: true,
    secondHalf: true,
    q1: true,
    q2: true,
    q3: true,
    q4: true,
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
  const [isColumnSettingsShown] = useState(false);
  const [internalDisplayUnit, setInternalDisplayUnit] = useState<
    'yen' | 'thousand'
  >('thousand');
  // 親から displayUnit が渡された場合は制御モード（内部トグルは非表示）
  const displayUnit = displayUnitProp ?? internalDisplayUnit;
  // クリックされた集計セルの算出元。rowIndexes は「月セルを強調する行」の一覧。
  // 計画／実績・予算・前年実績は自行のみ。差／差率は算出元である
  // 計画／実績行と予算(前年実績)行の2行を対象にする。
  const [clickedCell, setClickedCell] = useState<{
    rowIndexes: number[];
    colId: string;
  } | null>(null);
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
  // 項目階層の展開状態（展開中の親項目名）。資料「各項目_折りたたみ表示」に合わせ既定は折りたたみ。
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const toggleItem = useCallback((itemName: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  }, []);

  // 数値がセルからはみ出さないよう、各列を内容に合わせて自動幅調整する。
  const gridRef = useRef<any>(null);
  // 列幅を内容に合わせる。利用者が変えた列の状態が保存済みなら、その幅を優先して調整しない
  const handleAutoSizeColumns = useCallback(() => {
    if (readSavedColumnState(columnStateKey)) return;
    const api = gridRef.current?.api;
    if (api) api.autoSizeAllColumns(false);
  }, [columnStateKey]);
  // 列の状態（幅・並び・表示）を保存／復元する（タブを行き来しても引き継ぐ → 02 §7）
  const gridColumnStateProps = useGridColumnState(columnStateKey, {
    autoSize: false,
    onGridReady: handleAutoSizeColumns,
  });

  const rowData = useMemo<AnnualTotalData[]>(() => {
    const MONTH_FIELDS = [
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

    // 各月の計算エンジン値（集計単位フィルタ適用）。集計項目xlsx「年間集計」準拠。
    const monthAmounts = MONTH_FIELDS.map((_, i) =>
      computeMonth(source, i + 1, aggFilter)
    );

    // 月別フィールドの一括生成
    const series = (fn: (i: number) => number): Record<string, number> => {
      const o: Record<string, number> = {};
      MONTH_FIELDS.forEach((mf, i) => (o[mf] = fn(i)));
      return o;
    };

    // 表示項目の定義（資料「各項目_折りたたみ表示」の項目階層）
    interface ItemDef {
      name: string;
      key: keyof AggAmounts;
      isRate: boolean;
      ratioType?: 'full' | 'previous-only';
      level: number;
      parent?: string;
      optional?: boolean; // △（補助項目を表示でのみ表示）
      unitExempt?: boolean; // 表示単位切替（円/千円）の対象外（数量項目）
      // 経費の項目（量経追加口・拡売費とその配下）。予算比・前年比の 100%超過を赤で示す（それ以外は青。UX-096）
      isExpense?: boolean;
      // 率項目の算出元（分子・分母）。集計列（累計/年間/上期/下期/四半期）を
      // 「Σ分子 ÷ Σ分母 × 100」で算出するために指定する（例：管理利益率＝管理利益額÷売上高）。
      rateNum?: { key: keyof AggAmounts; label: string };
      rateDen?: { key: keyof AggAmounts; label: string };
    }

    // 1項目（〇/△）について「計画/実績・予算・前年実績」＋率（予算比/前年比）の行を作る。
    // 率項目（管理利益率）は % 値（×100）で保持し、金額項目は円で保持する。
    const buildGroup = (
      item: ItemDef,
      itemHasChildren: boolean,
      itemChildCount: number
    ): AnnualTotalData[] => {
      const {
        name: groupName,
        key,
        isRate,
        rateNum,
        rateDen,
        level: itemLevel,
        parent: itemParent,
      } = item;
      const ratioType = item.ratioType ?? 'full';
      const unitExempt = item.unitExempt ?? false;
      const scale = isRate ? 100 : 1;
      const d = (i: number) => displayOf(monthAmounts[i][key], isRate);
      const plan = series((i) => d(i).plan * scale);
      const budget = series((i) => d(i).budget * scale);
      const prev = series((i) => d(i).prevYear * scale);
      const budgetRatio = series((i) =>
        d(i).budget ? (d(i).plan / d(i).budget) * 100 : 0
      );
      const prevRatio = series((i) =>
        d(i).prevYear ? (d(i).plan / d(i).prevYear) * 100 : 0
      );
      // 表示整数化：formatNumber の金額規則（円・千円(非exempt)とも四捨五入）と同一。
      // 函数など unitExempt の項は円・千円とも四捨五入で揃える。
      const intAmount = (v: number) =>
        displayUnit === 'thousand' && !unitExempt
          ? Math.round(v / 1000)
          : Math.round(v);
      // 差（計画実績 − 予算/前年実績）。
      // 金額は「各項を表示と同じ規則で整数化してから引く」ことで、
      // 画面の計画実績 − 画面の予算/前年実績 と常に一致させる（端数処理由来の±1を解消）。
      // 率は従来どおり率差（×scale）で保持する（今回の主目的は金額の±1解消のため）。
      const budgetDiff = isRate
        ? series((i) => (d(i).plan - d(i).budget) * scale)
        : series((i) => intAmount(d(i).plan) - intAmount(d(i).budget));
      const prevDiff = isRate
        ? series((i) => (d(i).plan - d(i).prevYear) * scale)
        : series((i) => intAmount(d(i).plan) - intAmount(d(i).prevYear));

      // 率項目の集計列（累計/年間/上期/下期/四半期）用の生値。
      // 月次%を合計しても期間の率にならないため、Σ分子 ÷ Σ分母 × 100 で再計算する
      //（例：管理利益率(年間)＝管理利益額(年間) ÷ 売上高(年間) × 100）。
      // 分子には行ごとの係数（予算＝budgetFactor／予算差＝1−budgetFactor 等）を掛け、
      // 月次の表示値（率×係数）と集計列の定義を一致させる。
      const rateAgg = (factor: number) =>
        isRate && rateNum && rateDen
          ? {
              aggNumRaw: series((i) => monthAmounts[i][rateNum.key] * factor),
              aggDenRaw: series((i) => monthAmounts[i][rateDen.key]),
              aggNumLabel: rateNum.label,
              aggDenLabel: rateDen.label,
            }
          : {};

      // ドリルダウンは「金額（親行）→ 展開で率」の形。予算/前年実績の親行に金額を表示し、
      // 開くと率（予算比/前年比）を子行で表示する。
      const result: AnnualTotalData[] = [];
      result.push({
        group: groupName,
        subItem: '計画／実績',
        ...plan,
        isPercentage: isRate,
        groupName,
        ...rateAgg(1),
      } as AnnualTotalData);
      if (ratioType === 'full') {
        result.push({
          group: '',
          subItem: '予算',
          ...budget,
          isPercentage: isRate,
          groupName,
          isDrillParent: true,
          expandKey: '予算',
          ...rateAgg(RATE_SETTINGS.budgetFactor),
        } as AnnualTotalData);
        // 差（子行）。マイナスは△＋赤（表記は formatCell / 配色は cellStyle 側）。
        result.push({
          group: '',
          subItem: '予算差',
          displayLabel: '予算差',
          ...budgetDiff,
          isPercentage: isRate,
          groupName,
          childOf: '予算',
          isDiffRow: true,
          // 差は既に表示単位の整数（金額）。formatNumber が千円で再度 /1000 しないよう exempt。
          isUnitExempt: true,
          // 集計列を「列の生値合計を丸めてから引く」で算出するための生値（率項目は従来どおり非設定）。
          ...(isRate
            ? {}
            : {
                diffPlanRaw: plan,
                diffOtherRaw: budget,
                diffExempt: unitExempt,
              }),
          // 率項目の差は「計画／実績の率 − 予算の率」。分子に (1−係数) を掛けた生値から
          // 期間の率差を再計算する（集計列でも 計画／実績(列) − 予算(列) と一致する）。
          ...rateAgg(1 - RATE_SETTINGS.budgetFactor),
        } as AnnualTotalData);
        result.push({
          group: '',
          subItem: '予算比',
          // 「予算比」表記（計算式は計画実績/予算×100のまま）。
          displayLabel: '予算比',
          ...budgetRatio,
          isPercentage: true,
          groupName,
          childOf: '予算',
          // 集計列は月次%の合計ではなく Σ計画／実績 ÷ Σ予算 × 100 で算出する。
          ratioNumRaw: plan,
          ratioDenRaw: budget,
        } as AnnualTotalData);
      }
      result.push({
        group: '',
        subItem: '前年実績',
        ...prev,
        isPercentage: isRate,
        groupName,
        isDrillParent: true,
        expandKey: '前年実績',
        ...rateAgg(RATE_SETTINGS.prevYearFactor),
      } as AnnualTotalData);
      result.push({
        group: '',
        subItem: '前年差',
        displayLabel: '前年差',
        ...prevDiff,
        isPercentage: isRate,
        groupName,
        childOf: '前年実績',
        isDiffRow: true,
        // 差は既に表示単位の整数（金額）。formatNumber が千円で再度 /1000 しないよう exempt。
        isUnitExempt: true,
        // 集計列を「列の生値合計を丸めてから引く」で算出するための生値（率項目は従来どおり非設定）。
        ...(isRate
          ? {}
          : {
              diffPlanRaw: plan,
              diffOtherRaw: prev,
              diffExempt: unitExempt,
            }),
        // 率項目の差は「計画／実績の率 − 前年実績の率」（予算差と同じ考え方）。
        ...rateAgg(1 - RATE_SETTINGS.prevYearFactor),
      } as AnnualTotalData);
      result.push({
        group: '',
        subItem: '前年比',
        displayLabel: '前年比',
        ...prevRatio,
        isPercentage: true,
        groupName,
        childOf: '前年実績',
        // 集計列は月次%の合計ではなく Σ計画／実績 ÷ Σ前年実績 × 100 で算出する。
        ratioNumRaw: plan,
        ratioDenRaw: prev,
      } as AnnualTotalData);
      // 項目階層メタを全行へ付与
      return result.map((r) => ({
        ...r,
        itemLevel,
        itemParent,
        itemHasChildren,
        itemChildCount,
        isExpenseItem: !!item.isExpense,
        // 差行は行側で isUnitExempt: true を設定済みなので上書きしない
        isUnitExempt: r.isUnitExempt ?? unitExempt,
      }));
    };

    // 資料「各項目_折りたたみ表示」（年間ビュー）の項目階層で表示する。
    //   売上高→売上高単価、拡売費→売上連動拡売費→売上連動拡売費率、
    //   管理利益額→管理利益率、量経追加口→量経追加口率（△は補助項目を表示で表示）。
    // 社外売上高は優先度が上がったため、折りたたまずに常に表示し、函数の次（売上高より上）に置く
    //（第1回手売りセッション 決定事項18）。
    const ITEMS: ItemDef[] = [
      // 函数は数量のため表示単位切替（円/千円）の対象外
      { name: '函数', key: 'func', isRate: false, level: 0, unitExempt: true },
      { name: '社外売上高', key: 'extSales', isRate: false, level: 0 },
      { name: '売上高', key: 'sales', isRate: false, level: 0 },
      {
        name: SALES_UNIT_PRICE_LABEL,
        key: 'salesUnitPrice',
        isRate: false,
        level: 1,
        parent: '売上高',
      },
      {
        name: '量経追加口',
        key: 'volumeAdd',
        isRate: false,
        level: 0,
        optional: true,
        isExpense: true,
      },
      {
        name: '量経追加口率',
        key: 'volumeAddRateAgg',
        isRate: true,
        level: 1,
        parent: '量経追加口',
        optional: true,
        isExpense: true,
        rateNum: { key: 'volumeAdd', label: '量経追加口' },
        rateDen: { key: 'extSales', label: '社外売上高' },
      },
      {
        name: PROMO_ITEM_NAME,
        key: 'promo',
        isRate: false,
        level: 0,
        isExpense: true,
      },
      {
        name: '売上連動拡売費',
        key: 'salesLinked',
        isRate: false,
        level: 1,
        parent: PROMO_ITEM_NAME,
        optional: true,
        isExpense: true,
      },
      {
        name: '売上連動拡売費率',
        key: 'salesLinkedRate',
        isRate: true,
        level: 2,
        parent: '売上連動拡売費',
        optional: true,
        isExpense: true,
        rateNum: { key: 'salesLinked', label: '売上連動拡売費' },
        rateDen: { key: 'extSales', label: '社外売上高' },
      },
      { name: '管理利益額', key: 'mgmtProfit', isRate: false, level: 0 },
      {
        name: '管理利益率',
        key: 'mgmtProfitRate',
        isRate: true,
        level: 1,
        parent: '管理利益額',
        rateNum: { key: 'mgmtProfit', label: '管理利益額' },
        rateDen: { key: 'sales', label: '売上高' },
      },
      ...(isWholesaleContext
        ? [
            {
              name: '納品金額',
              key: 'deliveryAmount' as keyof AggAmounts,
              isRate: false,
              ratioType: 'previous-only' as const,
              level: 0,
            },
          ]
        : []),
    ];
    // △は補助項目を表示のときのみ対象にする
    const visibleItems = ITEMS.filter((it) => !it.optional || isOptionalShown);
    const childCount = (name: string) =>
      visibleItems.filter((it) => it.parent === name).length;
    return visibleItems.flatMap((it) => {
      const cc = childCount(it.name);
      return buildGroup(it, cc > 0, cc);
    });
    // 差（金額）は表示単位で整数化してから引くため displayUnit に依存する
  }, [source, isWholesaleContext, aggFilter, isOptionalShown, displayUnit]);

  // ドリルダウン展開状態に応じた表示行。折りたたみ中の子行（予算比/前年比）を除外し、
  // グループ先頭フラグと rowSpan（可視行数）を再計算する。
  const displayRows = useMemo<AnnualTotalData[]>(() => {
    // 項目名→親項目のマップ（項目階層の折りたたみ判定に使用）
    const parentOf = new Map<string, string | undefined>();
    rowData.forEach((r) => {
      if (r.groupName) parentOf.set(r.groupName, r.itemParent);
    });
    // 祖先項目がすべて展開されている項目だけ表示する
    const itemVisible = (name?: string): boolean => {
      let cur = name ? parentOf.get(name) : undefined;
      while (cur) {
        if (!expandedItems.has(cur)) return false;
        cur = parentOf.get(cur);
      }
      return true;
    };
    const visible = rowData.filter((r) => {
      // 項目階層：親が折りたたみ中なら非表示
      if (!itemVisible(r.groupName)) return false;
      // サブ項目（予算比/前年比）の折りたたみ
      return r.childOf
        ? expandedRows.has(`${r.groupName}::${r.childOf}`)
        : true;
    });
    // グループ毎の可視行数を集計
    const counts: Record<string, number> = {};
    visible.forEach((r) => {
      const g = r.groupName || '';
      counts[g] = (counts[g] || 0) + 1;
    });
    // 各グループ先頭行に isFirstInGroup・最終行に isLastInGroup・groupRowSpan を付与
    const seen: Record<string, boolean> = {};
    return visible.map((r, idx) => {
      const g = r.groupName || '';
      const first = !seen[g];
      seen[g] = true;
      const next = visible[idx + 1];
      const isLast = !next || (next.groupName || '') !== g;
      return {
        ...r,
        isFirstInGroup: first,
        isLastInGroup: isLast,
        groupRowSpan: first ? counts[g] : 1,
      };
    });
  }, [rowData, expandedRows, expandedItems]);

  // セルレンダラに渡す開閉状態（AG Grid 標準の context）。開閉時は displayRows の変化で
  // 下の refreshCells({ force: true }) が走り、各セルがこの最新の context で再描画される。
  const gridContext = useMemo<AnnualTotalGridContext>(
    () => ({ expandedItems, expandedRows, toggleItem }),
    [expandedItems, expandedRows, toggleItem]
  );

  // 表示行・表示単位（円/千円）・列表示が変わるたびに、セルを強制再描画してから列幅を再調整する。
  // 表示単位の切替は rowData と columnDefs（valueFormatter）を同時に差し替えるため、
  // refreshCells を明示しないと AG Grid が旧フォーマッタの結果を再利用し、
  // 表示が1操作分遅れる（円を押しても千円表示のままになる）。
  useEffect(() => {
    const id = setTimeout(() => {
      gridRef.current?.api?.refreshCells({ force: true });
      handleAutoSizeColumns();
    }, 0);
    return () => clearTimeout(id);
  }, [displayRows, displayUnit, columnVisibility, handleAutoSizeColumns]);

  const formatNumber = (
    value: number,
    isPercentage: boolean = false,
    isUnitExempt: boolean = false
  ) => {
    // 率は小数点以下2桁を四捨五入し、小数点以下1桁・3桁区切りで表示する
    //（グラフ・詳細タブと同じ丸め＝販売計画(集計)全体で桁を揃える）。
    if (isPercentage) {
      return formatPlanRate(value, PLAN_DETAIL_DIGITS.rate);
    }
    // 千円単位の場合は下3桁を削除（1000で割る）。
    // ただし函数などの数量項目は表示単位切替の対象外のため、そのまま表示する。
    const displayValue =
      displayUnit === 'thousand' && !isUnitExempt
        ? Math.round(value / 1000)
        : value;
    // 金額・函数（計画/実績・予算・前年実績）は四捨五入して整数で表示する。
    return Math.round(displayValue).toLocaleString('ja-JP');
  };

  // 差（金額）行の集計列の値。その列に含まれる月の「生値合計」を表示規則（円=四捨五入／
  // 千円(非exempt)=四捨五入 /1000）で丸めてから引く。計画実績・予算/前年実績セルは
  // 「生値合計→表示時丸め」で表示されるため、同じ生値合計に同じ丸めを適用することで、
  // 差(列) == 画面表示の計画実績(列) − 予算/前年実績(列) が円・千円とも常に一致する。
  const aggDiffValue = (
    data: AnnualTotalData,
    fields: readonly string[]
  ): number => {
    const roundBy = (v: number) =>
      displayUnit === 'thousand' && !data.diffExempt
        ? Math.round(v / 1000)
        : Math.round(v);
    const sum = (rec?: Record<string, number>) =>
      fields.reduce((s, f) => s + (rec?.[f] ?? 0), 0);
    return roundBy(sum(data.diffPlanRaw)) - roundBy(sum(data.diffOtherRaw));
  };

  // 差率（予算比/前年比）行の集計列。月次%を合計すると期間比率にならないため
  //（例：1〜7月で 98.04% × 7 ≒ 686%）、生値の期間合計から Σ分子 ÷ Σ分母 × 100 で再計算する。
  const aggRatioValue = (
    data: AnnualTotalData,
    fields: readonly string[]
  ): number => {
    const sum = (rec?: Record<string, number>) =>
      fields.reduce((s, f) => s + (rec?.[f] ?? 0), 0);
    const den = sum(data.ratioDenRaw);
    // 分母0は月次と同じく0%扱い（月次の budgetRatio / prevRatio と揃える）。
    if (!den) return 0;
    return (sum(data.ratioNumRaw) / den) * 100;
  };

  // 率項目（管理利益率・量経追加口率・売上連動拡売費率）の集計列。
  // 月次%の合計は期間の率にならないため、Σ分子 ÷ Σ分母 × 100 で算出する
  //（管理利益率(年間)＝管理利益額(年間) ÷ 売上高(年間) × 100）。
  const aggRateValue = (
    data: AnnualTotalData,
    fields: readonly string[]
  ): number => {
    const sum = (rec?: Record<string, number>) =>
      fields.reduce((s, f) => s + (rec?.[f] ?? 0), 0);
    const den = sum(data.aggDenRaw);
    // 分母0は月次（computeForMonths の率算出）と同じく0%扱い。
    if (!den) return 0;
    return (sum(data.aggNumRaw) / den) * 100;
  };

  // 集計列（累計・年間・上期・下期・四半期・年計）共通の値算出。
  //   差（金額） ：列の生値合計を表示規則で丸めてから引く（画面の計画実績−予算と一致させる）
  //   差率       ：Σ計画／実績 ÷ Σ予算(前年実績) × 100
  //   率項目     ：Σ分子 ÷ Σ分母 × 100（管理利益率＝管理利益額 ÷ 売上高）
  //   その他     ：月次値の単純合計
  const aggColumnValue = (
    data: AnnualTotalData,
    fields: readonly string[]
  ): number => {
    if (data.isDiffRow && data.diffPlanRaw) return aggDiffValue(data, fields);
    if (data.ratioNumRaw && data.ratioDenRaw)
      return aggRatioValue(data, fields);
    if (data.aggNumRaw && data.aggDenRaw) return aggRateValue(data, fields);
    return fields.reduce(
      (s, f) => s + (Number((data as Record<string, any>)[f]) || 0),
      0
    );
  };

  // データセル共通フォーマッタ。親ラベル行（予算/前年実績）はデータを持たないため空欄表示。
  const formatCell = (params: any) => {
    if (params.data?.isGroupHeaderRow) return '';
    const value = params.value;
    // 差行のマイナスは「△1,000」表記（絶対値＋△）。色付けは cellStyle 側で行う。
    if (params.data?.isDiffRow && typeof value === 'number' && value < 0) {
      return `△${formatNumber(
        Math.abs(value),
        params.data?.isPercentage,
        params.data?.isUnitExempt
      )}`;
    }
    return formatNumber(
      value,
      params.data?.isPercentage,
      params.data?.isUnitExempt
    );
  };

  // クリックされたセルの計算に使用されている月セルを判定
  const getSourceMonthFields = (colId: string): string[] => {
    const monthMap: { [key: string]: string } = {
      '1': 'jan',
      '2': 'feb',
      '3': 'mar',
      '4': 'apr',
      '5': 'may',
      '6': 'jun',
      '7': 'jul',
      '8': 'aug',
      '9': 'sep',
      '10': 'oct',
      '11': 'nov',
      '12': 'dec',
    };

    if (colId.includes('cumulative')) {
      const endMonth = parseInt(selectedMonth);
      const fields: string[] = [];
      for (let i = 1; i <= endMonth; i++) {
        fields.push(monthMap[i.toString()]);
      }
      return fields;
    }
    if (colId.includes('annual')) {
      return Object.values(monthMap);
    }
    if (colId.includes('firstHalf')) {
      return ['jan', 'feb', 'mar', 'apr', 'may', 'jun'];
    }
    if (colId.includes('secondHalf')) {
      return ['jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    }
    if (colId.includes('q1')) {
      return ['jan', 'feb', 'mar'];
    }
    if (colId.includes('q2')) {
      return ['apr', 'may', 'jun'];
    }
    if (colId.includes('q3')) {
      return ['jul', 'aug', 'sep'];
    }
    if (colId.includes('q4')) {
      return ['oct', 'nov', 'dec'];
    }
    return [];
  };

  // 対象グループかどうか判定
  const isTargetGroup = (groupName: string) => {
    const targetGroups = [
      '函数',
      '売上高',
      '社外売上高',
      '管理利益額',
      '管理利益率',
      SALES_UNIT_PRICE_LABEL,
      PROMO_ITEM_NAME,
      '納品金額',
    ];
    return targetGroups.includes(groupName);
  };

  // 対象サブ項目かどうか判定（差／差率も算出元を持つため対象に含める）
  const isTargetSubItem = (subItem: string) => {
    const targetSubItems = [
      '計画／実績',
      '予算',
      '前年実績',
      '予算比',
      '予算差',
      '前年比',
      '前年差',
    ];
    return targetSubItems.includes(subItem);
  };

  // 差／差率の算出元サブ項目（分子・分母）。値行は自身のみを算出元とする。
  const sourceSubItems = (subItem: string): string[] => {
    if (subItem === '予算比' || subItem === '予算差')
      return ['計画／実績', '予算'];
    if (subItem === '前年比' || subItem === '前年差')
      return ['計画／実績', '前年実績'];
    return [subItem];
  };

  // クリックされたセルの算出元となる行インデックス一覧を求める。
  // 差／差率は自行に月次値を持たないため、計画／実績行と予算(前年実績)行を対象にする。
  const sourceRowIndexes = (params: any): number[] => {
    const data = params.data as AnnualTotalData | undefined;
    const ownIndex = params.node?.rowIndex ?? 0;
    if (!data) return [ownIndex];
    const targets = sourceSubItems(data.subItem);
    if (targets.length === 1 && targets[0] === data.subItem) return [ownIndex];
    const indexes: number[] = [];
    params.api?.forEachNode((node: any) => {
      const row = node.data as AnnualTotalData | undefined;
      if (!row || row.groupName !== data.groupName) return;
      if (targets.includes(row.subItem) && node.rowIndex != null)
        indexes.push(node.rowIndex);
    });
    return indexes.length > 0 ? indexes : [ownIndex];
  };

  // 集計列共通のセルクリック処理（青枠ハイライトの算出元を確定する）。
  const makeCellClickHandler = (colId: string) => (params: any) => {
    const groupName = params.data?.groupName || '';
    const subItem = params.data?.subItem || '';
    if (isTargetGroup(groupName) && isTargetSubItem(subItem)) {
      setClickedCell({ rowIndexes: sourceRowIndexes(params), colId });
    }
  };

  // 対象列かどうか判定
  const isTargetColumn = (colId: string) => {
    return (
      colId.includes('cumulative') ||
      colId.includes('annual') ||
      colId.includes('firstHalf') ||
      colId.includes('secondHalf') ||
      colId.includes('q1') ||
      colId.includes('q2') ||
      colId.includes('q3') ||
      colId.includes('q4')
    );
  };

  // サブ項目セル：予算・前年実績は開閉アイコン付きの親行、率（予算比/前年比）は子行としてインデント表示。
  const SubItemCellRenderer = (params: ICellRendererParams) => {
    const data = params.data;
    const isParent = data?.isDrillParent;
    const isChild = !!data?.childOf;
    const { expandedRows } = params.context as AnnualTotalGridContext;
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

  const GroupCellRenderer = (params: ICellRendererParams) => {
    if (!params.data?.isFirstInGroup) return null;
    const data = params.data as AnnualTotalData;
    // 項目階層：ネスト分インデント、子項目を持つ項目は chevron＋（折りたたみ時）件数を表示。
    const level = data.itemLevel ?? 0;
    const hasChildren = !!data.itemHasChildren;
    const itemName = data.groupName || '';
    const { expandedItems, toggleItem } =
      params.context as AnnualTotalGridContext;
    const expanded = expandedItems.has(itemName);
    const showCount =
      hasChildren && !expanded && (data.itemChildCount ?? 0) > 0;
    return (
      // 項目は左上・太字（集計表の共通の書式 → aggregationTableStyle.ts・UX-095）
      <div
        className={AGG_ITEM_CONTENT_CLASS}
        style={{
          whiteSpace: 'pre-line',
          paddingLeft: `${level}rem`,
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className={`${AGG_ITEM_TOGGLE_CLASS} border-0 bg-transparent px-1 cursor-pointer`}
            onClick={(e) => {
              e.stopPropagation();
              toggleItem(itemName);
            }}
            aria-label={expanded ? '折りたたむ' : '展開する'}
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
            <span className="ml-1 font-normal text-gray-500">
              ({data.itemChildCount})
            </span>
          )}
        </span>
      </div>
    );
  };

  // 実績セル（左上の三角）の判定。三角は「実績が反映されたセル」を示すため、累計月選択ではなく
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

    // 月列（累計月選択の単月列を含む）：実績反映月（1月〜5月）のみ左上の三角
    if (columnType === 'month') return isActualReflectedMonth(monthField);

    // 累計・年間・上期・下期・四半期・年計は複数月の集計値のため実績セルとしない
    return false;
  };

  const getDataCellStyle = asCellStyle(
    (
      params: any,
      _isImportant: boolean = false,
      columnType: string = '',
      monthField?: string
    ) => {
      const rowIndex = params.node?.rowIndex || 0;
      const stripeColor = GRID_COLORS.background;
      const subItem = params.data?.subItem || '';
      const groupName = params.data?.groupName || '';
      const highlight = shouldHighlight(subItem, columnType, monthField);

      // ハイライト対象のセルかチェック
      const colId = params.column?.colId || '';
      // 算出元行（差／差率は計画／実績行＋予算(前年実績)行）の対象期間の月セルを強調する。
      const isHighlighted =
        clickedCell &&
        clickedCell.rowIndexes.includes(rowIndex) &&
        getSourceMonthFields(clickedCell.colId).includes(monthField || '');

      return {
        backgroundColor: isHighlighted
          ? GRID_COLORS.clickHighlightBg
          : stripeColor,
        // 文字色はテーマ既定の黒字。予算比・前年比の100%超過だけ、経費の項目は赤・それ以外は青（UX-096）
        color: ratioRowTextColor(params.data, params.value),
        paddingRight: '0.75rem',
        // 計画／実績の行は太字（UX-095）
        fontWeight: isAggPrimaryRow(params.data) ? 'bold' : 'normal',
        // サブ行間は薄い罫線、項目境界（各項目の最終行）は濃い罫線で区切る（重複防止のため下罫線に一本化）
        borderBottom: aggRowBorderBottom(params.data),
        border: isHighlighted
          ? `0.125rem solid ${GRID_COLORS.clickHighlightBorder}`
          : undefined,
        // 実績反映済み（函数/計算式）セルは、年間計画の1〜5月セルと同様に
        // 枠ではなくセル左上の三角で示す（existingFuncCellStyle → 02 §7）
        ...(highlight && !isHighlighted ? existingFuncCellStyle() : {}),
        cursor:
          isTargetGroup(groupName) &&
          isTargetSubItem(subItem) &&
          isTargetColumn(colId)
            ? 'pointer'
            : 'default',
      };
    }
  );

  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(() => {
    const monthMap: { [key: string]: string } = {
      '1': 'jan',
      '2': 'feb',
      '3': 'mar',
      '4': 'apr',
      '5': 'may',
      '6': 'jun',
      '7': 'jul',
      '8': 'aug',
      '9': 'sep',
      '10': 'oct',
      '11': 'nov',
      '12': 'dec',
    };

    return [
      {
        headerName: '項目',
        children: [
          {
            headerName: '',
            // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
            suppressColumnsToolPanel: true,
            field: 'group',
            // 項目で絞り込んだら配下のサブ項目（予算・前年実績・差・比）も残す。項目名は先頭の行にしか
            // 無いため、絞り込みの値は全行で項目名にする（AG Grid 公式 filterValueGetter。UX-097）
            filterValueGetter: aggItemFilterValue,
            width: ANNUAL_ITEM_COL_WIDTH,
            lockPinned: true,
            suppressAutoSize: true,
            cellRenderer: GroupCellRenderer,
            rowSpan: (params) => {
              return params.data?.isFirstInGroup
                ? params.data?.groupRowSpan || 1
                : 1;
            },
            // 先頭列の左寄せは ag-cell-left、結合したセルの中身は上に置く cell-span-top
            // （grid.css。項目は左上・太字 → 02 §7「集計表の項目と計画／実績の行」・UX-095）
            cellClass: AGG_ITEM_CELL_CLASS,
            cellStyle: (_params) => {
              const stripeColor = GRID_COLORS.background;

              return {
                backgroundColor: stripeColor,
                // 項目列は1文字インデント
                paddingLeft: '1em',
                // 項目セルは rowSpan で項目全体を占めるため、下端（項目境界）に濃い横罫線
                borderBottom: `1px solid ${GRID_COLORS.strongDivider}`,
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
            // 横寄せは共通クラスで指定する（→ 02 §6 セルの寄せ）
            cellClass: 'cell-left',
            cellStyle: (params) => {
              const stripeColor = GRID_COLORS.background;

              return {
                backgroundColor: stripeColor,
                paddingLeft: '0.75rem',
                // 計画／実績の行は太字（UX-095）
                fontWeight: isAggPrimaryRow(params.data) ? 'bold' : 'normal',
                // サブ行間は薄い罫線、項目境界（最終行）は濃い罫線で区切る
                borderBottom: aggRowBorderBottom(params.data),
              };
            },
          },
        ],
      },
      {
        // 累計列の左隣：累計月選択で選択した月の単月データ（既存の月別列と同じ値）
        headerName: `${selectedMonth}月`,
        width: 80,
        colId: 'selectedMonthSingle',
        valueGetter: (params) => {
          const data = params.data;
          if (!data) return 0;
          return data[monthMap[selectedMonth]] || 0;
        },
        valueFormatter: formatCell,
        cellStyle: (params) =>
          getDataCellStyle(params, false, 'month', monthMap[selectedMonth]),
      },
      {
        headerName: `${selectedMonth}月迄累計`,
        width: 96,
        hide: !columnVisibility.cumulative,
        colId: 'cumulative',
        valueGetter: (params) => {
          const data = params.data;
          if (!data) return 0;
          const endMonth = parseInt(selectedMonth);
          const fields: string[] = [];
          for (let i = 1; i <= endMonth; i++)
            fields.push(monthMap[i.toString()]);
          return aggColumnValue(data, fields);
        },
        valueFormatter: formatCell,
        onCellClicked: makeCellClickHandler('cumulative'),
        // 横寄せは共通クラスで指定する（→ 02 §6 セルの寄せ）
        cellClass: 'cell-right',
        cellStyle: asCellStyle((params) => {
          const stripeColor = GRID_COLORS.background;
          const subItem = params.data?.subItem || '';
          const groupName = params.data?.groupName || '';
          const highlight = shouldHighlight(subItem, 'cumulative');

          return {
            backgroundColor: stripeColor,
            // 予算比・前年比の100%超過は、経費の項目は赤・それ以外は青（ほかの数値の列と同じ。UX-096）
            color: ratioRowTextColor(params.data, params.value),
            paddingRight: '0.75rem',
            // 計画／実績の行は太字、項目の境目は濃い線（ほかの数値の列と同じ。UX-095）
            fontWeight: isAggPrimaryRow(params.data) ? 'bold' : 'normal',
            borderBottom: aggRowBorderBottom(params.data),
            // 実績反映済み（函数/計算式）セルはセル左上の三角で示す（existingFuncCellStyle）
            ...(highlight ? existingFuncCellStyle() : {}),
            cursor:
              isTargetGroup(groupName) && isTargetSubItem(subItem)
                ? 'pointer'
                : 'default',
          };
        }),
      },
      {
        headerName: '年間',
        width: 96,
        hide: !columnVisibility.annual,
        colId: 'annual',
        valueGetter: (params) => {
          const data = params.data;
          if (!data) return 0;
          const fields = [
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
          ];
          return aggColumnValue(data, fields);
        },
        valueFormatter: formatCell,
        onCellClicked: makeCellClickHandler('annual'),
        cellStyle: (params) => getDataCellStyle(params, true, 'annual'),
      },
      {
        headerName: '上期',
        width: 92,
        hide: !columnVisibility.firstHalf,
        colId: 'firstHalf',
        valueGetter: (params) => {
          const data = params.data;
          if (!data) return 0;
          const fields = ['jan', 'feb', 'mar', 'apr', 'may', 'jun'];
          return aggColumnValue(data, fields);
        },
        valueFormatter: formatCell,
        onCellClicked: makeCellClickHandler('firstHalf'),
        cellStyle: (params) => getDataCellStyle(params, false, 'firstHalf'),
      },
      {
        headerName: '下期',
        width: 92,
        hide: !columnVisibility.secondHalf,
        colId: 'secondHalf',
        valueGetter: (params) => {
          const data = params.data;
          if (!data) return 0;
          const fields = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          return aggColumnValue(data, fields);
        },
        valueFormatter: formatCell,
        onCellClicked: makeCellClickHandler('secondHalf'),
        cellStyle: (params) => getDataCellStyle(params, false, 'secondHalf'),
      },
      {
        headerName: '第１Q計',
        width: 80,
        hide: !columnVisibility.q1,
        colId: 'q1',
        valueGetter: (params) => {
          const data = params.data;
          if (!data) return 0;
          const fields = ['jan', 'feb', 'mar'];
          return aggColumnValue(data, fields);
        },
        valueFormatter: formatCell,
        onCellClicked: makeCellClickHandler('q1'),
        cellStyle: (params) => ({
          ...getDataCellStyle(params, false, 'q1'),
          borderRight: `1px solid ${GRID_COLORS.strongDivider}`,
        }),
      },
      {
        headerName: '第２Q計',
        width: 80,
        hide: !columnVisibility.q2,
        colId: 'q2',
        valueGetter: (params) => {
          const data = params.data;
          if (!data) return 0;
          const fields = ['apr', 'may', 'jun'];
          return aggColumnValue(data, fields);
        },
        valueFormatter: formatCell,
        onCellClicked: makeCellClickHandler('q2'),
        cellStyle: (params) => ({
          ...getDataCellStyle(params, false, 'q2'),
          borderRight: `1px solid ${GRID_COLORS.strongDivider}`,
        }),
      },
      {
        headerName: '第３Q計',
        width: 80,
        hide: !columnVisibility.q3,
        colId: 'q3',
        valueGetter: (params) => {
          const data = params.data;
          if (!data) return 0;
          const fields = ['jul', 'aug', 'sep'];
          return aggColumnValue(data, fields);
        },
        valueFormatter: formatCell,
        onCellClicked: makeCellClickHandler('q3'),
        cellStyle: (params) => ({
          ...getDataCellStyle(params, false, 'q3'),
          borderRight: `1px solid ${GRID_COLORS.strongDivider}`,
        }),
      },
      {
        headerName: '第４Q計',
        width: 80,
        hide: !columnVisibility.q4,
        colId: 'q4',
        valueGetter: (params) => {
          const data = params.data;
          if (!data) return 0;
          const fields = ['oct', 'nov', 'dec'];
          return aggColumnValue(data, fields);
        },
        valueFormatter: formatCell,
        onCellClicked: makeCellClickHandler('q4'),
        cellStyle: (params) => ({
          ...getDataCellStyle(params, false, 'q4'),
          borderRight: `1px solid ${GRID_COLORS.strongDivider}`,
        }),
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
            headerName: '',
            // 見出しが空の列は列選択に出さない（空白のチェックボックスになるため → 02 §8・UX-061）
            suppressColumnsToolPanel: true,
            colId: 'monthsTotal',
            width: 88,
            columnGroupShow: 'closed',
            valueGetter: () => null,
            valueFormatter: () => '',
            cellStyle: (params) => getDataCellStyle(params, true, 'yearTotal'),
          } as ColDef,
          ...(
            [
              ['1月', 'jan'],
              ['2月', 'feb'],
              ['3月', 'mar'],
              ['4月', 'apr'],
              ['5月', 'may'],
              ['6月', 'jun'],
              ['7月', 'jul'],
              ['8月', 'aug'],
              ['9月', 'sep'],
              ['10月', 'oct'],
              ['11月', 'nov'],
              ['12月', 'dec'],
            ] as const
          ).map(
            ([hn, f]): ColDef => ({
              headerName: hn,
              field: f,
              width: 72,
              hide: !columnVisibility[f as keyof typeof columnVisibility],
              // グループ展開時のみ表示（折りたたみ時は隠す）
              columnGroupShow: 'open',
              valueFormatter: formatCell,
              cellStyle: asCellStyle((params) =>
                getDataCellStyle(params, false, 'month', f)
              ),
            })
          ),
        ],
      },
    ];
    // 開閉状態（expandedItems / expandedRows）は依存に含めない。項目列・サブ項目列の
    // cellRenderer は params.context から読むため、列定義を作り直さなくても chevron と
    // aria-label が追従する（作り直すと列幅がリセットされ、開閉のたびに表が一瞬横に伸びる）。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- セルの書式・値の関数が読む表示単位・対象月・列の表示・クリックしたセルは依存に入っている（関数を入れると描画のたびに列定義を作り直し列幅が戻る）
  }, [selectedMonth, columnVisibility, displayUnit, clickedCell]);

  const defaultColDef = useMemo(
    () => ({
      // 編集できない列の見出しをグレーにする（GRID_DEFAULT_COL_DEF を引き継がないため明示。→ grid/gridCommon）
      headerStyle: gridHeaderStyle,
      sortable: false,
      resizable: true,
      filter: true,
      suppressMovable: true,
      // 数値の列は右寄せ（ラベルの列は列ごとに cellClass で上書きする → 02 §6 セルの寄せ）
      cellClass: 'cell-right',
      // ヘッダーのフィルター／列メニューボタンを非表示（販売計画詳細と統一）
      suppressHeaderMenuButton: true,
      suppressHeaderFilterButton: true,
      // マウスオーバーは画面設計標準（列幅で省略された値の全文表示）に従い、共通の tooltip を使う。
      // 計算式の表示は行わない（第1回手売りセッション 決定事項15）。
      // 注記を持つ項目（納品金額）は、その行のどのセルでも注記を添える（課題1815）。
      tooltipValueGetter: (params: any) => {
        const base = GRID_DEFAULT_COL_DEF.tooltipValueGetter?.(params);
        const note = ITEM_NOTES[params.data?.groupName ?? ''];
        if (!note) return base;
        return base
          ? `${base}
${note}`
          : note;
      },
    }),
    []
  );

  // グリッド外クリックでハイライトをクリア
  const handleGridClick = useCallback(() => {
    setClickedCell(null);
  }, []);

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
              <SegmentToggle
                ariaLabel="表示単位"
                options={[
                  { value: 'yen', label: '円' },
                  { value: 'thousand', label: '千円' },
                ]}
                value={displayUnit}
                onChange={setInternalDisplayUnit}
              />
            </div>
          )}

          {/* 補助項目（△）の表示トグル（資料「各項目_折りたたみ表示」準拠）。
              入力するものと凡例を離すため左側に配置する（第1回手売りセッション 決定事項32） */}
          <button
            type="button"
            onClick={() => setIsOptionalShown((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
            aria-label={isOptionalShown ? '補助項目を隠す' : '補助項目を表示'}
          >
            {isOptionalShown ? (
              <Minus className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isOptionalShown ? '補助項目を隠す' : '補助項目を表示'}
          </button>
        </div>
        {/* 凡例は「サンプル → 説明」の順で表示し、右端に配置する（決定事項32）。
            「反映」ではユーザーが選択した実績か自動反映かの区別が付かないため「選択実績セル」とする */}
        <div className="flex items-center gap-1 text-sm">
          <span
            className="text-black px-2 py-1 font-medium"
            style={existingFuncCellStyle()}
          >
            XXX,XXX
          </span>
          <span className="text-black bg-white px-2 py-1">：選択実績セル</span>
        </div>
      </div>

      {isColumnSettingsShown && (
        <div className="mb-3 p-4 border rounded-lg bg-gray-50">
          <div className="text-sm font-medium mb-2">表示列設定</div>
          <div className="grid grid-cols-5 gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-cumulative"
                checked={columnVisibility.cumulative}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    cumulative: !!checked,
                  })
                }
              />
              <label htmlFor="col-cumulative" className="text-sm">
                累計
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-annual"
                checked={columnVisibility.annual}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    annual: !!checked,
                  })
                }
              />
              <label htmlFor="col-annual" className="text-sm">
                年間
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-firstHalf"
                checked={columnVisibility.firstHalf}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    firstHalf: !!checked,
                  })
                }
              />
              <label htmlFor="col-firstHalf" className="text-sm">
                上期
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-secondHalf"
                checked={columnVisibility.secondHalf}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    secondHalf: !!checked,
                  })
                }
              />
              <label htmlFor="col-secondHalf" className="text-sm">
                下期
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-q1"
                checked={columnVisibility.q1}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    q1: !!checked,
                  })
                }
              />
              <label htmlFor="col-q1" className="text-sm">
                第1Q
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-q2"
                checked={columnVisibility.q2}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    q2: !!checked,
                  })
                }
              />
              <label htmlFor="col-q2" className="text-sm">
                第2Q
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-q3"
                checked={columnVisibility.q3}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    q3: !!checked,
                  })
                }
              />
              <label htmlFor="col-q3" className="text-sm">
                第3Q
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-q4"
                checked={columnVisibility.q4}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    q4: !!checked,
                  })
                }
              />
              <label htmlFor="col-q4" className="text-sm">
                第4Q
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-jan"
                checked={columnVisibility.jan}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    jan: !!checked,
                  })
                }
              />
              <label htmlFor="col-jan" className="text-sm">
                1月
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-feb"
                checked={columnVisibility.feb}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    feb: !!checked,
                  })
                }
              />
              <label htmlFor="col-feb" className="text-sm">
                2月
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-mar"
                checked={columnVisibility.mar}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    mar: !!checked,
                  })
                }
              />
              <label htmlFor="col-mar" className="text-sm">
                3月
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-apr"
                checked={columnVisibility.apr}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    apr: !!checked,
                  })
                }
              />
              <label htmlFor="col-apr" className="text-sm">
                4月
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-may"
                checked={columnVisibility.may}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    may: !!checked,
                  })
                }
              />
              <label htmlFor="col-may" className="text-sm">
                5月
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-jun"
                checked={columnVisibility.jun}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    jun: !!checked,
                  })
                }
              />
              <label htmlFor="col-jun" className="text-sm">
                6月
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-jul"
                checked={columnVisibility.jul}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    jul: !!checked,
                  })
                }
              />
              <label htmlFor="col-jul" className="text-sm">
                7月
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-aug"
                checked={columnVisibility.aug}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    aug: !!checked,
                  })
                }
              />
              <label htmlFor="col-aug" className="text-sm">
                8月
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-sep"
                checked={columnVisibility.sep}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    sep: !!checked,
                  })
                }
              />
              <label htmlFor="col-sep" className="text-sm">
                9月
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-oct"
                checked={columnVisibility.oct}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    oct: !!checked,
                  })
                }
              />
              <label htmlFor="col-oct" className="text-sm">
                10月
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-nov"
                checked={columnVisibility.nov}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    nov: !!checked,
                  })
                }
              />
              <label htmlFor="col-nov" className="text-sm">
                11月
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="col-dec"
                checked={columnVisibility.dec}
                onCheckedChange={(checked) =>
                  setColumnVisibility({
                    ...columnVisibility,
                    dec: !!checked,
                  })
                }
              />
              <label htmlFor="col-dec" className="text-sm">
                12月
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="py-0 w-full flex-1 overflow-hidden">
        <div
          className="annual-total-grid"
          style={{ height: '100%', width: '100%' }}
        >
          <style>{`
              /* （見出しの背景色・文字色は共通テーマ GRID_THEME に委ねる → 02 §7「ヘッダーの配色」・UI/UX UX-031）
                 ヘッダーと明細の間に青い強調線は引かない。
                 見出しのセルの余白は共通テーマのまま（上下に余白を足すと、高さ 1.75rem の見出しで文字の上が切れる。UX-095） */

              /* 見出しの寄せは grid.css の共通指定（左寄せ）に委ねる */
              .annual-total-grid .ag-header-group-cell {
                font-weight: 700;
                border-right: 1px solid var(--grid-grid-line);
                display: flex;
                align-items: center;
              }

              .annual-total-grid .ag-cell {
                border-bottom: 1px solid var(--grid-grid-line);
                /* 上下の余白は付けない（付けると文字が行の高さに収まらず下へずれる。縦中央は line-height に任せる） */
                padding: 0 0.625rem;
              }

              .annual-total-grid .ag-cell-inline-editing {
                border: none;
              }

              .annual-total-grid .ag-row {
                border: none;
              }

              .annual-total-grid .ag-row-even,
              .annual-total-grid .ag-row-odd {
                background-color: transparent;
              }

              .annual-total-grid .ag-row-hover .ag-cell {
                background-color: var(--grid-row-hover) !important;
              }

              .annual-total-grid .ag-root-wrapper {
                border: 1px solid var(--grid-grid-line);
                border-radius: 4px;
              }

              /* 固定列の境界は他の列と同じ 1px 罫線に統一（影は付けない） */
              .annual-total-grid .ag-pinned-left-header {
                box-shadow: none;
                z-index: 1;
              }

              .annual-total-grid .ag-pinned-left-cols-container {
                box-shadow: none;
                z-index: 1;
              }



              .annual-total-grid .ag-header-cell.ag-header-cell-last-left-pinned {
                border-right: 1px solid var(--grid-grid-line) !important;
              }
            `}</style>
          {/* theme は指定せず、App.tsx の provideGlobalGridOptions で登録した
              共通テーマ(GRID_THEME / themeBalham)を継承する（販売計画(詳細)と統一） */}
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
            context={gridContext}
            {...gridColumnStateProps}
            onBodyScroll={handleGridClick}
            onRowClicked={(params: any) => {
              const d = params.data as AnnualTotalData;
              if (!d) return;
              // chevron（ボタン）由来のクリックはボタン側の onClick で開閉済みのため無視する。
              // AG Grid は行DOMへネイティブの click リスナーを張り、React は #root で受けるため
              // 実行順が「行クリック→ボタンの onClick」となり、ボタン側の stopPropagation では
              // ここを止められない。除外しないと1クリックで2回トグルして開閉が打ち消される。
              if ((params.event?.target as HTMLElement)?.closest?.('button'))
                return;
              // 項目の先頭行（計画/実績）クリックで項目階層の開閉（chevron以外でも開閉可）
              if (d.isFirstInGroup && d.itemHasChildren && d.groupName) {
                toggleItem(d.groupName);
                return;
              }
              // 予算/前年実績の行クリックでサブ項目（率）の開閉
              if (
                d.isDrillParent &&
                d.groupName != null &&
                d.expandKey != null
              ) {
                toggleDrillRow(d.groupName, d.expandKey);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

// 拡売費計画グリッドの行 → 集計ソース（AggregationExpense[]）への変換。
//
// 補足3-1 の拡売費関連項目（No.12〜14・18〜20・22〜24・31）はすべて
// 「[拡売費計画]管理区分・管理コードが○○の対象 の集計」で定義されるため、
// 管理区分をそのまま集計の費目（category）として扱う。
//
// 拡売費集計対象選択（対象月／計上月）に応じて集計月が切り替わるよう、2系列を持つ。
//   ・対象月基準：販売計画の対象年月に属するものとして集計する
//   ・計上月基準：グリッドの計上年月に属するものとして集計する
//     （対象月基準の系列を (計上月 − 対象月) か月ずらす。12か月で循環）
import { managementClassFromCode } from '../constants/expenseRelations';
import { SUMMARY_PRODUCT_OPTIONS } from '../constants/productMasters';
import {
  toAxisMetaBrand,
  toAxisCapacity,
  AXIS_OTHER,
} from '../constants/aggregationAxisMapping';
import {
  expandToMonths,
  shiftMonths,
} from '../constants/aggregationMasterDummy';
import { monthIndex0Of } from './yearMonth';
import type {
  AggregationExpense,
  ExpenseCategory,
} from '../constants/aggregationSourceData';

// 集計対象となる管理区分の一覧（AggregationExpense.category と一致させる）
export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  '売上連動拡売費A口',
  '売上連動拡売費B口',
  '売上連動拡売費本社口',
  '拡売費(固定費)A口',
  '拡売費(固定費)B口',
  '拡売費(固定費)本社口',
  'ロケ補填',
  'コラム料',
  'リース料',
  '販売器具費',
];

// 集計に必要な項目のみ参照する緩い行型（NonProductExpenseData と構造互換）。
export interface ExpenseGridRow {
  isTotal?: boolean;
  metaBrand?: string;
  summaryProduct?: string;
  exp1PlannedAmount?: number | string | null;
  exp1PostingMonth?: string;
  exp1ManagementClass?: string;
  exp1ManagementCode?: string;
}

export interface ExpenseGridContext {
  // 対象年月の月インデックス（0始まり）
  targetMonthIdx0: number;
}

const isExpenseCategory = (value: string): value is ExpenseCategory =>
  (EXPENSE_CATEGORIES as readonly string[]).includes(value);

export function toAggregationExpenses(
  rows: ExpenseGridRow[],
  context: ExpenseGridContext
): AggregationExpense[] {
  const expenses: AggregationExpense[] = [];
  for (const row of rows) {
    // 合計行は集計対象外
    if (row.isTotal) continue;

    // 管理区分。行が保持していない場合は管理コードの接頭辞から復元する
    const className =
      row.exp1ManagementClass ||
      managementClassFromCode(row.exp1ManagementCode ?? '');
    if (!isExpenseCategory(className)) continue;

    const amount = Number(row.exp1PlannedAmount ?? 0);
    if (!Number.isFinite(amount) || amount === 0) continue;

    // 集計軸：サマリ商品が指定されていればそのマスタから、無ければ行のメタブランドから引く
    // （補足1-3：サマリ商品は任意項目）
    const master = SUMMARY_PRODUCT_OPTIONS.find(
      (option) => option.value === row.summaryProduct
    );
    const metaBrand = master?.metaBrand ?? row.metaBrand ?? '';
    const capacity = master
      ? toAxisCapacity(master.containerCapacityG, master.metaBrand)
      : AXIS_OTHER;

    const amountByTargetMonth = expandToMonths(amount, context.targetMonthIdx0);
    const postingIdx0 = monthIndex0Of(row.exp1PostingMonth ?? '');
    // 計上月が読めない行は対象月基準と同じ系列にする
    const shift =
      postingIdx0 === null ? 0 : postingIdx0 - context.targetMonthIdx0;

    expenses.push({
      metaBrand: toAxisMetaBrand(metaBrand),
      capacity,
      category: className,
      amountByTargetMonth,
      amountByPostingMonth: shiftMonths(amountByTargetMonth, shift),
    });
  }
  return expenses;
}

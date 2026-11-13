// 支払詳細(自販機)：支払情報サマリ（管理項目別合計値）の行と列の定義。
// 画面は useMemo（依存配列はこれまでどおり）からこの関数を呼ぶ。

import { ColDef, ICellRendererParams } from 'ag-grid-community';

import { GRID_EMPTY_TEXT, GRID_COLORS } from '@/app/components/grid';

import type {
  ExpenseItemData,
  ExpenseSummaryData,
} from './paymentDetailVending.types';
import {
  PREPAID_AMORTIZATION_ITEM,
  SUMMARY_EXPENSE_ITEMS,
  SUMMARY_MANAGEMENT_CODE,
  SUMMARY_AGGREGATION_ACCOUNTS,
} from './constants';
import {
  matchesSummaryItem,
  matchesSplitDestSummaryItem,
  isExpenseAggregateRow,
} from './utilsMaster';
import { SPLIT_FROM_OTHER_INITIAL_DATA } from '@/mocks/payment/payment-detail-vending/paymentDetail';

import {
  isExpenseAlertRow,
  parseNumber,
  formatNumber,
  sumPaymentToOtherDept,
  sumSplitToOtherDept,
} from './utilsRows';

// 管理項目別合計値グリッドの行データ。
export const buildSummaryData = (
  allRoundsExpenseData: ExpenseItemData[],
  allRoundsPrepaymentData: ExpenseItemData[],
  summaryAmountUnit: 'yen' | 'thousand'
): ExpenseSummaryData[] => {
  // 金額列を金額単位（円／千円）へ換算して3桁区切りへ整形する。
  // 率（前年比・計画差異）と「-」は単位に依存しないため換算しない。
  const unitDivisor = summaryAmountUnit === 'thousand' ? 1000 : 1;
  const formatAmount = (num: number): string => formatNumber(num / unitDivisor);

  // 各経費項目の集計値。小計・合計の合算に使うため数値のまま保持する。
  const rows = SUMMARY_EXPENSE_ITEMS.map((item) => {
    // 支払合計：経費明細の金額合計。
    // ※ 長期前払費用自販機関係費（XKA）は前払金グリッドが全行当カテゴリのため、その全行も加算する。
    const paymentTotal =
      allRoundsExpenseData
        .filter((d) => matchesSummaryItem(d, item))
        .reduce((sum, d) => sum + parseNumber(d.amount), 0) +
      (item === PREPAID_AMORTIZATION_ITEM
        ? allRoundsPrepaymentData.reduce(
            (sum, d) => sum + parseNumber(d.amount),
            0
          )
        : 0);
    // 他部門へ：自部門以外が負担する金額。次の2つを別々の管理区分で振り分ける。
    //  ・行の支払金額 … 行の管理区分（支払合計と同じ範囲）
    //  ・分割金額 … 分割先の管理区分（分割元の管理区分とは別の行へ計上される）
    // ※ 長期前払費用自販機関係費（XKA）は前払金グリッドの全行も対象に含める。
    const chargeTo =
      sumPaymentToOtherDept(
        allRoundsExpenseData.filter((d) => matchesSummaryItem(d, item))
      ) +
      sumSplitToOtherDept(
        allRoundsExpenseData.filter((d) => matchesSplitDestSummaryItem(d, item))
      ) +
      (item === PREPAID_AMORTIZATION_ITEM
        ? sumPaymentToOtherDept(allRoundsPrepaymentData) +
          sumSplitToOtherDept(allRoundsPrepaymentData)
        : 0);
    // 他部門から：他部門から分割/振替された経費明細の合計
    const chargeFrom = SPLIT_FROM_OTHER_INITIAL_DATA.filter((d) =>
      matchesSummaryItem(d, item)
    ).reduce((sum, d) => sum + parseNumber(d.amount), 0);
    const monthlyTotal = paymentTotal - chargeTo + chargeFrom; // 負担額合計
    const planAmount = paymentTotal * 1.1; // 計画金額はモック
    const planDifference = monthlyTotal - planAmount; // 計画差
    // 長期前払費用自販機関係費（前払金の償却項目）は計画対象外のため、
    // 前年比・計画金額・計画差・計画差異の各列は「-」、差異理由はブランクにする。
    const isPlanExcluded = item === PREPAID_AMORTIZATION_ITEM;
    return {
      item,
      paymentTotal,
      chargeTo,
      chargeFrom,
      monthlyTotal,
      planAmount,
      planDifference,
      isPlanExcluded,
    };
  });

  // 計画差異（％）：計画差 ÷ 計画金額
  const toRate = (planDifference: number, planAmount: number): string =>
    planAmount === 0
      ? '0.00%'
      : ((planDifference / planAmount) * 100).toFixed(2) + '%';

  // 集計値（数値）→ グリッド表示用の行データへ変換する。
  const displayRows: ExpenseSummaryData[] = rows.map((r) => ({
    managementCode: SUMMARY_MANAGEMENT_CODE[r.item] ?? '',
    aggregationAccount: (
      SUMMARY_AGGREGATION_ACCOUNTS[SUMMARY_MANAGEMENT_CODE[r.item] ?? ''] ?? []
    ).join('、'),
    expenseItem: r.item,
    amount: formatAmount(r.paymentTotal),
    chargeTo: formatAmount(r.chargeTo),
    chargeFrom: formatAmount(r.chargeFrom),
    monthlyTotal: formatAmount(r.monthlyTotal),
    yearOverYear: r.isPlanExcluded ? GRID_EMPTY_TEXT : '100.0%',
    planAmount: r.isPlanExcluded ? GRID_EMPTY_TEXT : formatAmount(r.planAmount),
    planDifference: r.isPlanExcluded
      ? GRID_EMPTY_TEXT
      : formatAmount(r.planDifference),
    planDifferenceRate: r.isPlanExcluded
      ? GRID_EMPTY_TEXT
      : toRate(r.planDifference, r.planAmount),
    differenceReason: '',
  }));

  // 小計行を作る（対象行の各列を合算する）。
  const buildSubtotalRow = (
    label: string,
    source: typeof rows
  ): ExpenseSummaryData => {
    const sum = (pick: (r: (typeof rows)[number]) => number): number =>
      source.reduce((s, r) => s + pick(r), 0);
    const planAmount = sum((r) => r.planAmount);
    const planDifference = sum((r) => r.planDifference);
    return {
      managementCode: '',
      aggregationAccount: '',
      expenseItem: label,
      amount: formatAmount(sum((r) => r.paymentTotal)),
      chargeTo: formatAmount(sum((r) => r.chargeTo)),
      chargeFrom: formatAmount(sum((r) => r.chargeFrom)),
      monthlyTotal: formatAmount(sum((r) => r.monthlyTotal)),
      yearOverYear: '100.0%',
      planAmount: formatAmount(planAmount),
      planDifference: formatAmount(planDifference),
      planDifferenceRate: toRate(planDifference, planAmount),
      differenceReason: '',
    };
  };

  // 営業経費：オペ条件口(手出票)〜ロケ契約料の集計。
  // 自販機関係費：自販機コラム料〜販売器具移設費の集計（XKA を除く）。
  const salesExpenseEnd = rows.findIndex((r) => r.item === 'ロケ契約料');
  const vendingExpenseEnd = rows.findIndex((r) => r.item === '販売器具移設費');
  const salesExpenseRows = rows.slice(0, salesExpenseEnd + 1);
  const vendingExpenseRows = rows.slice(
    salesExpenseEnd + 1,
    vendingExpenseEnd + 1
  );
  const salesSubtotalRow = buildSubtotalRow('営業経費', salesExpenseRows);
  const vendingSubtotalRow = buildSubtotalRow(
    '自販機関係費',
    vendingExpenseRows
  );

  // 長期前払費用：長期前払費用自販機関係費（XKA）の集計。XKA は計画対象外のため、
  // 前年比〜計画差異は XKA 行・合計行と同じく「-」にする（差異理由はブランク）。
  const prepaidRows = rows.filter((r) => r.item === PREPAID_AMORTIZATION_ITEM);
  const prepaidSectionRow: ExpenseSummaryData = {
    ...buildSubtotalRow('長期前払費用', prepaidRows),
    yearOverYear: GRID_EMPTY_TEXT,
    planAmount: GRID_EMPTY_TEXT,
    planDifference: GRID_EMPTY_TEXT,
    planDifferenceRate: GRID_EMPTY_TEXT,
  };

  // 合計：営業経費 ＋ 自販機関係費 ＋ 長期前払費用自販機関係費（XKA）。
  // 支払合計〜負担額合計のみ集計し、前年比〜計画差異は「-」、差異理由はブランク。
  const xkaRow = rows.find((r) => r.item === PREPAID_AMORTIZATION_ITEM);
  const totalSource = [
    ...salesExpenseRows,
    ...vendingExpenseRows,
    ...(xkaRow ? [xkaRow] : []),
  ];
  const totalSum = (pick: (r: (typeof rows)[number]) => number): number =>
    totalSource.reduce((s, r) => s + pick(r), 0);
  const totalRow: ExpenseSummaryData = {
    managementCode: '',
    aggregationAccount: '',
    expenseItem: '合計',
    amount: formatAmount(totalSum((r) => r.paymentTotal)),
    chargeTo: formatAmount(totalSum((r) => r.chargeTo)),
    chargeFrom: formatAmount(totalSum((r) => r.chargeFrom)),
    monthlyTotal: formatAmount(totalSum((r) => r.monthlyTotal)),
    yearOverYear: GRID_EMPTY_TEXT,
    planAmount: GRID_EMPTY_TEXT,
    planDifference: GRID_EMPTY_TEXT,
    planDifferenceRate: GRID_EMPTY_TEXT,
    differenceReason: '',
  };

  // 集計行は配下の経費項目より前に置く（合計＝先頭行、営業経費＝オペ条件口(手出票)の直前、
  // 自販機関係費＝コラム料の直前、長期前払費用＝長期前払費用自販機関係費(XKA)の直前）。
  // XKA は引き続き最下行。
  return [
    totalRow,
    salesSubtotalRow,
    ...displayRows.slice(0, salesExpenseEnd + 1),
    vendingSubtotalRow,
    ...displayRows.slice(salesExpenseEnd + 1, vendingExpenseEnd + 1),
    prepaidSectionRow,
    ...displayRows.slice(vendingExpenseEnd + 1),
  ];
};

// 管理項目別合計値グリッドの列定義
export const buildSummaryColumnDefs = (
  amountHeaderColDef: (
    name: string
  ) => Pick<ColDef, 'headerName' | 'headerValueGetter'>
): ColDef[] => {
  return [
    { headerName: '管理区分', field: 'managementCode' },
    {
      headerName: '管理区分名称',
      field: 'expenseItem',
      // 区切り行（営業経費・自販機関係費・長期前払費用）の配下の管理区分を1段字下げし、
      // 親子関係を示す。合計・区切り行は字下げしない（→ 02 §7「データ種の区切り（見出し）行」）
      cellClass: (params) =>
        isExpenseAggregateRow(params.data) ? undefined : 'cell-indent-1',
    },
    {
      ...amountHeaderColDef('支払合計'),
      field: 'amount',
      cellClass: 'cell-right',
    },
    {
      ...amountHeaderColDef('他部門へ'),
      field: 'chargeTo',
      cellClass: 'cell-right',
    },
    {
      ...amountHeaderColDef('他部門から'),
      field: 'chargeFrom',
      cellClass: 'cell-right',
    },
    {
      ...amountHeaderColDef('負担額合計'),
      field: 'monthlyTotal',
      cellClass: 'cell-right',
    },
    {
      headerName: '前年比 (％)',
      field: 'yearOverYear',
      cellClass: 'cell-right',
    },
    {
      ...amountHeaderColDef('計画金額'),
      field: 'planAmount',
      cellClass: 'cell-right',
    },
    {
      ...amountHeaderColDef('計画差'),
      field: 'planDifference',
      cellClass: 'cell-right',
    },
    {
      headerName: '計画差異 (％)',
      field: 'planDifferenceRate',
      cellClass: 'cell-right',
    },
    {
      headerName: '差異理由',
      field: 'differenceReason',
      // 計画差異が大きく赤背景になる行のみ入力可能にする
      editable: (params) => isExpenseAlertRow(params.data),
      cellStyle: { backgroundColor: GRID_COLORS.editable },
      // 入力可能な行（計画差異が大きく赤背景になる行）が未入力のときだけ、
      // 入力を促すプレースホルダを表示する
      cellRenderer: (params: ICellRendererParams) => {
        if (params.value) return params.value;
        if (isExpenseAlertRow(params.data)) {
          return (
            <span className="text-gray-600 italic">
              差異理由を入力してください
            </span>
          );
        }
        return '';
      },
      // ※ 差異理由は表示用集計のため state へは保持しない（入力値はグリッド内に留まる）。
    },
    {
      headerName: '集計対象の勘定科目',
      field: 'aggregationAccount',
      // 複数科目が紐づく管理区分（89H）は1行に収まらないため折り返し＋行高自動調整で全文表示する
      width: 256,
      wrapText: true,
      autoHeight: true,
      cellClass: 'cell-left',
    },
  ];
};

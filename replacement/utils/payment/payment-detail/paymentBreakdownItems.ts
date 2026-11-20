// 支払詳細(追加口請求書有／追加口請求書無)の合計表 ─ 明細からの集計（→ 補足3-2 3章）。
//
// 合計表は支払情報・追加口明細・拡売費明細の各エリアに出す。表示中の支払回数の明細だけを集計する
//（支払回数ごとの合計表。全支払回数の合計は支払情報サマリで扱う）。
//   支払情報エリア … 全項目（追加口　計・センターフィ・拡売費　計・金額　計）
//   追加口明細エリア … 追加口　計
//   拡売費明細エリア … 拡売費　計
//
// 請求書有：
//   追加口　計   … 請求＝金額（請求情報）、支払＝支払金額。税率は8%の列、データ元は明細のデータ元
//   センターフィ … 請求・支払とも、請求詳細のセンターフィ（費目＝センターフィの明細）をサマリ商品ごとに
//                  合算した値。明細は画面に出さず裏で持つ。税率・データ元は明細の値で振り分ける
//                  （手入力の列は0）。差額は「-」（請求と支払が同じ値のため）。
//                  支払情報サマリのセンターフィ額（追加口明細×計画のセンターフィ率）とは別の値になる。
//   拡売費　計   … 請求＝請求金額（未承認NETの明細は0）、支払＝支払金額。税率は税区分、データ元は明細
//   金額　計 … セルごとに 追加口　計＋センターフィ＋拡売費　計（差額＝請求－支払）
// 請求書無：
//   請求・差額はすべて「-」。追加口　計の支払は8%の列。追加口明細はデータ元の区分を持たないため、
//   データ元別（AIC入力・手入力）の列には入れない。拡売費　計のデータ元別は明細のデータ元で振り分ける。
//   金額　計の支払＝追加口　計＋拡売費　計。センターフィの行は持たない。
// 拡売費の枝番行（分割先）・グループ合計行・総合計行は集計しない。値は分割前の明細の値とする。
import type {
  AdditionalEntryData,
  WithoutInvoiceEntryRow,
  ExpenseRow,
} from '@/types/paymentDetail';
import { DEFAULT_DATA_SOURCE } from '@/constants/dataSource';
import { toEntryNumber } from './additionalEntryRules';
import {
  TAX_RATE_COLUMNS,
  computeAmountBreakdown,
  diffSideOf,
  sumAmountBreakdowns,
  type AmountBreakdown,
  type AmountBreakdownSide,
  type TaxRateColumn,
} from './paymentAmountBreakdown';
import type { DataSource } from '@/constants/dataSource';

// 合計表に並べる1項目（項目名と合計表）。
export interface BreakdownItem {
  label: string;
  breakdown: AmountBreakdown;
  // 支払情報エリアの金額　計。直前の項目との区切りを二重線にする。
  isGrandTotal?: boolean;
  // 請求データを持たない項目か。請求・差額の行を「-」で表示する（請求書無の全項目）。
  isBillUnavailable?: boolean;
  // 差額を出さない項目か。差額の行を「-」で表示する（請求書有のセンターフィ）。
  isDiffUnavailable?: boolean;
}

// 追加口明細の消費税率の列。追加口は税率の列を設けず一律8%を裏で保持する
// （→ 課題 No.0871／20260710_第16回 決定事項21）。
const ENTRY_TAX_COLUMN: TaxRateColumn = '8%';

// 拡売費明細の税区分 → 合計表の税率別の列（税区分プルダウンの4種類をそのまま振り分ける）。
export const EXPENSE_TAX_COLUMN_BY_CLASS: Record<string, TaxRateColumn> = {
  '1:課税10%': '10%',
  '2:課税8%': '8%',
  '3:その他(5%)': 'その他(5%)',
  '4:その他(非課税)': 'その他(非課税)',
};

// ── 請求書有 ─────────────────────────────────────

// 合計表（追加口　計）。請求＝金額、支払＝支払金額（追加口金額＋拡売費金額(NET未承認)）。
// 金額が未設定の行は0として数える。合計行は対象外。
export const computeEntryBreakdown = (
  rows: readonly AdditionalEntryData[]
): AmountBreakdown =>
  computeAmountBreakdown(
    rows.filter((d) => !d.isTotal),
    {
      bill: (d) => toEntryNumber(d.amount),
      pay: (d) => toEntryNumber(d.payAmount),
      taxColumn: () => ENTRY_TAX_COLUMN,
      dataSource: (d) => d.dataSource ?? DEFAULT_DATA_SOURCE,
    }
  );

// 請求詳細から反映したセンターフィの明細1件（費目＝センターフィの明細）。
// 支払詳細の画面には出さず、システムの裏側で持つ（→ 利用者の決定 2026-10-05）。
export interface BilledCenterFeeRow {
  productName: string; // サマリ商品
  dataSource: DataSource; // データ元（請求EDI／AIC入力）
  taxRate: TaxRateColumn; // 税率
  billAmount: number; // 請求金額（税抜）
}

// 請求詳細のセンターフィを、サマリ商品ごとに合算する。
// 同じサマリ商品でもデータ元・税率が違う明細は、合計表の内訳を振り分けるため分けて持つ。
// 並びは各サマリ商品（データ元・税率）が最初に出てきた順。
export const sumBilledCenterFeeByProduct = (
  rows: readonly BilledCenterFeeRow[]
): BilledCenterFeeRow[] => {
  const byKey = new Map<string, BilledCenterFeeRow>();
  rows.forEach((row) => {
    const key = `${row.productName}|${row.dataSource}|${row.taxRate}`;
    const current = byKey.get(key);
    if (current) current.billAmount += row.billAmount;
    else byKey.set(key, { ...row });
  });
  return [...byKey.values()];
};

// 合計表（センターフィ）。請求詳細のセンターフィをサマリ商品ごとに合算した値を、請求・支払とも同じ値で数える。
// 税率別・データ元別は、請求詳細の明細の税率・データ元で振り分ける（手入力の明細は無いため手入力の列は0）。
export const computeBilledCenterFeeBreakdown = (
  rows: readonly BilledCenterFeeRow[]
): AmountBreakdown =>
  computeAmountBreakdown(sumBilledCenterFeeByProduct(rows), {
    bill: (d) => d.billAmount,
    pay: (d) => d.billAmount,
    taxColumn: (d) => d.taxRate,
    dataSource: (d) => d.dataSource,
  });

// ── 拡売費（両画面） ─────────────────────────────────

// 合計表の集計対象の拡売費明細か（グループ合計行・総合計行・枝番行を除く）。
export const isExpenseBreakdownTarget = (row: ExpenseRow): boolean =>
  !row.isGroup && !row.isTotal && row.costSplit !== '分割先';

// 合計表（拡売費　計）。
//   請求 … 請求金額（未設定の行は0。未承認NETの明細は請求書を持たないため0）
//   支払 … 支払金額
//   税率別 … 税区分（4種類）、データ元別 … 明細のデータ元で振り分ける。
export const computeExpenseBreakdown = (
  rows: readonly ExpenseRow[]
): AmountBreakdown =>
  computeAmountBreakdown(rows.filter(isExpenseBreakdownTarget), {
    bill: (d) => (d.isNetUnapproved ? 0 : toEntryNumber(d.billAmount)),
    pay: (d) => toEntryNumber(d.payAmount),
    taxColumn: (d) =>
      EXPENSE_TAX_COLUMN_BY_CLASS[String(d.taxClass ?? '')] ?? null,
    dataSource: (d) => d.dataSource ?? DEFAULT_DATA_SOURCE,
  });

// 支払情報エリアの合計表（請求書有）。金額　計＝追加口　計＋センターフィ＋拡売費　計（セルごと）。
// 未承認NET分は追加口　計と拡売費　計の両方に含まれるが、別軸の支払のため二重計上としない。
export const buildWithInvoicePaymentItems = (breakdowns: {
  entry: AmountBreakdown;
  centerFee: AmountBreakdown;
  expense: AmountBreakdown;
}): BreakdownItem[] => [
  { label: '追加口　計', breakdown: breakdowns.entry },
  {
    label: 'センターフィ',
    breakdown: breakdowns.centerFee,
    isDiffUnavailable: true,
  },
  { label: '拡売費　計', breakdown: breakdowns.expense },
  {
    label: '金額　計',
    breakdown: sumAmountBreakdowns([
      breakdowns.entry,
      breakdowns.centerFee,
      breakdowns.expense,
    ]),
    isGrandTotal: true,
  },
];

// ── 請求書無 ─────────────────────────────────────

// 合計表（追加口　計・請求書無）。支払＝支払金額、税率は8%。
// 追加口明細はデータ元の区分を持たないため、データ元別のどの列にも入れない（合計・税率別にだけ入れる）。
// 請求は集計しない（合計表では請求・差額の行を「-」で表示する）。
export const computeWithoutInvoiceEntryBreakdown = (
  rows: readonly WithoutInvoiceEntryRow[]
): AmountBreakdown =>
  computeAmountBreakdown(rows, {
    bill: () => null,
    pay: (d) => toEntryNumber(d.payAmount),
    taxColumn: () => ENTRY_TAX_COLUMN,
    dataSource: () => null,
  });

// 支払情報エリアの合計表（請求書無）。請求・差額はすべて「-」、
// 金額　計の支払＝追加口　計＋拡売費　計。センターフィの行は持たない。
export const buildWithoutInvoicePaymentItems = (breakdowns: {
  entry: AmountBreakdown;
  expense: AmountBreakdown;
}): BreakdownItem[] => [
  {
    label: '追加口　計',
    breakdown: breakdowns.entry,
    isBillUnavailable: true,
  },
  {
    label: '拡売費　計',
    breakdown: breakdowns.expense,
    isBillUnavailable: true,
  },
  {
    label: '金額　計',
    breakdown: sumAmountBreakdowns([breakdowns.entry, breakdowns.expense]),
    isGrandTotal: true,
    isBillUnavailable: true,
  },
];

// ── 表示するセルの値 ─────────────────────────────────

// 合計表の区分（請求／支払／差額）。
export type BreakdownKind = 'bill' | 'pay' | 'diff';

// 合計表1項目の区分ごとのセルの値。並びは［合計, 税率別4列, データ元別の列］。
// null は「-」で表示するセル（請求書無の請求・差額、センターフィの差額）。
// 0 のセルも表示は「-」になる（→ formatBreakdownAmount）。
export const breakdownCellValues = (
  item: BreakdownItem,
  dataSourceColumns: readonly DataSource[]
): Record<BreakdownKind, (number | null)[]> => {
  const cellsOf = (side: AmountBreakdownSide | null): (number | null)[] =>
    side
      ? [
          side.total,
          ...TAX_RATE_COLUMNS.map((c) => side.byTax[c]),
          ...dataSourceColumns.map((s) => side.bySource[s]),
        ]
      : Array<null>(
          1 + TAX_RATE_COLUMNS.length + dataSourceColumns.length
        ).fill(null);
  return {
    bill: cellsOf(item.isBillUnavailable ? null : item.breakdown.bill),
    pay: cellsOf(item.breakdown.pay),
    diff: cellsOf(
      item.isBillUnavailable || item.isDiffUnavailable
        ? null
        : diffSideOf(item.breakdown)
    ),
  };
};

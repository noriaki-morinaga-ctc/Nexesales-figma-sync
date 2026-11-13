// 支払詳細(追加口請求書有)の合計表（請求／支払／差額 × 合計・税率別・データ元別）の集計。
// 追加口カード・拡売費カード・支払情報カードの3つの合計表で同じ形を使う。
//   合計 ＝ 税率別4列の和 ＝ データ元別3列の和（同じ合計を別の軸で分けたもの）
//   差額 ＝ 請求 − 支払（各列とも）
// 支払情報エリアの下に税率ごとの合計金額（税抜）を出す（→ 20260710_第16回 決定事項12）。
// データ元別の内訳は、支払回数を分けずに合計行をデータ元ごとに分けて出すため（→ 課題 No.1275）。
// 値は明細から集計する。請求金額が未設定の行は0として数え、差額のマイナスを許容する
//（請求EDIの取込か手入力で請求金額が入ると、画面上で再集計する）。
import { DATA_SOURCES, type DataSource } from '@/app/constants/dataSource';

// 税率別の列（表示順）。
export const TAX_RATE_COLUMNS = [
  '10%',
  '8%',
  'その他(5%)',
  'その他(非課税)',
] as const;

export type TaxRateColumn = (typeof TAX_RATE_COLUMNS)[number];

// 請求または支払の片側（合計・税率別・データ元別）。
export interface AmountBreakdownSide {
  total: number;
  byTax: Record<TaxRateColumn, number>;
  bySource: Record<DataSource, number>;
}

// 合計表1項目分（請求・支払）。差額は表示時に 請求 − 支払 で求める。
export interface AmountBreakdown {
  bill: AmountBreakdownSide;
  pay: AmountBreakdownSide;
}

// 明細1行から集計に使う値を取り出す関数群。
//   bill・pay    … 金額（未設定は null を返せば0として数える）
//   taxColumn    … 税率別の振り分け先（不明な行は税率別に入れず、合計にだけ入れる）
//   dataSource   … データ元別の振り分け先（不明な行はデータ元別に入れず、合計にだけ入れる）
export interface AmountBreakdownAccessors<T> {
  bill: (row: T) => number | null;
  pay: (row: T) => number | null;
  taxColumn: (row: T) => TaxRateColumn | null;
  dataSource: (row: T) => DataSource | null;
}

const emptySide = (): AmountBreakdownSide => ({
  total: 0,
  byTax: Object.fromEntries(TAX_RATE_COLUMNS.map((c) => [c, 0])) as Record<
    TaxRateColumn,
    number
  >,
  bySource: Object.fromEntries(DATA_SOURCES.map((s) => [s, 0])) as Record<
    DataSource,
    number
  >,
});

// 明細が無い場合の合計表（全て0）。
export const createEmptyAmountBreakdown = (): AmountBreakdown => ({
  bill: emptySide(),
  pay: emptySide(),
});

// 片側へ1行分の金額を加える。
const addToSide = (
  side: AmountBreakdownSide,
  amount: number,
  tax: TaxRateColumn | null,
  source: DataSource | null
): void => {
  side.total += amount;
  if (tax) side.byTax[tax] += amount;
  if (source) side.bySource[source] += amount;
};

// 明細の配列から合計表を集計する（集計対象外の行は呼び出し側で除いて渡す）。
export const computeAmountBreakdown = <T>(
  rows: readonly T[],
  accessors: AmountBreakdownAccessors<T>
): AmountBreakdown => {
  const result = createEmptyAmountBreakdown();
  rows.forEach((row) => {
    const tax = accessors.taxColumn(row);
    const source = accessors.dataSource(row);
    addToSide(result.bill, accessors.bill(row) ?? 0, tax, source);
    addToSide(result.pay, accessors.pay(row) ?? 0, tax, source);
  });
  return result;
};

// 片側どうしをセルごとに足す。
const sumSides = (sides: AmountBreakdownSide[]): AmountBreakdownSide => {
  const result = emptySide();
  sides.forEach((side) => {
    result.total += side.total;
    TAX_RATE_COLUMNS.forEach((c) => {
      result.byTax[c] += side.byTax[c];
    });
    DATA_SOURCES.forEach((s) => {
      result.bySource[s] += side.bySource[s];
    });
  });
  return result;
};

// 合計表どうしをセルごとに足す（税抜金額計＝追加口計＋センターフィ＋拡売費計に使う）。
export const sumAmountBreakdowns = (
  breakdowns: AmountBreakdown[]
): AmountBreakdown => ({
  bill: sumSides(breakdowns.map((b) => b.bill)),
  pay: sumSides(breakdowns.map((b) => b.pay)),
});

// 差額（請求 − 支払）の片側を求める。
export const diffSideOf = (breakdown: AmountBreakdown): AmountBreakdownSide => {
  const { bill, pay } = breakdown;
  const result = emptySide();
  result.total = bill.total - pay.total;
  TAX_RATE_COLUMNS.forEach((c) => {
    result.byTax[c] = bill.byTax[c] - pay.byTax[c];
  });
  DATA_SOURCES.forEach((s) => {
    result.bySource[s] = bill.bySource[s] - pay.bySource[s];
  });
  return result;
};

// 負の値の表示形式。
//   parentheses … 括弧付き（例：(100)。Excel の表示形式に合わせる。支払詳細(追加口請求書有)）
//   minus       … 先頭に「-」符号（例：-100。括弧では負と分かりにくいため。支払詳細(追加口請求書無)）
export type BreakdownNegativeFormat = 'parentheses' | 'minus';

// 合計表の数値書式（Excel の表示形式 #,##0;[Red]\(#,##0\);\- に合わせる）。
//   正の値 … 3桁カンマ区切り、負の値 … 括弧付きまたは「-」符号（色は表示側で赤にする）、0 … 「-」
export const formatBreakdownAmount = (
  value: number,
  negativeFormat: BreakdownNegativeFormat = 'parentheses'
): string => {
  const n = Math.round(value);
  if (n === 0) return '-';
  if (n < 0) {
    const abs = Math.abs(n).toLocaleString();
    return negativeFormat === 'minus' ? `-${abs}` : `(${abs})`;
  }
  return n.toLocaleString();
};

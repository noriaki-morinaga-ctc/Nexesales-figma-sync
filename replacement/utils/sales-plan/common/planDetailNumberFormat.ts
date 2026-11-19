// 販売計画（計画詳細＝マージン率固定・NET入力／NET固定）の数値表示桁。
// 販売計画(詳細)グリッド・明細追加ペイン・販売計画(集計)の率表示から参照する。
//
// 項目ごとの小数桁は業務要件で決まっており、モックデータや算出結果の桁がばらついても
// 画面表示は必ずこの桁に揃える。そのため各列の valueFormatter で整形し、
// 手入力欄は入力時点で桁を制限したうえ、確定時にも同じ桁へ丸めて保持する。
// 端数はいずれも四捨五入、金額・率とも3桁区切りを付ける。
//
//   函数(計画/当月着地見込/当月実績/前年実績)・入数 … 整数（小数は許容しない。端数は四捨五入）
//   計画/前年実績比 … 小数第1位（％付き）
//   NET・納価(計画/EDI反映/前年実績) … 小数第2位
//   売価・社外売上高・売上原価 … 整数
//   マージン率 … 小数第2位％
//   値入率・量経追加口率・売買差益率 … 小数第1位％
import type {
  ValueFormatterParams,
  ValueParserParams,
} from 'ag-grid-community';
import {
  GRID_EMPTY_TEXT,
  parseFormulaNumber,
} from '@/components/grid/gridCommon';

// 販売計画(詳細)の項目別 小数桁（画面間で同じ値を使うため定数で共有する）。
export const PLAN_DETAIL_DIGITS = {
  // 計画/前年実績比（％）
  ratio: 1,
  // NET・納価（計画／EDI反映／前年実績）
  price: 2,
  // 売価・社外売上高・売上原価
  amount: 0,
  // マージン率（％）
  marginRate: 2,
  // 値入率・量経追加口率・売買差益率（％）
  rate: 1,
} as const;

// 指定桁への丸め（四捨五入）。Number.toFixed は 2進表現の誤差で桁上がりを落とすこと
// （例: (95.365).toFixed(2) === '95.36'）があるため、表示・保持とも toLocaleString に統一する
// （toLocaleString の既定は halfExpand ＝ 四捨五入）。
const roundTo = (value: number, digits: number, useGrouping: boolean): string =>
  value.toLocaleString('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping,
  });

// 計算できない値（分母が 0 の率など。NaN・Infinity）の表示（→ api/calculation-ownership.md K4）
const NOT_COMPUTABLE_TEXT = '-';

// 数値（金額・単価）を指定桁で整形する。桁区切りは既存の社外売上高・売上原価に合わせる。
export function formatPlanAmount(value: number, digits: number): string {
  if (!Number.isFinite(value)) return NOT_COMPUTABLE_TEXT;
  return roundTo(value, digits, true);
}

// 函数・入数を整形する。函数・入数は整数のみで小数を持たないため、
// 端数が出た場合も四捨五入して整数にし、3桁区切りを付ける。
export function formatPlanCount(value: number): string {
  if (!Number.isFinite(value)) return NOT_COMPUTABLE_TEXT;
  return roundTo(value, 0, true);
}

// 率を指定桁＋「％」で整形する（金額と同じく3桁区切りを付ける）。
export function formatPlanRate(value: number, digits: number): string {
  if (!Number.isFinite(value)) return NOT_COMPUTABLE_TEXT;
  return `${roundTo(value, digits, true)}%`;
}

// 指定桁へ四捨五入した文字列（桁区切りなし）。保持値（再パースする値）に使う。
export function roundPlanNumber(value: number, digits: number): string {
  return roundTo(value, digits, false);
}

// 表示値（文字列・数値いずれも可）を金額として指定桁へ整形する。
// 空欄・数値として読めない値はそのまま返す（呼び出し側の空欄表示ルールに委ねる）。
export function formatPlanAmountText(value: unknown, digits: number): string {
  const num = parseFormulaNumber(value);
  return Number.isFinite(num)
    ? formatPlanAmount(num, digits)
    : String(value ?? '');
}

// 表示値（文字列・数値いずれも可）を函数・入数として整形する。
// 空欄・数値として読めない値はそのまま返す（呼び出し側の空欄表示ルールに委ねる）。
export function formatPlanCountText(value: unknown): string {
  const num = parseFormulaNumber(value);
  return Number.isFinite(num) ? formatPlanCount(num) : String(value ?? '');
}

// 表示値（文字列・数値いずれも可）を率として指定桁＋「％」へ整形する。
export function formatPlanRateText(value: unknown, digits: number): string {
  const num = parseFormulaNumber(value);
  return Number.isFinite(num)
    ? formatPlanRate(num, digits)
    : String(value ?? '');
}

// 数値以外（空欄・ラベル行・文字列）は共通の空欄表示ルール（formatEmptyAsDash）に合わせる。
const formatNonNumeric = (params: ValueFormatterParams): string => {
  const value = params.value;
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return GRID_EMPTY_TEXT;
  }
  return String(value);
};

// 金額・単価列の valueFormatter を作る。
export const planAmountFormatter =
  (digits: number) =>
  (params: ValueFormatterParams): string => {
    if (params.data?._isHeader) return '';
    const num = parseFormulaNumber(params.value);
    if (!Number.isFinite(num)) return formatNonNumeric(params);
    return formatPlanAmount(num, digits);
  };

// 函数・入数列の valueFormatter。算出値・集計値にも3桁区切りを付ける。
export const planCountFormatter = (params: ValueFormatterParams): string => {
  if (params.data?._isHeader) return '';
  const num = parseFormulaNumber(params.value);
  if (!Number.isFinite(num)) return formatNonNumeric(params);
  return formatPlanCount(num);
};

// 率列の valueFormatter を作る。
export const planRateFormatter =
  (digits: number) =>
  (params: ValueFormatterParams): string => {
    if (params.data?._isHeader) return '';
    const num = parseFormulaNumber(params.value);
    if (!Number.isFinite(num)) return formatNonNumeric(params);
    return formatPlanRate(num, digits);
  };

// 手入力列の valueParser を作る。入力値を指定桁へ丸めて保持する
// （表示だけでなく保持値も揃え、算出結果や計算式ツールチップと桁を一致させる）。
// 空入力はそのまま空欄、数値として読めない入力は編集前の値を維持する。
export const planNumberParser =
  (digits: number) =>
  (params: ValueParserParams): string => {
    const raw = String(params.newValue ?? '').trim();
    if (raw === '') return '';
    const num = parseFormulaNumber(raw);
    if (!Number.isFinite(num)) return String(params.oldValue ?? '');
    // 保持値は再パースするため桁区切りを付けない。
    return roundPlanNumber(num, digits);
  };

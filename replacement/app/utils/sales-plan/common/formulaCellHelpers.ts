// 明細表（計画詳細・販売計画シミュレーション）の計算式セル共通ヘルパー。
//
// 4画面で違うのは「行から商品マスタを引く方法」だけ（計画詳細(マージン率固定・NET入力)と
// シミュレーション2画面はサマリ商品名、計画詳細(NET固定)は定番商品のみ一般卸メッシュ）。
// その差分を masterOf に閉じ込め、社外売単価・売上原価単価の解決と
// 「単価 × 入数 × 函数(計画)」の算出、ツールチップ生成を共有する。
import {
  formulaTooltip,
  parseFormulaNumber,
  formatFormulaNumber,
  type FormulaTemplate,
} from '@/app/components/grid/gridCommon';
import {
  deriveExternalUnitPrice,
  type ExternalUnitPriceMasterValues,
} from '@/app/utils/common/externalUnitPrice';

// 明細表の計算式セルが必要とする商品マスタの値。
export interface FormulaCellMaster extends ExternalUnitPriceMasterValues {
  // 補足2-3 の売上原価単価（モックは支社受渡原価のみ）
  costOfSales: string;
}

// 行 → 商品マスタ。引けない行（新規行・未選択行）は undefined を返す。
export type MasterResolver<R> = (row: R) => FormulaCellMaster | undefined;

// 行の社外売単価（補足2-2）。マスタが引けない行は NaN。
export function makeExternalUnitPriceOf<R extends { planPrice: string }>(
  masterOf: MasterResolver<R>,
  unitPriceKbn: string
): (row: R) => number {
  return (row) => {
    const master = masterOf(row);
    if (!master) return NaN;
    return deriveExternalUnitPrice(master, unitPriceKbn, row.planPrice).value;
  };
}

// 行の売上原価単価（補足2-3）。マスタが引けない行は NaN。
export function makeCostUnitPriceOf<R>(
  masterOf: MasterResolver<R>
): (row: R) => number {
  return (row) => parseFormulaNumber(masterOf(row)?.costOfSales);
}

// 「単価 × 入数 × 函数(計画)」。いずれかが欠けたら空文字。
export function unitTimesQuantityTimesPlan(
  unitPrice: number,
  quantity: string,
  plan: string
): string {
  const quantityNum = parseFormulaNumber(quantity);
  const planNum = parseFormulaNumber(plan);
  if (![unitPrice, quantityNum, planNum].every(Number.isFinite)) return '';
  return formatFormulaNumber(Math.round(unitPrice * quantityNum * planNum));
}

// 値入額 ＝ (売価 − 納価(計画)) × 入数 × 函数(計画)（課題1757）。いずれかが欠けたら空文字。
export function markupAmountOf(row: {
  price: string;
  planPrice: string;
  quantity: string;
  plan: string;
}): string {
  return unitTimesQuantityTimesPlan(
    parseFormulaNumber(row.price) - parseFormulaNumber(row.planPrice),
    row.quantity,
    row.plan
  );
}

// テンプレートのトークン → 実値。
// `__unitPrice` / `__costUnitPrice` は行データに無い擬似トークンでマスタから導出する。
export function makeDetailValueOf<R>(
  externalUnitPriceOf: (row: R) => number,
  costUnitPriceOf: (row: R) => number
): (row: R, token: string) => string | null {
  return (row, token) => {
    if (token === '__unitPrice' || token === '__costUnitPrice') {
      const value =
        token === '__unitPrice'
          ? externalUnitPriceOf(row)
          : costUnitPriceOf(row);
      return Number.isFinite(value) ? formatFormulaNumber(value, 2) : null;
    }
    const raw = (row as Record<string, unknown>)[token];
    return raw == null || raw === '' ? null : String(raw);
  };
}

// テンプレートと結果値からツールチップ本文（式＋実値の2行）を作る関数を返す。
export function makeDetailTooltip<R>(
  labels: Record<string, string>,
  valueOf: (row: R, token: string) => string | null
) {
  return (tpl: FormulaTemplate, resultOf: (row: R) => string) =>
    (row: R): string =>
      formulaTooltip(
        tpl,
        (token) => labels[token] ?? token,
        (token) => valueOf(row, token),
        resultOf(row)
      );
}

// 増減列（変更後 − 変更前）の結果値。増減列は colId しか持たず行データに値が無いため自前で算出する。
export function deltaResult<R>(row: R, metric: string): string {
  const data = row as Record<string, unknown>;
  const after = parseFormulaNumber(data[metric]);
  const before = parseFormulaNumber(data[`${metric}Before`]);
  if (!Number.isFinite(after) || !Number.isFinite(before)) return '';
  return formatFormulaNumber(after - before);
}

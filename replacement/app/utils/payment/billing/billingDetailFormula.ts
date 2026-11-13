// 請求詳細（請求EDI取込／AIC入力）の明細グリッドの算出項目と、その計算式ツールチップ。
//
// 支払詳細（請求書有）の追加口グリッド（FORMULA_DEFS）と同じ方針で、計算式が入るセルは
// マウスオーバーで「項目名 ＝ 式 ＝ 実値 ＝ 結果」を表示する。
// 2画面（請求EDI取込・AIC入力）は同じ列・同じ式のため、算出とツールチップ文言を
// ここに集約して画面間で食い違わないようにする。
import type { BillingDetailRow } from '@/app/types/billing';
import {
  formatBillingUnitPrice,
  roundBillingNumber,
} from './billingNumberFormat';

// 請求金額と数量×請求書記載単価の差がこの金額以上なら不一致とみなす（決定21）。
// 卸側の端数処理（切捨て・切上げ・四捨五入）で1円未満の差は生じるため、1円以上を対象にする。
export const BILLING_AMOUNT_MISMATCH_THRESHOLD = 1;

// 請求単位が「バラ」であることを表す値（BILLING_UNIT_OPTIONS の 3:バラ）。
const BILLING_UNIT_LOOSE = '3:バラ';

// バラ換算した数量。単価はバラ単価で扱うため（→ 20260710_第16回 決定事項3）、
// ケース・パックで請求された明細は入数を掛けてバラの数量にそろえる
//（→ 20260821_第31回 決定事項15／課題 No.1283「請求計上対象数量・ケース入数から逆算」）。
// 請求単位がバラのとき、および入数を持たないときは数量をそのまま使う。
export const billingBaseQtyOf = (
  row: BillingDetailRow | undefined
): number | null => {
  if (!row || row.qty == null) return null;
  if (row.billingUnit === BILLING_UNIT_LOOSE || !row.perCase) return row.qty;
  return row.qty * row.perCase;
};

// 入数でバラ換算しているか（ツールチップに入数を出すかの判定にも使う）
const usesPerCase = (row: BillingDetailRow | undefined): boolean =>
  !!row && row.billingUnit !== BILLING_UNIT_LOOSE && !!row.perCase;

// 数量 × 請求書記載単価（参考値）。単価はバラ単価のため、数量もバラ換算して掛ける。
// 小数第3位を四捨五入して第2位まで持つ。
export const billingCalcAmountOf = (
  row: BillingDetailRow | undefined
): number | null => {
  const baseQty = billingBaseQtyOf(row);
  if (!row || baseQty == null || row.unitPrice == null) return null;
  return roundBillingNumber(baseQty * row.unitPrice);
};

// 正式な請求単価 ＝ 請求金額 ÷ 数量 ÷ 入数（バラ換算した数量で割る）。
// 小数第3位を四捨五入して第2位まで持つ
//（→ 20260821_第31回 決定事項15／課題 No.1283・No.1317）。
export const billingUnitPriceOf = (
  row: BillingDetailRow | undefined
): number | null => {
  const baseQty = billingBaseQtyOf(row);
  if (!row || row.billAmount == null || !baseQty) return null;
  return roundBillingNumber(row.billAmount / baseQty);
};

// 差額（請求-支払）＝ 請求金額 − 支払金額。支払未反映の明細は空欄。
export const billingDiffOf = (
  row: BillingDetailRow | undefined
): number | null => {
  if (!row || row.billAmount == null || row.payAmount == null) return null;
  return roundBillingNumber(row.billAmount - row.payAmount);
};

// 請求金額と数量×請求書記載単価のずれ（絶対値）。どちらかが空欄なら null。
export const billingAmountGapOf = (
  row: BillingDetailRow | undefined
): number | null => {
  const calc = billingCalcAmountOf(row);
  if (!row || calc == null || row.billAmount == null) return null;
  return roundBillingNumber(Math.abs(calc - row.billAmount));
};

// 数量×請求書記載単価と請求金額が食い違っているか（決定21）。
// 取込時にはチェックせず連携値をそのまま取り込むため、この画面で気づけるようにする。
export const isBillingAmountMismatch = (
  row: BillingDetailRow | undefined
): boolean => {
  const gap = billingAmountGapOf(row);
  return gap != null && gap >= BILLING_AMOUNT_MISMATCH_THRESHOLD;
};

// ツールチップ用の数値整形（小数第2位まで固定・3桁区切り）。
// 空欄は「未入力」と書き、式のどこが埋まっていないか分かるようにする。
const fmt = (value: number | null | undefined): string =>
  value == null ? '未入力' : formatBillingUnitPrice(value);

// 数量は整数のため桁を付けずに表示する（取消明細はマイナス）。
const fmtQty = (value: number | null | undefined): string =>
  value == null ? '未入力' : value.toLocaleString('ja-JP');

// 請求金額と数量×請求書記載単価が1円以上ずれている明細の説明。
// 赤字表示だけでは理由が分からないため、ずれの大きさをホバーで示す。
// 請求金額セル・数量×請求書記載単価セルのどちらにマウスを乗せても同じ説明を出す。
export const billingAmountMismatchNote = (
  row: BillingDetailRow | undefined
): string | null => {
  const gap = billingAmountGapOf(row);
  if (gap == null || gap < BILLING_AMOUNT_MISMATCH_THRESHOLD) return null;
  return (
    `請求金額 ${fmt(row?.billAmount)} と 数量×請求書記載単価 ${fmt(billingCalcAmountOf(row))} が ` +
    `${fmt(gap)} ずれています（${BILLING_AMOUNT_MISMATCH_THRESHOLD}円以上の差）。\n` +
    '内容を確認して請求金額を修正してください。'
  );
};

// 計算式が入る列（colId／field）→ ツールチップ本文。
// 支払詳細（請求書有）の FORMULA_DEFS と同じく「式 ＝ 実値 ＝ 結果」の形にする。
const FORMULA_TOOLTIPS: Record<
  string,
  (row: BillingDetailRow) => string | null
> = {
  // 数量×請求書記載単価 ＝ 数量 × 請求書記載単価。
  // ケース・パック請求の明細は、単価がバラ単価のため数量を入数でバラ換算してから掛ける
  calcAmount: (r) =>
    usesPerCase(r)
      ? `数量×請求書記載単価 ＝ 数量 × 入数 × 請求書記載単価\n` +
        `＝ ${fmtQty(r.qty)} × ${fmtQty(r.perCase)} × ${fmt(r.unitPrice)} ＝ ${fmt(billingCalcAmountOf(r))}`
      : `数量×請求書記載単価 ＝ 数量 × 請求書記載単価\n` +
        `＝ ${fmtQty(r.qty)} × ${fmt(r.unitPrice)} ＝ ${fmt(billingCalcAmountOf(r))}`,
  // 請求単価 ＝ 請求金額 ÷ 数量 ÷ 入数（バラ単価）
  calcUnitPrice: (r) =>
    usesPerCase(r)
      ? `請求単価（逆算） ＝ 請求金額 ÷ 数量 ÷ 入数\n` +
        `＝ ${fmt(r.billAmount)} ÷ ${fmtQty(r.qty)} ÷ ${fmtQty(r.perCase)} ＝ ${fmt(billingUnitPriceOf(r))}`
      : `請求単価（逆算） ＝ 請求金額 ÷ 数量\n` +
        `＝ ${fmt(r.billAmount)} ÷ ${fmtQty(r.qty)} ＝ ${fmt(billingUnitPriceOf(r))}`,
  // 差額（請求-支払）＝ 請求金額 − 支払金額
  diff: (r) =>
    `差額（請求-支払）＝ 請求金額 − 支払金額\n` +
    `＝ ${fmt(r.billAmount)} − ${fmt(r.payAmount)} ＝ ${fmt(billingDiffOf(r))}`,
  // 請求金額は入力値のため式は無いが、数量×請求書記載単価とのずれだけは理由を示す。
  billAmount: () => null,
};

// 計算式セルのツールチップ本文。計算式が無い列は null を返す
//（呼び出し側は既定どおりセル値をツールチップにする）。
// 請求金額・数量×請求書記載単価は、1円以上ずれている明細だけ末尾に理由を足す。
export const billingFormulaTooltipOf = (
  colKey: string | undefined,
  row: BillingDetailRow | undefined
): string | null => {
  if (!colKey || !row) return null;
  const formula = FORMULA_TOOLTIPS[colKey]?.(row) ?? null;
  const note =
    colKey === 'billAmount' || colKey === 'calcAmount'
      ? billingAmountMismatchNote(row)
      : null;
  if (formula && note) return `${formula}\n\n${note}`;
  return formula ?? note;
};

// 請求一覧の「新規作成」から開く請求詳細（AIC入力）。
//
// 新規作成は既存の入力単位と同じ BillingDetailAic／DetailTable を使い、違いは
// 「基本情報が空（createEmptyBilling）」「明細が空行（createEmptyBillingDetailRows）」だけ。
// そのため明細グリッドの取り決め（対象月のカレンダー入力・担当者の販売店連動・
// 単価系の小数第2位・計算式ツールチップ）は新規作成でもそのまま効く必要がある。
// 空行だと判定が変わって効かなくなる、という取りこぼしを防ぐために確認する。
import { describe, it, expect } from 'vitest';
import { BILLING_STAFF_BY_STORE_NAME } from '@/mocks/payment/billing-detail-aic';
import { NEW_BILLING_ID } from '@/app/constants/billing';
import { createEmptyBilling } from '@/mocks/common/billing';
import {
  createEmptyBillingDetailRows,
  isBillingDetailStatusLocked,
} from '@/app/utils/payment/billing/billing';
import {
  billingCalcAmountOf,
  billingDiffOf,
  billingFormulaTooltipOf,
  billingUnitPriceOf,
  isBillingAmountMismatch,
} from '@/app/utils/payment/billing/billingDetailFormula';
import { formatBillingUnitPrice } from '@/app/utils/payment/billing/billingNumberFormat';

const newEntry = createEmptyBilling();
const newRows = createEmptyBillingDetailRows();

describe('新規作成の入力単位', () => {
  it('新規作成のIDで開く（このIDのときだけ空行の明細を読む）', () => {
    expect(newEntry.id).toBe(NEW_BILLING_ID);
  });

  it('入力状況は「入力中」＝参照専用にならない（画面で入力できる）', () => {
    // 請求詳細は status === '反映済' を参照専用にする
    expect(newEntry.status).toBe('入力中');
    expect(newEntry.dataSource).toBe('AIC入力');
  });

  it('明細の空行は支払処理まで進んでおらず、行ごとの編集ロックもかからない', () => {
    expect(newRows.length).toBeGreaterThan(0);
    for (const row of newRows) {
      expect(isBillingDetailStatusLocked(row.status)).toBe(false);
    }
  });
});

describe('新規作成の空行でも明細グリッドの取り決めが効く', () => {
  const row = newRows[0];

  it('対象月は未設定で開く（カレンダー入力のプレースホルダ表示になる）', () => {
    expect(row.targetMonth).toBe('');
  });

  it('販売店が未選択のため担当者は活性（画面で選ぶ）', () => {
    expect(row.storeName).toBe('');
    // 担当者セルの活性判定は「販売店が候補に無いこと」で行う
    expect(BILLING_STAFF_BY_STORE_NAME.has(row.storeName)).toBe(false);
    expect(row.staffName).toBe('');
  });

  it('単価系は未入力のため空欄（0 埋めの 0.00 を出さない）', () => {
    expect(billingCalcAmountOf(row)).toBeNull();
    expect(billingUnitPriceOf(row)).toBeNull();
    expect(billingDiffOf(row)).toBeNull();
    expect(formatBillingUnitPrice(null)).toBe('');
  });

  it('未入力の行を金額差異（赤字）にしない', () => {
    for (const r of newRows) expect(isBillingAmountMismatch(r)).toBe(false);
    expect(billingFormulaTooltipOf('billAmount', row)).toBeNull();
  });

  it('計算式ツールチップは空行でも式を示し、未入力の箇所が分かる', () => {
    const tooltip = billingFormulaTooltipOf('calcAmount', row);
    expect(tooltip).toContain('数量×請求書記載単価 ＝ 数量 × 請求書記載単価');
    expect(tooltip).toContain('未入力');
    // ずれの説明は付けない（算出元がそろっていないため判定しない）
    expect(tooltip).not.toContain('ずれています');
  });
});

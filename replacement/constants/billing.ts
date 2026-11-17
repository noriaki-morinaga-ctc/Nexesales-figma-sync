// 請求（一覧・詳細）の区分値の定義・業務の決まり（バックエンドをつないでも残す値）。

import type { BillingDetailStatus } from '@/types/billing';

// 支払側の処理が進んだ明細のステータス。
// この状態の明細は支払画面へ反映済み（以降は申請・検印と進む。支払無で止まる場合もある）で、
// 請求側から内容を変えると支払データと食い違うため、行全体を参照専用にする。
export const BILLING_DETAIL_LOCKED_STATUSES: readonly BillingDetailStatus[] = [
  '支払画面反映済',
  '支払処理申請中',
  '支払処理検印済',
  '支払無',
];

// 費目の選択肢（AIC入力分は画面で選ぶ）。
// 卸によってはセンターフィを商品ごとに請求してくるため、請求EDI・AIC入力の
// いずれでも判別できるよう「センターフィ」を持たせる（→ 20260821_第31回 決定事項19）。
export const BILLING_EXPENSE_TYPE_OPTIONS = [
  '追加口',
  '拡売費',
  'センターフィ',
] as const;

// 請求単位（EDI区分4-12 相当）
export const BILLING_UNIT_OPTIONS = ['1:ケース', '2:パック', '3:バラ'] as const;

// 消費税区分（EDI区分4-19 相当）と税率。
// 表記は「コード:名称」で、支払詳細（ExpansionPaymentProcess・支払申請承認）の税区分に合わせる。
export const BILLING_TAX_KBN_OPTIONS = [
  '1:課税10%',
  '2:課税8%',
  '3:その他(5%)',
  '4:その他(非課税)',
] as const;

// 商流未設定（販売店・一次店・三次店を商流販売店変換マスタで特定できない）明細の
// 受け皿となる得意先。支払側へ渡す先が決まらないため、得意先コード・得意先名を
// この固定値へ寄せ、商流の登録待ちであることを明細から分かるようにする。
// 得意先コードは実在の得意先と衝突しないダミー値。
export const BILLING_UNSET_CUSTOMER_CODE = '99999999';

export const BILLING_UNSET_CUSTOMER_NAME = '商流未設定';

// 新規作成時に用意する空明細の件数。
// AIC は請求書の明細をまとめて入力するため、最初から入力できる行を並べておく。
export const NEW_BILLING_ROW_COUNT = 100;

// 新規作成の入力単位ID。この ID のときは既存の明細を読まず、
// 空行だけを並べた明細（基本情報も空）で請求詳細を開く。
export const NEW_BILLING_ID = 'BILL-NEW';

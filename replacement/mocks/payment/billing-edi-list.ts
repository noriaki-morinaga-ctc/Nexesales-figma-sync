// 請求EDI取込一覧：検索条件の候補・初期値のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/app/components/payment/billing-edi-list/page.tsx。

import type { BillingEdiSearchCriteria } from '@/app/types/billingEdi';

// 受信日の初期値（決定11 2026-08-18）。業務仕様は「当月1日〜当月末日」だが、
// モックの受信日時が2026年8月固定のため、システム日付から導出すると初期表示が0件になる。
// 他の一覧画面（支払一覧・引用一覧・計画一覧）と同様に仮データに合わせた固定値にする。
const INITIAL_IMPORT_DATE_FROM = '2026/08/01';

const INITIAL_IMPORT_DATE_TO = '2026/08/31';

// 請求元企業の検索候補。実システムでは取引先マスタから取得する。
export const BILLING_EDI_PAYEE_OPTIONS: string[] = [
  '国分株式会社',
  '三菱食品株式会社',
  '伊藤忠食品株式会社',
  '加藤産業株式会社',
];

// 検索条件の初期値（クリアボタンで戻す値）
// ステータスの初期値は「エラー」。エラーを見ることが本画面の主目的で、
// ステータスは正常／エラーの2値しかないため、「エラーのみ」の絞り込みは
// ステータスの初期値で足りる（2026/9/11 一覧 4.レイアウト AJ46 のコメント）
export const INITIAL_SEARCH_CRITERIA: BillingEdiSearchCriteria = {
  importDateFrom: INITIAL_IMPORT_DATE_FROM,
  importDateTo: INITIAL_IMPORT_DATE_TO,
  payee: '',
  status: 'エラー',
};

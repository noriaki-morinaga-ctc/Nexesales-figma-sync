// 請求一覧の選択肢（バックエンドをつないでも残す値）。

import type { BillingDataSource, BillingStatus } from '@/types/billing';

export const BILLING_STATUS_OPTIONS: BillingStatus[] = ['入力中', '反映済'];

// データ元の選択肢（決定23）。入力単位の属性で、請求一覧の検索条件にも使う
export const BILLING_DATA_SOURCE_OPTIONS: BillingDataSource[] = [
  'EDI',
  'AIC入力',
];

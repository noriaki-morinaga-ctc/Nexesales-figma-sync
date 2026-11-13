// 予算参照登録：アップロード・ダウンロード対象と対象年度の選択肢、初期値（バックエンドをつないでも残す値）。

import type { UploadOption } from '@/app/components/shared/upload/uploadTypes';

// アップロード対象の選択肢
export const BUDGET_UPLOAD_TARGET_OPTIONS: UploadOption[] = [
  { value: 'initial_sales', label: '年初予算（売上）' },
  { value: 'initial_promotion', label: '年初予算（拡売費）' },
  { value: 'midterm_sales', label: '期中変更（売上）' },
  { value: 'midterm_promotion', label: '期中変更（拡売費）' },
];

// ダウンロード対象の選択肢
export const BUDGET_DOWNLOAD_TARGET_OPTIONS: UploadOption[] = [
  { value: 'sales_raw', label: '売上予算（ローデータ）' },
  { value: 'promotion_raw', label: '拡売費（ローデータ）' },
  { value: 'sales_summary', label: '売上予算（部支店別集計データ）' },
  { value: 'promotion_summary', label: '拡売費（部支店別集計データ）' },
];

// 対象年度の選択肢
export const BUDGET_FISCAL_YEAR_OPTIONS = [2025, 2026] as const;

// 対象年度・対象区分の初期値
export const BUDGET_DEFAULT_FISCAL_YEAR = 2025;

export const BUDGET_DEFAULT_UPLOAD_TARGET = 'initial_sales';

export const BUDGET_DEFAULT_DOWNLOAD_TARGET = 'sales_raw';

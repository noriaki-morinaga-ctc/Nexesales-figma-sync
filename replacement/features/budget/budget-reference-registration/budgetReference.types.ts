// ===== 予算参照登録画面の型 =====
import type { UploadHistoryCommon } from '@/components/shared/upload/uploadTypes';

// アップロード履歴の1件分（共通の項目＋対象年度）
export interface BudgetUploadHistoryItem extends UploadHistoryCommon {
  uploadFiscalYear: number; // 対象年度
}

// ダウンロード対象ごとの出力データセット
export interface BudgetDownloadDataset {
  headers: string[];
  rows: (string | number)[][];
  colWidths: { wch: number }[];
  sheetName: string;
  fileName: string;
}

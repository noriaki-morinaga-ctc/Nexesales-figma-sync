// ===== 予算参照登録画面の型定義 =====

// アップロードの処理ステータス
export type UploadStatusType = 'PROCESSING' | 'COMPLETED' | 'ERROR';

// アップロードエラー明細（1行ごとのエラー内容）
export interface UploadErrorItem {
  rowNumber: number; // 行番号
  errorMessage: string; // エラー内容
}

// アップロード履歴の1件分
export interface UploadHistoryItem {
  uploadId: string; // アップロードID
  uploadFiscalYear: number; // 対象年度
  uploadTarget: string; // 対象データ（value）
  uploadTargetName: string; // 対象データ（表示名）
  fileName: string; // ファイル名
  uploadedAt: string; // 登録日時（ISO形式）
  uploadedBy: string; // 登録者
  status: UploadStatusType; // ステータス
  errorCount: number; // エラー件数
  errors?: UploadErrorItem[]; // エラー明細
  isSysError: boolean; // システムエラーか（true＝システムエラー／false＝入力内容エラー）
}

// セレクトの選択肢
export interface SelectOption {
  value: string;
  label: string;
}

// ダウンロード対象ごとの出力データセット
export interface DownloadDataset {
  headers: string[];
  rows: (string | number)[][];
  colWidths: { wch: number }[];
  sheetName: string;
  fileName: string;
}

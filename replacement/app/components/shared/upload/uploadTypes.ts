// ===== アップロード画面（予算参照登録・ファイルアップロード）共通の型 =====

// アップロードの処理ステータス
export type UploadStatusType = 'PROCESSING' | 'COMPLETED' | 'ERROR';

// アップロードエラー明細（1行ごとのエラー内容）
export interface UploadErrorItem {
  rowNumber: number; // 行番号
  errorMessage: string; // エラー内容
}

// アップロード結果カードに出す項目（各画面のアップロード履歴の1件分が持つ）
export interface UploadResultItem {
  status: UploadStatusType; // ステータス
  errors?: UploadErrorItem[]; // エラー明細
  isSysError: boolean; // システムエラーか（true＝システムエラー／false＝入力内容エラー）
}

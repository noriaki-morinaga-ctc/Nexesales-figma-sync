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

// 選択肢（アップロード対象・ダウンロード対象など）
export interface UploadOption<TValue extends string = string> {
  value: TValue;
  label: string;
}

// アップロード履歴の1件分のうち、画面に共通の項目。
// 各画面の履歴の型は、これに画面ごとの項目（対象年度・対象年月など）を足す
export interface UploadHistoryCommon<TTarget extends string = string>
  extends UploadResultItem {
  uploadId: string; // アップロードID
  uploadTarget: TTarget; // 対象データ（value）
  uploadTargetName: string; // 対象データ（表示名）
  fileName: string; // ファイル名
  uploadedAt: string; // 登録日時（ISO形式）
  uploadedBy: string; // 登録者
  errorCount: number; // エラー件数
}

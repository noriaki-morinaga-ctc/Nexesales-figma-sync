// ===== アップロード画面（予算参照登録・ファイルアップロード）共通の定数 =====
import type { UploadStatusType } from './uploadTypes';

// アップロードできるファイルの拡張子
export const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];

// ファイル選択ダイアログに渡す accept 値
export const FILE_ACCEPT = ALLOWED_EXTENSIONS.join(',');

// ステータスの表示名
export const STATUS_NAME_MAP: Record<UploadStatusType, string> = {
  PROCESSING: '処理中',
  COMPLETED: '完了',
  ERROR: 'エラー',
};

// 登録者（モック：ログインユーザー）
export const MOCK_LOGIN_USER_NAME = 'アサヒ 太郎';

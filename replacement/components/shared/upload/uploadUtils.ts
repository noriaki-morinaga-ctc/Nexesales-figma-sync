// ===== アップロード画面（予算参照登録・ファイルアップロード）共通のユーティリティ =====
import { ALLOWED_EXTENSIONS } from './uploadConstants';

// ISO形式の日時を「YYYY/MM/DD HH:mm:ss」形式に整形する
export function formatDateTime(iso: string): string {
  if (!iso) return '';
  const matched = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!matched) return iso;
  return `${matched[1]}/${matched[2]}/${matched[3]} ${matched[4]}:${matched[5]}:${matched[6]}`;
}

// 2桁（または指定桁）のゼロ埋め
const pad = (value: number, width = 2): string =>
  String(value).padStart(width, '0');

// アップロードIDを生成する（UPL-YYYYMMDD-HHmmss-連番3桁）
export function genUploadId(): string {
  const date = new Date();
  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const seq = pad(Math.floor(Math.random() * 999) + 1, 3);
  return `UPL-${datePart}-${timePart}-${seq}`;
}

// 現在日時をISO形式（タイムゾーン付き）で返す
export function nowIso(): string {
  const date = new Date();
  const tzMinutes = -date.getTimezoneOffset();
  const tzSign = tzMinutes >= 0 ? '+' : '-';
  const tzHour = pad(Math.floor(Math.abs(tzMinutes) / 60));
  const tzMin = pad(Math.abs(tzMinutes) % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${tzSign}${tzHour}:${tzMin}`
  );
}

// ファイル形式のバリデーション（エラー時はメッセージ、正常時は null）
// ※ファイルサイズ上限チェックは Make 版と同じく無効
export function validateFile(file: File): string | null {
  const extension = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return '許可されていないファイル形式です。.xlsxまたは.xlsファイルをアップロードしてください。';
  }
  return null;
}

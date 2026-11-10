// ===== アップロード画面（予算参照登録・ファイルアップロード）共通のユーティリティ =====

// ISO形式の日時を「YYYY/MM/DD HH:mm:ss」形式に整形する
export function formatDateTime(iso: string): string {
  if (!iso) return '';
  const matched = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!matched) return iso;
  return `${matched[1]}/${matched[2]}/${matched[3]} ${matched[4]}:${matched[5]}:${matched[6]}`;
}

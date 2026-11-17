// コードと名称を「コード:名称」の1値に結合する（いずれか欠落時は在る方のみ）。
// コードと名称を1つの値で持つ・表示するときは「コード:名称」の順にする（→ 02 §9-1・UI/UX UX-114）。
// 計画系画面（計画詳細／販売計画シミュレーション）の基本情報エリアや、支払詳細（支払按分）の参照専用値の表示に使う。
export function joinCodeName(code?: string, name?: string): string {
  const trimmedCode = code ?? '';
  const trimmedName = name ?? '';
  if (trimmedCode && trimmedName) return `${trimmedCode}:${trimmedName}`;
  return trimmedCode || trimmedName || '';
}

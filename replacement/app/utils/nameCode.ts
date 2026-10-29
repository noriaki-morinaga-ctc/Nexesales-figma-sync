// 名称とコードを「名称:コード」の1値に結合する（いずれか欠落時は在る方のみ）。
// 支払詳細（支払按分・支払分割）で参照専用値の表示に使う。
export function joinNameCode(name?: string, code?: string): string {
  const trimmedName = name ?? '';
  const trimmedCode = code ?? '';
  if (trimmedName && trimmedCode) return `${trimmedName}:${trimmedCode}`;
  return trimmedName || trimmedCode || '';
}

// 「名称:コード」と「コード:名称」を相互に入れ替える（区切りが無い値・空値はそのまま返す）。
// マスタ（storeHierarchy／paymentOrgCascade）は「名称:コード」、画面によっては
// 「コード:名称」で保持するため、定義元マスタを再利用する際の表記変換に使う。
export function swapNameCode(value?: string): string {
  const trimmed = value ?? '';
  const separator = trimmed.indexOf(':');
  if (separator < 0) return trimmed;
  return `${trimmed.slice(separator + 1)}:${trimmed.slice(0, separator)}`;
}

// コードと名称を「コード:名称」の1値に結合する（いずれか欠落時は在る方のみ）。
// 計画系画面（計画詳細／販売計画シミュレーション）の基本情報エリアで参照専用値の表示に使う。
export function joinCodeName(code?: string, name?: string): string {
  const trimmedCode = code ?? '';
  const trimmedName = name ?? '';
  if (trimmedCode && trimmedName) return `${trimmedCode}:${trimmedName}`;
  return trimmedCode || trimmedName || '';
}

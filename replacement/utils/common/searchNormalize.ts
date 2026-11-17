// 検索文字列の表記ゆれを吸収するための正規化。
// 商品検索（コンボボックスの候補絞り込み）で、利用者が全角・半角のどちらで入力しても
// 候補がヒットするようにする。候補データ側を全角へ統一するのではなく、
// 入力値と候補の双方を正規化して突き合わせる方式を採る。
//
// NFKC 正規化で次が揃う:
//   - 全角英数字 → 半角（５００ＭＬ → 500ML）
//   - 半角カナ → 全角カナ（ｶﾞ → ガ。濁点も1文字に合成される）
//   - 全角スペース → 半角スペース
// あわせて小文字化し、英字の大文字・小文字も区別しない。

// 検索・照合用に文字列を正規化する（未設定は空文字）。
export function normalizeForSearch(value?: string | null): string {
  if (!value) return '';
  return value.normalize('NFKC').toLowerCase();
}

// 候補文字列が検索語を含むか（全角/半角・大文字小文字を区別しない部分一致）。
// 検索語が空なら絞り込みなしとして true を返す。
export function matchesSearchQuery(
  target: string | null | undefined,
  query: string
): boolean {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return true;
  if (!target) return false;
  return normalizeForSearch(target).includes(normalizedQuery);
}

// カードの見出しの行（headerActions）で、操作のまとまりの間に置く縦の区切り線
//（全画面共通。UI/UX UX-063 → 02 §6「数式ガイドの切替（FormulaGuideToggle）」）。
// 例：数式ガイド ｜ 自動更新 ｜ 実数表示／差分表示。見た目だけのため読み上げの対象から外す。
export function HeaderDivider() {
  return <span className="mx-1 h-6 w-px bg-gray-200" aria-hidden="true" />;
}

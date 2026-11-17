// 画面の縦幅に合わせるグリッドの高さ（inline style の height に渡す）。
// 下ペイン（BottomPane）が開いている間は、ペインの高さ（CSS 変数 --bottom-pane-height）だけ低くし、
// グリッドが下ペインの上に収まるようにする。グリッドの中をスクロールしても列の見出し・合計行が
// 見えたままになる（UI/UX UX-048 → 02 §7「画面の縦幅に合わせるグリッドの高さ」）。
import { BOTTOM_PANE_HEIGHT_VAR } from '@/styles/commonStyles';

// offsetRem：画面の縦幅から引く高さ（ヘッダー・フッター・余白など、グリッド以外の固定の高さ。rem）
export const viewportGridHeight = (offsetRem: number): string =>
  `calc(100vh - ${offsetRem}rem - var(${BOTTOM_PANE_HEIGHT_VAR}, 0rem))`;

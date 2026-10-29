import { useEffect } from 'react';
import type { RefObject } from 'react';

// 画面表示時に、Z順（左上→右下＝DOM の順）で先頭の入力可能項目へフォーカスを当てる
// （画面設計標準 3.10）。App.tsx で画面の切り替えごとに呼ぶ（画面側の実装は不要）。
//
// 対象：入力欄（input・textarea・select）、コンボボックス（aria-haspopup="listbox"）、
//       年月・年月日の部品（data-input-control）。
// 対象外：非活性・読み取り専用・Tab で飛ばす項目（tabindex="-1"）・非表示の項目・グリッド内。
// 画面が自分でフォーカスを当てた場合（表示直後に本文の中へフォーカスがある）は何もしない。
const INPUT_SELECTOR = [
  'input:not([type="hidden"]):not([disabled]):not([readonly])',
  'textarea:not([disabled]):not([readonly])',
  'select:not([disabled])',
  'button[aria-haspopup="listbox"]:not([disabled])',
  '[data-input-control]:not([disabled])',
]
  .map((s) => `${s}:not([tabindex="-1"])`)
  .join(', ');

export function focusFirstInput(root: HTMLElement) {
  if (root.contains(document.activeElement) && document.activeElement !== root) return;
  const target = Array.from(root.querySelectorAll<HTMLElement>(INPUT_SELECTOR)).find(
    (el) => el.offsetParent !== null && !el.closest('.ag-root-wrapper')
  );
  target?.focus({ preventScroll: true });
}

// key（画面 ID 等）が変わるたびに、描画が終わってから先頭の入力項目へフォーカスする
export function useInitialFocus(rootRef: RefObject<HTMLElement | null>, key: unknown) {
  useEffect(() => {
    // 画面の描画（子の useEffect・遅延描画）が終わってから探す
    const timer = window.setTimeout(() => {
      if (rootRef.current) focusFirstInput(rootRef.current);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [rootRef, key]);
}

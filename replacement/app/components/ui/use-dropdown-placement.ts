import * as React from 'react';

// コンボボックス（SingleCombobox／MultiCombobox／EditableCombobox）の候補一覧を
// 開く向きと位置を決める共通フック（UI/UX UX-094）。
// ・下に候補一覧が入りきらず、上のほうが広いときは上に開く（入りきるなら常に下）。
// ・判定の範囲は、表の中（AG Grid のセル編集）なら表の外枠（.ag-root-wrapper）と画面の重なり、
//   それ以外は画面（ビューポート）。下に入らない一覧を開くと、フォーカスや候補のスクロールで
//   表・画面ごと動いてしまうため。
// ・ポータル描画（usePortal）のときは固定配置の位置（top／bottom・left・width）も返す。
// ・開いた側にも入りきらないときは、一覧の高さの上限（maxHeight）をその側の空きにする。
//   外枠は flex-col、候補の並びは min-h-0 にしておく（上限に合わせて候補の並びが縮み、中でスクロールする）。

/** 候補一覧を開く向き */
export type DropdownSide = 'below' | 'above';

/** トリガーと候補一覧のすき間（px。mt-1／mb-1 と同じ 0.25rem） */
const MENU_GAP_PX = 4;
/** ポータル描画の候補一覧の最小幅（px。min-w-60 と同じ 15rem） */
const MENU_MIN_WIDTH_PX = 240;

interface UseDropdownPlacementParams {
  /** 開いているか */
  open: boolean;
  /** body 直下のポータルで描画するか */
  usePortal: boolean;
  /** トリガー（ボタン・入力欄）を囲む要素 */
  containerRef: React.RefObject<HTMLElement | null>;
  /** 候補一覧の要素（高さを測る） */
  menuRef: React.RefObject<HTMLElement | null>;
}

// 判定の範囲（上端・下端）。表の中は表の外枠と画面の重なり、それ以外は画面。
const getBounds = (el: HTMLElement) => {
  const viewport = { top: 0, bottom: window.innerHeight };
  const grid = el.closest('.ag-root-wrapper');
  if (!grid) return viewport;
  const r = grid.getBoundingClientRect();
  return {
    top: Math.max(viewport.top, r.top),
    bottom: Math.min(viewport.bottom, r.bottom),
  };
};

export function useDropdownPlacement({
  open,
  usePortal,
  containerRef,
  menuRef,
}: UseDropdownPlacementParams) {
  const [side, setSide] = React.useState<DropdownSide>('below');
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({});
  // 開いた時点の候補一覧の高さ（高さの上限を付ける前に測った値。スクロール追従でも使う）
  const naturalHeightRef = React.useRef(0);

  const update = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const bounds = getBounds(el);
    const menuHeight = naturalHeightRef.current;
    const spaceBelow = bounds.bottom - r.bottom - MENU_GAP_PX;
    const spaceAbove = r.top - bounds.top - MENU_GAP_PX;
    const next: DropdownSide =
      menuHeight > spaceBelow && spaceAbove > spaceBelow ? 'above' : 'below';
    setSide(next);
    // 開いた側にも入りきらないときは、一覧の高さをその側の空きまでにする
    // （候補は一覧の中でスクロールする。一覧が表・画面の端で切れないようにする）。
    const space = Math.max(0, next === 'above' ? spaceAbove : spaceBelow);
    const maxHeight = menuHeight > space ? space : undefined;
    if (!usePortal) {
      setMenuStyle(maxHeight === undefined ? {} : { maxHeight });
      return;
    }
    // ポータル描画は固定配置。上に開くときは下端をトリガーの上端にそろえる
    // （絞り込みで候補が減っても、一覧はトリガー側へ縮む）。
    setMenuStyle({
      position: 'fixed',
      left: r.left,
      width: Math.max(MENU_MIN_WIDTH_PX, r.width),
      maxHeight,
      ...(next === 'above'
        ? { bottom: window.innerHeight - r.top + MENU_GAP_PX }
        : { top: r.bottom + MENU_GAP_PX }),
    });
  }, [containerRef, usePortal]);

  // 開いた直後（描画前）に候補一覧の高さを測って向きを決める。
  // ポータル描画は開いている間、スクロール・リサイズでトリガーに追従する。
  React.useLayoutEffect(() => {
    if (!open) {
      setSide('below');
      setMenuStyle({});
      return;
    }
    naturalHeightRef.current = menuRef.current?.offsetHeight ?? 0;
    update();
    if (!usePortal) return;
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, usePortal, update, menuRef]);

  // menuStyle は候補一覧の外枠の style にそのまま渡す（インライン描画でも高さの上限を含む）
  return { side, menuStyle };
}

// 候補一覧の中だけをスクロールして、ハイライト中の候補を見える位置に出す。
// scrollIntoView は祖先（表・画面）までスクロールさせるため使わない（UI/UX UX-094）。
export const scrollIntoListView = (
  list: HTMLElement | null,
  item: HTMLElement | null
) => {
  if (!list || !item) return;
  const l = list.getBoundingClientRect();
  const i = item.getBoundingClientRect();
  if (i.top < l.top) list.scrollTop -= l.top - i.top;
  else if (i.bottom > l.bottom) list.scrollTop += i.bottom - l.bottom;
};

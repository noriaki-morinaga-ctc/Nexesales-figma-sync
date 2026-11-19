import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { CellMouseOverEvent } from 'ag-grid-community';
import { Check, Copy } from 'lucide-react';

import { GRID_EMPTY_TEXT } from '@/components/grid';
import { copyText } from '@/components/ui/copyable-area';

// セルにマウスを乗せるとセルの右端にコピーのボタンを出し、押すとセルの表示値をコピーする（試作）。
// UI/UX 確認用モックのコメント #22「コンテキストメニュー経由でなくても値をコピーできるように」への案。
// ・コピーする値は画面に見えている文字（セル内の文字）。Ctrl+C（範囲コピー）・右クリック「コピー」はそのまま使える。
// ・対象は入力できないセルで、値があるもの。空欄（「-」）・値を持たない操作ボタンやチェックボックスの列には出さない。
// ・コピーできたらボタンを1秒チェックの印にする（トーストは出さない。失敗時だけ copyText がトーストで知らせる）。
// ・マウス操作の補助のため、ボタンは Tab で止まらない（キーボードは Ctrl+C で同じことができる）。
// ・スクロール・右クリックしたら隠す。位置はセルの位置から JS で求めるため style で指定する（規約の例外：JS で計算する値）。
// ※ セルのクリックだけでコピーする形も試したが、クリックのたびにクリップボードが上書きされるため、ボタンにした（11/19）。
// ※ 画面の再描画を起こさないよう、表示の状態は小さな store に持ち、ボタンだけが購読する。
// ※ 計画一覧だけの試作。全画面で使うと決まったら grid/ の共通部品へ移す。

interface HoverTarget {
  text: string;
  /** セルの縦の中央（rem。画面の左上から） */
  top: number;
  /** セルの右端（rem。画面の左上から） */
  left: number;
}

const PX_PER_REM = 12.8;
const HIDE_DELAY_MS = 150;
const COPIED_MS = 1000;

/** ボタンの表示の状態（PlanList 全体を再描画しないため React の state にしない） */
const createHoverStore = () => {
  let target: HoverTarget | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  // マウスがボタンの上にあるか。AG Grid のセルから外れた知らせ（cellMouseOut）はボタンの
  // mouseenter より後に届くため、ボタンの上にいる間は隠さない（隠すと下のセルに乗り直して点滅する）
  let overButton = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const cancelHide = () => clearTimeout(hideTimer);
  return {
    enterButton: () => {
      overButton = true;
      cancelHide();
    },
    leaveButton: () => {
      overButton = false;
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    get: () => target,
    show: (next: HoverTarget) => {
      cancelHide();
      target = next;
      emit();
    },
    hideNow: () => {
      cancelHide();
      // ボタンを消すので、ボタンの上にいる印も戻す
      overButton = false;
      if (!target) return;
      target = null;
      emit();
    },
    hideLater: () => {
      cancelHide();
      if (overButton) return;
      hideTimer = setTimeout(() => {
        target = null;
        emit();
      }, HIDE_DELAY_MS);
    },
  };
};
type HoverStore = ReturnType<typeof createHoverStore>;

/** マウスを乗せたセルから、コピーする文字とボタンの位置を求める（対象外は null） */
const resolveTarget = (e: CellMouseOverEvent): HoverTarget | null => {
  const cell = (e.event?.target as Element | null)?.closest('.ag-cell');
  if (!cell || e.node.group || e.column.isCellEditable(e.node)) return null;
  // 値を持たない列（操作ボタン・チェックボックスの列）は対象外。計画書番号のようなリンクのボタンは値があるので対象
  if (e.value == null || e.value === '' || cell.querySelector('input'))
    return null;
  const text = cell.textContent?.trim() ?? '';
  if (!text || text === GRID_EMPTY_TEXT) return null;
  const rect = cell.getBoundingClientRect();
  return {
    text,
    top: (rect.top + rect.height / 2) / PX_PER_REM,
    left: rect.right / PX_PER_REM,
  };
};

interface HoverCopyButtonProps {
  store: HoverStore;
}

function HoverCopyButton({ store }: HoverCopyButtonProps) {
  const target = useSyncExternalStore(store.subscribe, store.get);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // 表示中はどこかがスクロールしたら隠す（セルとボタンの位置がずれるため）
  useEffect(() => {
    if (!target) return;
    window.addEventListener('scroll', store.hideNow, true);
    return () => window.removeEventListener('scroll', store.hideNow, true);
  }, [target, store]);

  useEffect(() => {
    if (!copiedText) return;
    const timer = setTimeout(() => setCopiedText(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copiedText]);

  if (!target) return null;
  const copied = copiedText === target.text;

  const handleClick = async () => {
    if (await copyText(target.text)) setCopiedText(target.text);
  };

  return createPortal(
    <button
      type="button"
      tabIndex={-1}
      aria-label="値をコピー"
      title="値をコピー"
      className="fixed z-50 -ml-1 flex size-6 -translate-x-full -translate-y-1/2 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-gray-100 hover:text-gray-900"
      style={{ top: `${target.top}rem`, left: `${target.left}rem` }}
      // グリッドのセルのフォーカス・範囲選択を動かさない
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={store.enterButton}
      onMouseLeave={() => {
        store.leaveButton();
        store.hideLater();
      }}
      onClick={() => void handleClick()}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>,
    document.body
  );
}

/**
 * セルのコピーのボタン。返り値の gridProps を <AgGridReact> に spread し、overlay をどこかに置く。
 */
export function useCellHoverCopy() {
  const store = useMemo(createHoverStore, []);
  const gridProps = useMemo(
    () => ({
      onCellMouseOver: (e: CellMouseOverEvent) => {
        const target = resolveTarget(e);
        if (target) store.show(target);
        else store.hideNow();
      },
      onCellMouseOut: () => store.hideLater(),
      // 右クリックメニューと重ならないよう隠す
      onCellContextMenu: () => store.hideNow(),
    }),
    [store]
  );
  return { gridProps, overlay: <HoverCopyButton store={store} /> };
}

'use client';

import * as React from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './context-menu';

// 入力項目の「表示中の値」をコピーできる範囲（検索エリア等を囲んで使う）。
// 範囲内で、フォーカス中の項目で Ctrl+C、または項目を右クリック →「コピー」で、
// その項目の表示値をクリップボードへ入れる（成功時のトーストは出さない。失敗時のみ知らせる）。
// 値の取り方（表示されている文字をそのままコピーする）：
//   ・data-copy-text 属性を持つ要素（MonthYearPicker／DateMonthYearPicker／
//     SingleCombobox／MultiCombobox が表示値を持たせている）
//   ・shadcn の Select（改変禁止のため属性を足せない）は、トリガー内の表示値
//     （未選択でプレースホルダを出している場合は対象外）
//   ・素の入力欄（input／textarea）はその値
// 入力欄で文字を選択している場合は、ブラウザ標準のコピー・右クリックメニューを優先する。
// 値の無い場所を右クリックした場合も、ブラウザ標準のメニューのままにする。

/** 入力欄で文字を選択中か（選択中は標準のコピーに任せる） */
const hasTextSelection = (target: EventTarget | null): boolean =>
  (target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement) &&
  target.selectionStart !== target.selectionEnd;

/** 範囲内の要素から、コピーする表示値を求める（無ければ空文字） */
const resolveCopyText = (target: EventTarget | null): string => {
  if (!(target instanceof Element)) return '';
  const owner = target.closest<HTMLElement>('[data-copy-text]');
  if (owner) return owner.dataset.copyText?.trim() ?? '';
  const trigger = target.closest<HTMLElement>('[data-slot="select-trigger"]');
  if (trigger) {
    if (trigger.hasAttribute('data-placeholder')) return '';
    return (
      trigger
        .querySelector('[data-slot="select-value"]')
        ?.textContent?.trim() ?? ''
    );
  }
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return target.value.trim();
  }
  return '';
};

/** 文字をクリップボードへコピーする。失敗したときだけトーストで知らせる（戻り値＝コピーできたか） */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    toast.error('コピーできませんでした');
    return false;
  }
};

interface CopyableAreaProps {
  className?: string;
  children: React.ReactNode;
}

export function CopyableArea({ className, children }: CopyableAreaProps) {
  // 右クリックした項目の表示値。空のときは独自メニューを出さず、標準メニューに任せる。
  const [menuText, setMenuText] = React.useState('');

  const handleKeyDownCapture = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    if (e.key.toLowerCase() !== 'c') return;
    if (hasTextSelection(e.target) || window.getSelection()?.toString()) return;
    const text = resolveCopyText(e.target);
    if (!text) return;
    e.preventDefault();
    void copyText(text);
  };

  // contextmenu より先に起きる右ボタンの pointerdown で、コピー対象の値を決める
  //（ContextMenuTrigger の disabled を contextmenu の時点で反映させるため）。
  const handlePointerDownCapture = (e: React.PointerEvent) => {
    if (e.button !== 2) return;
    setMenuText(hasTextSelection(e.target) ? '' : resolveCopyText(e.target));
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={!menuText}>
        <div
          className={className}
          onKeyDownCapture={handleKeyDownCapture}
          onPointerDownCapture={handlePointerDownCapture}
        >
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => void copyText(menuText)}>
          <Copy />
          コピー
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

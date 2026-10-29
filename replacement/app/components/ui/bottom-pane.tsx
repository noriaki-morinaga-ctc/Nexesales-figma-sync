import { useState, useEffect, useRef, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { XIcon, ChevronUp, MoveVertical } from 'lucide-react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import {
  Sheet,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './sheet';
import { cn } from './utils';
import { useExclusivePane } from './use-exclusive-pane';
import { CARD_TITLE_CLASS } from '../../../styles/commonStyles';

interface BottomPaneProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  description?: string;
  // タイトル直下（固定ヘッダー内）に表示する任意の要素。指定時は説明文の代わりに表示する。
  // ヘッダーはスクロールしないため、ここに置いた項目は常に見える。
  headerContent?: React.ReactNode;
  // タイトル行の右端（閉じる×の左）に置く操作要素（確定ボタン等）。
  // ヘッダーは固定表示のため、本文をスクロールしても常に操作できる。
  headerActions?: React.ReactNode;
  initialHeight?: number; // rem単位
  // 画面の縦幅に対する初期表示高さの割合（0〜1）。initialHeight 未指定時に使う。
  // 例：0.5 を渡すと、親画面のグリッドとペインが画面をおよそ半分ずつ使う。
  initialHeightRatio?: number;
  minHeight?: number; // rem単位
  maxHeight?: number; // rem単位
  // 高さ分のpadding-bottomを付与して中身を押し上げるスクロールコンテナのCSSセレクタ
  // （既定はアプリのメインスクロール領域 <main>）
  pushTargetSelector?: string;
  // 画面下部のアクションバー（フッター）のCSSセレクタ。
  // 既定は data-screen-footer 属性を持つ画面下部のアクションバー。
  // ペインはこのフッターの高さ分だけ上へドックし、フッターをペインの下
  // （画面最下部）に残す。
  screenFooterSelector?: string;
  // 折り畳み状態を親が制御する場合に指定（制御コンポーネント化）。
  // 指定時は内部状態ではなくこの値を用い、変更は onCollapsedChange で親へ通知する。
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  // 非制御時の初期折り畳み状態（既定：展開＝false）。
  initialCollapsed?: boolean;
  // 折り畳みタブを目立たせる（ラベル付きの青タブ）。常時ドック表示の入口として使う。
  prominentTab?: boolean;
  // 目立つ折り畳みタブに表示するラベル（既定：title）。
  collapsedTabLabel?: string;
  // 目立つ折り畳みタブのラベル左に表示するアイコン（機能を示す補助。例：<Copy />）。
  collapsedTabIcon?: React.ReactNode;
  // 開いたときにペイン自体へフォーカスする（既定は先頭の操作要素へ自動フォーカス）。
  // フォーカスで候補が開くコンボボックスをヘッダー先頭に置くペインで指定し、
  // 開いた直後にドロップダウンが広がって一覧を覆うのを防ぐ。
  focusPaneOnOpen?: boolean;
}

// 折り畳み時に表示するタブの高さ（rem）。画面の縦幅を稼ぐためタブ高（h-6）に合わせる。
const COLLAPSED_HEIGHT_REM = 1.5;

// ペイン表示中に画面最下部へ固定するアクションバーの重なり順。
// 右ペイン・下ペイン（いずれも z-50）より必ず低くして、
// 右ペイン最下部のボタンを覆わないようにする。
const SCREEN_FOOTER_Z_INDEX = 40;

/**
 * プッシュ式の下ペイン。
 *
 * オーバーレイ（親画面に被さる）ではなく、ペイン自体は画面下部に固定しつつ、
 * メインスクロール領域に「ペイン高さ分の padding-bottom」を動的に付与し、
 * 親画面の中身を上へ押し上げる（＝重ならない）。これにより参照表と明細表を
 * 同時に視認しながらコピー操作ができる。
 *
 * 画面下部のアクションバー（data-screen-footer）はペインの下＝画面最下部に残す。
 * アクションバーを画面最下部へ固定し、ペインはその高さ分だけ上へドックさせる。
 * 固定時の重なり順は右ペイン（z-50）より低い SCREEN_FOOTER_Z_INDEX とするため、
 * 右ペイン最下部のボタンを覆うことはない。
 */
export function BottomPane({
  open,
  onClose,
  title,
  children,
  description,
  headerContent,
  headerActions,
  footer,
  initialHeight,
  initialHeightRatio,
  minHeight = 15,
  maxHeight,
  pushTargetSelector = 'main',
  screenFooterSelector = '[data-screen-footer]',
  collapsed,
  onCollapsedChange,
  initialCollapsed = false,
  prominentTab = false,
  collapsedTabLabel,
  collapsedTabIcon,
  focusPaneOnOpen = false,
}: BottomPaneProps) {
  // 画面の縦幅（rem換算）。デフォルトの表示高さ・最大高さの算出に用いる。
  const viewportRem =
    typeof window !== 'undefined' ? window.innerHeight / 16 : 50;
  // デフォルトは画面の縦幅の約60%まで開く（明示指定があればそれを優先）。
  // 画面最下部のアクションバーの分だけ実際の表示領域が狭くなるため、
  // 親画面（グリッド）が十分に見える高さに抑える。
  const resolvedInitial =
    initialHeight ?? Math.round(viewportRem * (initialHeightRatio ?? 0.6));
  // 最大高さは画面の縦幅の約92%（デフォルトより上までドラッグ可。明示指定優先）。
  const resolvedMax = maxHeight ?? Math.round(viewportRem * 0.92);

  const [height, setHeight] = useState(resolvedInitial);
  const [isResizing, setIsResizing] = useState(false);
  // 画面下部のアクションバー（フッター）の高さ（rem）。ペインの下端オフセットに使う。
  const [footerHeight, setFooterHeight] = useState(0);
  const resizing = useRef(false);
  // ハンドル操作がドラッグ（高さ調整）かクリック（折り畳みトグル）かの判定用
  const moved = useRef(false);
  const startY = useRef(0);

  // 折り畳み状態：collapsed prop 指定時は制御コンポーネント、未指定時は内部状態で管理。
  const isControlled = collapsed !== undefined;
  const [internalCollapsed, setInternalCollapsed] = useState(initialCollapsed);
  const isCollapsed = isControlled ? collapsed : internalCollapsed;
  // 折り畳み状態の変更（非制御時は内部状態を更新し、常に親へも通知）
  const setIsCollapsed = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalCollapsed(next);
      onCollapsedChange?.(next);
    },
    [isControlled, onCollapsedChange],
  );

  // 非制御時のみ：開くたびに初期折り畳み状態へリセット（制御時は親が管理）
  useEffect(() => {
    if (open && !isControlled) setInternalCollapsed(initialCollapsed);
  }, [open, isControlled, initialCollapsed]);

  // ペインは画面で1つだけ表示する。他のペインが展開されたら自身を閉じる。
  // 常時ドック表示の下ペイン（prominentTab）は再表示の入口となるタブを残すため
  // 「閉じる」＝折り畳みとし、それ以外はペイン自体を閉じる。
  const handleExclusiveClose = useCallback(() => {
    if (prominentTab) setIsCollapsed(true);
    else onClose();
  }, [prominentTab, setIsCollapsed, onClose]);
  useExclusivePane(open && !isCollapsed, handleExclusiveClose);

  // ペイン表示中は画面下部のアクションバー（フッター）を画面最下部へ固定する。
  // フッターはスクロール領域（<main>）の内側にあり、押し上げ用の padding-bottom で
  // 一緒に持ち上がってしまう。かつ祖先が overflow-hidden のため transform でずらすと
  // 見切れる。そのため position:fixed で最下部へ固定し、ペインはその上へドックさせる。
  // 高さはコメント欄のリサイズ等で変わるため ResizeObserver で追従する。
  useEffect(() => {
    const footer =
      open && screenFooterSelector
        ? document.querySelector<HTMLElement>(screenFooterSelector)
        : null;
    if (!footer) {
      setFooterHeight(0);
      return;
    }
    // 元の値を退避しておき、確実に復元できるようにする
    const prev = {
      position: footer.style.position,
      left: footer.style.left,
      right: footer.style.right,
      bottom: footer.style.bottom,
      zIndex: footer.style.zIndex,
    };
    footer.style.position = 'fixed';
    footer.style.left = '0';
    footer.style.right = '0';
    footer.style.bottom = '0';
    footer.style.zIndex = String(SCREEN_FOOTER_Z_INDEX);

    // 実測値は px のため rem へ換算して扱う（1rem = 16px）
    const update = () =>
      setFooterHeight(footer.getBoundingClientRect().height / 16);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(footer);
    return () => {
      observer.disconnect();
      Object.assign(footer.style, prev);
      setFooterHeight(0);
    };
  }, [open, screenFooterSelector]);

  // プッシュ処理：スクロールコンテナへ「ペイン高さ＋フッター高さ」分の padding-bottom を
  // 付与する。border-box のため内容領域がその分だけ縮み、中身がペインの上へ押し上げられる
  // （フッターは固定表示でフローから外れるため、その高さも加算する）。
  // 開いている間のみ適用し、閉じる／アンマウント時に元へ戻す。
  useEffect(() => {
    const target = document.querySelector<HTMLElement>(pushTargetSelector);
    if (!target) return;

    // 元の値を退避しておき、確実に復元できるようにする
    const prevPaddingBottom = target.style.paddingBottom;
    const prevTransition = target.style.transition;

    if (open) {
      const effectiveHeight = isCollapsed ? COLLAPSED_HEIGHT_REM : height;
      // ドラッグ中はカクつき防止のためトランジションを無効化
      target.style.transition = isResizing
        ? 'none'
        : 'padding-bottom 300ms ease-in-out';
      target.style.paddingBottom = `${effectiveHeight + footerHeight}rem`;
    } else {
      target.style.transition = 'padding-bottom 300ms ease-in-out';
      target.style.paddingBottom = '';
    }

    return () => {
      // クリーンアップ：付与したスタイルを元に戻す
      target.style.paddingBottom = prevPaddingBottom;
      target.style.transition = prevTransition;
    };
  }, [
    open,
    isCollapsed,
    height,
    isResizing,
    pushTargetSelector,
    footerHeight,
  ]);

  // リサイズ処理（上端ハンドルのドラッグで高さを変更）
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      // 一定以上動かしたらドラッグ（高さ調整）とみなす
      if (Math.abs(e.clientY - startY.current) > 3) moved.current = true;
      const newHeightRem = (window.innerHeight - e.clientY) / 16;
      if (newHeightRem >= minHeight && newHeightRem <= resolvedMax) {
        setHeight(newHeightRem);
      }
    };

    const handleMouseUp = () => {
      if (!resizing.current) return;
      resizing.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // ドラッグせずクリックした場合は折り畳む（リサイズハンドルに統合）。
      // 展開はハンドル非表示時に現れる中央タブから行う。
      if (!moved.current) setIsCollapsed(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minHeight, resolvedMax, setIsCollapsed]);

  // リサイズ開始（ドラッグ中はアニメーションを無効化してカクつきを防ぐ）
  const handleResizeStart = (e: ReactMouseEvent) => {
    resizing.current = true;
    moved.current = false;
    startY.current = e.clientY;
    setIsResizing(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      // modal={false}：背景オーバーレイを無くし、表示中も親画面を操作可能にする
      modal={false}
    >
      <SheetPrimitive.Portal>
        <SheetPrimitive.Content
          data-slot="sheet-content"
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex w-full flex-col gap-0 overflow-visible border-t border-gray-200 bg-white p-0 ease-in-out',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-300 data-[state=open]:duration-500',
            isCollapsed
              ? 'pointer-events-none border-t-0 bg-transparent shadow-none'
              : 'shadow-2xl',
          )}
          style={{
            height: isCollapsed ? `${COLLAPSED_HEIGHT_REM}rem` : `${height}rem`,
            // 画面最下部のアクションバーの上へドックする（重ならない）
            bottom: `${footerHeight}rem`,
            // 折り畳み/展開時は高さをアニメーション。ドラッグ中は無効化。
            transitionProperty: isResizing ? 'none' : 'height',
            transitionDuration: isResizing ? '0ms' : '300ms',
            transitionTimingFunction: 'ease-in-out',
          }}
          // 親画面を操作してもペインを閉じない（閉じるは✕／Escのみ）
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            if (!focusPaneOnOpen) return;
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {isCollapsed ? (
            <>
              {/* アクセシビリティ用（折り畳み時も保持） */}
              <SheetPrimitive.Title className="sr-only">
                {title}
              </SheetPrimitive.Title>
              <SheetPrimitive.Description className="sr-only">
                {description || title}
              </SheetPrimitive.Description>

              {/* 折り畳み時：上端中央のタブ（押下で展開）。
                  prominentTab 指定時はラベル付きの青タブで目立たせる（常時ドックの入口）。
                  collapsedTabIcon を渡すとラベル左に機能を示すアイコンが並ぶ。 */}
              <div className="flex h-full w-full justify-center">
                {prominentTab ? (
                  <button
                    type="button"
                    className="pointer-events-auto flex h-6 items-center justify-center gap-1.5 rounded-t-lg border border-b-0 border-blue-600 bg-blue-600 px-4 text-white shadow-lg ring-2 ring-blue-300 transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    onClick={() => setIsCollapsed(false)}
                    aria-expanded={false}
                    title={collapsedTabLabel || title}
                  >
                    <ChevronUp className="h-5 w-5 motion-safe:animate-bounce" />
                    {collapsedTabIcon}
                    <span className="text-sm font-bold whitespace-nowrap">
                      {collapsedTabLabel || title}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="pointer-events-auto flex h-6 w-16 items-center justify-center rounded-t-lg border border-b-0 border-gray-300 bg-white text-gray-600 shadow-lg transition-colors hover:bg-blue-50 hover:text-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    onClick={() => setIsCollapsed(false)}
                    aria-label="ペインを展開"
                    aria-expanded={false}
                    title={title}
                  >
                    <ChevronUp className="h-5 w-5" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* 上端リサイズハンドル（ドラッグで高さ変更／クリックで折り畳み） */}
              <div
                className="group absolute left-0 top-0 z-10 flex h-3 w-full cursor-row-resize items-center justify-center bg-transparent transition-colors hover:bg-blue-400/15"
                onMouseDown={handleResizeStart}
                role="separator"
                aria-orientation="horizontal"
                aria-label="ドラッグで高さ変更／クリックで折り畳み・展開"
                title="ドラッグで高さ変更 / クリックで折り畳み・展開"
              >
                {/* 1つの図形：円の中に上下矢印。ドラッグ＝高さ調整／クリック＝折り畳み */}
                <span className="absolute left-1/2 top-0 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm transition-colors group-hover:border-blue-400 group-hover:bg-blue-50 group-hover:text-blue-600">
                  <MoveVertical className="h-4 w-4" />
                </span>
              </div>

              {/* ヘッダー（画面の縦幅を稼ぐため、タイトルはカード見出しサイズ・
                  上下余白は最小限に留める） */}
              <SheetHeader className="relative mt-1 gap-1 border-b border-gray-200 px-6 pt-2 pb-1.5">
                <div className="flex items-center gap-2 pr-8">
                  <SheetTitle className={CARD_TITLE_CLASS}>{title}</SheetTitle>
                  {/* タイトル行右端の操作要素。pr-8 で確保した余白の内側に置くため
                      絶対配置の×ボタンとは重ならない。 */}
                  {headerActions && (
                    <div className="ml-auto flex items-center gap-2">
                      {headerActions}
                    </div>
                  )}
                </div>
                <SheetDescription
                  className={
                    headerContent
                      ? 'sr-only'
                      : description
                        ? 'mt-1 text-sm text-gray-600'
                        : 'sr-only'
                  }
                >
                  {description || title}
                </SheetDescription>

                {/* タイトル直下のヘッダー要素（指定時のみ）。ヘッダーは固定表示のため常に見える。 */}
                {headerContent && <div className="mt-1.5">{headerContent}</div>}

                {/* ×ボタン */}
                <button
                  type="button"
                  className="absolute top-1.5 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  onClick={onClose}
                  aria-label="閉じる"
                >
                  <XIcon className="size-5" />
                </button>
              </SheetHeader>

              {/* コンテンツエリア（スクロール可能・コンテナクエリ対応） */}
              <div className="@container flex flex-1 flex-col overflow-y-auto px-6 py-2">
                {children}
              </div>

              {/* フッター */}
              {footer && (
                <SheetFooter className="border-t border-gray-200 bg-white px-6 py-2">
                  <div className="flex justify-end">{footer}</div>
                </SheetFooter>
              )}
            </>
          )}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </Sheet>
  );
}

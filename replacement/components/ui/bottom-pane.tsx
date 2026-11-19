import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { XIcon, ChevronUp } from 'lucide-react';
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
import {
  BOTTOM_PANE_HEIGHT_VAR,
  CARD_TITLE_CLASS,
} from '@/styles/commonStyles';

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
  // 見出しのすぐ右に置く要素（対象年月の選択など）。説明文はさらにその右に並ぶ。
  titleExtra?: React.ReactNode;
  // タイトル行の右端（閉じる×の左）に置く操作要素（確定ボタン等）。
  // ヘッダーは固定表示のため、本文をスクロールしても常に操作できる。
  headerActions?: React.ReactNode;
  // 初めて開いたときの高さ（rem単位）。中にグリッドがあるペインは、開いたあとに明細5行分の高さへ
  // 合わせ直すため、これはグリッドが無いペインの高さと、合わせる前の高さになる。
  initialHeight?: number;
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

// 初めて開いたときに見せるグリッドの明細の行数（UI/UX UX-049 → 02 BottomPane）
const INITIAL_VISIBLE_ROWS = 5;
// 明細5行分に合わせるときの高さの下限（rem）。見出し・境目だけにならないようにする
const FIT_MIN_HEIGHT_REM = 8;
// グリッドの描画と、開くときの高さの動き（0.3秒）が終わるのを待つフレーム数の上限（約1.5秒）
const FIT_WAIT_FRAMES = 90;
// 5行分に合わせ直す回数の上限（横スクロールバーが後から出るなどで表示域が変わるため）
const FIT_MAX_ADJUSTMENTS = 3;
// 境目のバーをキーボード（↑↓）で動かすときの1回の量（rem）
const KEYBOARD_RESIZE_STEP_REM = 2;

// rem・px の長さ（CSS 変数の値など）を px にする（1rem = 12.8px → 01「ルートフォントサイズ設定」）
const lengthToPx = (value: string): number => {
  const v = value.trim();
  if (v.endsWith('rem')) return parseFloat(v) * 12.8;
  return parseFloat(v) || 0;
};

// 画面の縦幅を測るまでの仮の値（rem）。サーバーで描画するときにも使う。
const FALLBACK_VIEWPORT_REM = 50;

// ブラウザでは表示する前に実行する useLayoutEffect、サーバーでは useEffect（何もしない）を使う。
// サーバーで useLayoutEffect を呼ぶと React が警告を出すため。
const useBrowserLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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
  titleExtra,
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
  // 描画中は window を読まない（サーバーで描画するときに無いため）。仮の値で描画し、
  // 表示する前（useLayoutEffect）に実際の縦幅を測って置き換える。
  const [viewportRem, setViewportRem] = useState(FALLBACK_VIEWPORT_REM);
  // デフォルトは画面の縦幅の約60%まで開く（明示指定があればそれを優先）。
  // 画面最下部のアクションバーの分だけ実際の表示領域が狭くなるため、
  // 親画面（グリッド）が十分に見える高さに抑える。
  const initialHeightOf = (vr: number) =>
    initialHeight ?? Math.round(vr * (initialHeightRatio ?? 0.6));
  // 最大高さは画面の縦幅の約92%（デフォルトより上までドラッグ可。明示指定優先）。
  const resolvedMax = maxHeight ?? Math.round(viewportRem * 0.92);

  const [height, setHeight] = useState(() =>
    initialHeightOf(FALLBACK_VIEWPORT_REM)
  );

  // 表示する前に画面の縦幅を測り、既定の高さを決める（初回だけ）。
  // 画面の大きさを変えたら最大高さも追従する。
  useBrowserLayoutEffect(() => {
    const measure = () => window.innerHeight / 12.8;
    const measured = measure();
    setViewportRem(measured);
    setHeight(initialHeightOf(measured));
    const handleResize = () => setViewportRem(measure());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // 初回の表示だけで測る（既定の高さは利用者のドラッグで変わるため上書きしない）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 初回の表示だけで測る（既定の高さは利用者のドラッグで変わるため上書きしない）
  }, []);
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

    // 実測値は px のため rem へ換算して扱う（1rem = 12.8px。画面全体を 80% にしている → 01「ルートフォントサイズ設定」）
    const update = () =>
      setFooterHeight(footer.getBoundingClientRect().height / 12.8);
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

    const root = document.documentElement;
    if (open) {
      const effectiveHeight = isCollapsed ? COLLAPSED_HEIGHT_REM : height;
      // 親画面のグリッドがペインの上に収まるよう、ペインの高さを CSS 変数で知らせる
      root.style.setProperty(BOTTOM_PANE_HEIGHT_VAR, `${effectiveHeight}rem`);
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
      if (open) root.style.removeProperty(BOTTOM_PANE_HEIGHT_VAR);
    };
  }, [
    open,
    isCollapsed,
    height,
    isResizing,
    pushTargetSelector,
    footerHeight,
  ]);

  // 初めて展開したとき、中のグリッドの明細が5行見える高さに合わせる（UI/UX UX-049）。
  // グリッドの行の高さと、明細の表示域（.ag-body-viewport）の今の高さの差だけペインを伸び縮みさせる
  // （ペインの中のグリッドはペインの高さに合わせて伸び縮みする作りにする → 02 BottomPane）。
  // 1回だけ行い、その後に利用者がドラッグで変えた高さは保つ。グリッドが無いペインは合わせない。
  const contentRef = useRef<HTMLDivElement>(null);
  const fittedRef = useRef(false);
  // 今の高さ（state）を effect の中から読む
  const heightRef = useRef(height);
  heightRef.current = height;
  useEffect(() => {
    if (!open || isCollapsed || fittedRef.current) return;
    let frame = 0;
    let waited = 0;
    let adjusted = 0;
    const fit = () => {
      const box = contentRef.current;
      const viewport = box?.querySelector<HTMLElement>('.ag-body-viewport');
      const wrapper = box?.querySelector<HTMLElement>('.ag-root-wrapper');
      // ペインが今の高さまで伸びきったか（折り畳みから広げる・合わせ直すと高さが 0.3 秒かけて動くため、途中で測らない）
      const paneEl = box?.closest<HTMLElement>('[data-slot=sheet-content]');
      const settled =
        !!paneEl &&
        Math.abs(
          paneEl.getBoundingClientRect().height - heightRef.current * 12.8
        ) < 1;
      if (!viewport || !wrapper || viewport.clientHeight === 0 || !settled) {
        // グリッドがまだ描画されていない（または無い）か、高さが動いている途中。少し待って、無ければやめる
        if (waited++ < FIT_WAIT_FRAMES) frame = requestAnimationFrame(fit);
        else fittedRef.current = adjusted > 0;
        return;
      }
      // 行の高さ：描画済みの行があればその高さ、無ければテーマの行の高さ（--ag-row-height）
      const row = viewport.querySelector<HTMLElement>('.ag-row');
      const rowPx =
        row?.getBoundingClientRect().height ||
        lengthToPx(
          getComputedStyle(wrapper).getPropertyValue('--ag-row-height')
        );
      const deltaPx = rowPx * INITIAL_VISIBLE_ROWS - viewport.clientHeight;
      if (!rowPx || Math.abs(deltaPx) < 1 || adjusted >= FIT_MAX_ADJUSTMENTS) {
        fittedRef.current = true;
        return;
      }
      // 合わせたあと、横スクロールバーが後から出るなどで表示域が変わることがあるため、
      // 高さが落ち着いたらもう一度測り、ずれていれば合わせ直す（最大 FIT_MAX_ADJUSTMENTS 回）
      adjusted += 1;
      waited = 0;
      const next = Math.min(
        resolvedMax,
        Math.max(FIT_MIN_HEIGHT_REM, heightRef.current + deltaPx / 12.8)
      );
      heightRef.current = next;
      setHeight(next);
      frame = requestAnimationFrame(fit);
    };
    frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [open, isCollapsed, resolvedMax]);

  // 境目のバーをキーボードで動かす（↑で高く・↓で低く。Enter・スペースで折り畳み）
  const handleSeparatorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step =
        e.key === 'ArrowUp' ? KEYBOARD_RESIZE_STEP_REM : -KEYBOARD_RESIZE_STEP_REM;
      setHeight((h) => Math.min(resolvedMax, Math.max(minHeight, h + step)));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsCollapsed(true);
    }
  };

  // リサイズ処理（上端ハンドルのドラッグで高さを変更）
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      // 一定以上動かしたらドラッグ（高さ調整）とみなす
      if (Math.abs(e.clientY - startY.current) > 3) moved.current = true;
      const newHeightRem = (window.innerHeight - e.clientY) / 12.8;
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
            'fixed inset-x-0 bottom-0 z-50 flex w-full flex-col gap-0 overflow-visible bg-slate-50 p-0 ease-in-out',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-300 data-[state=open]:duration-500',
            isCollapsed && 'pointer-events-none bg-transparent shadow-none',
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
              {/* 親画面との境目のバー（UI/UX UX-049）。グレーの帯＋上下の線＋上向きの影で親画面と
                  はっきり分け、中央のつまみでつかめることを示す。ドラッグで高さ変更／クリックで折り畳み、
                  キーボードは ↑↓ で高さ・Enter で折り畳み。つかんでいる間とホバーは青 */}
              <div
                className={cn(
                  'flex h-2.5 w-full shrink-0 cursor-row-resize items-center justify-center border-y border-slate-400 bg-slate-300 shadow-[0_-0.25rem_0.625rem_rgb(15_23_42/0.12)] transition-colors hover:bg-blue-300 focus-visible:bg-blue-300 focus-visible:outline-none',
                  isResizing && 'bg-blue-300'
                )}
                onMouseDown={handleResizeStart}
                onKeyDown={handleSeparatorKeyDown}
                tabIndex={0}
                role="separator"
                aria-orientation="horizontal"
                aria-label="ドラッグで高さ変更／クリックで折り畳み・展開"
                title="ドラッグで高さ変更 / クリックで折り畳み・展開"
              >
                <span className="h-1 w-11 rounded-full bg-slate-500" />
              </div>

              {/* ヘッダー（画面の縦幅を稼ぐため、タイトルはカード見出しサイズ・
                  上下余白は最小限に留める）。見出し・見出しの右の要素（titleExtra）・説明文を
                  1行に並べる（→ 02 §10.3 BottomPane）。説明文が入りきらないときは省略して title で全文を出す。 */}
              {/* 見出しの帯は濃い紺（slate-700）・白い文字にし、本体（薄いグレー）・親画面と見分けやすくする
                  （UI/UX UX-049）。見出しの右の要素の項目名も白にする */}
              <SheetHeader className="relative gap-1 bg-slate-700 px-6 py-2">
                <div className="flex min-w-0 items-center gap-3 pr-8">
                  <SheetTitle
                    className={`${CARD_TITLE_CLASS} shrink-0 whitespace-nowrap text-white`}
                  >
                    {title}
                  </SheetTitle>
                  {titleExtra && (
                    <div className="flex shrink-0 items-center gap-2 [&_label]:text-white">
                      {titleExtra}
                    </div>
                  )}
                  <SheetDescription
                    className={
                      headerContent || !description
                        ? 'sr-only'
                        : 'min-w-0 truncate text-sm text-slate-300'
                    }
                    title={headerContent ? undefined : description}
                  >
                    {description || title}
                  </SheetDescription>
                  {/* タイトル行右端の操作要素。pr-8 で確保した余白の内側に置くため
                      絶対配置の×ボタンとは重ならない。 */}
                  {headerActions && (
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      {headerActions}
                    </div>
                  )}
                </div>

                {/* ×ボタン */}
                <button
                  type="button"
                  className="absolute top-1.5 right-4 rounded-sm p-0.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus:ring-2 focus:ring-blue-300 focus:outline-hidden"
                  onClick={onClose}
                  aria-label="閉じる"
                >
                  <XIcon className="size-5" />
                </button>
              </SheetHeader>

              {/* タイトル直下のヘッダー要素（指定時のみ）。濃い見出しの帯の下に、本体と同じ薄いグレーで置く。
                  スクロールしないため常に見える。 */}
              {headerContent && (
                <div className="border-b border-slate-200 px-6 pt-2 pb-1.5">
                  {headerContent}
                </div>
              )}

              {/* コンテンツエリア（スクロール可能・コンテナクエリ対応）。背景は薄いグレー（slate-50） */}
              <div
                ref={contentRef}
                className="@container flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-2"
              >
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

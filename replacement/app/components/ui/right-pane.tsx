import { useState, useEffect, useRef, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { XIcon, ChevronLeft, MoveHorizontal } from 'lucide-react';
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
import { requestConfirm } from './confirm-dialog';
import { BUTTON_STYLES, SCREEN_TITLE_CLASS } from '../../../styles/commonStyles';

interface RightPaneProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  description?: string;
  initialWidth?: number; // rem単位
  minWidth?: number; // rem単位
  maxWidth?: number; // rem単位
  /**
   * 折り畳み（付箋）状態。onCollapsedChange と併せて指定すると制御コンポーネントになり、
   * 親が折り畳み中かどうかを判別できる（折り畳み中に同じボタンを再押下したら閉じずに展開する等）。
   * 未指定時は RightPane 内部で状態を保持する。
   */
  collapsed?: boolean;
  /** 折り畳み状態の変更通知（collapsed と併せて指定する） */
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * 画面右端からのオフセット（rem）。複数のペインを横並びで開くときに、
   * 右隣のペインの実効幅を渡して重なりを避ける。未指定なら従来どおり右端に固定。
   */
  offsetRight?: number;
  /**
   * 実効幅（rem）の変更通知。折り畳み時は折り畳み幅を通知する。
   * 左隣に並べるペインの offsetRight を算出するために使う。
   */
  onWidthChange?: (width: number) => void;
  /**
   * フッターバーの className 追加・上書き（既定は `px-6 py-4`）。
   * 画面下部の固定フッター（`px-6 py-2`）と縦余白を揃えたいペインで `py-2` を渡す。
   */
  footerClassName?: string;
  /**
   * 未保存の入力があるか。指定すると、閉じる（×・Esc・別のペインを開く）前に破棄の確認を出す
   * （画面設計標準 3.4）。未指定なら、ペイン内で利用者が入力・変更した（input／change、コンボボックスの
   * 候補・年月日のカレンダーでの選択、入力欄の×）ことで判定する。値を元に戻しても「入力あり」のまま
   * なので、正確に判定したいペインは指定する。
   */
  dirty?: boolean;
  /** 破棄の確認を出さない（入力の無い参照用ペイン等で、自動判定を止めたいとき） */
  disableDiscardConfirm?: boolean;
}

// 折り畳み時に表示するタブの幅（rem）
const COLLAPSED_WIDTH_REM = 1.75;

export function RightPane({
  open,
  onClose,
  title,
  children,
  description,
  footer,
  initialWidth = 30,
  minWidth = 20,
  maxWidth = 60,
  collapsed,
  onCollapsedChange,
  offsetRight = 0,
  onWidthChange,
  footerClassName,
  dirty,
  disableDiscardConfirm = false,
}: RightPaneProps) {
  const [width, setWidth] = useState(initialWidth);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // collapsed/onCollapsedChange が渡された場合は親が状態を保持する（制御コンポーネント）
  const isControlled = collapsed !== undefined && onCollapsedChange !== undefined;
  const isCollapsed = isControlled ? collapsed : internalCollapsed;
  const setIsCollapsed = (next: boolean) => {
    if (isControlled) {
      onCollapsedChange(next);
    } else {
      setInternalCollapsed(next);
    }
  };
  const resizing = useRef(false);
  // ハンドル操作がドラッグ（幅調整）かクリック（折り畳みトグル）かの判定用
  const moved = useRef(false);
  const startX = useRef(0);
  // window の mouseup ハンドラから最新の折り畳み状態・更新関数を参照するための ref
  const collapseRef = useRef({ isCollapsed, setIsCollapsed });
  collapseRef.current = { isCollapsed, setIsCollapsed };

  // 開くたびに折り畳み状態をリセット
  useEffect(() => {
    if (open) collapseRef.current.setIsCollapsed(false);
  }, [open]);

  // ── 未保存の入力の破棄確認（画面設計標準 3.4）──────────────────────────
  // ×・Esc・別のペインを開いたときに、未保存の入力があれば確認してから閉じる。
  // 行の選択でペインを入れ替える画面は confirmDiscardActivePane（use-exclusive-pane）を呼ぶ。
  // dirty 未指定時は、ペイン内の input／change で「入力あり」とする（開き直し・フッターのボタン押下で解除）。
  const userEditedRef = useRef(false);
  useEffect(() => {
    if (open) userEditedRef.current = false;
  }, [open]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const markEdited = () => {
    userEditedRef.current = true;
  };
  // コンボボックスの候補・年月日部品のカレンダー（別の層に描かれる）での選択や、入力欄の×（クリア）も
  // 「入力あり」とする。React のイベントは描画先が別の層でもペインまで伝わる
  const handleClickCapture = (e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        '[role="option"], [data-radix-popper-content-wrapper] button, button[aria-label$="クリア"]'
      )
    ) {
      markEdited();
    }
  };
  const confirmClose = useCallback(async () => {
    const hasChanges = dirtyRef.current ?? userEditedRef.current;
    if (disableDiscardConfirm || !hasChanges) return true;
    const ok = await requestConfirm({
      title: '入力内容の破棄の確認',
      description: '入力中の内容は保存されていません。破棄してよろしいですか？',
      confirmLabel: '破棄',
      confirmClassName: BUTTON_STYLES.delete,
    });
    if (ok) userEditedRef.current = false;
    return ok;
  }, [disableDiscardConfirm]);
  const requestClose = async () => {
    if (await confirmClose()) onClose();
  };

  // ペインは画面で1つだけ表示する。他のペインが展開されたら自身を閉じる（未保存なら確認）。
  // 折り畳み（付箋）中は再表示の入口のため、排他の対象外。
  useExclusivePane(open && !isCollapsed, onClose, confirmClose);

  // 実効幅（折り畳み時は折り畳み幅）を親へ通知する。
  // 横並びで開く左隣のペインが、この幅を offsetRight として参照する。
  const effectiveWidth = isCollapsed ? COLLAPSED_WIDTH_REM : width;
  useEffect(() => {
    onWidthChange?.(effectiveWidth);
  }, [effectiveWidth, onWidthChange]);

  // リサイズ処理（左端ハンドルのドラッグで幅を変更）
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      // 一定以上動かしたらドラッグ（幅調整）とみなす
      if (Math.abs(e.clientX - startX.current) > 3) moved.current = true;
      // 横並び時はペインの右端が offsetRight ぶん内側にあるため、その分を差し引く
      const newWidthRem = (window.innerWidth - e.clientX) / 16 - offsetRight;
      if (newWidthRem >= minWidth && newWidthRem <= maxWidth) {
        setWidth(newWidthRem);
      }
    };

    const handleMouseUp = () => {
      if (!resizing.current) return;
      resizing.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // ドラッグせずクリックした場合は折り畳み/展開をトグル（リサイズハンドルに統合）
      if (!moved.current) {
        const { isCollapsed: current, setIsCollapsed: update } =
          collapseRef.current;
        update(!current);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth, maxWidth, offsetRight]);

  // リサイズ開始（ドラッグ中はアニメーションを無効化してカクつきを防ぐ）
  const handleResizeStart = (e: ReactMouseEvent) => {
    resizing.current = true;
    moved.current = false;
    startX.current = e.clientX;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) void requestClose();
      }}
      // modal={false}：背景オーバーレイを無くし、表示中も親画面を操作可能にする
      modal={false}
    >
      <SheetPrimitive.Portal>
        <SheetPrimitive.Content
          data-slot="sheet-content"
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-full flex-col gap-0 overflow-visible border-l border-gray-200 bg-white p-0 ease-in-out',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:duration-300 data-[state=open]:duration-500',
            isCollapsed
              ? 'pointer-events-none border-l-0 bg-transparent shadow-none'
              : 'shadow-2xl',
          )}
          style={{
            width: `${effectiveWidth}rem`,
            maxWidth: 'none',
            // 横並び時は右隣のペインの幅ぶん左へずらす（クラスの right-0 を上書き）
            right: `${offsetRight}rem`,
            // 折り畳み/展開時は幅をアニメーション。ドラッグ中は無効化。
            transitionProperty: isResizing ? 'none' : 'width, right',
            transitionDuration: isResizing ? '0ms' : '300ms',
            transitionTimingFunction: 'ease-in-out',
          }}
          // 親画面を操作してもペインを閉じない（閉じるは✕／Escのみ）
          onInteractOutside={(e) => e.preventDefault()}
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

              {/* 折り畳み時：左端中央のタブ（押下で展開） */}
              <div className="flex h-full w-full items-center">
                <button
                  type="button"
                  className="pointer-events-auto flex h-16 w-7 items-center justify-center rounded-l-lg border border-r-0 border-gray-300 bg-white text-gray-600 shadow-lg transition-colors hover:bg-blue-50 hover:text-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  onClick={() => setIsCollapsed(false)}
                  aria-label="ペインを展開"
                  title={title}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 左端リサイズハンドル（ドラッグで幅変更／ダブルクリックでリセット） */}
              <div
                className="group absolute left-0 top-0 z-10 flex h-full w-3 cursor-col-resize items-center justify-center bg-transparent transition-colors hover:bg-blue-400/15"
                onMouseDown={handleResizeStart}
                role="separator"
                aria-orientation="vertical"
                aria-label="ドラッグで幅変更／クリックで折り畳み・展開"
                title="ドラッグで幅変更 / クリックで折り畳み・展開"
              >
                {/* 1つの図形：円の中に左右矢印。ドラッグ＝幅調整／クリック＝折り畳み・展開 */}
                <span className="absolute left-0 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm transition-colors group-hover:border-blue-400 group-hover:bg-blue-50 group-hover:text-blue-600">
                  <MoveHorizontal className="h-4 w-4" />
                </span>
              </div>

              {/* ヘッダー */}
              <SheetHeader className="relative border-b border-gray-200 px-6 pt-6 pb-4">
                <div className="flex items-center gap-2 pr-8">
                  <SheetTitle className={SCREEN_TITLE_CLASS}>{title}</SheetTitle>
                </div>
                {/*
                  説明文は画面に表示しない（表示不要となったため）。
                  ただし Radix Dialog は Description を要求するため、
                  スクリーンリーダー向けに sr-only で保持する。
                */}
                <SheetDescription className="sr-only">
                  {description || title}
                </SheetDescription>

                {/* ×ボタン */}
                <button
                  type="button"
                  className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  onClick={() => void requestClose()}
                  aria-label="閉じる"
                >
                  <XIcon className="size-6" />
                </button>
              </SheetHeader>

              {/* コンテンツエリア（スクロール可能・コンテナクエリ対応） */}
              <div
                className="@container flex flex-1 flex-col overflow-y-auto px-6 py-4"
                onInputCapture={markEdited}
                onChangeCapture={markEdited}
                onClickCapture={handleClickCapture}
              >
                {children}
              </div>

              {/* フッター */}
              {footer && (
                <SheetFooter
                  // 保存・登録などフッターのボタンを押したら「入力あり」を解除する
                  onClickCapture={(e) => {
                    if ((e.target as HTMLElement).closest('button')) userEditedRef.current = false;
                  }}
                  className={cn(
                    'border-t border-gray-200 bg-white px-6 py-4',
                    footerClassName
                  )}
                >
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

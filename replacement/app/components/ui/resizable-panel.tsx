import * as React from 'react';

// ドラッグで高さを拡縮するための共通ユーティリティ。
// 集計表・明細表・拡売費計画など、複数のエリアで共通利用する。

interface UseResizableHeightOptions {
  /** 初期の高さ(px) */
  defaultHeight?: number;
  /** 最小の高さ(px) */
  minHeight?: number;
  /** 最大の高さ(px) */
  maxHeight?: number;
}

// 高さの状態とドラッグ開始ハンドラを提供するフック。
// 既存レイアウト（タブ等）に組み込みたい場合はこのフックと ResizeHandle を利用する。
export function useResizableHeight({
  defaultHeight = 500,
  minHeight = 200,
  maxHeight = 800,
}: UseResizableHeightOptions = {}) {
  const [height, setHeight] = React.useState(defaultHeight);
  const [isResizing, setIsResizing] = React.useState(false);
  const startYRef = React.useRef(0);
  const startHeightRef = React.useRef(0);

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startYRef.current = e.clientY;
      startHeightRef.current = height;
    },
    [height]
  );

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startYRef.current;
      const newHeight = startHeightRef.current + delta;
      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setHeight(newHeight);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minHeight, maxHeight]);

  return { height, isResizing, handleMouseDown };
}

interface ResizeHandleProps {
  /** ドラッグ開始ハンドラ（useResizableHeight から取得） */
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
}

// 下端に表示するドラッグハンドル。relative な親要素の中で使用する。
export function ResizeHandle({
  onMouseDown,
  className = '',
}: ResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-300 transition-colors border-t-2 border-gray-300 flex items-center justify-center ${className}`}
      title="ドラッグして高さを変更"
    >
      <div className="w-12 h-1 bg-gray-400 rounded-full" />
    </div>
  );
}

interface ResizablePanelProps {
  children: React.ReactNode;
  /** 初期の高さ(px) */
  defaultHeight?: number;
  /** 最小の高さ(px) */
  minHeight?: number;
  /** 最大の高さ(px) */
  maxHeight?: number;
  /** 外側コンテナの追加クラス名 */
  className?: string;
}

// 高さをドラッグで拡縮できるパネル。children は height:100% で内部を埋める想定。
// 単一の表（明細表・拡売費計画など）をそのまま包む用途に使う。
export function ResizablePanel({
  children,
  defaultHeight = 500,
  minHeight = 200,
  maxHeight = 800,
  className = '',
}: ResizablePanelProps) {
  const { height, handleMouseDown } = useResizableHeight({
    defaultHeight,
    minHeight,
    maxHeight,
  });

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {/* ドラッグハンドルと表が重ならないよう、下端にハンドル分の余白を確保 */}
      <div style={{ height: 'calc(100% - 1rem)', width: '100%' }}>
        {children}
      </div>
      <ResizeHandle onMouseDown={handleMouseDown} />
    </div>
  );
}

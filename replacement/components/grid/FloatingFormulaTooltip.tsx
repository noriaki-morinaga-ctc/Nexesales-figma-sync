// セルをクリックしたときに出す数式ガイドの吹き出し（全画面共通。UI/UX UX-051 → 02 §7「数式のツールチップ」）。
// 式・実値の各行は折り返さずに1行で見せる（幅は中身に合わせる）。画面の幅を超えるときだけ折り返し、
// 右端からはみ出す位置では左へずらして画面の中に収める。
import { useLayoutEffect, useRef } from 'react';

export interface FloatingFormulaTooltipValue {
  text: string;
  // セルの左下の位置（x はビューポート基準、y はページ基準＝scrollY を含む）
  x: number;
  y: number;
}

interface FloatingFormulaTooltipProps {
  tooltip: FloatingFormulaTooltipValue | null;
}

// 画面の端から空ける幅（1rem）
const EDGE_MARGIN_REM = 1;

export function FloatingFormulaTooltip({
  tooltip,
}: FloatingFormulaTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  // 描画後に幅を測り、右端からはみ出すときは左へずらす（JS の計算値のため style で指定）
  useLayoutEffect(() => {
    const el = ref.current;
    if (!tooltip || !el) return;
    const margin = EDGE_MARGIN_REM * 12.8;
    const maxLeft = window.innerWidth - el.offsetWidth - margin;
    el.style.left = `${Math.max(margin, Math.min(tooltip.x, maxLeft)) / 12.8}rem`;
  }, [tooltip]);

  if (!tooltip) return null;
  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-70 w-max max-w-[calc(100vw-2rem)] rounded-md bg-gray-800 px-2.5 py-1.5 text-xs leading-normal whitespace-pre-wrap text-gray-50 shadow-lg"
      // 表示位置のみ動的値のため inline（他は Tailwind）
      style={{
        left: tooltip.x,
        top: tooltip.y - window.scrollY,
      }}
    >
      {tooltip.text}
    </div>
  );
}

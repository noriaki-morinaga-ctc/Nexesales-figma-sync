// 別の画面へ移るだけのボタン（全画面共通。UI/UX UX-059 → 02 §6「別の画面へ移るボタン（ScreenLinkButton）」）。
// 操作ボタン（btn-toolbar-outline・btn-action-*）と見分けられるよう、両端の丸いピル型の青枠・青文字に
// 右向きの矢印（ArrowRight）を付ける。外部サイト・別タブ用のアイコン（ExternalLink）は使わない。
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

interface ScreenLinkButtonProps {
  // 移る先の画面名（例：「計画詳細(管理対象商品)」）
  children: ReactNode;
  onClick?: () => void;
  // 追加クラス（余白の調整など。色・形は指定しない）
  className?: string;
}

export function ScreenLinkButton({
  children,
  onClick,
  className = '',
}: ScreenLinkButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1 rounded-full border border-blue-600 bg-white px-3 text-sm whitespace-nowrap text-blue-600 transition-colors hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`}
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

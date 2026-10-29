import type { ReactNode } from 'react';
import { CARD_TITLE_CLASS } from '../../../../../styles/commonStyles';

interface CardHeaderProps {
  // 見出し先頭のアイコン（lucide）
  icon: ReactNode;
  title: string;
  // 見出し右側に置く補足（件数・ステータスバッジ等）
  right?: ReactNode;
}

// カード見出し（→ 05「カードヘッダー（アイコン＋見出し）」）
export function CardHeader({ icon, title, right }: CardHeaderProps) {
  return (
    <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className={CARD_TITLE_CLASS}>{title}</h2>
      </div>
      {right != null &&
        (typeof right === 'string' || typeof right === 'number' ? (
          <span className="text-xs text-gray-500">{right}</span>
        ) : (
          right
        ))}
    </div>
  );
}

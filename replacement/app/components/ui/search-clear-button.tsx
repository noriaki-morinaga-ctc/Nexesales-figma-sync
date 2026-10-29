import { RotateCcw } from 'lucide-react';
import { BUTTON_BASE, BUTTON_STYLES } from '../../../styles/commonStyles';

interface SearchClearButtonProps {
  // 検索条件を初期値へ戻す処理
  onClick: () => void;
  // 非活性（検索条件自体が操作できない状態など）
  disabled?: boolean;
}

// 検索条件カードのクリアボタン（画面共通）。
// 専用の行を使わず、検索条件カードのヘッダーバー（CollapsibleCard の headerActions）に置く。
// 検索はリアルタイムのため検索ボタンは設けず、このボタンだけを置く。
export function SearchClearButton({
  onClick,
  disabled = false,
}: SearchClearButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 px-2 py-1 whitespace-nowrap text-sm ${
        disabled ? BUTTON_STYLES.disabled : BUTTON_STYLES.cancel
      } ${BUTTON_BASE}`}
    >
      <RotateCcw className="h-4 w-4" />
      クリア
    </button>
  );
}

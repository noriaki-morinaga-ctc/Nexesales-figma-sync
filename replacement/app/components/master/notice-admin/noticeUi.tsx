import type { CustomCellRendererProps } from 'ag-grid-react';
import { SquarePen, Copy } from 'lucide-react';
import { Badge } from '../../ui/badge';
import {
  type DisplayStatus,
  type NoticeItem,
  DISPLAY_STATUS_LABEL,
  displayStatus,
} from './noticeStore';

// ===== お知らせメンテ画面の UI 定数・共通表示・AG Grid セルレンダラ =====

// タイトルの入力上限（文字数）
export const TITLE_MAX = 50;

// 種別の表示設定。バッジを付けるのは「重要」のみ（badge なし＝バッジ非表示）
export const TYPE_CONFIG: Record<
  NoticeItem['type'],
  { label: string; badge?: string }
> = {
  important: { label: '重要', badge: 'bg-orange-700' },
  notice: { label: 'お知らせ' },
};

// 種別バッジの見た目（ui/badge に重ねる）。グリッド・入力欄・プレビューで同じ形にする。色は TYPE_CONFIG の badge
export const NOTICE_TYPE_BADGE_CLASS =
  'rounded-full border-transparent font-bold text-white';

// 状態（派生ステータス）のドット色
export const STATUS_DOT: Record<DisplayStatus, string> = {
  draft: 'bg-gray-400',
  scheduled: 'bg-blue-500',
  open: 'bg-green-500',
  ended: 'bg-gray-300',
  withdrawn: 'bg-orange-500',
};

// ===== ステータス表示（ドット＋ラベル） =====
interface StatusIndicatorProps {
  ds: DisplayStatus;
}

export function StatusIndicator({ ds }: StatusIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
      <span
        className={`w-2 h-2 rounded-full ${STATUS_DOT[ds]}`}
        aria-hidden="true"
      />
      {DISPLAY_STATUS_LABEL[ds]}
    </span>
  );
}

// AG Grid 操作列のハンドラ（context 経由で受け渡し）
// 削除は編集画面へ集約したため、一覧操作列は編集・複製のみ。
export interface NoticeGridContext {
  onEdit: (n: NoticeItem) => void;
  onDup: (n: NoticeItem) => void;
}

// ===== AG Grid セルレンダラ =====
// セル内の縦中央寄せは、レンダラのルートを h-full＋flex items-center にして行う（cellStyle の flex は使わない → 02 §7）。
export function StatusCellRenderer(p: CustomCellRendererProps<NoticeItem>) {
  if (!p.data) return null;
  return (
    <div className="flex items-center h-full">
      <StatusIndicator ds={displayStatus(p.data)} />
    </div>
  );
}

export function TypeBadgeRenderer(p: CustomCellRendererProps<NoticeItem>) {
  // 列の value はフィルタ用ラベルに差し替えているため、種別は行データから直接参照する
  const cfg = TYPE_CONFIG[p.data?.type ?? 'notice'];
  if (!cfg.badge) return null;
  return (
    // バッジは flex 親の中で縦横中央に置き、行の高さに引き伸ばされないようにする
    <div className="flex items-center justify-center h-full">
      <Badge className={`${NOTICE_TYPE_BADGE_CLASS} ${cfg.badge}`}>
        {cfg.label}
      </Badge>
    </div>
  );
}

export function ActionCellRenderer(
  p: CustomCellRendererProps<NoticeItem, unknown, NoticeGridContext>
) {
  const n = p.data;
  const c = p.context;
  if (!n) return null;
  return (
    <div className="flex items-center gap-1 h-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          c?.onEdit?.(n);
        }}
        className="p-1.5 rounded text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="編集"
        aria-label={`「${n.title}」を編集`}
      >
        <SquarePen className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          c?.onDup?.(n);
        }}
        className="p-1.5 rounded text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="複製"
        aria-label={`「${n.title}」を複製`}
      >
        <Copy className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

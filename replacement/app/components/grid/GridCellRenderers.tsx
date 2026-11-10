// グリッドの共通セル部品（画面ごとに同じ形で作っていたものを集約 → 02 §12.2）。
// 画面ごとの違いは列定義の cellRendererParams、操作は グリッドの context で受け取る。
import type { ComponentType } from 'react';
import type { CustomCellRendererProps } from 'ag-grid-react';
import { Copy, Trash2 } from 'lucide-react';

// ── ステータス（アイコン＋文言） ─────────────────────────────
// 一覧のステータス列。値ごとのアイコンと色は画面の STATUS_CONFIG を cellRendererParams.statusConfig で渡す
// （色は 01「ステータスアイコンの色」）。設定に無い値は文言だけを出す。
export interface StatusIconConfig {
  icon: ComponentType<{ className?: string }>;
  className: string;
}
interface StatusIconCellRendererParams {
  statusConfig: Record<string, StatusIconConfig>;
}
export function StatusIconCellRenderer(
  props: CustomCellRendererProps & StatusIconCellRendererParams
) {
  const config = props.statusConfig[props.value as string];
  if (!config) {
    return <span className="text-gray-900">{props.value}</span>;
  }
  const Icon = config.icon;
  // 列幅を締めた際にテキストを3点リーダで省略するため、
  // アイコンは縮小不可（flex-shrink-0）、文言は truncate（overflow-hidden + ellipsis）にする。
  // 縦中央寄せはAG Grid標準（.ag-cell-wrapper）で自動。
  return (
    <div className="flex items-center gap-1 overflow-hidden">
      <Icon className={`h-5 w-5 flex-shrink-0 ${config.className}`} />
      <span className="text-gray-900 truncate">{props.value}</span>
    </div>
  );
}

// ── 行のコピー（コピーボタン1つ） ─────────────────────────────
// 参照一覧の行を明細へコピーする。ボタンの名前は cellRendererParams.label、
// 押したときの処理はグリッドの context.onCopyRow(行) で受け取る。
interface CopyRowCellRendererParams {
  label: string;
}
export function CopyRowCellRenderer(
  props: CustomCellRendererProps & CopyRowCellRendererParams
) {
  const { onCopyRow } = props.context;
  return (
    <div className="flex items-center justify-center h-full">
      <button
        className="text-green-600 hover:text-green-800 p-1"
        onClick={() => onCopyRow(props.data)}
        title={props.label}
        aria-label={props.label}
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── 行のコピー・削除（ボタン2つ） ───────────────────────────
// 明細の行をコピー・削除する。押したときの処理はグリッドの context.onCopy(行)／onDelete(行)。
// cellRendererParams.isHidden(行) が true の行はボタンを出さない（合計行・固定の行など）。
// cellRendererParams.deleteDisabledReason(行) が文字を返す行は削除できない（理由をツールチップに出す）。
interface CopyDeleteCellRendererParams {
  isHidden?: (row: unknown) => boolean;
  deleteDisabledReason?: (row: unknown) => string | null;
}
export function CopyDeleteCellRenderer(
  props: CustomCellRendererProps & CopyDeleteCellRendererParams
) {
  if (props.isHidden?.(props.data)) {
    return null;
  }
  const { onDelete, onCopy } = props.context;
  const disabledReason = props.deleteDisabledReason?.(props.data) ?? null;
  return (
    <div className="flex items-center justify-center gap-2 h-full">
      <button
        className="text-green-600 hover:text-green-800 p-1"
        onClick={() => onCopy(props.data)}
        title="コピー"
        aria-label="コピー"
      >
        <Copy className="w-4 h-4" />
      </button>
      <button
        onClick={disabledReason ? undefined : () => onDelete(props.data)}
        disabled={!!disabledReason}
        className={`p-1 rounded transition-colors ${
          disabledReason
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-red-600 hover:text-red-800 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:outline-none'
        }`}
        title={disabledReason ?? '削除'}
        aria-label="削除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

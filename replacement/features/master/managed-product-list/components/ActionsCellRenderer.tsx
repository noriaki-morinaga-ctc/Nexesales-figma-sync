import { SquarePen, Trash2 } from 'lucide-react';
import type { ICellRendererParams } from 'ag-grid-community';

// アクションセルレンダラー
export const ActionsCellRenderer = (props: ICellRendererParams) => {
  const { onEditRow, onDeleteRow } = props.context;

  if (!props.data) return null;

  const handleEdit = () => {
    onEditRow(props.data);
  };

  const handleDelete = () => {
    onDeleteRow(props.data);
  };

  return (
    <div className="flex h-full items-center justify-center gap-1">
      <button
        onClick={handleEdit}
        className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
        aria-label="更新"
        title="更新"
      >
        <SquarePen className="w-4 h-4" />
      </button>
      <button
        onClick={handleDelete}
        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none"
        aria-label="削除"
        title="削除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

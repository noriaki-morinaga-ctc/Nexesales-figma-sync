// 支払詳細(自販機)：RowMenuCellRenderer（セルの部品）
import { Trash2, Copy, Split } from 'lucide-react';
import { ICellRendererParams } from 'ag-grid-community';
import { RowActionMenu } from '@/components/grid';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { isSplitDestRow } from '@/features/payment/payment-detail-vending/utilsRows';

// 行の操作（分割・コピー・削除）を、手売りの支払詳細と同じ「︙」のメニュー（共通部品 RowActionMenu）で出す
// （画面設計標準・UI/UX UX-087 → 02 §7「行の操作」）。
// ・分割は経費明細グリッドだけ（ロケ契約料前払金グリッドでは showSplit=false で出さない）。
//   分割先の行は分割できないため非活性にする。
const ACTIVE = 'text-blue-600 focus:text-blue-600';
const DISABLED = 'text-gray-400';

export const RowMenuCellRenderer = (props: ICellRendererParams) => {
  if (!props.data) return null;
  const { showSplit, onSplitRow, onCopyRow, onDeleteRow } = props.context;
  const splitDisabled = isSplitDestRow(props.data);

  return (
    <RowActionMenu>
      {showSplit && (
        <DropdownMenuItem
          onClick={splitDisabled ? undefined : () => onSplitRow(props.data)}
          disabled={splitDisabled}
          className={splitDisabled ? DISABLED : ACTIVE}
        >
          <Split
            className={`h-4 w-4 ${splitDisabled ? 'text-gray-400' : 'text-blue-600'}`}
          />
          分割
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        onClick={() => onCopyRow(props.data)}
        className="text-green-600 focus:text-green-600"
      >
        <Copy className="h-4 w-4 text-green-600" />
        コピー
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => onDeleteRow(props.data)}
        className="text-red-600 focus:text-red-600"
      >
        <Trash2 className="h-4 w-4 text-red-600" />
        削除
      </DropdownMenuItem>
    </RowActionMenu>
  );
};

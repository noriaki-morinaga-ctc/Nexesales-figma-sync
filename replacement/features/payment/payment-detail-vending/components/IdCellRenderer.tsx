// 支払詳細(自販機)：IdCellRenderer（セルの部品）
import { ICellRendererParams } from 'ag-grid-community';

// No. 列のレンダラー。分割の開閉ボタンは専用の列（SplitCollapseCells）に移した（→ UI/UX UX-088）。
export const IdCellRenderer = (props: ICellRendererParams) => {
  if (!props.data) return null;
  return <span>{(props.value as string) ?? ''}</span>;
};

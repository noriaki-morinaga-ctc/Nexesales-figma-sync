// 支払詳細(自販機)：分割の開閉の列（見出し・セルの部品）
// 手売りの支払詳細の拡売費の表（BranchCollapseHeader・BranchCollapseCellRenderer）と同じ形にする（UI/UX UX-088）。
// ・専用の列（No. の左）に、分割先を持つ分割元の行だけ開閉ボタン（ChevronDown。∨＝閉じている／∧＝開いている）を出す
// ・見出しの分割（Split）のアイコンで、分割先をまとめて開閉する（全部開いていれば全部閉じる、それ以外は全部開く）。
//   分割先が1件も無いときは非活性（灰）
import { ChevronDown, Split } from 'lucide-react';
import type { ICellRendererParams, IHeaderParams } from 'ag-grid-community';
import type { ExpenseItemData } from '@/app/components/payment/payment-detail-vending/paymentDetailVending.types';
import { hasSplitDestRows } from '@/app/components/payment/payment-detail-vending/utilsRows';

interface SplitCollapseContext {
  collapsedSplitGroups?: string[];
  onToggleSplitGroup?: (sourceId: string) => void;
  // 指定の分割元をまとめて閉じる（collapse=true）／開く（false）
  onSetSplitGroupsCollapsed?: (sourceIds: string[], collapse: boolean) => void;
}

// 分割先を持つ分割元の行の id
const splitSourceIdsOf = (api: IHeaderParams['api']): string[] => {
  const sources = new Set<string>();
  const dests = new Set<string>();
  api.forEachNode((node) => {
    const data = node.data as ExpenseItemData | undefined;
    if (data?.splitRole === 'source') sources.add(data.id);
    if (data?.splitRole === 'dest' && data.splitGroupId)
      dests.add(data.splitGroupId);
  });
  return [...sources].filter((id) => dests.has(id));
};

export const SplitCollapseHeader = (props: IHeaderParams) => {
  // 見出しは作ったときの params を持ち続けるため、AG Grid 公式の getGridOption で最新の context を読む
  const ctx = (props.api.getGridOption('context') ??
    props.context ??
    {}) as SplitCollapseContext;
  const ids = splitSourceIdsOf(props.api);
  const enabled = ids.length > 0 && !!ctx.onSetSplitGroupsCollapsed;
  const expanded =
    enabled && ids.every((id) => !ctx.collapsedSplitGroups?.includes(id));
  const action = `分割先を全て${expanded ? '折りたたむ' : '展開'}`;
  return (
    <div className="flex h-full w-full items-center justify-start">
      <button
        type="button"
        disabled={!enabled}
        onClick={() => ctx.onSetSplitGroupsCollapsed?.(ids, expanded)}
        className={`flex h-5 w-5 items-center justify-center rounded focus:ring-2 focus:ring-blue-500 focus:outline-none ${
          enabled
            ? 'text-blue-600 hover:bg-gray-200'
            : 'cursor-not-allowed text-gray-400'
        }`}
        aria-expanded={expanded}
        aria-label={enabled ? action : '分割先なし'}
        title={enabled ? action : '分割先なし'}
      >
        <Split className="h-4 w-4" />
      </button>
    </div>
  );
};

export const SplitCollapseCellRenderer = (props: ICellRendererParams) => {
  const data = props.data as ExpenseItemData | undefined;
  if (!data || data.splitRole !== 'source') return null;
  const ctx = (props.context ?? {}) as SplitCollapseContext;
  if (!ctx.onToggleSplitGroup || !hasSplitDestRows(props.api, data.id))
    return null;
  const collapsed = ctx.collapsedSplitGroups?.includes(data.id) ?? false;
  return (
    <div className="flex h-full items-center justify-center">
      <button
        type="button"
        onClick={() => ctx.onToggleSplitGroup?.(data.id)}
        className="flex h-5 w-5 items-center justify-center rounded text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        aria-expanded={!collapsed}
        aria-label={`分割先を${collapsed ? '展開' : '折りたたむ'}`}
        title={`分割先を${collapsed ? '展開' : '折りたたむ'}`}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
        />
      </button>
    </div>
  );
};

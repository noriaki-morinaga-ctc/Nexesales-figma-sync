import type { GridApi } from 'ag-grid-community';
import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BUTTON_BASE, BUTTON_STYLES } from '@/styles/commonStyles';

interface ExpandCollapseButtonProps {
  // 開閉するグリッドの API（onGridReady で受け取る。準備前は null）
  api: GridApi | null;
}

// 子を持つ行がすべて開いているか（子を持つ行が無ければ false）
function isAllExpanded(api: GridApi): boolean {
  let hasParent = false;
  let isAllOpen = true;
  api.forEachNode((node) => {
    if ((node.allChildrenCount ?? 0) <= 0) return;
    hasParent = true;
    if (!node.expanded) isAllOpen = false;
  });
  return hasParent && isAllOpen;
}

// 集計表のトグルを一括で開閉するボタン（10/27 第4回 決定事項13・14）。
// 1つのボタンで、閉じた行があれば「全展開」、すべて開いていれば「折り畳み」に切り替わる。
export function ExpandCollapseButton({ api }: ExpandCollapseButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 行ごとの開閉・一括の開閉・行の作り直しのたびに表示を合わせる（AG Grid 公式イベント）
  useEffect(() => {
    if (!api) return;
    const handleSync = () => {
      if (!api.isDestroyed()) setIsExpanded(isAllExpanded(api));
    };
    handleSync();
    api.addEventListener('rowGroupOpened', handleSync);
    api.addEventListener('expandOrCollapseAll', handleSync);
    api.addEventListener('modelUpdated', handleSync);
    return () => {
      if (api.isDestroyed()) return;
      api.removeEventListener('rowGroupOpened', handleSync);
      api.removeEventListener('expandOrCollapseAll', handleSync);
      api.removeEventListener('modelUpdated', handleSync);
    };
  }, [api]);

  const handleClick = () => {
    if (!api) return;
    if (isExpanded) {
      api.collapseAll();
    } else {
      api.expandAll();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${BUTTON_STYLES.cancel} ${BUTTON_BASE} flex items-center gap-1 px-2 py-1 text-sm`}
    >
      {isExpanded ? (
        <Minus className="h-4 w-4" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      {isExpanded ? '折り畳み' : '全展開'}
    </button>
  );
}

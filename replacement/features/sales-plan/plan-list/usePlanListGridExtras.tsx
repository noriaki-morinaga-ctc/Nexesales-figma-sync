import { useMemo } from 'react';

import { planListMenus } from './planListContextMenu';
import { useCellHoverCopy } from './useCellHoverCopy';

// 計画一覧のグリッドに足す試作（UI/UX 確認用モックのコメント #21・#22）。
// ・セル・見出しの右クリックメニューにフィルタの解除を足す（→ ./planListContextMenu）
// ・セルにマウスを乗せるとコピーのボタンを出す（→ ./useCellHoverCopy）
// gridProps を <AgGridReact> に spread し、overlay をグリッドの近くに置く。
export function usePlanListGridExtras(jihanki: boolean) {
  const hoverCopy = useCellHoverCopy();
  const gridProps = useMemo(
    () => ({
      ...hoverCopy.gridProps,
      ...planListMenus(jihanki),
    }),
    [hoverCopy.gridProps, jihanki]
  );
  return { gridProps, overlay: hoverCopy.overlay };
}

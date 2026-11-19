import type {
  Column,
  DefaultMenuItem,
  GetContextMenuItemsParams,
  GetMainMenuItemsParams,
  GridApi,
  MenuItemDef,
} from 'ag-grid-community';

import { gridFilterContextMenuItems } from '@/components/grid';

// 計画一覧の右クリックメニュー（試作。UI/UX 確認用モックのコメント #21「コンテキストメニューでフィルター解除」）。
// 「この列のフィルタを解除」「すべてのフィルタを解除」を次の2か所に足す。
//   ・セルの右クリック：共通の gridFilterContextMenuItems（フィルタ・コピー・エクスポート）の「フィルタ」のすぐ下
//   ・見出しの右クリック（列のメニュー）：標準の「列フィルター」のすぐ下
// ・AG Grid の標準項目（DefaultMenuItem）にフィルタの解除は無いため、項目は MenuItemDef で作り、
//   解除は公式 API（setColumnFilterModel／setFilterModel）で行う。
// ・解除するものが無いときは灰色（disabled）にして、項目の場所は変えない。
// ・自販機（実績登録）モードの作成パターンの絞り込みは画面が掛けているものなので解除しない（lockedColIds）。
// ※ 計画一覧だけの試作のため共通関数は変えない。全画面で使うと決まったら grid/ の共通設定へ移す。

type MenuItem = DefaultMenuItem | MenuItemDef;

const CLEAR_ICON = '<span class="ag-icon ag-icon-cancel"></span>';

/** フィルタの解除の2項目 */
const buildClearItems = (
  api: GridApi,
  column: Column | null | undefined,
  lockedColIds: readonly string[]
): MenuItem[] => {
  const colId = column?.getColId();
  const model = api.getFilterModel();
  const clearableColIds = Object.keys(model).filter(
    (id) => !lockedColIds.includes(id)
  );
  const canClearColumn =
    !!colId &&
    !lockedColIds.includes(colId) &&
    !!column?.isFilterAllowed() &&
    column.isFilterActive();
  return [
    {
      name: 'この列のフィルタを解除',
      icon: CLEAR_ICON,
      disabled: !canClearColumn,
      action: () => {
        if (!colId) return;
        void api
          .setColumnFilterModel(colId, null)
          .then(() => api.onFilterChanged());
      },
    },
    {
      name: 'すべてのフィルタを解除',
      icon: CLEAR_ICON,
      disabled: clearableColIds.length === 0,
      // 解除しない列（lockedColIds）の絞り込みだけを残す
      action: () =>
        api.setFilterModel(
          Object.fromEntries(
            Object.entries(model).filter(([id]) => lockedColIds.includes(id))
          )
        ),
    },
  ];
};

/** items の中の isAnchor に当たる項目のすぐ下に added を入れる（無ければ先頭に区切り線を付けて入れる） */
const insertAfter = (
  items: MenuItem[],
  added: MenuItem[],
  isAnchor: (item: MenuItem) => boolean
): MenuItem[] => {
  const index = items.findIndex(isAnchor);
  if (index < 0) return [...added, 'separator', ...items];
  return [...items.slice(0, index + 1), ...added, ...items.slice(index + 1)];
};

const createPlanListMenus = (lockedColIds: readonly string[]) => ({
  // セルの右クリック：「フィルタ」のすぐ下
  getContextMenuItems: (params: GetContextMenuItemsParams): MenuItem[] =>
    insertAfter(
      gridFilterContextMenuItems(params),
      buildClearItems(params.api, params.column, lockedColIds),
      (item) => typeof item === 'object' && item.name === 'フィルタ'
    ),
  // 見出しの右クリック（列のメニュー）：「列フィルター」のすぐ下
  getMainMenuItems: (params: GetMainMenuItemsParams): MenuItem[] =>
    insertAfter(
      [...params.defaultItems],
      buildClearItems(params.api, params.column, lockedColIds),
      (item) => item === 'columnFilter'
    ),
});

const PLAN_LIST_MENUS = createPlanListMenus([]);
// 自販機の実績登録モードは、作成パターンの絞り込みを残す
const PLAN_LIST_JIHANKI_MENUS = createPlanListMenus(['tradeSystem']);

/** 計画一覧の getContextMenuItems・getMainMenuItems（jihanki＝自販機の実績登録モード） */
export const planListMenus = (jihanki: boolean) =>
  jihanki ? PLAN_LIST_JIHANKI_MENUS : PLAN_LIST_MENUS;

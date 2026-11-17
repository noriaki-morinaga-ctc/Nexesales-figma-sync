// aggregationTree（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import type {
  AggTreeNode,
  AggTreeNodeRef,
  AggTreeRow,
  AggregationView,
  DisplayVisibility,
  FlattenOptions,
} from '@/types/aggregation';
import {
  AGGREGATION_ITEMS_BY_ID,
  AGGREGATION_TREE,
} from '@/constants/aggregationTree';

// ノードの指定ビューでの可視性を解決する。
//   1) visibility（補助ノードの明示指定）
//   2) itemId 経由の 30項目マスタ
//   3) どちらも無ければ 'always'（構造ノード）
const resolveVisibility = (
  node: AggTreeNode,
  view: AggregationView,
  labelVisibility: (itemId: number, view: AggregationView) => DisplayVisibility
): DisplayVisibility => {
  if (node.visibility && node.visibility[view]) {
    return node.visibility[view] as DisplayVisibility;
  }
  if (node.itemId != null) return labelVisibility(node.itemId, view);
  return 'always';
};

// 既定の可視性解決（30項目マスタ直参照）
const defaultVisibilityOf = (
  itemId: number,
  view: AggregationView
): DisplayVisibility => {
  // id から項目を引く（label 経由のマスタ関数しか無いため線形探索は避け、id 一致で解決）
  const item = AGGREGATION_ITEMS_BY_ID.get(itemId);
  return item ? item.visibility[view] : 'always';
};

// 木を treeData 行へフラット化する。
// 可視性ルール：〇=常時表示 / △=shownOptionalIds に含まれる時のみ表示 / ×=非表示。
// 親が非表示なら子孫も出さない。
export const flattenAggregationTree = (
  view: AggregationView,
  options: FlattenOptions = {}
): AggTreeRow[] => {
  const shown = options.shownOptionalIds ?? new Set<number>();
  const visibilityOf = options.visibilityOf ?? defaultVisibilityOf;
  const rows: AggTreeRow[] = [];

  const isVisible = (node: AggTreeNode): boolean => {
    const vis = resolveVisibility(node, view, visibilityOf);
    if (vis === 'hidden') return false;
    if (vis === 'optional') {
      // itemId を持つ △ は＋ボタンの選択に従う。補助ノード（itemId 無し）は常時表示扱い。
      if (node.itemId == null) return true;
      return shown.has(node.itemId);
    }
    return true; // always
  };

  const walk = (nodes: AggTreeNode[], parentPath: string[], level: number) => {
    nodes.forEach((node) => {
      if (!isVisible(node)) return;
      const path = [...parentPath, node.key];
      const visibleChildren = (node.children ?? []).filter(isVisible);
      rows.push({
        key: node.key,
        label: node.label,
        itemId: node.itemId,
        level,
        hierarchyPath: path,
        hasChildren: visibleChildren.length > 0,
        descendantCount: visibleChildren.length,
        note: node.note,
      });
      if (visibleChildren.length > 0) {
        walk(node.children ?? [], path, level + 1);
      }
    });
  };

  walk(AGGREGATION_TREE, [], 0);
  return rows;
};

// 指定ビューで△（＋ボタン切替対象）となる itemId の一覧（表示切替UIの対象）。
export const getOptionalItemIds = (
  view: AggregationView,
  visibilityOf: (
    itemId: number,
    view: AggregationView
  ) => DisplayVisibility = defaultVisibilityOf
): number[] => {
  const ids: number[] = [];
  const walk = (nodes: AggTreeNode[]) => {
    nodes.forEach((node) => {
      if (
        node.itemId != null &&
        visibilityOf(node.itemId, view) === 'optional'
      ) {
        ids.push(node.itemId);
      }
      if (node.children) walk(node.children);
    });
  };
  walk(AGGREGATION_TREE);
  return ids;
};

// 可視性（〇/△/×）を無視して木の全ノードをフラットに返す。
// 計算式ツールチップの実値行は、画面に出ていない算出元の値も表示するため、
// 全ノードの値を引けるようにする用途で使う（表示行の生成には使わない）。
// 木を再帰して { key, label, itemId } だけを集める単純な処理であり、
// level・hierarchyPath・hasChildren・descendantCount のような表示専用メタ情報は持たない。
export const flattenAllTreeNodes = (): AggTreeNodeRef[] => {
  const refs: AggTreeNodeRef[] = [];
  const walk = (nodes: AggTreeNode[]) => {
    nodes.forEach((node) => {
      refs.push({ key: node.key, label: node.label, itemId: node.itemId });
      if (node.children) walk(node.children);
    });
  };
  walk(AGGREGATION_TREE);
  return refs;
};

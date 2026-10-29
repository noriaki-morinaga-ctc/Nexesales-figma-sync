// 集計表の「表示項目」ドリルダウン木 ─ 課題0623
// 資料 XLSX「各項目_折りたたみ表示」シートに準拠した、集計系テーブル共通の階層構造。
// すべての集計系テーブル（販売計画集計の詳細/年間、シミュレーション集計の詳細＋各卸版）は
// この木を AG Grid の treeData（getDataPath）へ流し込み、chevron＋件数付きドリルダウンで描画する。
//
// 各ノードは可能な範囲で 30項目マスタ（aggregationDisplayItems.ts）の id に対応づけ、
// 表示可否（〇/△/×）と数値の引き当てをその id 経由で行う。
// 木にしか存在しない補助ノード（CF込金額 等）は itemId を持たず、visibility を明示する。

import type {
  AggregationView,
  DisplayVisibility,
} from './aggregationDisplayItems';
import { AGGREGATION_DISPLAY_ITEMS } from './aggregationDisplayItems';

export interface AggTreeNode {
  // 木内で一意なキー（hierarchyPath の要素に使う）
  key: string;
  // 表示ラベル（資料の「金額」「率」「函単価」等の総称ラベルを含む）
  label: string;
  // 対応する 30項目マスタの id（数値・可視性の引き当て元）。補助ノードは未指定。
  itemId?: number;
  // itemId を持たない補助ノードの可視性（ビュー別）。省略時は親に追従。
  visibility?: Partial<Record<AggregationView, DisplayVisibility>>;
  // 項目のマウスオーバーで表示する注記（例：納品金額の NO_DELIVERY_PRICE_NOTE）
  note?: string;
  children?: AggTreeNode[];
}

// 売上高単価の表示ラベル。量経追加口だけを控除した特殊な指標のため、項目名に括弧書きで計算式を出す
//（10/16 手売りセッション 決定事項15・16）。年間計画集計（AnnualTotalTab）でも同じラベルを使う。
// 納価が未入力の明細は納品金額を0として集計する（加算しない）ことの注記（課題1815・補足3-1 No.40）。
// NET固定など納価の入力が任意の計画では一部の明細だけの合計になるため、マウスオーバーで表示する。
export const NO_DELIVERY_PRICE_NOTE = '※納価未入力の行は計算されません';

export const SALES_UNIT_PRICE_LABEL =
  '売上高単価（(社外売上高−量経追加口)÷函数）';

// 親項目配下の「金額」子ノードは親と同じ itemId＝同じ値を出す重複行のため、
// 計画詳細の詳細タブ（monthlyDetail）とシミュレーション集計（simulation）では表示しない。
// 年間集計（annual）は従来どおり表示する。
const AMOUNT_NODE_VISIBILITY: Partial<
  Record<AggregationView, DisplayVisibility>
> = { monthlyDetail: 'hidden', simulation: 'hidden' };

// 資料「各項目_折りたたみ表示」の階層をそのまま定義。
// 親（chevron＋件数）→子（＞なし）→孫（＞＞）の3階層まで。
export const AGGREGATION_TREE: AggTreeNode[] = [
  { key: 'func', label: '函数', itemId: 1 },
  {
    key: 'sales',
    label: '売上高',
    itemId: 2,
    children: [
      { key: 'externalSales', label: '社外売上高', itemId: 3 },
      { key: 'salesUnitPrice', label: SALES_UNIT_PRICE_LABEL, itemId: 6 },
      { key: 'condition', label: '条件口', itemId: 15 },
    ],
  },
  {
    key: 'volumeAdd',
    label: '量経追加口',
    itemId: 10,
    children: [
      {
        key: 'volumeAdd.amount',
        label: '金額',
        itemId: 10,
        visibility: AMOUNT_NODE_VISIBILITY,
      },
      { key: 'volumeAdd.rate', label: '率', itemId: 11 },
      // 資料の木にのみ存在する補助ノード（CF込）。CF込率(id12)に可視性を合わせる。
      {
        key: 'volumeAdd.cfAmount',
        label: 'CF込金額',
        visibility: { monthlyChart: 'hidden' },
      },
      { key: 'volumeAdd.cfRate', label: 'CF込率', itemId: 12 },
    ],
  },
  {
    key: 'promoTotal',
    label: '拡売費（売上連動拡売費＋直接固定費）',
    itemId: 30,
    children: [
      {
        key: 'promoLinked',
        label: '売上連動拡売費',
        itemId: 13,
        children: [
          {
            key: 'promoLinked.amount',
            label: '金額',
            itemId: 13,
            visibility: AMOUNT_NODE_VISIBILITY,
          },
          { key: 'promoLinked.rate', label: '率', itemId: 14 },
        ],
      },
      {
        key: 'promoFixed',
        label: '直接固定費',
        itemId: 26,
        children: [
          { key: 'promoFixed.expense', label: '拡売費(固定費)', itemId: 27 },
          { key: 'promoFixed.vending', label: '自販機関係費', itemId: 28 },
        ],
      },
    ],
  },
  {
    key: 'cost',
    label: '売上原価',
    itemId: 16,
    children: [
      {
        key: 'cost.amount',
        label: '金額',
        itemId: 16,
        visibility: AMOUNT_NODE_VISIBILITY,
      },
      { key: 'cost.rate', label: '率', itemId: 17 },
    ],
  },
  {
    key: 'grossProfit',
    label: '売上総利益',
    itemId: 18,
    children: [
      {
        key: 'grossProfit.amount',
        label: '金額',
        itemId: 18,
        visibility: AMOUNT_NODE_VISIBILITY,
      },
      { key: 'grossProfit.rate', label: '率', itemId: 19 },
    ],
  },
  {
    key: 'variableCost',
    label: '変動費（CF/ロケ補填）',
    itemId: 20,
    children: [
      { key: 'variableCost.centerFee', label: 'センターフィ', itemId: 21 },
      { key: 'variableCost.locationSupport', label: 'ロケ補填', itemId: 22 },
    ],
  },
  {
    key: 'tradeProfit',
    label: '売買差益',
    itemId: 23,
    children: [
      {
        key: 'tradeProfit.amount',
        label: '金額',
        itemId: 23,
        visibility: AMOUNT_NODE_VISIBILITY,
      },
      { key: 'tradeProfit.rate', label: '率', itemId: 24 },
      { key: 'tradeProfit.unitPrice', label: '函単価', itemId: 25 },
    ],
  },
  {
    key: 'mgmtProfit',
    label: '管理利益',
    itemId: 4,
    children: [
      {
        key: 'mgmtProfit.amount',
        label: '金額',
        itemId: 4,
        visibility: AMOUNT_NODE_VISIBILITY,
      },
      { key: 'mgmtProfit.rate', label: '率', itemId: 5 },
      { key: 'mgmtProfit.unitPrice', label: '函単価', itemId: 29 },
    ],
  },
  {
    key: 'salesDiscount',
    label: '売上値引',
    itemId: 8,
    children: [
      {
        key: 'salesDiscount.amount',
        label: '金額',
        itemId: 8,
        visibility: AMOUNT_NODE_VISIBILITY,
      },
      { key: 'salesDiscount.rate', label: '率', itemId: 9 },
    ],
  },
  {
    key: 'delivery',
    label: '納品金額',
    itemId: 7,
    note: NO_DELIVERY_PRICE_NOTE,
  },
];

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

// treeData 用のフラット行（描画側はこの配列を rowData に渡す）
export interface AggTreeRow {
  key: string;
  label: string;
  itemId?: number;
  level: number;
  hierarchyPath: string[];
  hasChildren: boolean;
  // 折りたたみ時に表示する直下の可視子ノード数
  descendantCount: number;
  // 項目のマウスオーバーで表示する注記
  note?: string;
}

// 木のノード参照（key / label / itemId のみ）。
// 計算式ツールチップの実値行のように、可視性に依らずノードの値だけを引きたい用途で使う。
// 表示行（AggTreeRow）とは別物で、level・hierarchyPath・hasChildren・descendantCount は持たない
// （これらは「可視な子」を前提にした表示専用の意味論のため、可視性を無視する用途に持たせない）。
export type AggTreeNodeRef = Pick<AggTreeRow, 'key' | 'label' | 'itemId'>;

export interface FlattenOptions {
  // △（optional）項目のうち、＋ボタンで表示ONにされている itemId 集合
  shownOptionalIds?: Set<number>;
  // itemId→ビュー別可視性を返す関数（呼び出し側で overrides 適用済みを渡せる）
  visibilityOf?: (itemId: number, view: AggregationView) => DisplayVisibility;
}

// 既定の可視性解決（30項目マスタ直参照）
const defaultVisibilityOf = (
  itemId: number,
  view: AggregationView
): DisplayVisibility => {
  // id から項目を引く（label 経由のマスタ関数しか無いため線形探索は避け、id 一致で解決）
  const item = AGGREGATION_ITEMS_BY_ID.get(itemId);
  return item ? item.visibility[view] : 'always';
};

// id 逆引き（default 可視性解決用）
const AGGREGATION_ITEMS_BY_ID = new Map(
  AGGREGATION_DISPLAY_ITEMS.map((i) => [i.id, i])
);

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

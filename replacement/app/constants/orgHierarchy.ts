// 組織階層マスタ（モック）：事業場 → 部署 → 末端組織 → 担当者（作成者・営業担当者・申請者）。
// 検索条件の連動フィルタリング（utils/common/orgCascade.ts）が、上位・下位の対応を引くために使う。
// 担当者は現在の所属（末端組織）で紐づける。
// value は各画面の検索条件で使ってきた値（'hokkaido' 等）に合わせる。

export type OrgLevel = 'office' | 'department' | 'terminalOrg' | 'salesRep';

// 上位から下位の順（左ほど上位）
export const ORG_LEVELS: readonly OrgLevel[] = [
  'office',
  'department',
  'terminalOrg',
  'salesRep',
];

export interface OrgItem {
  value: string;
  code: string;
  name: string;
  /** すぐ上の階層の value（事業場は持たない） */
  parent?: string;
}

// 事業場
const OFFICES: OrgItem[] = [
  { value: 'hokkaido', code: '10000621', name: '北海道支社' },
  { value: 'tohoku', code: '10000622', name: '東北支社' },
  { value: 'shutoken', code: '10000623', name: '首都圏支社' },
  { value: 'kinki', code: '10000624', name: '近畿圏支社' },
  { value: 'shikoku', code: '10000625', name: '四国支社' },
  { value: 'kyushu', code: '10000626', name: '九州支社' },
];

// 部署
const DEPARTMENTS: OrgItem[] = [
  {
    value: 'hokkaido-sales-1',
    code: '10002984',
    name: '北海道営業一部',
    parent: 'hokkaido',
  },
  {
    value: 'hokkaido-sales-2',
    code: '10002990',
    name: '北海道営業二部',
    parent: 'hokkaido',
  },
  {
    value: 'tohoku-sales-1',
    code: '10002985',
    name: '東北営業一部',
    parent: 'tohoku',
  },
  {
    value: 'shutoken-sales-1',
    code: '10002986',
    name: '首都圏営業一部',
    parent: 'shutoken',
  },
  {
    value: 'kinki-sales-1',
    code: '10002987',
    name: '近畿圏営業一部',
    parent: 'kinki',
  },
  {
    value: 'shikoku-sales-1',
    code: '10002988',
    name: '四国営業一部',
    parent: 'shikoku',
  },
  {
    value: 'kyushu-sales-1',
    code: '10002989',
    name: '九州営業一部',
    parent: 'kyushu',
  },
];

// 末端組織（＝採算組織第6階層。部署配下の営業所単位）
const TERMINAL_ORGS: OrgItem[] = [
  {
    value: 'sapporo-1',
    code: '10005001',
    name: '札幌第一営業所',
    parent: 'hokkaido-sales-1',
  },
  {
    value: 'sapporo-2',
    code: '10005002',
    name: '札幌第二営業所',
    parent: 'hokkaido-sales-1',
  },
  {
    value: 'asahikawa-1',
    code: '10005006',
    name: '旭川営業所',
    parent: 'hokkaido-sales-2',
  },
  {
    value: 'sendai-1',
    code: '10005003',
    name: '仙台営業所',
    parent: 'tohoku-sales-1',
  },
  {
    value: 'tokyo-1',
    code: '10005004',
    name: '東京第一営業所',
    parent: 'shutoken-sales-1',
  },
  {
    value: 'osaka-1',
    code: '10005005',
    name: '大阪営業所',
    parent: 'kinki-sales-1',
  },
  {
    value: 'takamatsu-1',
    code: '10005007',
    name: '高松営業所',
    parent: 'shikoku-sales-1',
  },
  {
    value: 'fukuoka-1',
    code: '10005008',
    name: '福岡営業所',
    parent: 'kyushu-sales-1',
  },
];

// 担当者（作成者・営業担当者・申請者）
const SALES_REPS: OrgItem[] = [
  {
    value: 'yamada-taro',
    code: '5172733',
    name: '山田 太郎',
    parent: 'sapporo-1',
  },
  {
    value: 'sato-hanako',
    code: '5172734',
    name: '佐藤 花子',
    parent: 'sapporo-2',
  },
  {
    value: 'ito-makoto',
    code: '5172738',
    name: '伊藤 誠',
    parent: 'asahikawa-1',
  },
  {
    value: 'suzuki-ichiro',
    code: '5172735',
    name: '鈴木 一郎',
    parent: 'sendai-1',
  },
  {
    value: 'tanaka-misaki',
    code: '5172736',
    name: '田中 美咲',
    parent: 'tokyo-1',
  },
  {
    value: 'takahashi-kenta',
    code: '5172737',
    name: '高橋 健太',
    parent: 'osaka-1',
  },
  {
    value: 'nakamura-yuko',
    code: '5172739',
    name: '中村 優子',
    parent: 'takamatsu-1',
  },
  {
    value: 'kobayashi-sho',
    code: '5172740',
    name: '小林 翔',
    parent: 'fukuoka-1',
  },
];

// 階層ごとの一覧（表示順＝この並び）
export const ORG_ITEMS: Record<OrgLevel, readonly OrgItem[]> = {
  office: OFFICES,
  department: DEPARTMENTS,
  terminalOrg: TERMINAL_ORGS,
  salesRep: SALES_REPS,
};

// value → 項目（階層ごと）
const ITEM_BY_VALUE: Record<OrgLevel, Map<string, OrgItem>> = {
  office: new Map(OFFICES.map((o) => [o.value, o])),
  department: new Map(DEPARTMENTS.map((o) => [o.value, o])),
  terminalOrg: new Map(TERMINAL_ORGS.map((o) => [o.value, o])),
  salesRep: new Map(SALES_REPS.map((o) => [o.value, o])),
};

export const findOrgItem = (
  level: OrgLevel,
  value: string
): OrgItem | undefined => ITEM_BY_VALUE[level].get(value);

// 下位の値から、指定した上位階層の値を引く（同じ階層なら自分自身。見つからなければ undefined）。
export function orgAncestor(
  level: OrgLevel,
  value: string,
  upper: OrgLevel
): string | undefined {
  let lv = ORG_LEVELS.indexOf(level);
  const target = ORG_LEVELS.indexOf(upper);
  let v: string | undefined = value;
  while (v !== undefined && lv > target) {
    v = findOrgItem(ORG_LEVELS[lv], v)?.parent;
    lv -= 1;
  }
  return lv === target ? v : undefined;
}

// 集計表の表示項目定義 ─ 課題0255/0288/0450
// 30項目を、各集計ビューごとに「常時表示／＋ボタンで表示可／非表示」で出し分けるための
// 単一の情報源（Single Source of Truth）。資料 XLSX「各シートの役割」シート（列E〜H）に準拠。
// 各集計画面（販売計画(集計)・シミュレーション集計・年間集計）はこのモジュールを参照する。
//
// 凡例：
//   'always'   … 〇 常時表示
//   'optional' … △ 「＋」ボタンで表示／非表示を切替可能
//   'hidden'   … × 非表示（BIで閲覧）
//
// ビュー：
//   monthlyChart  … ①各月 販売計画(集計) グラフ（初期表示）
//   monthlyDetail … ①各月 販売計画(集計) 詳細（ボタン切り替え）
//   simulation    … ②シミュレーションシート（補助機能）集計欄
//   annual        … ③年間集計シート
//
// 対象は手売りのみ（自販機は資料「表示項目（自販機）」が未確定のため別途）。

export type DisplayVisibility = 'always' | 'optional' | 'hidden';

export type AggregationView =
  | 'monthlyChart'
  | 'monthlyDetail'
  | 'simulation'
  | 'annual';

export interface AggregationDisplayItem {
  // 資料の項目No（1〜30）
  id: number;
  // 項目名
  label: string;
  // 今回追加した新規項目か（資料スライド4）
  isNew?: boolean;
  // 新規項目の計算式メモ（補足資料準拠）
  formula?: string;
  // 課題0450：条件口は全ビュー非表示だが、管理利益の算出では差し引く対象
  deductFromManagementProfit?: boolean;
  // ビューごとの表示判定
  visibility: Record<AggregationView, DisplayVisibility>;
}

const v = (
  monthlyChart: DisplayVisibility,
  monthlyDetail: DisplayVisibility,
  simulation: DisplayVisibility,
  annual: DisplayVisibility
): Record<AggregationView, DisplayVisibility> => ({
  monthlyChart,
  monthlyDetail,
  simulation,
  annual,
});

// 30項目の表示判定（課題0623 XLSX「販売計画_集計表_表一覧」の各タブシートに一致）
//   monthlyChart  ← 計画詳細_グラフタブ
//   monthlyDetail ← 計画詳細_詳細タブ
//   simulation    ← 計画詳細_詳細タブ（monthlyDetail と同一）
//   annual        ← 計画詳細_年間集計タブ
// ※ シミュレーション集計表（パターン①/②）の表示項目・補助項目は計画詳細（詳細タブ）と
//   揃えるため、simulation 列は monthlyDetail 列と常に同一の表示区分にする。
//   集計値は詳細グリッドの実集計（utils/simulationDetailAggregate）が供給し、詳細グリッドが
//   保持しない項目（量経追加口・売上原価・売買差益 等）は空欄表示となる。
export const AGGREGATION_DISPLAY_ITEMS: AggregationDisplayItem[] = [
  {
    id: 1,
    label: '函数',
    visibility: v('always', 'always', 'always', 'always'),
  },
  {
    id: 2,
    label: '売上高',
    visibility: v('always', 'always', 'always', 'always'),
  },
  {
    id: 3,
    label: '社外売上高',
    visibility: v('always', 'optional', 'optional', 'always'),
  },
  {
    id: 4,
    label: '管理利益',
    visibility: v('always', 'always', 'always', 'always'),
  },
  {
    id: 5,
    label: '管理利益率',
    visibility: v('always', 'optional', 'optional', 'always'),
  },
  {
    id: 6,
    label: '売上高単価',
    isNew: true,
    formula: '（社外売上高 − 量経追加口）÷ 函数',
    visibility: v('hidden', 'optional', 'optional', 'always'),
  },
  {
    id: 7,
    label: '納品金額',
    visibility: v('hidden', 'always', 'always', 'always'),
  },
  {
    id: 8,
    label: '売上値引',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 9,
    label: '売上値引率',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 10,
    label: '量経追加口',
    visibility: v('hidden', 'always', 'always', 'optional'),
  },
  {
    id: 11,
    label: '量経追加口率',
    visibility: v('hidden', 'optional', 'optional', 'optional'),
  },
  {
    id: 12,
    label: '（CF込追加口率）',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 13,
    label: '売上連動拡売費',
    visibility: v('hidden', 'optional', 'optional', 'optional'),
  },
  {
    id: 14,
    label: '売上連動拡売費率',
    visibility: v('hidden', 'optional', 'optional', 'optional'),
  },
  {
    id: 15,
    label: '条件口',
    deductFromManagementProfit: true,
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 16,
    label: '売上原価',
    visibility: v('hidden', 'always', 'always', 'hidden'),
  },
  {
    id: 17,
    label: '原価率',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 18,
    label: '売上総利益',
    visibility: v('hidden', 'always', 'always', 'hidden'),
  },
  {
    id: 19,
    label: '売上総利益率',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 20,
    label: '変動費（CF/ロケ補填）',
    visibility: v('hidden', 'always', 'always', 'hidden'),
  },
  {
    id: 21,
    label: '（センターフィ）',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 22,
    label: '（ロケ補填）',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 23,
    label: '売買差益',
    visibility: v('hidden', 'always', 'always', 'hidden'),
  },
  {
    id: 24,
    label: '売買差益率',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 25,
    label: '売買差益函単価',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 26,
    label: '直接固定費',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 27,
    label: '（拡売費・固定費）',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 28,
    label: '（自販機関係費）',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 29,
    label: '管理利益函単価',
    visibility: v('hidden', 'optional', 'optional', 'hidden'),
  },
  {
    id: 30,
    label: '拡売費（売上連動拡売費＋直接固定費）',
    isNew: true,
    formula: '売上連動拡売費 ＋ 直接固定費',
    visibility: v('always', 'always', 'always', 'always'),
  },
];

// 将来、ASD管理者が×項目を〇/△へ変更できるようにするための上書き口（課題スライド4【相談】）。
// 現状は上書き無し。overrides を渡すと該当ビューの判定だけ差し替える。
export type DisplayOverrides = Partial<
  Record<number, Partial<Record<AggregationView, DisplayVisibility>>>
>;

export const getDisplayItems = (
  overrides?: DisplayOverrides
): AggregationDisplayItem[] => {
  if (!overrides) return AGGREGATION_DISPLAY_ITEMS;
  return AGGREGATION_DISPLAY_ITEMS.map((item) => {
    const ov = overrides[item.id];
    if (!ov) return item;
    return { ...item, visibility: { ...item.visibility, ...ov } };
  });
};

// 指定ビューで表示対象（常時＋＋ボタン）となる項目
export const getVisibleItems = (
  view: AggregationView,
  overrides?: DisplayOverrides
): AggregationDisplayItem[] =>
  getDisplayItems(overrides).filter((i) => i.visibility[view] !== 'hidden');

// 指定ビューで常時表示（〇）の項目
export const getAlwaysItems = (
  view: AggregationView,
  overrides?: DisplayOverrides
): AggregationDisplayItem[] =>
  getDisplayItems(overrides).filter((i) => i.visibility[view] === 'always');

// 指定ビューで「＋」ボタン切替対象（△）の項目
export const getOptionalItems = (
  view: AggregationView,
  overrides?: DisplayOverrides
): AggregationDisplayItem[] =>
  getDisplayItems(overrides).filter((i) => i.visibility[view] === 'optional');

// ラベルから項目を引く
export const getDisplayItemByLabel = (
  label: string
): AggregationDisplayItem | undefined =>
  AGGREGATION_DISPLAY_ITEMS.find((i) => i.label === label);

// id から項目ラベルを引く（ドリルダウン各ノード→計算結果の突き合わせに使用）
export const getDisplayItemLabelById = (id?: number): string | undefined =>
  id == null
    ? undefined
    : AGGREGATION_DISPLAY_ITEMS.find((i) => i.id === id)?.label;

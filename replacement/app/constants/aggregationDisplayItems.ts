import type {
  AggregationDisplayItem,
  AggregationView,
  DisplayVisibility,
} from '@/app/types/aggregation';

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
//   集計値は詳細グリッドの実集計（utils/sales-plan/simulation/simulationDetailAggregate）が供給し、詳細グリッドが
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

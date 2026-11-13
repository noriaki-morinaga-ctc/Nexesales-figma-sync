// sim(マージン率固定)：画面の定数・選択肢・初期値（バックエンドをつないでも残す値）

import { GRID_COLORS } from '@/app/components/grid';

import type { ProductData } from '@/app/types/simulation';

import type { DetailFormValues } from './salesPlanSimulationMarginRateFixed.types';

export const EMPTY_DETAIL_FORM: DetailFormValues = {
  category: '定番商品',
  wholesaleMesh: '',
  summaryProduct: '',
  metaBrand: '',
  containerCapacityG: '',
  quantity: '',
  endSale: '',
  promotion: '',
  plan: '',
  period: '',
  boxEarly: '',
  boxMid: '',
  boxLate: '',
  currentEstimate: '',
  currentActual: '',
  prevYearActual: '',
  net: '',
  deliveryPrice: '',
  price: '',
  margin: '',
  costOfSales: '',
  seihan: '',
  profitRate: '',
  discountRate: '',
  campaign: '',
  probability: '',
  campaignName: '',
  targetMonth: '',
  exp1PlannedAmount: '',
  exp1PostingMonth: '',
  exp1ManagementCode: '',
  exp1AccountItem: '',
  exp1ManagementClass: '',
  exp1CampaignClass: '',
  exp1CampaignCode: '',
  exp1Description: '',
  exp2PlannedAmount: '',
  exp2PostingMonth: '',
  exp2ManagementCode: '',
  exp2AccountItem: '',
  exp2ManagementClass: '',
  exp2CampaignClass: '',
  exp2CampaignCode: '',
  exp2Description: '',
};

export const CAMPAIGN_OPTIONS = Array.from(
  { length: 20 },
  (_, i) => `企画${String(i + 1).padStart(2, '0')}`
);

export const PROBABILITY_OPTIONS = ['A', 'B', 'C', '確定', '不採用'];

// 新規行の強調表示でフォーカスを当てる列（先頭の対象年月）。
// 強調（スクロール・フラッシュ）は共通の useRevealNewRows が行う（→ 02 変更履歴）。
export const REVEAL_FOCUS_COLUMN = 'targetMonth';

// 不採用行のグレーアウト背景：readonly(GRID_COLORS.readonly)より薄い灰。
// 不採用は変更可能なため、他のグレーアウトと区別する（gridStyles は変更しない）。
export const REJECTED_BG = GRID_COLORS.rejectedBg;

// 比較表示の対象指標（変更前/変更後/増減/AF）
export const COMPARISON_FIELDS = [
  'plan',
  'net',
  'planPrice',
  'price',
  'margin',
  'exp1PlannedAmount',
  'exp2PlannedAmount',
] as const;

// 再計算（computeDerived）で書き換わる算出列。連動セルの Undo（useLinkedCellUndo）で
// 主セルと一緒に退避・復元する従属セルとして使う（→ 02 §7.3）。
export const DERIVED_FIELDS: (keyof ProductData)[] = [
  'net',
  'margin',
  'discount',
  'externalSales',
  '_volumeAdd',
  '_condition',
  '_tradeProfit',
  '_directFixed',
  'netSales',
  'managementProfitAmount',
  'managementProfitRate',
];

// 拡売費①②を空にする差分（参照コピー・新規追加の初期化に使用）。
export const EMPTY_EXPENSE_FIELDS = {
  exp1PlannedAmount: '',
  exp1PlannedAmountBefore: '',
  exp1PostingMonth: '',
  exp1ManagementCode: '',
  exp1AccountItem: '',
  exp1ManagementClass: '',
  exp1CampaignClass: '',
  exp1CampaignCode: '',
  exp1Description: '',
  exp2PlannedAmount: '',
  exp2PlannedAmountBefore: '',
  exp2PostingMonth: '',
  exp2ManagementCode: '',
  exp2AccountItem: '',
  exp2ManagementClass: '',
  exp2CampaignClass: '',
  exp2CampaignCode: '',
  exp2Description: '',
} as const;

export const THIS_YEAR = new Date().getFullYear();

// 計算式（派生）セル → 計算式テンプレートと算出元フィールド。
// 計算式セルにホバーすると、計算式ツールチップ（式＋実値の2行）を表示し、
// 同時に当該行内の算出元セルの枠線を強調する（マウスが離れると消える）。
// 「補足資料_手売り_販売計画_計算式一覧表」補足1-1・補足2-1・補足2-2・補足5-2 に準拠。
// 行ごとに「固定マージン率（NETが算出）」「NET入力（マージン率が算出）」が入れ替わるため、
// net / margin は isFormula で行単位に判定する。
export const SIM_COLUMN_LABELS: Record<string, string> = {
  plan: '計画函数(SIM値)',
  planBefore: '計画函数(計画値)',
  net: 'NET(SIM値)',
  netBefore: 'NET(計画値)',
  planPrice: '納価(SIM値)',
  planPriceBefore: '納価(計画値)',
  price: '売価(SIM値)',
  priceBefore: '売価(計画値)',
  margin: 'マージン率',
  quantity: '入数',
  externalSales: '社外売上高',
  netSales: '売上高',
  _volumeAdd: '量経追加口',
  _condition: '条件口',
  _tradeProfit: '売買差益',
  _directFixed: '直接固定費',
  managementProfitAmount: '管理利益額',
  exp1PlannedAmountBefore: '拡売費①計画金額',
  exp2PlannedAmountBefore: '拡売費②計画金額',
  __unitPrice: '社外売単価',
};

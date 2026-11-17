// 計画詳細(NET固定)：画面の定数（バックエンドをつないでも残す値）

import type { ProductData } from '@/types/salesPlanWholesale';
import type { DetailFormValues } from '@/types/salesPlanWholesale';

// 連動セル（→ 02 §7.3）：recalcGiftLikeRates が算出して書き換える従属セル。
// マージン率・値入率はギフト/特殊商品のときだけ再計算される（他区分は値をそのまま保つ）。
export const GIFT_LIKE_CALC_FIELDS: (keyof ProductData)[] = [
  'margin',
  'discount',
  'markupAmount',
  'externalSales',
  'delivery',
  'volumeAddRate',
];

// 連動セル：サマリ商品名の選択で共通マスタから補完する従属セル。
export const SUMMARY_MASTER_FIELDS: (keyof ProductData)[] = [
  'metaBrand',
  'containerCapacityG',
  'wholesaleMesh',
  'quantity',
  'actual',
  'prevYear',
];

// 計算式（派生）セル → 計算式テンプレートと算出元フィールド。
// 計算式セルにホバーすると、計算式ツールチップ（式＋実値の2行）を表示し、
// 同時に当該行内の算出元セルの枠線を強調する（マウスが離れると消える）。
// 「補足資料_手売り_販売計画_計算式一覧表」補足1-2・補足2-1・補足2-2・補足2-3 に準拠。
// refs は当該行内かつ「明細表に表示される列」の算出元のみを対象とする。
// テンプレートの `{token}` は実値を代入できる算出元、素のテキストは画面外の算出元。
// NET固定パターンのため NET は入力値、マージン率が算出セル。
export const WHOLESALE_COLUMN_LABELS: Record<string, string> = {
  plan: '計画',
  prevYear: '前年実績',
  planPrice: '納価',
  net: 'NET',
  price: '売価',
  quantity: '入数',
  __unitPrice: '社外売単価',
  __costUnitPrice: '売上原価単価',
};

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
};

// 計画詳細(マージン率固定)：実販EDI（実販FACT）・コメント履歴・一次店/三次店のモック
// （バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/features/sales-plan/plan-detail-margin-rate-fixed/page.tsx。

import {
  PLAN_DETAIL_DIGITS,
  roundPlanNumber,
} from '@/utils/sales-plan/common/planDetailNumberFormat';
import type { CommentHistoryItem } from '@/components/shared/common/CommentHistoryPane';
import type { MarginRate } from '@/types/planDetail';
import type { EdiActual, ProductData } from '@/types/salesPlanRetail';

const toNumber = (value: unknown): number => {
  const num = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(num) ? num : 0;
};

// 当月実績がある計画行は、計画納価どおりの実販FACTが反映ルール②（同じサマリ商品・同じ計画納価の行に反映）で
// 自動で反映済みとみなす（補足8-1・8-7）。
const isAutoReflected = (row: ProductData): boolean =>
  toNumber(row.actual) > 0 && toNumber(row.planPrice) > 0;

const priceOf = (value: unknown): string =>
  roundPlanNumber(toNumber(value), PLAN_DETAIL_DIGITS.price);

// 計画行に、自動で反映済みの実販EDI（EDI納価・突合の状態「自動」）を付ける。
// 反映していない行のEDI納価は空欄にする。
export const withMockAutoEdi = (rows: ProductData[]): ProductData[] =>
  rows.map((row) =>
    isAutoReflected(row)
      ? { ...row, ediPrice: priceOf(row.planPrice), ediMatchStatus: 'auto2' }
      : { ...row, ediPrice: '', ediMatchStatus: undefined }
  );

// ── 補足8-7 2. の題材（東日本／マージン率固定、2026年8月、当月〆後に実販FACTが届いた時点） ──
// 計画行 P1〜P3 と実販EDI E1〜E3 を図1-1・1-2 と同じ商品・値で持つ。
// 共通モック（mocks/common/salesPlanRetail）は集計の元にも使うため触らず、この画面の明細の先頭に足す。
const MITSUYA_PET500 = '三ツ矢サイダーＰＥＴ５００';
const CALPIS_PET500 = 'カルピスウォーターＰＥＴ５００';

const scenarioRow = (
  row: Pick<
    ProductData,
    | 'section'
    | 'productCategory'
    | 'metaBrand'
    | 'summaryProduct'
    | 'promotion'
    | 'plan'
    | 'planPrice'
    | 'price'
  > &
    Partial<ProductData>
): ProductData => ({
  containerCapacityG: 'PET500',
  wholesaleMesh: '',
  endSale: '',
  period: '',
  quantity: '24',
  estimate: '',
  actual: '',
  prevYear: '',
  ratio: '',
  net: '',
  ediPrice: '',
  prevYearPrice: row.planPrice,
  margin: '11.00%',
  volumeAddRate: '',
  externalSales: '',
  delivery: '',
  discount: '',
  profit: '',
  exp1PlannedAmount: '',
  exp1PostingMonth: '',
  exp1ManagementCode: '',
  exp1AccountItem: '',
  exp1ManagementClass: '',
  exp1Description: '',
  exp2PlannedAmount: '',
  exp2PostingMonth: '',
  exp2ManagementCode: '',
  exp2AccountItem: '',
  exp2ManagementClass: '',
  exp2Description: '',
  ...row,
});

// 定番の題材行：P1（E1 がルール②で自動反映済み）・P3（E3 と一致する納価が無い）
export const EDI_SCENARIO_REGULAR_ROWS: ProductData[] = [
  scenarioRow({
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: '三ツ矢',
    summaryProduct: MITSUYA_PET500,
    promotion: '定番・EDLP',
    plan: '2,300',
    estimate: '2,200',
    actual: '2,200',
    prevYear: '3,000',
    ratio: '76.67%',
    planPrice: '80.00',
    price: '98',
  }),
  scenarioRow({
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: 'カルピス',
    summaryProduct: CALPIS_PET500,
    promotion: '定番・EDLP',
    plan: '1,500',
    prevYear: '1,400',
    ratio: '107.14%',
    planPrice: '85.00',
    price: '105',
  }),
];

// 特売の題材行：P2（E2 を手動で突合する先。計画78.00／EDI76.50）
export const EDI_SCENARIO_PROMOTION_ROWS: ProductData[] = [
  scenarioRow({
    section: '特売',
    productCategory: '特売',
    metaBrand: '三ツ矢',
    summaryProduct: MITSUYA_PET500,
    promotion: 'アプリ販促',
    plan: '1,200',
    planPrice: '78.00',
    price: '98',
  }),
];

// 未突合の実販EDI：当月〆後に届いた実販FACTのうち、一致する計画納価が無かったもの（題材の E2・E3）。
// E1 は P1 に自動で反映済みのため、mockEdiActualsOf で P1 から作る。
export const UNMATCHED_EDI_ACTUALS: EdiActual[] = [
  // 担当者が「特売（計画78.00）で商談した分」と判断できる実績（手動で突合する想定）
  {
    id: 'E2',
    summaryProduct: MITSUYA_PET500,
    ediPrice: '76.50',
    count: '900',
    status: 'unmatched',
  },
  // 計画外の値引きの実績（突合せずに保存し、計画納価が空欄の明細として追加する想定）
  {
    id: 'E3',
    summaryProduct: CALPIS_PET500,
    ediPrice: '84.00',
    count: '600',
    status: 'unmatched',
  },
];

// 実販EDIの一覧：自動で反映済みの分（当月実績がある計画行）と未突合の分。
export const mockEdiActualsOf = (allRows: ProductData[]): EdiActual[] => [
  ...allRows.filter(isAutoReflected).map(
    (row): EdiActual => ({
      id: `A-${row.id}`,
      summaryProduct: row.summaryProduct,
      ediPrice: priceOf(row.planPrice),
      count: String(toNumber(row.actual)),
      status: 'auto2',
      planRowId: row.id,
    })
  ),
  ...UNMATCHED_EDI_ACTUALS,
];

// コメント履歴ペイン（shared/common/CommentHistoryPane）のモックデータ。
// 操作（申請・引戻し・承認・差戻し）と、その操作の後の計画ステータスで表す。
// 流れ：申請 → 引戻し → 申請 → 差戻し → 申請 → 承認
// 共通ペインの持ち方に合わせて古い順（日時の昇順）で並べる（表示は新しい順）。
export const COMMENT_HISTORY_DATA: CommentHistoryItem[] = [
  {
    actionType: '申請',
    status: '承認待ち',
    datetime: '2025/02/20 15:54:45',
    userName: '河〇　雅◇',
    comment: '販促NETは競合対策提示条件。',
  },
  {
    actionType: '引戻し',
    status: '未申請',
    datetime: '2025/02/20 16:02:10',
    userName: '河〇　雅◇',
    comment: '販促の条件を見直すため引き戻します。',
  },
  {
    actionType: '申請',
    status: '承認待ち',
    datetime: '2025/02/20 16:14:25',
    userName: '河〇　雅◇',
    comment: '販促の条件を見直したため、再度申請します。',
  },
  {
    actionType: '差戻し',
    status: '差戻し',
    datetime: '2025/02/20 18:47:05',
    userName: '◇山　〇郎',
    comment: '函数計画を前年販売実績120%となるよう更新すること。',
  },
  {
    actionType: '申請',
    status: '承認待ち',
    datetime: '2025/02/21 9:30:45',
    userName: '河〇　雅◇',
    comment: '函数計画を前年販売実績120%となるように修正。',
  },
  {
    actionType: '承認',
    status: '承認済み',
    datetime: '2025/02/21 12:47:05',
    userName: '◇山　〇郎',
    comment: '',
  },
];

export const SAMPLE_STORES = [
  { tier1: '三菱食品株式会社（イオン）', tier3: 'イオン東北ＲＤＣ' },
  {
    tier1: '加藤産業株式会社　仙台支店イオンＲＤＣ',
    tier3: 'イオン商品調達株式会社　ＡＧＭ東北ＲＤＣ',
  },
  {
    tier1: '伊藤忠食品株式会社　仙台支店',
    tier3: '伊藤忠食品株式会社　仙台支店',
  },
];

export const RETAIL_MARGIN_RATES: MarginRate[] = [
  {
    tier1: '三菱食品株式会社（イオン）',
    tier3: 'イオン東北ＲＤＣ',
    rate: 7.62,
  },
  {
    tier1: '加藤産業株式会社　仙台支店イオンＲＤＣ',
    tier3: 'イオン商品調達株式会社　ＡＧＭ東北ＲＤＣ',
    rate: 7.62,
  },
  {
    tier1: '伊藤忠食品株式会社　仙台支店',
    tier3: '伊藤忠食品株式会社　仙台支店',
    rate: 7.62,
  },
];

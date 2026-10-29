// 販売計画表(マージン率固定・NET入力) のダミーデータ集約

// PlanDetailMarginRateFixed.tsx / DetailTable.tsx で使用するモックデータ。

import type { MarginRate } from '../components/shared/MarginNetRatePane';
import type { CommentHistoryItem } from '../components/shared/CommentHistoryPane';

export interface ProductData {
  // 行の一意ID（getRowId・行削除の照合に使用。withRowId／コピー時に採番）
  id?: string;
  section: string;
  metaBrand: string;
  containerCapacityG?: string;
  summaryProduct: string;
  wholesaleMesh: string;
  productCategory: string;
  endSale: string;
  period?: string;
  promotion: string;
  quantity: string;
  plan: string;
  estimate: string;
  actual: string;
  prevYear: string;
  ratio: string;
  net: string;
  planPrice: string;
  ediPrice?: string;
  prevYearPrice: string;
  price: string;
  margin: string;
  volumeAddRate: string;
  externalSales: string;
  delivery: string;
  discount: string;
  markupAmount?: string; // 値入額（算出：(売価 − 納価) × 入数 × 函数(計画)）
  profit: string;
  exp1PlannedAmount: string;
  exp1PostingMonth: string;
  exp1ManagementCode: string;
  exp1AccountItem: string;
  exp1ManagementClass: string;
  exp1Description: string;
  exp2PlannedAmount: string;
  exp2PostingMonth: string;
  exp2ManagementCode: string;
  exp2AccountItem: string;
  exp2ManagementClass: string;
  exp2Description: string;
  tier1?: string; // 一次店
  tier3?: string; // 三次店
  // 明細追加・コピーで採番する挿入順。値が大きいほど新しく、表示時は合計行直下（先頭）へ並べる
  _addedSeq?: number;
  // 行の追加経路（カラーバー表示用）: detail=グリッドの行コピー / new=明細追加
  _copySource?: 'reference' | 'detail' | 'new';
  // ギフトの「上旬・中旬・下旬」3行1セットを識別するキー。
  // 同一 giftSetId の行はグリッドで販売期間・計画(函数)以外をセル結合し、
  // 追加・コピー・削除を3行まとめて行う。
  giftSetId?: string;
  // グリッド表示用の一時フラグ（rowData生成時に付与。セル結合の先頭行判定と行数）。
  _giftFirst?: boolean;
  _giftSpan?: number;
  // 操作アイコンをセット中央行にのみ表示するための一時フラグ（rowData生成時に付与）。
  _giftMiddle?: boolean;
  // セット最終行（下旬）判定。操作列の内部罫線制御に使用。
  _giftLast?: boolean;
}

// 拡売費フォーム値：共通（サマリ商品名・メタブランド）＋拡売費（8項目）。
// 拡売費フォーム型は共通モジュールに集約（単一ソース）
export type { ExpenseFormValues } from './nonProductExpenseForm';

export type DetailFormValues = {
  category: string;
  wholesaleMesh: string;
  summaryProduct: string;
  metaBrand: string;
  containerCapacityG: string;
  quantity: string;
  endSale: string;
  promotion: string;
  plan: string;
  period: string;
  // ギフト専用：上旬/中旬/下旬ごとの箱数（＝計画函数）。ギフト以外は未使用。
  boxEarly: string;
  boxMid: string;
  boxLate: string;
  currentEstimate: string;
  currentActual: string;
  prevYearActual: string;
  net: string;
  deliveryPrice: string;
  price: string;
  margin: string;
  costOfSales: string;
  seihan: string;
  profitRate: string;
  discountRate: string;
};

// コメント履歴ペイン（shared/CommentHistoryPane）のモックデータ。
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

export const PROMOTION_OPTIONS = [
  { value: '定番・EDLP', label: '定番・EDLP' },
  { value: 'ギフト特売', label: 'ギフト特売' },
  { value: '季節特売', label: '季節特売' },
  { value: '新商品', label: '新商品' },
];

export const SALES_PERIOD_OPTIONS = [
  { value: '上旬', label: '上旬' },
  { value: '中旬', label: '中旬' },
  { value: '下旬', label: '下旬' },
];

// 拡売費の選択肢は expenseRelations.ts に集約（全画面共通）
export {
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
  EXPENSE_MANAGEMENT_CLASS_OPTIONS,
  EXPENSE_ACCOUNT_ITEM_OPTIONS,
  EXPENSE_CAMPAIGN_CLASS_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
} from './expenseRelations';

// 拡売費フォーム初期値は共通モジュールに集約（単一ソース）
export { EMPTY_EXPENSE_FORM } from './nonProductExpenseForm';

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

// ── 削除確認用の「実績なし」明細行 ───────────────────────────
// 前年実績がある行は削除できないため、削除操作を確認できるよう、実績データ
// （当月着地見込・当月実績・前年実績・計画/前年実績・前年実績納価）をすべて空にした行を
// 商品区分ごとに2行ずつ用意する。NET・売買差益率・社外売上高・納品金額は
// 明細表の初期化時に納価・売価・マージン率から算出されるため空で持つ。
const noActualRow = (
  row: Pick<
    ProductData,
    | 'section'
    | 'productCategory'
    | 'metaBrand'
    | 'summaryProduct'
    | 'wholesaleMesh'
    | 'promotion'
    | 'quantity'
    | 'plan'
    | 'planPrice'
    | 'price'
    | 'margin'
  > &
    Partial<ProductData>
): ProductData => ({
  containerCapacityG: '',
  endSale: '',
  period: '',
  net: '',
  ediPrice: '',
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
  // 実績データは常に空にして削除可能な行にする
  estimate: '',
  actual: '',
  prevYear: '',
  ratio: '',
  prevYearPrice: '',
});

export const REGULAR_PRODUCTS_DATA: ProductData[] = [
  {
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: '三ツ矢',
    containerCapacityG: '350mL',
    summaryProduct: '三ツ矢サイダー３５０ｍＬ２４本',
    wholesaleMesh: '【三ツ矢150円】三ツ矢サイダー28・350',
    endSale: '',
    period: '',
    promotion: '定番・EDLP',
    quantity: '8',
    plan: '800',
    estimate: '800',
    actual: '400',
    prevYear: '800',
    ratio: '100.00%',
    net: '89.16',
    planPrice: '95.36',
    ediPrice: '',
    prevYearPrice: '95.50',
    price: '128',
    margin: '6.50%',
    volumeAddRate: '-700.00%',
    externalSales: '100',
    delivery: '90',
    discount: '25.50%',
    profit: '20.00%',

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
  },
  {
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: '三ツ矢',
    containerCapacityG: '350mL',
    summaryProduct: '三ツ矢サイダー３５０ｍＬ２４本',
    wholesaleMesh: '【三ツ矢150円】三ツ矢サイダー28・350',
    endSale: '',
    period: '',
    promotion: 'アプリ販促',
    quantity: '24',
    plan: '30',
    estimate: '30',
    actual: '15',
    prevYear: '30',
    ratio: '100.00%',
    net: '100.11',
    planPrice: '107.64',
    ediPrice: '20.00',
    prevYearPrice: '19.80',
    price: '138',
    margin: '7.00%',
    volumeAddRate: '0.00%',
    externalSales: '',
    delivery: '',
    discount: '22.00%',
    profit: '20.00%',

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
  },
  {
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: 'ウィルキンソン',
    containerCapacityG: '350mL',
    summaryProduct: 'ウィルキンソンタンサン３５０ｍＬ２４本',
    wholesaleMesh: '【ウィルキンソン101円】リタ瓶（プレーン）',
    endSale: '',
    period: '',
    promotion: 'ポイント販促',
    quantity: '12',
    plan: '800',
    estimate: '800',
    actual: '400',
    prevYear: '800',
    ratio: '100.00%',
    net: '72.79',
    planPrice: '77.44',
    ediPrice: '',
    prevYearPrice: '98.20',
    price: '108',
    margin: '6.00%',
    volumeAddRate: '0.00%',
    externalSales: '800',
    delivery: '790',
    discount: '28.30%',
    profit: '20.00%',

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
  },
  {
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: 'ウィルキンソン',
    containerCapacityG: '350mL',
    summaryProduct: 'ウィルキンソンタンサン３５０ｍＬ２４本',
    wholesaleMesh: '【ウィルキンソン101円】リタ瓶（プレーン）',
    endSale: '',
    period: '',
    promotion: 'リテールメディア',
    quantity: '24',
    plan: '240',
    estimate: '',
    actual: '',
    prevYear: '',
    ratio: '',
    net: '116.77',
    planPrice: '126.24',
    ediPrice: '',
    // 前年実績なし（函数・納価とも空）の定番商品。削除可のケース確認用。
    prevYearPrice: '',
    price: '158',
    margin: '7.50%',
    volumeAddRate: '100.00%',
    externalSales: '200',
    delivery: '190',
    discount: '20.10%',
    profit: '20.00%',

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
  },
  {
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: 'ウィルキンソン',
    containerCapacityG: '350mL',
    summaryProduct: 'ウィルキンソンタンサン３５０ｍＬ２４本',
    wholesaleMesh: '【ウィルキンソン101円】リタ瓶（プレーン）',
    endSale: '',
    period: '',
    promotion: '定番・EDLP',
    quantity: '24',
    plan: '30',
    estimate: '30',
    actual: '15',
    prevYear: '30',
    ratio: '100.00%',
    net: '67.58',
    planPrice: '71.74',
    ediPrice: '',
    prevYearPrice: '96.80',
    price: '98',
    margin: '5.80%',
    volumeAddRate: '87.00%',
    externalSales: '230',
    delivery: '220',
    discount: '26.80%',
    profit: '20.00%',

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
  },
  {
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: '十六茶',
    containerCapacityG: '660mL',
    summaryProduct: '十六茶６６０ｍＬ２４本',
    wholesaleMesh: '【十六茶140円】十六茶自販機用660ml',
    endSale: '',
    period: '',
    promotion: 'アプリ販促',
    quantity: '24',
    plan: '300',
    estimate: '300',
    actual: '150',
    prevYear: '300',
    ratio: '100.00%',
    net: '105.66',
    planPrice: '113.37',
    ediPrice: '',
    prevYearPrice: '135.00',
    price: '148',
    margin: '6.80%',
    volumeAddRate: '40.00%',
    externalSales: '500',
    delivery: '490',
    discount: '23.40%',
    profit: '20.00%',

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
  },
  {
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: 'カルピス',
    summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
    containerCapacityG: '500mL',
    wholesaleMesh: '【カルピスストレート455円】500mL帯',
    endSale: '',
    period: '',
    promotion: 'ポイント販促',
    quantity: '24',
    plan: '360',
    estimate: '',
    actual: '',
    prevYear: '',
    ratio: '',
    net: '83.35',
    planPrice: '88.85',
    ediPrice: '',
    prevYearPrice: '445.00',
    price: '118',
    margin: '6.20%',
    volumeAddRate: '100.00%',
    externalSales: '200',
    delivery: '190',
    discount: '24.70%',
    profit: '20.00%',

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
  },
  {
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: 'カルピス',
    containerCapacityG: '500mL',
    summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
    wholesaleMesh: '【カルピスソーダ455円】500mL帯',
    endSale: '',
    period: '',
    promotion: 'リテールメディア',
    quantity: '24',
    plan: '180',
    estimate: '',
    actual: '',
    prevYear: '',
    ratio: '',
    net: '122.70',
    planPrice: '132.22',
    ediPrice: '',
    prevYearPrice: '450.00',
    price: '168',
    margin: '7.20%',
    volumeAddRate: '100.00%',
    externalSales: '200',
    delivery: '190',
    discount: '21.30%',
    profit: '20.00%',

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
  },
  {
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: 'おいしい水',
    containerCapacityG: '2L',
    summaryProduct: 'おいしい水 天然水２Ｌ６本',
    wholesaleMesh: '【水355円】２L',
    endSale: '',
    period: '',
    promotion: '定番・EDLP',
    quantity: '24',
    plan: '50',
    estimate: '50',
    actual: '25',
    prevYear: '50',
    ratio: '100.00%',
    net: '60.62',
    planPrice: '64.15',
    ediPrice: '',
    prevYearPrice: '348.00',
    price: '88',
    margin: '5.50%',
    volumeAddRate: '75.00%',
    externalSales: '250',
    delivery: '240',
    discount: '27.10%',
    profit: '20.00%',

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
  },
  {
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: 'おいしい水',
    containerCapacityG: '2L',
    summaryProduct: 'おいしい水 天然水２Ｌ６本',
    wholesaleMesh: '【水355円】２L',
    endSale: '',
    period: '',
    promotion: 'アプリ販促',
    quantity: '6',
    plan: '50',
    estimate: '50',
    actual: '25',
    prevYear: '50',
    ratio: '100.00%',
    net: '129.00',
    planPrice: '137.24',
    ediPrice: '',
    prevYearPrice: '350.00',
    price: '178',
    margin: '6.00%',
    volumeAddRate: '75.00%',
    externalSales: '250',
    delivery: '240',
    discount: '22.90%',
    profit: '20.00%',

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
  },
  // 削除確認用：実績データが空で削除できる行（商品区分ごとに2行）
  noActualRow({
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: '三ツ矢',
    containerCapacityG: '350mL',
    summaryProduct: '三ツ矢サイダー３５０ｍＬ２４本',
    wholesaleMesh: '【三ツ矢150円】三ツ矢サイダー28・350',
    promotion: 'ポイント販促',
    quantity: '8',
    plan: '300',
    planPrice: '95.36',
    price: '128',
    margin: '6.50%',
    volumeAddRate: '2.00%',
    profit: '20.00%',
  }),
  noActualRow({
    section: '定番商品',
    productCategory: '定番商品',
    metaBrand: '十六茶',
    containerCapacityG: '660mL',
    summaryProduct: '十六茶６６０ｍＬ２４本',
    wholesaleMesh: '【十六茶140円】十六茶自販機用660ml',
    promotion: 'リテールメディア',
    quantity: '24',
    plan: '250',
    planPrice: '108.00',
    price: '140',
    margin: '7.00%',
    volumeAddRate: '1.50%',
    profit: '18.00%',
  }),
];

export const NEW_PRODUCTS_DATA: ProductData[] = [
  {
    section: '新商品',
    productCategory: '新商品',
    metaBrand: 'カルピス',
    containerCapacityG: '500mL',
    summaryProduct: 'カルピスソーダ至福の時間白桃５００ｍＬ２４本',
    wholesaleMesh: '【カルピスソーダ455円】500mL帯',
    endSale: '',
    promotion: 'アプリ販促',
    quantity: '24',
    plan: '480',
    estimate: '',
    actual: '',
    prevYear: '',
    ratio: '',
    net: '89.16',
    planPrice: '95.36',
    prevYearPrice: '',
    delivery: '',
    price: '128',
    margin: '6.50%',
    volumeAddRate: '20.30%',
    externalSales: '',
    discount: '25.50%',
    profit: '23.10%',

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
  },
  {
    section: '新商品',
    productCategory: '新商品',
    metaBrand: 'アサヒ',
    containerCapacityG: '350mL',
    summaryProduct: 'アサヒ贅沢搾りグレープフルーツ３５０ｍＬ２４本',
    wholesaleMesh: '【グレープフルーツ455円】350mL帯',
    endSale: '',
    promotion: 'チラシ（日替り）',
    quantity: '24',
    plan: '8',
    estimate: '',
    actual: '8',
    prevYear: '',
    ratio: '',
    net: '100.11',
    planPrice: '107.64',
    prevYearPrice: '',
    delivery: '220',
    price: '138',
    margin: '7.00%',
    volumeAddRate: '10.10%',
    externalSales: '240',
    discount: '22.00%',
    profit: '23.10%',

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
  },
  {
    section: '新商品',
    productCategory: '新商品',
    metaBrand: '三ツ矢',
    containerCapacityG: '500mL',
    summaryProduct: '三ツ矢特濃グレープ５００ｍＬ２４本',
    wholesaleMesh: '【三ツ矢サイダーグレープ455円】500mL帯',
    endSale: '',
    promotion: 'サンプリング',
    quantity: '24',
    // 集計単位「三ツ矢×PET・ボトル缶500」の唯一の商品行。ロケ補填(拡売費計画 no.101)を
    // 補足3-1準拠の妥当額へ戻すための headroom として函数を引き上げる（Important 2 対応）。
    plan: '200',
    estimate: '',
    actual: '8',
    prevYear: '',
    ratio: '',
    net: '72.79',
    planPrice: '77.44',
    prevYearPrice: '',
    delivery: '120',
    price: '108',
    margin: '6.00%',
    volumeAddRate: '1.10%',
    externalSales: '121',
    discount: '28.30%',
    profit: '30.10%',

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
  },
  {
    section: '新商品',
    productCategory: '新商品',
    metaBrand: 'ワンダ',
    containerCapacityG: '400g',
    summaryProduct: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    wholesaleMesh: '【ワンダラテ455円】400g帯',
    endSale: '',
    promotion: '導入条件',
    quantity: '24',
    plan: '8',
    estimate: '',
    actual: '8',
    prevYear: '',
    ratio: '',
    net: '116.77',
    planPrice: '126.24',
    prevYearPrice: '',
    delivery: '160',
    price: '158',
    margin: '7.50%',
    volumeAddRate: '1.10%',
    externalSales: '165',
    discount: '20.10%',
    profit: '28.10%',

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
  },
  // 削除確認用：実績データが空で削除できる行（商品区分ごとに2行）
  noActualRow({
    section: '新商品',
    productCategory: '新商品',
    metaBrand: 'カルピス',
    containerCapacityG: '500mL',
    summaryProduct: 'カルピスソーダ至福の時間白桃５００ｍＬ２４本',
    wholesaleMesh: '【カルピスソーダ455円】500mL帯',
    promotion: 'エンド',
    quantity: '24',
    plan: '120',
    planPrice: '106.00',
    price: '140',
    margin: '8.00%',
    volumeAddRate: '1.20%',
    profit: '21.00%',
  }),
  noActualRow({
    section: '新商品',
    productCategory: '新商品',
    metaBrand: '贅沢搾り',
    containerCapacityG: '350mL',
    summaryProduct: 'アサヒ贅沢搾りグレープフルーツ３５０ｍＬ２４本',
    wholesaleMesh: '【グレープフルーツ455円】350mL帯',
    promotion: '試飲会',
    quantity: '24',
    plan: '90',
    planPrice: '98.00',
    price: '130',
    margin: '7.50%',
    volumeAddRate: '1.00%',
    profit: '19.00%',
  }),
];

export const PROMOTION_PRODUCTS_DATA: ProductData[] = [
  {
    section: '特売',
    productCategory: '特売',
    metaBrand: '三ツ矢',
    containerCapacityG: '1.5L',
    summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ',
    wholesaleMesh: '',
    endSale: '',
    period: '',
    promotion: 'チラシ（日替り）',
    quantity: '12',
    plan: '16,000',
    estimate: '18,000',
    actual: '16,000',
    prevYear: '20,000',
    ratio: '80.00%',
    net: '67.58',
    planPrice: '71.74',
    ediPrice: '21.50',
    prevYearPrice: '21.20',
    price: '98',
    margin: '5.80%',
    volumeAddRate: '2.50%',
    externalSales: '130',
    delivery: '120',
    discount: '26.80%',
    profit: '16.70%',

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
  },
  {
    section: '特売',
    productCategory: '特売',
    metaBrand: 'ウィルキンソン',
    containerCapacityG: '1L',
    summaryProduct: 'ウィルキンソンタンサン１Ｌ',
    wholesaleMesh: '',
    endSale: '',
    period: '',
    promotion: 'エンド',
    quantity: '12',
    plan: '18,000',
    estimate: '15,000',
    actual: '12,000',
    prevYear: '20,000',
    ratio: '60.00%',
    net: '105.66',
    planPrice: '113.37',
    ediPrice: '19.20',
    prevYearPrice: '19.00',
    price: '148',
    margin: '6.80%',
    volumeAddRate: '1.80%',
    externalSales: '130',
    delivery: '120',
    discount: '23.40%',
    profit: '16.70%',

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
  },
  {
    section: '特売',
    productCategory: '特売',
    metaBrand: 'おいしい水',
    containerCapacityG: '2L',
    summaryProduct: 'おいしい水 天然水２Ｌ６本',
    wholesaleMesh: '',
    endSale: '',
    period: '',
    promotion: '催事',
    quantity: '6',
    plan: '2,000',
    estimate: '4,000',
    actual: '28,000',
    prevYear: '3,000',
    ratio: '66.70%',
    net: '83.35',
    planPrice: '88.85',
    ediPrice: '14.10',
    prevYearPrice: '13.90',
    price: '118',
    margin: '6.20%',
    volumeAddRate: '3.20%',
    externalSales: '90',
    delivery: '80',
    discount: '24.70%',
    profit: '14.70%',

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
  },
  {
    section: '特売',
    productCategory: '特売',
    metaBrand: 'カルピス',
    containerCapacityG: '500mL',
    summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
    wholesaleMesh: '',
    endSale: '',
    period: '',
    promotion: 'チラシ（通し）',
    quantity: '6',
    plan: '2,000',
    estimate: '4,000',
    actual: '28,000',
    prevYear: '3,000',
    ratio: '66.70%',
    net: '122.70',
    planPrice: '132.22',
    ediPrice: '14.00',
    prevYearPrice: '13.75',
    price: '168',
    margin: '7.20%',
    volumeAddRate: '2.90%',
    externalSales: '90',
    delivery: '80',
    discount: '21.30%',
    profit: '14.70%',

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
  },
  {
    section: '特売',
    productCategory: '特売',
    metaBrand: '十六茶',
    containerCapacityG: '660mL',
    summaryProduct: '十六茶６６０ｍＬ２４本',
    wholesaleMesh: '',
    endSale: '',
    period: '',
    promotion: '月間強化',
    quantity: '6',
    plan: '2,000',
    estimate: '4,000',
    actual: '28,000',
    prevYear: '3,000',
    ratio: '66.70%',
    net: '60.62',
    planPrice: '64.15',
    ediPrice: '13.80',
    prevYearPrice: '13.60',
    price: '88',
    margin: '5.50%',
    volumeAddRate: '3.50%',
    externalSales: '90',
    delivery: '80',
    discount: '27.10%',
    profit: '14.70%',

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
  },
  {
    section: '特売',
    productCategory: '特売',
    metaBrand: 'ワンダ',
    containerCapacityG: '185g',
    summaryProduct: 'ワンダ金の微糖１８５ｇ３０本',
    wholesaleMesh: '',
    endSale: '',
    period: '',
    promotion: '週間強化',
    quantity: '6',
    plan: '2,000',
    estimate: '4,000',
    actual: '28,000',
    prevYear: '3,000',
    ratio: '66.70%',
    net: '129.00',
    planPrice: '137.24',
    ediPrice: '13.90',
    prevYearPrice: '13.70',
    price: '178',
    margin: '6.00%',
    volumeAddRate: '2.70%',
    externalSales: '90',
    delivery: '80',
    discount: '22.90%',
    profit: '14.70%',

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
  },
  {
    section: '特売',
    productCategory: '特売',
    metaBrand: '三ツ矢',
    containerCapacityG: '1.5L',
    summaryProduct: '三ツ矢サイダー１．５Ｌ８本',
    wholesaleMesh: '',
    endSale: '',
    period: '',
    promotion: '景品企画',
    quantity: '6',
    plan: '2,000',
    estimate: '4,000',
    actual: '28,000',
    prevYear: '3,000',
    ratio: '66.70%',
    net: '89.16',
    planPrice: '95.36',
    ediPrice: '14.20',
    prevYearPrice: '14.00',
    price: '128',
    margin: '6.50%',
    volumeAddRate: '3.10%',
    externalSales: '90',
    delivery: '80',
    discount: '25.50%',
    profit: '14.70%',

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
  },
  // 削除確認用：実績データが空で削除できる行（商品区分ごとに2行）
  noActualRow({
    section: '特売',
    productCategory: '特売',
    metaBrand: '三ツ矢',
    containerCapacityG: '1.5L',
    summaryProduct: '三ツ矢サイダーゼロストロング１．５Ｌ',
    wholesaleMesh: '',
    promotion: '契約対策',
    quantity: '8',
    plan: '150',
    planPrice: '210.00',
    price: '270',
    margin: '9.00%',
    volumeAddRate: '1.80%',
    profit: '17.00%',
  }),
  noActualRow({
    section: '特売',
    productCategory: '特売',
    metaBrand: 'ウィルキンソン',
    containerCapacityG: '1L',
    summaryProduct: 'ウィルキンソンタンサン１Ｌ',
    wholesaleMesh: '',
    promotion: '長在品',
    quantity: '12',
    plan: '180',
    planPrice: '150.00',
    price: '198',
    margin: '8.50%',
    volumeAddRate: '1.40%',
    profit: '16.00%',
  }),
];

// ギフトは「上旬・中旬・下旬」を1セット（3行）として扱う。
// セット内は販売期間(period)と計画函数(plan)以外は同一値（グリッドでセル結合表示）。
// 販売期間ごとの箱数（＝計画函数 plan）を配列で受け取り3行を生成する。
const GIFT_PERIODS = ['上旬', '中旬', '下旬'];
const buildGiftSet = (
  giftSetId: string,
  base: Omit<ProductData, 'period' | 'plan' | 'estimate' | 'giftSetId'>,
  plans: [string, string, string]
): ProductData[] =>
  GIFT_PERIODS.map((period, i) => ({
    ...base,
    giftSetId,
    period,
    plan: plans[i],
    estimate: plans[i],
  }));

const GIFT_SET_1_BASE: Omit<
  ProductData,
  'period' | 'plan' | 'estimate' | 'giftSetId'
> = {
  section: 'ギフト',
  productCategory: 'ギフト',
  metaBrand: 'アサヒ飲料',
  containerCapacityG: '500mL',
  summaryProduct: 'カルピスギフトセット',
  wholesaleMesh: 'ギフト',
  endSale: '2025/12',
  promotion: 'ギフト',
  quantity: '24',
  actual: '480',
  prevYear: '450',
  ratio: '98.10%',
  net: '174.00',
  planPrice: '200.00',
  prevYearPrice: '195.00',
  price: '250',
  margin: '13.00%',
  volumeAddRate: '2.30%',
  externalSales: '220.00',
  delivery: '200.00',
  discount: '20.00%',
  profit: '12.00%',
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
};

const GIFT_SET_2_BASE: Omit<
  ProductData,
  'period' | 'plan' | 'estimate' | 'giftSetId'
> = {
  section: 'ギフト',
  productCategory: 'ギフト',
  metaBrand: 'アサヒ飲料',
  containerCapacityG: '660mL',
  summaryProduct: '十六茶ギフトセット',
  wholesaleMesh: 'ギフト',
  endSale: '2025/10',
  promotion: 'ギフト',
  quantity: '1',
  actual: '280',
  prevYear: '280',
  ratio: '97.20%',
  net: '126.00',
  planPrice: '144.00',
  prevYearPrice: '140.00',
  price: '180',
  margin: '12.50%',
  volumeAddRate: '3.30%',
  externalSales: '180.00',
  delivery: '144.00',
  discount: '20.00%',
  profit: '11.10%',
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
};

// 実績なしのギフトセット。buildGiftSet は当月着地見込に計画函数を入れるため、
// 削除確認用（実績データがすべて空）のセットは別に組み立てる。
const buildNoActualGiftSet = (
  giftSetId: string,
  base: Omit<ProductData, 'period' | 'plan' | 'estimate' | 'giftSetId'>,
  plans: [string, string, string]
): ProductData[] =>
  GIFT_PERIODS.map((period, i) => ({
    ...base,
    giftSetId,
    period,
    plan: plans[i],
    estimate: '',
    actual: '',
    prevYear: '',
    ratio: '',
    prevYearPrice: '',
  }));

export const GIFT_PRODUCTS_DATA: ProductData[] = [
  ...buildGiftSet('gift-set-1', GIFT_SET_1_BASE, ['500', '300', '200']),
  ...buildGiftSet('gift-set-2', GIFT_SET_2_BASE, ['300', '200', '150']),
  // 削除確認用：実績データが空で削除できるセット（2セット）
  ...buildNoActualGiftSet('gift-set-3', GIFT_SET_1_BASE, ['120', '80', '60']),
  ...buildNoActualGiftSet('gift-set-4', GIFT_SET_2_BASE, ['100', '70', '50']),
];

// ── エクスポート用ダミーデータ ──
// 実際のアプリではAPIから取得
export const generateDummyProductData = () => {
  const brands = ['三ツ矢', 'カルピス', 'ウィルキンソン', '十六茶', 'ワンダ'];
  const promotionTypes = ['定番・EDLP', '新商品', '特殊商品', 'ギフト'];
  const data = [];

  for (let i = 0; i < 20; i++) {
    data.push({
      promotionType: promotionTypes[i % 4],
      metaBrand: brands[i % 5],
      summaryProductName: `${brands[i % 5]}商品${i + 1}`,
      generalMesh: `M${100000 + i}`,
      endSale: i % 10 === 0 ? '終売' : '',
      quantity: [8, 12, 24, 30][i % 4],
      planBoxes: [800, 500, 300, 200][i % 4],
      currentEstimate: [800, 480, 290, 190][i % 4],
      currentActual: [445, 250, 150, 100][i % 4],
      prevYearActual: [800, 500, 300, 200][i % 4],
      planVsPrevYear: [100.0, 96.0, 96.7, 95.0][i % 4],
      net: [62.13, 58.5, 50.0, 36.68][i % 4],
      deliveryPrice: [55.0, 52.0, 45.0, 33.0][i % 4],
      sellingPrice: [120, 115, 100, 80][i % 4],
      marginRate: [11.2, 10.5, 9.8, 9.0][i % 4],
      markupRate: [54.2, 54.8, 55.0, 58.8][i % 4],
      seihan: [11000, 14000, 10500, 8800][i % 4],
      ukewatashi: [10500, 13500, 10000, 8400][i % 4],
      profitRate: [23.1, 18.5, 23.1, 8.5][i % 4],
      exp1Amount: i % 3 === 0 ? 50000 : 0,
      exp1PostingMonth: i % 3 === 0 ? 10 : 0,
      exp1DeliveryMonth: i % 3 === 0 ? 10 : 0,
      exp1ManagementClass: i % 3 === 0 ? '販促費' : '',
      exp1ManagementCode: i % 3 === 0 ? 'A001' : '',
      exp1Description: i % 3 === 0 ? '新商品導入費' : '',
      exp2Amount: 0,
      exp2PostingMonth: 0,
      exp2DeliveryMonth: 0,
      exp2ManagementClass: '',
      exp2ManagementCode: '',
      exp2Description: '',
    });
  }
  return data;
};

export const generateDummyNonProductExpenseData = () => {
  return [
    {
      metaBrand: '三ツ矢',
      summaryProduct: '三ツ矢サイダー500mL24本',
      exp1PlannedAmount: 150000,
      exp1PriorYearActual: 0,
      exp1PostingMonth: '2025-10',
      exp1ManagementClass: '拡売費A',
      exp1ManagementCode: 'A001',
      exp1AccountItem: '販促費',
      exp1CampaignClass: '',
      exp1CampaignCode: '',
      exp1Description: '店頭POP費用',
    },
    {
      metaBrand: 'カルピス',
      summaryProduct: 'カルピスウォーター500mL24本',
      exp1PlannedAmount: 300000,
      exp1PriorYearActual: 0,
      exp1PostingMonth: '2025-10',
      exp1ManagementClass: '拡売費B',
      exp1ManagementCode: 'B002',
      exp1AccountItem: '広告費',
      exp1CampaignClass: '',
      exp1CampaignCode: '',
      exp1Description: 'TV-CM放映費',
    },
    {
      metaBrand: 'ウィルキンソン',
      summaryProduct: 'ウィルキンソン炭酸水1L12本',
      exp1PlannedAmount: 200000,
      exp1PriorYearActual: 0,
      exp1PostingMonth: '2025-10',
      exp1ManagementClass: '拡売費A',
      exp1ManagementCode: 'A003',
      exp1AccountItem: '販促費',
      exp1CampaignClass: '',
      exp1CampaignCode: '',
      exp1Description: 'サンプリング費用',
    },
  ];
};

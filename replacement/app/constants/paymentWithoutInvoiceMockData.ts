// 支払詳細(追加口請求書無) ─ 支払回数ごとのモック明細（追加口明細・拡売費明細）。
//
// 画面（page.tsx）と集計のテスト（paymentDetailAggregates.test.ts）の両方がこのモジュールの
// 明細を使う。明細を変えたら画面とテストが一緒に変わる（ずれないようにするため）。
//
// 支払回数ごとにデータ元をばらつかせる。本画面は EDI を持たないため、拡売費のデータ元は
// AIC入力 と 手入力 の2種類だけとする。
//   支払回数1 … 追加口あり（実販FACTから自動で作る。データ元の区分を持たず、直せない）。
//                拡売費は AIC入力 と 手入力 の混在
//   支払回数2 … 追加口は無し。拡売費は AIC入力 と 手入力 の混在（手入力が多い回）
//   支払回数3 … 追加口は無し。拡売費は AIC入力 と 手入力 の混在（AIC入力が多い回）
// 手入力の明細は「明細追加で作った明細」か「AIC入力の明細を手で直した結果」
// （originDataSource に元のデータ元を持つ）のどちらか。
import type { EntryRow } from '../components/payment/payment-detail-without-invoice/components/DetailTable';
import {
  createBlankExpenseRow,
  type ExpenseRow,
} from '../components/shared/payment/payment-detail/PaymentNonProductExpensePane';
import { deriveWithoutInvoiceEntryRow } from '../utils/payment/payment-detail/additionalEntryRules';
import type { SummaryFixedValues } from '../utils/payment/payment-detail/paymentSummaryAggregate';

// 支払回数の選択肢（プルダウンの表示順）。
export const WITHOUT_INVOICE_PAYMENT_ROUNDS = ['1', '2', '3'];

// 既定で表示する支払回数。モックのため3回目にしている。
// 3回目は拡売費にデータ元の違う明細（AIC入力・手入力）が混在するため、開いた時点で
// データ元ごとの表示と合計表のデータ元別の列を見られるようにする（業務の決まりではない）。
export const WITHOUT_INVOICE_DEFAULT_ROUND = '3';

// 派生項目（deriveWithoutInvoiceEntryRow で導く）の既定値。
const DERIVED_BLANK = {
  addUnit: '',
  addAmount: '',
  payAmount: '',
};

// 支払回数1の追加口明細（実販FACTの実績を1行1明細で表示する）。
// 支払NET（追加口分）は計画NETと同じ値（→ 補足1-6 b21.t8）。
// 追加口バラ単価・追加口金額・支払金額は deriveWithoutInvoiceEntryRow で導く。
const ROUND1_ENTRY_ROWS: EntryRow[] = [
  {
    ...DERIVED_BLANK,
    lineNo: 1,
    productCode: '45160011',
    productName: 'ワンダ金の微糖185g30本',
    capacity: 24,
    seihan: 161,
    planNet: 92,
    addNet: 92,
    payCases: 180,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 2,
    productCode: '45160042',
    productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    capacity: 24,
    seihan: 154,
    planNet: 88,
    addNet: 88,
    payCases: 150,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 3,
    productCode: '45160042',
    productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    capacity: 24,
    seihan: 154,
    planNet: 88,
    addNet: 88,
    payCases: 0,
    payLoose: 24,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 4,
    productCode: '45160011',
    productName: 'ワンダ金の微糖185g30本',
    capacity: 5,
    seihan: 642,
    planNet: 452,
    addNet: 452,
    payCases: 40,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 5,
    productCode: '45160011',
    productName: 'ワンダ金の微糖185g30本',
    capacity: 5,
    seihan: 642,
    planNet: 452,
    addNet: 452,
    payCases: 30,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 6,
    productCode: '45160028',
    productName: 'ワンダモーニングショット185g30本',
    capacity: 5,
    seihan: 642,
    planNet: 452,
    addNet: 452,
    payCases: 62,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 7,
    productCode: '45160028',
    productName: 'ワンダモーニングショット185g30本',
    capacity: 5,
    seihan: 642,
    planNet: 452,
    addNet: 452,
    payCases: 100,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 8,
    productCode: '45160035',
    productName: 'ワンダ ボトルコーヒー微糖500mL24本',
    capacity: 24,
    seihan: 168,
    planNet: 95,
    addNet: 95,
    payCases: 250,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 9,
    productCode: '45160042',
    productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    capacity: 24,
    seihan: 161,
    planNet: 90,
    addNet: 90,
    payCases: 200,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 10,
    productCode: '45130042',
    productName: '三ツ矢サイダー250mL30本',
    capacity: 30,
    seihan: 89.5,
    planNet: 38.35,
    addNet: 38.35,
    payCases: 30,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 11,
    productCode: '45130042',
    productName: '三ツ矢サイダー250mL30本',
    capacity: 30,
    seihan: 89.5,
    planNet: 38.35,
    addNet: 38.35,
    payCases: 90,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 12,
    productCode: '45130042',
    productName: '三ツ矢サイダー250mL30本',
    capacity: 30,
    seihan: 89.5,
    planNet: 38.35,
    addNet: 38.35,
    payCases: 20,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 13,
    productCode: '45130042',
    productName: '三ツ矢サイダー250mL30本',
    capacity: 30,
    seihan: 71.5,
    planNet: 40,
    addNet: 40,
    payCases: 21,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 14,
    productCode: '45130066',
    productName: '三ツ矢サイダー350mL28本',
    capacity: 24,
    seihan: 112,
    planNet: 85,
    addNet: 85,
    payCases: 20,
    payLoose: 0,
    summary: '',
    summary1: '',
  },
  {
    ...DERIVED_BLANK,
    lineNo: 15,
    productCode: '45130059',
    productName: '三ツ矢サイダー500mL24本',
    capacity: 24,
    seihan: 140,
    planNet: 85,
    addNet: 85,
    payCases: '',
    payLoose: 1,
    summary: '',
    summary1: '',
  },
];

// 支払回数の追加口明細を新規生成する（回ごとに独立した実体を持たせる）。
// 支払回数2・3は追加口の明細を持たない（実販FACTの実績は1回目にまとめて載る）。
export const createWithoutInvoiceEntryRows = (round: string): EntryRow[] =>
  round === '1'
    ? ROUND1_ENTRY_ROWS.map((row) => deriveWithoutInvoiceEntryRow({ ...row }))
    : [];

// 拡売費明細1行（BLANK を基にした差分）。照合支払区分は、請求と支払が一致する「照合支払:0」を
// 既定とし、差額が出る明細だけ個別に持つ。
const expenseOf = (fields: Partial<ExpenseRow>): ExpenseRow => ({
  ...createBlankExpenseRow(),
  matchType: '照合支払:0',
  ...fields,
});

// グループ合計行（その他拡売費合計）。本画面は未承認NETの一覧を持たないため、その他だけを持つ。
// 金額は画面の数式で再集計する。
const OTHER_GROUP_ROW = (): ExpenseRow =>
  expenseOf({
    isGroup: true,
    product: 'その他拡売費合計',
    payAmount: 0,
    matchType: '',
    planAmount: 0,
  });

// 支払回数1の拡売費：AIC入力 と 手入力。
const round1ExpenseRows = (): ExpenseRow[] => [
  expenseOf({
    lineNo: 1,
    dataSource: 'AIC入力',
    planLinked: true,
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    billNote: 'アプリ20%相当の販促値引',
    billAmount: 57433,
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    payAmount: 57433,
    planAmount: 27433,
    taxClass: '課税8%:2',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    billNo: '457801SA',
    summary1: 'アプリ施策の値引き原資（社内）',
    summary2: 'アプリ20%相当の販促値引（社外）',
    billPage: '①02',
  }),
  // 費用分割先（No.1 の分割明細。枝番行は合計表に含めない）。
  expenseOf({
    lineNo: '1-1',
    dataSource: 'AIC入力',
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    billNote: 'アプリ20%相当の販促値引',
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    payAmount: 20000,
    costSplit: '分割先',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    summary1: '東日本支社より分割',
    summary2: 'アプリ20%相当の販促値引（社外）',
    splitPrimaryStore: '三菱食品株式会社（イオン）:10888030',
    splitTertiaryStore: 'イオン東北ＲＤＣ:10863223',
    splitStore: 'イオンリテール:21100677',
    splitDept: '首都圏営業第二部:10002990',
    splitStaff: 'アサヒ　太郎:5172733',
  }),
  // 支払金額を 600→0 に直した（手入力。元はAIC入力）。
  expenseOf({
    lineNo: 2,
    dataSource: '手入力',
    originDataSource: 'AIC入力',
    planLinked: true,
    billName: 'アサヒ飲料 三ツ矢サイダー 試飲会費用　30店日',
    billNote: '試飲会費用（30店日）',
    billAmount: 600,
    planExpContent: '三ツ矢',
    product: '-',
    payAmount: 0,
    matchType: '条件違い:2',
    planAmount: 600,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    billNo: '457803SA',
    summary1: '試飲会は中止（社内）',
    summary2: '試飲会30店日分の実施（社外）',
    billPage: '①02',
  }),
  // 明細追加で作った明細（手入力）。
  expenseOf({
    lineNo: 3,
    dataSource: '手入力',
    planLinked: true,
    billName: 'アサヒ飲料 ワンダ アプリエントリーキャンペーン費',
    billNote: 'アプリエントリーキャンペーン',
    billAmount: 200,
    planExpContent: 'ブランド横断(全商品)',
    product: '-',
    payAmount: 200,
    planAmount: 200,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    billNo: '457802SA',
    summary1: 'アプリ会員エントリー費（社内）',
    summary2: 'アプリ会員登録キャンペーン（社外）',
    billPage: '①02',
  }),
  expenseOf({
    lineNo: 4,
    dataSource: 'AIC入力',
    planLinked: true,
    billName: 'アサヒ飲料 ウィルキンソン 棚替え協力費',
    billNote: '新商品棚替え協力',
    billAmount: 30000,
    planExpContent: 'ウィルキンソン',
    product: 'ウィルキンソン炭酸水500mL24本',
    payAmount: 30000,
    planAmount: 30000,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'リピート',
    measureCode: 'SR001',
    summary1: '棚替え什器協力費（社内）',
    summary2: '新商品棚替え協力（社外）',
    billNo: '457804SA',
    billPage: '①02',
  }),
];

// 支払回数2の拡売費：AIC入力 と 手入力。
const round2ExpenseRows = (): ExpenseRow[] => [
  expenseOf({
    lineNo: 1,
    dataSource: 'AIC入力',
    billName: 'アサヒ飲料 ワンダ金の微糖 実販連動拡売費',
    billNote: '販売実績連動の拡売費',
    billAmount: 48000,
    planExpContent: 'ワンダ',
    product: 'ワンダ金の微糖185g30本',
    payAmount: 48000,
    planAmount: 48000,
    taxClass: '課税8%:2',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: '実販連動の拡売費（社内）',
    summary2: '販売実績に応じた拡売費（社外）',
    billNo: '457929SA',
    billPage: '②01',
  }),
  // 支払金額を 24,000→21,000 に直した（手入力。元はAIC入力）。
  expenseOf({
    lineNo: 2,
    dataSource: '手入力',
    originDataSource: 'AIC入力',
    billName: 'アサヒ飲料 三ツ矢サイダー 実販連動拡売費',
    billNote: '販売実績連動の拡売費',
    billAmount: 24000,
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー250mL30本',
    payAmount: 21000,
    matchType: '数量違い:1',
    planAmount: 24000,
    taxClass: '課税8%:2',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    measureClass: '販売促進',
    measureCode: 'SP002',
    summary1: '返品分を差し引いて減額（社内）',
    summary2: '販売実績に応じた拡売費（社外）',
    billNo: '457930SA',
    billPage: '②01',
  }),
  // 明細追加で作った明細（手入力）。
  expenseOf({
    lineNo: 3,
    dataSource: '手入力',
    billName: 'アサヒ飲料 カルピスウォーター 店頭サンプリング費',
    billNote: '店頭サンプリング（10店）',
    billAmount: 9000,
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    payAmount: 9000,
    planAmount: 9000,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    summary1: '店頭サンプリング費（社内）',
    summary2: '店頭サンプリング（社外）',
    billNo: '457931SA',
    billPage: '②01',
  }),
];

// 支払回数3の拡売費：AIC入力 と 手入力。
const round3ExpenseRows = (): ExpenseRow[] => [
  expenseOf({
    lineNo: 1,
    dataSource: 'AIC入力',
    billName: 'アサヒ飲料 ワンダ モーニングショット 実販連動拡売費',
    billNote: '販売実績連動の拡売費',
    billAmount: 36000,
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    payAmount: 36000,
    planAmount: 36000,
    taxClass: '課税8%:2',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: '実販連動の拡売費（社内）',
    summary2: '販売実績に応じた拡売費（社外）',
    billNo: '458040SA',
    billPage: '③01',
  }),
  expenseOf({
    lineNo: 2,
    dataSource: 'AIC入力',
    planLinked: true,
    billName: 'アサヒ飲料 カルピス アプリクーポン費',
    billNote: 'アプリクーポン',
    billAmount: 12000,
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    payAmount: 12000,
    planAmount: 12000,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: '販売促進',
    measureCode: 'SP003',
    summary1: 'アプリクーポン原資（社内）',
    summary2: 'アプリクーポン（社外）',
    billNo: '458041SA',
    billPage: '③01',
  }),
  // 支払金額を 8,000→6,500 に直した（手入力。元はAIC入力）。
  expenseOf({
    lineNo: 3,
    dataSource: '手入力',
    originDataSource: 'AIC入力',
    planLinked: true,
    billName: 'アサヒ飲料 ウィルキンソン 棚替え協力費',
    billNote: '棚替え協力（8店）',
    billAmount: 8000,
    planExpContent: 'ウィルキンソン',
    product: 'ウィルキンソン炭酸水500mL24本',
    payAmount: 6500,
    matchType: '数量違い:1',
    planAmount: 8000,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'リピート',
    measureCode: 'SR001',
    summary1: '実施は6.5店分（社内）',
    summary2: '棚替え協力（社外）',
    billNo: '458042SA',
    billPage: '③01',
  }),
  // 明細追加で作った明細（手入力）。
  expenseOf({
    lineNo: 4,
    dataSource: '手入力',
    billName: 'アサヒ飲料 十六茶 チラシ協賛',
    billNote: '',
    billAmount: 3000,
    planExpContent: '十六茶',
    product: '十六茶630mL24本',
    payAmount: 3000,
    planAmount: 3000,
    taxClass: 'その他(5%):3',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    summary1: 'チラシ協賛費（社内）',
    summary2: 'チラシ掲載協賛（社外）',
    billNo: '458043SA',
    billPage: '③02',
  }),
  expenseOf({
    lineNo: 5,
    dataSource: 'AIC入力',
    billName: 'アサヒ飲料 ドデカミン 売場協賛金',
    billNote: '売場協賛金（非課税）',
    billAmount: 2000,
    planExpContent: 'ドデカミン',
    product: '-',
    payAmount: 2000,
    planAmount: 0,
    taxClass: 'その他(非課税):4',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'スポット',
    measureCode: 'SS002',
    summary1: '売場協賛金（社内）',
    summary2: '売場協賛金（社外）',
    billNo: '458044SA',
    billPage: '③02',
  }),
];

const EXPENSE_ROWS_BY_ROUND: Record<string, () => ExpenseRow[]> = {
  '1': round1ExpenseRows,
  '2': round2ExpenseRows,
  '3': round3ExpenseRows,
};

// 支払回数の拡売費明細を新規生成する（グループ合計行＋明細）。モックに無い回は明細0件。
export const createWithoutInvoiceExpenseRows = (
  round: string
): ExpenseRow[] => [
  OTHER_GROUP_ROW(),
  ...(EXPENSE_ROWS_BY_ROUND[round]?.() ?? []),
];

// ── 支払情報サマリの固定値 ───────────────────────────────
// 実販FACT から集計する値（実販函数・納品金額・社外売上高）は本画面の明細からは求めないため、
// 固定値で持つ。値は全支払回数の明細から求めた支払の行と並べて比率が自然になるよう置いた
//（初期表示：追加口率 約42%、函数の差 −2）。
// 管理利益額は計算式が無いため「基準の管理利益額＋（売上高−基準の売上高）」で近似する。
// 基準は初期表示の売上高と、その 25.1%（見本の管理利益率）。
export const WITHOUT_INVOICE_ACTUAL_FUNC = 1192;
export const WITHOUT_INVOICE_SUMMARY_FIXED_VALUES: SummaryFixedValues = {
  externalSales: 4262000,
  deliveryAmount: 2740000,
  salesBasis: 2252713,
  mgmtProfitBasis: 565431,
};

// 支払詳細(追加口請求書有) ─ 支払回数ごとのモック明細（追加口明細・拡売費明細）。バックエンドをつないだら消す（→ 04 §画面ディレクトリ構成「モックデータ」）。
//
// 画面（page.tsx）と集計のテスト（paymentDetailAggregates.test.ts）の両方がこのモジュールの
// 明細を使う。明細を変えたら画面とテストが一緒に変わる（ずれないようにするため）。
//
// 支払回数ごとにデータ元をばらつかせる（利用者の決定 2026-10-03）。
//   支払回数1 … 請求EDI と 手入力 の混在
//   支払回数2 … AIC入力 と 手入力 の混在（未申請の回。追加口分割を編集できる）
//   支払回数3 … 請求EDI と AIC入力 と 手入力 の混在
// 手入力の明細は「明細追加で作った明細」か「請求EDI・AIC入力の明細を手で直した結果」
// （originDataSource に元のデータ元を持つ）のどちらか。
//
// 計画の種類（→ 補足2-1 No.10）の例も入れる。
//   一般卸メッシュ … 請求NET＜計画NET の請求EDI・AIC入力の明細は、取込・反映の時点で
//                    支払NET（追加口分）を計画NETにする（applyAutoTransfer）。赤くしない。
//   サマリ商品     … 請求NET＜計画NET の明細は赤く表示し、担当者が直す
//                    （B①：摘要1に理由／B②：支払NET（追加口分）を計画NETに／
//                      B③：支払NET（全体）を計画NETに。直した明細は手入力になる）
//   計画に無い商品 … 計画NETを空欄にし、赤く表示する
// 拡売費の「未承認NET」の明細は、追加口明細の拡売費金額（NET未承認）からサマリ商品ごとに作る
// （createNetUnapprovedRows）。支払金額は追加口明細の値と一致させる。
import type {
  AdditionalEntryData,
  ExpenseRow,
} from '@/app/types/paymentDetail';
import { BASIC_INFO } from '@/app/components/shared/payment/payment-detail/AdditionalPaymentBasicInfoPane';
import { createBlankExpenseRow } from '@/app/utils/payment/payment-detail/nonProductExpenseRows';
import {
  applyAutoTransfer,
  recalcEntryRow,
  type PlanType,
} from '@/app/utils/payment/payment-detail/additionalEntryRules';
import type { BilledCenterFeeRow } from '@/app/utils/payment/payment-detail/paymentBreakdownItems';
import type { SummaryFixedValues } from '@/app/utils/payment/payment-detail/paymentSummaryAggregate';
import type { DataSource } from '@/app/constants/dataSource';

// 支払回数の選択肢（プルダウンの表示順）。
export const WITH_INVOICE_PAYMENT_ROUNDS = ['1', '2', '3'];

// 既定で表示する支払回数。モックのため3回目にしている。
// 3回目はデータ元の違う明細（請求EDI・AIC入力・手入力）が混在するため、開いた時点で
// データ元ごとの表示と合計表のデータ元別の列を見られるようにする（業務の決まりではない）。
export const WITH_INVOICE_DEFAULT_ROUND = '3';

// 支払回数ごとの請求方法（→ 補足1-5 b16.t2）。請求EDIから反映した回＝請求EDI、
// AICが請求詳細から反映した回＝AIC入力。3回目はモックのため請求EDI・AIC入力の明細が混在する
// （本来は同じ回の中で請求方法は混在しない）ため、先に反映した請求EDIとする。
export const WITH_INVOICE_ROUND_BILLING_METHODS: Record<string, string> = {
  '1': '請求EDI',
  '2': 'AIC入力',
  '3': '請求EDI',
};

// 販売店名（請求書明細から引き継ぐ表示専用項目 → ★ASD決定案 ⑦請求情報）。
// 請求書は帳合（販売店）単位で届くため、モックでは基本情報の販売店の名称部分を全明細に出す。
export const BILL_RETAILER_NAME =
  BASIC_INFO.store.split(':')[1] ?? BASIC_INFO.store;

// サマリ商品ごとのセンターフィ率（ダミー）。センターフィ率は画面に出さないため、
// 計画情報として裏で持たせ、センターフィ額の算出にだけ使う。
// 一覧に無いサマリ商品（明細追加で選んだ商品など）は既定の率を使う。
// 率は、全支払回の合計が支払情報サマリの「センターフィ率」（販売計画書 2.5%）に近くなる値にしている。
const CENTER_FEE_RATE_BY_PRODUCT: Record<string, number> = {
  ワンダ金の微糖185g30本: 0.0126,
  ワンダ極上のラテ贅沢仕立て４００ｇ２４本: 0.0126,
  ワンダモーニングショット185g30本: 0.0147,
  'ワンダ ボトルコーヒー微糖500mL24本': 0.0126,
  三ツ矢サイダー250mL30本: 0.0105,
  三ツ矢サイダー350mL28本: 0.0105,
  三ツ矢サイダー500mL24本: 0.0105,
  カルピスウォーター500mL24本: 0.0126,
  ウィルキンソン炭酸水500mL24本: 0.0105,
};
const DEFAULT_CENTER_FEE_RATE = 0.0126;

// サマリ商品名からセンターフィ率（ダミー）を引く。サマリ商品が未選択なら空欄。
export const centerFeeRateOf = (productName: string): number | '' =>
  productName
    ? (CENTER_FEE_RATE_BY_PRODUCT[productName] ?? DEFAULT_CENTER_FEE_RATE)
    : '';

// サマリ商品名 → サマリ商品コード（追加口明細の8桁の体裁）。
export const ENTRY_PRODUCT_CODE_BY_NAME: Record<string, string> = {
  ワンダ金の微糖185g30本: '45160011',
  ワンダ極上のラテ贅沢仕立て４００ｇ２４本: '45160042',
  ワンダモーニングショット185g30本: '45160028',
  'ワンダ ボトルコーヒー微糖500mL24本': '45160035',
  三ツ矢サイダー250mL30本: '45130042',
  三ツ矢サイダー350mL28本: '45130066',
  三ツ矢サイダー500mL24本: '45130059',
  カルピスウォーター500mL24本: '45120169',
  ウィルキンソン炭酸水500mL24本: '45140103',
  十六茶630mL24本: '45150110',
  '三ツ矢サイダー1.5L8本': '45130073',
};
import type { EntryPlan } from '@/app/types/paymentDetail';
import { createNetUnapprovedRows } from '@/app/utils/payment/payment-detail/paymentWithInvoice';

const ENTRY_PLAN_BY_PRODUCT: Record<string, EntryPlan> = {
  ワンダ金の微糖185g30本: {
    capacity: 24,
    seihan: 161,
    planNet: 92,
    planType: 'サマリ商品',
  },
  ワンダ極上のラテ贅沢仕立て４００ｇ２４本: {
    capacity: 24,
    seihan: 154,
    planNet: 88,
    planType: '一般卸メッシュ',
  },
  ワンダモーニングショット185g30本: {
    capacity: 5,
    seihan: 642,
    planNet: 452,
    planType: '一般卸メッシュ',
  },
  'ワンダ ボトルコーヒー微糖500mL24本': {
    capacity: 24,
    seihan: 168,
    planNet: 95,
    planType: 'サマリ商品',
  },
  三ツ矢サイダー250mL30本: {
    capacity: 30,
    seihan: 89.5,
    planNet: 38.35,
    planType: '一般卸メッシュ',
  },
  三ツ矢サイダー350mL28本: {
    capacity: 24,
    seihan: 112,
    planNet: 85,
    planType: 'サマリ商品',
  },
  三ツ矢サイダー500mL24本: {
    capacity: 24,
    seihan: 140,
    planNet: 85,
    planType: 'サマリ商品',
  },
  カルピスウォーター500mL24本: {
    capacity: 24,
    seihan: 120,
    planNet: 70,
    planType: '一般卸メッシュ',
  },
  ウィルキンソン炭酸水500mL24本: {
    capacity: 24,
    seihan: 110,
    planNet: 62,
    planType: 'サマリ商品',
  },
  // 計画に無いサマリ商品（→ 利用者の決定 Q6）。
  十六茶630mL24本: { capacity: 24, seihan: 105, planNet: '' },
};

// サマリ商品の当月の販売計画（計画に無いサマリ商品は undefined）。
// 明細追加・追加口処理で足す明細の計画情報（計画NET・社外売上高単価・計画の種類）に使う
//（→ 補足1-5 b24.t5・t6：同じサマリ商品の計画行のうち最も安い計画NET）。
export const entryPlanOf = (productName: string): EntryPlan | undefined => {
  const plan = ENTRY_PLAN_BY_PRODUCT[productName];
  return plan && plan.planNet !== '' ? plan : undefined;
};

// ── この画面のモックの商品マスタの値（サマリ商品のNET・社外売上高単価） ──
// 共通の商品マスタ（constants/productMasters）は、販売計画の画面（計画詳細・シミュレーション等）の
// 計画がそこから作られているため変えない。この画面の計画（ENTRY_PLAN_BY_PRODUCT）は、明細の金額に
// 合わせて共通マスタより高い水準で作ってあるため、この画面で使うマスタの値も同じ水準にそろえる
//（→ 利用者の決定 2026-10-05）。明細追加の支払NET（追加口分・全体）の初期値（マスタNET）や、
// 計画に無いサマリ商品の社外売上高単価・計画NETに使う。
//   ・計画のあるサマリ商品 … NET＝計画NET、社外売上高単価＝計画の社外売上高単価
//   ・計画に無いが、この画面の計画情報に社外売上高単価があるサマリ商品（十六茶630mL24本）
//       … 社外売上高単価はその値。NETは共通マスタのNETを同じ倍率（社外売上高単価の比）で上げる
//   ・そのほかのサマリ商品 … 共通マスタのNET・社外売上高単価を WITH_INVOICE_MASTER_SCALE 倍にする
//     （倍率は、計画のあるサマリ商品の「計画の社外売上高単価÷共通マスタの社外売上高単価」の中央値）
export const WITH_INVOICE_MASTER_SCALE = 2;

const round2 = (v: number): number => Math.round(v * 100) / 100;

export const withInvoiceMasterValuesOf = (
  productName: string,
  common: { net: number | ''; seihan: number | '' }
): { net: number | ''; seihan: number | '' } => {
  const plan = ENTRY_PLAN_BY_PRODUCT[productName];
  if (plan && plan.planNet !== '')
    return { net: plan.planNet, seihan: plan.seihan };
  const scale =
    plan && common.seihan !== '' && common.seihan > 0
      ? plan.seihan / common.seihan
      : WITH_INVOICE_MASTER_SCALE;
  return {
    net: common.net === '' ? '' : round2(common.net * scale),
    seihan: plan
      ? plan.seihan
      : common.seihan === ''
        ? ''
        : round2(common.seihan * scale),
  };
};

// 追加口明細の空行（各明細はこれを基にした差分だけを書く）。
const EMPTY_ENTRY: AdditionalEntryData = {
  lineNo: '',
  productCode: '',
  productName: '',
  capacity: '',
  cases: '',
  loose: '',
  unitPrice: '',
  amount: '',
  payCases: '',
  payLoose: '',
  addUnit: '',
  expUnit: '',
  addAmount: '',
  expAmount: 0,
  payAmount: '',
  diff: '',
  matchType: '照合支払:0',
  expProcess: '-',
  seihan: '',
  planNet: '',
  billNet: '',
  addNet: '',
  payNet: '',
  billDetailNo: '',
  billPage: '',
  retailerName: '',
  summary1: '',
  summary: '',
  funcCheck: false,
  finalNet: '',
};

// 追加口明細1行の入力値。支払のケース・バラ・支払NETは省略すると請求の値（取込時の初期値）。
interface EntrySeed {
  lineNo: number;
  dataSource: DataSource;
  // 手で直した明細の元のデータ元（直した明細は dataSource を手入力にする）。
  originDataSource?: DataSource;
  productName: string;
  billNet: number | string;
  cases: number | '';
  loose: number | '';
  addNet?: number | string;
  payNet?: number | string;
  payCases?: number | '';
  payLoose?: number | '';
  matchType?: string;
  summary?: string;
  summary1?: string;
  // 函数無効チェックON の明細（最終NETを手で入れる）。派生項目は ON にする前の値のまま。
  funcCheck?: boolean;
  finalNet?: number | '';
  billDetailNo: string;
  billPage: string;
  // 計画情報を明細ごとに持つ場合（支払回数1の明細）。省略時は当月の販売計画から引く。
  plan?: EntryPlan;
  // 明細の値をそのまま持つ項目（支払回数1の No.15 のように計算式で求めない明細）。
  fixed?: Partial<AdditionalEntryData>;
}

// 入力値から追加口明細1行を作る。派生項目は計算式（recalcEntryRow）で求め、
// 取込・反映した請求EDI・AIC入力の明細には一般卸メッシュの自動振替（applyAutoTransfer）を当てる。
const entryOf = (seed: EntrySeed): AdditionalEntryData => {
  const plan = seed.plan ?? ENTRY_PLAN_BY_PRODUCT[seed.productName];
  const row: AdditionalEntryData = {
    ...EMPTY_ENTRY,
    lineNo: seed.lineNo,
    dataSource: seed.dataSource,
    ...(seed.originDataSource
      ? { originDataSource: seed.originDataSource }
      : {}),
    productCode: ENTRY_PRODUCT_CODE_BY_NAME[seed.productName] ?? '',
    productName: seed.productName,
    capacity: plan.capacity,
    seihan: plan.seihan,
    planNet: plan.planNet,
    planType: plan.planType,
    centerFeeRate: centerFeeRateOf(seed.productName),
    billNet: seed.billNet,
    cases: seed.cases,
    loose: seed.loose,
    addNet: seed.addNet ?? seed.billNet,
    payNet: seed.payNet ?? seed.billNet,
    payCases: seed.payCases ?? seed.cases,
    payLoose: seed.payLoose ?? seed.loose,
    matchType: seed.matchType ?? '照合支払:0',
    summary: seed.summary ?? '',
    summary1: seed.summary1 ?? '',
    billDetailNo: seed.billDetailNo,
    billPage: seed.billPage,
    retailerName: BILL_RETAILER_NAME,
    ...seed.fixed,
  };
  recalcEntryRow(row);
  applyAutoTransfer(row);
  if (seed.funcCheck) {
    row.funcCheck = true;
    row.finalNet = seed.finalNet ?? '';
  }
  return row;
};

// ── 支払回数1：請求EDI と 手入力 ───────────────────────────
// Excel「C_追加口・拡売費支払修正」の追加口表サンプルを基にした明細（計画情報は明細ごとに持つ）。
const plan1 = (
  capacity: number,
  seihan: number,
  planNet: number,
  planType: PlanType
): EntryPlan => ({ capacity, seihan, planNet, planType });

const ROUND1_ENTRY_SEEDS: EntrySeed[] = [
  // サマリ商品の計画で請求NET＜計画NET（赤）。B①：請求NETが正しいため摘要1に理由を書いた（手入力）。
  {
    lineNo: 1,
    dataSource: '手入力',
    originDataSource: '請求EDI',
    productName: 'ワンダ金の微糖185g30本',
    plan: plan1(24, 161, 92, 'サマリ商品'),
    billNet: 90,
    cases: 180,
    loose: 0,
    summary1: '計画修正漏れ',
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  {
    lineNo: 2,
    dataSource: '請求EDI',
    productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    plan: plan1(24, 154, 88, '一般卸メッシュ'),
    billNet: 90,
    cases: 150,
    loose: 0,
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  {
    lineNo: 3,
    dataSource: '請求EDI',
    productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    plan: plan1(24, 154, 88, '一般卸メッシュ'),
    billNet: 88,
    cases: 0,
    loose: 24,
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  {
    lineNo: 4,
    dataSource: '請求EDI',
    productName: 'ワンダ金の微糖185g30本',
    plan: plan1(5, 642, 452, 'サマリ商品'),
    billNet: 452,
    cases: 40,
    loose: 0,
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  {
    lineNo: 5,
    dataSource: '請求EDI',
    productName: 'ワンダ金の微糖185g30本',
    plan: plan1(5, 642, 452, 'サマリ商品'),
    billNet: 488,
    cases: 30,
    loose: 0,
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  {
    lineNo: 6,
    dataSource: '請求EDI',
    productName: 'ワンダモーニングショット185g30本',
    plan: plan1(5, 642, 452, '一般卸メッシュ'),
    billNet: 452,
    cases: 62,
    loose: 0,
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  {
    lineNo: 7,
    dataSource: '請求EDI',
    productName: 'ワンダモーニングショット185g30本',
    plan: plan1(5, 642, 452, '一般卸メッシュ'),
    billNet: 488,
    cases: 100,
    loose: 0,
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  // サマリ商品の計画で請求NET＜計画NET（赤）。B③：計画NETまでしか払わないため、
  // 支払NET（全体）だけを計画NETの95に直した（手入力）。支払NET（追加口分）は請求NETの92のままで、
  // 拡売費バラ単価（NET未承認）は 92−95＝−3 になる（→ 利用者の決定 Q4）。
  {
    lineNo: 8,
    dataSource: '手入力',
    originDataSource: '請求EDI',
    productName: 'ワンダ ボトルコーヒー微糖500mL24本',
    plan: plan1(24, 168, 95, 'サマリ商品'),
    billNet: 92,
    cases: 250,
    loose: 0,
    payNet: 95,
    matchType: '条件違い:2',
    summary: '納価訂正、条件違いの為訂正',
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  // 一般卸メッシュの計画で請求NET＜計画NET。取込の時点で支払NET（追加口分）を計画NETの90にした
  //（自動振替。データ元は請求EDIのまま）。差の 90−87＝3 が拡売費（NET未承認）になる。
  {
    lineNo: 9,
    dataSource: '請求EDI',
    productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    plan: plan1(24, 161, 90, '一般卸メッシュ'),
    billNet: 87,
    cases: 200,
    loose: 0,
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  {
    lineNo: 10,
    dataSource: '請求EDI',
    productName: '三ツ矢サイダー250mL30本',
    plan: plan1(30, 89.5, 38.35, '一般卸メッシュ'),
    billNet: 38.35,
    cases: 30,
    loose: 0,
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  {
    lineNo: 11,
    dataSource: '請求EDI',
    productName: '三ツ矢サイダー250mL30本',
    plan: plan1(30, 89.5, 38.35, '一般卸メッシュ'),
    billNet: 39.6,
    cases: 90,
    loose: 0,
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  {
    lineNo: 12,
    dataSource: '請求EDI',
    productName: '三ツ矢サイダー250mL30本',
    plan: plan1(30, 89.5, 38.35, '一般卸メッシュ'),
    billNet: 42,
    cases: 20,
    loose: 0,
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  {
    lineNo: 13,
    dataSource: '請求EDI',
    productName: '三ツ矢サイダー250mL30本',
    plan: plan1(30, 71.5, 40, '一般卸メッシュ'),
    billNet: 40,
    cases: 21,
    loose: 0,
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  // 数量違い：支払ケースを 20→18 に直した（手入力）。
  {
    lineNo: 14,
    dataSource: '手入力',
    originDataSource: '請求EDI',
    productName: '三ツ矢サイダー350mL28本',
    plan: plan1(24, 112, 85, 'サマリ商品'),
    billNet: 85,
    cases: 20,
    loose: 0,
    payCases: 18,
    matchType: '数量違い:1',
    summary: '2ケース未納のため数量訂正',
    billDetailNo: '457794SA',
    billPage: '①02',
  },
  // 明細追加で作った明細（手入力）。請求NET・支払NETを持たず、金額をそのまま持つ。
  {
    lineNo: 15,
    dataSource: '手入力',
    productName: '三ツ矢サイダー500mL24本',
    plan: plan1(24, 140, 85, 'サマリ商品'),
    billNet: '-',
    cases: '',
    loose: 1,
    addNet: '-',
    payNet: '-',
    billDetailNo: '457794SA',
    billPage: '①02',
    fixed: {
      unitPrice: 50000,
      addUnit: '',
      expUnit: '',
      addAmount: '',
      expAmount: 0,
      payAmount: 50000,
    },
  },
];

// ── 支払回数2：AIC入力 と 手入力 ───────────────────────────
const ROUND2_ENTRY_SEEDS: EntrySeed[] = [
  {
    lineNo: 1,
    dataSource: 'AIC入力',
    productName: 'カルピスウォーター500mL24本',
    billNet: 70,
    cases: 40,
    loose: 0,
    billDetailNo: '457911SA',
    billPage: '②01',
  },
  // 一般卸メッシュの計画で請求NET＜計画NET。反映の時点で支払NET（追加口分）を計画NETにした（自動振替）。
  {
    lineNo: 2,
    dataSource: 'AIC入力',
    productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    billNet: 85,
    cases: 60,
    loose: 0,
    billDetailNo: '457911SA',
    billPage: '②01',
  },
  {
    lineNo: 3,
    dataSource: 'AIC入力',
    productName: 'ワンダ金の微糖185g30本',
    billNet: 92,
    cases: 50,
    loose: 0,
    billDetailNo: '457911SA',
    billPage: '②01',
  },
  // 数量違い：支払ケースを 30→28 に直した（手入力）。
  {
    lineNo: 4,
    dataSource: '手入力',
    originDataSource: 'AIC入力',
    productName: 'ウィルキンソン炭酸水500mL24本',
    billNet: 62,
    cases: 30,
    loose: 0,
    payCases: 28,
    matchType: '数量違い:1',
    summary: '2ケース破損のため数量訂正',
    billDetailNo: '457911SA',
    billPage: '②01',
  },
  // サマリ商品の計画で請求NET＜計画NET（赤）。B②：請求NETが正しく差額を拡売費で払うため、
  // 支払NET（追加口分）を計画NETの95に直した（手入力）。差の 95−93＝2 が拡売費（NET未承認）になる。
  {
    lineNo: 5,
    dataSource: '手入力',
    originDataSource: 'AIC入力',
    productName: 'ワンダ ボトルコーヒー微糖500mL24本',
    billNet: 93,
    cases: 80,
    loose: 0,
    addNet: 95,
    summary1: '請求NETが正しい。差額は拡売費で支払う',
    billDetailNo: '457911SA',
    billPage: '②01',
  },
  {
    lineNo: 6,
    dataSource: 'AIC入力',
    productName: '三ツ矢サイダー250mL30本',
    billNet: 39,
    cases: 0,
    loose: 18,
    billDetailNo: '457911SA',
    billPage: '②02',
  },
  // 明細追加で作った明細（手入力）。請求書の情報は担当者が入れた値。
  {
    lineNo: 7,
    dataSource: '手入力',
    productName: '三ツ矢サイダー350mL28本',
    billNet: 85,
    cases: 10,
    loose: 0,
    billDetailNo: '457912SA',
    billPage: '②03',
  },
  {
    lineNo: 8,
    dataSource: 'AIC入力',
    productName: '三ツ矢サイダー500mL24本',
    billNet: 88,
    cases: 12,
    loose: 0,
    billDetailNo: '457911SA',
    billPage: '②02',
  },
];

// ── 支払回数3：請求EDI と AIC入力 と 手入力 ──────────────────────
const ROUND3_ENTRY_SEEDS: EntrySeed[] = [
  {
    lineNo: 1,
    dataSource: '請求EDI',
    productName: 'ワンダ金の微糖185g30本',
    billNet: 92,
    cases: 120,
    loose: 0,
    billDetailNo: '458003SA',
    billPage: '③01',
  },
  // 一般卸メッシュの計画で請求NET＜計画NET。取込の時点で支払NET（追加口分）を計画NETにした（自動振替）。
  {
    lineNo: 2,
    dataSource: '請求EDI',
    productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    billNet: 84,
    cases: 90,
    loose: 0,
    billDetailNo: '458003SA',
    billPage: '③01',
  },
  {
    lineNo: 3,
    dataSource: '請求EDI',
    productName: 'ワンダモーニングショット185g30本',
    billNet: 452,
    cases: 50,
    loose: 0,
    billDetailNo: '458003SA',
    billPage: '③01',
  },
  // サマリ商品の計画で請求NET＜計画NET（赤）。B③：支払NET（全体）だけを計画NETの95に直した（手入力）。
  // 拡売費バラ単価（NET未承認）は 91−95＝−4 になる。
  {
    lineNo: 4,
    dataSource: '手入力',
    originDataSource: '請求EDI',
    productName: 'ワンダ ボトルコーヒー微糖500mL24本',
    billNet: 91,
    cases: 100,
    loose: 0,
    payNet: 95,
    matchType: '条件違い:2',
    summary: '計画NETで支払',
    billDetailNo: '458003SA',
    billPage: '③01',
  },
  {
    lineNo: 5,
    dataSource: '請求EDI',
    productName: '三ツ矢サイダー250mL30本',
    billNet: 38.35,
    cases: 60,
    loose: 0,
    billDetailNo: '458003SA',
    billPage: '③02',
  },
  // 一般卸メッシュの計画で請求NET＜計画NET（AIC入力）。反映の時点で自動振替した。
  {
    lineNo: 6,
    dataSource: 'AIC入力',
    productName: 'カルピスウォーター500mL24本',
    billNet: 66,
    cases: 30,
    loose: 0,
    billDetailNo: '458010SA',
    billPage: '③05',
  },
  // サマリ商品の計画で請求NET＜計画NET（赤）。B①：特売条件のため請求NETが正しく、
  // 摘要1に理由を書いた（手入力）。
  {
    lineNo: 7,
    dataSource: '手入力',
    originDataSource: 'AIC入力',
    productName: 'ウィルキンソン炭酸水500mL24本',
    billNet: 60,
    cases: 25,
    loose: 0,
    summary1: '特売条件のため請求NETが正しい',
    billDetailNo: '458010SA',
    billPage: '③05',
  },
  {
    lineNo: 8,
    dataSource: 'AIC入力',
    productName: '三ツ矢サイダー350mL28本',
    billNet: 85,
    cases: 15,
    loose: 0,
    billDetailNo: '458010SA',
    billPage: '③06',
  },
  // 函数無効チェックを付け、最終NETを入れた（手入力）。支払函数に含めない。
  {
    lineNo: 9,
    dataSource: '手入力',
    originDataSource: '請求EDI',
    productName: '三ツ矢サイダー500mL24本',
    billNet: 85,
    cases: 20,
    loose: 0,
    funcCheck: true,
    finalNet: 85,
    summary1: '販促用の無償出荷分のため函数に含めない',
    billDetailNo: '458003SA',
    billPage: '③02',
  },
  // 計画に無いサマリ商品（計画NETは空欄、赤）。
  {
    lineNo: 10,
    dataSource: '請求EDI',
    productName: '十六茶630mL24本',
    billNet: 64,
    cases: 30,
    loose: 0,
    billDetailNo: '458003SA',
    billPage: '③02',
  },
  // 明細追加で作った明細（手入力）。
  {
    lineNo: 11,
    dataSource: '手入力',
    productName: 'カルピスウォーター500mL24本',
    billNet: 70,
    cases: 0,
    loose: 12,
    billDetailNo: '458011SA',
    billPage: '③07',
  },
];

const ENTRY_SEEDS_BY_ROUND: Record<string, EntrySeed[]> = {
  '1': ROUND1_ENTRY_SEEDS,
  '2': ROUND2_ENTRY_SEEDS,
  '3': ROUND3_ENTRY_SEEDS,
};

// 支払回数の追加口明細を新規生成する（画面の編集は行オブジェクトへ直接反映されるため、
// 呼び出しのたびに新しい行を返す）。モックに無い回は明細0件。
export const createWithInvoiceEntryRows = (
  round: string
): AdditionalEntryData[] => (ENTRY_SEEDS_BY_ROUND[round] ?? []).map(entryOf);

// ── 拡売費明細 ─────────────────────────────────────

// 拡売費明細1行（BLANK を基にした差分）。
const expenseOf = (fields: Partial<ExpenseRow>): ExpenseRow => ({
  ...createBlankExpenseRow(),
  ...fields,
});

// グループ合計行（未承認NET拡売費合計・その他拡売費合計）。金額は画面の数式で再集計する。
const NET_GROUP_ROW = (): ExpenseRow =>
  expenseOf({
    isGroup: true,
    product: '未承認NET拡売費合計',
    payAmount: 0,
    planAmount: 0,
    summary1: 'NET差額拡売費自動振替分',
  });
const OTHER_GROUP_ROW = (): ExpenseRow =>
  expenseOf({
    isGroup: true,
    product: 'その他拡売費合計',
    payAmount: 0,
    planAmount: 0,
  });

// 支払回数1の拡売費（その他）：請求EDI と 手入力。
const round1OtherRows = (): ExpenseRow[] => [
  expenseOf({
    lineNo: 1,
    dataSource: '請求EDI',
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
    matchType: '照合支払:0',
    billPage: '①02',
  }),
  // 費用分割先（No.1 の分割明細。枝番行は合計表に含めない）。
  expenseOf({
    lineNo: '1-1',
    dataSource: '請求EDI',
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
  expenseOf({
    lineNo: '1-2',
    dataSource: '請求EDI',
    billName: 'アサヒ飲料 ワンダ モーニングショット ６Ｐ アプリ20',
    billNote: 'アプリ20%相当の販促値引',
    planExpContent: 'ワンダ',
    product: 'ワンダモーニングショット185g30本',
    payAmount: 10000,
    costSplit: '分割先',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA002',
    summary1: '中部支社より分割',
    splitPrimaryStore: '三菱食品株式会社（イオン）:10888030',
    splitTertiaryStore: 'イオン関東ＲＤＣ:10863241',
    splitStore: 'マックスバリュ関東:21100742',
    splitDept: '中部営業部:10003002',
    splitStaff: 'アサヒ　次郎:5172735',
  }),
  // 明細追加で作った明細（手入力）。
  expenseOf({
    lineNo: 2,
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
    matchType: '照合支払:0',
    billPage: '①02',
  }),
  // 支払金額を 600→0 に直した（手入力。元は請求EDI）。
  expenseOf({
    lineNo: 3,
    dataSource: '手入力',
    originDataSource: '請求EDI',
    planLinked: true,
    billName: 'アサヒ飲料 三ツ矢サイダー 試飲会費用　30店日',
    billNote: '試飲会費用（30店日）',
    billAmount: 600,
    planExpContent: '三ツ矢',
    product: '-',
    payAmount: 0,
    planAmount: 600,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    billNo: '457803SA',
    summary1: '店頭試飲会の実施費用（社内）',
    summary2: '試飲会30店日分の実施（社外）',
    matchType: '条件違い:2',
    billPage: '①02',
  }),
  // 支払金額を 30,000→0 に直した（手入力。元は請求EDI）。
  expenseOf({
    lineNo: 4,
    dataSource: '手入力',
    originDataSource: '請求EDI',
    planLinked: true,
    billName: 'アサヒ飲料 ウィルキンソン 棚替え協力費',
    billNote: '新商品棚替え協力',
    billAmount: 30000,
    planExpContent: 'ウィルキンソン',
    product: 'ウィルキンソン炭酸水500mL24本',
    payAmount: 0,
    planAmount: 30000,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'リピート',
    measureCode: 'SR001',
    summary1: '棚替え什器協力費（社内）',
    summary2: '新商品棚替え協力（社外）',
    matchType: '数量違い:1',
    billNo: '457804SA',
    billPage: '①02',
  }),
  // 追加口の No.15 から「拡売費処理」で移した明細（手入力）。「追加口処理」で追加口へ戻せる。
  expenseOf({
    lineNo: 5,
    dataSource: '手入力',
    planLinked: true,
    billAmount: 12000,
    sourceLineNo: 15,
    billName: 'アサヒ飲料 三ツ矢サイダーＰＥＴ５００ 店頭企画',
    billNote: '三ツ矢サイダー 店頭企画',
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー500mL24本',
    payAmount: 0,
    planAmount: 12000,
    taxClass: '課税8%:2',
    mgmtClass: '売上連動拡売費本社口',
    mgmtCode: 'RH001',
    measureClass: 'リピート',
    measureCode: 'SR002',
    summary1: '店頭販促企画の販促費（社内）',
    summary2: '三ツ矢サイダー店頭企画（社外）',
    matchType: '照合支払:0',
    billNo: '457805SA',
    billPage: '①02',
  }),
  // 計画紐づけ前の明細（請求EDI）。管理区分〜摘要2は空白。
  expenseOf({
    lineNo: 6,
    dataSource: '請求EDI',
    billName: 'アサヒ飲料 カルピスウォーター 店頭サンプリング費',
    billNote: 'カルピスウォーター 新商品サンプリング',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    billAmount: 8000,
    payAmount: 8000,
    planAmount: 0,
    taxClass: '課税8%:2',
    billNo: '457806SA',
    billPage: '①03',
  }),
  // No.6 と同じ請求の明細。支払金額を 8,000→0 に直した（手入力。元は請求EDI）。
  expenseOf({
    lineNo: 7,
    dataSource: '手入力',
    originDataSource: '請求EDI',
    billName: 'アサヒ飲料 カルピスウォーター 店頭サンプリング費',
    billNote: 'カルピスウォーター 新商品サンプリング',
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    billAmount: 8000,
    payAmount: 0,
    planAmount: 0,
    taxClass: '課税8%:2',
    matchType: '約束無し:5',
    billNo: '457806SA',
    billPage: '①03',
  }),
];

// 支払回数2の拡売費（その他）：AIC入力 と 手入力。
const round2OtherRows = (): ExpenseRow[] => [
  expenseOf({
    lineNo: 1,
    dataSource: 'AIC入力',
    planLinked: true,
    billName: 'アサヒ飲料 ウィルキンソン 棚替え協力費',
    billNote: '夏季棚替え協力',
    billAmount: 25000,
    planExpContent: 'ウィルキンソン',
    product: 'ウィルキンソン炭酸水500mL24本',
    payAmount: 25000,
    planAmount: 25000,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'リピート',
    measureCode: 'SR001',
    summary1: '棚替え什器協力費（社内）',
    summary2: '夏季棚替え協力（社外）',
    matchType: '照合支払:0',
    billNo: '457921SA',
    billPage: '②04',
  }),
  // 支払金額を 9,000→7,500 に直した（手入力。元はAIC入力）。
  expenseOf({
    lineNo: 2,
    dataSource: '手入力',
    originDataSource: 'AIC入力',
    planLinked: true,
    billName: 'アサヒ飲料 カルピスウォーター 店頭サンプリング費',
    billNote: '店頭サンプリング（15店）',
    billAmount: 9000,
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    payAmount: 7500,
    planAmount: 9000,
    taxClass: '課税8%:2',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP001',
    summary1: '実施は12.5店分（社内）',
    summary2: '店頭サンプリング（社外）',
    matchType: '数量違い:1',
    billNo: '457922SA',
    billPage: '②04',
  }),
  // 明細追加で作った明細（手入力）。
  expenseOf({
    lineNo: 3,
    dataSource: '手入力',
    billName: 'アサヒ飲料 十六茶 チラシ協賛',
    billNote: '',
    billAmount: 15000,
    planExpContent: '十六茶',
    product: '十六茶630mL24本',
    payAmount: 15000,
    planAmount: 15000,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    summary1: 'チラシ協賛費（社内）',
    summary2: 'チラシ掲載協賛（社外）',
    matchType: '照合支払:0',
    billNo: '457923SA',
    billPage: '②05',
  }),
  expenseOf({
    lineNo: 4,
    dataSource: 'AIC入力',
    planLinked: true,
    billName: 'アサヒ飲料 三ツ矢サイダー 試飲会費用　10店日',
    billNote: '試飲会費用（10店日）',
    billAmount: 4400,
    planExpContent: '三ツ矢',
    product: '-',
    payAmount: 4400,
    planAmount: 4400,
    taxClass: 'その他(5%):3',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS001',
    summary1: '店頭試飲会の実施費用（社内）',
    summary2: '試飲会10店日分の実施（社外）',
    matchType: '照合支払:0',
    billNo: '457924SA',
    billPage: '②05',
  }),
  expenseOf({
    lineNo: 5,
    dataSource: 'AIC入力',
    billName: 'アサヒ飲料 ワンダ 売場協賛金',
    billNote: '売場協賛金（非課税）',
    billAmount: 3000,
    planExpContent: 'ワンダ',
    product: '-',
    payAmount: 3000,
    planAmount: 0,
    taxClass: 'その他(非課税):4',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'スポット',
    measureCode: 'SS001',
    summary1: '売場協賛金（社内）',
    summary2: '売場協賛金（社外）',
    matchType: '照合支払:0',
    billNo: '457925SA',
    billPage: '②06',
  }),
];

// 支払回数3の拡売費（その他）：請求EDI と AIC入力 と 手入力。
const round3OtherRows = (): ExpenseRow[] => [
  expenseOf({
    lineNo: 1,
    dataSource: '請求EDI',
    planLinked: true,
    billName: 'アサヒ飲料 ワンダ 店頭什器設置費',
    billNote: '店頭什器（20店）',
    billAmount: 40000,
    planExpContent: 'ワンダ',
    product: '-',
    payAmount: 40000,
    planAmount: 40000,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'リピート',
    measureCode: 'SR001',
    summary1: '店頭什器の設置費（社内）',
    summary2: '店頭什器設置（社外）',
    matchType: '照合支払:0',
    billNo: '458021SA',
    billPage: '③03',
  }),
  // 費用分割先（No.1 の分割明細。枝番行は合計表に含めない）。
  expenseOf({
    lineNo: '1-1',
    dataSource: '請求EDI',
    billName: 'アサヒ飲料 ワンダ 店頭什器設置費',
    billNote: '店頭什器（20店）',
    planExpContent: 'ワンダ',
    product: '-',
    payAmount: 15000,
    costSplit: '分割先',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    summary1: '中部支社へ分割',
    splitPrimaryStore: '三菱食品株式会社（イオン）:10888030',
    splitTertiaryStore: 'イオン関東ＲＤＣ:10863241',
    splitStore: 'マックスバリュ関東:21100742',
    splitDept: '中部営業部:10003002',
    splitStaff: 'アサヒ　次郎:5172735',
  }),
  // 支払金額を 22,000→20,000 に直した（手入力。元は請求EDI）。
  expenseOf({
    lineNo: 2,
    dataSource: '手入力',
    originDataSource: '請求EDI',
    planLinked: true,
    billName: 'アサヒ飲料 三ツ矢サイダー 特売販促費',
    billNote: '特売販促（3日間）',
    billAmount: 22000,
    planExpContent: '三ツ矢',
    product: '三ツ矢サイダー250mL30本',
    payAmount: 20000,
    planAmount: 20000,
    taxClass: '課税8%:2',
    mgmtClass: '売上連動拡売費A口',
    mgmtCode: 'RA001',
    measureClass: '販売促進',
    measureCode: 'SP002',
    summary1: '計画額まで支払う（社内）',
    summary2: '特売販促（社外）',
    matchType: '条件違い:2',
    billNo: '458022SA',
    billPage: '③03',
  }),
  expenseOf({
    lineNo: 3,
    dataSource: 'AIC入力',
    planLinked: true,
    billName: 'アサヒ飲料 カルピス アプリクーポン費',
    billNote: 'アプリクーポン',
    billAmount: 3300,
    planExpContent: 'カルピス',
    product: 'カルピスウォーター500mL24本',
    payAmount: 3300,
    planAmount: 3300,
    taxClass: '課税10%:1',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: '販売促進',
    measureCode: 'SP003',
    summary1: 'アプリクーポン原資（社内）',
    summary2: 'アプリクーポン（社外）',
    matchType: '照合支払:0',
    billNo: '458031SA',
    billPage: '③08',
  }),
  // 摘要1を直した（手入力。元はAIC入力）。
  expenseOf({
    lineNo: 4,
    dataSource: '手入力',
    originDataSource: 'AIC入力',
    billName: 'アサヒ飲料 ウィルキンソン 売場協賛金',
    billNote: '売場協賛金（非課税）',
    billAmount: 5000,
    planExpContent: 'ウィルキンソン',
    product: '-',
    payAmount: 5000,
    planAmount: 0,
    taxClass: 'その他(非課税):4',
    mgmtClass: '拡売費(固定費)A口',
    mgmtCode: 'FA002',
    measureClass: 'スポット',
    measureCode: 'SS002',
    summary1: '協賛金の内訳を確認済（社内）',
    summary2: '売場協賛金（社外）',
    matchType: '照合支払:0',
    billNo: '458032SA',
    billPage: '③08',
  }),
  // 明細追加で作った明細（手入力）。
  expenseOf({
    lineNo: 5,
    dataSource: '手入力',
    billName: 'アサヒ飲料 十六茶 店頭POP制作費',
    billNote: '',
    billAmount: 6000,
    planExpContent: '十六茶',
    product: '十六茶630mL24本',
    payAmount: 6000,
    planAmount: 6000,
    taxClass: 'その他(5%):3',
    mgmtClass: '拡売費(固定費)B口',
    mgmtCode: 'FB001',
    measureClass: 'スポット',
    measureCode: 'SS003',
    summary1: '店頭POPの制作費（社内）',
    summary2: '店頭POP制作（社外）',
    matchType: '照合支払:0',
    billNo: '458033SA',
    billPage: '③09',
  }),
];

// 支払回数ごとの拡売費（その他）と、未承認NETの明細の請求書番号・ページ。
const OTHER_ROWS_BY_ROUND: Record<string, () => ExpenseRow[]> = {
  '1': round1OtherRows,
  '2': round2OtherRows,
  '3': round3OtherRows,
};
const NET_BILL_BY_ROUND: Record<string, { prefix: string; page: string }> = {
  '1': { prefix: 'NET2410-1', page: '①02' },
  '2': { prefix: 'NET2410-2', page: '②01' },
  '3': { prefix: 'NET2410-3', page: '③01' },
};

// 支払回数の拡売費明細を新規生成する（グループ合計行・未承認NETの明細・その他の明細）。
// 未承認NETの明細は、同じ回の追加口明細（entryRows）の拡売費金額（NET未承認）から作る。
export const createWithInvoiceExpenseRows = (
  round: string,
  entryRows: readonly AdditionalEntryData[] = createWithInvoiceEntryRows(round)
): ExpenseRow[] => {
  const net = NET_BILL_BY_ROUND[round];
  return [
    NET_GROUP_ROW(),
    ...(net ? createNetUnapprovedRows(entryRows, net.prefix, net.page) : []),
    OTHER_GROUP_ROW(),
    ...(OTHER_ROWS_BY_ROUND[round]?.() ?? []),
  ];
};

// ── 請求詳細から反映したセンターフィ（画面に出さず裏で持つ） ──────────────
// 請求詳細のセンターフィ（費目＝センターフィの明細）は、支払詳細の画面の項目としては出さず、
// サマリ商品ごとに合算して合計表のセンターフィ（請求・支払）にだけ反映する（→ 利用者の決定 2026-10-05）。
// 値はダミー。請求詳細のモック（src/mocks/common/billingEdi）とはつながっていない（もともと別のダミー）。
// データ元は回の請求方法に合わせる（回3はモックのため請求EDI・AIC入力が混在する → WITH_INVOICE_ROUND_BILLING_METHODS）。
// サマリ商品ごとの合算を見せるため、同じサマリ商品の明細を2件持つ商品を各回に入れる。
// 税率はおおむね10%。回3の十六茶だけ8%にし、合計表の税率別の振り分けを見られるようにしている。
const BILLED_CENTER_FEE_ROWS_BY_ROUND: Record<string, BilledCenterFeeRow[]> = {
  '1': [
    {
      productName: 'ワンダ金の微糖185g30本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 9850,
    },
    {
      productName: 'ワンダ金の微糖185g30本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 4320,
    },
    {
      productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 11240,
    },
    {
      productName: 'ワンダモーニングショット185g30本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 6780,
    },
    {
      productName: 'ワンダ ボトルコーヒー微糖500mL24本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 3150,
    },
    {
      productName: '三ツ矢サイダー250mL30本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 8960,
    },
    {
      productName: '三ツ矢サイダー250mL30本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 2410,
    },
    {
      productName: '三ツ矢サイダー350mL28本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 2880,
    },
    {
      productName: '三ツ矢サイダー500mL24本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 2640,
    },
  ],
  '2': [
    {
      productName: 'カルピスウォーター500mL24本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 2460,
    },
    {
      productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 2180,
    },
    {
      productName: 'ワンダ金の微糖185g30本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 1950,
    },
    {
      productName: 'ワンダ金の微糖185g30本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 640,
    },
    {
      productName: 'ウィルキンソン炭酸水500mL24本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 1320,
    },
    {
      productName: 'ワンダ ボトルコーヒー微糖500mL24本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 980,
    },
    {
      productName: '三ツ矢サイダー250mL30本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 1540,
    },
    {
      productName: '三ツ矢サイダー500mL24本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 1210,
    },
  ],
  '3': [
    {
      productName: 'ワンダ金の微糖185g30本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 4860,
    },
    {
      productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 3720,
    },
    {
      productName: 'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 1180,
    },
    {
      productName: 'ワンダモーニングショット185g30本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 2950,
    },
    {
      productName: '三ツ矢サイダー250mL30本',
      dataSource: '請求EDI',
      taxRate: '10%',
      billAmount: 2640,
    },
    {
      productName: '十六茶630mL24本',
      dataSource: '請求EDI',
      taxRate: '8%',
      billAmount: 1870,
    },
    {
      productName: 'カルピスウォーター500mL24本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 2310,
    },
    {
      productName: 'カルピスウォーター500mL24本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 620,
    },
    {
      productName: '三ツ矢サイダー350mL28本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 1460,
    },
    {
      productName: 'ウィルキンソン炭酸水500mL24本',
      dataSource: 'AIC入力',
      taxRate: '10%',
      billAmount: 1050,
    },
  ],
};

// 支払回数の、請求詳細から反映したセンターフィの明細を新規生成する（無い回は空）。
export const createWithInvoiceBilledCenterFeeRows = (
  round: string
): BilledCenterFeeRow[] =>
  (BILLED_CENTER_FEE_ROWS_BY_ROUND[round] ?? []).map((row) => ({ ...row }));

// ── 支払情報サマリの固定値 ───────────────────────────────
// 実販FACT から集計する値（実販函数・納品金額・社外売上高）は本画面の明細からは求めないため、
// 固定値で持つ。値は全支払回数の明細から求めた支払の行と並べて比率が自然になるよう置いた
//（初期表示：追加口率 約42%、マージン率 約10%、函数の差 −3）。
// 管理利益額は計算式が無いため「基準の管理利益額＋（売上高−基準の売上高）」で近似する。
// 基準は初期表示（支払回数1の追加口分割を反映した後）の売上高と、その 25.2%（見本の管理利益率）。
export const WITH_INVOICE_ACTUAL_FUNC = 1533;
export const WITH_INVOICE_SUMMARY_FIXED_VALUES: SummaryFixedValues = {
  externalSales: 5534000,
  deliveryAmount: 3558000,
  salesBasis: 3015906,
  mgmtProfitBasis: 760008,
};

// 支払詳細(追加口請求書有)の追加口明細の行を作る処理（モックの明細・拡売費から移す明細・明細追加の明細）と、
// サマリ商品の参照値（入数・NET・社外売上高単価）。画面（DetailTable）・明細追加ペイン・テストで使う。
import { DEFAULT_DATA_SOURCE } from '@/constants/dataSource';
import {
  BILL_RETAILER_NAME,
  ENTRY_PRODUCT_CODE_BY_NAME,
  centerFeeRateOf,
  createWithInvoiceEntryRows,
  entryPlanOf,
  withInvoiceMasterValuesOf,
} from '@/mocks/payment/payment-detail-with-invoice/paymentDetail';
import { SUMMARY_PRODUCT_OPTIONS } from '@/constants/productMasters';
import type {
  AdditionalEntryData,
  EntryFormValues,
  ExpenseToEntryItem,
} from '@/types/paymentDetail';
import { deriveExternalUnitPrice } from '@/utils/common/externalUnitPrice';
import {
  calcEntryAmount,
  calcEntryUnitPrice,
  isSameEntryNumber,
  recalcEntryRow,
  toEntryNumber as toNum,
  type PlanType,
} from '@/utils/payment/payment-detail/additionalEntryRules';

// 支払回数1の追加口明細を新規生成する（モックデータ → src/mocks/payment/payment-detail-with-invoice/paymentDetail）。
// 画面は支払回数ごとのデータセット（createWithInvoiceEntryRows）を initialRows で渡す。
export const createEntryRows = (): AdditionalEntryData[] =>
  createWithInvoiceEntryRows('1');

// 追加口明細の空行（拡売費一覧の「追加口処理」で追加する行の既定値）。
export const EMPTY_ENTRY_ROW: AdditionalEntryData = {
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
  matchType: '',
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

// 追加口明細に現れないサマリ商品のコード（拡売費明細から移した明細で使う）。
// 追加口明細のサンプルと同じ8桁の体裁でそろえる。
const EXTRA_SUMMARY_PRODUCT_CODES: Record<string, string> = {
  カルピスウォーター500mL24本: '45120169',
  ウィルキンソン炭酸水500mL24本: '45140103',
  十六茶630mL24本: '45150110',
  '三ツ矢サイダー1.5L8本': '45130073',
  'ワンダ ボトルコーヒー微糖500mL24本': '45160035',
};

// サマリ商品名 → サマリ商品コードの逆引き（追加口明細の行を追加するときに使う）。
const BILLING_SUMMARY_PRODUCT_CODE_BY_NAME: Record<string, string> = {
  ...EXTRA_SUMMARY_PRODUCT_CODES,
  ...ENTRY_PRODUCT_CODE_BY_NAME,
};

// サマリ商品名 → 商品マスタの参照値（入数・NET単価・社外売上高単価）。
// 拡売費明細から「追加口処理」で移した明細は請求EDIの取込データを持たないため、
// サマリ商品名で商品マスタを引き、参照列（灰色セル）をこの値で埋める。
// 社外売上高単価は補足2-2「社外売単価の導出方法」に従って導く。ただしモックの商品マスタには
// 導出値が NET 以下になる商品（アイテムバラ単価・オペレータバラ単価を持たない商品）があり、
// そのままではバラ単価（社外売上高単価−NET）が負になるため、NET を上回る売価で代替する。
// 商品マスタの数値項目（文字列）を数値へ。空欄・数値化できない値は空文字にする。
const masterNum = (value: string): number | '' => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : '';
};

// NET・社外売上高単価は、共通の商品マスタの値をこの画面の計画の水準にそろえた値
//（→ src/mocks/payment/payment-detail-with-invoice/paymentDetail の withInvoiceMasterValuesOf）。
// 明細追加ペインでも同じ参照値を表示するため export する。
export const SUMMARY_PRODUCT_ENTRY_REFERENCE: Record<
  string,
  {
    capacity: number | '';
    net: number | '';
    seihan: number | '';
    productCode: string;
  }
> = SUMMARY_PRODUCT_OPTIONS.reduce(
  (map, option) => {
    if (!option.value || map[option.value]) return map;
    const capacity = masterNum(option.quantity);
    const net = masterNum(option.net);
    if (capacity === '' && net === '') return map;
    const external = deriveExternalUnitPrice(option, '', '').value;
    const price = masterNum(option.price);
    const seihan =
      net === ''
        ? ''
        : Number.isFinite(external) && external > net
          ? external
          : price !== '' && price > net
            ? price
            : '';
    // この画面の計画の水準にそろえたマスタの値（→ withInvoiceMasterValuesOf）。
    const scaled = withInvoiceMasterValuesOf(option.value, { net, seihan });
    map[option.value] = {
      capacity,
      net: scaled.net,
      seihan: scaled.seihan,
      productCode: BILLING_SUMMARY_PRODUCT_CODE_BY_NAME[option.value] ?? '',
    };
    return map;
  },
  {} as Record<
    string,
    {
      capacity: number | '';
      net: number | '';
      seihan: number | '';
      productCode: string;
    }
  >
);

// 明細追加・追加口処理で足す明細の参照値（入数・計画NET・社外売上高単価・計画の種類）。
// 当月の販売計画にあるサマリ商品は計画の値（計画NETは最も安い値 → 補足1-5 b24.t5・t6）と
// 計画の種類を使う。計画に無いサマリ商品はマスタの値（計画NETはマスタのNET → 利用者の決定 Q6）とし、
// 計画の種類を持たない。
export interface EntryReference {
  capacity: number | '';
  net: number | '';
  seihan: number | '';
  productCode: string;
  planType?: PlanType;
}
// サマリ商品のマスタNET（商品マスタのNET。計画の有無によらない）。明細追加で足す明細の
// 支払NET（追加口分）・（全体）の初期値（→ 補足1-5 b24.t12・t13、利用者の決定 2026-10-05）。
export const entryMasterNetOf = (productName: string): number | '' =>
  SUMMARY_PRODUCT_ENTRY_REFERENCE[productName]?.net ?? '';

export const entryReferenceOf = (
  productName: string
): EntryReference | undefined => {
  const master = SUMMARY_PRODUCT_ENTRY_REFERENCE[productName];
  const plan = entryPlanOf(productName);
  if (!plan) return master;
  return {
    capacity: plan.capacity,
    net: plan.planNet,
    seihan: plan.seihan,
    productCode:
      master?.productCode ||
      (BILLING_SUMMARY_PRODUCT_CODE_BY_NAME[productName] ?? ''),
    planType: plan.planType,
  };
};

// 金額から「ケース／バラ」を割り戻す（拡売費明細から移した明細の初期値を作るために使う）。
// 金額をバラ単価で割ったバラ換算の本数を、入数でケースと端数のバラに分ける。
// バラ単価が0以下（＝社外売上高単価がNET以下）の商品は割り戻せないため空欄にする。
const splitCasesAndLoose = (
  amount: number,
  capacity: number | '',
  unitPrice: number
): { cases: number | ''; loose: number | '' } => {
  if (!(unitPrice > 0) || !(amount > 0)) return { cases: '', loose: '' };
  const totalLoose = Math.round(amount / unitPrice);
  if (capacity === '' || capacity <= 0) return { cases: 0, loose: totalLoose };
  const cases = Math.floor(totalLoose / capacity);
  return { cases, loose: totalLoose - cases * capacity };
};

// 拡売費一覧の「追加口処理」で外した明細から、追加口明細の1行を作る。
// 金額は請求金額・支払金額を引き継ぎ、追加口として支払う明細のため追加口金額へ同じ値を入れる。
// 入数・NET・社外売上高単価・計画の種類はサマリ商品名で引き（entryReferenceOf）、
// 請求・支払のケース／バラは引き継いだ金額をバラ単価で割り戻して埋める。
// バラ単価・追加口バラ単価・拡売費バラ単価・追加口金額・支払金額・差額は数式で導く（recalcEntryRow）。
// 請求書番号・請求書ページは拡売費明細の値をそのまま引き継ぐ。
// 画面の操作で作る明細のためデータ元は手入力（一般卸メッシュの自動振替は行わない）。
export const createEntryRowFromExpense = (
  item: ExpenseToEntryItem,
  lineNo: number
): AdditionalEntryData => {
  const amount = toNum(item.billAmount) ?? 0;
  const payAmount = toNum(item.payAmount) ?? 0;
  const reference = entryReferenceOf(item.productName);
  const capacity = reference?.capacity ?? '';
  const net = reference?.net ?? '';
  const seihan = reference?.seihan ?? '';
  // バラ単価＝社外売上高単価−請求NET。追加口バラ単価も同じNETを使うため同値になる。
  // この単価で請求金額・支払金額を割り戻し、請求・支払のケース／バラを埋める。
  const unitPrice = seihan !== '' && net !== '' ? seihan - net : Number.NaN;
  const billQty = splitCasesAndLoose(amount, capacity, unitPrice);
  const payQty = splitCasesAndLoose(payAmount, capacity, unitPrice);
  const newRow: AdditionalEntryData = {
    ...EMPTY_ENTRY_ROW,
    lineNo,
    dataSource: DEFAULT_DATA_SOURCE,
    productName: item.productName,
    productCode: BILLING_SUMMARY_PRODUCT_CODE_BY_NAME[item.productName] ?? '',
    capacity,
    planNet: net,
    planType: reference?.planType,
    centerFeeRate: centerFeeRateOf(item.productName),
    billNet: net,
    addNet: net,
    payNet: net,
    seihan,
    cases: billQty.cases,
    loose: billQty.loose,
    payCases: payQty.cases,
    payLoose: payQty.loose,
    amount,
    addAmount: payAmount,
    expAmount: 0,
    payAmount,
    matchType: item.matchType ?? '',
    summary1: item.summary1 ?? '',
    summary: item.summary2 ?? '',
    billDetailNo: item.billNo ?? '',
    billPage: item.billPage ?? '',
    retailerName: BILL_RETAILER_NAME,
    // 拡売費一覧から移してきた明細であることを示す（入力セルの背景を変える）。
    fromExpense: true,
  };
  recalcEntryRow(newRow);
  return newRow;
};

// 「明細追加」ペインの入力値から、追加口明細の1行を作る。
// 入数・計画NET・社外売上高単価・計画の種類はサマリ商品名で引く（entryReferenceOf）。
// 請求NETはペインの値をそのまま使う（補足1-5 b24.t7：初期値なし・担当者が請求書を見て入力する）。
// ペインの請求NETは空欄から始まり、担当者が空欄のまま追加したら空欄のまま追加して、
// バラ単価・金額も計算しない（ペインの表示と一致させる）。
// サマリ商品で作った計画に紐づく明細は、請求NETが計画NETを下回ると赤く表示する
//（isEntryAlertRow。空欄は比べられないため赤くしない）。
// 請求情報（ケース・バラ・バラ単価・金額）もペインの入力値を使う（→ 補足1-5 b24.t7〜t11）。
// バラ単価・金額はペインの値を入れ、計算した値と違う値だけ手で直した値として残す。
// 追加口金額・支払金額・差額は数式で導く（recalcEntryRow）。
export const createManualEntryRow = (
  values: EntryFormValues,
  lineNo: number
): AdditionalEntryData => {
  const reference = entryReferenceOf(values.productName);
  const net = reference?.net ?? '';
  const masterNet = entryMasterNetOf(values.productName);
  const typedUnitPrice = toNum(values.unitPrice);
  const typedAmount = toNum(values.amount);
  const newRow: AdditionalEntryData = {
    ...EMPTY_ENTRY_ROW,
    lineNo,
    dataSource: DEFAULT_DATA_SOURCE,
    productName: values.productName,
    productCode: reference?.productCode ?? '',
    capacity: reference?.capacity ?? '',
    planNet: net,
    planType: reference?.planType,
    centerFeeRate: centerFeeRateOf(values.productName),
    billNet: toNum(values.billNet) ?? '',
    cases: toNum(values.cases) ?? '',
    loose: toNum(values.loose) ?? '',
    seihan: reference?.seihan ?? '',
    payCases: toNum(values.payCases) ?? '',
    payLoose: toNum(values.payLoose) ?? '',
    // 支払NET（追加口分）・（全体）はペインの値。未入力ならサマリ商品のマスタNET（→ b24.t12・t13）。
    addNet: toNum(values.addNet) ?? masterNet,
    payNet: toNum(values.payNet) ?? masterNet,
    matchType: values.matchType,
    expProcess: values.expProcess || '-',
    billPage: values.billPage,
    billDetailNo: values.billDetailNo,
    retailerName: values.retailerName,
    summary1: values.summary1,
    summary: values.summary2,
    funcCheck: values.funcCheck,
    finalNet: values.finalNet,
  };
  // バラ単価・金額はペインの値を入れ、手で直した値（計算した値と違う値）にだけ印を付ける。
  // 印の無い値は計算式で求め直す（計算した値と同じ）。函数無効チェックONの明細は計算しないため、
  // ペインの値をそのまま持つ。以後のグリッドの編集も同じ決まり（→ applyEntryCellEdit）。
  if (typedUnitPrice !== null) {
    newRow.unitPriceManual =
      (values.unitPriceManual ?? true) &&
      !isSameEntryNumber(typedUnitPrice, calcEntryUnitPrice(newRow));
    newRow.unitPrice = typedUnitPrice;
  }
  recalcEntryRow(newRow);
  if (typedAmount !== null) {
    newRow.amountManual =
      (values.amountManual ?? true) &&
      !isSameEntryNumber(typedAmount, calcEntryAmount(newRow));
    newRow.amount = typedAmount;
    recalcEntryRow(newRow); // 印の無い金額は計算し直し、差額を金額に合わせる
  }
  return newRow;
};

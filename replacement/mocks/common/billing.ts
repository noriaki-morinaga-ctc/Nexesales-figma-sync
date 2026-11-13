// 請求一覧・請求詳細(AIC入力)・請求詳細(請求EDI)：入力単位・明細・サマリ商品・商流販売店の紐づけのモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。

import type {
  BillingCustomerLink,
  BillingDataSource,
  BillingDetailRow,
  BillingDetailStatus,
  BillingExpenseType,
  BillingRow,
  BillingStoreField,
  BillingSummaryProduct,
} from '@/app/types/billing';
import type { SingleComboboxOption } from '@/app/components/ui/single-combobox';
import {
  BILLING_UNSET_CUSTOMER_CODE,
  BILLING_UNSET_CUSTOMER_NAME,
  NEW_BILLING_ID,
} from '@/app/constants/billing';
import {
  aggregateBillingDetailRows,
  roundBillingAmount,
} from '@/app/utils/payment/billing/billing';

export const BILLING_SUMMARY_PRODUCTS: BillingSummaryProduct[] = [
  { name: 'ｶﾙﾋﾟｽ Lﾊﾟﾂｸ ｶﾐ 1L', code: '45120031', perCase: 6 },
  { name: 'ｶﾙﾋﾟｽ ｷﾖﾎｳ Lﾊﾟﾂｸ ｶﾐ 1L', code: '45120048', perCase: 6 },
  { name: 'ｶﾙﾋﾟｽｳｵｰﾀｰ ｼﾞﾊﾝｷﾖｳ P 490', code: '45120152', perCase: 24 },
  { name: 'ｶﾙﾋﾟｽ ｳｴﾙﾁ ｸﾞﾚｰﾌﾟ ﾍﾟﾂﾄ800', code: '45120219', perCase: 8 },
  { name: 'ﾐﾂﾔ ｻｲﾀﾞｰ ｶﾝ 250', code: '45130042', perCase: 30 },
  { name: 'ﾐﾂﾔ ｻｲﾀﾞｰ ﾋﾟﾕｱﾎﾞﾄﾙﾍﾟﾂﾄ500', code: '45130059', perCase: 24 },
  { name: 'ﾐﾂﾔ ｻｲﾀﾞｰ ｼﾞﾊﾝｷﾖｳ ﾍﾟﾂﾄ430', code: '45130066', perCase: 24 },
  { name: 'ｱｻﾋ ｳｲﾙｷﾝｿﾝ ｼﾞﾝｼﾞﾔｴｰﾙP500', code: '45140073', perCase: 24 },
  { name: 'ｱｻﾋ ｳｲﾙｷﾝｿﾝDｼﾞﾝｼﾞﾔｴｰﾙ 500', code: '45140080', perCase: 24 },
  { name: 'ｱｻﾋ ｳｲﾙｷﾝｿﾝ ﾄﾆﾂｸ ﾍﾟﾂﾄ 500', code: '45140097', perCase: 24 },
  { name: 'ｱｻﾋ ｼﾞﾕｳﾛｸﾁﾔﾑｷﾞﾁﾔ ﾍﾟﾂﾄ 2L', code: '45150103', perCase: 6 },
  { name: 'ｱｻﾋ ｼﾞﾕｳﾛｸﾁﾔ ﾍﾟﾂﾄ 600', code: '45150110', perCase: 24 },
  { name: 'ｱｻﾋ ｳｰﾛﾝﾁﾔ ｷﾞﾖｳﾑﾖｳ ﾍﾟﾂﾄ2L', code: '45150127', perCase: 6 },
  { name: 'ｱｻﾋ N ｲﾂｷﾕｳﾁﾔﾊﾞｳｰﾛﾝﾁﾔ P2L', code: '45150134', perCase: 6 },
  { name: 'ｱｻﾋ ｵｲｼｲﾊﾞﾅｼﾞｳﾑﾃﾝﾈﾝｽｲP350', code: '45160141', perCase: 24 },
  { name: 'ｱｻﾋ ｵｲｼｲﾊﾞﾅｼﾞｳﾑﾃﾝﾈﾝｽｲP600', code: '45160158', perCase: 24 },
  { name: 'ｱｻﾋ ｵｲｼｲﾊﾞﾅｼﾞｳﾑﾃﾝﾈﾝｽｲ P2L', code: '45160165', perCase: 6 },
  { name: 'ｱｻﾋ ﾊﾞﾔﾘｰｽ ｵﾚﾝｼﾞ ﾍﾟﾂﾄ 280', code: '45170172', perCase: 24 },
  { name: 'ｱｻﾋ ﾊﾞﾔﾘｰｽ ｵﾚﾝｼﾞ ｶﾝ 245', code: '45170189', perCase: 30 },
  { name: 'ﾊﾞﾔﾘｰｽ ｵﾚﾝｼﾞ Pﾊﾞｺ 200', code: '45170196', perCase: 24 },
  { name: 'ｱｻﾋ ﾄﾞﾃﾞｶﾐﾝｽﾄﾛﾝｸﾞ Bｶﾝ 300', code: '45180202', perCase: 24 },
  { name: 'ｱｻﾋ ﾜﾝﾀﾞ ｷﾝﾉﾋﾞﾄｳ ｶﾝ 185', code: '45180219', perCase: 30 },
  { name: 'ﾓﾝｽﾀｰｴﾅｼﾞｰ ｶﾝ 355', code: '45180226', perCase: 24 },
];

// サマリ商品名 → マスタ（入数の自動補完に使用）
export const BILLING_SUMMARY_PRODUCT_BY_NAME: Map<
  string,
  BillingSummaryProduct
> = new Map(BILLING_SUMMARY_PRODUCTS.map((p) => [p.name, p]));

// サマリ商品名の選択肢（名称＝1行目／サマリ商品コード＝2行目。下4桁でも検索できる）
export const billingSummaryProductComboOptions = (): SingleComboboxOption[] =>
  BILLING_SUMMARY_PRODUCTS.map((p) => ({
    value: p.name,
    label: p.name,
    code: `サマリ商品コード: ${p.code}`,
  }));

// 一次店・三次店（国分グループ）。表記は「コード:名称」（→ 02 §9）
const KOKUBU_PRIMARY = '10903533:国分株式会社';

const KOKUBU_FS = '10001433:国分グループ本社株式会社フードサービス事業部';

const KOKUBU_ITABASHI =
  '10908138:国分グループ本社株式会社　ＦＳ　板橋総合センター';

export const BILLING_CUSTOMER_LINKS: BillingCustomerLink[] = [
  {
    customerCode: '13213120',
    customerName: 'ｶ)ｽｽﾞｷｼﾕﾊﾝﾄｳﾌﾞｷﾖｳﾊｲｾﾝﾀ-',
    staffName: '5172741:芳賀　洋平',
    storeName: '30300249:鈴木酒販',
    primaryStore: KOKUBU_PRIMARY,
    tertiaryStore: KOKUBU_FS,
  },
  {
    customerCode: '13130200',
    customerName: 'ｶ)ﾄｳｷﾖｳﾜｲﾝｼﾌﾞﾔ',
    staffName: '5172741:芳賀　洋平',
    storeName: '30300210:東京ワイン',
    primaryStore: KOKUBU_PRIMARY,
    tertiaryStore: KOKUBU_ITABASHI,
  },
  {
    customerCode: '13141740',
    customerName: 'ｶ)ｴｲｺｰｷﾖｳﾊｲｾﾝﾀｰ',
    staffName: '5172742:木村　慧',
    storeName: '30300069:エイコー',
    primaryStore: KOKUBU_PRIMARY,
    tertiaryStore: KOKUBU_FS,
  },
  {
    customerCode: '13014449',
    customerName: 'ｶ)ｵｸﾞﾗ',
    staffName: '5172743:加藤　凌太朗',
    storeName: '30300032:（株）小倉',
    primaryStore: KOKUBU_PRIMARY,
    tertiaryStore: KOKUBU_FS,
  },
  // 商流未設定（受け皿）。商流販売店を特定できない明細はこの得意先に寄せる。
  // 得意先コード・得意先名の候補にも出し、画面から直接選べるようにする。
  {
    customerCode: BILLING_UNSET_CUSTOMER_CODE,
    customerName: BILLING_UNSET_CUSTOMER_NAME,
    staffName: '',
    storeName: '',
    primaryStore: '',
    tertiaryStore: '',
  },
];

export const BILLING_CUSTOMER_LINK_BY_CODE: Map<string, BillingCustomerLink> =
  new Map(BILLING_CUSTOMER_LINKS.map((c) => [c.customerCode, c]));

// 得意先名の選択肢（過去の入力リストから選ぶことで名称の揺れを防ぐ）
export const billingCustomerComboOptions = (): SingleComboboxOption[] =>
  BILLING_CUSTOMER_LINKS.map((c) => ({
    value: c.customerName,
    label: c.customerName,
    code: `得意先コード: ${c.customerCode}`,
  }));

// 得意先コードの選択肢（得意先名と同じ紐づけ表から。コード・名称どちらでも絞り込める）
export const billingCustomerCodeComboOptions = (): SingleComboboxOption[] =>
  BILLING_CUSTOMER_LINKS.map((c) => ({
    value: c.customerCode,
    label: c.customerCode,
    code: `得意先名: ${c.customerName}`,
  }));

// マスタは「コード:名称」で保持するが、画面では名称だけを扱う。
// マスタで導出できない先はコードを持てないため、候補・明細とも名称で統一する。
export const billingStoreDisplayName = (codeName: string): string =>
  codeName.includes(':') ? codeName.slice(codeName.indexOf(':') + 1) : codeName;

// 販売店・一次店・三次店の候補（名称のみ）。候補に無い名称は画面で直接入力できる
export const billingStoreComboOptions = (
  field: BillingStoreField
): SingleComboboxOption[] =>
  Array.from(
    new Set(
      BILLING_CUSTOMER_LINKS.map((c) =>
        billingStoreDisplayName(c[field])
      ).filter(Boolean)
    )
  ).map((value) => ({ value, label: value }));

// 担当者の選択肢（「コード:名称」）。販売店が未選択・手入力の明細はマスタから担当者を
// 導出できないため、画面で選ぶ。どの得意先の担当かを手掛かりに選べるよう、担当者ごとに
// 得意先名をまとめて添える（コンボボックスは得意先名でも絞り込める）。
// 販売店・得意先と同じく専用のマスタは持たず、商流販売店変換マスタの値から作る。
export const billingStaffComboOptions = (): SingleComboboxOption[] => {
  const customerNamesByStaff = new Map<string, string[]>();
  for (const c of BILLING_CUSTOMER_LINKS) {
    if (!c.staffName) continue;
    const names = customerNamesByStaff.get(c.staffName);
    if (names) names.push(c.customerName);
    else customerNamesByStaff.set(c.staffName, [c.customerName]);
  }
  return Array.from(customerNamesByStaff, ([staffName, customerNames]) => ({
    value: staffName,
    label: staffName,
    code: `得意先名: ${customerNames.join('、')}`,
  }));
};

// 商流販売店（販売店・一次店・三次店）の組み合わせから得意先を逆引きする。
// 商流未設定の明細で3項目を手で埋め直したとき、得意先を受け皿から実在の得意先へ戻すために使う。
// 受け皿（商流未設定）は3項目が空のため対象外にする。
export const billingCustomerByStores = (row: {
  storeName: string;
  primaryStore: string;
  tertiaryStore: string;
}): BillingCustomerLink | undefined =>
  BILLING_CUSTOMER_LINKS.find(
    (c) =>
      !!c.storeName &&
      billingStoreDisplayName(c.storeName) === row.storeName &&
      billingStoreDisplayName(c.primaryStore) === row.primaryStore &&
      billingStoreDisplayName(c.tertiaryStore) === row.tertiaryStore
  );

// 支払側で付与される値（ステータス・照合区分）の行別指定。
// 既定は「支払反映済か」「紐づけ表にあるか」から導出するが、⑤-1シート凡例の
// 全ステータス・全照合区分を画面で確認できるよう、行ごとに上書きできるようにする。
interface BillingPayState {
  status?: BillingDetailStatus; // 未指定＝反映済なら「支払画面反映済」／未反映なら空
  matchKbn?: string; // 未指定＝反映済なら「0:照合支払」／未反映なら空
}

// 明細の対象月（モック）。請求EDI取込結果詳細の対象年月と揃える。
const BILLING_TARGET_MONTH = '2026/07';

// 明細1行を組み立てる。担当者・販売店名・一次店・三次店は紐づけ表から補完し、
// 入数はサマリ商品マスタから補完する（画面の自動補完と同じ導出）。
// reflected=true（支払反映済の請求書）のときだけ支払金額・支払消費税額を持たせる。
// 商流未設定（紐づけ表に無い得意先）の行は支払側へ反映できないため、
// ステータスは常に「商流未設定」・照合区分は空になる（pay の指定より優先）。
// データ元は請求書1枚ごとに揃う（EDI受領分か、紙・PDFを AIC が入力した分か）。
const detail = (
  id: string,
  invoiceNo: string,
  slipNo: string,
  customerCode: string,
  productName: string,
  qty: number,
  unitPrice: number,
  billAmount: number,
  reflected: boolean,
  dataSource: BillingDataSource = 'AIC入力',
  pay: BillingPayState = {},
  expense: { type?: BillingExpenseType; unresolved?: boolean } = {},
  // 請求単位。既定はバラ（数量＝バラ本数）。ケース・パック請求の明細は
  // 単価をバラ単価で扱うため、数量に入数を掛けてバラ換算する（課題 No.1283）
  billingUnit: string = '3:バラ'
): BillingDetailRow => {
  const link = BILLING_CUSTOMER_LINK_BY_CODE.get(customerCode);
  const linked = !!link?.storeName;
  return {
    id,
    dataSource,
    status: linked
      ? (pay.status ?? (reflected ? '支払画面反映済' : '支払画面未反映'))
      : '商流未設定',
    // 判別できなかった明細は追加口として取り込む（決定19）
    expenseType: expense.type ?? '追加口',
    // 支払画面へ反映した明細だけ反映先の支払No.・支払回数を持つ。
    // 支払Noは商流販売店ごとに採番する想定（→ 20260821_第31回 AL115 コメント）
    payNo: reflected && linked ? `PAY-${customerCode}` : undefined,
    payCount: reflected && linked ? 1 : undefined,
    expenseUnresolved: expense.unresolved ?? false,
    // 対象月は請求EDI取込結果詳細から連携される（決定8）。AIC入力分はAICが入力する。
    targetMonth: BILLING_TARGET_MONTH,
    billAmount,
    payAmount: reflected && linked ? billAmount : null,
    matchKbn: linked ? (pay.matchKbn ?? (reflected ? '0:照合支払' : '')) : '',
    taxKbn: '2:課税8%',
    // 消費税額は円未満を四捨五入する（小数点以下は扱わない）
    payTaxAmount: reflected && linked ? Math.round(billAmount * 0.08) : null,
    productName,
    // 商品名・備考は請求書の記載を書き写す項目のため、モックでは空にしておく
    itemName: '',
    perCase: BILLING_SUMMARY_PRODUCT_BY_NAME.get(productName)?.perCase ?? null,
    billingUnit,
    qty,
    unitPrice,
    slipNo,
    invoiceNo,
    customerCode,
    customerName: link?.customerName ?? '',
    staffName: link?.staffName ?? '',
    // 販売店・一次店・三次店は画面では名称だけを扱う（マスタは「コード:名称」で保持）
    storeName: billingStoreDisplayName(link?.storeName ?? ''),
    primaryStore: billingStoreDisplayName(link?.primaryStore ?? ''),
    tertiaryStore: billingStoreDisplayName(link?.tertiaryStore ?? ''),
    note: '',
  };
};

// 請求書No.174470（請求EDI取込→夜間バッチで自動作成。支払反映済）の明細。
// 請求EDI取込結果詳細で商流販売店まで変換できた明細だけが連携されるため（決定13）、
// 請求EDI取込分に「商流未設定」の明細は存在しない。
// 請求EDI取込分は取込時点で支払画面へ反映済のため、全明細が「支払画面反映済」以降のステータスを持つ。
// 支払処理の進み方（反映済→申請中→検印済）は支払伝票ごとに揃える。
// 先頭2行は反映後、照合の結果その回では支払が立たなかったケース（保留・約束無し）。
const DETAIL_174470: BillingDetailRow[] = [
  detail('D470-01', '174470', '439211KA', '13213120', 'ｶﾙﾋﾟｽ Lﾊﾟﾂｸ ｶﾐ 1L', 149, 10.07, 1490, true, 'EDI', { matchKbn: '4:保留' }, { unresolved: true }), // prettier-ignore
  detail('D470-02', '174470', '439194KA', '13014449', 'ｶﾙﾋﾟｽ Lﾊﾟﾂｸ ｶﾐ 1L', 100, 20.8, 2097, true, 'EDI', { matchKbn: '5:約束無し' }), // prettier-ignore
  detail('D470-03', '174470', '439150KA', '13130200', 'ｶﾙﾋﾟｽ Lﾊﾟﾂｸ ｶﾐ 1L', 394, 30.61, 12195, true, 'EDI', { status: '支払処理申請中', matchKbn: '1:数量違い' }), // prettier-ignore
  detail('D470-04', '174470', '439150KA', '13130200', 'ｶﾙﾋﾟｽ ｷﾖﾎｳ Lﾊﾟﾂｸ ｶﾐ 1L', 1, 30.61, 31, true, 'EDI', { status: '支払処理申請中', matchKbn: '2:条件違い' }), // prettier-ignore
  detail('D470-05', '174470', '439150KA', '13130200', 'ｶﾙﾋﾟｽｳｵｰﾀｰ ｼﾞﾊﾝｷﾖｳ P 490', 24, 3, 72, true, 'EDI', { status: '支払処理申請中', matchKbn: '3:条件・数量違い' }), // prettier-ignore
  detail('D470-06', '174470', '439183KA', '13141740', 'ｶﾙﾋﾟｽ Lﾊﾟﾂｸ ｶﾐ 1L', 31, 25.7, 797, true, 'EDI', { status: '支払処理検印済', matchKbn: '8:対象税率違い' }, { type: '拡売費' }), // prettier-ignore
  detail('D470-07', '174470', '439183KA', '13141740', 'ｶﾙﾋﾟｽ ｳｴﾙﾁ ｸﾞﾚｰﾌﾟ ﾍﾟﾂﾄ800', 8, 12.64, 102, true, 'EDI', { status: '支払処理検印済', matchKbn: '9:対象期間違い' }), // prettier-ignore
  detail('D470-08', '174470', '439119KA', '13014449', 'ｶﾙﾋﾟｽ Lﾊﾟﾂｸ ｶﾐ 1L', 95, 38.3, 3619, true, 'EDI', { status: '支払処理検印済', matchKbn: '6:支払済み' }), // prettier-ignore
  // 卸がセンターフィを商品ごとに請求してくるケース。費目「センターフィ」で判別する
  // （→ 20260821_第31回 決定事項19）。
  detail('D470-09', '174470', '439119KA', '13014449', 'ｱｻﾋ ｵｲｼｲﾐｽﾞ ﾃﾝﾈﾝｽｲ ﾍﾟﾂﾄ 600', 60, 4.5, 270, true, 'EDI', { status: '支払処理検印済' }, { type: 'センターフィ' }), // prettier-ignore
  // 計上区分（EDI区分4-3）が1＝取消の明細。数量をマイナスで取り込み、請求金額もマイナスになる
  // （単価をマイナスで送ってくる卸もある。→ 20260817 芳賀コメント／販促金EDIデータからわかった点）。
  detail('D470-10', '174470', '439119KA', '13014449', 'ｶﾙﾋﾟｽ Lﾊﾟﾂｸ ｶﾐ 1L', -20, 38.3, -766, true, 'EDI', { status: '支払処理検印済', matchKbn: '7:別途支払い済み' }, { type: '拡売費' }), // prettier-ignore
];

// 請求書No.174474（紙・PDF の請求書を AIC が入力。支払未反映）の明細。
// AIC入力分は商流販売店をこの画面で導出するため、紐づけ表に無い得意先＝「商流未設定」が
// 発生しうる（D474-12／13）。紐づけマスタを直して再導出する対象になる。
// 反映は全明細を一括で行うため、入力中の明細はすべて未反映（ステータス空欄か商流未設定）。
const DETAIL_174474: BillingDetailRow[] = [
  detail('D474-01', '174474', '439212KA', '13213120', 'ﾐﾂﾔ ｻｲﾀﾞｰ ｶﾝ 250', 150, 7.09, 1065, false), // prettier-ignore
  detail('D474-02', '174474', '439212KA', '13213120', 'ｱｻﾋ ｳｲﾙｷﾝｿﾝ ｼﾞﾝｼﾞﾔｴｰﾙP500', 107, 18.55, 1984, false), // prettier-ignore
  detail('D474-03', '174474', '439212KA', '13213120', 'ﾐﾂﾔ ｻｲﾀﾞｰ ﾋﾟﾕｱﾎﾞﾄﾙﾍﾟﾂﾄ500', 48, 18.55, 890, false), // prettier-ignore
  detail('D474-04', '174474', '439212KA', '13213120', 'ｱｻﾋ ｼﾞﾕｳﾛｸﾁﾔﾑｷﾞﾁﾔ ﾍﾟﾂﾄ 2L', 3, 99.76, 299, false), // prettier-ignore
  detail('D474-05', '174474', '439212KA', '13213120', 'ｱｻﾋ ｵｲｼｲﾊﾞﾅｼﾞｳﾑﾃﾝﾈﾝｽｲP350', 58, 5.84, 338, false), // prettier-ignore
  detail('D474-06', '174474', '439212KA', '13213120', 'ｱｻﾋ ｵｲｼｲﾊﾞﾅｼﾞｳﾑﾃﾝﾈﾝｽｲP600', 61, 22.09, 1347, false), // prettier-ignore
  detail('D474-07', '174474', '439212KA', '13213120', 'ｱｻﾋ ｳｲﾙｷﾝｿﾝ ﾄﾆﾂｸ ﾍﾟﾂﾄ 500', 108, 18.55, 2002, false), // prettier-ignore
  detail('D474-08', '174474', '439212KA', '13213120', 'ｱｻﾋ ｳｰﾛﾝﾁﾔ ｷﾞﾖｳﾑﾖｳ ﾍﾟﾂﾄ2L', 323, 44.2, 14260, false), // prettier-ignore
  detail('D474-09', '174474', '439212KA', '13213120', 'ｱｻﾋ N ｲﾂｷﾕｳﾁﾔﾊﾞｳｰﾛﾝﾁﾔ P2L', 38, 99.76, 3793, false), // prettier-ignore
  detail('D474-10', '174474', '439212KA', '13213120', 'ﾓﾝｽﾀｰｴﾅｼﾞｰ ｶﾝ 355', 72, 11.1, 798, false), // prettier-ignore
  detail('D474-11', '174474', '439212KA', '13213120', 'ｱｻﾋ ｵｲｼｲﾊﾞﾅｼﾞｳﾑﾃﾝﾈﾝｽｲ P2L', 7, 5.62, 39, false), // prettier-ignore
  detail('D474-12', '174474', '439195KA', BILLING_UNSET_CUSTOMER_CODE, 'ｱｻﾋ ｼﾞﾕｳﾛｸﾁﾔﾑｷﾞﾁﾔ ﾍﾟﾂﾄ 2L', 20, 93, 1860, false), // prettier-ignore
  detail('D474-13', '174474', '439195KA', BILLING_UNSET_CUSTOMER_CODE, 'ｱｻﾋ ｳｰﾛﾝﾁﾔ ｷﾞﾖｳﾑﾖｳ ﾍﾟﾂﾄ2L', 16, 78.7, 1258, false), // prettier-ignore
  detail('D474-14', '174474', '439151KA', '13130200', 'ｱｻﾋ ｳｲﾙｷﾝｿﾝ ｼﾞﾝｼﾞﾔｴｰﾙP500', 1440, 8.12, 11665, false), // prettier-ignore
  detail('D474-15', '174474', '439151KA', '13130200', 'ｱｻﾋ ｳｲﾙｷﾝｿﾝDｼﾞﾝｼﾞﾔｴｰﾙ 500', 449, 8.12, 3642, false), // prettier-ignore
  detail('D474-16', '174474', '439151KA', '13130200', 'ﾐﾂﾔ ｻｲﾀﾞｰ ｼﾞﾊﾝｷﾖｳ ﾍﾟﾂﾄ430', 24, 3.41, 82, false), // prettier-ignore
  detail('D474-17', '174474', '439151KA', '13130200', 'ｱｻﾋ ｼﾞﾕｳﾛｸﾁﾔﾑｷﾞﾁﾔ ﾍﾟﾂﾄ 2L', 48, 87.9, 4224, false), // prettier-ignore
  detail('D474-18', '174474', '439151KA', '13130200', 'ｱｻﾋ ｳｲﾙｷﾝｿﾝ ﾄﾆﾂｸ ﾍﾟﾂﾄ 500', 126, 8.2, 1033, false), // prettier-ignore
  detail('D474-19', '174474', '439151KA', '13130200', 'ｱｻﾋ ﾊﾞﾔﾘｰｽ ｵﾚﾝｼﾞ ﾍﾟﾂﾄ 280', 68, 10.17, 692, false), // prettier-ignore
  detail('D474-20', '174474', '439151KA', '13130200', 'ｱｻﾋ ﾄﾞﾃﾞｶﾐﾝｽﾄﾛﾝｸﾞ Bｶﾝ 300', 24, 10.7, 257, false), // prettier-ignore
  detail('D474-21', '174474', '439151KA', '13130200', 'ｱｻﾋ N ｲﾂｷﾕｳﾁﾔﾊﾞｳｰﾛﾝﾁﾔ P2L', 6, 87.9, 527, false), // prettier-ignore
  detail('D474-22', '174474', '439184KA', '13141740', 'ﾊﾞﾔﾘｰｽ ｵﾚﾝｼﾞ Pﾊﾞｺ 200', 5, 1, 5, false), // prettier-ignore
  detail('D474-23', '174474', '439120KA', '13014449', 'ｱｻﾋ ｼﾞﾕｳﾛｸﾁﾔ ﾍﾟﾂﾄ 600', 168, 3.42, 574, false), // prettier-ignore
  detail('D474-24', '174474', '439120KA', '13014449', 'ｱｻﾋ ﾊﾞﾔﾘｰｽ ｵﾚﾝｼﾞ ﾍﾟﾂﾄ 280', 144, 7.42, 1068, false), // prettier-ignore
  detail('D474-25', '174474', '439120KA', '13014449', 'ｱｻﾋ ﾄﾞﾃﾞｶﾐﾝｽﾄﾛﾝｸﾞ Bｶﾝ 300', 24, 7.16, 172, false), // prettier-ignore
  detail('D474-26', '174474', '439120KA', '13014449', 'ｱｻﾋ ﾊﾞﾔﾘｰｽ ｵﾚﾝｼﾞ ｶﾝ 245', 660, 31.87, 21032, false), // prettier-ignore
  detail('D474-27', '174474', '439120KA', '13014449', 'ｱｻﾋ ﾜﾝﾀﾞ ｷﾝﾉﾋﾞﾄｳ ｶﾝ 185', 60, 6.13, 368, false), // prettier-ignore
  // ケース単位で請求された明細。単価はバラ単価のため、請求単価は請求金額を
  // 数量（60ケース）と入数（24本）で割って求める（11,693 ÷ 60 ÷ 24 ＝ 8.12。課題 No.1283）
  detail('D474-28', '174474', '439120KA', '13014449', 'ｱｻﾋ ｳｲﾙｷﾝｿﾝ ｼﾞﾝｼﾞﾔｴｰﾙP500', 60, 8.12, 11693, false, 'AIC入力', {}, {}, '1:ケース'), // prettier-ignore
];

// データ種別（入力単位の属性）→ 明細。
// PPT：請求内容反映画面は請求元事業所毎の管理（請求・支払・集計）にしておく必要がある。
// 1つの入力単位に複数の請求書No.（例：174470／174474）が含まれる。
// 請求EDI取込分と AIC入力分は別の入力単位になる（決定23）。
// 請求書No.174470＝請求EDI取込、174474＝AIC が紙・PDF を見て入力した分。
// モックの明細はデータ種別ごとに1組だけ持ち、同じデータ種別の入力単位では同じ明細を使う
// （入力単位ごとに明細を用意せず、一覧のどの行から開いても明細を確認できるようにするため）。
export const BILLING_DETAIL_BY_DATA_SOURCE: Record<
  BillingDataSource,
  BillingDetailRow[]
> = {
  EDI: DETAIL_174470,
  AIC入力: DETAIL_174474,
};

// 明細を持たない一覧行（モックの固定値）の合計の列。
// 差額(請求-支払)は、明細から求める行と同じく 請求金額合計－支払金額合計 で求める。
const billingTotalsOf = (
  billAmount: number,
  payAmount: number,
  sealedPayAmount: number
): Pick<
  BillingRow,
  'billAmount' | 'payAmount' | 'correction' | 'sealedPayAmount'
> => ({
  billAmount,
  payAmount,
  correction: roundBillingAmount(billAmount - payAmount),
  sealedPayAmount,
});

// 請求一覧の「新規作成」から開く空の入力単位。
export const createEmptyBilling = (): BillingRow => ({
  id: NEW_BILLING_ID,
  status: '入力中',
  // 画面から新規作成する入力単位は AIC が直接入力するため常にAIC入力
  dataSource: 'AIC入力',
  receivedAt: '',
  providerCode: '',
  providerName: '',
  billCompanyCode: '',
  billCompanyName: '',
  billOfficeCode: '',
  billOfficeName: '',
  billAmount: 0,
  payAmount: 0,
  correction: 0,
  sealedPayAmount: 0,
});

// 請求EDI取込分は AIC の入力を経ずに支払画面へ反映されるため、入力状況は常に「反映済」。
// AIC が請求書を見て入力する AIC入力分だけが「入力中」を持つ。
export const BILLING_LIST: BillingRow[] = [
  {
    // 請求書No.174470（請求EDI取込→夜間バッチで自動作成）
    id: 'BILL-EDI-001',
    status: '反映済',
    dataSource: 'EDI',
    receivedAt: '2026/08/10 08:30',
    providerCode: '300000000001',
    providerName: 'ｺｸﾌﾞｸﾞﾙｰﾌﾟﾎﾝｼｬ',
    billCompanyCode: '100000000001',
    billCompanyName: 'ｺｸﾌﾞｸﾞﾙｰﾌﾟﾎﾝｼｬ',
    billOfficeCode: '200000000001',
    billOfficeName: 'ｲﾀﾊﾞｼC',
    ...aggregateBillingDetailRows(BILLING_DETAIL_BY_DATA_SOURCE['EDI']),
  },
  {
    // 請求書No.174474（紙・PDF を AIC が入力）。同じ請求元企業事業所でもEDIとは別の入力単位
    id: 'BILL-AIC-001',
    status: '入力中',
    dataSource: 'AIC入力',
    receivedAt: '2026/08/14 10:20',
    // AIC入力分は請求元企業を特定できないためブランク、事業所は名称のみで識別する（決定24）
    providerCode: '',
    providerName: '',
    billCompanyCode: '',
    billCompanyName: '',
    billOfficeCode: '',
    billOfficeName: 'ｲﾀﾊﾞｼC',
    ...aggregateBillingDetailRows(BILLING_DETAIL_BY_DATA_SOURCE['AIC入力']),
  },
  {
    id: 'BILL-EDI-003',
    status: '反映済',
    dataSource: 'EDI',
    receivedAt: '2026/08/10 08:30',
    providerCode: '300000000002',
    providerName: 'ｲﾄｳﾁﾕｳｼﾖｸﾋﾝ',
    billCompanyCode: '100000000002',
    billCompanyName: 'ｲﾄｳﾁﾕｳｼﾖｸﾋﾝ',
    billOfficeCode: '200000000002',
    billOfficeName: 'ﾋｶﾞｼﾆﾎﾝ',
    ...billingTotalsOf(1842600, 1230400, 0),
  },
  {
    id: 'BILL-EDI-004',
    status: '反映済',
    dataSource: 'EDI',
    receivedAt: '2026/08/10 08:30',
    providerCode: '300000000001',
    providerName: 'ｺｸﾌﾞｸﾞﾙｰﾌﾟﾎﾝｼｬ',
    billCompanyCode: '100000000001',
    billCompanyName: 'ｺｸﾌﾞｸﾞﾙｰﾌﾟﾎﾝｼｬ',
    billOfficeCode: '200000000003',
    billOfficeName: 'ｵｵｻｶC',
    ...billingTotalsOf(486300, 0, 0),
  },
  {
    id: 'BILL-EDI-005',
    status: '反映済',
    dataSource: 'EDI',
    receivedAt: '2026/08/12 09:15',
    providerCode: '300000000003',
    providerName: 'ﾐﾂﾋﾞｼｼﾖｸﾋﾝ',
    billCompanyCode: '100000000003',
    billCompanyName: 'ﾐﾂﾋﾞｼｼﾖｸﾋﾝ',
    billOfficeCode: '200000000004',
    billOfficeName: 'ﾅｺﾞﾔC',
    ...billingTotalsOf(723150, 723150, 723150),
  },
  {
    id: 'BILL-EDI-006',
    status: '反映済',
    dataSource: 'EDI',
    receivedAt: '2026/08/15 09:00',
    providerCode: '300000000004',
    providerName: 'ｶﾄｳｻﾝｷﾞﾖｳ',
    billCompanyCode: '100000000004',
    billCompanyName: 'ｶﾄｳｻﾝｷﾞﾖｳ',
    billOfficeCode: '200000000005',
    billOfficeName: 'ｷﾕｳｼﾕｳC',
    ...billingTotalsOf(253800, 251300, 0),
  },
  {
    // 1つの提供企業の下に請求元企業が2社ある例（20261006_請求EDI取込結果詳細画面の表示データ変更.pptx）。
    // カナカンの請求EDIは、区分1の提供企業が北陸中央食品で、区分2に請求元企業
    // ﾎｸﾘｸﾁﾕｳｵｳｼﾖｸﾋﾝ／ｶﾅｶﾝ ﾎﾝｼﾔ の2つを含む。請求一覧は請求元企業事業所単位のため2行になる。
    // コード・事業所名・金額はモックの仮値
    id: 'BILL-EDI-009',
    status: '反映済',
    dataSource: 'EDI',
    receivedAt: '2026/08/18 09:00',
    providerCode: '300000000005',
    providerName: 'ﾎｸﾘｸﾁﾕｳｵｳｼﾖｸﾋﾝ',
    billCompanyCode: '100000000005',
    billCompanyName: 'ﾎｸﾘｸﾁﾕｳｵｳｼﾖｸﾋﾝ',
    billOfficeCode: '200000000006',
    billOfficeName: 'ｶﾅｻﾞﾜC',
    ...billingTotalsOf(315000, 315000, 0),
  },
  {
    id: 'BILL-EDI-010',
    status: '反映済',
    dataSource: 'EDI',
    receivedAt: '2026/08/18 09:00',
    providerCode: '300000000005',
    providerName: 'ﾎｸﾘｸﾁﾕｳｵｳｼﾖｸﾋﾝ',
    billCompanyCode: '100000000006',
    billCompanyName: 'ｶﾅｶﾝ ﾎﾝｼﾔ',
    billOfficeCode: '200000000007',
    billOfficeName: 'ﾄﾔﾏC',
    ...billingTotalsOf(128400, 128400, 0),
  },
  {
    id: 'BILL-AIC-007',
    status: '反映済',
    dataSource: 'AIC入力',
    receivedAt: '2026/07/16 14:05',
    providerCode: '',
    providerName: '',
    billCompanyCode: '',
    billCompanyName: '',
    billOfficeCode: '',
    billOfficeName: 'ﾋｶﾞｼﾆﾎﾝ',
    ...billingTotalsOf(372150, 372150, 372150),
  },
  {
    id: 'BILL-AIC-008',
    status: '反映済',
    dataSource: 'AIC入力',
    receivedAt: '2026/07/17 11:40',
    providerCode: '',
    providerName: '',
    billCompanyCode: '',
    billCompanyName: '',
    billOfficeCode: '',
    billOfficeName: 'ﾅｺﾞﾔC',
    ...billingTotalsOf(96420, 96420, 96420),
  },
];

// 請求EDI（販売促進金請求）取込結果の型定義・仮データ。
// フォーマット: 日本加工食品卸協会 販売促進金システム 請求データ Version1。
// 項目の出典（区分x-y）は docs/EDI/請求EDIフォーマット_変換対象項目_棚卸.md を参照。
// 一覧の1行は「請求元企業 × 受信日時」＝1回の受信ファイル。実サンプル3社（国分・三菱食品・
// 伊藤忠食品）を解析した結果、いずれも1ファイル＝1卸で、区分1〜8のセットの繰り返しは
// 同一卸内の束（国分2,786組／三菱6組＝事業所単位）だった。請求書・伝票は1ファイル内に
// 多数あるため行にはできない（国分＝請求書442・伝票2,786・明細16,953）。
// 支払は商流販売店単位で、EDIとは粒度が一致しない。支払との紐づけは請求一覧・請求詳細が担う。
//
// 仮データの件数はすべて明細データから集計する（buildCounts／countErrorRows）。
// 実データ規模の数値を手書きすると画面の中で辻褄が合わなくなるため、モック内で閉じさせる。
// ファイル単位で取り込めないエラー。いずれもシステム管理担当が対応する。
//   フォーマット不正   … レコード長・区分の並び・文字コードが仕様と違う
//   二重取込           … 同一ファイルの再受信（作成日付＋作成時刻＋提供企業コードで判定）
//   件数・金額不一致   … 区分8-3 レコード件数／8-4 請求金額合計が実データと合わない
// ※受信失敗は受信できていない＝行を作れないため、この一覧には載らない
export const SYSTEM_ERROR_REASONS = [
  'フォーマット不正',
  '二重取込',
  '件数・金額不一致',
] as const;
export type SystemErrorReason = (typeof SYSTEM_ERROR_REASONS)[number];

// 取込ステータス。取込・再取込はオンラインで実行され結果が即時に確定するため、
// 「取込中」「再取込指示済」のような待ち状態は持たない。
export type BillingEdiStatus = '正常' | 'エラー';

// 明細1行のステータス。エラー行を一目で判別するために使う（errors から導出する）
export type BillingEdiDetailStatus = '正常' | 'エラー';

// エラー区分。誰が対応するかで分ける（技術的な分類ではなく対応の担い手で切る）。
//   変換マスタ未登録 … 連携値は正しいが自社マスタに無い。業務担当がマスタを直すか
//                       変換後の値を登録して再取込する（決定4）
//   データ不正       … 連携値そのものが不正。卸へ照会するか、画面で値を直して再取込する
export const BILLING_EDI_ERROR_CATEGORIES = [
  '変換マスタ未登録',
  'データ不正',
] as const;
export type BillingEdiErrorCategory =
  (typeof BILLING_EDI_ERROR_CATEGORIES)[number];

// 影響範囲（請求書内すべて／伝票内すべて／この明細のみ）は決定14で意味を持たなくなったため
// 型・判定関数ごと廃止した。取込可否は請求元事業所単位で決まり、1件でもエラーがあれば
// その事業所は取り込まないため、どのレコード区分まで波及するかを持つ必要がない。

// 計上区分（区分4-3）。取消はこの区分で表し、請求計上金額は正の値のまま連携される
export type RecordingType = '通常' | '取消';

// 請求金額計算区分（区分4-16）。単価×数量と金額の突合（スライド7 No8）に使う
export type AmountCalcType = '切捨て' | '切上げ' | '四捨五入';

// 費目区分（決定9。卸ごとの判別ロジックで決まる）。判別できない場合は空文字。
// センターフィは追加口・拡売費とは別の費目として扱う（第31回 決定19／8-24 決定1・3・4）
export type ExpenseType = '追加口' | '拡売費' | 'センターフィ';

// 商品コード使用区分（区分4-9）。変換エラーの原因切り分けに使う。
// 標準フォーマット（4-9）の定義は 1：プライベート／3：JAN の2値だが、
// 5：SDP（旭食品）・6：GTIN（加藤産業）を卸独自の拡張値として使う卸がある
// （8-04 EDI打合せ 決定1・2）。GTIN は先頭ゼロを除いて JAN の変換ルールへ合流させる。
export type ProductCodeType = 'プライベート' | 'JAN' | 'SDP' | 'GTIN';

// 得意先区分（区分3-8）。商流変換の粒度に影響する。空白運用の卸もあるため空文字を許容
export type CustomerClass = '全店' | '地域' | '店舗' | '';

// 消費税区分（区分4-19）。宿題事項3で「条件単価・税率が変換の対象」とされた項目
export type TaxType = '外税' | '内税' | '非課税';

// 計上対象数量単位（区分4-12）の区分値。EDIからはコードで届き、画面・再取込ともコードのまま扱う
// （名称は表示時にだけ変換する）。定義外の区分値が連携された場合は空文字（生値は rawValues へ）
export type QtyUnitCode = '0' | '1' | '3' | '5' | '7';

// 計上対象数量単位の区分値と名称（請求EDIフォーマット定義 sys09_v2 区分4-12）。
// 0：円 は請求計上条件区分（4-13）が 0：％ の場合のみ使える
export const QTY_UNIT_DEFINITIONS: { code: QtyUnitCode; label: string }[] = [
  { code: '0', label: '円' },
  { code: '1', label: 'ケース' },
  { code: '3', label: 'バラ' },
  { code: '5', label: 'キログラム' },
  { code: '7', label: 'グラム' },
];

// 請求計上条件区分（区分4-13）。「％」のときは請求計上条件（4-14）が単価ではなく率になる
// （議事録2026/8/4 ASD芳賀発言：拡売費の一部はパーセントで連携される）
export type BillingConditionType =
  | '％'
  | 'ケース'
  | 'バラ'
  | 'キログラム'
  | 'グラム'
  | '金額';

// 販売促進金摘要コード（区分4-24）の名称。フォーマット仕様書のコード表（01〜99）より抜粋。
// 費目（追加口／拡売費）の判別に使う最有力の項目（決定9）。
export const PROMO_SUMMARY_NAMES: Record<string, string> = {
  '01': 'センターフィ',
  '02': '大陳料',
  '03': '拡売協力金',
  '04': 'チラシ代',
  '06': 'ポップ代',
  '10': 'キャンペーン協力金',
  '22': '新規定番導入料',
  '90': '(各社任意コード)',
};

// 費目判別ロジックの名称（決定9。卸ごとにパターン化し、どの卸にどれを適用するかを設定する）。
// 議事録2026/8/4：摘要コード(4-24)を使う卸は少なく、国分は「商品コードを全て0にして商品名を
// その他とし、請求条件を数量1で請求」、別の卸は「請求計上条件区分」で判別できる、とされている。
export const EXPENSE_RULES = {
  bySummaryCode: '摘要コード判別',
  byProductCode: '商品コード判別',
  byConditionType: '請求計上条件区分判別',
  // 国分・トーカン。約定区分が H ならセンターフィ、N なら摘要コード判別へ回す
  // （8-24 決定1／第27回 決定9）
  byContractType: '約定区分判別',
  // 卸ごとのロジックで判別できない場合の最終フォールバック（第30回 決定27／第31回 決定17）
  byTaxType: '消費税区分判別',
} as const;
export type ExpenseRule = (typeof EXPENSE_RULES)[keyof typeof EXPENSE_RULES];

// 摘要コードから費目を判別する仮ロジック（摘要コード判別を適用する卸で使う）。
// 未定義のコードは判別不可。エラーにはせず追加口として取り込む（決定19 2026-08-18）。
// 摘要コード 01 はフォーマット仕様書の 4-24 コード表どおりセンターフィとする
// （第31回 決定19／8-24 決定1・3・4）。
const EXPENSE_BY_SUMMARY: Record<string, ExpenseType> = {
  '01': 'センターフィ',
  '22': '追加口',
  '02': '拡売費',
  '03': '拡売費',
  '04': '拡売費',
  '06': '拡売費',
  '10': '拡売費',
};

// 約定区分（8-24 決定1）。H＝センターフィ、N＝摘要コード判別へ回す。
// ※日食協フォーマットに「約定区分」という項目名は無く、どの項目で連携されるかが未特定
//   （計上№（4-4）の7桁目が有力候補。卸への確認待ち）。特定できるまでは明細が持つ
//   contractType を連携値の置き場とし、画面には出さない。
export const CONTRACT_TYPE_CENTER_FEE = 'H';
export const CONTRACT_TYPE_NORMAL = 'N';

// 明細1行に付くエラー。原因（区分・エラー項目）で表す。
// 影響範囲は決定14で意味を持たなくなったため持たない
export interface BillingEdiDetailError {
  category: BillingEdiErrorCategory; // 区分（変換／形式）
  field: string; // エラー項目（事業所コード・得意先コード・商品コード 等）
  reason: string; // エラー内容
}

// 画面で値を直したときの区分。
//   連携値修正 … 形式エラー。卸から届いた値そのものが不正なため、明細のセルで直す
//   変換値指定 … 変換エラー。連携値は正しく変換先が決まらないため、変換後の値を指定する
//                （マスタ修正が本筋。値の指定は応急処置＝資料No1「卸へ照会し値を指定」）
export const CORRECTION_KINDS = ['連携値修正', '変換値指定'] as const;
export type CorrectionKind = (typeof CORRECTION_KINDS)[number];

// 原本（卸から連携された値）との差分。画面で値を直した項目だけ保持する。
// 受領した請求データの原本は保管が必要なため（宿題事項2・電子帳簿保存）、
// 連携値は上書きせず、直した後の値と修正者・修正日時を別に持つ。
export interface BillingEdiCorrection {
  kind: CorrectionKind;
  field: string; // 直した項目
  original: string; // 原本の連携値（変換値指定の場合は「(未変換)」）
  corrected: string; // 直した後の値
  correctedBy: string; // 修正者
  correctedAt: string; // 修正日時 'YYYY/MM/DD HH:mm'
}

// ── 卸会社の変換（提供企業コード 1-15 → 自社の卸会社）。一覧の行キーに使う（決定15）
const PAYEE_CONVERSION: Record<string, { code: string; name: string }> = {
  MF01: { code: 'W0002', name: '三菱食品株式会社' },
  KK01: { code: 'W0001', name: '国分株式会社' },
  KT01: { code: 'W0003', name: '加藤産業株式会社' },
};

// ── 商流販売店変換マスタ（2026/08/18 第30回 決定事項No.12）
// 次の組合せから商流販売店（一次店・三次店・販売店）を直接導出する。
//   ①原則：提供企業コード（1-15）＋請求元企業事業所コード（2-7）＋得意先コード（3-6）
//   ②請求元企業事業所コードが連携されない場合：提供企業コード＋請求元企業コード（2-5）＋得意先コード
// コードを1つずつ個別に変換する方式は採らない（事業所・得意先の個別変換は行わない）。
export interface RetailerConversion {
  storeCode: string; // 販売店コード
  storeName: string; // 販売店名
  primaryStoreCode: string; // 一次店コード
  primaryStoreName: string; // 一次店名
  tertiaryStoreCode: string; // 三次店コード
  tertiaryStoreName: string; // 三次店名
}

/**
 * 商流販売店変換マスタのキー。請求元企業事業所コードがあれば①、無ければ②の組合せで1件を表す。
 * ①で見つからない場合に②へ読み替えることはしない。
 */
export const retailerKey = (
  providerCode: string,
  senderCode: string,
  officeCode: string,
  customerCode: string
): string =>
  officeCode
    ? `${providerCode}|office:${officeCode}|${customerCode}`
    : `${providerCode}|sender:${senderCode}|${customerCode}`;

// 三次店（得意先コードに対応する自社の三次店）。一次店は卸会社ごとに決まる
const TERTIARY_STORES: Record<string, { code: string; name: string }> = {
  '9901': { code: '10754882', name: 'イオン東北ＲＤＣ' },
  '9902': { code: '10754883', name: 'イオン九州ＲＤＣ' },
  '9903': { code: '10754884', name: 'イオン関東ＲＤＣ' },
  '9904': { code: '10754885', name: 'イオン中部ＲＤＣ' },
  '9905': { code: '10754886', name: 'イオン北海道ＲＤＣ' },
};

// 販売店（得意先コードに対応する自社の販売店）。三次店とあわせて商流販売店を構成する
const RETAIL_STORES: Record<string, { code: string; name: string }> = {
  '9901': { code: '30310001', name: 'イオンリテール東北カンパニー' },
  '9902': { code: '30310002', name: 'イオン九州' },
  '9903': { code: '30310003', name: 'イオンリテール南関東カンパニー' },
  '9904': { code: '30310004', name: 'イオンリテール東海カンパニー' },
  '9905': { code: '30310005', name: 'イオン北海道' },
};

// 一次店（卸会社の変換結果に対応する自社の一次店）
const PRIMARY_STORES: Record<string, { code: string; name: string }> = {
  MF01: { code: '10888030', name: '三菱食品株式会社（イオン）' },
  KK01: { code: '10903533', name: '国分株式会社' },
  KT01: { code: '10888031', name: '加藤産業株式会社' },
};

/** 商流変換マスタの1件分を組み立てる（モックの登録内容を宣言的に書くためのヘルパー）。 */
const retailerEntry = (
  senderCode: string,
  customerCode: string
): RetailerConversion => ({
  storeCode: RETAIL_STORES[customerCode].code,
  storeName: RETAIL_STORES[customerCode].name,
  primaryStoreCode: PRIMARY_STORES[senderCode].code,
  primaryStoreName: PRIMARY_STORES[senderCode].name,
  tertiaryStoreCode: TERTIARY_STORES[customerCode].code,
  tertiaryStoreName: TERTIARY_STORES[customerCode].name,
});

// 提供企業コード（1-15）。データ提供元＝卸を表し、商流変換の入力のひとつになる
export const PROVIDER_CODES = {
  mitsubishi: '828300',
  kokubu: '800001',
  kato: '800002',
} as const;

// モックの商流変換マスタ。卸ごとに「登録済みの事業所 × 得意先」を展開して作る。
// ここに現れない組合せが商流変換エラー＝取込エラーになる（決定13）。
//   ・MF01-03      … 事業所ごと未登録（その請求書の配下すべてが取込不可）
//   ・9902／9905   … 得意先ごと未登録（その伝票の配下すべてが取込不可）
const RETAILER_MASTER_SEEDS: {
  providerCode: string;
  senderCode: string;
  officeCodes: string[];
  customerCodes: string[];
}[] = [
  {
    providerCode: PROVIDER_CODES.mitsubishi,
    senderCode: 'MF01',
    officeCodes: ['MF01-01', 'MF01-02'],
    customerCodes: ['9901', '9903', '9904'],
  },
  {
    providerCode: PROVIDER_CODES.kokubu,
    senderCode: 'KK01',
    officeCodes: ['KK01-01', 'KK01-02'],
    customerCodes: ['9901', '9903', '9904'],
  },
  {
    providerCode: PROVIDER_CODES.kato,
    senderCode: 'KT01',
    officeCodes: ['KT01-01'],
    customerCodes: ['9901', '9903', '9904'],
  },
];

const RETAILER_CONVERSION: Record<string, RetailerConversion> = {};
for (const seed of RETAILER_MASTER_SEEDS) {
  for (const customerCode of seed.customerCodes) {
    const entry = retailerEntry(seed.senderCode, customerCode);
    // ①事業所単位の登録
    for (const officeCode of seed.officeCodes) {
      RETAILER_CONVERSION[
        retailerKey(
          seed.providerCode,
          seed.senderCode,
          officeCode,
          customerCode
        )
      ] = entry;
    }
    // ②請求元企業事業所コードを連携しない請求書向けの、請求元企業単位の登録
    RETAILER_CONVERSION[
      retailerKey(seed.providerCode, seed.senderCode, '', customerCode)
    ] = entry;
  }
}

/** ①／②の組合せから商流販売店を導出する。登録が無ければ undefined（＝取込エラー）。 */
export const resolveRetailer = (
  providerCode: string,
  senderCode: string,
  officeCode: string,
  customerCode: string
): RetailerConversion | undefined =>
  RETAILER_CONVERSION[
    retailerKey(providerCode, senderCode, officeCode, customerCode)
  ];

// 「変換後の値」で選ぶ商流販売店の選択肢（一次店・三次店・販売店の組）。
// 選択肢の母集団は変換マスタ（RETAILER_CONVERSION）ではなく自社の商流販売店マスタとする。
// 変換マスタに登録が無いコードに対し、自社マスタにある商流販売店を指定して変換マスタへ
// 登録し直す操作のため、変換マスタ由来の組合せでは選べる先が足りない（決定28）。
export interface RetailerAssignOption extends RetailerConversion {
  // 選択値。同じ三次店・販売店が複数の一次店にぶら下がるため、3つの組で一意にする
  value: string;
  label: string; // 表示（一次店名 / 三次店名 / 販売店名:販売店コード）
}

export const RETAILER_ASSIGN_OPTIONS: RetailerAssignOption[] = Object.values(
  PRIMARY_STORES
).flatMap((primary) =>
  Object.entries(TERTIARY_STORES).map(([customerCode, tertiary]) => {
    const store = RETAIL_STORES[customerCode];
    return {
      storeCode: store.code,
      storeName: store.name,
      primaryStoreCode: primary.code,
      primaryStoreName: primary.name,
      tertiaryStoreCode: tertiary.code,
      tertiaryStoreName: tertiary.name,
      value: `${primary.code}-${tertiary.code}-${store.code}`,
      label: `${primary.name} / ${tertiary.name} / ${store.name}:${store.code}`,
    };
  })
);

// 変換エラーで画面から指定する「変換後の値」の種類。
// 商流販売店変換マスタの出力は商流販売店（一次店・三次店・販売店）そのものであり（決定12）、
// コードごとの変換先を指定する方式は採らない。
export const ASSIGN_TARGETS = ['商流販売店', 'オンライン商品'] as const;
export type AssignTarget = (typeof ASSIGN_TARGETS)[number];

// エラー項目 → 指定する変換後の値の種類
export const ASSIGN_TARGET_BY_FIELD: Record<string, AssignTarget> = {
  商流販売店: '商流販売店',
  商品コード: 'オンライン商品',
};

// 変換後の値の選択肢（マスタから選ぶ。自由入力にすると存在しない値が入り再びエラーになる）。
// 実システムでは事業所マスタ・得意先マスタ・商品マスタ・費目設定から取得する。
export const ASSIGN_OPTIONS: Record<
  AssignTarget,
  { value: string; label: string }[]
> = {
  // 商流販売店は一次店・三次店・販売店の組で選ぶ
  商流販売店: RETAILER_ASSIGN_OPTIONS.map(({ value, label }) => ({
    value,
    label,
  })),
  オンライン商品: [
    { value: 'S2001', label: '三ツ矢サイダー ペット 500ml:S2001' },
    { value: 'S2002', label: 'ウィルキンソン タンサン 500ml:S2002' },
    { value: 'S2003', label: 'カルピスウォーター 500ml:S2003' },
  ],
};

// エラー種別ごとの対応部署（決定10 2026-08-18）。マスタで設定し、対応の進行に応じて付け替えない。
// 取込エラーの一次対応はAICが担う（課題No.1278・2026-08-27 芳賀回答。営業戦略部はデータの
// 詳細を見られる環境にないため）。ファイル自体が壊れていて業務では直せないものだけ
// システム管理担当が対応する。
export const ERROR_CATEGORY_OWNERS: Record<string, string> = {
  フォーマット不正: 'システム管理担当',
  二重取込: 'システム管理担当',
  '件数・金額不一致': 'システム管理担当',
  変換マスタ未登録: 'AIC',
  データ不正: 'AIC',
};

// 再取込の状態（エラーサマリ1件ごと）
export const REIMPORT_STATES = ['未実施', '解消', '未解消'] as const;
export type ReimportState = (typeof REIMPORT_STATES)[number];

// エラーサマリ（詳細画面 中段）の1行。同じ原因の明細をまとめた作業単位＝再取込の単位。
// 「エラー項目」が何で、その「値」が何だったか、変換に併せて使う「補助項目」は何かを持つ。
export interface BillingEdiErrorSummary {
  id: string;
  category: BillingEdiErrorCategory; // 区分（変換／形式）
  field: string; // エラー項目
  valueCode: string; // エラー項目の値（コード）
  valueName: string; // エラー項目の値（名称）。名称を持たない項目は空
  // 補助項目。変換・検証に併せて使う項目を「項目名：値」で並べる。
  // 請求EDI明細で確認できる内容のため画面には出さない（保持のみ）
  subFields: string;
  // 影響範囲（この明細のみ／伝票内すべて／請求書内すべて）は決定14で意味を持たなくなったため廃止。
  // 1件でもエラーがあればその請求元事業所は取り込まないため、対象の請求元事業所を画面で示す。
  reason: string; // エラー内容
  // これを解消すると直る明細件数（＝エラー明細件数）はデータとして持たない。
  // 対象明細の定義を matchesErrorSummary に一本化し、targetCountOf() で都度導出する
  // （データに手書きすると、行押下で絞り込んだ結果と件数がズレる余地があるため）
  // 明細のセルで連携値を直せるか（形式エラー＝true）。
  // 形式エラーは卸から届いた値そのものが不正で、マスタでは直せないため明細側で直す。
  correctable: boolean;
  // 画面で登録した「変換後の値」。変換エラーのみ。未登録は空文字。
  // 値があればそれを適用して再変換し、無ければマスタから再変換する（分岐は持たない）
  assignedValue: string;
  // 再取込の状態。取込はオンラインのため、押した時点で解消／未解消が確定する。
  //   未実施 … まだ再取込していない
  //   解消   … 再取込して対象明細のエラーが解消した（履歴として表示に残す）
  //   未解消 … 再取込したが、このエラー自体が解消しなかった（マスタ未修正のまま再取込した等）。
  //            対象明細に別のエラーが残っているかどうかは状態に影響しない
  resolveState: ReimportState;
}

// 請求EDI明細（フラット）＝詳細画面 下段。決定6により集約しない。
// 列は区分2（請求書）→ 区分3（伝票）→ 区分4/5（明細）の順に並べる。
export interface BillingEdiDetailRow {
  id: string;

  // ── 区分1 ファイルヘッダー
  providerCode: string; // 提供企業コード（1-15）。卸会社の判定・商流変換の入力

  // ── 区分2 請求元情報（請求書単位）
  billingNo: string; // 請求書№（2-3）
  senderCode: string; // 請求元企業コード（2-5）。卸会社判定・商流変換の入力
  senderName: string; // 請求元企業名（2-6）
  senderOfficeCode: string; // 請求元企業事業所コード（2-7）。決定7の粒度キー
  senderOfficeName: string; // 請求元企業事業所名（2-8）
  // 請求締日（区分2）。対象期間（終了日）が空欄の明細は、この日付が属する月を
  // 対象月とする（→ 20260804_第27回 決定事項8／課題 No.1184・No.1286）。
  billingClosingDate: string;

  // ── 区分3 得意先情報（伝票単位）※伝票ヘッダ項目のため1伝票に1つ
  slipNo: string; // 請求伝票番号（3-3）
  customerCode: string; // 得意先コード（3-6）。商流変換の入力
  customerName: string; // 得意先名（3-9）
  // 得意先区分（3-8）。取込では保持するが請求EDI取込結果詳細の画面には表示しない（決定22）
  customerClass: CustomerClass;

  // ── 変換後（卸会社）
  // 提供企業コード（1-15）から導出する。一覧の行キーに使う（決定15）。
  // 請求元企業は一覧・基本情報とも連携値をそのまま表示する方式のため、
  // 明細には変換後の列を出さない（取込では保持する）
  convertedPayeeCode: string; // 卸会社コード
  convertedPayeeName: string; // 卸会社名

  // ── 変換後（商流販売店）
  // 商流販売店変換マスタを①／②の組合せで引いて導出する（決定12）。
  // 導出できない明細は取込エラーとし、請求詳細画面へは連携しない（決定13）。
  storeCode: string; // 販売店コード。導出できない場合は空文字
  storeName: string; // 販売店名
  primaryStoreCode: string; // 一次店コード。導出できない場合は空文字
  primaryStoreName: string; // 一次店名
  tertiaryStoreCode: string; // 三次店コード。導出できない場合は空文字
  tertiaryStoreName: string; // 三次店名

  // ── 区分4 請求明細
  recordingNo: string; // 計上№（4-4）。卸への照会キー
  accountingDate: string; // 計上日（4-5）'YYYY/MM/DD'。形式エラー時は連携生値のまま
  // 対象年月 'YYYY/MM'。対象期間（終了日・4-22）が属する月。終了日が空欄なら
  // 請求締日（区分2）が属する月とする（決定8）。どちらも取れない場合は空文字。
  targetMonth: string;
  periodFrom: string; // 対象期間（開始日・4-21）。計上月＋01
  periodTo: string; // 対象期間（終了日・4-22）。計上月＋末日
  recordingType: RecordingType; // 計上区分（4-3）
  summaryCode: string; // 販売促進金摘要コード（4-24）。費目判別の入力のひとつ
  summaryName: string; // 摘要名（コード表より）。未定義コードは空文字
  // 適用した費目判別ロジック（決定9。卸ごとにパターン化し、項目単位で適用先を設定する）。
  // 摘要コードを使わない卸があるため、判別に使う項目は卸ごとに異なる
  expenseRule: string;
  // 約定区分（8-24 決定1）。連携項目が未特定のため画面には出さず、判別の入力としてのみ持つ
  contractType: string;
  expenseType: ExpenseType | ''; // 費目（変換後）。判別不可は空文字
  promotionPlanNo: string; // 販売促進企画番号（4-23）。支払データへ引き継ぐ
  productCodeOriginal: string; // 商品コード（変換前・4-8）。未連携は空文字
  productNameOriginal: string; // 商品名（変換前・区分5-3）。未変換時の唯一の手がかり
  // 備考（区分5-5）。卸によって拡売費の内容が商品名の欄ではなくこちらに入る（第31回 決定8）。
  // どちらも連携値のまま表示し、読み替えロジックは設けない
  noteOriginal: string;
  productCodeType: ProductCodeType | ''; // 商品コード使用区分（4-9）
  // 商品は 商品コード（JAN／卸プライベート）→ オンライン商品コード → サマリ商品コード の
  // 2段階で変換する（宿題事項4の回答：JANとオンライン商品は1:Nだがロジックで一意化）。
  // サマリ商品へは変換するがレコードは集約しない（決定6）。
  onlineProductCode: string; // オンライン商品コード（変換後）。未変換は空文字
  onlineProductName: string; // オンライン商品名（変換後）。未変換は空文字
  summaryProductCode: string; // サマリ商品コード（オンライン商品から導出）。未変換は空文字
  summaryProductName: string; // サマリ商品名。未変換は空文字
  billingQty: number | null; // 請求計上対象数量（4-11）。決定11により null を許容
  qtyUnit: QtyUnitCode | ''; // 計上対象数量単位（4-12）のコード。定義外の区分値は空文字
  casePack: number; // ケース入数（4-10）。金額の検算に使う
  billingConditionType: BillingConditionType; // 請求計上条件区分（4-13）
  billingCondition: number; // 請求計上条件（4-14）。区分が「％」なら率、それ以外は単価（金額）
  // 請求計上金額（4-15）。実データでは常に正の値で連携され、取消は計上区分（4-3）で表される
  // （区分8-4 の合計も、束の計上区分 8-6 を考慮すると実サンプル2,786束すべてで一致した）。
  // 数値に変換できない場合は null
  billingAmount: number | null;
  amountCalcType: AmountCalcType; // 請求金額計算区分（4-16）
  taxType: TaxType; // 消費税区分（4-19）。外税／内税／非課税
  // 請求消費税額（4-17）。仕様上ゼロ固定で実データでも常にゼロのため画面には出さない。
  // 取込では保持する（税額の見せ方は区分8の値を基本情報に出すかを含め整理中）
  billingTax: number;

  // ── 取込結果
  // 型変換できなかった項目の連携生値（列見出し→生値）。数値・日付として保持できないため、
  // 画面はここから元の値を表示する。
  rawValues: Record<string, string>;
  // 画面で修正した項目の差分（原本→修正後）。原本は上書きしない
  corrections: BillingEdiCorrection[];
  errors: BillingEdiDetailError[]; // エラー（複数可）。空＝実質正常
  // 再取込で取り除いたエラーのエラーサマリID。再取込するとエラーは errors から消えるが、
  // エラーサマリの行を選んだときに対象明細を引き当てられるよう対応を残す
  reimportedSummaryIds: string[];
  // 受信日時。卸からこの明細を受け取った日時。基本情報の受信日時は明細の最も古い値を出す
  receivedAt: string;
  // 再取込日時。この明細を最後に再取込した日時。未実施は空文字。
  // 基本情報の再取込日時は明細の最も新しい値を出す
  reimportedAt: string;
}

// 一覧の1行＝請求元企業 × 受信日時
export interface BillingEdiImportRow {
  id: string;
  receivedAt: string; // 受信日時 'YYYY/MM/DD HH:mm'。卸から受け取った日時。行キーであり再取込しても変わらない
  reimportedAt: string; // 再取込日時 'YYYY/MM/DD HH:mm'。再取込を実行した日時。未実施は空文字
  // 請求元企業。マスタ変換は行わず請求EDIの連携値をそのまま表示する。
  // フォーマット不正のように中身を読めない場合のみ null＝配下を特定できない
  payeeName: string | null;
  senderNames: string[]; // 請求元（変換前）。詳細の基本情報でのみ使用
  status: BillingEdiStatus;
  isSystemError: boolean; // 形式不正・受信失敗・二重取込。配下を持たない
  systemErrorReason: SystemErrorReason | ''; // ファイル単位のエラー内容。通常行は空文字
  counts: { invoices: number; slips: number; details: number };
  errorCount: number; // エラー明細件数
  errorSummaries: BillingEdiErrorSummary[];
  details: BillingEdiDetailRow[];
}

// 検索条件。一覧に列として存在する項目だけを条件にする
export interface BillingEdiSearchCriteria {
  importDateFrom: string; // 受信日（開始・YYYY/MM/DD。未指定は空文字）
  importDateTo: string; // 受信日（終了・YYYY/MM/DD。未指定は空文字）
  payee: string; // 卸会社（部分一致）
  status: string; // 'all' または BillingEdiStatus
}

// 受信日の初期値（決定11 2026-08-18）。業務仕様は「当月1日〜当月末日」だが、
// モックの受信日時が2026年8月固定のため、システム日付から導出すると初期表示が0件になる。
// 他の一覧画面（支払一覧・引用一覧・計画一覧）と同様に仮データに合わせた固定値にする。
const INITIAL_IMPORT_DATE_FROM = '2026/08/01';
const INITIAL_IMPORT_DATE_TO = '2026/08/31';

// 請求元企業の検索候補。実システムでは取引先マスタから取得する。
export const BILLING_EDI_PAYEE_OPTIONS: string[] = [
  '国分株式会社',
  '三菱食品株式会社',
  '伊藤忠食品株式会社',
  '加藤産業株式会社',
];

// 検索条件の初期値（クリアボタンで戻す値）
// ステータスの初期値は「エラー」。エラーを見ることが本画面の主目的で、
// ステータスは正常／エラーの2値しかないため、「エラーのみ」の絞り込みは
// ステータスの初期値で足りる（2026/9/11 一覧 4.レイアウト AJ46 のコメント）
export const INITIAL_SEARCH_CRITERIA: BillingEdiSearchCriteria = {
  importDateFrom: INITIAL_IMPORT_DATE_FROM,
  importDateTo: INITIAL_IMPORT_DATE_TO,
  payee: '',
  status: 'エラー',
};

// ─────────────────────────────────────────────────────────────────────────
// 仮データ生成

// 検算・照会用項目の仮データ生成に使う対象月。計上日はこの月内に散らす
const TARGET_MONTH = '2026/07';
const PERIOD_FROM = `${TARGET_MONTH}/01`;
const PERIOD_TO = `${TARGET_MONTH}/30`;
// 請求締日（区分2）。対象期間（終了日）が空欄の明細の対象月の導出に使う。
const BILLING_CLOSING_DATE = `${TARGET_MONTH}/31`;
const CASE_PACKS = [24, 30, 6];
// 請求計上条件区分が「％」以外の明細に割り当てる単位（円は「％」の明細のみ。区分4-12の定義）
const QTY_UNITS: QtyUnitCode[] = ['1', '3', '5', '7'];
// 拡売費の一部を「％」で連携されるケースとして再現する率のサンプル
const RATE_SAMPLES = [1.26, 3.5, 8.0, 12.5];
// 明細に循環して割り当てる摘要コード（4-24）。すべて EXPENSE_BY_SUMMARY に定義がある＝費目変換可
const SUMMARY_CODE_CYCLE = ['01', '02', '03', '04', '06', '10', '22'];
// 費目を判別できない摘要コード（各社任意コード帯）
const UNKNOWN_SUMMARY_CODE = '90';
// 形式エラーの連携生値
const INVALID_DATE_RAW = '20260631'; // 6月31日は存在しない
const INVALID_AMOUNT_RAW = '****'; // 数値として解釈できない
const INVALID_QTY_UNIT_RAW = '8'; // 定義は QTY_UNIT_DEFINITIONS を参照

// 得意先コード（3-6）と得意先名（3-9）の対応。連携値の名称はカナで届く（実サンプル準拠）
const CUSTOMER_NAMES: Record<string, string> = {
  '9901': 'ｲｵﾝﾄｳﾎｸRDC',
  '9902': 'ｲｵﾝｷﾕｳｼﾕｳRDC',
  '9903': 'ｲｵﾝｶﾝﾄｳRDC',
  '9904': 'ｲｵﾝﾁﾕｳﾌﾞRDC',
  '9905': 'ｲｵﾝﾎﾂｶｲﾄﾞｳRDC',
};

// サマリ商品（オンライン商品から導出）。サマリ商品1に対しオンライン商品N（議事録2026/8/4 梶田）
export const SUMMARY_PRODUCT_CODE = 'SM0001';
export const SUMMARY_PRODUCT_NAME = '三ツ矢サイダー';

// 商品を特定できない商品コード（すべて0／すべて9）。卸が拡売費をまとめて請求するときに使う。
// 変換エラーにはせず、サマリ商品「ブランド横断」へ寄せる（8-24 決定2）。
// オンライン商品は特定できないため空のままとする。
export const SUMMARY_PRODUCT_CROSS_BRAND_CODE = 'SM9999';
export const SUMMARY_PRODUCT_CROSS_BRAND_NAME = 'ブランド横断';
const isCrossBrandCode = (productCode: string): boolean =>
  /^0+$/.test(productCode) || /^9+$/.test(productCode);

// 備考（区分5-5）の連携サンプル。卸によって拡売費の内容がこの欄に入る（第31回 決定8）
const NOTE_SAMPLES = [
  '',
  'ｷﾔﾝﾍﾟｰﾝ ｷﾖｳﾘﾖｸｷﾝ',
  '',
  '',
  'ﾃﾝﾄﾞﾋﾞﾗ ｷﾖｳﾘﾖｸｷﾝ',
  '',
  '',
];

// 対象月を導出する。対象期間（終了日）が属する月を採り、終了日が空欄なら
// 請求締日が属する月を採る。どちらも取れなければ空文字（＝導出不可）。
// （→ 20260804_第27回 決定事項8・宿題事項8／課題 No.1184・No.1286）
export const resolveTargetMonth = (
  periodTo: string,
  billingClosingDate: string
): string => {
  const monthOf = (date: string) =>
    /^\d{4}\/\d{2}\/\d{2}$/.test(date) ? date.slice(0, 7) : '';
  return monthOf(periodTo) || monthOf(billingClosingDate);
};

// 計上№・計上日・対象年月・対象期間・ケース入数・請求金額計算区分をまとめて生成する。
const buildAccountingFields = (
  recordingNoPrefix: string,
  index: number
): Pick<
  BillingEdiDetailRow,
  | 'recordingNo'
  | 'accountingDate'
  | 'targetMonth'
  | 'periodFrom'
  | 'periodTo'
  | 'casePack'
  | 'amountCalcType'
> => {
  const day = (index % 30) + 1;
  const accountingDate = `${TARGET_MONTH}/${String(day).padStart(2, '0')}`;
  return {
    recordingNo: `K${recordingNoPrefix}${String(index + 1).padStart(5, '0')}`,
    accountingDate,
    targetMonth: resolveTargetMonth(PERIOD_TO, BILLING_CLOSING_DATE),
    periodFrom: PERIOD_FROM,
    periodTo: PERIOD_TO,
    casePack: CASE_PACKS[index % CASE_PACKS.length],
    amountCalcType: index % 5 === 0 ? '四捨五入' : '切捨て',
  };
};

// 商品コード使用区分（4-9）。卸ごとの設定があればそれを使い、無ければコードの形式から判定する。
//   PB始まり … プライベート（1）
//   14桁     … GTIN（6・加藤産業）。先頭ゼロを除いてJANの変換ルールへ合流させる
//   8桁      … SDP（5・旭食品）
//   それ以外 … JAN（3）
const resolveProductCodeType = (
  productCodeOriginal: string,
  configured?: ProductCodeType
): ProductCodeType | '' => {
  if (!productCodeOriginal) return '';
  if (configured) return configured;
  if (productCodeOriginal.startsWith('PB')) return 'プライベート';
  if (productCodeOriginal.length === 14) return 'GTIN';
  if (productCodeOriginal.length === 8) return 'SDP';
  return 'JAN';
};

/** GTIN の先頭ゼロを除き、JAN の変換ルールへ合流できる形にする（8-04 EDI打合せ 決定2）。 */
export const normalizeProductCode = (
  productCodeOriginal: string,
  productCodeType: ProductCodeType | ''
): string =>
  productCodeType === 'GTIN'
    ? productCodeOriginal.replace(/^0+/, '')
    : productCodeOriginal;

// 摘要コード（4-24）から費目・摘要名を導出する（決定9の仮ロジック）
const buildExpenseFields = (
  rule: ExpenseRule,
  summaryCode: string,
  productCodeOriginal: string,
  billingConditionType: BillingConditionType,
  contractType: string
): Pick<
  BillingEdiDetailRow,
  'summaryCode' | 'summaryName' | 'expenseRule' | 'expenseType'
> => {
  const base = {
    summaryCode,
    summaryName: PROMO_SUMMARY_NAMES[summaryCode] ?? '',
    expenseRule: rule,
  };
  // 摘要コード判別。コード表に無い値（各社任意コード帯など）は判別できない。
  // 判別できない摘要コードは追加口として取り込む（決定19）
  const bySummary = EXPENSE_BY_SUMMARY[summaryCode] ?? '追加口';

  if (rule === EXPENSE_RULES.byProductCode) {
    // 商品コードを全て0にして商品名を「その他」とし、拡売費を表現する卸
    return {
      ...base,
      expenseType: isCrossBrandCode(productCodeOriginal) ? '拡売費' : '追加口',
    };
  }
  if (rule === EXPENSE_RULES.byConditionType) {
    // 商品コードにプライベートコードを使うため商品では判断できず、請求計上条件区分で判別する卸
    return {
      ...base,
      expenseType: billingConditionType === '％' ? '拡売費' : '追加口',
    };
  }
  if (rule === EXPENSE_RULES.byContractType) {
    // 国分・トーカン。約定区分が H ならセンターフィ、N なら摘要コード判別へ回す（8-24 決定1）
    return {
      ...base,
      expenseType:
        contractType === CONTRACT_TYPE_CENTER_FEE ? 'センターフィ' : bySummary,
    };
  }
  if (rule === EXPENSE_RULES.byTaxType) {
    // 卸ごとのロジックで判別できない場合のフォールバック（第30回 決定27／第31回 決定17）。
    // 消費税区分（4-19）は「外税／内税／非課税」で税率ではなく、卸ごとの読み替え定義が
    // 決まるまで判別できないため、判別できない明細として追加口で取り込む（決定19）。
    return { ...base, expenseType: '追加口' };
  }
  return { ...base, expenseType: bySummary };
};

// 計上対象数量単位・請求計上条件区分・請求計上条件を生成する。
// 拡売費の一部は単価ではなく率（％）で連携される（議事録 ASD芳賀発言に対応）。
const buildBillingConditionFields = (
  index: number
): Pick<
  BillingEdiDetailRow,
  'qtyUnit' | 'billingConditionType' | 'billingCondition'
> => {
  const qtyUnit = QTY_UNITS[index % QTY_UNITS.length];
  // 一部は単価ではなく率（％）で連携される。この区分自体が費目判別に使える卸もある（決定9）
  const isRateCase = index % 7 === 0;
  if (isRateCase) {
    return {
      qtyUnit: '0',
      billingConditionType: '％',
      billingCondition: RATE_SAMPLES[index % RATE_SAMPLES.length],
    };
  }
  return {
    qtyUnit,
    billingConditionType: '金額',
    billingCondition: 320 + (index % 9) * 40,
  };
};

// ── エラー定義。明細とエラーサマリの双方から参照し、文言のぶれを防ぐ
// 商流販売店変換マスタに①／②の組合せが無い（決定12・13）。影響範囲は組合せのどこが欠けているかで変わる。
//   事業所ごと未登録 … その請求書の配下すべてが取込不可
//   得意先ごと未登録 … その伝票の配下すべてが取込不可
const E_RETAILER_UNRESOLVED_INVOICE: BillingEdiDetailError = {
  category: '変換マスタ未登録',
  field: '商流販売店',
  reason: '商流変換マスタ未登録',
};
const E_RETAILER_UNRESOLVED_SLIP: BillingEdiDetailError = {
  category: '変換マスタ未登録',
  field: '商流販売店',
  reason: '商流変換マスタ未登録',
};
const E_PRODUCT_UNREGISTERED: BillingEdiDetailError = {
  category: '変換マスタ未登録',
  field: '商品コード',
  reason: '商品マスタ未登録',
};
const E_PRODUCT_MISSING: BillingEdiDetailError = {
  category: 'データ不正',
  field: '商品コード',
  reason: '必須項目が未連携',
};
const E_AMOUNT_NOT_NUMERIC: BillingEdiDetailError = {
  category: 'データ不正',
  field: '請求計上金額',
  reason: '数値以外の値',
};
const E_DATE_INVALID: BillingEdiDetailError = {
  category: 'データ不正',
  field: '計上日',
  reason: '日付として不正',
};
const E_QTY_UNIT_UNDEFINED: BillingEdiDetailError = {
  category: 'データ不正',
  field: '計上対象数量単位',
  reason: '定義外の区分値',
};
// 「単価×数量と請求金額の不一致」は取込時にはチェックしない（決定21 2026-08-18）。
// 連携された値をそのまま取り込み、金額の妥当性の確認と修正は請求詳細画面で行う。

// 請求元（区分2-5〜2-8）
interface SenderSeed {
  code: string;
  name: string;
}

// 請求書（区分2）1件分の構成。事業所は請求書ごとに変わりうる（決定7の粒度）
interface InvoiceSeed {
  billingNo: string; // 請求書№（2-3）
  officeCode: string; // 請求元企業事業所コード（2-7）
  officeName: string; // 請求元企業事業所名（2-8）
  officeResolvable: boolean; // この事業所の組合せが商流変換マスタにあるか
  slipCustomers: string[]; // 伝票の並び順に対応する得意先コード（3-6）
  detailsPerSlip: number;
}

// 行ごとの明細レベル判定
interface DetailVerdict {
  errors: BillingEdiDetailError[];
  productCodeOriginal?: string; // 商品エラー時に差し替える変換前コード（'' は未連携）
  summaryCode?: string; // 費目エラー時に差し替える摘要コード
  amountInvalid?: boolean; // 請求計上金額が数値でない
  amountMismatch?: boolean; // 単価×数量と金額が合わない
  dateInvalid?: boolean; // 計上日が日付として不正
  qtyUnitInvalid?: boolean; // 計上対象数量単位が定義外
}

interface DetailSeed {
  prefix: string;
  sender: SenderSeed;
  invoices: InvoiceSeed[];
  customerClass: CustomerClass;
  // 商流変換マスタに組合せが無い得意先コード＝その伝票の配下すべてが取込不可（決定13）
  unresolvedCustomers: string[];
  providerCode: string; // 提供企業コード（1-15）。商流変換の入力
  expenseRule: ExpenseRule; // 適用する費目判別ロジック（卸ごとに設定。決定9）
  // 商品コード使用区分（4-9）。卸独自の拡張値を使う卸だけ設定する（8-04 EDI打合せ 決定1・2）
  productCodeType?: ProductCodeType;
  receivedAt: string; // 受信日時。この受信ファイルの明細に共通で入る
  reimportedAt?: string; // 再取込日時。再取込を実行した受信ファイルだけ設定する
  // 再取込の対象になった明細か。再取込はエラーサマリ単位で実行するため、
  // まだ再取込していないエラーが残る明細には再取込日時を入れない
  isReimported?: (verdict: DetailVerdict) => boolean;
  // 上位（請求書・伝票）が正常だった明細にだけ適用する判定。連番 n は 0 から通し
  classifyDetail: (n: number) => DetailVerdict;
}

const createDetails = (seed: DetailSeed): BillingEdiDetailRow[] => {
  const rows: BillingEdiDetailRow[] = [];
  let index = 0; // 全体の連番（計上№・id の生成に使う）
  let okIndex = 0; // 上位が正常な明細内の連番（明細レベルのエラー割当に使う）

  for (const invoice of seed.invoices) {
    invoice.slipCustomers.forEach((customerCode, slipIndex) => {
      const slipNo = `D-${String(slipIndex + 1).padStart(4, '0')}`;
      const customerUnresolved =
        seed.unresolvedCustomers.includes(customerCode);
      // ①／②の組合せから商流販売店を導出する（決定12）。導出できなければ取込エラー（決定13）
      const retailer = resolveRetailer(
        seed.providerCode,
        seed.sender.code,
        invoice.officeCode,
        customerCode
      );

      for (let d = 1; d <= invoice.detailsPerSlip; d++) {
        // 商流変換は請求書（事業所）・伝票（得意先）の単位で決まるため先に判定する。
        // 商流販売店が決まらない場合、配下の明細は取り込めないため
        // 明細レベルの判定（商品コード等）は行わない。
        let verdict: DetailVerdict;
        if (!invoice.officeResolvable) {
          verdict = { errors: [E_RETAILER_UNRESOLVED_INVOICE] };
        } else if (customerUnresolved) {
          verdict = { errors: [E_RETAILER_UNRESOLVED_SLIP] };
        } else {
          verdict = seed.classifyDetail(okIndex++);
        }

        const summaryCode =
          verdict.summaryCode ??
          SUMMARY_CODE_CYCLE[index % SUMMARY_CODE_CYCLE.length];
        const baseProductCode = `490134003${String(1000 + index).slice(-4)}`;
        const productCodeOriginal =
          verdict.productCodeOriginal ??
          // GTIN を使う卸は14桁・先頭ゼロ詰めで連携される（8-04 EDI打合せ 決定2）
          (seed.productCodeType === 'GTIN'
            ? baseProductCode.padStart(14, '0')
            : baseProductCode);
        // 商品を特定できないコード（すべて0／すべて9）はエラーにせずブランド横断へ寄せる
        const crossBrand = isCrossBrandCode(productCodeOriginal);
        // 商品が変換できたか。商品エラー時のみ変換前コードが差し替えられる
        const productConverted =
          verdict.productCodeOriginal === undefined && !crossBrand;
        const accounting = buildAccountingFields(seed.prefix, index);
        // 費目は判別ロジックによって使う項目が変わるため、条件区分を先に決めてから導出する
        const conditionFields = buildBillingConditionFields(index);
        // 約定区分（8-24 決定1）。約定区分判別を適用する卸だけ値を持つ
        const contractType =
          seed.expenseRule === EXPENSE_RULES.byContractType
            ? index % 3 === 0
              ? CONTRACT_TYPE_CENTER_FEE
              : CONTRACT_TYPE_NORMAL
            : '';
        const expenseFields = buildExpenseFields(
          seed.expenseRule,
          summaryCode,
          productCodeOriginal,
          conditionFields.billingConditionType,
          contractType
        );
        // 金額は常に正。取消は計上区分（4-3）で表す
        const baseAmount = 4080 + (index % 7) * 320;

        const rawValues: Record<string, string> = {};
        if (verdict.amountInvalid)
          rawValues['請求計上金額'] = INVALID_AMOUNT_RAW;
        if (verdict.dateInvalid) rawValues['計上日'] = INVALID_DATE_RAW;
        if (verdict.qtyUnitInvalid) {
          rawValues['計上対象数量単位'] = INVALID_QTY_UNIT_RAW;
        }
        if (verdict.productCodeOriginal === '') {
          // 必須項目（区分4-8）が空で連携されたケース。原本が空であることを残す
          rawValues['商品コード'] = '(未連携)';
        }

        rows.push({
          id: `${seed.prefix}-${invoice.billingNo}-${slipNo}-${d}`,
          billingNo: invoice.billingNo,
          senderCode: seed.sender.code,
          senderName: seed.sender.name,
          senderOfficeCode: invoice.officeCode,
          senderOfficeName: invoice.officeName,
          billingClosingDate: BILLING_CLOSING_DATE,
          slipNo,
          customerCode,
          customerName: CUSTOMER_NAMES[customerCode] ?? '',
          customerClass: seed.customerClass,
          providerCode: seed.providerCode,
          // 卸会社は提供企業コードから導出する（一覧の行キー。決定15）
          convertedPayeeCode: PAYEE_CONVERSION[seed.sender.code]?.code ?? '',
          convertedPayeeName: PAYEE_CONVERSION[seed.sender.code]?.name ?? '',
          // 商流販売店は①／②の組合せから直接導出する（決定12）。未登録は空文字
          storeCode: retailer?.storeCode ?? '',
          storeName: retailer?.storeName ?? '',
          primaryStoreCode: retailer?.primaryStoreCode ?? '',
          primaryStoreName: retailer?.primaryStoreName ?? '',
          tertiaryStoreCode: retailer?.tertiaryStoreCode ?? '',
          tertiaryStoreName: retailer?.tertiaryStoreName ?? '',
          ...accounting,
          // 計上日が日付として不正なら生値のまま保持する。
          // 対象月は計上日ではなく対象期間（終了日）／請求締日から導出するため、
          // 計上日の不正は対象月の導出には影響しない（決定8）。
          accountingDate: verdict.dateInvalid
            ? INVALID_DATE_RAW
            : accounting.accountingDate,
          recordingType: index % 17 === 0 ? '取消' : '通常',
          contractType,
          ...expenseFields,
          promotionPlanNo: `PL26${String((index % 4) + 1).padStart(4, '0')}`,
          productCodeOriginal,
          productNameOriginal: !productCodeOriginal
            ? ''
            : crossBrand
              ? 'ｿﾉﾀ'
              : 'ﾐﾂﾔｻｲﾀﾞｰ ﾍﾟｯﾄ 500ML',
          // 拡売費の内容が商品名ではなく備考に入る卸がある（第31回 決定8）
          noteOriginal: crossBrand
            ? 'ｿﾉﾀ ｶｸﾊﾞｲﾋ'
            : NOTE_SAMPLES[index % NOTE_SAMPLES.length],
          productCodeType: resolveProductCodeType(
            productCodeOriginal,
            seed.productCodeType
          ),
          // 商品コード → オンライン商品コード → サマリ商品コード の2段階変換。
          // ブランド横断はオンライン商品を特定できないためサマリ商品だけを持つ（8-24 決定2）
          onlineProductCode: productConverted ? `S${String(2000 + index)}` : '',
          onlineProductName: productConverted
            ? '三ツ矢サイダー ペット 500ml'
            : '',
          summaryProductCode: crossBrand
            ? SUMMARY_PRODUCT_CROSS_BRAND_CODE
            : productConverted
              ? SUMMARY_PRODUCT_CODE
              : '',
          summaryProductName: crossBrand
            ? SUMMARY_PRODUCT_CROSS_BRAND_NAME
            : productConverted
              ? SUMMARY_PRODUCT_NAME
              : '',
          billingQty: index % 11 === 0 ? null : 120 * ((index % 5) + 1),
          ...conditionFields,
          qtyUnit: verdict.qtyUnitInvalid ? '' : conditionFields.qtyUnit,
          // 検算不一致は、算出根拠から導かれる金額とわざとずらした値を持たせる
          billingAmount: verdict.amountInvalid
            ? null
            : verdict.amountMismatch
              ? baseAmount + 777
              : baseAmount,
          taxType: index % 13 === 0 ? '非課税' : '外税',
          billingTax: 0, // 仕様上ゼロ固定（区分4-17）。税率は宿題事項3で整理中
          rawValues,
          corrections: [],
          errors: verdict.errors,
          reimportedSummaryIds: [],
          receivedAt: seed.receivedAt,
          // 再取込していない明細は空。基本情報はこの最大値を再取込日時に出す
          reimportedAt:
            seed.reimportedAt && (seed.isReimported?.(verdict) ?? true)
              ? seed.reimportedAt
              : '',
        });
        index++;
      }
    });
  }
  return rows;
};

/** 明細から一覧の件数を集計する（手書きの件数と食い違わせないため）。 */
const buildCounts = (
  details: BillingEdiDetailRow[]
): BillingEdiImportRow['counts'] => ({
  invoices: new Set(details.map((d) => d.billingNo)).size,
  slips: new Set(details.map((d) => `${d.billingNo}/${d.slipNo}`)).size,
  details: details.length,
});

/** エラーを持つ明細の行数。 */
const countErrorRows = (details: BillingEdiDetailRow[]): number =>
  details.filter((d) => d.errors.length > 0).length;

// ─────────────────────────────────────────────────────────────────────────
// R2 三菱食品（エラーあり）
// 明細200件のうちエラー40件（20.0%）。エラー種別は変換5種・形式5種の計10種。

const MITSUBISHI_SENDER: SenderSeed = {
  code: 'MF01',
  name: 'ﾐﾂﾋﾞｼｼﾖｸﾋﾝ',
};
// 事業所コードが変換マスタに無い請求書（配下8明細がまとめて取込不可になる）
const MITSUBISHI_UNRESOLVED_OFFICE = 'MF01-03';
// 得意先コードそのものが変換マスタに無い（＝エラー。伝票内すべてが取込不可）
const MITSUBISHI_UNRESOLVED_CUSTOMER = '9902';
// 得意先ごと変換マスタに無い2件目（＝エラー。伝票内すべてが取込不可）
const MITSUBISHI_UNRESOLVED_CUSTOMER_2 = '9905';
// R2 の受信日時（一覧の行と同じ値を明細にも持たせる）
const MITSUBISHI_RECEIVED_AT = '2026/08/10 08:30';
const MITSUBISHI_JAN_UNREGISTERED = '4901234567890';
const MITSUBISHI_PB_UNREGISTERED = 'PB-0034';

const MITSUBISHI_DETAILS = createDetails({
  prefix: 'R2',
  sender: MITSUBISHI_SENDER,
  customerClass: '店舗',
  unresolvedCustomers: [
    MITSUBISHI_UNRESOLVED_CUSTOMER,
    MITSUBISHI_UNRESOLVED_CUSTOMER_2,
  ],
  providerCode: PROVIDER_CODES.mitsubishi,
  expenseRule: EXPENSE_RULES.bySummaryCode,
  receivedAt: MITSUBISHI_RECEIVED_AT,
  invoices: [
    {
      billingNo: 'A26-0001',
      officeCode: 'MF01-01',
      officeName: 'ﾐﾂﾋﾞｼｼﾖｸﾋﾝ ｼﾕﾄｹﾝ',
      officeResolvable: true,
      // D-0003 は得意先9902、D-0005 は得意先9905（どちらも変換マスタ未登録）
      slipCustomers: [
        '9901',
        '9903',
        MITSUBISHI_UNRESOLVED_CUSTOMER,
        '9904',
        MITSUBISHI_UNRESOLVED_CUSTOMER_2,
        '9903',
        '9904',
        '9901',
      ],
      detailsPerSlip: 12,
    },
    {
      billingNo: 'A26-0002',
      officeCode: 'MF01-02',
      officeName: 'ﾐﾂﾋﾞｼｼﾖｸﾋﾝ ｶﾝｻｲ',
      officeResolvable: true,
      slipCustomers: [
        '9901',
        '9903',
        '9904',
        '9901',
        '9903',
        '9904',
        MITSUBISHI_UNRESOLVED_CUSTOMER_2,
        '9901',
      ],
      detailsPerSlip: 12,
    },
    {
      billingNo: 'A26-0003',
      officeCode: MITSUBISHI_UNRESOLVED_OFFICE,
      officeName: 'ﾐﾂﾋﾞｼｼﾖｸﾋﾝ ｷﾕｳｼﾕｳ',
      officeResolvable: false, // 配下8明細がまとめて取込不可
      slipCustomers: ['9901'],
      detailsPerSlip: 8,
    },
  ],
  // 上位が正常な180明細のうち20行にエラーを割り当てる（残り160行は正常）
  classifyDetail: (n) => {
    if (n < 6) {
      return {
        errors: [E_PRODUCT_UNREGISTERED],
        productCodeOriginal: MITSUBISHI_JAN_UNREGISTERED,
      };
    }
    if (n < 9) {
      return {
        errors: [E_PRODUCT_UNREGISTERED],
        productCodeOriginal: MITSUBISHI_PB_UNREGISTERED,
      };
    }
    if (n < 10) {
      // 必須項目（区分4-8 商品コード）が空で連携された
      return { errors: [E_PRODUCT_MISSING], productCodeOriginal: '' };
    }
    // 費目を判別できない明細。エラーにはせず追加口として取り込む（決定19 2026-08-18）
    if (n < 13) {
      return { errors: [], summaryCode: UNKNOWN_SUMMARY_CODE };
    }
    if (n < 14) {
      return { errors: [E_AMOUNT_NOT_NUMERIC], amountInvalid: true };
    }
    if (n < 15) {
      return { errors: [E_DATE_INVALID], dateInvalid: true };
    }
    if (n < 16) {
      // 1明細に複数のエラーが付くケース
      return {
        errors: [E_AMOUNT_NOT_NUMERIC, E_DATE_INVALID],
        amountInvalid: true,
        dateInvalid: true,
      };
    }
    if (n < 17) {
      return { errors: [E_QTY_UNIT_UNDEFINED], qtyUnitInvalid: true };
    }
    // 単価×数量と金額が合わない明細。取込時はエラーにせず、そのまま取り込む（決定21）
    if (n < 20) {
      return { errors: [], amountMismatch: true };
    }
    return { errors: [] };
  },
});

const MITSUBISHI_ERROR_SUMMARIES: BillingEdiErrorSummary[] = [
  // 商流販売店の変換は①／②の組合せ単位（決定12）。エラーサマリの値は組合せのうち
  // 欠けているコード（事業所または得意先）を表す。
  {
    id: 'R2-E1',
    category: '変換マスタ未登録',
    field: '商流販売店',
    valueCode: MITSUBISHI_UNRESOLVED_OFFICE,
    valueName: 'ﾐﾂﾋﾞｼｼﾖｸﾋﾝ ｷﾕｳｼﾕｳ',
    subFields: `提供企業コード：${PROVIDER_CODES.mitsubishi} / 請求元企業コード：MF01 / 請求元企業事業所コード：${MITSUBISHI_UNRESOLVED_OFFICE} / 得意先コード：9901`,
    reason: '商流変換マスタ未登録',
    correctable: false,
    assignedValue: '',
    resolveState: '未実施',
  },
  {
    id: 'R2-E2',
    category: '変換マスタ未登録',
    field: '商流販売店',
    valueCode: MITSUBISHI_UNRESOLVED_CUSTOMER,
    valueName: 'ｲｵﾝｷﾕｳｼﾕｳRDC',
    subFields: `提供企業コード：${PROVIDER_CODES.mitsubishi} / 請求元企業コード：MF01 / 請求元企業事業所コード：MF01-01 / 得意先コード：${MITSUBISHI_UNRESOLVED_CUSTOMER}`,
    reason: '商流変換マスタ未登録',
    correctable: false,
    assignedValue: '',
    resolveState: '未実施',
  },
  {
    id: 'R2-E2B',
    category: '変換マスタ未登録',
    field: '商流販売店',
    valueCode: MITSUBISHI_UNRESOLVED_CUSTOMER_2,
    valueName: 'ｲｵﾝﾎﾂｶｲﾄﾞｳRDC',
    subFields: `提供企業コード：${PROVIDER_CODES.mitsubishi} / 請求元企業コード：MF01 / 請求元企業事業所コード：MF01-01 / 得意先コード：${MITSUBISHI_UNRESOLVED_CUSTOMER_2}`,
    reason: '商流変換マスタ未登録',
    correctable: false,
    assignedValue: '',
    resolveState: '未実施',
  },
  {
    id: 'R2-E3',
    category: '変換マスタ未登録',
    field: '商品コード',
    valueCode: MITSUBISHI_JAN_UNREGISTERED,
    valueName: 'ﾐﾂﾔｻｲﾀﾞｰ ﾍﾟｯﾄ 500ML',
    subFields: '商品コード使用区分：JAN',
    reason: '商品マスタ未登録',
    correctable: false,
    assignedValue: '',
    resolveState: '未実施',
  },
  {
    id: 'R2-E4',
    category: '変換マスタ未登録',
    field: '商品コード',
    valueCode: MITSUBISHI_PB_UNREGISTERED,
    valueName: 'ﾐﾂﾔｻｲﾀﾞｰ ﾍﾟｯﾄ 500ML',
    subFields: '商品コード使用区分：プライベート',
    reason: '商品マスタ未登録',
    correctable: false,
    assignedValue: '',
    resolveState: '未実施',
  },
  // 費目判別のエラーサマリは決定19により廃止（判別できない明細は追加口として取り込む）
  {
    id: 'R2-E6',
    category: 'データ不正',
    field: '商品コード',
    valueCode: '',
    valueName: '',
    subFields: '商品コード使用区分：(未連携)',
    reason: '必須項目が未連携',
    correctable: true,
    assignedValue: '',
    resolveState: '未実施',
  },
  {
    id: 'R2-E7',
    category: 'データ不正',
    field: '請求計上金額',
    valueCode: INVALID_AMOUNT_RAW,
    valueName: '',
    subFields: '',
    reason: '数値以外の値',
    correctable: true,
    assignedValue: '',
    resolveState: '未実施',
  },
  {
    id: 'R2-E8',
    category: 'データ不正',
    field: '計上日',
    valueCode: INVALID_DATE_RAW,
    valueName: '',
    subFields: '',
    reason: '日付として不正',
    correctable: true,
    assignedValue: '',
    resolveState: '未実施',
  },
  {
    id: 'R2-E9',
    category: 'データ不正',
    field: '計上対象数量単位',
    valueCode: INVALID_QTY_UNIT_RAW,
    valueName: '',
    subFields: '定義：0円 / 1ケース / 3バラ / 5キログラム / 7グラム',
    reason: '定義外の区分値',
    correctable: true,
    assignedValue: '',
    resolveState: '未実施',
  },
  // 「単価×数量と不一致」のエラーサマリは決定21により廃止（取込時にチェックしない）
];

// ─────────────────────────────────────────────────────────────────────────
// R1 国分（正常）
const KOKUBU_DETAILS = createDetails({
  prefix: 'R1',
  sender: { code: 'KK01', name: 'ｺｸﾌﾞ' },
  customerClass: '店舗',
  unresolvedCustomers: [],
  providerCode: PROVIDER_CODES.kokubu,
  // 国分・トーカンは約定区分で判別する（8-24 決定1）
  expenseRule: EXPENSE_RULES.byContractType,
  receivedAt: '2026/08/10 08:30',
  invoices: [
    {
      billingNo: 'K26-0007',
      officeCode: 'KK01-01',
      officeName: 'ｺｸﾌﾞ ﾄｳｷﾖｳ',
      officeResolvable: true,
      slipCustomers: ['9901', '9903', '9904', '9901'],
      detailsPerSlip: 10,
    },
    {
      billingNo: 'K26-0008',
      officeCode: 'KK01-02',
      officeName: 'ｺｸﾌﾞ ｶﾝｻｲ',
      officeResolvable: true,
      slipCustomers: ['9903', '9904', '9901', '9903'],
      detailsPerSlip: 10,
    },
  ],
  // 拡売費をまとめて請求する明細は商品コードをすべて0で送ってくる。商品は特定できないが
  // エラーにはせず、サマリ商品「ブランド横断」へ寄せる（8-24 決定2）
  classifyDetail: (n) =>
    n % 5 === 4
      ? { errors: [], productCodeOriginal: '000000000' }
      : { errors: [] },
});

// ─────────────────────────────────────────────────────────────────────────
// R4 三菱食品（再取込を実行して解消済み）
// R4-E1（商品マスタ未登録）の対象だった明細数。解消済みのエラーサマリから対象明細を引けるよう、
// 先頭の明細をその対象として、変換後の値（S2001）を適用した状態にする
const MITSUBISHI_R4_RESOLVED_COUNT = 4;
const MITSUBISHI_R4_DETAILS = createDetails({
  prefix: 'R4',
  sender: MITSUBISHI_SENDER,
  customerClass: '店舗',
  unresolvedCustomers: [],
  providerCode: PROVIDER_CODES.mitsubishi,
  expenseRule: EXPENSE_RULES.bySummaryCode,
  receivedAt: '2026/08/12 09:15',
  // 再取込を実行した日時（この時点で取り込めた）
  reimportedAt: '2026/08/12 15:40',
  invoices: [
    {
      billingNo: 'A26-0004',
      officeCode: 'MF01-01',
      officeName: 'ﾐﾂﾋﾞｼｼﾖｸﾋﾝ ｼﾕﾄｹﾝ',
      officeResolvable: true,
      slipCustomers: ['9901', '9903'],
      detailsPerSlip: 6,
    },
  ],
  classifyDetail: () => ({ errors: [] }),
}).map((detail, i) =>
  i < MITSUBISHI_R4_RESOLVED_COUNT
    ? {
        ...detail,
        productCodeOriginal: '4901234567890',
        onlineProductCode: 'S2001',
        reimportedSummaryIds: ['R4-E1'],
      }
    : detail
);

// R4 で解消済みのエラーサマリ。何をどのように直したかを後から追えるよう履歴として残す。
const MITSUBISHI_R4_ERROR_SUMMARIES: BillingEdiErrorSummary[] = [
  {
    id: 'R4-E1',
    category: '変換マスタ未登録',
    field: '商品コード',
    valueCode: '4901234567890',
    valueName: 'ﾐﾂﾔｻｲﾀﾞｰ ﾍﾟｯﾄ 500ML',
    subFields: '商品コード使用区分：JAN',
    reason: '商品マスタ未登録',
    correctable: false,
    // 変換後の値を指定して解消した例
    assignedValue: 'S2001',
    resolveState: '解消',
  },
];

// ─────────────────────────────────────────────────────────────────────────
// R5 加藤産業（再取込したが解消しなかったエラーが残る）
// 「まだ再取込していない」ものと「再取込したがエラー自体が解消しなかった」ものを区別するための例。
// 同じ明細に複数のエラーがあると、すべて解消するまでその明細は取り込めない。
// 加藤産業はGTIN（14桁・先頭ゼロ詰め）で連携する（8-04 EDI打合せ 決定2）
const KATO_GTIN_UNREGISTERED = '04909876543210';

let katoOkIndex = 0;

const KATO_DETAILS = createDetails({
  prefix: 'R5',
  sender: { code: 'KT01', name: 'ｶﾄｳｻﾝｷﾞﾖｳ' },
  customerClass: '店舗',
  unresolvedCustomers: [],
  providerCode: PROVIDER_CODES.kato,
  expenseRule: EXPENSE_RULES.byConditionType,
  // 加藤産業は商品コードにGTIN（6）を使う（8-04 EDI打合せ 決定2）
  productCodeType: 'GTIN',
  receivedAt: '2026/08/15 09:00',
  reimportedAt: '2026/08/15 16:20',
  // 再取込したのは商品コードのエラーサマリのみ。金額のエラーはまだ再取込していない
  isReimported: (verdict) =>
    verdict.errors.some((e) => e.field === '商品コード'),
  invoices: [
    {
      billingNo: 'KT26-0001',
      officeCode: 'KT01-01',
      officeName: 'ｶﾄｳｻﾝｷﾞﾖｳ ﾎﾝｼﾔ',
      officeResolvable: true,
      slipCustomers: ['9901', '9903', '9904'],
      detailsPerSlip: 20,
    },
  ],
  classifyDetail: () => {
    const n = katoOkIndex++;
    // 2件：商品マスタを直さないまま再取込し、商品マスタ未登録が解消しなかった（＝未解消）。
    // 計上日も不正のため、両方のエラーが解消するまで取り込めない
    if (n < 2) {
      return {
        errors: [E_PRODUCT_UNREGISTERED, E_DATE_INVALID],
        productCodeOriginal: KATO_GTIN_UNREGISTERED,
        dateInvalid: true,
      };
    }
    // 3件：まだ再取込していない形式エラー
    if (n < 5) {
      return { errors: [E_AMOUNT_NOT_NUMERIC], amountInvalid: true };
    }
    return { errors: [] };
  },
});

const KATO_ERROR_SUMMARIES: BillingEdiErrorSummary[] = [
  {
    id: 'R5-E1',
    category: '変換マスタ未登録',
    field: '商品コード',
    valueCode: KATO_GTIN_UNREGISTERED,
    valueName: 'ｱｻﾋ ｵｲﾁﾔ ﾍﾟｯﾄ 600ML',
    subFields: '商品コード使用区分：JAN',
    reason: '商品マスタ未登録',
    correctable: false,
    assignedValue: '',
    // 商品マスタを修正しないまま再取込したため、このエラー自体が解消しなかった
    resolveState: '未解消',
  },
  {
    id: 'R5-E2',
    category: 'データ不正',
    field: '計上日',
    valueCode: INVALID_DATE_RAW,
    valueName: '',
    subFields: '',
    reason: '日付として不正',
    correctable: true,
    assignedValue: '',
    resolveState: '未実施',
  },
  {
    id: 'R5-E3',
    category: 'データ不正',
    field: '請求計上金額',
    valueCode: INVALID_AMOUNT_RAW,
    valueName: '',
    subFields: '',
    reason: '数値以外の値',
    correctable: true,
    assignedValue: '',
    resolveState: '未実施',
  },
];

// 一覧の仮データ。同一受信（2026/08/10 08:30）に複数卸が混載される様子を表す
export const BILLING_EDI_ROWS: BillingEdiImportRow[] = [
  {
    id: 'R0',
    receivedAt: '2026/08/10 08:30',
    reimportedAt: '',
    payeeName: null,
    senderNames: [],
    status: 'エラー',
    isSystemError: true,
    systemErrorReason: 'フォーマット不正',
    counts: { invoices: 0, slips: 0, details: 0 },
    errorCount: 0,
    errorSummaries: [],
    details: [],
  },
  {
    id: 'R1',
    receivedAt: '2026/08/10 08:30',
    reimportedAt: '',
    payeeName: 'ｺｸﾌﾞ',
    senderNames: ['KOKUBU-東京', 'KOKUBU-関西', 'KOKUBU-九州'],
    status: '正常',
    isSystemError: false,
    systemErrorReason: '',
    counts: buildCounts(KOKUBU_DETAILS),
    errorCount: countErrorRows(KOKUBU_DETAILS),
    errorSummaries: [],
    details: KOKUBU_DETAILS,
  },
  {
    id: 'R2',
    receivedAt: '2026/08/10 08:30',
    reimportedAt: '',
    payeeName: 'ﾐﾂﾋﾞｼｼﾖｸﾋﾝ',
    senderNames: ['MF01'],
    status: 'エラー',
    isSystemError: false,
    systemErrorReason: '',
    counts: buildCounts(MITSUBISHI_DETAILS),
    errorCount: countErrorRows(MITSUBISHI_DETAILS),
    errorSummaries: MITSUBISHI_ERROR_SUMMARIES,
    details: MITSUBISHI_DETAILS,
  },
  {
    id: 'R4',
    receivedAt: '2026/08/12 09:15',
    // 再取込を実行して解消した例（オンライン取込のため押した時点で結果が確定する）
    reimportedAt: '2026/08/12 15:40',
    payeeName: 'ﾐﾂﾋﾞｼｼﾖｸﾋﾝ',
    senderNames: ['MF01'],
    status: '正常',
    isSystemError: false,
    systemErrorReason: '',
    counts: buildCounts(MITSUBISHI_R4_DETAILS),
    errorCount: countErrorRows(MITSUBISHI_R4_DETAILS),
    // 解消したエラーサマリも残す（何をどのように直したかを後から追えるようにするため）
    errorSummaries: MITSUBISHI_R4_ERROR_SUMMARIES,
    details: MITSUBISHI_R4_DETAILS,
  },
  {
    id: 'R6',
    receivedAt: '2026/08/10 08:30',
    reimportedAt: '',
    payeeName: 'ｺｸﾌﾞ',
    senderNames: ['KOKUBU-東京'],
    status: 'エラー',
    isSystemError: true,
    // 作成日付＋作成時刻＋提供企業コードが既に取り込んだファイルと同一だった
    systemErrorReason: '二重取込',
    counts: { invoices: 0, slips: 0, details: 0 },
    errorCount: 0,
    errorSummaries: [],
    details: [],
  },
  {
    id: 'R7',
    receivedAt: '2026/08/10 08:30',
    reimportedAt: '',
    payeeName: 'ｲﾄｳﾁﾕｳｼﾖｸﾋﾝ',
    senderNames: ['IT01'],
    status: 'エラー',
    isSystemError: true,
    // 区分8-3 レコード件数／8-4 請求金額合計がファイルの実データと合わない
    systemErrorReason: '件数・金額不一致',
    counts: { invoices: 0, slips: 0, details: 0 },
    errorCount: 0,
    errorSummaries: [],
    details: [],
  },
  {
    id: 'R5',
    receivedAt: '2026/08/15 09:00',
    // 再取込を実行したが、マスタ未修正のためエラー自体が解消しなかった例
    reimportedAt: '2026/08/15 16:20',
    payeeName: 'ｶﾄｳｻﾝｷﾞﾖｳ',
    senderNames: ['KT01'],
    status: 'エラー',
    isSystemError: false,
    systemErrorReason: '',
    counts: buildCounts(KATO_DETAILS),
    errorCount: countErrorRows(KATO_DETAILS),
    errorSummaries: KATO_ERROR_SUMMARIES,
    details: KATO_DETAILS,
  },
];

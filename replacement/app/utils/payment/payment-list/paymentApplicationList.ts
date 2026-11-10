// 支払一覧の表示整形・検索フィルタ判定（純粋関数）。
// React / AG Grid の結合部は型チェックと目視で確認するため、ここには UI 依存を持ち込まない。

/** 伝票種別。振替＝検印後に行う部署間の付替え（追加口→拡売費の費目振替とは別物）。 */
export const VOUCHER_TYPE = {
  payment: '支払',
  deptTransfer: '振替',
} as const;

export type VoucherType = (typeof VOUCHER_TYPE)[keyof typeof VOUCHER_TYPE];

/** 検索プルダウンの「全て」を表す値。 */
export const VOUCHER_TYPE_ALL = '全て';

/** ステータス「支払無し」（当月は支払が発生しない伝票）。 */
export const NO_PAYMENT_STATUS = '支払無し';

/** ステータス検索の「全て」。支払無しを含め、ステータスで絞り込まない。 */
export const STATUS_FILTER_ALL = 'all';

/**
 * ステータス検索の「支払無し以外」（検索条件の初期値）。
 * 支払無しの伝票は初期の検索条件では一覧に出さない（課題No.0949、7/24 共通セッション）。
 * 支払無しも見たいときは「全て」または「支払無し」を選ぶ。
 */
export const STATUS_FILTER_EXCLUDING_NO_PAYMENT = 'excludingNoPayment';

/** 値なしを表す表示文字（グレーの半角「-」。画面設計標準 3.11・グリッド共通の GRID_EMPTY_TEXT と同じ）。 */
const DASH = '-';

/**
 * 代表1件＋「他N件」形式に整形する。
 * 振替は1伝票が複数の振替元・複数の振替先部署を束ねるため、一覧では代表1件のみ表示し、
 * 内訳は振替詳細で確認する。
 */
export function formatRepresentative(values: string[]): string {
  if (values.length === 0) {
    return DASH;
  }
  if (values.length === 1) {
    return values[0];
  }
  return `${values[0]} 他${values.length - 1}件`;
}

/** 検索フィルタの判定に必要な行の項目。 */
export interface PaymentListFilterableRow {
  accountingMonth: string;
  targetMonth: string;
  status: string;
  voucherType: string;
  /** 販売店コード（振替は商流を持たないため空文字）。 */
  retailerCode: string;
  /** 一次店コード（振替は空文字）。 */
  primaryStoreCode: string;
  /** 三次店コード（振替は空文字）。 */
  tertiaryStoreCode: string;
}

/** 検索条件。 */
export interface PaymentListFilterCriteria {
  dateBasis: 'accounting' | 'target';
  yearMonthStart: string;
  yearMonthEnd: string;
  /**
   * ステータス。STATUS_FILTER_ALL は絞り込まない。
   * STATUS_FILTER_EXCLUDING_NO_PAYMENT は支払無しだけを除く。
   */
  status: string;
  /** 伝票種別。VOUCHER_TYPE_ALL は絞り込まない。 */
  voucherType: string;
  /** 販売店（販売店コード）。'' または未指定なら絞らない。 */
  retailer?: string;
  /** 一次店（一次店コード）。'' または未指定なら絞らない。 */
  primaryStore?: string;
  /** 三次店（三次店コード）。'' または未指定なら絞らない。 */
  tertiaryStore?: string;
}

/** 行が検索条件に一致するか判定する（各条件は AND）。 */
export function matchesPaymentListFilter(
  row: PaymentListFilterableRow,
  criteria: PaymentListFilterCriteria
): boolean {
  // 年月範囲（計上年月／対象年月をラジオで切替。YYYY/MM の文字列比較でよい）。
  // 開始・終了は×でクリアできるため、指定されている側だけ判定する。
  const targetYm =
    criteria.dateBasis === 'accounting' ? row.accountingMonth : row.targetMonth;
  if (criteria.yearMonthStart && targetYm < criteria.yearMonthStart) {
    return false;
  }
  if (criteria.yearMonthEnd && targetYm > criteria.yearMonthEnd) {
    return false;
  }
  // ステータス（「全て」は絞らない／「支払無し以外」は支払無しだけを除く／他は一致するもの）
  if (criteria.status === STATUS_FILTER_EXCLUDING_NO_PAYMENT) {
    if (row.status === NO_PAYMENT_STATUS) {
      return false;
    }
  } else if (
    criteria.status !== STATUS_FILTER_ALL &&
    row.status !== criteria.status
  ) {
    return false;
  }
  // 伝票種別
  if (
    criteria.voucherType !== VOUCHER_TYPE_ALL &&
    row.voucherType !== criteria.voucherType
  ) {
    return false;
  }
  // 販売店・一次店・三次店（商流販売店を構成する3項目。指定したものだけで絞る）
  if (criteria.retailer && row.retailerCode !== criteria.retailer) {
    return false;
  }
  if (criteria.primaryStore && row.primaryStoreCode !== criteria.primaryStore) {
    return false;
  }
  if (
    criteria.tertiaryStore &&
    row.tertiaryStoreCode !== criteria.tertiaryStore
  ) {
    return false;
  }
  return true;
}

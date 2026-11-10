import {
  DEALER_OPTIONS,
  FIRST_STORE_OPTIONS,
  THIRD_STORE_OPTIONS,
} from '../../../constants/storeTierMockData';

// 引用基本情報（支払一覧の右ペイン入力 → 遷移先へ引き継ぐ4項目）。
export interface QuoteBasicInfo {
  targetMonth: string; // 対象年月（YYYY/MM）
  dealer: string; // 販売店（DEALER_OPTIONS の value）
  thirdStore: string; // 三次店（THIRD_STORE_OPTIONS の value）
  firstStore: string; // 一次店（FIRST_STORE_OPTIONS の value）
}

// 引用基本情報の既定値。右ペイン初期表示／遷移先プリフィルの共通フォールバックであり、
// 既存 SearchPane の初期値（対象年月 2025/10・各店 先頭 option）に合わせる。
export const DEFAULT_QUOTE_BASIC_INFO: QuoteBasicInfo = {
  targetMonth: '2025/10',
  dealer: DEALER_OPTIONS[0].value,
  thirdStore: THIRD_STORE_OPTIONS[0].value,
  firstStore: FIRST_STORE_OPTIONS[0].value,
};

// 部分指定の基本情報を既定値で補完して完全な QuoteBasicInfo にする。
// 空文字は「未入力」ではなく「クリア（任意項目の空選択）」として尊重するため、
// null / undefined のときだけ既定値へフォールバックする（`??` を使用）。
export function resolveQuoteBasicInfo(
  info?: Partial<QuoteBasicInfo>
): QuoteBasicInfo {
  return {
    targetMonth: info?.targetMonth ?? DEFAULT_QUOTE_BASIC_INFO.targetMonth,
    dealer: info?.dealer ?? DEFAULT_QUOTE_BASIC_INFO.dealer,
    thirdStore: info?.thirdStore ?? DEFAULT_QUOTE_BASIC_INFO.thirdStore,
    firstStore: info?.firstStore ?? DEFAULT_QUOTE_BASIC_INFO.firstStore,
  };
}

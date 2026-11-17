import type { StoreSelectOption } from '@/types/organization';

// 引用基本情報（支払一覧の右ペイン入力 → 遷移先へ引き継ぐ4項目）。
export interface QuoteBasicInfo {
  targetMonth: string; // 対象年月（YYYY/MM）
  dealer: string; // 販売店（選択肢 dealer の value）
  thirdStore: string; // 三次店（選択肢 third の value）
  firstStore: string; // 一次店（選択肢 first の value）
}

// 引用基本情報の販売店・一次店・三次店の選択肢（画面がマスタから取得して渡す）
export interface QuoteStoreOptions {
  dealer: StoreSelectOption[];
  first: StoreSelectOption[];
  third: StoreSelectOption[];
}

// 部分指定の基本情報を既定値（defaults）で補完して完全な QuoteBasicInfo にする。
// 空文字は「未入力」ではなく「クリア（任意項目の空選択）」として尊重するため、
// null / undefined のときだけ既定値へフォールバックする（`??` を使用）。
export function resolveQuoteBasicInfo(
  defaults: QuoteBasicInfo,
  info?: Partial<QuoteBasicInfo>
): QuoteBasicInfo {
  return {
    targetMonth: info?.targetMonth ?? defaults.targetMonth,
    dealer: info?.dealer ?? defaults.dealer,
    thirdStore: info?.thirdStore ?? defaults.thirdStore,
    firstStore: info?.firstStore ?? defaults.firstStore,
  };
}

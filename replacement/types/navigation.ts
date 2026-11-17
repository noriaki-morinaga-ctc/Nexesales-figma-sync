import type { QuoteBasicInfo } from '@/utils/payment/quote/quoteBasicInfo';

/** 年間計画作成へ引き継ぐ遷移元情報（計画詳細2画面の取引制度）。 */
export interface AnnualPlanCreationContext {
  tradingSystem: string;
}

/** 画面遷移のペイロード。遷移元によって引用の基本情報か取引制度のいずれかを載せる。 */
export type MenuChangePayload = QuoteBasicInfo | AnnualPlanCreationContext;

/** 画面を切り替える関数（遷移先のルート ID と、遷移先へ引き継ぐペイロード）。 */
export type NavigateFn = (menuId: string, payload?: MenuChangePayload) => void;

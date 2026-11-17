// 支払詳細(引用)・支払詳細(引用入力)：引用基本情報の選択肢と既定値のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
import {
  DEALER_OPTIONS,
  FIRST_STORE_OPTIONS,
  THIRD_STORE_OPTIONS,
} from '@/mocks/common/storeTier';
import type {
  QuoteBasicInfo,
  QuoteStoreOptions,
} from '@/utils/payment/quote/quoteBasicInfo';

// 販売店・一次店・三次店の選択肢（拡売費計画(商流販売店に紐づき無し)と同じ共通マスタ）
export const QUOTE_STORE_OPTIONS: QuoteStoreOptions = {
  dealer: DEALER_OPTIONS,
  first: FIRST_STORE_OPTIONS,
  third: THIRD_STORE_OPTIONS,
};

// 引用基本情報の既定値。右ペイン初期表示／遷移先プリフィルの共通フォールバックであり、
// 既存 SearchPane の初期値（対象年月 2025/10・各店 先頭 option）に合わせる。
export const DEFAULT_QUOTE_BASIC_INFO: QuoteBasicInfo = {
  targetMonth: '2025/10',
  dealer: DEALER_OPTIONS[0].value,
  thirdStore: THIRD_STORE_OPTIONS[0].value,
  firstStore: FIRST_STORE_OPTIONS[0].value,
};

// paymentListSearchOptions（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import type { StoreOption } from '@/app/types/paymentList';

// 販売店で一次店・三次店の候補を絞る。販売店が未選択（''）なら全件を返す。
export const storeOptionsForRetailer = (
  options: StoreOption[],
  retailerCode: string
): StoreOption[] =>
  retailerCode
    ? options.filter((option) => option.retailerCode === retailerCode)
    : options;

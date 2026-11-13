// 支払一覧の型（型だけを書く → 04 §画面ディレクトリ構成「共通の型」）
import type { SingleComboboxOption } from '@/app/components/ui/single-combobox';

// 一次店・三次店の選択肢。value に店コードを持たせ、絞り込みに直接使う。
// retailerCode＝その店が属する商流の販売店コード（販売店を選んだときに候補を絞るために使う）。
export interface StoreOption extends SingleComboboxOption {
  retailerCode: string;
}

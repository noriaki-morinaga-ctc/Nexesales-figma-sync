// actualMonths（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import { ACTUAL_REFLECTED_MONTHS } from '@/constants/actualMonths';

/** 月キー（jan〜dec）が実績反映済みの月かどうかを判定する。 */
export const isActualReflectedMonth = (monthKey?: string): boolean =>
  !!monthKey && ACTUAL_REFLECTED_MONTHS.includes(monthKey);

// promotionAccountItems（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import { PROMOTION_ACCOUNT_ITEMS } from '@/constants/promotionAccountItems';

/** 勘定科目の表示ラベル（コード＋名称）を返す。未定義キーは空文字。 */
export const promotionAccountLabel = (key: string): string => {
  const item = PROMOTION_ACCOUNT_ITEMS[key];
  return item ? `${item.code} ${item.name}` : '';
};

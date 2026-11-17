// 新商品・新価格用サマリ商品紐づけマスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/features/master/shared';
import { NEW_PRODUCT_SUMMARY_LINK_DEF } from './constants';
import { NEW_PRODUCT_SUMMARY_LINK_ROWS } from '@/mocks/master/new-product-summary-link-master';

export default function NewProductSummaryLinkMaster() {
  return (
    <MasterMaintenancePage
      def={NEW_PRODUCT_SUMMARY_LINK_DEF}
      initialRows={NEW_PRODUCT_SUMMARY_LINK_ROWS}
    />
  );
}

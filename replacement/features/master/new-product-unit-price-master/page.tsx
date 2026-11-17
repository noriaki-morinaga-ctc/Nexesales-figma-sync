// 新商品・新価格用単価マスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/features/master/shared';
import { NEW_PRODUCT_UNIT_PRICE_DEF } from './constants';
import { NEW_PRODUCT_UNIT_PRICE_ROWS } from '@/mocks/master/new-product-unit-price-master';

export default function NewProductUnitPriceMaster() {
  return (
    <MasterMaintenancePage
      def={NEW_PRODUCT_UNIT_PRICE_DEF}
      initialRows={NEW_PRODUCT_UNIT_PRICE_ROWS}
    />
  );
}

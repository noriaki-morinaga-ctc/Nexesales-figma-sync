// 新商品・新価格用単価マスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import {
  NEW_PRODUCT_UNIT_PRICE_DEF,
  NEW_PRODUCT_UNIT_PRICE_ROWS,
} from './mockData';

export default function NewProductUnitPriceMaster() {
  return (
    <MasterMaintenancePage
      def={NEW_PRODUCT_UNIT_PRICE_DEF}
      initialRows={NEW_PRODUCT_UNIT_PRICE_ROWS}
    />
  );
}

// 新商品小ブランドマスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import {
  NEW_PRODUCT_SUB_BRAND_DEF,
  NEW_PRODUCT_SUB_BRAND_ROWS,
} from './mockData';

export default function NewProductSubBrandMaster() {
  return (
    <MasterMaintenancePage
      def={NEW_PRODUCT_SUB_BRAND_DEF}
      initialRows={NEW_PRODUCT_SUB_BRAND_ROWS}
    />
  );
}

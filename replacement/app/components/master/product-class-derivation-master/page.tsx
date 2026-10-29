// 商品分類導出マスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import {
  PRODUCT_CLASS_DERIVATION_DEF,
  PRODUCT_CLASS_DERIVATION_ROWS,
} from './mockData';

export default function ProductClassDerivationMaster() {
  return (
    <MasterMaintenancePage
      def={PRODUCT_CLASS_DERIVATION_DEF}
      initialRows={PRODUCT_CLASS_DERIVATION_ROWS}
    />
  );
}

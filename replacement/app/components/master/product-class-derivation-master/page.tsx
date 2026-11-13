// 商品分類導出マスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/app/components/shared/master';
import { PRODUCT_CLASS_DERIVATION_DEF } from './constants';
import { PRODUCT_CLASS_DERIVATION_ROWS } from '@/mocks/master/product-class-derivation-master';

export default function ProductClassDerivationMaster() {
  return (
    <MasterMaintenancePage
      def={PRODUCT_CLASS_DERIVATION_DEF}
      initialRows={PRODUCT_CLASS_DERIVATION_ROWS}
    />
  );
}

// 新商品小ブランドマスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/features/master/shared';
import { NEW_PRODUCT_SUB_BRAND_DEF } from './constants';
import { NEW_PRODUCT_SUB_BRAND_ROWS } from '@/mocks/master/new-product-sub-brand-master';

export default function NewProductSubBrandMaster() {
  return (
    <MasterMaintenancePage
      def={NEW_PRODUCT_SUB_BRAND_DEF}
      initialRows={NEW_PRODUCT_SUB_BRAND_ROWS}
    />
  );
}

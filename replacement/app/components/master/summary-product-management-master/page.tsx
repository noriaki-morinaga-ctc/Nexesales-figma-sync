// サマリ商品管理マスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/app/components/shared/master';
import { SUMMARY_PRODUCT_MANAGEMENT_DEF } from './constants';
import { SUMMARY_PRODUCT_MANAGEMENT_ROWS } from '@/mocks/master/summary-product-management-master';

export default function SummaryProductManagementMaster() {
  return (
    <MasterMaintenancePage
      def={SUMMARY_PRODUCT_MANAGEMENT_DEF}
      initialRows={SUMMARY_PRODUCT_MANAGEMENT_ROWS}
    />
  );
}

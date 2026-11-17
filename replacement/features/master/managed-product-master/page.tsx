// 管理対象商品マスタ（型1 マスタメンテCRUD型・世代管理・一括UL）。代表パターン②。
// 自販機の管理対象商品一覧（managed-product-list）を型1の標準に寄せた版（既存モックとの統廃合は未決）。名称は 2026-11-02 に確定。
import { MasterMaintenancePage } from '@/features/master/shared';
import { MANAGED_PRODUCT_DEF } from './constants';
import { MANAGED_PRODUCT_ROWS } from '@/mocks/master/managed-product-master';

export default function ManagedProductMaster() {
  return (
    <MasterMaintenancePage
      def={MANAGED_PRODUCT_DEF}
      initialRows={MANAGED_PRODUCT_ROWS}
    />
  );
}

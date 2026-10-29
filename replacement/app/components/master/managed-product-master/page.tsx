// 管理対象商品マスタ（型1 マスタメンテCRUD型・世代管理・一括UL）。代表パターン②。
// 自販機の管理対象商品一覧（managed-product-list）を型1の標準に寄せた版。名称・正体は確認中。
import { MasterMaintenancePage } from '../../shared/master';
import { MANAGED_PRODUCT_DEF, MANAGED_PRODUCT_ROWS } from './mockData';

export default function ManagedProductMaster() {
  return (
    <MasterMaintenancePage
      def={MANAGED_PRODUCT_DEF}
      initialRows={MANAGED_PRODUCT_ROWS}
    />
  );
}

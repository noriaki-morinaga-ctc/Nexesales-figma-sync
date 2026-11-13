// 新商品小ブランドマスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/new-product-sub-brand-master.json）。画面の定義は src/app/components/master/new-product-sub-brand-master/constants.ts。

import type { MasterRow } from '@/app/components/shared/master';

const CREATED_AT = '2026/02/10 10:00';

export const NEW_PRODUCT_SUB_BRAND_ROWS: MasterRow[] = [
  {
    id: 'new-product-sub-brand-master-1',
    subBrandCode: '999999',
    brand: '2B200',
    subBrandName: 'グリーンコーラ（ダミー）',
    endSaleFlag: '0',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-sub-brand-master-2',
    subBrandCode: '999998',
    brand: '2B600',
    subBrandName: '新カルピス（ダミー）',
    endSaleFlag: '0',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-sub-brand-master-3',
    subBrandCode: '999997',
    brand: '2B400',
    subBrandName: '新ティー（ダミー）',
    endSaleFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

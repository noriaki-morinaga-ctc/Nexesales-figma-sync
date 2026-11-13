// 新商品一括変更マスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/new-product-bulk-change-master.json）。画面の定義は src/app/components/master/new-product-bulk-change-master/constants.ts。

import type { MasterRow } from '@/app/components/shared/master';

const CREATED_AT = '2026/02/10 10:00';

export const NEW_PRODUCT_BULK_CHANGE_ROWS: MasterRow[] = [
  {
    id: 'new-product-bulk-change-master-1',
    dummyCode: 'D0001',
    newCode: 'P0001',
    processFlag: '0',
    changedAt: '',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-bulk-change-master-2',
    dummyCode: 'D0002',
    newCode: 'P0002',
    processFlag: '0',
    changedAt: '',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-bulk-change-master-3',
    dummyCode: 'D0003',
    newCode: 'P0003',
    processFlag: '1',
    changedAt: '2026/09/30 02:10',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

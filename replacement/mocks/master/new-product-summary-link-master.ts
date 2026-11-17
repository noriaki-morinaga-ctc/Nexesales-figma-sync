// 新商品・新価格用サマリ商品紐づけマスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/new-product-summary-link-master.json）。画面の定義は src/features/master/new-product-summary-link-master/constants.ts。

import type { MasterRow } from '@/features/master/shared';

const CREATED_AT = '2026/02/10 10:00';

export const NEW_PRODUCT_SUMMARY_LINK_ROWS: MasterRow[] = [
  {
    id: 'new-product-summary-link-master-1',
    linkStart: '2026/10/01',
    summaryProduct: 'D0001',
    salesItem: '99999901',
    itemStart: '2026/10/01',
    linkEnd: '4000/12/31',
    provisionalFlag: '1',
    representativeFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-summary-link-master-2',
    linkStart: '2026/10/01',
    summaryProduct: 'D0002',
    salesItem: '99999902',
    itemStart: '2026/10/01',
    linkEnd: '4000/12/31',
    provisionalFlag: '1',
    representativeFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-summary-link-master-3',
    linkStart: '2026/04/01',
    summaryProduct: 'P0001',
    salesItem: '00410147',
    itemStart: '2024/05/01',
    linkEnd: '4000/12/31',
    provisionalFlag: '0',
    representativeFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-summary-link-master-4',
    linkStart: '2025/04/01',
    summaryProduct: 'P0001',
    salesItem: '00410147',
    itemStart: '2024/05/01',
    linkEnd: '2026/03/31',
    provisionalFlag: '0',
    representativeFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

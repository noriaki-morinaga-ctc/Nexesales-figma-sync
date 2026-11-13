// サマリ商品管理マスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/summary-product-management-master.json）。画面の定義は src/app/components/master/summary-product-management-master/constants.ts。

import type { MasterRow } from '@/app/components/shared/master';

const CREATED_AT = '2026/02/10 10:00';

export const SUMMARY_PRODUCT_MANAGEMENT_ROWS: MasterRow[] = [
  {
    id: 'summary-product-management-master-1',
    summaryProduct: 'D0001',
    newStart: '2026/10/01',
    newEnd: '2027/01/31',
    focusStart: '',
    focusEnd: '',
    planDisplayFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'summary-product-management-master-2',
    summaryProduct: 'D0002',
    newStart: '2026/10/01',
    newEnd: '2027/01/31',
    focusStart: '',
    focusEnd: '',
    planDisplayFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'summary-product-management-master-3',
    summaryProduct: 'D0003',
    newStart: '2026/12/01',
    newEnd: '2027/03/31',
    focusStart: '',
    focusEnd: '',
    planDisplayFlag: '0',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'summary-product-management-master-4',
    summaryProduct: 'P0001',
    newStart: '2026/04/01',
    newEnd: '2026/07/31',
    focusStart: '2026/04/01',
    focusEnd: '2026/09/30',
    planDisplayFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

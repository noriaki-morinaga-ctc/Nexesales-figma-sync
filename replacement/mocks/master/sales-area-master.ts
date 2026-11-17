// 担当エリアマスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/sales-area-master.json）。画面の定義は src/features/master/sales-area-master/constants.ts。

import type { MasterRow } from '@/features/master/shared';

const CREATED_AT = '2026/02/10 10:00';

export const SALES_AREA_ROWS: MasterRow[] = [
  {
    id: 'sales-area-master-1',
    areaCode: 'AR0001',
    areaName: 'エリア①',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'sales-area-master-2',
    areaCode: 'AR0002',
    areaName: 'エリア②',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'sales-area-master-3',
    areaCode: 'AR0003',
    areaName: 'エリア③',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'sales-area-master-4',
    areaCode: 'AR0004',
    areaName: 'エリア④',
    inactive: true,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

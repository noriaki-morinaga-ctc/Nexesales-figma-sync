// 役職承認者設定マスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/position-approver-setting-master.json）。画面の定義は src/features/master/position-approver-setting-master/constants.ts。

import { PROFIT_ORG_CODE_NAME } from '@/constants/masterCodeNameOptions';
import type { MasterRow } from '@/features/master/shared';

const CREATED_AT = '2026/02/10 10:00';

export const POSITION_APPROVER_SETTING_ROWS: MasterRow[] = [
  {
    id: 'position-approver-setting-master-1',
    profitOrg: PROFIT_ORG_CODE_NAME[0]?.code ?? '',
    position: '200',
    positionClass: '02',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'position-approver-setting-master-2',
    profitOrg: PROFIT_ORG_CODE_NAME[0]?.code ?? '',
    position: '300',
    positionClass: '03',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'position-approver-setting-master-3',
    profitOrg: PROFIT_ORG_CODE_NAME[1]?.code ?? '',
    position: '300',
    positionClass: '03',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'position-approver-setting-master-4',
    profitOrg: PROFIT_ORG_CODE_NAME[1]?.code ?? '',
    position: '400',
    positionClass: '04',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'position-approver-setting-master-5',
    profitOrg: PROFIT_ORG_CODE_NAME[2]?.code ?? '',
    position: '400',
    positionClass: '04',
    inactive: true,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

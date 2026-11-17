// システム管理者設定マスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/system-admin-setting-master.json）。画面の定義は src/features/master/system-admin-setting-master/constants.ts。

import {
  DEPT_CODE_BY_STAFF_CODE,
  OFFICE_CODE_BY_DEPT_CODE,
} from '@/constants/masterCodeNameOptions';
import type { MasterRow } from '@/features/master/shared';

const CREATED_AT = '2026/02/10 10:00';

export const SYSTEM_ADMIN_SETTING_ROWS: MasterRow[] = [
  {
    id: 'system-admin-setting-master-1',
    office:
      OFFICE_CODE_BY_DEPT_CODE[DEPT_CODE_BY_STAFF_CODE['1000101'] ?? ''] ?? '',
    dept: DEPT_CODE_BY_STAFF_CODE['1000101'] ?? '',
    staff: '1000101',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'system-admin-setting-master-2',
    office:
      OFFICE_CODE_BY_DEPT_CODE[DEPT_CODE_BY_STAFF_CODE['1000102'] ?? ''] ?? '',
    dept: DEPT_CODE_BY_STAFF_CODE['1000102'] ?? '',
    staff: '1000102',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'system-admin-setting-master-3',
    office:
      OFFICE_CODE_BY_DEPT_CODE[DEPT_CODE_BY_STAFF_CODE['1000103'] ?? ''] ?? '',
    dept: DEPT_CODE_BY_STAFF_CODE['1000103'] ?? '',
    staff: '1000103',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'system-admin-setting-master-4',
    office:
      OFFICE_CODE_BY_DEPT_CODE[DEPT_CODE_BY_STAFF_CODE['1000104'] ?? ''] ?? '',
    dept: DEPT_CODE_BY_STAFF_CODE['1000104'] ?? '',
    staff: '1000104',
    inactive: true,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

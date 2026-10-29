// システム管理者設定マスタ：画面定義（型1 マスタメンテCRUD型）とモックデータ。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/system-admin-setting-master.json）。項目はエンティティ定義に合わせる。
// システム管理者設定マスタ（型1・無効化フラグ型）。エンティティ一覧表・定義書 10/22 版「システム管理者設定マスタ」（採算組織末端組織コード＋社員コード）。

import {
  PROFIT_ORG_DEPT_CODE_NAME,
  STAFF_CODE_NAME,
} from '../../../constants/masterCodeNameOptions';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

export const SYSTEM_ADMIN_SETTING_DEF: MasterScreenDef = {
  routeId: 'system-admin-setting-master',
  title: 'システム管理者設定マスタ',
  entityLabel: 'システム管理者',
  fields: [
    {
      key: 'orgUnit',
      label: '採算組織末端組織',
      kind: 'combo',
      pk: true,
      required: true,
      options: PROFIT_ORG_DEPT_CODE_NAME,
      codeLabel: '採算組織末端組織コード',
      nameLabel: '採算組織末端組織名称',
    },
    {
      key: 'staff',
      label: '社員',
      kind: 'combo',
      pk: true,
      required: true,
      options: STAFF_CODE_NAME,
      codeLabel: '社員コード',
      nameLabel: '社員名称',
    },
  ],
  searchKeys: ['orgUnit', 'staff'],
  inactivation: true,
};

const CREATED_AT = '2026/02/10 10:00';

export const SYSTEM_ADMIN_SETTING_ROWS: MasterRow[] = [
  {
    id: 'system-admin-setting-master-1',
    orgUnit: PROFIT_ORG_DEPT_CODE_NAME[0]?.code ?? '',
    staff: '1000101',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'system-admin-setting-master-2',
    orgUnit: PROFIT_ORG_DEPT_CODE_NAME[0]?.code ?? '',
    staff: '1000102',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'system-admin-setting-master-3',
    orgUnit: PROFIT_ORG_DEPT_CODE_NAME[1]?.code ?? '',
    staff: '1000103',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'system-admin-setting-master-4',
    orgUnit: PROFIT_ORG_DEPT_CODE_NAME[2]?.code ?? '',
    staff: '1000104',
    inactive: true,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

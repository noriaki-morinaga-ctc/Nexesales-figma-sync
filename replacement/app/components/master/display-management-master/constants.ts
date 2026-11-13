// 表示管理マスタ：画面定義（型1 マスタメンテCRUD型）。一覧のモック行は src/mocks/master/display-management-master.ts。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/display-management-master.json）。項目はエンティティ定義に合わせる。
// 表示管理マスタ（型1・無効化フラグ型）。エンティティ一覧表・定義書 10/22 版「表示管理マスタ」（現行 C1580MS_EIG_KEIH_HJKNR）。
// 現行の画面 SC-MST-030（表示管理マスタ一覧登録）の表示パターン・階層・採算組織・表示順・インデント・非表示に相当する。

import { PROFIT_ORG_CODE_NAME } from '@/app/constants/masterCodeNameOptions';
import type { MasterScreenDef } from '@/app/components/shared/master';

export const DISPLAY_MANAGEMENT_DEF: MasterScreenDef = {
  routeId: 'display-management-master',
  title: '表示管理マスタ',
  entityLabel: '表示管理',
  fields: [
    {
      key: 'patternCode',
      label: '採算組織表示パターンコード',
      kind: 'text',
      pk: true,
      required: true,
      placeholder: '例：001',
    },
    {
      key: 'profitOrg',
      label: '採算組織',
      kind: 'combo',
      pk: true,
      required: true,
      options: PROFIT_ORG_CODE_NAME,
      codeLabel: '採算組織コード',
      nameLabel: '採算組織名称',
    },
    {
      key: 'displayOrder',
      label: '採算組織表示順序',
      kind: 'number',
      format: 'integer',
      placeholder: '例：1000',
    },
    {
      key: 'indent',
      label: '採算組織表示インデント数',
      kind: 'number',
      format: 'integer',
      placeholder: '例：1',
    },
  ],
  searchKeys: ['patternCode', 'profitOrg'],
  inactivation: true,
};

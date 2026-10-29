// 担当エリアマスタ：画面定義（型1 マスタメンテCRUD型）とモックデータ。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/sales-area-master.json）。項目はエンティティ定義に合わせる。
// 担当エリアマスタ（型1・無効化フラグ型）。エンティティ一覧表・定義書 10/22 版「担当エリアマスタ」（担当エリアコード・名称）。コードは登録時に自動採番（採番ルールは仮）。

import type { MasterRow, MasterScreenDef } from '../../shared/master';

export const SALES_AREA_DEF: MasterScreenDef = {
  routeId: 'sales-area-master',
  title: '担当エリアマスタ',
  entityLabel: '担当エリア',
  fields: [
    {
      key: 'areaCode',
      label: '担当エリアコード',
      kind: 'text',
      pk: true,
      required: true,
      searchAlsoKeys: ['areaName'],
      readOnly: true,
    },
    {
      key: 'areaName',
      label: '担当エリア名称',
      kind: 'text',
      required: true,
      placeholder: '全角20文字以内',
    },
  ],
  searchKeys: ['areaCode'],
  inactivation: true,
  autoNumberKey: 'areaCode',
  autoNumberPrefix: 'AR',
};

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

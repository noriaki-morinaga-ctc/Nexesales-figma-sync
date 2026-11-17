// 担当エリアマスタ：画面定義（型1 マスタメンテCRUD型）。一覧のモック行は src/mocks/master/sales-area-master.ts。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/sales-area-master.json）。項目はエンティティ定義に合わせる。
// 担当エリアマスタ（型1・無効化フラグ型）。エンティティ一覧表・定義書 10/22 版「担当エリアマスタ」（担当エリアコード・名称）。コードは登録時に自動採番（採番ルールは仮）。

import type { MasterScreenDef } from '@/features/master/shared';

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

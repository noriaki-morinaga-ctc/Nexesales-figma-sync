// 新商品・新価格用単価マスタ：画面定義（型1 マスタメンテCRUD型）。一覧のモック行は src/mocks/master/new-product-unit-price-master.ts。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/new-product-unit-price-master.json）。項目はエンティティ定義に合わせる。
// 新商品・新価格用単価マスタ（型1・更新有）。エンティティ一覧表・定義書 10/22 版「新商品・新価格用単価マスタ」（現行の単価マスタと同じ項目）。
// 単価商流は商流マスタの卸商流内部コード。モックでは一次店の候補で代用する。

import {
  COMPANY_CODE_NAME,
  PRIMARY_STORE_CODE_NAME,
  SALES_ITEM_CODE_NAME,
} from '@/constants/masterCodeNameOptions';
import type { MasterScreenDef } from '@/features/master/shared';

export const NEW_PRODUCT_UNIT_PRICE_DEF: MasterScreenDef = {
  routeId: 'new-product-unit-price-master',
  title: '新商品・新価格用単価マスタ',
  entityLabel: '単価',
  fields: [
    {
      key: 'salesItem',
      label: '販売アイテム（オンライン商品）',
      kind: 'combo',
      pk: true,
      required: true,
      options: SALES_ITEM_CODE_NAME,
      codeLabel: '販売アイテム内部コード',
      nameLabel: '商品名称',
    },
    {
      key: 'priceStart',
      label: '単価適用開始年月日',
      kind: 'date',
      pk: true,
      required: true,
    },
    {
      key: 'channel',
      label: '単価商流',
      kind: 'combo',
      pk: true,
      required: true,
      options: PRIMARY_STORE_CODE_NAME,
      codeLabel: '単価商流内部コード',
      nameLabel: '商流名称',
    },
    {
      key: 'priceKbn',
      label: '単価区分',
      kind: 'select',
      pk: true,
      required: true,
      options: [
        { code: '2000', name: '生産者価格（2000）' },
        { code: '2101', name: '生産者価格（2101）' },
        { code: '2102', name: '卸価格（2102）' },
        { code: '2104', name: '小売価格（2104）' },
        { code: '2107', name: '卸価格（2107）' },
        { code: '2019', name: '小売価格（2019）' },
      ],
    },
    {
      key: 'piecePrice',
      label: 'アイテムバラ単価',
      kind: 'number',
      format: 'decimal2',
      unit: '円',
    },
    {
      key: 'piecePriceExDeposit',
      label: 'アイテムバラ保証金抜き単価',
      kind: 'number',
      format: 'decimal2',
      unit: '円',
    },
    {
      key: 'company',
      label: '単価共通会社',
      kind: 'combo',
      options: COMPANY_CODE_NAME,
      codeLabel: '単価共通会社コード',
      nameLabel: '共通会社名称',
      fixedValue: '0093',
    },
  ],
  searchKeys: ['salesItem', 'channel', 'priceKbn'],
};

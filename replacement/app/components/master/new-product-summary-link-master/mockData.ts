// 新商品・新価格用サマリ商品紐づけマスタ：画面定義（型1 マスタメンテCRUD型）とモックデータ。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/new-product-summary-link-master.json）。項目はエンティティ定義に合わせる。
// 新商品・新価格用サマリ商品紐づけマスタ（型1・世代管理）。エンティティ一覧表・定義書 10/22 版「新商品・新価格用サマリ商品紐づけマスタ」。
// サマリ商品は保存はサマリ商品管理番号、画面はサマリ商品コード・名称で選ぶ（戦略NET と同じ扱い）。

import {
  SALES_ITEM_CODE_NAME,
  SUMMARY_PRODUCT_CODE_NAME_WITH_DUMMY,
} from '../../../constants/masterCodeNameOptions';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

export const NEW_PRODUCT_SUMMARY_LINK_DEF: MasterScreenDef = {
  routeId: 'new-product-summary-link-master',
  title: '新商品・新価格用サマリ商品紐づけマスタ',
  entityLabel: 'サマリ商品紐づけ',
  fields: [
    {
      key: 'linkStart',
      label: 'サマリ商品紐付適用開始年月日',
      kind: 'date',
      pk: true,
      required: true,
    },
    {
      key: 'summaryProduct',
      label: 'サマリ商品',
      kind: 'combo',
      pk: true,
      required: true,
      options: SUMMARY_PRODUCT_CODE_NAME_WITH_DUMMY,
      codeLabel: 'サマリ商品コード',
      nameLabel: 'サマリ商品名称',
    },
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
      key: 'itemStart',
      label: '販売アイテム適用開始年月日',
      kind: 'date',
      pk: true,
      required: true,
    },
    {
      key: 'linkEnd',
      label: 'サマリ商品紐付適用終了年月日',
      kind: 'date',
    },
    {
      key: 'provisionalFlag',
      label: 'サマリ商品紐付け暫定フラグ',
      kind: 'select',
      required: true,
      options: [
        { code: '0', name: '暫定代表でない' },
        { code: '1', name: '暫定代表' },
      ],
    },
    {
      key: 'representativeFlag',
      label: 'サマリ商品紐付け代表固定フラグ',
      kind: 'select',
      required: true,
      options: [
        { code: '0', name: '代表でない' },
        { code: '1', name: '代表' },
      ],
    },
  ],
  searchKeys: ['summaryProduct', 'salesItem', 'linkStart'],
  generation: { startKey: 'linkStart', endKey: 'linkEnd' },
  copyAction: true,
};

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

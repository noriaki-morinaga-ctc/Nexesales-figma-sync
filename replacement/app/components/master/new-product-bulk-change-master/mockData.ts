// 新商品一括変更マスタ：画面定義（型1 マスタメンテCRUD型）とモックデータ。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/new-product-bulk-change-master.json）。項目はエンティティ定義に合わせる。
// 新商品一括変更マスタ（型1・無効化フラグ型）。エンティティ一覧表・定義書 10/22 版「新商品一括変更マスタ」。ダミーのサマリ商品コードを正式コードに置き換える指示を主管部が登録し、夜間バッチが置換する（第28回 決定16・17）。

import {
  SUMMARY_PRODUCT_CODE_NAME_DUMMY,
  SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY,
} from '../../../constants/masterCodeNameOptions';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

export const NEW_PRODUCT_BULK_CHANGE_DEF: MasterScreenDef = {
  routeId: 'new-product-bulk-change-master',
  title: '新商品一括変更マスタ',
  entityLabel: '一括変更',
  fields: [
    {
      key: 'dummyCode',
      label: 'ダミーサマリ商品',
      kind: 'combo',
      pk: true,
      required: true,
      options: SUMMARY_PRODUCT_CODE_NAME_DUMMY,
      codeLabel: 'ダミーサマリ商品コード',
      nameLabel: 'ダミーサマリ商品名称',
    },
    {
      key: 'newCode',
      label: '新サマリ商品',
      kind: 'combo',
      pk: true,
      required: true,
      options: SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY,
      codeLabel: '新サマリ商品コード',
      nameLabel: '新サマリ商品名称',
    },
    {
      key: 'processFlag',
      label: '処理フラグ',
      kind: 'select',
      options: [
        { code: '0', name: '未処理' },
        { code: '1', name: '処理済' },
      ],
      readOnly: true,
    },
    {
      key: 'changedAt',
      label: '一括変更日時',
      kind: 'text',
      readOnly: true,
    },
  ],
  searchKeys: ['dummyCode', 'newCode', 'processFlag'],
  inactivation: true,
};

const CREATED_AT = '2026/02/10 10:00';

export const NEW_PRODUCT_BULK_CHANGE_ROWS: MasterRow[] = [
  {
    id: 'new-product-bulk-change-master-1',
    dummyCode: 'D0001',
    newCode: 'P0001',
    processFlag: '0',
    changedAt: '',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-bulk-change-master-2',
    dummyCode: 'D0002',
    newCode: 'P0002',
    processFlag: '0',
    changedAt: '',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-bulk-change-master-3',
    dummyCode: 'D0003',
    newCode: 'P0003',
    processFlag: '1',
    changedAt: '2026/09/30 02:10',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

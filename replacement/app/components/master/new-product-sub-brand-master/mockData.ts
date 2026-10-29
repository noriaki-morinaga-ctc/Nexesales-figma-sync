// 新商品小ブランドマスタ：画面定義（型1 マスタメンテCRUD型）とモックデータ。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/new-product-sub-brand-master.json）。項目はエンティティ定義に合わせる。
// 新商品小ブランドマスタ（型1・更新有）。エンティティ一覧表・定義書 10/22 版「新商品小ブランドマスタ」。新商品コード対応で主管部がダミーの小ブランドを登録する用途。

import { BRAND_CODE_NAME } from '../../../constants/masterCodeNameOptions';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

export const NEW_PRODUCT_SUB_BRAND_DEF: MasterScreenDef = {
  routeId: 'new-product-sub-brand-master',
  title: '新商品小ブランドマスタ',
  entityLabel: '小ブランド',
  fields: [
    {
      key: 'subBrandCode',
      label: '小ブランドコード',
      kind: 'text',
      pk: true,
      required: true,
      placeholder: '例：999999',
      searchAlsoKeys: ['subBrandName'],
    },
    {
      key: 'brand',
      label: 'ブランド',
      kind: 'combo',
      required: true,
      options: BRAND_CODE_NAME,
      codeLabel: 'ブランドコード',
      nameLabel: 'ブランド名称',
    },
    {
      key: 'subBrandName',
      label: '小ブランド名称',
      kind: 'text',
      required: true,
      placeholder: '全角40文字以内',
    },
    {
      key: 'endSaleFlag',
      label: '小ブランド終売フラグ',
      kind: 'select',
      required: true,
      options: [
        { code: '0', name: '未終売' },
        { code: '1', name: '終売' },
      ],
    },
  ],
  searchKeys: ['subBrandCode', 'brand'],
};

const CREATED_AT = '2026/02/10 10:00';

export const NEW_PRODUCT_SUB_BRAND_ROWS: MasterRow[] = [
  {
    id: 'new-product-sub-brand-master-1',
    subBrandCode: '999999',
    brand: '2B200',
    subBrandName: 'グリーンコーラ（ダミー）',
    endSaleFlag: '0',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-sub-brand-master-2',
    subBrandCode: '999998',
    brand: '2B600',
    subBrandName: '新カルピス（ダミー）',
    endSaleFlag: '0',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-sub-brand-master-3',
    subBrandCode: '999997',
    brand: '2B400',
    subBrandName: '新ティー（ダミー）',
    endSaleFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

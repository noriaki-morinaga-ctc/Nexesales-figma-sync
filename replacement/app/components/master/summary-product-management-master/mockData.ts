// サマリ商品管理マスタ：画面定義（型1 マスタメンテCRUD型）とモックデータ。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/summary-product-management-master.json）。項目はエンティティ定義に合わせる。
// サマリ商品管理マスタ（型1・更新有）。エンティティ一覧表・定義書 10/22 版「サマリ商品管理マスタ」（現行 C1592MS_EINRY_SHIN_KNR）。
// 新商品コード対応で主管部が登録するダミーのサマリ商品の新商品期間を管理する用途（第28回 決定8・9）。正式なサマリ商品の分は飲料長期DBから連携される。

import { SUMMARY_PRODUCT_CODE_NAME_WITH_DUMMY } from '../../../constants/masterCodeNameOptions';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

export const SUMMARY_PRODUCT_MANAGEMENT_DEF: MasterScreenDef = {
  routeId: 'summary-product-management-master',
  title: 'サマリ商品管理マスタ',
  entityLabel: 'サマリ商品管理',
  fields: [
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
      key: 'newStart',
      label: '新規取扱対象開始年月日',
      kind: 'date',
      required: true,
    },
    {
      key: 'newEnd',
      label: '新規取扱対象終了年月日',
      kind: 'date',
      required: true,
    },
    {
      key: 'focusStart',
      label: '重点管理対象開始年月日',
      kind: 'date',
    },
    {
      key: 'focusEnd',
      label: '重点管理対象終了年月日',
      kind: 'date',
    },
    {
      key: 'planDisplayFlag',
      label: '計画画面表示フラグ',
      kind: 'select',
      options: [
        { code: '0', name: '表示しない' },
        { code: '1', name: '表示する' },
      ],
    },
  ],
  searchKeys: ['summaryProduct'],
};

const CREATED_AT = '2026/02/10 10:00';

export const SUMMARY_PRODUCT_MANAGEMENT_ROWS: MasterRow[] = [
  {
    id: 'summary-product-management-master-1',
    summaryProduct: 'D0001',
    newStart: '2026/10/01',
    newEnd: '2027/01/31',
    focusStart: '',
    focusEnd: '',
    planDisplayFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'summary-product-management-master-2',
    summaryProduct: 'D0002',
    newStart: '2026/10/01',
    newEnd: '2027/01/31',
    focusStart: '',
    focusEnd: '',
    planDisplayFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'summary-product-management-master-3',
    summaryProduct: 'D0003',
    newStart: '2026/12/01',
    newEnd: '2027/03/31',
    focusStart: '',
    focusEnd: '',
    planDisplayFlag: '0',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'summary-product-management-master-4',
    summaryProduct: 'P0001',
    newStart: '2026/04/01',
    newEnd: '2026/07/31',
    focusStart: '2026/04/01',
    focusEnd: '2026/09/30',
    planDisplayFlag: '1',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

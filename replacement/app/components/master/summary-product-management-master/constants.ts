// サマリ商品管理マスタ：画面定義（型1 マスタメンテCRUD型）。一覧のモック行は src/mocks/master/summary-product-management-master.ts。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/summary-product-management-master.json）。項目はエンティティ定義に合わせる。
// サマリ商品管理マスタ（型1・更新有）。エンティティ一覧表・定義書 10/22 版「サマリ商品管理マスタ」（現行 C1592MS_EINRY_SHIN_KNR）。
// 新商品コード対応で主管部が登録するダミーのサマリ商品の新商品期間を管理する用途（第28回 決定8・9）。正式なサマリ商品の分は飲料長期DBから連携される。

import { SUMMARY_PRODUCT_CODE_NAME_WITH_DUMMY } from '@/app/constants/masterCodeNameOptions';
import type { MasterScreenDef } from '@/app/components/shared/master';

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

// 一般卸メッシュマスタ：画面定義（型1）。一覧のモック行は src/mocks/master/general-wholesale-mesh-master.ts。
// 項目はエンティティ一覧表・定義書（2026-10-22 版）「一般卸メッシュマスタ」シートに合わせる
// （PK＝一般卸メッシュコード・適用開始年月日。メタブランドコード・容器容量Ｇコード・希望小売価格・商品函バラ入数は
// 適用開始年月日と組でユニーク制約）。業務キーは一般卸メッシュコード（登録時に自動採番、変更不可）。
// モックの一般卸メッシュは販売計画表と同じ WHOLESALE_MESH_OPTIONS（単一の情報源）から起こし、
// コード・名称の候補は masterCodeNameOptions（マスタ画面共通）を使う。

import {
  CONTAINER_GROUP_CODE_NAME,
  META_BRAND_CODE_NAME,
  SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY,
} from '@/constants/masterCodeNameOptions';
import type { MasterScreenDef } from '@/features/master/shared';

export const GENERAL_WHOLESALE_MESH_DEF: MasterScreenDef = {
  routeId: 'general-wholesale-mesh-master',
  title: '一般卸メッシュマスタ',
  entityLabel: '一般卸メッシュ',
  fields: [
    {
      key: 'meshCode',
      label: '一般卸メッシュコード',
      kind: 'text',
      pk: true,
      readOnly: true,
    },
    {
      key: 'startDate',
      label: '適用開始年月日',
      kind: 'date',
      pk: true,
      required: true,
    },
    {
      key: 'endDate',
      label: '適用終了年月日',
      kind: 'date',
      required: true,
    },
    {
      key: 'metaBrand',
      label: 'メタブランド',
      kind: 'combo',
      unique: true,
      required: true,
      options: META_BRAND_CODE_NAME,
    },
    {
      key: 'containerGroup',
      label: '容器容量グループ',
      kind: 'combo',
      unique: true,
      required: true,
      options: CONTAINER_GROUP_CODE_NAME,
      codeLabel: '容器容量Gコード',
      nameLabel: '容器容量G名称',
    },
    {
      key: 'retailPrice',
      label: '希望小売価格',
      kind: 'number',
      unique: true,
      required: true,
      format: 'integer',
      unit: '円',
    },
    {
      key: 'caseQuantity',
      label: '商品函バラ入数',
      kind: 'number',
      unique: true,
      required: true,
      format: 'integer',
      unit: '本',
    },
    {
      key: 'meshName',
      label: '一般卸メッシュ名称',
      kind: 'text',
      required: true,
      searchAlsoKeys: ['meshCode'],
      placeholder: '例：三ツ矢サイダー500mL24本',
    },
    {
      key: 'summaryProduct',
      label: '代表サマリ商品',
      kind: 'combo',
      required: true,
      // ダミーのサマリ商品は設定しない（10/8 決定14、Q&A No.31）
      options: SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY,
    },
    {
      key: 'costOfSales',
      label: '売上原価(支社受渡バラ単価・保証金抜き)',
      kind: 'number',
      required: true,
      format: 'decimal2',
      unit: '円',
    },
    {
      key: 'baseNet',
      label: '基準NET(バラ単価)',
      kind: 'number',
      required: true,
      format: 'decimal2',
      unit: '円',
    },
  ],
  searchKeys: [
    'meshName',
    'metaBrand',
    'containerGroup',
    'summaryProduct',
    'startDate',
  ],
  generation: {
    startKey: 'startDate',
    endKey: 'endDate',
  },
  copyAction: true,
  bulkUpload: true,
  autoNumberKey: 'meshCode',
  autoNumberPrefix: 'WM',
};

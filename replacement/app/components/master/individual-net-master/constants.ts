// 個別NETマスタ：画面定義（型1）。一覧のモック行は src/mocks/master/individual-net-master.ts。
// 項目はエンティティ一覧表・定義書（2026-10-22 版）「個別NETマスタ」シートに合わせる
// （一般卸メッシュコードは、個別NETの適用開始年月日時点で有効な一般卸メッシュの世代を参照する）
// （PK＝一般卸メッシュコード・商流販売店内部コード・適用開始年月日）。
// 商流販売店内部コードはサロゲートキーのため画面には出さず（10/2 決定2）、
// 業務キーの一次店・三次店・販売店（10/2 決定7）で表示・入力する。

import {
  PRIMARY_STORE_CODE_NAME,
  RETAILER_CODE_NAME,
  TERTIARY_STORE_CODE_NAME,
  WHOLESALE_MESH_CODE_NAME,
} from '@/app/constants/masterCodeNameOptions';
import type { MasterScreenDef } from '@/app/components/shared/master';

export const INDIVIDUAL_NET_DEF: MasterScreenDef = {
  routeId: 'individual-net-master',
  title: '個別NETマスタ',
  entityLabel: '個別NET',
  fields: [
    {
      key: 'wholesaleMesh',
      label: '一般卸メッシュ',
      kind: 'combo',
      pk: true,
      required: true,
      options: WHOLESALE_MESH_CODE_NAME,
    },
    {
      key: 'primaryStore',
      label: '一次店',
      kind: 'combo',
      pk: true,
      required: true,
      options: PRIMARY_STORE_CODE_NAME,
    },
    {
      key: 'tertiaryStore',
      label: '三次店',
      kind: 'combo',
      pk: true,
      required: true,
      options: TERTIARY_STORE_CODE_NAME,
    },
    {
      key: 'retailer',
      label: '販売店',
      kind: 'combo',
      pk: true,
      required: true,
      options: RETAILER_CODE_NAME,
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
      key: 'individualNet',
      label: '個別NET(バラ単価)',
      kind: 'number',
      required: true,
      format: 'decimal2',
      unit: '円',
    },
  ],
  searchKeys: [
    'primaryStore',
    'tertiaryStore',
    'retailer',
    'wholesaleMesh',
    'startDate',
  ],
  generation: {
    startKey: 'startDate',
    endKey: 'endDate',
  },
  copyAction: true,
  bulkUpload: true,
};

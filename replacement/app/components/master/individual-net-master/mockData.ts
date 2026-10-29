// 個別NETマスタ：画面定義（型1）とモックデータ。
// 項目はエンティティ一覧表・定義書（2026-10-22 版）「個別NETマスタ」シートに合わせる
// （一般卸メッシュコードは、個別NETの適用開始年月日時点で有効な一般卸メッシュの世代を参照する）
// （PK＝一般卸メッシュコード・商流販売店内部コード・適用開始年月日）。
// 商流販売店内部コードはサロゲートキーのため画面には出さず（10/2 決定2）、
// 業務キーの一次店・三次店・販売店（10/2 決定7）で表示・入力する。

import {
  PRIMARY_STORE_CODE_NAME,
  RETAILER_CODE_NAME,
  STORE_CHAIN_COMBOS,
  TERTIARY_STORE_CODE_NAME,
  WHOLESALE_MESH_CODE_NAME,
} from '../../../constants/masterCodeNameOptions';
import { WHOLESALE_MESH_BY_VALUE } from '../../../constants/productMasters';
import { END_OF_TIME } from '../../shared/master';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

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

const CREATED_AT = '2026/03/22 09:45';

// モック：一般卸メッシュの先頭8件 × 商流の組合せ先頭4件に個別NETを設定する。
// 値はメッシュの基準NET（モック）から数%引いた額にする。
const buildRows = (): MasterRow[] => {
  const rows: MasterRow[] = [];
  const meshes = WHOLESALE_MESH_CODE_NAME.slice(0, 8);
  const chains = STORE_CHAIN_COMBOS.slice(0, 4);
  meshes.forEach((mesh, mi) => {
    const baseNet = Number(WHOLESALE_MESH_BY_VALUE.get(mesh.name)?.net ?? 60);
    chains.forEach((chain, ci) => {
      const net = Math.round(baseNet * (0.98 - ci * 0.01) * 100) / 100;
      rows.push({
        id: `inet-${mi}-${ci}-current`,
        wholesaleMesh: mesh.code,
        primaryStore: chain.primary.code,
        tertiaryStore: chain.tertiary.code,
        retailer: chain.retailer.code,
        startDate: '2026/04/01',
        endDate: END_OF_TIME,
        individualNet: net,
        createdBy: '営戦 花子',
        createdAt: CREATED_AT,
        updatedBy: '営戦 花子',
        updatedAt: CREATED_AT,
      });
      // 先頭2メッシュは前年度の世代も持たせる
      if (mi < 2) {
        rows.push({
          id: `inet-${mi}-${ci}-prev`,
          wholesaleMesh: mesh.code,
          primaryStore: chain.primary.code,
          tertiaryStore: chain.tertiary.code,
          retailer: chain.retailer.code,
          startDate: '2025/04/01',
          endDate: '2026/03/31',
          individualNet: Math.round(net * 0.97 * 100) / 100,
          createdBy: '営戦 花子',
          createdAt: '2025/03/18 14:30',
          updatedBy: '営戦 花子',
          updatedAt: '2025/03/18 14:30',
        });
      }
    });
  });
  return rows;
};

export const INDIVIDUAL_NET_ROWS: MasterRow[] = buildRows();

// 個別NETマスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/individual-net-master.json）。画面の定義は src/app/components/master/individual-net-master/constants.ts。

import { WHOLESALE_MESH_BY_VALUE } from '@/app/constants/productMasters';
import { END_OF_TIME } from '@/app/components/shared/master';
import {
  STORE_CHAIN_COMBOS,
  WHOLESALE_MESH_CODE_NAME,
} from '@/app/constants/masterCodeNameOptions';
import type { MasterRow } from '@/app/components/shared/master';

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

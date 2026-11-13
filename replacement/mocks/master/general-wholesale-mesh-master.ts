// 一般卸メッシュマスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/general-wholesale-mesh-master.json）。画面の定義は src/app/components/master/general-wholesale-mesh-master/constants.ts。

import {
  CONTAINER_CAPACITY_MASTER,
  META_BRAND_MASTER,
  SUMMARY_PRODUCT_BY_WHOLESALE_MESH,
  WHOLESALE_MESH_BY_VALUE,
} from '@/app/constants/productMasters';
import {
  containerCapacityCodeOf,
  metaBrandCodeOf,
  wholesaleMeshCodeOf,
} from '@/app/utils/common/comboFieldOptions';
import { END_OF_TIME } from '@/app/components/shared/master';
import { SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY } from '@/app/constants/masterCodeNameOptions';
import {
  containerGroupCodeOf,
  summaryProductCodeOf,
} from '@/app/utils/common/masterCodeNameOptions';
import type { MasterRow } from '@/app/components/shared/master';

// 希望小売価格：メッシュ名の「〇〇円」から取り、無ければ代表サマリ商品の売価、それも無ければ 150円
const retailPriceOf = (meshValue: string, fallback?: string): number => {
  const m = /(\d+)円/.exec(meshValue);
  if (m) return Number(m[1]);
  const price = Number(fallback);
  return Number.isNaN(price) || price === 0 ? 150 : price;
};

const CREATED_AT = '2026/03/15 10:00';

const buildRows = (): MasterRow[] => {
  const rows: MasterRow[] = [];
  Array.from(WHOLESALE_MESH_BY_VALUE.values()).forEach((mesh, index) => {
    const summary = SUMMARY_PRODUCT_BY_WHOLESALE_MESH.get(mesh.value);
    const summaryCode = summary ? summaryProductCodeOf(summary.value) : '';
    const base: Omit<MasterRow, 'id'> = {
      meshCode: wholesaleMeshCodeOf(mesh.value),
      meshName: mesh.value,
      metaBrand: metaBrandCodeOf(mesh.metaBrand) || META_BRAND_MASTER[1].code,
      containerGroup: containerGroupCodeOf(
        containerCapacityCodeOf(mesh.containerCapacityG) ||
          CONTAINER_CAPACITY_MASTER[0].code
      ),
      retailPrice: retailPriceOf(mesh.value, summary?.price),
      caseQuantity: Number(mesh.quantity) || 24,
      startDate: '2026/04/01',
      endDate: END_OF_TIME,
      // 代表サマリ商品は必須のため、対応が無いメッシュには候補の先頭から順に仮の値を置く
      summaryProduct:
        summaryCode ||
        SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY[
          index % SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY.length
        ].code,
      costOfSales: Number(mesh.costOfSales) || 0,
      baseNet: Number(mesh.net) || 0,
      createdBy: '営戦 花子',
      createdAt: CREATED_AT,
      updatedBy: '営戦 花子',
      updatedAt: CREATED_AT,
    };
    // MasterRow は添字付きの型のため Omit<MasterRow, 'id'> の base を広げると項目の型が消える。行として扱う
    rows.push({ ...base, id: `gwm-${index + 1}-current` } as MasterRow);

    // 先頭5件は前年度の世代を持たせ、集約表示（展開で全世代を確認）を確かめられるようにする
    if (index < 5) {
      rows.push({
        ...base,
        id: `gwm-${index + 1}-prev`,
        startDate: '2025/04/01',
        endDate: '2026/03/31',
        costOfSales: Math.round(Number(base.costOfSales) * 0.97 * 100) / 100,
        baseNet: Math.round(Number(base.baseNet) * 0.97 * 100) / 100,
        createdAt: '2025/03/14 09:30',
        updatedAt: '2025/03/14 09:30',
      } as unknown as MasterRow);
    }
  });
  return rows;
};

export const GENERAL_WHOLESALE_MESH_ROWS: MasterRow[] = buildRows();

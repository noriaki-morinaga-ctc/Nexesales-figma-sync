// 管理対象商品マスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/managed-product-master.json）。画面の定義は src/features/master/managed-product-master/constants.ts。

import {
  OFFICE_CODE_NAME,
  PRODUCT_HANDLING_KBN,
  SUMMARY_PRODUCT_CODE_NAME,
} from '@/constants/masterCodeNameOptions';
import type { MasterRow } from '@/features/master/shared';

const CREATED_AT = '2026/03/05 10:30';

const buildRows = (): MasterRow[] => {
  const rows: MasterRow[] = [];
  const products = SUMMARY_PRODUCT_CODE_NAME.slice(0, 15);
  products.forEach((product, i) => {
    const kbn = PRODUCT_HANDLING_KBN[i % 3].code;
    const area = OFFICE_CODE_NAME[i % OFFICE_CODE_NAME.length].code;
    rows.push({
      id: `mp-${i}-current`,
      summaryProduct: product.code,
      startDate: '2026/04',
      endDate: '2027/03',
      targetArea: area,
      handlingKbn: kbn,
      referenceProduct: SUMMARY_PRODUCT_CODE_NAME[(i + 5) % 20]?.code ?? '',
      createdBy: '自販機マーケ 一郎',
      createdAt: CREATED_AT,
      updatedBy: '自販機マーケ 一郎',
      updatedAt: CREATED_AT,
    });
    // 先頭3商品は前年度の管理対象期間も持たせる
    if (i < 3) {
      rows.push({
        id: `mp-${i}-prev`,
        summaryProduct: product.code,
        startDate: '2025/04',
        endDate: '2026/03',
        targetArea: area,
        handlingKbn: kbn,
        referenceProduct: SUMMARY_PRODUCT_CODE_NAME[(i + 5) % 20]?.code ?? '',
        createdBy: '自販機マーケ 一郎',
        createdAt: '2025/03/03 11:00',
        updatedBy: '自販機マーケ 一郎',
        updatedAt: '2025/03/03 11:00',
      });
    }
  });
  return rows;
};

export const MANAGED_PRODUCT_ROWS: MasterRow[] = buildRows();

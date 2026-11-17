// 販売店条件口率マスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/retailer-condition-rate-master.json）。画面の定義は src/features/master/retailer-condition-rate-master/constants.ts。

import { END_OF_MONTH } from '@/features/master/shared';
import { RETAILER_CODE_NAME } from '@/constants/masterCodeNameOptions';
import type { MasterRow } from '@/features/master/shared';

const CREATED_AT = '2026/03/25 13:10';

const buildRows = (): MasterRow[] => {
  const rows: MasterRow[] = [];
  RETAILER_CODE_NAME.forEach((retailer, i) => {
    // ％で小数第2位まで（例 22.23）
    const rate = Math.round((20 + (i % 7) * 1.23) * 100) / 100;
    rows.push({
      id: `rcr-${i}-current`,
      retailer: retailer.code,
      startDate: '2026/04',
      endDate: END_OF_MONTH,
      conditionRate: rate,
      createdBy: '営戦 花子',
      createdAt: CREATED_AT,
      updatedBy: '営戦 花子',
      updatedAt: CREATED_AT,
    });
    // 先頭2件は前年度の世代も持たせる
    if (i < 2) {
      rows.push({
        id: `rcr-${i}-prev`,
        retailer: retailer.code,
        startDate: '2025/04',
        endDate: '2026/03',
        conditionRate: Math.round((rate - 0.5) * 100) / 100,
        createdBy: '営戦 花子',
        createdAt: '2025/03/20 11:00',
        updatedBy: '営戦 花子',
        updatedAt: '2025/03/20 11:00',
      });
    }
  });
  return rows;
};

export const RETAILER_CONDITION_RATE_ROWS: MasterRow[] = buildRows();

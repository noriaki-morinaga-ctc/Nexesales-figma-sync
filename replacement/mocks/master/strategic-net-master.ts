// 戦略NETマスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/strategic-net-master.json）。画面の定義は src/app/components/master/strategic-net-master/constants.ts。

import { SUMMARY_PRODUCT_OPTIONS } from '@/app/constants/productMasters';
import { END_OF_TIME } from '@/app/components/shared/master';
import {
  OFFICE_CODE_BY_DEPT_CODE,
  PROFIT_ORG_DEPT_CODE_NAME,
  SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY,
} from '@/app/constants/masterCodeNameOptions';
import type { MasterRow } from '@/app/components/shared/master';

const CREATED_AT = '2026/03/20 11:00';

// モック：サマリ商品の先頭12件 × 採算組織（部署）の先頭3件に戦略NETを設定する。
// 値はサマリ商品の NET（モック）を基準に、部署ごとに数%の差を付ける。
const buildRows = (): MasterRow[] => {
  const rows: MasterRow[] = [];
  const products = SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY.slice(0, 12);
  const orgs = PROFIT_ORG_DEPT_CODE_NAME.slice(0, 3);
  products.forEach((product, pi) => {
    const base = Number(
      SUMMARY_PRODUCT_OPTIONS.find((o) => o.value === product.name)?.net ?? 60
    );
    orgs.forEach((org, oi) => {
      const net = Math.round(base * (0.9 + oi * 0.03) * 100) / 100;
      rows.push({
        id: `snet-${pi}-${oi}-current`,
        summaryProduct: product.code,
        office: OFFICE_CODE_BY_DEPT_CODE[org.code] ?? '',
        profitOrg: org.code,
        startDate: '2026/04/01',
        endDate: END_OF_TIME,
        strategicNet: net,
        createdBy: '営戦 花子',
        createdAt: CREATED_AT,
        updatedBy: '営戦 花子',
        updatedAt: CREATED_AT,
      });
      // 先頭3商品は前年度の世代も持たせる
      if (pi < 3) {
        rows.push({
          id: `snet-${pi}-${oi}-prev`,
          summaryProduct: product.code,
          office: OFFICE_CODE_BY_DEPT_CODE[org.code] ?? '',
          profitOrg: org.code,
          startDate: '2025/04/01',
          endDate: '2026/03/31',
          strategicNet: Math.round(net * 0.97 * 100) / 100,
          createdBy: '営戦 花子',
          createdAt: '2025/03/18 14:00',
          updatedBy: '営戦 花子',
          updatedAt: '2025/03/18 14:00',
        });
      }
    });
  });
  return rows;
};

export const STRATEGIC_NET_ROWS: MasterRow[] = buildRows();

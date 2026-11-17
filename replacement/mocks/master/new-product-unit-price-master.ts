// 新商品・新価格用単価マスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/new-product-unit-price-master.json）。画面の定義は src/features/master/new-product-unit-price-master/constants.ts。

import { PRIMARY_STORE_CODE_NAME } from '@/constants/masterCodeNameOptions';
import type { MasterRow } from '@/features/master/shared';

const CREATED_AT = '2026/02/10 10:00';

export const NEW_PRODUCT_UNIT_PRICE_ROWS: MasterRow[] = [
  {
    id: 'new-product-unit-price-master-1',
    salesItem: '99999901',
    priceStart: '2026/10/01',
    channel: PRIMARY_STORE_CODE_NAME[0]?.code ?? '',
    priceKbn: '2101',
    piecePrice: 112,
    piecePriceExDeposit: 112,
    company: '0093',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-unit-price-master-2',
    salesItem: '99999901',
    priceStart: '2026/10/01',
    channel: PRIMARY_STORE_CODE_NAME[1]?.code ?? '',
    priceKbn: '2101',
    piecePrice: 110,
    piecePriceExDeposit: 110,
    company: '0093',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'new-product-unit-price-master-3',
    salesItem: '00410147',
    priceStart: '2026/10/01',
    channel: PRIMARY_STORE_CODE_NAME[0]?.code ?? '',
    priceKbn: '2101',
    piecePrice: 290.5,
    piecePriceExDeposit: 290.5,
    company: '0093',
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

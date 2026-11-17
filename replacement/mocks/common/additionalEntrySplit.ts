// 支払詳細(請求書あり)・支払詳細(請求書なし)：分割（IN）の追加口明細のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。

import type { SplitInEntryRow } from '@/app/types/paymentDetail';

// 分割（IN）の追加口明細の分割元（他部署の支払）。
const SPLIT_IN_SOURCE = {
  srcDept: '10003325:首都圏本部営業三部',
  srcStaff: '5510361:◯藤　△一',
  srcPaymentNo: 'C2400NTO7',
  srcPaymentCount: 1,
  dataSource: '請求EDI',
  billDetailNo: '457801SA',
} as const;

// 分割（IN）の追加口明細1行。追加口金額は（ケース × 入数 ＋ バラ）× 追加口バラ単価。
const splitInRow = (
  lineNo: number,
  srcLineNo: number,
  productCode: string,
  productName: string,
  capacity: number,
  cases: number,
  loose: number,
  addUnit: number,
  addNet: number
): SplitInEntryRow => ({
  ...SPLIT_IN_SOURCE,
  lineNo,
  srcLineNo,
  productCode,
  productName,
  capacity,
  cases,
  loose,
  addUnit,
  addAmount: (cases * capacity + loose) * addUnit,
  addNet,
});

// 他部署（首都圏本部営業三部）から当部署へ分割された追加口明細（参照専用）。
// 分割元明細No が飛んでいるのは、当部署への分割が 0 の明細を作らないため。
export const SPLIT_IN_ENTRY_ROWS: SplitInEntryRow[] = [
  splitInRow(1, 1, '45160011', 'ワンダ金の微糖185g30本', 24, 20, 0, 71, 90),
  splitInRow(
    2,
    2,
    '45160042',
    'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    24,
    18,
    0,
    64,
    90
  ),
  splitInRow(
    3,
    3,
    '45160042',
    'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    24,
    0,
    3,
    66,
    88
  ),
  splitInRow(4, 4, '45160011', 'ワンダ金の微糖185g30本', 5, 6, 0, 190, 452),
  splitInRow(
    5,
    6,
    '45160028',
    'ワンダモーニングショット185g30本',
    5,
    14,
    0,
    190,
    452
  ),
  splitInRow(
    6,
    7,
    '45160028',
    'ワンダモーニングショット185g30本',
    5,
    20,
    0,
    154,
    488
  ),
  splitInRow(
    7,
    8,
    '45160035',
    'ワンダ ボトルコーヒー微糖500mL24本',
    24,
    45,
    0,
    73,
    95
  ),
  splitInRow(
    8,
    9,
    '45160042',
    'ワンダ極上のラテ贅沢仕立て４００ｇ２４本',
    24,
    30,
    3,
    71,
    87
  ),
];

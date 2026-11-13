import { describe, it, expect } from 'vitest';
import { DEFAULT_TARGET_MONTH_IDX0 } from '@/app/constants/defaultAggregationSource';
import { DEFAULT_AGGREGATION_SOURCE } from '@/mocks/common/aggregationSource';
import {
  computeMonth,
  computeMonthsRange,
  listCapacities,
  listMetaBrands,
  monthsForPeriod,
  type AggAmounts,
  type ExpenseMonthBasis,
} from './aggregationCalc';
import { RATE_SETTINGS } from '@/app/constants/aggregationSourceData';
import type { AggregationSource } from '@/app/types/aggregation';
import { toAggregationProducts } from '@/app/utils/sales-plan/plan-detail/planGridToAggregation';
import { toAggregationExpenses } from '@/app/utils/sales-plan/plan-detail/expenseGridToAggregation';
import { NON_PRODUCT_EXPENSE_ROWS } from '@/mocks/common/nonProductExpense';
import {
  REGULAR_PRODUCTS_DATA as WHOLESALE_REGULAR_PRODUCTS_DATA,
  NEW_PRODUCTS_DATA as WHOLESALE_NEW_PRODUCTS_DATA,
  PROMOTION_PRODUCTS_DATA as WHOLESALE_PROMOTION_PRODUCTS_DATA,
  GIFT_PRODUCTS_DATA as WHOLESALE_GIFT_PRODUCTS_DATA,
} from '@/mocks/sales-plan/plan-detail-net-fixed';
import { withWholesaleRowDummies } from '@/mocks/common/salesPlanWholesale';
import { UNIT_PRICE_KBN } from '@/mocks/common/planBasicInfo';

// 集計エリアに表示される金額・数量項目。率は金額から導出されるため、
// 金額が非負なら率も破綻しない（分母0のときは0を返す実装）。
const AMOUNT_KEYS: (keyof AggAmounts)[] = [
  'func',
  'extSales',
  'deliveryAmount',
  'volumeAdd',
  'condition',
  'sales',
  'cost',
  'netProfit',
  'salesLinkedA',
  'salesLinkedB',
  'salesLinkedH',
  'salesLinked',
  'centerFee',
  'locFill',
  'variableCost',
  'tradeProfit',
  'fixedA',
  'fixedB',
  'fixedH',
  'fixed',
  'column',
  'lease',
  'equip',
  'vendingRelated',
  'directFixed',
  'mgmtProfit',
  'promo',
  'salesUnitPrice',
  'annualContractAmount',
  'incentiveAmount',
];

const PERIODS = ['monthly', 'cumulative', 'yearly'] as const;

// 計画詳細(NET固定) の集計ソース。plan-detail-net-fixed/page.tsx と同じ組み立て方をする：
//   ・商品行は「一般卸メッシュ」ダミー（src/mocks/common/salesPlanWholesale）を
//     withWholesaleRowDummies で補完した行（DetailTable.tsx の
//     regularProductsData/newProductsData/promotionProductsData/giftProductsData の初期化と同一）。
//   ・拡売費行は計画詳細(マージン率固定・NET入力)と同じ NON_PRODUCT_EXPENSE_ROWS。
// withWholesaleRowDummies はサマリ商品名／一般卸メッシュが空欄の行を補完するだけで、
// toAggregationProducts 自身が社外売単価・原価単価・条件口単価を算出し直すため、
// DetailTable.tsx 側の recalcGiftLikeRates（グリッド表示専用のキャッシュ）は集計値に影響しない
// （手元調査で確認済み）。よってテストでは recalcGiftLikeRates を複製する必要はない。
const NET_FIXED_AGGREGATION_SOURCE: AggregationSource = {
  products: toAggregationProducts(
    [
      ...withWholesaleRowDummies(WHOLESALE_REGULAR_PRODUCTS_DATA, 'reg'),
      ...withWholesaleRowDummies(WHOLESALE_NEW_PRODUCTS_DATA, 'new'),
      ...withWholesaleRowDummies(WHOLESALE_PROMOTION_PRODUCTS_DATA, 'promo'),
      ...withWholesaleRowDummies(WHOLESALE_GIFT_PRODUCTS_DATA, 'gift'),
    ],
    {
      planPattern: 'netFixed',
      targetMonthIdx0: DEFAULT_TARGET_MONTH_IDX0,
      unitPriceKbn: UNIT_PRICE_KBN,
    }
  ),
  expenses: toAggregationExpenses(NON_PRODUCT_EXPENSE_ROWS, {
    targetMonthIdx0: DEFAULT_TARGET_MONTH_IDX0,
  }),
};

// 非負テストの対象となる2画面の集計ソース。失敗メッセージにどちらの画面かを含めるため
// ラベル付きで持つ（screen名は describe/it の見出しにもそのまま使う）。
const SCREENS: { label: string; source: AggregationSource }[] = [
  {
    label: '計画詳細(マージン率固定・NET入力)',
    source: DEFAULT_AGGREGATION_SOURCE,
  },
  { label: '計画詳細(NET固定)', source: NET_FIXED_AGGREGATION_SOURCE },
];

const amountsFor = (
  source: AggregationSource,
  period: (typeof PERIODS)[number],
  aOnlyPromo: boolean
) =>
  computeMonthsRange(
    source,
    monthsForPeriod(period, DEFAULT_TARGET_MONTH_IDX0 + 1),
    { aOnlyPromo }
  );

for (const { label, source } of SCREENS) {
  describe(`販売計画(集計)の既定ダミーデータ（${label}）`, () => {
    for (const period of PERIODS) {
      for (const aOnlyPromo of [false, true]) {
        it(`${period}（A口のみ=${aOnlyPromo}）は全項目が非負`, () => {
          const amounts = amountsFor(source, period, aOnlyPromo);
          const negatives = AMOUNT_KEYS.filter(
            (key) => (amounts[key] as number) < 0
          ).map((key) => `${key}=${amounts[key]}`);
          expect(
            negatives,
            `${label}: マイナスの項目: ${negatives.join(', ')}`
          ).toEqual([]);
        });
      }
    }

    it('売上高・売上総利益・売買差益・管理利益がこの順に減っても正のまま', () => {
      const a = amountsFor(source, 'yearly', false);
      expect(a.sales, `${label}: sales`).toBeGreaterThan(0);
      expect(a.netProfit, `${label}: netProfit`).toBeGreaterThan(0);
      expect(a.tradeProfit, `${label}: tradeProfit`).toBeGreaterThan(0);
      expect(a.mgmtProfit, `${label}: mgmtProfit`).toBeGreaterThan(0);
    });
  });
}

it('予算差・前年差が負にならない（計画が予算・前年を上回る係数設定）', () => {
  // 予算差 ＝ 計画 − 予算 ＝ 計画 ×(1 − budgetFactor)
  // 前年差 ＝ 計画 − 前年 ＝ 計画 ×(1 − prevYearFactor)
  expect(RATE_SETTINGS.budgetFactor).toBeLessThanOrEqual(1);
  expect(RATE_SETTINGS.prevYearFactor).toBeLessThanOrEqual(1);
});

// 欠陥B回帰テスト：集計対象選択（メタブランド／容器容量G）で絞り込んだ場合も
// 全項目が非負であることを検証する。Task 13 の非負回帰は絞り込みなしのみを
// 検証しており、拡売費（固定費）が特定の集計単位に偏って乗る組合せの
// マイナスを見逃していた（Task 14 の実測：三ツ矢×PET・ボトル缶280・350 で
// 管理利益額 ¥-18,945）。
// Task 15 フィードバック：この絞り込みテストは元々 計画詳細(マージン率固定・NET入力) の
// DEFAULT_AGGREGATION_SOURCE しか見ておらず、計画詳細(NET固定) 側（一般卸メッシュの
// ダミー行を経由する別データ）を一度も検証していなかった。両画面を対象にする。
for (const { label, source } of SCREENS) {
  describe(`集計単位で絞り込んでも全項目が非負（${label}）`, () => {
    const brands = listMetaBrands(source);

    it.each(brands)('メタブランド=%s', (brand) => {
      const amounts = computeMonthsRange(
        source,
        monthsForPeriod('yearly', DEFAULT_TARGET_MONTH_IDX0 + 1),
        { metaBrands: [brand] }
      );
      const negatives = AMOUNT_KEYS.filter(
        (k) => (amounts[k] as number) < 0
      ).map((k) => `${k}=${amounts[k]}`);
      expect(negatives, `${label} / ${brand}: ${negatives.join(', ')}`).toEqual(
        []
      );
    });

    it('メタブランド×容器容量G の全組合せで非負', () => {
      const failures: string[] = [];
      for (const brand of brands) {
        for (const capacity of listCapacities(source, brand)) {
          const amounts = computeMonthsRange(
            source,
            monthsForPeriod('yearly', DEFAULT_TARGET_MONTH_IDX0 + 1),
            { metaBrands: [brand], capacities: [capacity] }
          );
          for (const key of AMOUNT_KEYS) {
            if ((amounts[key] as number) < 0) {
              failures.push(
                `${label} / ${brand}×${capacity}: ${key}=${amounts[key]}`
              );
            }
          }
        }
      }
      expect(failures, failures.join(' / ')).toEqual([]);
    });
  });
}

// Important 1 回帰テスト：拡売費集計対象選択（対象月／計上月）を計上月にすると、
// 季節指数による月ずらし（expandToMonths のリスケール）で特定の集計単位・月の
// 直接固定費が対象月基準より大きくなり、管理利益が負転する組合せがあった
// （ウィルキンソン×Lパック、ワンダ×250缶）。この回帰は絞り込みなし・年間のみを
// 見る既存テストでは検出できないため、対象月／計上月 × 全12か月 × 全メタブランド×
// 容器容量G の組合せで非負を検証する。
const EXPENSE_MONTH_BASES: ExpenseMonthBasis[] = ['target', 'posting'];

for (const { label, source } of SCREENS) {
  describe(`計上月基準×月×集計単位で絞り込んでも全項目が非負（${label}）`, () => {
    const brands = listMetaBrands(source);

    it('対象月／計上月 × 全12か月 × メタブランド×容器容量G の全組合せで非負', () => {
      const failures: string[] = [];
      for (const basis of EXPENSE_MONTH_BASES) {
        for (let month = 1; month <= 12; month += 1) {
          for (const brand of brands) {
            for (const capacity of listCapacities(source, brand)) {
              const amounts = computeMonth(source, month, {
                metaBrands: [brand],
                capacities: [capacity],
                expenseMonthBasis: basis,
              });
              for (const key of AMOUNT_KEYS) {
                const value = amounts[key] as number;
                if (value < 0) {
                  failures.push(
                    `${label} / basis=${basis} / ${month}月 / ${brand}×${capacity}: ${key}=${value}`
                  );
                }
              }
            }
          }
        }
      }
      expect(failures, failures.join('\n')).toEqual([]);
    });
  });
}

import { describe, it, expect } from 'vitest';
import { planDetailTotalRatesOf } from './planDetailTotalRates';
import { simulationManagementProfitOf } from './simulationManagementProfit';
import { SUMMARY_PRODUCT_OPTIONS } from '../constants/productMasters';

const master = SUMMARY_PRODUCT_OPTIONS[0];
const base = {
  metaBrand: master.metaBrand,
  summaryProduct: master.value,
  wholesaleMesh: '',
  quantity: '24',
};
// 売上原価単価はテストでは固定値にする
const costUnitPriceOf = () => 50;

describe('planDetailTotalRatesOf（計画詳細の合計行の率）', () => {
  const rows = [
    {
      ...base,
      plan: '100',
      planPrice: '100',
      net: '90',
      price: '125',
      externalSales: '300,000',
    },
    {
      ...base,
      plan: '300',
      planPrice: '200',
      net: '160',
      price: '250',
      externalSales: '1,800,000',
    },
  ];

  it('マージン率・値入率は分子・分母を合算してから除算する（加重平均）', () => {
    const rates = planDetailTotalRatesOf(
      rows,
      'marginRateFixed',
      costUnitPriceOf
    );
    // マージン率 ＝ (10×2400 + 40×7200) ÷ (100×2400 + 200×7200)
    expect(rates.margin).toBeCloseTo(
      ((10 * 2400 + 40 * 7200) / (100 * 2400 + 200 * 7200)) * 100
    );
    // 値入率 ＝ (25×2400 + 50×7200) ÷ (125×2400 + 250×7200)
    expect(rates.discount).toBeCloseTo(
      ((25 * 2400 + 50 * 7200) / (125 * 2400 + 250 * 7200)) * 100
    );
  });

  it('量経追加口率・売買差益率は明細1行ごとの集計値（補足3-1）を合算して求める', () => {
    const rates = planDetailTotalRatesOf(
      rows,
      'marginRateFixed',
      costUnitPriceOf
    );
    const amounts = rows.map((r) =>
      simulationManagementProfitOf(r, 'marginRateFixed', 50)
    );
    const sum = (f: (a: (typeof amounts)[number]) => number) =>
      amounts.reduce((s, a) => s + f(a), 0);
    expect(rates.volumeAddRate).toBeCloseTo(
      (sum((a) => a.volumeAdd) / 2_100_000) * 100
    );
    expect(rates.profit).toBeCloseTo(
      (sum((a) => a.tradeProfit) / sum((a) => a.sales)) * 100
    );
  });

  it('計画/前年実績比は新商品・ギフトを除いて Σ計画 ÷ Σ前年実績 で求める', () => {
    const rates = planDetailTotalRatesOf(
      [
        { ...base, productCategory: '定番商品', plan: '120', prevYear: '100' },
        { ...base, productCategory: '特売', plan: '80', prevYear: '100' },
        { ...base, productCategory: '新商品', plan: '500', prevYear: '' },
      ],
      'marginRateFixed',
      costUnitPriceOf
    );
    expect(rates.ratio).toBeCloseTo(100);
  });

  it('分母が0（対象行なし）のときは NaN を返す（画面は「-」表示）', () => {
    const rates = planDetailTotalRatesOf(
      [{ ...base, plan: '100', planPrice: '', net: '', price: '' }],
      'netFixed',
      costUnitPriceOf
    );
    expect(rates.margin).toBeNaN();
    expect(rates.discount).toBeNaN();
    expect(rates.volumeAddRate).toBeNaN();
  });
});

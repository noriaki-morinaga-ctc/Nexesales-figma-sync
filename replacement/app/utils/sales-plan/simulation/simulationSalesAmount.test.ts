import { describe, it, expect } from 'vitest';
import { simulationSalesOf } from './simulationSalesAmount';
import { toAggregationProducts } from '@/app/utils/sales-plan/plan-detail/planGridToAggregation';
import { computeMonthsRange } from '@/app/utils/sales-plan/common/aggregationCalc';
import { SUMMARY_PRODUCT_OPTIONS } from '@/app/constants/productMasters';
import type { PlanPattern } from '@/app/utils/sales-plan/common/conditionUnitPrice';
import { UNIT_PRICE_KBN } from '@/mocks/common/planBasicInfo';

// 計画詳細の集計エンジン（補足3-1）と同じ売上高になることを、明細1行だけの集計で確かめる。
const master = SUMMARY_PRODUCT_OPTIONS[0];
const row = {
  metaBrand: master.metaBrand,
  containerCapacityG: master.containerCapacityG,
  summaryProduct: master.value,
  wholesaleMesh: '',
  quantity: '24',
  plan: '100',
  planPrice: '120',
};

const engineOf = (planPattern: PlanPattern) =>
  computeMonthsRange(
    {
      products: toAggregationProducts([row], {
        planPattern,
        targetMonthIdx0: 0,
        unitPriceKbn: UNIT_PRICE_KBN,
      }),
      expenses: [],
    },
    [0]
  );

describe('simulationSalesOf（売上高＝社外売上高−量経追加口−条件口）', () => {
  (['marginRateFixed', 'netFixed'] as const).forEach((planPattern) => {
    it(`計画詳細の集計と同じ値になる（${planPattern}）`, () => {
      const engine = engineOf(planPattern);
      // 量経追加口・条件口とも0でない行で比べる（0同士の一致で素通りしないため）
      expect(engine.volumeAdd).toBeGreaterThan(0);
      expect(engine.condition).toBeGreaterThan(0);
      const result = simulationSalesOf(
        { ...row, externalSales: String(engine.extSales) },
        planPattern
      );
      expect(result.volumeAdd).toBeCloseTo(engine.volumeAdd, 6);
      expect(result.condition).toBeCloseTo(engine.condition, 6);
      expect(result.sales).toBeCloseTo(engine.sales, 6);
      expect(result.sales).toBeCloseTo(
        engine.extSales - engine.volumeAdd - engine.condition,
        6
      );
    });
  });

  it('函数・入数が空なら条件口は0、社外売上高が空なら売上高は0', () => {
    const result = simulationSalesOf(
      { metaBrand: master.metaBrand },
      'netFixed'
    );
    expect(result).toEqual({ volumeAdd: 0, condition: 0, sales: 0 });
  });
});

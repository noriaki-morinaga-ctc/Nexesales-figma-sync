import { describe, expect, it } from 'vitest';
import { REGULAR_PRODUCTS_DATA } from '@/mocks/sales-plan/plan-detail-net-fixed';
import { applyRateToRows, recalcGiftLikeRates } from './utils';

describe('applyRateToRows（函数反映・計画コピー）', () => {
  // 前年実績のある行（計算に使う単価もそろった行）
  const rows = REGULAR_PRODUCTS_DATA.map(recalcGiftLikeRates).filter(
    (r) => (parseFloat(String(r.prevYear ?? '').replace(/,/g, '')) || 0) > 0
  );

  it('計画函数を前年実績×率にし、社外売上高・売上原価・値入額も計算し直す', () => {
    expect(rows.length).toBeGreaterThan(0);
    const [after] = applyRateToRows([rows[0]], 200);
    const prev = parseFloat(String(rows[0].prevYear).replace(/,/g, ''));
    expect(after.plan).toBe(String(Math.round(prev * 2)));
    // 変えた計画函数で計算した値と同じ（古い値のまま残らない）
    const expected = recalcGiftLikeRates({ ...rows[0], plan: after.plan });
    expect(after.externalSales).toBe(expected.externalSales);
    expect(after.delivery).toBe(expected.delivery);
    expect(after.markupAmount).toBe(expected.markupAmount);
    expect(after.externalSales).not.toBe(rows[0].externalSales);
  });

  it('前年実績が無い行は変えない', () => {
    const row = { ...rows[0], prevYear: '' };
    expect(applyRateToRows([row], 200)[0]).toBe(row);
  });
});

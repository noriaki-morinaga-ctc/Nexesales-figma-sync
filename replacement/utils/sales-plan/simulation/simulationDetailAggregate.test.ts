import { describe, it, expect } from 'vitest';
import {
  aggregateSimulationDetail,
  isAOnlyPromoTarget,
} from './simulationDetailAggregate';
import { SIMULATION_RATIOS } from '@/mocks/common/aggregationSource';

const SEL = { fixed: true, a: false, b: false, c: false };
const ROW = {
  probability: '確定',
  plan: '1',
  externalSales: '100000',
  exp1PlannedAmountBefore: '1000',
  exp1ManagementClass: '売上連動拡売費A口',
  exp2PlannedAmountBefore: '500',
  exp2ManagementClass: '売上連動拡売費B口',
};

describe('aggregateSimulationDetail（A口のみ集計）', () => {
  it('① オプション省略時は拡売費①②を全額集計する（従来どおり）', () => {
    expect(
      aggregateSimulationDetail([ROW], SEL, SIMULATION_RATIOS).promo
    ).toBeCloseTo(1500);
  });

  it('② A口のみ集計では対象の管理区分の金額だけを集計する', () => {
    expect(
      aggregateSimulationDetail([ROW], SEL, SIMULATION_RATIOS, {
        aOnlyPromo: true,
      }).promo
    ).toBeCloseTo(1000);
  });

  it('③ 管理区分が空の行は、管理コードの接頭辞で判定する', () => {
    const row = {
      ...ROW,
      exp2ManagementClass: '',
      exp2ManagementCode: 'FA001',
    };
    expect(
      aggregateSimulationDetail([row], SEL, SIMULATION_RATIOS, {
        aOnlyPromo: true,
      }).promo
    ).toBeCloseTo(1500);
  });

  it('④ A口のみ集計では、除いた拡売費の分だけ管理利益が増える', () => {
    const all = aggregateSimulationDetail([ROW], SEL, SIMULATION_RATIOS);
    const aOnly = aggregateSimulationDetail([ROW], SEL, SIMULATION_RATIOS, {
      aOnlyPromo: true,
    });
    expect(aOnly.mgmtProfit - all.mgmtProfit).toBeGreaterThan(0);
  });

  it('isAOnlyPromoTarget：計画詳細と同じ2費目だけが対象', () => {
    expect(isAOnlyPromoTarget('売上連動拡売費A口')).toBe(true);
    expect(isAOnlyPromoTarget('拡売費(固定費)A口')).toBe(true);
    expect(isAOnlyPromoTarget('売上連動拡売費B口')).toBe(false);
    expect(isAOnlyPromoTarget('ロケ補填')).toBe(false);
    expect(isAOnlyPromoTarget('コラム料')).toBe(false);
    expect(isAOnlyPromoTarget('', 'RB001')).toBe(false);
    expect(isAOnlyPromoTarget('', 'RA001')).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';

import type { EdiActual, ProductData } from '@/types/salesPlanRetail';
import { makeEmptyProduct } from '@/utils/sales-plan/plan-detail/planDetailEmptyRow';

import {
  addedPlanRowOf,
  addedRowPlacementOf,
  ediMatchErrorOf,
  ediPriceDiffText,
  ediRowHintOf,
  ediRowOf,
  insertEdiRows,
  isEdiMatchCandidate,
  isEdiPriceDifferent,
  matchedPlanRowOf,
  unmatchedPlanRowOf,
  withoutEdiMatch,
} from './utilsEdiMatching';

// テスト用の計画行（必要な項目だけ上書きする）
const planRow = (over: Partial<ProductData> = {}): ProductData => ({
  ...makeEmptyProduct('定番商品'),
  id: 'p1',
  summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
  productCategory: '定番商品',
  promotion: 'ポイント販促',
  planPrice: '88.85',
  ...over,
});

// テスト用の未突合の実販EDI
const edi = (over: Partial<EdiActual> = {}): EdiActual => ({
  id: 'E2',
  summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
  ediPrice: '87.35',
  count: '900',
  status: 'unmatched',
  ...over,
});

describe('isEdiPriceDifferent', () => {
  it('計画納価とEDI納価が違えば true', () => {
    expect(isEdiPriceDifferent('88.85', '87.35')).toBe(true);
  });
  it('同じ値（桁の表記違いを含む）なら false', () => {
    expect(isEdiPriceDifferent('80', '80.00')).toBe(false);
  });
  it('どちらかが空欄なら false（判定しない）', () => {
    expect(isEdiPriceDifferent('', '84.00')).toBe(false);
    expect(isEdiPriceDifferent('85.00', '')).toBe(false);
  });
});

describe('ediPriceDiffText', () => {
  it('差は EDI納価 − 計画納価 で、マイナスは「−」を付ける', () => {
    expect(ediPriceDiffText('78.00', '76.50')).toBe('−1.50');
  });
  it('プラスは「+」を付ける', () => {
    expect(ediPriceDiffText('79.00', '79.50')).toBe('+0.50');
  });
  it('どちらかが空欄なら空文字', () => {
    expect(ediPriceDiffText('', '84.00')).toBe('');
  });
});

describe('isEdiMatchCandidate', () => {
  it('同じサマリ商品で実販EDIを反映していない計画行は候補', () => {
    expect(isEdiMatchCandidate(planRow(), edi().summaryProduct)).toBe(true);
  });
  it('実販EDIを反映済みの計画行は候補にしない', () => {
    expect(
      isEdiMatchCandidate(planRow({ ediPrice: '88.85' }), edi().summaryProduct)
    ).toBe(false);
  });
  it('サマリ商品が違う計画行・EDI行・ギフトは候補にしない', () => {
    expect(
      isEdiMatchCandidate(
        planRow({ summaryProduct: '十六茶６６０ｍＬ２４本' }),
        edi().summaryProduct
      )
    ).toBe(false);
    expect(isEdiMatchCandidate(ediRowOf(edi()), edi().summaryProduct)).toBe(
      false
    );
    expect(
      isEdiMatchCandidate(planRow({ section: 'ギフト' }), edi().summaryProduct)
    ).toBe(false);
  });
});

describe('ediMatchErrorOf', () => {
  it('同じサマリ商品・双方が未突合なら突合できる（null）', () => {
    expect(ediMatchErrorOf(planRow(), edi())).toBeNull();
  });
  it('EDIが未突合でなければ突合できない', () => {
    expect(
      ediMatchErrorOf(planRow(), edi({ status: 'manual' }))
    ).not.toBeNull();
  });
  it('サマリ商品が違えば突合できない', () => {
    expect(
      ediMatchErrorOf(
        planRow({ summaryProduct: '十六茶６６０ｍＬ２４本' }),
        edi()
      )
    ).toContain('サマリ商品');
  });
  it('実販EDIを反映済みの計画行には突合できない', () => {
    expect(ediMatchErrorOf(planRow({ ediPrice: '88.85' }), edi())).toContain(
      '反映済み'
    );
  });
  it('EDI行どうしは突合できない', () => {
    expect(ediMatchErrorOf(ediRowOf(edi()), edi())).not.toBeNull();
  });
});

describe('matchedPlanRowOf / unmatchedPlanRowOf', () => {
  it('突合すると実販函数を当月実績に加算し、EDI納価を入れる。計画納価は書き換えない', () => {
    const matched = matchedPlanRowOf(planRow({ actual: '1,200' }), edi());
    expect(matched.actual).toBe('2100');
    expect(matched.ediPrice).toBe('87.35');
    expect(matched.planPrice).toBe('88.85');
    expect(matched.ediMatchStatus).toBe('manual');
  });
  it('取り消すと当月実績・EDI納価・突合の状態を突合の前に戻す', () => {
    const matched = matchedPlanRowOf(planRow({ actual: '' }), edi());
    const cancelled = unmatchedPlanRowOf(matched, edi());
    expect(cancelled.actual).toBe('');
    expect(cancelled.ediPrice).toBe('');
    expect(cancelled.ediMatchStatus).toBeUndefined();
  });
  it('コピーした行は突合の状態・EDI納価を引き継がない（当月実績などはそのまま）', () => {
    const matched = matchedPlanRowOf(planRow({ actual: '1,200' }), edi());
    const copied = withoutEdiMatch(matched);
    expect(copied.ediPrice).toBe('');
    expect(copied.ediMatchStatus).toBeUndefined();
    expect(copied._ediActualId).toBeUndefined();
    expect(copied.actual).toBe('2100');
    expect(copied.planPrice).toBe('88.85');
  });
});

describe('ediRowOf / addedPlanRowOf', () => {
  it('EDI行はサマリ商品・入数・実販函数・EDI納価だけを持ち、計画側は空', () => {
    const row = ediRowOf(edi());
    expect(row._ediRow).toBe(true);
    expect(row.id).toBe('edi-E2');
    expect(row.actual).toBe('900');
    expect(row.ediPrice).toBe('87.35');
    expect(row.quantity).toBe('24');
    expect(row.plan).toBe('');
    expect(row.planPrice).toBe('');
    expect(row.productCategory).toBe('');
  });
  it('追加行は入力・選択欄を空欄にし、突合の状態を「追加」にする', () => {
    const row = addedPlanRowOf(edi(), '定番商品', 'added-E2');
    expect(row.ediMatchStatus).toBe('added');
    expect(row.section).toBe('定番商品');
    expect(row.productCategory).toBe('');
    expect(row.promotion).toBe('');
    expect(row.plan).toBe('');
    expect(row.planPrice).toBe('');
    expect(row.price).toBe('');
    expect(row.actual).toBe('900');
    expect(row.metaBrand).toBe('カルピス');
  });
});

describe('insertEdiRows', () => {
  const a = planRow({ id: 'a', summaryProduct: 'A' });
  const b1 = planRow({ id: 'b1', summaryProduct: 'B' });
  const b2 = planRow({ id: 'b2', summaryProduct: 'B' });
  const c = planRow({ id: 'c', summaryProduct: 'C' });
  const ediB = ediRowOf(edi({ id: 'EB', summaryProduct: 'B' }));
  const ediB2 = ediRowOf(edi({ id: 'EB2', summaryProduct: 'B' }));
  const ediZ = ediRowOf(edi({ id: 'EZ', summaryProduct: 'Z' }));

  it('同じサマリ商品の最後の計画行の直下に差し込む', () => {
    const ids = insertEdiRows([a, b1, b2, c], [ediB]).map((r) => r.id);
    expect(ids).toEqual(['a', 'b1', 'b2', 'edi-EB', 'c']);
  });
  it('同じサマリ商品のEDI行が複数あれば受け取った順に並べる', () => {
    const ids = insertEdiRows([a, b1, c], [ediB, ediB2]).map((r) => r.id);
    expect(ids).toEqual(['a', 'b1', 'edi-EB', 'edi-EB2', 'c']);
  });
  it('同じサマリ商品の計画行が無いEDI行は先頭に置く', () => {
    const ids = insertEdiRows([a, c], [ediZ]).map((r) => r.id);
    expect(ids).toEqual(['edi-EZ', 'a', 'c']);
  });
});

describe('addedRowPlacementOf', () => {
  it('同じサマリ商品の最後の計画行と同じ区分の、その直下', () => {
    const sections = {
      定番商品: [planRow({ id: 'r1', summaryProduct: 'B' })],
      特売: [
        planRow({ id: 'p1', summaryProduct: 'A' }),
        planRow({ id: 'p2', summaryProduct: 'B' }),
      ],
    };
    expect(addedRowPlacementOf(sections, 'B')).toEqual({
      section: '特売',
      index: 2,
    });
  });
  it('同じサマリ商品の計画行が無ければ定番商品の先頭', () => {
    expect(addedRowPlacementOf({ 定番商品: [planRow()] }, 'Z')).toEqual({
      section: '定番商品',
      index: 0,
    });
  });
});

describe('ediRowHintOf', () => {
  it('突合先の候補と差を出す', () => {
    const hint = ediRowHintOf(edi(), [planRow()]);
    expect(hint).toContain('定番商品・ポイント販促（計画88.85／差 −1.50）');
  });
  it('候補が無ければ、保存すると明細が追加されることを出す', () => {
    const hint = ediRowHintOf(edi(), [planRow({ ediPrice: '88.85' })]);
    expect(hint).toContain('突合できる計画行がありません');
  });
});

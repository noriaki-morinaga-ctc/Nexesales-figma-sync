import { describe, it, expect } from 'vitest';

import type { EdiActual, ProductData } from '@/types/salesPlanRetail';
import { makeEmptyProduct } from '@/utils/sales-plan/plan-detail/planDetailEmptyRow';

import {
  addedPlanRowOf,
  addedRowHintOf,
  ediMatchErrorOf,
  ediPriceDiffText,
  isAddedByEdiRow,
  isEdiMatchCandidate,
  isEdiPriceDifferent,
  matchedPlanRowOf,
  sectionsAfterCancel,
  sectionsAfterMatch,
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

// テスト用の実販EDI（反映ルール④で計画行として追加したもの）
const edi = (over: Partial<EdiActual> = {}): EdiActual => ({
  id: 'E2',
  summaryProduct: 'カルピスウォーター５００ｍＬ２４本',
  ediPrice: '87.35',
  count: '900',
  status: 'added',
  planRowId: 'edi-added-E2',
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

describe('addedPlanRowOf', () => {
  it('追加の行は入力・選択欄を空欄にし、突合の状態を「追加」にする', () => {
    const row = addedPlanRowOf(edi(), '定番商品');
    expect(row.id).toBe('edi-added-E2');
    expect(row.ediMatchStatus).toBe('added');
    expect(isAddedByEdiRow(row)).toBe(true);
    expect(row._ediActualId).toBe('E2');
    expect(row.section).toBe('定番商品');
    expect(row.productCategory).toBe('');
    expect(row.promotion).toBe('');
    expect(row.plan).toBe('');
    expect(row.planPrice).toBe('');
    expect(row.price).toBe('');
    expect(row.actual).toBe('900');
    expect(row.ediPrice).toBe('87.35');
    expect(row.metaBrand).toBe('カルピス');
  });
});

describe('isEdiMatchCandidate', () => {
  it('同じサマリ商品で実販EDIを反映していない計画行は候補', () => {
    expect(isEdiMatchCandidate(planRow(), edi().summaryProduct)).toBe(true);
  });
  it('実販EDIを反映済みの計画行・追加の行は候補にしない', () => {
    expect(
      isEdiMatchCandidate(planRow({ ediPrice: '88.85' }), edi().summaryProduct)
    ).toBe(false);
    expect(
      isEdiMatchCandidate(
        addedPlanRowOf(edi(), '定番商品'),
        edi().summaryProduct
      )
    ).toBe(false);
  });
  it('サマリ商品が違う計画行・ギフトは候補にしない', () => {
    expect(
      isEdiMatchCandidate(
        planRow({ summaryProduct: '十六茶６６０ｍＬ２４本' }),
        edi().summaryProduct
      )
    ).toBe(false);
    expect(
      isEdiMatchCandidate(planRow({ section: 'ギフト' }), edi().summaryProduct)
    ).toBe(false);
  });
});

describe('ediMatchErrorOf', () => {
  it('同じサマリ商品・双方が未突合なら突合できる（null）', () => {
    expect(ediMatchErrorOf(planRow(), edi())).toBeNull();
  });
  it('追加の行の実販EDIでなければ突合できない', () => {
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
  it('追加の行どうしは突合できない', () => {
    expect(
      ediMatchErrorOf(addedPlanRowOf(edi(), '定番商品'), edi())
    ).not.toBeNull();
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

describe('sectionsAfterMatch / sectionsAfterCancel', () => {
  const other = planRow({ id: 'p0', summaryProduct: 'A' });
  const target = planRow({ id: 'p1', actual: '1,200' });
  const added = addedPlanRowOf(edi(), '定番商品');

  it('突合すると突合先の計画行を置き換え、追加の行を消す（1行にまとめる）', () => {
    const next = sectionsAfterMatch(
      { 定番商品: [other, target, added] },
      matchedPlanRowOf(target, edi()),
      added.id ?? ''
    );
    expect(next['定番商品'].map((r) => r.id)).toEqual(['p0', 'p1']);
    expect(next['定番商品'][1].actual).toBe('2100');
    expect(next['定番商品'][1].ediMatchStatus).toBe('manual');
  });
  it('取り消すと計画行を戻し、その直下に追加の行を作り直す', () => {
    const matched = matchedPlanRowOf(target, edi());
    const next = sectionsAfterCancel(
      { 定番商品: [other, matched], 特売: [planRow({ id: 's1' })] },
      unmatchedPlanRowOf(matched, edi()),
      edi()
    );
    expect(next['定番商品'].map((r) => r.id)).toEqual([
      'p0',
      'p1',
      'edi-added-E2',
    ]);
    expect(next['定番商品'][1].actual).toBe('1200');
    expect(next['定番商品'][2].ediMatchStatus).toBe('added');
    expect(next['特売'].map((r) => r.id)).toEqual(['s1']);
  });
});

describe('addedRowHintOf', () => {
  it('突合先の候補と差を出す', () => {
    const hint = addedRowHintOf(edi(), [planRow()]);
    expect(hint).toContain('定番商品・ポイント販促（計画88.85／差 −1.50）');
  });
  it('候補が無ければ、入力を促す（保存で追加される案内は出さない）', () => {
    const hint = addedRowHintOf(edi(), [planRow({ ediPrice: '88.85' })]);
    expect(hint).toContain('突合できる計画行はありません');
    expect(hint).toContain('商品区分・販促区分・計画函数・納価・売価を入力');
    expect(hint).not.toContain('保存');
  });
});

import { describe, it, expect } from 'vitest';
import {
  GIFT_PERIODS,
  promotionForCategory,
  buildCategoryChangeRows,
} from './productCategoryChange';

// テスト用の採番（決定的な値を返す）。
const options = {
  newGiftSetId: () => 'giftset-test',
  newRowId: (i: number) => `new-test-${i}`,
};

describe('promotionForCategory', () => {
  it('ギフトは販促区分もギフトになる', () => {
    expect(promotionForCategory('ギフト', 'エンド')).toBe('ギフト');
  });

  it('特殊商品は販促区分を持たない（空文字）', () => {
    expect(promotionForCategory('特殊商品', 'エンド')).toBe('');
  });

  it('変更後の区分に現在の販促区分があれば維持する', () => {
    expect(promotionForCategory('新商品', 'エンド')).toBe('エンド');
  });

  it('変更後の区分に無い販促区分は先頭の選択肢へ切り替える', () => {
    expect(promotionForCategory('定番商品', 'エンド')).toBe('定番・EDLP');
  });
});

describe('buildCategoryChangeRows', () => {
  const singleRow = {
    id: 'reg-1',
    section: '定番商品',
    productCategory: '定番商品',
    promotion: '定番・EDLP',
    summaryProduct: '三ツ矢サイダー500mL24本',
    plan: '500',
    estimate: '480',
  };

  it('ギフト以外どうしの変更は1行のまま区分と section を更新する', () => {
    const rows = buildCategoryChangeRows([singleRow], '新商品', options);
    expect(rows).toHaveLength(1);
    expect(rows[0].section).toBe('新商品');
    expect(rows[0].productCategory).toBe('新商品');
    expect(rows[0].id).toBe('reg-1');
    // 計画・当月着地見込は据え置き
    expect(rows[0].plan).toBe('500');
    expect(rows[0].estimate).toBe('480');
  });

  it('既存のサマリ商品名は変更しない', () => {
    const rows = buildCategoryChangeRows([singleRow], 'ギフト', options);
    rows.forEach((r) =>
      expect(r.summaryProduct).toBe('三ツ矢サイダー500mL24本')
    );
  });

  it('ギフトへ変更すると上旬・中旬・下旬の3行になる', () => {
    const rows = buildCategoryChangeRows([singleRow], 'ギフト', options);
    expect(rows.map((r) => r.period)).toEqual(GIFT_PERIODS);
    expect(rows.every((r) => r.giftSetId === 'giftset-test')).toBe(true);
    expect(rows.every((r) => r.productCategory === 'ギフト')).toBe(true);
    // 販促区分もギフトへ自動反映
    expect(rows.every((r) => r.promotion === 'ギフト')).toBe(true);
    // 計画は上旬へ寄せ、中旬・下旬は空欄
    expect(rows.map((r) => r.plan)).toEqual(['500', '', '']);
    // 先頭行のIDは維持（変更セルのハイライトを引き継ぐため）
    expect(rows.map((r) => r.id)).toEqual([
      'reg-1',
      'new-test-1',
      'new-test-2',
    ]);
  });

  const giftSet = GIFT_PERIODS.map((period, i) => ({
    id: `gift-${i}`,
    section: 'ギフト',
    productCategory: 'ギフト',
    promotion: 'ギフト',
    giftSetId: 'gift-set-1',
    period,
    plan: ['500', '300', '200'][i],
    estimate: ['500', '300', '200'][i],
  }));

  it('ギフトから他区分へ変更すると3行が1行に畳まれる', () => {
    const rows = buildCategoryChangeRows(giftSet, '新商品', options);
    expect(rows).toHaveLength(1);
    expect(rows[0].section).toBe('新商品');
    expect(rows[0].giftSetId).toBeUndefined();
    expect(rows[0].period).toBe('');
    // 計画（函数）はセット合計を引き継ぐ
    expect(rows[0].plan).toBe('1000');
    expect(rows[0].estimate).toBe('1000');
    // 先頭行（上旬）のIDを維持
    expect(rows[0].id).toBe('gift-0');
  });

  it('セットの並びが崩れていても上旬を先頭として畳む', () => {
    const shuffled = [giftSet[2], giftSet[0], giftSet[1]];
    const rows = buildCategoryChangeRows(shuffled, '特殊商品', options);
    expect(rows[0].id).toBe('gift-0');
    // 特殊商品は販促区分を持たない
    expect(rows[0].promotion).toBe('');
  });

  it('periodFields を指定すると変更前／変更後も期間ごとに扱う', () => {
    const simGiftSet = GIFT_PERIODS.map((period, i) => ({
      id: `sim-${i}`,
      section: 'ギフト',
      productCategory: 'ギフト',
      promotion: 'ギフト',
      giftSetId: 'gift-set-1',
      period,
      plan: ['500', '300', '200'][i],
      planBefore: ['500', '300', '200'][i],
    }));
    const simOptions = {
      ...options,
      periodFields: ['plan', 'planBefore'],
    };
    const merged = buildCategoryChangeRows(simGiftSet, '新商品', simOptions);
    expect(merged[0].plan).toBe('1000');
    expect(merged[0].planBefore).toBe('1000');
    // 1行→3行では上旬へ寄せ、中旬・下旬は空欄になる
    const expanded = buildCategoryChangeRows(merged, 'ギフト', simOptions);
    expect(expanded.map((r) => r.planBefore)).toEqual(['1000', '', '']);
  });

  it('section を指定すると商品区分と別のセクション名へ振り分ける', () => {
    // 量販シミュレーション：商品区分「特売」＝セクション「特殊商品」
    const rows = buildCategoryChangeRows([singleRow], '特売', {
      ...options,
      section: '特殊商品',
    });
    expect(rows[0].productCategory).toBe('特売');
    expect(rows[0].section).toBe('特殊商品');
  });

  it('対象行が無ければ空配列を返す', () => {
    expect(buildCategoryChangeRows([], 'ギフト', options)).toEqual([]);
  });
});

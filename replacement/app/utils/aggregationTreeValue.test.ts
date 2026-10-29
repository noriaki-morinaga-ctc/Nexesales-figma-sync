// 欠陥A回帰テスト：詳細タブ（AggregationItemTreeTable）の函数が表示単位トグルで
// 1000分の1にならないことを固定する。函数は数量（函）であり通貨ではないため、
// 表示単位＝千円でも Math.floor(v/1000) を適用してはならない
// （グラフタブ・年間集計タブと同じ扱いに揃える）。
import { describe, it, expect } from 'vitest';
import { makeTreeValueFor } from './aggregationTreeValue';
import type { AggAmounts } from './aggregationCalc';

// 函数 27,000 / 社外売上高 5,000,000 の最小データ
const AMOUNTS = { func: 27000, extSales: 5000000 } as unknown as AggAmounts;

describe('makeTreeValueFor の表示単位', () => {
  it('函数は数量なので千円表示でも1000で割らない', () => {
    const yen = makeTreeValueFor(AMOUNTS, 'yen');
    const thousand = makeTreeValueFor(AMOUNTS, 'thousand');
    const row = { key: 'func', label: '函数', itemId: 1 };
    expect(yen(row, 'plan')).toBe('27,000');
    expect(thousand(row, 'plan')).toBe('27,000');
  });

  it('金額項目は千円表示で1000で割る', () => {
    const row = { key: 'externalSales', label: '社外売上高', itemId: 3 };
    expect(makeTreeValueFor(AMOUNTS, 'yen')(row, 'plan')).toBe('5,000,000');
    expect(makeTreeValueFor(AMOUNTS, 'thousand')(row, 'plan')).toBe('5,000');
  });
});

// Minor 4 回帰テスト：単価項目（売上高単価・売買差益函単価・管理利益函単価）は
// 「円/函」であり集計金額ではないため、千円表示でも1000で割ってはいけない
// （旧実装では ¥525 のような単価が Math.floor(525/1000)=0 に丸まっていた）。
describe('makeTreeValueFor の単価項目（Minor 4）', () => {
  // 売上高単価＝525円、函数=1000（売買差益函単価44円・管理利益函単価18円になるよう
  // 売買差益=44,000・管理利益=18,000に設定）
  const UNIT_PRICE_AMOUNTS = {
    func: 1000,
    extSales: 5000000,
    salesUnitPrice: 525,
    tradeProfit: 44000,
    mgmtProfit: 18000,
  } as unknown as AggAmounts;

  it('売上高単価（itemId 6）は千円表示でも円のまま表示する', () => {
    const row = { key: 'salesUnitPrice', label: '売上高単価', itemId: 6 };
    expect(makeTreeValueFor(UNIT_PRICE_AMOUNTS, 'yen')(row, 'plan')).toBe(
      '525'
    );
    expect(makeTreeValueFor(UNIT_PRICE_AMOUNTS, 'thousand')(row, 'plan')).toBe(
      '525'
    );
  });

  it('売買差益函単価（itemId 25）は千円表示でも円のまま表示する', () => {
    const row = {
      key: 'tradeProfitUnitPrice',
      label: '売買差益函単価',
      itemId: 25,
    };
    expect(makeTreeValueFor(UNIT_PRICE_AMOUNTS, 'yen')(row, 'plan')).toBe('44');
    expect(makeTreeValueFor(UNIT_PRICE_AMOUNTS, 'thousand')(row, 'plan')).toBe(
      '44'
    );
  });

  it('管理利益函単価（itemId 29）は千円表示でも円のまま表示する', () => {
    const row = {
      key: 'mgmtProfitUnitPrice',
      label: '管理利益函単価',
      itemId: 29,
    };
    expect(makeTreeValueFor(UNIT_PRICE_AMOUNTS, 'yen')(row, 'plan')).toBe('18');
    expect(makeTreeValueFor(UNIT_PRICE_AMOUNTS, 'thousand')(row, 'plan')).toBe(
      '18'
    );
  });
});

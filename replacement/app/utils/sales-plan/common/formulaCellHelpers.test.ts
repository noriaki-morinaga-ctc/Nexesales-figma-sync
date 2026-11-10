import { describe, it, expect } from 'vitest';
import {
  makeExternalUnitPriceOf,
  makeCostUnitPriceOf,
  unitTimesQuantityTimesPlan,
  makeDetailValueOf,
  makeDetailTooltip,
  deltaResult,
  type FormulaCellMaster,
} from './formulaCellHelpers';

interface Row {
  summaryProduct: string;
  planPrice: string;
  quantity: string;
  plan: string;
  price?: string;
  netBefore?: string;
  net?: string;
}

const MASTER: FormulaCellMaster = {
  itemBaraPrice: '70.00',
  opeChannel: true,
  opeBaraPrice: '65.00',
  seihan: '48.50',
  costOfSales: '52.00',
};

const row: Row = {
  summaryProduct: '三ツ矢サイダー500mL24本',
  planPrice: '131.60',
  quantity: '24',
  plan: '800',
};

// 単価取得区分は planBasicInfoMockData の UNIT_PRICE_KBN（'取得不可'）が使われるため、
// 分岐1（アイテムバラ保証金抜き単価）に落ちる。
const masterOf = (r: Row) =>
  r.summaryProduct === '三ツ矢サイダー500mL24本' ? MASTER : undefined;

describe('makeExternalUnitPriceOf', () => {
  it('マスタが引ければ補足2-2の導出結果を返す', () => {
    expect(makeExternalUnitPriceOf(masterOf)(row)).toBe(70);
  });

  it('マスタが引けなければ NaN を返す', () => {
    expect(
      makeExternalUnitPriceOf(masterOf)({ ...row, summaryProduct: '未登録' })
    ).toBeNaN();
  });
});

describe('makeCostUnitPriceOf', () => {
  it('売上原価単価（支社受渡原価）を返す', () => {
    expect(makeCostUnitPriceOf(masterOf)(row)).toBe(52);
  });

  it('マスタが引けなければ NaN を返す', () => {
    expect(
      makeCostUnitPriceOf(masterOf)({ ...row, summaryProduct: '未登録' })
    ).toBeNaN();
  });
});

describe('unitTimesQuantityTimesPlan', () => {
  it('単価 × 入数 × 函数を3桁区切りで返す', () => {
    expect(unitTimesQuantityTimesPlan(131.6, '24', '800')).toBe('2,526,720');
  });

  it('いずれかが欠けたら空文字を返す', () => {
    expect(unitTimesQuantityTimesPlan(NaN, '24', '800')).toBe('');
    expect(unitTimesQuantityTimesPlan(131.6, '', '800')).toBe('');
    expect(unitTimesQuantityTimesPlan(131.6, '24', '')).toBe('');
  });
});

describe('makeDetailValueOf', () => {
  const valueOf = makeDetailValueOf(
    makeExternalUnitPriceOf(masterOf),
    makeCostUnitPriceOf(masterOf)
  );

  it('__unitPrice は社外売単価を小数2桁で返す', () => {
    expect(valueOf(row, '__unitPrice')).toBe('70.00');
  });

  it('__costUnitPrice は売上原価単価を小数2桁で返す', () => {
    expect(valueOf(row, '__costUnitPrice')).toBe('52.00');
  });

  it('通常のトークンは行のフィールド値を返す', () => {
    expect(valueOf(row, 'planPrice')).toBe('131.60');
  });

  it('空・未定義のフィールドは null を返す', () => {
    expect(valueOf(row, 'price')).toBeNull();
  });

  it('マスタが引けなければ擬似トークンは null を返す', () => {
    expect(
      valueOf({ ...row, summaryProduct: '未登録' }, '__unitPrice')
    ).toBeNull();
  });
});

describe('makeDetailTooltip', () => {
  const valueOf = makeDetailValueOf(
    makeExternalUnitPriceOf(masterOf),
    makeCostUnitPriceOf(masterOf)
  );
  const tooltip = makeDetailTooltip<Row>(
    { __unitPrice: '社外売単価', quantity: '入数', plan: '函数(計画)' },
    valueOf
  );

  it('式と実値の2行を返す', () => {
    const fn = tooltip(
      { template: '{__unitPrice} × {quantity} × {plan}' },
      () => '1,344,000'
    );
    expect(fn(row)).toBe(
      '社外売単価 × 入数 × 函数(計画)\n= 70.00 × 24 × 800 = 1,344,000'
    );
  });

  it('valueLine が false なら式だけを返す', () => {
    const fn = tooltip(
      { template: '売買差益 ÷ 売上高 × 100%', valueLine: false },
      () => ''
    );
    expect(fn(row)).toBe('売買差益 ÷ 売上高 × 100%');
  });
});

describe('deltaResult', () => {
  it('変更後 − 変更前 を返す', () => {
    expect(deltaResult({ net: '120', netBefore: '100' }, 'net')).toBe('20');
  });

  it('負の増減も返す', () => {
    expect(deltaResult({ net: '80', netBefore: '100' }, 'net')).toBe('-20');
  });

  it('どちらかが欠けたら空文字を返す', () => {
    expect(deltaResult({ net: '120', netBefore: '' }, 'net')).toBe('');
  });
});

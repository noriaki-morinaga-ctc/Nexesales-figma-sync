import { describe, it, expect } from 'vitest';
import {
  computeMonth,
  computeMonthsRange,
  computePeriods,
  computeUnitMatrix,
  listMetaBrands,
  listCapacities,
} from './aggregationCalc';
import type { AggregationSource } from '../../../constants/aggregationSourceData';

const months = (value: number, at: number): number[] =>
  Array.from({ length: 12 }, (_, i) => (i === at ? value : 0));

// 10月（index 9）にだけ値がある最小のソース。
// 社外売上高 = 100 × 10 × 20 = 20,000 / 納品金額 = 80 × 10 × 20 = 16,000
// 量経追加口 = 20,000 × 0.10 = 2,000 / 条件口 = 5 × 10 × 20 = 1,000
// 売上原価 = 60 × 10 × 20 = 12,000
const SOURCE: AggregationSource = {
  products: [
    {
      metaBrand: '三ツ矢',
      capacity: 'PET・ボトル缶500',
      isPB: false,
      quantity: 10,
      funcByMonth: months(20, 9),
      extUnitPrice: 100,
      deliveryPrice: 80,
      costUnitPriceTransfer: 60,
      conditionUnitPrice: 5,
      volumeAddRate: 0.1,
    },
  ],
  expenses: [
    {
      metaBrand: '三ツ矢',
      capacity: 'PET・ボトル缶500',
      category: '売上連動拡売費A口',
      amountByTargetMonth: months(1000, 9),
      amountByPostingMonth: months(1000, 10),
    },
    {
      metaBrand: '三ツ矢',
      capacity: 'PET・ボトル缶500',
      category: '売上連動拡売費B口',
      amountByTargetMonth: months(500, 9),
      amountByPostingMonth: months(500, 10),
    },
    {
      metaBrand: '三ツ矢',
      capacity: 'PET・ボトル缶500',
      category: '拡売費(固定費)A口',
      amountByTargetMonth: months(300, 9),
      amountByPostingMonth: months(300, 10),
    },
    {
      metaBrand: '三ツ矢',
      capacity: 'PET・ボトル缶500',
      category: 'ロケ補填',
      amountByTargetMonth: months(200, 9),
      amountByPostingMonth: months(200, 10),
    },
    {
      metaBrand: '三ツ矢',
      capacity: 'PET・ボトル缶500',
      category: 'コラム料',
      amountByTargetMonth: months(100, 9),
      amountByPostingMonth: months(100, 10),
    },
  ],
};

// 率を0にした設定＝補足4-1 の3項目を無効化し、素の集計だけを検証する
const NO_RATES = {
  centerFee: { method: '直接入力' as const, includePB: false, value: 0 },
  annualContract: { method: '直接入力' as const, includePB: false, value: 0 },
  incentive: { method: '直接入力' as const, includePB: false, value: 0 },
};

const base = (over = {}) => ({ commonRates: NO_RATES, ...over });

describe('computeMonth（補足3-1 の基本チェーン）', () => {
  it('社外売上高 ＝ 社外売単価 × 入数 × 函数(計画)', () => {
    expect(computeMonth(SOURCE, 10, base()).extSales).toBe(20000);
  });

  it('納品金額 ＝ 納価 × 入数 × 函数(計画)', () => {
    expect(computeMonth(SOURCE, 10, base()).deliveryAmount).toBe(16000);
  });

  it('条件口 ＝ 条件口単価 × 入数 × 函数(計画)', () => {
    expect(computeMonth(SOURCE, 10, base()).condition).toBe(1000);
  });

  it('量経追加口 ＝ 社外売上高 × 量経追加口率', () => {
    expect(computeMonth(SOURCE, 10, base()).volumeAdd).toBeCloseTo(2000, 6);
  });

  it('売上高 ＝ 社外売上高 − 量経追加口 − 条件口', () => {
    expect(computeMonth(SOURCE, 10, base()).sales).toBeCloseTo(17000, 6);
  });

  it('売上総利益 ＝ 売上高 − 売上原価', () => {
    const a = computeMonth(SOURCE, 10, base());
    expect(a.cost).toBe(12000);
    expect(a.netProfit).toBeCloseTo(5000, 6);
  });

  it('変動費 ＝ センターフィ ＋ ロケ補填', () => {
    const a = computeMonth(SOURCE, 10, base());
    expect(a.centerFee).toBe(0); // 率を0にしているため
    expect(a.locFill).toBe(200);
    expect(a.variableCost).toBeCloseTo(200, 6);
  });

  it('売買差益 ＝ 売上総利益 − 変動費', () => {
    expect(computeMonth(SOURCE, 10, base()).tradeProfit).toBeCloseTo(4800, 6);
  });

  it('直接固定費 ＝ 拡売費(固定費) ＋ 自販機関係費', () => {
    const a = computeMonth(SOURCE, 10, base());
    expect(a.fixed).toBe(300);
    expect(a.vendingRelated).toBe(100);
    expect(a.directFixed).toBe(400);
  });

  it('管理利益 ＝ 売買差益 − 直接固定費', () => {
    expect(computeMonth(SOURCE, 10, base()).mgmtProfit).toBeCloseTo(4400, 6);
  });

  it('拡売費 ＝ 売上連動拡売費 ＋ 直接固定費', () => {
    const a = computeMonth(SOURCE, 10, base());
    expect(a.salesLinked).toBe(1500);
    expect(a.promo).toBe(1900);
  });

  it('値の無い月は全項目0になる', () => {
    expect(computeMonth(SOURCE, 1, base()).extSales).toBe(0);
    expect(computeMonth(SOURCE, 1, base()).func).toBe(0);
  });
});

// 売上高単価 ＝ (社外売上高 − 量経追加口) ÷ Σ函数（量経追加口だけを控除した函単価）。
// 10/16 手売りセッション 決定事項15 と ASD のコメントに合わせ、
// 計算式一覧（補足3-1 item4）の「社外売上高 ÷ Σ(入数×函数)」から改めた。
// SOURCE（quantity=10, func=20, extUnitPrice=100, 量経追加口率=10%）では
//   (20,000 − 2,000) / 20 = 900
describe('売上高単価（(社外売上高 − 量経追加口) ÷ 函数）', () => {
  it('(社外売上高 − 量経追加口) ÷ Σ函数 になる', () => {
    const a = computeMonth(SOURCE, 10, base());
    // 旧式（社外売上高 ÷ Σ(入数×函数)）なら 20000/(10×20)=100 になっていた
    expect(a.salesUnitPrice).toBeCloseTo(900, 6);
  });

  it('複数商品では函数の合計で割る（入数で重み付けしない）', () => {
    const months20 = (value: number, at: number): number[] =>
      Array.from({ length: 12 }, (_, i) => (i === at ? value : 0));
    // 商品A：入数5・函数10・社外売単価200 → 社外売上高=10,000
    // 商品B：入数20・函数10・社外売単価50  → 社外売上高=10,000
    // 量経追加口=0 / 社外売上高 計=20,000 / Σ函数=20 → 売上高単価=1,000
    // （旧式の Σ(入数×函数)=250 で割ると 80 になり一致しない）
    const source: AggregationSource = {
      products: [
        {
          metaBrand: '三ツ矢',
          capacity: 'PET・ボトル缶500',
          isPB: false,
          quantity: 5,
          funcByMonth: months20(10, 9),
          extUnitPrice: 200,
          deliveryPrice: 0,
          costUnitPriceTransfer: 0,
          conditionUnitPrice: 0,
          volumeAddRate: 0,
        },
        {
          metaBrand: '三ツ矢',
          capacity: 'PET・ボトル缶500',
          isPB: false,
          quantity: 20,
          funcByMonth: months20(10, 9),
          extUnitPrice: 50,
          deliveryPrice: 0,
          costUnitPriceTransfer: 0,
          conditionUnitPrice: 0,
          volumeAddRate: 0,
        },
      ],
      expenses: [],
    };
    const a = computeMonth(source, 10, base());
    expect(a.extSales).toBe(20000);
    expect(a.salesUnitPrice).toBe(1000);
  });

  it('商品が無い（分母0）ときは0になる', () => {
    expect(computeMonth(SOURCE, 1, base()).salesUnitPrice).toBe(0);
  });
});

describe('A口のみ集計（補足4-1 集計表反映先の条件指定）', () => {
  it('チェックありでは A口の2費目だけを集計する', () => {
    const a = computeMonth(SOURCE, 10, base({ aOnlyPromo: true }));
    expect(a.salesLinkedA).toBe(1000);
    expect(a.salesLinkedB).toBe(0);
    expect(a.salesLinkedH).toBe(0);
    expect(a.fixedA).toBe(300);
    expect(a.salesLinked).toBe(1000);
  });

  it('チェックありではロケ補填・自販機関係費も集計対象から外す', () => {
    const a = computeMonth(SOURCE, 10, base({ aOnlyPromo: true }));
    expect(a.locFill).toBe(0);
    expect(a.vendingRelated).toBe(0);
  });

  it('チェックなしでは全費目を集計する', () => {
    const a = computeMonth(SOURCE, 10, base({ aOnlyPromo: false }));
    expect(a.salesLinked).toBe(1500);
    expect(a.locFill).toBe(200);
    expect(a.vendingRelated).toBe(100);
  });
});

describe('拡売費集計対象選択（対象月／計上月）', () => {
  it('対象月基準では10月に拡売費が載る', () => {
    const a = computeMonth(SOURCE, 10, base({ expenseMonthBasis: 'target' }));
    expect(a.salesLinked).toBe(1500);
    expect(
      computeMonth(SOURCE, 11, base({ expenseMonthBasis: 'target' }))
        .salesLinked
    ).toBe(0);
  });

  it('計上月基準では11月に拡売費が載る', () => {
    const a = computeMonth(SOURCE, 11, base({ expenseMonthBasis: 'posting' }));
    expect(a.salesLinked).toBe(1500);
    expect(
      computeMonth(SOURCE, 10, base({ expenseMonthBasis: 'posting' }))
        .salesLinked
    ).toBe(0);
  });

  it('基準を切り替えても商品側（社外売上高）は変わらない', () => {
    const target = computeMonth(
      SOURCE,
      10,
      base({ expenseMonthBasis: 'target' })
    );
    const posting = computeMonth(
      SOURCE,
      10,
      base({ expenseMonthBasis: 'posting' })
    );
    expect(posting.extSales).toBe(target.extSales);
  });

  it('未指定時は対象月基準を既定にする', () => {
    expect(computeMonth(SOURCE, 10, base()).salesLinked).toBe(1500);
  });
});

describe('原価軸（新_補足2-3）', () => {
  it('支社受渡原価では売上原価がマスタ値どおり', () => {
    expect(computeMonth(SOURCE, 10, base({ costAxis: 'transfer' })).cost).toBe(
      12000
    );
  });

  it('実原価では売上原価が支社受渡原価より小さくなる', () => {
    const actual = computeMonth(SOURCE, 10, base({ costAxis: 'actual' })).cost;
    expect(actual).toBeLessThan(12000);
    expect(actual).toBeGreaterThan(0);
  });

  it('原価軸を変えると管理利益も連動して変わる', () => {
    const transfer = computeMonth(SOURCE, 10, base({ costAxis: 'transfer' }));
    const actual = computeMonth(SOURCE, 10, base({ costAxis: 'actual' }));
    expect(actual.mgmtProfit).toBeGreaterThan(transfer.mgmtProfit);
  });
});

describe('補足4-1 の3項目の反映', () => {
  const rates = {
    // センターフィ ＝ 社外売上高 20,000 × 指数1 × 10% ＝ 2,000
    centerFee: {
      method: '社外売上高' as const,
      includePB: false,
      index: 1,
      value: 0.1,
    },
    // 年契基本分 ＝ 20,000 × 5% ＝ 1,000
    annualContract: {
      method: '社外売上高' as const,
      includePB: false,
      index: 1,
      value: 0.05,
    },
    // 取組強化マージン率 ＝ 20,000 × 2% ＝ 400
    incentive: {
      method: '社外売上高' as const,
      includePB: false,
      index: 1,
      value: 0.02,
    },
  };

  it('センターフィが変動費へ反映される', () => {
    const a = computeMonth(SOURCE, 10, { commonRates: rates });
    expect(a.centerFee).toBeCloseTo(2000, 6);
    expect(a.variableCost).toBeCloseTo(2200, 6); // センターフィ2,000 ＋ ロケ補填200
  });

  it('A口のみ未チェック時、年契基本分・取組強化マージン率が売上連動拡売費へ加算される', () => {
    const a = computeMonth(SOURCE, 10, {
      commonRates: rates,
      aOnlyPromo: false,
    });
    // グリッド由来 1,500 ＋ 年契基本分 1,000 ＋ 取組強化 400
    expect(a.salesLinked).toBeCloseTo(2900, 6);
  });

  it('取組強化マージン率はB口へ、年契基本分はグリッド由来金額で口別按分される', () => {
    const a = computeMonth(SOURCE, 10, {
      commonRates: rates,
      aOnlyPromo: false,
    });
    // 年契基本分 1,000 を グリッド由来 A口1,000 : B口500 : 本社口0 で按分
    //   A口 ＝ 1,000 ＋ 1,000×(1,000/1,500) ＝ 1,666.67
    //   B口 ＝ 500 ＋ 取組強化400 ＋ 1,000×(500/1,500) ＝ 1,233.33
    //   本社口 ＝ 0（グリッド由来0のため按分もされない）
    expect(a.salesLinkedA).toBeCloseTo(1666.6666667, 6);
    expect(a.salesLinkedB).toBeCloseTo(1233.3333333, 6);
    expect(a.salesLinkedH).toBe(0);
  });

  it('3口ともグリッド由来が0のときは年契基本分の全額がB口へ入る', () => {
    const noGridPromo: AggregationSource = {
      ...SOURCE,
      expenses: SOURCE.expenses.filter(
        (e) => !e.category.startsWith('売上連動拡売費')
      ),
    };
    const a = computeMonth(noGridPromo, 10, {
      commonRates: rates,
      aOnlyPromo: false,
    });
    expect(a.salesLinkedA).toBe(0);
    expect(a.salesLinkedH).toBe(0);
    // 年契基本分 1,000 ＋ 取組強化 400
    expect(a.salesLinkedB).toBeCloseTo(1400, 6);
  });

  it('A口のみチェック時、両方ともB口扱いのため売上連動拡売費に含まれない', () => {
    const a = computeMonth(SOURCE, 10, {
      commonRates: rates,
      aOnlyPromo: true,
    });
    expect(a.salesLinked).toBe(1000); // A口のみ
    // A口も年契基本分の按分を受け取らない
    expect(a.salesLinkedA).toBe(1000);
    expect(a.salesLinkedB).toBe(0);
    expect(a.salesLinkedH).toBe(0);
  });

  it('売上連動拡売費の計は常に口別3項目の合算と一致する', () => {
    for (const aOnlyPromo of [false, true]) {
      const a = computeMonth(SOURCE, 10, { commonRates: rates, aOnlyPromo });
      expect(a.salesLinkedA + a.salesLinkedB + a.salesLinkedH).toBe(
        a.salesLinked
      );
    }
  });

  it('納品金額から算出する場合は納品金額を分母にし、指数を乗じない', () => {
    const a = computeMonth(SOURCE, 10, {
      commonRates: {
        ...rates,
        // 納品金額 16,000 × 10% ＝ 1,600（社外売上高2,000でも指数倍8,000でもない）
        centerFee: {
          method: '納品金額' as const,
          includePB: false,
          index: 5,
          value: 0.1,
        },
      },
    });
    expect(a.centerFee).toBeCloseTo(1600, 6);
  });

  it('納品金額でPB商品を含む設定ではPB分も分母に入る', () => {
    const withPB: AggregationSource = {
      ...SOURCE,
      products: [
        ...SOURCE.products,
        { ...SOURCE.products[0], metaBrand: 'PB', isPB: true },
      ],
    };
    const a = computeMonth(withPB, 10, {
      commonRates: {
        ...rates,
        // 納品金額 16,000 × 2 × 10% ＝ 3,200
        centerFee: {
          method: '納品金額' as const,
          includePB: true,
          value: 0.1,
        },
      },
    });
    expect(a.centerFee).toBeCloseTo(3200, 6);
  });

  it('金額を AggAmounts に記録する（ツールチップ・検証用）', () => {
    const a = computeMonth(SOURCE, 10, { commonRates: rates });
    expect(a.annualContractAmount).toBeCloseTo(1000, 6);
    expect(a.incentiveAmount).toBeCloseTo(400, 6);
  });

  // Minor 7 回帰テスト：年契基本分・取組強化マージンは「A口のみ」☑時に反映先の
  // 売上連動拡売費B口ごと集計対象外になる（実質どこにも反映されない）。
  // AggAmounts.annualContractAmount／incentiveAmount は算出値そのままではなく、
  // 実際に反映された額（＝0）を返さなければ、画面に出ない値を報告してしまう。
  it('A口のみチェック時は annualContractAmount／incentiveAmount も0を報告する', () => {
    const a = computeMonth(SOURCE, 10, {
      commonRates: rates,
      aOnlyPromo: true,
    });
    expect(a.annualContractAmount).toBe(0);
    expect(a.incentiveAmount).toBe(0);
  });

  it('PB商品を除く設定ではPB商品の社外売上高を分母から外す', () => {
    const withPB: AggregationSource = {
      ...SOURCE,
      products: [
        ...SOURCE.products,
        { ...SOURCE.products[0], metaBrand: 'PB', isPB: true },
      ],
    };
    const excluded = computeMonth(withPB, 10, {
      commonRates: {
        ...rates,
        centerFee: { ...rates.centerFee, includePB: false },
      },
    });
    const included = computeMonth(withPB, 10, {
      commonRates: {
        ...rates,
        centerFee: { ...rates.centerFee, includePB: true },
      },
    });
    expect(included.centerFee).toBeGreaterThan(excluded.centerFee);
  });
});

describe('集計対象選択（集計単位①×②・除外ペア）', () => {
  it('メタブランドで絞り込むと対象外の商品が集計されない', () => {
    expect(
      computeMonth(SOURCE, 10, base({ metaBrands: ['ワンダ'] })).extSales
    ).toBe(0);
    expect(
      computeMonth(SOURCE, 10, base({ metaBrands: ['三ツ矢'] })).extSales
    ).toBe(20000);
  });

  it('容器容量Gで絞り込める', () => {
    expect(
      computeMonth(SOURCE, 10, base({ capacities: ['PET1.5'] })).extSales
    ).toBe(0);
  });

  it('除外ペアに一致する組合せは集計されない', () => {
    const filter = base({
      excludePairs: [{ brand: '三ツ矢', capacity: 'PET・ボトル缶500' }],
    });
    expect(computeMonth(SOURCE, 10, filter).extSales).toBe(0);
  });

  it('絞り込みは拡売費にも効く', () => {
    expect(
      computeMonth(SOURCE, 10, base({ metaBrands: ['ワンダ'] })).salesLinked
    ).toBe(0);
  });
});

describe('期間集計', () => {
  it('年間は12か月の合計になる', () => {
    expect(
      computeMonthsRange(SOURCE, [...Array(12).keys()], base()).extSales
    ).toBe(20000);
  });

  it('累計は1月〜対象月の合計になる', () => {
    const periods = computePeriods(SOURCE, 10, base());
    expect(periods.monthly.extSales).toBe(20000);
    expect(periods.cumulative.extSales).toBe(20000);
    expect(periods.yearly.extSales).toBe(20000);
  });

  it('対象月より前の累計には10月分が入らない', () => {
    expect(computePeriods(SOURCE, 9, base()).cumulative.extSales).toBe(0);
  });
});

describe('集計単位の一覧と行列', () => {
  it('ソースに存在する集計単位だけを返す', () => {
    expect(listMetaBrands(SOURCE)).toEqual(['三ツ矢']);
    expect(listCapacities(SOURCE, '三ツ矢')).toEqual(['PET・ボトル缶500']);
  });

  it('合計行＋メタブランド行＋容器容量G行を返す', () => {
    const rows = computeUnitMatrix(SOURCE, [9], base());
    expect(rows[0].level).toBe(0);
    expect(rows[0].label).toBe('合計');
    expect(rows.some((r) => r.level === 1 && r.label === '三ツ矢')).toBe(true);
    expect(rows.some((r) => r.level === 2)).toBe(true);
  });

  it('空のソースでも例外を投げず合計行のみ返す', () => {
    const rows = computeUnitMatrix({ products: [], expenses: [] }, [9], base());
    expect(rows).toHaveLength(1);
    expect(rows[0].amounts.extSales).toBe(0);
  });
});

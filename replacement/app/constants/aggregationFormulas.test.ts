import { describe, it, expect } from 'vitest';
import { formulaTokens } from '@/app/components/grid/gridCommon';
import { flattenAllTreeNodes } from '@/app/utils/sales-plan/common/aggregationTree';
import {
  AGGREGATION_FORMULAS,
  AGG_RATIO_FORMULAS,
} from './aggregationFormulas';

const allKeys = new Set(flattenAllTreeNodes().map((r) => r.key));

describe('flattenAllTreeNodes', () => {
  it('可視性に関係なく全ノードを返す（× の条件口も含む）', () => {
    expect(allKeys.has('condition')).toBe(true);
    expect(allKeys.has('volumeAdd.cfAmount')).toBe(true);
  });

  it('key / label / itemId だけを返す（表示用の行ではない）', () => {
    // 先頭ノード（func）は itemId を持つため、フィールド構成を確実に検査できる。
    const node = flattenAllTreeNodes()[0];
    expect(Object.keys(node).sort()).toEqual(['itemId', 'key', 'label']);
  });
});

describe('AGGREGATION_FORMULAS', () => {
  it('キーはすべて実在するツリーノードキーである', () => {
    for (const key of Object.keys(AGGREGATION_FORMULAS)) {
      expect(allKeys.has(key), `未知のノードキー: ${key}`).toBe(true);
    }
  });

  it('refKeys はすべて実在するツリーノードキーである', () => {
    for (const [key, f] of Object.entries(AGGREGATION_FORMULAS)) {
      for (const ref of f.refKeys) {
        expect(allKeys.has(ref), `${key} の未知の参照: ${ref}`).toBe(true);
      }
    }
  });

  it('テンプレート中の {token} と refKeys が一致する', () => {
    for (const [key, f] of Object.entries(AGGREGATION_FORMULAS)) {
      const tokens = [...new Set(formulaTokens(f.template))].sort();
      expect(tokens, `${key} のトークンと refKeys がずれている`).toEqual(
        [...f.refKeys].sort()
      );
    }
  });

  it('自分自身を参照しない', () => {
    for (const [key, f] of Object.entries(AGGREGATION_FORMULAS)) {
      expect(f.refKeys, `${key} が自己参照している`).not.toContain(key);
    }
  });

  it('画面外の算出元を持つ式は valueLine を false にしている', () => {
    // {token} が1つも無い式は実値行を出せないため valueLine: false であること。
    for (const [key, f] of Object.entries(AGGREGATION_FORMULAS)) {
      if (formulaTokens(f.template).length === 0) {
        expect(f.valueLine, `${key} は valueLine: false にすべき`).toBe(false);
      }
    }
  });

  it('主要項目の式が補足3-1どおりである', () => {
    expect(AGGREGATION_FORMULAS['sales'].template).toBe(
      '{externalSales} − {volumeAdd} − {condition}'
    );
    expect(AGGREGATION_FORMULAS['mgmtProfit'].template).toBe(
      '{tradeProfit} − {promoFixed}'
    );
    expect(AGGREGATION_FORMULAS['promoTotal'].template).toBe(
      '{promoLinked} + {promoFixed}'
    );
  });
});

describe('AGG_RATIO_FORMULAS', () => {
  it('予算比・予算差・前年比・前年差の4つを持つ', () => {
    expect(Object.keys(AGG_RATIO_FORMULAS).sort()).toEqual([
      'budgetDiff',
      'budgetRate',
      'prevYearDiff',
      'yoy',
    ]);
  });

  it('列キーをトークンとして参照する', () => {
    expect(AGG_RATIO_FORMULAS.budgetRate.template).toBe(
      '{plan} ÷ {budget} × 100%'
    );
    expect(AGG_RATIO_FORMULAS.prevYearDiff.template).toBe(
      '{plan} − {prevYear}'
    );
  });
});

// 補足3-1「計画詳細の集計の項目一覧」の計算式（L列）どおりであることを固定する。
// 資料の式 → テンプレートの対応が崩れたら気づけるようにする。
describe('AGGREGATION_FORMULAS が補足3-1 の計算式どおりである', () => {
  const cases: [string, string][] = [
    // No.2 売上高＝社外売上高-量経追加口-条件口
    ['sales', '{externalSales} − {volumeAdd} − {condition}'],
    // No.7 量経追加口 率＝量経追加口/社外売上高*100%
    ['volumeAdd.rate', '{volumeAdd} ÷ {externalSales} × 100%'],
    // No.8 CF込金額＝量経追加口(金額)+センターフィ
    ['volumeAdd.cfAmount', '{volumeAdd} + {variableCost.centerFee}'],
    // No.9 CF込率＝{量経追加口(金額)+センターフィ}/社外売上高*100%
    [
      'volumeAdd.cfRate',
      '({volumeAdd} + {variableCost.centerFee}) ÷ {externalSales} × 100%',
    ],
    // No.10 拡売費＝売上連動拡売費+直接固定費
    ['promoTotal', '{promoLinked} + {promoFixed}'],
    // No.16 直接固定費＝拡売費(固定費)+自販機関連費
    ['promoFixed', '{promoFixed.expense} + {promoFixed.vending}'],
    // No.26 売上原価 率＝売上原価(金額)/社外売上高*100%
    ['cost.rate', '{cost} ÷ {externalSales} × 100%'],
    // No.27 売上総利益＝売上高-売上原価(金額)
    ['grossProfit', '{sales} − {cost}'],
    // No.28 売上総利益 率＝売上総利益(金額)/売上高*100%
    ['grossProfit.rate', '{grossProfit} ÷ {sales} × 100%'],
    // No.29 変動費＝センターフィ+ロケ補填
    [
      'variableCost',
      '{variableCost.centerFee} + {variableCost.locationSupport}',
    ],
    // No.32 売買差益＝売上総利益(金額)-変動費
    ['tradeProfit', '{grossProfit} − {variableCost}'],
    // No.33/34 売買差益 率・函単価
    ['tradeProfit.rate', '{tradeProfit} ÷ {sales} × 100%'],
    ['tradeProfit.unitPrice', '{tradeProfit} ÷ {func}'],
    // No.35 管理利益＝売買差益(金額)-直接固定費
    ['mgmtProfit', '{tradeProfit} − {promoFixed}'],
    // No.36/37 管理利益 率・函単価
    ['mgmtProfit.rate', '{mgmtProfit} ÷ {sales} × 100%'],
    ['mgmtProfit.unitPrice', '{mgmtProfit} ÷ {func}'],
    // No.38/39 売上値引＝量経追加口+売上連動拡売費（率どうしは率で加算）
    ['salesDiscount', '{volumeAdd} + {promoLinked}'],
    ['salesDiscount.rate', '{volumeAdd.rate} + {promoLinked.rate}'],
  ];

  it.each(cases)('%s', (key, template) => {
    expect(AGGREGATION_FORMULAS[key].template).toBe(template);
  });

  it('売上高単価は (社外売上高 − 量経追加口) ÷ 函数（10/16 手売りセッション 決定事項15）', () => {
    // 社外売上高・量経追加口・函数の行から算出するため、それらの行をハイライトする。
    expect(AGGREGATION_FORMULAS.salesUnitPrice.template).toBe(
      '({externalSales} − {volumeAdd}) ÷ {func}'
    );
    expect(AGGREGATION_FORMULAS.salesUnitPrice.refKeys).toEqual([
      'externalSales',
      'volumeAdd',
      'func',
    ]);
  });

  it('売上連動拡売費はA口+B口+本社口の集計（No.11。年契基本分はB口へ反映：補足4-1）', () => {
    expect(AGGREGATION_FORMULAS.promoLinked.template).toContain(
      '売上連動拡売費A口 + B口 + 本社口 の集計'
    );
  });
});

// 集計表の計算式マスタ ─ 補足資料「補足3-1.計画詳細の集計の項目一覧」
//
// キーは aggregationTree.ts の AggTreeNode.key。
// template の `{key}` は同じ列にある別項目行を指し、クリック時にハイライトされる。
// 素のテキストは画面外の算出元（明細表・拡売費計画タブ・マスタ）で、実値行を出せないため
// valueLine: false を指定する。
//
// 参照先は原則として親ノードのキー（常時表示され、`.amount` の子と同値）を指す。
// 率どうしの加算（salesDiscount.rate）のように親に相当が無いものだけ `.rate` の子を指す。
// 集計値の算出元は販売計画(詳細)・拡売費計画のグリッド行（utils/sales-plan/plan-detail/planGridToAggregation・
// utils/sales-plan/plan-detail/expenseGridToAggregation が集計ソースへ変換する）。
import type { AggFormula } from '@/app/types/aggregation';

// 画面外の算出元だけで構成される式（実値行なし・ハイライトなし）。
const external = (template: string): AggFormula => ({
  template,
  valueLine: false,
  refKeys: [],
});

export const AGGREGATION_FORMULAS: Record<string, AggFormula> = {
  func: external('函数の計画 の集計'),

  sales: {
    template: '{externalSales} − {volumeAdd} − {condition}',
    refKeys: ['externalSales', 'volumeAdd', 'condition'],
  },
  externalSales: external('社外売単価 × 入数 × 函数(計画) の集計'),
  salesUnitPrice: {
    template: '({externalSales} − {volumeAdd}) ÷ {func}',
    refKeys: ['externalSales', 'volumeAdd', 'func'],
  },
  condition: external('条件口単価(補足4-2) × 入数 × 函数(計画) の集計'),

  volumeAdd: external('[マスタ]量経追加口(金額)'),
  'volumeAdd.amount': external('[マスタ]量経追加口(金額)'),
  'volumeAdd.rate': {
    template: '{volumeAdd} ÷ {externalSales} × 100%',
    refKeys: ['volumeAdd', 'externalSales'],
  },
  'volumeAdd.cfAmount': {
    template: '{volumeAdd} + {variableCost.centerFee}',
    refKeys: ['volumeAdd', 'variableCost.centerFee'],
  },
  'volumeAdd.cfRate': {
    template:
      '({volumeAdd} + {variableCost.centerFee}) ÷ {externalSales} × 100%',
    refKeys: ['volumeAdd', 'variableCost.centerFee', 'externalSales'],
  },

  promoTotal: {
    template: '{promoLinked} + {promoFixed}',
    refKeys: ['promoLinked', 'promoFixed'],
  },
  promoLinked: external(
    '売上連動拡売費A口 + B口 + 本社口 の集計 + 年契基本分 + 取組強化マージン（補足4-1）'
  ),
  'promoLinked.amount': external(
    '売上連動拡売費A口 + B口 + 本社口 の集計 + 年契基本分 + 取組強化マージン（補足4-1）'
  ),
  'promoLinked.rate': {
    template: '{promoLinked} ÷ {externalSales} × 100%',
    refKeys: ['promoLinked', 'externalSales'],
  },
  promoFixed: {
    template: '{promoFixed.expense} + {promoFixed.vending}',
    refKeys: ['promoFixed.expense', 'promoFixed.vending'],
  },
  'promoFixed.expense': external('拡売費(固定費)A口 + B口 + 本社口 の集計'),
  'promoFixed.vending': external(
    '拡売費計画の管理区分がコラム料・リース料・販売器具費の対象 の集計'
  ),

  cost: external('売上原価単価(補足2-3の原価軸) × 入数 × 函数(計画) の集計'),
  'cost.amount': external(
    '売上原価単価(補足2-3の原価軸) × 入数 × 函数(計画) の集計'
  ),
  'cost.rate': {
    template: '{cost} ÷ {externalSales} × 100%',
    refKeys: ['cost', 'externalSales'],
  },

  grossProfit: {
    template: '{sales} − {cost}',
    refKeys: ['sales', 'cost'],
  },
  'grossProfit.amount': {
    template: '{sales} − {cost}',
    refKeys: ['sales', 'cost'],
  },
  'grossProfit.rate': {
    template: '{grossProfit} ÷ {sales} × 100%',
    refKeys: ['grossProfit', 'sales'],
  },

  variableCost: {
    template: '{variableCost.centerFee} + {variableCost.locationSupport}',
    refKeys: ['variableCost.centerFee', 'variableCost.locationSupport'],
  },
  'variableCost.centerFee': external(
    'センターフィ率の設定に基づく集計（補足4-1）'
  ),
  'variableCost.locationSupport': external(
    '拡売費計画の管理区分がロケ補填の対象 の集計'
  ),

  tradeProfit: {
    template: '{grossProfit} − {variableCost}',
    refKeys: ['grossProfit', 'variableCost'],
  },
  'tradeProfit.amount': {
    template: '{grossProfit} − {variableCost}',
    refKeys: ['grossProfit', 'variableCost'],
  },
  'tradeProfit.rate': {
    template: '{tradeProfit} ÷ {sales} × 100%',
    refKeys: ['tradeProfit', 'sales'],
  },
  'tradeProfit.unitPrice': {
    template: '{tradeProfit} ÷ {func}',
    refKeys: ['tradeProfit', 'func'],
  },

  mgmtProfit: {
    template: '{tradeProfit} − {promoFixed}',
    refKeys: ['tradeProfit', 'promoFixed'],
  },
  'mgmtProfit.amount': {
    template: '{tradeProfit} − {promoFixed}',
    refKeys: ['tradeProfit', 'promoFixed'],
  },
  'mgmtProfit.rate': {
    template: '{mgmtProfit} ÷ {sales} × 100%',
    refKeys: ['mgmtProfit', 'sales'],
  },
  'mgmtProfit.unitPrice': {
    template: '{mgmtProfit} ÷ {func}',
    refKeys: ['mgmtProfit', 'func'],
  },

  salesDiscount: {
    template: '{volumeAdd} + {promoLinked}',
    refKeys: ['volumeAdd', 'promoLinked'],
  },
  'salesDiscount.amount': {
    template: '{volumeAdd} + {promoLinked}',
    refKeys: ['volumeAdd', 'promoLinked'],
  },
  'salesDiscount.rate': {
    template: '{volumeAdd.rate} + {promoLinked.rate}',
    refKeys: ['volumeAdd.rate', 'promoLinked.rate'],
  },

  delivery: external('納価(計画) × 入数 × 函数(計画) の集計'),
};

// 比率・差分列の計算式（同一行の別列を参照する）。トークンは列キー。
// 予算・前年の金額列は設定値／実績値であり算出セルではないため定義しない（補足3-1 AD列・AY列）。
export const AGG_RATIO_FORMULAS: Record<
  'budgetRate' | 'budgetDiff' | 'yoy' | 'prevYearDiff',
  AggFormula
> = {
  budgetRate: {
    template: '{plan} ÷ {budget} × 100%',
    refKeys: ['plan', 'budget'],
  },
  budgetDiff: { template: '{plan} − {budget}', refKeys: ['plan', 'budget'] },
  yoy: {
    template: '{plan} ÷ {prevYear} × 100%',
    refKeys: ['plan', 'prevYear'],
  },
  prevYearDiff: {
    template: '{plan} − {prevYear}',
    refKeys: ['plan', 'prevYear'],
  },
};

// 列キー → 見出し（比率・差分列のツールチップ1行目に使う）。
export const AGG_COLUMN_LABELS: Record<string, string> = {
  plan: '計画金額',
  budget: '予算金額',
  prevYear: '前年実績金額',
};

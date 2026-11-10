// 支払情報サマリの集計関数の単体テスト（小さな明細で式どおりになることを確かめる）。
// 画面のモック明細（全支払回数）での集計は paymentDetailAggregates.test.ts で確かめる。
import { describe, it, expect } from 'vitest';
import {
  aggregateSummaryDetails,
  effectiveExpensePayAmount,
  fillSummaryRowValues,
  NET_UNAPPROVED_MGMT_CLASS_NAME,
  netUnapprovedByProduct,
  payCaseEquivalentOf,
  summaryPayValuesOf,
  totalSplitOut,
  type SummaryDetailTotals,
  type SummaryEntryRow,
  type SummaryExpenseRow,
} from './paymentSummaryAggregate';

// 追加口明細1行（集計に使う項目だけ）。
const entry = (fields: Partial<SummaryEntryRow>): SummaryEntryRow => ({
  capacity: 24,
  payCases: 0,
  payLoose: 0,
  addAmount: 0,
  payAmount: 0,
  expAmount: 0,
  funcCheck: false,
  ...fields,
});

// 拡売費明細1行（集計に使う項目だけ）。
const expense = (fields: Partial<SummaryExpenseRow>): SummaryExpenseRow => ({
  payAmount: 0,
  ...fields,
});

describe('payCaseEquivalentOf', () => {
  it('支払ケース＋支払バラ÷入数', () => {
    expect(
      payCaseEquivalentOf(entry({ capacity: 24, payCases: 10, payLoose: 12 }))
    ).toBe(10.5);
  });

  it('空欄は0、入数が無ければバラは数えない', () => {
    expect(
      payCaseEquivalentOf(entry({ capacity: '', payCases: '', payLoose: 5 }))
    ).toBe(0);
  });
});

describe('aggregateSummaryDetails（請求書有）', () => {
  const round = () => ({
    entryRows: [
      entry({
        productName: 'A',
        payCases: 10,
        payLoose: 12,
        addAmount: 1000,
        expAmount: 300,
      }),
      entry({ productName: 'B', payCases: 5, addAmount: 500 }),
      // 函数無効チェックを付けた明細は支払函数に含めない（追加口金額には含める）。
      entry({ productName: 'C', payCases: 7, addAmount: 70, funcCheck: true }),
      entry({ isTotal: true, payCases: 999, addAmount: 999 }),
    ],
    expenseRows: [
      expense({ isGroup: true, product: '未承認NET拡売費合計', payAmount: 9 }),
      expense({
        isNetUnapproved: true,
        product: 'A',
        payAmount: 1,
        mgmtClass: NET_UNAPPROVED_MGMT_CLASS_NAME,
      }),
      expense({ payAmount: 200, mgmtClass: '売上連動拡売費A口' }),
      // 枝番行（分割先）は親の内訳のため含めない。
      expense({ costSplit: '分割先', payAmount: 50 }),
      // 支払金額が空欄なら請求金額を初期値とする。
      expense({ payAmount: '', billAmount: 80 }),
    ],
  });

  it('支払函数・追加口金額・拡売費（NET未承認／NET未承認以外）を明細から求める', () => {
    expect(aggregateSummaryDetails([round()], 'with-invoice')).toEqual({
      payFunc: 16, // 10.5＋5 → 小数第1位を四捨五入
      addEntryAmount: 1570,
      promoNetUnapproved: 300, // 未承認NETの明細は追加口明細の拡売費金額を参照する
      promoLinked: 280,
    });
  });

  it('全支払回数を合計し、明細0件の回は0として数える', () => {
    expect(
      aggregateSummaryDetails(
        [round(), round(), { entryRows: [], expenseRows: [] }],
        'with-invoice'
      )
    ).toEqual({
      payFunc: 31, // 15.5×2＝31
      addEntryAmount: 3140,
      promoNetUnapproved: 600,
      promoLinked: 560,
    });
  });

  it('未承認NETで管理区分を変えた明細は、保存前でも拡売費（NET未承認以外）へ入れる', () => {
    const r = round();
    (r.expenseRows[1] as SummaryExpenseRow).mgmtClass = '売上連動拡売費A口';
    const v = aggregateSummaryDetails([r], 'with-invoice');
    expect(v.promoNetUnapproved).toBe(0);
    expect(v.promoLinked).toBe(580);
  });

  it('その他の明細を値引き（売上連動）に変えても、保存までは拡売費（NET未承認以外）のまま', () => {
    const r = round();
    (r.expenseRows[2] as SummaryExpenseRow).mgmtClass =
      NET_UNAPPROVED_MGMT_CLASS_NAME;
    const v = aggregateSummaryDetails([r], 'with-invoice');
    expect(v.promoNetUnapproved).toBe(300);
    expect(v.promoLinked).toBe(280);
  });

  it('未承認NETの明細がまだ無いサマリ商品の拡売費金額（NET未承認）も NET未承認に入れる', () => {
    const r = round();
    (r.entryRows[1] as SummaryEntryRow).expAmount = 40; // 商品B（未承認NETの明細なし）
    expect(
      aggregateSummaryDetails([r], 'with-invoice').promoNetUnapproved
    ).toBe(340);
  });
});

describe('aggregateSummaryDetails（請求書無）', () => {
  it('追加口金額は支払金額の合計、拡売費は全明細を拡売費（NET未承認以外）へ入れる', () => {
    const v = aggregateSummaryDetails(
      [
        {
          entryRows: [
            entry({ payCases: 3, payLoose: 6, addAmount: '', payAmount: 900 }),
          ],
          expenseRows: [
            expense({ payAmount: 120 }),
            expense({ costSplit: '分割先', payAmount: 20 }),
          ],
        },
      ],
      'without-invoice'
    );
    expect(v).toEqual({
      payFunc: 3,
      addEntryAmount: 900,
      promoNetUnapproved: 0,
      promoLinked: 120,
    });
  });
});

describe('effectiveExpensePayAmount', () => {
  it('未承認NETの明細は追加口の同じサマリ商品の拡売費金額を参照する', () => {
    expect(
      effectiveExpensePayAmount(
        {
          isNetUnapproved: true,
          product: 'A',
          payAmount: 92000,
          mgmtClass: NET_UNAPPROVED_MGMT_CLASS_NAME,
        },
        { A: 8640 }
      )
    ).toBe(8640);
  });

  it('手入力した未承認NETの明細と、追加口に無いサマリ商品は明細の値のまま', () => {
    expect(
      effectiveExpensePayAmount(
        {
          isNetUnapproved: true,
          payAmountManual: true,
          product: 'A',
          payAmount: 500,
        },
        { A: 8640 }
      )
    ).toBe(500);
    expect(
      effectiveExpensePayAmount(
        { isNetUnapproved: true, product: 'B', payAmount: 700 },
        { A: 8640 }
      )
    ).toBe(700);
  });

  it('その他の明細で支払金額が空欄なら請求金額を使う', () => {
    expect(effectiveExpensePayAmount({ payAmount: '', billAmount: 1200 })).toBe(
      1200
    );
    expect(effectiveExpensePayAmount({ payAmount: '', billAmount: '' })).toBe(
      0
    );
  });
});

describe('netUnapprovedByProduct', () => {
  it('サマリ商品ごとに拡売費金額（NET未承認）を合計する（合計行は除く）', () => {
    expect(
      netUnapprovedByProduct([
        entry({ productName: 'A', expAmount: 100 }),
        entry({ productName: 'A', expAmount: '50' }),
        entry({ isTotal: true, productName: 'A', expAmount: 999 }),
      ])
    ).toEqual({ A: 150 });
  });
});

describe('totalSplitOut', () => {
  it('支払回数ごとの分割を、その回の追加口明細で金額にして全回分を足す', () => {
    const rows = [
      { lineNo: 1, capacity: 24, payCases: 10, payLoose: 0, addUnit: 70 },
      { lineNo: 2, capacity: 6, payCases: 5, payLoose: 0, addUnit: 100 },
    ];
    const v = totalSplitOut(
      {
        '1': {
          allocations: [
            { lineNo: 1, destId: 'X', cases: 2, loose: 12 },
            { lineNo: 9, destId: 'X', cases: 1, loose: 0 }, // 明細に無い No. は無視
          ],
        },
        '2': { allocations: [{ lineNo: 2, destId: 'X', cases: 1, loose: 3 }] },
      },
      { '1': rows, '2': rows }
    );
    // 2.5ケース→3（四捨五入）＋1.5ケース→2（四捨五入）
    expect(v.caseEquivalent).toBe(5);
    expect(v.addAmount).toBe((2 * 24 + 12) * 70 + (1 * 6 + 3) * 100);
  });
});

// 支払情報サマリの固定値（実販FACT と管理利益額の近似の基準）。値は例。
const FIXED = {
  externalSales: 10000000,
  deliveryAmount: 6500000,
  salesBasis: 5000000,
  mgmtProfitBasis: 1250000,
};

describe('summaryPayValuesOf', () => {
  const details: SummaryDetailTotals = {
    payFunc: 2000,
    addEntryAmount: 4200000,
    promoNetUnapproved: 10000,
    promoLinked: 200000,
  };

  it('分割が無ければ明細の合計をそのまま使い、売上高などを今の式で求める', () => {
    const v = summaryPayValuesOf(details, FIXED);
    expect(v.payFunc).toBe(2000);
    expect(v.addEntryAmount).toBe(4200000);
    expect(v.promoNetUnapproved).toBe(10000);
    expect(v.promoLinked).toBe(200000);
    // 支払NET売上高＝社外売上高－追加口金額－拡売費（NET未承認）
    expect(v.payNetSales).toBe(10000000 - 4200000 - 10000);
    // 売上高＝支払NET売上高－拡売費（NET未承認以外）
    expect(v.sales).toBe(10000000 - 4200000 - 10000 - 200000);
    // 管理利益額＝基準の管理利益額＋（売上高－基準の売上高）
    expect(v.mgmtProfitAmount).toBe(1250000 + (v.sales - 5000000));
    expect(v.addEntryRate).toBeCloseTo(42, 10);
    expect(v.marginRate).toBeCloseTo(
      ((6500000 - v.payNetSales) / 6500000) * 100,
      10
    );
    expect(v.mgmtProfitRate).toBeCloseTo(
      (v.mgmtProfitAmount / v.sales) * 100,
      10
    );
  });

  it('追加口分割は自部署負担分（明細の合計－分割先へ出した分）で求める', () => {
    const v = summaryPayValuesOf(details, FIXED, {
      caseEquivalent: 300.4,
      addAmount: 600000,
    });
    expect(v.payFunc).toBe(2000 - 300);
    expect(v.addEntryAmount).toBe(3600000);
    expect(v.sales).toBe(10000000 - 3600000 - 10000 - 200000);
    // 管理利益額は分割後も、基準の売上高との差で求める
    expect(v.mgmtProfitAmount).toBe(1250000 + (v.sales - 5000000));
    // 拡売費は分割の対象外
    expect(v.promoLinked).toBe(200000);
  });
});

describe('fillSummaryRowValues', () => {
  const rows = [
    {
      key: 'payFunc',
      kind: 'count' as const,
      vals: { pay: '', plan: '3,141', prev: '3,107' },
    },
    {
      key: 'addEntryRate',
      kind: 'rate' as const,
      vals: { pay: '', plan: '42.1%', prev: '42.9%' },
    },
    {
      key: 'promoNetUnapproved',
      kind: 'amount' as const,
      vals: { pay: '', plan: '–', diff: '–', errRate: '–', prev: '23,009' },
    },
    {
      key: 'actualFunc',
      kind: 'count' as const,
      vals: { pay: '3,115', plan: '3,141', prev: '3,107' },
    },
  ];

  it('支払・実績情報を差し替え、差・計画誤差率・前年比を列方向の式で求める', () => {
    const [payFunc, rate, net, actual] = fillSummaryRowValues(rows, {
      payFunc: 3125,
      addEntryRate: 32.536,
      promoNetUnapproved: 8640,
    });
    expect(payFunc.vals).toMatchObject({
      pay: '3,125',
      diff: '-16',
      errRate: '-0.5%',
      yoy: '100.6%',
    });
    // 率の行の差はポイント差
    expect(rate.vals).toMatchObject({ pay: '32.5%', diff: '-9.6%' });
    // 販売計画書を持たない行は「–」のまま
    expect(net.vals).toMatchObject({
      pay: '8,640',
      plan: '–',
      diff: '–',
      errRate: '–',
      yoy: '37.6%',
    });
    // 差し替えない行（固定値）も、差・計画誤差率・前年比は式で求める
    expect(actual.vals).toMatchObject({
      pay: '3,115',
      diff: '-26',
      errRate: '-0.8%',
      yoy: '100.3%',
    });
  });

  it('分母が0の率は空欄', () => {
    const [net] = fillSummaryRowValues(
      [
        {
          key: 'promoNetUnapproved',
          kind: 'amount' as const,
          vals: { pay: '', plan: '–', diff: '–', errRate: '–', prev: '0' },
        },
      ],
      { promoNetUnapproved: 0 }
    );
    expect(net.vals.pay).toBe('0');
    expect(net.vals.yoy).toBe('');
  });
});

// 明細追加－追加口ペイン（請求書有）の請求情報：バラ単価・金額を計算した値で表示し、
// 手で直した値をグリッドと同じ決まりで扱うこと（→ 補足1-5 b24.t10・t11、利用者の決定 2026-10-05 B案）。
import { beforeEach, describe, it, expect } from 'vitest';
import {
  WITH_INVOICE_MASTER_SCALE,
  withInvoiceMasterValuesOf,
} from '../constants/paymentWithInvoiceMockData';
import {
  applyEntryCellEdit,
  updateEntryBillingDraft,
  type EntryBillingDraft,
  type EntryBillingDraftField,
} from './additionalEntryRules';
import {
  SUMMARY_PRODUCT_ENTRY_REFERENCE,
  createManualEntryRow,
  entryMasterNetOf,
  entryReferenceOf,
  type AdditionalEntryData,
  type EntryFormValues,
} from '../components/payment/payment-detail-with-invoice/components/DetailTable';

const EMPTY: EntryBillingDraft = {
  billNet: '',
  cases: '',
  loose: '',
  unitPrice: '',
  amount: '',
  unitPriceManual: false,
  amountManual: false,
};
// 社外売上高単価 120・入数 24（カルピスウォーター500mL24本 と同じ）。
const REF = { seihan: 120, capacity: 24 };

// 入力を順に当てる。
const typeAll = (
  steps: [EntryBillingDraftField, string][],
  draft: EntryBillingDraft = EMPTY,
  ref: { seihan?: unknown; capacity?: unknown } | undefined = REF
) =>
  steps.reduce(
    (d, [field, value]) => updateEntryBillingDraft(d, field, value, ref),
    draft
  );

describe('明細追加－追加口ペイン：バラ単価・金額の自動算出', () => {
  it('請求NETを入れるとバラ単価を表示し、ケース・バラを入れると金額を表示する', () => {
    let d = typeAll([['billNet', '70']]);
    expect(d).toMatchObject({ unitPrice: '50.00', amount: '' });
    d = typeAll([['cases', '2']], d);
    expect(d.amount).toBe(String(48 * 50));
    d = typeAll([['loose', '4']], d);
    expect(d).toMatchObject({
      unitPrice: '50.00',
      amount: '2600',
      unitPriceManual: false,
      amountManual: false,
    });
  });

  it('計算できないあいだは空欄（サマリ商品なし・請求NETなし・数量なし）', () => {
    expect(typeAll([['cases', '2']], EMPTY, undefined)).toMatchObject({
      unitPrice: '',
      amount: '',
    });
    expect(typeAll([['cases', '2']])).toMatchObject({
      unitPrice: '',
      amount: '',
    });
    expect(typeAll([['billNet', '70']])).toMatchObject({ amount: '' });
    // 請求NETを空欄に戻すと、バラ単価・金額も空欄に戻る。
    expect(
      typeAll([
        ['billNet', '70'],
        ['cases', '2'],
        ['billNet', ''],
      ])
    ).toMatchObject({ unitPrice: '', amount: '' });
  });

  it('グリッドと同じ丸め：バラ単価は小数第2位、金額は1円未満を四捨五入', () => {
    const d = typeAll(
      [
        ['billNet', '38.35'],
        ['cases', '1'],
        ['loose', '1'],
      ],
      EMPTY,
      { seihan: 89.5, capacity: 30 }
    );
    expect(d.unitPrice).toBe('51.15');
    expect(d.amount).toBe(String(Math.round(31 * (89.5 - 38.35))));
  });
});

describe('明細追加－追加口ペイン：手で直した値', () => {
  const base = () =>
    typeAll([
      ['billNet', '70'],
      ['cases', '2'],
      ['loose', '4'],
    ]);

  it('金額を直すと残り、ケースを直すと金額だけ計算し直す', () => {
    let d = typeAll([['amount', '9999']], base());
    expect(d).toMatchObject({ amount: '9999', amountManual: true });
    d = typeAll([['billNet', '70']], d); // 同じ値でも請求NETの変更は両方を計算し直す
    expect(d).toMatchObject({ amount: '2600', amountManual: false });
    d = typeAll(
      [
        ['amount', '9999'],
        ['cases', '3'],
      ],
      d
    );
    expect(d).toMatchObject({ amount: String(76 * 50), amountManual: false });
  });

  it('バラ単価を直すと残り、金額はその単価で計算する。ケース・バラを直してもバラ単価は残る', () => {
    let d = typeAll([['unitPrice', '55']], base());
    expect(d).toMatchObject({
      unitPrice: '55',
      unitPriceManual: true,
      amount: String(52 * 55),
    });
    d = typeAll([['loose', '6']], d);
    expect(d).toMatchObject({
      unitPrice: '55',
      unitPriceManual: true,
      amount: String(54 * 55),
    });
  });

  it('請求NETを直すとバラ単価・金額とも計算し直す', () => {
    const d = typeAll(
      [
        ['unitPrice', '55'],
        ['amount', '9999'],
        ['billNet', '60'],
      ],
      base()
    );
    expect(d).toMatchObject({
      unitPrice: '60.00',
      amount: String(52 * 60),
      unitPriceManual: false,
      amountManual: false,
    });
  });

  it('サマリ商品を選び直すと、請求NETはそのままで、選んだ商品の値で両方を計算し直す', () => {
    const d = updateEntryBillingDraft(
      typeAll([['unitPrice', '55']], base()),
      'product',
      '',
      { seihan: 168, capacity: 24 }
    );
    expect(d).toMatchObject({
      billNet: '70',
      unitPrice: '98.00',
      amount: String(52 * 98),
      unitPriceManual: false,
    });
  });

  it.each([
    ['unitPrice', '50.00', '2600'],
    ['amount', '50.00', '2600'],
  ] as const)(
    '直した%sを空欄にすると、計算した値に戻る',
    (field, expectedUnit, expectedAmount) => {
      const typed = field === 'unitPrice' ? '55' : '9999';
      const d = typeAll(
        [
          [field, typed],
          [field, ''],
        ],
        base()
      );
      expect(d).toMatchObject({
        unitPrice: expectedUnit,
        amount: expectedAmount,
        unitPriceManual: false,
        amountManual: false,
      });
    }
  );

  it('計算した値と同じ値を入れても、手で直した値として扱わない', () => {
    const d = typeAll(
      [
        ['unitPrice', '50'],
        ['amount', '2600'],
      ],
      base()
    );
    expect(d).toMatchObject({ unitPriceManual: false, amountManual: false });
  });
});

describe('明細追加－追加口ペイン：追加した明細', () => {
  const PRODUCT = 'カルピスウォーター500mL24本';
  const form = (d: EntryBillingDraft): EntryFormValues => ({
    productName: PRODUCT,
    payCases: '2',
    payLoose: '',
    addNet: '70',
    payNet: '70',
    matchType: '',
    expProcess: '-',
    summary1: '',
    summary2: '',
    funcCheck: false,
    finalNet: '',
    billPage: '',
    billDetailNo: '',
    retailerName: '',
    ...d,
  });
  const ref = entryReferenceOf(PRODUCT);
  const draftOf = (steps: [EntryBillingDraftField, string][]) =>
    typeAll(steps, EMPTY, ref);

  it('ペインの参照値はカルピスの社外売上高単価・入数', () => {
    expect(ref).toMatchObject({ seihan: 120, capacity: 24 });
  });

  it.each([
    ['計算した値のまま', [] as [EntryBillingDraftField, string][]],
    ['バラ単価を手で直した', [['unitPrice', '55']]],
    ['金額を手で直した', [['amount', '9999']]],
    [
      '両方を手で直した',
      [
        ['unitPrice', '55'],
        ['amount', '9999'],
      ],
    ],
  ] as [string, [EntryBillingDraftField, string][]][])(
    '%s：ペインの表示と同じ値・同じ手で直した印で一覧に追加する',
    (_label, extra) => {
      const d = draftOf([
        ['billNet', '65'],
        ['cases', '1'],
        ['loose', '2'],
        ...extra,
      ]);
      const row = createManualEntryRow(form(d), 12);
      expect(row.unitPrice).toBeCloseTo(Number(d.unitPrice), 6);
      expect(row.amount).toBe(Number(d.amount));
      expect(!!row.unitPriceManual).toBe(d.unitPriceManual);
      expect(!!row.amountManual).toBe(d.amountManual);
      expect(row.diff).toBe(Number(d.amount) - Number(row.payAmount));
    }
  );

  it('サマリ商品を選んでも請求NETは空欄のまま（初期値なし）で、請求NETを入れるまでバラ単価・金額は空欄', () => {
    // ペイン（handleProductChange）は 'product' で選んだ商品の参照値を渡す。
    let d = updateEntryBillingDraft(EMPTY, 'product', '', ref);
    d = typeAll(
      [
        ['cases', '1'],
        ['loose', '2'],
      ],
      d,
      ref
    );
    expect(d).toMatchObject({ billNet: '', unitPrice: '', amount: '' });
    d = typeAll([['billNet', '70']], d, ref);
    expect(d).toMatchObject({ unitPrice: '50.00', amount: '1300' });
    const row = createManualEntryRow(form(d), 12);
    expect(row).toMatchObject({ billNet: 70, unitPrice: 50, amount: 1300 });
  });

  it.each([
    [
      'ケース・バラを入れたあと',
      [
        ['cases', '1'],
        ['loose', '2'],
      ],
    ],
    [
      'バラ単価・金額を手で直したあと',
      [
        ['cases', '1'],
        ['unitPrice', '55'],
        ['amount', '9999'],
      ],
    ],
  ] as [string, [EntryBillingDraftField, string][]][])(
    '請求NETを空欄にして追加すると（%s）、ペインの表示どおり請求NET・バラ単価・金額とも空欄の明細になる',
    (_label, steps) => {
      const d = draftOf([['billNet', '65'], ...steps, ['billNet', '']]);
      expect(d.billNet).toBe('');
      expect(d.unitPrice).toBe('');
      expect(d.amount).toBe('');
      const row = createManualEntryRow(form(d), 12);
      expect(row).toMatchObject({ billNet: '', unitPrice: '', amount: '' });
      expect(row.diff).toBe(-Number(row.payAmount));
    }
  );

  it('追加後のグリッドの編集も同じ決まり（ケースを直すと手で直した金額は計算し直す）', () => {
    const d = draftOf([
      ['billNet', '65'],
      ['cases', '1'],
      ['loose', '2'],
      ['amount', '9999'],
    ]);
    const row: AdditionalEntryData = createManualEntryRow(form(d), 12);
    expect(row.amount).toBe(9999);
    row.cases = 2;
    applyEntryCellEdit(row, 'cases');
    expect(row.amountManual).toBe(false);
    expect(row.amount).toBe(Math.round(50 * 55));
  });

  it('手で直した印が付いていても、計算した値と同じなら印を付けない', () => {
    const d = draftOf([
      ['billNet', '65'],
      ['cases', '1'],
      ['loose', '2'],
    ]);
    const row = createManualEntryRow(
      { ...form(d), unitPriceManual: true, amountManual: true },
      12
    );
    expect(row.unitPriceManual).toBe(false);
    expect(row.amountManual).toBe(false);
  });

  it('函数無効チェックONの明細は、ペインの値をそのまま持つ', () => {
    const d = draftOf([
      ['billNet', '65'],
      ['cases', '1'],
      ['loose', '2'],
    ]);
    const row = createManualEntryRow(
      { ...form(d), funcCheck: true, finalNet: '65' },
      12
    );
    expect(row.unitPrice).toBe(55);
    expect(row.amount).toBe(26 * 55);
  });
});

// ── 入力中（1文字ずつ）の扱い：入力欄を離れるまで入力中の文字を書き換えない ──
describe('明細追加－追加口ペイン：入力中の文字', () => {
  // ペインと同じ流れ：入力欄に入った時点の値を残し（committed）、1文字ごとの入力（focused）と
  // 離れたときの確定（focused なし）にそれを渡す。keys の最初の呼び出しが「入力欄に入る」。
  let committed: EntryBillingDraft | undefined;
  beforeEach(() => {
    committed = undefined;
  });
  const keys = (
    d: EntryBillingDraft,
    field: 'unitPrice' | 'amount',
    texts: string[]
  ) => {
    committed ??= d;
    return texts.reduce(
      (acc, t) =>
        updateEntryBillingDraft(acc, field, t, REF, {
          focused: true,
          committed,
        }),
      d
    );
  };
  const blur = (d: EntryBillingDraft, field: 'unitPrice' | 'amount') => {
    committed ??= d; // 何も打たずに離れた
    const r = updateEntryBillingDraft(d, field, d[field], REF, { committed });
    committed = undefined;
    return r;
  };
  const base = () =>
    typeAll([
      ['billNet', '70'],
      ['cases', '2'],
      ['loose', '4'],
    ]);

  it('バラ単価「55.00」を1文字ずつ消しても、入力中の文字のまま（計算した値に戻さない）', () => {
    let d = blur(keys(base(), 'unitPrice', ['55.00']), 'unitPrice');
    expect(d).toMatchObject({ unitPrice: '55.00', unitPriceManual: true });
    for (const t of ['55.0', '55.', '55', '5']) {
      d = keys(d, 'unitPrice', [t]);
      expect(d.unitPrice).toBe(t);
      // 金額は入力中のバラ単価で計算して表示する
      expect(d.amount).toBe(String(Math.round(52 * Number(t))));
    }
    d = blur(d, 'unitPrice');
    expect(d).toMatchObject({ unitPrice: '5', unitPriceManual: true });
  });

  it('全部消してから打ち直すと、打った数字がそのまま入る（途中で計算した値に戻らない）', () => {
    let d = blur(keys(base(), 'unitPrice', ['55']), 'unitPrice');
    d = keys(d, 'unitPrice', ['']);
    expect(d.unitPrice).toBe('');
    expect(d.amount).toBe('2600'); // 空欄のあいだは計算した単価（50）で金額を出す
    d = keys(d, 'unitPrice', ['6', '60']);
    expect(d).toMatchObject({ unitPrice: '60', amount: String(52 * 60) });
    d = blur(d, 'unitPrice');
    expect(d).toMatchObject({ unitPrice: '60', unitPriceManual: true });
  });

  it('全部消したまま入力欄を離れると、計算した値に戻る', () => {
    let d = blur(keys(base(), 'amount', ['9999']), 'amount');
    d = blur(keys(d, 'amount', ['']), 'amount');
    expect(d).toMatchObject({ amount: '2600', amountManual: false });
  });

  it('金額を1文字ずつ打つ途中で計算した値と同じになっても、入力中の文字を残し、離れたときに手で直した値として扱わない', () => {
    let d = keys(base(), 'amount', ['', '2', '26', '260', '2600']);
    expect(d).toMatchObject({ amount: '2600', amountManual: false });
    d = keys(d, 'amount', ['26000']);
    expect(d).toMatchObject({ amount: '26000', amountManual: true });
    d = keys(d, 'amount', ['2600']);
    d = blur(d, 'amount');
    expect(d).toMatchObject({ amount: '2600', amountManual: false });
  });

  it('金額を手で直したあと、バラ単価の入力欄に入って何も変えずに離れても、手で直した金額は残る', () => {
    let d = blur(keys(base(), 'amount', ['9999']), 'amount');
    expect(d).toMatchObject({ amount: '9999', amountManual: true });
    d = blur(d, 'unitPrice'); // 入って何も打たずに離れる
    expect(d).toMatchObject({
      unitPrice: '50.00',
      unitPriceManual: false,
      amount: '9999',
      amountManual: true,
    });
    // 打って元の値に戻してから離れても同じ（入った時点の値と変わらない）
    d = blur(keys(d, 'unitPrice', ['5', '50', '50.0']), 'unitPrice');
    expect(d).toMatchObject({
      unitPrice: '50.00',
      amount: '9999',
      amountManual: true,
    });
  });

  it('バラ単価を手で直したあと、金額の入力欄に入って何も変えずに離れても、手で直したバラ単価と金額はそのまま', () => {
    let d = blur(keys(base(), 'unitPrice', ['55']), 'unitPrice');
    expect(d).toMatchObject({
      unitPrice: '55',
      unitPriceManual: true,
      amount: String(52 * 55),
    });
    d = blur(d, 'amount');
    expect(d).toMatchObject({
      unitPrice: '55',
      unitPriceManual: true,
      amount: String(52 * 55),
      amountManual: false,
    });
    // 金額も手で直してから、バラ単価に入って離れても両方残る
    d = blur(keys(d, 'amount', ['8888']), 'amount');
    d = blur(d, 'unitPrice');
    expect(d).toMatchObject({
      unitPrice: '55',
      unitPriceManual: true,
      amount: '8888',
      amountManual: true,
    });
  });

  it('手で直した金額があっても、バラ単価を実際に変えれば金額は計算し直す', () => {
    let d = blur(keys(base(), 'amount', ['9999']), 'amount');
    d = keys(d, 'unitPrice', ['6', '60']);
    expect(d).toMatchObject({ amount: String(52 * 60), amountManual: false });
    d = blur(d, 'unitPrice');
    expect(d).toMatchObject({
      unitPrice: '60',
      unitPriceManual: true,
      amount: String(52 * 60),
      amountManual: false,
    });
  });

  it('計算した値と同じバラ単価を「50.0」と打っても、離れたときに整えて手で直した値として扱わない', () => {
    let d = keys(base(), 'unitPrice', ['', '5', '50', '50.', '50.0']);
    expect(d.unitPrice).toBe('50.0');
    d = blur(d, 'unitPrice');
    expect(d).toMatchObject({ unitPrice: '50.00', unitPriceManual: false });
  });
});

// ── 丸め：金額は丸める前のバラ単価で計算する（ペインと一覧の明細で一致） ──
describe('明細追加－追加口ペイン：丸め', () => {
  it('バラ単価が小数第3位以下を持つときも、ペインの金額と追加した明細の金額が一致する', () => {
    // 社外売上高単価 120・請求NET 69.995 → バラ単価 50.005（表示は 50.01）
    const d = typeAll([
      ['billNet', '69.995'],
      ['cases', '0'],
      ['loose', '1000'],
    ]);
    expect(d.unitPrice).toBe('50.01');
    // 丸める前の 50.005 で計算（50.01 で計算すると 50,010）
    expect(d.amount).toBe(String(Math.round(1000 * (120 - 69.995))));
    const row = createManualEntryRow(
      {
        productName: 'カルピスウォーター500mL24本',
        payCases: '',
        payLoose: '',
        addNet: '',
        payNet: '',
        matchType: '',
        expProcess: '-',
        summary1: '',
        summary2: '',
        funcCheck: false,
        finalNet: '',
        billPage: '',
        billDetailNo: '',
        retailerName: '',
        ...d,
      },
      12
    );
    expect(row.amount).toBe(Number(d.amount));
    expect(row.unitPriceManual).toBe(false);
  });
});

// ── 支払NET（追加口分）・（全体）の初期値：サマリ商品のマスタNET（→ 補足1-5 b24.t12・t13） ──
describe('明細追加－追加口ペイン：支払NETの初期値（マスタNET）', () => {
  // 計画のある商品（マスタNET＝計画NET）と計画に無い商品（マスタNET＝共通マスタの2倍）。
  const PRODUCTS = [
    'ワンダ ボトルコーヒー微糖500mL24本',
    'カルピスウォーター500mL24本',
    'ウィルキンソン炭酸水500mL24本',
    '三ツ矢サイダー500mL24本',
    'ドデカミン500mL24本',
  ];

  it.each(PRODUCTS)(
    '%s：支払NETを入れずに追加すると、支払NET（追加口分）・（全体）はマスタNETで、追加口金額・支払金額・差額はその値で計算する',
    (productName) => {
      const reference = entryReferenceOf(productName);
      const master = entryMasterNetOf(productName) as number;
      const row = createManualEntryRow(
        {
          productName,
          payCases: '2',
          payLoose: '3',
          addNet: '',
          payNet: '',
          matchType: '',
          expProcess: '-',
          summary1: '',
          summary2: '',
          funcCheck: false,
          finalNet: '',
          billNet: '60',
          cases: '2',
          loose: '3',
          unitPrice: '',
          amount: '',
          billPage: '',
          billDetailNo: '',
          retailerName: '',
        },
        12
      );
      const seihan = Number(reference?.seihan);
      const capacity = Number(reference?.capacity);
      const qty = capacity * 2 + 3;
      expect(row.addNet).toBe(master);
      expect(row.payNet).toBe(master);
      expect(row.planNet).toBe(reference?.net); // 計画NETは計画の値のまま（赤表示の判定に使う）
      expect(row.addUnit).toBeCloseTo(seihan - master, 6); // 追加口バラ単価
      expect(row.expUnit).toBe(0); // 拡売費バラ単価（NET未承認）＝追加口分－全体
      expect(row.addAmount).toBe(Math.round(qty * (seihan - master)));
      expect(row.expAmount).toBe(0); // 未承認NETへは流れない
      expect(row.payAmount).toBe(row.addAmount);
      expect(row.diff).toBe(Number(row.amount) - Number(row.payAmount));
    }
  );
});

// ── この画面のモックの商品マスタの値（計画の水準にそろえる → withInvoiceMasterValuesOf） ──
describe('支払詳細(追加口請求書有)のモックの商品マスタ（NET・社外売上高単価）', () => {
  it('計画のあるサマリ商品は、マスタNET＝計画NET、社外売上高単価＝計画の社外売上高単価', () => {
    expect(
      withInvoiceMasterValuesOf('ワンダ ボトルコーヒー微糖500mL24本', {
        net: 52,
        seihan: 70,
      })
    ).toEqual({ net: 95, seihan: 168 });
    expect(entryMasterNetOf('カルピスウォーター500mL24本')).toBe(70);
    expect(
      SUMMARY_PRODUCT_ENTRY_REFERENCE['カルピスウォーター500mL24本']
    ).toMatchObject({ net: 70, seihan: 120 });
  });

  it('計画に無いサマリ商品は、共通マスタのNET・社外売上高単価を同じ倍率（2倍）で上げる', () => {
    expect(WITH_INVOICE_MASTER_SCALE).toBe(2);
    expect(
      withInvoiceMasterValuesOf('ドデカミン500mL24本', {
        net: 44,
        seihan: 52.5,
      })
    ).toEqual({ net: 88, seihan: 105 });
    expect(
      withInvoiceMasterValuesOf('ドデカミン500mL24本', { net: '', seihan: '' })
    ).toEqual({ net: '', seihan: '' });
  });

  it('計画に無いがこの画面の計画情報に社外売上高単価がある十六茶は、その社外売上高単価と、同じ比で上げたNET', () => {
    const v = withInvoiceMasterValuesOf('十六茶630mL24本', {
      net: 54,
      seihan: 65,
    });
    expect(v.seihan).toBe(105);
    expect(v.net).toBe(Math.round(54 * (105 / 65) * 100) / 100);
    expect(SUMMARY_PRODUCT_ENTRY_REFERENCE['十六茶630mL24本'].seihan).toBe(105);
  });

  it('すべてのサマリ商品で、マスタNETは社外売上高単価を下回る（追加口バラ単価が正になる）', () => {
    const bad = Object.entries(SUMMARY_PRODUCT_ENTRY_REFERENCE).filter(
      ([, r]) => r.net !== '' && r.seihan !== '' && !(r.net < r.seihan)
    );
    expect(bad).toEqual([]);
  });
});

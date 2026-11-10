// 支払詳細(追加口請求書有／追加口請求書無)の集計が、明細の合計と一致することを確かめる。
//
// 明細は画面と同じモックデータ（constants/payment*MockData）から作る。期待値は、テストの中で
// 明細を1行ずつ足して求める（集計の実装は使わない）。
//   ・合計表：支払回数ごと（画面は表示中の支払回数の明細だけを集計する）。
//     支払情報（全項目）・追加口明細（追加口　計）・拡売費明細（拡売費　計）の全セル
//   ・支払情報サマリ：全支払回数の合計（請求書有は追加口分割の自部署負担分）
//   ・手で直した明細：手入力になり、合計表のデータ元別で手入力の列へ移る
import { describe, it, expect } from 'vitest';
import {
  WITH_INVOICE_ACTUAL_FUNC,
  WITH_INVOICE_DEFAULT_ROUND,
  WITH_INVOICE_PAYMENT_ROUNDS,
  WITH_INVOICE_SUMMARY_FIXED_VALUES,
  createWithInvoiceBilledCenterFeeRows,
  createWithInvoiceEntryRows,
  createWithInvoiceExpenseRows,
} from '../../../constants/paymentWithInvoiceMockData';
import {
  WITHOUT_INVOICE_ACTUAL_FUNC,
  WITHOUT_INVOICE_DEFAULT_ROUND,
  WITHOUT_INVOICE_PAYMENT_ROUNDS,
  WITHOUT_INVOICE_SUMMARY_FIXED_VALUES,
  createWithoutInvoiceEntryRows,
  createWithoutInvoiceExpenseRows,
} from '../../../constants/paymentWithoutInvoiceMockData';
import { PREV_MONTH_SPLIT } from '../../../constants/additionalEntrySplitMockData';
import {
  WITH_INVOICE_DATA_SOURCE_COLUMNS,
  WITHOUT_INVOICE_DATA_SOURCE_COLUMNS,
  type DataSource,
} from '../../../constants/dataSource';
import {
  breakdownCellValues,
  buildWithInvoicePaymentItems,
  buildWithoutInvoicePaymentItems,
  computeBilledCenterFeeBreakdown,
  computeEntryBreakdown,
  computeExpenseBreakdown,
  computeWithoutInvoiceEntryBreakdown,
  sumBilledCenterFeeByProduct,
  type BilledCenterFeeRow,
  type BreakdownItem,
} from './paymentBreakdownItems';
import {
  aggregateSummaryDetails,
  summaryPayValuesOf,
  totalSplitOut,
} from './paymentSummaryAggregate';
import {
  applyAutoTransfer,
  applyEntryCellEdit,
  applyEntryManualEdit,
  computeEntryCenterFeeTotal,
  isEntryAlertRow,
  isEntryCellEditable,
  isManualOriginEntry,
} from './additionalEntryRules';
import {
  isExpenseInvoiceRefEditable,
  markExpenseManualEdit,
  originDataSourceOf,
} from './paymentDataSource';
import {
  linkNetUnapprovedRows,
  netUnapprovedLinkOf,
} from './netUnapprovedLink';
import {
  createEntryRowFromExpense,
  createManualEntryRow,
  type EntryFormValues,
} from '../../../components/payment/payment-detail-with-invoice/components/DetailTable';
import { formatBreakdownAmount } from './paymentAmountBreakdown';
import type { AdditionalEntryData } from '../../../components/payment/payment-detail-with-invoice/components/DetailTable';
import type { EntryRow as WithoutEntryRow } from '../../../components/payment/payment-detail-without-invoice/components/DetailTable';
import {
  createManualExpenseRow,
  type ExpenseFormValues,
  type ExpenseRow,
} from '../../../components/shared/payment/payment-detail/PaymentNonProductExpensePane';

// ── 期待値を求めるための独立した計算（実装は使わない） ─────────────────

const TAX_COLUMNS = ['10%', '8%', 'その他(5%)', 'その他(非課税)'];
const TAX_COLUMN_OF: Record<string, string> = {
  '課税10%:1': '10%',
  '課税8%:2': '8%',
  'その他(5%):3': 'その他(5%)',
  'その他(非課税):4': 'その他(非課税)',
};
const NET_MGMT_CLASS = '値引き（売上連動）';

// 空欄・「-」は0として数える。
const num = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const text = String(v ?? '')
    .replace(/,/g, '')
    .trim();
  if (text === '' || text === '-') return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
};

// 合計表に入れる1行分の金額（税率別・データ元別の振り分け先つき）。
interface Line {
  amount: number;
  tax: string;
  source: string;
}

// ［合計, 税率別4列, データ元別の列］のセル。
const cellsOf = (lines: Line[], sources: readonly string[]): number[] => {
  const sum = (pick: (l: Line) => boolean) =>
    lines.filter(pick).reduce((s, l) => s + l.amount, 0);
  return [
    sum(() => true),
    ...TAX_COLUMNS.map((t) => sum((l) => l.tax === t)),
    ...sources.map((s) => sum((l) => l.source === s)),
  ];
};
const minus = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
const plus = (...xs: number[][]) =>
  xs[0].map((_, i) => xs.reduce((s, x) => s + x[i], 0));
const nulls = (sources: readonly string[]) =>
  Array<null>(1 + TAX_COLUMNS.length + sources.length).fill(null);

interface ExpectedItem {
  bill: (number | null)[];
  pay: (number | null)[];
  diff: (number | null)[];
}

// 浮動小数の誤差（三ツ矢サイダーの小数の単価など）を許してセルを比べる。
const expectCells = (
  actual: (number | null)[],
  expected: (number | null)[],
  label: string
) => {
  expect(actual.length, label).toBe(expected.length);
  expected.forEach((e, i) => {
    if (e === null) expect(actual[i], `${label}[${i}]`).toBeNull();
    else expect(actual[i] as number, `${label}[${i}]`).toBeCloseTo(e, 6);
  });
};
const expectItem = (
  item: BreakdownItem,
  expected: ExpectedItem,
  sources: readonly DataSource[],
  label: string
) => {
  const cells = breakdownCellValues(item, sources);
  expectCells(cells.bill, expected.bill, `${label} 請求`);
  expectCells(cells.pay, expected.pay, `${label} 支払`);
  expectCells(cells.diff, expected.diff, `${label} 差額`);
};

// 請求書有：追加口明細（合計行を除く）。
const entryLines = (
  rows: AdditionalEntryData[],
  side: 'bill' | 'pay'
): Line[] =>
  rows
    .filter((r) => !r.isTotal)
    .map((r) => ({
      amount: num(side === 'bill' ? r.amount : r.payAmount),
      tax: '8%',
      source: String(r.dataSource),
    }));

// 請求書有：センターフィ額＝社外売上高単価×（入数×支払ケース＋支払バラ）×センターフィ率（明細ごとに四捨五入）。
const centerFeeLines = (rows: AdditionalEntryData[]): Line[] =>
  rows
    .filter((r) => !r.isTotal)
    .map((r) => ({
      amount: Math.round(
        num(r.seihan) *
          (num(r.capacity) * num(r.payCases) + num(r.payLoose)) *
          num(r.centerFeeRate)
      ),
      tax: '8%',
      source: String(r.dataSource),
    }));

// 請求書有：合計表のセンターフィ＝請求詳細から反映したセンターフィ（画面に出さず裏で持つ）の合計。
// 請求・支払とも同じ値。税率別・データ元別は裏のデータの税率・データ元で振り分ける。
const billedCenterFeeLines = (rows: readonly BilledCenterFeeRow[]): Line[] =>
  rows.map((r) => ({
    amount: r.billAmount,
    tax: r.taxRate,
    source: r.dataSource,
  }));

// 拡売費明細（グループ合計行・総合計行・枝番行を除く。未承認NETの請求は0）。
const expenseDetailRows = (rows: ExpenseRow[]) =>
  rows.filter((r) => !r.isGroup && !r.isTotal && r.costSplit !== '分割先');
const expenseLines = (rows: ExpenseRow[], side: 'bill' | 'pay'): Line[] =>
  expenseDetailRows(rows).map((r) => ({
    amount:
      side === 'bill'
        ? r.isNetUnapproved
          ? 0
          : num(r.billAmount)
        : num(r.payAmount),
    tax: TAX_COLUMN_OF[r.taxClass] ?? '',
    source: String(r.dataSource),
  }));

// 請求書無：追加口明細は8%の列に入り、データ元別のどの列にも入らない（データ元の区分を持たない）。
const withoutEntryLines = (rows: WithoutEntryRow[]): Line[] =>
  rows.map((r) => ({ amount: num(r.payAmount), tax: '8%', source: '' }));

// 請求書有の合計表の期待値（追加口　計・センターフィ・拡売費　計・税抜金額　計）。
const expectedWithInvoice = (
  entries: AdditionalEntryData[],
  expenses: ExpenseRow[],
  centerFees: readonly BilledCenterFeeRow[]
) => {
  const S = WITH_INVOICE_DATA_SOURCE_COLUMNS;
  const entryBill = cellsOf(entryLines(entries, 'bill'), S);
  const entryPay = cellsOf(entryLines(entries, 'pay'), S);
  const cf = cellsOf(billedCenterFeeLines(centerFees), S);
  const expBill = cellsOf(expenseLines(expenses, 'bill'), S);
  const expPay = cellsOf(expenseLines(expenses, 'pay'), S);
  const totalBill = plus(entryBill, cf, expBill);
  const totalPay = plus(entryPay, cf, expPay);
  return {
    entry: {
      bill: entryBill,
      pay: entryPay,
      diff: minus(entryBill, entryPay),
    },
    centerFee: { bill: cf, pay: cf, diff: nulls(S) },
    expense: { bill: expBill, pay: expPay, diff: minus(expBill, expPay) },
    total: {
      bill: totalBill,
      pay: totalPay,
      diff: minus(totalBill, totalPay),
    },
  };
};

// 請求書無の合計表の期待値（請求・差額はすべて「-」）。
const expectedWithoutInvoice = (
  entries: WithoutEntryRow[],
  expenses: ExpenseRow[]
) => {
  const S = WITHOUT_INVOICE_DATA_SOURCE_COLUMNS;
  const entryPay = cellsOf(withoutEntryLines(entries), S);
  const expPay = cellsOf(expenseLines(expenses, 'pay'), S);
  return {
    entry: { bill: nulls(S), pay: entryPay, diff: nulls(S) },
    expense: { bill: nulls(S), pay: expPay, diff: nulls(S) },
    total: { bill: nulls(S), pay: plus(entryPay, expPay), diff: nulls(S) },
  };
};

// 1回分の明細（画面の初期表示と同じ）と、裏で持つ請求詳細のセンターフィ。
const withInvoiceRound = (round: string) => {
  const entries = createWithInvoiceEntryRows(round);
  return {
    entries,
    expenses: createWithInvoiceExpenseRows(round, entries),
    centerFees: createWithInvoiceBilledCenterFeeRows(round),
  };
};
const withoutInvoiceRound = (round: string) => ({
  entries: createWithoutInvoiceEntryRows(round),
  expenses: createWithoutInvoiceExpenseRows(round),
});

// 画面と同じ集計（合計表）。
const withInvoiceItems = (
  entries: AdditionalEntryData[],
  expenses: ExpenseRow[],
  centerFees: readonly BilledCenterFeeRow[]
) => {
  const entry = computeEntryBreakdown(entries);
  const expense = computeExpenseBreakdown(expenses);
  return {
    entryCard: { label: '合計', breakdown: entry },
    expenseCard: { label: '合計', breakdown: expense },
    payment: buildWithInvoicePaymentItems({
      entry,
      centerFee: computeBilledCenterFeeBreakdown(centerFees),
      expense,
    }),
  };
};
const withoutInvoiceItems = (
  entries: WithoutEntryRow[],
  expenses: ExpenseRow[]
) => {
  const entry = computeWithoutInvoiceEntryBreakdown(entries);
  const expense = computeExpenseBreakdown(expenses);
  return {
    entryCard: { label: '合計', breakdown: entry, isBillUnavailable: true },
    expenseCard: {
      label: '合計',
      breakdown: expense,
      isBillUnavailable: true,
    },
    payment: buildWithoutInvoicePaymentItems({ entry, expense }),
  };
};

// 請求書有の合計表がすべて明細の合計と一致すること。
const assertWithInvoiceTables = (
  entries: AdditionalEntryData[],
  expenses: ExpenseRow[],
  centerFees: readonly BilledCenterFeeRow[],
  label: string
) => {
  const S = WITH_INVOICE_DATA_SOURCE_COLUMNS;
  const exp = expectedWithInvoice(entries, expenses, centerFees);
  const items = withInvoiceItems(entries, expenses, centerFees);
  expectItem(items.entryCard, exp.entry, S, `${label} 追加口明細の合計表`);
  expectItem(items.expenseCard, exp.expense, S, `${label} 拡売費明細の合計表`);
  expect(items.payment.map((i) => i.label)).toEqual([
    '追加口　計',
    'センターフィ',
    '拡売費　計',
    '税抜金額　計',
  ]);
  expectItem(items.payment[0], exp.entry, S, `${label} 支払情報 追加口　計`);
  expectItem(
    items.payment[1],
    exp.centerFee,
    S,
    `${label} 支払情報 センターフィ`
  );
  expectItem(items.payment[2], exp.expense, S, `${label} 支払情報 拡売費　計`);
  expectItem(items.payment[3], exp.total, S, `${label} 支払情報 税抜金額　計`);
  return exp;
};

// 請求書無の合計表がすべて明細の合計と一致すること。
const assertWithoutInvoiceTables = (
  entries: WithoutEntryRow[],
  expenses: ExpenseRow[],
  label: string
) => {
  const S = WITHOUT_INVOICE_DATA_SOURCE_COLUMNS;
  const exp = expectedWithoutInvoice(entries, expenses);
  const items = withoutInvoiceItems(entries, expenses);
  expectItem(items.entryCard, exp.entry, S, `${label} 追加口明細の合計表`);
  expectItem(items.expenseCard, exp.expense, S, `${label} 拡売費明細の合計表`);
  expect(items.payment.map((i) => i.label)).toEqual([
    '追加口　計',
    '拡売費　計',
    '税抜金額　計',
  ]);
  expectItem(items.payment[0], exp.entry, S, `${label} 支払情報 追加口　計`);
  expectItem(items.payment[1], exp.expense, S, `${label} 支払情報 拡売費　計`);
  expectItem(items.payment[2], exp.total, S, `${label} 支払情報 税抜金額　計`);
  return exp;
};

const sourcesOf = (rows: { dataSource?: DataSource }[]) =>
  [...new Set(rows.map((r) => r.dataSource))].sort();

// ── 請求書有 ───────────────────────────────────────

describe('支払詳細(追加口請求書有)：モックの明細', () => {
  it('既定で表示する支払回数は3回目', () => {
    expect(WITH_INVOICE_DEFAULT_ROUND).toBe('3');
    expect(WITH_INVOICE_PAYMENT_ROUNDS).toEqual(['1', '2', '3']);
  });

  it.each([
    ['1', ['手入力', '請求EDI']],
    ['2', ['AIC入力', '手入力']],
    ['3', ['AIC入力', '手入力', '請求EDI']],
  ])('支払回数%s の追加口・拡売費のデータ元は %j の混在', (round, expected) => {
    const { entries, expenses } = withInvoiceRound(round);
    expect(sourcesOf(entries)).toEqual([...expected].sort());
    expect(sourcesOf(expenseDetailRows(expenses))).toEqual(
      [...expected].sort()
    );
  });

  it('手入力の明細のうち、手で直した明細は元のデータ元を持つ', () => {
    for (const round of WITH_INVOICE_PAYMENT_ROUNDS) {
      const { entries, expenses } = withInvoiceRound(round);
      for (const r of [...entries, ...expenseDetailRows(expenses)]) {
        if (r.originDataSource) {
          expect(r.dataSource, `支払回数${round} No.${r.lineNo}`).toBe(
            '手入力'
          );
          expect(['請求EDI', 'AIC入力']).toContain(r.originDataSource);
        }
      }
    }
  });

  it('回ごとに行数・商品・税区分が異なる', () => {
    const rounds = WITH_INVOICE_PAYMENT_ROUNDS.map(withInvoiceRound);
    expect(rounds.map((r) => r.entries.length)).toEqual([15, 8, 11]);
    const products = rounds.map((r) =>
      [...new Set(r.entries.map((e) => e.productName))].sort().join('|')
    );
    expect(new Set(products).size).toBe(3);
    // 税区分の並び（未承認NETの明細を含む）も回ごとに異なる。
    const taxes = rounds.map((r) =>
      expenseDetailRows(r.expenses)
        .map((e) => e.taxClass)
        .join('|')
    );
    expect(new Set(taxes).size).toBe(3);
  });

  it('未承認NETの明細の支払金額は、同じサマリ商品の追加口明細の拡売費金額（NET未承認）の合計', () => {
    for (const round of WITH_INVOICE_PAYMENT_ROUNDS) {
      const { entries, expenses } = withInvoiceRound(round);
      const byProduct = new Map<string, number>();
      entries.forEach((e) =>
        byProduct.set(
          e.productName,
          (byProduct.get(e.productName) ?? 0) + num(e.expAmount)
        )
      );
      const netRows = expenses.filter((r) => r.isNetUnapproved);
      const expectedProducts = [...byProduct.entries()]
        .filter(([, v]) => v !== 0)
        .map(([p]) => p);
      expect(netRows.map((r) => r.product).sort()).toEqual(
        expectedProducts.sort()
      );
      netRows.forEach((r) =>
        expect(num(r.payAmount), `支払回数${round} ${r.product}`).toBe(
          byProduct.get(r.product)
        )
      );
    }
  });
});

describe.each(WITH_INVOICE_PAYMENT_ROUNDS)(
  '支払詳細(追加口請求書有) 支払回数%s：合計表',
  (round) => {
    it('支払情報・追加口明細・拡売費明細の合計表の全セルが明細の合計と一致する', () => {
      const { entries, expenses, centerFees } = withInvoiceRound(round);
      assertWithInvoiceTables(
        entries,
        expenses,
        centerFees,
        `支払回数${round}`
      );
    });

    it('センターフィの差額は全セル「-」、税抜金額　計＝追加口　計＋センターフィ＋拡売費　計', () => {
      const { entries, expenses, centerFees } = withInvoiceRound(round);
      const items = withInvoiceItems(entries, expenses, centerFees);
      const cf = breakdownCellValues(
        items.payment[1],
        WITH_INVOICE_DATA_SOURCE_COLUMNS
      );
      expect(cf.diff.every((v) => v === null)).toBe(true);
      const cells = items.payment.map((i) =>
        breakdownCellValues(i, WITH_INVOICE_DATA_SOURCE_COLUMNS)
      );
      cells[3].pay.forEach((v, i) =>
        expect(v as number).toBeCloseTo(
          (cells[0].pay[i] as number) +
            (cells[1].pay[i] as number) +
            (cells[2].pay[i] as number),
          6
        )
      );
    });

    it('追加口　計の税率は8%の列だけ（10%・その他は0で「-」表示）', () => {
      const { entries, expenses, centerFees } = withInvoiceRound(round);
      const cells = breakdownCellValues(
        withInvoiceItems(entries, expenses, centerFees).entryCard,
        WITH_INVOICE_DATA_SOURCE_COLUMNS
      );
      for (const kind of ['bill', 'pay'] as const) {
        expect(cells[kind][1]).toBe(0);
        expect(cells[kind][3]).toBe(0);
        expect(cells[kind][4]).toBe(0);
        expect(formatBreakdownAmount(cells[kind][1] as number)).toBe('-');
        expect(cells[kind][2]).toBeCloseTo(cells[kind][0] as number, 6);
      }
    });
  }
);

// 合計表のセンターフィは、請求詳細のセンターフィ（費目＝センターフィの明細）を画面に出さずに持ち、
// サマリ商品ごとに合算した値（利用者の決定 2026-10-05）。支払情報サマリのセンターフィ額は
// 追加口明細×計画のセンターフィ率のまま（両者は別の値になる）。
describe('支払詳細(追加口請求書有)：合計表のセンターフィ（請求詳細のセンターフィの合算）', () => {
  // 回ごとの合計表のセンターフィ（裏のデータの合計）と、変えないサマリのセンターフィ額（変更前の値）。
  const EXPECTED_BY_ROUND: Record<
    string,
    {
      tableTotal: number;
      bySource: Partial<Record<DataSource, number>>;
      byTax: Record<string, number>;
      summary: number;
    }
  > = {
    '1': {
      tableTotal: 52230,
      bySource: { 請求EDI: 52230 },
      byTax: { '10%': 52230 },
      summary: 53639,
    },
    '2': {
      tableTotal: 12280,
      bySource: { AIC入力: 12280 },
      byTax: { '10%': 12280 },
      summary: 12242,
    },
    '3': {
      tableTotal: 22660,
      bySource: { 請求EDI: 17220, AIC入力: 5440 },
      byTax: { '10%': 20790, '8%': 1870 },
      summary: 23046,
    },
  };

  it('裏のデータは回ごとに値が異なり、回1は請求EDI、回2はAIC入力、回3は請求EDIとAIC入力の両方', () => {
    const sourcesByRound = WITH_INVOICE_PAYMENT_ROUNDS.map((round) =>
      [
        ...new Set(
          createWithInvoiceBilledCenterFeeRows(round).map((r) => r.dataSource)
        ),
      ].sort()
    );
    expect(sourcesByRound).toEqual([
      ['請求EDI'],
      ['AIC入力'],
      ['AIC入力', '請求EDI'],
    ]);
    const totals = WITH_INVOICE_PAYMENT_ROUNDS.map((round) =>
      createWithInvoiceBilledCenterFeeRows(round).reduce(
        (s, r) => s + r.billAmount,
        0
      )
    );
    expect(new Set(totals).size).toBe(3);
  });

  describe.each(WITH_INVOICE_PAYMENT_ROUNDS)('支払回数%s', (round) => {
    const S = WITH_INVOICE_DATA_SOURCE_COLUMNS;
    const expected = EXPECTED_BY_ROUND[round];

    it('サマリ商品ごとに合算する（同じサマリ商品・データ元・税率の行を1つにまとめ、金額は変えない）', () => {
      const rows = createWithInvoiceBilledCenterFeeRows(round);
      const grouped = sumBilledCenterFeeByProduct(rows);
      const keyOf = (r: BilledCenterFeeRow) =>
        `${r.productName}|${r.dataSource}|${r.taxRate}`;
      // 同じサマリ商品の行が複数あり、合算で行数が減る。
      expect(grouped.length).toBeLessThan(rows.length);
      expect(grouped.map(keyOf)).toEqual([...new Set(rows.map(keyOf))]);
      grouped.forEach((g) =>
        expect(g.billAmount, keyOf(g)).toBe(
          rows
            .filter((r) => keyOf(r) === keyOf(g))
            .reduce((s, r) => s + r.billAmount, 0)
        )
      );
    });

    it('合計表のセンターフィは請求・支払とも裏のデータの合計（税率別・データ元別も裏のデータで振り分け、手入力は0、差額は「-」）', () => {
      const { entries, expenses, centerFees } = withInvoiceRound(round);
      const cells = breakdownCellValues(
        withInvoiceItems(entries, expenses, centerFees).payment[1],
        S
      );
      const cf = cellsOf(billedCenterFeeLines(centerFees), S);
      expectCells(cells.bill, cf, 'センターフィ 請求');
      expectCells(cells.pay, cf, 'センターフィ 支払');
      expectCells(cells.diff, nulls(S), 'センターフィ 差額');
      // 値そのもの（合計・データ元別・税率別）。
      const at = (s: DataSource) => 5 + S.indexOf(s);
      for (const kind of ['bill', 'pay'] as const) {
        expect(cells[kind][0]).toBe(expected.tableTotal);
        for (const s of S)
          expect(cells[kind][at(s)], `${kind} ${s}`).toBe(
            expected.bySource[s] ?? 0
          );
        TAX_COLUMNS.forEach((t, i) =>
          expect(cells[kind][1 + i], `${kind} ${t}`).toBe(
            expected.byTax[t] ?? 0
          )
        );
        expect(cells[kind][at('手入力')]).toBe(0);
      }
    });

    it('税抜金額　計＝追加口　計＋センターフィ＋拡売費　計（請求・支払の全セル）', () => {
      const { entries, expenses, centerFees } = withInvoiceRound(round);
      const cells = withInvoiceItems(entries, expenses, centerFees).payment.map(
        (i) => breakdownCellValues(i, S)
      );
      for (const kind of ['bill', 'pay'] as const) {
        cells[3][kind].forEach((v, i) =>
          expect(v as number, `${kind}[${i}]`).toBeCloseTo(
            (cells[0][kind][i] as number) +
              (cells[1][kind][i] as number) +
              (cells[2][kind][i] as number),
            6
          )
        );
      }
      expect(cells[3].pay[0] as number).toBeCloseTo(
        (cells[0].pay[0] as number) +
          expected.tableTotal +
          (cells[2].pay[0] as number),
        6
      );
    });

    it('追加口明細を直しても、合計表のセンターフィは変わらない（追加口明細から求めない）', () => {
      const { entries, expenses, centerFees } = withInvoiceRound(round);
      const row = entries.find(
        (r) => !r.isTotal && num(r.payCases) > 1
      ) as AdditionalEntryData;
      row.payCases = num(row.payCases) - 1;
      applyEntryManualEdit(row);
      const cells = breakdownCellValues(
        withInvoiceItems(entries, expenses, centerFees).payment[1],
        S
      );
      expect(cells.pay[0]).toBe(expected.tableTotal);
      assertWithInvoiceTables(
        entries,
        expenses,
        centerFees,
        `支払回数${round} 追加口編集後`
      );
    });

    it('支払情報サマリのセンターフィ額は今のまま（追加口明細の社外売上高単価×数量×センターフィ率の合計）', () => {
      const { entries } = withInvoiceRound(round);
      const summary = computeEntryCenterFeeTotal(entries);
      expect(summary).toBe(expected.summary);
      expect(summary).toBe(
        centerFeeLines(entries).reduce((s, l) => s + l.amount, 0)
      );
      // サマリと合計表のセンターフィは別の値になる。
      expect(summary).not.toBe(expected.tableTotal);
    });
  });
});

describe('支払詳細(追加口請求書有)：手で直した明細', () => {
  describe.each(WITH_INVOICE_PAYMENT_ROUNDS)('支払回数%s', (round) => {
    const importedSources = sourcesOf(withInvoiceRound(round).entries).filter(
      (s) => s !== '手入力'
    ) as DataSource[];

    it.each(importedSources)(
      '追加口明細：%s の明細の支払ケースを直すと手入力になり、データ元別の列が手入力へ移る',
      (source) => {
        const { entries, expenses, centerFees } = withInvoiceRound(round);
        const row = entries.find(
          (r) => r.dataSource === source && num(r.payCases) > 0
        ) as AdditionalEntryData;
        const before = expectedWithInvoice(entries, expenses, centerFees).entry
          .pay;
        const oldPay = num(row.payAmount);
        // 画面のセル編集と同じ：値を書き換えてから編集後の処理を呼ぶ。
        row.payCases = num(row.payCases) - 1;
        applyEntryManualEdit(row);
        expect(row.dataSource).toBe('手入力');
        expect(row.originDataSource).toBe(source);
        const newPay = num(row.payAmount);
        expect(newPay).not.toBe(oldPay);
        const after = assertWithInvoiceTables(
          entries,
          expenses,
          centerFees,
          `支払回数${round} 編集後`
        ).entry.pay;
        const S = WITH_INVOICE_DATA_SOURCE_COLUMNS;
        const at = (s: string) => 5 + S.indexOf(s as DataSource);
        expect(after[at(source)]).toBeCloseTo(before[at(source)] - oldPay, 6);
        expect(after[at('手入力')]).toBeCloseTo(
          before[at('手入力')] + newPay,
          6
        );
      }
    );

    it('追加口明細：手入力の明細を直しても手入力のまま（元のデータ元を持たない）', () => {
      const { entries } = withInvoiceRound(round);
      const row = entries.find(
        (r) => r.dataSource === '手入力' && !r.originDataSource
      ) as AdditionalEntryData;
      row.summary1 = '確認済み';
      expect(applyEntryManualEdit(row)).toBe(false);
      expect(row.dataSource).toBe('手入力');
      expect(row.originDataSource).toBeUndefined();
    });

    const expenseSources = sourcesOf(
      expenseDetailRows(withInvoiceRound(round).expenses).filter(
        (r) => !r.isNetUnapproved
      )
    ).filter((s) => s !== '手入力') as DataSource[];

    it.each(expenseSources)(
      '拡売費明細：%s の明細の支払金額を直すと手入力になり、データ元別の列が手入力へ移る',
      (source) => {
        const { entries, expenses, centerFees } = withInvoiceRound(round);
        const row = expenses.find(
          (r) =>
            !r.isGroup &&
            !r.isNetUnapproved &&
            r.costSplit !== '分割先' &&
            r.dataSource === source
        ) as ExpenseRow;
        const before = expectedWithInvoice(entries, expenses, centerFees)
          .expense.pay;
        const oldPay = num(row.payAmount);
        row.payAmount = oldPay + 1000;
        markExpenseManualEdit(expenses, row);
        expect(row.dataSource).toBe('手入力');
        expect(row.originDataSource).toBe(source);
        const after = assertWithInvoiceTables(
          entries,
          expenses,
          centerFees,
          `支払回数${round} 拡売費編集後`
        ).expense.pay;
        const S = WITH_INVOICE_DATA_SOURCE_COLUMNS;
        const at = (s: string) => 5 + S.indexOf(s as DataSource);
        expect(after[at(source)]).toBeCloseTo(before[at(source)] - oldPay, 6);
        expect(after[at('手入力')]).toBeCloseTo(
          before[at('手入力')] + oldPay + 1000,
          6
        );
      }
    );
  });

  it('分割の枝番行を直すと、親の明細と枝番行が手入力になる', () => {
    const { expenses } = withInvoiceRound('1');
    const branch = expenses.find(
      (r) => r.lineNo === '1-1' && !r.isNetUnapproved
    ) as ExpenseRow;
    const parent = expenses.find(
      (r) => r.lineNo === 1 && !r.isNetUnapproved
    ) as ExpenseRow;
    expect(parent.dataSource).toBe('請求EDI');
    branch.payAmount = 25000;
    const changed = markExpenseManualEdit(expenses, branch);
    expect(parent.dataSource).toBe('手入力');
    expect(parent.originDataSource).toBe('請求EDI');
    expect(changed).toContain(parent);
    expect(
      expenses
        .filter((r) => String(r.lineNo).startsWith('1-'))
        .every((r) => r.dataSource === '手入力')
    ).toBe(true);
  });
});

describe('支払詳細(追加口請求書有)：計画の種類と自動振替', () => {
  it('一般卸メッシュの計画で請求NET＜計画NETの請求EDI・AIC入力の明細は、支払NET（追加口分）が計画NET（データ元はそのまま・赤くしない）', () => {
    const autoRows = WITH_INVOICE_PAYMENT_ROUNDS.flatMap((round) =>
      createWithInvoiceEntryRows(round).filter(
        (r) =>
          r.planType === '一般卸メッシュ' &&
          (r.dataSource === '請求EDI' || r.dataSource === 'AIC入力') &&
          num(r.billNet) < num(r.planNet)
      )
    );
    expect(autoRows.map((r) => r.dataSource).sort()).toEqual([
      'AIC入力',
      'AIC入力',
      '請求EDI',
      '請求EDI',
    ]);
    for (const r of autoRows) {
      expect(num(r.addNet)).toBe(num(r.planNet));
      expect(num(r.payNet)).toBe(num(r.billNet));
      expect(num(r.expAmount)).toBeGreaterThan(0);
      expect(isEntryAlertRow(r)).toBe(false);
    }
  });

  it('自動振替は請求EDI・AIC入力の明細だけに行い、手入力・サマリ商品の計画の明細には行わない', () => {
    const base = createWithInvoiceEntryRows('3').find(
      (r) => r.lineNo === 2
    ) as AdditionalEntryData;
    const rowOf = (fields: Partial<AdditionalEntryData>) => ({
      ...base,
      addNet: base.billNet,
      ...fields,
    });
    for (const source of ['請求EDI', 'AIC入力'] as const) {
      const row = rowOf({ dataSource: source });
      expect(applyAutoTransfer(row)).toBe(true);
      expect(row.addNet).toBe(base.planNet);
      expect(row.dataSource).toBe(source);
    }
    const manual = rowOf({ dataSource: '手入力' });
    expect(applyAutoTransfer(manual)).toBe(false);
    expect(manual.addNet).toBe(base.billNet);
    const summaryPlan = rowOf({
      dataSource: '請求EDI',
      planType: 'サマリ商品',
    });
    expect(applyAutoTransfer(summaryPlan)).toBe(false);
    expect(summaryPlan.addNet).toBe(base.billNet);
  });

  it('サマリ商品の計画で請求NET＜計画NETの明細と、計画に無いサマリ商品の明細（計画NETは空欄）は赤', () => {
    const rows = createWithInvoiceEntryRows('3');
    const red = rows.filter((r) => isEntryAlertRow(r)).map((r) => r.lineNo);
    // No.4（B③）・No.7（B①）・No.10（計画に無い商品）
    expect(red).toEqual([4, 7, 10]);
    expect(rows.find((r) => r.lineNo === 10)?.planNet).toBe('');
  });

  it('B③は支払NET（全体）だけを計画NETにし、拡売費バラ単価（NET未承認）はマイナスになる', () => {
    const row = createWithInvoiceEntryRows('3').find(
      (r) => r.lineNo === 4
    ) as AdditionalEntryData;
    expect(num(row.payNet)).toBe(num(row.planNet));
    expect(num(row.addNet)).toBe(num(row.billNet));
    expect(num(row.expUnit)).toBe(num(row.billNet) - num(row.planNet));
    expect(num(row.expAmount)).toBeLessThan(0);
  });
});

describe('支払詳細(追加口請求書有)：手で直した追加口明細から出た未承認NETの明細', () => {
  // 請求EDI・AIC入力の追加口明細で、未承認NETの明細を持つもの（一般卸メッシュの自動振替）。
  const cases = WITH_INVOICE_PAYMENT_ROUNDS.flatMap((round) =>
    withInvoiceRound(round)
      .entries.filter(
        (r) => r.dataSource !== '手入力' && num(r.expAmount) !== 0
      )
      .map((r) => [round, r.lineNo, r.dataSource] as const)
  );

  it('対象の明細がある（1回目 No.9、2回目 No.2、3回目 No.2・No.6）', () => {
    expect(cases.map(([round, lineNo]) => `${round}-${lineNo}`)).toEqual([
      '1-9',
      '2-2',
      '3-2',
      '3-6',
    ]);
  });

  it.each(cases)(
    '支払回数%s No.%s（%s）を直すと、未承認NETの明細も手入力になり、拡売費　計のデータ元別が明細の和と一致する',
    (round, lineNo, source) => {
      const { entries, expenses, centerFees } = withInvoiceRound(round);
      const row = entries.find(
        (r) => r.lineNo === lineNo
      ) as AdditionalEntryData;
      const netRow = expenses.find(
        (r) => r.isNetUnapproved && r.product === row.productName
      ) as ExpenseRow;
      expect(netRow.dataSource).toBe(source);
      const S = WITH_INVOICE_DATA_SOURCE_COLUMNS;
      const at = (s: string) => 5 + S.indexOf(s as DataSource);
      const before = expectedWithInvoice(entries, expenses, centerFees).expense
        .pay;
      const oldNet = num(netRow.payAmount);
      // 画面と同じ：追加口明細を直す → 連動データを作る → 未承認NETの明細へ当てる。
      row.payCases = num(row.payCases) - 1;
      applyEntryManualEdit(row);
      linkNetUnapprovedRows(expenses, netUnapprovedLinkOf(entries, round));
      expect(netRow.dataSource).toBe('手入力');
      expect(netRow.originDataSource).toBe(source);
      const newNet = entries
        .filter((r) => r.productName === row.productName)
        .reduce((s, r) => s + num(r.expAmount), 0);
      expect(num(netRow.payAmount)).toBe(newNet);
      const after = assertWithInvoiceTables(
        entries,
        expenses,
        centerFees,
        `支払回数${round} No.${lineNo} 編集後`
      ).expense.pay;
      expect(after[at(source)]).toBeCloseTo(before[at(source)] - oldNet, 6);
      expect(after[at('手入力')]).toBeCloseTo(before[at('手入力')] + newNet, 6);
    }
  );

  it('差の出ていない追加口明細を直しても、同じ商品の未承認NETの明細のデータ元は変わらない', () => {
    const { entries, expenses } = withInvoiceRound('1');
    // No.2（ラテ、差0）を直す。ラテの未承認NETは No.9（請求EDI の自動振替）から出ている。
    const row = entries.find((r) => r.lineNo === 2) as AdditionalEntryData;
    row.summary1 = '確認済み';
    applyEntryManualEdit(row);
    linkNetUnapprovedRows(expenses, netUnapprovedLinkOf(entries, '1'));
    const netRow = expenses.find(
      (r) => r.isNetUnapproved && r.product === row.productName
    ) as ExpenseRow;
    expect(netRow.dataSource).toBe('請求EDI');
  });
});

describe('支払詳細(追加口請求書有)：明細追加・追加口処理で足した明細', () => {
  const form = (fields: Partial<EntryFormValues>): EntryFormValues => ({
    productName: '',
    payCases: '10',
    payLoose: '',
    addNet: '',
    payNet: '',
    matchType: '',
    expProcess: '-',
    summary1: '',
    summary2: '',
    funcCheck: false,
    finalNet: '',
    billNet: '',
    cases: '',
    loose: '',
    unitPrice: '',
    amount: '',
    billPage: '',
    billDetailNo: '',
    retailerName: '',
    ...fields,
  });

  it('サマリ商品の計画の商品で、請求NETが計画NETを下回ると赤く表示する（自動振替はしない）', () => {
    const row = createManualEntryRow(
      form({
        productName: 'ワンダ ボトルコーヒー微糖500mL24本',
        billNet: '93',
        addNet: '93',
        payNet: '93',
      }),
      12
    );
    expect(row).toMatchObject({
      dataSource: '手入力',
      planType: 'サマリ商品',
      planNet: 95,
      seihan: 168,
      billNet: 93,
      addNet: 93,
    });
    expect(isEntryAlertRow(row)).toBe(true);
    expect(applyAutoTransfer(row)).toBe(false);
    expect(row.addNet).toBe(93);
  });

  it('一般卸メッシュの計画の商品は、請求NETが計画NETを下回っても赤くせず、手入力のため自動振替もしない', () => {
    const row = createManualEntryRow(
      form({
        productName: 'カルピスウォーター500mL24本',
        billNet: '66',
        addNet: '66',
        payNet: '66',
      }),
      12
    );
    expect(row.planType).toBe('一般卸メッシュ');
    expect(row.planNet).toBe(70);
    expect(isEntryAlertRow(row)).toBe(false);
    expect(applyAutoTransfer(row)).toBe(false);
    expect(row.addNet).toBe(66);
  });

  it('請求NETを空欄で追加すると空欄のまま（バラ単価・金額も計算しない）で、赤くしない', () => {
    const row = createManualEntryRow(
      form({ productName: 'ワンダ ボトルコーヒー微糖500mL24本', cases: '1' }),
      12
    );
    expect(row.billNet).toBe('');
    expect(row.unitPrice).toBe('');
    expect(row.amount).toBe('');
    expect(isEntryAlertRow(row)).toBe(false);
  });

  it('計画に無いサマリ商品はマスタのNETを計画NETとし、計画の種類を持たない（赤くしない）', () => {
    const row = createManualEntryRow(
      form({ productName: 'ドデカミン500mL24本', billNet: '40' }),
      12
    );
    expect(row.planType).toBeUndefined();
    // マスタのNET：共通の商品マスタ 44 をこの画面の計画の水準（2倍）にそろえた値
    //（→ withInvoiceMasterValuesOf）。
    expect(row.planNet).toBe(88);
    expect(isEntryAlertRow(row)).toBe(false);
  });

  it('支払NETを入れずに明細追加した明細は支払NETがマスタNETになり、未承認NETへは流れず、合計表は明細の合計と一致する', () => {
    const { entries, expenses, centerFees } = withInvoiceRound(
      WITH_INVOICE_DEFAULT_ROUND
    );
    const before = netUnapprovedLinkOf(entries);
    const row = createManualEntryRow(
      form({
        productName: 'ワンダ ボトルコーヒー微糖500mL24本',
        billNet: '93',
        cases: '1',
        payCases: '1',
      }),
      12
    );
    expect(row.addNet).toBe(row.payNet);
    expect(row.expAmount).toBe(0);
    entries.push(row);
    const after = netUnapprovedLinkOf(entries);
    expect(after.total).toBe(before.total);
    assertWithInvoiceTables(
      entries,
      expenses,
      centerFees,
      '明細追加（マスタNET）の後'
    );
  });

  it('追加口処理で足した明細も計画の種類を持ち、計画の値で作る', () => {
    const row = createEntryRowFromExpense(
      {
        productName: 'ワンダ ボトルコーヒー微糖500mL24本',
        billAmount: 7300,
        payAmount: 7300,
      },
      12
    );
    expect(row).toMatchObject({
      dataSource: '手入力',
      planType: 'サマリ商品',
      planNet: 95,
      billNet: 95,
      fromExpense: true,
    });
    // 請求NET＝計画NETのため赤くしない（計画NETを下回れば赤くなる）。
    expect(isEntryAlertRow(row)).toBe(false);
    expect(isEntryAlertRow({ ...row, billNet: 90 })).toBe(true);
  });
});

// ── 手入力の明細の請求情報・請求書情報（Change 14-1・補足1-5 b21・b24・b30） ──
// 元のデータ元が手入力の明細だけ、請求情報・請求書情報をグリッドで直せる。
// 直したあとも赤表示・差額・合計表は明細の値で計算し直す。
describe('支払詳細(追加口請求書有)：手入力の明細の請求情報・請求書情報を直す', () => {
  const MANUAL_ONLY = [
    'billNet',
    'cases',
    'loose',
    'unitPrice',
    'amount',
    'billPage',
    'billDetailNo',
    'retailerName',
  ];

  // 画面のセル編集と同じ：値を書き換えてから編集後の処理を呼ぶ。
  const editCell = (
    row: AdditionalEntryData,
    field: keyof AdditionalEntryData,
    value: unknown
  ) => {
    (row as unknown as Record<string, unknown>)[field] = value;
    applyEntryCellEdit(row, field);
  };
  // 期待値（補足2-1）：バラ単価＝社外売上高単価－請求NET、金額＝（入数×ケース＋バラ）×バラ単価。
  const qtyOf = (r: AdditionalEntryData) =>
    num(r.capacity) * num(r.cases) + num(r.loose);

  const round3 = () => withInvoiceRound(WITH_INVOICE_DEFAULT_ROUND);
  const manualRowOf = (entries: AdditionalEntryData[]) =>
    entries.find(
      (r) => !r.isTotal && r.dataSource === '手入力' && !r.originDataSource
    ) as AdditionalEntryData;

  describe.each(WITH_INVOICE_PAYMENT_ROUNDS)('支払回数%s', (round) => {
    it('元のデータ元が手入力の明細だけ請求情報・請求書情報を直せ、ほかの明細は直せない', () => {
      const { entries } = withInvoiceRound(round);
      for (const row of entries.filter((r) => !r.isTotal)) {
        const manual = originDataSourceOf(row) === '手入力';
        expect(isManualOriginEntry(row)).toBe(manual);
        for (const f of MANUAL_ONLY)
          expect(isEntryCellEditable(row, f), `No.${row.lineNo} ${f}`).toBe(
            manual
          );
      }
      const total = entries.find((r) => r.isTotal);
      if (total)
        for (const f of MANUAL_ONLY)
          expect(isEntryCellEditable(total, f)).toBe(false);
    });

    // この支払回数にある取込の明細のデータ元（請求EDI・AIC入力）。
    const importedEntrySources = sourcesOf(
      withInvoiceRound(round).entries.filter((r) => !r.isTotal)
    ).filter((s) => s !== '手入力') as DataSource[];

    it('取込の明細（請求EDI・AIC入力）と、元から手入力の明細がある', () => {
      expect(importedEntrySources.length).toBeGreaterThan(0);
      expect(manualRowOf(withInvoiceRound(round).entries)).toBeDefined();
    });

    it.each(importedEntrySources)(
      '%s の明細は、手で直して手入力になっても請求情報・請求書情報を直せない',
      (source) => {
        const { entries } = withInvoiceRound(round);
        const row = entries.find(
          (r) => r.dataSource === source
        ) as AdditionalEntryData;
        expect(row).toBeDefined();
        row.summary1 = '確認済み';
        applyEntryManualEdit(row);
        expect(row.dataSource).toBe('手入力');
        for (const f of MANUAL_ONLY)
          expect(isEntryCellEditable(row, f)).toBe(false);
      }
    );

    it('手入力の明細の請求NET・ケース・バラ・請求書情報を直すと、計算式で求め直し、合計表は明細の合計と一致する', () => {
      const { entries, expenses, centerFees } = withInvoiceRound(round);
      const row = manualRowOf(entries);
      editCell(row, 'billNet', num(row.planNet) - 2);
      editCell(row, 'cases', 3);
      editCell(row, 'loose', 5);
      editCell(row, 'billPage', '③09');
      editCell(row, 'billDetailNo', '0099');
      editCell(row, 'retailerName', '手入力販売店');
      const unit = num(row.seihan) - (num(row.planNet) - 2);
      expect(row.unitPrice).toBeCloseTo(unit, 6);
      expect(row.amount).toBe(Math.round(qtyOf(row) * unit));
      expect(row.diff).toBe(num(row.amount) - num(row.payAmount));
      expect(row.dataSource).toBe('手入力');
      expect(row).toMatchObject({
        billPage: '③09',
        billDetailNo: '0099',
        retailerName: '手入力販売店',
      });
      // サマリ商品の計画は請求NETが計画NETを下回ると赤、一般卸メッシュは赤くしない。
      expect(isEntryAlertRow(row)).toBe(row.planType !== '一般卸メッシュ');
      assertWithInvoiceTables(
        entries,
        expenses,
        centerFees,
        `支払回数${round} 手入力編集後`
      );
    });
  });

  it('全支払回数で、請求EDI・AIC入力の両方の明細を確かめている', () => {
    const all = WITH_INVOICE_PAYMENT_ROUNDS.flatMap((round) =>
      withInvoiceRound(round).entries.filter((r) => !r.isTotal)
    );
    expect(sourcesOf(all)).toEqual(['AIC入力', '手入力', '請求EDI'].sort());
  });

  describe('セルを空欄にする（Delete・Backspace）', () => {
    // 期待値：計算式の値（計算できなければ空欄）。差額は金額と支払金額に合わせる（空欄は0）。
    const expectConsistent = (row: AdditionalEntryData) => {
      const U = row.seihan === '' ? null : num(row.seihan);
      const W =
        row.billNet === '' || row.billNet == null ? null : num(row.billNet);
      if (!row.unitPriceManual)
        expect(row.unitPrice).toEqual(U !== null && W !== null ? U - W : '');
      const hasQty =
        !(row.cases === '' || row.cases == null) ||
        !(row.loose === '' || row.loose == null);
      const H =
        row.unitPrice === '' || row.unitPrice == null
          ? null
          : num(row.unitPrice);
      if (!row.amountManual)
        expect(row.amount).toEqual(
          H !== null && hasQty ? Math.round(qtyOf(row) * H) : ''
        );
      expect(row.diff).toBe(num(row.amount) - num(row.payAmount));
    };
    const prepared = () => {
      const { entries, expenses, centerFees } = round3();
      const row = manualRowOf(entries);
      editCell(row, 'cases', 2);
      editCell(row, 'loose', 4);
      editCell(row, 'unitPrice', 50.5);
      editCell(row, 'amount', 12345);
      return { entries, expenses, centerFees, row };
    };

    it.each([null, ''])(
      'バラ単価を空欄（%j）にすると計算した値に戻り、金額も計算し直す',
      (blank) => {
        const { entries, expenses, centerFees, row } = prepared();
        editCell(row, 'unitPrice', blank);
        expect(row.unitPriceManual).toBe(false);
        expect(row.amountManual).toBe(false);
        expect(row.unitPrice).toBeCloseTo(
          num(row.seihan) - num(row.billNet),
          6
        );
        expectConsistent(row);
        assertWithInvoiceTables(
          entries,
          expenses,
          centerFees,
          'バラ単価を空欄にした後'
        );
      }
    );

    it('金額を空欄にすると計算した値に戻り（手で直したバラ単価は残す）、差額も合わせる', () => {
      const { entries, expenses, centerFees, row } = prepared();
      editCell(row, 'unitPrice', 50.5);
      editCell(row, 'amount', 99999);
      editCell(row, 'amount', null);
      expect(row.amountManual).toBe(false);
      expect(row.unitPrice).toBe(50.5);
      expect(row.amount).toBe(Math.round(qtyOf(row) * 50.5));
      expectConsistent(row);
      assertWithInvoiceTables(
        entries,
        expenses,
        centerFees,
        '金額を空欄にした後'
      );
    });

    it('請求NETを空欄にすると、バラ単価・金額は計算できないため空欄になり、差額は金額0として合わせる', () => {
      const { entries, expenses, centerFees, row } = prepared();
      editCell(row, 'billNet', null);
      expect(row.unitPrice).toBe('');
      expect(row.amount).toBe('');
      expect(row.diff).toBe(-num(row.payAmount));
      expectConsistent(row);
      assertWithInvoiceTables(
        entries,
        expenses,
        centerFees,
        '請求NETを空欄にした後'
      );
      // 請求NETを入れ直すと計算した値に戻る。
      editCell(row, 'billNet', 60);
      expect(row.unitPrice).toBe(num(row.seihan) - 60);
      expectConsistent(row);
    });

    it('ケースを空欄にするとバラだけで金額を計算し、ケース・バラとも空欄にすると金額は空欄になる', () => {
      const { entries, expenses, centerFees, row } = prepared();
      editCell(row, 'cases', null);
      expect(row.amount).toBe(Math.round(4 * num(row.unitPrice)));
      expectConsistent(row);
      editCell(row, 'loose', '');
      expect(row.amount).toBe('');
      expectConsistent(row);
      assertWithInvoiceTables(
        entries,
        expenses,
        centerFees,
        'ケース・バラを空欄にした後'
      );
    });

    it('バラを空欄にするとケースだけで金額を計算する', () => {
      const { row } = prepared();
      editCell(row, 'loose', null);
      expect(row.amount).toBe(
        Math.round(num(row.capacity) * 2 * num(row.unitPrice))
      );
      expectConsistent(row);
    });

    it('函数無効チェックONの明細は、空欄にした項目のほかは変えない', () => {
      const { row } = prepared();
      row.funcCheck = true;
      const before = { unitPrice: row.unitPrice, amount: row.amount };
      editCell(row, 'billNet', null);
      expect(row.billNet).toBeNull();
      expect(row).toMatchObject(before);
    });
  });

  it('計算した値と同じ値を入れる（元に戻す（Undo）で計算値に戻す）と、手で直した値として扱わない', () => {
    const { row } = (() => {
      const { entries } = round3();
      return { row: manualRowOf(entries) };
    })();
    editCell(row, 'cases', 2);
    const calcUnit = num(row.unitPrice);
    editCell(row, 'unitPrice', 50.5);
    expect(row.unitPriceManual).toBe(true);
    // Undo：直す前の値（計算した値）に戻る
    editCell(row, 'unitPrice', calcUnit);
    expect(row.unitPriceManual).toBe(false);
    const calcAmount = num(row.amount);
    editCell(row, 'amount', 777);
    expect(row.amountManual).toBe(true);
    editCell(row, 'amount', calcAmount);
    expect(row.amountManual).toBe(false);
    // 以後はケースを直すと金額が計算式に追随する（手で直した値として残らない）。
    editCell(row, 'cases', 3);
    expect(row.amount).toBe(Math.round(qtyOf(row) * calcUnit));
  });

  it('バラ単価・金額は計算した値を手で直せ、元になる項目を直すまで残す', () => {
    const { entries, expenses, centerFees } = round3();
    const row = manualRowOf(entries);
    editCell(row, 'cases', 2);
    editCell(row, 'loose', 4);
    const qty = qtyOf(row);

    // バラ単価を直す → 直した値を残し、金額はその単価で計算する。
    editCell(row, 'unitPrice', 50.5);
    expect(row.unitPrice).toBe(50.5);
    expect(row.amount).toBe(Math.round(qty * 50.5));
    // ケースを直しても、直したバラ単価は残り、金額は計算し直す。
    editCell(row, 'cases', 1);
    expect(row.unitPrice).toBe(50.5);
    expect(row.amount).toBe(Math.round(qtyOf(row) * 50.5));

    // 金額を直す → 直した値を残す。支払情報など他の項目を直しても残る。
    editCell(row, 'amount', 12345);
    editCell(row, 'payCases', num(row.payCases) + 1);
    expect(row.amount).toBe(12345);
    expect(row.diff).toBe(12345 - num(row.payAmount));
    assertWithInvoiceTables(
      entries,
      expenses,
      centerFees,
      '金額を手で直した後'
    );

    // バラを直す → 直した金額は捨て、計算し直す（バラ単価は残す）。
    editCell(row, 'loose', 6);
    expect(row.amount).toBe(Math.round(qtyOf(row) * 50.5));

    // 請求NETを直す → 直したバラ単価・金額とも捨て、計算し直す。
    editCell(row, 'amount', 999);
    editCell(row, 'billNet', 60);
    expect(row.unitPrice).toBeCloseTo(num(row.seihan) - 60, 6);
    expect(row.amount).toBe(Math.round(qtyOf(row) * (num(row.seihan) - 60)));
    assertWithInvoiceTables(entries, expenses, centerFees, '請求NETを直した後');
  });

  it('明細追加で入れたケース・バラ・バラ単価・金額を使い、入れたバラ単価・金額は手で直した値として残す', () => {
    const base = {
      productName: 'ワンダ ボトルコーヒー微糖500mL24本',
      payCases: '10',
      payLoose: '',
      addNet: '',
      payNet: '',
      matchType: '',
      expProcess: '-',
      summary1: '',
      summary2: '',
      funcCheck: false,
      finalNet: '',
      billNet: '93',
      cases: '2',
      loose: '3',
      unitPrice: '',
      amount: '',
      billPage: '③05',
      billDetailNo: '0012',
      retailerName: 'テスト販売店',
    } as EntryFormValues;
    const calc = createManualEntryRow(base, 12);
    expect(calc).toMatchObject({ cases: 2, loose: 3, billNet: 93 });
    expect(calc.unitPrice).toBeCloseTo(168 - 93, 6);
    expect(calc.amount).toBe(Math.round(qtyOf(calc) * (168 - 93)));
    expect(calc.unitPriceManual).toBeFalsy();

    const typed = createManualEntryRow(
      { ...base, unitPrice: '70', amount: '3500' },
      12
    );
    expect(typed).toMatchObject({
      unitPrice: 70,
      amount: 3500,
      unitPriceManual: true,
      amountManual: true,
    });
    expect(typed.diff).toBe(3500 - num(typed.payAmount));
    expect(isManualOriginEntry(typed)).toBe(true);
  });

  it('追加口処理で足した明細（手入力）も直せる', () => {
    const row = createEntryRowFromExpense(
      {
        productName: 'ワンダ ボトルコーヒー微糖500mL24本',
        billAmount: 7300,
        payAmount: 7300,
      },
      12
    );
    for (const f of MANUAL_ONLY) expect(isEntryCellEditable(row, f)).toBe(true);
  });

  describe('拡売費明細の請求書番号・請求書ページ', () => {
    it.each(WITH_INVOICE_PAYMENT_ROUNDS)(
      '支払回数%s：元のデータ元が手入力の明細だけ直せ、請求EDI・AIC入力・未承認NET・枝番行は直せない',
      (round) => {
        const { expenses } = withInvoiceRound(round);
        for (const r of expenses) {
          const expected =
            !r.isGroup &&
            !r.isTotal &&
            r.costSplit !== '分割先' &&
            !r.isNetUnapproved &&
            originDataSourceOf(r) === '手入力';
          expect(isExpenseInvoiceRefEditable(r, true), `No.${r.lineNo}`).toBe(
            expected
          );
          // 入力欄を持たない画面（商流販売店紐づけなし）は直せない。
          expect(isExpenseInvoiceRefEditable(r, false)).toBe(false);
        }
      }
    );

    it.each(WITHOUT_INVOICE_PAYMENT_ROUNDS)(
      '請求書無の支払回数%s：紙の請求書を手入力するため、元のデータ元が手入力の明細だけ直せる（C80）',
      (round) => {
        const { expenses } = withoutInvoiceRound(round);
        for (const r of expenses) {
          const expected =
            !r.isGroup &&
            !r.isTotal &&
            r.costSplit !== '分割先' &&
            originDataSourceOf(r) === '手入力';
          expect(isExpenseInvoiceRefEditable(r, true), `No.${r.lineNo}`).toBe(
            expected
          );
        }
      }
    );

    it('請求EDI・AIC入力の明細は、手で直して手入力になっても直せない', () => {
      for (const round of WITH_INVOICE_PAYMENT_ROUNDS) {
        const { expenses } = withInvoiceRound(round);
        const imported = expenseDetailRows(expenses).filter(
          (r) =>
            !r.isNetUnapproved &&
            (r.dataSource === '請求EDI' || r.dataSource === 'AIC入力')
        );
        for (const r of imported) {
          r.payAmount = num(r.payAmount) + 1;
          markExpenseManualEdit(expenses, r);
          expect(r.dataSource).toBe('手入力');
          expect(isExpenseInvoiceRefEditable(r, true)).toBe(false);
        }
      }
    });

    const expenseForm = (
      fields: Partial<ExpenseFormValues>
    ): ExpenseFormValues => ({
      billName: 'テスト請求',
      billNote: '',
      planExpContent: '',
      product: '',
      billAmount: '5000',
      payAmount: '',
      matchType: '',
      mgmtClass: '',
      mgmtCode: '',
      measureClass: '',
      measureCode: '',
      summary1: '',
      summary2: '',
      taxClass: '課税10%:1',
      ...fields,
    });

    it('明細追加（請求書有）で入れた請求書番号・ページを持つ手入力の明細になり、あとからグリッドでも直せる', () => {
      const row = createManualExpenseRow(
        expenseForm({ billNo: 'INV-0099', billPage: '③10' }),
        6
      );
      expect(row).toMatchObject({
        lineNo: 6,
        dataSource: '手入力',
        billNo: 'INV-0099',
        billPage: '③10',
        billAmount: 5000,
        payAmount: 5000,
      });
      expect(row.originDataSource).toBeUndefined();
      expect(isExpenseInvoiceRefEditable(row, true)).toBe(true);
      // 足した明細を含めても、合計表は明細の合計と一致する。
      const { entries, expenses, centerFees } = round3();
      assertWithInvoiceTables(
        entries,
        [...expenses, row],
        centerFees,
        '明細追加の後'
      );
    });

    it('請求書番号・ページを空欄のまま足した明細は空欄で、あとからグリッドで直せる', () => {
      const row = createManualExpenseRow(expenseForm({}), 6);
      expect(row.billNo).toBe('');
      expect(row.billPage).toBe('');
      expect(isExpenseInvoiceRefEditable(row, true)).toBe(true);
    });

    it('手入力の明細の請求書番号・ページを直しても、合計表は明細の合計と一致する', () => {
      const { entries, expenses, centerFees } = round3();
      const row = expenseDetailRows(expenses).find((r) =>
        isExpenseInvoiceRefEditable(r, true)
      ) as ExpenseRow;
      expect(row).toBeDefined();
      row.billNo = 'TEST-001';
      row.billPage = '③99';
      expect(markExpenseManualEdit(expenses, row)).toEqual([]);
      expect(row.dataSource).toBe('手入力');
      assertWithInvoiceTables(
        entries,
        expenses,
        centerFees,
        '請求書番号を直した後'
      );
    });
  });
});

// 支払情報サマリの期待値（全支払回数・独立した計算）。
const expectedWithInvoiceSummary = (
  rounds: { entries: AdditionalEntryData[]; expenses: ExpenseRow[] }[],
  splitRound1: boolean
) => {
  const entries = rounds.flatMap((r) => r.entries);
  const payFuncRaw = entries
    .filter((e) => e.funcCheck !== true)
    .reduce(
      (s, e) =>
        s +
        num(e.payCases) +
        (num(e.capacity) > 0 ? num(e.payLoose) / num(e.capacity) : 0),
      0
    );
  const addEntry = entries.reduce((s, e) => s + num(e.addAmount), 0);
  // 未承認NETの明細の支払金額＝同じ回・同じサマリ商品の追加口明細の拡売費金額（NET未承認）の合計
  //（手入力した明細は入力値）。未承認NETの明細が無いサマリ商品の拡売費金額も NET未承認に入る。
  let netUnapproved = 0;
  let linked = 0;
  for (const r of rounds) {
    const expByProduct = new Map<string, number>();
    r.entries.forEach((e) =>
      expByProduct.set(
        e.productName,
        (expByProduct.get(e.productName) ?? 0) + num(e.expAmount)
      )
    );
    for (const x of expenseDetailRows(r.expenses)) {
      const pay =
        x.isNetUnapproved && !x.payAmountManual
          ? (expByProduct.get(x.product) ?? num(x.payAmount))
          : num(x.payAmount);
      if (x.isNetUnapproved && x.mgmtClass === NET_MGMT_CLASS)
        netUnapproved += pay;
      else linked += pay;
    }
    for (const [product, amount] of expByProduct) {
      if (!r.expenses.some((x) => x.isNetUnapproved && x.product === product))
        netUnapproved += amount;
    }
  }
  let splitCases = 0;
  let splitAmount = 0;
  if (splitRound1) {
    for (const a of PREV_MONTH_SPLIT.allocations) {
      const e = rounds[0].entries.find(
        (r) => String(r.lineNo) === String(a.lineNo)
      );
      if (!e) continue;
      splitCases +=
        a.cases + (num(e.capacity) > 0 ? a.loose / num(e.capacity) : 0);
      splitAmount += Math.round(
        (a.cases * num(e.capacity) + a.loose) * num(e.addUnit)
      );
    }
  }
  const f = WITH_INVOICE_SUMMARY_FIXED_VALUES;
  const payFunc = Math.round(payFuncRaw) - Math.round(splitCases);
  const addEntryAfter = addEntry - splitAmount;
  const payNetSales = f.externalSales - addEntryAfter - netUnapproved;
  const sales = payNetSales - linked;
  const mgmtProfitAmount = f.mgmtProfitBasis + (sales - f.salesBasis);
  return {
    payFunc,
    addEntryAmount: addEntryAfter,
    promoNetUnapproved: netUnapproved,
    promoLinked: linked,
    payNetSales,
    sales,
    mgmtProfitAmount,
    addEntryRate: (addEntryAfter / f.externalSales) * 100,
    marginRate: ((f.deliveryAmount - payNetSales) / f.deliveryAmount) * 100,
    mgmtProfitRate: (mgmtProfitAmount / sales) * 100,
  };
};

// 画面と同じ集計（支払情報サマリ）。
const withInvoiceSummary = (
  rounds: { entries: AdditionalEntryData[]; expenses: ExpenseRow[] }[],
  splitByRound: Record<
    string,
    { allocations: typeof PREV_MONTH_SPLIT.allocations }
  >
) =>
  summaryPayValuesOf(
    aggregateSummaryDetails(
      rounds.map((r) => ({ entryRows: r.entries, expenseRows: r.expenses })),
      'with-invoice'
    ),
    WITH_INVOICE_SUMMARY_FIXED_VALUES,
    totalSplitOut(
      splitByRound,
      Object.fromEntries(rounds.map((r, i) => [String(i + 1), r.entries]))
    )
  );

const expectSummary = (
  actual: Record<string, number>,
  expected: Record<string, number>
) => {
  for (const [key, value] of Object.entries(expected)) {
    expect(actual[key], key).toBeCloseTo(value, 6);
  }
};

describe('支払詳細(追加口請求書有)：支払情報サマリ（全支払回数の合計）', () => {
  const initialSplit = { '1': PREV_MONTH_SPLIT };

  it('初期表示：3回分の明細の合計から、支払回数1の追加口分割（自部署負担分）を引く', () => {
    const rounds = WITH_INVOICE_PAYMENT_ROUNDS.map(withInvoiceRound);
    const actual = withInvoiceSummary(rounds, initialSplit);
    expectSummary(actual, expectedWithInvoiceSummary(rounds, true));
  });

  it('分割を取りやめると、明細の合計そのままになる', () => {
    const rounds = WITH_INVOICE_PAYMENT_ROUNDS.map(withInvoiceRound);
    expectSummary(
      withInvoiceSummary(rounds, {}),
      expectedWithInvoiceSummary(rounds, false)
    );
  });

  it('初期表示の比率が自然（追加口率 約42%・マージン率 約10%・管理利益率 25.2%・函数の差が小さい）', () => {
    const rounds = WITH_INVOICE_PAYMENT_ROUNDS.map(withInvoiceRound);
    const v = withInvoiceSummary(rounds, initialSplit);
    expect(v.addEntryRate).toBeGreaterThan(40);
    expect(v.addEntryRate).toBeLessThan(44);
    expect(v.marginRate).toBeGreaterThan(9);
    expect(v.marginRate).toBeLessThan(11);
    expect(v.mgmtProfitRate).toBeCloseTo(25.2, 1);
    expect(Math.abs(WITH_INVOICE_ACTUAL_FUNC - v.payFunc)).toBeLessThan(10);
    const centerFee = rounds
      .flatMap((r) => centerFeeLines(r.entries))
      .reduce((s, l) => s + l.amount, 0);
    const centerFeeRate =
      (centerFee / WITH_INVOICE_SUMMARY_FIXED_VALUES.deliveryAmount) * 100;
    expect(centerFeeRate).toBeGreaterThan(2);
    expect(centerFeeRate).toBeLessThan(3);
  });

  it.each(WITH_INVOICE_PAYMENT_ROUNDS)(
    '支払回数%s の明細を直すと、サマリも明細の合計に追従する',
    (round) => {
      const rounds = WITH_INVOICE_PAYMENT_ROUNDS.map(withInvoiceRound);
      const target = rounds[Number(round) - 1];
      const entry = target.entries.find(
        (r) => r.funcCheck !== true && num(r.payCases) > 2
      ) as AdditionalEntryData;
      entry.payCases = num(entry.payCases) - 2;
      applyEntryManualEdit(entry);
      const expense = target.expenses.find(
        (r) => !r.isGroup && !r.isNetUnapproved && r.costSplit !== '分割先'
      ) as ExpenseRow;
      expense.payAmount = num(expense.payAmount) + 500;
      markExpenseManualEdit(target.expenses, expense);
      expectSummary(
        withInvoiceSummary(rounds, initialSplit),
        expectedWithInvoiceSummary(rounds, true)
      );
    }
  );

  it.each(WITH_INVOICE_PAYMENT_ROUNDS)(
    '支払回数%s の明細に函数無効チェックを付けると、支払函数から外れて手入力になる',
    (round) => {
      const rounds = WITH_INVOICE_PAYMENT_ROUNDS.map(withInvoiceRound);
      const before = withInvoiceSummary(rounds, initialSplit).payFunc;
      const row = rounds[Number(round) - 1].entries.find(
        (r) =>
          r.funcCheck !== true &&
          r.dataSource !== '手入力' &&
          num(r.payCases) > 0
      ) as AdditionalEntryData;
      const source = row.dataSource;
      row.funcCheck = true;
      applyEntryManualEdit(row);
      expect(row.dataSource).toBe('手入力');
      expect(row.originDataSource).toBe(source);
      const after = withInvoiceSummary(rounds, initialSplit);
      expectSummary(after, expectedWithInvoiceSummary(rounds, true));
      expect(after.payFunc).toBeLessThan(before);
    }
  );

  it('支払NET（追加口分）を直すと、拡売費（NET未承認）が追加口明細の拡売費金額と一緒に変わる', () => {
    const rounds = WITH_INVOICE_PAYMENT_ROUNDS.map(withInvoiceRound);
    const before = expectedWithInvoiceSummary(
      WITH_INVOICE_PAYMENT_ROUNDS.map(withInvoiceRound),
      false
    );
    // 支払回数1 No.1（サマリ商品の計画、請求NET 90＜計画NET 92）を B② で 92 に直す。
    // 未承認NETの明細がまだ無いサマリ商品でも、拡売費（NET未承認）へ入る。
    const row = rounds[0].entries.find(
      (r) => r.lineNo === 1
    ) as AdditionalEntryData;
    row.addNet = 92;
    applyEntryManualEdit(row);
    expect(num(row.expAmount)).toBe(4320 * 2);
    const v = aggregateSummaryDetails(
      rounds.map((r) => ({ entryRows: r.entries, expenseRows: r.expenses })),
      'with-invoice'
    );
    expect(v.promoNetUnapproved).toBe(before.promoNetUnapproved + 4320 * 2);
    expect(v.addEntryAmount).toBe(before.addEntryAmount - 4320 * 2);
    // 支払回数3 No.2（未承認NETの明細あり）の支払NET（追加口分）を 88→90 にすると、
    // 未承認NETの明細の支払金額（追加口明細の拡売費金額の合計）も増える。
    const autoRow = rounds[2].entries.find(
      (r) => r.lineNo === 2
    ) as AdditionalEntryData;
    autoRow.addNet = 90;
    applyEntryManualEdit(autoRow);
    const v2 = aggregateSummaryDetails(
      rounds.map((r) => ({ entryRows: r.entries, expenseRows: r.expenses })),
      'with-invoice'
    );
    expect(v2.promoNetUnapproved).toBe(
      before.promoNetUnapproved + 4320 * 2 + 90 * 24 * 2
    );
  });
});

// ── 請求書無 ───────────────────────────────────────

describe('支払詳細(追加口請求書無)：モックの明細', () => {
  it('既定で表示する支払回数は3回目', () => {
    expect(WITHOUT_INVOICE_DEFAULT_ROUND).toBe('3');
    expect(WITHOUT_INVOICE_PAYMENT_ROUNDS).toEqual(['1', '2', '3']);
  });

  it.each([
    ['1', 15, ['AIC入力', '手入力']],
    ['2', 0, ['AIC入力', '手入力']],
    ['3', 0, ['AIC入力', '手入力']],
  ])(
    '支払回数%s：追加口 %i 件（データ元の区分なし）、拡売費のデータ元は %j の混在',
    (round, entryCount, sources) => {
      const { entries, expenses } = withoutInvoiceRound(round as string);
      expect(entries).toHaveLength(entryCount as number);
      entries.forEach((e) => expect(e).not.toHaveProperty('dataSource'));
      expect(sourcesOf(expenseDetailRows(expenses))).toEqual(
        [...(sources as string[])].sort()
      );
    }
  );

  it('支払回数1の追加口明細は支払NET（追加口分）＝計画NET', () => {
    for (const e of withoutInvoiceRound('1').entries) {
      expect(e.addNet).toBe(e.planNet);
    }
  });

  it('未承認NETの明細を持たない', () => {
    for (const round of WITHOUT_INVOICE_PAYMENT_ROUNDS) {
      expect(
        withoutInvoiceRound(round).expenses.some(
          (r) =>
            r.isNetUnapproved ||
            (r.isGroup && r.product === '未承認NET拡売費合計')
        )
      ).toBe(false);
    }
  });
});

describe.each(WITHOUT_INVOICE_PAYMENT_ROUNDS)(
  '支払詳細(追加口請求書無) 支払回数%s：合計表',
  (round) => {
    it('支払情報・追加口明細・拡売費明細の合計表の全セルが明細の合計と一致し、請求・差額は「-」', () => {
      const { entries, expenses } = withoutInvoiceRound(round);
      assertWithoutInvoiceTables(entries, expenses, `支払回数${round}`);
    });

    it('データ元別の列は AIC入力・手入力だけで、追加口　計はどちらの列にも入らず「-」', () => {
      const { entries, expenses } = withoutInvoiceRound(round);
      const S = WITHOUT_INVOICE_DATA_SOURCE_COLUMNS;
      expect(S).toEqual(['AIC入力', '手入力']);
      const items = withoutInvoiceItems(entries, expenses);
      for (const item of [items.entryCard, items.payment[0]]) {
        const pay = breakdownCellValues(item, S).pay;
        expect(pay).toHaveLength(1 + 4 + S.length);
        expect(formatBreakdownAmount(pay[5] as number)).toBe('-');
        expect(formatBreakdownAmount(pay[6] as number)).toBe('-');
      }
    });
  }
);

describe('支払詳細(追加口請求書無)：手で直した明細', () => {
  describe.each(WITHOUT_INVOICE_PAYMENT_ROUNDS)('支払回数%s', (round) => {
    const sources = sourcesOf(
      expenseDetailRows(withoutInvoiceRound(round).expenses)
    ).filter((s) => s !== '手入力') as DataSource[];

    it.each(sources)(
      '拡売費明細：%s の明細の支払金額を直すと手入力になり、データ元別の列が手入力へ移る',
      (source) => {
        const { entries, expenses } = withoutInvoiceRound(round);
        const row = expenses.find(
          (r) =>
            !r.isGroup && r.costSplit !== '分割先' && r.dataSource === source
        ) as ExpenseRow;
        const before = expectedWithoutInvoice(entries, expenses).expense.pay;
        const oldPay = num(row.payAmount);
        row.payAmount = oldPay - 100;
        markExpenseManualEdit(expenses, row);
        expect(row.dataSource).toBe('手入力');
        expect(row.originDataSource).toBe(source);
        const after = assertWithoutInvoiceTables(
          entries,
          expenses,
          `支払回数${round} 編集後`
        ).expense.pay as number[];
        const S = WITHOUT_INVOICE_DATA_SOURCE_COLUMNS;
        const at = (s: string) => 5 + S.indexOf(s as DataSource);
        expect(after[at(source)]).toBeCloseTo(
          (before[at(source)] as number) - oldPay,
          6
        );
        expect(after[at('手入力')]).toBeCloseTo(
          (before[at('手入力')] as number) + oldPay - 100,
          6
        );
      }
    );
  });
});

// 請求書無の支払情報サマリの期待値（全支払回数・独立した計算）。
const expectedWithoutInvoiceSummary = (
  rounds: { entries: WithoutEntryRow[]; expenses: ExpenseRow[] }[]
) => {
  const entries = rounds.flatMap((r) => r.entries);
  const expenses = rounds.flatMap((r) => expenseDetailRows(r.expenses));
  const payFunc = Math.round(
    entries.reduce(
      (s, e) =>
        s +
        num(e.payCases) +
        (num(e.capacity) > 0 ? num(e.payLoose) / num(e.capacity) : 0),
      0
    )
  );
  const addEntry = entries.reduce((s, e) => s + num(e.payAmount), 0);
  const linked = expenses.reduce((s, x) => s + num(x.payAmount), 0);
  const f = WITHOUT_INVOICE_SUMMARY_FIXED_VALUES;
  const payNetSales = f.externalSales - addEntry;
  const sales = payNetSales - linked;
  const mgmtProfitAmount = f.mgmtProfitBasis + (sales - f.salesBasis);
  return {
    payFunc,
    addEntryAmount: addEntry,
    promoNetUnapproved: 0,
    promoLinked: linked,
    payNetSales,
    sales,
    mgmtProfitAmount,
    addEntryRate: (addEntry / f.externalSales) * 100,
    mgmtProfitRate: (mgmtProfitAmount / sales) * 100,
  };
};
const withoutInvoiceSummary = (
  rounds: { entries: WithoutEntryRow[]; expenses: ExpenseRow[] }[]
) =>
  summaryPayValuesOf(
    aggregateSummaryDetails(
      rounds.map((r) => ({ entryRows: r.entries, expenseRows: r.expenses })),
      'without-invoice'
    ),
    WITHOUT_INVOICE_SUMMARY_FIXED_VALUES
  );

describe('支払詳細(追加口請求書無)：支払情報サマリ（全支払回数の合計）', () => {
  it('初期表示：3回分の明細の合計と一致する', () => {
    const rounds = WITHOUT_INVOICE_PAYMENT_ROUNDS.map(withoutInvoiceRound);
    expectSummary(
      withoutInvoiceSummary(rounds),
      expectedWithoutInvoiceSummary(rounds)
    );
  });

  it('初期表示の比率が自然（追加口率 約42%・管理利益率 25.1%・函数の差が小さい）', () => {
    const rounds = WITHOUT_INVOICE_PAYMENT_ROUNDS.map(withoutInvoiceRound);
    const v = withoutInvoiceSummary(rounds);
    expect(v.addEntryRate).toBeGreaterThan(40);
    expect(v.addEntryRate).toBeLessThan(44);
    expect(v.mgmtProfitRate).toBeCloseTo(25.1, 1);
    expect(Math.abs(WITHOUT_INVOICE_ACTUAL_FUNC - v.payFunc)).toBeLessThan(10);
  });

  it.each(WITHOUT_INVOICE_PAYMENT_ROUNDS)(
    '支払回数%s の拡売費明細を直すと、サマリも明細の合計に追従する',
    (round) => {
      const rounds = WITHOUT_INVOICE_PAYMENT_ROUNDS.map(withoutInvoiceRound);
      const target = rounds[Number(round) - 1];
      const row = target.expenses.find(
        (r) => !r.isGroup && r.costSplit !== '分割先'
      ) as ExpenseRow;
      row.payAmount = num(row.payAmount) + 700;
      markExpenseManualEdit(target.expenses, row);
      expectSummary(
        withoutInvoiceSummary(rounds),
        expectedWithoutInvoiceSummary(rounds)
      );
    }
  );
});

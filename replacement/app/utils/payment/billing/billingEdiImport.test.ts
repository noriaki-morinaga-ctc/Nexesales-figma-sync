import { describe, it, expect } from 'vitest';
import {
  formatSenderNames,
  formatPayeeName,
  filterBillingEdiRows,
  summarizeBillingEdiStatus,
} from './billingEdiImport';
import type {
  BillingEdiImportRow,
  BillingEdiSearchCriteria,
} from '../../../constants/billingEdiMockData';
import { INITIAL_SEARCH_CRITERIA } from '../../../constants/billingEdiMockData';

// テスト用の行を最小限の指定で組み立てる
const makeRow = (
  over: Partial<BillingEdiImportRow> = {}
): BillingEdiImportRow => ({
  id: 'X',
  receivedAt: '2026/07/10 08:30',
  lastProcessedAt: '2026/07/10 08:30',
  payeeName: '三菱食品株式会社',
  senderNames: ['MF01'],
  status: '正常',
  isSystemError: false,
  systemErrorReason: '',
  counts: { invoices: 1, slips: 1, details: 1 },
  errorCount: 0,
  pendingErrors: [],
  details: [],
  ...over,
});

// 受信日とステータスには初期値があるため（受信日＝当月・決定11／ステータス＝エラー・AJ46）、
// それ以外の条件を確かめるテストでは、どちらも絞り込まない状態にして使う
const criteria = (
  over: Partial<BillingEdiSearchCriteria> = {}
): BillingEdiSearchCriteria => ({
  ...INITIAL_SEARCH_CRITERIA,
  importDateFrom: '',
  importDateTo: '',
  status: 'all',
  ...over,
});

describe('formatSenderNames', () => {
  it('請求元が無ければハイフンを返す', () => {
    expect(formatSenderNames([])).toBe('-');
  });

  it('1件ならその名称をそのまま返す', () => {
    expect(formatSenderNames(['MF01'])).toBe('MF01');
  });

  it('複数件は全件を連結する（件数の省略表示はしない）', () => {
    expect(
      formatSenderNames(['KOKUBU-東京', 'KOKUBU-関西', 'KOKUBU-九州'])
    ).toBe('KOKUBU-東京、KOKUBU-関西、KOKUBU-九州');
  });
});

describe('formatPayeeName', () => {
  it('システムエラー行は配下を持たないためハイフンを返す', () => {
    expect(
      formatPayeeName(
        makeRow({
          isSystemError: true,
          payeeName: null,
          systemErrorReason: '形式不正',
        })
      )
    ).toBe('-');
  });

  it('請求元企業があれば連携値をそのまま返す', () => {
    expect(formatPayeeName(makeRow())).toBe('三菱食品株式会社');
  });
});

describe('filterBillingEdiRows', () => {
  const rows = [
    makeRow({ id: 'ok', status: '正常' }),
    makeRow({ id: 'ng', status: 'エラー', errorCount: 3 }),
    makeRow({
      id: 'sys',
      status: 'エラー',
      isSystemError: true,
      payeeName: null,
      senderNames: [],
      systemErrorReason: '形式不正',
    }),
  ];

  it('受信日を指定しなければ全件返す', () => {
    expect(filterBillingEdiRows(rows, criteria()).map((r) => r.id)).toEqual([
      'ok',
      'ng',
      'sys',
    ]);
  });

  // エラーを見ることが本画面の主目的のため、初期表示をエラーの行だけに絞る（AJ46）
  it('ステータスの初期値はエラーで、初期表示はエラーの行だけになる', () => {
    expect(INITIAL_SEARCH_CRITERIA.status).toBe('エラー');
    expect(
      filterBillingEdiRows(
        rows,
        criteria({ status: INITIAL_SEARCH_CRITERIA.status })
      ).map((r) => r.id)
    ).toEqual(['ng', 'sys']);
  });

  it('ステータス指定で該当行だけ返す', () => {
    expect(
      filterBillingEdiRows(rows, criteria({ status: '正常' })).map((r) => r.id)
    ).toEqual(['ok']);
  });

  it('支払先を指定するとシステムエラー行は除外される（支払先を持たないため）', () => {
    expect(
      filterBillingEdiRows(rows, criteria({ payee: '三菱' })).map((r) => r.id)
    ).toEqual(['ok', 'ng']);
  });

  // 仮データの受信日時が2026年8月固定のため、初期値もその月に合わせた固定値にする
  it('受信日の初期値は仮データのある2026年8月（1日〜末日）', () => {
    expect(INITIAL_SEARCH_CRITERIA.importDateFrom).toBe('2026/08/01');
    expect(INITIAL_SEARCH_CRITERIA.importDateTo).toBe('2026/08/31');
  });

  it('受信日の範囲で絞り込む', () => {
    const dated = [
      makeRow({ id: 'a', receivedAt: '2026/07/10 08:30' }),
      makeRow({ id: 'b', receivedAt: '2026/07/22 09:15' }),
    ];
    expect(
      filterBillingEdiRows(
        dated,
        criteria({ importDateFrom: '2026/07/15' })
      ).map((r) => r.id)
    ).toEqual(['b']);
    expect(
      filterBillingEdiRows(dated, criteria({ importDateTo: '2026/07/15' })).map(
        (r) => r.id
      )
    ).toEqual(['a']);
  });
});

describe('summarizeBillingEdiStatus', () => {
  it('正常とエラーの件数を数える（再取込指示済はどちらにも数えない）', () => {
    const rows = [
      makeRow({ status: '正常' }),
      makeRow({ status: 'エラー' }),
      makeRow({ status: 'エラー' }),
      makeRow({ status: '再取込指示済' }),
    ];
    expect(summarizeBillingEdiStatus(rows)).toEqual({
      normalCount: 1,
      errorCount: 2,
    });
  });
});

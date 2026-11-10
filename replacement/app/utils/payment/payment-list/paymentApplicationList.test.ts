import { describe, it, expect } from 'vitest';
import {
  VOUCHER_TYPE,
  VOUCHER_TYPE_ALL,
  NO_PAYMENT_STATUS,
  STATUS_FILTER_ALL,
  STATUS_FILTER_EXCLUDING_NO_PAYMENT,
  formatRepresentative,
  matchesPaymentListFilter,
  type PaymentListFilterableRow,
  type PaymentListFilterCriteria,
} from './paymentApplicationList';

// 検索条件の既定（絞り込みが一切効かない状態）。各テストで必要な条件だけ上書きする。
const criteria = (
  over: Partial<PaymentListFilterCriteria> = {}
): PaymentListFilterCriteria => ({
  dateBasis: 'accounting',
  yearMonthStart: '2026/01',
  yearMonthEnd: '2026/12',
  status: STATUS_FILTER_ALL,
  voucherType: VOUCHER_TYPE_ALL,
  ...over,
});

// 絞り込み対象の行の既定（支払・ローソンの商流）。
const row = (
  over: Partial<PaymentListFilterableRow> = {}
): PaymentListFilterableRow => ({
  accountingMonth: '2026/03',
  targetMonth: '2026/04',
  status: '承認待ち',
  voucherType: VOUCHER_TYPE.payment,
  retailerCode: '30200742', // ローソン
  primaryStoreCode: '10010077', // 伊藤忠食品札幌支店
  tertiaryStoreCode: '10754884', // 伊藤忠食品株式会社東北支社
  ...over,
});

describe('formatRepresentative', () => {
  it('空配列は「-」を返す', () => {
    expect(formatRepresentative([])).toBe('-');
  });

  it('1件のときはその値をそのまま返す', () => {
    expect(formatRepresentative(['S26100001'])).toBe('S26100001');
  });

  it('2件のときは代表1件＋「他1件」を返す', () => {
    expect(formatRepresentative(['S26100001', 'S26100002'])).toBe(
      'S26100001 他1件'
    );
  });

  it('3件のときは代表1件＋「他2件」を返す', () => {
    expect(formatRepresentative(['S26100001', 'S26100002', 'S26100003'])).toBe(
      'S26100001 他2件'
    );
  });
});

describe('matchesPaymentListFilter', () => {
  it('計上年月が範囲内なら通す', () => {
    expect(
      matchesPaymentListFilter(row({ accountingMonth: '2026/03' }), criteria())
    ).toBe(true);
  });

  it('計上年月が範囲外なら弾く', () => {
    expect(
      matchesPaymentListFilter(
        row({ accountingMonth: '2025/12' }),
        criteria({ yearMonthStart: '2026/01', yearMonthEnd: '2026/12' })
      )
    ).toBe(false);
  });

  it('年月の開始・終了が未指定（×でクリア）なら、その側は絞らない', () => {
    expect(
      matchesPaymentListFilter(
        row({ accountingMonth: '2030/01' }),
        criteria({ yearMonthEnd: '' })
      )
    ).toBe(true);
    expect(
      matchesPaymentListFilter(
        row({ accountingMonth: '2020/01' }),
        criteria({ yearMonthStart: '' })
      )
    ).toBe(true);
    // 指定されている側は引き続き判定する
    expect(
      matchesPaymentListFilter(
        row({ accountingMonth: '2025/12' }),
        criteria({ yearMonthEnd: '' })
      )
    ).toBe(false);
  });

  it('基準が対象年月のときは対象年月で範囲判定する', () => {
    // 計上年月は範囲外だが対象年月は範囲内 → 通す
    expect(
      matchesPaymentListFilter(
        row({ accountingMonth: '2025/12', targetMonth: '2026/04' }),
        criteria({ dateBasis: 'target' })
      )
    ).toBe(true);
  });

  it('ステータスが一致しなければ弾く', () => {
    expect(
      matchesPaymentListFilter(
        row({ status: '検印済' }),
        criteria({ status: '承認待ち' })
      )
    ).toBe(false);
  });

  it('ステータス＝全てのときは支払無しも通す', () => {
    expect(
      matchesPaymentListFilter(
        row({ status: NO_PAYMENT_STATUS }),
        criteria({ status: STATUS_FILTER_ALL })
      )
    ).toBe(true);
  });

  it('ステータス＝支払無し以外（初期値）のときは支払無しだけを弾く', () => {
    const excluding = criteria({ status: STATUS_FILTER_EXCLUDING_NO_PAYMENT });
    expect(
      matchesPaymentListFilter(row({ status: NO_PAYMENT_STATUS }), excluding)
    ).toBe(false);
    expect(matchesPaymentListFilter(row({ status: '未申請' }), excluding)).toBe(
      true
    );
    expect(matchesPaymentListFilter(row({ status: '検印済' }), excluding)).toBe(
      true
    );
  });

  it('ステータス＝支払無しのときは支払無しだけを通す', () => {
    expect(
      matchesPaymentListFilter(
        row({ status: NO_PAYMENT_STATUS }),
        criteria({ status: NO_PAYMENT_STATUS })
      )
    ).toBe(true);
    expect(
      matchesPaymentListFilter(
        row({ status: '未申請' }),
        criteria({ status: NO_PAYMENT_STATUS })
      )
    ).toBe(false);
  });

  it('伝票種別＝支払のとき振替を弾く', () => {
    expect(
      matchesPaymentListFilter(
        row({ voucherType: VOUCHER_TYPE.deptTransfer }),
        criteria({ voucherType: VOUCHER_TYPE.payment })
      )
    ).toBe(false);
  });

  it('伝票種別＝振替のとき支払を弾く', () => {
    expect(
      matchesPaymentListFilter(
        row({ voucherType: VOUCHER_TYPE.payment }),
        criteria({ voucherType: VOUCHER_TYPE.deptTransfer })
      )
    ).toBe(false);
  });

  it('伝票種別＝全てのときは支払・振替とも通す', () => {
    expect(
      matchesPaymentListFilter(
        row({ voucherType: VOUCHER_TYPE.payment }),
        criteria()
      )
    ).toBe(true);
    expect(
      matchesPaymentListFilter(
        row({ voucherType: VOUCHER_TYPE.deptTransfer }),
        criteria()
      )
    ).toBe(true);
  });

  it('販売店を指定すると販売店コードが一致する行だけ通す', () => {
    expect(
      matchesPaymentListFilter(
        row({ retailerCode: '30200742' }),
        criteria({ retailer: '30200742' })
      )
    ).toBe(true);
    expect(
      matchesPaymentListFilter(
        row({ retailerCode: '30200740' }),
        criteria({ retailer: '30200742' })
      )
    ).toBe(false);
  });

  it('販売店が未指定（空文字）なら絞らない', () => {
    expect(
      matchesPaymentListFilter(row({ retailerCode: '30200740' }), criteria())
    ).toBe(true);
  });

  it('一次店を指定すると一次店コードが一致する行だけ通す', () => {
    expect(
      matchesPaymentListFilter(
        row({ primaryStoreCode: '10010077' }),
        criteria({ primaryStore: '10010077' })
      )
    ).toBe(true);
    expect(
      matchesPaymentListFilter(
        row({ primaryStoreCode: '10010075' }),
        criteria({ primaryStore: '10010077' })
      )
    ).toBe(false);
  });

  it('三次店を指定すると三次店コードが一致する行だけ通す', () => {
    expect(
      matchesPaymentListFilter(
        row({ tertiaryStoreCode: '10754884' }),
        criteria({ tertiaryStore: '10754884' })
      )
    ).toBe(true);
    expect(
      matchesPaymentListFilter(
        row({ tertiaryStoreCode: '10754882' }),
        criteria({ tertiaryStore: '10754884' })
      )
    ).toBe(false);
  });

  it('振替（商流を持たない行）は販売店・一次店・三次店のいずれかを指定すると弾く', () => {
    const transferRow = row({
      voucherType: VOUCHER_TYPE.deptTransfer,
      retailerCode: '',
      primaryStoreCode: '',
      tertiaryStoreCode: '',
    });
    expect(
      matchesPaymentListFilter(
        transferRow,
        criteria({ primaryStore: '10010077' })
      )
    ).toBe(false);
    expect(matchesPaymentListFilter(transferRow, criteria())).toBe(true);
  });

  it('販売店＋一次店＋三次店＋ステータスはAND条件', () => {
    // すべて満たすので通す
    expect(
      matchesPaymentListFilter(
        row({ status: '承認待ち' }),
        criteria({
          retailer: '30200742',
          primaryStore: '10010077',
          tertiaryStore: '10754884',
          status: '承認待ち',
        })
      )
    ).toBe(true);
    // 商流が一致してもステータスが違えば弾く
    expect(
      matchesPaymentListFilter(
        row({ status: '検印済' }),
        criteria({
          retailer: '30200742',
          primaryStore: '10010077',
          tertiaryStore: '10754884',
          status: '承認待ち',
        })
      )
    ).toBe(false);
    // 三次店だけ違えば弾く
    expect(
      matchesPaymentListFilter(
        row({ tertiaryStoreCode: '10754882' }),
        criteria({ retailer: '30200742', tertiaryStore: '10754884' })
      )
    ).toBe(false);
  });
});

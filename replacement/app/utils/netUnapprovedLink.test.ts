import { describe, it, expect } from 'vitest';
import {
  isNetLinkForRound,
  linkNetUnapprovedRows,
  missingNetProducts,
  netRowDataSourceOf,
  netUnapprovedLinkOf,
  type NetLinkExpenseRow,
} from './netUnapprovedLink';

const entry = (
  productName: string,
  expAmount: number,
  dataSource: '請求EDI' | 'AIC入力' | '手入力'
) => ({ productName, expAmount, dataSource });

describe('netUnapprovedLinkOf（追加口明細から連動データを作る）', () => {
  it('サマリ商品ごとの拡売費金額と、差を出した手入力の明細を持つ商品', () => {
    const link = netUnapprovedLinkOf(
      [
        entry('A', 300, '請求EDI'),
        entry('A', 0, '手入力'), // 差が0の手入力の明細は数えない
        entry('B', -40, '手入力'),
        { isTotal: true, productName: 'A', expAmount: 999 },
      ],
      '3'
    );
    expect(link).toEqual({
      total: 260,
      byProduct: { A: 300, B: -40 },
      manualProducts: ['B'],
      round: '3',
    });
  });
});

describe('支払回数つきの連動データ（切替の直後に前の回の値を当てない）', () => {
  const link = netUnapprovedLinkOf([entry('A', 300, '手入力')], '1');

  it('表示中の支払回数の値だけを当てる', () => {
    expect(isNetLinkForRound(link, '1')).toBe(true);
    expect(isNetLinkForRound(link, '3')).toBe(false);
    expect(isNetLinkForRound(undefined, '1')).toBe(false);
  });

  it('別の支払回数の値からは、未承認NETの明細を足さない', () => {
    expect(missingNetProducts(link, '3', new Set())).toEqual([]);
    expect(missingNetProducts(link, '1', new Set())).toEqual([['A', 300]]);
    expect(missingNetProducts(link, '1', new Set(['A']))).toEqual([]);
  });
});

describe('linkNetUnapprovedRows（未承認NETの明細へ当てる）', () => {
  const netRow = (fields: Partial<NetLinkExpenseRow>): NetLinkExpenseRow => ({
    isNetUnapproved: true,
    product: 'A',
    payAmount: 0,
    dataSource: '請求EDI',
    ...fields,
  });

  it('支払金額を連動させ、差を出した追加口明細が手入力なら手入力にする（元のデータ元を残す）', () => {
    const rows = [
      netRow({}),
      netRow({ product: 'B', dataSource: 'AIC入力' }),
      { product: 'A', payAmount: 500, dataSource: '請求EDI' as const }, // その他の明細は対象外
    ];
    const changed = linkNetUnapprovedRows(
      rows,
      netUnapprovedLinkOf([
        entry('A', 120, '手入力'),
        entry('B', 80, 'AIC入力'),
      ])
    );
    expect(rows[0]).toMatchObject({
      payAmount: 120,
      dataSource: '手入力',
      originDataSource: '請求EDI',
    });
    expect(rows[1]).toMatchObject({ payAmount: 80, dataSource: 'AIC入力' });
    expect(rows[2]).toMatchObject({ payAmount: 500, dataSource: '請求EDI' });
    expect(changed).toEqual([rows[0]]);
  });

  it('支払金額を手で入れた明細は金額を上書きしない', () => {
    const rows = [netRow({ payAmountManual: true, payAmount: 50 })];
    linkNetUnapprovedRows(
      rows,
      netUnapprovedLinkOf([entry('A', 120, '請求EDI')])
    );
    expect(rows[0].payAmount).toBe(50);
  });
});

describe('netRowDataSourceOf（モックの未承認NETの明細のデータ元）', () => {
  it('差を出した明細に手入力があれば手入力、無ければ最初の明細のデータ元', () => {
    expect(
      netRowDataSourceOf([
        entry('A', 1, 'AIC入力'),
        { ...entry('A', 1, '手入力'), originDataSource: '請求EDI' },
      ])
    ).toEqual({ dataSource: '手入力', originDataSource: '請求EDI' });
    expect(netRowDataSourceOf([entry('A', 1, 'AIC入力')])).toEqual({
      dataSource: 'AIC入力',
    });
  });
});

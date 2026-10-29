import { describe, it, expect } from 'vitest';
import {
  calcExpensePaymentScheduleDate,
  firstDayOfMonth,
  lastDayOfMonth,
  latestOpenAccountingMonth,
  nthBusinessDayOfMonth,
  toSlashYearMonth,
} from './paymentScheduleDate';

describe('toSlashYearMonth（対象年月の表記をそろえる）', () => {
  it('「YYYY年M月」を YYYY/MM にする', () => {
    expect(toSlashYearMonth('2025年10月')).toBe('2025/10');
    expect(toSlashYearMonth('2026年1月')).toBe('2026/01');
  });

  it('既に YYYY/MM のときはそのまま、読めないときは空にする', () => {
    expect(toSlashYearMonth('2025/10')).toBe('2025/10');
    expect(toSlashYearMonth('')).toBe('');
  });
});

describe('firstDayOfMonth／lastDayOfMonth（月の初日・末日）', () => {
  it('月の初日と末日を YYYY/MM/DD で返す', () => {
    expect(firstDayOfMonth('2025/10')).toBe('2025/10/01');
    expect(lastDayOfMonth('2025/10')).toBe('2025/10/31');
    expect(lastDayOfMonth('2025/02')).toBe('2025/02/28');
    expect(lastDayOfMonth('2024/02')).toBe('2024/02/29');
  });

  it('年月が空なら空を返す', () => {
    expect(firstDayOfMonth('')).toBe('');
    expect(lastDayOfMonth('')).toBe('');
  });
});

describe('nthBusinessDayOfMonth（月の第N営業日）', () => {
  it('土日を除いて数える', () => {
    // 2025/10/1(水)・2(木)・3(金)
    expect(nthBusinessDayOfMonth('2025/10', 3)).toBe('2025/10/03');
    // 2025/11/1(土)・2(日)を飛ばし、3(月)・4(火)・5(水)
    expect(nthBusinessDayOfMonth('2025/11', 3)).toBe('2025/11/05');
  });
});

describe('latestOpenAccountingMonth（直近の有効な会計月）', () => {
  it('当月の第3営業日までは前月の会計が締まっていないため前月', () => {
    expect(latestOpenAccountingMonth('2025/10/01')).toBe('2025/09');
    expect(latestOpenAccountingMonth('2025/10/03')).toBe('2025/09');
  });

  it('第3営業日を過ぎたら当月', () => {
    expect(latestOpenAccountingMonth('2025/10/06')).toBe('2025/10');
    expect(latestOpenAccountingMonth('2025/10/15')).toBe('2025/10');
  });

  it('年をまたぐ前月も求める', () => {
    // 2026/1/1(木)・2(金)・5(月)が第3営業日
    expect(latestOpenAccountingMonth('2026/01/05')).toBe('2025/12');
    expect(latestOpenAccountingMonth('2026/01/06')).toBe('2026/01');
  });
});

describe('calcExpensePaymentScheduleDate（拡売費支払予定日）', () => {
  it('支払先か計上年月が無ければ求めない（初期表示なし）', () => {
    expect(calcExpensePaymentScheduleDate('', '2025/10')).toBe('');
    expect(calcExpensePaymentScheduleDate('1001584:伊藤忠食品', '')).toBe('');
  });

  it('計上年月の第3営業日を起算日に、決済条件（モックは起算日の月末）の日を返す', () => {
    expect(
      calcExpensePaymentScheduleDate('1001584:伊藤忠食品', '2025/10')
    ).toBe('2025/10/31');
    expect(calcExpensePaymentScheduleDate('1001585:三菱食品', '2025/11')).toBe(
      '2025/11/30'
    );
  });
});

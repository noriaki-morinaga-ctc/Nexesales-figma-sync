// 支払情報の日付（発生日・計上年月・拡売費支払予定日）の初期値を求める
//（→ 20261006_第36回 手売り自販機共通 決定事項6・7・9／課題No.727。補足1-5・1-6 支払情報）。
//   発生日：対象年月の末日（手入力で変えられるのは対象年月内）
//   計上年月：直近の有効な会計月（手入力不可）
//   拡売費支払予定日：支払先を入力したら、計上年月の第3営業日を起算日に
//                     会計決済条件区分マスタの日（手入力可）
// 年月は YYYY/MM、年月日は YYYY/MM/DD の文字列で扱う。

// 会計の締め日（当月の第N営業日に前月の会計を締める）。
// 拡売費支払予定日の起算日（計上年月の第N営業日）にも同じ日を使う。
export const ACCOUNTING_CLOSING_BUSINESS_DAY = 3;

const pad = (n: number) => String(n).padStart(2, '0');

const formatDate = (d: Date) =>
  `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;

// 'YYYY/MM' を年・月に分ける（読めないときは null）。
const parseYearMonth = (ym: string): { year: number; month: number } | null => {
  const [year, month] = (ym || '').split('/').map(Number);
  return year && month ? { year, month } : null;
};

// 対象年月の表記（「2025年10月」）を YYYY/MM にそろえる。
export const toSlashYearMonth = (value: string): string => {
  const m = (value || '').match(/^(\d{4})(?:年|\/)(\d{1,2})月?$/);
  return m ? `${m[1]}/${pad(Number(m[2]))}` : '';
};

// 月の初日（YYYY/MM/DD）。
export const firstDayOfMonth = (ym: string): string => {
  const p = parseYearMonth(ym);
  return p ? formatDate(new Date(p.year, p.month - 1, 1)) : '';
};

// 月の末日（YYYY/MM/DD）。
export const lastDayOfMonth = (ym: string): string => {
  const p = parseYearMonth(ym);
  return p ? formatDate(new Date(p.year, p.month, 0)) : '';
};

// 月の第N営業日（YYYY/MM/DD）。
// モックは土日だけを休みとする（本番は会社カレンダーで祝日・休業日も除く）。
export const nthBusinessDayOfMonth = (ym: string, n: number): string => {
  const p = parseYearMonth(ym);
  if (!p) return '';
  const d = new Date(p.year, p.month - 1, 1);
  let count = 0;
  while (d.getMonth() === p.month - 1) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
      if (count === n) return formatDate(d);
    }
    d.setDate(d.getDate() + 1);
  }
  return '';
};

// 直近の有効な会計月（YYYY/MM）。
// 前月の会計が締まっていなければ前月、締まっていれば当月とする（→ 第36回 決定事項7）。
// 締め日（当月の第3営業日）の当日までは、前月の会計がまだ締まっていないものとする。
export const latestOpenAccountingMonth = (today: string): string => {
  const [year, month] = (today || '').split('/').map(Number);
  if (!year || !month) return '';
  const thisMonth = `${year}/${pad(month)}`;
  const closingDay = nthBusinessDayOfMonth(
    thisMonth,
    ACCOUNTING_CLOSING_BUSINESS_DAY
  );
  if (today > closingDay) return thisMonth;
  const prev = new Date(year, month - 2, 1);
  return `${prev.getFullYear()}/${pad(prev.getMonth() + 1)}`;
};

// 会計決済条件区分マスタで決まる支払日（モック）。
// 本番は支払先ごとの決済条件をマスタから引く。モックでは全支払先を仮の条件
// 「起算日の月末」とする（決済条件の中身は未確認 → 修正前後HTML 6章）。
const settlementDateOf = (_destination: string, baseDate: string): string =>
  lastDayOfMonth(baseDate.slice(0, 7));

// 拡売費支払予定日（YYYY/MM/DD）。支払先か計上年月が無いときは空（初期表示なし）。
// 計上年月の第3営業日を起算日に、支払先の会計決済条件区分マスタの日を返す（→ 第36回 決定事項6）。
export const calcExpensePaymentScheduleDate = (
  destination: string,
  postingMonth: string
): string => {
  if (!destination || !postingMonth) return '';
  const baseDate = nthBusinessDayOfMonth(
    postingMonth,
    ACCOUNTING_CLOSING_BUSINESS_DAY
  );
  return baseDate ? settlementDateOf(destination, baseDate) : '';
};

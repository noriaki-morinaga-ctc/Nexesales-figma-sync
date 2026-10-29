// 取引制度（固定マージン率／NET入力）の判定ヘルパー。
//
// 本来は「販売店・1次店/3次店（計画のヘッダ）× サマリ商品 × 対象年月」をキーに
// マスタから取引制度を取得する（参考2-1／補足5-2）。モックには判定用マスタが無いため、
// 対象年月の月が奇数なら固定マージン率、偶数ならNET入力として代用する。
// 判定できない（対象年月が未入力・不正）場合は null を返し、呼び出し側で非活性とする。

// 取引制度の区分。
export type TradeSystem = 'fixedMargin' | 'netInput';

// 'YYYY/MM'（'YYYY年M月' 表記も許容）から月を取り出す。取り出せない場合は null。
const monthOf = (yearMonth?: string): number | null => {
  const matched = String(yearMonth ?? '')
    .trim()
    .match(/^(\d{4})[/年-](\d{1,2})月?$/);
  if (!matched) return null;
  const month = Number(matched[2]);
  return month >= 1 && month <= 12 ? month : null;
};

// 対象年月から取引制度を判定する。判定できない場合は null。
export const tradeSystemOf = (yearMonth?: string): TradeSystem | null => {
  const month = monthOf(yearMonth);
  if (month === null) return null;
  return month % 2 === 1 ? 'fixedMargin' : 'netInput';
};

// 固定マージン率か（NETは納価×マージン率から算出するため非活性）。
export const isFixedMarginMonth = (yearMonth?: string): boolean =>
  tradeSystemOf(yearMonth) === 'fixedMargin';

// NET入力か（NETは手入力のため活性）。判定できない場合は false。
export const isNetInputMonth = (yearMonth?: string): boolean =>
  tradeSystemOf(yearMonth) === 'netInput';

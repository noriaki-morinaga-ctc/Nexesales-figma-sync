// 年月（'YYYY/MM'）の加算・表記変換ヘルパー。
// ゼロ埋め前提のため、辞書順＝時系列順として文字列比較で範囲判定にも使える。

// 表示表記「YYYY年M月」を内部表記「YYYY/MM」へ変換する。
// 変換できない文字列（すでに 'YYYY/MM' 等）はそのまま返す。
export function toYearMonth(label: string): string {
  const m = String(label ?? '').match(/(\d{4})年(\d{1,2})月/);
  return m ? `${m[1]}/${m[2].padStart(2, '0')}` : (label ?? '');
}

// 内部表記「YYYY/MM」を表示表記「YYYY年M月」へ変換する（月のゼロ埋めは外す）。
// 変換できない文字列はそのまま返す。
export function toMonthLabel(yearMonth: string): string {
  const m = String(yearMonth ?? '').match(/(\d{4})\/(\d{1,2})/);
  return m ? `${m[1]}年${Number(m[2])}月` : (yearMonth ?? '');
}

// 'YYYY/MM' に months か月を加算した 'YYYY/MM' を返す。不正値はそのまま返す。
export function addMonths(yearMonth: string, months: number): string {
  const [y, m] = String(yearMonth ?? '').split('/');
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return yearMonth;
  const total = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}/${String(nextMonth).padStart(2, '0')}`;
}

// 'YYYY/MM' に years 年を加算した 'YYYY/MM' を返す。
export function addYears(yearMonth: string, years: number): string {
  return addMonths(yearMonth, years * 12);
}

// システム日付の当年1月（'YYYY/01'）。シミュレーション(集計)の対象期間 from の初期値・選択下限。
export function thisYearJanuary(): string {
  return `${new Date().getFullYear()}/01`;
}

// システム日付の当年12月（'YYYY/12'）。シミュレーション(集計)の対象期間 to の初期値。
export function thisYearDecember(): string {
  return `${new Date().getFullYear()}/12`;
}

// システム日付の次年12月（'YYYY/12'）。シミュレーション(集計)の対象期間 from・to の選択上限。
export function nextYearDecember(): string {
  return `${new Date().getFullYear() + 1}/12`;
}

// 基準年月から「前後1年」の選択可能範囲（1年前の同月〜1年後の同月）を返す。
// 拡売費計画(コピー元)ペインの対象年月で使う（課題1908：未来の計画からも引用できるようにする。
// 1年後までとするかは確認事項）。
// 基準年月が未設定・不正なときは範囲なし（undefined）を返し、呼び出し側で無制限にする。
export function yearAroundRange(yearMonth: string): {
  min: string | undefined;
  max: string | undefined;
} {
  if (!monthNumberOf(yearMonth)) return { min: undefined, max: undefined };
  return { min: addMonths(yearMonth, -12), max: addMonths(yearMonth, 12) };
}

// 'YYYY/MM' の月を数値（1〜12）で返す。解釈できない場合は null。
export function monthNumberOf(yearMonth: string): number | null {
  const m = String(yearMonth ?? '').match(/^(\d{4})\/(\d{1,2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? month : null;
}

// 'YYYY/MM' の月インデックス（0始まり。1月=0 … 12月=11）。解釈できない場合は null。
// 販売計画(集計)の「○月合計／1〜○月累計／年間」、月別展開の基準月、
// 拡売費の計上月ずらし がいずれもこの値を使う（解釈を1か所に集約する）。
export function monthIndex0Of(yearMonth: string): number | null {
  const month = monthNumberOf(yearMonth);
  return month === null ? null : month - 1;
}

// 'YYYY/MM' の年を year に置き換えた 'YYYY/MM' を返す（月はそのまま）。不正値はそのまま返す。
// モックデータの対象年月をシステム日付の年に寄せるために使う。
export function withYear(yearMonth: string, year: number): string {
  const month = monthNumberOf(yearMonth);
  if (month === null) return yearMonth;
  return `${year}/${String(month).padStart(2, '0')}`;
}

// 'YYYY/MM' が from〜to（両端を含む）に入るかを返す。
// from・to が未設定の側は制限なしとして扱う。
export function isInPeriod(
  yearMonth: string,
  from?: string,
  to?: string
): boolean {
  if (from && yearMonth < from) return false;
  if (to && yearMonth > to) return false;
  return true;
}

// 'YYYY/MM' と同じ月で from〜to に入る最初の年月を返す。
// 期間内に同じ月がない（期間が1年未満で該当月を含まない）場合は from を返す。
// 過去の計画（参照用下ペイン）から明細へコピーした行の対象年月を、対象期間内に寄せるために使う。
export function alignToPeriod(
  yearMonth: string,
  from: string,
  to: string
): string {
  const month = monthNumberOf(yearMonth);
  const fromYear = Number(String(from).split('/')[0]);
  if (month === null || !Number.isFinite(fromYear)) return from;
  const candidate = withYear(yearMonth, fromYear);
  const aligned = candidate < from ? addYears(candidate, 1) : candidate;
  return aligned <= to ? aligned : from;
}

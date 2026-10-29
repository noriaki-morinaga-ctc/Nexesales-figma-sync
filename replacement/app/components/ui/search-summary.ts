// 検索条件カードを折り畳んだときに、見出しの行へ出す要約の文字列を作る共通関数。
// 値が入っている項目だけを「項目名：値」で並べ、「｜」で区切る（UI/UX UX-024）。
// 表示は CollapsibleCard の collapsedSummary が受け持つ。

// 複数選択の値は、この件数まで名前を出し、残りは「他N件」にする
const SUMMARY_MAX_VALUES = 2;

// 要約の区切り
const SUMMARY_SEPARATOR = ' ｜ ';

export interface SearchSummaryItem {
  // 項目名（検索条件のラベルと同じ）
  label: string;
  // 表示する値（空文字＝値なしとして要約に出さない）
  value: string;
}

interface SummaryOption {
  value: string;
  label: string;
}

// 複数選択の値を「A、B 他N件」にする。options を渡すと値を表示名に置き換える。
// unit は MultiCombobox の unit と同じ（人は「名」）。
export function formatSummaryValues(
  values: string[],
  options?: SummaryOption[],
  unit = '件'
): string {
  const labels = values.map(
    (v) => options?.find((o) => o.value === v)?.label ?? v
  );
  if (labels.length <= SUMMARY_MAX_VALUES) return labels.join('、');
  return `${labels.slice(0, SUMMARY_MAX_VALUES).join('、')} 他${
    labels.length - SUMMARY_MAX_VALUES
  }${unit}`;
}

// 単一選択の値を表示名にする（空文字＝値なしは空文字のまま）。
export function formatSummaryValue(
  value: string,
  options?: SummaryOption[]
): string {
  return value ? formatSummaryValues([value], options) : '';
}

// 範囲指定（開始～終了）を「開始～終了」にする。片方だけのときは「開始～」「～終了」。
export function formatSummaryRange(start: string, end: string): string {
  if (!start && !end) return '';
  return `${start}～${end}`;
}

// 値が入っている項目だけを「項目名：値 ｜ 項目名：値」にする。1つも無ければ空文字。
export function buildSearchSummary(items: SearchSummaryItem[]): string {
  return items
    .filter((item) => item.value.trim() !== '')
    .map((item) => `${item.label}：${item.value}`)
    .join(SUMMARY_SEPARATOR);
}

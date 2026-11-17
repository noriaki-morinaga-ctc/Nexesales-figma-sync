import type { ReactNode } from 'react';

// 値が無い項目の表示（グレーの半角「-」。画面設計標準 3.11「値が空の項目はグレーの「-」（一覧と同じ）」）。
// グリッドの外（基本情報・ヘッダー・ペイン等）で使う。グリッドのセルは GRID_DEFAULT_COL_DEF が受け持つ。
export const EMPTY_VALUE_TEXT = '-';

// 値が無いか（null・undefined・空文字・「-」「－」）
export const isEmptyValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && ['', '-', '－'].includes(value.trim()));

// グレーの「-」
export function EmptyValue() {
  return <span className="text-gray-400">{EMPTY_VALUE_TEXT}</span>;
}

// 値があればそのまま、無ければグレーの「-」を返す（例：{valueOrEmpty(info.department)}）
export const valueOrEmpty = (value: ReactNode): ReactNode =>
  isEmptyValue(value) ? <EmptyValue /> : value;

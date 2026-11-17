// 月ストリップ（対象年月の横並び選択 UI）の年月計算。
// 年月を「year * 12 + month（month は 1〜12）」の単一インデックスで扱い、
// ページ送りを単純な加減算に落とす。UI 側（month-strip-picker.tsx）はこの結果を描画するだけ。

// ストリップに一度に表示する月数（選択月を中央に、前後5か月ずつ＝計11か月）。
export const STRIP_MONTH_COUNT = 11;

// 選択月を中央に置くための、左端から中央までのオフセット（11件なら5）。
// windowStart = 選択インデックス - STRIP_CENTER_OFFSET とすると選択月が中央に来る。
export const STRIP_CENTER_OFFSET = Math.floor(STRIP_MONTH_COUNT / 2);

// ストリップの1タイル分。
export interface MonthTile {
  index: number;
  year: number;
  month: number;
  value: string;
}

// 'YYYY/MM'（'YYYY/M' も可）を年月インデックスへ変換する。不正値は null。
export const toMonthIndex = (value: string): number | null => {
  const [y, m] = String(value ?? '')
    .split('/')
    .map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return y * 12 + m;
};

// 年月インデックスから年を返す。
export const yearOfMonthIndex = (index: number): number =>
  Math.floor((index - 1) / 12);

// 年月インデックスから月（1〜12）を返す。
export const monthOfMonthIndex = (index: number): number =>
  ((index - 1) % 12) + 1;

// 年月インデックスを 'YYYY/MM' へ変換する（月は2桁ゼロ詰め）。
export const fromMonthIndex = (index: number): string =>
  `${yearOfMonthIndex(index)}/${String(monthOfMonthIndex(index)).padStart(2, '0')}`;

// windowStart を左端とする STRIP_MONTH_COUNT 件のタイルを返す。
export const buildMonthTiles = (windowStart: number): MonthTile[] =>
  Array.from({ length: STRIP_MONTH_COUNT }, (_, i) => {
    const index = windowStart + i;
    return {
      index,
      year: yearOfMonthIndex(index),
      month: monthOfMonthIndex(index),
      value: fromMonthIndex(index),
    };
  });

// 年ごとのタイルのかたまり（年は月のかたまりの上にまとめて表示する）。
export interface MonthTileGroup {
  year: number;
  tiles: MonthTile[];
}

// タイルを年ごとに分ける（並び順はそのまま）。
export const groupTilesByYear = (tiles: MonthTile[]): MonthTileGroup[] => {
  const groups: MonthTileGroup[] = [];
  for (const tile of tiles) {
    const last = groups[groups.length - 1];
    if (last && last.year === tile.year) last.tiles.push(tile);
    else groups.push({ year: tile.year, tiles: [tile] });
  }
  return groups;
};

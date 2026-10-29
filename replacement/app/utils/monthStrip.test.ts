import { describe, it, expect } from 'vitest';
import {
  STRIP_MONTH_COUNT,
  STRIP_CENTER_OFFSET,
  toMonthIndex,
  fromMonthIndex,
  yearOfMonthIndex,
  monthOfMonthIndex,
  buildMonthTiles,
} from './monthStrip';

describe('toMonthIndex / fromMonthIndex', () => {
  it('YYYY/MM を年月インデックスへ変換して往復できる', () => {
    const i = toMonthIndex('2026/05');
    expect(i).toBe(2026 * 12 + 5);
    expect(fromMonthIndex(i as number)).toBe('2026/05');
  });

  it('月がゼロ詰めされていなくても解釈する', () => {
    expect(toMonthIndex('2026/5')).toBe(2026 * 12 + 5);
  });

  it('12月をまたいでも往復できる', () => {
    const i = toMonthIndex('2026/12') as number;
    expect(fromMonthIndex(i)).toBe('2026/12');
    expect(fromMonthIndex(i + 1)).toBe('2027/01');
  });

  it('不正な値は null を返す', () => {
    expect(toMonthIndex('')).toBeNull();
    expect(toMonthIndex('abc')).toBeNull();
  });
});

describe('yearOfMonthIndex / monthOfMonthIndex', () => {
  it('1月の境界を正しく扱う', () => {
    const i = toMonthIndex('2026/01') as number;
    expect(yearOfMonthIndex(i)).toBe(2026);
    expect(monthOfMonthIndex(i)).toBe(1);
  });

  it('12月の境界を正しく扱う', () => {
    const i = toMonthIndex('2026/12') as number;
    expect(yearOfMonthIndex(i)).toBe(2026);
    expect(monthOfMonthIndex(i)).toBe(12);
  });
});

describe('buildMonthTiles', () => {
  it('9ヶ月分のタイルを返す', () => {
    const tiles = buildMonthTiles(toMonthIndex('2026/05') as number);
    expect(tiles).toHaveLength(STRIP_MONTH_COUNT);
    expect(STRIP_MONTH_COUNT).toBe(9);
  });

  // 選択月を中央に置く：windowStart = 選択インデックス - 中央オフセット(4)。
  // 2026/09 を選択すると 2026年5月〜2027年1月 の9件になり、中央(index 4)が選択月。
  it('選択月が中央（前後4ヶ月）に来る', () => {
    const selected = toMonthIndex('2026/09') as number;
    const tiles = buildMonthTiles(selected - STRIP_CENTER_OFFSET);
    expect(tiles.map((t) => t.month)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 1]);
    expect(tiles[STRIP_CENTER_OFFSET].value).toBe('2026/09');
  });

  // 9ヶ月表示：2026/05 起点は 2026年5月〜2027年1月 の9件になる
  it('2026/05 起点で 2026年5月〜2027年1月 を返す', () => {
    const tiles = buildMonthTiles(toMonthIndex('2026/05') as number);
    expect(tiles.map((t) => t.month)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 1]);
    expect(tiles.map((t) => t.year)).toEqual([
      2026, 2026, 2026, 2026, 2026, 2026, 2026, 2026, 2027,
    ]);
  });

  // >> を1回押した後（1ヶ月送り）：左端が1つ進み、右端に1ヶ月増える
  it('1ヶ月送ると起点が1つ進む', () => {
    const start = toMonthIndex('2026/05') as number;
    const tiles = buildMonthTiles(start + 1);
    expect(tiles.map((t) => t.month)).toEqual([6, 7, 8, 9, 10, 11, 12, 1, 2]);
    expect(tiles[0].value).toBe('2026/06');
  });

  it('年をまたぐウィンドウでは年が切り替わる', () => {
    const tiles = buildMonthTiles(toMonthIndex('2025/10') as number);
    expect(tiles.map((t) => `${t.year}/${t.month}`)).toEqual([
      '2025/10',
      '2025/11',
      '2025/12',
      '2026/1',
      '2026/2',
      '2026/3',
      '2026/4',
      '2026/5',
      '2026/6',
    ]);
  });

  it('タイルは value として YYYY/MM を持つ', () => {
    const tiles = buildMonthTiles(toMonthIndex('2026/05') as number);
    expect(tiles[0].value).toBe('2026/05');
    expect(tiles[STRIP_MONTH_COUNT - 1].value).toBe('2027/01');
  });
});

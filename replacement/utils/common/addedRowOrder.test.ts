import { describe, it, expect } from 'vitest';
import { orderAddedRows } from './addedRowOrder';

interface Row {
  id: string;
  set?: string;
  _addedSeq?: number;
  _copyOf?: string;
}

const keyOf = (r: Row) => r.set ?? r.id;
const ids = (rows: Row[]) => rows.map((r) => r.id);

describe('orderAddedRows', () => {
  const base: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('追加した行が無ければ並びを変えない', () => {
    expect(ids(orderAddedRows(base, keyOf))).toEqual(['a', 'b', 'c']);
  });

  it('新規追加・下ペインからのコピーは追加した順に最下行へ置く', () => {
    const rows: Row[] = [
      { id: 'n2', _addedSeq: 2 },
      ...base,
      { id: 'n1', _addedSeq: 1 },
    ];
    expect(ids(orderAddedRows(rows, keyOf))).toEqual([
      'a',
      'b',
      'c',
      'n1',
      'n2',
    ]);
  });

  it('行コピーはコピー元の行のすぐ下に置く', () => {
    const rows: Row[] = [...base, { id: 'copyA', _addedSeq: 1, _copyOf: 'a' }];
    expect(ids(orderAddedRows(rows, keyOf))).toEqual(['a', 'copyA', 'b', 'c']);
  });

  it('同じ行を続けてコピーすると、新しいコピーがコピー元のすぐ下に来る', () => {
    const rows: Row[] = [
      ...base,
      { id: 'copy1', _addedSeq: 1, _copyOf: 'b' },
      { id: 'copy2', _addedSeq: 2, _copyOf: 'b' },
    ];
    expect(ids(orderAddedRows(rows, keyOf))).toEqual([
      'a',
      'b',
      'copy2',
      'copy1',
      'c',
    ]);
  });

  it('追加した行のコピーは、その追加した行のすぐ下に置く', () => {
    const rows: Row[] = [
      ...base,
      { id: 'n1', _addedSeq: 1 },
      { id: 'copyN1', _addedSeq: 2, _copyOf: 'n1' },
    ];
    expect(ids(orderAddedRows(rows, keyOf))).toEqual([
      'a',
      'b',
      'c',
      'n1',
      'copyN1',
    ]);
  });

  it('コピー元が表に出ていない（別のタブ等）ときは最下行に置く', () => {
    const rows: Row[] = [...base, { id: 'copyX', _addedSeq: 1, _copyOf: 'x' }];
    expect(ids(orderAddedRows(rows, keyOf))).toEqual(['a', 'b', 'c', 'copyX']);
  });

  it('まとまり（ギフトの3行1セット）はまとめて動かし、セットの最後の行の下に入れる', () => {
    const rows: Row[] = [
      { id: 'g1', set: 'G' },
      { id: 'g2', set: 'G' },
      { id: 'g3', set: 'G' },
      { id: 'z' },
      { id: 'h1', set: 'H', _addedSeq: 1, _copyOf: 'G' },
      { id: 'h2', set: 'H', _addedSeq: 1, _copyOf: 'G' },
      { id: 'h3', set: 'H', _addedSeq: 1, _copyOf: 'G' },
    ];
    expect(ids(orderAddedRows(rows, keyOf))).toEqual([
      'g1',
      'g2',
      'g3',
      'h1',
      'h2',
      'h3',
      'z',
    ]);
  });
});

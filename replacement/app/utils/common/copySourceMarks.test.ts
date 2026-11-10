import { describe, it, expect } from 'vitest';
import { markCopySource, stripCopySource } from './copySourceMarks';

interface Row {
  lineNo: number;
  _copySource?: 'reference' | 'detail' | 'new';
}

describe('markCopySource', () => {
  it('帯を付ける画面では、指定した追加経路を持つ新しい行を返す', () => {
    const row: Row = { lineNo: 3 };
    const marked = markCopySource(row, 'detail', true);
    expect(marked).toEqual({ lineNo: 3, _copySource: 'detail' });
    expect(marked).not.toBe(row);
  });

  it('コピー元が別の追加経路を持っていても、指定した経路で上書きする', () => {
    const row: Row = { lineNo: 3, _copySource: 'new' };
    expect(markCopySource(row, 'detail', true)._copySource).toBe('detail');
  });

  it('帯を付けない画面では、行をそのまま返す（従来どおり）', () => {
    const row: Row = { lineNo: 3 };
    const result = markCopySource(row, 'new', false);
    expect(result).toBe(row);
    expect(result).not.toHaveProperty('_copySource');
  });
});

describe('stripCopySource', () => {
  it('帯を持つ行だけ帯を外し、持たない行は同じ参照のまま残す', () => {
    const plain: Row = { lineNo: 1 };
    const copied: Row = { lineNo: 2, _copySource: 'detail' };
    const added: Row = { lineNo: 3, _copySource: 'new' };
    const result = stripCopySource([plain, copied, added]);
    expect(result).toEqual([{ lineNo: 1 }, { lineNo: 2 }, { lineNo: 3 }]);
    expect(result[0]).toBe(plain);
    expect(result[1]._copySource).toBeUndefined();
    expect(result[2]._copySource).toBeUndefined();
  });

  it('帯を持つ行が無ければ、同じ配列をそのまま返す（再描画させない）', () => {
    const rows: Row[] = [{ lineNo: 1 }, { lineNo: 2 }];
    expect(stripCopySource(rows)).toBe(rows);
  });

  it('空配列はそのまま返す', () => {
    const rows: Row[] = [];
    expect(stripCopySource(rows)).toBe(rows);
  });
});

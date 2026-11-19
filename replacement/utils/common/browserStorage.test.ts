import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readStoredJson,
  readStoredText,
  removeStored,
  writeStoredJson,
  writeStoredText,
} from './browserStorage';

// node の環境には localStorage が無いため、Map で作った代わりを window に置く
const fakeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('サーバー側（window が無い）', () => {
  it('読むと null・書くと false で、例外を投げない', () => {
    expect(readStoredText('k')).toBeNull();
    expect(readStoredJson('k')).toBeNull();
    expect(writeStoredJson('k', [1])).toBe(false);
    expect(() => removeStored('k')).not.toThrow();
  });
});

describe('ブラウザ', () => {
  it('JSON で保存して読み戻す・消す', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage() });
    expect(writeStoredJson('k', { a: 1 })).toBe(true);
    expect(readStoredJson<{ a: number }>('k')).toEqual({ a: 1 });
    removeStored('k');
    expect(readStoredJson('k')).toBeNull();
  });

  it('壊れた保存値は null', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage() });
    writeStoredText('k', '{壊れた');
    expect(readStoredText('k')).toBe('{壊れた');
    expect(readStoredJson('k')).toBeNull();
  });

  it('保存できない（容量超過など）ときは false', () => {
    const s = fakeStorage();
    s.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    vi.stubGlobal('window', { localStorage: s });
    expect(writeStoredText('k', 'v')).toBe(false);
  });
});

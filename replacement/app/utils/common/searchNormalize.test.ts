import { describe, it, expect } from 'vitest';
import { normalizeForSearch, matchesSearchQuery } from './searchNormalize';

describe('normalizeForSearch', () => {
  it('全角英数字を半角へ揃える', () => {
    expect(normalizeForSearch('５００ＭＬ')).toBe('500ml');
  });

  it('英字の大文字・小文字を区別しない', () => {
    expect(normalizeForSearch('500ML')).toBe(normalizeForSearch('500ml'));
  });

  it('半角カナを全角カナへ揃える（濁点付きも1文字に合成する）', () => {
    expect(normalizeForSearch('ｶﾞﾌﾞﾘﾁol')).toBe(
      normalizeForSearch('ガブリチol')
    );
  });

  it('全角スペースを半角スペースへ揃える', () => {
    expect(normalizeForSearch('お茶　５００')).toBe('お茶 500');
  });

  it('未入力・null 相当は空文字を返す', () => {
    expect(normalizeForSearch('')).toBe('');
    expect(normalizeForSearch(undefined)).toBe('');
  });

  it('漢字・かなはそのまま保持する', () => {
    expect(normalizeForSearch('緑茶帯')).toBe('緑茶帯');
  });
});

describe('matchesSearchQuery', () => {
  it('全角で入力しても半角表記の候補にヒットする', () => {
    expect(matchesSearchQuery('500ml帯', '５００')).toBe(true);
    expect(matchesSearchQuery('500ml帯', 'ＭＬ')).toBe(true);
  });

  it('半角で入力しても全角表記の候補にヒットする', () => {
    expect(matchesSearchQuery('５００ｍｌ帯', '500')).toBe(true);
  });

  it('大文字・小文字を区別せずヒットする', () => {
    expect(matchesSearchQuery('500ml帯', 'ML')).toBe(true);
  });

  it('一致しない場合は false を返す', () => {
    expect(matchesSearchQuery('500ml帯', '350')).toBe(false);
  });

  it('候補が未設定（undefined）なら false を返す', () => {
    expect(matchesSearchQuery(undefined, '500')).toBe(false);
  });

  it('検索語が空なら true を返す（絞り込みなし）', () => {
    expect(matchesSearchQuery('500ml帯', '')).toBe(true);
  });
});

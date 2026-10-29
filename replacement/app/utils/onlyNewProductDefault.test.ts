import { describe, it, expect } from 'vitest';
import { initialOnlyNew } from './onlyNewProductDefault';

describe('initialOnlyNew', () => {
  it('① 初期チェックする画面で商品区分が新商品ならチェックあり', () => {
    expect(initialOnlyNew('新商品', true, false)).toBe(true);
  });

  it('② 初期チェックする画面で新商品以外ならチェックなし', () => {
    expect(initialOnlyNew('定番商品', true, false)).toBe(false);
  });

  it('③ 対象年月が未入力（非活性）の間はチェックなし', () => {
    expect(initialOnlyNew('新商品', true, true)).toBe(false);
  });

  it('④ 初期チェックしない画面では利用者の操作を保つ（null）', () => {
    expect(initialOnlyNew('新商品', false, false)).toBeNull();
  });

  it('⑤ 初期チェックしない画面でも、非活性の間はチェックを外す', () => {
    expect(initialOnlyNew('新商品', false, true)).toBe(false);
  });
});

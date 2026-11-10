import { describe, it, expect } from 'vitest';
import {
  NO_LINK_PATTERN,
  storeInputAvailability,
  isSplitDestRow,
  type NoLinkPattern,
} from './paymentNoLink';

describe('storeInputAvailability', () => {
  it('② 商流のみに紐づく：一次店・三次店は入力、販売店はダミー（権限 P9）', () => {
    expect(storeInputAvailability(NO_LINK_PATTERN.distributionOnly)).toEqual({
      dealer: false,
      firstStore: true,
      thirdStore: true,
    });
  });

  it('③ 販売店のみに紐づく：販売店は入力、一次店・三次店はダミー（権限 P10）', () => {
    expect(storeInputAvailability(NO_LINK_PATTERN.dealerOnly)).toEqual({
      dealer: true,
      firstStore: false,
      thirdStore: false,
    });
  });

  it('④ 末端組織のみに紐づく：すべてダミー（権限 P11）', () => {
    expect(storeInputAvailability(NO_LINK_PATTERN.terminalOrgOnly)).toEqual({
      dealer: false,
      firstStore: false,
      thirdStore: false,
    });
  });

  it('未知のパターンは④へ寄せず例外にする（型チェックのゲートが無いため）', () => {
    expect(() => storeInputAvailability('未選択' as NoLinkPattern)).toThrow(
      '未知の作成単位パターン: 未選択'
    );
  });
});

describe('isSplitDestRow', () => {
  it('費用分割で追加された分割先行を判定する', () => {
    expect(isSplitDestRow({ costSplit: '分割先' })).toBe(true);
  });

  it('分割元行（分割の入力内容を持つ行）は分割先行ではない', () => {
    expect(
      isSplitDestRow({ costSplit: '計上先：本社、費用負担部署：営業一部' })
    ).toBe(false);
  });

  it('通常の明細行は分割先行ではない', () => {
    expect(isSplitDestRow({})).toBe(false);
  });
});

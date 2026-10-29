import { describe, it, expect } from 'vitest';
import {
  DEFAULT_QUOTE_BASIC_INFO,
  resolveQuoteBasicInfo,
  type QuoteBasicInfo,
} from './quoteBasicInfo';

describe('resolveQuoteBasicInfo', () => {
  it('未指定なら全項目を既定値で埋める', () => {
    expect(resolveQuoteBasicInfo()).toEqual(DEFAULT_QUOTE_BASIC_INFO);
  });

  it('部分指定は指定分のみ上書きし残りは既定値', () => {
    const result = resolveQuoteBasicInfo({ targetMonth: '2024/03' });
    expect(result.targetMonth).toBe('2024/03');
    expect(result.dealer).toBe(DEFAULT_QUOTE_BASIC_INFO.dealer);
    expect(result.thirdStore).toBe(DEFAULT_QUOTE_BASIC_INFO.thirdStore);
    expect(result.firstStore).toBe(DEFAULT_QUOTE_BASIC_INFO.firstStore);
  });

  it('空文字は「クリア」として尊重し既定値で上書きしない', () => {
    const result = resolveQuoteBasicInfo({ dealer: '' });
    expect(result.dealer).toBe('');
  });

  it('全項目指定はそのまま返す', () => {
    const full: QuoteBasicInfo = {
      targetMonth: '2026/12',
      dealer: 'd1',
      thirdStore: 't1',
      firstStore: 'f1',
    };
    expect(resolveQuoteBasicInfo(full)).toEqual(full);
  });
});

import { describe, it, expect } from 'vitest';
import {
  deriveExternalUnitPrice,
  UNIT_PRICE_KBN_AVAILABLE,
  type ExternalUnitPriceMasterValues,
} from './externalUnitPrice';

// 補足2-2 の分岐1（アイテムバラ保証金抜き単価が取得可能）を満たすマスタ値。
const master = (
  over: Partial<ExternalUnitPriceMasterValues> = {}
): ExternalUnitPriceMasterValues => ({
  itemBaraPrice: '70.00',
  opeChannel: true,
  opeBaraPrice: '65.00',
  seihan: '48.50',
  ...over,
});

describe('deriveExternalUnitPrice', () => {
  it('No.5 単価取得区分が取得可能なら納価を返す（他の条件より優先）', () => {
    expect(
      deriveExternalUnitPrice(master(), UNIT_PRICE_KBN_AVAILABLE, '131.60')
    ).toEqual({
      kind: '納価',
      value: 131.6,
      source: '販売計画表保存済みの納価設定',
    });
  });

  it('No.1 単価保証金抜きが取得可能なら特殊単価（アイテムバラ）', () => {
    expect(deriveExternalUnitPrice(master(), '取得不可', '131.60')).toEqual({
      kind: '特殊単価',
      value: 70,
      source: '単価マスタ_アイテムバラ保証金抜き単価',
    });
  });

  it('No.2 単価保証金抜きが取得不可・オペチャネルYes・オペバラ≠0 なら特殊単価（オペレータバラ）', () => {
    expect(
      deriveExternalUnitPrice(
        master({ itemBaraPrice: '', opeChannel: true, opeBaraPrice: '65.00' }),
        '0',
        '131.60'
      )
    ).toEqual({
      kind: '特殊単価',
      value: 65,
      source: '商品マスタ_オペレータバラ保証金抜き価格',
    });
  });

  it('No.3 オペチャネルYes・オペバラ=0 なら生販', () => {
    expect(
      deriveExternalUnitPrice(
        master({ itemBaraPrice: '', opeChannel: true, opeBaraPrice: '0' }),
        '',
        '131.60'
      )
    ).toEqual({
      kind: '生販',
      value: 48.5,
      source: '商品マスタ_商品生産者バラ価格保証金抜',
    });
  });

  it('No.4 オペチャネルNo なら生販（オペバラの値は見ない）', () => {
    expect(
      deriveExternalUnitPrice(
        master({ itemBaraPrice: '', opeChannel: false, opeBaraPrice: '65.00' }),
        '取得不可',
        '131.60'
      )
    ).toEqual({
      kind: '生販',
      value: 48.5,
      source: '商品マスタ_商品生産者バラ価格保証金抜',
    });
  });

  it('単価取得区分が 0・空欄・取得不可 はいずれも同じ分岐に入る', () => {
    const m = master({ itemBaraPrice: '70.00' });
    for (const kbn of ['0', '', '取得不可']) {
      expect(deriveExternalUnitPrice(m, kbn, '131.60').kind).toBe('特殊単価');
    }
  });

  it('納価が空なら値は NaN（呼び出し側で表示を抑止する）', () => {
    expect(
      deriveExternalUnitPrice(master(), UNIT_PRICE_KBN_AVAILABLE, '').value
    ).toBeNaN();
  });

  it('3桁区切りの納価を解釈する', () => {
    expect(
      deriveExternalUnitPrice(master(), UNIT_PRICE_KBN_AVAILABLE, '1,131.60')
        .value
    ).toBe(1131.6);
  });
});

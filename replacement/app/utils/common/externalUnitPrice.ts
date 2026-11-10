// 社外売単価の導出 ─ 補足資料「補足2-2.社外売単価の導出方法」
//
// 明細表の 社外売上高 ＝ 社外売単価 × 入数 × 函数(計画) で使う。
// 社外売単価は3つのマスタの条件で決まる（判定順は No.5 → No.1 → No.2 → No.3/4）。
//
//   No.5 単価取得区分＝取得可能
//        → 納価
//   No.1 単価取得区分∈{0,空欄,取得不可} かつ 単価保証金抜き＝取得可能
//        → 特殊単価（アイテムバラ保証金抜き単価）
//   No.2 同上・単価保証金抜き＝取得不可・オペチャネル＝Yes・オペバラ≠0
//        → 特殊単価（オペレータバラ保証金抜き価格）
//   No.3 同上・オペチャネル＝Yes・オペバラ＝0
//        → 生販（商品生産者バラ価格保証金抜）
//   No.4 同上・オペチャネル＝No
//        → 生販（同上）
//
// オペバラが取得不可（空文字）の場合は No.2 の条件を満たさず No.3/4 の生販へ落とす。
// 補足2-2 の表は Yes チャネルについて「0以外」「0」しか定義していないため、安全側に倒している。
import { parseFormulaNumber } from '../../components/grid/gridCommon';

export type ExternalUnitPriceKind = '特殊単価' | '生販' | '納価';

// 取引先補足情報マスタ_単価取得区分が「取得可能」を表す値。
export const UNIT_PRICE_KBN_AVAILABLE = '取得可能';

// 補足2-2 の条件列に対応する、商品1件分のマスタ値。
export interface ExternalUnitPriceMasterValues {
  // 飲料単価マスタ_アイテムバラ保証金抜き単価（空文字＝取得不可）
  itemBaraPrice: string;
  // 飲料商品マスタ_オペチャネル
  opeChannel: boolean;
  // 飲料商品マスタ_オペレータバラ保証金抜き価格
  opeBaraPrice: string;
  // 飲料商品マスタ_商品生産者バラ価格保証金抜（＝生販）
  seihan: string;
}

export interface ExternalUnitPrice {
  kind: ExternalUnitPriceKind;
  value: number;
  // 補足2-2 の「取得元」列。ツールチップ・レポート用。
  source: string;
}

export function deriveExternalUnitPrice(
  master: ExternalUnitPriceMasterValues,
  unitPriceKbn: string,
  planPrice: string
): ExternalUnitPrice {
  // No.5 取引先補足情報マスタから単価が取得できる場合は納価をそのまま使う。
  if (unitPriceKbn === UNIT_PRICE_KBN_AVAILABLE) {
    return {
      kind: '納価',
      value: parseFormulaNumber(planPrice),
      source: '販売計画表保存済みの納価設定',
    };
  }

  // No.1 飲料単価マスタからアイテムバラ保証金抜き単価が取得できる場合。
  const itemBara = parseFormulaNumber(master.itemBaraPrice);
  if (Number.isFinite(itemBara)) {
    return {
      kind: '特殊単価',
      value: itemBara,
      source: '単価マスタ_アイテムバラ保証金抜き単価',
    };
  }

  // No.2 オペチャネルの商品で、オペレータバラ保証金抜き価格が設定されている場合。
  const opeBara = parseFormulaNumber(master.opeBaraPrice);
  if (master.opeChannel && Number.isFinite(opeBara) && opeBara !== 0) {
    return {
      kind: '特殊単価',
      value: opeBara,
      source: '商品マスタ_オペレータバラ保証金抜き価格',
    };
  }

  // No.3 / No.4 上記以外は生販（商品生産者バラ価格保証金抜）を使う。
  return {
    kind: '生販',
    value: parseFormulaNumber(master.seihan),
    source: '商品マスタ_商品生産者バラ価格保証金抜',
  };
}

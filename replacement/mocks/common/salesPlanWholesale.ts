// 計画詳細(NET固定)・販売計画シミュレーション(NET固定)：明細のダミー値の補完（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。

import type { ProductData } from '@/types/salesPlanWholesale';
import {
  SUMMARY_PRODUCT_BY_VALUE,
  SUMMARY_PRODUCT_BY_WHOLESALE_MESH,
  SUMMARY_PRODUCT_VALUES,
  WHOLESALE_MESH_VALUES,
} from '@/constants/productMasters';

// ============================================================================
// 計画詳細(NET固定)・シミュレーション(NET固定) 共通のダミーデータ補完。
// 同じ行（同じ prefix と index＝同じ seed）には同じダミー値が入り、
// 明細表とシミュレーション表の初期データが揃う。
// ============================================================================

// EDI反映ダミー生成用のオフセット（差異±1.00未満/以上が混在）。
const EDI_OFFSETS = [0.3, -0.5, 0.8, 1.5, -2.2, 3.1, -0.2, 2.6];

const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const numOf = (s?: string): number =>
  parseFloat(String(s ?? '').replace(/,/g, ''));

const isBlank = (s?: string): boolean => !s || String(s).trim() === '';

// EDI反映：納価近傍のランダム値。一部の行は「ー」（値なし）。
const fixedEdi = (seed: string, planPrice?: string): string => {
  const s = hashStr(seed);
  if (s % 4 === 0) return ''; // 一部はー（値なし）
  const plan = numOf(planPrice);
  if (!(plan > 0)) return '';
  return (plan + EDI_OFFSETS[s % EDI_OFFSETS.length]).toFixed(2);
};

// 納価-計画ダミー（全商品区分で必ず値）。空欄なら 18.00〜29.99 円。
const fixedPlanPrice = (seed: string, existing?: string): string => {
  if (!isBlank(existing)) return existing as string;
  const s = hashStr(`${seed}-plan`);
  return (18 + (s % 12) + (s % 100) / 100).toFixed(2);
};

// NETダミー（必ず0以外・納価未満＝マージン率0〜100%）。既存が 0<NET<納価 なら温存。
const fixedNet = (
  seed: string,
  planPriceStr: string,
  existing?: string
): string => {
  const pp = numOf(planPriceStr);
  const ex = numOf(existing);
  if (ex > 0 && ex < pp) return String(existing);
  const s = hashStr(`${seed}-net`);
  const ratio = 0.6 + (s % 21) / 100; // 0.60〜0.80
  return Math.max(1, pp * ratio).toFixed(2);
};

// 売価ダミー（全行・納価より高め＝値入率が正）。空欄行のみ補完。
const fixedSalesPrice = (
  seed: string,
  planPriceStr: string,
  existing?: string
): string => {
  if (!isBlank(existing)) return existing as string;
  const pp = numOf(planPriceStr);
  const s = hashStr(`${seed}-price`);
  const ratio = 1.1 + (s % 21) / 100; // 1.10〜1.30
  return (pp * ratio).toFixed(2);
};

// マージン率＝(納価−NET)/納価×100（既存値は温存）。
const computedMargin = (
  planPriceStr: string,
  netStr: string,
  existing?: string
): string => {
  if (!isBlank(existing)) return existing as string;
  const pp = numOf(planPriceStr);
  if (!(pp > 0)) return '0.00%';
  return `${(((pp - numOf(netStr)) / pp) * 100).toFixed(2)}%`;
};

// 値入率＝(売価−納価)/売価×100（既存値は温存）。
const computedDiscount = (
  priceStr: string,
  planPriceStr: string,
  existing?: string
): string => {
  if (!isBlank(existing)) return existing as string;
  const pr = numOf(priceStr);
  const pp = numOf(planPriceStr);
  if (!(pr > 0) || !(pp > 0)) return '0.00%';
  return `${(((pr - pp) / pr) * 100).toFixed(2)}%`;
};

// 1行ぶんのダミー補完（id は変更しない。seed は決定的ダミーの種）。
//  ・サマリ商品名/一般卸メッシュ：空欄なら相互のひも付き（明細追加と同じマスタ）で補完
//  ・納価-計画/NET/売価/EDI反映/マージン率/値入率：上記ルールで補完
export const fillWholesaleRow = (
  row: ProductData,
  seed: string
): ProductData => {
  const r = { ...row } as ProductData;
  // サマリ商品名 ⇔ 一般卸メッシュ のひも付き補完（定番=商品名空／特殊=メッシュ空 等）。
  if (isBlank(r.summaryProduct)) {
    r.summaryProduct =
      (!isBlank(r.wholesaleMesh) &&
        SUMMARY_PRODUCT_BY_WHOLESALE_MESH.get(r.wholesaleMesh)?.value) ||
      SUMMARY_PRODUCT_VALUES[hashStr(seed) % SUMMARY_PRODUCT_VALUES.length] ||
      r.summaryProduct;
  }
  if (isBlank(r.wholesaleMesh)) {
    r.wholesaleMesh =
      (!isBlank(r.summaryProduct) &&
        SUMMARY_PRODUCT_BY_VALUE.get(r.summaryProduct)?.wholesaleMesh) ||
      WHOLESALE_MESH_VALUES[hashStr(seed) % WHOLESALE_MESH_VALUES.length] ||
      r.wholesaleMesh;
  }
  const planPrice = fixedPlanPrice(seed, r.planPrice);
  const net = fixedNet(seed, planPrice, r.net);
  const price = fixedSalesPrice(seed, planPrice, r.price);
  r.planPrice = planPrice;
  r.net = net;
  r.price = price;
  r.ediPrice = !isBlank(r.ediPrice) ? r.ediPrice : fixedEdi(seed, planPrice);
  r.margin = computedMargin(planPrice, net, r.margin);
  r.discount = computedDiscount(price, planPrice, r.discount);
  return r;
};

// 行に一意IDを付与しつつ、上記ダミーを補完する（計画詳細の useState 初期化用）。
export const withWholesaleRowDummies = (
  rows: ProductData[],
  prefix: string
): ProductData[] =>
  rows.map((r, i) => {
    const id = r.id ?? `${prefix}-${i}`;
    return { ...fillWholesaleRow(r, id), id };
  });

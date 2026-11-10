import { describe, it, expect } from 'vitest';
import { toAggregationProducts } from './planGridToAggregation';
import { SUMMARY_PRODUCT_OPTIONS } from '../../../constants/productMasters';

// 2025/10 が対象年月 → index0 = 9
const CONTEXT = { planPattern: 'marginRateFixed' as const, targetMonthIdx0: 9 };

const row = (over: Record<string, string> = {}) => ({
  section: '定番商品',
  productCategory: '定番商品',
  metaBrand: '三ツ矢',
  containerCapacityG: '350mL',
  summaryProduct: SUMMARY_PRODUCT_OPTIONS[0].value,
  wholesaleMesh: '',
  quantity: '24',
  plan: '800',
  planPrice: '95.36',
  ...over,
});

describe('toAggregationProducts', () => {
  it('グリッド1行から集計ソース1件を作る', () => {
    expect(toAggregationProducts([row()], CONTEXT)).toHaveLength(1);
  });

  it('メタブランド・容器容量Gを集計軸の値へ写す', () => {
    const [product] = toAggregationProducts([row()], CONTEXT);
    expect(product.metaBrand).toBe('三ツ矢');
    expect(product.capacity).toBe('PET・ボトル缶280・350');
  });

  it('対象月の計画函数はグリッドの入力値と一致する', () => {
    const [product] = toAggregationProducts([row({ plan: '800' })], CONTEXT);
    expect(product.funcByMonth).toHaveLength(12);
    expect(product.funcByMonth[9]).toBe(800);
  });

  it('入数・納価をそのまま数値化する', () => {
    const [product] = toAggregationProducts([row()], CONTEXT);
    expect(product.quantity).toBe(24);
    expect(product.deliveryPrice).toBeCloseTo(95.36, 6);
  });

  // 社外売単価・支社受渡原価・条件口単価・量経追加口率を厳密値で検証する。
  //
  // row() は summaryProduct: SUMMARY_PRODUCT_OPTIONS[0].value
  //   （＝『三ツ矢サイダー500mL24本』、metaBrand: '三ツ矢'）を参照する。
  //   このマスタの itemBaraPrice: '70.00' / costOfSales: '52.00'。
  //
  // 【社外売単価】補足2-2 の判定は No.5→No.1→No.2→No.3/4 の順。
  //   単価取得区分は constants/planBasicInfoMockData の UNIT_PRICE_KBN（'取得不可'）が
  //   使われるため No.5（納価をそのまま採用）は成立せず、No.1
  //   （飲料単価マスタ_アイテムバラ保証金抜き単価）が itemBaraPrice: '70.00' で
  //   数値として取得できるためこれを採用 → extUnitPrice = 70。
  //
  // 【支社受渡原価】補足2-3 は costOfSales をそのまま使う → costUnitPriceTransfer = 52。
  //
  // 【条件口単価】補足4-2 抽出ステップ（constants/conditionUnitPriceMaster）を
  //   metaBrand '三ツ矢' でたどる。
  //     No.2 商品・商流分類紐づけマスタ: CHANNEL_CLASS_BY_META_BRAND['三ツ矢'] = 'CC01_炭酸'
  //     No.3 商流販売店マスタ: DIRECT_CHANNEL_CODE_BY_CLASS['CC01_炭酸'] = 'DC1001'
  //     No.4 商流マスタ: CHANNEL_MASTER['DC1001'] = { tier1: '国分グループ本社', salesKbn: 'ドライ', ... }
  //     No.5 量販経費情報マスタ: PATTERN_CODE_BY_TIER1['国分グループ本社'] = 'V1010'
  //       （salesKbn が 'ドライ' のためチルド接尾辞 'C' は付かず patternCode = 'V1010'）
  //     No.7 単価パターンマスタ: CONDITION_UNIT_PRICE_BY_PATTERN['V1010'] = 6
  //   → conditionUnitPrice = 6。
  //
  // 【量経追加口率】constants/aggregationMasterDummy の
  //   VOLUME_ADD_RATE_BY_BRAND['三ツ矢'] = 0.07（既定値0.06とは異なる値であり、
  //   ブランド別マスタが正しく引かれていることを検証できる）。
  it('社外売単価・支社受渡原価・条件口単価・量経追加口率をマスタから厳密値で導出する', () => {
    const [product] = toAggregationProducts([row()], CONTEXT);
    expect(product.extUnitPrice).toBe(70);
    expect(product.deliveryPrice).toBe(95.36);
    expect(product.costUnitPriceTransfer).toBe(52);
    expect(product.conditionUnitPrice).toBe(6);
    expect(product.volumeAddRate).toBe(0.07);
  });

  it('PB商品を判定する', () => {
    const [pb] = toAggregationProducts([row({ metaBrand: 'PB商品' })], CONTEXT);
    expect(pb.isPB).toBe(true);
    const [normal] = toAggregationProducts([row()], CONTEXT);
    expect(normal.isPB).toBe(false);
  });

  it('合計行・見出し行（_isHeader / isTotal）は除外する', () => {
    const rows = [
      row(),
      { ...row(), _isHeader: true },
      { ...row(), isTotal: true },
    ];
    expect(toAggregationProducts(rows as never[], CONTEXT)).toHaveLength(1);
  });

  it('計画函数が空・0の行は集計ソースに含めない', () => {
    expect(toAggregationProducts([row({ plan: '' })], CONTEXT)).toHaveLength(0);
    expect(toAggregationProducts([row({ plan: '0' })], CONTEXT)).toHaveLength(
      0
    );
  });

  it('ギフト行（上旬・中旬・下旬）はそれぞれ1件として扱う', () => {
    const gift = { ...row({ productCategory: 'ギフト' }), giftSetId: 'g1' };
    const rows = [
      { ...gift, period: '上旬', plan: '100' },
      { ...gift, period: '中旬', plan: '200' },
      { ...gift, period: '下旬', plan: '300' },
    ];
    const products = toAggregationProducts(rows as never[], CONTEXT);
    expect(products).toHaveLength(3);
    // ギフトは容器容量Gも集計軸「ギフト」へ寄せる
    for (const product of products) expect(product.capacity).toBe('ギフト');
  });

  it('空配列を渡すと空配列を返す', () => {
    expect(toAggregationProducts([], CONTEXT)).toEqual([]);
  });

  it('NET固定は一般卸メッシュからマスタを引く', () => {
    const netFixedRow = row({
      summaryProduct: '',
      wholesaleMesh: '【三ツ矢150円】三ツ矢サイダー28・350',
    });
    const [product] = toAggregationProducts([netFixedRow], {
      planPattern: 'netFixed',
      targetMonthIdx0: 9,
    });
    expect(product.extUnitPrice).toBeGreaterThan(0);
    expect(product.costUnitPriceTransfer).toBeGreaterThan(0);
  });
});

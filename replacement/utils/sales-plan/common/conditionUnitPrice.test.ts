import { describe, it, expect } from 'vitest';
import {
  deriveConditionUnitPrice,
  DEFAULT_STORE_KEY,
} from './conditionUnitPrice';
import { SUMMARY_PRODUCT_OPTIONS } from '@/constants/productMasters';

const forSummary = (summaryProduct: string) =>
  deriveConditionUnitPrice({
    planPattern: 'marginRateFixed',
    summaryProduct,
    wholesaleMesh: '',
    storeKey: DEFAULT_STORE_KEY,
  });

describe('deriveConditionUnitPrice（マージン率固定・NET入力）', () => {
  it('サマリ商品を入口に、6ステップすべてをたどって単価を返す', () => {
    const result = forSummary(SUMMARY_PRODUCT_OPTIONS[0].value);
    expect(result.representativeSummaryProduct).toBe(
      SUMMARY_PRODUCT_OPTIONS[0].value
    );
    expect(result.channelClass).not.toBe('');
    expect(result.directChannelCode).not.toBe('');
    expect(result.tier1).not.toBe('');
    expect(result.patternCode).not.toBe('');
    expect(result.onlineProduct).not.toBe('');
    expect(result.value).toBeGreaterThan(0);
  });

  it('たどったステップを6件記録する（取引制度メッシュマスタは通らない）', () => {
    expect(forSummary(SUMMARY_PRODUCT_OPTIONS[0].value).steps).toHaveLength(6);
  });

  it('商品マスタの全サマリ商品で単価を導出できる', () => {
    for (const option of SUMMARY_PRODUCT_OPTIONS) {
      const result = forSummary(option.value);
      expect(result.value, option.value).toBeGreaterThan(0);
    }
  });

  it('売上区分はドライまたはチルドのいずれか', () => {
    for (const option of SUMMARY_PRODUCT_OPTIONS) {
      expect(['ドライ', 'チルド']).toContain(forSummary(option.value).salesKbn);
    }
  });

  it('同一サマリ商品・同一商流なら常に同じ単価（決定的）', () => {
    const a = forSummary(SUMMARY_PRODUCT_OPTIONS[0].value);
    const b = forSummary(SUMMARY_PRODUCT_OPTIONS[0].value);
    expect(a.value).toBe(b.value);
  });

  it('サマリ商品が引けない場合は単価0を返す（例外を投げない）', () => {
    expect(forSummary('存在しない商品').value).toBe(0);
  });

  // 追加要件：異なる流通チャネル・異なる単価の製品で検証
  it('炭酸系のサマリ商品は国分商流をたどり単価パターンV1010・単価6を返す', () => {
    const result = forSummary('三ツ矢サイダー350mL28本');
    expect(result.representativeSummaryProduct).toBe('三ツ矢サイダー350mL28本');
    expect(result.channelClass).toBe('CC01_炭酸');
    expect(result.directChannelCode).toBe('DC1001');
    expect(result.tier1).toBe('国分グループ本社');
    expect(result.patternCode).toBe('V1010');
    expect(result.onlineProduct).toBe('OL00002');
    expect(result.value).toBe(6);
  });

  it('コーヒーのサマリ商品は日本アクセス商流（ドライ）をたどり単価パターンV1030・単価8を返す', () => {
    const result = forSummary('ワンダ ボトルコーヒー微糖500mL24本');
    expect(result.representativeSummaryProduct).toBe(
      'ワンダ ボトルコーヒー微糖500mL24本'
    );
    expect(result.channelClass).toBe('CC03_コーヒー');
    expect(result.directChannelCode).toBe('DC1003');
    expect(result.tier1).toBe('日本アクセス');
    expect(result.salesKbn).toBe('ドライ');
    expect(result.patternCode).toBe('V1030');
    expect(result.value).toBe(8);
  });

  it('乳性のサマリ商品は日本アクセス商流（チルド）をたどり単価パターンV1030C・単価9を返す', () => {
    const result = forSummary('カルピスウォーター500mL24本');
    expect(result.representativeSummaryProduct).toBe(
      'カルピスウォーター500mL24本'
    );
    expect(result.channelClass).toBe('CC04_乳性');
    expect(result.directChannelCode).toBe('DC1004');
    expect(result.tier1).toBe('日本アクセス');
    expect(result.salesKbn).toBe('チルド');
    expect(result.patternCode).toBe('V1030C');
    expect(result.value).toBe(9);
  });
});

describe('deriveConditionUnitPrice（NET固定）', () => {
  it('一般卸メッシュから代表サマリ商品を引いてから同じ経路をたどる', () => {
    const result = deriveConditionUnitPrice({
      planPattern: 'netFixed',
      summaryProduct: '',
      wholesaleMesh: '【三ツ矢150円】三ツ矢サイダー28・350',
      storeKey: DEFAULT_STORE_KEY,
    });
    expect(result.representativeSummaryProduct).not.toBe('');
    expect(result.value).toBeGreaterThan(0);
    // NET固定は取引制度メッシュマスタの一手が先頭に入るため7ステップ
    expect(result.steps).toHaveLength(7);
    expect(result.steps[0]).toBe('取引制度メッシュマスタ');
  });

  it('サマリ商品が指定された行（新商品・特殊商品・ギフト）はそれを優先する', () => {
    const summary = SUMMARY_PRODUCT_OPTIONS[0].value;
    const result = deriveConditionUnitPrice({
      planPattern: 'netFixed',
      summaryProduct: summary,
      wholesaleMesh: '【三ツ矢150円】三ツ矢サイダー28・350',
      storeKey: DEFAULT_STORE_KEY,
    });
    expect(result.representativeSummaryProduct).toBe(summary);
  });
});

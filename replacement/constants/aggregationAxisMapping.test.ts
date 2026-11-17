import { describe, it, expect } from 'vitest';
import {
  META_BRAND_OPTIONS,
  CONTAINER_CAPACITY_OPTIONS,
} from './aggregationAxisMaster';
import { META_BRAND_MASTER, CONTAINER_CAPACITY_MASTER } from './productMasters';
import { AXIS_OTHER } from './aggregationAxisMapping';
import {
  toAxisMetaBrand,
  toAxisCapacity,
  isPBProduct,
} from '@/utils/sales-plan/common/aggregationAxisMapping';

const brandValues = new Set(META_BRAND_OPTIONS.map((o) => o.value));
const capacityValues = new Set(CONTAINER_CAPACITY_OPTIONS.map((o) => o.value));

describe('toAxisMetaBrand', () => {
  it('商品マスタの全メタブランドが集計軸のいずれかに写る', () => {
    for (const m of META_BRAND_MASTER) {
      expect(brandValues.has(toAxisMetaBrand(m.value)), m.value).toBe(true);
    }
  });

  // 商品マスタの各メタブランドが、意図した集計軸メタブランドへ写ることを1件ずつ検証する。
  // 「集計軸のいずれかに写る」だけの検証では、対応表の綴り誤りが AXIS_OTHER へ
  // 静かに落ちて検出できないため、期待値を個別に固定する。
  const metaBrandExpected: [string, string][] = [
    ['ブランド横断(全商品)', 'その他'],
    ['三ツ矢', '三ツ矢'],
    ['カルピス', 'カルピスストレート'],
    ['ウィルキンソン', 'ウィルキンソン'],
    ['十六茶', '十六茶'],
    ['モンスター', 'モンスター'],
    ['ワンダ', 'ワンダ'],
    ['水', '水'],
    ['バヤリース', 'その他'],
    ['ドデカミン', 'その他'],
    ['三ツ矢特濃', '三ツ矢'],
    ['PB商品', 'PB'],
  ];

  it.each(metaBrandExpected)('メタブランド %s は %s へ写る', (from, to) => {
    expect(toAxisMetaBrand(from)).toBe(to);
  });

  it('未知の値はその他へ倒す', () => {
    expect(toAxisMetaBrand('未登録ブランド')).toBe(AXIS_OTHER);
  });
});

describe('toAxisCapacity', () => {
  it('商品マスタの全容器容量が集計軸のいずれかに写る', () => {
    for (const c of CONTAINER_CAPACITY_MASTER) {
      expect(
        capacityValues.has(toAxisCapacity(c.value, '三ツ矢')),
        c.value
      ).toBe(true);
    }
  });

  // 商品マスタの各容器容量が、意図した集計軸容器容量へ写ることを1件ずつ検証する。
  // 「集計軸のいずれかに写る」だけの検証では、対応表の綴り誤りが AXIS_OTHER へ
  // 静かに落ちて検出できないため、期待値を個別に固定する。
  // 容器容量は水以外のブランド（'三ツ矢'）を基準に期待値を指定する。
  const capacityExpected: [string, string, string][] = [
    ['185g', '三ツ矢', '250缶'],
    ['350mL', '三ツ矢', 'PET・ボトル缶280・350'],
    ['355mL', '三ツ矢', 'PET・ボトル缶280・350'],
    ['470mL', '三ツ矢', 'PET・ボトル缶500'],
    ['500mL', '三ツ矢', 'PET・ボトル缶500'],
    ['600mL', '三ツ矢', 'PET・ボトル缶500'],
    ['630mL', '三ツ矢', 'PET・ボトル缶500'],
    ['1L', '三ツ矢', 'Lパック'],
    ['1.5L', '三ツ矢', 'PET1.5'],
    ['2L', '三ツ矢', 'PET2L'],
    ['100mL', '三ツ矢', 'その他'],
    ['190mL', '三ツ矢', '250缶'],
    ['250mL', '三ツ矢', '250缶'],
    ['660mL', '三ツ矢', 'PET・ボトル缶500'],
  ];

  it.each(capacityExpected)(
    '容器容量 %s（%s）は %s へ写る',
    (capacity, brand, expectedAxis) => {
      expect(toAxisCapacity(capacity, brand)).toBe(expectedAxis);
    }
  );

  it('水ブランドの500mLは水PET500へ写る', () => {
    expect(toAxisCapacity('500mL', '水')).toBe('水PET500');
    expect(toAxisCapacity('500mL', '三ツ矢')).toBe('PET・ボトル缶500');
  });

  it('水ブランドの2Lは水PET2Lへ写る', () => {
    expect(toAxisCapacity('2L', '水')).toBe('水PET2L');
    expect(toAxisCapacity('2L', '十六茶')).toBe('PET2L');
  });

  it('水ブランドの600mLは水PET500へ写る', () => {
    expect(toAxisCapacity('600mL', '水')).toBe('水PET500');
  });

  it('商品区分がギフトの行は容器容量によらずギフトへ写る', () => {
    expect(toAxisCapacity('500mL', '三ツ矢', 'ギフト')).toBe('ギフト');
  });

  it('未知の値はその他へ倒す', () => {
    expect(toAxisCapacity('999mL', '三ツ矢')).toBe(AXIS_OTHER);
  });
});

describe('isPBProduct', () => {
  it('PB商品のみ true', () => {
    expect(isPBProduct('PB商品')).toBe(true);
    expect(isPBProduct('PB')).toBe(true);
    expect(isPBProduct('三ツ矢')).toBe(false);
  });
});

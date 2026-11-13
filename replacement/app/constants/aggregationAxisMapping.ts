// 商品マスタ（productMasters）の メタブランド／容器容量 を、
// 集計軸（aggregationAxisMaster）の メタブランド／容器容量G へ対応づける。
//
// 商品マスタは個品に近い粒度（三ツ矢特濃・350mL 等）、集計軸はグループ粒度
// （三ツ矢・PET・ボトル缶280・350 等）で体系が異なるため、ここで一元的に写像する。
// 集計対象選択（集計単位①×②）の絞り込みは集計軸の値で行うため、
// この対応づけが無いとフィルタが1件も一致しない。
import type { MultiComboboxOption } from '@/app/components/ui/multi-combobox';
import {
  META_BRAND_OPTIONS,
  CONTAINER_CAPACITY_OPTIONS,
} from './aggregationAxisMaster';

// 対応づけの無い値を倒す先。集計軸の①②とも「その他」を持つ。
export const AXIS_OTHER = 'その他';

// 商品マスタのメタブランド → 集計軸のメタブランド
export const META_BRAND_TO_AXIS: Record<string, string> = {
  三ツ矢: '三ツ矢',
  三ツ矢特濃: '三ツ矢',
  カルピス: 'カルピスストレート',
  ウィルキンソン: 'ウィルキンソン',
  十六茶: '十六茶',
  モンスター: 'モンスター',
  ワンダ: 'ワンダ',
  水: '水',
  バヤリース: AXIS_OTHER,
  ドデカミン: AXIS_OTHER,
  PB商品: 'PB',
  'ブランド横断(全商品)': AXIS_OTHER,
};

// 商品マスタの容器容量 → 集計軸の容器容量G（水ブランド以外）
export const CAPACITY_TO_AXIS: Record<string, string> = {
  '185g': '250缶',
  '190mL': '250缶',
  '250mL': '250缶',
  '350mL': 'PET・ボトル缶280・350',
  '355mL': 'PET・ボトル缶280・350',
  '470mL': 'PET・ボトル缶500',
  '500mL': 'PET・ボトル缶500',
  '600mL': 'PET・ボトル缶500',
  '630mL': 'PET・ボトル缶500',
  '660mL': 'PET・ボトル缶500',
  '1L': 'Lパック',
  '1.5L': 'PET1.5',
  '2L': 'PET2L',
  '100mL': AXIS_OTHER,
};

// 水ブランドは専用の容器容量G（水PET500／水PET2L）を持つ
export const WATER_CAPACITY_TO_AXIS: Record<string, string> = {
  '500mL': '水PET500',
  '600mL': '水PET500',
  '2L': '水PET2L',
};

export const AXIS_META_BRANDS = new Set(
  META_BRAND_OPTIONS.map((o: MultiComboboxOption) => o.value)
);
export const AXIS_CAPACITIES = new Set(
  CONTAINER_CAPACITY_OPTIONS.map((o: MultiComboboxOption) => o.value)
);

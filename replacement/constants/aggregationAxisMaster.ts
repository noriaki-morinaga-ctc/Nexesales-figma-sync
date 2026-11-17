// 集計単位（軸）の選択肢定義 ─ 課題0290/0488
// メタブランド・容器容量G の選択肢、および集計単位種別の単一の情報源（Single Source of Truth）。
// 各集計画面（販売計画(集計)・年間集計・シミュレーション集計）はこのモジュールを参照する。
// 旧「一般卸メッシュ」「サマリ商品」は集計単位から削除済み（資料 mst シート準拠）。

import type { MultiComboboxOption } from '@/components/ui/multi-combobox';
import type { AggregationUnitOption } from '@/types/aggregation';

export const AGGREGATION_UNIT_OPTIONS: AggregationUnitOption[] = [
  { value: 'all', label: '全体' },
  { value: 'meta-brand', label: 'メタブランド' },
  { value: 'container-capacity', label: '容器容量G' },
];

// メタブランド（集計単位選択①）
export const META_BRAND_OPTIONS: MultiComboboxOption[] = [
  { label: '三ツ矢', value: '三ツ矢', code: 'MB001' },
  { label: 'ワンダ', value: 'ワンダ', code: 'MB006' },
  { label: 'ウィルキンソン', value: 'ウィルキンソン', code: 'MB003' },
  { label: '十六茶', value: '十六茶', code: 'MB004' },
  { label: '水', value: '水', code: 'MB007' },
  { label: 'カルピスコンク', value: 'カルピスコンク', code: 'MB002' },
  { label: 'カルピスストレート', value: 'カルピスストレート', code: 'MB009' },
  { label: 'モンスター', value: 'モンスター', code: 'MB005' },
  { label: 'ヘルスケア', value: 'ヘルスケア', code: 'MB010' },
  { label: 'PB', value: 'PB', code: 'MB011' },
  { label: 'その他', value: 'その他', code: 'MB099' },
  { label: '和紅茶', value: '和紅茶', code: 'MB012' },
];

// 容器容量G（集計単位選択②）
export const CONTAINER_CAPACITY_OPTIONS: MultiComboboxOption[] = [
  { label: 'PET・ボトル缶500', value: 'PET・ボトル缶500', code: 'CG001' },
  {
    label: 'PET・ボトル缶280・350',
    value: 'PET・ボトル缶280・350',
    code: 'CG002',
  },
  { label: '水PET500', value: '水PET500', code: 'CG003' },
  { label: 'PET1.5', value: 'PET1.5', code: 'CG004' },
  { label: 'PET2L', value: 'PET2L', code: 'CG005' },
  { label: '水PET2L', value: '水PET2L', code: 'CG006' },
  { label: 'コーヒー缶', value: 'コーヒー缶', code: 'CG007' },
  { label: '250缶', value: '250缶', code: 'CG008' },
  { label: 'その他', value: 'その他', code: 'CG099' },
  { label: '250缶（20）', value: '250缶（20）', code: 'CG009' },
  { label: 'Lパック', value: 'Lパック', code: 'CG010' },
  { label: 'ギフト', value: 'ギフト', code: 'CG011' },
];

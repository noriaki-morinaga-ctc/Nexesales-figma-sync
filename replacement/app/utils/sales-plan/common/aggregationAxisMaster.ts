// aggregationAxisMaster（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import {
  CONTAINER_CAPACITY_OPTIONS,
  META_BRAND_OPTIONS,
} from '@/app/constants/aggregationAxisMaster';

// value（名称）からコードを引く補助
export const getMetaBrandCode = (value: string): string | undefined =>
  META_BRAND_OPTIONS.find((o) => o.value === value)?.code;

export const getContainerCapacityCode = (value: string): string | undefined =>
  CONTAINER_CAPACITY_OPTIONS.find((o) => o.value === value)?.code;

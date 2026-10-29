// 販売店条件口率マスタ（型1 マスタメンテCRUD型・世代管理・一括UL）。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import {
  RETAILER_CONDITION_RATE_DEF,
  RETAILER_CONDITION_RATE_ROWS,
} from './mockData';

export default function RetailerConditionRateMaster() {
  return (
    <MasterMaintenancePage
      def={RETAILER_CONDITION_RATE_DEF}
      initialRows={RETAILER_CONDITION_RATE_ROWS}
    />
  );
}

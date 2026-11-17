// 販売店条件口率マスタ（型1 マスタメンテCRUD型・世代管理・一括UL）。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/features/master/shared';
import { RETAILER_CONDITION_RATE_DEF } from './constants';
import { RETAILER_CONDITION_RATE_ROWS } from '@/mocks/master/retailer-condition-rate-master';

export default function RetailerConditionRateMaster() {
  return (
    <MasterMaintenancePage
      def={RETAILER_CONDITION_RATE_DEF}
      initialRows={RETAILER_CONDITION_RATE_ROWS}
    />
  );
}

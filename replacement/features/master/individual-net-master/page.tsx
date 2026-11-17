// 個別NETマスタ（型1 マスタメンテCRUD型・世代管理・一括UL）。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/features/master/shared';
import { INDIVIDUAL_NET_DEF } from './constants';
import { INDIVIDUAL_NET_ROWS } from '@/mocks/master/individual-net-master';

export default function IndividualNetMaster() {
  return (
    <MasterMaintenancePage
      def={INDIVIDUAL_NET_DEF}
      initialRows={INDIVIDUAL_NET_ROWS}
    />
  );
}

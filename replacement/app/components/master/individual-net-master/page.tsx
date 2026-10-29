// 個別NETマスタ（型1 マスタメンテCRUD型・世代管理・一括UL）。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import { INDIVIDUAL_NET_DEF, INDIVIDUAL_NET_ROWS } from './mockData';

export default function IndividualNetMaster() {
  return (
    <MasterMaintenancePage
      def={INDIVIDUAL_NET_DEF}
      initialRows={INDIVIDUAL_NET_ROWS}
    />
  );
}

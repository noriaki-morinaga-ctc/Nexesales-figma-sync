// 戦略NETマスタ（型1 マスタメンテCRUD型・世代管理・一括UL）。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import { STRATEGIC_NET_DEF, STRATEGIC_NET_ROWS } from './mockData';

export default function StrategicNetMaster() {
  return (
    <MasterMaintenancePage
      def={STRATEGIC_NET_DEF}
      initialRows={STRATEGIC_NET_ROWS}
    />
  );
}

// 容器容量グループマスタ（型1 マスタメンテCRUD型・無効化フラグ）。代表パターン①。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import {
  CONTAINER_CAPACITY_GROUP_DEF,
  CONTAINER_CAPACITY_GROUP_ROWS,
} from './mockData';

export default function ContainerCapacityGroupMaster() {
  return (
    <MasterMaintenancePage
      def={CONTAINER_CAPACITY_GROUP_DEF}
      initialRows={CONTAINER_CAPACITY_GROUP_ROWS}
    />
  );
}

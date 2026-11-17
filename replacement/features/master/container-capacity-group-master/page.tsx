// 容器容量グループマスタ（型1 マスタメンテCRUD型・無効化フラグ）。代表パターン①。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/features/master/shared';
import { CONTAINER_CAPACITY_GROUP_DEF } from './constants';
import { CONTAINER_CAPACITY_GROUP_ROWS } from '@/mocks/master/container-capacity-group-master';

export default function ContainerCapacityGroupMaster() {
  return (
    <MasterMaintenancePage
      def={CONTAINER_CAPACITY_GROUP_DEF}
      initialRows={CONTAINER_CAPACITY_GROUP_ROWS}
    />
  );
}

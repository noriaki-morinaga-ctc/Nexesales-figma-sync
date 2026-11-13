// 一般卸メッシュマスタ（型1 マスタメンテCRUD型・世代管理・一括UL）。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/app/components/shared/master';
import { GENERAL_WHOLESALE_MESH_DEF } from './constants';
import { GENERAL_WHOLESALE_MESH_ROWS } from '@/mocks/master/general-wholesale-mesh-master';

export default function GeneralWholesaleMeshMaster() {
  return (
    <MasterMaintenancePage
      def={GENERAL_WHOLESALE_MESH_DEF}
      initialRows={GENERAL_WHOLESALE_MESH_ROWS}
    />
  );
}

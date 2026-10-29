// 一般卸メッシュマスタ（型1 マスタメンテCRUD型・世代管理・一括UL）。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import {
  GENERAL_WHOLESALE_MESH_DEF,
  GENERAL_WHOLESALE_MESH_ROWS,
} from './mockData';

export default function GeneralWholesaleMeshMaster() {
  return (
    <MasterMaintenancePage
      def={GENERAL_WHOLESALE_MESH_DEF}
      initialRows={GENERAL_WHOLESALE_MESH_ROWS}
    />
  );
}

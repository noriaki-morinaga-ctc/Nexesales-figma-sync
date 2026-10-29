// 表示管理マスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import { DISPLAY_MANAGEMENT_DEF, DISPLAY_MANAGEMENT_ROWS } from './mockData';

export default function DisplayManagementMaster() {
  return (
    <MasterMaintenancePage
      def={DISPLAY_MANAGEMENT_DEF}
      initialRows={DISPLAY_MANAGEMENT_ROWS}
    />
  );
}

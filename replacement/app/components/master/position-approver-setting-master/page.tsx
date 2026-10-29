// 役職承認者設定マスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import {
  POSITION_APPROVER_SETTING_DEF,
  POSITION_APPROVER_SETTING_ROWS,
} from './mockData';

export default function PositionApproverSettingMaster() {
  return (
    <MasterMaintenancePage
      def={POSITION_APPROVER_SETTING_DEF}
      initialRows={POSITION_APPROVER_SETTING_ROWS}
    />
  );
}

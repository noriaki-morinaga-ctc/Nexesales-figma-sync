// 役職承認者設定マスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/app/components/shared/master';
import { POSITION_APPROVER_SETTING_DEF } from './constants';
import { POSITION_APPROVER_SETTING_ROWS } from '@/mocks/master/position-approver-setting-master';

export default function PositionApproverSettingMaster() {
  return (
    <MasterMaintenancePage
      def={POSITION_APPROVER_SETTING_DEF}
      initialRows={POSITION_APPROVER_SETTING_ROWS}
    />
  );
}

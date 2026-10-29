// システム管理者設定マスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import {
  SYSTEM_ADMIN_SETTING_DEF,
  SYSTEM_ADMIN_SETTING_ROWS,
} from './mockData';

export default function SystemAdminSettingMaster() {
  return (
    <MasterMaintenancePage
      def={SYSTEM_ADMIN_SETTING_DEF}
      initialRows={SYSTEM_ADMIN_SETTING_ROWS}
    />
  );
}

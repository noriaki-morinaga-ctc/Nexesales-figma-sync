// システム管理者設定マスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/features/master/shared';
import { SYSTEM_ADMIN_SETTING_DEF } from './constants';
import { SYSTEM_ADMIN_SETTING_ROWS } from '@/mocks/master/system-admin-setting-master';

export default function SystemAdminSettingMaster() {
  return (
    <MasterMaintenancePage
      def={SYSTEM_ADMIN_SETTING_DEF}
      initialRows={SYSTEM_ADMIN_SETTING_ROWS}
    />
  );
}

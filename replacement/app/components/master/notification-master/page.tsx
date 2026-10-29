// 通知管理マスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import { NOTIFICATION_DEF, NOTIFICATION_ROWS } from './mockData';

export default function NotificationMaster() {
  return (
    <MasterMaintenancePage
      def={NOTIFICATION_DEF}
      initialRows={NOTIFICATION_ROWS}
    />
  );
}

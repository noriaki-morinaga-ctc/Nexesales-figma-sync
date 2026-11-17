// 担当エリアマスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義（constants.ts）を持ち、一覧のモック行は src/mocks/master/ から渡す。
import { MasterMaintenancePage } from '@/features/master/shared';
import { SALES_AREA_DEF } from './constants';
import { SALES_AREA_ROWS } from '@/mocks/master/sales-area-master';

export default function SalesAreaMaster() {
  return (
    <MasterMaintenancePage def={SALES_AREA_DEF} initialRows={SALES_AREA_ROWS} />
  );
}

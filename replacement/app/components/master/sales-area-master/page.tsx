// 担当エリアマスタ（型1 マスタメンテCRUD型）。tools/master-gen/new-master.mjs が生成。
// 画面の骨格・挙動は shared/master のスキャフォールドが担い、本画面は項目定義とモックデータを持つ。
import { MasterMaintenancePage } from '../../shared/master';
import { SALES_AREA_DEF, SALES_AREA_ROWS } from './mockData';

export default function SalesAreaMaster() {
  return (
    <MasterMaintenancePage def={SALES_AREA_DEF} initialRows={SALES_AREA_ROWS} />
  );
}

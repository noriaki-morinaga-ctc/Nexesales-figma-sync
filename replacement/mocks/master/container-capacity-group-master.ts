// 容器容量グループマスタ：一覧のモック行（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/container-capacity-group-master.json）。画面の定義は src/features/master/container-capacity-group-master/constants.ts。

import {
  CONTAINER_CAPACITY_CODE_NAME,
  CONTAINER_GROUP_CODE_NAME,
} from '@/constants/masterCodeNameOptions';
import type { MasterRow } from '@/features/master/shared';

const CREATED_AT = '2026/02/10 10:00';

const buildRows = (): MasterRow[] =>
  CONTAINER_GROUP_CODE_NAME.map((group, i) => ({
    id: `ccg-${i}`,
    groupCode: group.code,
    groupName: group.name,
    representativeCapacity: CONTAINER_CAPACITY_CODE_NAME[i]?.code ?? '',
    company: '0093',
    // 末尾2件は無効化済み（利用停止の見え方の確認用）
    inactive: i >= CONTAINER_GROUP_CODE_NAME.length - 2,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy:
      i >= CONTAINER_GROUP_CODE_NAME.length - 2 ? 'アサヒ太郎' : '営戦 花子',
    updatedAt:
      i >= CONTAINER_GROUP_CODE_NAME.length - 2
        ? '2026/09/30 16:00'
        : CREATED_AT,
  }));

export const CONTAINER_CAPACITY_GROUP_ROWS: MasterRow[] = buildRows();

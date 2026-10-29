// 容器容量グループマスタ：画面定義（型1・無効化フラグ型）とモックデータ。
// 標準化資料 p.19 の代表パターン①（容器容量グループ／担当エリア／商品分類導出）の代表。
// 項目はエンティティ一覧表・定義書（2026-10-22 版。10/19 版から変更なし）「容器容量グループマスタ」シートに合わせる
// （PK＝容器容量Ｇコード。容器容量Ｇ全角２３文字名称・容器容量Ｇ代表容器容量コード・容器容量Ｇ共通会社コード）。
// 容器容量Ｇコードは現行どおり数字2桁（Q&A No.36）。

import {
  COMPANY_CODE_NAME,
  CONTAINER_CAPACITY_CODE_NAME,
  CONTAINER_GROUP_CODE_NAME,
} from '../../../constants/masterCodeNameOptions';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

export const CONTAINER_CAPACITY_GROUP_DEF: MasterScreenDef = {
  routeId: 'container-capacity-group-master',
  title: '容器容量グループマスタ',
  entityLabel: '容器容量グループ',
  fields: [
    {
      key: 'groupCode',
      label: '容器容量Gコード',
      kind: 'text',
      pk: true,
      required: true,
      searchAlsoKeys: ['groupName'],
      placeholder: '例：05',
    },
    {
      key: 'groupName',
      label: '容器容量G名称',
      kind: 'text',
      required: true,
      placeholder: '全角23文字以内',
    },
    {
      key: 'representativeCapacity',
      label: '代表容器容量',
      kind: 'combo',
      required: true,
      options: CONTAINER_CAPACITY_CODE_NAME,
      codeLabel: '代表容器容量コード',
      nameLabel: '代表容器容量名称',
    },
    {
      // 一覧はコード・名称の2列、登録・更新ではアサヒ飲料に固定（Q&A No.35①）
      key: 'company',
      label: '共通会社',
      kind: 'combo',
      required: true,
      options: COMPANY_CODE_NAME,
      codeLabel: '共通会社コード',
      nameLabel: '共通会社名称',
      fixedValue: '0093',
    },
  ],
  searchKeys: ['groupCode', 'company'],
  // 無効化と論理削除（標準）の両方を持つ（Q&A No.35②）
  inactivation: true,
};

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

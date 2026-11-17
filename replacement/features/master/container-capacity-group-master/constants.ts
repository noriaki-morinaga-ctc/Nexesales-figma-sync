// 容器容量グループマスタ：画面定義（型1・無効化フラグ型）。一覧のモック行は src/mocks/master/container-capacity-group-master.ts。
// 標準化資料 p.19 の代表パターン①（容器容量グループ／担当エリア／商品分類導出）の代表。
// 項目はエンティティ一覧表・定義書（2026-10-22 版。10/19 版から変更なし）「容器容量グループマスタ」シートに合わせる
// （PK＝容器容量Ｇコード。容器容量Ｇ全角２３文字名称・容器容量Ｇ代表容器容量コード・容器容量Ｇ共通会社コード）。
// 容器容量Ｇコードは現行どおり数字2桁（Q&A No.36）。
// 2026-10-30 Q&A QM-022：無効化フラグはエンティティ定義書に追加（定義書側を修正）。共通会社の名称は汎用コード値明細マスタの区分「会社コード」（KBN-027。
// アサヒ飲料のみ）から取る（会社マスタは作らない）。QM-030（代表容器容量を ToBe でも使うか）は確認中のため項目を残している。

import {
  COMPANY_CODE_NAME,
  CONTAINER_CAPACITY_CODE_NAME,
} from '@/constants/masterCodeNameOptions';
import type { MasterScreenDef } from '@/features/master/shared';

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
      // エンティティ定義では「ToBeでは廃止する」。Q&A QM-030（ToBe でも使うか）の回答待ちのため残している
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

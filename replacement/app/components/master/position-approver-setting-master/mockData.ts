// 役職承認者設定マスタ：画面定義（型1 マスタメンテCRUD型）とモックデータ。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/position-approver-setting-master.json）。項目はエンティティ定義に合わせる。
// 役職承認者設定マスタ（型1・無効化フラグ型）。エンティティ一覧表・定義書 10/22 版「役職承認者設定マスタ」（採算組織コード＋役職コード）に、Q&A QM-036 の回答（2026-10-30）で役職区分コード（属性・更新可）を追加。
// 役職コードは社員マスタの社員共通役職コード（半角 3 桁）で、名称は汎用コード値明細マスタの区分「役職コード」（KBN-028。値は仮）から取る（QM-037）。役職区分の候補は役職区分マスタ（区分値は未定義のため仮）。
// 権限一覧の機能名は「役職区分設定マスタメンテ」。定義書への反映は依頼中。

import {
  POSITION_CLASS_CODE_NAME,
  POSITION_CODE_NAME,
  PROFIT_ORG_CODE_NAME,
} from '../../../constants/masterCodeNameOptions';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

export const POSITION_APPROVER_SETTING_DEF: MasterScreenDef = {
  routeId: 'position-approver-setting-master',
  title: '役職承認者設定マスタ',
  entityLabel: '役職承認者',
  fields: [
    {
      key: 'profitOrg',
      label: '採算組織',
      kind: 'combo',
      pk: true,
      required: true,
      options: PROFIT_ORG_CODE_NAME,
      codeLabel: '採算組織コード',
      nameLabel: '採算組織名称',
    },
    {
      key: 'position',
      label: '役職',
      kind: 'combo',
      pk: true,
      required: true,
      options: POSITION_CODE_NAME,
      codeLabel: '役職コード',
      nameLabel: '役職名称',
    },
    {
      key: 'positionClass',
      label: '役職区分',
      kind: 'combo',
      required: true,
      options: POSITION_CLASS_CODE_NAME,
      codeLabel: '役職区分コード',
      nameLabel: '役職区分名称',
    },
  ],
  searchKeys: ['profitOrg', 'position', 'positionClass'],
  inactivation: true,
};

const CREATED_AT = '2026/02/10 10:00';

export const POSITION_APPROVER_SETTING_ROWS: MasterRow[] = [
  {
    id: 'position-approver-setting-master-1',
    profitOrg: PROFIT_ORG_CODE_NAME[0]?.code ?? '',
    position: '200',
    positionClass: '02',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'position-approver-setting-master-2',
    profitOrg: PROFIT_ORG_CODE_NAME[0]?.code ?? '',
    position: '300',
    positionClass: '03',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'position-approver-setting-master-3',
    profitOrg: PROFIT_ORG_CODE_NAME[1]?.code ?? '',
    position: '300',
    positionClass: '03',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'position-approver-setting-master-4',
    profitOrg: PROFIT_ORG_CODE_NAME[1]?.code ?? '',
    position: '400',
    positionClass: '04',
    inactive: false,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
  {
    id: 'position-approver-setting-master-5',
    profitOrg: PROFIT_ORG_CODE_NAME[2]?.code ?? '',
    position: '400',
    positionClass: '04',
    inactive: true,
    createdBy: '営戦 花子',
    createdAt: CREATED_AT,
    updatedBy: '営戦 花子',
    updatedAt: CREATED_AT,
  },
];

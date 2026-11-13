// システム管理者設定マスタ：画面定義（型1 マスタメンテCRUD型）。一覧のモック行は src/mocks/master/system-admin-setting-master.ts。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/system-admin-setting-master.json）。項目はエンティティ定義に合わせる。
// システム管理者設定マスタ（型1・無効化フラグ型）。エンティティ一覧表・定義書 10/22 版「システム管理者設定マスタ」は採算組織末端組織コード＋社員コードだが、
// Q&A QM-032 の回答（2026-10-30。登録時に末端組織の登録は不要）により主キーは社員コードだけ。事業場・部署は社員を絞り込むための項目で保存しない（一覧は社員マスタの所属から表示）。
// 変更できる項目が無いため更新ペインは設けない（QM-033。登録・無効化・削除だけ）。定義書への反映は依頼中。

import {
  DEPT_CODE_BY_STAFF_CODE,
  OFFICE_CODE_BY_DEPT_CODE,
  OFFICE_CODE_NAME,
  PROFIT_ORG_DEPT_CODE_NAME,
  STAFF_CODE_NAME,
} from '@/app/constants/masterCodeNameOptions';
import type { MasterScreenDef } from '@/app/components/shared/master';

export const SYSTEM_ADMIN_SETTING_DEF: MasterScreenDef = {
  routeId: 'system-admin-setting-master',
  title: 'システム管理者設定マスタ',
  entityLabel: 'システム管理者',
  fields: [
    {
      key: 'office',
      label: '事業場',
      kind: 'combo',
      options: OFFICE_CODE_NAME,
      codeLabel: '事業場コード',
      nameLabel: '事業場名称',
    },
    {
      key: 'dept',
      label: '部署',
      kind: 'combo',
      options: PROFIT_ORG_DEPT_CODE_NAME,
      codeLabel: '部署コード',
      nameLabel: '部署名称',
      parentKey: 'office',
      parentOf: OFFICE_CODE_BY_DEPT_CODE,
    },
    {
      key: 'staff',
      label: '社員',
      kind: 'combo',
      pk: true,
      required: true,
      options: STAFF_CODE_NAME,
      codeLabel: '社員コード',
      nameLabel: '社員名称',
      parentKey: 'dept',
      parentOf: DEPT_CODE_BY_STAFF_CODE,
    },
  ],
  searchKeys: ['office', 'dept', 'staff'],
  inactivation: true,
};

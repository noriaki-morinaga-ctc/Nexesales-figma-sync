// 商品分類導出マスタ：画面定義（型1 マスタメンテCRUD型）。一覧のモック行は src/mocks/master/product-class-derivation-master.ts。
// tools/master-gen/new-master.mjs が生成（定義: tools/master-gen/defs/product-class-derivation-master.json）。項目はエンティティ定義に合わせる。
// 商品分類導出マスタ（型1・無効化フラグ型）。主キーはシステム採番の導出ルールID（画面には出さない）、適用優先順は一意、判断軸 4 項目（メタブランド・ブランド・容器容量・容器容量グループ）は任意で未設定＝「指定なし」（どの値にも当てはまる。保持する値は無し）、商品分類３コードは導出の結果。判断軸の組は有効な行の中で一意（Q&A QM-028 の回答 2026-10-30。エンティティ定義書への反映は依頼中）。適用優先順は整数 3 桁（QM-029）。
// 導出ルールとモックの行は、アサヒ側で整理した 商品マスタ案（A-FRAME出力から追加）0127修正.xlsx の「商品分類マスタ【26.8.6ver】」（23 行）。適用優先順は後から差し込めるよう 10 刻み。
// メタブランド・容器容量グループは現行コードを使い、ToBe 案にしか無い区分は仮コード T〜。商品分類③のコードは仮（01〜16）。

import {
  DERIVATION_BRAND_CODE_NAME,
  DERIVATION_CONTAINER_CAPACITY_CODE_NAME,
  DERIVATION_CONTAINER_GROUP_CODE_NAME,
  DERIVATION_META_BRAND_CODE_NAME,
  PRODUCT_CLASS_CODE_NAME,
} from '@/constants/masterCodeNameOptions';
import type { MasterScreenDef } from '@/features/master/shared';

export const PRODUCT_CLASS_DERIVATION_DEF: MasterScreenDef = {
  routeId: 'product-class-derivation-master',
  title: '商品分類導出マスタ',
  entityLabel: '商品分類導出',
  fields: [
    {
      key: 'ruleId',
      label: '導出ルールID',
      kind: 'text',
      pk: true,
      required: true,
      hideInGrid: true,
      hideInForm: true,
      readOnly: true,
    },
    {
      key: 'priority',
      label: '適用優先順',
      kind: 'number',
      required: true,
      format: 'integer',
      maxDigits: 3,
      min: 1,
      max: 999,
      placeholder: '例：10',
      note: '小さい順に当てはめる（1〜999）。後から差し込めるよう 10 刻みで付ける',
    },
    {
      key: 'metaBrand',
      label: 'メタブランド',
      kind: 'combo',
      options: DERIVATION_META_BRAND_CODE_NAME,
      codeLabel: 'メタブランドコード',
      nameLabel: 'メタブランド名称',
      note: '未設定（指定なし）はどの値にも当てはまる',
      emptyLabel: '指定なし',
    },
    {
      key: 'brand',
      label: 'ブランド',
      kind: 'combo',
      options: DERIVATION_BRAND_CODE_NAME,
      codeLabel: 'ブランドコード',
      nameLabel: 'ブランド名称',
      note: '未設定（指定なし）はどの値にも当てはまる',
      emptyLabel: '指定なし',
    },
    {
      key: 'containerCapacity',
      label: '容器容量',
      kind: 'combo',
      options: DERIVATION_CONTAINER_CAPACITY_CODE_NAME,
      codeLabel: '容器容量コード',
      nameLabel: '容器容量名称',
      note: '未設定（指定なし）はどの値にも当てはまる',
      emptyLabel: '指定なし',
    },
    {
      key: 'containerGroup',
      label: '容器容量グループ',
      kind: 'combo',
      options: DERIVATION_CONTAINER_GROUP_CODE_NAME,
      codeLabel: '容器容量Gコード',
      nameLabel: '容器容量G名称',
      note: '未設定（指定なし）はどの値にも当てはまる',
      emptyLabel: '指定なし',
    },
    {
      key: 'productClass',
      label: '商品分類',
      kind: 'combo',
      required: true,
      options: PRODUCT_CLASS_CODE_NAME,
      codeLabel: '商品分類３コード',
      nameLabel: '商品分類名称',
    },
  ],
  searchKeys: ['metaBrand', 'brand', 'containerGroup', 'productClass'],
  inactivation: true,
  autoNumberKey: 'ruleId',
  autoNumberPrefix: 'R',
  uniqueGroups: [
    { keys: ['priority'] },
    {
      keys: ['metaBrand', 'brand', 'containerCapacity', 'containerGroup'],
      activeOnly: true,
    },
  ],
  displayKeys: ['priority', 'productClass'],
  defaultSortKey: 'priority',
};

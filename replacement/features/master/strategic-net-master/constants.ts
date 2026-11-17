// 戦略NETマスタ：画面定義（型1）。一覧のモック行は src/mocks/master/strategic-net-master.ts。
// 項目はエンティティ一覧表・定義書（2026-10-22 版）「戦略NETマスタ」シートに合わせる
// （PK＝サマリ商品管理番号・採算組織コード（第5階層）・適用開始年月日）。
// サマリ商品はサマリ商品管理番号（サマリ商品マスタの FK）で保持するが、画面ではサマリ商品コード・名称で選ぶ・表示する
// （管理番号は表示しない。モックはコードを保持する）。
// 10/8 第28回 決定9：戦略NETはダミーのサマリ商品には設定せず、正式コードの採番後に管理する。
// Q&A No.28：採算組織（第5階層）は「事業場」「部署」の2項目で見せる（事業場を選ぶと部署を絞り込む）。
// 保存する値は部署（採算組織の第5階層）のコードで、事業場は表示と絞り込みのための項目。
// 2026-10-30 Q&A QM-020：戦略NET は整数 9 桁・小数 2 桁（現行 DB の定義）。マイナスは入力できない（型1 の標準）。0 は登録できる（0 を禁止するかは業務チームに確認中）。
// QM-023（主キーをサマリ商品管理番号からサマリ商品コードに戻すか）は業務チームに確認中のため、保持する値は変えていない。

import {
  OFFICE_CODE_BY_DEPT_CODE,
  OFFICE_CODE_NAME,
  PROFIT_ORG_DEPT_CODE_NAME,
  SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY,
} from '@/constants/masterCodeNameOptions';
import type { MasterScreenDef } from '@/features/master/shared';

export const STRATEGIC_NET_DEF: MasterScreenDef = {
  routeId: 'strategic-net-master',
  title: '戦略NETマスタ',
  entityLabel: '戦略NET',
  fields: [
    {
      key: 'summaryProduct',
      label: 'サマリ商品',
      kind: 'combo',
      pk: true,
      required: true,
      options: SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY,
    },
    {
      key: 'office',
      label: '事業場',
      kind: 'combo',
      required: true,
      options: OFFICE_CODE_NAME,
    },
    {
      key: 'profitOrg',
      label: '部署',
      kind: 'combo',
      pk: true,
      required: true,
      options: PROFIT_ORG_DEPT_CODE_NAME,
      parentKey: 'office',
      parentOf: OFFICE_CODE_BY_DEPT_CODE,
    },
    {
      key: 'startDate',
      label: '適用開始年月日',
      kind: 'date',
      pk: true,
      required: true,
    },
    {
      key: 'endDate',
      label: '適用終了年月日',
      kind: 'date',
      required: true,
    },
    {
      key: 'strategicNet',
      label: '戦略NET',
      kind: 'number',
      required: true,
      format: 'decimal2',
      maxDigits: 9,
      unit: '円',
    },
  ],
  searchKeys: ['summaryProduct', 'office', 'profitOrg', 'startDate'],
  generation: {
    startKey: 'startDate',
    endKey: 'endDate',
  },
  copyAction: true,
  bulkUpload: true,
};

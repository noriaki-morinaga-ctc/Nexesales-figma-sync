// 戦略NETマスタ：画面定義（型1）とモックデータ。
// 項目はエンティティ一覧表・定義書（2026-10-22 版）「戦略NETマスタ」シートに合わせる
// （PK＝サマリ商品管理番号・採算組織コード（第5階層）・適用開始年月日）。
// サマリ商品はサマリ商品管理番号（サマリ商品マスタの FK）で保持するが、画面ではサマリ商品コード・名称で選ぶ・表示する
// （管理番号は表示しない。モックはコードを保持する）。
// 10/8 第28回 決定9：戦略NETはダミーのサマリ商品には設定せず、正式コードの採番後に管理する。
// Q&A No.28：採算組織（第5階層）は「事業場」「部署」の2項目で見せる（事業場を選ぶと部署を絞り込む）。
// 保存する値は部署（採算組織の第5階層）のコードで、事業場は表示と絞り込みのための項目。

import {
  OFFICE_CODE_BY_DEPT_CODE,
  OFFICE_CODE_NAME,
  PROFIT_ORG_DEPT_CODE_NAME,
  SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY,
} from '../../../constants/masterCodeNameOptions';
import { SUMMARY_PRODUCT_OPTIONS } from '../../../constants/productMasters';
import { END_OF_TIME } from '../../shared/master';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

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

const CREATED_AT = '2026/03/20 11:00';

// モック：サマリ商品の先頭12件 × 採算組織（部署）の先頭3件に戦略NETを設定する。
// 値はサマリ商品の NET（モック）を基準に、部署ごとに数%の差を付ける。
const buildRows = (): MasterRow[] => {
  const rows: MasterRow[] = [];
  const products = SUMMARY_PRODUCT_CODE_NAME_NO_DUMMY.slice(0, 12);
  const orgs = PROFIT_ORG_DEPT_CODE_NAME.slice(0, 3);
  products.forEach((product, pi) => {
    const base = Number(
      SUMMARY_PRODUCT_OPTIONS.find((o) => o.value === product.name)?.net ?? 60
    );
    orgs.forEach((org, oi) => {
      const net = Math.round(base * (0.9 + oi * 0.03) * 100) / 100;
      rows.push({
        id: `snet-${pi}-${oi}-current`,
        summaryProduct: product.code,
        office: OFFICE_CODE_BY_DEPT_CODE[org.code] ?? '',
        profitOrg: org.code,
        startDate: '2026/04/01',
        endDate: END_OF_TIME,
        strategicNet: net,
        createdBy: '営戦 花子',
        createdAt: CREATED_AT,
        updatedBy: '営戦 花子',
        updatedAt: CREATED_AT,
      });
      // 先頭3商品は前年度の世代も持たせる
      if (pi < 3) {
        rows.push({
          id: `snet-${pi}-${oi}-prev`,
          summaryProduct: product.code,
          office: OFFICE_CODE_BY_DEPT_CODE[org.code] ?? '',
          profitOrg: org.code,
          startDate: '2025/04/01',
          endDate: '2026/03/31',
          strategicNet: Math.round(net * 0.97 * 100) / 100,
          createdBy: '営戦 花子',
          createdAt: '2025/03/18 14:00',
          updatedBy: '営戦 花子',
          updatedAt: '2025/03/18 14:00',
        });
      }
    });
  });
  return rows;
};

export const STRATEGIC_NET_ROWS: MasterRow[] = buildRows();

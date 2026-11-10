// 管理対象商品マスタ：画面定義（型1・世代管理・一括UL）とモックデータ。
// 自販機の「管理対象商品一覧」（master/managed-product-list、要件書 No.28）を型1の標準に寄せた版。
// 項目はエンティティ一覧表・定義書（2026-10-22 版）「管理対象商品マスタ」シートに合わせる
// （PK＝サマリ商品コード・管理対象開始年月・管理対象終了年月・管理対象エリアコード。管理対象期間は年月。
// 商品取り扱い区分は汎用コード、参考商品コードはサマリ商品から選ぶ）。
// 名称は「管理対象商品マスタ」で確定（2026-11-02 朝比奈。WBS・成果物台帳の「実原価管理マスタ」は本画面を指す。
// 権限一覧の「実原価管理マスタメンテ」（サマリ商品毎の実原価登録）は別機能で、本画面とは関係しない）。

import {
  OFFICE_CODE_NAME,
  PRODUCT_HANDLING_KBN,
  SUMMARY_PRODUCT_CODE_NAME,
} from '../../../constants/masterCodeNameOptions';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

export const MANAGED_PRODUCT_DEF: MasterScreenDef = {
  routeId: 'managed-product-master',
  title: '管理対象商品マスタ',
  entityLabel: '管理対象商品',
  fields: [
    {
      key: 'summaryProduct',
      label: 'サマリ商品',
      kind: 'combo',
      pk: true,
      required: true,
      options: SUMMARY_PRODUCT_CODE_NAME,
    },
    {
      key: 'startDate',
      label: '管理対象開始年月',
      kind: 'month',
      pk: true,
      required: true,
    },
    {
      key: 'endDate',
      label: '管理対象終了年月',
      kind: 'month',
      pk: true,
      required: true,
    },
    {
      // 採算組織の第4階層（支社レベル）
      key: 'targetArea',
      label: '管理対象エリア',
      kind: 'combo',
      pk: true,
      required: true,
      options: OFFICE_CODE_NAME,
      codeLabel: '管理対象エリアコード',
      nameLabel: '管理対象エリア名称',
    },
    {
      key: 'handlingKbn',
      label: '商品取り扱い区分',
      kind: 'select',
      required: true,
      options: PRODUCT_HANDLING_KBN,
    },
    {
      key: 'referenceProduct',
      label: '参考商品',
      kind: 'combo',
      required: true,
      options: SUMMARY_PRODUCT_CODE_NAME,
    },
  ],
  searchKeys: ['summaryProduct', 'targetArea', 'handlingKbn', 'startDate'],
  generation: {
    startKey: 'startDate',
    endKey: 'endDate',
  },
  copyAction: true,
  bulkUpload: true,
};

const CREATED_AT = '2026/03/05 10:30';

const buildRows = (): MasterRow[] => {
  const rows: MasterRow[] = [];
  const products = SUMMARY_PRODUCT_CODE_NAME.slice(0, 15);
  products.forEach((product, i) => {
    const kbn = PRODUCT_HANDLING_KBN[i % 3].code;
    const area = OFFICE_CODE_NAME[i % OFFICE_CODE_NAME.length].code;
    rows.push({
      id: `mp-${i}-current`,
      summaryProduct: product.code,
      startDate: '2026/04',
      endDate: '2027/03',
      targetArea: area,
      handlingKbn: kbn,
      referenceProduct: SUMMARY_PRODUCT_CODE_NAME[(i + 5) % 20]?.code ?? '',
      createdBy: '自販機マーケ 一郎',
      createdAt: CREATED_AT,
      updatedBy: '自販機マーケ 一郎',
      updatedAt: CREATED_AT,
    });
    // 先頭3商品は前年度の管理対象期間も持たせる
    if (i < 3) {
      rows.push({
        id: `mp-${i}-prev`,
        summaryProduct: product.code,
        startDate: '2025/04',
        endDate: '2026/03',
        targetArea: area,
        handlingKbn: kbn,
        referenceProduct: SUMMARY_PRODUCT_CODE_NAME[(i + 5) % 20]?.code ?? '',
        createdBy: '自販機マーケ 一郎',
        createdAt: '2025/03/03 11:00',
        updatedBy: '自販機マーケ 一郎',
        updatedAt: '2025/03/03 11:00',
      });
    }
  });
  return rows;
};

export const MANAGED_PRODUCT_ROWS: MasterRow[] = buildRows();

// 販売店条件口率マスタ：画面定義（型1）とモックデータ。
// 項目はエンティティ一覧表・定義書（2026-10-22 版）「販売店条件口率マスタ」シートに合わせる
// （PK＝販売店コード・適用開始年月。適用期間は年月。オペ条件口率は％で小数第2位まで）。
// 画面の要否はエンティティ一覧（Q列＝画面）を正とする（朝比奈判断 10/15）。
// アップロード用シートの列は課題0614 のレイアウト提示（20260729_条件口率マスタ登録_アップロードシート_v0.1）に合わせる。
// 2026-10-30 Q&A QM-026：オペ条件口率は整数 3 桁・小数 2 桁（0.00〜100.00）。マイナスは入力できない（型1 の標準）。0 は登録できる（条件口が無い販売店）。
// 上限 100 は業務上の範囲チェック（7 に書く）。

import { RETAILER_CODE_NAME } from '../../../constants/masterCodeNameOptions';
import { END_OF_MONTH } from '../../shared/master';
import type { MasterRow, MasterScreenDef } from '../../shared/master';

export const RETAILER_CONDITION_RATE_DEF: MasterScreenDef = {
  routeId: 'retailer-condition-rate-master',
  title: '販売店条件口率マスタ',
  entityLabel: '販売店条件口率',
  fields: [
    {
      key: 'retailer',
      label: '販売店',
      kind: 'combo',
      pk: true,
      required: true,
      options: RETAILER_CODE_NAME,
    },
    {
      key: 'startDate',
      label: '適用開始年月',
      kind: 'month',
      pk: true,
      required: true,
    },
    {
      key: 'endDate',
      label: '適用終了年月',
      kind: 'month',
      required: true,
    },
    {
      key: 'conditionRate',
      label: 'オペ条件口率',
      kind: 'number',
      required: true,
      format: 'decimal2',
      maxDigits: 3,
      max: 100,
      unit: '％',
      placeholder: '例：22.23',
    },
  ],
  searchKeys: ['retailer', 'startDate'],
  generation: {
    startKey: 'startDate',
    endKey: 'endDate',
  },
  copyAction: true,
  bulkUpload: true,
  uploadSheetColumns: [
    'NO',
    '変更開始対象年月',
    '販売店CD',
    '販売店名',
    'オペ条件口率',
  ],
};

const CREATED_AT = '2026/03/25 13:10';

const buildRows = (): MasterRow[] => {
  const rows: MasterRow[] = [];
  RETAILER_CODE_NAME.forEach((retailer, i) => {
    // ％で小数第2位まで（例 22.23）
    const rate = Math.round((20 + (i % 7) * 1.23) * 100) / 100;
    rows.push({
      id: `rcr-${i}-current`,
      retailer: retailer.code,
      startDate: '2026/04',
      endDate: END_OF_MONTH,
      conditionRate: rate,
      createdBy: '営戦 花子',
      createdAt: CREATED_AT,
      updatedBy: '営戦 花子',
      updatedAt: CREATED_AT,
    });
    // 先頭2件は前年度の世代も持たせる
    if (i < 2) {
      rows.push({
        id: `rcr-${i}-prev`,
        retailer: retailer.code,
        startDate: '2025/04',
        endDate: '2026/03',
        conditionRate: Math.round((rate - 0.5) * 100) / 100,
        createdBy: '営戦 花子',
        createdAt: '2025/03/20 11:00',
        updatedBy: '営戦 花子',
        updatedAt: '2025/03/20 11:00',
      });
    }
  });
  return rows;
};

export const RETAILER_CONDITION_RATE_ROWS: MasterRow[] = buildRows();

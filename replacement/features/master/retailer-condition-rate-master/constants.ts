// 販売店条件口率マスタ：画面定義（型1）。一覧のモック行は src/mocks/master/retailer-condition-rate-master.ts。
// 項目はエンティティ一覧表・定義書（2026-10-22 版）「販売店条件口率マスタ」シートに合わせる
// （PK＝販売店コード・適用開始年月。適用期間は年月。オペ条件口率は％で小数第2位まで）。
// 画面の要否はエンティティ一覧（Q列＝画面）を正とする（朝比奈判断 10/15）。
// アップロード用シートの列は課題0614 のレイアウト提示（20260729_条件口率マスタ登録_アップロードシート_v0.1）に合わせる。
// 2026-10-30 Q&A QM-026：オペ条件口率は整数 3 桁・小数 2 桁（0.00〜100.00）。マイナスは入力できない（型1 の標準）。0 は登録できる（条件口が無い販売店）。
// 上限 100 は業務上の範囲チェック（7 に書く）。

import { RETAILER_CODE_NAME } from '@/constants/masterCodeNameOptions';
import type { MasterScreenDef } from '@/features/master/shared';

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

// マーケティングファイルアップロード：テンプレートの仮の行・サンプルのエラー・アップロード履歴のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/app/components/sales-plan/marketing-file-upload/page.tsx。

import type {
  SalesChannel,
  TemplateRow,
  UploadErrorItem,
  UploadHistoryItem,
  UploadTargetType,
} from '@/app/components/sales-plan/marketing-file-upload/marketingFileUpload.types';

// ───────────────────────────────────────────────
// ダウンロード用の明細（モック：登録済みデータ）
// ───────────────────────────────────────────────

// 商流（販売店〜一次店）のサンプル。販売店で三次店・一次店の候補が絞られることを確認できるよう、
// 販売店を2つ（フローレン：2商流／静岡ベンディング：1商流）用意する
const CHANNEL_NAGANO: SalesChannel = {
  retailerCode: 11504245,
  retailerName: 'フローレン',
  tertiaryStoreCode: 10771461,
  tertiaryStoreName: 'レユネール㈱（㈱フローレン）長野営業所',
  primaryStoreCode: 10770446,
  primaryStoreName: '㈱エヌ・アイ・エフ（旧エヌエス自販）長野',
};

const CHANNEL_YAMANASHI: SalesChannel = {
  retailerCode: 11504245,
  retailerName: 'フローレン',
  tertiaryStoreCode: 10841195,
  tertiaryStoreName: '株式会社フローレン境川事業所',
  primaryStoreCode: 10831468,
  primaryStoreName: '㈱エヌ・アイ・エフ（旧エヌエス自販）山梨',
};

const CHANNEL_SHIZUOKA: SalesChannel = {
  retailerCode: 11507310,
  retailerName: '静岡ベンディング',
  tertiaryStoreCode: 10862204,
  tertiaryStoreName: '静岡ベンディング㈱浜松営業所',
  primaryStoreCode: 10850117,
  primaryStoreName: '㈱東海自販サービス浜松',
};

export const MOCK_TEMPLATE_ROWS: Record<UploadTargetType, TemplateRow[]> = {
  managed_product_target: [
    {
      yearMonth: '2025/05',
      channel: CHANNEL_NAGANO,
      values: [
        '新商品',
        33333333,
        'ワンダ大人のミルクコーヒー缶185g',
        20,
        22222222,
        'ワンダ子供のミルクコーヒー缶185g',
      ],
    },
    {
      yearMonth: '2025/06',
      channel: CHANNEL_YAMANASHI,
      values: [
        '新商品',
        33333333,
        'ワンダ大人のミルクコーヒー缶185g',
        25,
        22222222,
        'ワンダ子供のミルクコーヒー缶185g',
      ],
    },
    {
      yearMonth: '2025/07',
      channel: CHANNEL_SHIZUOKA,
      values: [
        '新商品',
        33333333,
        'ワンダ大人のミルクコーヒー缶185g',
        15,
        22222222,
        'ワンダ子供のミルクコーヒー缶185g',
      ],
    },
  ],
  alliance_additional_sales: [
    { yearMonth: '2025/05', channel: CHANNEL_NAGANO, values: [70000] },
    { yearMonth: '2025/06', channel: CHANNEL_YAMANASHI, values: [80000] },
    { yearMonth: '2025/07', channel: CHANNEL_SHIZUOKA, values: [65000] },
  ],
  sales_equipment_lease: [
    {
      yearMonth: '2025/05',
      channel: CHANNEL_NAGANO,
      values: ['×××', 'リース料', 10020, '支社A 自販機部門', 71000],
    },
    {
      yearMonth: '2025/06',
      channel: CHANNEL_YAMANASHI,
      values: ['×××', '販売器具費', 10020, '支社A 自販機部門', 89000],
    },
    {
      yearMonth: '2025/07',
      channel: CHANNEL_SHIZUOKA,
      values: ['×××', 'リース料', 10020, '支社A 自販機部門', 54000],
    },
  ],
  partner_machine: [
    {
      yearMonth: '2025/05',
      channel: CHANNEL_NAGANO,
      values: [70, 618, 2316, 24.9],
    },
    {
      yearMonth: '2025/06',
      channel: CHANNEL_YAMANASHI,
      values: [73, 702, 2203, 25],
    },
    {
      yearMonth: '2025/07',
      channel: CHANNEL_SHIZUOKA,
      values: [64, 540, 2280, 24],
    },
  ],
  alliance_product: [
    {
      yearMonth: '2025/05',
      channel: CHANNEL_NAGANO,
      values: [4505, 38196, 2355, 24],
    },
    {
      yearMonth: '2025/06',
      channel: CHANNEL_YAMANASHI,
      values: [1, 7, 2272, 29.6],
    },
    {
      yearMonth: '2025/07',
      channel: CHANNEL_SHIZUOKA,
      values: [12, 96, 2310, 24],
    },
  ],
};

// ───────────────────────────────────────────────
// アップロード結果・履歴（モック）
// ───────────────────────────────────────────────

// アップロード失敗時に表示するサンプルエラー
export const SAMPLE_UPLOAD_ERRORS: UploadErrorItem[] = [
  { rowNumber: 3, errorMessage: '販売店が存在しません。' },
  { rowNumber: 4, errorMessage: '３次店が存在しません。' },
];

// アップロード履歴の初期データ（仮データ。両モード分を持ち、画面側でモードの対象のみに絞る）
export const INITIAL_HISTORY: UploadHistoryItem[] = [
  {
    uploadId: 'UPL-20250705-150000-001',
    targetYearMonthFrom: '2025/05',
    targetYearMonthTo: '2025/06',
    uploadTarget: 'managed_product_target',
    uploadTargetName: '管理対象商品目標数値',
    fileName: '管理対象商品目標数値_202505-202506.xlsx',
    uploadedAt: '2025-07-05T15:00:00+09:00',
    uploadedBy: 'アサヒ 太郎',
    status: 'COMPLETED',
    errorCount: 0,
    isSysError: false,
  },
  {
    uploadId: 'UPL-20250705-151000-002',
    targetYearMonthFrom: '2025/05',
    targetYearMonthTo: '2025/05',
    uploadTarget: 'alliance_additional_sales',
    uploadTargetName: 'アライアンス品契約状況変動に伴う追加売上金額',
    fileName: 'アライアンス品追加売上_202505.xlsx',
    uploadedAt: '2025-07-05T15:10:00+09:00',
    uploadedBy: 'アサヒ 太郎',
    status: 'ERROR',
    errorCount: 2,
    errors: SAMPLE_UPLOAD_ERRORS,
    isSysError: false,
  },
  {
    uploadId: 'UPL-20250705-152000-003',
    targetYearMonthFrom: '2025/05',
    targetYearMonthTo: '2025/07',
    uploadTarget: 'sales_equipment_lease',
    uploadTargetName: '販売器具費・リース料',
    fileName: '販売器具費_リース料_202505-202507.xlsx',
    uploadedAt: '2025-07-05T15:20:00+09:00',
    uploadedBy: 'アサヒ 太郎',
    status: 'PROCESSING',
    errorCount: 0,
    isSysError: false,
  },
  {
    uploadId: 'UPL-20250705-153000-004',
    targetYearMonthFrom: '2025/05',
    targetYearMonthTo: '2025/05',
    uploadTarget: 'managed_product_target',
    uploadTargetName: '管理対象商品目標数値',
    fileName:
      '管理対象商品目標数値_202505_非常に長いファイル名の表示確認用データ.xlsx',
    uploadedAt: '2025-07-05T15:30:00+09:00',
    uploadedBy: 'アサヒ 太郎',
    status: 'ERROR',
    errorCount: 0,
    isSysError: true,
  },
  {
    uploadId: 'UPL-20250706-100000-005',
    targetYearMonthFrom: '2025/05',
    targetYearMonthTo: '2025/06',
    uploadTarget: 'partner_machine',
    uploadTargetName: '提携機',
    fileName: '提携機_202505-202506.xlsx',
    uploadedAt: '2025-07-06T10:00:00+09:00',
    uploadedBy: 'アサヒ 太郎',
    status: 'COMPLETED',
    errorCount: 0,
    isSysError: false,
  },
  {
    uploadId: 'UPL-20250706-101000-006',
    targetYearMonthFrom: '2025/06',
    targetYearMonthTo: '2025/06',
    uploadTarget: 'alliance_product',
    uploadTargetName: 'アライアンス品',
    fileName: 'アライアンス品_202506.xlsx',
    uploadedAt: '2025-07-06T10:10:00+09:00',
    uploadedBy: 'アサヒ 花子',
    status: 'ERROR',
    errorCount: 2,
    errors: SAMPLE_UPLOAD_ERRORS,
    isSysError: false,
  },
];

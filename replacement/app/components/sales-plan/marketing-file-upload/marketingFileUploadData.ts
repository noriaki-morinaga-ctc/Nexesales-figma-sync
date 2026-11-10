import type {
  SalesChannel,
  StoreFilter,
  TemplateDefinition,
  TemplateRow,
  UploadErrorItem,
  UploadHistoryItem,
  UploadTargetOption,
  UploadTargetType,
} from './marketingFileUploadTypes';

// ファイルの拡張子・accept 値・ステータスの表示名は共通（→ shared/upload/uploadConstants.ts）
export {
  ALLOWED_EXTENSIONS,
  FILE_ACCEPT,
  STATUS_NAME_MAP,
} from '../../shared/upload/uploadConstants';

// ===== ファイルアップロード画面の定数・モックデータ =====

// アップロード・ダウンロード対象の選択肢（販売計画メニューから遷移＝jihanki なし）
export const PLAN_TARGET_OPTIONS: UploadTargetOption[] = [
  { value: 'managed_product_target', label: '管理対象商品目標数値' },
  {
    value: 'alliance_additional_sales',
    label: 'アライアンス品契約状況変動に伴う追加売上金額',
  },
];

// アップロード・ダウンロード対象の選択肢（実績登録メニューから遷移＝jihanki あり）
export const ACTUAL_TARGET_OPTIONS: UploadTargetOption[] = [
  { value: 'partner_machine', label: '提携機' },
  { value: 'alliance_product', label: 'アライアンス品' },
  { value: 'sales_equipment_lease', label: '販売器具費・リース料' },
];

// ダウンロード対象期間（From～To）の初期値（YYYY/MM）。仮置き
export const DEFAULT_DOWNLOAD_PERIOD_FROM = '2025/05';
export const DEFAULT_DOWNLOAD_PERIOD_TO = '2026/04';

// ダウンロード条件の販売店・三次店・一次店の初期値（すべて未選択）
export const INITIAL_STORE_FILTER: StoreFilter = {
  retailer: '',
  tertiaryStore: '',
  primaryStore: '',
};

// 登録者（モック：ログインユーザー）
export const MOCK_LOGIN_USER_NAME = 'アサヒ 太郎';

// 許可するファイル拡張子

// 進捗トーストのID（同一IDで再描画して進捗を更新する）
export const UPLOAD_PROGRESS_TOAST_ID = 'marketing-upload-progress';
export const DOWNLOAD_PROGRESS_TOAST_ID = 'marketing-download-progress';

// ───────────────────────────────────────────────
// テンプレート（Excel）の定義
// テンプレートファイル.xlsx の各シートと項目・構成を揃える（書式は再現しない）。
// 構成：見出し行 → 空行 → 明細。管理対象商品目標数値のみ見出しが2段。
// ───────────────────────────────────────────────

// 年月列の列位置（0始まり。全シートでB列＝NOの次）
export const YEAR_MONTH_COLUMN_INDEX = 1;

// 年月セルの表示形式（テンプレートファイルと同じ「yyyy年m月」）
export const YEAR_MONTH_CELL_FORMAT = 'yyyy"年"m"月"';

// 全シート共通の先頭列（NO・年月以外の商流列）と列幅
const CHANNEL_HEADERS = [
  '販売店CD',
  '販売店名',
  '三次店CD',
  '三次店名',
  '一次店CD',
  '一次店名',
];
const CHANNEL_COL_WIDTHS = [13, 30, 13, 38, 14, 38].map((wch) => ({ wch }));
const NO_COL_WIDTH = { wch: 9 };
const YEAR_MONTH_COL_WIDTH = { wch: 14 };

export const TEMPLATE_DEFINITIONS: Record<
  UploadTargetType,
  TemplateDefinition
> = {
  managed_product_target: {
    sheetName: '管理対象商品目標数値',
    fileName: '管理対象商品目標数値.xlsx',
    // J列に「管理対象商品」、M列に「参考商品」
    groupHeaders: [
      ...Array.from({ length: 9 }, () => null),
      '管理対象商品',
      null,
      null,
      '参考商品',
    ],
    headers: [
      'NO',
      '対象年月',
      ...CHANNEL_HEADERS,
      '商品区分',
      'サマリ商品CD',
      'サマリ商品名称',
      '目標函数（単位：函）',
      'サマリ商品CD',
      'サマリ商品名称',
    ],
    colWidths: [
      NO_COL_WIDTH,
      YEAR_MONTH_COL_WIDTH,
      ...CHANNEL_COL_WIDTHS,
      ...[12, 15, 42, 20, 16, 38].map((wch) => ({ wch })),
    ],
  },
  alliance_additional_sales: {
    sheetName: 'アライアンス品契約状況変動に伴う追加売上金額',
    fileName: 'アライアンス品契約状況変動に伴う追加売上金額.xlsx',
    headers: ['NO', '対象年月', ...CHANNEL_HEADERS, '金額（単位：円）'],
    colWidths: [
      NO_COL_WIDTH,
      YEAR_MONTH_COL_WIDTH,
      ...CHANNEL_COL_WIDTHS,
      { wch: 16 },
    ],
  },
  sales_equipment_lease: {
    sheetName: '販売器具費_リース料',
    fileName: '販売器具費_リース料.xlsx',
    headers: [
      'NO',
      '対象年月',
      ...CHANNEL_HEADERS,
      '管理区分',
      '管理区分名称',
      '管理コード',
      '管理コード名称',
      '金額（単位：円）',
    ],
    colWidths: [
      NO_COL_WIDTH,
      YEAR_MONTH_COL_WIDTH,
      ...CHANNEL_COL_WIDTHS,
      ...[18, 17, 12, 20, 17].map((wch) => ({ wch })),
    ],
  },
  partner_machine: {
    sheetName: '提携機',
    fileName: '提携機.xlsx',
    headers: [
      'NO',
      '対象年月',
      ...CHANNEL_HEADERS,
      'コラム数',
      '売上本数',
      '函単価',
      '入数',
    ],
    colWidths: [
      NO_COL_WIDTH,
      YEAR_MONTH_COL_WIDTH,
      ...CHANNEL_COL_WIDTHS,
      ...[10, 10, 10, 10].map((wch) => ({ wch })),
    ],
  },
  alliance_product: {
    sheetName: 'アライアンス品',
    fileName: 'アライアンス品.xlsx',
    headers: [
      'NO',
      '対象年月',
      ...CHANNEL_HEADERS,
      '台数',
      '売上本数',
      '函単価',
      '入数',
    ],
    colWidths: [
      NO_COL_WIDTH,
      YEAR_MONTH_COL_WIDTH,
      ...CHANNEL_COL_WIDTHS,
      ...[10, 10, 10, 10].map((wch) => ({ wch })),
    ],
  },
};

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

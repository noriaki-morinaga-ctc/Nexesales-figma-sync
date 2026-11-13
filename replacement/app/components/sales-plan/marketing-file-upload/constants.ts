// マーケティングファイルアップロード：対象の選択肢・初期値・テンプレートの定義（バックエンドをつないでも残す値）。

import type {
  StoreFilter,
  TemplateDefinition,
  UploadTargetOption,
  UploadTargetType,
} from './marketingFileUpload.types';

// ===== ファイルアップロード画面の定数・モックデータ =====
// 拡張子・登録者・進捗トーストなどアップロード画面共通のものは shared/upload/ にある

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

// 予算参照登録：ダウンロードの出力データ・サンプルのエラー・アップロード履歴のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/features/budget/budget-reference-registration/page.tsx。

import type {
  BudgetDownloadDataset,
  BudgetUploadHistoryItem,
} from '@/features/budget/budget-reference-registration/budgetReference.types';
import type { UploadErrorItem } from '@/components/shared/upload/uploadTypes';

// ───────────────────────────────────────────────
// ダウンロードテンプレート（Excel）の出力内容
// ───────────────────────────────────────────────

// ダウンロードテンプレートのファイル名
const SALES_DEALER_FILE_NAME = '年間予算_売上（参照）.xlsx';

// 属性列（見出し・Excel列幅）
const ATTRIBUTE_COLUMNS: { header: string; wch: number }[] = [
  { header: '事業場', wch: 30 },
  { header: '部署', wch: 30 },
  { header: '営業担当', wch: 30 },
  { header: '大区分', wch: 10 },
  { header: '業態区分', wch: 10 },
  { header: '商談区分', wch: 10 },
  { header: 'メタブランド', wch: 30 },
  { header: '容器容量グループ', wch: 20 },
  { header: '一次店', wch: 30 },
  { header: '三次店', wch: 30 },
  { header: '販売店', wch: 30 },
];

// 月別の見出し（1月〜12月＋年間）
const PERIOD_LABELS = [
  ...Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
  '年間',
];

// 数値項目の列幅（Excel）
const MEASURE_COL_WCH = 10;

// 数値項目ごとのサンプル値（1月〜12月＋年間の13値）
const MONTHLY_ZERO = PERIOD_LABELS.map(() => '0');

const BRANCH_COST_SAMPLE = [
  '3,456',
  '2,448',
  '5,904',
  '4,176',
  '2,880',
  '1,584',
  '4,320',
  '3,888',
  '5,472',
  '4,464',
  '4,464',
  '6,912',
  '49,968',
];

const MEASURES: { name: string; sample: string[] }[] = [
  {
    name: '函数',
    sample: [
      '2.4',
      '1.7',
      '4.1',
      '2.9',
      '2.0',
      '1.1',
      '3.0',
      '2.7',
      '3.8',
      '3.1',
      '3.1',
      '4.8',
      '34.7',
    ],
  },
  {
    name: '社外売上高',
    sample: [
      '5,818',
      '4,121',
      '9,939',
      '7,030',
      '4,848',
      '2,666',
      '7,272',
      '6,545',
      '9,211',
      '7,515',
      '7,515',
      '11,635',
      '84,115',
    ],
  },
  { name: '割引高', sample: MONTHLY_ZERO },
  {
    name: '条件口',
    sample: [
      '346',
      '245',
      '590',
      '418',
      '288',
      '158',
      '432',
      '389',
      '547',
      '446',
      '446',
      '691',
      '4,996',
    ],
  },
  { name: '支社売上原価', sample: BRANCH_COST_SAMPLE },
  { name: '本社売上原価', sample: BRANCH_COST_SAMPLE },
  { name: '追加口', sample: MONTHLY_ZERO },
];

// 末尾の理由列（期中変更時のみ入力）
const REASON_HEADER = '理由（期中変更）';

// テンプレートのヘッダー行（属性列 → 数値項目×月別 → 理由）
const SALES_DEALER_HEADERS: string[] = [
  ...ATTRIBUTE_COLUMNS.map((column) => column.header),
  ...MEASURES.flatMap((measure) =>
    PERIOD_LABELS.map((period) => `${measure.name}${period}`)
  ),
  REASON_HEADER,
];

// サンプル行の属性値（商談区分・容器容量グループのみ行ごとに異なる）
const SAMPLE_ATTRIBUTE_NATIONAL = [
  '10000594:北海道支社',
  '10000067:北海道営業一部',
  '9999999999:XXXXアサヒ太郎',
  '01:SM',
  '01:SM',
  '01:全国',
  '2100:三ツ矢',
  '01:ＰＥＴ・ボトル缶２８０・３５０',
  '33333333:○○一次店',
  '11111111:○○卸',
  '22222222:○○商店',
];

const SAMPLE_ATTRIBUTE_SPECIFIC = SAMPLE_ATTRIBUTE_NATIONAL.map((value, i) => {
  if (i === 5) return '02:特定';
  if (i === 7) return '02:ＰＥＴ・ボトル缶５００';
  return value;
});

// 属性値に数値項目のサンプル値と空の理由を連結して1行にする
const buildSampleRow = (attributes: string[]): string[] => [
  ...attributes,
  ...MEASURES.flatMap((measure) => measure.sample),
  '',
];

// テンプレートのサンプル行（全国・特定の2行を2回繰り返す）
const SALES_DEALER_SAMPLE_ROWS: (string | number)[][] = [
  buildSampleRow(SAMPLE_ATTRIBUTE_NATIONAL),
  buildSampleRow(SAMPLE_ATTRIBUTE_SPECIFIC),
  buildSampleRow(SAMPLE_ATTRIBUTE_NATIONAL),
  buildSampleRow(SAMPLE_ATTRIBUTE_SPECIFIC),
];

// テンプレートの列幅（属性列＋数値項目列。理由列は既定幅のため指定しない）
const SALES_DEALER_COL_WIDTHS: { wch: number }[] = [
  ...ATTRIBUTE_COLUMNS.map((column) => ({ wch: column.wch })),
  ...MEASURES.flatMap(() =>
    PERIOD_LABELS.map(() => ({ wch: MEASURE_COL_WCH }))
  ),
];

// ダウンロード対象ごとの出力データセット
export const BUDGET_DOWNLOAD_DATASETS: Record<string, BudgetDownloadDataset> = {
  sales_raw: {
    headers: SALES_DEALER_HEADERS,
    rows: SALES_DEALER_SAMPLE_ROWS,
    colWidths: SALES_DEALER_COL_WIDTHS,
    sheetName: '年間予算_売上',
    fileName: SALES_DEALER_FILE_NAME,
  },
  promotion_raw: {
    headers: SALES_DEALER_HEADERS,
    rows: SALES_DEALER_SAMPLE_ROWS,
    colWidths: SALES_DEALER_COL_WIDTHS,
    sheetName: '年間予算_拡売費',
    fileName: '年間予算_拡売費（参照）.xlsx',
  },
  sales_summary: {
    headers: SALES_DEALER_HEADERS,
    rows: SALES_DEALER_SAMPLE_ROWS,
    colWidths: SALES_DEALER_COL_WIDTHS,
    sheetName: '売上予算_部支店別集計',
    fileName: '売上予算_部支店別集計（参照）.xlsx',
  },
  promotion_summary: {
    headers: SALES_DEALER_HEADERS,
    rows: SALES_DEALER_SAMPLE_ROWS,
    colWidths: SALES_DEALER_COL_WIDTHS,
    sheetName: '拡売費_部支店別集計',
    fileName: '拡売費_部支店別集計（参照）.xlsx',
  },
};

// ───────────────────────────────────────────────
// アップロード結果・履歴（モック）
// ───────────────────────────────────────────────

// アップロード失敗時に表示するサンプルエラー
export const BUDGET_SAMPLE_UPLOAD_ERRORS: UploadErrorItem[] = [
  { rowNumber: 1, errorMessage: '販売店が存在しません。' },
  { rowNumber: 2, errorMessage: '３次店が存在しません。' },
];

// アップロード履歴の初期データ（仮データ）
export const BUDGET_INITIAL_HISTORY: BudgetUploadHistoryItem[] = [
  {
    uploadId: 'UPL-20250705-150000-001',
    uploadFiscalYear: 2025,
    uploadTarget: 'initial_sales',
    uploadTargetName: '年初予算（売上）',
    fileName: 'budget_2025_initial_sales.xlsx',
    uploadedAt: '2025-07-05T15:00:00+09:00',
    uploadedBy: 'アサヒ 太郎',
    status: 'COMPLETED',
    errorCount: 0,
    isSysError: false,
  },
  {
    uploadId: 'UPL-20250705-151000-002',
    uploadFiscalYear: 2025,
    uploadTarget: 'midterm_change',
    uploadTargetName: '期中変更（売上）',
    fileName: 'budget_2025_midterm_change_error.xlsx',
    uploadedAt: '2025-07-05T15:10:00+09:00',
    uploadedBy: 'アサヒ 太郎',
    status: 'ERROR',
    errorCount: 3,
    errors: [
      { rowNumber: 1, errorMessage: '販売店が存在しません。' },
      { rowNumber: 2, errorMessage: '３次店が存在しません。' },
    ],
    isSysError: false,
  },
  {
    uploadId: 'UPL-20250705-152000-003',
    uploadFiscalYear: 2025,
    uploadTarget: 'initial_promotion',
    uploadTargetName: '年初予算（拡売費）',
    fileName: 'budget_2025_initial_promotion.xlsx',
    uploadedAt: '2025-07-05T15:20:00+09:00',
    uploadedBy: 'アサヒ 太郎',
    status: 'PROCESSING',
    errorCount: 0,
    isSysError: false,
  },
  {
    uploadId: 'UPL-20250705-153000-004',
    uploadFiscalYear: 2025,
    uploadTarget: 'initial_sales',
    uploadTargetName: '年初予算（売上）',
    fileName:
      'budget_2025_initial_sales_非常に長いファイル名の表示確認用データ.xlsx',
    uploadedAt: '2025-07-05T15:30:00+09:00',
    uploadedBy: 'アサヒ 太郎',
    status: 'ERROR',
    errorCount: 0,
    isSysError: true,
  },
];

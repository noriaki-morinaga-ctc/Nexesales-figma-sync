import type { SingleComboboxOption } from '../../ui/single-combobox';
import { ALLOWED_EXTENSIONS } from './marketingFileUploadData';
import type {
  SalesChannel,
  StoreFilter,
  TemplateRow,
} from './marketingFileUploadTypes';

// ===== ファイルアップロード画面のユーティリティ関数 =====

// 2桁（または指定桁）のゼロ埋め
const pad = (value: number, width = 2): string =>
  String(value).padStart(width, '0');

// アップロードIDを生成する（UPL-YYYYMMDD-HHmmss-連番3桁）
export function genUploadId(): string {
  const date = new Date();
  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const seq = pad(Math.floor(Math.random() * 999) + 1, 3);
  return `UPL-${datePart}-${timePart}-${seq}`;
}

// 現在日時をISO形式（タイムゾーン付き）で返す
export function nowIso(): string {
  const date = new Date();
  const tzMinutes = -date.getTimezoneOffset();
  const tzSign = tzMinutes >= 0 ? '+' : '-';
  const tzHour = pad(Math.floor(Math.abs(tzMinutes) / 60));
  const tzMin = pad(Math.abs(tzMinutes) % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${tzSign}${tzHour}:${tzMin}`
  );
}

// ISO形式の日時を「YYYY/MM/DD HH:mm:ss」形式に整形する
export function formatDateTime(iso: string): string {
  if (!iso) return '';
  const matched = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!matched) return iso;
  return `${matched[1]}/${matched[2]}/${matched[3]} ${matched[4]}:${matched[5]}:${matched[6]}`;
}

// ファイル形式のバリデーション（エラー時はメッセージ、正常時は null）
// ※ファイルサイズ上限チェックは Make 版と同じく無効
export function validateFile(file: File): string | null {
  const extension = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return '許可されていないファイル形式です。.xlsxまたは.xlsファイルをアップロードしてください。';
  }
  return null;
}

// ───────────────────────────────────────────────
// 年月（YYYY/MM）関連
// ───────────────────────────────────────────────

// Excel シリアル値の基準日（1899/12/30）からの日数を日付へ変換する際の1日のミリ秒
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

// 年・月から「YYYY/MM」形式の文字列を作る
const formatYearMonth = (year: number, month: number): string =>
  `${year}/${pad(month)}`;

// セル値（日付／Excelシリアル値／文字列）を「YYYY/MM」に変換する（変換できない場合は空文字）
export function toYearMonth(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatYearMonth(value.getFullYear(), value.getMonth() + 1);
  }
  if (typeof value === 'number' && value > 0) {
    const date = new Date(EXCEL_EPOCH_MS + value * MS_PER_DAY);
    return formatYearMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
  }
  if (typeof value === 'string') {
    // 「2025/05」「2025-5」「2025年5月」等を許容する
    const matched = value.trim().match(/^(\d{4})\D+(\d{1,2})/);
    if (matched) {
      const month = Number(matched[2]);
      if (month >= 1 && month <= 12) {
        return formatYearMonth(Number(matched[1]), month);
      }
    }
  }
  return '';
}

// 「YYYY/MM」を、その月の1日の日付へ変換する（Excel の日付セル出力用）
export function yearMonthToDate(yearMonth: string): Date {
  const [year, month] = yearMonth.split('/').map(Number);
  return new Date(year, month - 1, 1);
}

// 対象期間（From～To）の入力チェック（エラー時はメッセージ、正常時は null）
export function validatePeriod(from: string, to: string): string | null {
  if (!from || !to) {
    return '対象期間を入力してください。';
  }
  // 「YYYY/MM」は文字列比較で前後を判定できる
  if (from > to) {
    return '対象期間の開始は終了以前の年月を指定してください。';
  }
  return null;
}

// 対象年月 From／To を表示用に整形する
// 単月（From＝To）は「YYYY/MM」、複数月は「YYYY/MM～YYYY/MM」（どちらかが空の場合は空文字）
export function formatYearMonthRange(from: string, to: string): string {
  if (!from || !to) return '';
  if (from === to) return from;
  return `${from}～${to}`;
}

// 年月が対象期間（From～To）に含まれるか
export function isWithinPeriod(
  yearMonth: string,
  from: string,
  to: string
): boolean {
  return yearMonth >= from && yearMonth <= to;
}

// ───────────────────────────────────────────────
// 販売店・三次店・一次店（ダウンロード条件）関連
// ───────────────────────────────────────────────

// 商流をテンプレートの列順（販売店CD〜一次店名）のセル値へ並べる
export function channelToCells(channel: SalesChannel): (string | number)[] {
  return [
    channel.retailerCode,
    channel.retailerName,
    channel.tertiaryStoreCode,
    channel.tertiaryStoreName,
    channel.primaryStoreCode,
    channel.primaryStoreName,
  ];
}

// 明細に含まれる店から、コンボボックスの候補（コード順・重複なし）を作る。
// 候補は「名称（上段）＋コード（下段）」の2行表示で、名称・コードのどちらでも検索できる（→ 02 §9）。
// value にコードを持たせ、絞り込みに直接使う
export function buildStoreOptions(
  rows: TemplateRow[],
  pickStore: (channel: SalesChannel) => { code: number; name: string }
): SingleComboboxOption[] {
  const storeMap = new Map<number, string>();
  rows.forEach((row) => {
    const { code, name } = pickStore(row.channel);
    storeMap.set(code, name);
  });
  return [...storeMap.entries()]
    .sort(([codeA], [codeB]) => codeA - codeB)
    .map(([code, name]) => ({
      value: String(code),
      label: name,
      code: String(code),
    }));
}

// 明細の商流が、販売店・三次店・一次店の条件に合うか（未選択の項目は絞り込まない）
export function matchesStoreFilter(
  channel: SalesChannel,
  filter: StoreFilter
): boolean {
  return (
    (!filter.retailer || String(channel.retailerCode) === filter.retailer) &&
    (!filter.tertiaryStore ||
      String(channel.tertiaryStoreCode) === filter.tertiaryStore) &&
    (!filter.primaryStore ||
      String(channel.primaryStoreCode) === filter.primaryStore)
  );
}

// 販売店・三次店・一次店の入力チェック（エラー時はメッセージ、正常時は null）。
// 全件出力はデータ量が膨大になるため、いずれか1つ以上の指定を必須とする
export function validateStoreFilter(filter: StoreFilter): string | null {
  if (!filter.retailer && !filter.tertiaryStore && !filter.primaryStore) {
    return '販売店・三次店・一次店のいずれかを選択してください。';
  }
  return null;
}

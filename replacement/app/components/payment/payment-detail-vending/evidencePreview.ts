// 支払根拠資料のプレビュー用PDF変換（指示書 D2）。
// ※ 支払詳細(自販機)画面ローカルのモジュール（Figma Make から移植）。convertToPdf() はモック実装。
// プレビューは「PDF化した資料」を見せ、ダウンロードは「原本」を渡す。
// 変換処理はこのファイルの convertToPdf() 1関数に閉じ込め、
// 呼び出し側（登録タブ・表示タブ）は結果の status と URL だけを見る。
import {
  SAMPLE_CONVERTED_EXCEL_PDF_BASE64,
  SAMPLE_CONVERTED_WORD_PDF_BASE64,
} from './evidenceSamplePdf';

// 擬似変換で返すサンプルPDFの blob URL を作る（初回だけ生成して再利用する）。
// base64 から blob を作るため、アセット解決（?url インポート）に依存しない。
// これによりビルド構成や取り込み経路が変わってもプレビューが壊れない。
const sampleBlobUrlCache = new Map<string, string>();

const sampleConvertedPdfUrl = (kind: 'excel' | 'word') => {
  const cached = sampleBlobUrlCache.get(kind);
  if (cached) return cached;
  const base64 =
    kind === 'excel'
      ? SAMPLE_CONVERTED_EXCEL_PDF_BASE64
      : SAMPLE_CONVERTED_WORD_PDF_BASE64;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(
    new Blob([bytes], { type: 'application/pdf' })
  );
  sampleBlobUrlCache.set(kind, url);
  return url;
};

// 変換の状態。
//  none       … 変換不要（PDF原本・画像原本をそのままプレビューする）
//  converting … 変換中（プレビューはスピナー表示）
//  done       … 変換済（pdfPreviewUrl をプレビューする）
//  failed     … 変換不可（プレビュー非対応。原本DLのみ）
export type ConvertStatus = 'none' | 'converting' | 'done' | 'failed';

export type ConvertToPdfResult =
  | { status: 'done'; pdfUrl: string }
  | { status: 'none' }
  | { status: 'failed'; reason: string };

// 擬似変換の待ち時間（モック専用）。実装版ではサーバー応答時間に置き換わる。
export const MOCK_CONVERT_DELAY_MS = 1200;

export const isExcelFileName = (fileName: string) => /\.xlsx?$/i.test(fileName);

export const isWordFileName = (fileName: string) => /\.docx?$/i.test(fileName);

export const isPdfFileName = (fileName: string) => /\.pdf$/i.test(fileName);

export const isImageFileName = (fileName: string) =>
  /\.(jpe?g|png|svg|gif|webp)$/i.test(fileName);

// PDF変換の対象（Excel / Word）
export const isConvertibleFileName = (fileName: string) =>
  isExcelFileName(fileName) || isWordFileName(fileName);

// ファイルを選んだ直後の状態。変換をキックする前に画面へ出す初期値。
export const initialConvertStatus = (fileName: string): ConvertStatus => {
  if (isPdfFileName(fileName) || isImageFileName(fileName)) return 'none';
  if (isConvertibleFileName(fileName)) return 'converting';
  return 'failed';
};

/**
 * 資料をプレビュー用のPDFへ変換する。
 *
 * - PDF・画像 … 変換不要（`none`）。原本をそのままプレビューする
 * - Excel・Word … PDFへ変換（`done`）
 * - それ以外 … 変換不可（`failed`）。原本DLのみ
 *
 * ＜モック実装＞
 * Excel・Word は {@link MOCK_CONVERT_DELAY_MS} だけ待ってから、同梱のサンプルPDF
 * （evidenceSamplePdf.ts に base64 で保持）を blob URL にして返す。Excel系・Word系で出し分ける。
 * どちらも請求書サンプルを LibreOffice（headless）で実際に変換した出力。
 * アップロードされたファイルの中身は読まない（＝どのファイルでも同じPDFが表示される）。
 *
 * ＜実装版＞
 * サーバーサイド変換API（LibreOffice headless。API化するなら Gotenberg 等）の呼び出しに
 * 差し替える。変換は非同期（登録時にキューイングし、完了後に配信URLを返す）とし、
 * 変換済みPDFはサーバー側でキャッシュして再変換を避ける。
 * 戻り値の形（status と URL）はそのまま使えるため、呼び出し側の改修は不要。
 *
 * 実測（2026-08-25・Java + Gotenberg/LibreOffice をコンテナで起動して検証）：
 * ウォーム状態で 0.32〜1.0 秒/件。変換サーバーには日本語ロケール（LANG=ja_JP.UTF-8）が必要で、
 * 未設定だと日本語が Noto Sans CJK SC/HK（中国語字形）で描画される。
 */
export async function convertToPdf(file: File): Promise<ConvertToPdfResult> {
  if (isPdfFileName(file.name) || isImageFileName(file.name))
    return { status: 'none' };

  if (!isConvertibleFileName(file.name))
    return {
      status: 'failed',
      reason: 'PDF変換に対応していない形式です',
    };

  await new Promise<void>((resolve) =>
    window.setTimeout(resolve, MOCK_CONVERT_DELAY_MS)
  );
  return {
    status: 'done',
    pdfUrl: sampleConvertedPdfUrl(
      isExcelFileName(file.name) ? 'excel' : 'word'
    ),
  };
}

/**
 * 流用モックファイル用のプレビュー情報を同期で返す。
 * 実際のFileオブジェクトがないため、サンプルPDF blob URL を代用する。
 * PDF/画像 → originalUrl に割り当てて canPreviewEvidence が true になるようにする。
 * Excel/Word → pdfPreviewUrl に変換済みサンプルPDFを割り当てる。
 */
export const getMockPreviewForReference = (
  fileName: string
): {
  originalUrl?: string;
  pdfPreviewUrl?: string;
  convertStatus: ConvertStatus;
} => {
  if (isPdfFileName(fileName) || isImageFileName(fileName)) {
    return {
      originalUrl: sampleConvertedPdfUrl('excel'),
      convertStatus: 'none',
    };
  }
  if (isExcelFileName(fileName)) {
    return {
      pdfPreviewUrl: sampleConvertedPdfUrl('excel'),
      convertStatus: 'done',
    };
  }
  if (isWordFileName(fileName)) {
    return {
      pdfPreviewUrl: sampleConvertedPdfUrl('word'),
      convertStatus: 'done',
    };
  }
  return { convertStatus: 'failed' };
};

// プレビュー可否の判定元（指示書 D3）。
// 登録タブの EvidenceSlot・表示タブの EvidenceFile の双方がこの形を満たす。
export interface EvidencePreviewSource {
  fileName: string;
  originalUrl?: string;
  pdfPreviewUrl?: string;
}

/**
 * プレビューできるか（指示書 D3）。
 * 「変換後PDFがある」または「PDF・画像の原本がある」場合のみ true。
 * 拡張子だけで判定しない（Office系は変換が終わるまで false）。
 */
export const canPreviewEvidence = (src: EvidencePreviewSource) =>
  !!src.pdfPreviewUrl ||
  (!!src.originalUrl &&
    (isPdfFileName(src.fileName) || isImageFileName(src.fileName)));

// 原本をダウンロードする（指示書 D5）。
// アップロードされたままの形式・ファイル名で渡す。
export const downloadOriginal = (originalUrl: string, fileName: string) => {
  const a = document.createElement('a');
  a.href = originalUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

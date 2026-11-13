// 根拠資料表示（支払根拠資料ペインの「根拠資料表示」タブの中身）
// 登録済み根拠資料の閲覧部品。ペインの外枠は EvidenceUploadPane が持ち、ここはタブ内のコンテンツのみ。
// 選択中資料の情報行 → 大プレビュー → 下部フィルムストリップ（サムネ列）の縦積み構成。
// サムネ押下で上の大プレビューを切り替える。
// 型（EvidenceFile・PaymentStatus 等）と編集可否の判定はここを唯一の定義元とする。
import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  RotateCcw,
  RotateCw,
  Download,
  FileSpreadsheet,
  FileText,
  FileQuestion,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  StickyNote,
  Trash2,
  Check,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  SquarePen,
} from 'lucide-react';

import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import { BUTTON_STYLES } from '@/styles/commonStyles';
import { PdfPreview } from './PdfPreview';
import { DateMonthYearPicker } from '@/app/components/ui/date-month-year-picker';
import {
  downloadOriginal,
  isImageFileName,
  isPdfFileName,
  type ConvertStatus,
} from '@/app/components/payment/payment-detail-vending/utils';
import {
  buildMockOriginalUrl,
  canBuildMockOriginal,
} from '@/mocks/payment/payment-detail-vending/originalFile';

// 全角スペース（テンプレートリテラル内の全角スペースは no-irregular-whitespace の対象になるため定数で埋め込む）
const FW_SPACE = '\u3000';

// 資料区分（5種）。登録(UL)画面のセレクトボックスと表示画面で同じものを使うため、
// ここを唯一の定義元とし、UL 側（EvidenceUploadPane）はこれを import して共有する。
// 2026-09-08 修正指示3・4（回答A-3）: 「覚書・契約書」を追加、「請求書代替帳票」は廃止
// （未着の代替資料は区分「請求書」／「覚書・契約書」＋未着フラグで表す）。
export const EVIDENCE_KINDS = [
  '請求書',
  '覚書・契約書',
  '見積書',
  '稟議書',
  'その他の資料',
] as const;

// 支払データのステータス（8種）
export type PaymentStatus =
  | '未申請'
  | 'EDI登録済み'
  | 'AIC登録済み'
  | '承認待ち'
  | '差戻し'
  | '検印待ち'
  | '検印差戻し'
  | '検印済';

// 利用者区分
export type EvidenceUserRole = '担当者' | 'APM';

// 請求書の受領形態
export type ReceiptFormat = '紙' | '電子' | '紙と電子';

export const canEditEvidence = (
  status: PaymentStatus,
  role: EvidenceUserRole = '担当者'
) => role === 'APM' || status === '未申請' || status === '差戻し';

export interface EvidenceFile {
  id: string;
  no: number;
  kind: string;
  fileName: string;
  updatedAt: string;
  memo?: string;
  afterSeal?: boolean;
  thumbnailUrl?: string;
  pageUrls?: string[];
  // D1: プレビュー（PDF）とダウンロード（原本）を分ける
  //  originalUrl    … 原本（アップロードされたままのファイル）。DLはこれを渡す
  //  pdfPreviewUrl  … 変換後PDF（プレビュー専用）
  //  convertStatus  … 変換の状態。省略時は none 扱い
  originalUrl?: string;
  pdfPreviewUrl?: string;
  convertStatus?: ConvertStatus;
  timestampStatus?: '付与済' | '待ち';
  timestampedAt?: string;
  receiptFormat?: ReceiptFormat;
  issueDate?: string;
  // 未着（代替資料）とその回収予定日。請求書・覚書・契約書のみ（修正指示8・9）
  notReceived?: boolean;
  collectionDate?: string;
}

export const evidenceLockedReason = (
  status: PaymentStatus,
  verb: '変更' | '登録' = '変更'
) => {
  switch (status) {
    case '承認待ち':
      return `支払申請が承認待ちのため、根拠資料を${verb}できません。支払申請を引き戻してください。`;
    case '検印待ち':
      return `支払申請が検印待ちのため、根拠資料を${verb}できません。検印者へ差戻しを依頼してください。`;
    case '検印差戻し':
      return `検印差戻しの伝票は承認済みのため、担当者は根拠資料を${verb}できません。営業企画（またはAPM）へ登録を依頼してください。`;
    case '検印済':
      return `検印済のため、担当者は根拠資料を${verb}できません。営業企画（またはAPM）へ登録を依頼してください。`;
    case 'EDI登録済み':
    case 'AIC登録済み':
      return `${status}の伝票は、担当者が根拠資料を${verb}できません。営業企画（またはAPM）へ登録を依頼してください。`;
    default:
      return `ステータスが「${status}」のため、根拠資料を${verb}できません。`;
  }
};

const TIMESTAMP_INTERVAL_MS = 5000;
const PENDING_KEEP_FOR_DEMO = 1;

// 表示順: 請求書 → 覚書・契約書 → 見積書 → 稟議書 → その他（回答B-5）
const KIND_SORT_ORDER: Record<string, number> = {
  請求書: 0,
  '覚書・契約書': 1,
  見積書: 2,
  稟議書: 3,
};
const sortByKind = (list: EvidenceFile[]): EvidenceFile[] =>
  [...list]
    .sort((a, b) => {
      const ao = KIND_SORT_ORDER[a.kind] ?? 4;
      const bo = KIND_SORT_ORDER[b.kind] ?? 4;
      if (ao !== bo) return ao - bo;
      return a.no - b.no;
    })
    .map((f, i) => ({ ...f, no: i + 1 }));

const iconForFile = (fileName: string) => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return FileSpreadsheet;
  if (lower.endsWith('.pdf')) return FileText;
  return FileQuestion;
};

// 受領形態・発行日を持つ区分
const isInvoiceKind = (kind: string) => kind === '請求書';
// 未着フラグ（未着バッジ・回収予定日）を持てる区分（修正指示8・9）
export const isNotReceivableKind = (kind: string) =>
  kind === '請求書' || kind === '覚書・契約書';

// ─── EvidenceViewerContent ────────────────────────────────────────────────────
// 外部ペインシェルを持たない純粋なコンテンツ部分。
// EvidenceViewerPane のシェル内でも、EvidenceUploadPane のタブ内でも利用できる。

export interface EvidenceViewerContentProps {
  paymentSlipNo: string;
  paymentRound: number;
  files: EvidenceFile[];
  status?: PaymentStatus;
  role?: EvidenceUserRole;
  onUpdateFile?: (
    id: string,
    patch: {
      fileName?: string;
      memo?: string;
      receiptFormat?: ReceiptFormat;
      issueDate?: string;
      collectionDate?: string;
    }
  ) => void;
  onDeleteFile?: (id: string) => void;
  onTimestamped?: (id: string, timestampedAt: string) => void;
  // タイムスタンプタイマーを動かすか（ペインが開いている・タブがアクティブなとき true）
  isActive?: boolean;
  // この値が変化したとき、ファイル一覧・選択状態を初期化する
  resetNonce?: number;
}

export function EvidenceViewerContent({
  paymentSlipNo,
  paymentRound,
  files,
  status = '未申請',
  role = '担当者',
  onUpdateFile,
  onDeleteFile,
  onTimestamped,
  isActive = false,
  resetNonce = 0,
}: EvidenceViewerContentProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [zoomPage, setZoomPage] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  // ズーム画像ロード完了フラグ: false の間は opacity-0 で非表示にしてフラッシュを防ぐ
  const [isZoomImgReady, setIsZoomImgReady] = useState(false);
  const zoomImgRef = useRef<HTMLImageElement>(null);
  const panStartRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);

  const [orderedFiles, setOrderedFiles] = useState(() => sortByKind(files));
  // サムネイルホバー時の高速ツールチップ情報
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // 編集対象は備考と属性（受領形態・発行日）のみ。ファイル名は変更不可（修正指示7）。
  const [editing, setEditing] = useState<{
    id: string;
    memo: string;
    receiptFormat?: ReceiptFormat;
    issueDate?: string;
    collectionDate?: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EvidenceFile | null>(null);

  const canEdit = canEditEvidence(status, role);
  const lockedReason = evidenceLockedReason(status, '変更');

  const pendingTimestampCount = orderedFiles.filter(
    (f) => f.timestampStatus === '待ち'
  ).length;

  // タイムスタンプの順次付与
  useEffect(() => {
    if (!isActive || pendingTimestampCount <= PENDING_KEEP_FOR_DEMO) return;
    const timer = window.setTimeout(() => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const stampedAt = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
      const target = orderedFiles.find((f) => f.timestampStatus === '待ち');
      if (!target) return;
      setOrderedFiles((prev) =>
        prev.map((f) =>
          f.id === target.id
            ? {
                ...f,
                timestampStatus: '付与済' as const,
                timestampedAt: stampedAt,
              }
            : f
        )
      );
      onTimestamped?.(target.id, stampedAt);
    }, TIMESTAMP_INTERVAL_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, pendingTimestampCount, onTimestamped]);

  const selected = orderedFiles[selectedIndex];

  // D4: プレビューの表示優先順位
  //   pdfPreviewUrl（変換後PDF） → PDF原本 → 画像原本 → 既存 pageUrls（モックデータ）
  // D3: プレビュー可否もこの導出値に一本化する（拡張子だけで判定しない）
  const selectedPdfUrl =
    selected?.pdfPreviewUrl ??
    (selected?.originalUrl && isPdfFileName(selected.fileName)
      ? selected.originalUrl
      : undefined);
  const selectedImageUrl =
    selected?.originalUrl && isImageFileName(selected.fileName)
      ? selected.originalUrl
      : undefined;
  // 変換後PDFを表示しているときだけ D6 の注記を出す（PDF原本・画像には当たらない）
  const showsConvertedPdf = !!selected?.pdfPreviewUrl;
  // D5: DLは常に原本。
  // 原本を持たないモックデータは、表示中の内容から同じ拡張子のファイルを組み立ててDLさせる
  // （デモで原本DLの流れを見せるため。実装版ではS3の原本をそのまま配信する）。
  const canDownloadOriginal = !!selected?.originalUrl;
  const [isMockDownloading, setIsMockDownloading] = useState(false);

  const pageUrls =
    selected?.pageUrls ??
    (selected?.thumbnailUrl
      ? [selected.thumbnailUrl]
      : selectedImageUrl
        ? [selectedImageUrl]
        : []);

  // モックデータ（原本なし）は、表示中のページ画像／サンプル内容から生成してDLできる
  const canDownloadMock =
    !canDownloadOriginal &&
    !!selected &&
    canBuildMockOriginal(selected.fileName, pageUrls);
  const canDownload = canDownloadOriginal || canDownloadMock;

  // paymentRound が変わったら表示を初期化
  useEffect(() => {
    setOrderedFiles(sortByKind(files));
    setSelectedIndex(0);
    setRotation(0);
    setEditing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentRound]);

  // ペイン開き直し・タブ切り替えで初期化
  useEffect(() => {
    if (resetNonce > 0) {
      setOrderedFiles(sortByKind(files));
      setSelectedIndex(0);
      setRotation(0);
      setEditing(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce]);

  // status/role が変わったら編集途中を破棄
  useEffect(() => {
    setEditing(null);
    setDeleteTarget(null);
    setZoomPage(null);
    setSelectedIndex(0);
    setRotation(0);
  }, [status, role]);

  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
    setRotation(0);
    setZoomPage(null);
  }, []);
  const handlePrev = useCallback(() => {
    setSelectedIndex((i) => Math.max(0, i - 1));
    setRotation(0);
    setZoomPage(null);
    setPanOffset({ x: 0, y: 0 });
  }, []);
  const handleNext = useCallback(() => {
    setSelectedIndex((i) => Math.min(orderedFiles.length - 1, i + 1));
    setRotation(0);
    setZoomPage(null);
    setPanOffset({ x: 0, y: 0 });
  }, [orderedFiles.length]);

  const stripRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const target = strip.children[selectedIndex] as HTMLElement | undefined;
    target?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [selectedIndex, orderedFiles]);

  useEffect(() => {
    if (zoomPage === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomPage(null);
        return;
      }
      // ページ遷移: ↑/↓
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIsZoomImgReady(false);
        setZoomPage((n) => Math.max(0, (n ?? 0) - 1));
        setPanOffset({ x: 0, y: 0 });
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIsZoomImgReady(false);
        setZoomPage((n) => Math.min(pageUrls.length - 1, (n ?? 0) + 1));
        setPanOffset({ x: 0, y: 0 });
      }
      // ファイル遷移: ←/→
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsZoomImgReady(false);
        handlePrev();
        setZoomPage(0);
        setPanOffset({ x: 0, y: 0 });
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsZoomImgReady(false);
        handleNext();
        setZoomPage(0);
        setPanOffset({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomPage, pageUrls.length, handlePrev, handleNext]);

  // D5: ダウンロードは常に原本（アップロードされたままの形式・ファイル名）。
  // 原本を持たないモックデータは、表示中のページ画像（.pdf）またはサンプル内容（.xlsx）から
  // ファイルを組み立てて渡す。生成できない形式はボタンが無効なのでここには来ない。
  const handleDownload = async (file: EvidenceFile) => {
    if (file.originalUrl) {
      downloadOriginal(file.originalUrl, file.fileName);
      return;
    }
    const urls =
      file.pageUrls ?? (file.thumbnailUrl ? [file.thumbnailUrl] : []);
    if (!canBuildMockOriginal(file.fileName, urls)) return;
    setIsMockDownloading(true);
    try {
      const url = await buildMockOriginalUrl(file.fileName, urls);
      if (!url) return;
      downloadOriginal(url, file.fileName);
      // DL開始後に解放する（即座に revoke すると保存が始まらない）
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setIsMockDownloading(false);
    }
  };

  // D5: ZIP一括DLも原本一式が対象。ZIP生成はモックのまま。
  const handleDownloadAll = () => {
    const zipName = `根拠資料_${paymentSlipNo}_${paymentRound}回目.zip`;

    // 空ZIPファイル
    const emptyZipBytes = new Uint8Array([
      0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    const blob = new Blob([emptyZipBytes], {
      type: 'application/zip',
    });

    const url = URL.createObjectURL(blob);

    downloadOriginal(url, zipName);

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const handleEditStart = (file: EvidenceFile) => {
    // 未着の資料は回収予定日を、未着でない請求書は受領形態・発行日を編集対象にする（修正指示8・9）
    const notRecv = isNotReceivableKind(file.kind) && !!file.notReceived;
    const isInv = isInvoiceKind(file.kind) && !notRecv;
    setEditing({
      id: file.id,
      memo: file.memo ?? '',
      receiptFormat: isInv ? file.receiptFormat : undefined,
      issueDate: isInv ? (file.issueDate ?? '') : undefined,
      collectionDate: notRecv ? (file.collectionDate ?? '') : undefined,
    });
  };
  const handleEditCancel = () => {
    setEditing(null);
  };
  const handleEditCommit = () => {
    if (!editing) return;
    const { id, memo } = editing;
    const extraPatch = {
      ...(editing.receiptFormat !== undefined && {
        receiptFormat: editing.receiptFormat,
      }),
      ...(editing.issueDate !== undefined && {
        issueDate: editing.issueDate,
      }),
      ...(editing.collectionDate !== undefined && {
        collectionDate: editing.collectionDate,
      }),
    };
    setOrderedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, memo, ...extraPatch } : f))
    );
    onUpdateFile?.(id, { memo, ...extraPatch });
    setEditing(null);
  };

  const handleDeleteCommit = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    const remaining = orderedFiles.filter((f) => f.id !== id);
    setOrderedFiles(remaining);
    setSelectedIndex((cur) => Math.max(0, Math.min(cur, remaining.length - 1)));
    setRotation(0);
    setZoomPage(null);
    onDeleteFile?.(id);
    setDeleteTarget(null);
  };

  useEffect(() => {
    if (zoomPage === null) return;
    const el = zoomLayerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomScale((z) =>
        Math.min(5, Math.max(fitScale, z + (e.deltaY < 0 ? 0.2 : -0.2)))
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomPage, fitScale]);

  useEffect(() => {
    if (zoomPage === null) {
      setZoomScale(1);
      setFitScale(1);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [zoomPage]);

  // 拡大表示の画像を「表示可」にしてスケールを合わせる。
  // onLoad からも、読み込み済み判定（下の useEffect）からも呼ぶ。
  const applyZoomImageFit = useCallback((img: HTMLImageElement) => {
    const c = zoomLayerRef.current;
    const cw = c ? c.clientWidth : window.innerWidth;
    const ch = c ? c.clientHeight - 48 : window.innerHeight - 56;
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    if (nw > 0 && nh > 0) {
      const scale = Math.min(cw / nw, ch / nh, 1);
      setFitScale(scale);
      setZoomScale(scale);
    }
    setPanOffset({ x: 0, y: 0 });
    setIsZoomImgReady(true);
  }, []);

  // ファイルまたはページが切り替わったらロード完了フラグをリセット（スケール確定前の大表示フラッシュを防ぐ）
  useEffect(() => {
    if (zoomPage !== null) setIsZoomImgReady(false);
  }, [zoomPage, selectedIndex]);

  // 資料を送った先の画像が「既に読み込み済み」のときは onLoad が発火しない。
  // モックデータのように複数の資料が同じ画像URLを使っていると、
  // これを拾わないと opacity-0 のまま＝何も表示されない状態になる。
  useEffect(() => {
    if (zoomPage === null || selectedPdfUrl) return;
    const img = zoomImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) applyZoomImageFit(img);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomPage, selectedIndex, selectedPdfUrl]);

  // 拡大表示中に資料を送ったときの整合を保つ。
  // 画像ページもPDFも持たない資料（プレビュー非対応）へ移ったら拡大表示を閉じ、
  // ページ数が減った資料へ移ったらページ番号を先頭へ丸める。
  // これをしないと「拡大表示が黙って消える／何も表示されない」状態になる。
  useEffect(() => {
    if (zoomPage === null) return;
    if (!selectedPdfUrl && pageUrls.length === 0) {
      setZoomPage(null);
      return;
    }
    if (pageUrls.length > 0 && zoomPage > pageUrls.length - 1) setZoomPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, selectedPdfUrl, pageUrls.length]);

  useEffect(() => {
    if (zoomScale <= fitScale) setPanOffset({ x: 0, y: 0 });
  }, [zoomScale, fitScale]);

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const st = panStartRef.current;
      if (!st) return;
      setPanOffset({
        x: st.ox + (e.clientX - st.x),
        y: st.oy + (e.clientY - st.y),
      });
    };
    const onUp = () => {
      panStartRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning]);

  const Icon = selected ? iconForFile(selected.fileName) : FileQuestion;
  const isFirst = selectedIndex <= 0;
  const isLast = selectedIndex >= orderedFiles.length - 1;
  const editingSelected =
    editing !== null && editing.id === selected?.id ? editing : null;
  const canEditSelected = canEdit && !selected?.afterSeal;
  // 未着の請求書・覚書・契約書 → 未着バッジ＋回収予定日、未着でない請求書 → 受領形態＋発行日（修正指示8・9）
  const selectedNotReceived =
    !!selected && isNotReceivableKind(selected.kind) && !!selected.notReceived;
  const selectedShowsInvoiceFields =
    !!selected && isInvoiceKind(selected.kind) && !selectedNotReceived;

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* 編集・削除できないステータスのときの案内 */}
      {!canEdit && (
        <div className="px-4 py-2 border-b border-gray-300 bg-gray-100 shrink-0 flex items-start gap-2">
          <AlertCircle
            className="h-4 w-4 shrink-0 text-gray-600 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-xs text-gray-800">{lockedReason}</p>
        </div>
      )}
      {orderedFiles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-gray-500">
            この支払回数には根拠資料が登録されていません
          </p>
        </div>
      ) : (
        <>
          {/* 選択中資料の情報行 */}
          <div className="px-4 py-2 border-b border-gray-300 shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="shrink-0 text-xs font-bold text-white bg-blue-700 px-2 py-0.5 rounded">
                {selected.kind}
              </span>
              {selectedNotReceived && (
                <span
                  className="shrink-0 text-xs font-bold text-white bg-red-600 px-2 py-0.5 rounded"
                  title="未着のため代替資料を登録しています"
                >
                  未着
                </span>
              )}
              {selected.afterSeal && (
                <span className="shrink-0 text-xs font-bold text-white bg-orange-700 px-2 py-0.5 rounded">
                  検印後
                </span>
              )}
              {/* 修正指示7: 編集モードでもファイル名は表示のみ（変更不可） */}
              <span
                className="min-w-0 flex-1 truncate text-sm text-gray-900"
                title={
                  editingSelected
                    ? `${selected.fileName}（ファイル名は変更できません）`
                    : selected.fileName
                }
              >
                {selected.fileName}
              </span>
              <span className="shrink-0 text-sm text-gray-500 whitespace-nowrap">
                {selectedIndex + 1} / {orderedFiles.length}
              </span>
            </div>
            {/* ファイル名直下の属性行（修正指示8・9、回答D-2・D-5）
                未着の請求書・覚書・契約書 … 回収予定日（編集時は発行日と同じカレンダーUI）
                未着でない請求書           … 受領形態・発行日（現行維持）
                未設定は「-」で表示 */}
            {selectedNotReceived && !editingSelected && (
              <div className="mt-0.5 mb-0.5">
                <span className="text-xs text-gray-600 whitespace-pre">
                  {`回収予定日:${FW_SPACE}${selected.collectionDate || '-'}`}
                </span>
              </div>
            )}
            {selectedNotReceived && editingSelected && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 mb-0.5">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="viewer-collection-date"
                    className="text-xs text-gray-600 whitespace-nowrap"
                  >
                    回収予定日
                  </label>
                  <DateMonthYearPicker
                    id="viewer-collection-date"
                    value={editingSelected.collectionDate ?? ''}
                    onChange={(v) =>
                      setEditing((p) => (p ? { ...p, collectionDate: v } : p))
                    }
                    clearable
                  />
                </div>
              </div>
            )}
            {selectedShowsInvoiceFields && !editingSelected && (
              <div className="mt-0.5 mb-0.5">
                <span className="text-xs text-gray-600 whitespace-pre">
                  {`受領形態:${FW_SPACE}${selected.receiptFormat ?? '電子'}${FW_SPACE}${FW_SPACE}${FW_SPACE}発行日:${FW_SPACE}${selected.issueDate || '2026/08/09'}`}
                </span>
              </div>
            )}
            {selectedShowsInvoiceFields && editingSelected && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 mb-0.5">
                <div className="flex items-center gap-2">
                  <span
                    id="viewer-receipt-format-label"
                    className="text-xs text-gray-600 whitespace-nowrap"
                  >
                    受領形態
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="viewer-receipt-format-label"
                    className="flex items-center gap-2"
                  >
                    {(['紙', '電子', '紙と電子'] as const).map((f) => (
                      <label
                        key={f}
                        className="flex cursor-pointer items-center gap-1 text-xs whitespace-nowrap"
                      >
                        <input
                          type="radio"
                          name={`viewer-receipt-format-${editing?.id}`}
                          value={f}
                          checked={editingSelected.receiptFormat === f}
                          onChange={() =>
                            setEditing((p) =>
                              p ? { ...p, receiptFormat: f } : p
                            )
                          }
                          className="h-3 w-3 accent-blue-600"
                        />
                        {f}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="viewer-issue-date"
                    className="text-xs text-gray-600 whitespace-nowrap"
                  >
                    発行日
                  </label>
                  <DateMonthYearPicker
                    id="viewer-issue-date"
                    value={editingSelected.issueDate ?? ''}
                    onChange={(v) =>
                      setEditing((p) => (p ? { ...p, issueDate: v } : p))
                    }
                    clearable
                  />
                </div>
              </div>
            )}
            {/* D6: プレビューがPDF変換後の内容であることの注記 */}
            {showsConvertedPdf && (
              <p className="mt-1 flex items-start gap-1 text-xs text-gray-500">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                プレビューはPDF変換後の内容です。原本と体裁が異なる場合があります。
              </p>
            )}
            {/* 備考 */}
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
              <StickyNote
                className="mt-0.5 h-4 w-4 shrink-0 text-gray-500"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-gray-500">備考</span>
                {editingSelected ? (
                  <textarea
                    value={editingSelected.memo}
                    onChange={(e) =>
                      setEditing((p) =>
                        p ? { ...p, memo: e.target.value } : p
                      )
                    }
                    rows={2}
                    maxLength={200}
                    placeholder="例）請求金額が見積と異なるため、差額の内訳を別紙で添付"
                    className="mt-0.5 w-full resize-y rounded-md border border-blue-400 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    aria-label="備考"
                  />
                ) : (
                  <p
                    className={`text-xs whitespace-pre-wrap break-words ${selected.memo ? 'text-gray-800' : 'text-gray-600'}`}
                  >
                    {selected.memo || '（未入力）'}
                  </p>
                )}
              </div>
            </div>
            {/* 修正指示10（回答D-3）: 登録日・タイムスタンプ＋操作ボタンの行は備考欄の直下に置く */}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  登録日:　{selected.updatedAt}
                </span>

                {selected.timestampStatus === '付与済' ? (
                  <span className="flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    タイムスタンプ {selected.timestampedAt}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                    <Clock
                      className="h-4 w-4 animate-pulse"
                      aria-hidden="true"
                    />
                    タイムスタンプ 付与待ち
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1 [&>button]:h-8">
                {editingSelected ? (
                  <>
                    <button
                      type="button"
                      className="btn-toolbar-outline disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={handleEditCommit}
                      aria-label="変更を確定"
                      title="変更を確定する"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      確定
                    </button>
                    <button
                      type="button"
                      className="btn-toolbar-outline disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        handleEditCancel();
                      }}
                      aria-label="編集をやめる"
                      title="編集をやめる"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <>
                    {/* D4: PDFプレビューはブラウザ内蔵ビューア表示のため回転できない */}
                    <button
                      type="button"
                      className="btn-toolbar-outline disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setRotation((r) => r - 90)}
                      disabled={!!selectedPdfUrl}
                      aria-label="左に回転"
                      title={
                        selectedPdfUrl
                          ? 'PDFプレビューでは回転できません'
                          : '左に回転'
                      }
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn-toolbar-outline disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setRotation((r) => r + 90)}
                      disabled={!!selectedPdfUrl}
                      aria-label="右に回転"
                      title={
                        selectedPdfUrl
                          ? 'PDFプレビューでは回転できません'
                          : '右に回転'
                      }
                    >
                      <RotateCw className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {/* D5: ダウンロードは常に原本 */}
                    <button
                      type="button"
                      className="btn-toolbar-outline disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleDownload(selected)}
                      disabled={!canDownload || isMockDownloading}
                      aria-label="原本をダウンロード"
                      title={
                        canDownloadOriginal
                          ? '原本をダウンロードする'
                          : canDownloadMock
                            ? 'モックのため、表示内容から生成したファイルをダウンロードします'
                            : 'この形式はモックではダウンロードできません'
                      }
                    >
                      {isMockDownloading ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Download className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn-toolbar-outline disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleEditStart(selected)}
                      disabled={!canEditSelected}
                      aria-label="備考等を編集"
                      title={
                        !canEdit
                          ? lockedReason
                          : selected?.afterSeal
                            ? '検印後の根拠資料は編集できません'
                            : '備考・受領形態・発行日を編集する（ファイル名は変更できません）'
                      }
                    >
                      <SquarePen className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`btn-toolbar-outline disabled:cursor-not-allowed disabled:opacity-50 ${canEdit ? 'text-red-700' : ''}`}
                      onClick={() => setDeleteTarget(selected)}
                      aria-label="削除"
                      disabled={!canEditSelected}
                      title={
                        !canEdit
                          ? lockedReason
                          : selected?.afterSeal
                            ? '検印後の根拠資料は削除できません'
                            : 'この資料を削除する'
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {/* 修正指示6: 登録済み根拠資料の一括ダウンロード（ボタン行の右端）。編集中は非表示＝非活性 */}
                    <button
                      type="button"
                      className="btn-toolbar-outline disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={handleDownloadAll}
                      disabled={orderedFiles.length === 0}
                      aria-label="一括ダウンロード"
                      title="登録済みの根拠資料をまとめてダウンロードする"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      一括
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 大プレビュー */}
          <div className="relative flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4">
            {/* 資料送りボタン。拡大表示中は拡大表示側の＜＞を使うため、
                ここには出さない（同じボタンが2組見えて誤操作の原因になる）。 */}
            {zoomPage === null && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={isFirst}
                  className="sticky left-2 top-1/2 z-10 float-left flex h-9 w-9 items-center justify-center rounded-full bg-white/90 border border-gray-300 shadow-md text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="前の資料"
                  title="前の資料"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isLast}
                  className="sticky right-2 top-1/2 z-10 float-right flex h-9 w-9 items-center justify-center rounded-full bg-white/90 border border-gray-300 shadow-md text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="次の資料"
                  title="次の資料"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            )}

            {/* D4: 変換後PDF → PDF原本 → 画像 → 既存 pageUrls → 非対応 の順で表示 */}
            {selectedPdfUrl ? (
              <div className="h-full w-full">
                <PdfPreview
                  src={selectedPdfUrl}
                  fileName={selected.fileName}
                  className="border border-gray-300 bg-white shadow-md"
                />
              </div>
            ) : selected.convertStatus === 'converting' ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2
                  className="h-8 w-8 animate-spin text-blue-600"
                  aria-hidden="true"
                />
                <p className="text-sm">PDF変換中…</p>
              </div>
            ) : pageUrls.length > 0 ? (
              <div className="flex flex-col items-center gap-4 h-full">
                {pageUrls.map((url, i) => (
                  <div
                    key={i}
                    className="relative flex flex-col items-center max-h-full"
                  >
                    <button
                      type="button"
                      onClick={() => setZoomPage(i)}
                      className="max-h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label={`${selected.fileName} ${i + 1}ページ目を拡大表示`}
                      title="クリックで拡大"
                    >
                      {/* 規約例外（可変サイズの画像）：大きさが画像ごとに違うため width／height は付けず、枠の大きさを CSS で決める */}
                      <img
                        loading="lazy"
                        src={url}
                        alt={`${selected.fileName} ${i + 1}ページ目`}
                        className="max-w-full max-h-full object-contain shadow-md bg-white transition-transform"
                        // 回転角は操作に応じて JS で決まる（inline style 例外：JS動的計算値）
                        style={{
                          transform: `rotate(${rotation}deg)`,
                        }}
                      />
                    </button>
                    {pageUrls.length > 1 && (
                      <span className="mt-1 text-xs text-gray-600">
                        {i + 1} / {pageUrls.length} ページ
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-500">
                <Icon className="h-16 w-16" aria-hidden="true" />
                <p className="text-sm text-center">
                  プレビュー非対応。
                  <br />
                  原本をダウンロードして確認してください。
                </p>
                <button
                  type="button"
                  className="btn-toolbar-outline disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleDownload(selected)}
                  disabled={!canDownload || isMockDownloading}
                  aria-label="原本をダウンロード"
                  title={
                    canDownloadOriginal
                      ? '原本をダウンロードする'
                      : canDownloadMock
                        ? 'モックのため、表示内容から生成したファイルをダウンロードします'
                        : 'この形式はモックではダウンロードできません'
                  }
                >
                  {isMockDownloading ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                  原本をダウンロード
                </button>
                {canDownloadMock && (
                  <p className="text-xs text-gray-400">
                    モックのため、表示内容から生成したファイルを渡します
                  </p>
                )}
              </div>
            )}
          </div>

          {/* フィルムストリップ */}
          <div className="border-t border-gray-300 bg-white shrink-0">
            <div className="flex items-center gap-1 px-2 py-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={isFirst}
                className="shrink-0 flex h-8 w-6 items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="前へ"
                title="前へ"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <div ref={stripRef} className="flex-1 flex gap-2 overflow-hidden">
                {orderedFiles.map((file, index) => {
                  const ThumbIcon = iconForFile(file.fileName);
                  const isActiveThumb = index === selectedIndex;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => handleSelect(index)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoverInfo({
                          x: rect.left + rect.width / 2,
                          y: rect.top - 4,
                          text: `${file.no}. ${file.kind}\n${file.fileName}`,
                        });
                      }}
                      onMouseLeave={() => setHoverInfo(null)}
                      className={`relative shrink-0 w-18 rounded border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isActiveThumb
                          ? 'border-blue-700'
                          : 'border-gray-300 hover:border-blue-400'
                      }`}
                      aria-label={`${file.no}. ${file.kind} ${file.fileName}`}
                      aria-current={isActiveThumb}
                    >
                      {/* 規約例外（重ね表示）：サムネイルに重ねる番号のため、行間を詰める（leading-none） */}
                      <span className="absolute left-0 top-0 z-10 text-xs leading-none font-bold text-white bg-gray-700 px-1 py-0.5 rounded-br">
                        {file.no}
                      </span>
                      {file.afterSeal && (
                        // 規約例外（重ね表示）：サムネイルに重ねる「印」のバッジのため、行間を詰める（leading-none）
                        <span className="absolute right-0 top-0 z-10 text-xs leading-none font-bold text-white bg-orange-700 px-1 py-0.5 rounded-bl">
                          印
                        </span>
                      )}
                      <div className="h-15 flex items-center justify-center bg-gray-100 overflow-hidden">
                        {file.thumbnailUrl ? (
                          // 規約例外（可変サイズの画像）：大きさが画像ごとに違うため width／height は付けず、枠の大きさを CSS で決める
                          <img
                            src={file.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ThumbIcon
                            className="h-6 w-6 text-gray-400"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      {file.timestampStatus === '待ち' && (
                        <span
                          className="absolute bottom-[1.1rem] left-0 z-10 flex items-center rounded-tr bg-gray-700/85 px-1 py-0.5 text-white"
                          title="タイムスタンプ付与待ち"
                        >
                          {/* 規約例外（重ね表示）：サムネイルに重ねる小さいバッジの中のアイコンのため w-3 h-3 */}
                          <Clock
                            className="h-3 w-3 animate-pulse"
                            aria-hidden="true"
                          />
                        </span>
                      )}
                      {/* 規約例外（重ね表示）：サムネイルの枠の中の小さい種類名のため、行間を詰める（leading-tight） */}
                      <div className="px-1 py-0.5 text-xs leading-tight text-gray-700 truncate">
                        {file.kind}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleNext}
                disabled={isLast}
                className="shrink-0 flex h-8 w-6 items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="次へ"
                title="次へ"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          {/* 高速ツールチップ — transform 親の影響を受けないよう body に portal レンダリング */}
          {hoverInfo &&
            createPortal(
              <div
                className="fixed z-70 pointer-events-none -translate-x-1/2 -translate-y-full rounded bg-gray-900 px-2 py-1.5 text-xs text-white shadow-lg"
                // 表示位置はホバーしたサムネの座標から JS で算出する（inline style 例外：JS動的計算値）
                style={{ left: hoverInfo.x, top: hoverInfo.y }}
              >
                {hoverInfo.text.split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>,
              document.body
            )}
        </>
      )}
      {/* 拡大表示（ライトボックス）。変換後PDF・PDF原本のときは PDF を全画面表示する */}
      {zoomPage !== null && (selectedPdfUrl || pageUrls[zoomPage]) && (
        <div
          className="absolute inset-0 z-60 bg-black/80 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.fileName} の拡大表示`}
          ref={zoomLayerRef}
          onClick={() => setZoomPage(null)}
        >
          {/* 上部コントロールバー */}
          <div
            className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-4 py-2 ${
              selectedPdfUrl
                ? 'bg-black/85'
                : 'bg-gradient-to-b from-black/70 to-transparent'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="min-w-0 flex-1 truncate text-sm text-white">
              {selected.fileName}
              {!selectedPdfUrl &&
                pageUrls.length > 1 &&
                `${FW_SPACE}${zoomPage + 1} / ${pageUrls.length} ページ`}
              {!selectedPdfUrl &&
                zoomScale > 1 &&
                `${FW_SPACE}（${Math.round(zoomScale * 100)}%）`}
            </span>
            {/* 拡大縮小は画像のときだけ。PDFはブラウザ内蔵ビューア側で操作する */}
            {!selectedPdfUrl && (
              <>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-md hover:bg-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() =>
                    setZoomScale((z) => Math.max(fitScale, z - 0.25))
                  }
                  disabled={zoomScale <= fitScale}
                  aria-label="縮小"
                  title="縮小"
                >
                  <ZoomOut className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-md hover:bg-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => setZoomScale((z) => Math.min(5, z + 0.25))}
                  disabled={zoomScale >= 5}
                  aria-label="拡大"
                  title="拡大"
                >
                  <ZoomIn className="h-4 w-4" aria-hidden="true" />
                </button>
              </>
            )}
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-md hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => setZoomPage(null)}
              aria-label="閉じる"
              title="閉じる（ESC）"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* ファイル遷移ボタン ＜ 前の資料 */}
          {orderedFiles.length > 1 && (
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomImgReady(false);
                handlePrev();
                setZoomPage(0);
                setPanOffset({ x: 0, y: 0 });
              }}
              disabled={isFirst}
              aria-label="前の資料"
              title="前の資料（←）"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
          {/* ファイル遷移ボタン ＞ 次の資料 */}
          {orderedFiles.length > 1 && (
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomImgReady(false);
                handleNext();
                setZoomPage(0);
                setPanOffset({ x: 0, y: 0 });
              }}
              disabled={isLast}
              aria-label="次の資料"
              title="次の資料（→）"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          )}

          {/* ページ遷移ボタン ＾ 前ページ（上部中央）。PDFはビューア内でスクロールする */}
          {!selectedPdfUrl && pageUrls.length > 1 && (
            <button
              type="button"
              className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomImgReady(false);
                setZoomPage((n) => Math.max(0, (n ?? 0) - 1));
                setPanOffset({ x: 0, y: 0 });
              }}
              disabled={zoomPage <= 0}
              aria-label="前のページ"
              title="前のページ（↑）"
            >
              <ChevronUp className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {/* ページ番号ラベル + ﹀ 次ページ（下部中央、ラベルは﹀の直上） */}
          {!selectedPdfUrl && pageUrls.length > 1 && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoomImgReady(false);
                  setZoomPage((n) =>
                    Math.min(pageUrls.length - 1, (n ?? 0) + 1)
                  );
                  setPanOffset({ x: 0, y: 0 });
                }}
                disabled={zoomPage >= pageUrls.length - 1}
                aria-label="次のページ"
                title="次のページ（↓）"
              >
                <ChevronDown className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* PDF エリア：ブラウザ内蔵ビューアで全画面表示 */}
          {selectedPdfUrl && (
            <div
              className="absolute inset-0 px-4 pt-14 pb-4"
              onClick={(e) => e.stopPropagation()}
            >
              <PdfPreview
                src={selectedPdfUrl}
                fileName={selected.fileName}
                className="bg-white shadow-2xl"
              />
            </div>
          )}

          {/* 画像エリア：中央配置でパン操作 */}
          {!selectedPdfUrl && (
            <div
              className={`absolute inset-0 pt-12 overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
              onClick={() => setZoomPage(null)}
            >
              {/* 規約例外（可変サイズの画像）：大きさが画像ごとに違うため width／height は付けず、枠の大きさを CSS で決める */}
              <img
                // 資料・ページごとに要素を作り直す（同じ画像URLの資料へ送っても読み込みイベントが拾える）
                key={`${selected.id}-${zoomPage}`}
                ref={zoomImgRef}
                loading="lazy"
                src={pageUrls[zoomPage]}
                alt={`${selected.fileName} ${zoomPage + 1}ページ目の拡大表示`}
                className={`absolute max-h-none max-w-none origin-center select-none bg-white shadow-2xl transition-opacity duration-100 ${isZoomImgReady ? 'opacity-100' : 'opacity-0'}`}
                // 位置・倍率・回転はパン／ズーム操作から JS で算出する（inline style 例外：JS動的計算値）
                style={{
                  top: `calc(50% + ${panOffset.y}px)`,
                  left: `calc(50% + ${panOffset.x}px)`,
                  transform: `translate(-50%, -50%) scale(${zoomScale}) rotate(${rotation}deg)`,
                }}
                draggable={false}
                onLoad={(e) => applyZoomImageFit(e.currentTarget)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => {
                  e.preventDefault();
                  panStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    ox: panOffset.x,
                    oy: panOffset.y,
                  };
                  setIsPanning(true);
                }}
              />
            </div>
          )}
        </div>
      )}
      {/* 削除確認ダイアログ（共通 ConfirmDialog）。本文のブロックは AlertDialogDescription（p 要素）内に置くため span で組む */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title="この根拠資料を削除します"
        description={
          deleteTarget && (
            <span className="flex flex-col gap-3">
              <span className="block text-sm text-gray-600">
                削除すると
                <span className="font-bold text-red-700">元に戻せません</span>
                。内容を確認のうえ削除してください。
              </span>
              <span className="block text-xs text-gray-500">
                支払明細書No. {paymentSlipNo}（{paymentRound}回目）
              </span>
              <span className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <FileText
                  className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-sm break-all text-gray-900">
                    {deleteTarget.fileName}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {deleteTarget.kind} / {deleteTarget.updatedAt} 登録
                  </span>
                </span>
              </span>
            </span>
          )
        }
        onConfirm={handleDeleteCommit}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="削除する"
        confirmClassName={BUTTON_STYLES.delete}
      />
    </div>
  );
}

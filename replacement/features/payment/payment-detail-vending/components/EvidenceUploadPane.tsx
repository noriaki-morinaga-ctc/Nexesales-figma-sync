// 支払根拠資料ペイン（根拠資料登録 ＋ 根拠資料表示 の統合ペイン）
// 支払詳細(自販機)の支払情報カードの「根拠資料格納」ボタンから開く右ペイン。
// タブ「根拠資料表示」（EvidenceViewerContent）と「根拠資料登録」（本ファイル）を切り替える。
//
// ※ ペインの外枠は共通 RightPane を使わず自前で持つ（Figma Make 版の挙動を維持するため）。
//   RightPane（Radix Sheet）は Esc でペイン自体を閉じるため、ペイン内の拡大表示・
//   インラインプレビューを Esc で閉じる操作と衝突する。また本ペインはヘッダー下からの表示・
//   縦書き付箋での折り畳み・画面幅いっぱいまでの拡張を持つ。
//   画面で1つだけ展開する排他（→ 02 §13.1）は共通フック useExclusivePane で担保する。
import {
  useState,
  useCallback,
  useEffect,
  useId,
  useRef,
  type Dispatch,
  type SetStateAction,
  type SyntheticEvent,
  type MouseEvent as ReactMouseEvent,
  type DragEvent as ReactDragEvent,
} from 'react';
import {
  X,
  Plus,
  Save,
  Upload,
  FileText,
  FileSpreadsheet,
  FileQuestion,
  MoveHorizontal,
  AlertCircle,
  StickyNote,
  ZoomIn,
  ZoomOut,
  Download,
  Loader2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { SingleCombobox } from '@/components/ui/single-combobox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useExclusivePane } from '@/components/ui/use-exclusive-pane';
import { SCREEN_TITLE_CLASS } from '@/styles/commonStyles';
import { PdfPreview } from './PdfPreview';
import { DateMonthYearPicker } from '@/components/ui/date-month-year-picker';
import {
  canPreviewEvidence,
  convertToPdf,
  downloadOriginal,
  getMockPreviewForReference,
  initialConvertStatus,
  isImageFileName,
  isPdfFileName,
  type ConvertStatus,
  type ConvertToPdfResult,
} from '@/features/payment/payment-detail-vending/utils';
import {
  EvidenceViewerContent,
  canEditEvidence,
  evidenceLockedReason,
  type PaymentStatus,
  type EvidenceUserRole,
  type EvidenceFile,
  type ReceiptFormat,
} from './EvidenceViewerPane';

// 全角スペース（テンプレートリテラル内の全角スペースは no-irregular-whitespace の対象になるため定数で埋め込む）
const FW_SPACE = '\u3000';

// 1枠ぶんの状態
export interface EvidenceSlot {
  fileName: string;
  updatedAt: string;
  uploaded: boolean;
  size?: number;
  // D1: プレビュー（PDF）とダウンロード（原本）を分ける
  //  slotId         … 非同期の変換結果を書き戻すための識別子
  //  originalUrl    … 原本（アップロードされたままのファイル）。DLはこれを渡す
  //  pdfPreviewUrl  … 変換後PDF（プレビュー専用）
  //  convertStatus  … 変換の状態
  slotId?: string;
  originalUrl?: string;
  pdfPreviewUrl?: string;
  convertStatus?: ConvertStatus;
  memo?: string;
  // 行ごとの属性（2026-09-08 修正指示1：全請求書共通 → 請求書ごと）
  //  notReceived    … 未着（請求書・覚書・契約書）。ONのとき選択したファイルは「代替」資料
  //  collectionDate … 回収予定日（未着のときのみ意味を持つ）
  //  receiptFormat  … 受領形態（請求書のみ）
  //  issueDate      … 発行日（請求書のみ）
  notReceived?: boolean;
  collectionDate?: string;
  receiptFormat?: ReceiptFormat;
  issueDate?: string;
}

// 各セクション（請求書・覚書・契約書・見積書・稟議書）の枠一覧の setState
type SlotSetter = Dispatch<SetStateAction<EvidenceSlot[]>>;

const emptySlot = (): EvidenceSlot => ({
  fileName: '',
  updatedAt: '',
  uploaded: false,
  memo: '',
  notReceived: false,
  collectionDate: '',
  issueDate: '',
});

const MAX_FILE_MB_STR = 'xx';
const MAX_FILE_MB = 100;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// D3: プレビュー可否は拡張子ではなく canPreviewEvidence()（変換後PDF or PDF・画像原本）で判定する。
// 旧 canPreview（Office拡張子を可としていた判定）は実挙動と合わないため廃止した。

// D1: スロットが持つ blob URL を解放する。
// pdfPreviewUrl はモックではバンドル同梱のサンプルPDF（blob URLではない）ため解放しない。
// 実装版でサーバー生成のURLに変わった場合も、解放要否の判断はここに集約する。
const revokeSlotUrls = (slot: EvidenceSlot) => {
  if (slot.originalUrl) URL.revokeObjectURL(slot.originalUrl);
};

const iconForFile = (fileName: string) => {
  if (/\.(xlsx?|xls)$/i.test(fileName)) return FileSpreadsheet;
  if (/\.pdf$/i.test(fileName)) return FileText;
  if (/\.(jpe?g|png|svg|gif|webp)$/i.test(fileName)) return FileText;
  return FileQuestion;
};

interface OtherDoc extends EvidenceSlot {
  id: string;
  kind: string;
}

const OTHER_DOC_MAX = 16;
// その他根拠資料の区分は固定（修正指示4）。表示タブの EVIDENCE_KINDS と同じ文言。
const OTHER_DOC_KIND = 'その他の資料';

export interface RegisteredEvidence {
  kind: string;
  fileName: string;
  memo?: string;
  // D1: 表示タブ（EvidenceFile）へ原本・変換後PDF・変換状態を引き継ぐ
  originalUrl?: string;
  pdfPreviewUrl?: string;
  convertStatus?: ConvertStatus;
  receiptFormat?: ReceiptFormat;
  issueDate?: string;
  // 未着（代替資料）とその回収予定日。請求書・覚書・契約書のみ
  notReceived?: boolean;
  collectionDate?: string;
}

// ─── SlotPreviewOverlay ────────────────────────────────────────────────────────
// 登録タブのインラインプレビュー。PDF=embed スクロール、画像=drag ズーム、その他=DL案内
interface SlotPreviewOverlayProps {
  slot: EvidenceSlot;
  onClose: () => void;
}

function SlotPreviewOverlay({ slot, onClose }: SlotPreviewOverlayProps) {
  const [zoomScale, setZoomScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // D4: 変換後PDF → PDF原本 → 画像原本 の順で表示する
  const pdfUrl =
    slot.pdfPreviewUrl ??
    (slot.originalUrl && isPdfFileName(slot.fileName)
      ? slot.originalUrl
      : undefined);
  const imageUrl =
    slot.originalUrl && isImageFileName(slot.fileName)
      ? slot.originalUrl
      : undefined;
  const fileIsImage = !!imageUrl;
  const fileIsPreviewable = !!pdfUrl || fileIsImage;
  const isConverting = slot.convertStatus === 'converting';
  // 変換後PDFを表示しているときだけ注記を出す（PDF原本・画像には当たらない）
  const showsConvertedPdf = !!slot.pdfPreviewUrl;

  const FileIcon = iconForFile(slot.fileName);

  // ESC で閉じる
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Ctrl+ホイールでズーム（画像のみ）
  useEffect(() => {
    if (!fileIsImage) return;
    const el = containerRef.current;
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
  }, [fileIsImage, fitScale]);

  // パン
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

  useEffect(() => {
    if (zoomScale <= fitScale) setPanOffset({ x: 0, y: 0 });
  }, [zoomScale, fitScale]);

  const handleImageLoad = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const c = containerRef.current;
    if (!c) return;
    const scale = Math.min(
      c.clientWidth / img.naturalWidth,
      c.clientHeight / img.naturalHeight,
      1
    );
    setFitScale(scale);
    setZoomScale(scale);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/90">
      {/* コントロールバー */}
      <div className="flex items-center gap-2 shrink-0 bg-gray-900 px-3 py-2">
        <FileIcon
          className="h-4 w-4 text-blue-400 shrink-0"
          aria-hidden="true"
        />
        <span
          className="min-w-0 flex-1 truncate text-sm font-bold text-white"
          title={slot.fileName}
        >
          {slot.fileName}
        </span>
        {fileIsImage && (
          <>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(fitScale, z - 0.25))}
              disabled={zoomScale <= fitScale}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-800 hover:bg-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="縮小"
              title="縮小"
            >
              <ZoomOut className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(5, z + 0.25))}
              disabled={zoomScale >= 5}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-800 hover:bg-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="拡大"
              title="拡大"
            >
              <ZoomIn className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
        {/* D5: プレビューがPDFでも、DLは常に原本を渡す */}
        {slot.originalUrl && (
          <button
            type="button"
            onClick={() => downloadOriginal(slot.originalUrl!, slot.fileName)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-800 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="原本をダウンロード"
            title="原本をダウンロード"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-800 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="閉じる（ESC）"
          title="閉じる（ESC）"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* プレビュー本体 */}
      <div
        ref={containerRef}
        className={`relative flex-1 overflow-hidden bg-gray-800 ${
          fileIsImage && isPanning
            ? 'cursor-grabbing'
            : fileIsImage
              ? 'cursor-grab'
              : ''
        }`}
        onClick={fileIsPreviewable ? undefined : onClose}
      >
        {pdfUrl ? (
          <PdfPreview src={pdfUrl} fileName={slot.fileName} />
        ) : imageUrl ? (
          // 画像：left-top アライン、drag でパン、Ctrl+ホイールでズーム
          // 規約例外（可変サイズの画像）：大きさが画像ごとに違うため width／height は付けず、枠の大きさを CSS で決める
          <img
            loading="lazy"
            src={imageUrl}
            alt={`${slot.fileName} のプレビュー`}
            className="absolute max-h-none max-w-none origin-top-left select-none bg-white shadow-md"
            // 位置・倍率はパン／ズーム操作から JS で算出する（inline style 例外：JS動的計算値）
            style={{
              top: panOffset.y,
              left: panOffset.x,
              transform: `scale(${zoomScale})`,
            }}
            draggable={false}
            onLoad={handleImageLoad}
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
        ) : isConverting ? (
          // D4: 変換中
          <div
            className="flex h-full flex-col items-center justify-center gap-3 text-gray-300"
            onClick={onClose}
          >
            <Loader2
              className="h-8 w-8 animate-spin text-blue-400"
              aria-hidden="true"
            />
            <p className="text-sm">PDF変換中…</p>
          </div>
        ) : (
          // D4: 変換不可（プレビュー非対応）。D5: DLは原本を渡す
          <div
            className="flex h-full flex-col items-center justify-center gap-3 text-gray-400"
            onClick={onClose}
          >
            <FileQuestion className="h-8 w-8" aria-hidden="true" />
            <p className="text-sm text-center">
              プレビュー非対応。
              <br />
              原本をダウンロードして確認してください。
            </p>
            {slot.originalUrl && (
              <a
                href={slot.originalUrl}
                download={slot.fileName}
                className="flex items-center gap-1.5 rounded-lg border border-gray-500 px-3 py-1.5 text-xs text-gray-300 hover:border-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                原本をダウンロード
              </a>
            )}
          </div>
        )}
      </div>
      <p className="shrink-0 bg-gray-900 px-3 py-1 text-center text-xs text-gray-400">
        {/* D6: 変換PDFを見せているときは体裁が原本と異なりうることを明示する */}
        {showsConvertedPdf &&
          'プレビューはPDF変換後の内容です。原本と体裁が異なる場合があります。　'}
        ESC で閉じる
        {fileIsImage &&
          zoomScale > fitScale &&
          `${FW_SPACE}（${Math.round(zoomScale * 100)}%）`}
      </p>
    </div>
  );
}

// ─── FileDropField ─────────────────────────────────────────────────────────────
interface FileDropFieldProps {
  slot: EvidenceSlot;
  disabled: boolean;
  onPickMultiple: (files: File[]) => void;
  onClear: () => void;
  onPreview?: (slot: EvidenceSlot) => void;
  // 未着ONの行で渡す「代替請求書」など。未選択時は案内文、選択後はチップとして出す（修正指示2、回答A-1）
  altLabel?: string;
}

function FileDropField({
  slot,
  disabled,
  onPickMultiple,
  onClear,
  onPreview,
  altLabel,
}: FileDropFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [rejected, setRejected] = useState('');

  const filterFiles = (files: File[]): { ok: File[]; rejected: string[] } => {
    const ok: File[] = [];
    const rej: string[] = [];
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        rej.push(
          `${f.name}：${formatSize(f.size)} は上限（${MAX_FILE_MB}MB）を超えています`
        );
      } else {
        ok.push(f);
      }
    }
    return { ok, rejected: rej };
  };

  const handleDrop = (e: ReactDragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files ?? []) as File[];
    if (files.length === 0) return;
    const { ok, rejected: rej } = filterFiles(files);
    if (rej.length > 0) setRejected(rej[0]);
    else setRejected('');
    if (ok.length > 0) onPickMultiple(ok);
  };

  // D3: プレビュー可否は「変換後PDFがある」または「PDF・画像の原本がある」で判定する。
  // Office系は変換が終わるまでプレビュー不可（＝リンクも非活性）になる。
  const previewable = canPreviewEvidence(slot);
  const FileIcon = iconForFile(slot.fileName);
  const isConverting = slot.convertStatus === 'converting';
  const previewTitle = previewable
    ? 'クリックしてプレビュー'
    : isConverting
      ? 'PDF変換中です'
      : 'プレビュー非対応（原本をダウンロードして確認してください）';

  return (
    <div>
      <div
        className={`rounded-lg border-2 border-dashed px-3 py-2 text-center transition-colors ${
          disabled
            ? 'border-gray-200 bg-gray-100'
            : isDragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []) as File[];
            const { ok, rejected: rej } = filterFiles(files);
            if (rej.length > 0) setRejected(rej[0]);
            else setRejected('');
            if (ok.length > 0) onPickMultiple(ok);
            e.target.value = '';
          }}
        />
        {slot.fileName ? (
          <div className="flex items-center gap-2">
            {altLabel && (
              <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 text-xs font-bold text-orange-700">
                {altLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (previewable) onPreview?.(slot);
              }}
              disabled={!previewable}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-default"
              title={previewTitle}
            >
              <FileIcon
                className={`h-4 w-4 shrink-0 ${previewable ? 'text-blue-600' : 'text-gray-500'}`}
                aria-hidden="true"
              />
              <span
                className={`min-w-0 truncate text-sm ${previewable ? 'text-blue-600 hover:underline' : 'text-gray-700'}`}
              >
                {slot.fileName}
              </span>
              {slot.size !== undefined && (
                <span className="shrink-0 text-xs text-gray-500">
                  {formatSize(slot.size)}
                </span>
              )}
              {/* D4: 変換ステータス */}
              {isConverting && (
                <span className="flex shrink-0 items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  変換中
                </span>
              )}
              {slot.convertStatus === 'failed' && (
                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                  プレビュー非対応
                </span>
              )}
            </button>
            {/* D5: プレビューの可否によらず、原本はいつでもダウンロードできる */}
            {slot.originalUrl && (
              <button
                type="button"
                onClick={() =>
                  downloadOriginal(slot.originalUrl!, slot.fileName)
                }
                className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="原本をダウンロード"
                title="原本をダウンロード"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="選択を取り消す"
              title="選択を取り消す"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-1">
            {altLabel && (
              <span className="text-sm font-bold text-orange-700">
                {altLabel}を選択
              </span>
            )}
            <div className="flex items-center justify-center gap-2">
              <Upload
                className="h-4 w-4 shrink-0 text-gray-400"
                aria-hidden="true"
              />
              <span className="text-sm text-gray-600">
                ドラッグ＆ドロップ、または
              </span>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                className="btn-toolbar-outline disabled:cursor-not-allowed disabled:opacity-50"
              >
                参照
              </button>
            </div>
            <span className="text-xs text-gray-500">
              複数ファイル選択可 / 1件 {MAX_FILE_MB_STR}MB まで
            </span>
          </div>
        )}
      </div>
      {rejected && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {rejected}
        </p>
      )}
    </div>
  );
}

// ─── MemoField ─────────────────────────────────────────────────────────────────
// 備考（添付理由・補足）の入力欄。各セクションの行・その他根拠資料の欄で共用する。
const MEMO_MAX_LENGTH = 200;

interface MemoFieldProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

function MemoField({ value, onChange, disabled }: MemoFieldProps) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 flex items-center gap-1 text-xs text-gray-600"
      >
        <StickyNote className="h-4 w-4 shrink-0" aria-hidden="true" />
        備考（添付理由・補足）
      </label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        maxLength={MEMO_MAX_LENGTH}
        placeholder="例）請求金額が見積と異なるため、差額の内訳を別紙で添付"
        className="min-h-0 resize-y border-gray-400 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
      />
      <p className="mt-0.5 text-right text-xs text-gray-400">
        {value.length} / {MEMO_MAX_LENGTH}
      </p>
    </div>
  );
}

// ─── SlotRowWithMemo ────────────────────────────────────────────────────────────
// 1枠（1資料）ぶんの行。fields を指定すると行ごとの属性入力を出す（2026-09-08 修正指示1・3）。
//  "invoice"       … 未着＋回収予定日 ／ 受領形態＋発行日（請求書）
//  "notReceivable" … 未着＋回収予定日 のみ（覚書・契約書）
// 未着・受領形態・発行日はファイル未選択でも常時表示する（回答A-2・A-4）。
// 未着ONのとき、その行で選ぶファイルは「代替○○」（回答A-1）。
export type SlotFields = 'invoice' | 'notReceivable';
export type SlotFieldPatch = Partial<
  Pick<
    EvidenceSlot,
    'notReceived' | 'collectionDate' | 'receiptFormat' | 'issueDate'
  >
>;
const RECEIPT_FORMATS: readonly ReceiptFormat[] = ['紙', '電子', '紙と電子'];

interface SlotRowWithMemoProps {
  slot: EvidenceSlot;
  disabled?: boolean;
  onPickMultiple: (files: File[]) => void;
  onClear: () => void;
  onMemoChange: (val: string) => void;
  onPreview?: (slot: EvidenceSlot) => void;
  fields?: SlotFields;
  onFieldChange?: (patch: SlotFieldPatch) => void;
  // 「請求書 1」など行の見出し。登録時エラーの「請求書1：…」と番号を揃える
  rowLabel?: string;
  // 未着ON時にファイル欄へ出す案内（「代替請求書」など）
  altLabel?: string;
  // 受領形態ラジオの name。行ごとに一意でないと他行の選択を奪うため必須
  radioName?: string;
}

function SlotRowWithMemo({
  slot,
  onPickMultiple,
  onClear,
  onMemoChange,
  onPreview,
  disabled = false,
  fields,
  onFieldChange,
  rowLabel,
  altLabel,
  radioName,
}: SlotRowWithMemoProps) {
  const notReceived = !!slot.notReceived;
  // 行ごとに一意な id（ラベルの htmlFor と入力欄の対応付け用）
  const uid = useId();
  const notReceivedId = `${uid}-not-received`;
  const collectionDateId = `${uid}-collection-date`;
  const issueDateId = `${uid}-issue-date`;
  const receiptFormatLabelId = `${uid}-receipt-format`;
  const body = (
    <div className="flex flex-col gap-2">
      {fields && (
        <div className="flex flex-col gap-1.5">
          {rowLabel && (
            <span className="text-xs font-bold text-gray-700">{rowLabel}</span>
          )}
          {/* 未着＋回収予定日 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-1.5">
              <Checkbox
                id={notReceivedId}
                checked={notReceived}
                onCheckedChange={(checked) =>
                  onFieldChange?.(
                    checked === true
                      ? {
                          notReceived: true,
                          receiptFormat: undefined,
                          issueDate: '',
                        }
                      : {
                          notReceived: false,
                          collectionDate: '',
                        }
                  )
                }
                disabled={disabled}
                className="border-gray-400"
              />
              <label
                htmlFor={notReceivedId}
                className={`text-sm whitespace-nowrap ${disabled ? '' : 'cursor-pointer'}`}
              >
                未着
              </label>
            </div>
            {notReceived && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor={collectionDateId}
                  className="text-sm whitespace-nowrap"
                >
                  回収予定日
                </label>
                <DateMonthYearPicker
                  id={collectionDateId}
                  value={slot.collectionDate ?? ''}
                  onChange={(v) => onFieldChange?.({ collectionDate: v })}
                  disabled={disabled}
                  clearable
                />
              </div>
            )}
          </div>
          {/* 受領形態＋発行日（発行日は受領形態と同一行の右側：修正指示1） */}
          {fields === 'invoice' && !notReceived && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <span
                  id={receiptFormatLabelId}
                  className="text-sm text-gray-600 whitespace-nowrap"
                >
                  受領形態
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby={receiptFormatLabelId}
                  className="flex items-center gap-3"
                >
                  {RECEIPT_FORMATS.map((f) => (
                    <label
                      key={f}
                      className={`flex items-center gap-1.5 text-sm whitespace-nowrap ${
                        disabled ? '' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name={radioName}
                        value={f}
                        checked={slot.receiptFormat === f}
                        onChange={() => onFieldChange?.({ receiptFormat: f })}
                        disabled={disabled}
                        className="h-4 w-4 accent-blue-600"
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor={issueDateId}
                  className="text-sm text-gray-600 whitespace-nowrap"
                >
                  発行日
                </label>
                <DateMonthYearPicker
                  id={issueDateId}
                  value={slot.issueDate ?? ''}
                  onChange={(v) => onFieldChange?.({ issueDate: v })}
                  disabled={disabled}
                  clearable
                />
              </div>
            </div>
          )}
        </div>
      )}
      <FileDropField
        slot={slot}
        disabled={disabled}
        onPickMultiple={onPickMultiple}
        onClear={onClear}
        onPreview={onPreview}
        altLabel={notReceived ? altLabel : undefined}
      />
      {slot.fileName && (
        <MemoField
          value={slot.memo ?? ''}
          onChange={onMemoChange}
          disabled={disabled}
        />
      )}
    </div>
  );
  // 属性入力を持つ行は枠で囲い、行の境目（どの請求書の未着か）を分かりやすくする
  return fields ? (
    <div className="rounded-lg border border-gray-200 p-3">{body}</div>
  ) : (
    body
  );
}

// ─── MultiSlotSection ──────────────────────────────────────────────────────────
// ファイル未選択の枠を優先して使い、未選択の枠は常に最大1つ（枠が全て埋まったら追加ボタンを出す）。
interface MultiSlotSectionProps {
  slots: EvidenceSlot[];
  disabled: boolean;
  addLabel: string;
  onPickAt: (index: number, file: File) => void;
  onClearAt: (index: number) => void;
  onMemoChangeAt: (index: number, val: string) => void;
  onAddSlots: (files: File[]) => void;
  onPreview?: (slot: EvidenceSlot) => void;
  onAddSlot: () => void;
  fields?: SlotFields;
  onFieldChangeAt?: (index: number, patch: SlotFieldPatch) => void;
  rowLabelPrefix?: string;
  altLabel?: string;
  radioNamePrefix?: string;
}

function MultiSlotSection({
  slots,
  disabled,
  addLabel,
  onPickAt,
  onClearAt,
  onMemoChangeAt,
  onAddSlots,
  onPreview,
  onAddSlot,
  fields,
  onFieldChangeAt,
  rowLabelPrefix,
  altLabel,
  radioNamePrefix,
}: MultiSlotSectionProps) {
  const hasEmpty = slots.some((s) => s.fileName === '');
  const showAdd = !hasEmpty;

  const handlePickMultiple = (slotIndex: number) => (files: File[]) => {
    if (files.length === 0) return;
    onPickAt(slotIndex, files[0]);
    if (files.length > 1) onAddSlots(files.slice(1));
  };

  return (
    <div className="flex flex-col gap-2">
      {slots.map((slot, i) => (
        <SlotRowWithMemo
          key={i}
          slot={slot}
          disabled={disabled}
          onPickMultiple={handlePickMultiple(i)}
          onClear={() => onClearAt(i)}
          onMemoChange={(val) => onMemoChangeAt(i, val)}
          onPreview={onPreview}
          fields={fields}
          onFieldChange={
            onFieldChangeAt ? (patch) => onFieldChangeAt(i, patch) : undefined
          }
          rowLabel={rowLabelPrefix ? `${rowLabelPrefix} ${i + 1}` : undefined}
          altLabel={altLabel}
          radioName={radioNamePrefix ? `${radioNamePrefix}-${i}` : undefined}
        />
      ))}
      {showAdd && (
        <button
          type="button"
          onClick={onAddSlot}
          className="btn-toolbar-outline self-start"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {addLabel}
        </button>
      )}
    </div>
  );
}

interface AddButtonProps {
  onClick: () => void;
  label: string;
}

function AddButton({ onClick, label }: AddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-toolbar-outline self-start"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

// ペインのタブ（左：表示、右：登録）
export const EVIDENCE_TABS = ['表示', '登録'] as const;
export type EvidenceTab = (typeof EVIDENCE_TABS)[number];

// ─── Props ────────────────────────────────────────────────────────────────────
interface EvidenceUploadPaneProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openNonce?: number;
  paymentSlipNo: string;
  paymentRound: number;
  onRegister?: (registered: RegisteredEvidence[], summary: string) => void;
  evidenceFiles?: EvidenceFile[];
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
  status?: PaymentStatus;
  role?: EvidenceUserRole;
  // 開いたときに表示するタブ。デフォルト「表示」
  defaultTab?: EvidenceTab;
}

// 流用候補（固定リスト）
const REFERENCE_OPTIONS = [
  { label: '2025年4月　支払回数：1', value: '2025_4_1' },
  { label: '2025年4月　支払回数：2', value: '2025_4_2' },
];

// 流用対象根拠資料のモックデータ（支払回数 → ファイル一覧）
interface ReferenceFileSummary {
  kind: string;
  fileName: string;
  updatedAt: string;
}

const REFERENCE_FILES_MOCK: Record<string, ReferenceFileSummary[]> = {
  // 流用対象は 覚書・契約書・見積書・稟議書・その他資料（回答B-4）。請求書は毎月届くため対象外。
  '2025_4_1': [
    {
      kind: '覚書・契約書',
      fileName: '覚書_ロケ契約_サンプルベンディング東_2025年度.pdf',
      updatedAt: '2025/04/10',
    },
    {
      kind: '見積書',
      fileName: '見積書_ロケ運転費_サンプルベンディング東_202504.pdf',
      updatedAt: '2025/04/10',
    },
    {
      kind: 'その他の資料',
      fileName: 'ロケ運転費台帳_202504.xlsx',
      updatedAt: '2025/04/11',
    },
  ],
  '2025_4_2': [
    {
      kind: '見積書',
      fileName: '見積書_ロケ契約_サンプルベンディング東_202504.pdf',
      updatedAt: '2025/04/12',
    },
    {
      kind: '稟議書',
      fileName: '稟議書_ロケ契約_RG-2025-0713.pdf',
      updatedAt: '2025/04/12',
    },
  ],
};

// ─── EvidenceUploadPane ───────────────────────────────────────────────────────
export function EvidenceUploadPane({
  open,
  onOpenChange,
  openNonce = 0,
  paymentSlipNo,
  paymentRound,
  onRegister,
  evidenceFiles = [],
  onUpdateFile,
  onDeleteFile,
  onTimestamped,
  status = '未申請',
  role = '担当者',
  defaultTab = '表示',
}: EvidenceUploadPaneProps) {
  const canRegister = canEditEvidence(status, role);
  const lockedReason = evidenceLockedReason(status, '登録');

  // ===== タブ =====
  const [activeTab, setActiveTab] = useState<EvidenceTab>(defaultTab);
  const [viewerResetNonce, setViewerResetNonce] = useState(0);

  // ===== ペインシェル =====
  const [isCollapsed, setIsCollapsed] = useState(false);
  const PANE_MIN_REM = 28;
  const [paneWidthRem, setPaneWidthRem] = useState(36);
  const resizeRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);
  // ハンドルを「ドラッグしたか」の判定用。しきい値を超えたらクリック扱いにしない。
  const dragMovedRef = useRef(false);
  const DRAG_THRESHOLD_PX = 3;
  const handleResizeMove = useCallback((e: MouseEvent) => {
    const st = resizeRef.current;
    if (!st) return;
    const deltaPx = st.startX - e.clientX;
    if (Math.abs(deltaPx) > DRAG_THRESHOLD_PX) dragMovedRef.current = true;
    // 1rem = 12.8px（画面全体を 80% にしている → 01「ルートフォントサイズ設定」）
    const next = st.startWidth + deltaPx / 12.8;
    const maxPaneRem = Math.floor(window.innerWidth / 12.8);
    setPaneWidthRem(Math.min(maxPaneRem, Math.max(PANE_MIN_REM, next)));
  }, []);
  const handleResizeEnd = useCallback(() => {
    resizeRef.current = null;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.userSelect = '';
  }, [handleResizeMove]);
  const handleResizeStart = (e: ReactMouseEvent) => {
    e.preventDefault();
    dragMovedRef.current = false;
    resizeRef.current = {
      startX: e.clientX,
      startWidth: paneWidthRem,
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
  };
  useEffect(
    () => () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.userSelect = '';
    },
    [handleResizeMove, handleResizeEnd]
  );

  // ===== 流用 =====
  const [referenceValue, setReferenceValue] = useState<string>(
    REFERENCE_OPTIONS[0].value
  );
  const [isReferenceAccordionOpen, setIsReferenceAccordionOpen] =
    useState(false);

  // ===== 請求書 =====
  // 未着・回収予定日・受領形態・発行日は行（EvidenceSlot）ごとに持つ（修正指示1）
  const [invoiceSlots, setInvoiceSlots] = useState<EvidenceSlot[]>([
    emptySlot(),
  ]);

  // ===== 覚書・契約書（2026-09-08 修正指示3。未着・回収予定日は行ごと、全支払で必須：回答B-1） =====
  const [contractSlots, setContractSlots] = useState<EvidenceSlot[]>([
    emptySlot(),
  ]);

  // ===== 見積書 =====
  const [quotationSlots, setQuotationSlots] = useState<EvidenceSlot[]>([
    emptySlot(),
  ]);

  // ===== 稟議書 =====
  const [approvalSlots, setApprovalSlots] = useState<EvidenceSlot[]>([
    emptySlot(),
  ]);

  // ===== その他根拠資料 =====
  const [otherDocs, setOtherDocs] = useState<OtherDoc[]>([]);
  const otherSeqRef = useRef(0);

  // ===== エラー =====
  const [errors, setErrors] = useState<string[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // ===== インラインプレビュー =====
  const [activePreviewSlot, setActivePreviewSlot] =
    useState<EvidenceSlot | null>(null);

  // ===== 登録済みバッジ =====
  const storedKindSet = new Set(evidenceFiles.map((f) => f.kind));
  // 未着（代替請求書）で登録済みのものも「登録済み」に含める（回答A-8）
  const invoiceAlreadyStored = storedKindSet.has('請求書');
  const contractAlreadyStored = storedKindSet.has('覚書・契約書');
  const quotationAlreadyStored = storedKindSet.has('見積書');

  // ===== open / openNonce / defaultTab 連動 =====
  useEffect(() => {
    if (open) {
      setIsCollapsed(false);
      setActiveTab(defaultTab);
      if (defaultTab === '表示') setViewerResetNonce((n) => n + 1);
    }
  }, [open, openNonce, defaultTab]);

  useEffect(() => {
    if (open) {
      setReferenceValue(REFERENCE_OPTIONS[0].value);
    }
  }, [open]);

  // ===== ファイル操作ヘルパー =====
  const slotSeqRef = useRef(0);

  // D2: 変換は非同期のため、完了時にどのセクションのスロットへ書き戻すかを
  // slotId で突き合わせる（請求書・見積書・稟議書・その他のいずれにも対応）。
  const applyConvertResult = useCallback(
    (slotId: string, result: ConvertToPdfResult) => {
      const patch = (prev: EvidenceSlot): EvidenceSlot => {
        if (prev.slotId !== slotId) return prev;
        if (result.status === 'done')
          return {
            ...prev,
            pdfPreviewUrl: result.pdfUrl,
            convertStatus: 'done',
          };
        return {
          ...prev,
          convertStatus: result.status === 'none' ? 'none' : 'failed',
        };
      };
      setInvoiceSlots((prev) => prev.map(patch));
      setContractSlots((prev) => prev.map(patch));
      setQuotationSlots((prev) => prev.map(patch));
      setApprovalSlots((prev) => prev.map(patch));
      setOtherDocs((prev) => prev.map((d) => ({ ...d, ...patch(d) })));
    },
    []
  );

  // D1: 原本URLを保持し、D2: プレビュー用のPDF変換をキックする。
  // URL生成・変換キックという副作用を含むため、setState の updater 内では呼ばない。
  const slotFromFile = (file: File): EvidenceSlot => {
    slotSeqRef.current += 1;
    const slotId = `slot-${slotSeqRef.current}`;
    const convertStatus = initialConvertStatus(file.name);
    if (convertStatus === 'converting')
      void convertToPdf(file).then((result) =>
        applyConvertResult(slotId, result)
      );
    return {
      fileName: file.name,
      updatedAt: '',
      uploaded: false,
      size: file.size,
      slotId,
      originalUrl: URL.createObjectURL(file),
      convertStatus,
      memo: '',
    };
  };

  const updateSlotAt = (
    setter: SlotSetter,
    index: number,
    updater: (prev: EvidenceSlot) => EvidenceSlot
  ) => setter((prev) => prev.map((s, i) => (i === index ? updater(s) : s)));

  const pickIntoSlot = (setter: SlotSetter, index: number) => (file: File) => {
    const next = slotFromFile(file);
    updateSlotAt(setter, index, (prev) => {
      revokeSlotUrls(prev);
      // ファイルを差し替えても、行に入力済みの備考・未着・回収予定日・受領形態・発行日は保つ
      return {
        ...next,
        memo: prev.memo,
        notReceived: prev.notReceived,
        collectionDate: prev.collectionDate,
        receiptFormat: prev.receiptFormat,
        issueDate: prev.issueDate,
      };
    });
  };

  const clearSlot = (setter: SlotSetter, index: number) => () =>
    setter((prev) => {
      revokeSlotUrls(prev[index]);
      // 最後の1件ならリセット（空スロット1件を維持）、複数ならこのスロットを削除
      if (prev.length <= 1) return [emptySlot()];
      return prev.filter((_, i) => i !== index);
    });

  const memoSlot = (setter: SlotSetter, index: number) => (val: string) =>
    updateSlotAt(setter, index, (prev) => ({
      ...prev,
      memo: val,
    }));

  // 行ごとの属性（未着・回収予定日・受領形態・発行日）の更新
  const updateSlotFields = (
    setter: SlotSetter,
    index: number,
    patch: SlotFieldPatch
  ) =>
    updateSlotAt(setter, index, (prev) => ({
      ...prev,
      ...patch,
    }));

  const addFilesToSection = (setter: SlotSetter, files: File[]) => {
    const valid = files.filter((f) => f.size <= MAX_FILE_BYTES);
    const added = valid.map(slotFromFile);
    setter((prev) => [...prev, ...added]);
  };

  // ===== その他 =====
  const handleAddOther = () => {
    if (otherDocs.length >= OTHER_DOC_MAX) return;

    otherSeqRef.current += 1;

    setOtherDocs((prev) => [
      ...prev,
      {
        ...emptySlot(),
        id: crypto.randomUUID(),
        kind: OTHER_DOC_KIND,
      },
    ]);

    requestAnimationFrame(() => {
      scrollAreaRef.current?.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  };

  const otherHasEmpty = otherDocs.some((d) => d.fileName === '');
  const showInitialOtherButton = otherDocs.length === 0;
  const showOtherAddButtonInsideSection =
    otherDocs.length > 0 && !otherHasEmpty;
  const otherSelectedCount = otherDocs.filter((d) => d.fileName).length;

  // 各セクションの選択件数
  const invoiceSelectedCount = invoiceSlots.filter((s) => s.fileName).length;
  const contractSelectedCount = contractSlots.filter((s) => s.fileName).length;
  const quotationSelectedCount = quotationSlots.filter(
    (s) => s.fileName
  ).length;
  const approvalSelectedCount = approvalSlots.filter((s) => s.fileName).length;

  const updateOther = (id: string, patch: Partial<OtherDoc>) =>
    setOtherDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
    );
  const removeOther = (id: string) =>
    setOtherDocs((prev) => prev.filter((d) => d.id !== id));

  // ===== 全クリア =====
  // D1: 登録直後（keepUrls）は原本URLの所有権が表示タブ（EvidenceFile）へ移るため解放しない。
  // それ以外（クリア・閉じる）は選択中のファイルを捨てるので解放する。
  const handleClearAll = useCallback((options?: { keepUrls?: boolean }) => {
    const keepUrls = options?.keepUrls === true;
    const dropSlots = (prev: EvidenceSlot[]) => {
      if (!keepUrls) prev.forEach(revokeSlotUrls);
      return [emptySlot()];
    };
    setReferenceValue(REFERENCE_OPTIONS[0].value);
    setInvoiceSlots(dropSlots);
    setContractSlots(dropSlots);
    setQuotationSlots(dropSlots);
    setApprovalSlots(dropSlots);
    setOtherDocs((prev) => {
      prev.forEach((d) => {
        if (!keepUrls && !d.uploaded) revokeSlotUrls(d);
      });
      return prev.filter((d) => d.uploaded);
    });
    setErrors([]);
    setActivePreviewSlot(null);
  }, []);

  // ===== 流用 =====
  // 前月支払の根拠資料をファイル未選択の枠へ入れる。対象は 覚書・契約書・見積書・稟議書・その他資料（回答B-4）。
  // 既にファイルを選択しているセクションには適用しない（現行踏襲）。未着（代替）の資料は流用元に含めない。
  const handleApplyReference = () => {
    const refs = REFERENCE_FILES_MOCK[referenceValue] ?? [];
    let applied = 0;

    const applyToSection = (
      slots: EvidenceSlot[],
      setter: SlotSetter,
      ref: ReferenceFileSummary
    ) => {
      if (slots.some((s) => s.fileName)) return false;
      setter((prev) => {
        const emptyIndex = prev.findIndex((s) => !s.fileName);
        const newSlot: EvidenceSlot = {
          ...emptySlot(),
          fileName: ref.fileName,
          ...getMockPreviewForReference(ref.fileName),
        };
        if (emptyIndex >= 0)
          return prev.map((s, i) => (i === emptyIndex ? newSlot : s));
        return [...prev, newSlot];
      });
      return true;
    };

    refs.forEach((ref) => {
      if (ref.kind === '覚書・契約書') {
        if (applyToSection(contractSlots, setContractSlots, ref)) applied++;
      } else if (ref.kind === '見積書') {
        if (applyToSection(quotationSlots, setQuotationSlots, ref)) applied++;
      } else if (ref.kind === '稟議書') {
        if (applyToSection(approvalSlots, setApprovalSlots, ref)) applied++;
      } else {
        // その他資料: 同名ファイルが未選択なら空欄に入れる（無ければ欄を追加）
        if (otherDocs.some((d) => d.fileName === ref.fileName)) return;
        otherSeqRef.current += 1;
        setOtherDocs((prev) => {
          const emptyIndex = prev.findIndex((d) => !d.fileName);
          const newDoc: OtherDoc = {
            ...emptySlot(),
            id: crypto.randomUUID(),
            kind: OTHER_DOC_KIND,
            fileName: ref.fileName,
            ...getMockPreviewForReference(ref.fileName),
          };
          if (emptyIndex >= 0)
            return prev.map((d, i) => (i === emptyIndex ? newDoc : d));
          return [...prev, newDoc];
        });
        applied++;
      }
    });

    if (applied > 0) {
      toast.success(`前月支払の根拠資料 ${applied}件 を流用しました。`);
    } else {
      toast.info('流用可能な資料がありませんでした。');
    }
  };

  // D2: 変換中に登録すると、表示タブ側が「変換中」のまま止まってしまうため登録させない。
  const hasConvertingSlot = [
    ...invoiceSlots,
    ...contractSlots,
    ...quotationSlots,
    ...approvalSlots,
    ...otherDocs,
  ].some((s) => s.convertStatus === 'converting');

  // ===== 登録バリデーション → 直接登録（確認ダイアログなし） =====
  // ルールは 2026-09-08 修正指示5（V1〜V10）。行ごとの指摘は「請求書1：…」の形で、行見出しの番号と揃える。
  const pickedOf = (slots: EvidenceSlot[]) => slots.filter((s) => s.fileName);
  const isBlank = (v?: string) => !(v ?? '').trim();

  const handleRegister = () => {
    const next: string[] = [];
    const storedKinds = new Set(evidenceFiles.map((f) => f.kind));

    const pickedCount =
      pickedOf(invoiceSlots).length +
      pickedOf(contractSlots).length +
      pickedOf(quotationSlots).length +
      pickedOf(approvalSlots).length +
      otherDocs.filter((d) => d.fileName).length;

    // V1: 1件も資料を選択していない（未着情報だけの登録は廃止：回答A-6）
    if (pickedCount === 0) next.push('登録する資料を選択してください');

    // V2: 請求書を選択しておらず、請求書も登録済みでない
    //     （未着＝代替請求書で登録済みのものも「登録済み」に含める：回答A-8）
    if (pickedOf(invoiceSlots).length === 0 && !storedKinds.has('請求書'))
      next.push(
        '請求書を選択してください（未着の場合は「未着」にチェックして代替請求書を選択）'
      );

    // V3〜V6: 請求書の行ごと
    //   受領形態・発行日は未着行でもファイルを選択したら必須（依頼5の文言どおり。回答A-2で入力欄は常時表示）
    invoiceSlots.forEach((s, i) => {
      const label = `請求書${i + 1}`;
      if (s.notReceived && isBlank(s.collectionDate))
        next.push(`${label}：未着の場合は回収予定日を入力してください`);
      if (s.notReceived && !s.fileName)
        next.push(`${label}：未着の場合は代替請求書を選択してください`);
      if (s.fileName && !s.notReceived && !s.receiptFormat)
        next.push(`${label}：受領形態（紙／電子／紙と電子）を選択してください`);

      if (s.fileName && !s.notReceived && isBlank(s.issueDate))
        next.push(`${label}：発行日を入力してください`);
    });

    // V7〜V8: 覚書・契約書の行ごと（未着なら回収予定日と代替覚書・契約書が必須）
    contractSlots.forEach((s, i) => {
      const label = `覚書・契約書${i + 1}`;
      if (s.notReceived && isBlank(s.collectionDate))
        next.push(`${label}：未着の場合は回収予定日を入力してください`);
      if (s.notReceived && !s.fileName)
        next.push(`${label}：未着の場合は代替覚書・契約書を選択してください`);
    });

    /*// V9: 覚書・契約書を選択しておらず、登録済みでもない（全支払で必須：回答B-1）
    if (
      pickedOf(contractSlots).length === 0 &&
      !storedKinds.has("覚書・契約書")
    )
      next.push(
        "覚書・契約書を選択してください（未着の場合は「未着」にチェックして代替覚書・契約書を選択）",
      );*/

    // V10: 見積書を選択しておらず、見積書も登録済みでない
    if (pickedOf(quotationSlots).length === 0 && !storedKinds.has('見積書'))
      next.push('見積書を選択してください');

    // D2: 変換中に登録すると表示タブ側が「変換中」のまま止まるため登録させない
    if (hasConvertingSlot)
      next.push('PDF変換中の資料があります。変換の完了をお待ちください');

    setErrors(next);
    if (next.length > 0) {
      scrollAreaRef.current?.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
      return;
    }

    // バリデーション通過 → 確認ダイアログなしで直接登録
    // D1: 原本URL・変換後PDF・変換状態をそのまま表示タブへ引き渡す
    // 未着・回収予定日は資料単位の属性として引き渡す（回答A-6）。受領形態・発行日は請求書のみ
    const toRegistered = (
      kind: string,
      slot: EvidenceSlot
    ): RegisteredEvidence => ({
      kind,
      fileName: slot.fileName,
      memo: slot.memo,
      originalUrl: slot.originalUrl,
      pdfPreviewUrl: slot.pdfPreviewUrl,
      convertStatus: slot.convertStatus,
      ...(kind === '請求書' && {
        receiptFormat: slot.receiptFormat,
        issueDate: slot.issueDate,
      }),
      ...((kind === '請求書' || kind === '覚書・契約書') && {
        notReceived: !!slot.notReceived,
        collectionDate: slot.notReceived ? slot.collectionDate : undefined,
      }),
    });
    const picked: RegisteredEvidence[] = [
      ...pickedOf(invoiceSlots).map((s) => toRegistered('請求書', s)),
      ...pickedOf(contractSlots).map((s) => toRegistered('覚書・契約書', s)),
      ...pickedOf(quotationSlots).map((s) => toRegistered('見積書', s)),
      ...pickedOf(approvalSlots).map((s) => toRegistered('稟議書', s)),
      ...otherDocs
        .filter((d) => d.fileName)
        .map((d) => toRegistered(d.kind || OTHER_DOC_KIND, d)),
    ];
    const lines = picked
      .map(
        (p) =>
          `${p.kind}${p.notReceived ? '（未着・代替）' : ''}：${p.fileName}`
      )
      .join('\n');
    onRegister?.(
      picked,
      `支払明細書No. ${paymentSlipNo}（${paymentRound}回目）に ${picked.length}件を登録しました。\n\n${lines}\n\nモックのため実際のアップロードは行いません。`
    );
    // 原本URLは表示タブ側で使い続けるため解放しない
    handleClearAll({ keepUrls: true });
  };

  // ペインを閉じる（×ボタン・他ペインの展開による排他クローズで共通）。
  // 登録タブの入力途中の内容は破棄する。
  const handleClose = () => {
    handleClearAll();
    setErrors([]);
    onOpenChange(false);
    setIsCollapsed(false);
  };

  // ペインは画面で1つだけ展開する（→ 02 §13.1）。他のペイン（コメント履歴・引用明細選択など）が
  // 展開されたら自身を閉じる。折り畳み（付箋）中は再表示の入口のため排他の対象外。
  useExclusivePane(open && !isCollapsed, handleClose);

  const handleTabChange = (tab: EvidenceTab) => {
    setActiveTab(tab);
    if (tab === '表示') setViewerResetNonce((n) => n + 1);
    setActivePreviewSlot(null);
  };

  return (
    <>
      {/* 折りたたみ時の付箋 */}
      {open && isCollapsed && (
        <button
          type="button"
          className="fixed top-1/2 right-0 -translate-y-1/2 z-50 flex flex-row items-center justify-center gap-0 h-32 w-12 rounded-l-lg bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={() => setIsCollapsed(false)}
          aria-label="支払根拠資料ペインを再表示"
          title="支払根拠資料を開く"
        >
          <span className="text-xs font-bold [writing-mode:vertical-rl] tracking-tight">
            支払根拠資料
          </span>
        </button>
      )}

      <div
        className={`fixed top-11 bottom-0 right-0 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40 flex flex-col ${
          open && !isCollapsed ? 'translate-x-0' : 'translate-x-full'
        }`}
        // 幅はドラッグリサイズで JS が決める（inline style 例外：JS動的計算値）
        style={{ width: `${paneWidthRem}rem` }}
        role="complementary"
        aria-label="支払根拠資料"
      >
        {/* リサイズハンドル */}
        <div
          className="absolute left-0 top-0 z-40 h-full w-1.5 cursor-ew-resize bg-transparent transition-colors hover:bg-blue-400/40"
          onMouseDown={handleResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="ペイン幅をリサイズ"
          title="ドラッグで幅を変更"
        />
        {/* リサイズ＆折りたたみハンドル。
            クリック（動かさずに離す）＝折りたたみ、ドラッグ＝幅変更。 */}
        {open && !isCollapsed && (
          <button
            type="button"
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-50 flex h-8 w-8 cursor-ew-resize items-center justify-center rounded-full bg-white border border-gray-300 text-gray-500 shadow-sm hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            onMouseDown={handleResizeStart}
            onClick={() => {
              // ドラッグで幅を変えたときは折りたたまない
              if (dragMovedRef.current) return;
              setIsCollapsed(true);
            }}
            aria-label="ペイン幅をドラッグで変更／クリックで折りたたむ"
            title="ドラッグで幅を変更／クリックで折りたたむ"
          >
            <MoveHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {/* ヘッダー */}
        <div className="relative px-6 pt-6 pb-4 border-b border-gray-200 shrink-0">
          <h2 className={SCREEN_TITLE_CLASS}>支払根拠資料</h2>
          <button
            type="button"
            className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            onClick={handleClose}
            aria-label="閉じる"
            title="閉じる"
          >
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>

        {/* タブ（左：表示、右：登録）。共通 Tabs（ui/tabs）を下線タブの見た目で使う。
            登録タブの入力途中の状態を保つため、非選択タブも forceMount で描画したまま隠す */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => handleTabChange(value as EvidenceTab)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <TabsList className="flex h-auto w-full shrink-0 rounded-none border-b border-gray-200 bg-transparent p-0">
            {EVIDENCE_TABS.map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="h-auto flex-1 rounded-none border-0 border-b-2 border-transparent py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              >
                根拠資料{tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ─── 登録タブ ─── */}
          <TabsContent
            value="登録"
            forceMount
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            {/* インラインプレビューオーバーレイ */}
            {activePreviewSlot && (
              <SlotPreviewOverlay
                slot={activePreviewSlot}
                onClose={() => setActivePreviewSlot(null)}
              />
            )}

            {/* ステータス案内バナー */}
            {!canRegister && (
              <div className="px-4 py-2 border-b border-gray-300 bg-gray-100 shrink-0 flex items-start gap-2">
                <AlertCircle
                  className="h-4 w-4 shrink-0 text-gray-600 mt-0.5"
                  aria-hidden="true"
                />
                <p className="text-xs text-gray-800">{lockedReason}</p>
              </div>
            )}
            {canRegister && status === '検印済' && (
              <div className="px-4 py-2 border-b border-orange-200 bg-orange-50 shrink-0 flex items-start gap-2">
                <AlertCircle
                  className="h-4 w-4 shrink-0 text-orange-600 mt-0.5"
                  aria-hidden="true"
                />
                <p className="text-xs text-orange-900">
                  検印済の伝票です。ここで登録した根拠資料は
                  <span className="font-bold">「検印後」</span>
                  として記録されます。
                </p>
              </div>
            )}

            {/* スクロール領域 */}
            <div
              ref={scrollAreaRef}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-5"
            >
              {/* エラーサマリ */}
              {errors.length > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3">
                  <p className="mb-1 flex items-center gap-1 text-sm font-bold text-red-700">
                    <AlertCircle
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    入力内容を確認してください
                  </p>
                  <ul className="list-disc pl-5 text-xs text-red-700 space-y-0.5">
                    {errors.map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ─── 流用 ─── */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="evidence-reference-round"
                  className="text-sm font-bold text-gray-900"
                >
                  流用する前月支払の支払回数を選択
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <SingleCombobox
                    id="evidence-reference-round"
                    className="min-w-64"
                    options={REFERENCE_OPTIONS}
                    value={referenceValue}
                    onChange={setReferenceValue}
                    placeholder="選択してください"
                    disabled={!canRegister}
                    searchable={false}
                  />
                  <button
                    type="button"
                    onClick={handleApplyReference}
                    disabled={!canRegister}
                    className="btn-action-base btn-action-blue"
                  >
                    流用
                  </button>
                </div>

                {/* 流用対象根拠資料 アコーディオン */}
                <div className="rounded-lg border border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-expanded={isReferenceAccordionOpen}
                    onClick={() => setIsReferenceAccordionOpen((o) => !o)}
                  >
                    <span className="text-sm font-medium text-gray-700">
                      流用対象根拠資料（
                      {(REFERENCE_FILES_MOCK[referenceValue] ?? []).length}
                      件）
                    </span>
                    {isReferenceAccordionOpen ? (
                      <ChevronUp
                        className="h-4 w-4 text-gray-500"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronDown
                        className="h-4 w-4 text-gray-500"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                  {isReferenceAccordionOpen && (
                    <div className="px-3 pb-3">
                      {(REFERENCE_FILES_MOCK[referenceValue] ?? []).length ===
                      0 ? (
                        <p className="py-2 text-center text-xs text-gray-500">
                          （なし）
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {(REFERENCE_FILES_MOCK[referenceValue] ?? []).map(
                            (ref, i) => {
                              const Icon = iconForFile(ref.fileName);
                              return (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2.5 py-1.5"
                                >
                                  <span className="shrink-0 rounded bg-blue-700 px-1.5 py-0.5 text-xs font-bold text-white">
                                    {ref.kind}
                                  </span>
                                  <Icon
                                    className="h-4 w-4 shrink-0 text-gray-500"
                                    aria-hidden="true"
                                  />
                                  <span
                                    className="min-w-0 flex-1 truncate text-xs text-gray-800"
                                    title={ref.fileName}
                                  >
                                    {ref.fileName}
                                  </span>
                                  <span className="shrink-0 whitespace-nowrap text-xs text-gray-500">
                                    {ref.updatedAt}
                                  </span>
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">
                    前月の支払に登録済みの根拠資料（覚書・契約書・見積書・稟議書・その他資料）を流用できます。
                    <br />
                    ※ファイル未選択の欄にのみ適用されます。
                  </p>
                </div>
              </div>

              {/* ─ 区切り線：流用対象根拠資料 ⇔ 請求書 ─ */}
              <div className="border-t border-gray-200" />

              {/* ─── 請求書 ─── */}
              {/* 未着・回収予定日・受領形態・発行日は請求書ごと（行内）に入力する（修正指示1） */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-900">
                    請求書
                  </span>
                  {invoiceAlreadyStored ? (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">
                      登録済
                    </span>
                  ) : (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">
                      未登録
                    </span>
                  )}
                  {invoiceSelectedCount > 0 && (
                    <span className="ml-auto text-xs text-gray-500">
                      {invoiceSelectedCount}件選択済み
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">
                  {invoiceAlreadyStored
                    ? '請求書は登録済みです。追加登録する場合のみ再度アップロードしてください。'
                    : '請求書は未登録です。未着の場合は、その行で「未着」にチェックし、回収予定日と代替請求書を登録してください。'}
                </p>

                <MultiSlotSection
                  slots={invoiceSlots}
                  disabled={!canRegister}
                  addLabel="請求書追加"
                  onPickAt={(i, file) => pickIntoSlot(setInvoiceSlots, i)(file)}
                  onClearAt={(i) => clearSlot(setInvoiceSlots, i)()}
                  onMemoChangeAt={(i, val) => memoSlot(setInvoiceSlots, i)(val)}
                  onAddSlots={(files) =>
                    addFilesToSection(setInvoiceSlots, files)
                  }
                  onPreview={setActivePreviewSlot}
                  onAddSlot={() =>
                    setInvoiceSlots((prev) => [...prev, emptySlot()])
                  }
                  fields="invoice"
                  onFieldChangeAt={(i, patch) =>
                    updateSlotFields(setInvoiceSlots, i, patch)
                  }
                  rowLabelPrefix="請求書"
                  altLabel="代替請求書"
                  radioNamePrefix="invoice-receipt-format"
                />
              </div>

              {/* ─ 区切り線：請求書 ⇔ 覚書・契約書 ─ */}
              <div className="border-t border-gray-200" />

              {/* ─── 覚書・契約書 ─── */}
              {/* 修正指示3: 請求書と同じ枠ルール（未選択枠は最大1つ・件数表示・追加ボタン）。未着・回収予定日は行ごと */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-900">
                    覚書・契約書
                  </span>
                  {contractAlreadyStored ? (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">
                      登録済
                    </span>
                  ) : (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">
                      未登録
                    </span>
                  )}
                  {contractSelectedCount > 0 && (
                    <span className="ml-auto text-xs text-gray-500">
                      {contractSelectedCount}件選択済み
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">
                  {contractAlreadyStored
                    ? '覚書・契約書は登録済みです。追加登録する場合のみ再度アップロードしてください。'
                    : '覚書・契約書は未登録です。未着の場合は、その行で「未着」にチェックし、回収予定日と代替覚書・契約書を登録してください。'}
                </p>
                <MultiSlotSection
                  slots={contractSlots}
                  disabled={!canRegister}
                  addLabel="覚書・契約書追加"
                  onPickAt={(i, file) =>
                    pickIntoSlot(setContractSlots, i)(file)
                  }
                  onClearAt={(i) => clearSlot(setContractSlots, i)()}
                  onMemoChangeAt={(i, val) =>
                    memoSlot(setContractSlots, i)(val)
                  }
                  onAddSlots={(files) =>
                    addFilesToSection(setContractSlots, files)
                  }
                  onPreview={setActivePreviewSlot}
                  onAddSlot={() =>
                    setContractSlots((prev) => [...prev, emptySlot()])
                  }
                  fields="notReceivable"
                  onFieldChangeAt={(i, patch) =>
                    updateSlotFields(setContractSlots, i, patch)
                  }
                  rowLabelPrefix="覚書・契約書"
                  altLabel="代替覚書・契約書"
                />
              </div>

              {/* ─ 区切り線：覚書・契約書 ⇔ 見積書 ─ */}
              <div className="border-t border-gray-200" />

              {/* ─── 見積書 ─── */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-900">
                    見積書
                  </span>
                  {quotationAlreadyStored ? (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">
                      登録済
                    </span>
                  ) : (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">
                      未登録
                    </span>
                  )}
                  {quotationSelectedCount > 0 && (
                    <span className="ml-auto text-xs text-gray-500">
                      {quotationSelectedCount}件選択済み
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">
                  {quotationAlreadyStored
                    ? '見積書は登録済みです。追加登録する場合のみ再度アップロードしてください。'
                    : '見積書は未登録です。'}
                </p>
                <MultiSlotSection
                  slots={quotationSlots}
                  disabled={!canRegister}
                  addLabel="見積書追加"
                  onPickAt={(i, file) =>
                    pickIntoSlot(setQuotationSlots, i)(file)
                  }
                  onClearAt={(i) => clearSlot(setQuotationSlots, i)()}
                  onMemoChangeAt={(i, val) =>
                    memoSlot(setQuotationSlots, i)(val)
                  }
                  onAddSlots={(files) =>
                    addFilesToSection(setQuotationSlots, files)
                  }
                  onPreview={setActivePreviewSlot}
                  onAddSlot={() =>
                    setQuotationSlots((prev) => [...prev, emptySlot()])
                  }
                />
              </div>

              {/* ─ 区切り線：見積書 ⇔ 稟議書 ─ */}
              <div className="border-t border-gray-200" />

              {/* ─── 稟議書 ─── */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-900">
                    稟議書
                  </span>
                  {approvalSelectedCount > 0 && (
                    <span className="ml-auto text-xs text-gray-500">
                      {approvalSelectedCount}件選択済み
                    </span>
                  )}
                </div>
                <MultiSlotSection
                  slots={approvalSlots}
                  disabled={!canRegister}
                  addLabel="稟議書追加"
                  onPickAt={(i, file) =>
                    pickIntoSlot(setApprovalSlots, i)(file)
                  }
                  onClearAt={(i) => clearSlot(setApprovalSlots, i)()}
                  onMemoChangeAt={(i, val) =>
                    memoSlot(setApprovalSlots, i)(val)
                  }
                  onAddSlots={(files) =>
                    addFilesToSection(setApprovalSlots, files)
                  }
                  onPreview={setActivePreviewSlot}
                  onAddSlot={() =>
                    setApprovalSlots((prev) => [...prev, emptySlot()])
                  }
                />
              </div>

              {/* ─── その他根拠資料追加ボタン（初期） ─── */}
              {showInitialOtherButton && (
                <div className="pt-3 border-t border-gray-200">
                  <AddButton
                    onClick={handleAddOther}
                    label="その他根拠資料追加"
                  />
                </div>
              )}

              {/* ─── その他根拠資料 ─── */}
              {otherDocs.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">
                      その他根拠資料
                    </span>
                    <span className="text-xs text-gray-500">
                      {otherSelectedCount > 0
                        ? `${otherSelectedCount}件選択済み`
                        : ''}
                    </span>
                  </div>

                  {otherDocs.map((doc, index) => (
                    <div
                      key={doc.id}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        {/* 区分は「その他の資料」固定（2026-09-08 修正指示4：区分プルダウン廃止） */}
                        <span className="text-sm font-medium text-gray-700">
                          その他根拠資料 {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeOther(doc.id)}
                          className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label={`その他根拠資料${index + 1}を削除`}
                          title="この欄を削除"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <FileDropField
                        slot={doc}
                        disabled={!canRegister}
                        onPickMultiple={(files) => {
                          if (files.length === 0) return;
                          const s = slotFromFile(files[0]);
                          revokeSlotUrls(doc);
                          updateOther(doc.id, {
                            ...s,
                            memo: doc.memo,
                          });
                          if (files.length > 1) {
                            files.slice(1).forEach((f) => {
                              if (otherDocs.length >= OTHER_DOC_MAX) return;
                              otherSeqRef.current += 1;
                              const added = {
                                ...slotFromFile(f),
                                id: crypto.randomUUID(),
                                kind: OTHER_DOC_KIND,
                              };
                              setOtherDocs((prev) => [...prev, added]);
                            });
                          }
                        }}
                        onClear={() => {
                          revokeSlotUrls(doc);
                          updateOther(doc.id, {
                            fileName: '',
                            size: undefined,
                            slotId: undefined,
                            originalUrl: undefined,
                            pdfPreviewUrl: undefined,
                            convertStatus: undefined,
                          });
                        }}
                        onPreview={setActivePreviewSlot}
                      />
                      {doc.fileName && (
                        <div className="mt-2">
                          <MemoField
                            value={doc.memo ?? ''}
                            onChange={(val) =>
                              updateOther(doc.id, { memo: val })
                            }
                            disabled={!canRegister}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {showOtherAddButtonInsideSection && (
                    <AddButton
                      onClick={handleAddOther}
                      label="その他根拠資料追加"
                    />
                  )}
                </div>
              )}
            </div>

            {/* フッター */}
            <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => handleClearAll()}
                className="btn-action-base btn-action-outline"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                クリア
              </button>
              <button
                type="button"
                onClick={handleRegister}
                disabled={!canRegister || hasConvertingSlot}
                title={
                  hasConvertingSlot
                    ? 'PDF変換中です。完了までお待ちください'
                    : undefined
                }
                className="btn-action-base btn-action-blue"
              >
                {hasConvertingSlot ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {hasConvertingSlot ? 'PDF変換中…' : '登録'}
              </button>
            </div>
          </TabsContent>

          {/* ─── 表示タブ ─── */}
          <TabsContent
            value="表示"
            forceMount
            className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <EvidenceViewerContent
              paymentSlipNo={paymentSlipNo}
              paymentRound={paymentRound}
              files={evidenceFiles}
              status={status}
              role={role}
              onUpdateFile={onUpdateFile}
              onDeleteFile={onDeleteFile}
              onTimestamped={onTimestamped}
              isActive={open && !isCollapsed && activeTab === '表示'}
              resetNonce={viewerResetNonce}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

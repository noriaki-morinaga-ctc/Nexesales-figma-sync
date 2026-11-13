import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { toast } from 'sonner';
import { ProgressToast } from './ProgressToast';
import { MOCK_LOGIN_USER_NAME } from './uploadConstants';
import type {
  UploadErrorItem,
  UploadHistoryCommon,
  UploadOption,
  UploadStatusType,
} from './uploadTypes';
import { genUploadId, nowIso, validateFile } from './uploadUtils';

// ===== アップロード画面（予算参照登録・ファイルアップロード）共通の状態管理 =====
// ファイル選択（ドラッグ＆ドロップ・ダイアログ）、アップロードの実行（モック：進捗トーストと結果のランダム）、
// 履歴と選択中の履歴を持つ。ダウンロードの条件は画面ごとに違うため画面が持ち、
// 出力は返り値の downloadXlsx（進捗トースト＋Excel 出力）で行う。

// アップロード処理のシミュレート時間（ミリ秒）
const UPLOAD_SIMULATE_MS = 2000;
// アップロード進捗の更新間隔（ミリ秒）と、完了前に止める上限値（%）
const UPLOAD_PROGRESS_INTERVAL_MS = 200;
const UPLOAD_PROGRESS_MAX = 95;
// ダウンロード進捗の更新間隔（ミリ秒）
const DOWNLOAD_PROGRESS_INTERVAL_MS = 100;
// 進捗の増分（%）
const PROGRESS_STEP = 10;

// 進捗トーストを表示（同一IDで再描画して更新）する
const showProgressToast = (id: string, title: string, value: number) => {
  toast.custom(() => <ProgressToast title={title} value={value} />, {
    id,
    duration: Infinity,
  });
};

// 登録日時の降順に並べる
const sortByUploadedAtDesc = <T extends UploadHistoryCommon>(items: T[]) =>
  [...items].sort((a, b) => (a.uploadedAt > b.uploadedAt ? -1 : 1));

// Excel に出力する1シート分
export interface UploadDownloadSheet {
  rows: unknown[][]; // 見出し・明細（1行＝1配列）
  colWidths: { wch: number }[]; // 列幅
  sheetName: string;
  fileName: string;
  // 日付のセルの書式（年月の列があるシートだけ。例：'yyyy/mm'）
  dateFormat?: string;
}

export interface UseUploadFlowOptions<T extends UploadHistoryCommon> {
  // 進捗トーストの id の先頭（画面ごとに一意。UploadCard の idPrefix と同じ値。例：'budget'）
  idPrefix: string;
  // アップロード対象の選択肢と初期値
  targetOptions: UploadOption<T['uploadTarget']>[];
  initialUploadTarget: T['uploadTarget'];
  // 履歴の初期データ（モック）
  initialHistory: T[];
  // 履歴に出す行の絞り込み（省略時はすべて）
  historyFilter?: (item: T) => boolean;
  // 初期表示で選ぶ履歴（省略時は最新の履歴）
  initialSelectedUploadId?: string | null;
  // エラー時に出すエラー明細（モック）
  sampleErrors: UploadErrorItem[];
  // アップロードしたファイルから、履歴に足す画面ごとの項目（対象年度・対象年月など）を作る
  buildHistoryFields: (
    file: File
  ) => Promise<Omit<T, keyof UploadHistoryCommon>>;
}

export function useUploadFlow<T extends UploadHistoryCommon>({
  idPrefix,
  targetOptions,
  initialUploadTarget,
  initialHistory,
  historyFilter,
  initialSelectedUploadId,
  sampleErrors,
  buildHistoryFields,
}: UseUploadFlowOptions<T>) {
  const uploadToastId = `${idPrefix}-upload-progress`;
  const downloadToastId = `${idPrefix}-download-progress`;

  const [uploadTarget, setUploadTarget] =
    useState<T['uploadTarget']>(initialUploadTarget);

  // 履歴・選択状態（表示する履歴は絞り込み後、登録日時の降順）
  const [history, setHistory] = useState<T[]>(initialHistory);
  const sortedHistory = useMemo(
    () =>
      sortByUploadedAtDesc(
        historyFilter ? history.filter(historyFilter) : history
      ),
    [history, historyFilter]
  );
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(() =>
    initialSelectedUploadId !== undefined
      ? initialSelectedUploadId
      : (sortedHistory[0]?.uploadId ?? null)
  );
  const selectedItem = useMemo(
    () =>
      sortedHistory.find((item) => item.uploadId === selectedUploadId) ?? null,
    [sortedHistory, selectedUploadId]
  );

  const [isUploadConfirmDialogOpen, setIsUploadConfirmDialogOpen] =
    useState<boolean>(false);

  // ファイル選択状態
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ファイル入力の選択値をクリアする（同じファイルを選び直せるようにする）
  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ファイル選択時の共通処理
  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      setSelectedFile(null);
      resetFileInput();
      return;
    }
    setValidationError(null);
    setSelectedFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileSelect(files[0]);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFileSelect(files[0]);
  };

  // ファイル選択ダイアログを開く
  const handleOpenFileDialog = () => {
    fileInputRef.current?.click();
  };

  // 選択中ファイルをクリアする
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setValidationError(null);
    resetFileInput();
  };

  // アップロード可否
  const canUpload = !!selectedFile && !validationError;

  // アップロード実行（トースト進捗＋インライン履歴の両方を更新）
  const handleUpload = async () => {
    if (!selectedFile) {
      setValidationError('アップロードするファイルを選択してください');
      return;
    }
    const error = validateFile(selectedFile);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);

    const uploadId = genUploadId();
    // 履歴に「処理中」を追加（インライン表示）。画面ごとの項目はファイルから作る
    const processingItem = {
      ...(await buildHistoryFields(selectedFile)),
      uploadId,
      uploadTarget,
      uploadTargetName:
        targetOptions.find((option) => option.value === uploadTarget)?.label ??
        '',
      fileName: selectedFile.name,
      uploadedAt: nowIso(),
      uploadedBy: MOCK_LOGIN_USER_NAME,
      status: 'PROCESSING',
      errorCount: 0,
      isSysError: false,
    } as T;
    setHistory((prev) => [processingItem, ...prev]);
    setSelectedUploadId(uploadId);

    // 進捗トーストを表示（完了直前の95%で止める）
    let progress = 0;
    showProgressToast(uploadToastId, 'アップロード中...', progress);
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + PROGRESS_STEP, UPLOAD_PROGRESS_MAX);
      showProgressToast(uploadToastId, 'アップロード中...', progress);
    }, UPLOAD_PROGRESS_INTERVAL_MS);

    // アップロード処理をシミュレート
    await new Promise((resolve) => setTimeout(resolve, UPLOAD_SIMULATE_MS));
    clearInterval(progressInterval);
    toast.dismiss(uploadToastId);

    // ランダムで結果をシミュレート
    const hasError = Math.random() > 0.5;
    const resultStatus: UploadStatusType = hasError ? 'ERROR' : 'COMPLETED';
    const result: Partial<UploadHistoryCommon> = hasError
      ? {
          status: resultStatus,
          errorCount: sampleErrors.length,
          errors: sampleErrors,
        }
      : { status: resultStatus, errorCount: 0, errors: [] };

    // 履歴を確定結果で更新（インライン表示）
    setHistory((prev) =>
      prev.map((item) =>
        item.uploadId === uploadId ? { ...item, ...result } : item
      )
    );

    // 結果トーストを表示（成功＝緑／失敗＝赤。配色は App の Toaster richColors に統一）
    if (hasError) {
      toast.error('アップロードに失敗しました。');
    } else {
      toast.success('アップロードが完了しました。');
    }

    handleRemoveFile();
  };

  // ダウンロード実行（進捗トーストを出し、1シートの Excel を出力する）
  const downloadXlsx = (sheet: UploadDownloadSheet) => {
    let progress = 0;
    showProgressToast(downloadToastId, 'ダウンロード中...', progress);
    // ファイル生成は即時完了するため、進捗バーを一定時間かけて
    // 100%まで描画し、完了時に閉じる
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + PROGRESS_STEP, 100);
      showProgressToast(downloadToastId, 'ダウンロード中...', progress);
      if (progress >= 100) {
        clearInterval(progressInterval);
        toast.dismiss(downloadToastId);
        toast.success('ダウンロードが完了しました。');
      }
    }, DOWNLOAD_PROGRESS_INTERVAL_MS);

    // xlsx を動的importして出力データを生成
    import('xlsx')
      .then((xlsx) => {
        const worksheet = xlsx.utils.aoa_to_sheet(
          sheet.rows,
          sheet.dateFormat
            ? { cellDates: true, dateNF: sheet.dateFormat }
            : undefined
        );
        worksheet['!cols'] = sheet.colWidths;
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, sheet.sheetName);
        xlsx.writeFile(workbook, sheet.fileName);
      })
      .catch(() => {
        // ライブラリ読込・ファイル生成に失敗した場合は進捗を止めて通知する
        clearInterval(progressInterval);
        toast.dismiss(downloadToastId);
        toast.error('ダウンロードに失敗しました。');
      });
  };

  // 履歴行の選択
  const handleSelectHistory = (uploadId: string) => {
    setSelectedUploadId(uploadId);
  };

  return {
    uploadTarget,
    setUploadTarget,
    sortedHistory,
    selectedUploadId,
    selectedItem,
    isUploadConfirmDialogOpen,
    setIsUploadConfirmDialogOpen,
    selectedFile,
    isDragging,
    validationError,
    fileInputRef,
    canUpload,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInputChange,
    handleOpenFileDialog,
    handleRemoveFile,
    handleUpload,
    downloadXlsx,
    handleSelectHistory,
  };
}

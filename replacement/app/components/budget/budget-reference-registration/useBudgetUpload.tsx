import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { toast } from 'sonner';
import type {
  UploadHistoryItem,
  UploadStatusType,
} from './budgetReferenceTypes';
import {
  DEFAULT_DOWNLOAD_TARGET,
  DEFAULT_FISCAL_YEAR,
  DEFAULT_UPLOAD_TARGET,
  DOWNLOAD_DATASETS,
  DOWNLOAD_PROGRESS_TOAST_ID,
  INITIAL_HISTORY,
  MOCK_LOGIN_USER_NAME,
  SAMPLE_UPLOAD_ERRORS,
  UPLOAD_PROGRESS_TOAST_ID,
  UPLOAD_TARGET_OPTIONS,
} from './budgetReferenceData';
import { genUploadId, nowIso, validateFile } from './budgetReferenceUtils';
import { ProgressToast } from '../../shared/upload/ProgressToast';

// ===== 予算参照登録画面の状態管理（アップロード・ダウンロード・履歴選択） =====

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

export function useBudgetUpload() {
  // アップロード対象年度（Make 版と同じく画面上の選択欄は無く、初期値固定）
  const [uploadFiscalYear] = useState<number>(DEFAULT_FISCAL_YEAR);
  const [downloadFiscalYear, setDownloadFiscalYear] =
    useState<number>(DEFAULT_FISCAL_YEAR);
  // 共通条件
  const [uploadTarget, setUploadTarget] = useState<string>(
    DEFAULT_UPLOAD_TARGET
  );
  const [downloadTarget, setDownloadTarget] = useState<string>(
    DEFAULT_DOWNLOAD_TARGET
  );
  // 履歴・選択状態
  const [history, setHistory] = useState<UploadHistoryItem[]>(INITIAL_HISTORY);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(
    INITIAL_HISTORY[0]?.uploadId ?? null
  );

  const [isUploadConfirmDialogOpen, setIsUploadConfirmDialogOpen] =
    useState<boolean>(false);

  // ファイル選択状態
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 登録日時の降順に並べた履歴
  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => (a.uploadedAt > b.uploadedAt ? -1 : 1)),
    [history]
  );

  // 選択中の履歴
  const selectedItem = useMemo(
    () =>
      sortedHistory.find((item) => item.uploadId === selectedUploadId) ?? null,
    [sortedHistory, selectedUploadId]
  );

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

    const targetLabel =
      UPLOAD_TARGET_OPTIONS.find((option) => option.value === uploadTarget)
        ?.label ?? '';
    const uploadId = genUploadId();
    const fileName = selectedFile.name;

    // 履歴に「処理中」を追加（インライン表示）
    const processingItem: UploadHistoryItem = {
      uploadId,
      uploadFiscalYear,
      uploadTarget,
      uploadTargetName: targetLabel,
      fileName,
      uploadedAt: nowIso(),
      uploadedBy: MOCK_LOGIN_USER_NAME,
      status: 'PROCESSING',
      errorCount: 0,
      isSysError: false,
    };
    setHistory((prev) => [processingItem, ...prev]);
    setSelectedUploadId(uploadId);

    // 進捗トーストを表示（完了直前の95%で止める）
    let progress = 0;
    showProgressToast(UPLOAD_PROGRESS_TOAST_ID, 'アップロード中...', progress);
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + PROGRESS_STEP, UPLOAD_PROGRESS_MAX);
      showProgressToast(
        UPLOAD_PROGRESS_TOAST_ID,
        'アップロード中...',
        progress
      );
    }, UPLOAD_PROGRESS_INTERVAL_MS);

    // アップロード処理をシミュレート
    await new Promise((resolve) => setTimeout(resolve, UPLOAD_SIMULATE_MS));
    clearInterval(progressInterval);
    toast.dismiss(UPLOAD_PROGRESS_TOAST_ID);

    // ランダムで結果をシミュレート
    const hasError = Math.random() > 0.5;
    const resultStatus: UploadStatusType = hasError ? 'ERROR' : 'COMPLETED';
    const result: Partial<UploadHistoryItem> = hasError
      ? {
          status: resultStatus,
          errorCount: SAMPLE_UPLOAD_ERRORS.length,
          errors: SAMPLE_UPLOAD_ERRORS,
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

  // テンプレートダウンロード実行
  const handleTemplateDownload = () => {
    // 進捗トーストを表示
    let progress = 0;
    showProgressToast(
      DOWNLOAD_PROGRESS_TOAST_ID,
      'ダウンロード中...',
      progress
    );
    // ファイル生成は即時完了するため、進捗バーを一定時間かけて
    // 100%まで描画し、完了時に閉じる
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + PROGRESS_STEP, 100);
      showProgressToast(
        DOWNLOAD_PROGRESS_TOAST_ID,
        'ダウンロード中...',
        progress
      );
      if (progress >= 100) {
        clearInterval(progressInterval);
        toast.dismiss(DOWNLOAD_PROGRESS_TOAST_ID);
        toast.success('ダウンロードが完了しました。');
      }
    }, DOWNLOAD_PROGRESS_INTERVAL_MS);

    // ダウンロード対象に応じた出力データセットを取得
    const dataset =
      DOWNLOAD_DATASETS[downloadTarget] ?? DOWNLOAD_DATASETS.sales_raw;

    // xlsx を動的importして出力データを生成
    import('xlsx')
      .then((xlsx) => {
        const worksheetData = [dataset.headers, ...dataset.rows];
        const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
        worksheet['!cols'] = dataset.colWidths;
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, dataset.sheetName);
        xlsx.writeFile(workbook, dataset.fileName);
      })
      .catch(() => {
        // ライブラリ読込・ファイル生成に失敗した場合は進捗を止めて通知する
        clearInterval(progressInterval);
        toast.dismiss(DOWNLOAD_PROGRESS_TOAST_ID);
        toast.error('ダウンロードに失敗しました。');
      });
  };

  // 履歴行の選択
  const handleSelectHistory = (uploadId: string) => {
    setSelectedUploadId(uploadId);
  };

  return {
    downloadFiscalYear,
    setDownloadFiscalYear,
    uploadTarget,
    setUploadTarget,
    downloadTarget,
    setDownloadTarget,
    sortedHistory,
    selectedUploadId,
    isUploadConfirmDialogOpen,
    setIsUploadConfirmDialogOpen,
    selectedItem,
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
    handleTemplateDownload,
    handleSelectHistory,
  };
}

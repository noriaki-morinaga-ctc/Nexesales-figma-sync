import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { toast } from 'sonner';
import type {
  StoreFilter,
  UploadHistoryItem,
  UploadStatusType,
  UploadTargetType,
} from './marketingFileUploadTypes';
import {
  ACTUAL_TARGET_OPTIONS,
  DEFAULT_DOWNLOAD_PERIOD_FROM,
  DEFAULT_DOWNLOAD_PERIOD_TO,
  DOWNLOAD_PROGRESS_TOAST_ID,
  INITIAL_HISTORY,
  INITIAL_STORE_FILTER,
  MOCK_LOGIN_USER_NAME,
  MOCK_TEMPLATE_ROWS,
  PLAN_TARGET_OPTIONS,
  SAMPLE_UPLOAD_ERRORS,
  TEMPLATE_DEFINITIONS,
  UPLOAD_PROGRESS_TOAST_ID,
  YEAR_MONTH_CELL_FORMAT,
  YEAR_MONTH_COLUMN_INDEX,
} from './marketingFileUploadData';
import {
  buildStoreOptions,
  channelToCells,
  genUploadId,
  isWithinPeriod,
  matchesStoreFilter,
  nowIso,
  toYearMonth,
  validateFile,
  validatePeriod,
  validateStoreFilter,
  yearMonthToDate,
} from './marketingFileUploadUtils';
import { ProgressToast } from '../../shared/upload/ProgressToast';

// ===== ファイルアップロード画面の状態管理（アップロード・ダウンロード・履歴選択） =====
// jihanki（実績登録メニューから遷移）により、アップロード・ダウンロード対象と履歴の表示対象を切り替える。

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
const sortByUploadedAtDesc = (items: UploadHistoryItem[]) =>
  [...items].sort((a, b) => (a.uploadedAt > b.uploadedAt ? -1 : 1));

// 対象年月 From／To（YYYY/MM）
interface YearMonthRange {
  from: string;
  to: string;
}

// 年月を読み取れない場合の値（履歴では「-」表示）
const EMPTY_YEAR_MONTH_RANGE: YearMonthRange = { from: '', to: '' };

// アップロードファイルの全明細から、対象年月（更新キー）の最小～最大を読み取る
const readYearMonthRange = async (file: File): Promise<YearMonthRange> => {
  try {
    const xlsx = await import('xlsx');
    const workbook = xlsx.read(await file.arrayBuffer(), { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return EMPTY_YEAR_MONTH_RANGE;
    const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
    });
    // 見出し・空行は年月として解釈できないため除外される
    const yearMonths = rows
      .map((row) => toYearMonth(row[YEAR_MONTH_COLUMN_INDEX]))
      .filter((yearMonth) => yearMonth !== '');
    if (yearMonths.length === 0) return EMPTY_YEAR_MONTH_RANGE;
    // 「YYYY/MM」は文字列比較で前後を判定できる
    const sorted = [...yearMonths].sort();
    return { from: sorted[0], to: sorted[sorted.length - 1] };
  } catch {
    return EMPTY_YEAR_MONTH_RANGE;
  }
};

// ダウンロード対象・対象期間内の明細（モック：登録済みデータ）
const rowsWithinPeriod = (target: UploadTargetType, from: string, to: string) =>
  MOCK_TEMPLATE_ROWS[target].filter((row) =>
    isWithinPeriod(row.yearMonth, from, to)
  );

// 販売店・三次店・一次店の候補を作る。
// 候補は、ダウンロード対象・対象期間の明細に存在する店のみ。
// 三次店・一次店は、販売店を選んでいればその販売店の商流にある店に絞る（支払一覧と同じ）
const buildStoreCandidates = (
  target: UploadTargetType,
  from: string,
  to: string,
  retailer: string
) => {
  const rows = rowsWithinPeriod(target, from, to);
  const retailerRows = retailer
    ? rows.filter((row) => String(row.channel.retailerCode) === retailer)
    : rows;
  return {
    retailerOptions: buildStoreOptions(rows, (channel) => ({
      code: channel.retailerCode,
      name: channel.retailerName,
    })),
    tertiaryStoreOptions: buildStoreOptions(retailerRows, (channel) => ({
      code: channel.tertiaryStoreCode,
      name: channel.tertiaryStoreName,
    })),
    primaryStoreOptions: buildStoreOptions(retailerRows, (channel) => ({
      code: channel.primaryStoreCode,
      name: channel.primaryStoreName,
    })),
  };
};

export function useMarketingFileUpload(jihanki: boolean) {
  // 表示モードの対象（販売計画＝2項目／実績登録＝3項目）
  const targetOptions = jihanki ? ACTUAL_TARGET_OPTIONS : PLAN_TARGET_OPTIONS;

  // アップロード・ダウンロード条件
  const [uploadTarget, setUploadTarget] = useState<UploadTargetType>(
    targetOptions[0].value
  );
  const [downloadTarget, setDownloadTarget] = useState<UploadTargetType>(
    targetOptions[0].value
  );
  const [downloadPeriodFrom, setDownloadPeriodFrom] = useState<string>(
    DEFAULT_DOWNLOAD_PERIOD_FROM
  );
  const [downloadPeriodTo, setDownloadPeriodTo] = useState<string>(
    DEFAULT_DOWNLOAD_PERIOD_TO
  );
  const [storeFilter, setStoreFilter] =
    useState<StoreFilter>(INITIAL_STORE_FILTER);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // 販売店・三次店・一次店の候補
  const storeCandidates = useMemo(
    () =>
      buildStoreCandidates(
        downloadTarget,
        downloadPeriodFrom,
        downloadPeriodTo,
        storeFilter.retailer
      ),
    [downloadTarget, downloadPeriodFrom, downloadPeriodTo, storeFilter.retailer]
  );

  // 履歴（全モード分）
  const [history, setHistory] = useState<UploadHistoryItem[]>(INITIAL_HISTORY);

  // 表示モードの対象データの履歴のみを、登録日時の降順に並べる
  const sortedHistory = useMemo(() => {
    const targetValues = new Set<UploadTargetType>(
      targetOptions.map((option) => option.value)
    );
    return sortByUploadedAtDesc(
      history.filter((item) => targetValues.has(item.uploadTarget))
    );
  }, [history, targetOptions]);

  // 初期表示は最新の履歴を選択する
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(
    () => sortedHistory[0]?.uploadId ?? null
  );

  const [isUploadConfirmDialogOpen, setIsUploadConfirmDialogOpen] =
    useState<boolean>(false);

  // ファイル選択状態
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      targetOptions.find((option) => option.value === uploadTarget)?.label ??
      '';
    const uploadId = genUploadId();
    const fileName = selectedFile.name;
    // 対象年月はファイル内の明細の最小～最大を表示する
    const yearMonthRange = await readYearMonthRange(selectedFile);

    // 履歴に「処理中」を追加（インライン表示）
    const processingItem: UploadHistoryItem = {
      uploadId,
      targetYearMonthFrom: yearMonthRange.from,
      targetYearMonthTo: yearMonthRange.to,
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

  // 候補が変わる条件の変更後に、候補から外れた販売店・三次店・一次店を未選択に戻す
  const applyStoreFilterInScope = (
    target: UploadTargetType,
    from: string,
    to: string,
    filter: StoreFilter
  ) => {
    const isInOptions = (options: { value: string }[], value: string) =>
      options.some((option) => option.value === value);
    const { retailerOptions } = buildStoreCandidates(target, from, to, '');
    const retailer = isInOptions(retailerOptions, filter.retailer)
      ? filter.retailer
      : '';
    const { tertiaryStoreOptions, primaryStoreOptions } = buildStoreCandidates(
      target,
      from,
      to,
      retailer
    );
    setStoreFilter({
      retailer,
      tertiaryStore: isInOptions(tertiaryStoreOptions, filter.tertiaryStore)
        ? filter.tertiaryStore
        : '',
      primaryStore: isInOptions(primaryStoreOptions, filter.primaryStore)
        ? filter.primaryStore
        : '',
    });
    setDownloadError(null);
  };

  // ダウンロード対象の変更
  const handleDownloadTargetChange = (value: UploadTargetType) => {
    setDownloadTarget(value);
    applyStoreFilterInScope(
      value,
      downloadPeriodFrom,
      downloadPeriodTo,
      storeFilter
    );
  };

  // 対象期間（From）の変更
  const handleDownloadPeriodFromChange = (value: string) => {
    setDownloadPeriodFrom(value);
    applyStoreFilterInScope(
      downloadTarget,
      value,
      downloadPeriodTo,
      storeFilter
    );
  };

  // 対象期間（To）の変更
  const handleDownloadPeriodToChange = (value: string) => {
    setDownloadPeriodTo(value);
    applyStoreFilterInScope(
      downloadTarget,
      downloadPeriodFrom,
      value,
      storeFilter
    );
  };

  // 販売店の変更（選択中の三次店・一次店が候補から外れたら未選択に戻す）
  const handleRetailerChange = (value: string) => {
    applyStoreFilterInScope(
      downloadTarget,
      downloadPeriodFrom,
      downloadPeriodTo,
      { ...storeFilter, retailer: value }
    );
  };

  // 三次店の変更
  const handleTertiaryStoreChange = (value: string) => {
    setStoreFilter((prev) => ({ ...prev, tertiaryStore: value }));
    setDownloadError(null);
  };

  // 一次店の変更
  const handlePrimaryStoreChange = (value: string) => {
    setStoreFilter((prev) => ({ ...prev, primaryStore: value }));
    setDownloadError(null);
  };

  // テンプレート・データダウンロード実行
  // 選択したダウンロード対象のテンプレートで出力し、
  // 対象期間内かつ販売店・三次店・一次店の条件に合う明細があれば明細行に出力する
  const handleTemplateDownload = () => {
    const conditionError =
      validatePeriod(downloadPeriodFrom, downloadPeriodTo) ??
      validateStoreFilter(storeFilter);
    if (conditionError) {
      setDownloadError(conditionError);
      return;
    }
    setDownloadError(null);

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

    // テンプレート定義と、条件に合う明細（NO は1からの連番）
    const template = TEMPLATE_DEFINITIONS[downloadTarget];
    const detailRows = rowsWithinPeriod(
      downloadTarget,
      downloadPeriodFrom,
      downloadPeriodTo
    )
      .filter((row) => matchesStoreFilter(row.channel, storeFilter))
      .map((row, index) => [
        index + 1,
        yearMonthToDate(row.yearMonth),
        ...channelToCells(row.channel),
        ...row.values,
      ]);

    // テンプレートと同じ構成（見出し → 空行 → 明細。見出し上段はシートにより有無あり）
    const worksheetData = [
      ...(template.groupHeaders ? [template.groupHeaders] : []),
      template.headers,
      [],
      ...detailRows,
    ];

    // xlsx を動的importして出力データを生成
    import('xlsx')
      .then((xlsx) => {
        const worksheet = xlsx.utils.aoa_to_sheet(worksheetData, {
          cellDates: true,
          dateNF: YEAR_MONTH_CELL_FORMAT,
        });
        worksheet['!cols'] = template.colWidths;
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, template.sheetName);
        xlsx.writeFile(workbook, template.fileName);
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
    targetOptions,
    uploadTarget,
    setUploadTarget,
    downloadTarget,
    handleDownloadTargetChange,
    downloadPeriodFrom,
    downloadPeriodTo,
    downloadError,
    handleDownloadPeriodFromChange,
    handleDownloadPeriodToChange,
    storeFilter,
    storeCandidates,
    handleRetailerChange,
    handleTertiaryStoreChange,
    handlePrimaryStoreChange,
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

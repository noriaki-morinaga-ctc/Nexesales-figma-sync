import { useCallback, useMemo, useState } from 'react';
import { useUploadFlow } from '@/components/shared/upload/useUploadFlow';
import type {
  StoreFilter,
  UploadHistoryItem,
  UploadTargetType,
} from './marketingFileUpload.types';
import {
  ACTUAL_TARGET_OPTIONS,
  DEFAULT_DOWNLOAD_PERIOD_FROM,
  DEFAULT_DOWNLOAD_PERIOD_TO,
  INITIAL_STORE_FILTER,
  PLAN_TARGET_OPTIONS,
  TEMPLATE_DEFINITIONS,
  YEAR_MONTH_CELL_FORMAT,
  YEAR_MONTH_COLUMN_INDEX,
} from './constants';
import {
  INITIAL_HISTORY,
  MOCK_TEMPLATE_ROWS,
  SAMPLE_UPLOAD_ERRORS,
} from '@/mocks/sales-plan/marketing-file-upload';
import {
  buildStoreOptions,
  channelToCells,
  isWithinPeriod,
  matchesStoreFilter,
  toYearMonth,
  validatePeriod,
  validateStoreFilter,
  yearMonthToDate,
} from './utils';

// ===== ファイルアップロード画面の状態管理 =====
// アップロード・履歴の動きはアップロード画面共通（shared/upload/useUploadFlow）。
// 本フックは、この画面だけのもの（履歴の対象年月、ダウンロードの対象期間・販売店・三次店・一次店）を持つ。
// jihanki（実績登録メニューから遷移）により、アップロード・ダウンロード対象と履歴の表示対象を切り替える。

// 対象年月 From／To（YYYY/MM）
interface YearMonthRange {
  targetYearMonthFrom: string;
  targetYearMonthTo: string;
}

// 年月を読み取れない場合の値（履歴では「-」表示）
const EMPTY_YEAR_MONTH_RANGE: YearMonthRange = {
  targetYearMonthFrom: '',
  targetYearMonthTo: '',
};

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
    return {
      targetYearMonthFrom: sorted[0],
      targetYearMonthTo: sorted[sorted.length - 1],
    };
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

  // 表示モードの対象データの履歴のみを出す
  const historyFilter = useCallback(
    (item: UploadHistoryItem) =>
      targetOptions.some((option) => option.value === item.uploadTarget),
    [targetOptions]
  );

  // アップロード・履歴（共通）
  const flow = useUploadFlow<UploadHistoryItem>({
    idPrefix: 'marketing',
    targetOptions,
    initialUploadTarget: targetOptions[0].value,
    initialHistory: INITIAL_HISTORY,
    historyFilter,
    sampleErrors: SAMPLE_UPLOAD_ERRORS,
    // 対象年月はファイル内の明細の最小～最大を表示する
    buildHistoryFields: readYearMonthRange,
  });

  // ダウンロード条件
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
    flow.downloadXlsx({
      rows: [
        ...(template.groupHeaders ? [template.groupHeaders] : []),
        template.headers,
        [],
        ...detailRows,
      ],
      colWidths: template.colWidths,
      sheetName: template.sheetName,
      fileName: template.fileName,
      dateFormat: YEAR_MONTH_CELL_FORMAT,
    });
  };

  return {
    ...flow,
    targetOptions,
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
    handleTemplateDownload,
  };
}

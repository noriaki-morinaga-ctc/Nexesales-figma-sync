import { useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SingleCombobox } from '@/components/ui/single-combobox';
import { ScreenTitle } from '@/components/ui/screen-title';
import { DownloadCard } from '@/components/shared/upload/DownloadCard';
import { FormField } from '@/components/shared/upload/FormField';
import { HistoryCard } from '@/components/shared/upload/HistoryCard';
import { ResultCard } from '@/components/shared/upload/ResultCard';
import { UploadCard } from '@/components/shared/upload/UploadCard';
import { useUploadFlow } from '@/components/shared/upload/useUploadFlow';
import {
  BUDGET_DEFAULT_DOWNLOAD_TARGET,
  BUDGET_DEFAULT_FISCAL_YEAR,
  BUDGET_DEFAULT_UPLOAD_TARGET,
  BUDGET_DOWNLOAD_TARGET_OPTIONS,
  BUDGET_FISCAL_YEAR_OPTIONS,
  BUDGET_UPLOAD_TARGET_OPTIONS,
} from './constants';
import {
  BUDGET_DOWNLOAD_DATASETS,
  BUDGET_INITIAL_HISTORY,
  BUDGET_SAMPLE_UPLOAD_ERRORS,
} from '@/mocks/budget/budget-reference-registration';
import type { BudgetUploadHistoryItem } from './budgetReference.types';

// ===== 予算参照登録画面 =====
// 左ペイン＝予算データのアップロード／ダウンロード、右ペイン＝アップロード履歴／選択した結果（高さ比 4:6）。
// アップロード・履歴の動きとカードはアップロード画面共通（shared/upload/）。
// この画面だけの選択肢・モックは mockData.ts、型は budgetReference.types.ts（画面のフォルダーに置く → 04）。

// 要素 id・進捗トーストの id の先頭
const ID_PREFIX = 'budget';

// 対象年度の選択肢
const FISCAL_YEAR_COMBO_OPTIONS = BUDGET_FISCAL_YEAR_OPTIONS.map((year) => ({
  value: String(year),
  label: String(year),
}));

// アップロード履歴の先頭の列（対象年度）
const HISTORY_TARGET_COLUMN: ColDef<BudgetUploadHistoryItem> = {
  field: 'uploadFiscalYear',
  headerName: '対象年度',
  width: 96,
  // 先頭列は grid.css のチェックボックス列向け規則で中央寄せになるため、
  // 先頭データ列用の ag-cell-left で左寄せに戻す
  cellClass: 'ag-cell-left',
};

// アップロードしたときに履歴に足す項目（対象年度は Make 版と同じく画面上の選択欄は無く、初期値固定）
const buildHistoryFields = async () => ({
  uploadFiscalYear: BUDGET_DEFAULT_FISCAL_YEAR,
});

export default function BudgetReferenceRegistration() {
  const u = useUploadFlow<BudgetUploadHistoryItem>({
    idPrefix: ID_PREFIX,
    targetOptions: BUDGET_UPLOAD_TARGET_OPTIONS,
    initialUploadTarget: BUDGET_DEFAULT_UPLOAD_TARGET,
    initialHistory: BUDGET_INITIAL_HISTORY,
    // 初期表示はモックの先頭の履歴を選ぶ（従来どおり）
    initialSelectedUploadId: BUDGET_INITIAL_HISTORY[0]?.uploadId ?? null,
    sampleErrors: BUDGET_SAMPLE_UPLOAD_ERRORS,
    buildHistoryFields,
  });

  // ダウンロードの条件（対象年度・ダウンロード対象）
  const [downloadFiscalYear, setDownloadFiscalYear] = useState<number>(
    BUDGET_DEFAULT_FISCAL_YEAR
  );
  const [downloadTarget, setDownloadTarget] = useState<string>(
    BUDGET_DEFAULT_DOWNLOAD_TARGET
  );

  // ダウンロード対象に応じた出力データセットを Excel に出力する
  const handleDownload = () => {
    const dataset =
      BUDGET_DOWNLOAD_DATASETS[downloadTarget] ??
      BUDGET_DOWNLOAD_DATASETS.sales_raw;
    u.downloadXlsx({
      rows: [dataset.headers, ...dataset.rows],
      colWidths: dataset.colWidths,
      sheetName: dataset.sheetName,
      fileName: dataset.fileName,
    });
  };

  return (
    // 画面いっぱいのレイアウト（→ 05）：ルートは h-full＋下限 min-h を併用し、
    // 画面が低いときは右ペインのグリッドを潰さず <main> 全体を縦スクロールさせる。
    <div className="min-w-300 h-full min-h-160 flex flex-col">
      <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
        {/* 画面名はヘッダー（システム名の右）に表示し、本文には説明だけを置く */}
        <ScreenTitle title="予算参照登録画面" />
        <div className="px-3 py-1.5 mb-1 shrink-0">
          <span className="text-xs text-gray-600">
            予算データの登録・取得・結果確認を行います
          </span>
        </div>

        {/* 2ペイン */}
        <div className="flex-1 min-h-0 grid grid-cols-[37.5rem_minmax(0,1fr)] gap-3">
          {/* 左ペイン：操作 */}
          <div className="flex flex-col gap-3 min-h-0">
            <UploadCard
              title="予算データアップロード"
              idPrefix={ID_PREFIX}
              targetOptions={BUDGET_UPLOAD_TARGET_OPTIONS}
              uploadTarget={u.uploadTarget}
              onUploadTargetChange={u.setUploadTarget}
              selectedFile={u.selectedFile}
              isDragging={u.isDragging}
              validationError={u.validationError}
              fileInputRef={u.fileInputRef}
              canUpload={u.canUpload}
              onDrop={u.handleDrop}
              onDragOver={u.handleDragOver}
              onDragLeave={u.handleDragLeave}
              onFileInputChange={u.handleFileInputChange}
              onOpenFileDialog={u.handleOpenFileDialog}
              onRemoveFile={u.handleRemoveFile}
              onUploadClick={() => u.setIsUploadConfirmDialogOpen(true)}
            />
            <DownloadCard
              title="予算データダウンロード"
              onDownload={handleDownload}
            >
              <div className="flex items-end gap-4">
                {/* 対象年度 */}
                <FormField
                  label="対象年度"
                  required
                  htmlFor="budget-download-fiscal-year"
                >
                  <SingleCombobox
                    id="budget-download-fiscal-year"
                    ariaRequired
                    className="w-27.5"
                    options={FISCAL_YEAR_COMBO_OPTIONS}
                    value={String(downloadFiscalYear)}
                    onChange={(value) => setDownloadFiscalYear(Number(value))}
                    placeholder="選択してください"
                    searchable={false}
                  />
                </FormField>

                {/* ダウンロード対象 */}
                <FormField
                  label="ダウンロード対象"
                  required
                  htmlFor="budget-download-target"
                  className="flex-1"
                >
                  <SingleCombobox
                    id="budget-download-target"
                    ariaRequired
                    className="w-full"
                    options={BUDGET_DOWNLOAD_TARGET_OPTIONS}
                    value={downloadTarget}
                    onChange={setDownloadTarget}
                    placeholder="選択してください"
                    searchable={false}
                  />
                </FormField>
              </div>
            </DownloadCard>
          </div>

          {/* 右ペイン：履歴 + 結果（高さ比 4:6、各エリアは内部で縦スクロール） */}
          <div className="grid gap-3 min-h-0 grid-rows-[4fr_6fr]">
            <HistoryCard
              history={u.sortedHistory}
              selectedUploadId={u.selectedUploadId}
              onSelectHistory={u.handleSelectHistory}
              columnStateKey="budgetReferenceRegistration.history.columnState.v1"
              targetColumnDef={HISTORY_TARGET_COLUMN}
            />
            <ResultCard
              item={u.selectedItem}
              errorColumnStateKey="budgetReferenceRegistration.errors.columnState.v1"
            />
          </div>
        </div>
      </div>

      {/* アップロード（既存データ置換）の確認ダイアログ。確定ボタンは操作名とする */}
      <ConfirmDialog
        open={u.isUploadConfirmDialogOpen}
        onOpenChange={u.setIsUploadConfirmDialogOpen}
        title="予算アップロードの確認"
        description="アップロードを実行すると、対象年度・対象区分の既存データはすべて置換されます、よろしいですか？"
        confirmLabel="アップロード"
        onConfirm={() => {
          u.setIsUploadConfirmDialogOpen(false);
          void u.handleUpload();
        }}
      />
    </div>
  );
}

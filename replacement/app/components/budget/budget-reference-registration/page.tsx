import type { ColDef } from 'ag-grid-community';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { useBudgetUpload } from './useBudgetUpload';
import { DownloadCard } from './components/DownloadCard';
import { HistoryCard } from '../../shared/upload/HistoryCard';
import type { UploadHistoryItem } from './budgetReferenceTypes';
import { ResultCard } from '../../shared/upload/ResultCard';
import { UploadCard } from '../../shared/upload/UploadCard';
import { UPLOAD_TARGET_OPTIONS } from './budgetReferenceData';
import { ScreenTitle } from '../../ui/screen-title';

// ===== 予算参照登録画面 =====
// 左ペイン＝予算データのアップロード／ダウンロード、右ペイン＝アップロード履歴／選択した結果（高さ比 4:6）。
// 状態管理=useBudgetUpload / 定数・モック=budgetReferenceData / 各カード=components/ に分割。

// アップロード履歴の先頭の列（対象年度）
const HISTORY_TARGET_COLUMN: ColDef<UploadHistoryItem> = {
  field: 'uploadFiscalYear',
  headerName: '対象年度',
  width: 96,
  // 先頭列は grid.css のチェックボックス列向け規則で中央寄せになるため、
  // 先頭データ列用の ag-cell-left で左寄せに戻す
  cellClass: 'ag-cell-left',
};

export default function BudgetReferenceRegistration() {
  const u = useBudgetUpload();

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
              idPrefix="budget"
              targetOptions={UPLOAD_TARGET_OPTIONS}
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
              downloadFiscalYear={u.downloadFiscalYear}
              onDownloadFiscalYearChange={u.setDownloadFiscalYear}
              downloadTarget={u.downloadTarget}
              onDownloadTargetChange={u.setDownloadTarget}
              onDownload={u.handleTemplateDownload}
            />
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

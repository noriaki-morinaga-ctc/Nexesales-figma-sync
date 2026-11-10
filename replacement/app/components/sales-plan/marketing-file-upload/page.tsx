import { useEffect } from 'react';
import type {
  ColDef,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { useMarketingFileUpload } from './useMarketingFileUpload';
import { DownloadCard } from './components/DownloadCard';
import { HistoryCard } from '../../shared/upload/HistoryCard';
import type { UploadHistoryItem } from './marketingFileUploadTypes';
import { formatYearMonthRange } from './marketingFileUploadUtils';
import { ResultCard } from '../../shared/upload/ResultCard';
import { UploadCard } from '../../shared/upload/UploadCard';
import { ScreenTitle } from '../../ui/screen-title';

// ===== ファイルアップロード画面（自販機） =====
// 予算参照登録画面をベースとした構成。
// 左ペイン＝アップロード／テンプレート・データダウンロード、右ペイン＝アップロード履歴／選択した結果（高さ比 4:6）。
// 状態管理=useMarketingFileUpload / 定数・モック=marketingFileUploadData / 各カード=components/ に分割。
// 販売計画・実績登録の2メニューから遷移し、jihanki によりアップロード・ダウンロード対象を切り替える。

interface MarketingFileUploadProps {
  // 実績登録メニューから遷移した場合 true（対象＝提携機／アライアンス品／販売器具費・リース料）。
  // 未指定／false は販売計画メニューからの遷移（対象＝管理対象商品目標数値／アライアンス品契約状況変動に伴う追加売上金額）
  jihanki?: boolean;
}

// アップロード履歴の先頭の列（対象年月。ファイル内の明細の対象年月で、単月は YYYY/MM、複数月は最小～最大）
const HISTORY_TARGET_COLUMN: ColDef<UploadHistoryItem> = {
  colId: 'targetYearMonthRange',
  headerName: '対象年月',
  width: 144,
  valueGetter: (params: ValueGetterParams<UploadHistoryItem>) =>
    params.data
      ? formatYearMonthRange(
          params.data.targetYearMonthFrom,
          params.data.targetYearMonthTo
        )
      : '',
  valueFormatter: (params: ValueFormatterParams<UploadHistoryItem>) =>
    params.value || '-',
  // 先頭列は grid.css のチェックボックス列向け規則で中央寄せになるため、
  // 先頭データ列用の ag-cell-left で左寄せに戻す
  cellClass: 'ag-cell-left',
};

export default function MarketingFileUpload({
  jihanki = false,
}: MarketingFileUploadProps) {
  const u = useMarketingFileUpload(jihanki);

  // 先頭入力（アップロード対象）へ初期フォーカス。描画確定後に id で取得して focus する（→ 06）
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.getElementById('marketing-upload-target')?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    // 画面いっぱいのレイアウト（→ 05）：ルートは h-full＋下限 min-h を併用し、
    // 画面が低いときは右ペインのグリッドを潰さず <main> 全体を縦スクロールさせる。
    <div className="min-w-300 h-full min-h-160 flex flex-col">
      <div className="px-6 pt-3 pb-3 flex-1 min-h-0 flex flex-col">
        {/* 画面名はヘッダー（システム名の右）に表示し、本文には説明だけを置く */}
        <ScreenTitle title="ファイルアップロード画面" />
        <div className="px-3 py-1.5 mb-1 shrink-0">
          <span className="text-xs text-gray-600">
            自販機関連データの登録・取得・結果確認を行います
          </span>
        </div>

        {/* 2ペイン */}
        <div className="flex-1 min-h-0 grid grid-cols-[37.5rem_minmax(0,1fr)] gap-3">
          {/* 左ペイン：操作 */}
          <div className="flex flex-col gap-3 min-h-0">
            <UploadCard
              title="アップロード"
              idPrefix="marketing"
              targetOptions={u.targetOptions}
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
              targetOptions={u.targetOptions}
              periodFrom={u.downloadPeriodFrom}
              periodTo={u.downloadPeriodTo}
              onPeriodFromChange={u.handleDownloadPeriodFromChange}
              onPeriodToChange={u.handleDownloadPeriodToChange}
              storeFilter={u.storeFilter}
              retailerOptions={u.storeCandidates.retailerOptions}
              tertiaryStoreOptions={u.storeCandidates.tertiaryStoreOptions}
              primaryStoreOptions={u.storeCandidates.primaryStoreOptions}
              onRetailerChange={u.handleRetailerChange}
              onTertiaryStoreChange={u.handleTertiaryStoreChange}
              onPrimaryStoreChange={u.handlePrimaryStoreChange}
              downloadTarget={u.downloadTarget}
              onDownloadTargetChange={u.handleDownloadTargetChange}
              downloadError={u.downloadError}
              onDownload={u.handleTemplateDownload}
            />
          </div>

          {/* 右ペイン：履歴 + 結果（高さ比 4:6、各エリアは内部で縦スクロール） */}
          <div className="grid gap-3 min-h-0 grid-rows-[4fr_6fr]">
            <HistoryCard
              history={u.sortedHistory}
              selectedUploadId={u.selectedUploadId}
              onSelectHistory={u.handleSelectHistory}
              columnStateKey="marketingFileUpload.history.columnState.v2"
              targetColumnDef={HISTORY_TARGET_COLUMN}
            />
            <ResultCard
              item={u.selectedItem}
              errorColumnStateKey="marketingFileUpload.errors.columnState.v1"
            />
          </div>
        </div>
      </div>

      {/* アップロードの確認ダイアログ。更新対象項目のみ更新される旨の汎用文面とする */}
      <ConfirmDialog
        open={u.isUploadConfirmDialogOpen}
        onOpenChange={u.setIsUploadConfirmDialogOpen}
        title="アップロードの確認"
        description={
          <>
            ファイルの内容で、登録済みデータの更新対象項目を更新します。
            <br />
            更新対象外の項目は変更されません。
            <br />
            アップロードしてよろしいですか？
          </>
        }
        confirmLabel="アップロード"
        onConfirm={() => {
          u.setIsUploadConfirmDialogOpen(false);
          void u.handleUpload();
        }}
      />
    </div>
  );
}

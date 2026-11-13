import { useEffect } from 'react';
import type {
  ColDef,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import { MonthYearPicker } from '@/app/components/ui/month-year-picker';
import { SingleCombobox } from '@/app/components/ui/single-combobox';
import { useMarketingFileUpload } from './useMarketingFileUpload';
import { DownloadCard } from '@/app/components/shared/upload/DownloadCard';
import { FormField } from '@/app/components/shared/upload/FormField';
import { HistoryCard } from '@/app/components/shared/upload/HistoryCard';
import type {
  UploadHistoryItem,
  UploadTargetType,
} from './marketingFileUpload.types';
import { formatYearMonthRange } from './utils';
import { ResultCard } from '@/app/components/shared/upload/ResultCard';
import { UploadCard } from '@/app/components/shared/upload/UploadCard';
import { ScreenTitle } from '@/app/components/ui/screen-title';

// ===== ファイルアップロード画面（自販機） =====
// 予算参照登録画面をベースとした構成。
// 左ペイン＝アップロード／テンプレート・データダウンロード、右ペイン＝アップロード履歴／選択した結果（高さ比 4:6）。
// アップロード・履歴の動きとカードはアップロード画面共通（shared/upload/）。
// この画面だけの状態（対象年月・対象期間・販売店など）=useMarketingFileUpload / 定数・モック=mockData / 型=marketingFileUpload.types / 処理=utils。
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
              onUploadTargetChange={(value) =>
                u.setUploadTarget(value as UploadTargetType)
              }
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
              title="テンプレート・データダウンロード"
              error={u.downloadError}
              onDownload={u.handleTemplateDownload}
            >
              {/* 対象期間（From～To）。開始＞終了を選べないよう相互に下限・上限を設定する */}
              <FormField
                label="対象期間"
                required
                labelId="marketing-download-period-label"
              >
                <div
                  role="group"
                  aria-labelledby="marketing-download-period-label"
                  className="flex items-center gap-2"
                >
                  <MonthYearPicker
                    value={u.downloadPeriodFrom}
                    onChange={u.handleDownloadPeriodFromChange}
                    max={u.downloadPeriodTo || undefined}
                    ariaLabel="対象期間（開始）"
                    required
                  />
                  <span className="text-sm text-gray-700">～</span>
                  <MonthYearPicker
                    value={u.downloadPeriodTo}
                    onChange={u.handleDownloadPeriodToChange}
                    min={u.downloadPeriodFrom || undefined}
                    ariaLabel="対象期間（終了）"
                    required
                  />
                </div>
              </FormField>

              {/* 販売店・三次店・一次店（横並び）。いずれか1つ以上の選択が必要（ダウンロード時にチェック）。
                  候補は対象期間・ダウンロード対象のデータにある店のみ。販売店を選ぶと三次店・一次店の候補をその商流に絞る */}
              <div className="grid grid-cols-3 gap-3">
                <FormField label="販売店" htmlFor="marketing-download-retailer">
                  <SingleCombobox
                    id="marketing-download-retailer"
                    options={u.storeCandidates.retailerOptions}
                    value={u.storeFilter.retailer}
                    onChange={u.handleRetailerChange}
                    placeholder="コード または 名称で検索..."
                    clearable
                  />
                </FormField>
                <FormField
                  label="三次店"
                  htmlFor="marketing-download-tertiary-store"
                >
                  <SingleCombobox
                    id="marketing-download-tertiary-store"
                    options={u.storeCandidates.tertiaryStoreOptions}
                    value={u.storeFilter.tertiaryStore}
                    onChange={u.handleTertiaryStoreChange}
                    placeholder="コード または 名称で検索..."
                    clearable
                  />
                </FormField>
                <FormField
                  label="一次店"
                  htmlFor="marketing-download-primary-store"
                >
                  <SingleCombobox
                    id="marketing-download-primary-store"
                    options={u.storeCandidates.primaryStoreOptions}
                    value={u.storeFilter.primaryStore}
                    onChange={u.handlePrimaryStoreChange}
                    placeholder="コード または 名称で検索..."
                    clearable
                  />
                </FormField>
              </div>

              {/* ダウンロード対象 */}
              <FormField
                label="ダウンロード対象"
                required
                htmlFor="marketing-download-target"
              >
                <SingleCombobox
                  id="marketing-download-target"
                  ariaRequired
                  className="w-full"
                  options={u.targetOptions}
                  value={u.downloadTarget}
                  onChange={(value) =>
                    u.handleDownloadTargetChange(value as UploadTargetType)
                  }
                  placeholder="選択してください"
                  searchable={false}
                />
              </FormField>
            </DownloadCard>
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

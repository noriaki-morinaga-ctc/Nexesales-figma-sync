import { AlertCircle, Download } from 'lucide-react';
import { Alert, AlertDescription } from '../../../ui/alert';
import { MonthYearPicker } from '../../../ui/month-year-picker';
import {
  SingleCombobox,
  type SingleComboboxOption,
} from '../../../ui/single-combobox';
import type {
  StoreFilter,
  UploadTargetOption,
  UploadTargetType,
} from '../marketingFileUploadTypes';
import {
  CARD_ICON_CLASS,
  WHITE_CARD_CLASS,
} from '../marketingFileUploadStyles';
import { CardHeader } from './CardHeader';
import { FormField } from './FormField';

interface DownloadCardProps {
  // ダウンロード対象の選択肢（表示モードにより異なる）
  targetOptions: UploadTargetOption[];
  // 対象期間（YYYY/MM）
  periodFrom: string;
  periodTo: string;
  onPeriodFromChange: (value: string) => void;
  onPeriodToChange: (value: string) => void;
  // 販売店・三次店・一次店（各コード。''＝未選択）と候補
  storeFilter: StoreFilter;
  retailerOptions: SingleComboboxOption[];
  tertiaryStoreOptions: SingleComboboxOption[];
  primaryStoreOptions: SingleComboboxOption[];
  onRetailerChange: (value: string) => void;
  onTertiaryStoreChange: (value: string) => void;
  onPrimaryStoreChange: (value: string) => void;
  downloadTarget: UploadTargetType;
  onDownloadTargetChange: (value: UploadTargetType) => void;
  // 入力エラー（対象期間の未入力・前後逆転、販売店・三次店・一次店がすべて未選択）
  downloadError: string | null;
  onDownload: () => void;
}

// 左：テンプレート・データダウンロードカード
export function DownloadCard({
  targetOptions,
  periodFrom,
  periodTo,
  onPeriodFromChange,
  onPeriodToChange,
  storeFilter,
  retailerOptions,
  tertiaryStoreOptions,
  primaryStoreOptions,
  onRetailerChange,
  onTertiaryStoreChange,
  onPrimaryStoreChange,
  downloadTarget,
  onDownloadTargetChange,
  downloadError,
  onDownload,
}: DownloadCardProps) {
  return (
    <section className={`${WHITE_CARD_CLASS} shrink-0`}>
      <CardHeader
        icon={<Download className={CARD_ICON_CLASS} aria-hidden="true" />}
        title="テンプレート・データダウンロード"
      />
      <div className="p-3 space-y-2.5">
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
              value={periodFrom}
              onChange={onPeriodFromChange}
              max={periodTo || undefined}
              ariaLabel="対象期間（開始）"
            />
            <span className="text-sm text-gray-700">～</span>
            <MonthYearPicker
              value={periodTo}
              onChange={onPeriodToChange}
              min={periodFrom || undefined}
              ariaLabel="対象期間（終了）"
            />
          </div>
        </FormField>

        {/* 販売店・三次店・一次店（横並び）。いずれか1つ以上の選択が必要（ダウンロード時にチェック）。
            候補は対象期間・ダウンロード対象のデータにある店のみ。販売店を選ぶと三次店・一次店の候補をその商流に絞る */}
        <div className="grid grid-cols-3 gap-3">
          <FormField label="販売店" htmlFor="marketing-download-retailer">
            <SingleCombobox
              id="marketing-download-retailer"
              options={retailerOptions}
              value={storeFilter.retailer}
              onChange={onRetailerChange}
              placeholder="コード または 名称で検索..."
              clearable
            />
          </FormField>
          <FormField label="三次店" htmlFor="marketing-download-tertiary-store">
            <SingleCombobox
              id="marketing-download-tertiary-store"
              options={tertiaryStoreOptions}
              value={storeFilter.tertiaryStore}
              onChange={onTertiaryStoreChange}
              placeholder="コード または 名称で検索..."
              clearable
            />
          </FormField>
          <FormField label="一次店" htmlFor="marketing-download-primary-store">
            <SingleCombobox
              id="marketing-download-primary-store"
              options={primaryStoreOptions}
              value={storeFilter.primaryStore}
              onChange={onPrimaryStoreChange}
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
            options={targetOptions}
            value={downloadTarget}
            onChange={(value) =>
              onDownloadTargetChange(value as UploadTargetType)
            }
            placeholder="選択してください"
            searchable={false}
          />
        </FormField>

        {/* 入力エラー */}
        {downloadError && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="text-xs">
              {downloadError}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onDownload}
            className="btn-toolbar-outline"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            ダウンロード
          </button>
        </div>
      </div>
    </section>
  );
}

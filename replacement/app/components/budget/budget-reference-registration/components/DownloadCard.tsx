import { Download } from 'lucide-react';
import { SingleCombobox } from '../../../ui/single-combobox';
import {
  DOWNLOAD_TARGET_OPTIONS,
  FISCAL_YEAR_OPTIONS,
} from '../budgetReferenceData';
import { CARD_ICON_CLASS, WHITE_CARD_CLASS } from '../budgetReferenceStyles';
import { CardHeader } from '../../../shared/upload/CardHeader';
import { FormField } from '../../../shared/upload/FormField';

interface DownloadCardProps {
  downloadFiscalYear: number;
  onDownloadFiscalYearChange: (year: number) => void;
  downloadTarget: string;
  onDownloadTargetChange: (value: string) => void;
  onDownload: () => void;
}

// 左：予算データダウンロードカード
export function DownloadCard({
  downloadFiscalYear,
  onDownloadFiscalYearChange,
  downloadTarget,
  onDownloadTargetChange,
  onDownload,
}: DownloadCardProps) {
  return (
    <section className={`${WHITE_CARD_CLASS} shrink-0`}>
      <CardHeader
        icon={<Download className={CARD_ICON_CLASS} aria-hidden="true" />}
        title="予算データダウンロード"
      />
      <div className="p-3 space-y-2">
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
              options={[
                ...FISCAL_YEAR_OPTIONS.map((year) => ({
                  value: String(year),
                  label: year,
                })),
              ]}
              value={String(downloadFiscalYear)}
              onChange={(value) => onDownloadFiscalYearChange(Number(value))}
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
              options={DOWNLOAD_TARGET_OPTIONS}
              value={downloadTarget}
              onChange={onDownloadTargetChange}
              placeholder="選択してください"
              searchable={false}
            />
          </FormField>
        </div>

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

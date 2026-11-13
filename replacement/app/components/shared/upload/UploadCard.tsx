import type { ChangeEvent, DragEvent, RefObject } from 'react';
import { AlertCircle, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { SingleCombobox } from '@/app/components/ui/single-combobox';
import { CARD_ICON_CLASS, WHITE_CARD_CLASS } from './uploadStyles';
import { CardHeader } from './CardHeader';
import { FilePicker } from './FilePicker';
import { FormField } from './FormField';

interface UploadCardProps<T extends string> {
  // カードの見出し（例：予算データアップロード）
  title: string;
  // 要素の id の先頭（画面ごとに一意。例：budget → budget-upload-target）
  idPrefix: string;
  // アップロード対象の選択肢（画面・表示モードにより異なる）
  targetOptions: { value: T; label: string }[];
  uploadTarget: T;
  onUploadTargetChange: (value: T) => void;
  selectedFile: File | null;
  isDragging: boolean;
  validationError: string | null;
  fileInputRef: RefObject<HTMLInputElement>;
  canUpload: boolean;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onOpenFileDialog: () => void;
  onRemoveFile: () => void;
  // アップロードボタン押下（置換確認ダイアログを開く）
  onUploadClick: () => void;
}

// 左：アップロードカード（予算参照登録・ファイルアップロード共通 → 02 §12.2）
export function UploadCard<T extends string>({
  title,
  idPrefix,
  targetOptions,
  uploadTarget,
  onUploadTargetChange,
  selectedFile,
  isDragging,
  validationError,
  fileInputRef,
  canUpload,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileInputChange,
  onOpenFileDialog,
  onRemoveFile,
  onUploadClick,
}: UploadCardProps<T>) {
  return (
    <section className={`${WHITE_CARD_CLASS} shrink-0`}>
      <CardHeader
        icon={<Upload className={CARD_ICON_CLASS} aria-hidden="true" />}
        title={title}
      />
      <div className="p-3 space-y-2.5">
        {/* アップロード対象 */}
        <FormField
          label="アップロード対象"
          required
          htmlFor={`${idPrefix}-upload-target`}
        >
          <SingleCombobox
            id={`${idPrefix}-upload-target`}
            ariaRequired
            className="w-full"
            options={targetOptions}
            value={uploadTarget}
            onChange={(value) => onUploadTargetChange(value as T)}
            placeholder="選択してください"
            searchable={false}
          />
        </FormField>

        {/* ファイル選択 */}
        <FormField
          label="ファイル"
          required
          labelId={`${idPrefix}-upload-file-label`}
        >
          <FilePicker
            labelId={`${idPrefix}-upload-file-label`}
            selectedFile={selectedFile}
            isDragging={isDragging}
            fileInputRef={fileInputRef}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onFileInputChange={onFileInputChange}
            onOpenFileDialog={onOpenFileDialog}
            onRemoveFile={onRemoveFile}
          />
        </FormField>

        {/* バリデーションエラー */}
        {validationError && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="text-xs">
              {validationError}
            </AlertDescription>
          </Alert>
        )}

        {/* アップロードボタン */}
        <div className="pt-1 flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={onUploadClick}
            disabled={!canUpload}
            className="btn-action-base btn-action-blue"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            アップロード
          </button>
          <p className="text-xs text-gray-500">
            処理状況は右側の履歴で確認してください
          </p>
        </div>
      </div>
    </section>
  );
}

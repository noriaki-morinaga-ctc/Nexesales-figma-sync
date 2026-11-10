import type { ChangeEvent, DragEvent, RefObject } from 'react';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { FILE_ACCEPT } from './uploadConstants';

interface FilePickerProps {
  // ファイル項目のラベル要素ID（aria-labelledby で参照）
  labelId: string;
  selectedFile: File | null;
  isDragging: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onOpenFileDialog: () => void;
  onRemoveFile: () => void;
}

// ファイル選択（選択済み表示／ドロップゾーン）
// ドラッグ&ドロップに加え「ファイルを選択」ボタンでキーボードからも選択できる。
export function FilePicker({
  labelId,
  selectedFile,
  isDragging,
  fileInputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileInputChange,
  onOpenFileDialog,
  onRemoveFile,
}: FilePickerProps) {
  if (selectedFile) {
    return (
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex items-center justify-between gap-2 border border-green-400 bg-green-50 rounded-md px-3 py-2 w-full"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileSpreadsheet
            className="h-5 w-5 text-green-600 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate" title={selectedFile.name}>
              {selectedFile.name}
            </p>
            <p className="text-xs text-gray-500">
              {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemoveFile}
          className="p-1.5 rounded-md text-gray-600 hover:bg-green-100 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="選択を解除"
          aria-label={`選択したファイル「${selectedFile.name}」を解除`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={`w-full border-2 border-dashed rounded-md transition-colors px-4 py-5 text-center ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gray-50/40 hover:border-gray-400 hover:bg-gray-50'
      }`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_ACCEPT}
        onChange={onFileInputChange}
        className="hidden"
        aria-labelledby={labelId}
        aria-required="true"
        tabIndex={-1}
      />
      <Upload
        className="h-8 w-8 mx-auto mb-2 text-gray-400"
        aria-hidden="true"
      />
      <p className="text-sm mb-2">ファイルをドラッグ&ドロップ、または</p>
      <button
        type="button"
        onClick={onOpenFileDialog}
        className="btn-toolbar-outline mx-auto"
      >
        ファイルを選択
      </button>
      <p className="text-xs text-gray-500 mt-2">.xlsx、.xls 形式のファイル</p>
    </div>
  );
}

import type { ReactNode } from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { CardHeader } from './CardHeader';
import { CARD_ICON_CLASS, WHITE_CARD_CLASS } from './uploadStyles';

interface DownloadCardProps {
  title: string; // カードの見出し
  // 入力エラー（ダウンロード時の条件チェック）。無い画面は省略
  error?: string | null;
  onDownload: () => void;
  // ダウンロードの条件の入力欄（画面ごとに違う。FormField で並べる）
  children: ReactNode;
}

// 左：ダウンロードカード（アップロード画面共通の枠。見出し・条件の入力欄・エラー・ダウンロードボタン）
export function DownloadCard({
  title,
  error,
  onDownload,
  children,
}: DownloadCardProps) {
  return (
    <section className={`${WHITE_CARD_CLASS} shrink-0`}>
      <CardHeader
        icon={<Download className={CARD_ICON_CLASS} aria-hidden="true" />}
        title={title}
      />
      <div className="p-3 space-y-2.5">
        {children}

        {/* 入力エラー */}
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
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

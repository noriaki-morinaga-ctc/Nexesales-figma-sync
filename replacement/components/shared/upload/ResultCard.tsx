import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  Inbox,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { UploadResultItem, UploadStatusType } from './uploadTypes';
import {
  CARD_ICON_CLASS,
  EMPTY_STATE_CLASS,
  WHITE_CARD_CLASS,
} from './uploadStyles';
import { CardHeader } from './CardHeader';
import { ErrorTable } from './ErrorTable';
import { StatusBadge } from './StatusBadge';

interface ResultCardProps {
  // 選択中のアップロード履歴（未選択は null）
  item: UploadResultItem | null;
  // エラー明細グリッドの列状態の保存キー（画面ごとに一意）
  errorColumnStateKey: string;
}

// 右：選択したアップロード結果カード
export function ResultCard({ item, errorColumnStateKey }: ResultCardProps) {
  return (
    <section className={`${WHITE_CARD_CLASS} min-h-0`}>
      <CardHeader
        icon={<AlertCircle className={CARD_ICON_CLASS} aria-hidden="true" />}
        title="選択したアップロード結果"
        right={item ? <StatusBadge status={item.status} /> : undefined}
      />

      {!item && (
        <div className={EMPTY_STATE_CLASS}>
          <Inbox className="h-8 w-8 mb-2" aria-hidden="true" />
          <p className="text-sm">
            アップロード履歴を選択すると、結果が表示されます。
          </p>
        </div>
      )}

      {item && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* 結果サマリ */}
          <div className="p-3 border-b border-gray-200 shrink-0">
            <ResultMessage status={item.status} isSysError={item.isSysError} />
          </div>

          {/* エラー明細（ステータスがエラーの場合に、行ごとのエラーを一覧表示） */}
          {item.status === 'ERROR' && (
            <ErrorTable
              errors={item.errors ?? []}
              columnStateKey={errorColumnStateKey}
            />
          )}
        </div>
      )}
    </section>
  );
}

interface ResultMessageProps {
  status: UploadStatusType;
  // システムエラーか（ERROR 時のメッセージを出し分ける）
  isSysError: boolean;
}

// ステータスに応じた結果メッセージ
function ResultMessage({ status, isSysError }: ResultMessageProps) {
  if (status === 'PROCESSING') {
    return (
      <Alert className="border-blue-300 bg-blue-50 py-2">
        <Hourglass className="h-4 w-4 text-blue-600" aria-hidden="true" />
        <AlertDescription className="text-xs text-blue-800">
          アップロード処理中です。処理が完了すると結果が表示されます。
        </AlertDescription>
      </Alert>
    );
  }
  if (status === 'COMPLETED') {
    return (
      <Alert className="border-green-500 bg-green-50 py-2">
        <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
        <AlertDescription className="text-xs text-green-800">
          アップロードは正常に完了しました。エラーはありません。
        </AlertDescription>
      </Alert>
    );
  }
  // ERROR（システムエラー／入力内容エラーで文言を出し分ける）
  return (
    <Alert variant="destructive" className="py-2">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <AlertDescription className="text-xs">
        {isSysError
          ? 'アップロード処理に失敗しました。時間をおいて再実行してください。解消しない場合はシステム管理者へ連絡してください。'
          : 'アップロード内容にエラーがあります。エラー内容を確認し、ファイルを修正して再アップロードしてください。'}
      </AlertDescription>
    </Alert>
  );
}

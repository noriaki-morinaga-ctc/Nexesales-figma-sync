// 支払回数の切替・追加の確認ダイアログ（支払詳細の各画面で共用）。
// 保存は支払回数1回ごとのため、切替時は入力中の内容が破棄される
// （→ 20260804_第26回 決定事項23・24）。
import { X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '../ui/alert-dialog';
import type { PendingPaymentRound } from './usePaymentRounds';

interface PaymentRoundConfirmDialogProps {
  // 確認対象の支払回数（null で閉じる）。
  pending: PendingPaymentRound | null;
  // 「はい」押下。
  onConfirm: () => void;
  // ×・領域外での閉じる操作。
  onCancel: () => void;
}

export function PaymentRoundConfirmDialog({
  pending,
  onConfirm,
  onCancel,
}: PaymentRoundConfirmDialogProps) {
  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        {/* ×ボタン */}
        <button
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
          onClick={onCancel}
          aria-label="閉じる"
        >
          <X className="size-6" />
          <span className="sr-only">Close</span>
        </button>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-gray-900">
            {pending?.isNew ? '支払回数追加の確認' : '支払回数切替の確認'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.isNew
              ? `支払回数「${pending.count}」を追加し、新たな入力画面を表示します。入力中の内容は破棄されます。よろしいですか？`
              : `支払回数「${pending?.count ?? ''}」の入力画面を表示します。入力中の内容は破棄されます。よろしいですか？`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-lg bg-blue-500 text-white hover:bg-blue-600"
            onClick={onConfirm}
          >
            {pending?.isNew ? '追加' : '切替'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// 支払回数の切替・追加の確認ダイアログ（支払詳細の各画面で共用）。
// 保存は支払回数1回ごとのため、切替時は入力中の内容が破棄される
// （→ 20260804_第26回 決定事項23・24）。
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import type { PendingPaymentRound } from '@/app/types/paymentDetail';

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
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={pending?.isNew ? '支払回数追加の確認' : '支払回数切替の確認'}
      description={
        pending?.isNew
          ? `支払回数「${pending.count}」を追加し、新たな入力画面を表示します。入力中の内容は破棄されます。よろしいですか？`
          : `支払回数「${pending?.count ?? ''}」の入力画面を表示します。入力中の内容は破棄されます。よろしいですか？`
      }
      confirmLabel={pending?.isNew ? '追加' : '切替'}
      onConfirm={onConfirm}
    />
  );
}

// 支払詳細(自販機)：明細削除の確認ダイアログ（分割元は紐づく分割先もまとめて削除する）

import { Button } from '@/components/ui/button';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { ExpenseItemData } from '@/features/payment/payment-detail-vending/paymentDetailVending.types';

interface DeleteDetailDialogProps {
  // ダイアログの開閉
  open: boolean;
  // 開閉の変更
  onOpenChange: (open: boolean) => void;
  // 削除する明細
  target: ExpenseItemData | null;
  // 削除する明細に分割先の明細が紐づくか
  hasDestRows: boolean;
  // 削除を実行する
  onConfirm: () => void;
}

export function DeleteDetailDialog({
  open,
  onOpenChange,
  target,
  hasDestRows,
  onConfirm,
}: DeleteDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>明細削除</DialogTitle>
          <DialogDescription>
            {hasDestRows
              ? '選択した明細と、紐づく分割先の明細をすべて削除します。よろしいですか？'
              : '選択した明細を削除してもよろしいですか？'}
          </DialogDescription>
        </DialogHeader>
        {target && (
          <div className="py-4">
            <p className="text-sm text-gray-600">
              <strong>経費項目:</strong> {target.expenseItem || '（未設定）'}
            </p>
            <p className="text-sm text-gray-600">
              <strong>金額 (円):</strong> {target.amount}
            </p>
          </div>
        )}
        <DialogFooter>
          {/* 閉じる操作は右上×（DialogContent標準）に統一する */}
          <Button
            variant="destructive"
            className="rounded-lg"
            onClick={onConfirm}
          >
            削除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

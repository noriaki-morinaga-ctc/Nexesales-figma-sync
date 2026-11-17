// 支払詳細(自販機)：固定フッター（一覧へ戻る・次の伝票へ・支払無し・コメント・差戻し／承認／検印／引戻し／申請／保存）。
// data-screen-footer は下ペインがこのバーの上へドックするための目印。

import {
  ArrowRight,
  Ban,
  Save,
  Send,
  Check,
  Undo2,
  Stamp,
  CornerUpLeft,
  ArrowLeft,
} from 'lucide-react';

import type { ConfirmAction } from '@/app/components/payment/payment-detail-vending/paymentDetailVending.types';
import { FooterCommentField } from '@/app/components/shared/common/FooterCommentField';
import {
  NO_PAYMENT_TITLE,
  type PaymentFooterActionState,
} from '@/app/utils/payment/payment-detail/paymentFooterActions';

interface PaymentDetailFooterProps {
  // 承認・差戻し等のコメント
  commentInput: string;
  // コメントの入力
  onCommentInputChange: (value: string) => void;
  // コメント履歴（右ペイン）を開く（コメント欄の右の「履歴」ボタン。UI/UX UX-107）
  onOpenHistory: () => void;
  // 支払無し（当月は支払が発生しない伝票）
  isNoPayment: boolean;
  // 支払無しの切替
  onToggleNoPayment: () => void;
  // 一覧へ戻る（確認ダイアログを開く）
  onBack: () => void;
  // 申請／引戻し／承認／検印／差戻しの確認を開く
  onConfirmAction: (action: Exclude<ConfirmAction, null>) => void;
  // 保存
  onSave: () => void;
  // ボタンの活性（ステータスで決める → paymentFooterActionStateOf。押せないボタンは灰色）
  actions: PaymentFooterActionState;
}

export function PaymentDetailFooter({
  commentInput,
  onCommentInputChange,
  onOpenHistory,
  isNoPayment,
  onToggleNoPayment,
  onBack,
  onConfirmAction,
  onSave,
  actions,
}: PaymentDetailFooterProps) {
  return (
    <div
      data-screen-footer
      className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10 mt-4 min-w-300"
    >
      <div className="flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-action-base btn-action-outline"
            onClick={onBack}
            aria-label="一覧へ戻る"
          >
            <ArrowLeft className="h-4 w-4" />
            一覧へ戻る
          </button>
          {/* 次の伝票へ：一覧の次の支払伝票へ送るためのボタン。
                現時点では画面遷移は行わない（表示のみ）。 */}
          <button
            type="button"
            className="btn-action-base btn-action-outline"
            aria-label="次の伝票へ"
          >
            <ArrowRight className="h-4 w-4" />
            次の伝票へ
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
          {/* 支払無しとコメント欄の間は全角4文字分（4rem）あける */}
          <div className="flex min-w-0 flex-1 items-center gap-16">
            {/* 支払無し：当月は支払が発生しない伝票にする。理由は支払情報の備考へ書く
                  （→ 20260724_第23回_共通 決定事項8）。 */}
            <button
              type="button"
              onClick={onToggleNoPayment}
              disabled={!actions.noPayment}
              className="btn-action-base btn-action-outline"
              aria-label={isNoPayment ? '支払無しを解除' : '支払無しにする'}
              title={NO_PAYMENT_TITLE.note}
            >
              <Ban className="h-4 w-4" />
              {isNoPayment ? '支払無しを解除' : '支払無し'}
            </button>
            {/* コメント欄（差戻し理由など） */}
            <FooterCommentField
              id="approval-comment"
              value={commentInput}
              onChange={onCommentInputChange}
              disabled={!actions.comment}
              onOpenHistory={onOpenHistory}
            />
          </div>
          <button
            className="btn-action-base btn-action-red"
            onClick={() => onConfirmAction('reject')}
            disabled={!actions.sendBack}
            aria-label="差戻し"
          >
            <Undo2 className="h-4 w-4" />
            差戻し
          </button>
          <button
            className="btn-action-base btn-action-green"
            onClick={() => onConfirmAction('approve')}
            disabled={!actions.approve}
            aria-label="承認"
          >
            <Check className="h-4 w-4" />
            承認
          </button>
          <button
            className="btn-action-base btn-action-green"
            onClick={() => onConfirmAction('seal')}
            disabled={!actions.seal}
            aria-label="検印"
          >
            <Stamp className="h-4 w-4" />
            検印
          </button>
          <button
            className="btn-action-base btn-action-outline-blue"
            onClick={() => onConfirmAction('withdraw')}
            disabled={!actions.retrieve}
            aria-label="引戻し"
          >
            <CornerUpLeft className="h-4 w-4" />
            引戻し
          </button>
          <button
            className="btn-action-base btn-action-green"
            onClick={() => onConfirmAction('apply')}
            disabled={!actions.apply}
            aria-label="申請"
          >
            <Send className="h-4 w-4" />
            申請
          </button>
          <button
            className="btn-action-base btn-action-blue"
            onClick={onSave}
            disabled={!actions.save}
            aria-label="保存"
          >
            <Save className="h-4 w-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

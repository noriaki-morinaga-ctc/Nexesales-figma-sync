// 計画詳細(自販機)：固定フッター（一覧へ戻る・コメント・差戻し／承認／引戻し／申請／保存）
// 主要アクションは shadcn Button ではなくネイティブ button ＋ globals.css の
// 共通クラス（btn-action-base ＋ 配色クラス）で組む。高さ・角丸・フォーカス
// リング・アイコンとの余白（gap）はクラス側が持つため直書きしない
// （→ 02 §6・§6「共通スタイルクラスを優先使用」）。
// 配色は 取消/差戻し=赤・承認/引戻し/申請=緑・保存=青・戻る=アウトライン
// （支払詳細(自販機)のフッターと同一）。
import { Save, Send, Check, Undo2, CornerUpLeft } from 'lucide-react';
import { FooterCommentField } from '@/app/components/shared/common/FooterCommentField';

interface PlanDetailFooterProps {
  // 承認・差戻し等のコメント
  commentInput: string;
  onCommentInputChange: (value: string) => void;
  // コメント履歴（右ペイン）の開閉（コメント欄の右の「履歴」ボタン。UI/UX UX-107）
  onOpenHistory: () => void;
  // 「一覧へ戻る」（確認ダイアログを開く）
  onBack: () => void;
}

export function PlanDetailFooter({
  commentInput,
  onCommentInputChange,
  onOpenHistory,
  onBack,
}: PlanDetailFooterProps) {
  return (
    <div className="bg-white border-t border-gray-200 px-6 py-2 sticky bottom-0 z-10">
      <div className="flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-action-base btn-action-outline"
            onClick={onBack}
            aria-label="一覧へ戻る"
          >
            <Undo2 className="h-4 w-4" />
            一覧へ戻る
          </button>
        </div>
        {/* コメント欄は伸縮させず、ボタン群とともに右詰めにする（支払詳細(自販機)と同一）。 */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
          <FooterCommentField
            id="approval-comment"
            value={commentInput}
            onChange={onCommentInputChange}
            onOpenHistory={onOpenHistory}
          />
          <button
            className="btn-action-base btn-action-red"
            aria-label="差戻し"
          >
            <CornerUpLeft className="h-4 w-4" />
            差戻し
          </button>
          <button
            className="btn-action-base btn-action-green"
            aria-label="承認"
          >
            <Check className="h-4 w-4" />
            承認
          </button>
          <button
            className="btn-action-base btn-action-outline-blue"
            aria-label="引戻し"
          >
            <CornerUpLeft className="h-4 w-4" />
            引戻し
          </button>
          <button
            className="btn-action-base btn-action-green"
            aria-label="申請"
          >
            <Send className="h-4 w-4" />
            申請
          </button>
          <button className="btn-action-base btn-action-blue" aria-label="保存">
            <Save className="h-4 w-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

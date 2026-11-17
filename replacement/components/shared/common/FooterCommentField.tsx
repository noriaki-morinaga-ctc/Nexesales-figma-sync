import { History } from 'lucide-react';

// フッターのコメント欄（申請・承認・差戻しの理由などを入力する。UI/UX UX-071 → 02 §6）
// ・項目名「コメント」＋複数行の入力欄（2行・縦に広げられる）
// ・入力欄は画面の幅に合わせて伸びる（最小 min-w-40・最大 max-w-128）。親はボタンと並べる
//   flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3 に置く
// ・案内文は「コメントを入力（差戻し理由など）」（括弧は全角）
// ・コメント履歴を開くボタンは入力欄のすぐ右に置く（アイコン＋「履歴」。UI/UX UX-107 → 02 §6）。
//   コメント履歴を開く場所はここだけにする（基本情報エリアのステータスの横などに置かない）
interface FooterCommentFieldProps {
  // 入力欄の id（項目名の htmlFor に使う）
  id: string;
  value: string;
  onChange: (value: string) => void;
  // 状態によって入力できないとき
  disabled?: boolean;
  // コメント履歴（右ペイン）を開く。渡したときだけ入力欄の右に「履歴」のボタンを出す
  onOpenHistory?: () => void;
}

export function FooterCommentField({
  id,
  value,
  onChange,
  disabled = false,
  onOpenHistory,
}: FooterCommentFieldProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <label
        htmlFor={id}
        className="text-sm font-medium whitespace-nowrap text-gray-700"
      >
        コメント
      </label>
      <textarea
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="コメントを入力（差戻し理由など）"
        rows={2}
        className="h-10 w-full max-w-128 min-w-40 resize-y rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
      />
      {onOpenHistory && (
        <button
          type="button"
          className="btn-toolbar-outline shrink-0"
          onClick={onOpenHistory}
          aria-label="コメント履歴"
          title="コメント履歴"
        >
          <History className="h-4 w-4" />
          履歴
        </button>
      )}
    </div>
  );
}

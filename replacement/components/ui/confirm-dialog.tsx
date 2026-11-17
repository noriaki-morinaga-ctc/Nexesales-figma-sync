import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./alert-dialog";

interface ConfirmDialogProps {
  /** 表示状態 */
  open: boolean;
  /** 開閉状態の変更（×・外側クリック・キャンセル時に false で呼ばれる） */
  onOpenChange?: (open: boolean) => void;
  /** タイトル */
  title?: string;
  /** 本文（確認メッセージ） */
  description: React.ReactNode;
  /** 実行ボタン押下時 */
  onConfirm: () => void;
  /** キャンセル押下時（任意） */
  onCancel?: () => void;
  /**
   * 実行ボタンのラベル（必須）。「はい」「OK」ではなく実行する操作名にする
   * （例：削除・保存・移動・変更。画面設計標準 3.8 2/2）。
   */
  confirmLabel: string;
  /** キャンセルボタンのラベル（既定: キャンセル） */
  cancelLabel?: string;
  /**
   * 実行ボタンの配色（既定: 塗り青＝メイン操作）。
   * 承認ワークフロー系の確認など、操作分類に応じて配色を変える場合に
   * commonStyles の BUTTON_STYLES（approve 等）を渡す。
   */
  confirmClassName?: string;
  /**
   * 実行する操作が無い警告（お知らせ）にする。キャンセルを出さず、ボタンは confirmLabel（例：閉じる）の1つだけ。
   * 例：未保存のまま操作したときに「先に保存してください」と知らせる（→ 02 §5）。
   */
  acknowledgeOnly?: boolean;
}

/**
 * 確認ダイアログの共通コンポーネント。
 * 「入力値がリセットされます。本当によろしいですか？」のような確認用途を、
 * 各画面で共通の見た目・挙動で利用するためのラッパー。
 * 右上の×・キャンセルは実行せずに閉じる（画面設計標準 3.6）。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title = "確認",
  description,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel = "キャンセル",
  confirmClassName,
  acknowledgeOnly = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel?.();
        onOpenChange?.(next);
      }}
    >
      <AlertDialogContent>
        {/* ×：実行せずに閉じる（キャンセルと同じ扱い） */}
        <button
          type="button"
          className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
          onClick={() => {
            onCancel?.();
            onOpenChange?.(false);
          }}
          aria-label="閉じる"
        >
          <XIcon className="size-6" />
        </button>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!acknowledgeOnly && (
            <AlertDialogCancel onClick={onCancel}>
              {cancelLabel}
            </AlertDialogCancel>
          )}
          <AlertDialogAction onClick={onConfirm} className={confirmClassName}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── React の外（グリッドの共通処理など）から確認ダイアログを出す ──────────────
// requestConfirm() を呼ぶと、App に1つだけ置いた ConfirmDialogHost が ConfirmDialog を表示し、
// 実行なら true、キャンセル・×なら false で解決する。
interface ConfirmRequest {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmClassName?: string;
}
type ConfirmListener = (request: ConfirmRequest, resolve: (ok: boolean) => void) => void;
let confirmListener: ConfirmListener | null = null;

export function requestConfirm(request: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    // 表示役が無い（テスト等）ときは確認せずに進める
    if (!confirmListener) {
      resolve(true);
      return;
    }
    confirmListener(request, resolve);
  });
}

// requestConfirm の表示役。App 全体で1つだけ置く。
export function ConfirmDialogHost() {
  const [pending, setPending] = useState<{
    request: ConfirmRequest;
    resolve: (ok: boolean) => void;
  } | null>(null);
  useEffect(() => {
    confirmListener = (request, resolve) => setPending({ request, resolve });
    return () => {
      confirmListener = null;
    };
  }, []);
  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  return (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
      title={pending?.request.title}
      description={pending?.request.description ?? ""}
      confirmLabel={pending?.request.confirmLabel ?? ""}
      confirmClassName={pending?.request.confirmClassName}
      onConfirm={() => close(true)}
    />
  );
}

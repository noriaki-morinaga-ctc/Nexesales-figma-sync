import type { ReactNode } from 'react';
import { Button } from './button';
import { RightPane } from './right-pane';
import { cn } from './utils';

// 削除確認ペインに並べる「ラベル: 値」1行分
export interface DeleteConfirmItem {
  label: string;
  value: ReactNode;
}

interface DeleteConfirmPaneProps {
  open: boolean;
  onClose: () => void;
  // ペイン見出し（例: 明細削除の確認）
  title: string;
  // スクリーンリーダー向けの説明（RightPane が sr-only で保持する）
  description?: string;
  // 確認文。対象の呼び方が画面ごとに異なるため画面側で指定する（省略時は非表示）
  message?: string;
  // 削除対象の内訳。ラベル幅は w-32 で揃える
  items: DeleteConfirmItem[];
  // items で表せない補足表示を差し込む逃げ道（内訳の末尾に描画）
  children?: ReactNode;
  onDelete: () => void;
}

// 一覧・明細の削除確認に使う共通ペイン。
// 計画詳細(マージン率固定・NET入力)の「明細削除の確認」を単一ソース化したもの。
// 削除実行の中身は画面ごとに異なるため onDelete で受け取り、
// ペインを閉じる／トーストを出すといった後処理も呼び出し側の責務とする。
export function DeleteConfirmPane({
  open,
  onClose,
  title,
  description,
  message,
  items,
  children,
  onDelete,
}: DeleteConfirmPaneProps) {
  return (
    <RightPane
      open={open}
      onClose={onClose}
      title={title}
      description={description ?? title}
      footer={
        <Button
          className="bg-red-600 hover:bg-red-700 text-white py-5 rounded-lg"
          onClick={onDelete}
        >
          削除
        </Button>
      }
    >
      <div className="space-y-4">
        {message && <p className="text-gray-700">{message}</p>}
        {/* 確認文が無い場合は上罫線を引かず、内訳がヘッダー直下から始まるようにする */}
        <div
          className={cn(
            'pb-4 border-b space-y-3',
            message ? 'pt-4 border-t' : 'pt-0',
          )}
        >
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.label} className="flex gap-2">
                <span className="font-bold text-gray-600 w-32">
                  {item.label}:
                </span>
                <span className="text-gray-900">{item.value}</span>
              </div>
            ))}
            {children}
          </div>
        </div>
      </div>
    </RightPane>
  );
}

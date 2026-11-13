// masterMessages（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）
import { MASTER_MESSAGES } from '@/app/constants/masterMessages';
import type { MasterMessageId } from '@/app/constants/masterMessages';

/** 文言に値を差し込む（{0}, {1}, …） */
export const masterMessage = (
  id: MasterMessageId,
  ...args: (string | number)[]
): string =>
  MASTER_MESSAGES[id].replace(/\{(\d+)\}/g, (_, i) =>
    String(args[Number(i)] ?? '')
  );

/** 確認ダイアログ用：1行目をタイトル、2行目以降を本文にする */
export const masterConfirmMessage = (
  id: MasterMessageId,
  ...args: (string | number)[]
): { title: string; description: string } => {
  const [title, ...rest] = masterMessage(id, ...args).split('\n');
  return { title, description: rest.join('\n') };
};

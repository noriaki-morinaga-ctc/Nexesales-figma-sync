import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { MASTER_MESSAGES } from './masterMessages';
import {
  masterConfirmMessage,
  masterMessage,
} from '@/app/utils/common/masterMessages';

// 共通メッセージ一覧（基本設計の正）とモックの定数が食い違っていないことを確かめる。
// 食い違ったら tools/master-gen/sync-messages.cjs を実行する
const require = createRequire(import.meta.url);
const { MESSAGES } =
  require('../../../docs/基本設計書/tools/specs/messages.cjs') as {
    MESSAGES: { id: string; text: string }[];
  };

describe('masterMessages', () => {
  it('共通メッセージ一覧と同じ文言である', () => {
    const byId = new Map(MESSAGES.map((m) => [m.id, m.text]));
    for (const [id, text] of Object.entries(MASTER_MESSAGES)) {
      expect(byId.get(id), id).toBe(text);
    }
  });

  it('差し込みと確認ダイアログの分割ができる', () => {
    expect(masterMessage('MSG-S-003', '戦略NET')).toBe(
      '戦略NETを登録しました。'
    );
    expect(masterConfirmMessage('MSG-C-001', '戦略NET「P0001」')).toEqual({
      title: '戦略NET「P0001」を削除します',
      description:
        '削除すると元に戻せません。内容を確認のうえ削除してください。',
    });
  });
});

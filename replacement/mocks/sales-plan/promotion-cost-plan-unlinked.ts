// 拡売費計画(紐づき無し)：コメント履歴のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/features/sales-plan/promotion-cost-plan-unlinked/page.tsx。

import type { CommentHistoryItem } from '@/components/shared/common/CommentHistoryPane';

// コメント履歴ペインのモックデータ（共通 CommentHistoryPane に渡す。古い順に並べる）。
// 販売計画の実際の流れ（未申請 → 承認待ち → 差戻し → 承認待ち → 承認済み → 確定）を、
// 操作（actionType）と、その操作の後の計画ステータス（status）で1件ずつたどれるようにする（UI/UX UX-075）。
// ※もう一つの終了ステータス「未承認確定」はシステムが自動実行するもので、
//   確定とは排他のためこの履歴には含めない（発生時は承認者・コメントを持たない）。
export const COMMENT_HISTORY_DATA: CommentHistoryItem[] = [
  {
    actionType: '保存',
    status: '未申請',
    datetime: '2025/02/20 15:54:45',
    userName: '河〇　雅◇',
    comment: '販促NETは競合対策提示条件。',
  },
  {
    actionType: '申請',
    status: '承認待ち',
    datetime: '2025/02/20 16:14:25',
    userName: '河〇　雅◇',
    comment: '販促NETは競合対策提示条件。',
  },
  {
    actionType: '差戻し',
    status: '差戻し',
    datetime: '2025/02/20 18:47:05',
    userName: '◇山　〇郎',
    comment: '函数計画を前年販売実績120%となるよう更新すること。',
  },
  {
    actionType: '申請',
    status: '承認待ち',
    datetime: '2025/02/21 9:30:45',
    userName: '河〇　雅◇',
    comment: '函数計画を前年販売実績120%となるように修正。',
  },
  {
    actionType: '承認',
    status: '承認済み',
    datetime: '2025/02/21 12:47:05',
    userName: '◇山　〇郎',
    comment: '',
  },
  {
    actionType: '確定',
    status: '確定',
    datetime: '2025/02/21 14:05:10',
    userName: '◇山　〇郎',
    comment: '内容を確認のうえ確定。',
  },
];

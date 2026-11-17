// 計画詳細(自販機)：コメント履歴（モック。バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/features/sales-plan/plan-detail-vending/page.tsx。

import type { CommentHistoryItem } from '@/components/shared/common/CommentHistoryPane';

// 共通 CommentHistoryPane に渡す履歴（古い順。ペインが新しい順に並べ替えて表示する → UI/UX UX-075）。
export const createCommentHistory = (): CommentHistoryItem[] => [
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
    comment: '函数計画を前年販売実績120%となるよう更新すること',
  },
  {
    actionType: '申請',
    status: '承認待ち',
    datetime: '2025/02/21 9:30:45',
    userName: '河〇　雅◇',
    comment: '函数計画を前年販売実績120%となるように修正しました',
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

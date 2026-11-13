// コメント履歴（右ペイン）。支払詳細の各画面と計画詳細（手売り）で共用する。
// 計画詳細は items に計画の履歴（申請・引戻し・承認・差戻し）を渡す。
// 既定のモックデータは支払のステータス遷移
//   未申請 → 承認待ち → 承認差戻し → 承認待ち → 承認 → 検印待ち → 検印差戻し → 検印待ち → 検印済
// を、操作（保存・申請・差戻し・承認・検印）と、その操作の後のステータスで表す。
// 差戻しは承認・検印のどちらから戻しても操作名は「差戻し」とし、戻された段階は
// ステータス（承認差戻し／検印差戻し）で区別する。
// 日付は支払情報の申請日（2025/10/15）を起点とする。
import { RightPane } from '@/app/components/ui/right-pane';

// コメント履歴の1件。
export interface CommentHistoryItem {
  actionType: string; // 操作種別（保存・申請・承認 等）
  status: string; // 操作の後のステータス
  datetime: string; // 操作日時（YYYY/MM/DD HH:mm:ss）
  userName: string; // 操作者
  comment: string; // コメント（空文字は本文を表示しない）
}

// コメント履歴のモックデータ（古い順に並べる）。
export const COMMENT_HISTORY_DATA: CommentHistoryItem[] = [
  {
    actionType: '保存',
    status: '未申請',
    datetime: '2025/10/15 9:12:30',
    userName: 'アサヒ　太郎',
    comment: '請求EDIの取込分に、追加口処理と拡売費の明細を入力しました。',
  },
  {
    actionType: '申請',
    status: '承認待ち',
    datetime: '2025/10/15 9:40:15',
    userName: 'アサヒ　太郎',
    comment: '10月分の拡売費支払を申請します。請求書は①02ページ分です。',
  },
  {
    actionType: '差戻し',
    status: '承認差戻し',
    datetime: '2025/10/15 11:05:48',
    userName: '◇山　〇郎',
    comment:
      'No.4 ウィルキンソンの棚替え協力費が販売計画と紐づいていません。該当の計画を確認して紐づけてください。',
  },
  {
    actionType: '保存',
    status: '承認差戻し',
    datetime: '2025/10/15 14:20:33',
    userName: 'アサヒ　太郎',
    comment:
      'No.4 を該当の販売計画に紐づけ、管理区分と施策コードを計画に合わせました。',
  },
  {
    actionType: '申請',
    status: '承認待ち',
    datetime: '2025/10/15 14:35:02',
    userName: 'アサヒ　太郎',
    comment: '差戻しのご指摘に対応したため、再度申請します。',
  },
  {
    actionType: '承認',
    status: '検印待ち',
    datetime: '2025/10/16 9:15:27',
    userName: '◇山　〇郎',
    comment: '計画との紐づけを確認しました。',
  },
  {
    actionType: '差戻し',
    status: '検印差戻し',
    datetime: '2025/10/16 16:42:10',
    userName: '河〇　雅◇',
    comment:
      '請求書番号 457805SA の請求金額と支払金額が合っていません。照合支払区分もあわせて確認してください。',
  },
  {
    actionType: '保存',
    status: '検印差戻し',
    datetime: '2025/10/17 10:08:55',
    userName: 'アサヒ　太郎',
    comment:
      '請求書と照合し、No.5 の支払金額を修正しました。照合支払区分は「数量違い」に変更しています。',
  },
  {
    actionType: '申請',
    status: '検印待ち',
    datetime: '2025/10/17 10:22:40',
    userName: 'アサヒ　太郎',
    comment: '請求金額との差額の理由は、摘要1（社内用）に記載しました。',
  },
  {
    actionType: '検印',
    status: '検印済',
    datetime: '2025/10/17 15:30:12',
    userName: '河〇　雅◇',
    comment: '',
  },
];

interface CommentHistoryPaneProps {
  open: boolean;
  onClose: () => void;
  // 表示する履歴（古い順）。未指定時は共通のモックデータを使う。
  items?: CommentHistoryItem[];
}

export function CommentHistoryPane({
  open,
  onClose,
  items = COMMENT_HISTORY_DATA,
}: CommentHistoryPaneProps) {
  // 直近の操作がペインの先頭に来るよう、新しい順で表示する。
  const view = [...items].reverse();
  return (
    <RightPane
      open={open}
      onClose={onClose}
      title="コメント履歴"
      description=""
    >
      <div className="space-y-3">
        {view.map((item, index) => (
          <div
            key={index}
            className="bg-gray-50 p-4 rounded-lg space-y-2 border border-gray-200"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-gray-900">{item.actionType}</span>
              <span className="text-sm text-gray-600">{item.datetime}</span>
              <span className="text-sm text-gray-900">{item.userName}</span>
              {/* 操作の後のステータス。承認・検印の流れが履歴で追えるようにする。 */}
              <span className="ml-auto rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs whitespace-nowrap text-gray-700">
                ステータス：{item.status}
              </span>
            </div>
            {item.comment && (
              <div className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                {item.comment}
              </div>
            )}
          </div>
        ))}
      </div>
    </RightPane>
  );
}

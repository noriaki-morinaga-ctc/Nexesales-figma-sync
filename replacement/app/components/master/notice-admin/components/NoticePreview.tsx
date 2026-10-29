import { Eye } from 'lucide-react';
import { CARD_TITLE_CLASS } from '../../../../../styles/commonStyles';
import {
  type NoticeDraft,
  bodyPreviewText,
  renderNoticeBody,
} from '../noticeStore';
import { TYPE_CONFIG } from '../noticeUi';

// ===== 編集画面プレビュー =====
// 一般画面（TOP）での見え方を、折りたたみ（一覧）と展開（詳細）の2形態で表示。

// お知らせタイトルの文字色（TOP画面のお知らせカードと同色）
const NOTICE_TITLE_COLOR_CLASS = 'text-[#385799]';

interface TypeBadgeProps {
  type: NoticeDraft['type'];
}

// バッジは「重要」のみ（badge 未定義の種別は非表示＝日時が左詰めになる）
function TypeBadge({ type }: TypeBadgeProps) {
  const cfg = TYPE_CONFIG[type];
  if (!cfg.badge) return null;
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-bold text-white ${cfg.badge}`}
    >
      {cfg.label}
    </span>
  );
}

interface NoticePreviewProps {
  draft: NoticeDraft;
}

export function NoticePreview({ draft }: NoticePreviewProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-md self-start">
      <div className="px-3 py-1.5 flex items-center gap-2">
        <Eye className="h-5 w-5 text-gray-700" aria-hidden="true" />
        <h2 className={CARD_TITLE_CLASS}>プレビュー</h2>
      </div>
      <div className="p-4 pt-1">
        <div className="bg-gray-100 rounded-md p-3">
          {/* 一覧（折りたたみ） */}
          <p className="text-xs text-gray-500 mb-1">■ 一覧（折りたたみ）</p>
          <div className="border border-gray-200 rounded-lg p-3 shadow-sm bg-white mb-3">
            <div className="flex items-center gap-2 mb-1">
              <TypeBadge type={draft.type} />
              <span className="text-xs text-gray-500">
                {draft.startAt || '（掲載日時未設定）'}
              </span>
            </div>
            <h3
              className={`text-sm font-bold mb-1 truncate ${NOTICE_TITLE_COLOR_CLASS}`}
            >
              {draft.title || '（タイトル未設定）'}
            </h3>
            <p className="text-xs text-gray-600 truncate">
              {bodyPreviewText(draft.body)}
            </p>
          </div>

          {/* 展開（詳細） */}
          <p className="text-xs text-gray-500 mb-1">■ 展開（詳細）</p>
          <div className="border border-blue-400 bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TypeBadge type={draft.type} />
              <span className="text-xs text-gray-500">{draft.startAt}</span>
            </div>
            <h3
              className={`text-sm font-bold mb-1 ${NOTICE_TITLE_COLOR_CLASS}`}
            >
              {draft.title || '（タイトル未設定）'}
            </h3>
            <div className="mt-2 pt-2 border-t border-blue-200/70 space-y-2.5">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">本文</p>
                <div className="space-y-1.5">
                  {renderNoticeBody(draft.body)}
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ※ プレビューは本文編集面からフォーカスを外した時点で更新されます。
          </p>
        </div>
      </div>
    </div>
  );
}

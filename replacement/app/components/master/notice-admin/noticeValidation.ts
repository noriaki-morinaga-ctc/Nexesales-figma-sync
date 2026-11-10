import { NOW_STR, type NoticeDraft } from './noticeStore';
import { bodyHasContent } from './noticeBody';
import { TITLE_MAX } from './NoticeUi';

// ===== お知らせ編集の入力チェック（宣言的ルール駆動） =====
export type FieldKey = 'title' | 'startAt' | 'endAt' | 'body';
export type FieldErrors = Partial<Record<FieldKey, string>>;

// 下書き・取下げから公開するボタン（公開＝下書きから／再公開＝取下げから）。それ以外の保存は undefined
export type PublishAction = 'publish' | 'republish';

// チェックの前提（押したボタンによって変わる条件）
interface ValidationContext {
  // 「今すぐ掲載する」ON かどうか（掲載開始日時の必須判定などに使う）
  publishNow: boolean;
  // 押したのが「公開」「再公開」のどちらか（それ以外は undefined）
  publishAction?: PublishAction;
}

interface ValidationRule {
  field: FieldKey;
  // 不正なら true を返す（その場合 message をエラーとして採用）
  invalid: (d: NoticeDraft, ctx: ValidationContext) => boolean;
  message: string;
  // 下書き保存のときにもこのルールを適用するか（true のときだけ下書きでも効く）。
  // 下書きの必須はタイトル・本文のみ。日時・URL等は公開時にのみチェックする。
  draft?: boolean;
}

// 現在日時は、状態の算出（displayStatus）と同じ基準時刻（NOW_STR）を使う。
// 上から順に評価し、フィールドごとに最初に該当したルールのメッセージを採用。
const VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'title',
    invalid: (d) => !d.title.trim(),
    message: 'タイトルは必須です。',
    draft: true,
  },
  {
    field: 'title',
    invalid: (d) => d.title.length > TITLE_MAX,
    message: `タイトルは${TITLE_MAX}文字以内です。`,
    draft: true,
  },
  {
    field: 'startAt',
    // 「今すぐ掲載する」ON時は掲載開始日時を入力できず（非活性）、公開時に自動設定するため必須チェックしない
    invalid: (d, { publishNow }) => !publishNow && !d.startAt.trim(),
    message: '掲載開始日時は必須です。',
  },
  {
    field: 'startAt',
    // 公開・再公開では、掲載開始日時は現在日時より未来であること（→ 7 VL-08・VL-09）。
    // 「今すぐ掲載する」ON時は押した日時を設定するため対象外。
    invalid: (d, { publishNow, publishAction }) =>
      !!publishAction && !publishNow && d.startAt <= NOW_STR,
    message: '掲載開始日時は現在日時より後にしてください。',
  },
  {
    field: 'endAt',
    invalid: (d) =>
      !!d.endAt &&
      d.endAt.trim() !== '' &&
      d.startAt.trim() !== '' &&
      d.endAt < d.startAt,
    message: '掲載終了日時は開始日時より後にしてください。',
  },
  {
    field: 'endAt',
    // 再公開では、掲載終了日時は現在日時より未来であること（→ 7 VL-09）。
    // 過去のままだと、再公開した直後に「掲載終了」になってしまうため。
    invalid: (d, { publishAction }) =>
      publishAction === 'republish' &&
      !!d.endAt &&
      d.endAt.trim() !== '' &&
      d.endAt < NOW_STR,
    message: '掲載終了日時は現在日時より後にしてください。',
  },
  {
    field: 'body',
    invalid: (d) => !bodyHasContent(d.body),
    message: '本文を入力してください。',
    draft: true,
  },
];

export const validate = (
  d: NoticeDraft,
  // 「今すぐ掲載する」ON かどうか。ON時は掲載開始日時の必須チェックを行わない。
  publishNow = false,
  // 下書き保存かどうか。下書きのときはタイトル・本文の必須のみチェックし、
  // 日時等の入力チェックは行わない（公開時にまとめてチェックする）。
  isDraft = false,
  // 押したのが「公開」「再公開」のどちらか（更新・取下げなどは undefined）
  publishAction?: PublishAction
): { fieldErrors: FieldErrors; messages: string[] } => {
  const fieldErrors: FieldErrors = {};
  for (const r of VALIDATION_RULES) {
    if (isDraft && !r.draft) continue; // 下書きは draft ルールのみ適用
    if (fieldErrors[r.field]) continue; // フィールドごと先勝ち
    if (r.invalid(d, { publishNow, publishAction }))
      fieldErrors[r.field] = r.message;
  }
  const messages = Object.values(fieldErrors).filter((m): m is string => !!m);
  return { fieldErrors, messages };
};

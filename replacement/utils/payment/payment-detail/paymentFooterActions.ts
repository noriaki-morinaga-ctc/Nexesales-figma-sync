// 支払詳細(追加口請求書有／追加口請求書無／商流販売店紐づけなし／自販機)のフッターのボタンの活性（→ 業務機能要件 55 4.レイアウト
// AF23〜AH78、52 4.レイアウト AF23〜AF77。10/03 版）。
// ボタンは常に表示し、活性はステータスと権限で決める。モックは利用者の権限を持たないため、
// 操作する人がそのボタンの権限（担当者・申請者・承認者・APM）を持つものとして、ステータスだけで判定する。
//   支払無し … 申請前（未申請・EDI登録済み・AIC登録済み）・支払無し（押すと未申請⇔支払無しを切り替える）
//   差戻し   … 承認待ち・検印待ち
//   承認     … 承認待ち（要件の「ステータスが「承認」」は承認待ちの誤記として扱う）
//   検印     … 検印待ち
//   引戻し   … 承認待ち・検印待ち
//   申請・保存 … 申請前（未申請・EDI登録済み・AIC登録済み）・差戻し（承認差戻し・検印差戻し）
// 自販機のステータス「EDI登録済み」「AIC登録済み」は未申請と、「差戻し」は承認差戻しと同じに扱う（UI/UX UX-072）。
//   コメント … 申請・引戻し・承認・差戻しのいずれかを押せるとき
// 「一覧へ戻る」は活性の条件を持たない（常に押せる）。

export interface PaymentFooterActionState {
  noPayment: boolean; // 支払無し
  comment: boolean; // コメント
  sendBack: boolean; // 差戻し
  approve: boolean; // 承認
  seal: boolean; // 検印
  retrieve: boolean; // 引戻し
  apply: boolean; // 申請
  save: boolean; // 保存
}

// 申請前のステータス（自販機の EDI登録済み・AIC登録済みを含む）。
const PRE_APPLY_STATUSES = ['未申請', 'EDI登録済み', 'AIC登録済み'];
// 申請・保存できるステータス（申請前と差戻し。自販機の「差戻し」を含む）。
const EDITABLE_STATUSES = [
  ...PRE_APPLY_STATUSES,
  '承認差戻し',
  '差戻し',
  '検印差戻し',
];
// 申請中のステータス（承認・検印の前）。
const APPLIED_STATUSES = ['承認待ち', '検印待ち'];

// ステータスからフッターのボタンの活性を求める。
export const paymentFooterActionStateOf = (
  status: string
): PaymentFooterActionState => {
  const editable = EDITABLE_STATUSES.includes(status);
  const applied = APPLIED_STATUSES.includes(status);
  const approve = status === '承認待ち';
  return {
    noPayment: PRE_APPLY_STATUSES.includes(status) || status === '支払無し',
    comment: editable || applied,
    sendBack: applied,
    approve,
    seal: status === '検印待ち',
    retrieve: applied,
    apply: editable,
    save: editable,
  };
};

// 「支払無し」ボタンの説明（マウスを乗せると出る）。理由を書く欄は、画面に実際にある欄を案内する（UI/UX UX-073）。
//   note    … 支払情報に「備考」がある画面（→ 20260724_第23回_共通 決定事項8「理由は備考欄へ書く」）
//   comment … 備考が無い画面（フッターのコメント欄へ書く）
export const NO_PAYMENT_TITLE = {
  note: '当月は支払が発生しない伝票にします。理由は支払情報の備考へ入力してください',
  comment:
    '当月は支払が発生しない伝票にします。理由は画面下部のコメントへ入力してください',
} as const;

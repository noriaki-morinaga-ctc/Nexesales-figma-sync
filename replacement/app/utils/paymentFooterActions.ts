// 支払詳細(追加口請求書有／追加口請求書無)のフッターのボタンの活性（→ 業務機能要件 55 4.レイアウト
// AF23〜AH78、52 4.レイアウト AF23〜AF77。10/03 版）。
// ボタンは常に表示し、活性はステータスと権限で決める。モックは利用者の権限を持たないため、
// 操作する人がそのボタンの権限（担当者・申請者・承認者・APM）を持つものとして、ステータスだけで判定する。
//   支払無し … 未申請・支払無し（押すと未申請⇔支払無しを切り替える）
//   差戻し   … 承認待ち・検印待ち
//   承認     … 承認待ち（要件の「ステータスが「承認」」は承認待ちの誤記として扱う）
//   検印     … 検印待ち
//   引戻し   … 承認待ち・検印待ち
//   申請・保存 … 未申請・承認差戻し・検印差戻し
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

// 申請・保存できるステータス（申請前と差戻し）。
const EDITABLE_STATUSES = ['未申請', '承認差戻し', '検印差戻し'];
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
    noPayment: status === '未申請' || status === '支払無し',
    comment: editable || applied,
    sendBack: applied,
    approve,
    seal: status === '検印待ち',
    retrieve: applied,
    apply: editable,
    save: editable,
  };
};

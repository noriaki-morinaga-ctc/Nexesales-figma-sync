// 支払詳細の共通部品（components/shared/payment/）で使う型。部品どうしが型のために参照し合わないよう、types/ に置く。

// 親（PaymentDetailWithInvoice）へ公開するハンドル。
//   addFromAddition: 追加口で「拡売費処理」を選択した行を、その他一覧の最上部に追加。
//   removeBySource : 指定の追加口行番に紐づく行を削除（追加口側で「-」に戻された時）。
// 費用振替の登録で追加する振替先明細の1件（費用振替ペインが親へ渡す）。
export interface SplitDetailItem {
  product: string; // 対象商品
  amount: number; // 分割金額
  mgmtClass: string; // 管理区分（コード）
  mgmtClassName?: string; // 管理区分名称
  mgmtCode: string; // 管理コード（コード）
  mgmtCodeName?: string; // 管理コード名称
  measureClass: string; // 施策区分
  measureCode: string; // 施策コード
  summary1: string; // 摘要1
  summary2: string; // 摘要2
  dept?: string; // 費用負担部署
  staff?: string; // 担当者
  store?: string; // 販売店
  tertiaryStore?: string; // 三次店
  primaryStore?: string; // 一次店
}

// 明細行（親行）の商流・組織列（一次店〜担当者）に表示する、画面の基本情報の値。
// 値は商流／組織マスタと同じ「名称:コード」表記で渡す
//（分割の枝番行で選択できる候補と表記を揃えるため）。
export interface ExpenseBasicInfo {
  primaryStore: string; // 一次店
  tertiaryStore: string; // 三次店
  store: string; // 販売店
  dept: string; // 費用負担部署（基本情報の「部署」）
  staff: string; // 担当者（基本情報の「営業担当者」）
}

// 計画情報の「選択」で親画面の拡売費明細へ設定する項目
//（メタブランド・サマリ商品名と、管理区分〜摘要2（社外用））。
// 拡売費一覧は管理区分・施策区分に名称を、管理コード・施策コードにコードを保持するため、
// コード・名称の双方を渡し、振り分けは親画面（拡売費一覧）側で行う。
export interface PlanFieldValues {
  planExpContent: string; // メタブランド（メタブランド名）
  product: string; // サマリ商品名
  mgmtClassCode: string; // 管理区分（区分値）
  mgmtClassName: string; // 管理区分名称
  mgmtCode: string; // 管理コード（コード）
  mgmtCodeName: string; // 管理コード名称
  measureClassCode: string; // 施策区分（区分値）
  measureClassName: string; // 施策区分名称
  measureCode: string; // 施策コード（コード）
  measureCodeName: string; // 施策コード名称
  summary1: string; // 摘要1（社内用）
  // 摘要2（社外用）は拡売費計画に存在しないため引用しない。支払時に営業担当者が入力する
  //（→ 20260821_第31回 決定事項3）。
}

// 確認ダイアログの対象。isNew=true は「＋支払回数追加」による新規の回。
export interface PendingPaymentRound {
  count: string;
  isNew: boolean;
}

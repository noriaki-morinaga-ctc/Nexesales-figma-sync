// 支払詳細(自販機)：画面の型（確認の種類・遷移先・支払明細の行・支払情報サマリの行・支払回）

// 支払確認ダイアログで扱うアクション種別
export type ConfirmAction =
  | 'apply'
  | 'withdraw'
  | 'approve'
  | 'seal'
  | 'reject'
  | null;

// 画面遷移の確認ダイアログの遷移先。「一覧へ戻る」と基本情報の販売計画書No リンクで
// 同じダイアログを使い回すため、遷移先の画面IDと確認文言をまとめて持つ。
export type NavigationTarget = 'paymentList' | 'planDetail';

// 経費項目一覧の1明細を表す型
export interface ExpenseItemData {
  id: string; // 内部識別子
  expenseItem: string; // 経費項目
  managementCategory: string; // 管理区分
  managementCode: string; // 管理コード
  amount: string; // 金額 (円)
  taxCategory: string; // 税区分（1:課税10% / 2:課税8% / 4:その他(非課税)）。税率はこの値から自動表示
  measureCategory: string; // 施策区分
  measureCode: string; // 施策コード
  invoiceNumber: string; // 請求書番号
  note1: string; // 摘要1（社内用）
  note2: string; // 摘要2（社外用）
  // 費用負担部署（"コード:名称"）。既定は自部門。グリッド列としては表示せず、
  // 分割先の費用負担部署の初期値と「他部門へ」の集計にのみ使用する。
  costBearingDept?: string;
  // ===== 分割（分割元／分割先）関連 =====
  splitRole?: 'source' | 'dest'; // 分割セットでの役割（分割元／分割先）
  splitGroupId?: string; // 同一分割セットを束ねるキー（＝分割元の id）。ソート時のセット維持に使用
  // 販売店。分割先行は分割先の店、分割元・通常行は基本情報の値（入力不可）。
  splitDestName?: string;
  splitDestDept?: string; // 分割先の費用負担部署（分割先行のみ）
  splitSourceDate?: string; // 分割/振替日（「他部門から分割/振替された経費明細」タブ専用）
  splitSourcePaymentNo?: string; // 分割/振替元の支払No（「他部門から分割/振替された経費明細」タブ専用）
  splitSourcePaymentRound?: string; // 分割/振替元の支払回数（「他部門から分割/振替された経費明細」タブ専用）
  splitSourceOffice?: string; // 分割/振替元の事業場（「他部門から分割/振替された経費明細」タブ専用）
  splitAmount?: string; // 負担金額（分割先行のみ）。支払金額(amount)とは別枠で保持する
  // 分割先行が本体項目とは別枠で保持する値。明細グリッドでは本体と同じ列で入力し、
  // 行の役割に応じて保持先だけを切り替える（dualFieldValue／dualFieldSetter）。
  // 営業担当者。分割先行は分割先の担当者、分割元・通常行は基本情報の値（入力不可）。
  splitDestManager?: string;
  splitDestMgmtCategory?: string; // 分割先の管理区分（"コード:名称"）
  splitDestMgmtCode?: string; // 分割先の管理コード（"コード:名称"）
  splitDestMeasureCategory?: string; // 分割先の施策区分（"コード:名称"）
  splitDestMeasureCode?: string; // 分割先の施策コード（"コード:名称"）
  splitDestNote1?: string; // 分割先の摘要1（社内用）
  splitDestNote2?: string; // 分割先の摘要2（社外用）
  // 三次店・一次店。分割先行は分割先の店、分割元・通常行は基本情報の値（入力不可）。
  splitTertiaryStore?: string;
  splitPrimaryStore?: string;
  splitDestGuide?: string; // 分割先の分割案内
  // ===== ロケ契約料前払金グリッド（償却情報／償却仕訳情報）関連 =====
  amortAccrualDate?: string; // 発生日(計上開始初月)
  amortStartDate?: string; // 償却期間開始
  amortEndDate?: string; // 償却期間終了
  crmCode?: string; // CRMコード
  amortMgmtCode?: string; // 償却仕訳の管理コード（"コード:名称"）
  amortMeasureCategory?: string; // 償却仕訳の施策区分（"コード:名称"）
  amortMeasureCode?: string; // 償却仕訳の施策コード（"コード:名称"）
}

// 管理項目別合計値の1行を表す型
export interface ExpenseSummaryData {
  managementCode: string; // 管理区分（コード）
  expenseItem: string; // 管理区分名称（＝経費項目名。集計の突き合わせキーも兼ねる）
  amount: string; // 支払合計 (円)
  chargeTo: string; // 他部門へ (円)（費用負担部署が自部門以外の支払金額＋分割金額）
  chargeFrom: string; // 他部門から (円)（他部門から分割/振替された金額）
  monthlyTotal: string; // 負担額合計 (円)（支払合計 − 他部門へ ＋ 他部門から）
  yearOverYear: string; // 前年比
  planAmount: string; // 計画金額
  planDifference: string; // 計画差 (円)（負担額合計 − 計画金額）
  planDifferenceRate: string; // 計画差異（％）
  differenceReason: string; // 差異理由
  aggregationAccount: string; // 集計対象の勘定科目（管理区分に対応する科目。複数ある場合は "、" 区切り）
}

// ===== 行種別の判定（行の背景色・編集可否の共用条件） =====

// 支払回数1回分のデータ（支払情報＋支払明細）。
// 支払回数プルダウンで回を切り替えると、この単位で保存／復元する。
export interface PaymentRoundData {
  // 支払情報
  paymentDestination: string;
  note: string;
  status: string; // ステータス
  applicantOffice: string; // 申請事業場
  applicantDept: string; // 申請部署
  applicant: string; // 申請者
  applicationDate: string; // 申請日
  occurrenceDate: Date;
  occurrenceDateInput: string;
  accountingDateInput: string;
  paymentScheduleDate: Date;
  paymentScheduleDateInput: string;
  // 支払明細（経費項目一覧）
  expenseData: ExpenseItemData[];
  // ロケ契約料前払金（支払明細と切り替えて表示するグリッド）
  prepaymentData: ExpenseItemData[];
}

// 引用元（「支払情報引用」で取り込む、選択した支払回数の支払情報・明細）
export interface QuoteSourceData {
  destination: string; // 支払先
  occurrenceDate: string; // 発生日
  scheduledDate: string; // 支払予定日
  note: string; // 備考
  expenseData: ExpenseItemData[]; // 経費明細
}

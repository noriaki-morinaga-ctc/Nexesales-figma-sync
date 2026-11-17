// 支払詳細の共通部品（features/payment/shared/）で使う型。部品どうしが型のために参照し合わないよう、types/ に置く。
import type { DataSource } from '@/constants/dataSource';
import type { PlanType } from '@/utils/payment/payment-detail/additionalEntryRules';
import type { CopySource } from '@/components/grid';
import type { AmountBreakdown } from '@/utils/payment/payment-detail/paymentAmountBreakdown';

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
// 値は商流／組織マスタと同じ「コード:名称」表記で渡す
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

// ───────────────────────────────────────────────
// 支払詳細(追加口請求書有)の追加口明細
// ───────────────────────────────────────────────

// 追加口明細データ（請求情報・支払情報・請求-支払・NET）
export interface AdditionalEntryData {
  isTotal?: boolean;
  lineNo: number | string;
  // データ元（請求EDI／AIC入力／手入力）。合計行は持たない（空白表示）。
  // 請求EDI・AIC入力の明細は、項目を手で直すと手入力に変わる（→ utils/payment/payment-detail/paymentDataSource）。
  dataSource?: DataSource;
  // 手で直す前の元のデータ元。活性は元のデータ元で決める（表示・集計は dataSource）。
  originDataSource?: DataSource;
  // 紐づく計画行を作った方法（一般卸メッシュ／サマリ商品）。計画に無いサマリ商品は持たない。
  // 赤表示と一般卸メッシュの自動振替の判定に使う（→ utils/payment/payment-detail/additionalEntryRules）。
  planType?: PlanType;
  // 手入力の明細でバラ単価・金額を手で直したか（直した値を計算で上書きしない → applyEntryCellEdit）。
  unitPriceManual?: boolean;
  amountManual?: boolean;
  productCode: string;
  productName: string;
  // 請求情報
  capacity: number | string; // 入数
  cases: number | string; // ケース
  loose: number | string; // バラ
  unitPrice: number | string; // バラ単価
  amount: number | string; // 金額
  // 支払情報
  payCases: number | string; // ケース
  payLoose: number | string; // バラ
  addUnit: number | string; // 追加口バラ単価
  expUnit: number | string; // 拡売費バラ単価（NET未承認）
  addAmount: number | string; // 追加口金額
  expAmount: number | string; // 拡売費金額（NET未承認）
  payAmount: number | string; // 支払金額
  // 請求-支払
  diff: number | string; // 差額
  matchType: string; // 照合支払区分
  expProcess: string; // 拡売費処理
  // NET
  seihan: number | string; // 生販
  planNet: number | string; // 計画NET
  // センターフィ率（計画情報。画面の列には出さず裏で持つダミー値 → centerFeeRateOf）。
  // センターフィ額＝社外売上高単価×数量×センターフィ率（→ computeCenterFeeAmount）。
  centerFeeRate?: number | '';
  billNet: number | string; // 請求NET
  addNet: number | string; // 支払NET（追加口分）
  payNet: number | string; // 支払NET（全体）
  billDetailNo: string; // 請求明細番号（拡売費明細の同名の項目と対応する）
  billPage: string; // 請求書ページ
  retailerName: string; // 販売店名（請求書明細から引き継ぐ表示専用項目）
  // 拡売費明細から「追加口処理」で移してきた明細。一覧が切り替わったことが分かるよう、
  // 入力セルの背景を薄い紫（GRID_COLORS.transferredBg）にする。
  fromExpense?: boolean;
  summary1?: string; // 摘要1（社内用）
  summary: string; // 摘要2（社外用）
  funcCheck: boolean | string; // 函数無効チェック
  finalNet: number | string; // 最終NET（函数無効チェックONのときに手入力する確定NET）
}

// 明細追加ペインの入力値（追加口グリッドで編集できる列＋起点となるサマリ商品名）。
export interface EntryFormValues {
  productName: string; // サマリ商品名
  payCases: string; // 支払ケース
  payLoose: string; // 支払バラ
  addNet: string; // 支払NET（追加口分）
  payNet: string; // 支払NET（全体）
  matchType: string; // 照合支払区分
  expProcess: string; // 拡売費処理
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  funcCheck: boolean; // 函数無効チェック
  finalNet: string; // 最終NET（函数無効チェックONのときに手入力する確定NET）
  billNet: string; // 請求NET（担当者が請求書を見て入力する → 補足1-5 b24.t7）
  cases: string; // ケース（請求）
  loose: string; // バラ（請求）
  // バラ単価（請求）・金額（請求）。ペインは計算した値を初めから表示し、手で直せる
  //（→ updateEntryBillingDraft）。手で直したかを unitPriceManual・amountManual で渡す。
  unitPrice: string;
  amount: string;
  // 手で直したか。省略時は、値が入っていれば手で直した値とみなす。どちらの場合も、
  // 計算した値と同じなら手で直した値として扱わない（→ createManualEntryRow）。
  unitPriceManual?: boolean;
  amountManual?: boolean;
  billPage: string; // 請求書ページ
  billDetailNo: string; // 請求明細番号
  retailerName: string; // 販売店名
}

// 拡売費一覧の「追加口処理」で追加口明細へ移す明細（拡売費明細から引き継ぐ値）
export interface ExpenseToEntryItem {
  productName: string;
  billAmount: number | string;
  payAmount: number | string;
  matchType?: string;
  summary1?: string;
  summary2?: string;
  // 拡売費明細から引き継ぐ請求書情報（追加口明細では billDetailNo／billPage に入る）。
  billNo?: string;
  billPage?: string;
}

// ───────────────────────────────────────────────
// 支払詳細(追加口請求書無)の追加口明細
// ───────────────────────────────────────────────

// 追加口明細データ（本グリッドの1行）。項目名・フィールド名は請求書有の追加口明細
// （AdditionalEntryData）に合わせる。親行・子行（枝行）は持たず、1行ずつが明細番号（No.）を持つ。
export interface WithoutInvoiceEntryRow {
  lineNo: number; // No.（明細番号。行の識別にも使う）
  productCode: string; // サマリ商品コード
  productName: string; // サマリ商品名
  capacity: number | string; // 入数
  // 計画情報
  seihan: number | string; // 社外売上高単価
  planNet: number | string; // 計画NET
  // 支払情報
  addNet: number | string; // 支払NET（追加口分）
  payCases: number | string; // ケース
  payLoose: number | string; // バラ
  addUnit: number | string; // 追加口バラ単価
  addAmount: number | string; // 追加口金額
  payAmount: number | string; // 支払金額
  summary: string; // 摘要2（社外用）
  summary1: string; // 摘要1（社内用）
}

// ── 拡売費一覧（shared/payment/payment-detail/PaymentNonProductExpensePane）の型 ──────────────

// 拡売費明細データ（Excel「拡売費」表）
// 支払回数ごとのデータセットを親（PaymentDetailWithInvoice）が保持するため export する。
export interface ExpenseRow {
  isGroup?: boolean; // グループ合計行
  isTotal?: boolean; // 総合計行
  lineNo: number | string; // 行番
  // データ元（請求EDI／AIC入力／手入力。請求EDIは支払詳細(追加口請求書有)だけ）。
  // グループ合計行・総合計行は表示しない。
  // 請求EDI・AIC入力の明細は、項目を手で直すと手入力に変わる（→ utils/payment/payment-detail/paymentDataSource）。
  dataSource?: DataSource;
  // 手で直す前の元のデータ元。活性（請求金額を直せるか等）は元のデータ元で決める。
  originDataSource?: DataSource;
  billName: string; // 卸からの請求名称（請求EDIから連携された商品名）
  // 備考（請求EDIから連携された備考）。卸によって拡売費の内容が商品名の欄と
  // 備考の欄のどちらに入るかが異なるため、両方を項目として持つ
  //（→ 20260821_第31回 決定事項8）。
  billNote: string;
  planExpContent: string; // メタブランド（メタブランド名）
  product: string; // サマリ商品名
  // 請求金額（請求書に記載された金額）。未設定の行は計画金額を表示する（実データ整備までの暫定）。
  billAmount?: number | string;
  payAmount: number | string; // 支払金額
  planAmount: number | string; // 計画金額
  taxClass: string; // 税区分
  costSplit: string; // 費用分割（ボタン以外のテキスト：分割先 等）
  mgmtClass: string; // 管理区分（コード）
  mgmtClassName: string; // 管理区分名称
  mgmtCode: string; // 管理コード（コード）
  mgmtCodeName: string; // 管理コード名称
  measureClass: string; // 施策区分
  measureCode: string; // 施策コード
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  planDiff: number | string; // 計画差異
  matchType: string; // 照合支払区分
  // ── 支払詳細(追加口請求書無)のみが持つ項目（→ 業務機能要件 52 4.レイアウト r275-283）。
  // 請求書を受領しない画面のため、稟議・勘定科目・差異理由を明細側で保持する。
  approvalNo?: string; // 稟議決裁番号
  approvalDate?: string; // 稟議決裁日（YYYY/MM/DD）
  accountAmount?: number | string; // 勘定科目別金額
  taxAmount?: number | string; // 税額
  diffReason?: string; // 差異理由（計画金額と支払金額に差が出た理由）
  // 販売計画選択の「選択内容を反映」で計画明細の項目が入った明細。
  // 反映された列のセル背景を変えて、どこに入ったかがその場で分かるようにする
  //（→ 20260821_第31回 決定事項2・宿題事項1）。
  planApplied?: boolean;
  billNo: string; // 請求書番号
  billPage: string; // 請求書ページ
  // 販売計画選択の「選択」で引き継いだ区分値・名称（販売計画側のコード体系）。
  // 拡売費一覧のマスタからは導出できないため、表示用にそのまま保持する。
  planMgmtClassCode?: string; // 管理区分（区分値）
  planMgmtCodeName?: string; // 管理コード名称
  planMeasureClassCode?: string; // 施策区分（区分値）
  planMeasureCodeName?: string; // 施策コード名称
  // 商流・組織（一次店〜担当者）。分割の枝番行のみが自身の値として保持する
  //（親行は画面の基本情報の値を表示するため保持しない）。
  splitDept?: string; // 費用負担部署
  splitStaff?: string; // 担当者
  splitStore?: string; // 販売店
  splitTertiaryStore?: string; // 三次店
  splitPrimaryStore?: string; // 一次店
  isNetUnapproved?: boolean; // 未承認NET拡売費の明細行（追加口のO列と連動）
  // 未承認NET明細の支払金額を利用者が手入力したか。
  // true の明細は追加口O列との連動（自動上書き）を行わず、手入力値を保持する。
  payAmountManual?: boolean;
  // 計画紐づけステータス：チェックあり＝紐づけ後、チェックなし＝紐づけ前。
  planLinked?: boolean;
  // 「計画なし」（紐づける計画が存在しない明細）。
  // 未紐付（planLinked が false）の行でのみ意味を持ち、アイコン押下で切り替える。
  planNoTarget?: boolean;
  // 「計画無し」列のチェック（紐づける計画が存在しない明細）。初期値は未チェック。
  // チェックすると「計画紐づけ」列が「計画無し」になり、「計画漏れ」のチェックを外す。
  planMissing?: boolean;
  // 「計画漏れ」列のチェック（計画の立て忘れである明細）。初期値は未チェック。
  // ※列は削除済み。値は他の画面（他部門から分割された経費明細）と揃えるため型に残す。
  planOmission?: boolean;
  // 追加口の「拡売費処理」から転記された行が保持する、元の追加口行番。
  // この値を持つ行のみ「追加口処理」ボタンを表示し、押下で追加口へ戻す。
  sourceLineNo?: number | string;
  // 行の追加経路（コピー＝detail／明細追加＝new）。No. 列の左端の帯で示し、保存・申請で外す。
  // showCopySourceBand を指定した画面でのみ設定する（→ 02 §10.1 コピー由来カラーバー）。
  _copySource?: CopySource;
  // 行ID（AG Grid 公式 getRowId 用。列には表示しない）。No. は未承認NET／その他の一覧で
  // 重複し、受け取る明細データにも行ごとに一意な項目が無いため、グリッド内部の識別子として持つ。
  // 一覧に入った時点で振り（assignExpenseRowIds）、セル編集・行の更新では変えない。
  _rowId?: string;
  // 明細追加・追加口からの転記・行コピーで足した順（大きいほど新しい。列には表示しない）。
  // 行コピーの行をコピー元のすぐ下へ並べるときの順番に使う（→ 02 §8「行の追加位置」・UX-112）。
  // 受け取った明細・分割の枝番行は持たない。
  _addedSeq?: number;
  // 行コピーで作った行の、コピー元の親行のキー（branchParentKeyOf の値。一覧:No.）。
  // 表示でコピー元の行のすぐ下に置くために使う（sortRowsForDisplay。列には表示しない）。
  _copyOf?: string;
}

// 引用（引用明細選択の「引用」ボタン）で追加する明細1件。
// 引用元の「明細No」は拡売費一覧の「No.」（lineNo）に対応する。
export type QuotedExpenseItem = Pick<
  ExpenseRow,
  | 'lineNo'
  | 'billName'
  | 'billNote'
  | 'planExpContent'
  | 'product'
  | 'payAmount'
  | 'planAmount'
  | 'taxClass'
  | 'mgmtClass'
  | 'mgmtCode'
  | 'measureClass'
  | 'measureCode'
  | 'summary1'
  | 'summary2'
  | 'planDiff'
  | 'matchType'
  | 'billNo'
  | 'billPage'
> &
  // 枝番行（引用元の明細No「X-N」）を分割先行として引用するための項目。
  // 分割列（costSplit＝「分割先」）と分割先グループの各列を引き継ぐ。
  Partial<
    Pick<
      ExpenseRow,
      | 'costSplit'
      | 'splitPrimaryStore'
      | 'splitTertiaryStore'
      | 'splitStore'
      | 'splitDept'
      | 'splitStaff'
    >
  >;

// 明細追加ペインの入力値（拡売費一覧で編集できる列に対応する）。
export interface ExpenseFormValues {
  billName: string; // 卸からの請求名称
  billNote: string; // 備考
  planExpContent: string; // メタブランド
  product: string; // サマリ商品名
  billAmount: string; // 請求金額
  payAmount: string; // 支払金額
  matchType: string; // 照合支払区分
  mgmtClass: string; // 管理区分（名称）
  mgmtCode: string; // 管理コード
  measureClass: string; // 施策区分（名称）
  measureCode: string; // 施策コード
  summary1: string; // 摘要1（社内用）
  summary2: string; // 摘要2（社外用）
  taxClass: string; // 税区分
  // 請求書番号・請求書ページ。入力できるのは支払詳細(追加口請求書有)のペインだけ
  //（→ 補足1-5 b30.t32・t33「手入力：明細追加で入力した値」）。ほかの画面は持たない（空欄）。
  billNo?: string;
  billPage?: string;
}

export interface PaymentNonProductExpensePaneHandle {
  // 現在の明細行を取得する（支払回数の切替時に、表示中の回のデータを退避するため）。
  getRows: () => ExpenseRow[];
  addFromAddition: (item: {
    sourceLineNo: number | string;
    product: string;
    // 追加口明細の「請求情報」の金額。拡売費明細の請求金額として引き継ぐ。
    billAmount?: number | string;
    payAmount: number | string;
    taxClass?: string;
    // 追加口明細から引き継ぐ照合支払区分・請求書情報。
    // 転記先で選択済み・入力済みの状態にするため、値をそのまま受け取る。
    matchType?: string;
    billNo?: string;
    billPage?: string;
    // 追加口明細と同名の項目（データ元・摘要1・摘要2）。内容をそのまま引き継ぐ。
    // 手で直した明細は元のデータ元も引き継ぐ（活性は元のデータ元で決めるため）。
    dataSource?: DataSource;
    originDataSource?: DataSource;
    summary1?: string;
    summary2?: string;
  }) => void;
  removeBySource: (sourceLineNo: number | string) => void;
  // 販売計画選択の「選択」：計画明細の「メタブランド」「サマリ商品名」と
  //「管理区分」〜「摘要2（社外用）」を、一覧でチェックした明細
  //（チェックボックス列）へ設定する。
  setPlanFields: (fields: PlanFieldValues) => void;
  // フッタの「保存」「申請」押下時：管理区分に応じて明細を未承認NET／その他の一覧へ移す。
  //   未承認NET → その他 ：管理区分を「1B3／値引き（売上連動）」から変更した明細
  //   その他   → 未承認NET：管理区分を「1B3／値引き（売上連動）」へ変更した明細
  // 戻り値は移動した明細の件数。
  relistByMgmtClass: () => number;
  // 「明細追加」ペインの「追加」から呼ばれ、その他拡売費の明細を1行足す。
  addManualRow: (values: ExpenseFormValues) => void;
  // フッタの「保存」「申請」押下時：コピー・明細追加の帯を外す（帯を付けない画面では何も変わらない）。
  clearSavedMarks: () => void;
}

// 拡売費一覧の画面差分。
//   'with-invoice'    … 支払詳細(追加口請求書有)。卸の請求書をもとに支払うため、
//                       未承認NET／その他の2一覧を持ち、追加口処理を持つ。
//   'without-invoice' … 支払詳細(追加口請求書無)。請求書を受領しないため区分を持たず
//                       単一の一覧とし、追加口処理を持たない
//                       （→ 業務機能要件 52 4.レイアウト r232-285）。
//                       列の見出し・その他の項目は 'with-invoice' と同じとする。
//   'no-store-link'   … 支払詳細(商流販売店紐づけなし)。'without-invoice' と同じ扱いとする
//                       （データ元・備考の列も他の2画面と同じ位置・内容で持つ）。
// 3画面とも請求との突合列（請求－支払：差額・照合支払区分）を持つ。
export type ExpensePaneVariant =
  | 'with-invoice'
  | 'without-invoice'
  | 'no-store-link';

// タイトル下の合計サマリーバーの表示値。
// 総合計と、グループ別（未承認NET拡売費／その他拡売費）の支払金額・計画金額を保持する。
// 支払詳細(追加口請求書有)は、サマリーバーの代わりに合計表（breakdown）を表示する。
export type ExpenseSummary = {
  grandPay: number;
  grandPlan: number;
  netPay: number;
  netPlan: number;
  otherPay: number;
  otherPlan: number;
  breakdown: AmountBreakdown;
};
import type { SplitAllocation } from '@/utils/payment/payment-detail/additionalEntrySplit';

// 分割先候補の商流販売店（分割先商流販売店の選択ペインの1行）。
// 販売店・三次店・一次店・部署・担当者をコードと名称に分けて持つ（親画面の表記にそろえる）。
export interface SplitDestination {
  id: string; // 商流販売店を識別するキー（三次店コード）
  storeCode: string; // 販売店コード
  storeName: string; // 販売店名称
  tertiaryCode: string; // 三次店コード
  tertiaryName: string; // 三次店名称
  primaryCode: string; // 一次店コード
  primaryName: string; // 一次店名称
  deptCode: string; // 部署コード
  deptName: string; // 部署名称
  staffCode: string; // 担当者コード
  staffName: string; // 担当者名
  planCases: number; // 計画ケース
}

// 支払回1回分の分割の状態（親画面が支払回数ごとに保持する）。
export interface AdditionalEntrySplitState {
  destIds: string[]; // 選んだ分割先（SplitDestination.id）。列の並び順を兼ねる
  allocations: SplitAllocation[]; // 明細 × 分割先ごとのケース・バラ
}

// 分割（IN）タブの追加口明細（他部署から分割された明細・全項目参照専用）。
export interface SplitInEntryRow {
  lineNo: number; // No.
  srcDept: string; // 分割元部署（コード:名称。分割（IN）の拡売費一覧の表記にそろえる）
  srcStaff: string; // 分割元担当者（コード:名称）
  srcPaymentNo: string; // 分割元支払No
  srcPaymentCount: number; // 分割元支払回数
  srcLineNo: number; // 分割元明細No
  dataSource: string; // データ元
  productCode: string; // サマリ商品コード
  productName: string; // サマリ商品名
  capacity: number; // 入数
  cases: number; // ケース
  loose: number; // バラ
  addUnit: number; // 追加口バラ単価
  addAmount: number; // 追加口金額
  addNet: number; // 支払NET（追加口分）
  billDetailNo: string; // 請求書番号
}

// 当月の販売計画（支払回数2・3の明細の計画情報）。計画NETは同じサマリ商品の計画行のうち
// 最も安い値、社外売上高単価はその行の値、計画の種類はその行を作った方法。
// 計画に無いサマリ商品（十六茶630mL24本）は計画NETを空欄にし、社外売上高単価は社外売単価マスタの値。
export interface EntryPlan {
  capacity: number;
  seihan: number;
  planNet: number | '';
  planType?: PlanType;
}

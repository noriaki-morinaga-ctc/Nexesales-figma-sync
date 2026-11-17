// 拡売費（非商品明細）データ／グリッド操作ハンドルの共有型。
// 計画詳細(卸)・拡売費計画(紐づき無し)など複数画面で同一形状のため、二重定義を避けてここへ集約する。

export interface NonProductExpenseData {
  isTotal?: boolean;
  // 行の一意キー（編集ハイライト・行更新の識別に使用）
  no?: number;
  // 共通列
  metaBrand: string;
  summaryProduct: string;
  // 拡売費（計画金額～作成者）
  exp1PlannedAmount: number;
  // 前年同月実績。実績が無い行は null（グリッドでは「-」表示）。
  // 値がある行は削除できない（削除アイコンを非活性にする）。
  exp1PriorYearActual: number | null;
  // 実績金額。支払側から連携される値のため画面では入力不可（未支払の行は null で「-」表示）。
  exp1PaymentActual?: number | null;
  exp1PostingMonth: string;
  exp1ManagementClass: string; // 管理区分（名称を保持。区分値は managementClassCodeOf で導出）
  exp1ManagementCode: string; // 管理コード（コードを保持。名称は managementCodeNameOf で導出）
  exp1AccountItem: string;
  exp1CampaignClass: string; // 施策区分（任意。名称を保持）
  exp1CampaignCode: string; // 施策コード（任意。コードを保持）
  exp1Description: string; // 摘要1（社内用）
  exp1Creator: string; // 作成者（行追加時にログインユーザー名を自動設定。編集不可）
  // 行の追加経路（カラーバー表示用）: reference=コピー元ペイン / detail=グリッドの行コピー / new=明細追加
  _copySource?: 'reference' | 'detail' | 'new';
  // 年契基本分・取組強化マージンの行（右ペインの設定から自動表示する非活性行。拡売費の明細とは別に持つ）
  _rateLinked?: 'annualContract' | 'incentive';
  // 管理区分の区分値・管理コード名称（拡売費のマスタに無い値を持つ年契基本分・取組強化マージンの行で使う）
  _managementClassCode?: string;
  _managementCodeName?: string;
}

// 編集セルの強調を消す手段（clear を持つもの）。
// 画面からは共通フック useChangedCells の resetChangedCells を { clear: resetChangedCells } で渡す。
export interface ChangedCellsClearer {
  clear: () => void;
}

// グリッドの行操作（親の追加/コピー/削除ペインから呼び出す）
export interface NonProductExpenseGridHandle {
  /** 行を追加（新規・下ペインは最下行、行コピーは afterNo の行のすぐ下） */
  // afterNo：行コピーのとき、コピー元の行の no（その行のすぐ下に入れる。省略時は最下行 → 02 §8・UX-112）
  addRow: (row: NonProductExpenseData, afterNo?: number) => void;
  /** no 一致行を更新 */
  updateRow: (row: NonProductExpenseData) => void;
  /** no 一致行を削除 */
  deleteRow: (no: number) => void;
  /** 計画保存時：コピー・追加の帯と編集セルの強調を消す（計画詳細2画面の拡売費計画で実装） */
  clearSavedMarks?: () => void;
}

// 拡売費（非商品費用）追加・編集・コピーフォームの共通型・初期値・変換ヘルパー。
// 販売計画表（小売／卸／連携なし）で共用する単一のソース。

export type ExpenseFormValues = {
  // 共通
  summaryProduct: string;
  metaBrand: string;
  // 拡売費
  exp1ManagementCode: string;
  exp1ManagementClass: string;
  exp1AccountItem: string;
  exp1CampaignClass: string; // 施策区分（任意入力）
  exp1CampaignCode: string; // 施策コード（任意入力）
  exp1Description: string;
  exp1PlannedAmount: string;
  exp1PostingMonth: string;
};

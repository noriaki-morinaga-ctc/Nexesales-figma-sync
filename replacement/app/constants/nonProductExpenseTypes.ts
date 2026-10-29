// 拡売費（非商品明細）データ／グリッド操作ハンドルの共有型。
// 計画詳細(卸)・拡売費計画(紐づき無し)など複数画面で同一形状のため、二重定義を避けてここへ集約する。
import { stripCopySource } from '../utils/copySourceMarks';

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
  exp1Description: string; // 摘要1(社内用)
  exp1Creator: string; // 作成者（行追加時にログインユーザー名を自動設定。編集不可）
  // 行の追加経路（カラーバー表示用）: reference=コピー元ペイン / detail=グリッドの行コピー / new=明細追加
  _copySource?: 'reference' | 'detail' | 'new';
  // 年契基本分・取組強化マージンの行（右ペインの設定から自動表示する非活性行。拡売費の明細とは別に持つ）
  _rateLinked?: 'annualContract' | 'incentive';
  // 管理区分の区分値・管理コード名称（拡売費のマスタに無い値を持つ年契基本分・取組強化マージンの行で使う）
  _managementClassCode?: string;
  _managementCodeName?: string;
}

// 前年実績に値がある（グリッド表示が「-」以外）か。実績がある行は削除できない。
// 判定は表示に合わせる：null / undefined / 空文字 / 「-」だけを実績なしとみなし、
// 0 は「0」と表示されるため実績ありとして扱う。
// 販売計画(詳細)のように前年実績列が複数ある場合は、いずれか1つでも値があれば true。
export function hasPriorYearActual(
  ...values: (number | string | null | undefined)[]
): boolean {
  return values.some((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'number') return true;
    const trimmed = v.trim();
    return trimmed !== '' && trimmed !== '-' && trimmed !== '－';
  });
}

// サマリ商品名が選択されているか（「ー（指定なし）」・空文字は未選択とみなす）。
// サマリ商品名からメタブランドが決まるため、メタブランド編集不可の判定に使う
// （サマリ商品名をクリアすると再び選択できる）。
export function hasSummaryProduct(row?: { summaryProduct?: string }): boolean {
  return !!row?.summaryProduct && row.summaryProduct !== '-';
}

// メタブランド列が編集可能か（合計行は常に不可。サマリ商品名の選択中も不可）。
export function isMetaBrandEditable(row?: {
  isTotal?: boolean;
  summaryProduct?: string;
}): boolean {
  return !row?.isTotal && !hasSummaryProduct(row);
}

// 計画保存時：拡売費計画グリッドの帯（コピー・追加由来）と編集セルの強調を消す。
// 帯は stripCopySource で外し（帯を持つ行が無ければ同じ配列を返す＝再描画抑止）、
// 編集セルの強調は呼び出し側が保持する Set（changedCellsRef）をその場で空にする。
export function clearExpenseSavedMarks(
  rows: NonProductExpenseData[],
  changedCells: Set<string>
): NonProductExpenseData[] {
  changedCells.clear();
  return stripCopySource(rows);
}

// グリッドの行操作（親の追加/コピー/削除ペインから呼び出す）
export interface NonProductExpenseGridHandle {
  /** 合計行の直下（先頭）に行を追加 */
  addRow: (row: NonProductExpenseData) => void;
  /** no 一致行を更新 */
  updateRow: (row: NonProductExpenseData) => void;
  /** no 一致行を削除 */
  deleteRow: (no: number) => void;
  /** 計画保存時：コピー・追加の帯と編集セルの強調を消す（計画詳細2画面の拡売費計画で実装） */
  clearSavedMarks?: () => void;
}

// 支払詳細(追加口請求書有／追加口請求書無)の明細の「データ元」の決まり。
//
// 請求EDI・AIC入力 の明細は、その行のどの項目を手で直しても、データ元が「手入力」に変わる
//（→ 補足1-5 b21.t5・b30.t6、補足1-6 b26.t3、補足3-2 r52。利用者の決定 2026-10-03）。
//   ・表示（データ元の列）と合計表のデータ元別の振り分けは「手入力」になる
//   ・活性（どの項目を直せるか）は元のデータ元のまま。例：請求EDI の行は手入力になっても
//     請求情報（請求金額など）を直せない。そのため元のデータ元を行に持っておく
//   ・値を元に戻しても（Undo を含む）手入力のままとする（要件に戻す決まりが無いため）
// 請求書無の追加口明細はデータ元の区分を持たず、値も直せないため対象外。
import {
  DEFAULT_DATA_SOURCE,
  type DataSource,
} from '@/app/constants/dataSource';

// データ元を持つ明細行（追加口明細・拡売費明細）。
export interface DataSourceRow {
  dataSource?: DataSource; // 表示・集計に使うデータ元
  originDataSource?: DataSource; // 手で直す前の元のデータ元（活性の判定に使う）
}

// 行を手で直したときに呼ぶ。データ元を「手入力」にし、元のデータ元を残す。
// データ元が変わったときだけ true を返す（すでに手入力の行は変えない）。
export const markManualEdit = (row: DataSourceRow): boolean => {
  if (!row.dataSource || row.dataSource === DEFAULT_DATA_SOURCE) return false;
  row.originDataSource = row.originDataSource ?? row.dataSource;
  row.dataSource = DEFAULT_DATA_SOURCE;
  return true;
};

// 活性の判定に使うデータ元（手で直す前のデータ元）。
export const originDataSourceOf = (
  row: DataSourceRow | undefined
): DataSource | undefined => row?.originDataSource ?? row?.dataSource;

// 拡売費明細の行（分割の枝番行の親子を判定する項目だけ）。
export interface ExpenseDataSourceRow extends DataSourceRow {
  lineNo: number | string;
  costSplit?: string; // 「分割先」は分割の枝番行（No.＝親No.-枝番）
  isNetUnapproved?: boolean; // 未承認NETの一覧の行（No. は一覧ごとに振る）
}

// 分割の枝番行が、指定した親行の内訳か（同じ一覧で No. が「親No.-枝番」）。
const isBranchOf = (
  row: ExpenseDataSourceRow,
  parent: ExpenseDataSourceRow
): boolean =>
  row.costSplit === '分割先' &&
  !!row.isNetUnapproved === !!parent.isNetUnapproved &&
  String(row.lineNo).startsWith(`${parent.lineNo}-`);

// 拡売費明細の請求書番号・請求書ページを直せるか（支払詳細(追加口請求書有・無)）。
// 元のデータ元が手入力の明細（明細追加・コピーで作った明細）だけ直せる（→ 補足1-5 b30.t32・t33
// 「手入力：明細追加で入力した値」。利用者の決定 2026-10-04）。請求EDI・AIC入力の明細は請求詳細の値を
// 持つため、手で直して手入力になっても直せない（活性は元のまま）。
// 枝番行は親の値を表示する列のため直せない。未承認NETの明細は追加口明細から作る明細のため対象外。
// 請求書無も紙の請求書を明細追加で手入力するため、手入力の明細は同じく直せる（→ C80。
// 以前の「請求書無は直せない（Change 12-1 の決定）」を改めた）。
// hasInvoiceRefInput は、画面が請求書番号・請求書ページの入力欄を持つか
//（商流販売店紐づけなしは持たないため false）。
export const isExpenseInvoiceRefEditable = (
  row:
    | (ExpenseDataSourceRow & { isGroup?: boolean; isTotal?: boolean })
    | undefined,
  hasInvoiceRefInput: boolean
): boolean =>
  hasInvoiceRefInput &&
  !!row &&
  !row.isGroup &&
  !row.isTotal &&
  row.costSplit !== '分割先' &&
  !row.isNetUnapproved &&
  originDataSourceOf(row) === DEFAULT_DATA_SOURCE;

// 拡売費明細のセルを手で直したときに呼ぶ。直した明細（枝番行を直したときは親の明細）を手入力にし、
// 枝番行のデータ元も親に合わせる（枝番行は親の明細の内訳のため）。
// データ元が変わった行を返す（画面はこの行を再描画する）。
export const markExpenseManualEdit = <T extends ExpenseDataSourceRow>(
  rows: readonly T[],
  edited: T
): T[] => {
  const parent =
    edited.costSplit === '分割先'
      ? rows.find(
          (r) =>
            r.costSplit !== '分割先' &&
            !!r.isNetUnapproved === !!edited.isNetUnapproved &&
            String(edited.lineNo).startsWith(`${r.lineNo}-`)
        )
      : edited;
  if (!parent || !markManualEdit(parent)) return [];
  const branches = rows.filter((r) => isBranchOf(r, parent));
  branches.forEach((branch) => {
    branch.dataSource = parent.dataSource;
    branch.originDataSource = parent.originDataSource;
  });
  return [parent, ...branches];
};

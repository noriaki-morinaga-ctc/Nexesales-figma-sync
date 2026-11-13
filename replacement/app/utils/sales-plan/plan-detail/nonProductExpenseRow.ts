// 拡売費（非商品明細）の行の判定・保存時の後始末（計画詳細・拡売費計画など複数画面で使う）。
// 型は types/nonProductExpense.ts に置く。
import { stripCopySource } from '@/app/utils/common/copySourceMarks';
import type {
  ChangedCellsClearer,
  NonProductExpenseData,
} from '@/app/types/nonProductExpense';

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
// 編集セルの強調は呼び出し側から渡された changedCells.clear() で消す。
export function clearExpenseSavedMarks(
  rows: NonProductExpenseData[],
  changedCells: ChangedCellsClearer
): NonProductExpenseData[] {
  changedCells.clear();
  return stripCopySource(rows);
}

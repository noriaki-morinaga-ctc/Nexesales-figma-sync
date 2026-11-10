// 明細グリッドの行の追加経路（コピー由来カラーバー）を付ける・外す（純粋関数）。
// 帯の表示は No. 列などの左端の列の cellStyle で copySourceLeftBorder() が行う
//（→ guidelines/02_component-rules.md §10.1 コピー由来カラーバー）。
// React / AG Grid に依存させず、単体テストで確認できるようにする。
import type { CopySource } from '../../components/grid';

/** 追加経路を持てる行 */
export interface CopySourceMarked {
  _copySource?: CopySource;
}

/**
 * コピー・明細追加で作った行に追加経路を付ける。
 * 帯を付けない画面（enabled=false）では行をそのまま返し、従来の行データを変えない。
 * コピー元の行が別の追加経路を持っていても、指定した経路で上書きする。
 */
export function markCopySource<T extends CopySourceMarked>(
  row: T,
  source: CopySource,
  enabled: boolean
): T {
  if (!enabled) return row;
  return { ...row, _copySource: source };
}

/**
 * 保存・申請時に追加経路（帯）を外す。
 * 帯を持つ行だけ新しい行にし、1件も無ければ同じ配列を返す（不要な再描画を起こさない）。
 */
export function stripCopySource<T extends CopySourceMarked>(rows: T[]): T[] {
  if (!rows.some((r) => r._copySource)) return rows;
  return rows.map((r) =>
    r._copySource ? { ...r, _copySource: undefined } : r
  );
}

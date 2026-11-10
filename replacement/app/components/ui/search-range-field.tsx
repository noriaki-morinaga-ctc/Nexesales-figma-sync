import type { ReactNode } from 'react';

import {
  SEARCH_LABEL_CLASS,
  SEARCH_LABEL_WIDTH_CLASS,
} from '../../../styles/commonStyles';

interface SearchRangeFieldProps {
  // 項目名（ラベル）。開始の入力欄の左に置く
  label: ReactNode;
  // ラベルと紐付ける開始の入力欄の id（部品が id を受け取れない場合は省略）
  htmlFor?: string;
  // 範囲全体の名前（読み上げ用。例：「検索対象年月の範囲」）
  groupLabel: string;
  // 開始・終了の入力欄（年月・年月日の部品。className="w-full" を付けて渡す）
  start: ReactNode;
  end: ReactNode;
  // 行の先頭に置くときの列の指定（例：'col-start-1'）。開始側のセルに付ける
  startClassName?: string;
}

// 一覧画面の検索条件（SEARCH_GRID_CLASS の5列）の範囲指定（開始～終了）。
// 2列分を使い、開始は1列目の入力欄、終了は2列目の入力欄の幅いっぱいに置く。
// 「～」は2列目のラベルの位置に置く。開始・終了の左右の端が他の行の入力欄と同じ縦の線にそろい、
// 画面の拡大・縮小で列の幅が変わっても線がずれない（UI/UX UX-029 → 05「一覧画面の検索条件」）。
// 2つのセルを検索条件の grid の子にするため、外側は display: contents のグループにする。
export function SearchRangeField({
  label,
  htmlFor,
  groupLabel,
  start,
  end,
  startClassName = '',
}: SearchRangeFieldProps) {
  return (
    <div role="group" aria-label={groupLabel} className="contents">
      <div className={`flex min-w-0 items-center gap-2 ${startClassName}`}>
        <label htmlFor={htmlFor} className={SEARCH_LABEL_CLASS}>
          {label}
        </label>
        <div className="flex min-w-0 flex-1">{start}</div>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={`flex shrink-0 justify-center text-sm text-gray-700 ${SEARCH_LABEL_WIDTH_CLASS}`}
        >
          ～
        </span>
        <div className="flex min-w-0 flex-1">{end}</div>
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';

import {
  FIT_CELL_CLASS,
  FIT_LABEL_CLASS,
  FIT_WIDE_CELL_CLASS,
  SEARCH_LABEL_CLASS,
} from '@/styles/commonStyles';

interface SearchRangeFieldProps {
  // 項目名（ラベル）。開始の入力欄の左に置く
  label: ReactNode;
  // ラベルと紐付ける開始の入力欄の id（部品が id を受け取れない場合は省略）
  htmlFor?: string;
  // 範囲全体の名前（読み上げ用。例：「検索対象年月の範囲」）
  groupLabel: string;
  // 開始・終了の入力欄（年月・年月日の部品。className="w-full" と compact を付けて渡す）
  start: ReactNode;
  end: ReactNode;
  // 行の先頭に置くときの列の指定（例：'col-start-1'）
  startClassName?: string;
  // 項目名が収まらない画面の並び（FIT_GRID_CLASS の中に置く）。項目名・値の2トラックの1項目にする
  fit?: boolean;
  // 2項目分を使う。年月日（YYYY/MM/DD）の範囲は1項目分に2つ並べると日付が切れるため付ける。
  // 開始は1列目・終了は2列目の入力欄の位置に置き、どちらもほかの項目の入力欄と同じ幅にする。
  // 「～」は開始の欄と終了の欄のあいだの真ん中に置く（年月の範囲は1項目分のまま → 05「一覧画面の検索条件」・UI/UX UX-092・UX-093）
  wide?: boolean;
}

// 一覧画面の検索条件（SEARCH_GRID_CLASS の5列）の範囲指定（開始～終了）。
// 開始～終了をセットで1項目分に置く（他の項目と同じ幅。UI/UX UX-058 → 05「一覧画面の検索条件」）。
// 入力欄の幅を開始・終了で等分し、間に「～」を置く。1項目分に2つ並べると狭いため、
// 年月・年月日の部品は compact（カレンダーのアイコンなし・×はマウスを乗せたとき・×にフォーカスがあるときだけ）で渡す。
export function SearchRangeField({
  label,
  htmlFor,
  groupLabel,
  start,
  end,
  startClassName = '',
  fit = false,
  wide = false,
}: SearchRangeFieldProps) {
  const tilde = (
    <span aria-hidden="true" className="shrink-0 text-sm text-gray-700">
      ～
    </span>
  );

  // 2項目分（fit）：親の4トラック（項目名・値・項目名・値）をそのまま受け継ぎ、
  // 開始を1つ目の値、「～」を2つ目の項目名のトラックの真ん中、終了を2つ目の値の位置に置く。
  if (wide && fit) {
    return (
      <div
        role="group"
        aria-label={groupLabel}
        className={`${FIT_WIDE_CELL_CLASS} ${startClassName}`}
      >
        <label htmlFor={htmlFor} className={FIT_LABEL_CLASS}>
          {label}
        </label>
        <div className="flex min-w-0">{start}</div>
        {/* 項目名のトラック（両側の間隔 gap-x-2 は同じ）の真ん中に置く */}
        <div className="flex justify-center">{tilde}</div>
        <div className="flex min-w-0">{end}</div>
      </div>
    );
  }

  // 2項目分：親の格子の2列（幅・間隔）をそのまま受け継ぎ、開始を1列目、終了を2列目の入力欄の位置に置く。
  // 「～」は開始の欄と終了の欄のあいだの真ん中。
  if (wide) {
    return (
      <div
        role="group"
        aria-label={groupLabel}
        className={`col-span-2 grid grid-cols-subgrid items-center ${startClassName}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <label htmlFor={htmlFor} className={SEARCH_LABEL_CLASS}>
            {label}
          </label>
          <div className="flex min-w-0 flex-1">{start}</div>
        </div>
        <div className="flex min-w-0 items-center">
          {/* 開始の欄の右端から終了の欄の左端まで（列の間隔 1.25rem＋項目名 5.625rem＋0.5rem＝7.375rem）の真ん中に置く */}
          <div className="-ml-5 flex w-[7.375rem] shrink-0 justify-center">
            {tilde}
          </div>
          <div className="flex min-w-0 flex-1">{end}</div>
        </div>
      </div>
    );
  }

  const inputs = (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <div className="flex min-w-0 flex-1">{start}</div>
      {tilde}
      <div className="flex min-w-0 flex-1">{end}</div>
    </div>
  );
  if (fit) {
    return (
      <div
        role="group"
        aria-label={groupLabel}
        className={`${FIT_CELL_CLASS} ${startClassName}`}
      >
        <label htmlFor={htmlFor} className={FIT_LABEL_CLASS}>
          {label}
        </label>
        {inputs}
      </div>
    );
  }
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={`flex min-w-0 items-center gap-2 ${startClassName}`}
    >
      <label htmlFor={htmlFor} className={SEARCH_LABEL_CLASS}>
        {label}
      </label>
      {inputs}
    </div>
  );
}

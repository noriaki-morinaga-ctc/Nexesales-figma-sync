// 計画系画面の「基本情報」カード内で使う参照専用フィールドの共通レイアウト。
// 計画詳細(マージン率固定・NET入力)（PlanSearchPane）の基本情報と同じ体裁
// ―― 等幅5列グリッド／ラベルは固定幅・右寄せ／値は「コード:名称」の1行表示 ―― を
// 他の計画系画面へ同一の見た目で展開するために切り出したもの。

import type { ReactNode } from 'react';
import { FORM_LABEL_CLASS, FORM_VALUE_CLASS } from '../../../styles/commonStyles';

// ラベル幅の既定値（計画詳細(マージン率固定・NET入力)と同一）。
// 既定幅に収まらない長いラベルを持つ画面のみ、画面内で幅を揃えて上書きする。
export const PLAN_BASIC_INFO_LABEL_WIDTH = 'w-[5.3125rem]';

interface PlanBasicInfoRowProps {
  children: ReactNode;
  // 行下の区切り罫線。カード内の最終行のみ false にする。
  divider?: boolean;
}

// 基本情報の1行（等幅5列グリッド）。列数を固定することで行をまたいで項目が縦に揃う。
export function PlanBasicInfoRow({
  children,
  divider = true,
}: PlanBasicInfoRowProps) {
  return (
    <div
      className={`grid grid-cols-5 gap-3${
        divider ? ' mb-2 pb-3 border-b border-gray-300' : ''
      }`}
    >
      {children}
    </div>
  );
}

interface PlanBasicInfoFieldProps {
  label: string;
  // 表示値。「コード:名称」形式は呼び出し側で joinCodeName() を使って整形する。
  value?: ReactNode;
  // ラベル幅クラス（既定は PLAN_BASIC_INFO_LABEL_WIDTH）。
  labelWidthClass?: string;
  // 占有する列数のクラス（既定は1列）。取引先名など長い値を持つ項目で 'col-span-2' 等を渡す。
  colSpanClass?: string;
  // 値の右へ並べる要素（コメント履歴ボタン等）。
  trailing?: ReactNode;
}

// 基本情報の1項目（ラベル＋参照専用値）。5列グリッドの1セルとして配置する。
export function PlanBasicInfoField({
  label,
  value,
  labelWidthClass = PLAN_BASIC_INFO_LABEL_WIDTH,
  colSpanClass,
  trailing,
}: PlanBasicInfoFieldProps) {
  return (
    <div
      className={`flex items-center gap-2${colSpanClass ? ` ${colSpanClass}` : ''}`}
    >
      <label
        className={`${FORM_LABEL_CLASS} whitespace-nowrap ${labelWidthClass} px-2 py-1 text-right`}
      >
        {label}
      </label>
      {/* 付随要素がある場合は値を内容幅に留め、ボタンが値の直後に並ぶようにする */}
      <div
        className={`h-8 flex items-center ${FORM_VALUE_CLASS} ${
          trailing ? 'whitespace-nowrap px-2' : 'flex-1'
        }`}
      >
        {value}
      </div>
      {trailing}
    </div>
  );
}

// 5列グリッドの空きセル（項目が5個未満の行で、後続の列位置を揃えるために置く）。
export function PlanBasicInfoSpacer() {
  return <div className="flex items-center gap-2" />;
}

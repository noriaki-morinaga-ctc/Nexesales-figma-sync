// 計画系画面の「基本情報」カード内で使う参照専用フィールドの共通レイアウト。
// 計画一覧の検索エリアと同じ並び ―― 5列グリッド（SEARCH_GRID_CLASS）／
// ラベルは SEARCH_LABEL_CLASS（幅 5.625rem・右寄せ）／値は「コード:名称」の1行表示 ―― を
// 計画系画面へ同一の見た目で展開するために切り出したもの（→ 05 §フォーム項目レイアウト）。
// 項目名が 5.625rem に収まらない画面は、行を PlanBasicInfoFitGrid で包むと、項目名の列を
// その列で一番長い項目名の幅に合わせる並び（FIT_GRID_CLASS → 05「ラベルが幅に収まらない画面」）になる。

import { createContext, useContext, type ReactNode } from 'react';
import {
  FIT_CELL_CLASS,
  FIT_GRID_CLASS,
  FIT_LABEL_CLASS,
  FIT_ROW_CLASS,
  FIT_WIDE_CELL_CLASS,
  FIT_WIDE_VALUE_CLASS,
  FORM_VALUE_CLASS,
  SEARCH_GRID_CLASS,
  SEARCH_LABEL_CLASS,
} from '@/styles/commonStyles';

// PlanBasicInfoFitGrid の中か（行・項目を subgrid の並びにする）
const PlanBasicInfoFitContext = createContext(false);

interface PlanBasicInfoFitGridProps {
  children: ReactNode;
}

// 項目名が 5.625rem に収まらない画面の基本情報。中の PlanBasicInfoRow は親の列を受け継ぐため、
// 行を区切り線で分けても列の縦の線がそろう。
export function PlanBasicInfoFitGrid({ children }: PlanBasicInfoFitGridProps) {
  return (
    <div className={FIT_GRID_CLASS}>
      <PlanBasicInfoFitContext.Provider value={true}>
        {children}
      </PlanBasicInfoFitContext.Provider>
    </div>
  );
}

interface PlanBasicInfoRowProps {
  children: ReactNode;
  // 行下の区切り罫線。カード内の最終行のみ false にする。
  divider?: boolean;
}

// 基本情報の1行（5列グリッド）。列数を固定することで行をまたいで項目が縦に揃う。
export function PlanBasicInfoRow({
  children,
  divider = true,
}: PlanBasicInfoRowProps) {
  const fit = useContext(PlanBasicInfoFitContext);
  return (
    <div
      className={`${fit ? FIT_ROW_CLASS : SEARCH_GRID_CLASS}${
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
  // 占有する列数のクラス（既定は1列）。取引先名など長い値を持つ項目で 'col-span-2' 等を渡す。
  colSpanClass?: string;
  // 値の右へ並べる要素（コメント履歴ボタン等）。
  trailing?: ReactNode;
}

// 基本情報の1項目（ラベル＋参照専用値）。5列グリッドの1セルとして配置する。
// ラベルの幅を超える長い項目名は、justify-end で左へはみ出させる（値側に重ねない）。
export function PlanBasicInfoField({
  label,
  value,
  colSpanClass,
  trailing,
}: PlanBasicInfoFieldProps) {
  const fit = useContext(PlanBasicInfoFitContext);
  if (fit) {
    // 2列分（col-span-2）は4トラックの箱にし、値（＋付随要素）を残りの3トラックへ広げる
    const wide = colSpanClass === 'col-span-2';
    return (
      <div className={wide ? FIT_WIDE_CELL_CLASS : FIT_CELL_CLASS}>
        <label className={FIT_LABEL_CLASS}>{label}</label>
        <div
          className={`flex min-w-0 items-center gap-2${wide ? ` ${FIT_WIDE_VALUE_CLASS}` : ''}`}
        >
          <div
            className={`h-8 flex items-center ${FORM_VALUE_CLASS} ${
              trailing ? 'whitespace-nowrap px-2' : 'flex-1'
            }`}
          >
            {value}
          </div>
          {trailing}
        </div>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-2${colSpanClass ? ` ${colSpanClass}` : ''}`}
    >
      <label className={SEARCH_LABEL_CLASS}>{label}</label>
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
// fit の並び（PlanBasicInfoFitGrid の中）では、行が親の列を受け継ぐため空きセルは要らない（何も置かない）。
export function PlanBasicInfoSpacer() {
  const fit = useContext(PlanBasicInfoFitContext);
  if (fit) return null;
  return <div className="flex items-center gap-2" />;
}

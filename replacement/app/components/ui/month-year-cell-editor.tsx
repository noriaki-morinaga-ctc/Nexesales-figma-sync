import type { CustomCellEditorProps } from 'ag-grid-react';
import { MonthYearPicker } from './month-year-picker';

// AG Grid 用の計上年月セルエディタ。
// MonthYearPicker（カレンダー入力フォーム）をラップし、グリッドのセル編集で
// 年月（YYYY/MM）を入力・選択できるようにする。ポップアップ編集として使用する。
//
// SingleComboboxCellEditor と同様に、AG Grid 公式の onValueChange/stopEditing で
// 確定する（旧 getValue 方式だとカレンダー選択時に旧値で確定されてしまう）。
// カレンダーはポータル描画のため、選択前に編集が確定（旧値で commit）しないよう、
// MonthYearPicker 側で blur／フォーカス移動を抑止している。
export interface MonthYearCellEditorParams {
  /** 選択可能な下限（YYYY/MM、これより前は選択不可） */
  min?: string;
  /** 選択可能な上限（YYYY/MM、これより後は選択不可） */
  max?: string;
  /** 必須フラグ（既定 true。false で空入力を許可） */
  required?: boolean;
}

export const MonthYearCellEditor = (
  props: CustomCellEditorProps & MonthYearCellEditorParams
) => {
  return (
    <div className="p-2 bg-white">
      <MonthYearPicker
        value={(props.value as string) ?? ''}
        min={props.min}
        max={props.max}
        required={props.required}
        // 入力途中の値もグリッドへ同期（他セルクリック等での確定に備える）
        onChange={(v) => props.onValueChange(v)}
        // カレンダー選択／入力確定でセル編集を確定する
        onCommit={(v) => {
          props.onValueChange(v);
          props.stopEditing();
        }}
      />
    </div>
  );
};

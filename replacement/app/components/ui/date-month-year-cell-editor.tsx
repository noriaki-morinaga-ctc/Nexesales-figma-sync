import type { CustomCellEditorProps } from 'ag-grid-react';
import { DateMonthYearPicker } from './date-month-year-picker';

// AG Grid 用の年月日（YYYY/MM/DD）セルエディタ。
// DateMonthYearPicker（年→月→日 のカレンダー入力フォーム）をラップし、
// グリッドのセル編集で年月日を入力・選択できるようにする。ポップアップ編集として使用。
// MonthYearCellEditor（年月）と同方針で、onValueChange/stopEditing で確定する。
export interface DateMonthYearCellEditorParams {
  /** 選択可能な下限（YYYY/MM/DD、これより前は選択不可） */
  min?: string;
  /** 選択可能な上限（YYYY/MM/DD、これより後は選択不可） */
  max?: string;
  /** 必須フラグ（既定 true。false で空入力を許可） */
  required?: boolean;
  /** ×（クリア）を表示するか。任意項目の列で true にする（×で空にしてセル編集を確定する） */
  clearable?: boolean;
}

export const DateMonthYearCellEditor = (
  props: CustomCellEditorProps & DateMonthYearCellEditorParams
) => {
  return (
    <div className="p-2 bg-white">
      <DateMonthYearPicker
        value={(props.value as string) ?? ''}
        min={props.min}
        max={props.max}
        required={props.required}
        clearable={props.clearable}
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

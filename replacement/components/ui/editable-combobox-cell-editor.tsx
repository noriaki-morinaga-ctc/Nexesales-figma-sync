import type { CustomCellEditorProps } from 'ag-grid-react';
import {
  EditableCombobox,
  type EditableComboboxOption,
} from './editable-combobox';

// AG Grid 用の入力可能コンボボックスセルエディタ（共通）。
// EditableCombobox を popup 表示し、候補から選ぶだけでなく、候補に無い値を
// そのまま文字として入力できる。マスタで名寄せしきれない項目に使う。
// 使用例:
//   editable: isEditable,
//   cellEditor: EditableComboboxCellEditor,
//   cellEditorPopup: true,
//   cellEditorParams: { comboOptions, placeholder: '選択、または入力' },
// ※ 編集中の Enter／↑／↓ の抑止は GRID_DEFAULT_COL_DEF の suppressKeyboardEvent が
//   本エディタを見て自動適用するため、列側での指定は不要（→ 02 §9）。
export interface EditableComboboxCellEditorParams {
  /** 候補（名称のみ） */
  comboOptions: EditableComboboxOption[];
  /** プレースホルダー */
  placeholder?: string;
  /** クリア（×ボタン）可否（既定: true） */
  clearable?: boolean;
  /** ポップアップの横幅（既定: '18rem'） */
  width?: string;
}


export const EditableComboboxCellEditor = (
  props: CustomCellEditorProps & EditableComboboxCellEditorParams
) => {
  const {
    comboOptions,
    placeholder = '選択、または入力',
    clearable = true,
    width = '18rem',
  } = props;

  return (
    <div className="bg-white p-1" style={{ width }}>
      <EditableCombobox
        options={comboOptions}
        value={(props.value as string) ?? ''}
        clearable={clearable}
        // ポータル（body直下）で描画するとAG Gridがエディタ外クリックと判定し、
        // 候補のmousedown時点で編集が終了して選択値が入らない。インライン描画にする。
        usePortal={false}
        autoOpen
        placeholder={placeholder}
        // 手入力は1文字ごとに編集中の値へ反映する（Tab・クリックでの確定に備える）
        onChange={(v) => props.onValueChange(v)}
        onCommit={(v) => {
          props.onValueChange(v);
          props.stopEditing(); // 候補選択・Enterで編集確定
          // Enter確定後の「1つ下のセルへ移動」は GRID_BASE_PROPS（onCellEditingStopped）が共通で担う。
        }}
      />
    </div>
  );
};

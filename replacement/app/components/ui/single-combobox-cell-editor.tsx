import type { CustomCellEditorProps } from 'ag-grid-react';
import {
  SingleCombobox,
  type SingleComboboxOption,
} from './single-combobox';

// AG Grid 用の単一選択コンボボックスセルエディタ（共通）。
// SingleCombobox（検索付き単一選択）を popup 表示し、コード／名称どちらでも
// 絞り込んで選択できる。表内のプルダウン項目はこのエディタに統一する。
// 使用例:
//   cellEditor: SingleComboboxCellEditor,
//   cellEditorParams: { comboOptions, placeholder: '管理区分を選択' },
//   cellEditorPopup: true,
export interface SingleComboboxCellEditorParams {
  /** 選択肢（value／label／code／badge） */
  comboOptions: SingleComboboxOption[];
  /** プレースホルダー */
  placeholder?: string;
  /** クリア（選択解除）可否（既定: true） */
  clearable?: boolean;
  /** ポップアップの横幅（既定: '14rem'） */
  width?: string;
  /** 入力駆動の絞り込み（未入力時は候補を出さない・既定: false） */
  filterOnType?: boolean;
}

// 文字列配列を SingleCombobox の選択肢（value=label）へ変換するヘルパー。
export const toComboOptions = (values: string[]): SingleComboboxOption[] =>
  values.map((v) => ({ value: v, label: v }));

export const SingleComboboxCellEditor = (
  props: CustomCellEditorProps & SingleComboboxCellEditorParams
) => {
  const {
    // 編集を Esc で閉じた直後に同じセルを開き直すと、破棄途中のエディタが
    // cellEditorParams を伴わずに一度だけ再描画される（AG Grid のポップアップ
    // エディタの後始末）。候補が undefined のままだと描画で落ちるため空配列で受ける。
    comboOptions = [],
    placeholder = '検索...',
    clearable = true,
    width = '14rem',
    filterOnType = false,
  } = props;

  return (
    <div className="p-1 bg-white" style={{ width }}>
      <SingleCombobox
        options={comboOptions}
        value={(props.value as string) ?? ''}
        clearable={clearable}
        filterOnType={filterOnType}
        // ポータル（body直下）で描画するとAG Gridがエディタ外クリックと判定し、
        // 候補のmousedown時点で編集が終了して選択値が入らない。インライン描画にする。
        usePortal={false}
        onChange={(v) => {
          props.onValueChange(v); // 確定値をプロキシへ反映（同期更新）
          props.stopEditing(); // 選択で編集確定
          // Enter確定後の「1つ下のセルへ移動」は GRID_BASE_PROPS（onCellEditingStopped）が共通で担う。
        }}
        autoOpen
        placeholder={placeholder}
      />
    </div>
  );
};

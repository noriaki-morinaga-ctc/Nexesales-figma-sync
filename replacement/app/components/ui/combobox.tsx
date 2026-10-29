import * as React from 'react';
import { SingleCombobox } from './single-combobox';

// 単一選択の検索付きコンボボックス（旧版）。
// SingleCombobox と違うのは、選択確定時に option 全体を渡す（呼び出し側の連動処理に使う）点だけ。
// 見た目・操作を SingleCombobox とそろえるため、中身は SingleCombobox に任せる（UI/UX UX-023）。
// 新規は SingleCombobox を使う（→ 02 §9）。

// 選択肢（value／label／code／badge で統一）
export interface ComboboxOption {
  /** 値 */
  value: string;
  /** 表示名（1行目） */
  label: string;
  /** コード等（2行目・指定時のみ2行表示） */
  code?: string;
  /** 名称の横に表示するバッジ */
  badge?: string;
}

interface ComboboxProps {
  /** 選択肢 */
  options: ComboboxOption[];
  /** 選択中の値 */
  value: string;
  /** 選択確定ハンドラ（option 全体を渡す） */
  onChange: (option: ComboboxOption) => void;
  /** 未選択のときにボタンへ表示する文字 */
  placeholder?: string;
  /** 追加のクラス名 */
  className?: string;
  /** トリガー（ボタン）の id（ラベルの htmlFor と紐付け用） */
  id?: string;
  /** アクセシブル名（ラベルが無い場合の aria-label） */
  ariaLabel?: string;
  /** 必須項目（aria-required を付与） */
  ariaRequired?: boolean;
  /** 非活性（グレーアウト・操作不可） */
  disabled?: boolean;
  /** 非表示（何も描画しない） */
  hidden?: boolean;
  /** マウント時に開いて絞り込み欄にフォーカス（グリッドのセル編集用） */
  autoOpen?: boolean;
  /** 指定時、先頭に「クリア（選択解除）」行を表示し、選択で本コールバックを呼ぶ */
  onClear?: () => void;
  /** 文字入力時のみ候補を表示（未入力時は何も表示しない・候補が多い項目向け） */
  filterOnType?: boolean;
  /**
   * ドロップダウンを body 直下のポータルで描画する（既定: true）。
   * AG Grid のセル編集（popup）内では false を指定してインライン描画する。
   */
  usePortal?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = '名前 または コードで検索...',
  className = '',
  id,
  ariaLabel,
  ariaRequired,
  disabled = false,
  hidden = false,
  autoOpen = false,
  onClear,
  filterOnType = false,
  usePortal = true,
}: ComboboxProps) {
  // SingleCombobox は値だけを返すため、選択肢全体に引き直して渡す（空＝クリア）
  const handleChange = React.useCallback(
    (v: string) => {
      if (v === '') {
        onClear?.();
        return;
      }
      const option = options.find((o) => o.value === v);
      if (option) onChange(option);
    },
    [options, onChange, onClear]
  );

  return (
    <SingleCombobox
      options={options}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      id={id}
      ariaLabel={ariaLabel}
      ariaRequired={ariaRequired}
      disabled={disabled}
      hidden={hidden}
      autoOpen={autoOpen}
      clearable={!!onClear}
      filterOnType={filterOnType}
      usePortal={usePortal}
    />
  );
}

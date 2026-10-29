import { useState } from 'react';
import { SingleCombobox } from '../ui/single-combobox';

// 承認申請ダイアログの「承認担当者」（モック）。
// 選択値は画面側で使わないため、この部品の中で持つ。
// 短い固定リストのため絞り込み欄なしの SingleCombobox（→ 02 §9）。
// ダイアログの外（body 直下）に候補を描画すると外側クリックとみなされて閉じるため、インライン描画にする。
const APPROVER_OPTIONS = [
  { value: 'manager1', label: 'アサヒ　早苗' },
  { value: 'manager2', label: 'アサヒ　次郎' },
];

interface ApproverSelectProps {
  /** 追加のクラス名（グリッド上の配置など） */
  className?: string;
}

export function ApproverSelect({ className = '' }: ApproverSelectProps) {
  const [approver, setApprover] = useState('');
  return (
    <SingleCombobox
      className={className}
      options={APPROVER_OPTIONS}
      value={approver}
      onChange={setApprover}
      placeholder="承認担当者を選択"
      searchable={false}
      usePortal={false}
    />
  );
}

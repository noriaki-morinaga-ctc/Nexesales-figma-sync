// 計画の基本情報カードを閉じている間だけ、見出しの行に出す主な項目の要約
//（計画詳細(マージン率固定・NET入力)・(NET固定)・(自販機)で共通。UI/UX UX-066 → 02 §10.3）。
// 例：対象年月 2026/07　ステータス 未申請　販売店 DLR001:イオンリテール
// 開いている間は本文に同じ項目が出るため、呼び出し側で閉じているときだけ CollapsibleCard の headerActions に渡す。
import type { ReactNode } from 'react';

export interface BasicInfoSummaryItem {
  label: string;
  value: ReactNode;
}

interface BasicInfoCollapsedSummaryProps {
  items: BasicInfoSummaryItem[];
}

export function BasicInfoCollapsedSummary({
  items,
}: BasicInfoCollapsedSummaryProps) {
  return (
    <dl className="flex items-center gap-4 text-sm whitespace-nowrap text-gray-700">
      {items.map((item) => (
        <div key={item.label} className="flex gap-1">
          <dt className="text-gray-500">{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

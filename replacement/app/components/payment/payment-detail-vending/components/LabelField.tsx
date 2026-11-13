// 支払詳細(自販機)：ヘッダー項目（テキストラベル）。
// 値は "コード:名称" の並びでそのまま表示する（支払系画面で表記を統一）。
// 値はアイコン等も置けるよう ReactNode で受ける。
import type { ReactNode } from 'react';
import { valueOrEmpty } from '@/app/components/ui/empty-value';
import { FORM_LABEL_CLASS } from '@/styles/commonStyles';

interface LabelFieldProps {
  label: string;
  value: ReactNode;
  // ラベルのクラス。基本情報エリアは計画一覧の検索条件と同じ SEARCH_LABEL_CLASS を渡す（→ 05）。
  // 省略時は支払情報エリア・ペインの従来の体裁（w-36・右寄せ）。
  labelClassName?: string;
}

export function LabelField({
  label,
  value,
  labelClassName = `${FORM_LABEL_CLASS} whitespace-nowrap w-36 text-right`,
}: LabelFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <label className={labelClassName}>{label}</label>
      <span className="h-8 flex items-center text-sm text-gray-900">
        {/* 値が無いときはグレーの「-」（→ 05 値が空の項目・UX-068） */}
        {valueOrEmpty(value)}
      </span>
    </div>
  );
}

'use client';

import * as React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from './utils';

interface MonthPickerProps {
  value: string; // 月（"1"〜"12"）
  onChange: (value: string) => void;
  className?: string;
  required?: boolean; // 必須フラグ（既定 true。false で未選択＝空を許可）
  disabled?: boolean; // 非活性フラグ
  min?: string; // 選択可能な下限月（"1"〜"12"、これより前は選択不可）
  max?: string; // 選択可能な上限月（"1"〜"12"、これより後は選択不可）
  // カレンダー選択で「確定」したい時に呼ぶ（AG Grid セル編集の確定に使用）。
  // onChange は選択の都度発火するが、onCommit は確定操作（月選択）で発火する。
  onCommit?: (value: string) => void;
}

// '1'〜'12' を比較用の数値（月）へ変換
const toComparable = (val?: string): number | null => {
  const n = parseInt(val ?? '', 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : null;
};

// 月のみを選択するカレンダーピッカー（年は持たない）。
// month-year-picker.tsx を参考にした共通コンポーネント。
// AG Grid のセル編集（MonthCellEditor）から利用する場合は onCommit で確定する。
export function MonthPicker({
  value,
  onChange,
  className,
  required = true,
  disabled = false,
  min,
  max,
  onCommit,
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const monthNum = toComparable(value);
  const hasValue = monthNum != null;
  const selectedMonth = monthNum ?? 1;
  // 表示ラベル：必須なら常に月を表示（未選択時は既定1月）、任意で未選択なら placeholder
  const triggerLabel = hasValue || required ? `${selectedMonth}月` : '月を選択';

  // 選択可能範囲（min/max）の判定
  const minVal = toComparable(min);
  const maxVal = toComparable(max);
  const inRange = (m: number): boolean => {
    if (minVal != null && m < minVal) return false;
    if (maxVal != null && m > maxVal) return false;
    return true;
  };

  const handleMonthSelect = (m: number) => {
    if (!inRange(m)) return;
    const s = String(m);
    onChange(s);
    setIsOpen(false);
    // カレンダーで月を選択したら確定（AG Grid セル編集を確定する）
    onCommit?.(s);
  };

  const months = [
    { label: '1月', value: 1 },
    { label: '2月', value: 2 },
    { label: '3月', value: 3 },
    { label: '4月', value: 4 },
    { label: '5月', value: 5 },
    { label: '6月', value: 6 },
    { label: '7月', value: 7 },
    { label: '8月', value: 8 },
    { label: '9月', value: 9 },
    { label: '10月', value: 10 },
    { label: '11月', value: 11 },
    { label: '12月', value: 12 },
  ];

  return (
    <Popover
      open={disabled ? false : isOpen}
      onOpenChange={disabled ? undefined : setIsOpen}
    >
      <PopoverTrigger asChild>
        <button
          // 入力欄の目印（画面表示時の初期フォーカスの対象にする → App.tsx）
          data-input-control
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9.5 w-32 items-center justify-between rounded-md border border-gray-400 bg-white px-3 text-sm shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <span className={hasValue ? '' : 'text-gray-400'}>{triggerLabel}</span>
          <CalendarIcon className="h-4 w-4 text-gray-600" />
        </button>
      </PopoverTrigger>
      {/*
        ポータル描画のため、AG Grid のセル編集（popup）内で使う場合に
        フォーカス移動／blur で選択前に旧値で確定されるのを防ぐ。
        onOpenAutoFocus を抑止し、各ボタンの onMouseDown も抑止する
        （month-year-picker と同方針）。
      */}
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-3">
          {/* 月グリッド */}
          <div className="grid grid-cols-3 gap-2">
            {months.map((m) => (
              <Button
                key={m.value}
                variant={selectedMonth === m.value ? 'default' : 'outline'}
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleMonthSelect(m.value)}
                disabled={!inRange(m.value)}
                className="h-8"
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

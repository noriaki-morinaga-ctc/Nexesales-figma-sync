import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ja } from 'date-fns/locale';

import { Popover, PopoverTrigger, PopoverContent } from '../../../ui/popover';
import { Calendar } from '../../../ui/calendar';
import { Input } from '../../../ui/input';

// ===== 根拠資料ペインの日付入力（テキスト入力＋カレンダー選択） =====
// 発行日・回収予定日で使う。登録タブ（size="sm"）と表示タブの編集行（size="xs"）で共用する。
// Make 版では登録タブ・表示タブにほぼ同じ部品が2つあったため、ここに1つへ集約した。

// 受け付ける日付の書式（先頭が表示・保存の書式）
const DATE_FORMATS = ['yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy/M/d'];
const DISPLAY_FORMAT = 'yyyy/MM/dd';

// 日付文字列を Date に変換する。解釈できなければ null。
const parseDateStr = (s: string): Date | null => {
  if (!s) return null;
  for (const fmt of DATE_FORMATS) {
    const d = parse(s, fmt, new Date());
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

// 大きさごとの className（sm＝登録タブ：コンボボックスと同じ高さ 2.375rem、xs＝表示タブの編集行：行に収める小さいサイズ）
const SIZE_CLASSES = {
  sm: {
    input:
      'h-9.5 w-28 border-gray-400 text-sm shadow-sm focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400',
    button:
      'h-9.5 w-9.5 border-gray-400 shadow-sm disabled:bg-gray-100 disabled:text-gray-400',
    icon: 'h-4 w-4',
  },
  xs: {
    input:
      'h-6 w-28 border-blue-400 text-xs shadow-none focus:ring-1 focus:ring-blue-500',
    button: 'h-6 w-6 border-blue-400',
    icon: 'h-3.5 w-3.5',
  },
} as const;

interface EvidenceDateInputProps {
  // 入力欄の id（ラベルの htmlFor と対にする）
  id?: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function EvidenceDateInput({
  id,
  value,
  onChange,
  disabled,
  placeholder = DISPLAY_FORMAT,
  size = 'sm',
  className = '',
}: EvidenceDateInputProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateStr(value) ?? undefined;
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={sizeClass.input}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={`flex items-center justify-center rounded-md border bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 ${sizeClass.button}`}
            aria-label="カレンダーで日付を選択"
          >
            <CalendarIcon className={sizeClass.icon} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, DISPLAY_FORMAT, { locale: ja }));
                setOpen(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

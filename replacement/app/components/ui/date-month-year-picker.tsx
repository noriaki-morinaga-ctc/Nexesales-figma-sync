'use client';

import * as React from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from './utils';

// 年月日（YYYY/MM/DD）のカレンダー入力フォーム。
// MonthYearPicker（年月）と同方針のカスタムグリッドで、「年→月→日」の順に選択する。
// テキスト入力は不可とし、入力フォーム全体をクリックするとカレンダーを開く。
// AG Grid のセル編集（DateMonthYearCellEditor）から利用する場合は onCommit で確定する。
interface DateMonthYearPickerProps {
  value: string; // YYYY/MM/DD 形式
  onChange: (value: string) => void;
  className?: string;
  required?: boolean; // 必須フラグ（テキスト入力廃止に伴い内部未使用。API互換のため保持）
  disabled?: boolean; // 非活性フラグ
  min?: string; // 選択可能な下限（YYYY/MM/DD、これより前は選択不可）
  max?: string; // 選択可能な上限（YYYY/MM/DD、これより後は選択不可）
  // カレンダー選択で「確定」したい時に呼ぶ（AG Grid セル編集の確定に使用）。
  onCommit?: (value: string) => void;
  id?: string; // トリガーボタンの id（ラベルの htmlFor と紐付ける用途）
  ariaLabel?: string; // アクセシブル名の上書き（既定は「年月日を選択」）
  // 値のクリア（×）を表示するか。任意入力の項目（検索条件など）で有効にする（MonthYearPicker と同じ）。
  clearable?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

// 'YYYY/MM/DD'（または '-' 区切り）を比較用の数値（年×10000＋月×100＋日）へ変換
const toComparable = (val?: string): number | null => {
  if (!val) return null;
  const [y, m, d] = val.split(/[-/]/).map(Number);
  if (!y || !m || !d) return null;
  return y * 10000 + m * 100 + d;
};

// 'YYYY/MM/DD'（または '-' 区切り）を年月日に分解
const parseValue = (
  val: string
): { year: number; month: number; day: number } => {
  const parts = (val || '').split(/[-/]/).map((s) => parseInt(s, 10));
  const now = new Date();
  return {
    year: parts[0] || now.getFullYear(),
    month: parts[1] || now.getMonth() + 1,
    day: parts[2] || now.getDate(),
  };
};

// 指定年月の日数
const daysInMonth = (year: number, month: number): number =>
  new Date(year, month, 0).getDate();

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function DateMonthYearPicker({
  value,
  onChange,
  className,
  disabled = false,
  min,
  max,
  onCommit,
  id,
  ariaLabel,
  clearable = false,
}: DateMonthYearPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  // 選択ステップ：'month'＝年・月の選択／'day'＝日の選択
  const [step, setStep] = React.useState<'month' | 'day'>('month');

  const parsed = parseValue(value);
  const [selectedYear, setSelectedYear] = React.useState(parsed.year);
  const [selectedMonth, setSelectedMonth] = React.useState(parsed.month);

  // 選択可能範囲（min/max）の判定
  const minVal = toComparable(min);
  const maxVal = toComparable(max);
  const inRange = (y: number, m: number, d: number): boolean => {
    const v = y * 10000 + m * 100 + d;
    if (minVal != null && v < minVal) return false;
    if (maxVal != null && v > maxVal) return false;
    return true;
  };
  // 月内に1日でも範囲内の日があれば、その月は選択可能
  const monthInRange = (y: number, m: number): boolean => {
    const last = daysInMonth(y, m);
    if (minVal != null && y * 10000 + m * 100 + last < minVal) return false;
    if (maxVal != null && y * 10000 + m * 100 + 1 > maxVal) return false;
    return true;
  };

  // ポップアップを開くたびに、現在値に合わせて年・月の選択ステップへ戻す。
  // 未設定時の初期表示は当月だが、min/max を与えた場合は当月が範囲外になり得る
  //（例：From-To 検索で To に From より前の月を出しても選べない）。
  // その場合は選べる直近の年月へ寄せて開き、無駄な年送りを不要にする。
  React.useEffect(() => {
    if (isOpen) {
      const p = parseValue(value);
      let year = p.year;
      let month = p.month;
      const ym = year * 100 + month;
      if (minVal != null && ym < Math.floor(minVal / 100)) {
        year = Math.floor(minVal / 10000);
        month = Math.floor(minVal / 100) % 100;
      } else if (maxVal != null && ym > Math.floor(maxVal / 100)) {
        year = Math.floor(maxVal / 10000);
        month = Math.floor(maxVal / 100) % 100;
      }
      setSelectedYear(year);
      setSelectedMonth(month);
      setStep('month');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 年送りは min/max の年をはみ出さない（送った先が全月選択不可になるのを防ぐ）
  const canChangeYear = (direction: 'prev' | 'next'): boolean => {
    const next = direction === 'prev' ? selectedYear - 1 : selectedYear + 1;
    if (direction === 'prev' && minVal != null)
      return next >= Math.floor(minVal / 10000);
    if (direction === 'next' && maxVal != null)
      return next <= Math.floor(maxVal / 10000);
    return true;
  };

  const handleYearChange = (direction: 'prev' | 'next') => {
    setSelectedYear((y) => (direction === 'prev' ? y - 1 : y + 1));
  };

  // 月を選択したら日の選択ステップへ進む
  const handleMonthSelect = (m: number) => {
    setSelectedMonth(m);
    setStep('day');
  };

  // 日を選択したら確定（YYYY/MM/DD）
  const handleDaySelect = (d: number) => {
    const formatted = `${selectedYear}/${pad(selectedMonth)}/${pad(d)}`;
    onChange(formatted);
    setIsOpen(false);
    onCommit?.(formatted);
  };

  const days = Array.from(
    { length: daysInMonth(selectedYear, selectedMonth) },
    (_, i) => i + 1
  );
  const selectedDay = parseValue(value).day;

  // クリア（×）は値がある活性状態のときだけ出す。
  const showClear = clearable && !disabled && !!value;

  const handleClear = () => {
    onChange('');
    onCommit?.('');
  };

  return (
    <Popover
      open={disabled ? false : isOpen}
      onOpenChange={disabled ? undefined : setIsOpen}
    >
      {/*
        入力フォーム全体をピッカーのトリガーにする。
        テキスト入力は不可とし、フォームのどこをクリックしてもカレンダーを開く。
      */}
      {/* クリア（×）はトリガーの入れ子ボタンにできないため、
          相対配置のラッパー内でトリガーの右側へ重ねて配置する（MonthYearPicker と同じ）。 */}
      {/* data-copy-text：表示中の値（CopyableArea の Ctrl+C／右クリック「コピー」で使う） */}
      <div
        className={cn('relative', className)}
        data-copy-text={value || undefined}
      >
        <PopoverTrigger asChild>
          <button
            // 入力欄の目印（画面表示時の初期フォーカスの対象にする → App.tsx）
            data-input-control
            type="button"
            disabled={disabled}
            id={id}
            aria-label={ariaLabel ?? '年月日を選択'}
            className={cn(
              'relative flex h-9.5 items-center justify-between rounded-md border border-gray-400 bg-white px-3 py-1 text-sm text-gray-900 shadow-sm transition-colors',
              // clearable のときは×の分だけ幅を常に広げる（値の有無で幅が変わると隣の項目がずれ、
              // 狭いと値が省略表示になるため）。右余白は×を出している間だけ取る。
              clearable ? 'w-40' : 'w-36',
              showClear && 'pr-8',
              'cursor-pointer text-left hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white',
              className
            )}
          >
            <span className={cn('truncate', !value && 'text-gray-400')}>
              {value || 'YYYY/MM/DD'}
            </span>
            <CalendarIcon className="ml-1 h-4 w-4 shrink-0 text-gray-600" />
          </button>
        </PopoverTrigger>
        {showClear && (
          <button
            type="button"
            aria-label="年月日をクリア"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded text-gray-500 transition-colors hover:text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {/*
        ポータル描画のため、AG Grid のセル編集（popup）内で使う場合に
        フォーカス移動／blur で選択前に旧値で確定されるのを防ぐ。
        onOpenAutoFocus を抑止し、各ボタンの onMouseDown も抑止する
        （month-year-picker と同方針）。
      */}
      <PopoverContent
        className="w-auto p-0"
        align="end"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-3">
          {step === 'month' ? (
            <>
              {/* 年セレクター */}
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleYearChange('prev')}
                  disabled={!canChangeYear('prev')}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="font-semibold text-sm">{selectedYear}年</div>
                <Button
                  variant="outline"
                  size="sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleYearChange('next')}
                  disabled={!canChangeYear('next')}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {/* 月グリッド */}
              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((m) => (
                  <Button
                    key={m}
                    variant={selectedMonth === m ? 'default' : 'outline'}
                    size="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleMonthSelect(m)}
                    disabled={!monthInRange(selectedYear, m)}
                    className="h-8"
                  >
                    {m}月
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* 年月ヘッダー（戻るで月選択へ） */}
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setStep('month')}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="font-semibold text-sm">
                  {selectedYear}年{selectedMonth}月
                </div>
                <span className="w-7" />
              </div>
              {/* 日グリッド */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => (
                  <Button
                    key={d}
                    variant={selectedDay === d ? 'default' : 'outline'}
                    size="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleDaySelect(d)}
                    disabled={!inRange(selectedYear, selectedMonth, d)}
                    className="h-8 w-8 p-0 text-xs"
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

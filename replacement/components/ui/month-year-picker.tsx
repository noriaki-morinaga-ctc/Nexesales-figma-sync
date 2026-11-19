"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "./button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import {
  PickerTextBox,
  parseMonthText,
  usePickerTextInput,
} from "./picker-text-input";
import { cn } from "./utils";
import { PICKER_COMPACT_CLEAR_CLASS } from "@/styles/commonStyles";

interface MonthYearPickerProps {
  value: string; // YYYY/MM format
  onChange: (value: string) => void;
  className?: string;
  required?: boolean; // 必須フラグ（トリガーへ aria-required を付与）
  disabled?: boolean; // 非活性フラグ
  min?: string; // 選択可能な下限（YYYY/MM、これより前は選択不可）
  max?: string; // 選択可能な上限（YYYY/MM、これより後は選択不可）
  disabledMonths?: string[]; // 範囲内でも選択させない月（YYYY/MM）
  // カレンダー選択で「確定」したい時に呼ぶ（AG Grid セル編集の確定に使用）。
  onCommit?: (value: string) => void;
  id?: string; // トリガーボタンの id（ラベルの htmlFor と紐付ける用途）
  ariaLabel?: string; // アクセシブル名の上書き（既定は「年月を選択」）
  // 値のクリア（×）を表示するか。任意入力・入力し直しが必要な項目で有効にする。
  clearable?: boolean;
  // 検索条件の範囲指定（SearchRangeField）で1項目分に開始・終了を並べるときの詰めた形。
  // カレンダーのアイコンを出さず左右の余白を詰め、×は場所を取らずにマウスを乗せたとき・×にフォーカスがあるときだけ重ねる（UI/UX UX-058）。
  compact?: boolean;
  // カレンダーを開く向き（トリガーの右端にそろえる end が既定。左端にそろえるときは start）
  align?: 'start' | 'center' | 'end';
  // 文字で打ち込めるか（既定 true。UI/UX UX-067）。表のセル編集・列フィルタでは false にしてカレンダーだけにする
  typeable?: boolean;
}

// 'YYYY/MM'（または 'YYYY-M'）を比較用の数値（年×12＋月）へ変換
const toComparable = (val?: string): number | null => {
  if (!val) return null;
  const [y, m] = val.split(/[-/]/).map(Number);
  if (!y || !m) return null;
  return y * 12 + m;
};

export function MonthYearPicker({
  value,
  onChange,
  className,
  required = false,
  disabled = false,
  min,
  max,
  disabledMonths,
  onCommit,
  id,
  ariaLabel,
  clearable = false,
  compact = false,
  align = 'end',
  typeable = true,
}: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // 値から年と月を取り出す
  const parseValue = (
    val: string,
  ): { year: number; month: number } => {
    const parts = val.split("/");
    return {
      year: parseInt(parts[0]) || new Date().getFullYear(),
      month: parseInt(parts[1]) || new Date().getMonth() + 1,
    };
  };

  const { year, month } = parseValue(value);
  const [selectedYear, setSelectedYear] = React.useState(year);
  const [selectedMonth, setSelectedMonth] =
    React.useState(month);

  // 外部から value が変わったら、カレンダーの選択状態を同期する。
  React.useEffect(() => {
    const parsed = parseValue(value);
    setSelectedYear(parsed.year);
    setSelectedMonth(parsed.month);
    // parseValue は純粋関数のため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parseValue は純粋関数で、value が変わったときだけ読み直す
  }, [value]);

  // 選択可能範囲（min/max）の判定
  const minVal = toComparable(min);
  const maxVal = toComparable(max);
  const inRange = (y: number, m: number): boolean => {
    const v = y * 12 + m;
    if (minVal != null && v < minVal) return false;
    if (maxVal != null && v > maxVal) return false;
    if (disabledMonths?.includes(`${y}/${m.toString().padStart(2, "0")}`))
      return false;
    return true;
  };

  // 打ち込み（typeable のとき）。範囲外・選べない月は元の値に戻す
  const text = usePickerTextInput({
    value,
    parse: parseMonthText,
    isAllowed: (v) => {
      const [y, m] = v.split("/").map(Number);
      return inRange(y, m);
    },
    allowEmpty: clearable,
    onChange,
    onCommit,
    onDone: () => setIsOpen(false),
  });
  // 打ち込みの欄の外側（入力欄と×）。ここを押してもカレンダーを閉じない
  const anchorRef = React.useRef<HTMLDivElement>(null);

  const handleMonthSelect = (m: number) => {
    text.resetDraft();
    setSelectedMonth(m);
    const formatted = `${selectedYear}/${m.toString().padStart(2, "0")}`;
    onChange(formatted);
    setIsOpen(false);
    // カレンダーで月を選択したら確定（AG Grid セル編集を確定する）
    onCommit?.(formatted);
  };

  const handleYearChange = (direction: "prev" | "next") => {
    setSelectedYear(
      direction === "prev"
        ? selectedYear - 1
        : selectedYear + 1,
    );
  };

  // クリア（×）は値がある活性状態のときだけ出す。
  const showClear = clearable && !disabled && !!value;

  const handleClear = () => {
    onChange("");
    onCommit?.("");
  };

  const months = [
    { label: "1月", value: 1 },
    { label: "2月", value: 2 },
    { label: "3月", value: 3 },
    { label: "4月", value: 4 },
    { label: "5月", value: 5 },
    { label: "6月", value: 6 },
    { label: "7月", value: 7 },
    { label: "8月", value: 8 },
    { label: "9月", value: 9 },
    { label: "10月", value: 10 },
    { label: "11月", value: 11 },
    { label: "12月", value: 12 },
  ];

  return (
    <Popover
      open={disabled ? false : isOpen}
      onOpenChange={disabled ? undefined : setIsOpen}
    >
      {typeable ? (
        // 打ち込める入力欄（文字の欄＋カレンダーのアイコン）。カレンダーは入力欄の位置に出す
        <PopoverAnchor asChild>
          <div
            ref={anchorRef}
            className={cn("group/picker relative", className)}
            data-copy-text={value || undefined}
          >
            <PickerTextBox
              inputProps={text.inputProps}
              placeholder="YYYY/MM"
              boxClassName={cn(
                clearable ? "w-32" : "w-28",
                showClear && !compact && "pr-8",
                compact && "px-2",
                className,
              )}
              disabled={disabled}
              compact={compact}
              id={id}
              ariaLabel={ariaLabel ?? "年月"}
              required={required}
              onOpen={() => setIsOpen(true)}
            />
            {showClear && (
              <button
                type="button"
                aria-label="年月をクリア"
                title="年月をクリア"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClear}
                className={cn(
                  "absolute top-1/2 right-2 -translate-y-1/2 rounded text-gray-500 transition-colors hover:text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none",
                  compact && PICKER_COMPACT_CLEAR_CLASS
                )}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </PopoverAnchor>
      ) : (
        // 表のセル編集・列フィルタ（typeable={false}）：入力フォーム全体をピッカーのトリガーにする。
        // テキスト入力は不可とし、フォームのどこをクリックしてもカレンダーを開く。
        // クリア（×）はトリガーの入れ子ボタンにできないため、相対配置のラッパー内でトリガーの右側へ重ねる。
        // data-copy-text：表示中の値（CopyableArea の Ctrl+C／右クリック「コピー」で使う）
        <div
          className={cn("group/picker relative", className)}
          data-copy-text={value || undefined}
        >
          <PopoverTrigger asChild>
            <button
              // 入力欄の目印（画面表示時の初期フォーカスの対象にする → App.tsx）
              data-input-control
              id={id}
              type="button"
              disabled={disabled}
              aria-label={ariaLabel ?? "年月を選択"}
              aria-required={required || undefined}
              className={cn(
                "relative flex h-9.5 items-center justify-between rounded-md border border-gray-400 bg-white px-3 py-1 text-sm text-gray-900 shadow-sm transition-colors",
                // clearable のときは×の分だけ幅を常に広げる（値の有無で幅が変わると隣の項目がずれ、
                // 狭いと値が省略表示になるため）。右余白は×を出している間だけ取る。
                clearable ? "w-32" : "w-28",
                showClear && !compact && "pr-8",
                compact && "px-2",
                "cursor-pointer text-left hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white",
                className,
              )}
            >
              <span className={cn("truncate", !value && "text-gray-500")}>
                {value || "YYYY/MM"}
              </span>
              {!compact && (
                <CalendarIcon className="ml-1 h-4 w-4 shrink-0 text-gray-600" />
              )}
            </button>
          </PopoverTrigger>
          {showClear && (
            <button
              type="button"
              aria-label="年月をクリア"
              title="年月をクリア"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className={cn(
                "absolute top-1/2 right-2 -translate-y-1/2 rounded text-gray-500 transition-colors hover:text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none",
                compact && PICKER_COMPACT_CLEAR_CLASS
              )}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {/*
        カレンダーはポータル描画のため、AG Grid のセル編集（popup）内で使う場合、
        フォーカスがポータルへ移動すると、月を選択する前に旧値で編集が確定されて
        しまう。onOpenAutoFocus を抑止してフォーカス移動を防ぎ、各ボタンの
        onMouseDown も抑止して blur を防ぐ（single-combobox と同方針）。
      */}
      {/* ag-custom-component-popup：AG Grid のフィルタ内（YearMonthFilterInput）で使うとき、
          カレンダーのクリックを「フィルタの外」と見なしてフィルタが閉じるのを防ぐ（AG Grid 公式の目印） */}
      <PopoverContent
        className="ag-custom-component-popup w-auto p-0"
        align={align}
        onOpenAutoFocus={(e) => e.preventDefault()}
        // 入力欄（打ち込み中）を押してもカレンダーを閉じない
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <div className="p-3">
          {/* Year selector */}
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="outline"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleYearChange("prev")}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-bold text-sm">
              {selectedYear}年
            </div>
            <Button
              variant="outline"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleYearChange("next")}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-3 gap-2">
            {months.map((m) => (
              <Button
                key={m.value}
                variant={
                  selectedMonth === m.value
                    ? "default"
                    : "outline"
                }
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleMonthSelect(m.value)}
                disabled={!inRange(selectedYear, m.value)}
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

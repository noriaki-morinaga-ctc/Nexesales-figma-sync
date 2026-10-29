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
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import { cn } from "./utils";

interface MonthYearPickerProps {
  value: string; // YYYY/MM format
  onChange: (value: string) => void;
  className?: string;
  required?: boolean; // 必須フラグ（テキスト入力廃止に伴い内部では未使用。API互換のため保持）
  disabled?: boolean; // 非活性フラグ
  min?: string; // 選択可能な下限（YYYY/MM、これより前は選択不可）
  max?: string; // 選択可能な上限（YYYY/MM、これより後は選択不可）
  // カレンダー選択で「確定」したい時に呼ぶ（AG Grid セル編集の確定に使用）。
  onCommit?: (value: string) => void;
  id?: string; // トリガーボタンの id（ラベルの htmlFor と紐付ける用途）
  ariaLabel?: string; // アクセシブル名の上書き（既定は「年月を選択」）
  // 値のクリア（×）を表示するか。任意入力・入力し直しが必要な項目で有効にする。
  clearable?: boolean;
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
  disabled = false,
  min,
  max,
  onCommit,
  id,
  ariaLabel,
  clearable = false,
}: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Parse the value to get year and month
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // 選択可能範囲（min/max）の判定
  const minVal = toComparable(min);
  const maxVal = toComparable(max);
  const inRange = (y: number, m: number): boolean => {
    const v = y * 12 + m;
    if (minVal != null && v < minVal) return false;
    if (maxVal != null && v > maxVal) return false;
    return true;
  };

  const handleMonthSelect = (m: number) => {
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
      {/*
        入力フォーム全体をピッカーのトリガーにする。
        テキスト入力は不可とし、フォームのどこをクリックしてもカレンダーを開く。
      */}
      {/* クリア（×）はトリガーの入れ子ボタンにできないため、
          相対配置のラッパー内でトリガーの右側へ重ねて配置する。 */}
      {/* data-copy-text：表示中の値（CopyableArea の Ctrl+C／右クリック「コピー」で使う） */}
      <div
        className={cn("relative", className)}
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
            className={cn(
              "relative flex h-9.5 items-center justify-between rounded-md border border-gray-400 bg-white px-3 py-1 text-sm text-gray-900 shadow-sm transition-colors",
              // clearable のときは×の分だけ幅を常に広げる（値の有無で幅が変わると隣の項目がずれ、
              // 狭いと値が省略表示になるため）。右余白は×を出している間だけ取る。
              clearable ? "w-32" : "w-28",
              showClear && "pr-8",
              "cursor-pointer text-left hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white",
              className,
            )}
          >
            <span className={cn("truncate", !value && "text-gray-400")}>
              {value || "YYYY/MM"}
            </span>
            <CalendarIcon className="ml-1 h-4 w-4 shrink-0 text-gray-600" />
          </button>
        </PopoverTrigger>
        {showClear && (
          <button
            type="button"
            aria-label="年月をクリア"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded text-gray-500 transition-colors hover:text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
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
        align="end"
        onOpenAutoFocus={(e) => e.preventDefault()}
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
            <div className="font-semibold text-sm">
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

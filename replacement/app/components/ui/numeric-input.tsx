import React from "react";
import { cn } from "./utils";

interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // 入力を許可する小数桁。0=整数のみ（小数点そのものを入力させない）。
  // 未指定なら桁制限なし（従来どおり）。
  // ・入力中：指定桁を超える桁は受け付けない
  // ・フォーカスアウト：指定桁へ四捨五入して整える（例: 小数2桁なら 95.3 → 95.30）
  maxFractionDigits?: number;
}

// 入力中の値から、許可桁を超える小数を取り除く。
const limitFractionDigits = (raw: string, digits: number): string => {
  const dot = raw.indexOf(".");
  if (dot < 0) return raw;
  return digits === 0 ? raw.slice(0, dot) : raw.slice(0, dot + 1 + digits);
};

// 指定桁へ四捨五入した文字列（桁区切りなし）。toLocaleString の既定は四捨五入。
const roundToDigits = (value: number, digits: number): string =>
  value.toLocaleString("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });

export function NumericInput({
  className,
  onKeyDown,
  onChange,
  onBlur,
  maxFractionDigits,
  step,
  ...props
}: NumericInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 上下矢印キーでのインクリメント/デクリメントを無効化
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
    // 整数のみの項目では小数点を入力させない
    if (maxFractionDigits === 0 && (e.key === "." || e.key === ",")) {
      e.preventDefault();
    }
    // 親コンポーネントのonKeyDownがあれば呼び出す
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // 許可桁を超える入力は切り捨てて、入力欄の表示と値を同時に揃える。
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (maxFractionDigits != null) {
      const limited = limitFractionDigits(e.target.value, maxFractionDigits);
      if (limited !== e.target.value) e.target.value = limited;
    }
    if (onChange) {
      onChange(e);
    }
  };

  // フォーカスアウト時に指定桁へ四捨五入する（表示桁と保持値を一致させる）。
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (maxFractionDigits != null && e.target.value !== "") {
      const num = Number(e.target.value);
      if (Number.isFinite(num)) {
        const rounded = roundToDigits(num, maxFractionDigits);
        if (rounded !== e.target.value) {
          e.target.value = rounded;
          onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);
        }
      }
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <input
      type="number"
      data-slot="input"
      className={cn(
        "no-spinner file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      // 小数桁の指定があれば、その桁を刻み幅の既定にする（step 明示指定が優先）。
      step={
        step ?? (maxFractionDigits != null ? 10 ** -maxFractionDigits : undefined)
      }
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      onBlur={handleBlur}
      {...props}
    />
  );
}

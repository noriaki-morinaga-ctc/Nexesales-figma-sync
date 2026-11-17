// 年月・年月日の部品（MonthYearPicker・DateMonthYearPicker）で、カレンダーで選ぶほかに
// 文字で打ち込めるようにする共通部分（UI/UX UX-067 → 02 §14「打ち込み」）。
// ・打ち込める形：「2025/05/15」「2025-5-15」「2025.5.15」「20250515」（年月は「2025/05」「2025-5」「202505」）
// ・確定（Enter・欄から出る）したときに形をそろえて onChange・onCommit を呼ぶ
// ・日付として正しくない／選べない範囲・月のときは、元の値に戻す（エラーで止めない）
// ・空にして確定できるのは clearable（任意項目）のときだけ。必須項目は元の値に戻す
import * as React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from './utils';

const pad = (n: number) => String(n).padStart(2, '0');

// 打ち込んだ年月日を「YYYY/MM/DD」にそろえる（正しくない日付は null）
export function parseDateText(text: string): string | null {
  const t = text.trim();
  const m =
    /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(t) ??
    /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(y, mo, 0).getDate())
    return null;
  return `${y}/${pad(mo)}/${pad(d)}`;
}

// 打ち込んだ年月を「YYYY/MM」にそろえる（正しくない年月は null）
export function parseMonthText(text: string): string | null {
  const t = text.trim();
  const m = /^(\d{4})[/\-.](\d{1,2})$/.exec(t) ?? /^(\d{4})(\d{2})$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return `${y}/${pad(mo)}`;
}

interface UsePickerTextInputOptions {
  value: string;
  // 打ち込んだ文字を値の形にそろえる（正しくなければ null）
  parse: (text: string) => string | null;
  // 選べる値か（min・max・選べない月）
  isAllowed: (formatted: string) => boolean;
  // 空にして確定してよいか（clearable のとき true）
  allowEmpty: boolean;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  // Enter・Esc で確定・取り消したあと（カレンダーを閉じる）
  onDone?: () => void;
}

export function usePickerTextInput({
  value,
  parse,
  isAllowed,
  allowEmpty,
  onChange,
  onCommit,
  onDone,
}: UsePickerTextInputOptions) {
  // 打ち込み中の文字（打ち込み中でないときは null＝値をそのまま出す）
  const [draft, setDraft] = React.useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (text === value) return;
    if (text === '') {
      if (allowEmpty && value !== '') {
        onChange('');
        onCommit?.('');
      }
      return;
    }
    const formatted = parse(text);
    if (formatted && isAllowed(formatted) && formatted !== value) {
      onChange(formatted);
      onCommit?.(formatted);
    }
  };

  return {
    // カレンダーで選んだときに、打ち込み中の文字を捨てる（欄から出たときに古い文字で確定しないため）
    resetDraft: () => setDraft(null),
    inputProps: {
      value: draft ?? value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          onDone?.();
        } else if (e.key === 'Escape') {
          setDraft(null);
          onDone?.();
        }
      },
    },
  };
}

interface PickerTextBoxProps {
  inputProps: ReturnType<typeof usePickerTextInput>['inputProps'];
  placeholder: string;
  // 入力欄の箱のクラス（幅・余白など。部品ごとに決める）
  boxClassName: string;
  disabled: boolean;
  compact: boolean;
  id?: string;
  ariaLabel: string;
  required: boolean;
  // 入力欄・カレンダーのアイコンを押したとき（カレンダーを開く）
  onOpen: () => void;
}

// 打ち込める入力欄（文字の欄＋カレンダーのアイコン）。見た目は従来のピッカーのトリガーと同じ
export function PickerTextBox({
  inputProps,
  placeholder,
  boxClassName,
  disabled,
  compact,
  id,
  ariaLabel,
  required,
  onOpen,
}: PickerTextBoxProps) {
  return (
    <div
      // 表示中の値（CopyableArea の Ctrl+C／右クリック「コピー」で使う）
      data-copy-text={inputProps.value || undefined}
      className={cn(
        'relative flex h-9.5 items-center justify-between rounded-md border border-gray-400 bg-white px-3 py-1 text-sm text-gray-900 shadow-sm transition-colors',
        'focus-within:ring-2 focus-within:ring-blue-500',
        disabled && 'cursor-not-allowed opacity-50',
        boxClassName
      )}
    >
      <input
        // 入力欄の目印（画面表示時の初期フォーカスの対象にする → App.tsx）
        data-input-control
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        className="w-full min-w-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500 disabled:cursor-not-allowed"
        {...inputProps}
        onClick={() => !disabled && onOpen()}
      />
      {!compact && (
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="カレンダーを開く"
          title="カレンダーを開く"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onOpen}
          className="ml-1 shrink-0 rounded text-gray-600 hover:text-gray-800 disabled:cursor-not-allowed"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

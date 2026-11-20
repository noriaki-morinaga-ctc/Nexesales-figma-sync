// 表示を切り替えるセグメント型の切替（全画面共通。UI/UX UX-056 → 02 §6「表示の切替（SegmentToggle）」）。
// 青枠（border-2 border-blue-600）で囲み、選ばれている側は青塗り＋白文字、選ばれていない側は白地＋青文字。
// 選ばれていない側をグレーにしない（非活性と見分けがつかなくなるため）。
import type { ReactNode } from 'react';

export interface SegmentToggleOption<T extends string> {
  value: T;
  label: ReactNode;
  // マウスを乗せたときの説明（何を表示するかが名前だけで分からないとき → 02 §6「表示の切替ボタンの説明」）
  title?: string;
  // 件数（明細の件数など）。渡すと名前の右に小さい文字（text-xs）で添える（→ 02 §6「切替に件数を出す」・UI/UX UX-118）
  count?: number;
}

interface SegmentToggleProps<T extends string> {
  options: SegmentToggleOption<T>[];
  // 選ばれている値（どれも選ばれていないときは null）
  value: T | null;
  onChange: (value: T) => void;
  // 切替のまとまりの名前（読み上げ用。例：「金額単位」）
  ariaLabel: string;
  // 追加クラス（余白の調整など。色・枠・高さは指定しない）
  className?: string;
}

export function SegmentToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SegmentToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex h-8 overflow-hidden rounded-lg border-2 border-blue-600 ${className}`}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`px-3 text-sm font-medium whitespace-nowrap transition-colors ${
              i > 0 ? 'border-l-2 border-blue-600' : ''
            } ${
              selected
                ? 'bg-blue-600 text-white'
                : 'bg-white text-blue-600 hover:bg-blue-50'
            }`}
          >
            {option.label}
            {/* 件数は名前より小さい文字で右に添える（見出しの行の幅を取りすぎないよう括弧は付けない） */}
            {option.count !== undefined && (
              <span className="ml-1 text-xs font-normal tabular-nums">
                {option.count}
                <span className="sr-only">件</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

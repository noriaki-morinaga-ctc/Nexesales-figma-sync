import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import {
  matchesSearchQuery,
  normalizeForSearch,
} from '@/utils/common/searchNormalize';
import { scrollIntoListView, useDropdownPlacement } from './use-dropdown-placement';

// 入力可能コンボボックス（自作）。
// SingleCombobox（検索付き単一選択）との違いは「候補から選ぶだけでなく、候補に無い値を
// そのまま文字として入力できる」こと。マスタで名寄せしきれない項目に使う。
//   例: 請求詳細の販売店・三次店・一次店（商流販売店変換マスタで導出できない明細を手で補う）
// 候補は名称だけを並べる（コードは持たせない）。入力した文字で候補を絞り込み、
// 選ばずに確定すればその文字がそのまま値になる。

export interface EditableComboboxOption {
  /** 値（＝表示名。候補は名称のみで持つ） */
  value: string;
  /** 表示名 */
  label: string;
}

interface EditableComboboxProps {
  /** 候補（名称のみ） */
  options: EditableComboboxOption[];
  /** 現在値（候補から選んだ値、または手入力した文字） */
  value: string;
  /** 入力・選択のたびに現在値を返す */
  onChange: (value: string) => void;
  /**
   * 確定（候補のクリック、または Enter）。
   * セル編集では編集終了に使う。未指定なら確定時も onChange だけを呼ぶ。
   */
  onCommit?: (value: string) => void;
  /** プレースホルダー */
  placeholder?: string;
  /** 追加のクラス名 */
  className?: string;
  /** 内部の入力欄に付与する id（ラベルの htmlFor と紐付ける用途） */
  id?: string;
  /** アクセシブル名（ラベルが無い場合に内部入力へ付与する aria-label） */
  ariaLabel?: string;
  /** 必須項目（内部入力へ aria-required を付与） */
  ariaRequired?: boolean;
  /** 非活性（グレーアウト・操作不可） */
  disabled?: boolean;
  /** マウント時に候補を開いて入力へフォーカスする（グリッドのセル編集用） */
  autoOpen?: boolean;
  /** 値があるとき×ボタンで空（""）にできるようにする（既定: true） */
  clearable?: boolean;
  /**
   * 候補を body 直下のポータルで描画する（既定: true）。
   * AG Grid のセル編集（ポップアップエディタ）内では、ポータル先がエディタ外と
   * 判定されクリックで編集が確定してしまうため false を指定してインライン描画する。
   */
  usePortal?: boolean;
}

export function EditableCombobox({
  options,
  value,
  onChange,
  onCommit,
  placeholder = '選択、または入力',
  className = '',
  id,
  ariaLabel,
  ariaRequired,
  disabled = false,
  autoOpen = false,
  clearable = true,
  usePortal = true,
}: EditableComboboxProps) {
  const [open, setOpen] = React.useState(autoOpen);
  // 候補を絞り込まずに全件出すか。シェブロン押下・フォーカス時に立て、入力で下ろす
  const [showAll, setShowAll] = React.useState(true);
  // キーボード操作でハイライト中の候補インデックス（↑↓で移動・Enterで確定）。
  // 手入力を許すため、既定は「どれも選んでいない」= -1 とする。
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // 候補一覧の向き（下に入らず上のほうが広ければ上）と、ポータル描画の固定配置の位置。
  // 幅は入力欄の幅、ただし 15rem 未満にはしない（SingleCombobox と同じ）
  const { side, menuStyle } = useDropdownPlacement({
    open,
    usePortal,
    containerRef,
    menuRef: listRef,
  });

  // 外クリックで閉じる。候補はポータル（containerRef の外）なので listRef も判定に含める
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // autoOpen 指定時はマウント直後に入力へフォーカス（セル編集で即入力できるように）。
  // 既存値は全選択し、そのまま打ち直せるようにする。
  React.useEffect(() => {
    if (!autoOpen) return;
    // preventScroll：フォーカスで表・画面をスクロールさせない（UX-094）
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  }, [autoOpen]);

  // 入力中の文字で候補を絞り込む（全角/半角・大文字小文字は区別しない）。
  // 入力欄を押した直後は絞り込まず全件を出す。
  const filtered = React.useMemo(() => {
    if (showAll || !normalizeForSearch(value)) return options;
    return options.filter((o) => matchesSearchQuery(o.label, value));
  }, [options, value, showAll]);

  // 任意項目（clearable）で値があり、絞り込んでいないときは先頭に「クリア（選択解除）」行を
  // 出す（SingleCombobox と同じ扱い）。value="" のダミー項目として差し込み、選択で空に戻す。
  const showClear = clearable && !!value && showAll;
  const items: EditableComboboxOption[] = React.useMemo(
    () =>
      showClear ? [{ value: '', label: '（クリア）' }, ...filtered] : filtered,
    [showClear, filtered]
  );

  // 候補が変わったらハイライトを外す（手入力をそのまま確定できる状態に戻す）
  React.useEffect(() => {
    setActiveIndex(-1);
  }, [value]);

  // ハイライト位置を候補一覧の中だけでスクロールして見せる（表・画面は動かさない）
  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    scrollIntoListView(
      listRef.current,
      listRef.current?.querySelector<HTMLElement>(
        `[data-index="${activeIndex}"]`
      ) ?? null
    );
  }, [activeIndex, open]);

  // 入力欄を押したときは絞り込みを解いて候補を全件出す（SingleCombobox と同じ挙動）
  const openDropdown = () => {
    if (disabled) return;
    setShowAll(true);
    setOpen(true);
  };

  const commit = (val: string) => {
    if (disabled) return;
    onChange(val);
    setOpen(false);
    onCommit?.(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (!open) {
        setShowAll(true);
        setOpen(true);
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      // -1 まで戻すと入力中の文字へ戻れる（候補を選ばない状態）
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // 候補をハイライト中ならその候補を、していなければ入力中の文字をそのまま確定する
      commit(activeIndex >= 0 && items[activeIndex] ? items[activeIndex].value : value);
    } else if (e.key === 'Escape') {
      // 候補が開いているときは閉じるだけ。閉じているときは呼び出し側（グリッド）へ委ねる
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    }
  };

  const renderMenu = (menu: React.ReactNode) =>
    usePortal ? createPortal(menu, document.body) : menu;

  return (
    // data-copy-text：表示中の値（CopyableArea の Ctrl+C／右クリック「コピー」で使う → 02 §15.1）
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      data-copy-text={value || undefined}
    >
      <div
        // 見た目は SingleCombobox のボタンとそろえる（濃いグレーの枠 border-gray-400・薄い影 shadow-sm（年月の入力と同じ）・高さ 2.375rem・右端に ∨・フォーカスで青枠。UI/UX UX-023）
        className={`flex items-center gap-2 rounded-md border px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 ${
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-70'
            : 'cursor-text border-gray-400 bg-white'
        }`}
        onClick={openDropdown}
      >
        <input
          ref={inputRef}
          id={id}
          aria-label={ariaLabel}
          aria-required={ariaRequired}
          value={value}
          onChange={(e) => {
            setShowAll(false);
            setOpen(true);
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={openDropdown}
          onBlur={() => setOpen(false)}
          disabled={disabled}
          placeholder={placeholder}
          // 長い名称は非フォーカス時に「…」で省略し、ホバーで全文をツールチップ表示
          title={value}
          className="min-w-20 flex-1 bg-transparent text-sm text-ellipsis text-gray-900 outline-none placeholder:text-gray-500 disabled:cursor-not-allowed"
        />

        {/* クリアは候補の先頭行（クリア（選択解除））で行う。アイコンは SingleCombobox と同じく常に ∨ */}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
      </div>

      {open &&
        !disabled &&
        renderMenu(
          <div
            ref={listRef}
            // 固定配置の位置（ポータル描画）と、入りきらないときの高さの上限（JS で計算した値）
            style={menuStyle}
            className={
              usePortal
                ? 'fixed z-50 max-h-80 overflow-auto rounded-md border border-gray-200 bg-white p-1 shadow-md'
                : side === 'above'
                  ? 'absolute bottom-full z-50 mb-1 max-h-80 w-full min-w-60 overflow-auto rounded-md border border-gray-200 bg-white p-1 shadow-md'
                  : 'absolute top-full z-50 mt-1 max-h-80 w-full min-w-60 overflow-auto rounded-md border border-gray-200 bg-white p-1 shadow-md'
            }
          >
            {items.length === 0 ? (
              <div className="px-2 py-3 text-center text-sm text-gray-500">
                該当なし（入力した内容がそのまま値になります）
              </div>
            ) : (
              items.map((opt, i) => {
                const active = i === activeIndex;

                // 「クリア（選択解除）」行（値があるとき先頭に表示）
                if (opt.value === '') {
                  return (
                    <div
                      key="__clear"
                      data-index={i}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={(e) => {
                        e.stopPropagation();
                        commit('');
                      }}
                      className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 ${
                        active ? 'bg-gray-100' : ''
                      }`}
                    >
                      <X className="h-4 w-4 shrink-0" />
                      クリア（選択解除）
                    </div>
                  );
                }

                const selected = value === opt.value;
                return (
                  <div
                    key={opt.value}
                    data-index={i}
                    // 候補クリックで入力欄が blur すると、選択より先に旧値で確定して
                    // しまうため mousedown を抑止して blur を防ぐ
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={(e) => {
                      e.stopPropagation();
                      commit(opt.value);
                    }}
                    className={`flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 ${
                      active ? 'bg-gray-100' : ''
                    }`}
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                      {selected && <Check className="h-4 w-4 text-blue-600" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 text-gray-900">{opt.label}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
    </div>
  );
}

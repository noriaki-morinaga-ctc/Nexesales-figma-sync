import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { matchesSearchQuery } from '@/utils/common/searchNormalize';
import { cn } from './utils';
import { scrollIntoListView, useDropdownPlacement } from './use-dropdown-placement';

// 単一選択の検索付きコンボボックス。
// 複数選択は MultiCombobox（ボタン＋チェックボックス一覧）を使う。本部品は
// 値を1つだけ選ぶ用途（例: 管理区分）に使う。名称・コードの両方で検索できる。
// 見た目・操作は MultiCombobox とそろえる（UI/UX UX-023）：
// ・閉じているときはボタン（濃いグレーの枠 border-gray-400・薄い影 shadow-sm（年月の入力と同じ）・右端に ∨）に、選択中の名前か placeholder を出す。
// ・開くと、上に「絞り込み欄」、下に候補一覧を出す。選択中の候補は左に ✓ を付ける。
// ・短い固定リスト（税区分・伝票種別など数件）は searchable={false} で絞り込み欄を出さない（shadcn の Select の代わりに使う）。

// 選択肢（value／label／code／badge で統一。MultiCombobox と同形）
export interface SingleComboboxOption {
  /** 値 */
  value: string;
  /** 表示名（1行目） */
  label: string;
  /** コード等（2行目・指定時のみ2行表示） */
  code?: string;
  /** 名称の横に表示するバッジ */
  badge?: string;
}

interface SingleComboboxProps {
  /** 選択肢 */
  options: SingleComboboxOption[];
  /** 選択中の値 */
  value: string;
  /**
   * 選択値の変更ハンドラ。
   * meta.viaKeyboard: Enterキーで確定した場合 true（マウスクリック選択時は false）。
   * セル編集で「Enter確定後に下セルへ移動」を通常セルと揃えるために利用する。
   */
  onChange: (value: string, meta?: { viaKeyboard?: boolean }) => void;
  /** 未選択のときにボタンへ表示する文字 */
  placeholder?: string;
  /** 追加のクラス名 */
  className?: string;
  /** トリガー（ボタン）に付与する id（ラベルの htmlFor と紐付ける用途） */
  id?: string;
  /** アクセシブル名（ラベルが無い場合にトリガーへ付与する aria-label） */
  ariaLabel?: string;
  /** 必須項目（トリガーへ aria-required を付与） */
  ariaRequired?: boolean;
  /** 非活性（グレーアウト・操作不可） */
  disabled?: boolean;
  /** 非表示（何も描画しない） */
  hidden?: boolean;
  /** マウント時にドロップダウンを開いて絞り込み欄にフォーカスする（グリッドのセル編集用） */
  autoOpen?: boolean;
  /** 任意項目用。値があるとき候補の先頭に「クリア（選択解除）」を出し、空（""）にできるようにする */
  clearable?: boolean;
  /**
   * 絞り込み欄を出す（既定: true）。
   * 短い固定リスト（数件）は false にし、開いたら候補一覧だけを出して ↑↓・Enter で選ぶ。
   */
  searchable?: boolean;
  /**
   * 文字入力時のみ候補を表示する（未入力時は候補を出さない）。
   * 候補数が多く、検索して絞り込む前提の項目で使う。
   */
  filterOnType?: boolean;
  /**
   * ドロップダウンを body 直下のポータルで描画する（既定: true）。
   * 祖先の overflow に左右されず前面表示できる。
   * AG Grid のセル編集（ポップアップエディタ）内では、ポータル先がエディタ外と
   * 判定されクリックで編集が確定してしまうため false を指定してインライン描画する。
   */
  usePortal?: boolean;
}

export function SingleCombobox({
  options,
  value,
  onChange,
  placeholder = '名前 または コードで検索...',
  className = '',
  id,
  ariaLabel,
  ariaRequired,
  disabled = false,
  hidden = false,
  autoOpen = false,
  clearable = false,
  filterOnType = false,
  usePortal = true,
  searchable = true,
}: SingleComboboxProps) {
  const [open, setOpenState] = React.useState(autoOpen);
  const [query, setQuery] = React.useState('');
  // キーボード操作でハイライト中の候補インデックス（↑↓で移動・Enterで確定）
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listboxRef = React.useRef<HTMLDivElement>(null);
  const listboxId = React.useId();

  // 開閉（閉じたら絞り込みの文字を消す）
  const setOpen = React.useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) setQuery('');
  }, []);

  // 候補一覧の向き（下に入らず上のほうが広ければ上）と、ポータル描画の固定配置の位置。
  // 幅はトリガーの幅、ただし 15rem 未満にはしない（MultiCombobox と同じ。候補名が切れないようにする）。
  const { side, menuStyle } = useDropdownPlacement({
    open,
    usePortal,
    containerRef,
    menuRef: listRef,
  });

  // 外クリックで閉じる。ドロップダウンはポータル（containerRef の外）なので listRef も判定に含める。
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setOpen]);

  // 開いたら絞り込み欄へフォーカスする（autoOpen のセル編集でもすぐ入力できる）。
  // 絞り込み欄を出さないときは候補一覧へフォーカスし、↑↓・Enter で選べるようにする。
  React.useEffect(() => {
    if (!open) return;
    // preventScroll：フォーカスで表・画面をスクロールさせない（UX-094）
    if (searchable) inputRef.current?.focus({ preventScroll: true });
    else listboxRef.current?.focus({ preventScroll: true });
  }, [open, searchable]);

  const selectedOption = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  // 名称・コード・値で検索（全角/半角・大文字小文字は区別しない）
  const filtered = React.useMemo(() => {
    // filterOnType 指定時は未入力なら候補を出さない
    if (!query.trim()) return filterOnType ? [] : options;
    return options.filter(
      (o) =>
        matchesSearchQuery(o.label, query) ||
        matchesSearchQuery(o.code, query) ||
        matchesSearchQuery(o.value, query)
    );
  }, [options, query, filterOnType]);

  // 2行表示が必要か（いずれかにコードがある場合）
  const hasSecondaryLine = React.useMemo(
    () => options.some((o) => o.code),
    [options]
  );

  // 任意項目（clearable）で値があり、検索していないときは
  // 先頭に「クリア（選択解除）」行を出す。value="" のダミー項目として表示リストへ差し込み、選択で空に戻す。
  const showClear = clearable && !!value && query.trim() === '';
  const items: SingleComboboxOption[] = showClear
    ? [{ value: '', label: '（クリア）' }, ...filtered]
    : filtered;

  // 検索語が変わったら先頭候補をハイライト
  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // ドロップダウンを開いたら、選択中の候補（無ければ先頭）をハイライト
  React.useEffect(() => {
    if (!open) return;
    const idx = items.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    // open の変化時のみ。items/value は開いた瞬間の値で十分。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 開いた瞬間の items・value で足りる（開いたときだけ選択位置を合わせる）
  }, [open]);

  // ハイライト位置を候補一覧の中だけでスクロールして見せる（表・画面は動かさない）
  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    scrollIntoListView(listboxRef.current, el ?? null);
  }, [activeIndex, open]);

  const select = (val: string, viaKeyboard = false) => {
    if (disabled) return;
    onChange(val, { viaKeyboard });
    setOpen(false);
    // セル編集（autoOpen）ではエディタごと閉じるため、ボタンへフォーカスを戻さない
    if (!autoOpen) buttonRef.current?.focus();
  };

  // 絞り込み欄（絞り込み欄なしは候補一覧）でのキー操作（↑↓で候補移動・Enterで確定・Escで閉じる・Tabで閉じる）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (items[activeIndex]) {
        e.preventDefault();
        e.stopPropagation();
        select(items[activeIndex].value, true); // Enter確定（下セル移動の判定に使用）
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      if (!autoOpen) buttonRef.current?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  if (hidden) return null;

  // 既定は body 直下のポータルで描画（祖先の overflow に左右されない）。
  // usePortal=false のときはトリガー直下にインライン描画する。
  const renderMenu = (menu: React.ReactNode) =>
    usePortal ? createPortal(menu, document.body) : menu;

  const selectedLabel = selectedOption?.label ?? '';

  return (
    // data-copy-text：表示中の値（CopyableArea の Ctrl+C／右クリック「コピー」で使う）
    <div
      ref={containerRef}
      className={cn('relative w-full min-w-0', className)}
      data-copy-text={selectedLabel || undefined}
    >
      {/* トリガー。MultiCombobox と同じ見た目（py-2＋text-sm＋枠線で高さ 2.375rem・濃いグレーの枠 border-gray-400・薄い影 shadow-sm（年月の入力と同じ）） */}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-required={ariaRequired}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        // 選択値が長い場合は「…」で省略表示し、ホバーで全文を出す
        title={selectedLabel || undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (open) return;
          // プルダウン系の共通操作：↓で開く（→ 06）
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            return;
          }
          // 文字キーを押したら開いて、その文字から絞り込む（ボタンにしても入力の手間を増やさない）。
          // 絞り込み欄なしは Enter／Space で開く（ボタン標準のクリック）。
          if (
            searchable &&
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            e.key !== ' '
          ) {
            e.preventDefault();
            setQuery(e.key);
            setOpenState(true);
          }
        }}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-gray-400 bg-white px-3 py-2 text-left text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:opacity-70"
      >
        <span
          className={`truncate ${selectedLabel ? 'text-gray-900' : 'text-gray-500'}`}
        >
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* ドロップダウン（既定は body 直下のポータル。usePortal=false でインライン描画） */}
      {open &&
        !disabled &&
        renderMenu(
          <div
            ref={listRef}
            // 固定配置の位置（ポータル描画）と、入りきらないときの高さの上限（JS で計算した値）
            style={menuStyle}
            className={`z-50 flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-md ${
              usePortal
                ? 'fixed'
                : side === 'above'
                  ? 'absolute bottom-full left-0 mb-1 w-full min-w-60'
                  : 'absolute left-0 top-full mt-1 w-full min-w-60'
            }`}
          >
            {/* 絞り込み欄（searchable={false} の短い固定リストでは出さない） */}
            {searchable && (
              <div className="border-b border-gray-200 p-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="入力して絞り込み"
                  aria-label="候補を絞り込み"
                  aria-controls={listboxId}
                  className="h-8 w-full rounded border border-gray-300 px-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {/* 候補一覧（見出しなし） */}
            <div
              id={listboxId}
              role="listbox"
              ref={listboxRef}
              // 絞り込み欄なしのときはここにフォーカスしてキー操作を受ける
              tabIndex={-1}
              onKeyDown={searchable ? undefined : handleKeyDown}
              aria-activedescendant={
                items[activeIndex] ? `${listboxId}-${activeIndex}` : undefined
              }
              className="max-h-80 min-h-0 overflow-y-auto p-1 outline-none"
            >
              {items.length === 0 ? (
                <div className="px-2 py-3 text-center text-sm text-gray-500">
                  {filterOnType && !query.trim()
                    ? '入力すると候補を表示します'
                    : '該当する候補がありません'}
                </div>
              ) : (
                items.map((opt, i) => {
                  const active = i === activeIndex;

                  // 「クリア（選択解除）」行（任意項目で値があるとき先頭に表示）
                  if (opt.value === '') {
                    return (
                      <div
                        key="__clear"
                        data-index={i}
                        id={`${listboxId}-${i}`}
                        role="option"
                        aria-selected={false}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => select('')}
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
                      id={`${listboxId}-${i}`}
                      role="option"
                      aria-selected={selected}
                      // AG Grid のセル編集（popup）内で使う場合、選択肢クリック時に
                      // 絞り込み欄が blur すると stopEditingWhenCellsLoseFocus により
                      // 選択より先に旧値で確定してしまう。mousedown を抑止して blur を防ぐ。
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => select(opt.value)}
                      className={`flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 ${
                        active ? 'bg-gray-100' : ''
                      }`}
                    >
                      {/* 選択中の印（MultiCombobox のチェックボックスと同じ位置・幅） */}
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        {selected && (
                          <Check
                            className="h-4 w-4 text-blue-600"
                            strokeWidth={3}
                          />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900">{opt.label}</span>
                          {opt.badge && (
                            <span className="rounded bg-green-100 px-2 text-xs">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {hasSecondaryLine && opt.code && (
                          <div className="text-xs text-gray-500">
                            {opt.code}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
    </div>
  );
}

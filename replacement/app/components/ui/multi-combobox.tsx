import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { matchesSearchQuery } from "@/app/utils/common/searchNormalize";
import { cn } from "./utils";

// 選択肢（value／label／code／badge で統一）
export interface MultiComboboxOption {
  /** 値 */
  value: string;
  /** 表示名（1行目） */
  label: string;
  /** コード等（2行目・指定時のみ2行表示） */
  code?: string;
  /** 名称の横に表示するバッジ */
  badge?: string;
}

interface MultiComboboxProps {
  /** トリガー（ボタン）の id（label の htmlFor と紐づける） */
  id?: string;
  /** 選択肢 */
  options: MultiComboboxOption[];
  /** 選択中の値 */
  value: string[];
  /** 選択値の変更ハンドラ（値は選択肢の並び順で渡す） */
  onChange: (value: string[]) => void;
  /**
   * ドロップダウンの開閉通知。
   * 選択の都度ではなく「閉じて確定した時点」で処理したい場合に使う
   * （例: 条件確定時に確認ダイアログを1回だけ表示する）。
   */
  onOpenChange?: (open: boolean) => void;
  /** 未選択のときにボタンへ表示する文字（既定:「指定なし」） */
  placeholder?: string;
  /** 複数選択時の「先頭 他N件」の単位（既定:「件」。人は「名」） */
  unit?: string;
  /** 追加のクラス名 */
  className?: string;
  /** 非活性（グレーアウト・操作不可） */
  disabled?: boolean;
  /** 非表示（何も描画しない） */
  hidden?: boolean;
  /** マウント時にドロップダウンを開く（AG Grid のセル編集用） */
  autoOpen?: boolean;
  /**
   * 入力駆動の絞り込みにする（既定: false）。
   * true のとき、絞り込み欄が未入力の間は候補を出さず、
   * 文字を入力して初めて絞り込み候補を出す（候補が多い項目向け）。
   */
  filterOnType?: boolean;
  /**
   * ドロップダウンを body 直下のポータルで描画する（既定: true）。
   * 祖先の overflow に左右されず前面表示でき、見切れを防ぐ。
   * AG Grid のセル編集（ポップアップエディタ）内では、ポータル先がエディタ外と
   * 判定されクリックで編集が確定してしまうため false を指定してインライン描画する。
   */
  usePortal?: boolean;
}

// チェックボックスの見た目（オン／一部オン／オフ）。行全体のクリックで切り替えるため表示専用。
type CheckState = "on" | "ind" | "off";
const CheckMark = ({ state }: { state: CheckState }) => (
  <span
    aria-hidden="true"
    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
      state === "off"
        ? "border-gray-500 bg-white"
        : "border-blue-500 bg-blue-500"
    }`}
  >
    {/* 規約例外（重ね表示）：チェック枠（h-4）の中の記号のため w-3 h-3 */}
    {state === "on" && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
    {state === "ind" && <span className="h-0.5 w-2 bg-white" />}
  </span>
);

// 複数選択のコンボボックス（画面共通）。
// ・ボタンには、未選択なら placeholder（既定「指定なし」）、1件ならその名前、複数なら「先頭 他N件」を出す。
//   ホバーで選択中の値をすべて表示する。「全て」「ー」の選択肢は持たない（未選択＝条件なし）。
// ・開くと、上から「絞り込み欄」「(すべて選択)＋右端に選択数」「候補一覧（チェックボックス）」を出す。
// ・(すべて選択) は Excel のオートフィルターと同じく、表示中の候補を対象に
//   「すべて選択済みなら全解除、それ以外なら全選択」する。
export function MultiCombobox({
  id,
  options,
  value,
  onChange,
  onOpenChange,
  placeholder = "指定なし",
  unit = "件",
  className = "",
  disabled = false,
  hidden = false,
  autoOpen = false,
  usePortal = true,
  filterOnType = false,
}: MultiComboboxProps) {
  const [open, setOpenState] = React.useState(autoOpen);
  const [query, setQuery] = React.useState("");
  // キーボード操作で強調中の候補（-1＝(すべて選択)）
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();

  // 開閉状態を更新し、変化したときだけ親へ通知する
  const openRef = React.useRef(open);
  openRef.current = open;
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const setOpen = React.useCallback((next: boolean) => {
    if (openRef.current === next) return;
    openRef.current = next;
    setOpenState(next);
    onOpenChangeRef.current?.(next);
    if (!next) setQuery("");
  }, []);

  // ドロップダウンはポータルで body 直下に描画するため、トリガーの位置・幅を
  // 算出して固定配置する（祖先の overflow-hidden に左右されず常に前面に出せる）。
  // 幅はトリガーの幅、ただし 15rem 未満にはしない（候補名が切れないようにする）。
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({});
  const updateMenuPosition = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(240, r.width),
    });
  }, []);

  // 開いている間はトリガー位置に追従（スクロール・リサイズで再計算）
  React.useEffect(() => {
    if (!open || !usePortal) return;
    updateMenuPosition();
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [open, usePortal, updateMenuPosition]);

  // 開いたら絞り込み欄へフォーカスする
  React.useEffect(() => {
    if (open) {
      setActiveIndex(-1);
      inputRef.current?.focus();
    }
  }, [open]);

  // 外クリックで閉じる（ポータル先のドロップダウン内クリックは閉じない）
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setOpen]);

  // 名称・コード・値で絞り込む（全角/半角・大文字小文字は区別しない）
  const visible = React.useMemo(() => {
    if (!query.trim()) return filterOnType ? [] : options;
    return options.filter(
      (o) =>
        matchesSearchQuery(o.label, query) ||
        matchesSearchQuery(o.code, query) ||
        matchesSearchQuery(o.value, query),
    );
  }, [options, query, filterOnType]);

  // 2行表示が必要か（いずれかにコードがある場合）
  const hasSecondaryLine = React.useMemo(
    () => options.some((o) => o.code),
    [options],
  );

  // 値を選択肢の並び順にそろえて通知する（選択肢に無い値は末尾に残す）
  const commit = (next: Set<string>) => {
    const ordered = options
      .filter((o) => next.has(o.value))
      .map((o) => o.value);
    const rest = [...next].filter((v) => !options.some((o) => o.value === v));
    onChange([...ordered, ...rest]);
  };

  const toggle = (val: string) => {
    if (disabled) return;
    const next = new Set(value);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    commit(next);
  };

  // (すべて選択)：表示中の候補がすべて選択済みなら全解除、それ以外なら全選択
  const selectedVisibleCount = visible.filter((o) =>
    value.includes(o.value),
  ).length;
  const allState: CheckState =
    visible.length > 0 && selectedVisibleCount === visible.length
      ? "on"
      : selectedVisibleCount > 0
        ? "ind"
        : "off";
  const toggleAll = () => {
    if (disabled || visible.length === 0) return;
    const next = new Set(value);
    if (allState === "on") visible.forEach((o) => next.delete(o.value));
    else visible.forEach((o) => next.add(o.value));
    commit(next);
  };

  // 絞り込み欄でのキー操作（↑↓で候補を移動、Enter／Space で選択切替、Esc で閉じる）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" || (e.key === " " && activeIndex >= 0)) {
      e.preventDefault();
      if (activeIndex < 0) toggleAll();
      else if (visible[activeIndex]) toggle(visible[activeIndex].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  if (hidden) return null;

  // ボタンの表示（1件ならその名前、複数なら「先頭 他N件」。ホバーで全件）
  const labelOf = (v: string) =>
    options.find((o) => o.value === v)?.label ?? v;
  const selectedLabels = value.map(labelOf);
  const summary =
    selectedLabels.length === 0
      ? ""
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels[0]} 他${selectedLabels.length - 1}${unit}`;

  // 既定は body 直下のポータルで描画（祖先の overflow に左右されない）。
  // usePortal=false のときはトリガー直下にインライン描画する。
  const renderMenu = (menu: React.ReactNode) =>
    usePortal ? createPortal(menu, document.body) : menu;

  return (
    // data-copy-text：表示中の値（CopyableArea の Ctrl+C／右クリック「コピー」で使う）。
    <div
      ref={containerRef}
      // 呼び出し側の幅指定（w-80 等）を優先する
      className={cn("relative w-full min-w-0", className)}
      data-copy-text={selectedLabels.join("、") || undefined}
    >
      {/* トリガー。SingleCombobox と同じ見た目（py-2＋text-sm＋枠線で高さ 2.375rem・濃いグレーの枠 border-gray-400・薄い影 shadow-sm（年月の入力と同じ）。UI/UX UX-023） */}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        title={selectedLabels.join("、") || undefined}
        onClick={() => setOpen(!open)}
        // プルダウン系の共通操作：Alt+↓（または↓）で開く（→ 06）
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-gray-400 bg-white px-3 py-2 text-left text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:opacity-70"
      >
        <span
          className={`truncate ${summary ? "text-gray-900" : "text-gray-500"}`}
        >
          {summary || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* ドロップダウン（既定は body 直下のポータル。usePortal=false でインライン描画） */}
      {open &&
        !disabled &&
        renderMenu(
          <div
            ref={menuRef}
            style={usePortal ? menuStyle : undefined}
            className={`z-50 flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-md ${
              usePortal ? "fixed" : "absolute left-0 top-full mt-1 w-full min-w-60"
            }`}
          >
            {/* 絞り込み欄 */}
            <div className="border-b border-gray-200 p-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder="入力して絞り込み"
                aria-label="候補を絞り込み"
                aria-controls={listboxId}
                className="h-8 w-full rounded border border-gray-300 px-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* (すべて選択)＋右端に選択数 */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 p-1">
              {visible.length > 0 ? (
                <div
                  role="option"
                  aria-selected={allState === "on"}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={toggleAll}
                  className={`flex flex-1 cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-gray-100 ${
                    activeIndex === -1 ? "bg-gray-100" : ""
                  }`}
                >
                  <CheckMark state={allState} />
                  (すべて選択)
                </div>
              ) : (
                <span className="flex-1" />
              )}
              <span className="shrink-0 whitespace-nowrap pr-2 text-xs text-gray-500">
                {value.length}件選択
              </span>
            </div>

            {/* 候補一覧（見出しなし） */}
            <div
              id={listboxId}
              role="listbox"
              aria-multiselectable="true"
              className="max-h-80 overflow-y-auto p-1"
            >
              {visible.length === 0 ? (
                <div className="px-2 py-3 text-center text-sm text-gray-500">
                  {filterOnType && !query.trim()
                    ? "入力すると候補を表示します"
                    : "該当する候補がありません"}
                </div>
              ) : (
                visible.map((opt, i) => {
                  const selected = value.includes(opt.value);
                  return (
                    <div
                      key={opt.value}
                      role="option"
                      aria-selected={selected}
                      // 候補クリックで絞り込み欄のフォーカスが外れないようにする（選択後も開いたまま）
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggle(opt.value)}
                      className={`flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 ${
                        activeIndex === i ? "bg-gray-100" : ""
                      }`}
                    >
                      <span className="mt-0.5">
                        <CheckMark state={selected ? "on" : "off"} />
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
          </div>,
        )}
    </div>
  );
}

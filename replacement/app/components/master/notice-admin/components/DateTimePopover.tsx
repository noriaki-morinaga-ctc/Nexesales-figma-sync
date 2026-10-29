import { useEffect, useRef, useState } from 'react';
import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ===== 掲載日時ピッカー（クリックで自前パネル：カレンダー日付＋「時」「分」セレクト） =====
// ネイティブ datetime-local の時刻ドロップダウンは中身のラベルを変えられず時分と分からないため、
// クリックで開く自前パネルで「時」「分」を明示する。ダブルクリックで手入力（マスク付き）に切り替わる。

const HH_LIST = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, '0')
);
// 分は 15 分刻み（00/15/30/45）
const MM_LIST = ['00', '15', '30', '45'];
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
// 日時マスクのテンプレート。数字が入る位置は英字（Y/M/D/H/m）、区切りは固定記号。全16文字。
const DT_TEMPLATE = 'YYYY/MM/DD HH:mm';

// 時刻を省略したとき（未設定・日付だけ選んだ・8桁/4桁の手入力）に使う既定の時刻 "HH:mm"
const DEFAULT_TIME = '00:00';

// "YYYY/MM/DD HH:mm" → { date:"YYYY-MM-DD", hh, mm }。未設定は date="" 時刻は既定の時刻。
const splitDT = (s: string | undefined, defaultTime: string) => {
  const [defHh, defMm] = defaultTime.split(':');
  if (!s) return { date: '', hh: defHh, mm: defMm };
  const [d, t] = s.split(' ');
  const [hh = defHh, mm = defMm] = (t ?? '').split(':');
  return { date: d.replace(/\//g, '-'), hh, mm };
};
// { date, hh, mm } → "YYYY/MM/DD HH:mm"（日付未設定なら空）
const joinDT = (date: string, hh: string, mm: string) =>
  date ? `${date.replace(/-/g, '/')} ${hh}:${mm}` : '';

// "YYYY-MM-DD" を安全にパース。不正なら null。
const parseISODate = (
  iso: string
): { y: number; m: number; d: number } | null => {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!mt) return null;
  const y = +mt[1];
  const m = +mt[2];
  const d = +mt[3];
  const dt = new Date(y, m - 1, d);
  // 実在日チェック（例：2月30日は繰り上がるので弾く）
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d)
    return null;
  return { y, m, d };
};

// カレンダーグリッド用：指定年月（m は 1〜12）の日セルを週配列で返す。前後月の空白は null。日曜始まり。
const buildCalendar = (y: number, m: number): (number | null)[][] => {
  const startWd = new Date(y, m - 1, 1).getDay(); // 0=日
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

// 年月日時分を "YYYY/MM/DD HH:mm" に組み立てる。実在日＋時刻範囲チェック。不正なら null。
const assembleDT = (
  y: string,
  mo: string,
  da: string,
  hh: string,
  mm: string
): string | null => {
  if (+hh > 23 || +mm > 59) return null;
  if (!parseISODate(`${y}-${mo}-${da}`)) return null;
  return `${y}/${mo}/${da} ${hh}:${mm}`;
};

// 数字列（最大12桁）を "YYYY/MM/DD HH:mm" の位置に区切り記号を挿入して整形する（入力中のリアルタイムマスク）。
// 区切りは「その区切り直前の桁が埋まった時点」で付く（4桁=年で "/"、6桁=月で "/"、8桁=日で空白、10桁=時で ":"）。
const maskDT = (raw: string): string => {
  const d = raw.replace(/\D/g, '').slice(0, 12);
  let out = d.slice(0, 4);
  if (d.length >= 4) out += '/';
  if (d.length > 4) out += d.slice(4, 6);
  if (d.length >= 6) out += '/';
  if (d.length > 6) out += d.slice(6, 8);
  if (d.length >= 8) out += ' ';
  if (d.length > 8) out += d.slice(8, 10);
  if (d.length >= 10) out += ':';
  if (d.length > 10) out += d.slice(10, 12);
  return out;
};

// 入力済み部分（濃色）と未入力テンプレート部分（薄色）を分けて返す（重ね表示で2色にするため）。
const maskParts = (raw: string): { filled: string; rest: string } => {
  const filled = maskDT(raw);
  return { filled, rest: DT_TEMPLATE.slice(filled.length) };
};

// フォーカスアウト／Enter 時の補完。数字桁数で判定する。
// 12桁=年月日時分／8桁=年月日＋既定の時刻／4桁=年のみ→今日の月日＋既定の時刻。それ以外はエラー(null)。空は ""。
const completeTypedDT = (s: string, defaultTime: string): string | null => {
  const [defHh, defMm] = defaultTime.split(':');
  const digits = s.replace(/\D/g, '');
  if (digits === '') return '';
  const now = new Date();
  if (digits.length === 12) {
    return assembleDT(
      digits.slice(0, 4),
      digits.slice(4, 6),
      digits.slice(6, 8),
      digits.slice(8, 10),
      digits.slice(10, 12)
    );
  }
  if (digits.length === 8) {
    return assembleDT(
      digits.slice(0, 4),
      digits.slice(4, 6),
      digits.slice(6, 8),
      defHh,
      defMm
    );
  }
  if (digits.length === 4) {
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const da = String(now.getDate()).padStart(2, '0');
    return assembleDT(digits, mo, da, defHh, defMm);
  }
  return null;
};

interface DateTimePopoverProps {
  id?: string;
  value?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  // 時刻を省略したときの既定の時刻 "HH:mm"（既定 00:00）。掲載終了日時は 23:59（選択日の終日掲載）
  defaultTime?: string;
  // 選べる最初の日付 "YYYY/MM/DD"。これより前の日付はカレンダーで選べない（手入力は入力チェックで弾く）
  minDate?: string;
}

export function DateTimePopover({
  id,
  value,
  onChange,
  disabled = false,
  invalid = false,
  placeholder = '日時を選択',
  defaultTime = DEFAULT_TIME,
  minDate,
}: DateTimePopoverProps) {
  const [open, setOpen] = useState<boolean>(false);
  // ダブルクリック手打ちモード（入力欄がテキスト入力になる）
  const [typing, setTyping] = useState<boolean>(false);
  const [typedText, setTypedText] = useState<string>('');
  // 手打ちが不正なときのエラー表示（入力は消さず赤枠＋メッセージ）
  const [typedError, setTypedError] = useState<boolean>(false);
  // 年月ヘッダをクリックした時の「月選択（1〜12月グリッド）」モード
  const [pickingMonth, setPickingMonth] = useState<boolean>(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const { date, hh, mm } = splitDT(value, defaultTime);
  // 分の候補は 15 分刻み。既定の時刻の分（23:59 の 59 など）が刻みに無ければ末尾に加える
  const defaultMm = defaultTime.split(':')[1];
  const mmList = MM_LIST.includes(defaultMm)
    ? MM_LIST
    : [...MM_LIST, defaultMm];

  // 時・分の候補リスト（自前ドロップダウン）の開閉。datalist はブラウザが入力値で候補を絞るため使わない。
  const [hhListOpen, setHhListOpen] = useState<boolean>(false);
  const [mmListOpen, setMmListOpen] = useState<boolean>(false);

  // カレンダーに表示している年月（初期は選択値の月、なければ現在月）
  const initYM = () => {
    const p = date ? parseISODate(date) : null;
    if (p) return { y: p.y, m: p.m };
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() + 1 };
  };
  const [viewYM, setViewYM] = useState(initYM);

  // パネルを開くたびに、選択値の月へカレンダーを合わせる
  useEffect(() => {
    if (open) {
      setViewYM(initYM());
      setPickingMonth(false);
    }
    // 開いた瞬間の選択値だけを基準にする（選択のたびにカレンダーを動かさない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 手打ちモードに入ったらテキストを現在値で初期化しフォーカス（エラーもリセット）
  useEffect(() => {
    if (typing) {
      setTypedText(value ?? '');
      setTypedError(false);
      setTimeout(() => textRef.current?.select(), 0);
    }
  }, [typing, value]);

  // 手打ちテキストを確定。妥当なら反映して手打ちモードを抜ける。不正なら入力を残してエラー表示。
  const commitTyped = (): boolean => {
    const parsed = completeTypedDT(typedText, defaultTime);
    if (parsed === null) {
      setTypedError(true);
      return false;
    }
    onChange(parsed);
    setTypedError(false);
    setTyping(false);
    return true;
  };

  // 外側クリックで閉じる。手打ち中は確定を試み、不正なら閉じずにその場に留める。
  useEffect(() => {
    if (!open && !typing) return;
    const handleDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        if (typing && !commitTyped()) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocMouseDown);
    return () => document.removeEventListener('mousedown', handleDocMouseDown);
    // commitTyped は typedText に依存するため typedText を監視する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, typing, typedText]);

  // Esc でパネルを閉じる（→ 06 キーボード操作）
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const sel = date ? parseISODate(date) : null;
  const weeks = buildCalendar(viewYM.y, viewYM.m);
  const handlePrevMonth = () =>
    setViewYM(({ y, m }) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }));
  const handleNextMonth = () =>
    setViewYM(({ y, m }) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }));
  const handlePickDay = (d: number) => {
    const iso = `${viewYM.y}-${String(viewYM.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    onChange(joinDT(iso, hh, mm));
  };
  // クリア：日時を未選択（空）にする。ポップアップは閉じない（続けて再選択できる）。
  const handleClear = () => {
    onChange('');
    setPickingMonth(false);
  };
  // 時分を反映するときの基準日付。未選択なら今日を補完（時分を選べば日付も入る）。
  const dateForTime = () => {
    if (date) return date;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const handlePickHour = (h: string) => {
    setHhListOpen(false);
    onChange(joinDT(dateForTime(), h, mm));
  };
  const handlePickMinute = (m: string) => {
    setMmListOpen(false);
    onChange(joinDT(dateForTime(), hh, m));
  };

  const borderClass = invalid
    ? 'border-red-400 bg-red-50'
    : 'border-gray-400 bg-white';

  return (
    <div className="relative" ref={wrapRef}>
      {/* 表示欄：クリックでカレンダーパネル、ダブルクリックで手打ち */}
      {typing && !disabled ? (
        <div>
          {/* 重ね表示：背後に「濃色の入力済み＋薄色の未入力テンプレート」、
              手前に透明テキストの実 input（キャレットのみ見える）。 */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 px-2 py-1 text-sm font-mono whitespace-pre flex items-center"
            >
              {(() => {
                const { filled, rest } = maskParts(typedText);
                return (
                  <>
                    <span className="text-gray-900">{filled}</span>
                    <span className="text-gray-400">{rest}</span>
                  </>
                );
              })()}
            </div>
            <input
              id={id}
              ref={textRef}
              type="text"
              inputMode="numeric"
              value={typedText}
              aria-invalid={typedError || invalid}
              onChange={(e) => {
                // 数字を左から整形。消した分は薄色テンプレートに戻る。
                setTypedText(maskDT(e.target.value));
                if (typedError) setTypedError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitTyped();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setTypedError(false);
                  setTyping(false);
                }
              }}
              onBlur={commitTyped}
              className={`relative w-full h-8 text-sm font-mono px-2 py-1 border rounded bg-transparent text-transparent caret-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                typedError ? 'border-red-400 bg-red-50' : 'border-gray-400'
              }`}
            />
          </div>
          {typedError && (
            <p className="mt-0.5 text-xs text-red-600" role="alert">
              日付が正しくありません。年月日（8桁）または年（4桁）まで入力してください。
            </p>
          )}
        </div>
      ) : (
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          onDoubleClick={() => {
            if (!disabled) {
              setOpen(false);
              setTyping(true);
            }
          }}
          title="クリック：カレンダー／ダブルクリック：手入力"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={invalid}
          className={`w-full h-8 flex items-center gap-2 text-sm border rounded px-2 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            disabled
              ? 'bg-gray-200 border-gray-300 opacity-60 cursor-not-allowed'
              : `${borderClass} hover:border-blue-400`
          }`}
        >
          <CalendarClock
            className={`w-4 h-4 flex-shrink-0 ${disabled ? 'text-gray-400' : 'text-gray-500'}`}
            aria-hidden="true"
          />
          <span
            className={
              disabled
                ? 'text-gray-500'
                : value
                  ? 'text-gray-900'
                  : 'text-gray-500'
            }
          >
            {value || placeholder}
          </span>
        </button>
      )}

      {/* パネル：クリックで開くとカレンダー（上）＋時分（下） */}
      {open && !disabled && !typing && (
        <div
          role="dialog"
          aria-label="日時の選択"
          className="absolute z-20 mt-1 w-max rounded-md border border-gray-200 bg-white p-3 shadow-lg"
        >
          {pickingMonth ? (
            // 月選択モード：年送り＋1〜12月グリッド
            <div>
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setViewYM(({ y, m }) => ({ y: y - 1, m }))}
                  aria-label="前の年"
                  className="p-1 rounded hover:bg-gray-100 text-gray-600"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="text-sm font-medium text-gray-800">
                  {viewYM.y}年
                </span>
                <button
                  type="button"
                  onClick={() => setViewYM(({ y, m }) => ({ y: y + 1, m }))}
                  aria-label="次の年"
                  className="p-1 rounded hover:bg-gray-100 text-gray-600"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 w-52">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
                  <button
                    key={mo}
                    type="button"
                    onClick={() => {
                      setViewYM(({ y }) => ({ y, m: mo }));
                      setPickingMonth(false); // カレンダーに戻る
                    }}
                    className={`py-2 rounded text-sm ${
                      viewYM.m === mo
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-800 hover:bg-blue-50'
                    }`}
                  >
                    {mo}月
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* カレンダー：月ナビ（年月クリックで月選択モードへ） */}
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="前の月"
                  className="p-1 rounded hover:bg-gray-100 text-gray-600"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setPickingMonth(true)}
                  title="年月を選ぶ"
                  className="text-sm font-medium text-gray-800 px-2 py-0.5 rounded hover:bg-gray-100"
                >
                  {viewYM.y}年{viewYM.m}月
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="次の月"
                  className="p-1 rounded hover:bg-gray-100 text-gray-600"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              {/* 曜日見出し */}
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {WEEKDAYS.map((w, i) => (
                  <div
                    key={w}
                    className={`w-8 text-center text-xs ${
                      i === 0
                        ? 'text-red-500'
                        : i === 6
                          ? 'text-blue-500'
                          : 'text-gray-500'
                    }`}
                  >
                    {w}
                  </div>
                ))}
              </div>
              {/* 日付グリッド */}
              <div className="grid grid-cols-7 gap-0.5">
                {weeks.flat().map((d, i) => {
                  if (d === null) return <div key={i} className="w-8 h-8" />;
                  const isSel =
                    sel &&
                    sel.y === viewYM.y &&
                    sel.m === viewYM.m &&
                    sel.d === d;
                  // 選べる最初の日付より前の日は押せない
                  const isBeforeMin =
                    !!minDate &&
                    `${viewYM.y}/${String(viewYM.m).padStart(2, '0')}/${String(d).padStart(2, '0')}` <
                      minDate;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handlePickDay(d)}
                      disabled={isBeforeMin}
                      aria-pressed={!!isSel}
                      className={`w-8 h-8 rounded text-sm ${
                        isSel
                          ? 'bg-blue-600 text-white'
                          : isBeforeMin
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-800 hover:bg-blue-50'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* 時・分（カレンダーの下・月選択モード中は隠す） */}
          {!pickingMonth && (
            <div className="flex items-end gap-3 mt-3 pt-3 border-t border-gray-100">
              {(
                [
                  {
                    label: '時',
                    current: hh,
                    list: HH_LIST,
                    isOpen: hhListOpen,
                    toggle: () => {
                      setMmListOpen(false);
                      setHhListOpen((v) => !v);
                    },
                    pick: handlePickHour,
                  },
                  {
                    label: '分',
                    current: mm,
                    list: mmList,
                    isOpen: mmListOpen,
                    toggle: () => {
                      setHhListOpen(false);
                      setMmListOpen((v) => !v);
                    },
                    pick: handlePickMinute,
                  },
                ] as const
              ).map((f) => (
                <div key={f.label}>
                  <span className="block text-xs text-gray-500 mb-1">
                    {f.label}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* 自前ドロップダウン。候補は約10件分の高さでスクロール表示し、パネルに収める */}
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={f.label}
                        aria-haspopup="listbox"
                        aria-expanded={f.isOpen}
                        onClick={f.toggle}
                        className="w-16 flex items-center justify-between text-sm border border-gray-400 rounded px-2 py-1 bg-white"
                      >
                        <span>{f.current}</span>
                        <ChevronDown
                          className="w-3.5 h-3.5 text-gray-500"
                          aria-hidden="true"
                        />
                      </button>
                      {f.isOpen && (
                        <ul
                          role="listbox"
                          aria-label={f.label}
                          className="absolute z-20 mt-1 w-16 max-h-[9.5rem] overflow-y-auto bg-white border border-gray-300 rounded shadow-lg"
                        >
                          {f.list.map((v) => (
                            <li
                              key={v}
                              role="option"
                              aria-selected={v === f.current}
                            >
                              <button
                                type="button"
                                onClick={() => f.pick(v)}
                                className={`w-full text-left text-sm px-2 py-1 hover:bg-blue-50 ${v === f.current ? 'bg-blue-100 font-bold' : ''}`}
                              >
                                {v}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span className="text-xs text-gray-600">{f.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* フッタ：左下＝クリア／右下＝閉じる */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleClear}
              className="btn-action-base btn-action-outline"
            >
              クリア
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-action-base btn-action-outline"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

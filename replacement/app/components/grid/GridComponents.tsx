// グリッド共通の小さな表示コンポーネント群。
// - CopySourceLegend：コピー由来カラーバーの凡例
// - CellColorLegend：セル背景色の凡例
// - GridDisplayedRowsStatusPanel：件数表示用の共通カスタムステータスパネル
// - RowActionMenu：明細グリッド右端の操作列（三点リーダー）
// - YearMonthFilterInput：年月の列の日付フィルタで使う年月入力（年月だけを選ぶ・×でクリア）
import { useState, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { CustomDateProps, CustomStatusPanelProps } from 'ag-grid-react';
import { useGridDate } from 'ag-grid-react';
import { EllipsisVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '../ui/dropdown-menu';
import { MonthYearPicker } from '../ui/month-year-picker';
import { COPY_SOURCE_COLORS } from '../../../styles/gridStyles';

// コピー由来カラーバーの凡例。明細グリッドのタイトル付近に配置し、
// 左端の色帯（青＝コピー元ペイン／緑＝行コピー／橙＝新規追加）の意味を示す。
// showNew=false で「新規追加」凡例を省略できる（新規行に帯を付けない画面向け）。
interface CopySourceLegendProps {
  // コピー元ペイン（青）の凡例を表示するか（既定: 表示）。
  // 参照ペインを持たない画面（販売計画(詳細)の量販/卸）では false にする。
  showReference?: boolean;
  // コピー元ペイン（青）の凡例ラベル。画面のコピー元ボタン文言に合わせる。
  referenceLabel?: string;
  // 行コピー（緑）の凡例ラベル。グリッドのコピーアイコンで複製した行を示す。
  detailLabel?: string;
  // 新規追加（オレンジ）の凡例を表示するか（既定: 表示）
  showNew?: boolean;
  // 追加クラス（余白調整など）
  className?: string;
}

interface LegendItemProps {
  color: string;
  label: string;
}

// 1項目（色帯＋ラベル）
function LegendItem({ color, label }: LegendItemProps) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span
        className="inline-block h-3.5 w-1 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

export function CopySourceLegend({
  showReference = true,
  referenceLabel = '販売計画(コピー元)',
  detailLabel = '明細コピー',
  showNew = true,
  className = '',
}: CopySourceLegendProps) {
  return (
    <div
      className={`flex items-center gap-3 text-sm text-gray-600 ${className}`}
    >
      {showReference && (
        <LegendItem
          color={COPY_SOURCE_COLORS.reference}
          label={referenceLabel}
        />
      )}
      <LegendItem color={COPY_SOURCE_COLORS.detail} label={detailLabel} />
      {showNew && (
        <LegendItem color={COPY_SOURCE_COLORS.new} label="新規追加" />
      )}
    </div>
  );
}

// セル背景色の凡例1件分。色は GRID_COLORS の値を渡す（hex は画面へ直書きしない）。
export interface CellColorLegendItem {
  // セルの背景色
  color: string;
  // セルの枠線色。入力変更セルのように背景＋枠で示す配色で指定する。
  borderColor?: string;
  // 色の意味（「：」に続けて表示する）
  label: string;
}

interface CellColorLegendProps {
  items: CellColorLegendItem[];
  className?: string;
}

// セル背景色の凡例。明細グリッドの見出し付近に置き、色が何を表すかを示す。
// 表示は「サンプル → 説明」の順（年間集計・年間計画作成の凡例と同じ体裁）。
// 色だけに頼らず必ず説明文を添える（→ 06 色以外の手がかり）。
export function CellColorLegend({
  items,
  className = '',
}: CellColorLegendProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 ${className}`}
    >
      {items.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-1 whitespace-nowrap"
        >
          <span
            className="inline-block h-4 w-6 rounded-xs border border-gray-300"
            style={{
              backgroundColor: item.color,
              ...(item.borderColor
                ? { boxShadow: `inset 0 0 0 2px ${item.borderColor}` }
                : {}),
            }}
            aria-hidden="true"
          />
          <span>：{item.label}</span>
        </span>
      ))}
    </div>
  );
}

// グリッド件数表示用の共通カスタムステータスパネル
// 公式statusBar枠内に「表示中：◯-◯件 / 全◯件」を表示する（画面設計標準 4.2 ④）。
// チェックボックスで行を選べるグリッド（rowSelection あり・checkboxes が false でない）では、
// 続けて「選択中：◯件」も表示する（UI/UX UX-015）。
//
// 注意: getFirstDisplayedRowIndex/getLastDisplayedRowIndex はDOMにレンダリングされた
// 行（画面外のrow bufferを含む）を返すため、実際に見えている範囲とズレる。
// そのため、ビューポートの可視ピクセル範囲（getVerticalPixelRange）と各行の
// rowTop/rowHeightの重なりから「実際に見えている行」を判定する。
//
// statusPanelParams の inHorizontalScroll: true（共通の GRID_STATUS_BAR で指定）のときは、件数を
// 横スクロールバーと同じ行の左に置き、その分スクロールバーを右側だけ短くする（UI/UX UX-030）。
// AG Grid に公式の設定が無いため、次の3点だけを補う（見た目は grid.css の .grid-count-in-hscroll）：
// ① 横スクロールバーを常に出す（公式 alwaysShowHorizontalScroll。出さないと件数が明細に重なる）
// ② 件数の幅を CSS 変数 --grid-count-w に入れ、スクロールバーの表示幅をその分狭める
// ③ スクロールバーの中身の幅（--grid-hscroll-content-w）も同じ分狭め、バーと表の動く範囲をそろえる
//    （狭めないと、バーの右端の件数の幅の分だけ動かしても表が動かない）
// ④ 件数の行の高さをスクロールバーの行の高さ（--grid-hscroll-h。OS・ブラウザで変わる）に合わせる
// 要素は自分のグリッドの直下からたどって探す（行の展開＝masterDetail の中の別グリッドの要素を拾わない）
interface GridDisplayedRowsStatusPanelProps extends CustomStatusPanelProps {
  inHorizontalScroll?: boolean;
}

// 件数とスクロールバーの間隔（px。件数の右に空ける）
const COUNT_IN_HSCROLL_GAP = 8;
// スクロールバーの高さが決まるまで測り直す回数の上限（約2秒。非表示のグリッドで回り続けないため）
const HSCROLL_RETRY_MAX = 120;
// 自分のグリッドの列の中身・横スクロールバー（.ag-root-wrapper から子要素だけでたどる）
const ROOT_SELECTOR = ':scope > .ag-root-wrapper-body > .ag-root';
const CENTER_SELECTOR = `${ROOT_SELECTOR} > .ag-body > .ag-body-viewport > .ag-center-cols-viewport > .ag-center-cols-container`;
const HSCROLL_SELECTOR = `${ROOT_SELECTOR} > .ag-body-horizontal-scroll`;

export const GridDisplayedRowsStatusPanel = (
  props: GridDisplayedRowsStatusPanelProps
) => {
  const rootRef = useRef<HTMLDivElement>(null);
  // 件数を横スクロールバーの行に置くときの測り直し（下の useEffect が入れる）
  const syncHScrollRef = useRef<(() => void) | null>(null);
  const [range, setRange] = useState<{
    first: number;
    last: number;
    total: number;
  }>({ first: 0, last: 0, total: 0 });
  // 選択中の件数（null＝行選択の無いグリッドのため表示しない）
  const [selectedCount, setSelectedCount] = useState<number | null>(null);

  // 選択中の件数を最新化（公式 getGridOption('rowSelection')・getSelectedRows を使う）
  const updateSelected = useCallback(() => {
    const api = props.api;
    if (api.isDestroyed()) return;
    const rowSelection = api.getGridOption('rowSelection');
    const selectable =
      typeof rowSelection === 'object' &&
      rowSelection !== null &&
      (!('checkboxes' in rowSelection) || rowSelection.checkboxes !== false);
    setSelectedCount(selectable ? api.getSelectedRows().length : null);
  }, [props.api]);

  // 表示範囲・総件数を最新化
  const updateRange = useCallback(() => {
    const api = props.api;
    // グリッド破棄後（支払回数の切替・タブ切替等でアンマウントされた場合）は
    // API 呼び出しが警告となるため、公式の isDestroyed() で判定して何もしない。
    if (api.isDestroyed()) return;
    const total = api.getDisplayedRowCount();
    if (total === 0) {
      setRange({ first: 0, last: 0, total: 0 });
      return;
    }
    // 可視ピクセル範囲（バッファ行を除外して実際の表示行を求めるため）
    const { top, bottom } = api.getVerticalPixelRange();
    let first = -1;
    let last = -1;
    for (let i = 0; i < total; i++) {
      const node = api.getDisplayedRowAtIndex(i);
      if (node?.rowTop == null || node.rowHeight == null) continue;
      const rowTop = node.rowTop;
      const rowBottom = rowTop + node.rowHeight;
      // 行が可視領域と少しでも重なっていれば可視とみなす
      if (rowBottom > top && rowTop < bottom) {
        if (first === -1) first = i;
        last = i;
      } else if (first !== -1) {
        // 行は上から順に並ぶため、可視範囲を過ぎたら終了
        break;
      }
    }
    if (first === -1) {
      first = 0;
      last = 0;
    }
    setRange({ first, last, total });
  }, [props.api]);

  // スクロール・データ更新・初期描画で再計算（公式イベントを購読）
  useEffect(() => {
    updateRange();
    updateSelected();
    props.api.addEventListener('selectionChanged', updateSelected);
    props.api.addEventListener('modelUpdated', updateSelected);
    props.api.addEventListener('bodyScroll', updateRange);
    props.api.addEventListener('viewportChanged', updateRange);
    props.api.addEventListener('modelUpdated', updateRange);
    props.api.addEventListener('firstDataRendered', updateRange);
    return () => {
      // グリッド破棄後（タブ切替等でアンマウントされた場合）は解除不要かつ警告となるため、
      // 公式の isDestroyed() で判定してから解除する。
      if (props.api.isDestroyed()) return;
      props.api.removeEventListener('selectionChanged', updateSelected);
      props.api.removeEventListener('modelUpdated', updateSelected);
      props.api.removeEventListener('bodyScroll', updateRange);
      props.api.removeEventListener('viewportChanged', updateRange);
      props.api.removeEventListener('modelUpdated', updateRange);
      props.api.removeEventListener('firstDataRendered', updateRange);
    };
  }, [props.api, updateRange, updateSelected]);

  // 件数を横スクロールバーの行に置く（inHorizontalScroll のときだけ）
  const { api, inHorizontalScroll } = props;
  useEffect(() => {
    const el = rootRef.current;
    if (!inHorizontalScroll || !el) return;
    let wrapper: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    let frame = 0;
    let retryFrame = 0;
    let retries = 0;
    let eventFrame = 0;
    // 列の並び・幅が変わるグリッドのイベントの後にも測り直す。大きさの変化の通知（ResizeObserver）が
    // 届かない画面があるため（件数の文字の変化は下の useEffect で測り直す）
    const SYNC_EVENTS = [
      'modelUpdated',
      'viewportChanged',
      'displayedColumnsChanged',
      'columnResized',
      'selectionChanged',
    ] as const;
    const scheduleSync = () => {
      cancelAnimationFrame(eventFrame);
      eventFrame = requestAnimationFrame(() => sync());
    };
    // 件数の幅・列の合計幅が変わるたびに、スクロールバーの表示幅と中身の幅を計算し直す
    // （JS で計算する値のため CSS 変数を style で渡す）
    const sync = () => {
      if (!wrapper) return;
      const center = wrapper.querySelector<HTMLElement>(CENTER_SELECTOR);
      const countW =
        Math.ceil(el.getBoundingClientRect().width) + COUNT_IN_HSCROLL_GAP;
      const contentW = center ? center.getBoundingClientRect().width : 0;
      // スクロールバーの行の高さ（OS・ブラウザで変わる）に件数の行の高さを合わせる
      const hscroll = wrapper.querySelector<HTMLElement>(HSCROLL_SELECTOR);
      const hscrollH = hscroll ? hscroll.getBoundingClientRect().height : 0;
      wrapper.style.setProperty('--grid-hscroll-h', `${hscrollH}px`);
      // 表示の直後はスクロールバーの高さがまだ 0 のことがあり、決まったときに大きさの変化の
      // 通知が来ないことがあるため、高さが決まるまで次の描画で測り直す（上限 HSCROLL_RETRY_MAX 回）
      cancelAnimationFrame(retryFrame);
      if (hscrollH === 0 && retries < HSCROLL_RETRY_MAX) {
        retries += 1;
        retryFrame = requestAnimationFrame(sync);
      }
      wrapper.style.setProperty('--grid-count-w', `${countW}px`);
      wrapper.style.setProperty(
        '--grid-hscroll-content-w',
        `${Math.max(0, contentW - countW)}px`
      );
    };
    // 件数パネルは描画の直後はまだグリッドの要素に組み込まれておらず、表の本体（列の中身・
    // 横スクロールバー）もまだ無いことがあるため、すべて揃うまで待つ（揃う前に監視を始めると、
    // スクロールバーの高さの変化を拾えず件数の行の高さが 0 のままになる）
    const attach = () => {
      if (api.isDestroyed()) return;
      wrapper = el.closest<HTMLElement>('.ag-root-wrapper');
      const center = wrapper?.querySelector(CENTER_SELECTOR);
      const hscroll = wrapper?.querySelector(HSCROLL_SELECTOR);
      if (!wrapper || !center || !hscroll) {
        frame = requestAnimationFrame(attach);
        return;
      }
      api.setGridOption('alwaysShowHorizontalScroll', true);
      wrapper.classList.add('grid-count-in-hscroll');
      sync();
      observer = new ResizeObserver(sync);
      observer.observe(el);
      observer.observe(center);
      observer.observe(hscroll);
      for (const ev of SYNC_EVENTS) api.addEventListener(ev, scheduleSync);
      syncHScrollRef.current = scheduleSync;
    };
    attach();
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(retryFrame);
      cancelAnimationFrame(eventFrame);
      syncHScrollRef.current = null;
      observer?.disconnect();
      if (!api.isDestroyed())
        for (const ev of SYNC_EVENTS) api.removeEventListener(ev, scheduleSync);
      if (!wrapper) return;
      wrapper.classList.remove('grid-count-in-hscroll');
      wrapper.style.removeProperty('--grid-count-w');
      wrapper.style.removeProperty('--grid-hscroll-content-w');
      wrapper.style.removeProperty('--grid-hscroll-h');
    };
  }, [api, inHorizontalScroll]);
  // 件数の文字（表示中の範囲・全件数・選択中）が変わったら、件数の幅を測り直す
  useEffect(() => {
    syncHScrollRef.current?.();
  }, [range, selectedCount]);

  return (
    <div
      ref={rootRef}
      className="flex items-center gap-4 px-2 text-sm text-gray-700"
    >
      <span>
        {range.total === 0
          ? '表示中：0件'
          : `表示中：${range.first + 1}-${range.last + 1}件 / 全${range.total}件`}
      </span>
      {selectedCount !== null && <span>選択中：{selectedCount}件</span>}
    </div>
  );
};

// 明細グリッドの右端に置く行操作メニュー（三点リーダー＝ケバブメニュー）。
// メニュー項目（DropdownMenuItem／DropdownMenuCheckboxItem）は利用側が children で渡す。
//
// マウスホバーで開き、三点リーダーとメニューの両方からポインタが外れたら閉じる。
// トリガーからメニューへポインタを移す間に一瞬どちらからも外れるため、
// 閉じるまでに猶予（ROW_MENU_CLOSE_DELAY_MS）を置いてから閉じる。
const ROW_MENU_CLOSE_DELAY_MS = 200;

interface RowActionMenuProps {
  // メニュー項目。
  children: ReactNode;
  // 三点リーダーのツールチップ（既定「操作」）。
  title?: string;
}

export function RowActionMenu({
  children,
  title = '操作',
}: RowActionMenuProps) {
  const [open, setOpen] = useState(false);
  // ホバーで開いたかどうか。ホバーで開いたときはメニューへフォーカスを移さない
  //（ポインタを動かしただけでフォーカスがグリッドから奪われないようにする）。
  // キーボード操作（Tab→Enter）で開いたときは既定どおりフォーカスを移す。
  const openedByHoverRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const openByHover = useCallback(() => {
    clearCloseTimer();
    openedByHoverRef.current = true;
    setOpen(true);
  }, [clearCloseTimer]);

  const closeAfterDelay = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(
      () => setOpen(false),
      ROW_MENU_CLOSE_DELAY_MS
    );
  }, [clearCloseTimer]);

  // アンマウント後に閉じ処理が走らないようタイマーを止める。
  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  return (
    <div
      className="flex h-full items-center justify-center"
      onMouseEnter={openByHover}
      onMouseLeave={closeAfterDelay}
    >
      {/* modal={false}：閉じる際に body の pointer-events をロックさせない */}
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            aria-label="操作メニュー"
            title={title}
            // ポインタ・キーボードでの操作はホバー以外の経路として扱う。
            onPointerDown={() => (openedByHoverRef.current = false)}
            onKeyDown={() => (openedByHoverRef.current = false)}
          >
            <EllipsisVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onMouseEnter={clearCloseTimer}
          onMouseLeave={closeAfterDelay}
          onOpenAutoFocus={(event) => {
            if (openedByHoverRef.current) event.preventDefault();
          }}
        >
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// 年月の列の日付フィルタで使う入力部品（列定義の公式 dateComponent に渡す → GRID_MONTH_TEXT_FILTER）。
// 画面の検索条件と同じ共通の年月部品 MonthYearPicker を使い、年と月だけを選ぶ（日は選ばない）。
// 選んだ年月は月初の日付としてフィルタへ渡す。×でクリアすると条件の値を空にする。
const toYearMonthText = (date: Date | null): string =>
  date
    ? `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`
    : '';

export function YearMonthFilterInput({ date, onDateChange }: CustomDateProps) {
  // 標準の日付入力と同じく、グリッドへのコールバックは不要（値は onDateChange で渡す）
  useGridDate({});
  const handleChange = useCallback(
    (value: string) => {
      const m = /^(\d{4})\/(\d{1,2})$/.exec(value);
      onDateChange(m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : null);
    },
    [onDateChange]
  );
  return (
    <MonthYearPicker
      value={toYearMonthText(date)}
      onChange={handleChange}
      clearable
      ariaLabel="年月を選択"
      className="w-full"
    />
  );
}

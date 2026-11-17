import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  STRIP_CENTER_OFFSET,
  STRIP_MONTH_COUNT,
  toMonthIndex,
  buildMonthTiles,
  groupTilesByYear,
  yearOfMonthIndex,
  monthOfMonthIndex,
} from '@/utils/common/monthStrip';
import { Button } from './button';
import { cn } from './utils';

interface MonthStripPickerProps {
  value: string; // YYYY/MM 形式
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  // データが無いため選択させない月（YYYY/MM）。グレーにして押せなくする（MonthYearPicker と同じ名前）
  disabledMonths?: string[];
}

// 表示窓をずらすアニメーション（→ 02 §10.3）。動かした月数ぶん（最大4か月分）横から滑り込ませる。
const SLIDE_DURATION_MS = 260;
const SLIDE_MAX_MONTHS = 4;

// 対象年月を横並びの月タイルから選ぶピッカー（→ 02 §10.3）。
// 選択月を中央に、前後5か月ずつ＝計11か月を表示する。年は月のかたまりの上にまとめて出し、
// 年の境に縦線を引く。‹ / › は選択は変えずに表示窓を1か月ずつ前後へずらす。
// 選択月が表示窓の外に出たら、右に「選択中：YYYY年M月」のバッジを出す。選択可能範囲は設けない。
export function MonthStripPicker({
  value,
  onChange,
  className,
  disabled = false,
  disabledMonths,
}: MonthStripPickerProps) {
  const selectedIndex = toMonthIndex(value);

  // 現在月（今日の属する年月）。右上の青ドット・青文字の目印に使う。
  const todayIndex = React.useMemo(() => {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth() + 1;
  }, []);

  // ウィンドウ左端の年月インデックス。選択月を中央に置くため、
  // 「選択インデックス - 中央オフセット」を左端にする。
  const [windowStart, setWindowStart] = React.useState(
    (selectedIndex ?? todayIndex) - STRIP_CENTER_OFFSET
  );

  // 外部から value が変わったらウィンドウを合わせ直し、選択月を中央へ戻す。
  React.useEffect(() => {
    if (selectedIndex != null)
      setWindowStart(selectedIndex - STRIP_CENTER_OFFSET);
  }, [selectedIndex]);

  // 表示窓が動いたら、動いた向きから滑り込ませる（OS の「視差効果を減らす」設定のときは動かさない）。
  // アニメーションは Web Animations API（element.animate）で付け、スタイルは書かない。
  const stripRef = React.useRef<HTMLDivElement>(null);
  const prevStartRef = React.useRef(windowStart);
  React.useLayoutEffect(() => {
    const moved = windowStart - prevStartRef.current;
    prevStartRef.current = windowStart;
    const strip = stripRef.current;
    if (!moved || !strip || typeof strip.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      return;
    const tile = strip.querySelector<HTMLElement>('[data-month-tile]');
    const step = tile ? tile.offsetWidth : 0;
    const distance =
      Math.sign(moved) * Math.min(Math.abs(moved), SLIDE_MAX_MONTHS) * step;
    strip.animate(
      [
        { transform: `translateX(${distance}px)`, opacity: 0.2 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: SLIDE_DURATION_MS, easing: 'cubic-bezier(.2,.7,.3,1)' }
    );
  }, [windowStart]);

  const groups = groupTilesByYear(buildMonthTiles(windowStart));
  const isSelectedInView =
    selectedIndex != null &&
    selectedIndex >= windowStart &&
    selectedIndex < windowStart + STRIP_MONTH_COUNT;

  // ‹ / › は選択を変えずに表示窓を1か月ずつ前後へずらす。
  const handlePrev = () => setWindowStart((s) => s - 1);
  const handleNext = () => setWindowStart((s) => s + 1);

  return (
    // data-copy-text：選択中の年月（CopyableArea の Ctrl+C／右クリック「コピー」で使う → 02 §15.1）
    <div
      className={cn('flex items-end gap-1.5', className)}
      data-copy-text={value || undefined}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handlePrev}
        disabled={disabled}
        aria-label="表示を1か月前へずらす"
        title="表示を1か月前へずらす"
        className="h-9 w-8 shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* 表示窓。滑り込むタイルが外へはみ出さないよう overflow-hidden で切る */}
      <div className="overflow-hidden p-0.5">
        <div ref={stripRef} className="flex items-end gap-1">
          {groups.map((group, groupIndex) => (
            <div
              key={group.year}
              className={cn(
                'flex flex-col gap-0.5',
                // 年の境に縦線を引く
                groupIndex > 0 && 'border-l-2 border-gray-200 pl-1'
              )}
            >
              <div className="h-4 flex items-center pl-0.5 text-xs font-bold text-gray-600 whitespace-nowrap">
                {group.year}年
              </div>
              <div className="flex gap-1">
                {group.tiles.map((tile) => {
                  const isSelected = tile.index === selectedIndex;
                  const isCurrentMonth = tile.index === todayIndex;
                  // 選択中の月はデータが無くてもグレーにせず、選択の色で出す
                  const hasNoData =
                    !isSelected && !!disabledMonths?.includes(tile.value);
                  return (
                    <Button
                      key={tile.index}
                      type="button"
                      variant="outline"
                      data-month-tile
                      onClick={() => onChange(tile.value)}
                      disabled={disabled || hasNoData}
                      aria-pressed={isSelected}
                      aria-label={`${tile.year}年${tile.month}月${isCurrentMonth ? '（今月）' : ''}${hasNoData ? '（データなし）' : ''}`}
                      title={hasNoData ? 'データがありません' : undefined}
                      className={cn(
                        'relative h-9 w-12 shrink-0 px-0 text-sm font-medium',
                        // 当月は文字色を青にして目印にする（白・hover の背景でも 4.5:1 以上）
                        isCurrentMonth && 'text-blue-700',
                        // 選択中は他のボタンと同じ濃い青の塗り＋白の太字（白に対し 5.17:1）
                        isSelected &&
                          'border-blue-600 bg-blue-600 font-bold text-white hover:bg-blue-700 hover:text-white',
                        // データの無い月はグレーにして押せなくする。title を出すためポインターは受ける
                        hasNoData &&
                          'disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-100 border-gray-200 bg-gray-100 text-gray-400'
                      )}
                    >
                      {tile.month}月
                      {/* 現在月の目印。選択中は塗りの上でも見えるよう白にする */}
                      {isCurrentMonth && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute right-1 top-1 h-1.5 w-1.5 rounded-full',
                            isSelected ? 'bg-white' : 'bg-blue-700'
                          )}
                        />
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={disabled}
        aria-label="表示を1か月後へずらす"
        title="表示を1か月後へずらす"
        className="h-9 w-8 shrink-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* 選択月が表示窓の外にあるときだけ出すバッジ。場所は常に取り、出し入れで横がずれないようにする */}
      <span
        className={cn(
          'h-9 inline-flex items-center shrink-0',
          isSelectedInView && 'invisible'
        )}
        aria-hidden={isSelectedInView}
      >
        <span className="rounded-full bg-amber-100 px-2.5 py-px text-xs font-bold text-amber-800 whitespace-nowrap">
          選択中：
          {selectedIndex != null
            ? `${yearOfMonthIndex(selectedIndex)}年${monthOfMonthIndex(selectedIndex)}月`
            : '-'}
        </span>
      </span>
    </div>
  );
}

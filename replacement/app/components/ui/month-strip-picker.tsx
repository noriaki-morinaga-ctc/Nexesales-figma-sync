import * as React from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import {
  STRIP_CENTER_OFFSET,
  toMonthIndex,
  buildMonthTiles,
  yearOfMonthIndex,
} from '../../utils/common/monthStrip';
import { Button } from './button';
import { cn } from './utils';

interface MonthStripPickerProps {
  value: string; // YYYY/MM 形式
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

// 対象年月を横並びの月タイルから選ぶピッカー。
// 選択月を中央に、前後4ヶ月ずつ＝計9ヶ月を表示する。
// << / >> は選択は変えずに表示窓を1ヶ月単位で前後へずらす（右送りで左端が消え、
// 右へ1ヶ月増え、選択月は1つ左へずれる）。選択可能範囲は設けない。
export function MonthStripPicker({
  value,
  onChange,
  className,
  disabled = false,
}: MonthStripPickerProps) {
  const selectedIndex = toMonthIndex(value);

  // 現在月（今日の属する年月）。青ドット・青文字の目印に使う。
  const todayIndex = React.useMemo(() => {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth() + 1;
  }, []);

  // 現在年（今日の属する年）。年サフィックス「(YYYY年)」の色出し分けに使う。
  const todayYear = React.useMemo(
    () => yearOfMonthIndex(todayIndex),
    [todayIndex]
  );

  // ウィンドウ左端の年月インデックス。選択月を中央に置くため、
  // 「選択インデックス - 中央オフセット」を左端にする。
  const [windowStart, setWindowStart] = React.useState(
    (selectedIndex ?? todayIndex) - STRIP_CENTER_OFFSET
  );

  // 外部から value が変わったらウィンドウを合わせ直し、選択月を中央へ戻す。
  React.useEffect(() => {
    if (selectedIndex != null) setWindowStart(selectedIndex - STRIP_CENTER_OFFSET);
  }, [selectedIndex]);

  const tiles = buildMonthTiles(windowStart);

  // << / >> は選択を変えずに表示窓を1ヶ月ずつ前後へずらす。
  const handlePrev = () => setWindowStart((s) => s - 1);
  const handleNext = () => setWindowStart((s) => s + 1);

  return (
    // data-copy-text：選択中の年月（CopyableArea の Ctrl+C／右クリック「コピー」で使う → 02 §15.1）
    <div
      className={cn('flex items-center gap-2', className)}
      data-copy-text={value || undefined}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handlePrev}
        disabled={disabled}
        aria-label="表示を1ヶ月前へずらす"
        title="表示を1ヶ月前へずらす"
        className="h-12 w-10 shrink-0"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>

      {/* flex-1 を付けない: タイルは shrink-0 の固定幅なので、コンテナ自体は
          タイル群の内容幅ぶんだけ確保すればよい。flex-1 を付けると縮んだタイルの
          後ろに余白が生まれ、» ボタンが親の右端まで押し出されてしまう。
          » をタイル直後（« と対称）に置くため、ここでは伸ばさない。 */}
      <div className="flex items-center gap-2">
        {tiles.map((tile) => {
          const isSelected = tile.index === selectedIndex;
          const isCurrentMonth = tile.index === todayIndex;
          // システム年（今日の年）と同じ年のタイルかどうか。年サフィックスの色出し分けに使う。
          // 当月タイルは必ず当年でもあるため、isCurrentMonth はこの条件に包含される。
          const isCurrentYear = tile.year === todayYear;
          return (
            <Button
              key={tile.index}
              type="button"
              variant="outline"
              onClick={() => onChange(tile.value)}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`${tile.year}年${tile.month}月${isCurrentMonth ? '（今月）' : ''}`}
              className={cn(
                // flex-1 で幅いっぱいに伸ばさず、9タイル全てに付く「(YYYY年)」表記（text-xs）が
                // 折り返さない幅に絞る（内容量に応じた固定幅）。
                // 1280px幅では9タイル+矢印ボタンがステータス列に重なるため、2xl(1536px)未満は
                // 縮小幅（w-14=3.5rem）にし、1600px等の広い幅では従来幅（4.5rem）を維持する。
                'relative h-12 w-14 2xl:w-18 shrink-0 flex-col items-center justify-center gap-0',
                // 選択中は薄い青の下地・濃い青の文字・青の枠にする（動画仕様）。
                // 現在月のドットが背景に埋もれないよう、outline 既定を保ったまま className で上書きする。
                // hover: 修飾子付きクラスも合わせて上書きし、ホバー時に選択状態のグレー化（outline の
                // hover:bg-accent hover:text-accent-foreground）を防ぐ。
                isSelected &&
                  'border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-700'
              )}
            >
              <span
                className={cn(
                  'text-sm font-medium',
                  // 当月は文字色をブルー系にして選択状態（同じくブルー系）と視覚的に揃える。
                  // 当月かつ非選択でも判別できるよう明示的に付与する（選択中は親要素の
                  // text-blue-700 と重なるため実質差はないが、意図を明確にするため残す）。
                  // text-blue-700 は白・bg-blue-50・bg-blue-100・bg-accent の全背景で
                  // AA基準（4.5:1）を満たす（実測: 白6.70:1 / blue-50 6.16:1 / blue-100 5.49:1 / accent 5.62:1）。
                  isCurrentMonth && 'text-blue-700'
                )}
              >
                {tile.month}月
              </span>
              <span
                className={cn(
                  'text-xs',
                  // システム年と同じ年のタイル（当月を含む）、または選択中タイルは
                  // text-blue-700 にする。選択中タイル（bg-blue-50）では muted-foreground だと
                  // コントラスト比が約4.40:1 でAA基準（4.5:1）を下回るため text-blue-700 が必須
                  // （実測: 白6.70:1 / blue-50 6.16:1 / blue-100 5.49:1 / accent 5.62:1、
                  //   いずれも4.5:1以上）。それ以外の年は現状どおり muted-foreground のまま。
                  isSelected || isCurrentYear
                    ? 'text-blue-700'
                    : 'text-muted-foreground'
                )}
              >
                ({tile.year}年)
              </span>
              {/* 現在月の目印。選択状態とは独立に表示する。文字色と揃えてブルー系にする。
                  bg-blue-700 は選択中タイルのホバー背景 bg-blue-100 上でも実測約5.49:1あり、
                  非テキストコントラスト（WCAG 1.4.11）の3:1を上回る（全背景で3:1以上を確保）。 */}
              {isCurrentMonth && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-700"
                />
              )}
            </Button>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={disabled}
        aria-label="表示を1ヶ月後へずらす"
        title="表示を1ヶ月後へずらす"
        className="h-12 w-10 shrink-0"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

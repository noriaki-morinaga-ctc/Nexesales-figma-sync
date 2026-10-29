import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible';
import { cn } from './utils';

interface CollapsibleCardProps {
  // ヘッダーに表示するタイトル（文字列・任意要素どちらも可）
  title: React.ReactNode;
  // 開閉状態（制御モード。省略時は defaultOpen による非制御モード）
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // 非制御モードの初期開閉状態（既定は展開）
  defaultOpen?: boolean;
  // 外側カードの className 上書き・追加
  className?: string;
  // 本文ラッパーの className（省略時は children をそのまま描画）
  contentClassName?: string;
  // 親フレックスの余り高さいっぱいまでカードを広げる。
  // 一覧グリッドのように「ページではなくカードの中だけをスクロールさせたい」場合に使う。
  // 開いている間だけ伸び、折り畳み時はヘッダーのみの高さに戻る。
  fillParent?: boolean;
  // ヘッダーバーに置く操作要素（ボタン・入力・ラジオなど）。
  // 開閉トリガー（button要素）の外側に描画されるため、
  // クリックしてもカードは開閉せず、HTMLのbuttonネスト制約にも違反しない。
  // 指定時はシェブロンが操作要素の右側（バー右端）に配置される。
  headerActions?: React.ReactNode;
  // タイトルのすぐ右に置く操作要素。グリッドのチェックボックス（行選択）と連動する
  // 一括操作（一括承認など）を置き、選択した行への操作だと分かるようにタイトルに寄せる。
  // headerActions と同じく開閉トリガーの外側に描画され、押してもカードは開閉しない。
  titleActions?: React.ReactNode;
  // 折り畳んでいる間だけタイトルの右に出す要約（検索条件カードで、値が入っている項目を
  // buildSearchSummary（ui/search-summary.ts）で並べた文字列を渡す）。入りきらない分は
  // 末尾を「…」で省略し、ホバーで全文を出す。空文字・省略時は何も出さない。
  collapsedSummary?: string;
  children: React.ReactNode;
}

// シェブロン（開閉状態で回転）。Radix の data-state を使うため制御／非制御どちらでも動作する。
const Chevron = () => (
  <ChevronDown className="h-5 w-5 text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
);

// 折り畳んでいる間だけ出す要約。開閉トリガー（group）の data-state で出し分ける。
const CollapsedSummary = ({ summary }: { summary?: string }) =>
  summary ? (
    <span
      className="hidden min-w-0 flex-1 truncate text-left text-sm text-gray-700 group-data-[state=closed]:block"
      title={summary}
    >
      {summary}
    </span>
  ) : null;

// 基本情報・経費項目別合計値などで使う開閉カードの共通部品。
// headerActions を渡すとヘッダー右側に操作要素を配置でき、それらは開閉しない
// （タイトル部とシェブロンが開閉トリガー／操作要素はトリガーの外側）。
export function CollapsibleCard({
  title,
  open,
  onOpenChange,
  defaultOpen = true,
  className,
  contentClassName,
  fillParent = false,
  headerActions,
  titleActions,
  collapsedSummary,
  children,
}: CollapsibleCardProps) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={open === undefined ? defaultOpen : undefined}
      className={cn(
        'bg-white rounded-lg border border-gray-200 overflow-hidden shadow-md mb-3',
        // 開いている間だけ余り高さを取る（折り畳み時に空のカードが伸びないようにする）
        fillParent && 'flex flex-col min-h-0 data-[state=open]:flex-1',
        className,
      )}
    >
      {headerActions || titleActions ? (
        // 操作要素がある場合：トリガーを「タイトル」と「シェブロン」に分け、
        // 操作要素はトリガーの外側に置く。シェブロンは常にバー右端。
        // titleActions はタイトルのすぐ右、headerActions はシェブロンの左（右寄せ）。
        <div className="card-header-accent bg-white flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors">
          {/* 開閉トリガーは画面ロック（screen-locked）下でも操作可能に保つ。
              data-keep-active でグレーアウト対象から除外し、pointer-events-auto で
              クリックを有効化する（ロック外では無害）。 */}
          <CollapsibleTrigger
            data-keep-active
            className={cn(
              'group flex items-center gap-4 text-left outline-none focus:outline-none focus-visible:outline-none focus:ring-0 pointer-events-auto',
              !titleActions && 'min-w-0 flex-1',
            )}
          >
            <span
            className={cn(
              'text-gray-900 font-bold text-base',
              // 要約を出すカードはタイトルを縮めず、要約の側を省略する
              collapsedSummary && 'shrink-0',
            )}
          >
              {title}
            </span>
            <CollapsedSummary summary={collapsedSummary} />
          </CollapsibleTrigger>
          {titleActions && (
            <>
              {/* タイトルとの間は gap-2 に ml-2 を足して 1rem 空け、タイトルと詰まって見えないようにする */}
              <div className="ml-2 flex items-center gap-2">{titleActions}</div>
              {/* タイトル側の操作と右端の間の余白も開閉トリガーにする（バーの任意の場所で開閉）。
                  見た目は空のため、キーボード操作・読み上げの対象からは外す。 */}
              <CollapsibleTrigger
                data-keep-active
                tabIndex={-1}
                aria-hidden="true"
                className="flex-1 self-stretch outline-none focus:outline-none pointer-events-auto"
              />
            </>
          )}
          {headerActions && (
            // シェブロンとの間は gap-2 に mr-2 を足して 1rem 空け、操作要素と開閉ボタンが詰まって見えないようにする
            <div className="mr-2 flex items-center gap-2">{headerActions}</div>
          )}
          <CollapsibleTrigger
            data-keep-active
            className="group shrink-0 hover:text-blue-700 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 pointer-events-auto"
          >
            <Chevron />
          </CollapsibleTrigger>
        </div>
      ) : (
        // 操作要素が無い場合：バー全体が開閉トリガー
        <CollapsibleTrigger
          data-keep-active
          className="group bg-white px-3 py-2 card-header-accent flex w-full items-center justify-between gap-4 hover:bg-gray-50 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 pointer-events-auto"
        >
          <span
            className={cn(
              'text-gray-900 font-bold text-base',
              // 要約を出すカードはタイトルを縮めず、要約の側を省略する
              collapsedSummary && 'shrink-0',
            )}
          >
            {title}
          </span>
          <CollapsedSummary summary={collapsedSummary} />
          <Chevron />
        </CollapsibleTrigger>
      )}
      <CollapsibleContent
        className={fillParent ? 'flex flex-col flex-1 min-h-0' : undefined}
      >
        {contentClassName ? (
          <div className={contentClassName}>{children}</div>
        ) : (
          children
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

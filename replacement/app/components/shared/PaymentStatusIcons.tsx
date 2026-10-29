// 支払系画面で共通利用するステータスアイコン。
// 「分割・振替有無」と「計画紐付ステータス」は支払一覧・支払詳細の双方で同じ図形・配色を使う。
// アイコン表現は暫定であり確定後に差し替えるため、定義を本ファイル1か所に集約する。
//
// アイコンは lucide-react から名前指定でインポートする（07 §アイコンライブラリ）。
// サイズは h-4 w-4（既存ステータス列の h-5 w-5 より一段小さくする）。
// 色は Tailwind 標準クラスのみを使い、任意値・inline style は使わない。
import {
  Split,
  ArrowLeftRight,
  Circle,
  Contrast,
  CircleCheck,
  CircleX,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyValue } from '../ui/empty-value';
import { Badge } from '../ui/badge';

interface StatusMarkProps {
  /** 表示するアイコン（lucide-react） */
  icon: LucideIcon;
  /** ツールチップ兼読み上げ文言 */
  label: string;
  /** 文字色（Tailwind 標準クラス） */
  colorClass: string;
  /** 押下で状態を切り替える場合のハンドラ（未指定時は参照専用の表示） */
  onClick?: () => void;
}

// アイコン1つ分。
// 読み上げ名とツールチップは span 側に持たせ、アイコン自体は装飾扱いにする（06 §1.4.1）。
// onClick を渡した場合はキーボード操作・フォーカスリングを備える button で描画する。
export const StatusMark = ({
  icon,
  label,
  colorClass,
  onClick,
}: StatusMarkProps) => {
  // JSX でコンポーネントとして扱うため大文字始まりの変数に入れ替える
  const Icon = icon;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className="inline-flex rounded-full p-0.5 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      >
        <Icon className={`h-4 w-4 ${colorClass}`} aria-hidden="true" />
      </button>
    );
  }
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex">
      <Icon className={`h-4 w-4 ${colorClass}`} aria-hidden="true" />
    </span>
  );
};

interface SplitTransferMarksProps {
  /** 分割された支払か */
  isSplit: boolean;
  /** 部門振替の振替元になった支払か（受け取った側は「他部門受領」で表す） */
  isTransfer: boolean;
}

// 分割・振替有無のアイコン。
// 分割（Split・青）と振替（ArrowLeftRight・橙）を独立して示し、両方該当なら並べる。
// どちらでもない場合は値なしのグレーの「-」（EmptyValue）。形と色の両方で区別できるため色を判別できなくても意味が伝わる。
export function SplitTransferMarks({
  isSplit,
  isTransfer,
}: SplitTransferMarksProps) {
  if (!isSplit && !isTransfer) {
    return <EmptyValue />;
  }
  return (
    <span className="flex items-center gap-1">
      {isSplit && (
        <StatusMark icon={Split} label="分割有" colorClass="text-blue-600" />
      )}
      {isTransfer && (
        <StatusMark
          icon={ArrowLeftRight}
          label="振替有"
          colorClass="text-amber-600"
        />
      )}
    </span>
  );
}

interface SplitPresenceBadgeProps {
  /** 追加口に分割があるか */
  hasSplit: boolean;
}

// 追加口の分割有無のバッジ（支払詳細(追加口請求書有)の追加口カードのタイトル横）。
// 明細行ごとには出さず、カード単位で「分割あり／分割なし」の2段階で示す（→ 20260901_第33回 決定事項14）。
// 分割ありは SplitTransferMarks の「分割有」と同じアイコン・配色（Split・青）にそろえる。
// 文言を常に出すため、色を判別できなくても意味が伝わる。
// 表示は共通部品 Badge（outline）に配色を足して使う（→ 02 §12 ステータス表示は badge）。
// アイコンの大きさは Badge 側の既定（バッジ内の svg を縮小）に任せる。
export function SplitPresenceBadge({ hasSplit }: SplitPresenceBadgeProps) {
  return hasSplit ? (
    <Badge
      variant="outline"
      className="rounded-full border-blue-300 bg-blue-50 font-bold text-blue-700"
    >
      <Split aria-hidden="true" />
      分割あり
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="rounded-full border-gray-300 bg-gray-50 text-gray-600"
    >
      分割なし
    </Badge>
  );
}

/**
 * 計画紐付の状態。
 * none＝対象なし（分割していない／振替が発生していない／計画紐付を持たない伝票）。
 * 「未紐付」と見分けられるよう、none だけはアイコンにせず値なしのグレーの「-」で表す。
 */
export type PlanLinkState = 'unlinked' | 'partial' | 'linked' | 'none';

/**
 * 単独表示（PlanLinkStatusMark）でのみ扱う状態を加えた版。
 * noPlan＝計画なし（紐づける計画が存在しない明細。営業担当者が自ら指定する）。
 * 支払一覧の3連アイコン（支払／分割／振替）では使わないため PlanLinkState には含めない。
 */
export type PlanLinkMarkState = PlanLinkState | 'noPlan';

// 状態ごとのアイコンと配色。
// 図形はアイコン案 S1「充填」（空の円→半分の円→チェックで中身が増える形）、
// 配色は P3「未紐付を強調」（red-500／amber-600／green-600）を採用する
// （課題No.0948関連_支払一覧の計画紐づけステータスのアイコン案.pptx）。
// noPlan は「紐づけ作業が不要」＝注意を引く必要がないため灰色とする。
const PLAN_LINK_CONFIG: Record<
  Exclude<PlanLinkMarkState, 'none'>,
  { icon: LucideIcon; label: string; colorClass: string }
> = {
  unlinked: { icon: Circle, label: '未紐付', colorClass: 'text-red-500' },
  partial: { icon: Contrast, label: '一部紐付', colorClass: 'text-amber-600' },
  linked: {
    icon: CircleCheck,
    label: '全て紐付済',
    colorClass: 'text-green-600',
  },
  noPlan: {
    icon: CircleX,
    label: '計画なし',
    colorClass: 'text-gray-500',
  },
};

interface PlanLinkStatusMarkProps {
  /** 計画紐付の状態 */
  state: PlanLinkMarkState;
  /** ツールチップ兼読み上げ文言（未指定時は状態の既定文言） */
  label?: string;
  /** 押下で状態を切り替える場合のハンドラ（未指定時は参照専用の表示） */
  onClick?: () => void;
}

// 計画紐付ステータスのアイコン1つ分（支払・分割・振替の区分を持たない単独表示用）。
// 支払詳細の拡売費一覧など、1行が1つの状態しか持たない列で使う。
// 対象なし（none）は「未紐付」と確実に見分けられるようアイコンにせず値なしのグレーの「-」で表す。
export function PlanLinkStatusMark({
  state,
  label,
  onClick,
}: PlanLinkStatusMarkProps) {
  if (state === 'none') {
    return <EmptyValue />;
  }
  const config = PLAN_LINK_CONFIG[state];
  return (
    <StatusMark
      icon={config.icon}
      label={label ?? config.label}
      colorClass={config.colorClass}
      onClick={onClick}
    />
  );
}

// 3連アイコンの1スロット分の幅。
// 案Aはヘッダー2行目の「支／分／振」と本体のアイコンを縦に揃えるため、
// ヘッダー・セルの双方で同じ幅指定を使う。
export const PLAN_LINK_SLOT_CLASS = 'w-4 flex justify-center';

// 区分の並び順（左から支払・分割・振替の固定位置）。
export const PLAN_LINK_CATEGORIES = ['支払', '分割', '振替'] as const;

interface PlanLinkStatusIconsProps {
  /** 支払伝票そのものの経費明細が計画に紐づいているか */
  payment: PlanLinkState;
  /** 分割してできた明細がそれぞれ計画に紐づいているか */
  split: PlanLinkState;
  /** 他部署へ振替えた明細が振替先の計画に紐づいているか */
  transfer: PlanLinkState;
}

// 計画紐付ステータスの3連アイコン（案A：1列・区分は左から支払／分割／振替の固定位置）。
// 区分名はヘッダー2行目の副見出しが凡例を兼ねるため、セル内には文字を置かない。
// 対象なしは「未紐付」と確実に見分けられるようアイコンにせず「－」で表す。
export function PlanLinkStatusIcons({
  payment,
  split,
  transfer,
}: PlanLinkStatusIconsProps) {
  const states: PlanLinkState[] = [payment, split, transfer];
  return (
    <div className="flex items-center gap-1">
      {states.map((state, index) => (
        <span
          key={PLAN_LINK_CATEGORIES[index]}
          className={PLAN_LINK_SLOT_CLASS}
        >
          {state === 'none' ? (
            <EmptyValue />
          ) : (
            <StatusMark
              icon={PLAN_LINK_CONFIG[state].icon}
              colorClass={PLAN_LINK_CONFIG[state].colorClass}
              label={`${PLAN_LINK_CATEGORIES[index]}：${PLAN_LINK_CONFIG[state].label}`}
            />
          )}
        </span>
      ))}
    </div>
  );
}

interface PlanLinkStatusMarksProps {
  /** 支払伝票そのものの経費明細が計画に紐づいているか */
  payment: PlanLinkState;
  /** 分割してできた明細がそれぞれ計画に紐づいているか */
  split: PlanLinkState;
  /** 他部署へ振替えた明細が振替先の計画に紐づいているか */
  transfer: PlanLinkState;
}

// 計画紐付ステータス（支払・分割・振替の3区分）。
// フォーム項目ではグリッドのようなヘッダー副見出しを置けないため、区分を文字で示して誤読を防ぐ。
export function PlanLinkStatusMarks({
  payment,
  split,
  transfer,
}: PlanLinkStatusMarksProps) {
  const categories: { category: string; state: PlanLinkState }[] = [
    { category: '支払', state: payment },
    { category: '分割', state: split },
    { category: '振替', state: transfer },
  ];
  return (
    <span className="flex items-center gap-4">
      {categories.map(({ category, state }) => (
        <span key={category} className="flex items-center gap-1">
          <span className="text-sm text-gray-900">{category}</span>
          {state === 'none' ? (
            <EmptyValue />
          ) : (
            <StatusMark
              icon={PLAN_LINK_CONFIG[state].icon}
              colorClass={PLAN_LINK_CONFIG[state].colorClass}
              label={`${category}：${PLAN_LINK_CONFIG[state].label}`}
            />
          )}
        </span>
      ))}
    </span>
  );
}

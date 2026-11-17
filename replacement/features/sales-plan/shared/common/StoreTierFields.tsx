import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { NameCodeValue, PlanStoreTier } from '@/types/planDetail';
import { joinCodeName } from '@/utils/common/nameCode';
import { FORM_VALUE_CLASS, SEARCH_LABEL_CLASS } from '@/styles/commonStyles';

interface StoreTierFieldsProps {
  // 表示する三次店・一次店の組。先頭の組を代表として常に表示し、2件目以降は開いたときだけ表示する。
  tiers: PlanStoreTier[];
  // 一次店の項目が占める列数のクラス（例：col-span-2）。右に別の項目が並ぶときは省略して1列にする。
  firstStoreColSpanClass?: string;
}

const codeName = (v: NameCodeValue) => joinCodeName(v.code, v.name);

// 組を「三次店 / 一次店」の1行に整形する（上の行の項目の並びと同じ順）。
const tierLabel = (tier: PlanStoreTier) =>
  `${codeName(tier.third)} / ${codeName(tier.first)}`;

// 項目名のクラス（基本情報エリアのほかの項目・計画一覧の検索条件と同じ幅・書式。値の高さに合わせて縦中央）
const LABEL_CLASS = `${SEARCH_LABEL_CLASS} h-8 items-center`;

// 基本情報エリア（計画詳細／販売計画シミュレーション／年間計画作成）の「三次店」「一次店」。
// 5列のグリッドの中に、三次店・一次店の2つの項目（グリッドのセル）として並べる（自販機の基本情報と同じ並び）。
// 参照専用の複数件のため、プルダウンの体裁は使わない。代表（先頭の組）を出し、一次店の右の「他N件」で
// 残りの組を開閉する。開いた一覧は次の行に、三次店の値の左端から「三次店 / 一次店」で縦に並べる（→ 02 §10.4）。
// 1行目の2列目（販売店の右）から置く前提のため、開いた一覧のセルは2行目（row-start-2）の col-start-2 から右端までを使う
// （行を指定して先に置くことで、右に並ぶ三次店企業・担当エリアが1行目に残る）。
export function StoreTierFields({
  tiers,
  firstStoreColSpanClass = '',
}: StoreTierFieldsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // 開閉トグルと展開領域を aria-controls で紐づけるための ID。
  const restListId = useId();

  const [representative, ...restTiers] = tiers;
  const hasRest = restTiers.length > 0;

  const value = (v: NameCodeValue | undefined) =>
    v ? (
      <span className={`${FORM_VALUE_CLASS} truncate`} title={codeName(v)}>
        {codeName(v)}
      </span>
    ) : (
      <span className={FORM_VALUE_CLASS}>-</span>
    );

  return (
    <>
      {/* 三次店：代表（先頭の組）の三次店 */}
      <div className="flex items-start gap-2 min-w-0">
        <label className={LABEL_CLASS}>三次店</label>
        <div className="flex-1 min-w-0 h-8 flex items-center">
          {value(representative?.third)}
        </div>
      </div>

      {/* 一次店：代表の組の一次店＋残りの件数のトグル */}
      <div
        className={`flex items-start gap-2 min-w-0 ${firstStoreColSpanClass}`}
      >
        <label className={LABEL_CLASS}>一次店</label>
        <div className="flex-1 min-w-0 h-8 flex items-center gap-2">
          {value(representative?.first)}
          {hasRest && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-controls={restListId}
              className="shrink-0 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none rounded px-1"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
              {isExpanded ? '閉じる' : `他${restTiers.length}件`}
            </button>
          )}
        </div>
      </div>

      {/* 開いたときの残りの組。次の行の2列目から右端までを使い、三次店の値の左端（ラベル幅 5.625rem＋間隔 0.5rem）にそろえる */}
      {hasRest && isExpanded && (
        <ul
          id={restListId}
          className="row-start-2 col-start-2 col-span-4 -mt-2 ml-[6.125rem] pt-1 border-t border-gray-200 max-h-80 overflow-y-auto"
        >
          {restTiers.map((tier, index) => (
            <li
              key={`${index}:${tier.third.code}:${tier.first.code}`}
              className={`h-8 flex items-center ${FORM_VALUE_CLASS} truncate`}
              title={tierLabel(tier)}
            >
              {tierLabel(tier)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

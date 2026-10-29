import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  firstStoreCode,
  thirdStoreCode,
  type StoreTier,
} from '../../constants/storeTierMockData';
import { joinCodeName } from '../../utils/nameCode';
import { FORM_VALUE_CLASS } from '../../../styles/commonStyles';

interface StoreTierListProps {
  // 表示する一次店/三次店の組。先頭を常時表示し、2件目以降は展開時のみ表示する。
  tiers: StoreTier[];
}

// 一次店・三次店を「コード:名称 / コード:名称」の1行に整形する。
function tierLabel(tier: StoreTier): string {
  const first = joinCodeName(firstStoreCode(tier.first), tier.first);
  const third = joinCodeName(thirdStoreCode(tier.third), tier.third);
  return `${first} / ${third}`;
}

// 基本情報エリア（計画詳細／販売計画シミュレーション）の「一次店/三次店」表示。
// 参照専用の複数件リストであり選択はできないため、枠線付きボックス＋▼という
// プルダウン（Select）と同じ体裁は使わない。先頭1件は他の参照項目（事業場・部署など）と
// 同じ素のテキストで表示し、残りは件数付きのリンク体裁トグルで開閉する。
export function StoreTierList({ tiers }: StoreTierListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // 開閉トグルと展開領域を aria-controls で紐づけるための ID。
  const restListId = useId();

  if (tiers.length === 0) {
    return (
      <div className={`flex-1 h-8 flex items-center ${FORM_VALUE_CLASS}`}>
        -
      </div>
    );
  }

  const [firstTier, ...restTiers] = tiers;
  const hasRest = restTiers.length > 0;

  return (
    <div className="flex-1 min-w-0">
      {/* 先頭1件＋残り件数のトグル。高さは他の参照項目（h-8）に揃える。 */}
      <div className="h-8 flex items-center gap-2">
        <span
          className={`${FORM_VALUE_CLASS} truncate`}
          title={tierLabel(firstTier)}
        >
          {tierLabel(firstTier)}
        </span>
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

      {/* 残りの一次店/三次店。先頭1件と同じ左端に揃え、区切り線で続きであることを示す。 */}
      {hasRest && isExpanded && (
        <ul
          id={restListId}
          className="mt-1 pt-1 border-t border-gray-200 max-h-80 overflow-y-auto"
        >
          {restTiers.map((tier, index) => (
            <li
              key={`${index}:${tier.first}`}
              className={`h-8 flex items-center ${FORM_VALUE_CLASS} truncate`}
              title={tierLabel(tier)}
            >
              {tierLabel(tier)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

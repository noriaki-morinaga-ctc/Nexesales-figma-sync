import { useState } from 'react';

import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { StoreTierFields } from '@/app/components/shared/sales-plan/common/StoreTierFields';
import { EmptyValue } from '@/app/components/ui/empty-value';
import type { PlanBasicInfo } from '@/app/types/planDetail';
import { joinCodeName } from '@/app/utils/common/nameCode';
import { SEARCH_GRID_CLASS, SEARCH_LABEL_CLASS } from '@/styles/commonStyles';

interface SimulationBasicInfoPaneProps {
  // 計画の基本情報（画面が取得して渡す。販売店は遷移元の計画詳細から引き継ぐ値）
  basicInfo: PlanBasicInfo;
}

// シミュレーション(マージン率固定)・(NET固定)共通の基本情報エリア（→ 02 §12.2）
export function SimulationBasicInfoPane({
  basicInfo,
}: SimulationBasicInfoPaneProps) {
  const [isOpen, setIsOpen] = useState(true);

  // 三次店・一次店の組
  const firstThirdList = basicInfo.storeTiers;

  // 販売店の表示値（見出しと本文で共用）。遷移元の計画詳細から引き継ぐ値を表示する
  const dealerLabel = joinCodeName(
    basicInfo.dealer.code,
    basicInfo.dealer.name
  );

  // 三次店企業（販売店から決まる。無ければ「-」）
  const tertiaryCompany = basicInfo.tertiaryCompany;

  // 折り畳み時に見出しへ出す主要項目（開いている間は本文に表示されるため出さない）。
  // シミュレーションは販売店を表示する（ステータスは 10/27 第4回 決定事項4 で削除）。
  // 対象期間は集計・詳細のそれぞれに持つため基本情報には出さない（10/27 第4回 決定事項5）。
  const collapsedSummary = !isOpen ? (
    <dl className="flex items-center gap-4 text-sm text-gray-700 whitespace-nowrap">
      <div className="flex gap-1">
        <dt className="text-gray-500">販売店</dt>
        <dd>{dealerLabel}</dd>
      </div>
    </dl>
  ) : undefined;

  return (
    <CollapsibleCard
      title="基本情報"
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mb-4"
      headerActions={collapsedSummary}
    >
      <div className="p-4">
        {/* 1行目: 取引制度・チャネル */}
        <div
          className={`${SEARCH_GRID_CLASS} mb-2 pb-3 border-b border-gray-300`}
        >
          {/* 取引制度 */}
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>取引制度</label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(
                basicInfo.tradingSystem.code,
                basicInfo.tradingSystem.name
              )}
            </div>
          </div>

          {/* チャネル */}
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>チャネル</label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(basicInfo.channel.code, basicInfo.channel.name)}
            </div>
          </div>

          {/* 空白セル */}
          <div className="flex items-center gap-2"></div>
          <div className="flex items-center gap-2"></div>
        </div>

        {/* 2行目: 事業場・部署・作成者 */}
        <div
          className={`${SEARCH_GRID_CLASS} mb-2 pb-3 border-b border-gray-300`}
        >
          {/* 事業場 */}
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>事業場</label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(basicInfo.office.code, basicInfo.office.name)}
            </div>
          </div>

          {/* 部署 */}
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>部署</label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(
                basicInfo.department.code,
                basicInfo.department.name
              )}
            </div>
          </div>

          {/* 作成者 */}
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>作成者</label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(basicInfo.creator.code, basicInfo.creator.name)}
            </div>
          </div>
        </div>

        {/* 3行目: 5列グリッド（最終行のため下区切り罫線なし）。
            販売店・三次店・一次店の右に三次店企業、さらにその右に担当エリアを並べる（10/20 第2回 決定事項12）。
            三次店・一次店を開くと行が伸びるため、items-start で他セルを
            1行目の高さに固定して縦位置のズレを防ぐ。 */}
        <div className={`${SEARCH_GRID_CLASS} items-start`}>
          {/* 販売店 */}
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>販売店</label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {dealerLabel}
            </div>
          </div>

          {/* 三次店・一次店（自販機の基本情報と同じ並び。三次店は代表＋「他N件」で残りを開閉する） */}
          <StoreTierFields tiers={firstThirdList} />

          {/* 三次店企業。販売店が「その他販売店」の計画だけ表示し、それ以外は「-」 */}
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>三次店企業</label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {tertiaryCompany ? (
                joinCodeName(tertiaryCompany.code, tertiaryCompany.name)
              ) : (
                <EmptyValue />
              )}
            </div>
          </div>

          {/* 担当エリア */}
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>担当エリア</label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(basicInfo.area.code, basicInfo.area.name)}
            </div>
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}

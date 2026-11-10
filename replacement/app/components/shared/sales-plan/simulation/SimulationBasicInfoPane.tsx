import { useState } from 'react';

import { CollapsibleCard } from '../../../ui/collapsible-card';
import { STORE_TIER_LIST } from '../../../../constants/storeTierMockData';
import { StoreTierList } from '../common/StoreTierList';
import { EmptyValue } from '../../../ui/empty-value';
import {
  BASIC_INFO_AREA,
  BASIC_INFO_CHANNEL,
  BASIC_INFO_CREATOR,
  BASIC_INFO_DEPARTMENT,
  BASIC_INFO_OFFICE,
  tertiaryCompanyOf,
  tradingSystemCode,
} from '../../../../constants/planBasicInfoMockData';
import { joinCodeName } from '../../../../utils/common/nameCode';
import { FORM_LABEL_CLASS } from '../../../../../styles/commonStyles';

// 表示する「コード：名称」
interface CodeName {
  code: string;
  name: string;
}

interface SimulationBasicInfoPaneProps {
  // 取引方式（マージン率固定／NET固定）
  tradingSystem: 'マージン率固定' | 'NET固定';
  // 販売店（遷移元の計画詳細から引き継ぐ値）
  dealer: CodeName;
}

// シミュレーション(マージン率固定)・(NET固定)共通の基本情報エリア（→ 02 §12.2）
export function SimulationBasicInfoPane({
  tradingSystem,
  dealer,
}: SimulationBasicInfoPaneProps) {
  const [isOpen, setIsOpen] = useState(true);

  // 一次店/三次店のリスト（共通のモックデータを参照）
  const firstThirdList = STORE_TIER_LIST;

  // 販売店の表示値（見出しと本文で共用）。遷移元の計画詳細から引き継ぐ値を表示する
  const dealerLabel = joinCodeName(dealer.code, dealer.name);

  // 三次店企業（販売店から決まる。無ければ「-」）
  const tertiaryCompany = tertiaryCompanyOf(dealer);

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
        <div className="grid grid-cols-5 gap-3 mb-2 pb-3 border-b border-gray-300">
          {/* 取引制度 */}
          <div className="flex items-center gap-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
            >
              取引制度
            </label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(tradingSystemCode(tradingSystem), tradingSystem)}
            </div>
          </div>

          {/* チャネル */}
          <div className="flex items-center gap-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
            >
              チャネル
            </label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(BASIC_INFO_CHANNEL.code, BASIC_INFO_CHANNEL.name)}
            </div>
          </div>

          {/* 空白セル */}
          <div className="flex items-center gap-2"></div>
          <div className="flex items-center gap-2"></div>
        </div>

        {/* 2行目: 事業場・部署・作成者 */}
        <div className="grid grid-cols-5 gap-3 mb-2 pb-3 border-b border-gray-300">
          {/* 事業場 */}
          <div className="flex items-center gap-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
            >
              事業場
            </label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(BASIC_INFO_OFFICE.code, BASIC_INFO_OFFICE.name)}
            </div>
          </div>

          {/* 部署 */}
          <div className="flex items-center gap-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
            >
              部署
            </label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(
                BASIC_INFO_DEPARTMENT.code,
                BASIC_INFO_DEPARTMENT.name
              )}
            </div>
          </div>

          {/* 作成者 */}
          <div className="flex items-center gap-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
            >
              作成者
            </label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(BASIC_INFO_CREATOR.code, BASIC_INFO_CREATOR.name)}
            </div>
          </div>
        </div>

        {/* 3行目: 5列グリッド（最終行のため下区切り罫線なし）。
            一次店/三次店の右に三次店企業、さらにその右に担当エリアを並べる（10/20 第2回 決定事項12）。
            一次店/三次店を展開すると行が伸びるため、items-start で他セルを
            1行目の高さに固定して縦位置のズレを防ぐ。 */}
        <div className="grid grid-cols-5 gap-3 items-start">
          {/* 販売店 */}
          <div className="flex items-center gap-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
            >
              販売店
            </label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {dealerLabel}
            </div>
          </div>

          {/* 一次店/三次店（参照専用の複数件。プルダウンと誤認させないため
              先頭1件は素のテキスト＋残りは件数付きトグルで表示する） */}
          <div className="flex items-start gap-2 col-span-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[6.875rem] px-2 h-8 flex items-center justify-end`}
            >
              一次店/三次店
            </label>

            <StoreTierList tiers={firstThirdList} />
          </div>

          {/* 三次店企業。販売店が「その他販売店」の計画だけ表示し、それ以外は「-」 */}
          <div className="flex items-center gap-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
            >
              三次店企業
            </label>
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
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
            >
              担当エリア
            </label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(BASIC_INFO_AREA.code, BASIC_INFO_AREA.name)}
            </div>
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}

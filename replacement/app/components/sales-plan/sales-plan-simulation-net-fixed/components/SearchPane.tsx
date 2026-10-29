import { CollapsibleCard } from '../../../ui/collapsible-card';
import { useState } from 'react';
import { STORE_TIER_LIST } from '../../../../constants/storeTierMockData';
import { StoreTierList } from '../../../shared/StoreTierList';
import {
  BASIC_INFO_AREA,
  BASIC_INFO_CHANNEL,
  BASIC_INFO_CREATOR,
  BASIC_INFO_DEALER_OTHER,
  BASIC_INFO_DEPARTMENT,
  BASIC_INFO_OFFICE,
  BASIC_INFO_STATUS,
  BASIC_INFO_TERTIARY_COMPANY,
  tradingSystemCode,
} from '../../../../constants/planBasicInfoMockData';
import { joinCodeName } from '../../../../utils/nameCode';
import { FORM_LABEL_CLASS } from '../../../../../styles/commonStyles';

export function SearchPane() {
  const [isOpen, setIsOpen] = useState(true);

  // 一次店/三次店のリスト（共通のモックデータを参照）
  const firstThirdList = STORE_TIER_LIST;

  // 販売店の表示値（見出しと本文で共用）。遷移元の計画詳細(NET固定)から引き継ぐ値を表示する
  const dealerLabel = joinCodeName(
    BASIC_INFO_DEALER_OTHER.code,
    BASIC_INFO_DEALER_OTHER.name
  );

  // 折り畳み時に見出しへ出す主要項目（開いている間は本文に表示されるため出さない）。
  // シミュレーションは対象年月の代わりにステータス・販売店を表示する
  // （共通対応方針P34。表示する項目は基本設計で精査する）。対象期間は集計・詳細の
  // それぞれに持つため基本情報には出さない（6/16 第9回 決定9）。
  const collapsedSummary = !isOpen ? (
    <dl className="flex items-center gap-4 text-sm text-gray-700 whitespace-nowrap">
      <div className="flex gap-1">
        <dt className="text-gray-500">ステータス</dt>
        <dd>{BASIC_INFO_STATUS}</dd>
      </div>
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
        {/* 1行目: ステータス（対象期間は集計・詳細のそれぞれに持つ：6/16 第9回 決定9） */}
        <div className="grid grid-cols-5 gap-3 mb-2 pb-3 border-b border-gray-300">
          {/* ステータス */}
          <div className="flex items-center gap-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
            >
              ステータス
            </label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {BASIC_INFO_STATUS}
            </div>
          </div>

          {/* 空白セル */}
          <div className="flex items-center gap-2"></div>
        </div>

        {/* 2行目: 4列グリッド */}
        <div className="grid grid-cols-5 gap-3 mb-2 pb-3 border-b border-gray-300">
          {/* 取引制度 */}
          <div className="flex items-center gap-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
            >
              取引制度
            </label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(tradingSystemCode('NET固定'), 'NET固定')}
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

        {/* 3行目: 5列グリッド（作成者の真横に三次店企業を並べる） */}
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

          {/* 三次店企業（作成者の真横）。遷移元の計画詳細(NET固定)から引き継ぐ実値を表示する */}
          <div className="flex items-center gap-2">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
            >
              三次店企業
            </label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(
                BASIC_INFO_TERTIARY_COMPANY.code,
                BASIC_INFO_TERTIARY_COMPANY.name
              )}
            </div>
          </div>
        </div>

        {/* 4行目: 5列グリッド（最終行のため下区切り罫線なし）。
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
          <div className="flex items-start gap-2 col-span-4">
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[6.875rem] px-2 h-8 flex items-center justify-end`}
            >
              一次店/三次店
            </label>

            <StoreTierList tiers={firstThirdList} />
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}

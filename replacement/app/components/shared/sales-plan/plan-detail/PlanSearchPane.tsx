import { useState } from 'react';

import { CollapsibleCard } from '@/app/components/ui/collapsible-card';
import { MonthStripPicker } from '@/app/components/ui/month-strip-picker';
import { StoreTierFields } from '@/app/components/shared/sales-plan/common/StoreTierFields';
import { BasicInfoCollapsedSummary } from '@/app/components/shared/sales-plan/common/BasicInfoCollapsedSummary';
import type { PlanBasicInfo } from '@/app/types/planDetail';
import { joinCodeName } from '@/app/utils/common/nameCode';
import { SEARCH_GRID_CLASS, SEARCH_LABEL_CLASS } from '@/styles/commonStyles';
import { EmptyValue } from '@/app/components/ui/empty-value';

interface PlanSearchPaneProps {
  // ステータスを表示するか（既定: 表示）。
  // 年間計画作成のように単月のステータスを持たない画面では false にする。
  showStatus?: boolean;
  // 計画の基本情報（画面が取得して渡す）
  basicInfo: PlanBasicInfo;
  // 対象年月（親で制御する場合に渡す。集計エリアと共有するため）
  targetYearMonth?: string;
  onChangeTargetYearMonth?: (value: string) => void;
  // 対象年月を表示するか（既定: 表示）。
  // 年間計画作成のように単月を対象としない画面では false にする。
  showTargetYearMonth?: boolean;
  // 取引制度・チャネルの行を表示するか（既定: 表示）。
  showTradingSystemAndChannel?: boolean;
  // 折り畳んだときに見出しへ主要項目（対象年月・ステータス・販売店）を表示するか（既定: 表示しない）。
  // 折り畳んでも操作中の計画が分かるようにする（課題0368。計画詳細の手売り2画面で指定）。
  showSummaryWhenCollapsed?: boolean;
  // 三次店企業・担当エリアを、下段の一次店の右に並べるか（既定: 上段の作成者の並び）。
  // 年間計画作成で指定する（10/20手売りセッション 決定事項12。その他販売店のときにセットで使うため）。
  placeCompanyAndAreaAfterStores?: boolean;
}

export function PlanSearchPane({
  showStatus = true,
  showTargetYearMonth = true,
  showTradingSystemAndChannel = true,
  basicInfo,
  targetYearMonth: targetYearMonthProp,
  onChangeTargetYearMonth,
  showSummaryWhenCollapsed = false,
  placeCompanyAndAreaAfterStores = false,
}: PlanSearchPaneProps) {
  const [isOpen, setIsOpen] = useState(true);
  // 対象年月（カレンダー入力）。親から渡された場合は制御コンポーネントとして共有する。
  const [internalYearMonth, setInternalYearMonth] = useState('2025/10');
  const targetYearMonth = targetYearMonthProp ?? internalYearMonth;
  const setTargetYearMonth = onChangeTargetYearMonth ?? setInternalYearMonth;

  // 三次店・一次店の組
  const firstThirdList = basicInfo.storeTiers;

  // 販売店の表示値
  const dealerLabel = joinCodeName(
    basicInfo.dealer.code,
    basicInfo.dealer.name
  );

  // 担当エリア（placeCompanyAndAreaAfterStores で表示位置が変わるため変数にまとめる）
  const areaField = (
    <div className="flex items-center gap-2">
      <label className={SEARCH_LABEL_CLASS}>担当エリア</label>
      <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
        {joinCodeName(basicInfo.area.code, basicInfo.area.name)}
      </div>
    </div>
  );

  // 三次店企業。販売店が「その他販売店」の計画だけ値を持ち、他は「-」
  const tertiaryCompanyField = (
    <div className="flex items-center gap-2">
      <label className={SEARCH_LABEL_CLASS}>三次店企業</label>
      <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
        {basicInfo.tertiaryCompany ? (
          joinCodeName(
            basicInfo.tertiaryCompany.code,
            basicInfo.tertiaryCompany.name
          )
        ) : (
          <EmptyValue />
        )}
      </div>
    </div>
  );

  // 折り畳み時に見出しへ出す主要項目（開いている間は本文に表示されるため出さない）
  const collapsedSummary =
    showSummaryWhenCollapsed && !isOpen ? (
      // 共通部品（自販機の基本情報と同じ表示 → UX-066）
      <BasicInfoCollapsedSummary
        items={[
          ...(showTargetYearMonth
            ? [{ label: '対象年月', value: targetYearMonth }]
            : []),
          ...(showStatus
            ? [{ label: 'ステータス', value: basicInfo.status }]
            : []),
          { label: '販売店', value: dealerLabel },
        ]}
      />
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
        {/* 1行目: 対象年月（月ストリップ）とステータス。
            どちらも持たない画面（年間計画作成）では行ごと出力しない。 */}
        {/* ステータスの位置は対象年月の col-span で制御する（等幅5列を維持）。
            月ストリップの必要幅（ラベル 5.625rem＋間隔＋ストリップ1048px）に対し、
            3列では最大1113px（1920px幅）で収まらずステータスに重なるため、
            収まる唯一の span が col-span-4。ステータスは5列目に固定され、
            2行目以降の列位置とも縦に揃う。 */}
        {(showTargetYearMonth || showStatus) && (
          <div
            className={`${SEARCH_GRID_CLASS} mb-2.5 pb-2.5 border-b border-gray-300`}
          >
            {/* 対象年月 */}
            {showTargetYearMonth ? (
              <div className="col-span-4 flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>対象年月</label>
                <div className="min-w-0">
                  <MonthStripPicker
                    disabledMonths={basicInfo.noDataMonths}
                    value={targetYearMonth}
                    onChange={setTargetYearMonth}
                  />
                </div>
              </div>
            ) : (
              <div className="col-span-4 flex items-center gap-2" />
            )}

            {/* ステータス（コメント履歴はフッターのコメント欄の「履歴」から開く。UI/UX UX-107）。
              showStatus=false の画面では5列目を空セルにして列位置だけ揃える。 */}
            {showStatus ? (
              <div className="flex items-center gap-2">
                <label className={SEARCH_LABEL_CLASS}>ステータス</label>
                <div className="h-8 flex items-center text-sm text-gray-900 whitespace-nowrap px-2">
                  {basicInfo.status}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2" />
            )}
          </div>
        )}

        {/* 2行目: 5列グリッド。取引制度・チャネルを持たない画面では行ごと出力しない。 */}
        {showTradingSystemAndChannel && (
          <div
            className={`${SEARCH_GRID_CLASS} mb-2.5 pb-2.5 border-b border-gray-300`}
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
            <div className="flex items-center gap-2"></div>
          </div>
        )}

        {/* 3行目: 5列グリッド（作成者の真横に三次店企業を並べる） */}
        <div
          className={`${SEARCH_GRID_CLASS} mb-2.5 pb-2.5 border-b border-gray-300`}
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

          {/* 担当エリア */}
          {!placeCompanyAndAreaAfterStores && areaField}

          {/* 作成者 */}
          <div className="flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>作成者</label>
            <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
              {joinCodeName(basicInfo.creator.code, basicInfo.creator.name)}
            </div>
          </div>

          {/* 三次店企業（作成者の真横） */}
          {!placeCompanyAndAreaAfterStores && tertiaryCompanyField}
        </div>

        {/* 4行目: 5列グリッド（最終行のため下区切り罫線なし）。
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

          {/* 三次店・一次店（自販機の基本情報と同じ並び。三次店は代表＋「他N件」で残りを開閉する）。
              三次店企業・担当エリアを右に並べる場合は、一次店を1列にして収める。 */}
          <StoreTierFields
            tiers={firstThirdList}
            firstStoreColSpanClass={
              placeCompanyAndAreaAfterStores ? '' : 'col-span-2'
            }
          />

          {/* 一次店の右に三次店企業、さらにその右に担当エリア（年間計画作成） */}
          {placeCompanyAndAreaAfterStores && tertiaryCompanyField}
          {placeCompanyAndAreaAfterStores && areaField}
        </div>
      </div>
    </CollapsibleCard>
  );
}

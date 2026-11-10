import { History } from 'lucide-react';
import { useState } from 'react';

import { CollapsibleCard } from '../../../ui/collapsible-card';
import { MonthStripPicker } from '../../../ui/month-strip-picker';
import { STORE_TIER_LIST } from '../../../../constants/storeTierMockData';
import { StoreTierList } from '../common/StoreTierList';
import {
  BASIC_INFO_AREA,
  BASIC_INFO_CHANNEL,
  BASIC_INFO_CREATOR,
  BASIC_INFO_DEALER,
  BASIC_INFO_DEALER_OTHER,
  BASIC_INFO_DEPARTMENT,
  BASIC_INFO_OFFICE,
  BASIC_INFO_STATUS,
  BASIC_INFO_TERTIARY_COMPANY,
  tradingSystemCode,
} from '../../../../constants/planBasicInfoMockData';
import { joinCodeName } from '../../../../utils/common/nameCode';
import {
  FORM_LABEL_CLASS,
  BUTTON_STYLES,
  BUTTON_BASE,
} from '../../../../../styles/commonStyles';
import { EmptyValue } from '../../../ui/empty-value';

interface PlanSearchPaneProps {
  // ステータス（＋コメント履歴ボタン）を表示するか（既定: 表示）。
  // 年間計画作成のように単月のステータスを持たない画面では false にする。
  showStatus?: boolean;
  onStatusClick?: () => void;
  // 取引制度の表示値（画面ごとに切替。既定は NET固定）
  tradingSystem?: string;
  // 対象年月（親で制御する場合に渡す。集計エリアと共有するため）
  targetYearMonth?: string;
  onChangeTargetYearMonth?: (value: string) => void;
  // 対象年月を表示するか（既定: 表示）。
  // 年間計画作成のように単月を対象としない画面では false にする。
  showTargetYearMonth?: boolean;
  // 取引制度・チャネルの行を表示するか（既定: 表示）。
  // false でも tradingSystem は販売店・三次店企業の出し分けに引き続き使う。
  showTradingSystemAndChannel?: boolean;
  // 折り畳んだときに見出しへ主要項目（対象年月・ステータス・販売店）を表示するか（既定: 表示しない）。
  // 折り畳んでも操作中の計画が分かるようにする（課題0368。計画詳細の手売り2画面で指定）。
  showSummaryWhenCollapsed?: boolean;
  // 三次店企業・担当エリアを、下段の一次店/三次店の右に並べるか（既定: 上段の作成者の並び）。
  // 年間計画作成で指定する（10/20手売りセッション 決定事項12。その他販売店のときにセットで使うため）。
  placeCompanyAndAreaAfterStores?: boolean;
}

export function PlanSearchPane({
  showStatus = true,
  showTargetYearMonth = true,
  showTradingSystemAndChannel = true,
  onStatusClick,
  tradingSystem = 'NET固定',
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

  // 一次店/三次店のリスト
  const firstThirdList = STORE_TIER_LIST;

  // 販売店の表示値（NET固定のみ「その他販売店」。マージン率固定・NET入力は従来表示）
  const dealerLabel =
    tradingSystem === 'NET固定'
      ? joinCodeName(BASIC_INFO_DEALER_OTHER.code, BASIC_INFO_DEALER_OTHER.name)
      : joinCodeName(BASIC_INFO_DEALER.code, BASIC_INFO_DEALER.name);

  // 担当エリア（placeCompanyAndAreaAfterStores で表示位置が変わるため変数にまとめる）
  const areaField = (
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
  );

  // 三次店企業。NET固定は実値、他制度は値を持たないため「-」
  const tertiaryCompanyField = (
    <div className="flex items-center gap-2">
      <label
        className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
      >
        三次店企業
      </label>
      <div className="flex-1 h-8 flex items-center text-sm text-gray-900">
        {tradingSystem === 'NET固定' ? (
          joinCodeName(
            BASIC_INFO_TERTIARY_COMPANY.code,
            BASIC_INFO_TERTIARY_COMPANY.name
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
      <dl className="flex items-center gap-4 text-sm text-gray-700 whitespace-nowrap">
        {showTargetYearMonth && (
          <div className="flex gap-1">
            <dt className="text-gray-500">対象年月</dt>
            <dd>{targetYearMonth}</dd>
          </div>
        )}
        {showStatus && (
          <div className="flex gap-1">
            <dt className="text-gray-500">ステータス</dt>
            <dd>{BASIC_INFO_STATUS}</dd>
          </div>
        )}
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
        {/* 1行目: 対象年月（月ストリップ）とステータス。
            どちらも持たない画面（年間計画作成）では行ごと出力しない。 */}
        {/* ステータスの位置は対象年月の col-span で制御する（等幅5列を維持）。
            月ストリップの必要幅（ラベル85px＋ストリップ1048px＝約1141px）に対し、
            3列では最大1113px（1920px幅）で収まらずステータスに重なるため、
            収まる唯一の span が col-span-4。ステータスは5列目に固定され、
            2行目以降の列位置とも縦に揃う。 */}
        {(showTargetYearMonth || showStatus) && (
          <div className="grid grid-cols-5 gap-3 mb-2 pb-3 border-b border-gray-300">
            {/* 対象年月 */}
            {showTargetYearMonth ? (
              <div className="col-span-4 flex items-center gap-2">
                <label
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
                >
                  対象年月
                </label>
                <div className="min-w-0">
                  <MonthStripPicker
                    value={targetYearMonth}
                    onChange={setTargetYearMonth}
                  />
                </div>
              </div>
            ) : (
              <div className="col-span-4 flex items-center gap-2" />
            )}

            {/* ステータス（横にコメント履歴ボタンを配置）。
              showStatus=false の画面では5列目を空セルにして列位置だけ揃える。 */}
            {showStatus ? (
              <div className="flex items-center gap-2">
                <label
                  className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[5.3125rem] px-2 py-1 text-right`}
                >
                  ステータス
                </label>
                <div className="h-8 flex items-center text-sm text-gray-900 whitespace-nowrap px-2">
                  {BASIC_INFO_STATUS}
                </div>
                {/* 対象年月を月ストリップにしたことで1行目の必要幅が増え、1280px幅では
                ラベル+値+本ボタンが収まらずカードのoverflow-hiddenでボタン右側が
                見切れる。2xl未満はアイコンのみにして必要幅を縮め、aria-labelで
                読み上げ名は維持する（拡売費計画(商流販売店に紐づき無し)と同様）。 */}
                <button
                  type="button"
                  onClick={onStatusClick}
                  className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} flex items-center gap-1 px-2 py-1 whitespace-nowrap text-xs`}
                  aria-label="コメント履歴"
                >
                  <History className="h-4 w-4" />
                  <span className="hidden 2xl:inline">コメント履歴</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2" />
            )}
          </div>
        )}

        {/* 2行目: 5列グリッド。取引制度・チャネルを持たない画面では行ごと出力しない。 */}
        {showTradingSystemAndChannel && (
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
            <div className="flex items-center gap-2"></div>
          </div>
        )}

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
          {!placeCompanyAndAreaAfterStores && areaField}

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

          {/* 三次店企業（作成者の真横） */}
          {!placeCompanyAndAreaAfterStores && tertiaryCompanyField}
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
              先頭1件は素のテキスト＋残りは件数付きトグルで表示する）。
              三次店企業・担当エリアを右に並べる場合は、その2列分を空けて col-span-2 とする。 */}
          <div
            className={`flex items-start gap-2 ${
              placeCompanyAndAreaAfterStores ? 'col-span-2' : 'col-span-4'
            }`}
          >
            <label
              className={`${FORM_LABEL_CLASS} whitespace-nowrap w-[6.875rem] px-2 h-8 flex items-center justify-end`}
            >
              一次店/三次店
            </label>

            <StoreTierList tiers={firstThirdList} />
          </div>

          {/* 一次店/三次店の右に三次店企業、さらにその右に担当エリア（年間計画作成） */}
          {placeCompanyAndAreaAfterStores && tertiaryCompanyField}
          {placeCompanyAndAreaAfterStores && areaField}
        </div>
      </div>
    </CollapsibleCard>
  );
}

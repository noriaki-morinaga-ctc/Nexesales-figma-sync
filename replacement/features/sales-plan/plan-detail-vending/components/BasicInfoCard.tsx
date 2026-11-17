// 計画詳細(自販機)：基本情報カード（対象年月・ステータス・販売計画No.・事業場・部署・作成者・販売店・三次店・一次店）
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { BasicInfoCollapsedSummary } from '@/features/sales-plan/shared/common/BasicInfoCollapsedSummary';
import { MonthStripPicker } from '@/components/ui/month-strip-picker';
import {
  PlanBasicInfoField,
  PlanBasicInfoRow,
  PlanBasicInfoSpacer,
} from '@/components/ui/plan-basic-info';
import { SEARCH_LABEL_CLASS } from '@/styles/commonStyles';
import {
  BASIC_INFO_CREATOR,
  BASIC_INFO_DEALER,
  BASIC_INFO_DEPARTMENT,
  BASIC_INFO_OFFICE,
  BASIC_INFO_STATUS,
  PLAN_NO_DATA_MONTHS,
} from '@/mocks/common/planBasicInfo';
import {
  STORE_TIER_LIST,
  firstStoreCode,
  thirdStoreCode,
} from '@/mocks/common/storeTier';
import { joinCodeName } from '@/utils/common/nameCode';
import { BASIC_INFO_SALES_PLAN_NO } from '@/mocks/sales-plan/plan-detail-vending/basicInfo';

// 基本情報に表示する三次店/一次店。本画面では販売店・三次店・一次店がいずれも一意（1件）の
// ため、計画詳細(マージン率固定・NET入力)と同じ参照元（src/mocks/common/storeTier）の先頭を使う。
const BASIC_INFO_STORE_TIER = STORE_TIER_LIST[0];

// 一次店の列幅。取引先名（例「T1001:三菱食品株式会社（イオン）」）が既定の1列幅
// （5列等幅）に収まらないため2列分を占有させる。三次店は1列幅に収まるので既定のまま。
const BASIC_INFO_FIRST_STORE_COL_SPAN = 'col-span-2';

// 基本情報の対象年月の初期値（旧表示「対象年度=2026年／対象月=7月」に対応）。
const BASIC_INFO_INITIAL_YEAR_MONTH = '2026/07';

interface BasicInfoCardProps {
  // 見出しの行の右端（開閉の左）に置くもの。別の画面へ移るボタン（ScreenLinkButton）など
  //（専用の行を作らず見出しの行に置く → 02 §6・UX-060）
  headerActions?: ReactNode;
}

export function BasicInfoCard({ headerActions }: BasicInfoCardProps) {
  // カードの開閉（既定は展開）
  const [isOpen, setIsOpen] = useState(true);
  // 基本情報の対象年月（月ストリップ）。基準画面 計画詳細(マージン率固定・NET入力)と同様、
  // 画面内で保持する（本画面では表示専用でグリッドへは連動しない）。
  const [targetYearMonth, setTargetYearMonth] = useState(
    BASIC_INFO_INITIAL_YEAR_MONTH
  );

  return (
    <CollapsibleCard
      title="基本情報"
      open={isOpen}
      onOpenChange={setIsOpen}
      // 閉じている間は、見出しの行に主な項目（対象年月・ステータス・販売店）を出す（手売りと同じ → UX-066）
      headerActions={
        <>
          {!isOpen && (
            <BasicInfoCollapsedSummary
              items={[
                { label: '対象年月', value: targetYearMonth },
                { label: 'ステータス', value: BASIC_INFO_STATUS },
                {
                  label: '販売店',
                  value: joinCodeName(
                    BASIC_INFO_DEALER.code,
                    BASIC_INFO_DEALER.name
                  ),
                },
              ]}
            />
          )}
          {headerActions}
        </>
      }
      className="mb-6"
    >
      {/* 項目・行構成・表示体裁を計画詳細(マージン率固定・NET入力)へ統一する。
          等幅5列グリッド（PlanBasicInfoRow）で各行の項目を縦に揃え、コードを持つ項目は
          同画面と同じ参照元から「コード:名称」で表示する。
          本画面固有の「販売計画No.」のみ、基準画面の空き列（2行目3列目）へ残す。
          計画書インポート／計画書エクスポート／見積書エクスポートは本画面では扱わないため、
          カードヘッダーのボタンは持たない。 */}
      <div className="p-4">
        {/* 1行目: 対象年月（月ストリップ）とステータス。
            月ストリップの必要幅から対象年月を col-span-4 とし、ステータスを5列目に
            固定することで、2行目以降の列位置と縦に揃う（基準画面と同一）。 */}
        <PlanBasicInfoRow>
          <div className="col-span-4 flex items-center gap-2">
            <label className={SEARCH_LABEL_CLASS}>対象年月</label>
            <div className="min-w-0">
              <MonthStripPicker
                disabledMonths={PLAN_NO_DATA_MONTHS}
                value={targetYearMonth}
                onChange={setTargetYearMonth}
              />
            </div>
          </div>

          {/* ステータス（コメント履歴はフッターのコメント欄の「履歴」から開く。UI/UX UX-107） */}
          <PlanBasicInfoField label="ステータス" value={BASIC_INFO_STATUS} />
        </PlanBasicInfoRow>

        {/* 2行目: 本画面固有の販売計画No.。
            持たない項目（基準画面の「取引制度」「チャネル」）は列を空けず左へ詰める。 */}
        <PlanBasicInfoRow>
          <PlanBasicInfoField
            label="販売計画No."
            value={BASIC_INFO_SALES_PLAN_NO}
          />
          <PlanBasicInfoSpacer />
          <PlanBasicInfoSpacer />
          <PlanBasicInfoSpacer />
          <PlanBasicInfoSpacer />
        </PlanBasicInfoRow>

        {/* 3行目: 事業場・部署・作成者。
            持たない項目（基準画面の「担当エリア」「三次店企業」）は列を空けず左へ詰める。 */}
        <PlanBasicInfoRow>
          <PlanBasicInfoField
            label="事業場"
            value={joinCodeName(BASIC_INFO_OFFICE.code, BASIC_INFO_OFFICE.name)}
          />
          <PlanBasicInfoField
            label="部署"
            value={joinCodeName(
              BASIC_INFO_DEPARTMENT.code,
              BASIC_INFO_DEPARTMENT.name
            )}
          />
          <PlanBasicInfoField
            label="作成者"
            value={joinCodeName(
              BASIC_INFO_CREATOR.code,
              BASIC_INFO_CREATOR.name
            )}
          />
          <PlanBasicInfoSpacer />
          <PlanBasicInfoSpacer />
        </PlanBasicInfoRow>

        {/* 4行目: 販売店・三次店・一次店（最終行のため下区切り罫線なし）。
            いずれも一意（1件）のため参照専用値として左から順に詰めて並べる。
            一次店のみ取引先名が1列幅に収まらないため2列分を占有させる。 */}
        <PlanBasicInfoRow divider={false}>
          <PlanBasicInfoField
            label="販売店"
            value={joinCodeName(BASIC_INFO_DEALER.code, BASIC_INFO_DEALER.name)}
          />
          <PlanBasicInfoField
            label="三次店"
            value={joinCodeName(
              thirdStoreCode(BASIC_INFO_STORE_TIER.third),
              BASIC_INFO_STORE_TIER.third
            )}
          />
          <PlanBasicInfoField
            label="一次店"
            value={joinCodeName(
              firstStoreCode(BASIC_INFO_STORE_TIER.first),
              BASIC_INFO_STORE_TIER.first
            )}
            colSpanClass={BASIC_INFO_FIRST_STORE_COL_SPAN}
          />
        </PlanBasicInfoRow>
      </div>
    </CollapsibleCard>
  );
}

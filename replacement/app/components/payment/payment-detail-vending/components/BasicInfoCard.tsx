// 支払詳細(自販機)：基本情報カード（参照専用。開閉はカードの中で持つ）
import { useState } from 'react';

import { Button } from '@/app/components/ui/button';

import { CollapsibleCard } from '@/app/components/ui/collapsible-card';

import { SplitTransferMarks } from '@/app/components/shared/payment/payment-detail/PaymentStatusIcons';

import {
  BASIC_INFO_IS_SPLIT,
  BASIC_INFO_IS_TRANSFER,
  OWN_COST_BEARING_DEPT,
  BASIC_INFO_CREATOR,
  BASIC_INFO_SALES_STORE,
  BASIC_INFO_TERTIARY_STORE,
  BASIC_INFO_PRIMARY_STORE,
  PAYMENT_NO,
  SALES_PLAN_NO,
} from '@/mocks/payment/payment-detail-vending/paymentDetail';
import { LabelField } from './LabelField';
import { SEARCH_GRID_CLASS, SEARCH_LABEL_CLASS } from '@/styles/commonStyles';

interface BasicInfoCardProps {
  // 販売計画書No のリンク（計画詳細(自販機)へ）
  onSalesPlanNoClick: () => void;
}

export function BasicInfoCard({ onSalesPlanNoClick }: BasicInfoCardProps) {
  // 基本情報カードの開閉（既定は展開）
  const [isHeaderOpen, setIsHeaderOpen] = useState(true);
  return (
    <CollapsibleCard
      title="基本情報"
      open={isHeaderOpen}
      onOpenChange={setIsHeaderOpen}
    >
      <div className="p-4">
        {/* 1行目: 対象年月 / 販売計画書No / 支払No / 分割・振替有無 */}
        <div
          className={`${SEARCH_GRID_CLASS} mb-2.5 items-center pb-2.5 border-b border-gray-300`}
        >
          <LabelField
            labelClassName={SEARCH_LABEL_CLASS}
            label="対象年月"
            value={'2025年5月'}
          />
          {/* 販売計画書No は計画詳細(自販機)へのリンク。URL 遷移ではなく
                  画面の切り替え（useAppNavigation）のため、Button の link バリアントで表現する。
                  余白は他のヘッダー項目の値と左端をそろえるため 0 にする。 */}
          <LabelField
            labelClassName={SEARCH_LABEL_CLASS}
            label="販売計画書No"
            value={
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-blue-700"
                onClick={onSalesPlanNoClick}
                aria-label={`販売計画書No ${SALES_PLAN_NO} の計画詳細を開く`}
              >
                {SALES_PLAN_NO}
              </Button>
            }
          />
          <LabelField
            labelClassName={SEARCH_LABEL_CLASS}
            label="支払No"
            value={PAYMENT_NO}
          />
          <LabelField
            labelClassName={SEARCH_LABEL_CLASS}
            label="分割・振替有無"
            value={
              <SplitTransferMarks
                isSplit={BASIC_INFO_IS_SPLIT}
                isTransfer={BASIC_INFO_IS_TRANSFER}
              />
            }
          />
        </div>

        {/* 販売店 / 三次店 / 一次店 */}
        <div
          className={`${SEARCH_GRID_CLASS} mb-2.5 pb-2.5 border-b border-gray-300`}
        >
          <LabelField
            labelClassName={SEARCH_LABEL_CLASS}
            label="販売店"
            value={BASIC_INFO_SALES_STORE}
          />
          <LabelField
            labelClassName={SEARCH_LABEL_CLASS}
            label="三次店"
            value={BASIC_INFO_TERTIARY_STORE}
          />
          <LabelField
            labelClassName={SEARCH_LABEL_CLASS}
            label="一次店"
            value={BASIC_INFO_PRIMARY_STORE}
          />
          <div />
        </div>

        {/* 事業場 / 部署 / 費用負担部署 / 営業担当者（最終行・下線なし）。
                申請側の組織（申請事業場・申請部署・申請者）は支払情報エリアに持ち、
                「申請」を冠して区別する（→ 20260804_第26回 決定事項18／課題 No.0956）。 */}
        <div className={`${SEARCH_GRID_CLASS} mb-2`}>
          <LabelField
            labelClassName={SEARCH_LABEL_CLASS}
            label="事業場"
            value={'10002012:近畿圏本部'}
          />
          <LabelField
            labelClassName={SEARCH_LABEL_CLASS}
            label="部署"
            value={'10000121:近畿圏本部営業一部'}
          />
          <LabelField
            labelClassName={SEARCH_LABEL_CLASS}
            label="費用負担部署"
            value={OWN_COST_BEARING_DEPT}
          />
          <LabelField
            labelClassName={SEARCH_LABEL_CLASS}
            label="営業担当者"
            value={BASIC_INFO_CREATOR}
          />
        </div>
      </div>
    </CollapsibleCard>
  );
}

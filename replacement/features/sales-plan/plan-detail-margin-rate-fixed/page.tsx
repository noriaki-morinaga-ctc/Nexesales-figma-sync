// 計画詳細(マージン率固定)。画面の骨組みは計画詳細(NET固定)と共通の PlanDetailScreen で、
// ここではマージン率固定の計算のパターン（値・明細の表・明細追加ペインの決まり）と、
// この画面だけの機能（本部計画コピー・固定マージン率の表示）を渡す。
import { PlanDetailScreen } from '@/features/sales-plan/shared/plan-detail/PlanDetailScreen';
import type { PlanDetailPattern } from '@/types/planDetailPattern';
import { CATEGORY_OPTIONS_MARGIN } from '@/constants/promotionCategories';
import {
  COMMENT_HISTORY_DATA,
  EDI_SCENARIO_PROMOTION_ROWS,
  EDI_SCENARIO_REGULAR_ROWS,
  RETAIL_MARGIN_RATES,
} from '@/mocks/sales-plan/plan-detail-margin-rate-fixed';
import {
  REGULAR_PRODUCTS_DATA,
  NEW_PRODUCTS_DATA,
  PROMOTION_PRODUCTS_DATA,
  GIFT_PRODUCTS_DATA,
} from '@/mocks/common/salesPlanRetail';
import { NON_PRODUCT_EXPENSE_ROWS } from '@/mocks/common/nonProductExpense';
import {
  CURRENT_USER_NAME,
  UNIT_PRICE_KBN,
  isAfterTradingSystemChange,
  planBasicInfoOf,
} from '@/mocks/common/planBasicInfo';
import type { PlanDetailData } from '@/types/planDetailPattern';
import { DetailTable } from './components/DetailTable';
import { EMPTY_DETAIL_FORM } from './constants';
import {
  applyWholesaleMesh,
  detailMissingFields,
  sectionToCategory,
} from './utils';

const MARGIN_RATE_FIXED_PATTERN: PlanDetailPattern = {
  screenTitle: '計画詳細(マージン率固定・NET入力)',
  tradingSystem: 'マージン率固定',
  planPattern: 'marginRateFixed',
  aggExpandStateKey: 'PlanMarginNet.agg',
  commentFieldId: 'sales-plan-retail-comment',
  DetailTable,
  addPane: {
    emptyForm: EMPTY_DETAIL_FORM,
    categoryOptions: CATEGORY_OPTIONS_MARGIN,
    fallbackCategory: '定番商品',
    sectionToCategory,
    missingFields: detailMissingFields,
    // 主選択はサマリ商品名（一般卸メッシュは使わない）
    useWholesaleMesh: false,
    applyWholesaleMesh,
    showWholesaleMeshField: () => false,
    // NET はマージン率から算出するため入力しない（表示専用）
    isNetEditable: () => false,
  },
  hasHeadquartersCopy: true,
  showFixedMarginRate: true,
};

// 計画1件のデータ（モック。バックエンドをつないだら API から受け取る）
const PLAN_DATA: PlanDetailData = {
  basicInfo: planBasicInfoOf('マージン率固定'),
  // 補足8-7 の題材の行（EDI_SCENARIO_*）は明細と同じく先頭に足す。
  initialDetailRows: () => [
    ...EDI_SCENARIO_REGULAR_ROWS,
    ...REGULAR_PRODUCTS_DATA,
    ...NEW_PRODUCTS_DATA,
    ...EDI_SCENARIO_PROMOTION_ROWS,
    ...PROMOTION_PRODUCTS_DATA,
    ...GIFT_PRODUCTS_DATA,
  ],
  initialMarginRates: RETAIL_MARGIN_RATES,
  commentHistory: COMMENT_HISTORY_DATA,
  initialExpenseRows: NON_PRODUCT_EXPENSE_ROWS,
  unitPriceKbn: UNIT_PRICE_KBN,
  currentUserName: CURRENT_USER_NAME,
  isAfterTradingSystemChange,
};

export default function PlanDetailMarginRateFixed() {
  return (
    <PlanDetailScreen
      pattern={MARGIN_RATE_FIXED_PATTERN}
      planData={PLAN_DATA}
    />
  );
}

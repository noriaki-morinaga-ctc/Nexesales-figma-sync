// 計画詳細(NET固定)。画面の骨組みは計画詳細(マージン率固定)と共通の PlanDetailScreen で、
// ここでは NET固定の計算のパターン（値・明細の表・明細追加ペインの決まり）だけを渡す。
import { PlanDetailScreen } from '@/features/sales-plan/shared/plan-detail/PlanDetailScreen';
import type { PlanDetailPattern } from '@/types/planDetailPattern';
import { CATEGORY_OPTIONS_NET_ADDABLE } from '@/constants/promotionCategories';
import {
  COMMENT_HISTORY_DATA,
  WHOLESALE_MARGIN_RATES,
  REGULAR_PRODUCTS_DATA,
  NEW_PRODUCTS_DATA,
  PROMOTION_PRODUCTS_DATA,
  GIFT_PRODUCTS_DATA,
} from '@/mocks/sales-plan/plan-detail-net-fixed';
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

const NET_FIXED_PATTERN: PlanDetailPattern = {
  screenTitle: '計画詳細(NET固定)',
  tradingSystem: 'NET固定',
  planPattern: 'netFixed',
  aggExpandStateKey: 'PlanNetFixed.agg',
  commentFieldId: 'sales-plan-wholesale-comment',
  DetailTable,
  addPane: {
    emptyForm: EMPTY_DETAIL_FORM,
    categoryOptions: CATEGORY_OPTIONS_NET_ADDABLE,
    fallbackCategory: '新商品',
    sectionToCategory,
    missingFields: detailMissingFields,
    // 定番商品の主選択は一般卸メッシュ
    useWholesaleMesh: true,
    applyWholesaleMesh,
    // 定番商品はサマリ商品名不要（主選択の一般卸メッシュのみ）。定番商品以外は一般卸メッシュを表示専用で出す
    showWholesaleMeshField: (category) => category !== '定番商品',
    // NET はギフト・特殊商品だけ入力できる（それ以外はマスタの値を表示専用）
    isNetEditable: (category) =>
      category === 'ギフト' || category === '特殊商品',
  },
  hasHeadquartersCopy: false,
  showFixedMarginRate: false,
};

// 計画1件のデータ（モック。バックエンドをつないだら API から受け取る）
const PLAN_DATA: PlanDetailData = {
  basicInfo: planBasicInfoOf('NET固定'),
  initialDetailRows: () => [
    ...REGULAR_PRODUCTS_DATA,
    ...NEW_PRODUCTS_DATA,
    ...PROMOTION_PRODUCTS_DATA,
    ...GIFT_PRODUCTS_DATA,
  ],
  initialMarginRates: WHOLESALE_MARGIN_RATES,
  commentHistory: COMMENT_HISTORY_DATA,
  initialExpenseRows: NON_PRODUCT_EXPENSE_ROWS,
  unitPriceKbn: UNIT_PRICE_KBN,
  currentUserName: CURRENT_USER_NAME,
  isAfterTradingSystemChange,
};

export default function PlanDetailNetFixed() {
  return <PlanDetailScreen pattern={NET_FIXED_PATTERN} planData={PLAN_DATA} />;
}

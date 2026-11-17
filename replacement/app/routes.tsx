import type { ReactNode } from 'react';
import type { QuoteBasicInfo } from '@/utils/payment/quote/quoteBasicInfo';
import type { BillingRow } from '@/types/billing';
import type { BillingEdiImportRow } from '@/types/billingEdi';

import TopDashboard from '@/features/top/page';
// 販売計画
import PlanList from '@/features/sales-plan/plan-list/page';
import ManagedProductPlanList from '@/features/sales-plan/managed-product-plan-list/page';
import PlanDetailMarginRateFixed from '@/features/sales-plan/plan-detail-margin-rate-fixed/page';
import PlanDetailNetFixed from '@/features/sales-plan/plan-detail-net-fixed/page';
import PlanDetailVending from '@/features/sales-plan/plan-detail-vending/page';
import PromotionCostPlanUnlinked from '@/features/sales-plan/promotion-cost-plan-unlinked/page';
import AnnualPlanCreation from '@/features/sales-plan/annual-plan-creation/page';
import SalesPlanSimulationMarginRateFixed from '@/features/sales-plan/sales-plan-simulation-margin-rate-fixed/page';
import SalesPlanSimulationNetFixed from '@/features/sales-plan/sales-plan-simulation-net-fixed/page';
import ManagedProductPlanDetail from '@/features/sales-plan/managed-product-plan-detail/page';
import MarketingFileUpload from '@/features/sales-plan/marketing-file-upload/page';
// 実績登録
import SalesActualDetail from '@/features/actual/sales-actual-detail/page';
// 支払
import PaymentList from '@/features/payment/payment-list/page';
import PaymentDetailVending from '@/features/payment/payment-detail-vending/page';
import PaymentDetailWithInvoice from '@/features/payment/payment-detail-with-invoice/page';
import PaymentDetailWithoutInvoice from '@/features/payment/payment-detail-without-invoice/page';
import PaymentDetailOther from '@/features/payment/payment-detail-other/page';
import PaymentDetailUnlinked from '@/features/payment/payment-detail-unlinked/page';
import PaymentDetailQuote from '@/features/payment/payment-detail-quote/page';
import PaymentDetailQuoteEntry from '@/features/payment/payment-detail-quote-entry/page';
import TransferDetail from '@/features/payment/transfer-detail/page';
import QuoteList from '@/features/payment/quote-list/page';
import LocationContractAmortizationList from '@/features/payment/location-contract-amortization-list/page';
import LocationContractFeeList from '@/features/payment/location-contract-fee-list/page';
import BillingEdiList from '@/features/payment/billing-edi-list/page';
import BillingEdiDetail from '@/features/payment/billing-edi-detail/page';
import BillingList from '@/features/payment/billing-list/page';
import BillingDetailEdi from '@/features/payment/billing-detail-edi/page';
import BillingDetailAic from '@/features/payment/billing-detail-aic/page';
import UnamortizedProjectBillingList from '@/features/payment/unamortized-project-billing-list/page';
import UnamortizedProjectBilling from '@/features/payment/unamortized-project-billing/page';
// 予算
import BudgetReferenceRegistration from '@/features/budget/budget-reference-registration/page';
// マスタ
import DistributionRetailerMaster from '@/features/master/distribution-retailer-master/page';
import ManagedProductList from '@/features/master/managed-product-list/page';
import MetadataMaintenance from '@/features/master/metadata-maintenance/page';
import NoticeAdminScreen from '@/features/master/notice-admin/page';
import GeneralWholesaleMeshMaster from '@/features/master/general-wholesale-mesh-master/page';
import ManagedProductMaster from '@/features/master/managed-product-master/page';
import ContainerCapacityGroupMaster from '@/features/master/container-capacity-group-master/page';
import RetailerConditionRateMaster from '@/features/master/retailer-condition-rate-master/page';
import IndividualNetMaster from '@/features/master/individual-net-master/page';
import StrategicNetMaster from '@/features/master/strategic-net-master/page';
import NotificationMaster from '@/features/master/notification-master/page';
import SystemAdminSettingMaster from '@/features/master/system-admin-setting-master/page';
import PositionApproverSettingMaster from '@/features/master/position-approver-setting-master/page';
import DisplayManagementMaster from '@/features/master/display-management-master/page';
import ProductClassDerivationMaster from '@/features/master/product-class-derivation-master/page';
import SalesAreaMaster from '@/features/master/sales-area-master/page';
import SummaryProductManagementMaster from '@/features/master/summary-product-management-master/page';
import NewProductSummaryLinkMaster from '@/features/master/new-product-summary-link-master/page';
import NewProductItemMaster from '@/features/master/new-product-item-master/page';
import NewProductSubBrandMaster from '@/features/master/new-product-sub-brand-master/page';
import NewProductUnitPriceMaster from '@/features/master/new-product-unit-price-master/page';
import NewProductBulkChangeMaster from '@/features/master/new-product-bulk-change-master/page';
import SummaryProductMaster from '@/features/master/summary-product-master/page';

/** 画面へ渡す共有ハンドラ・状態。App.tsx が組み立てて render に渡す。
 * 画面の切り替え（遷移先のルート ID）は props で渡さず、ui/use-app-navigation の useAppNavigation で受け取る。 */
export interface RouteContext {
  /** 引用ペインから受け取った基本情報（支払詳細(引用) 入力へのプリフィル）。 */
  quoteBasicInfo?: QuoteBasicInfo;
  /** 年間計画作成へ引き継ぐ取引制度。 */
  annualPlanTradingSystem: string;
  /** 請求一覧で選択された入力単位（請求詳細へ引き継ぐ）。 */
  selectedBilling?: BillingRow;
  /** 請求一覧の行操作。データ種別に対応する請求詳細（請求EDI／AIC入力）へ遷移する。 */
  onOpenBillingDetail: (entry: BillingRow) => void;
  onCreateBilling: () => void;
  onBackToBillingList: () => void;
  /** 請求EDI取込一覧の行データ。詳細画面での再取込指示によるステータス更新を
   * 一覧・詳細の両方に反映するため、App.tsx が state で保持し配列で共有する。 */
  billingEdiRows: BillingEdiImportRow[];
  /** 請求EDI取込一覧で選択された取込分のID（請求EDI取込結果詳細へ引き継ぐ）。
   * IDのみ保持し billingEdiRows から引き直すことで、再取込後も詳細画面の表示が古くならない。 */
  selectedBillingEdiId?: string;
  onOpenBillingEdiDetail: (row: BillingEdiImportRow) => void;
  onBackToBillingEdiList: () => void;
  /** 請求EDI取込結果詳細の再取込指示（指示したエラーを取り除き、対象行のステータスを正常／エラーに付け直す）。 */
  onReimportBillingEdiSummary: (rowId: string, summaryId: string) => void;
  onAssignBillingEdiValue: (
    rowId: string,
    summaryId: string,
    assignedValue: string
  ) => void;
  onCorrectBillingEdiDetail: (
    rowId: string,
    detailId: string,
    field: string,
    corrected: string
  ) => void;
}

export interface RouteDef {
  /** 画面のディレクトリ（ルート ID との一致を検証するために保持する）。 */
  dir: string;
  render: (ctx: RouteContext) => ReactNode;
}

/**
 * ルート ID → 画面定義。
 * ルート ID は `components/<category>/<ルートID>/page.tsx` のディレクトリ名と一致させること
 * （`top` のみ `features/top/page.tsx`）。ROUTE_DIR_EXCEPTIONS 以外はテストで検証する。
 */
export const ROUTES: Record<string, RouteDef> = {
  top: {
    dir: 'top',
    render: () => <TopDashboard />,
  },

  // ── 販売計画 ──────────────────────────────────────────────
  'plan-list': {
    dir: 'sales-plan/plan-list',
    render: () => <PlanList />,
  },
  // 実績登録メニュー：作成パターンフィルターを自販機のみに絞って同じ画面を表示する
  'plan-list-actual': {
    dir: 'sales-plan/plan-list',
    render: () => <PlanList jihanki={true} />,
  },
  'managed-product-plan-list': {
    dir: 'sales-plan/managed-product-plan-list',
    render: () => <ManagedProductPlanList />,
  },
  'plan-detail-margin-rate-fixed': {
    dir: 'sales-plan/plan-detail-margin-rate-fixed',
    render: () => <PlanDetailMarginRateFixed />,
  },
  'plan-detail-net-fixed': {
    dir: 'sales-plan/plan-detail-net-fixed',
    render: () => <PlanDetailNetFixed />,
  },
  'plan-detail-vending': {
    dir: 'sales-plan/plan-detail-vending',
    render: () => <PlanDetailVending />,
  },
  'promotion-cost-plan-unlinked': {
    dir: 'sales-plan/promotion-cost-plan-unlinked',
    render: () => <PromotionCostPlanUnlinked />,
  },
  'annual-plan-creation': {
    dir: 'sales-plan/annual-plan-creation',
    render: (c) => (
      <AnnualPlanCreation tradingSystem={c.annualPlanTradingSystem} />
    ),
  },
  'sales-plan-simulation-margin-rate-fixed': {
    dir: 'sales-plan/sales-plan-simulation-margin-rate-fixed',
    render: () => <SalesPlanSimulationMarginRateFixed />,
  },
  'sales-plan-simulation-net-fixed': {
    dir: 'sales-plan/sales-plan-simulation-net-fixed',
    render: () => <SalesPlanSimulationNetFixed />,
  },
  'managed-product-plan-detail': {
    dir: 'sales-plan/managed-product-plan-detail',
    render: () => <ManagedProductPlanDetail />,
  },
  // 販売計画・実績登録の2メニューで同じ画面を使うため、key を分けて
  // メニュー切替時に状態（選択中の対象・履歴選択等）を引き継がないようにする
  'marketing-file-upload': {
    dir: 'sales-plan/marketing-file-upload',
    render: () => <MarketingFileUpload key="plan" />,
  },
  // 実績登録メニュー：アップロード・ダウンロード対象を提携機／アライアンス品／販売器具費・リース料にして同じ画面を表示する
  'marketing-file-upload-actual': {
    dir: 'sales-plan/marketing-file-upload',
    render: () => <MarketingFileUpload key="actual" jihanki={true} />,
  },

  // ── 実績登録 ──────────────────────────────────────────────
  'sales-actual-detail': {
    dir: 'actual/sales-actual-detail',
    render: () => <SalesActualDetail />,
  },

  // ── 支払 ──────────────────────────────────────────────────
  'payment-list': {
    dir: 'payment/payment-list',
    render: () => <PaymentList />,
  },
  'payment-detail-vending': {
    dir: 'payment/payment-detail-vending',
    render: () => <PaymentDetailVending />,
  },
  'payment-detail-with-invoice': {
    dir: 'payment/payment-detail-with-invoice',
    render: () => <PaymentDetailWithInvoice />,
  },
  'payment-detail-without-invoice': {
    dir: 'payment/payment-detail-without-invoice',
    render: () => <PaymentDetailWithoutInvoice />,
  },
  'payment-detail-other': {
    dir: 'payment/payment-detail-other',
    render: () => <PaymentDetailOther />,
  },
  'payment-detail-unlinked': {
    dir: 'payment/payment-detail-unlinked',
    render: () => <PaymentDetailUnlinked />,
  },
  'payment-detail-quote': {
    dir: 'payment/payment-detail-quote',
    render: () => <PaymentDetailQuote />,
  },
  'payment-detail-quote-entry': {
    dir: 'payment/payment-detail-quote-entry',
    render: (c) => <PaymentDetailQuoteEntry basicInfo={c.quoteBasicInfo} />,
  },
  'transfer-detail': {
    dir: 'payment/transfer-detail',
    render: () => <TransferDetail />,
  },
  'quote-list': {
    dir: 'payment/quote-list',
    render: () => <QuoteList />,
  },
  'location-contract-amortization-list': {
    dir: 'payment/location-contract-amortization-list',
    render: () => <LocationContractAmortizationList />,
  },
  'location-contract-fee-list': {
    dir: 'payment/location-contract-fee-list',
    render: () => <LocationContractFeeList />,
  },
  'billing-edi-list': {
    dir: 'payment/billing-edi-list',
    render: (c) => (
      <BillingEdiList
        rows={c.billingEdiRows}
        onOpenDetail={c.onOpenBillingEdiDetail}
      />
    ),
  },
  'billing-edi-detail': {
    dir: 'payment/billing-edi-detail',
    render: (c) => (
      <BillingEdiDetail
        rows={c.billingEdiRows}
        selectedId={c.selectedBillingEdiId}
        onBack={c.onBackToBillingEdiList}
        onReimportSummary={c.onReimportBillingEdiSummary}
        onAssignValue={c.onAssignBillingEdiValue}
        onCorrectDetail={c.onCorrectBillingEdiDetail}
      />
    ),
  },
  'billing-list': {
    dir: 'payment/billing-list',
    render: (c) => (
      <BillingList
        onOpenDetail={c.onOpenBillingDetail}
        onCreate={c.onCreateBilling}
      />
    ),
  },
  // 請求詳細はデータ種別ごとに画面を分ける。請求一覧からは行のデータ種別に応じて
  // どちらかへ遷移し、新規作成（AIC入力）は請求詳細(AIC入力)へ遷移する。
  'billing-detail-edi': {
    dir: 'payment/billing-detail-edi',
    render: (c) => (
      <BillingDetailEdi
        entry={c.selectedBilling}
        onBack={c.onBackToBillingList}
      />
    ),
  },
  'billing-detail-aic': {
    dir: 'payment/billing-detail-aic',
    render: (c) => (
      <BillingDetailAic
        entry={c.selectedBilling}
        onBack={c.onBackToBillingList}
      />
    ),
  },
  'unamortized-project-billing-list': {
    dir: 'payment/unamortized-project-billing-list',
    render: () => <UnamortizedProjectBillingList />,
  },
  'unamortized-project-billing': {
    dir: 'payment/unamortized-project-billing',
    render: () => <UnamortizedProjectBilling />,
  },

  // ── 予算 ──────────────────────────────────────────────────
  'budget-reference-registration': {
    dir: 'budget/budget-reference-registration',
    render: () => <BudgetReferenceRegistration />,
  },

  // ── マスタ ────────────────────────────────────────────────
  'distribution-retailer-master': {
    dir: 'master/distribution-retailer-master',
    render: () => <DistributionRetailerMaster />,
  },
  'managed-product-list': {
    dir: 'master/managed-product-list',
    render: () => <ManagedProductList />,
  },
  'metadata-maintenance': {
    dir: 'master/metadata-maintenance',
    render: () => <MetadataMaintenance />,
  },
  'notice-admin': {
    dir: 'master/notice-admin',
    render: () => <NoticeAdminScreen />,
  },
  'general-wholesale-mesh-master': {
    dir: 'master/general-wholesale-mesh-master',
    render: () => <GeneralWholesaleMeshMaster />,
  },
  'strategic-net-master': {
    dir: 'master/strategic-net-master',
    render: () => <StrategicNetMaster />,
  },
  'individual-net-master': {
    dir: 'master/individual-net-master',
    render: () => <IndividualNetMaster />,
  },
  'retailer-condition-rate-master': {
    dir: 'master/retailer-condition-rate-master',
    render: () => <RetailerConditionRateMaster />,
  },
  'container-capacity-group-master': {
    dir: 'master/container-capacity-group-master',
    render: () => <ContainerCapacityGroupMaster />,
  },
  'managed-product-master': {
    dir: 'master/managed-product-master',
    render: () => <ManagedProductMaster />,
  },
  'notification-master': {
    dir: 'master/notification-master',
    render: () => <NotificationMaster />,
  },
  'system-admin-setting-master': {
    dir: 'master/system-admin-setting-master',
    render: () => <SystemAdminSettingMaster />,
  },
  'position-approver-setting-master': {
    dir: 'master/position-approver-setting-master',
    render: () => <PositionApproverSettingMaster />,
  },
  'display-management-master': {
    dir: 'master/display-management-master',
    render: () => <DisplayManagementMaster />,
  },
  'product-class-derivation-master': {
    dir: 'master/product-class-derivation-master',
    render: () => <ProductClassDerivationMaster />,
  },
  'sales-area-master': {
    dir: 'master/sales-area-master',
    render: () => <SalesAreaMaster />,
  },
  'summary-product-management-master': {
    dir: 'master/summary-product-management-master',
    render: () => <SummaryProductManagementMaster />,
  },
  'new-product-summary-link-master': {
    dir: 'master/new-product-summary-link-master',
    render: () => <NewProductSummaryLinkMaster />,
  },
  'new-product-item-master': {
    dir: 'master/new-product-item-master',
    render: () => <NewProductItemMaster />,
  },
  'new-product-sub-brand-master': {
    dir: 'master/new-product-sub-brand-master',
    render: () => <NewProductSubBrandMaster />,
  },
  'new-product-unit-price-master': {
    dir: 'master/new-product-unit-price-master',
    render: () => <NewProductUnitPriceMaster />,
  },
  'new-product-bulk-change-master': {
    dir: 'master/new-product-bulk-change-master',
    render: () => <NewProductBulkChangeMaster />,
  },
  'summary-product-master': {
    dir: 'master/summary-product-master',
    render: () => <SummaryProductMaster />,
  },
};

/**
 * ルート ID とディレクトリ名が一致しない例外。
 * `plan-list-actual` は計画一覧を、`marketing-file-upload-actual` はファイルアップロード画面を
 * 実績モードで再利用するため、専用ディレクトリを持たない。
 */
export const ROUTE_DIR_EXCEPTIONS = new Set([
  'plan-list-actual',
  'marketing-file-upload-actual',
]);

/** ルート ID。`ROUTES` のキー。 */
export type RouteId = keyof typeof ROUTES;

/**
 * 未知のルート ID を受け取った場合のフォールバック先。
 * 初期表示ページを変えたい場合はここではなく `App.tsx` の
 * `useState<string>('…')` を編集する。
 */
export const DEFAULT_ROUTE = 'top';

/** ヘッダのメニューから遷移せず、外部システムへ飛ぶ ID。 */
export const EXTERNAL_ROUTE_IDS = new Set(['bi-system', 'budget-sales-system']);

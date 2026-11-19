import { useState, useRef, useCallback } from 'react';
import { LicenseManager } from 'ag-grid-enterprise';

import { useInitialFocus } from '@/components/ui/use-initial-focus';
import { AppProviders } from '@/components/layout/AppProviders';

import { Header } from '@/components/layout/Header';
import { ROUTES, DEFAULT_ROUTE } from './routes';
import type { RouteParams } from '@/types/navigation';
import type { BillingEdiAssignMasters } from '@/types/billingEdi';
import { BillingEdiProvider } from '@/features/payment/shared/billing-edi/BillingEdiProvider';
import {
  ASSIGN_OPTIONS,
  BILLING_EDI_ROWS,
  RETAILER_ASSIGN_OPTIONS,
  SUMMARY_PRODUCT_CODE,
  SUMMARY_PRODUCT_NAME,
} from '@/mocks/common/billingEdi';
import { setupAgGrid } from '@/components/grid';

LicenseManager.setLicenseKey(
  'AG_GRID_LICENSE_KEY'
);

// AG Grid の全画面共通の設定（モジュール・テーマ・ロケール・右クリックメニュー・列フィルタ等。→ grid/gridSetup）
setupAgGrid();
// AG Grid v33+ 新しいTheming APIを使用（CSSファイルは不要）
// 古いgrid.cssとag-theme-alpine.cssは削除

/**
 * 初期表示ページに指定できるルート ID の一覧。
 *
 * 切り替えたいときは App 内の currentPage の初期値（`useState<string>('…')`）の
 * **1 行だけ**を下記のルート ID に書き換える。他のファイルを触る必要はない。
 *
 * 別ファイル（旧 `initialPage.tsx`）に外出しすると Figma Make が再生成で元に戻して
 * しまうため、初期値は App.tsx に直接書く。
 *
 * 未知の値を書いた場合は `routes.tsx` の `DEFAULT_ROUTE`（= `top`）へフォールバックする。
 * 一覧は `src/app/routes.tsx` の `ROUTES` が正で、`routes.test.ts` が下記コメントとの
 * 同期を検証する。
 *
 * 選べるルート ID:
 *
 * - Top
 *   - `top` … Top
 * - 販売計画
 *   - `plan-list` … 計画一覧
 *   - `plan-list-actual` … 実績一覧（計画一覧の実績モード）
 *   - `managed-product-plan-list` … 計画一覧(管理対象商品)
 *   - `plan-detail-margin-rate-fixed` … 計画詳細(マージン率固定・NET入力)
 *   - `plan-detail-net-fixed` … 計画詳細(NET固定)
 *   - `plan-detail-vending` … 計画詳細（自販機）
 *   - `promotion-cost-plan-unlinked` … 拡売費計画(商流販売店に紐づき無し)
 *   - `annual-plan-creation` … 年間計画作成
 *   - `sales-plan-simulation-margin-rate-fixed` … 販売計画シミュレーション(マージン率固定・NET入力)
 *   - `sales-plan-simulation-net-fixed` … 販売計画シミュレーション(NET固定)
 *   - `managed-product-plan-detail` … 計画詳細(管理対象商品)
 *   - `marketing-file-upload` … ファイルアップロード画面
 * - 実績登録
 *   - `sales-actual-detail` … 販売実績詳細
 *   - `marketing-file-upload-actual` … ファイルアップロード画面（jihanki＝提携機／アライアンス品／販売器具費・リース料）
 * - 支払
 *   - `payment-list` … 支払一覧
 *   - `payment-detail-vending` … 支払詳細(自販機)
 *   - `payment-detail-with-invoice` … 支払詳細(追加口請求書有)
 *   - `payment-detail-without-invoice` … 支払詳細(追加口請求書無)
 *   - `payment-detail-other` … 支払詳細(その他)（★廃止）
 *   - `payment-detail-unlinked` … 支払詳細(商流販売店紐づけなし)
 *   - `payment-detail-quote` … 支払詳細(引用)
 *   - `payment-detail-quote-entry` … 支払詳細(引用) 入力
 *   - `transfer-detail` … 振替詳細
 *   - `quote-list` … 引用一覧（★廃止）
 *   - `location-contract-amortization-list` … ロケ契約(償却)一覧
 *   - `location-contract-fee-list` … ロケ契約料一覧（★廃止）
 *   - `billing-edi-list` … 請求EDI取込一覧
 *   - `billing-edi-detail` … 請求EDI取込結果詳細
 *   - `billing-list` … 請求一覧
 *   - `billing-detail-edi` … 請求詳細(請求EDI)
 *   - `billing-detail-aic` … 請求詳細(AIC入力)
 *   - `unamortized-project-billing-list` … 未償却案件請求一覧
 *   - `unamortized-project-billing` … 未償却案件請求（★廃止）
 * - 予算
 *   - `budget-reference-registration` … 予算参照登録
 * - マスタ
 *   - `distribution-retailer-master` … 商流販売店マスタ
 *   - `managed-product-list` … 管理対象商品一覧
 *   - `metadata-maintenance` … メタデータメンテナンス
 *   - `notice-admin` … お知らせメンテ
 *   - `general-wholesale-mesh-master` … 一般卸メッシュマスタ
 *   - `managed-product-master` … 管理対象商品マスタ
 *   - `container-capacity-group-master` … 容器容量グループマスタ
 *   - `retailer-condition-rate-master` … 販売店条件口率マスタ
 *   - `individual-net-master` … 個別NETマスタ
 *   - `strategic-net-master` … 戦略NETマスタ
 *   - `notification-master` … 通知管理マスタ
 *   - `system-admin-setting-master` … システム管理者設定マスタ
 *   - `position-approver-setting-master` … 役職承認者設定マスタ
 *   - `display-management-master` … 表示管理マスタ
 *   - `product-class-derivation-master` … 商品分類導出マスタ
 *   - `sales-area-master` … 担当エリアマスタ
 *   - `summary-product-master` … サマリ商品マスタ
 *   - `summary-product-management-master` … サマリ商品管理マスタ
 *   - `new-product-summary-link-master` … 新商品・新価格用サマリ商品紐づけマスタ
 *   - `new-product-item-master` … 新商品・新価格用商品マスタ
 *   - `new-product-sub-brand-master` … 新商品小ブランドマスタ
 *   - `new-product-unit-price-master` … 単価マスタ
 *   - `new-product-bulk-change-master` … 新商品一括変更マスタ
 */
// ログインユーザー（モック。修正履歴の修正者に記録する。実システムでは認証の情報から取る）
const LOGIN_USER_NAME = 'アサヒ　太郎';

// 請求EDIの「変換後の値」を明細へ反映するときに引くマスタ（モック。実システムではマスタの API から取る）
const BILLING_EDI_ASSIGN_MASTERS: BillingEdiAssignMasters = {
  assignOptions: ASSIGN_OPTIONS,
  retailerAssignOptions: RETAILER_ASSIGN_OPTIONS,
  summaryProduct: { code: SUMMARY_PRODUCT_CODE, name: SUMMARY_PRODUCT_NAME },
};

// 画面の切り替えだけを持つ。画面をまたぐ受け渡しは次の2つで行い、ここに画面ごとの state を足さない。
// - 遷移のパラメータ（ID などの文字列）：navigate の第2引数 → 遷移先は useRouteParams で読む（Next.js では URL のクエリ）
// - 画面をまたいで共有する業務のデータ：業務の Provider（Next.js では業務の layout）
export default function App() {
  // 初期表示ページ。切り替えたいときはこの 'top' を上記一覧のルート ID に書き換える
  const [currentPage, setCurrentPage] = useState<string>('top');
  // 今の画面へ遷移したときに受け取ったパラメータ（メニューから開いたときは空）
  const [routeParams, setRouteParams] = useState<RouteParams>({});

  // 画面の切り替え。画面・ヘッダーへは AppProviders（AppNavigationProvider）で渡す（→ ui/use-app-navigation）。
  // パラメータは遷移のたびに作り直す（同じ画面をメニューから開き直したときも、画面が開き直しを知れるように）。
  // state の更新関数だけを使うため、描画のたびに作り直さない
  const handleMenuChange = useCallback(
    (routeId: string, params?: RouteParams) => {
      setRouteParams({ ...params });
      setCurrentPage(routeId);
    },
    []
  );

  // 未知のルート ID を受け取った場合は既定画面へフォールバックする
  const route = ROUTES[currentPage] ?? ROUTES[DEFAULT_ROUTE];

  // 画面を表示したら、先頭の入力項目へフォーカスを当てる（画面設計標準 3.10。画面側の実装は不要）
  const mainRef = useRef<HTMLElement>(null);
  useInitialFocus(mainRef, currentPage);

  return (
    // 画面名は各画面の ScreenTitle からヘッダーへ渡す（本文には画面名の見出しを置かない）
    // 共通の Provider・トースト・確認ダイアログの表示役は AppProviders にまとめる
    <AppProviders navigate={handleMenuChange} params={routeParams}>
      {/* 請求EDI取込の行データ（取込一覧と取込結果詳細で共有する） */}
      <BillingEdiProvider
        initialRows={BILLING_EDI_ROWS}
        masters={BILLING_EDI_ASSIGN_MASTERS}
        operator={LOGIN_USER_NAME}
      >
        <div className="flex flex-col h-screen bg-app-background">
          {/* Header */}
          <Header />

          {/* Scrollable Content */}
          <main
            ref={mainRef}
            className="flex-1 overflow-x-auto overflow-y-auto bg-app-background"
          >
            {route.render()}
          </main>
        </div>
      </BillingEdiProvider>
    </AppProviders>
  );
}

// 請求詳細(AIC入力)：販売店→担当者の紐づけのモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/app/components/payment/billing-detail-aic/page.tsx。

import {
  BILLING_CUSTOMER_LINKS,
  billingStoreDisplayName,
} from '@/mocks/common/billing';

// 販売店（名称）→ 担当者（「コード:名称」）。
// 商流販売店変換マスタでは販売店が決まれば担当者も決まるため、販売店を候補から選んだ明細は
// 担当者を自動反映し、画面では変更できないようにする（→ 請求詳細（AIC入力））。
export const BILLING_STAFF_BY_STORE_NAME: Map<string, string> = new Map(
  BILLING_CUSTOMER_LINKS.filter((c) => c.storeName && c.staffName).map((c) => [
    billingStoreDisplayName(c.storeName),
    c.staffName,
  ])
);

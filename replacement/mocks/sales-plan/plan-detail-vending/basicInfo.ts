// 計画詳細(自販機)：基本情報のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/features/sales-plan/plan-detail-vending/page.tsx（基本情報カードは components/BasicInfoCard.tsx）。

// 販売計画No. のダミー値。計画一覧（PlanList）が生成する月次販売計画書No と
// 同じ「A + 年下2桁 + 連番6桁」形式に合わせる。
export const BASIC_INFO_SALES_PLAN_NO = 'A26100502';

# Figma Make 取り込み用（main 27ff696f 時点の src 一式）

前回の取り込み（main 65264f7c）からの変更は、下の 42 ファイルだけです（フォルダー構成の変更・削除・改名はありません）。

Figma Make への指示：

GitHub の Nexesales-figma-sync リポジトリ（main ブランチ）の replacement/ にある次のファイルで、src の同じ場所のファイルを置き換えてください（「新規」は追加してください）。
表にないファイルは変更しないでください。作業途中のエラーは無視してください。

| replacement/ | 置き換え先 |
|---|---|
| replacement/components/grid/index.ts | src/components/grid/index.ts |
| replacement/components/grid/numberOnlyCellEditor.ts | src/components/grid/numberOnlyCellEditor.ts（新規） |
| replacement/features/master/shared/MasterListCard.tsx | src/features/master/shared/MasterListCard.tsx |
| replacement/features/payment/billing-detail-aic/components/DetailTable.tsx | src/features/payment/billing-detail-aic/components/DetailTable.tsx |
| replacement/features/payment/billing-detail-edi/components/DetailTable.tsx | src/features/payment/billing-detail-edi/components/DetailTable.tsx |
| replacement/features/payment/billing-list/page.tsx | src/features/payment/billing-list/page.tsx |
| replacement/features/payment/location-contract-amortization-list/page.tsx | src/features/payment/location-contract-amortization-list/page.tsx |
| replacement/features/payment/payment-detail-other/page.tsx | src/features/payment/payment-detail-other/page.tsx |
| replacement/features/payment/payment-detail-vending/constants.ts | src/features/payment/payment-detail-vending/constants.ts |
| replacement/features/payment/payment-detail-vending/utilsDetailColumns.tsx | src/features/payment/payment-detail-vending/utilsDetailColumns.tsx |
| replacement/features/payment/payment-detail-vending/utilsRows.ts | src/features/payment/payment-detail-vending/utilsRows.ts |
| replacement/features/payment/payment-detail-with-invoice/components/PaymentDetailPane.tsx | src/features/payment/payment-detail-with-invoice/components/PaymentDetailPane.tsx |
| replacement/features/payment/payment-detail-with-invoice/page.tsx | src/features/payment/payment-detail-with-invoice/page.tsx |
| replacement/features/payment/payment-detail-with-invoice/paymentDetailAggregates.test.ts | src/features/payment/payment-detail-with-invoice/paymentDetailAggregates.test.ts |
| replacement/features/payment/payment-detail-without-invoice/components/PaymentDetailPane.tsx | src/features/payment/payment-detail-without-invoice/components/PaymentDetailPane.tsx |
| replacement/features/payment/payment-detail-without-invoice/page.tsx | src/features/payment/payment-detail-without-invoice/page.tsx |
| replacement/features/payment/payment-list/page.tsx | src/features/payment/payment-list/page.tsx |
| replacement/features/payment/quote-list/page.tsx | src/features/payment/quote-list/page.tsx |
| replacement/features/payment/shared/payment-detail/PaymentAmountBreakdownTable.tsx | src/features/payment/shared/payment-detail/PaymentAmountBreakdownTable.tsx |
| replacement/features/payment/shared/payment-detail/PaymentNonProductExpensePane.tsx | src/features/payment/shared/payment-detail/PaymentNonProductExpensePane.tsx |
| replacement/features/payment/shared/quote/QuoteSelectionPane.tsx | src/features/payment/shared/quote/QuoteSelectionPane.tsx |
| replacement/features/payment/transfer-detail/components/NonProductExpensePane.tsx | src/features/payment/transfer-detail/components/NonProductExpensePane.tsx |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/components/DetailTable.tsx | src/features/sales-plan/plan-detail-margin-rate-fixed/components/DetailTable.tsx |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/components/EdiMatchBanner.tsx | src/features/sales-plan/plan-detail-margin-rate-fixed/components/EdiMatchBanner.tsx |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/useEdiMatching.ts | src/features/sales-plan/plan-detail-margin-rate-fixed/useEdiMatching.ts |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/utilsDetailColumns.tsx | src/features/sales-plan/plan-detail-margin-rate-fixed/utilsDetailColumns.tsx |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/utilsEdiColumns.tsx | src/features/sales-plan/plan-detail-margin-rate-fixed/utilsEdiColumns.tsx |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/utilsEdiMatching.ts | src/features/sales-plan/plan-detail-margin-rate-fixed/utilsEdiMatching.ts |
| replacement/features/sales-plan/plan-detail-net-fixed/utilsDetailColumns.tsx | src/features/sales-plan/plan-detail-net-fixed/utilsDetailColumns.tsx |
| replacement/features/sales-plan/plan-detail-vending/components/AggregationPane.tsx | src/features/sales-plan/plan-detail-vending/components/AggregationPane.tsx |
| replacement/features/sales-plan/plan-detail-vending/page.tsx | src/features/sales-plan/plan-detail-vending/page.tsx |
| replacement/features/sales-plan/plan-list/useCellHoverCopy.tsx | src/features/sales-plan/plan-list/useCellHoverCopy.tsx |
| replacement/features/sales-plan/sales-plan-simulation-margin-rate-fixed/utilsDetailColumns.tsx | src/features/sales-plan/sales-plan-simulation-margin-rate-fixed/utilsDetailColumns.tsx |
| replacement/features/sales-plan/sales-plan-simulation-net-fixed/utilsDetailColumns.tsx | src/features/sales-plan/sales-plan-simulation-net-fixed/utilsDetailColumns.tsx |
| replacement/features/sales-plan/shared/common/AggregationItemTreeTable.tsx | src/features/sales-plan/shared/common/AggregationItemTreeTable.tsx |
| replacement/features/sales-plan/shared/plan-detail/AnnualTotalTab.tsx | src/features/sales-plan/shared/plan-detail/AnnualTotalTab.tsx |
| replacement/features/sales-plan/shared/plan-detail/PromotionCostTotalTab.tsx | src/features/sales-plan/shared/plan-detail/PromotionCostTotalTab.tsx |
| replacement/features/sales-plan/shared/simulation/SimulationAggregationPane.tsx | src/features/sales-plan/shared/simulation/SimulationAggregationPane.tsx |
| replacement/styles/grid.css | src/styles/grid.css |
| replacement/types/salesPlanRetail.ts | src/types/salesPlanRetail.ts |
| replacement/utils/payment/payment-detail/paymentAmountBreakdown.ts | src/utils/payment/payment-detail/paymentAmountBreakdown.ts |
| replacement/utils/payment/payment-detail/paymentBreakdownItems.ts | src/utils/payment/payment-detail/paymentBreakdownItems.ts |

※ src/app/App.tsx は今回の置き換えの対象外です（変更なし）。AG Grid ライセンスキー・初期表示の画面（currentPage の初期値）は Figma Make 側のままにしてください。
※ import の別名（@ = src）と vite.config の alias（'@' → ./src）はそのまま残してください。
※ src/styles/grid.css の .ag-cell.cell-pulldown::after は、content: '' と枠線（border）で ▼ を描く形です。文字（▼）や文字コードに書き換えないでください。
※ replacement/ には main 27ff696f 時点の src 一式（app・features・components・constants・types・utils・mocks・styles・main.tsx）が入っています。表のファイル以外は前回の取り込みと同じ内容です。

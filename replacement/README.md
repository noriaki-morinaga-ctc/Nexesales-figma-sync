# Figma Make 取り込み用（main 65264f7c 時点の src 一式）

前回の取り込み（main c2c58620）からの変更は、下の 23 ファイルだけです（フォルダー構成の変更・削除・改名はありません）。

Figma Make への指示：

GitHub の Nexesales-figma-sync リポジトリ（main ブランチ）の replacement/ にある次のファイルで、src の同じ場所のファイルを置き換えてください（「新規」は追加してください）。
表にないファイルは変更しないでください。作業途中のエラーは無視してください。

| replacement/ | 置き換え先 |
|---|---|
| replacement/components/shared/common/SegmentToggle.tsx | src/components/shared/common/SegmentToggle.tsx |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/components/DetailTable.tsx | src/features/sales-plan/plan-detail-margin-rate-fixed/components/DetailTable.tsx |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/components/EdiMatchBanner.tsx | src/features/sales-plan/plan-detail-margin-rate-fixed/components/EdiMatchBanner.tsx |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/page.tsx | src/features/sales-plan/plan-detail-margin-rate-fixed/page.tsx |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/useEdiMatching.ts | src/features/sales-plan/plan-detail-margin-rate-fixed/useEdiMatching.ts |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/utilsDetailColumns.tsx | src/features/sales-plan/plan-detail-margin-rate-fixed/utilsDetailColumns.tsx |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/utilsEdiColumns.tsx | src/features/sales-plan/plan-detail-margin-rate-fixed/utilsEdiColumns.tsx |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/utilsEdiMatching.test.ts | src/features/sales-plan/plan-detail-margin-rate-fixed/utilsEdiMatching.test.ts |
| replacement/features/sales-plan/plan-detail-margin-rate-fixed/utilsEdiMatching.ts | src/features/sales-plan/plan-detail-margin-rate-fixed/utilsEdiMatching.ts |
| replacement/features/sales-plan/plan-detail-net-fixed/components/DetailTable.tsx | src/features/sales-plan/plan-detail-net-fixed/components/DetailTable.tsx |
| replacement/features/sales-plan/plan-detail-vending/constants.ts | src/features/sales-plan/plan-detail-vending/constants.ts |
| replacement/features/sales-plan/plan-detail-vending/page.tsx | src/features/sales-plan/plan-detail-vending/page.tsx |
| replacement/features/sales-plan/plan-detail-vending/utilsExpensePlanColumns.tsx | src/features/sales-plan/plan-detail-vending/utilsExpensePlanColumns.tsx |
| replacement/features/sales-plan/sales-plan-simulation-margin-rate-fixed/components/DetailTable.tsx | src/features/sales-plan/sales-plan-simulation-margin-rate-fixed/components/DetailTable.tsx |
| replacement/features/sales-plan/sales-plan-simulation-net-fixed/components/DetailTable.tsx | src/features/sales-plan/sales-plan-simulation-net-fixed/components/DetailTable.tsx |
| replacement/features/sales-plan/shared/common/countDetailItems.ts | src/features/sales-plan/shared/common/countDetailItems.ts（新規） |
| replacement/features/sales-plan/shared/plan-detail/PlanDetailScreen.tsx | src/features/sales-plan/shared/plan-detail/PlanDetailScreen.tsx |
| replacement/features/sales-plan/shared/plan-detail/PlanNonProductExpensePane.tsx | src/features/sales-plan/shared/plan-detail/PlanNonProductExpensePane.tsx |
| replacement/mocks/sales-plan/plan-detail-margin-rate-fixed.ts | src/mocks/sales-plan/plan-detail-margin-rate-fixed.ts |
| replacement/mocks/sales-plan/plan-detail-vending/expense.ts | src/mocks/sales-plan/plan-detail-vending/expense.ts |
| replacement/styles/gridStyles.ts | src/styles/gridStyles.ts |
| replacement/types/planDetailPattern.ts | src/types/planDetailPattern.ts |
| replacement/types/salesPlanRetail.ts | src/types/salesPlanRetail.ts |

※ src/app/App.tsx は今回の置き換えの対象外です（変更なし）。AG Grid ライセンスキー・初期表示の画面（currentPage の初期値）は Figma Make 側のままにしてください。
※ import の別名（@ = src）と vite.config の alias（'@' → ./src）はそのまま残してください。
※ replacement/ には main 65264f7c 時点の src 一式（app・features・components・constants・types・utils・mocks・styles・main.tsx）が入っています。表のファイル以外は前回の取り込みと同じ内容です。

// 計画詳細(マージン率固定)・計画詳細(NET固定)・拡売費計画(紐づき無し)：商品以外の拡売費の明細のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 拡売費グリッド（PlanNonProductExpensePane / NonProductExpensePane）で使用。
// 管理区分・施策区分はコードから自動導出（expenseRelations と整合）させ、コード↔区分の不整合を防ぐ。
// 前年実績は削除可否の確認用に「実績あり(数値)」「実績なし(null)」の両方を混在させている。

import {
  managementClassFromCode,
  campaignClassFromCode,
} from '@/app/utils/common/expenseRelations';
import type { NonProductExpenseData } from '@/app/types/nonProductExpense';

// 管理区分・施策区分をコードから補完する
type RawExpenseRow = Omit<
  NonProductExpenseData,
  'exp1ManagementClass' | 'exp1CampaignClass'
>;

const withDerivedClasses = (row: RawExpenseRow): NonProductExpenseData => ({
  ...row,
  exp1ManagementClass: managementClassFromCode(row.exp1ManagementCode),
  exp1CampaignClass: campaignClassFromCode(row.exp1CampaignCode),
});

export const NON_PRODUCT_EXPENSE_ROWS: NonProductExpenseData[] = [
  withDerivedClasses({
    no: 1,
    metaBrand: '十六茶',
    summaryProduct: '十六茶2L6本',
    exp1PlannedAmount: 150000,
    exp1PriorYearActual: 150000,
    exp1PaymentActual: 150000,
    exp1PostingMonth: '2025/10',
    exp1ManagementCode: 'RA001',
    exp1AccountItem: '販促費',
    exp1CampaignCode: 'SN001',
    exp1Description: '店頭POP費用',
    exp1Creator: 'アサヒ　太郎',
  }),
  withDerivedClasses({
    no: 2,
    metaBrand: '三ツ矢特濃',
    summaryProduct: '三ツ矢特濃ピーチスカッシュ500mL24本',
    exp1PlannedAmount: 300000,
    exp1PriorYearActual: 280000,
    exp1PaymentActual: 250000,
    exp1PostingMonth: '2025/10',
    exp1ManagementCode: 'RB002',
    exp1AccountItem: '広告費',
    exp1CampaignCode: 'SP002',
    exp1Description: 'TV-CM放映費',
    exp1Creator: '山田 太郎',
  }),
  withDerivedClasses({
    no: 3,
    metaBrand: 'カルピス',
    summaryProduct: 'カルピスウォーター500mL24本',
    exp1PlannedAmount: 80000,
    exp1PriorYearActual: null,
    exp1PaymentActual: null,
    exp1PostingMonth: '2025/10',
    exp1ManagementCode: 'RH002',
    exp1AccountItem: '販促費',
    exp1CampaignCode: 'SS002',
    exp1Description: 'サンプリング費用',
    exp1Creator: '佐藤 花子',
  }),
  withDerivedClasses({
    no: 4,
    metaBrand: 'ウィルキンソン',
    summaryProduct: 'ウィルキンソンタンサン1L12本',
    // Important 1: 拡売費集計対象選択が計上月のとき、季節指数によるリスケール
    // （対象月10月・計上月11月 → 9月表示時に ×約1.35）でウィルキンソン×Lパックの
    // 管理利益が負転していた。450,000 では計上月基準のリスケール後に売買差益を
    // 超えるため、対象月基準の実額を保ったまま許容できる水準へ調整する。
    exp1PlannedAmount: 240000,
    exp1PriorYearActual: 430000,
    exp1PaymentActual: 400000,
    exp1PostingMonth: '2025/11',
    exp1ManagementCode: 'FA002',
    exp1AccountItem: '販促費',
    exp1CampaignCode: 'SR002',
    exp1Description: '展示会出展費',
    exp1Creator: 'アサヒ　太郎',
  }),
  withDerivedClasses({
    no: 5,
    metaBrand: '水',
    summaryProduct: 'アサヒおいしい水六甲600mL24本',
    exp1PlannedAmount: 200000,
    exp1PriorYearActual: null,
    exp1PaymentActual: 120000,
    exp1PostingMonth: '2025/10',
    exp1ManagementCode: 'FB002',
    exp1AccountItem: '広告費',
    exp1CampaignCode: 'SN003',
    exp1Description: 'Web広告費',
    exp1Creator: '鈴木 一郎',
  }),
  withDerivedClasses({
    no: 6,
    metaBrand: 'モンスター',
    summaryProduct: 'モンスターエナジー355mL24本',
    exp1PlannedAmount: 500000,
    exp1PriorYearActual: 300000,
    exp1PaymentActual: null,
    exp1PostingMonth: '2025/10',
    exp1ManagementCode: 'FH002',
    exp1AccountItem: '販促費',
    exp1CampaignCode: 'SS003',
    exp1Description: 'イベントスポンサー費',
    exp1Creator: '田中 美咲',
  }),
  withDerivedClasses({
    no: 7,
    metaBrand: 'ワンダ',
    summaryProduct: 'ワンダ金の微糖185g30本',
    exp1PlannedAmount: 120000,
    exp1PriorYearActual: null,
    exp1PaymentActual: 60000,
    exp1PostingMonth: '2025/11',
    exp1ManagementCode: 'RA001',
    exp1AccountItem: '販促費',
    exp1CampaignCode: 'SN004',
    exp1Description: 'キャンペーン費用',
    exp1Creator: 'アサヒ　太郎',
  }),
  withDerivedClasses({
    no: 8,
    metaBrand: '十六茶',
    summaryProduct: '十六茶2L6本',
    exp1PlannedAmount: 180000,
    exp1PriorYearActual: 180000,
    exp1PaymentActual: 180000,
    exp1PostingMonth: '2025/10',
    exp1ManagementCode: 'RB002',
    exp1AccountItem: '広告費',
    exp1CampaignCode: 'SP002',
    exp1Description: '雑誌広告費',
    exp1Creator: '山田 太郎',
  }),
  withDerivedClasses({
    no: 9,
    metaBrand: '三ツ矢特濃',
    summaryProduct: '三ツ矢特濃ピーチスカッシュ500mL24本',
    exp1PlannedAmount: 90000,
    exp1PriorYearActual: null,
    exp1PaymentActual: null,
    exp1PostingMonth: '2025/11',
    exp1ManagementCode: 'RH002',
    exp1AccountItem: '販促費',
    exp1CampaignCode: 'SS002',
    exp1Description: 'ノベルティ制作費',
    exp1Creator: '佐藤 花子',
  }),
  withDerivedClasses({
    no: 10,
    metaBrand: 'カルピス',
    summaryProduct: 'カルピスウォーター500mL24本',
    exp1PlannedAmount: 60000,
    exp1PriorYearActual: 280000,
    exp1PaymentActual: 200000,
    exp1PostingMonth: '2025/10',
    exp1ManagementCode: 'FA002',
    exp1AccountItem: '広告費',
    exp1CampaignCode: 'SR002',
    exp1Description: 'デジタルサイネージ費用',
    exp1Creator: '鈴木 一郎',
  }),
  // 補足3-1 No.31 ロケ補填（変動費(CF/ロケ補填)へ集計）
  withDerivedClasses({
    no: 101,
    metaBrand: '三ツ矢',
    summaryProduct: '三ツ矢サイダー500mL24本',
    // Important 2: 千円表示で0円表示になるほど小さい額（600円）まで削られていたため、
    // 妥当な水準へ戻す。この単位（三ツ矢×PET・ボトル缶500）の商品行の函数を
    // 併せて引き上げ（salesPlanRetailMockData／src/mocks/sales-plan/plan-detail-net-fixed）、
    // 計上月基準でリスケールされても管理利益が負転しないだけの余力を確保している。
    exp1PlannedAmount: 15000,
    exp1PriorYearActual: 115000,
    exp1PaymentActual: null,
    exp1PostingMonth: '2025/11',
    exp1ManagementCode: 'LC001',
    exp1AccountItem: '販促費',
    exp1CampaignCode: 'SR001',
    exp1Description: 'ロケーション補填費',
    exp1Creator: 'アサヒ　太郎',
  }),
  // 補足3-1 No.22 コラム料（自販機関係費へ集計）
  withDerivedClasses({
    no: 102,
    metaBrand: 'ワンダ',
    summaryProduct: 'ワンダ金の微糖185g30本',
    // Important 1: ワンダ×250缶の直接固定費（コラム料＋リース料）が計上月基準の
    // リスケール後に売買差益を超え管理利益が負転していたため、no.102/103 とも
    // 対象月基準の実額を保ったまま許容できる水準へ調整する。
    exp1PlannedAmount: 41000,
    exp1PriorYearActual: 58000,
    exp1PaymentActual: null,
    exp1PostingMonth: '2025/11',
    exp1ManagementCode: 'CL001',
    exp1AccountItem: '販促費',
    exp1CampaignCode: 'SR002',
    exp1Description: 'コラム使用料',
    exp1Creator: 'アサヒ　太郎',
  }),
  // 補足3-1 No.23 リース料（自販機関係費へ集計）
  withDerivedClasses({
    no: 103,
    metaBrand: 'ワンダ',
    summaryProduct: 'ワンダ金の微糖185g30本',
    exp1PlannedAmount: 31000,
    exp1PriorYearActual: null,
    exp1PaymentActual: null,
    exp1PostingMonth: '2025/11',
    exp1ManagementCode: 'LS001',
    exp1AccountItem: '販促費',
    exp1CampaignCode: 'SR003',
    exp1Description: '自販機リース料',
    exp1Creator: 'アサヒ　太郎',
  }),
  // 補足3-1 No.24 販売器具費（自販機関係費へ集計）
  withDerivedClasses({
    no: 104,
    metaBrand: '十六茶',
    summaryProduct: '十六茶2L6本',
    exp1PlannedAmount: 30000,
    exp1PriorYearActual: 28000,
    exp1PaymentActual: null,
    exp1PostingMonth: '2025/11',
    exp1ManagementCode: 'EQ001',
    exp1AccountItem: '販促費',
    exp1CampaignCode: 'SR003',
    exp1Description: '販売器具購入費',
    exp1Creator: 'アサヒ　太郎',
  }),
];

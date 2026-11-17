// sim(マージン率固定)：画面専用の型

export interface DetailFormValues {
  category: string;
  wholesaleMesh: string;
  summaryProduct: string;
  metaBrand: string;
  containerCapacityG: string;
  quantity: string;
  endSale: string;
  promotion: string;
  plan: string;
  period: string;
  // ギフト専用：上旬/中旬/下旬ごとの箱数（＝計画函数）。ギフト以外は未使用。
  boxEarly: string;
  boxMid: string;
  boxLate: string;
  currentEstimate: string;
  currentActual: string;
  prevYearActual: string;
  net: string;
  deliveryPrice: string;
  price: string;
  margin: string;
  costOfSales: string;
  seihan: string;
  profitRate: string;
  discountRate: string;
  // シミュレーション固有
  campaign: string;
  probability: string;
  // 企画名：企画に付随する名称。KEYには含まないが入力必須
  campaignName: string;
  targetMonth: string;
  // 拡売費①
  exp1PlannedAmount: string;
  exp1PostingMonth: string;
  exp1ManagementCode: string;
  exp1AccountItem: string;
  exp1ManagementClass: string;
  exp1CampaignClass: string; // 施策区分（任意）
  exp1CampaignCode: string; // 施策コード（任意）
  exp1Description: string;
  // 拡売費②
  exp2PlannedAmount: string;
  exp2PostingMonth: string;
  exp2ManagementCode: string;
  exp2AccountItem: string;
  exp2ManagementClass: string;
  exp2CampaignClass: string; // 施策区分（任意）
  exp2CampaignCode: string; // 施策コード（任意）
  exp2Description: string;
}

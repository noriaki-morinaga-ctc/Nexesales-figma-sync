// salesPlanWholesaleMockData（constants）から移した処理（→ 04 §画面ディレクトリ構成「共通の処理」）

// ── エクスポート用ダミーデータ生成 ──────────────────────────
// Excel エクスポート機能（未実装）の出力対象として用意したダミーデータ。
// 実際のアプリでは API から取得する想定。

// 商品データ（20件をループ生成）
export const generateDummyProductData = () => {
  const brands = ['三ツ矢', 'カルピス', 'ウィルキンソン', '十六茶', 'ワンダ'];
  const promotionTypes = ['定番・EDLP', '新商品', '特殊商品', 'ギフト'];
  const data = [];

  for (let i = 0; i < 20; i++) {
    data.push({
      promotionType: promotionTypes[i % 4],
      metaBrand: brands[i % 5],
      summaryProductName: `${brands[i % 5]}商品${i + 1}`,
      generalMesh: `M${100000 + i}`,
      endSale: i % 10 === 0 ? '終売' : '',
      quantity: [8, 12, 24, 30][i % 4],
      planBoxes: [800, 500, 300, 200][i % 4],
      currentEstimate: [800, 480, 290, 190][i % 4],
      currentActual: [445, 250, 150, 100][i % 4],
      prevYearActual: [800, 500, 300, 200][i % 4],
      planVsPrevYear: [100.0, 96.0, 96.7, 95.0][i % 4],
      net: [62.13, 58.5, 50.0, 36.68][i % 4],
      deliveryPrice: [55.0, 52.0, 45.0, 33.0][i % 4],
      sellingPrice: [120, 115, 100, 80][i % 4],
      marginRate: [11.2, 10.5, 9.8, 9.0][i % 4],
      markupRate: [54.2, 54.8, 55.0, 58.8][i % 4],
      seihan: [11000, 14000, 10500, 8800][i % 4],
      ukewatashi: [10500, 13500, 10000, 8400][i % 4],
      profitRate: [23.1, 18.5, 23.1, 8.5][i % 4],
      exp1Amount: i % 3 === 0 ? 50000 : 0,
      exp1PostingMonth: i % 3 === 0 ? 10 : 0,
      exp1DeliveryMonth: i % 3 === 0 ? 10 : 0,
      exp1ManagementClass: i % 3 === 0 ? '販促費' : '',
      exp1ManagementCode: i % 3 === 0 ? 'A001' : '',
      exp1Description: i % 3 === 0 ? '新商品導入費' : '',
      exp2Amount: 0,
      exp2PostingMonth: 0,
      exp2DeliveryMonth: 0,
      exp2ManagementClass: '',
      exp2ManagementCode: '',
      exp2Description: '',
    });
  }
  return data;
};

// 拡売費データ（商品外費用・3件）
export const generateDummyNonProductExpenseData = () => {
  return [
    {
      metaBrand: '三ツ矢',
      summaryProduct: '三ツ矢サイダー500mL24本',
      exp1PlannedAmount: 150000,
      exp1PriorYearActual: 0,
      exp1PostingMonth: '2025-10',
      exp1ManagementClass: '拡売費A',
      exp1ManagementCode: 'A001',
      exp1AccountItem: '販促費',
      exp1CampaignClass: '',
      exp1CampaignCode: '',
      exp1Description: '店頭POP費用',
    },
    {
      metaBrand: 'カルピス',
      summaryProduct: 'カルピスウォーター500mL24本',
      exp1PlannedAmount: 300000,
      exp1PriorYearActual: 0,
      exp1PostingMonth: '2025-10',
      exp1ManagementClass: '拡売費B',
      exp1ManagementCode: 'B002',
      exp1AccountItem: '広告費',
      exp1CampaignClass: '',
      exp1CampaignCode: '',
      exp1Description: 'TV-CM放映費',
    },
    {
      metaBrand: 'ウィルキンソン',
      summaryProduct: 'ウィルキンソン炭酸水1L12本',
      exp1PlannedAmount: 200000,
      exp1PriorYearActual: 0,
      exp1PostingMonth: '2025-10',
      exp1ManagementClass: '拡売費A',
      exp1ManagementCode: 'A003',
      exp1AccountItem: '販促費',
      exp1CampaignClass: '',
      exp1CampaignCode: '',
      exp1Description: 'サンプリング費用',
    },
  ];
};

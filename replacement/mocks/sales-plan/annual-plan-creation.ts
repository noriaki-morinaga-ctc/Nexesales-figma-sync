// 年間計画作成：初期の明細（新商品マスタ・月次の函数）のモック（バックエンドをつないだら消す → 04 §画面ディレクトリ構成「モックデータ」）。
// 画面は src/features/sales-plan/annual-plan-creation/page.tsx。

import { CATEGORY_LABELS_ANNUAL } from '@/constants/promotionCategories';
import { getPromotionLabels } from '@/utils/sales-plan/common/promotionCategories';

// ギフトの販売期間（旬）の並び。ギフトは上旬・中旬・下旬の3行1セットで計画する
// （第14回手売りセッション 決定事項8。計画詳細と同じ持ち方）。
export const GIFT_PERIOD_ORDER = ['上旬', '中旬', '下旬'] as const;

// 月次の函数（1〜12月。値の無い月は null）を行データの月列と年間合計へ展開する。
const MONTH_KEYS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

const toMonthFields = (values: (number | null)[]) => {
  const fields: Record<string, number | null> = {};
  MONTH_KEYS.forEach((key, i) => {
    fields[key] = values[i] ?? null;
  });
  fields.total = values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  return fields;
};

export const generateRowData = () => {
  // ギフトは上旬・中旬・下旬の3行1セットで表示するため、専用のダミー（giftProduct）で
  // 用意し、通常商品の商品区分（ランダム割当）からは除く。
  const productCategories = CATEGORY_LABELS_ANNUAL.filter(
    (category) => category !== 'ギフト'
  );
  const promotions = ['定番・EDLP', 'アプリ販促', 'エンド', '催事'];
  const endSales = [
    '',
    '',
    '',
    '2026年3月終売',
    '2026年6月終売',
    '2026年9月終売',
  ];

  const getRandomItem = (arr: string[]) =>
    arr[Math.floor(Math.random() * arr.length)];

  const products = [
    {
      metaBrand: '三ツ矢',
      containerCapacity: '500mL',
      summaryProduct: '三ツ矢サイダー28・350',
      wholesaleMesh: '【三ツ矢150円】三ツ矢サイダー28・350',
      productCategory: getRandomItem(productCategories),
      promotion: getRandomItem(promotions),
      endSale: getRandomItem(endSales),
      net: 62.13,
      quantity: 24,
      deliveryPrice: 75,
      sellingPrice: 98,
      marginRate: '11.11%',
      markupRate: '54.2%',
      volumeAddRate: '3.0%',
      seihan: 1800,
      genka: 2352,
      planData: [420, 400, 200, 550, 50, 0, 0, 0, 0, 0, 0, 0],
      actualData: [403, 384, 192, 528, 48, 0, 0, 0, 0, 0, 0, 0],
      prevYearData: [420, 400, 200, 550, 50, 0, 0, 0, 0, 0, 0, 0],
      // 計画／実績が複数明細（商品区分・販促区分・納価・売価が異なる）
      planVariants: [
        {
          productCategory: '定番商品',
          promotion: '定番・EDLP',
          deliveryPrice: 75,
          sellingPrice: 98,
          planData: [420, 400, 200, 550, 50, 0, 0, 0, 0, 0, 0, 0],
        },
        {
          productCategory: '特売',
          promotion: 'チラシ',
          deliveryPrice: 72,
          sellingPrice: 95,
          planData: [120, 100, 80, 150, 20, 0, 0, 0, 0, 0, 0, 0],
        },
        {
          productCategory: '新商品',
          promotion: 'エンド企画',
          deliveryPrice: 78,
          sellingPrice: 105,
          planData: [60, 50, 40, 80, 10, 0, 0, 0, 0, 0, 0, 0],
        },
      ],
    },
    {
      metaBrand: 'ウィルキンソン',
      containerCapacity: '500mL',
      summaryProduct: 'リタ瓶（プレーン）',
      wholesaleMesh: '【ウィルキンソン101円】リタ瓶（プレーン）',
      productCategory: getRandomItem(productCategories),
      promotion: getRandomItem(promotions),
      endSale: getRandomItem(endSales),
      net: 48.0,
      quantity: 24,
      deliveryPrice: 60,
      sellingPrice: 78,
      marginRate: '11.11%',
      markupRate: '50.0%',
      volumeAddRate: '2.0%',
      seihan: 2000,
      genka: 2600,
      planData: [500, 480, 300, 600, 120, 0, 0, 0, 0, 0, 0, 0],
      actualData: [480, 460, 288, 576, 115, 0, 0, 0, 0, 0, 0, 0],
      prevYearData: [500, 480, 300, 600, 120, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      metaBrand: '十六茶',
      containerCapacity: '500mL',
      summaryProduct: '十六茶自販機用660ml',
      wholesaleMesh: '【十六茶140円】十六茶自販機用660ml',
      productCategory: getRandomItem(productCategories),
      promotion: getRandomItem(promotions),
      endSale: getRandomItem(endSales),
      net: 52.0,
      quantity: 24,
      deliveryPrice: 65,
      sellingPrice: 85,
      marginRate: '11.11%',
      markupRate: '51.5%',
      volumeAddRate: '2.8%',
      seihan: 1600,
      genka: 2080,
      planData: [400, 350, 280, 500, 70, 0, 0, 0, 0, 0, 0, 0],
      actualData: [384, 336, 269, 480, 67, 0, 0, 0, 0, 0, 0, 0],
      prevYearData: [400, 350, 280, 500, 70, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      metaBrand: 'カルピス',
      containerCapacity: '500mL',
      summaryProduct: '500mL帯',
      wholesaleMesh: '【カルピスソーダ455円】500mL帯',
      productCategory: getRandomItem(productCategories),
      promotion: getRandomItem(promotions),
      endSale: getRandomItem(endSales),
      net: 55.0,
      quantity: 24,
      deliveryPrice: 68,
      sellingPrice: 88,
      marginRate: '11.11%',
      markupRate: '52.0%',
      volumeAddRate: '2.5%',
      seihan: 1200,
      genka: 1560,
      planData: [300, 280, 220, 350, 50, 0, 0, 0, 0, 0, 0, 0],
      actualData: [288, 268, 211, 336, 48, 0, 0, 0, 0, 0, 0, 0],
      prevYearData: [300, 280, 220, 350, 50, 0, 0, 0, 0, 0, 0, 0],
      // 計画／実績が複数明細（商品区分・販促区分・納価・売価が異なる）
      planVariants: [
        {
          productCategory: '定番商品',
          promotion: '定番・EDLP',
          deliveryPrice: 68,
          sellingPrice: 88,
          planData: [300, 280, 220, 350, 50, 0, 0, 0, 0, 0, 0, 0],
        },
        {
          productCategory: '特売',
          promotion: '催事',
          deliveryPrice: 65,
          sellingPrice: 85,
          planData: [150, 130, 100, 180, 30, 0, 0, 0, 0, 0, 0, 0],
        },
      ],
    },
    {
      metaBrand: '水',
      containerCapacity: '500mL',
      summaryProduct: '2L',
      wholesaleMesh: '【水355円】2L',
      productCategory: getRandomItem(productCategories),
      promotion: getRandomItem(promotions),
      endSale: getRandomItem(endSales),
      net: 35.5,
      quantity: 6,
      deliveryPrice: 45,
      sellingPrice: 58,
      marginRate: '11.11%',
      markupRate: '48.0%',
      volumeAddRate: '2.0%',
      seihan: 1800,
      genka: 2340,
      planData: [450, 420, 350, 500, 80, 0, 0, 0, 0, 0, 0, 0],
      actualData: [432, 403, 336, 480, 77, 0, 0, 0, 0, 0, 0, 0],
      prevYearData: [450, 420, 350, 500, 80, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      metaBrand: 'カルピス',
      containerCapacity: '500mL',
      summaryProduct: '500ml帯',
      wholesaleMesh: '【カルピスソーダ200円】500ml帯',
      productCategory: getRandomItem(productCategories),
      promotion: getRandomItem(promotions),
      endSale: getRandomItem(endSales),
      net: 58.5,
      quantity: 24,
      deliveryPrice: 72,
      sellingPrice: 95,
      marginRate: '11.11%',
      markupRate: '54.8%',
      volumeAddRate: '3.0%',
      seihan: 1400,
      genka: 1848,
      planData: [350, 300, 250, 450, 50, 0, 0, 0, 0, 0, 0, 0],
      actualData: [333, 285, 238, 428, 48, 0, 0, 0, 0, 0, 0, 0],
      prevYearData: [350, 300, 250, 450, 50, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      metaBrand: 'その他',
      containerCapacity: '500mL',
      summaryProduct: 'グレープフルーツ350ml',
      wholesaleMesh: '【その他240円】グレープフルーツ350ml',
      productCategory: getRandomItem(productCategories),
      promotion: getRandomItem(promotions),
      endSale: getRandomItem(endSales),
      net: 45.0,
      quantity: 24,
      deliveryPrice: 56,
      sellingPrice: 72,
      marginRate: '11.11%',
      markupRate: '49.5%',
      volumeAddRate: '2.2%',
      seihan: 1100,
      genka: 1430,
      planData: [280, 260, 200, 320, 40, 0, 0, 0, 0, 0, 0, 0],
      actualData: [269, 250, 192, 307, 38, 0, 0, 0, 0, 0, 0, 0],
      prevYearData: [280, 260, 200, 320, 40, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      metaBrand: '三ツ矢',
      containerCapacity: '185mL',
      summaryProduct: '三ツ矢サイダーリタ瓶',
      wholesaleMesh: '【三ツ矢121円】三ツ矢サイダーリタ瓶',
      productCategory: getRandomItem(productCategories),
      promotion: getRandomItem(promotions),
      endSale: getRandomItem(endSales),
      net: 38.0,
      quantity: 30,
      deliveryPrice: 48,
      sellingPrice: 62,
      marginRate: '11.11%',
      markupRate: '47.0%',
      volumeAddRate: '1.8%',
      seihan: 900,
      genka: 1170,
      planData: [220, 210, 180, 250, 40, 0, 0, 0, 0, 0, 0, 0],
      actualData: [211, 202, 173, 240, 38, 0, 0, 0, 0, 0, 0, 0],
      prevYearData: [220, 210, 180, 250, 40, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      metaBrand: 'ワンダ',
      containerCapacity: '185mL',
      summaryProduct: 'クリーミーラテ280ml',
      wholesaleMesh: '【ワンダ165円】クリーミーラテ280ml',
      productCategory: getRandomItem(productCategories),
      promotion: getRandomItem(promotions),
      endSale: getRandomItem(endSales),
      net: 42.0,
      quantity: 30,
      deliveryPrice: 52,
      sellingPrice: 68,
      marginRate: '11.11%',
      markupRate: '48.5%',
      volumeAddRate: '1.5%',
      seihan: 1800,
      genka: 2340,
      planData: [450, 420, 350, 500, 80, 0, 0, 0, 0, 0, 0, 0],
      actualData: [432, 403, 336, 480, 77, 0, 0, 0, 0, 0, 0, 0],
      prevYearData: [450, 420, 350, 500, 80, 0, 0, 0, 0, 0, 0, 0],
    },
  ];

  // ギフト（計画／実績は上旬・中旬・下旬の3行1セット）。函数のみ旬ごとに持つ。
  // 実績反映月（画面の ACTUAL_REFLECTED_MONTHS＝1〜5月）は月の実績を中旬に表示し、
  // 上旬・下旬は null（画面で空欄・入力不可）とする（10/20手売りセッション 決定事項18）。
  // 前年実績は旬に分けず1行にまとめる（決定事項17）。
  const giftProduct = {
    metaBrand: 'カルピスコンク',
    containerCapacity: 'ギフト',
    summaryProduct: 'カルピスギフト CR30',
    wholesaleMesh: '【ギフト】カルピスギフト CR30',
    productCategory: 'ギフト',
    promotion: 'ギフト',
    net: 2160,
    deliveryPrice: 2400,
    sellingPrice: 3000,
    marginRate: '10.00%',
    planByPeriod: {
      上旬: [null, null, null, null, null, 40, 150, 30, 0, 0, 60, 180],
      中旬: [12, 4, 3, 6, 18, 90, 110, 10, 0, 5, 120, 90],
      下旬: [null, null, null, null, null, 60, 40, 5, 0, 10, 150, 20],
    } as Record<(typeof GIFT_PERIOD_ORDER)[number], (number | null)[]>,
    prevYearData: [10, 5, 3, 5, 15, 180, 290, 50, 2, 12, 320, 280],
  };

  // 商品区分に対応する販促区分へ正規化（特殊商品はリスト無し→空欄=グリッドで'ー'表示）
  const normalizePromotion = (category: string, current: string) => {
    const labels = getPromotionLabels(category);
    if (labels.length === 0) return '';
    return labels.includes(current) ? current : labels[0];
  };
  // 特殊商品のダミーを必ず1件表示する（planVariants の無い商品を特殊商品に固定）
  products[1].productCategory = '特殊商品';
  products.forEach((product: any) => {
    product.promotion = normalizePromotion(
      product.productCategory,
      product.promotion
    );
    if (product.planVariants) {
      product.planVariants.forEach((v: any) => {
        v.promotion = normalizePromotion(v.productCategory, v.promotion);
      });
    }
  });

  const rows: any[] = [];

  // 値引率（=値入率）の算出
  const calcDiscount = (sellingPrice: number, deliveryPrice: number) =>
    sellingPrice > 0
      ? ((sellingPrice - deliveryPrice) / sellingPrice) * 100
      : 0;

  products.forEach((product: any) => {
    // 計画／実績は複数明細を許容する。
    // メタブランド・容器容量G・サマリ商品名・一般卸メッシュが同一でも、
    // 商品区分・販促区分・納価・売価が異なる場合は別行になる。
    const variants = product.planVariants ?? [
      {
        productCategory: product.productCategory,
        promotion: product.promotion,
        deliveryPrice: product.deliveryPrice,
        sellingPrice: product.sellingPrice,
        planData: product.planData,
      },
    ];

    variants.forEach((v: any, vi: number) => {
      rows.push({
        id: `${product.wholesaleMesh}-plan-${vi}`,
        metaBrand: product.metaBrand,
        containerCapacity: product.containerCapacity,
        summaryProduct: product.summaryProduct,
        wholesaleMesh: product.wholesaleMesh,
        yearType: '計画／実績',
        prevYearRatio: '100.0%',
        productCategory: v.productCategory,
        promotion: v.promotion,
        net: product.net,
        deliveryPrice: v.deliveryPrice,
        sellingPrice: v.sellingPrice,
        discountRate: calcDiscount(v.sellingPrice, v.deliveryPrice),
        marginRate: product.marginRate,
        ...toMonthFields(v.planData),
      });
    });

    // 前年実績（1行）
    rows.push({
      id: `${product.wholesaleMesh}-prev`,
      metaBrand: product.metaBrand,
      containerCapacity: product.containerCapacity,
      summaryProduct: product.summaryProduct,
      wholesaleMesh: product.wholesaleMesh,
      yearType: '前年実績',
      prevYearRatio: '',
      productCategory: product.productCategory,
      promotion: product.promotion,
      net: product.net,
      deliveryPrice: product.deliveryPrice,
      sellingPrice: product.sellingPrice,
      discountRate: calcDiscount(product.sellingPrice, product.deliveryPrice),
      marginRate: product.marginRate,
      ...toMonthFields(product.prevYearData),
    });
  });

  // ギフト：計画／実績は上旬・中旬・下旬の3行1セット、前年実績は1行で追加する。
  // giftSetId が同じ3行は、函数・合計・販売期間以外の列を画面でセル結合する。
  const giftCommon = {
    metaBrand: giftProduct.metaBrand,
    containerCapacity: giftProduct.containerCapacity,
    summaryProduct: giftProduct.summaryProduct,
    wholesaleMesh: giftProduct.wholesaleMesh,
    productCategory: giftProduct.productCategory,
    promotion: giftProduct.promotion,
    net: giftProduct.net,
    deliveryPrice: giftProduct.deliveryPrice,
    sellingPrice: giftProduct.sellingPrice,
    discountRate: calcDiscount(
      giftProduct.sellingPrice,
      giftProduct.deliveryPrice
    ),
    marginRate: giftProduct.marginRate,
  };
  GIFT_PERIOD_ORDER.forEach((period) => {
    rows.push({
      ...giftCommon,
      id: `${giftProduct.wholesaleMesh}-plan-${period}`,
      giftSetId: `${giftProduct.wholesaleMesh}-plan`,
      salePeriod: period,
      yearType: '計画／実績',
      prevYearRatio: '100.0%',
      ...toMonthFields(giftProduct.planByPeriod[period]),
    });
  });
  // 前年実績は上旬・中旬・下旬に分けず1行（販売期間は持たない）
  rows.push({
    ...giftCommon,
    id: `${giftProduct.wholesaleMesh}-prev`,
    yearType: '前年実績',
    prevYearRatio: '',
    ...toMonthFields(giftProduct.prevYearData),
  });

  return rows;
};

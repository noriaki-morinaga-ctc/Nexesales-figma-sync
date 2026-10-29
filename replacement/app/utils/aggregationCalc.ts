// 販売計画(集計)の計算エンジン。補足資料3-1/4-1 の計算式に基づき、渡された集計ソース
// （販売計画(詳細)グリッド・拡売費計画グリッド由来）から対象月・集計単位フィルタ・
// 除外ペア・拡売費集計対象・原価軸を適用して集計値を算出する。
// 計画値を動的算出し、予算/前年実績は係数（RATE_SETTINGS）で導出する。

import {
  RATE_SETTINGS,
  type AggregationProduct,
  type AggregationExpense,
  type AggregationSource,
  type ExpenseCategory,
} from '../constants/aggregationSourceData';
import {
  isPairExcluded,
  type ExcludePair,
} from '../constants/aggregationExcludePair';
import { costUnitPriceOfAxis, type CostAxis } from './costUnitPrice';
import { computeCommonRateAmount } from './commonRateAmounts';
import {
  DEFAULT_COMMON_RATE_SETTINGS,
  type CommonRateSettings,
} from '../constants/commonRateSettings';

// 拡売費集計対象選択（対象月／計上月）
export type ExpenseMonthBasis = 'target' | 'posting';

// 集計単位フィルタ（空配列＝全件）
export interface AggFilter {
  metaBrands?: string[];
  capacities?: string[];
  excludePairs?: ExcludePair[];
  // 「A口のみ集計」チェック時 true。補足4-1 の集計表反映先の条件指定に従い、
  // 管理区分が 売上連動拡売費A口・拡売費(固定費)A口 の費目のみを集計対象にする。
  aOnlyPromo?: boolean;
  // 拡売費集計対象選択（既定＝対象月）
  expenseMonthBasis?: ExpenseMonthBasis;
  // 原価軸（既定＝支社受渡原価）。補足2-3 の閲覧権限は呼び出し側で解決済みの値を渡す。
  costAxis?: CostAxis;
  // センターフィ率・年契基本分・取組強化マージン率の設定（補足4-1）
  commonRates?: CommonRateSettings;
}

// P/L 全項目（金額・率）。補足3-1 の項目に対応。
export interface AggAmounts {
  func: number; // 函数
  extSales: number; // 社外売上高
  deliveryAmount: number; // 納品金額（納価×入数×函数）
  volumeAdd: number; // 量経追加口（金額）
  condition: number; // 条件口（帳合料）
  sales: number; // 売上高
  cost: number; // 売上原価
  netProfit: number; // 売上総利益
  salesLinkedA: number; // 売上連動拡売費A口
  salesLinkedB: number; // 売上連動拡売費B口
  salesLinkedH: number; // 売上連動拡売費本社口
  salesLinked: number; // 売上連動拡売費（計）
  centerFee: number; // センターフィ
  locFill: number; // ロケ補填
  variableCost: number; // 変動費(CF+ロケ補填)
  tradeProfit: number; // 売買差益
  fixedA: number; // 拡売費(固定費)A口
  fixedB: number; // 拡売費(固定費)B口
  fixedH: number; // 拡売費(固定費)本社口
  fixed: number; // 拡売費(固定費)（計）
  column: number; // コラム料
  lease: number; // リース料
  equip: number; // 販売器具費
  vendingRelated: number; // 自販機関連費
  directFixed: number; // 直接固定費
  mgmtProfit: number; // 管理利益
  promo: number; // 拡売費（売上連動＋直接固定費）
  // 年契基本分（補足4-1）。売上連動拡売費へ実際に反映された額
  // （「A口のみ」☑時は反映先のB口ごと集計対象外になるため0）
  annualContractAmount: number;
  // 取組強化マージン（補足4-1）。売上連動拡売費B口へ実際に反映された額
  // （「A口のみ」☑時は反映先のB口ごと集計対象外になるため0）
  incentiveAmount: number;
  salesUnitPrice: number; // 売上高単価
  mgmtProfitRate: number; // 管理利益率
  tradeProfitRate: number; // 売買差益率
  volumeAddRateAgg: number; // 量経追加口率
  salesLinkedRate: number; // 売上連動拡売費率
}

// 集計単位（メタブランド・容器容量G）がフィルタ条件に合致するか
const inList = (val: string, list?: string[]): boolean =>
  !list || list.length === 0 || list.includes(val);

const unitMatch = (
  metaBrand: string,
  capacity: string,
  f: AggFilter
): boolean =>
  inList(metaBrand, f.metaBrands) &&
  inList(capacity, f.capacities) &&
  !(f.excludePairs && isPairExcluded(f.excludePairs, metaBrand, capacity));

// 指定の月インデックス集合（0始まり）について素集計し、P/Lを導出する
const computeForMonths = (
  products: AggregationProduct[],
  expenses: AggregationExpense[],
  monthsIdx0: number[],
  filter: AggFilter
): AggAmounts => {
  const aOnlyPromo = filter.aOnlyPromo ?? false;
  const basis = filter.expenseMonthBasis ?? 'target';
  const costAxis = filter.costAxis ?? 'transfer';
  const rates = filter.commonRates ?? DEFAULT_COMMON_RATE_SETTINGS;

  let func = 0;
  let extSales = 0;
  let extSalesExcludingPB = 0;
  let deliveryAmount = 0;
  let deliveryExcludingPB = 0;
  let volumeAdd = 0;
  let condition = 0;
  let cost = 0;
  for (const p of products) {
    for (const m of monthsIdx0) {
      const fn = p.funcByMonth[m] ?? 0;
      func += fn;
      const es = p.extUnitPrice * p.quantity * fn;
      const delivery = p.deliveryPrice * p.quantity * fn;
      extSales += es;
      deliveryAmount += delivery;
      if (!p.isPB) {
        // 補足4-1「PB商品を除く」設定の分母
        extSalesExcludingPB += es;
        deliveryExcludingPB += delivery;
      }
      volumeAdd += es * p.volumeAddRate;
      condition += p.conditionUnitPrice * p.quantity * fn;
      // 補足2-3：用いる原価単価は閲覧権限に応じた原価軸で決まる
      cost +=
        costUnitPriceOfAxis(p.costUnitPriceTransfer, costAxis) *
        p.quantity *
        fn;
    }
  }

  // 拡売費集計対象選択に応じて参照する月別系列を切り替える
  const seriesOf = (e: AggregationExpense): number[] =>
    basis === 'posting' ? e.amountByPostingMonth : e.amountByTargetMonth;

  const cat = (c: ExpenseCategory): number =>
    expenses
      .filter((e) => e.category === c)
      .reduce(
        (sum, e) =>
          sum + monthsIdx0.reduce((a, m) => a + (seriesOf(e)[m] ?? 0), 0),
        0
      );

  // 補足4-1：センターフィ・年契基本分・取組強化マージン率の金額を算出する
  const rateBase = {
    extSalesAll: extSales,
    extSalesExcludingPB,
    deliveryAll: deliveryAmount,
    deliveryExcludingPB,
  };
  const centerFee = computeCommonRateAmount(rates.centerFee, rateBase);
  const annualContractAmount = computeCommonRateAmount(
    rates.annualContract,
    rateBase
  );
  const incentiveAmount = computeCommonRateAmount(rates.incentive, rateBase);

  // 「A口のみ集計」時は 売上連動拡売費A口・拡売費(固定費)A口 の2費目のみ対象。
  // B口/本社口・ロケ補填・自販機関連費（コラム料/リース料/販売器具費）は0にする。
  //
  // 補足4-1 の反映先：
  //   取組強化マージン率 → 常に 売上連動拡売費B口
  //   年契基本分         → A口のみ☑: 売上連動拡売費B口 ／ □: 売上連動拡売費A口+B口+本社口
  // A口のみ☑ では B口が集計対象外になるため、いずれも売上連動拡売費に含まれない。
  const gridSalesLinkedA = cat('売上連動拡売費A口');
  const gridSalesLinkedB = cat('売上連動拡売費B口');
  const gridSalesLinkedH = cat('売上連動拡売費本社口');
  const gridSalesLinkedTotal =
    gridSalesLinkedA + gridSalesLinkedB + gridSalesLinkedH;

  // 年契基本分の口別按分。補足4-1 は反映先を「売上連動拡売費A口+B口+本社口」と定めるだけで
  // 按分基準を規定していないため、グリッド由来の口別金額での比例按分を設計判断として採用する。
  // （計＝A口＋B口＋本社口 の内訳整合を保つため。集計表の計の値は按分方法によらず変わらない）
  const annualContractToSplit = aOnlyPromo ? 0 : annualContractAmount;
  const annualContractShareOf = (gridAmount: number): number =>
    gridSalesLinkedTotal === 0
      ? 0
      : (annualContractToSplit * gridAmount) / gridSalesLinkedTotal;
  const annualContractToA = annualContractShareOf(gridSalesLinkedA);
  const annualContractToH = annualContractShareOf(gridSalesLinkedH);
  // 残余をB口に寄せる。3口とも0で按分できない場合は全額がB口に入る
  // （取組強化マージン率と同じ扱い。A口のみ☑ の反映先とも整合する）。
  const annualContractToB =
    annualContractToSplit - annualContractToA - annualContractToH;

  // Minor 7：incentiveAmount は「A口のみ」☑時は売上連動拡売費B口ごと集計対象外になり
  // どこにも反映されないため、AggAmounts へ返す値も反映額（0）に合わせる
  // （旧実装は常に算出値をそのまま返しており、A口のみ☑時に画面外の値を報告していた）。
  const incentiveReflected = aOnlyPromo ? 0 : incentiveAmount;

  const salesLinkedA = gridSalesLinkedA + annualContractToA;
  const salesLinkedB = aOnlyPromo
    ? 0
    : gridSalesLinkedB + incentiveReflected + annualContractToB;
  const salesLinkedH = aOnlyPromo ? 0 : gridSalesLinkedH + annualContractToH;
  // 計は必ず3口の合算で求める（内訳と計が一致しない表示にならないようにするため）
  const salesLinked = salesLinkedA + salesLinkedB + salesLinkedH;
  const fixedA = cat('拡売費(固定費)A口');
  const fixedB = aOnlyPromo ? 0 : cat('拡売費(固定費)B口');
  const fixedH = aOnlyPromo ? 0 : cat('拡売費(固定費)本社口');
  const fixed = fixedA + fixedB + fixedH;
  const column = aOnlyPromo ? 0 : cat('コラム料');
  const lease = aOnlyPromo ? 0 : cat('リース料');
  const equip = aOnlyPromo ? 0 : cat('販売器具費');
  const vendingRelated = column + lease + equip;
  const locFill = aOnlyPromo ? 0 : cat('ロケ補填');

  const sales = extSales - volumeAdd - condition;
  const netProfit = sales - cost;
  const variableCost = centerFee + locFill;
  const tradeProfit = netProfit - variableCost;
  const directFixed = fixed + vendingRelated;
  const mgmtProfit = tradeProfit - directFixed;
  const promo = salesLinked + directFixed;

  return {
    func,
    extSales,
    deliveryAmount,
    volumeAdd,
    condition,
    sales,
    cost,
    netProfit,
    salesLinkedA,
    salesLinkedB,
    salesLinkedH,
    salesLinked,
    centerFee,
    locFill,
    variableCost,
    tradeProfit,
    fixedA,
    fixedB,
    fixedH,
    fixed,
    column,
    lease,
    equip,
    vendingRelated,
    directFixed,
    mgmtProfit,
    promo,
    // Minor 7：年契基本分／取組強化マージンは「A口のみ」☑時にどこにも反映されないため、
    // 実際に反映された額（annualContractToSplit／incentiveReflected）を返す
    // （常に算出値そのままだと、画面に出ない値を報告してしまう）。
    annualContractAmount: annualContractToSplit,
    incentiveAmount: incentiveReflected,
    // 売上高単価 ＝ (社外売上高 − 量経追加口) ÷ Σ函数（量経追加口だけを控除した函単価）。
    // 10/16 手売りセッション 決定事項15（項目名に計算式を表示）と ASD のコメントに合わせ、
    // 計算式一覧（補足3-1 item4）の「社外売単価の集計の加重平均」から改めた。
    salesUnitPrice: func ? (extSales - volumeAdd) / func : 0,
    mgmtProfitRate: sales ? mgmtProfit / sales : 0,
    tradeProfitRate: sales ? tradeProfit / sales : 0,
    volumeAddRateAgg: extSales ? volumeAdd / extSales : 0,
    salesLinkedRate: extSales ? salesLinked / extSales : 0,
  };
};

const range = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
};

// 期間別の集計（当月／累計＝1月〜当月／年間＝1〜12月）
export interface PeriodAmounts {
  monthly: AggAmounts;
  cumulative: AggAmounts;
  yearly: AggAmounts;
}

const filtered = (source: AggregationSource, filter: AggFilter) => ({
  products: source.products.filter((p) =>
    unitMatch(p.metaBrand, p.capacity, filter)
  ),
  expenses: source.expenses.filter((e) =>
    unitMatch(e.metaBrand, e.capacity, filter)
  ),
});

export const computePeriods = (
  source: AggregationSource,
  month: number,
  filter: AggFilter = {}
): PeriodAmounts => {
  const { products, expenses } = filtered(source, filter);
  const m = month - 1;
  return {
    monthly: computeForMonths(products, expenses, [m], filter),
    cumulative: computeForMonths(products, expenses, range(0, m), filter),
    yearly: computeForMonths(products, expenses, range(0, 11), filter),
  };
};

// 単一月の集計（月軸グリッド用）
export const computeMonth = (
  source: AggregationSource,
  month: number,
  filter: AggFilter = {}
): AggAmounts => {
  const { products, expenses } = filtered(source, filter);
  return computeForMonths(products, expenses, [month - 1], filter);
};

// 月インデックス集合の集計（累計・年間・上期・下期・四半期など）
export const computeMonthsRange = (
  source: AggregationSource,
  monthsIdx0: number[],
  filter: AggFilter = {}
): AggAmounts => {
  const { products, expenses } = filtered(source, filter);
  return computeForMonths(products, expenses, monthsIdx0, filter);
};

// ── 集計単位マトリクス（詳細タブ：合計→メタブランド→容器容量G の階層別） ──
// ソースに存在する集計単位の一覧
export const listMetaBrands = (source: AggregationSource): string[] => [
  ...new Set(source.products.map((p) => p.metaBrand)),
];
export const listCapacities = (
  source: AggregationSource,
  metaBrand?: string
): string[] => [
  ...new Set(
    source.products
      .filter((p) => !metaBrand || p.metaBrand === metaBrand)
      .map((p) => p.capacity)
  ),
];

export interface UnitRow {
  level: number; // 0=合計 / 1=メタブランド / 2=容器容量G
  label: string;
  amounts: AggAmounts;
}

// 月インデックス集合について、集計単位の掛け合わせ階層（合計＋メタブランド＋容器容量G）を算出。
// filter.metaBrands/capacities が空なら全件。除外ペア・商品の存在しない組合せは行を作らない。
export const computeUnitMatrix = (
  source: AggregationSource,
  monthsIdx0: number[],
  filter: AggFilter = {}
): UnitRow[] => {
  const brands =
    filter.metaBrands && filter.metaBrands.length
      ? filter.metaBrands
      : listMetaBrands(source);
  const rows: UnitRow[] = [
    {
      level: 0,
      label: '合計',
      amounts: computeMonthsRange(source, monthsIdx0, filter),
    },
  ];
  for (const brand of brands) {
    const caps =
      filter.capacities && filter.capacities.length
        ? filter.capacities
        : listCapacities(source, brand);
    rows.push({
      level: 1,
      label: brand,
      amounts: computeMonthsRange(source, monthsIdx0, {
        ...filter,
        metaBrands: [brand],
      }),
    });
    for (const cap of caps) {
      if (
        filter.excludePairs &&
        isPairExcluded(filter.excludePairs, brand, cap)
      )
        continue;
      const hasProduct = source.products.some(
        (p) => p.metaBrand === brand && p.capacity === cap
      );
      if (!hasProduct) continue;
      rows.push({
        level: 2,
        label: cap,
        amounts: computeMonthsRange(source, monthsIdx0, {
          ...filter,
          metaBrands: [brand],
          capacities: [cap],
        }),
      });
    }
  }
  return rows;
};

// 月インデックス集合のヘルパ（当月/累計/年間/上期/下期/四半期）
export const monthsForPeriod = (
  period: 'monthly' | 'cumulative' | 'yearly',
  month: number
): number[] => {
  const m = month - 1;
  if (period === 'monthly') return [m];
  if (period === 'cumulative') return range(0, m);
  return range(0, 11);
};

// 表示値の導出：計画＝計算値、予算＝計画×係数、前年＝計画×係数。
export interface DisplayValue {
  plan: number;
  budget: number;
  prevYear: number;
  isRate: boolean;
}

export const displayOf = (plan: number, isRate = false): DisplayValue => ({
  plan,
  budget: plan * RATE_SETTINGS.budgetFactor,
  prevYear: plan * RATE_SETTINGS.prevYearFactor,
  isRate,
});

// sim(NET固定)：画面専用の処理（明細行の算出・初期行・計算式の定義など）

import { GetRowIdParams } from 'ag-grid-community';

import { type FormulaDef, type FormulaDefs } from '@/components/grid';

import {
  PLAN_DETAIL_DIGITS,
  formatPlanAmount,
} from '@/utils/sales-plan/common/planDetailNumberFormat';

import { withYear } from '@/utils/common/yearMonth';

import { fillWholesaleRow } from '@/mocks/common/salesPlanWholesale';
import type { ProductData as WholesaleProductData } from '@/types/salesPlanWholesale';

import {
  SUMMARY_PRODUCT_OPTIONS,
  WHOLESALE_MESH_OPTIONS,
} from '@/constants/productMasters';
import {
  makeExternalUnitPriceOf,
  makeCostUnitPriceOf,
  unitTimesQuantityTimesPlan,
  makeDetailValueOf,
  makeDetailTooltip,
  deltaResult,
} from '@/utils/sales-plan/common/formulaCellHelpers';
import { simulationManagementProfitOf } from '@/utils/sales-plan/simulation/simulationManagementProfit';
import type { ProductData } from '@/types/simulation';
import {
  formatSimMetric,
  parseSimMetric,
} from '@/utils/sales-plan/simulation/simulationMetricFormat';
import { COMPARISON_FIELDS, WHOLESALE_SIM_COLUMN_LABELS } from './constants';
import { SIM_CREATORS } from '@/mocks/sales-plan/sales-plan-simulation-net-fixed';
import { UNIT_PRICE_KBN } from '@/mocks/common/planBasicInfo';

// 明細行の一意ID（Undo履歴を維持するためモジュール直下で参照を固定する → 02 §7.1）。
// 編集対象フィールド（metaBrand/summaryProduct/section）は含めない。
// 含めると編集で行IDが変わり、変更セルのハイライト記録（useChangedCells）
// が孤立する。id だけで一意（コピー行の id は copy-... で一意採番）。
export const getDetailRowId = (params: GetRowIdParams<ProductData>) =>
  String(params.data.id);

// シミュレーション更新KEYの単価：NET固定はNET
export const usesNetAsKey = (): boolean => true;

// 文字列をプラスの整数へ整える（小数は四捨五入・負値は絶対値・空/0/非数値は fallback）。
export const toPositiveInt = (
  value: string | undefined,
  fallback: number
): string => {
  const n = Math.round(
    Math.abs(parseFloat(String(value ?? '').replace(/,/g, '')))
  );
  return String(Number.isFinite(n) && n > 0 ? n : fallback);
};

// 行 → 商品マスタ。定番商品はサマリ商品を持たず一般卸メッシュで商品を特定する（補足4-2）。
export const masterOf = (row: ProductData) =>
  SUMMARY_PRODUCT_OPTIONS.find((o) => o.value === row.summaryProduct) ??
  WHOLESALE_MESH_OPTIONS.find((o) => o.value === row.wholesaleMesh);

// 行の社外売単価（補足2-2）。社外売上高の算出（recomputeDerived）とツールチップの両方で使う。
export const externalUnitPriceOf = makeExternalUnitPriceOf(
  masterOf,
  UNIT_PRICE_KBN
);

// 行の売上原価単価（補足2-3）。管理利益額の算出（recomputeDerived）とツールチップの両方で使う。
export const costUnitPriceOf = makeCostUnitPriceOf(masterOf);

// NET固定モード：算出列を販売計画表（補足2-1/補足3-1）と同様に動的算出する。
//   マージン率 = (納価 − NET) / 納価 × 100（NET固定）
//   値入率    = (売価 − 納価) / 売価 × 100
//   社外売上高 = 社外売単価(補足2-2) × 入数 × 函数
//   売上高    = 社外売上高 − 量経追加口 − 条件口（補足3-1：計画詳細の集計と同じ定義）
//   管理利益額 = 売買差益 − 直接固定費（補足3-1：計画詳細の集計と同じ定義）
//   管理利益率 = 管理利益額/売上高×100
//   （量販シミュ DetailTable.tsx の computeDerived と同じ基準に統一）
// セル編集直後の再計算（onAfterCellChange）と初期表示（withBaseline）の両方から呼ぶ。
export const recomputeDerived = (data: any): void => {
  const num = (v?: string) => {
    const n = parseSimMetric(v);
    return isNaN(n) ? 0 : n;
  };
  const planPrice = parseSimMetric(data?.planPrice); // 納価
  const net = parseSimMetric(data?.net); // NET
  // マージン率（NET固定パターン）
  if (!isNaN(planPrice) && !isNaN(net) && planPrice !== 0) {
    data.margin = formatSimMetric(((planPrice - net) / planPrice) * 100, {
      digits: PLAN_DETAIL_DIGITS.marginRate,
      percent: true,
    });
  }
  // 値入率＝(売価−納価)/売価×100
  const price = parseSimMetric(data?.price); // 売価
  if (!isNaN(price) && !isNaN(planPrice) && price !== 0) {
    data.discount = formatSimMetric(((price - planPrice) / price) * 100, {
      digits: PLAN_DETAIL_DIGITS.rate,
      percent: true,
    });
  }
  // 金額系：社外売上高／売上高／管理利益（函数・入数が揃う場合のみ算出）
  const func = num(data?.plan); // 函数(計画)
  const qty = num(data?.quantity); // 入数
  if (qty > 0 && func > 0) {
    // 社外売上高 ＝ 社外売単価(補足2-2) × 入数 × 計画函数(変更後)
    data.externalSales = unitTimesQuantityTimesPlan(
      externalUnitPriceOf(data),
      data.quantity,
      data.plan
    );
    // 売上高・管理利益額を計画詳細と同じ式（補足3-1）で算出する（NET固定パターン）
    //   売上高     ＝ 社外売上高 − 量経追加口 − 条件口
    //   管理利益額 ＝ 売買差益 − 直接固定費
    const {
      volumeAdd,
      condition,
      sales,
      tradeProfit,
      directFixed,
      mgmtProfit,
    } = simulationManagementProfitOf(data, 'netFixed', costUnitPriceOf(data));
    // 明細に列が無い途中項目は、計算式ツールチップ用に行へ保持する
    // （社外売上高と同じく3桁区切りの整数で持つ）
    data._volumeAdd = formatPlanAmount(volumeAdd, PLAN_DETAIL_DIGITS.amount);
    data._condition = formatPlanAmount(condition, PLAN_DETAIL_DIGITS.amount);
    data._tradeProfit = formatPlanAmount(
      tradeProfit,
      PLAN_DETAIL_DIGITS.amount
    );
    data._directFixed = formatPlanAmount(
      directFixed,
      PLAN_DETAIL_DIGITS.amount
    );
    // 売上高は整数（四捨五入）で保持・表示する
    data.netSales = formatSimMetric(sales, {
      digits: PLAN_DETAIL_DIGITS.amount,
    });
    // 管理利益額は整数（四捨五入）で保持・表示する
    data.managementProfitAmount = formatSimMetric(mgmtProfit, {
      digits: PLAN_DETAIL_DIGITS.amount,
    });
    // 管理利益率 ＝ 管理利益額 ÷ 売上高 × 100%（補足3-1：分母は売上高）
    data.managementProfitRate = formatSimMetric(
      sales !== 0 ? (mgmtProfit / sales) * 100 : 0,
      { percent: true }
    );
  }
};

// 初期行：比較項目の Before/After を確定したうえで recomputeDerived で算出し、
// 算出されたマージン率を Before に同期して初期の増減を0にする（NET固定のため net は入力値のまま）。
export const withBaseline = (
  rows: ProductData[],
  prefix: string
): ProductData[] =>
  rows.map((r, i) => {
    const seed = r.id ?? `${prefix}-${i}`;
    // 計画詳細(NET固定) と同じダミーで補完する（行の型は計画詳細のものを借りる。補完する項目は共通）
    const copy = {
      ...fillWholesaleRow(r as unknown as WholesaleProductData, seed),
    } as unknown as Record<string, string | undefined>;
    // 拡売費①②の金額のみプラスの整数のダミー値に整える。
    (['exp1PlannedAmount', 'exp2PlannedAmount'] as const).forEach((f) => {
      copy[f] = toPositiveInt(copy[f], 100 + ((i * 13) % 90));
    });
    // 拡売費が入っている枠だけ作成者を持たせる（未入力の枠は「ー」表示）。
    (['exp1', 'exp2'] as const).forEach((p) => {
      if (copy[`${p}Creator`] !== undefined) return;
      copy[`${p}Creator`] = copy[`${p}PlannedAmount`]
        ? SIM_CREATORS[i % SIM_CREATORS.length]
        : '';
    });
    COMPARISON_FIELDS.forEach((f) => {
      if (copy[`${f}Before`] === undefined) copy[`${f}Before`] = copy[f] ?? '';
      if (copy[`${f}After`] === undefined) copy[`${f}After`] = '';
    });
    recomputeDerived(copy);
    copy.marginBefore = copy.margin; // マージン率は常に算出のため基準を確定値に同期
    return copy as unknown as ProductData;
  });

// ── ギフト（上旬・中旬・下旬の3行1セット）ユーティリティ（並び・採番は utils/sales-plan/common/productCategoryChange） ──
// セル結合用 rowSpan：セット先頭行のみセット行数を返し、他は1（先頭セルが覆う）。
export const giftRowSpan = (params: any): number =>
  params.data?._giftFirst ? (params.data?._giftSpan ?? 1) : 1;

// 全項目が空の明細行テンプレート（ギフトセット生成で共通利用）。
export const makeEmptyProduct = (section: string): ProductData => ({
  section,
  productCategory: section,
  metaBrand: '',
  containerCapacityG: '',
  summaryProduct: '',
  wholesaleMesh: '',
  quantity: '',
  plan: '',
  net: '',
  planPrice: '',
  price: '',
  margin: '',
  discount: '',
  exp1PlannedAmount: '',
  exp1PostingMonth: '',
  exp1ManagementCode: '',
  exp1AccountItem: '',
  exp1ManagementClass: '',
  exp1CampaignClass: '',
  exp1CampaignCode: '',
  exp1Description: '',
  exp2PlannedAmount: '',
  exp2PostingMonth: '',
  exp2ManagementCode: '',
  exp2AccountItem: '',
  exp2ManagementClass: '',
  exp2CampaignClass: '',
  exp2Description: '',
});

// この画面に売上原価列は無いが、makeDetailValueOf は原価単価の resolver を要求するため
// costUnitPriceOf を渡す（__costUnitPrice はどのテンプレートからも参照されない）。
export const wsSimTooltip = makeDetailTooltip<ProductData>(
  WHOLESALE_SIM_COLUMN_LABELS,
  makeDetailValueOf(externalUnitPriceOf, costUnitPriceOf)
);

// セル自身の値を結果として使う。
export const fieldResult =
  (field: keyof ProductData) =>
  (row: ProductData): string =>
    String(row[field] ?? '');

// 増減列（計画函数・NET・納価・売価）の定義を作る。
// 増減列は colId が `<metric>Delta` で行データに値を持たないため、結果値は deltaResult で算出する。
export const wsDeltaDef = (metric: string): FormulaDef<ProductData> => ({
  refs: () => [metric, `${metric}Before`],
  tooltip: wsSimTooltip(
    { template: `{${metric}} − {${metric}Before}` },
    (row) => deltaResult(row, metric)
  ),
});

export const WHOLESALE_SIM_FORMULA_DEFS: FormulaDefs<ProductData> = {
  planDelta: wsDeltaDef('plan'),
  netDelta: wsDeltaDef('net'),
  planPriceDelta: wsDeltaDef('planPrice'),
  priceDelta: wsDeltaDef('price'),

  // マージン率 ＝ (納価 − NET) ÷ 納価 × 100%（NET固定のため全行が算出セル）
  margin: {
    refs: () => ['planPrice', 'net'],
    tooltip: wsSimTooltip(
      { template: '({planPrice} − {net}) ÷ {planPrice} × 100%' },
      fieldResult('margin')
    ),
  },
  // 値入率 ＝ (売価 − 納価) ÷ 売価 × 100%
  discount: {
    refs: () => ['price', 'planPrice'],
    tooltip: wsSimTooltip(
      { template: '({price} − {planPrice}) ÷ {price} × 100%' },
      fieldResult('discount')
    ),
  },
  // 社外売上高 ＝ 社外売単価(補足2-2) × 入数 × 計画函数(変更後)
  externalSales: {
    refs: () => ['quantity', 'plan'],
    tooltip: wsSimTooltip(
      { template: '{__unitPrice} × {quantity} × {plan}' },
      fieldResult('externalSales')
    ),
  },
  // 売上高 ＝ 社外売上高 − 量経追加口 − 条件口（量経追加口・条件口は明細に列が無い）
  netSales: {
    refs: () => ['externalSales'],
    tooltip: wsSimTooltip(
      { template: '{externalSales} − {_volumeAdd} − {_condition}' },
      fieldResult('netSales')
    ),
  },
  // 管理利益額 ＝ 売買差益 − 直接固定費（補足3-1。売買差益・直接固定費は明細に列が無い）
  //   売買差益は売上高から、直接固定費は拡売費①②（管理区分で振り分け）から求めるため、両者を強調する
  managementProfitAmount: {
    refs: () => [
      'netSales',
      'exp1PlannedAmountBefore',
      'exp2PlannedAmountBefore',
    ],
    tooltip: wsSimTooltip(
      { template: '{_tradeProfit} − {_directFixed}' },
      fieldResult('managementProfitAmount')
    ),
  },
  // 管理利益率 ＝ 管理利益額 ÷ 売上高 × 100%
  managementProfitRate: {
    refs: () => ['managementProfitAmount', 'netSales'],
    tooltip: wsSimTooltip(
      { template: '{managementProfitAmount} ÷ {netSales} × 100%' },
      fieldResult('managementProfitRate')
    ),
  },
};

// モックの対象年月を年だけ置き換える（月はそのまま）。
// 明細・参照用下ペインともシステム日付の当年に寄せ、対象期間の初期値（当年1〜12月）で
// 表示されるようにする。
export const withTargetYear = (
  rows: ProductData[],
  year: number
): ProductData[] =>
  rows.map((r) =>
    r.targetMonth ? { ...r, targetMonth: withYear(r.targetMonth, year) } : r
  );

// ===== 変更前 / 変更後 / 増減 比較 ヘルパー =====
// 文字列→数値（カンマ・%除去）。空は NaN。
export const parseMetric = parseSimMetric;

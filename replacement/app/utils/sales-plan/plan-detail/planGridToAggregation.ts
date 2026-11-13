// 販売計画(詳細)グリッドの行 → 集計ソース（AggregationProduct[]）への変換。
//
// 集計値は補足3-1 の計算式でこのソースから算出する。グリッドに列が無い項目は
// 補足2-2（社外売単価）／2-3（売上原価単価）／4-2（条件口単価）の導出ロジックと
// ダミーマスタ（constants/aggregationMasterDummy）が供給する。
//
// グリッドは対象年月1か月分の行しか持たないため、月別函数は expandToMonths で
// 12か月へ展開する（対象月の値はグリッドの入力値と必ず一致する）。
import { parseFormulaNumber } from '@/app/components/grid/gridCommon';
import {
  SUMMARY_PRODUCT_OPTIONS,
  WHOLESALE_MESH_OPTIONS,
} from '@/app/constants/productMasters';
import {
  toAxisMetaBrand,
  toAxisCapacity,
  isPBProduct,
} from '@/app/utils/sales-plan/common/aggregationAxisMapping';
import {
  expandToMonths,
  volumeAddRateOf,
} from '@/app/utils/sales-plan/common/aggregationMasterDummy';
import {
  deriveConditionUnitPrice,
  DEFAULT_STORE_KEY,
  type PlanPattern,
} from '@/app/utils/sales-plan/common/conditionUnitPrice';
import {
  makeExternalUnitPriceOf,
  makeCostUnitPriceOf,
} from '@/app/utils/sales-plan/common/formulaCellHelpers';
import type { AggregationProduct } from '@/app/types/aggregation';

// 集計に必要な項目のみ参照する緩い行型（ProductData と構造互換）。
// マージン率固定・NET入力／NET固定の双方の ProductData を受け取れるようにする。
export interface PlanGridRow {
  section?: string;
  productCategory?: string;
  metaBrand?: string;
  containerCapacityG?: string;
  summaryProduct?: string;
  wholesaleMesh?: string;
  quantity?: string;
  plan?: string;
  planPrice?: string;
  // 合計行・見出し行の判定
  isTotal?: boolean;
  _isHeader?: boolean;
}

export interface PlanGridContext {
  planPattern: PlanPattern;
  // 対象年月の月インデックス（0始まり）。1〜12月への展開の基準になる
  targetMonthIdx0: number;
  // 取引先補足情報マスタの単価取得区分（社外売単価の導出に使う。補足2-2）
  unitPriceKbn: string;
}

// 行 → 商品マスタ。サマリ商品名を優先し、無ければ一般卸メッシュで引く（NET固定の定番商品）。
const masterOf = (row: PlanGridRow) =>
  SUMMARY_PRODUCT_OPTIONS.find((o) => o.value === row.summaryProduct) ??
  WHOLESALE_MESH_OPTIONS.find((o) => o.value === row.wholesaleMesh);

const costUnitPriceOf = makeCostUnitPriceOf<PlanGridRow>(masterOf);

// 数値化。数値でない値は0にする（集計を壊さないため）。
const num = (value: unknown): number => {
  const parsed = parseFormulaNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function toAggregationProducts(
  rows: PlanGridRow[],
  context: PlanGridContext
): AggregationProduct[] {
  const externalUnitPriceOf = makeExternalUnitPriceOf<
    PlanGridRow & { planPrice: string }
  >(masterOf, context.unitPriceKbn);
  const products: AggregationProduct[] = [];
  for (const row of rows) {
    // 合計行・グループ見出し行は集計対象外
    if (row.isTotal || row._isHeader) continue;
    // 計画函数が無い行は社外売上高・売上原価とも0になるため集計ソースに含めない
    const plan = num(row.plan);
    if (plan <= 0) continue;

    const metaBrand = row.metaBrand ?? '';
    const axisMetaBrand = toAxisMetaBrand(metaBrand);
    const conditionUnitPrice = deriveConditionUnitPrice({
      planPattern: context.planPattern,
      summaryProduct: row.summaryProduct ?? '',
      wholesaleMesh: row.wholesaleMesh ?? '',
      storeKey: DEFAULT_STORE_KEY,
    }).value;

    products.push({
      metaBrand: axisMetaBrand,
      capacity: toAxisCapacity(
        row.containerCapacityG ?? '',
        metaBrand,
        row.productCategory ?? row.section
      ),
      isPB: isPBProduct(metaBrand),
      quantity: num(row.quantity),
      funcByMonth: expandToMonths(plan, context.targetMonthIdx0),
      extUnitPrice: num(
        externalUnitPriceOf({ ...row, planPrice: row.planPrice ?? '' })
      ),
      deliveryPrice: num(row.planPrice),
      costUnitPriceTransfer: num(costUnitPriceOf(row)),
      conditionUnitPrice,
      volumeAddRate: volumeAddRateOf(axisMetaBrand),
    });
  }
  return products;
}

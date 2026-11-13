// 計画詳細(マージン率固定)：画面専用の処理（明細行の算出・計算式の定義など）
import { UNIT_PRICE_KBN } from '@/mocks/common/planBasicInfo';

import { type FormulaDefs } from '@/app/components/grid';
import { parseFormulaNumber } from '@/app/components/grid/gridCommon';

import type { ProductData } from '@/app/types/salesPlanRetail';

import { SUMMARY_PRODUCT_OPTIONS } from '@/app/constants/productMasters';

import {
  makeExternalUnitPriceOf,
  makeCostUnitPriceOf,
  markupAmountOf,
  unitTimesQuantityTimesPlan,
  makeDetailValueOf,
  makeDetailTooltip,
} from '@/app/utils/sales-plan/common/formulaCellHelpers';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanRate,
  roundPlanNumber,
} from '@/app/utils/sales-plan/common/planDetailNumberFormat';
import { currentMonthEstimate } from '@/app/utils/sales-plan/plan-detail/currentMonthEstimate';

import { toAxisMetaBrand } from '@/app/utils/sales-plan/common/aggregationAxisMapping';
import { volumeAddRateOf } from '@/app/utils/sales-plan/common/aggregationMasterDummy';

import { RETAIL_COLUMN_LABELS } from './constants';
import { fixedEdi } from '@/mocks/sales-plan/plan-detail-margin-rate-fixed';

// 各行に一意なIDを付与（getRowId・行更新の照合に使用）。
// 重複するサマリ商品名でも getRowId が衝突せず、編集時に行が消えないようにする。
// あわせて EDI反映の固定ダミー（ediPrice）を初期設定する。
export const withRowId = (rows: ProductData[], prefix: string): ProductData[] =>
  rows.map((r, i) => {
    const id = (r as any).id ?? `${prefix}-${i}`;
    return {
      ...(r as any),
      id,
      ediPrice: (r as any).ediPrice || fixedEdi(id, (r as any).planPrice),
    };
  });

// ── ギフト（上旬・中旬・下旬の3行1セット）ユーティリティ（並び・採番は utils/sales-plan/common/productCategoryChange） ──
// セル結合用 rowSpan：セット先頭行のみセット行数を返し、他は1（先頭セルが覆う）。
export const giftRowSpan = (params: any): number =>
  params.data?._giftFirst ? (params.data?._giftSpan ?? 1) : 1;

// 行 → 商品マスタ。この画面はサマリ商品名で商品を特定する。
export const masterOf = (row: ProductData) =>
  SUMMARY_PRODUCT_OPTIONS.find((o) => o.value === row.summaryProduct);

// 行の社外売単価（補足2-2）／売上原価単価（補足2-3）。
export const externalUnitPriceOf = makeExternalUnitPriceOf(
  masterOf,
  UNIT_PRICE_KBN
);

export const costUnitPriceOf = makeCostUnitPriceOf(masterOf);

// マージン率固定パターン（補足2-1）：マージン率は固定設定値（非活性）。
// 納価・売価・入数・函数(計画)・サマリ商品名の変更に応じて
// NET・値入率・社外売上高・売上原価を再計算する。
// NET = 納価 - 納価 × マージン率、値入率 = (売価 - 納価) / 売価 × 100。
// 社外売上高 = 社外売単価(補足2-2) × 入数 × 函数(計画)、
// 売上原価 = 売上原価単価(補足2-3) × 入数 × 函数(計画)。
// 納価未入力時は NET・値入率を更新しない（前年実績の初期表示を維持）。
// 初期表示（useState の初期化子）とセル編集後の両方から呼べるよう、
// コンポーネントの外＝モジュールスコープの純関数として定義する。
export function recalcFixedMargin(data: ProductData): ProductData {
  const planPriceVal = parseFormulaNumber(data.planPrice) || 0;
  const priceVal = parseFormulaNumber(data.price) || 0;
  const marginRate = (parseFormulaNumber(data.margin) || 0) / 100;
  const next = { ...data };
  if (planPriceVal > 0) {
    next.net = roundPlanNumber(
      planPriceVal - planPriceVal * marginRate,
      PLAN_DETAIL_DIGITS.price
    );
    if (priceVal > 0) {
      // 値入率は小数第1位（％）で保持・表示する
      next.discount = formatPlanRate(
        ((priceVal - planPriceVal) / priceVal) * 100,
        PLAN_DETAIL_DIGITS.rate
      );
    }
  }
  // 値入額 ＝ (売価 − 納価(計画)) × 入数 × 函数(計画)（課題1757）
  next.markupAmount = markupAmountOf(next);
  next.externalSales = unitTimesQuantityTimesPlan(
    externalUnitPriceOf(next),
    next.quantity,
    next.plan
  );
  next.delivery = unitTimesQuantityTimesPlan(
    costUnitPriceOf(next),
    next.quantity,
    next.plan
  );
  // 量経追加口率は明細表に量経追加口の列が無いため、集計と同じダミーマスタから引く
  // （補足1-1 No.29：量経追加口 ÷ 社外売上高 × 100%。率そのものをマスタが持つ）。
  // 量経追加口率は小数第1位（％）で保持・表示する
  next.volumeAddRate = formatPlanRate(
    volumeAddRateOf(toAxisMetaBrand(next.metaBrand)) * 100,
    PLAN_DETAIL_DIGITS.rate
  );
  return next;
}

// 連動セルのキャッシュを引く行キー（共通フック useLinkedCellUndo の rowIdOf）。
// 行IDに「主セル・従属セル以外の算出元」の値を加える。他の算出元を変えた後に主セルを
// 以前の値へ打ち直したとき、古い算出値をキャッシュから戻さず導出し直すため。
// Undo/Redo は後の編集から順に戻るため算出元が一致し、キャッシュから厳密に復元される。
export const linkedRowKeyOf =
  (fields: (keyof ProductData)[]) =>
  (params: { node?: { id?: string }; data?: ProductData }): string =>
    [
      params.node?.id ?? '',
      ...fields.map((f) => String(params.data?.[f] ?? '')),
    ].join('#');

export const retailTooltip = makeDetailTooltip<ProductData>(
  RETAIL_COLUMN_LABELS,
  makeDetailValueOf(externalUnitPriceOf, costUnitPriceOf)
);

// セル自身の値を結果として使う（明細表は算出結果を行データに保持している）。
export const fieldResult =
  (field: keyof ProductData) =>
  (row: ProductData): string =>
    String(row[field] ?? '');

export const RETAIL_FORMULA_DEFS: FormulaDefs<ProductData> = {
  // 当月着地見込 ＝ 当月実績 ÷ 当月実績反映日数 × 当月日数（日数は明細表に列が無い）
  estimate: {
    refs: () => ['actual'],
    tooltip: retailTooltip(
      { template: '当月実績 ÷ 当月実績反映日数 × 当月日数', valueLine: false },
      (row) =>
        String(
          currentMonthEstimate(
            parseFormulaNumber(row.actual) || 0,
            row.summaryProduct || row.wholesaleMesh
          )
        )
    ),
  },
  // 計画/前年実績比 ＝ 計画 ÷ 前年実績 × 100%
  ratio: {
    refs: () => ['plan', 'prevYear'],
    tooltip: retailTooltip(
      { template: '{plan} ÷ {prevYear} × 100%' },
      fieldResult('ratio')
    ),
  },
  // NET ＝ 納価 − 納価 × マージン率（補足2-1：固定マージン率パターン）
  net: {
    refs: () => ['planPrice', 'margin'],
    tooltip: retailTooltip(
      { template: '{planPrice} − {planPrice} × {margin}' },
      fieldResult('net')
    ),
  },
  // 値入率 ＝ (売価 − 納価) ÷ 売価 × 100%
  discount: {
    refs: () => ['price', 'planPrice'],
    tooltip: retailTooltip(
      { template: '({price} − {planPrice}) ÷ {price} × 100%' },
      fieldResult('discount')
    ),
  },
  // 値入額 ＝ (売価 − 納価) × 入数 × 函数(計画)（課題1757）
  markupAmount: {
    refs: () => ['price', 'planPrice', 'quantity', 'plan'],
    tooltip: retailTooltip(
      { template: '({price} − {planPrice}) × {quantity} × {plan}' },
      fieldResult('markupAmount')
    ),
  },
  // 量経追加口率 ＝ 量経追加口 ÷ 社外売上高 × 100%（量経追加口は明細表に列が無い）
  volumeAddRate: {
    refs: () => ['externalSales'],
    tooltip: retailTooltip(
      { template: '量経追加口 ÷ 社外売上高 × 100%', valueLine: false },
      fieldResult('volumeAddRate')
    ),
  },
  // 社外売上高 ＝ 社外売単価(補足2-2) × 入数 × 函数(計画)
  externalSales: {
    refs: () => ['quantity', 'plan'],
    tooltip: retailTooltip(
      { template: '{__unitPrice} × {quantity} × {plan}' },
      fieldResult('externalSales')
    ),
  },
  // 売上原価 ＝ 売上原価単価(補足2-3) × 入数 × 函数(計画)
  delivery: {
    refs: () => ['quantity', 'plan'],
    tooltip: retailTooltip(
      { template: '{__costUnitPrice} × {quantity} × {plan}' },
      fieldResult('delivery')
    ),
  },
  // 売買差益率 ＝ 売買差益 ÷ 売上高 × 100%（両方とも明細表に列が無い）
  profit: {
    refs: () => [],
    tooltip: retailTooltip(
      { template: '売買差益 ÷ 売上高 × 100%', valueLine: false },
      fieldResult('profit')
    ),
  },
};

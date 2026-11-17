// 計画詳細(NET固定)：画面専用の処理（明細行の算出・計算式の定義など）
import { UNIT_PRICE_KBN } from '@/mocks/common/planBasicInfo';

import { type FormulaDefs } from '@/components/grid';
import { parseFormulaNumber } from '@/components/grid/gridCommon';

import { withWholesaleRowDummies } from '@/mocks/common/salesPlanWholesale';
import type { ProductData } from '@/types/salesPlanWholesale';

import {
  SUMMARY_PRODUCT_OPTIONS,
  WHOLESALE_MESH_OPTIONS,
} from '@/constants/productMasters';

import {
  makeExternalUnitPriceOf,
  makeCostUnitPriceOf,
  markupAmountOf,
  unitTimesQuantityTimesPlan,
  makeDetailValueOf,
  makeDetailTooltip,
} from '@/utils/sales-plan/common/formulaCellHelpers';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanRate,
} from '@/utils/sales-plan/common/planDetailNumberFormat';
import { currentMonthEstimate } from '@/utils/sales-plan/plan-detail/currentMonthEstimate';

import { toAxisMetaBrand } from '@/utils/sales-plan/common/aggregationAxisMapping';
import { volumeAddRateOf } from '@/utils/sales-plan/common/aggregationMasterDummy';

import { WHOLESALE_COLUMN_LABELS } from './constants';

// 計画詳細・シミュレーション共通のダミー補完（src/mocks/common/salesPlanWholesale）。
export const withRowId = withWholesaleRowDummies;

// ── ギフト（上旬・中旬・下旬の3行1セット）ユーティリティ（並び・採番は utils/sales-plan/common/productCategoryChange） ──
// セル結合用 rowSpan：セット先頭行のみセット行数を返し、他は1（先頭セルが覆う）。
export const giftRowSpan = (params: any): number =>
  params.data?._giftFirst ? (params.data?._giftSpan ?? 1) : 1;

// EDI反映の表示値（行ベース）。定番商品・新商品はEDI連携が無いため空欄。
// セルの valueGetter と合計行の集計で同じ判定を使えるようモジュールスコープに置く。
export const ediValueOf = (row: any): string => {
  if (!row || row._isHeader) return '';
  const category = row.productCategory;
  if (category === '定番商品' || category === '新商品') return '';
  return row.ediPrice ?? '';
};

// 行 → 商品マスタ。定番商品はサマリ商品を持たず一般卸メッシュで商品を特定する（補足4-2）。
export const masterOf = (row: ProductData) =>
  SUMMARY_PRODUCT_OPTIONS.find((o) => o.value === row.summaryProduct) ??
  WHOLESALE_MESH_OPTIONS.find((o) => o.value === row.wholesaleMesh);

// 行の社外売単価（補足2-2）／売上原価単価（補足2-3）。
export const externalUnitPriceOf = makeExternalUnitPriceOf(
  masterOf,
  UNIT_PRICE_KBN
);

export const costUnitPriceOf = makeCostUnitPriceOf(masterOf);

// ギフト/特殊商品：NET・納価・売価の変更に応じてマージン率・値入率を再計算する。
// マージン率 = (納価 - NET) / 納価 × 100（納価未入力時は0表示）、値入率 = (売価 - 納価) / 売価 × 100。
// マージン率・値入率の算出はギフト・特殊商品のときだけ行う（既存仕様を維持）。
// 社外売上高・売上原価は入数・函数(計画)・マスタに依存するため、商品区分によらず算出する。
// 初期表示（useState の初期化子）とセル編集後の両方から呼べるよう、
// コンポーネントの外＝モジュールスコープの純関数として定義する。
export function recalcGiftLikeRates(data: ProductData): ProductData {
  const netVal = parseFormulaNumber(data.net) || 0;
  const planPriceVal = parseFormulaNumber(data.planPrice) || 0;
  const priceVal = parseFormulaNumber(data.price) || 0;
  const next = { ...data };
  if (
    data.productCategory === 'ギフト' ||
    data.productCategory === '特殊商品'
  ) {
    // マージン率：納価未入力時は0表示（補足1-2）
    next.margin =
      planPriceVal > 0
        ? formatPlanRate(
            ((planPriceVal - netVal) / planPriceVal) * 100,
            PLAN_DETAIL_DIGITS.marginRate
          )
        : '0.00%';
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
  // 社外売上高 ＝ 社外売単価(補足2-2) × 入数 × 函数(計画)
  next.externalSales = unitTimesQuantityTimesPlan(
    externalUnitPriceOf(next),
    next.quantity,
    next.plan
  );
  // 売上原価 ＝ 売上原価単価(補足2-3) × 入数 × 函数(計画)
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
// マージン率はギフト/特殊商品以外では再計算されず手入力値を保つため、キーに含める。
export const linkedRowKeyOf =
  (fields: (keyof ProductData)[]) =>
  (params: { node?: { id?: string }; data?: ProductData }): string => {
    const category = params.data?.productCategory;
    const keyFields =
      category === 'ギフト' || category === '特殊商品'
        ? fields
        : [...fields, 'margin' as const];
    return [
      params.node?.id ?? '',
      ...keyFields.map((f) => String(params.data?.[f] ?? '')),
    ].join('#');
  };

export const wholesaleTooltip = makeDetailTooltip<ProductData>(
  WHOLESALE_COLUMN_LABELS,
  makeDetailValueOf(externalUnitPriceOf, costUnitPriceOf)
);

// セル自身の値を結果として使う（明細表は算出結果を行データに保持している）。
export const fieldResult =
  (field: keyof ProductData) =>
  (row: ProductData): string =>
    String(row[field] ?? '');

export const WHOLESALE_FORMULA_DEFS: FormulaDefs<ProductData> = {
  // 当月着地見込 ＝ 当月実績 ÷ 当月実績反映日数 × 当月日数（日数は明細表に列が無い）
  estimate: {
    refs: () => ['actual'],
    tooltip: wholesaleTooltip(
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
    tooltip: wholesaleTooltip(
      { template: '{plan} ÷ {prevYear} × 100%' },
      fieldResult('ratio')
    ),
  },
  // マージン率 ＝ (納価 − NET) ÷ 納価 × 100%（補足1-2：納価未入力時は 0 表示）
  margin: {
    refs: () => ['planPrice', 'net'],
    tooltip: wholesaleTooltip(
      { template: '({planPrice} − {net}) ÷ {planPrice} × 100%' },
      fieldResult('margin')
    ),
  },
  // 値入率 ＝ (売価 − 納価) ÷ 売価 × 100%
  discount: {
    refs: () => ['price', 'planPrice'],
    tooltip: wholesaleTooltip(
      { template: '({price} − {planPrice}) ÷ {price} × 100%' },
      fieldResult('discount')
    ),
  },
  // 値入額 ＝ (売価 − 納価) × 入数 × 函数(計画)（課題1757）
  markupAmount: {
    refs: () => ['price', 'planPrice', 'quantity', 'plan'],
    tooltip: wholesaleTooltip(
      { template: '({price} − {planPrice}) × {quantity} × {plan}' },
      fieldResult('markupAmount')
    ),
  },
  // 量経追加口率 ＝ 量経追加口 ÷ 社外売上高 × 100%（量経追加口は明細表に列が無い）
  volumeAddRate: {
    refs: () => ['externalSales'],
    tooltip: wholesaleTooltip(
      { template: '量経追加口 ÷ 社外売上高 × 100%', valueLine: false },
      fieldResult('volumeAddRate')
    ),
  },
  // 社外売上高 ＝ 社外売単価(補足2-2) × 入数 × 函数(計画)
  externalSales: {
    refs: () => ['quantity', 'plan'],
    tooltip: wholesaleTooltip(
      { template: '{__unitPrice} × {quantity} × {plan}' },
      fieldResult('externalSales')
    ),
  },
  // 売上原価 ＝ 売上原価単価(補足2-3) × 入数 × 函数(計画)
  delivery: {
    refs: () => ['quantity', 'plan'],
    tooltip: wholesaleTooltip(
      { template: '{__costUnitPrice} × {quantity} × {plan}' },
      fieldResult('delivery')
    ),
  },
  // 売買差益率 ＝ 売買差益 ÷ 売上高 × 100%（両方とも明細表に列が無い）
  profit: {
    refs: () => [],
    tooltip: wholesaleTooltip(
      { template: '売買差益 ÷ 売上高 × 100%', valueLine: false },
      fieldResult('profit')
    ),
  },
};

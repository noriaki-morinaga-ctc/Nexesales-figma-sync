// sim(マージン率固定)：画面専用の処理（取引制度の判定・明細行の算出・計算式の定義など）

import { GetRowIdParams } from 'ag-grid-community';

import { type FormulaDef, type FormulaDefs } from '@/app/components/grid';

import {
  PLAN_DETAIL_DIGITS,
  formatPlanAmount,
} from '@/app/utils/sales-plan/common/planDetailNumberFormat';

import { withYear } from '@/app/utils/common/yearMonth';
import { SUMMARY_PRODUCT_OPTIONS } from '@/app/constants/productMasters';
import {
  makeExternalUnitPriceOf,
  makeCostUnitPriceOf,
  unitTimesQuantityTimesPlan,
  makeDetailValueOf,
  makeDetailTooltip,
  deltaResult,
} from '@/app/utils/sales-plan/common/formulaCellHelpers';
import type { ProductData } from '@/app/types/simulation';
import { simulationManagementProfitOf } from '@/app/utils/sales-plan/simulation/simulationManagementProfit';
import {
  formatSimMetric,
  parseSimMetric,
} from '@/app/utils/sales-plan/simulation/simulationMetricFormat';
import { COMPARISON_FIELDS, SIM_COLUMN_LABELS } from './constants';
import { seedCreator } from '@/mocks/sales-plan/sales-plan-simulation-margin-rate-fixed';
import { UNIT_PRICE_KBN } from '@/mocks/common/planBasicInfo';
// 取引制度（固定マージン率／NET入力）の判定ヘルパー。
//
// 本来は「販売店・1次店/3次店（計画のヘッダ）× サマリ商品 × 対象年月」をキーに
// マスタから取引制度を取得する（参考2-1／補足5-2）。モックには判定用マスタが無いため、
// 対象年月の月が奇数なら固定マージン率、偶数ならNET入力として代用する。
// 判定できない（対象年月が未入力・不正）場合は null を返し、呼び出し側で非活性とする。

// 取引制度の区分。
export type TradeSystem = 'fixedMargin' | 'netInput';

// 'YYYY/MM'（'YYYY年M月' 表記も許容）から月を取り出す。取り出せない場合は null。
const monthOf = (yearMonth?: string): number | null => {
  const matched = String(yearMonth ?? '')
    .trim()
    .match(/^(\d{4})[/年-](\d{1,2})月?$/);
  if (!matched) return null;
  const month = Number(matched[2]);
  return month >= 1 && month <= 12 ? month : null;
};

// 対象年月から取引制度を判定する。判定できない場合は null。
export const tradeSystemOf = (yearMonth?: string): TradeSystem | null => {
  const month = monthOf(yearMonth);
  if (month === null) return null;
  return month % 2 === 1 ? 'fixedMargin' : 'netInput';
};

// 固定マージン率か（NETは納価×マージン率から算出するため非活性）。
export const isFixedMarginMonth = (yearMonth?: string): boolean =>
  tradeSystemOf(yearMonth) === 'fixedMargin';

// NET入力か（NETは手入力のため活性）。判定できない場合は false。
export const isNetInputMonth = (yearMonth?: string): boolean =>
  tradeSystemOf(yearMonth) === 'netInput';

// 明細行の一意ID（Undo履歴を維持するためモジュール直下で参照を固定する → 02 §7.1）。
// 編集対象フィールド（metaBrand/summaryProduct/section）は含めない。
// 含めると編集で行IDが変わり、変更セルのハイライト記録（useChangedCells）
// が孤立する。id だけで一意（コピー行の id は copy-... で一意採番）。
export const getDetailRowId = (params: GetRowIdParams<ProductData>) =>
  String(params.data.id);

// 補足2-1：行ごとに「固定マージン率／NET入力」パターンを決定する。
// 本来は 販売店・1次店/3次店 × サマリ商品 × 対象年月 でマスタから取引制度を取得するが、
// モックでは対象年月の月の偶奇で代用する（奇数月＝固定マージン率、偶数月＝NET入力）。
// 対象年月が未入力の行は取引制度を判定できないため、NETは非活性とする。
export const isFixedMarginRow = (data: any): boolean =>
  isFixedMarginMonth(data?.targetMonth);

export const isNetInputRow = (data: any): boolean =>
  isNetInputMonth(data?.targetMonth);

// シミュレーション更新KEYの単価：NET入力はNET、固定マージン率は納価
export const usesNetAsKey = (row: { targetMonth?: string }): boolean =>
  isNetInputRow(row);

// 行 → 商品マスタ。この画面はサマリ商品名で商品を特定する。
export const masterOf = (row: ProductData) =>
  SUMMARY_PRODUCT_OPTIONS.find((o) => o.value === row.summaryProduct);

// 行の社外売単価（補足2-2）。社外売上高の算出（computeDerived）とツールチップの両方で使う。
export const externalUnitPriceOf = makeExternalUnitPriceOf(
  masterOf,
  UNIT_PRICE_KBN
);

// 行の売上原価単価（補足2-3）。管理利益額の算出（computeDerived）とツールチップの両方で使う。
export const costUnitPriceOf = makeCostUnitPriceOf(masterOf);

// 補足2-1 パターン別に NET／マージン率／値入率／社外売上高／売上高／管理利益を算出（data を直接更新）。
//  Pattern A（固定マージン率）：マージン率=固定(marginBefore)、NET=納価−納価×マージン率
//  Pattern B（NET入力）：NET=入力、マージン率=(納価−NET)/納価×100
//  社外売上高=社外売単価(補足2-2)×入数×函数、売上高=社外売上高−量経追加口−条件口（補足3-1）、
//  管理利益額=売買差益−直接固定費（補足3-1：計画詳細の集計と同じ定義）、
//  管理利益率=管理利益額/売上高×100（補足3-1：分母は売上高）
export const computeDerived = (data: any): void => {
  const num = (v?: string) => {
    const n = parseSimMetric(v);
    return isNaN(n) ? 0 : n;
  };
  const planPrice = parseSimMetric(data?.planPrice); // 納価
  if (isFixedMarginRow(data)) {
    const m = parseSimMetric(data?.marginBefore); // 固定マージン率
    if (!isNaN(planPrice) && !isNaN(m)) {
      data.net = formatSimMetric(planPrice - (planPrice * m) / 100, {
        digits: PLAN_DETAIL_DIGITS.price,
      });
      // 固定値を表示（マージン率＝小数第2位％）
      data.margin = formatSimMetric(m, {
        digits: PLAN_DETAIL_DIGITS.marginRate,
        percent: true,
      });
    }
  } else {
    const net = parseSimMetric(data?.net); // NET入力
    if (!isNaN(planPrice) && planPrice !== 0 && !isNaN(net))
      data.margin = formatSimMetric(((planPrice - net) / planPrice) * 100, {
        digits: PLAN_DETAIL_DIGITS.marginRate,
        percent: true,
      });
  }
  // 値入率＝(売価−納価)/売価×100
  const price = parseSimMetric(data?.price);
  if (!isNaN(price) && !isNaN(planPrice) && price !== 0)
    data.discount = formatSimMetric(((price - planPrice) / price) * 100, {
      digits: PLAN_DETAIL_DIGITS.rate,
      percent: true,
    });
  // 金額系（函数・入数が揃う場合のみ算出）
  const func = num(data?.plan);
  const qty = num(data?.quantity);
  if (qty > 0 && func > 0) {
    // 社外売上高＝社外売単価(補足2-2)×入数×函数(計画)
    data.externalSales = unitTimesQuantityTimesPlan(
      externalUnitPriceOf(data),
      data.quantity,
      data.plan
    );
    // 売上高・管理利益額を計画詳細と同じ式（補足3-1）で算出する（マージン率固定パターン）
    //   売上高     ＝ 社外売上高 − 量経追加口 − 条件口
    //   管理利益額 ＝ 売買差益 − 直接固定費
    const {
      volumeAdd,
      condition,
      sales,
      tradeProfit,
      directFixed,
      mgmtProfit: mgmt,
    } = simulationManagementProfitOf(
      data,
      'marginRateFixed',
      costUnitPriceOf(data)
    );
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
    data.managementProfitAmount = formatSimMetric(mgmt, {
      digits: PLAN_DETAIL_DIGITS.amount,
    });
    data.managementProfitRate = formatSimMetric(
      sales !== 0 ? (mgmt / sales) * 100 : 0,
      {
        percent: true,
      }
    ); // 管理利益率=管理利益額/売上高×100
  }
};

// 初期行：比較項目の Before/After を確定したうえで補足2-1 パターンで算出し、
// 算出された NET／マージン率を Before に同期して初期の増減を0にする。
export const initSimRow = (r: ProductData): ProductData => {
  const d = { ...(r as any) } as Record<string, string | undefined>;
  COMPARISON_FIELDS.forEach((f) => {
    if (d[`${f}Before`] === undefined) d[`${f}Before`] = d[f] ?? '';
    if (d[`${f}After`] === undefined) d[`${f}After`] = '';
  });
  seedCreator(d, 'exp1');
  seedCreator(d, 'exp2');
  if (isFixedMarginRow(d)) d.marginBefore = d.margin; // 固定マージン率の基準を確定
  computeDerived(d);
  d.netBefore = d.net;
  d.marginBefore = d.margin;
  return d as unknown as ProductData;
};

// 新しいセット識別キーを採番。
// 商品区分 → 明細表のセクション名（タブ・状態配列のキー）。
// 当画面（量販）の商品区分は「特売」だが、セクション名は「特殊商品」のため読み替える
// （page.tsx の categoryToSection と同じ対応）。
export const categoryToSection = (category: string): string =>
  category === '特売' ? '特殊商品' : category;

// ── ギフト（上旬・中旬・下旬の3行1セット）ユーティリティ（並び・採番は utils/sales-plan/common/productCategoryChange） ──
// セル結合用 rowSpan：セット先頭行のみセット行数を返し、他は1（先頭セルが覆う）。
export const giftRowSpan = (params: any): number =>
  params.data?._giftFirst ? (params.data?._giftSpan ?? 1) : 1;

// 全項目が空の明細行テンプレート（ギフトセット生成で共通利用）。
export const makeEmptyProduct = (section: string): ProductData => ({
  section,
  productCategory: section,
  metaBrand: '',
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
  exp2CampaignCode: '',
  exp2Description: '',
});

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

// この画面に売上原価列は無いが、makeDetailValueOf は原価単価の resolver を要求するため
// costUnitPriceOf を渡す（__costUnitPrice はどのテンプレートからも参照されない）。
export const simTooltip = makeDetailTooltip<ProductData>(
  SIM_COLUMN_LABELS,
  makeDetailValueOf(externalUnitPriceOf, costUnitPriceOf)
);

// セル自身の値を結果として使う。
export const fieldResult =
  (field: keyof ProductData) =>
  (row: ProductData): string =>
    String(row[field] ?? '');

// 増減列（計画函数・NET・納価・売価）の定義を作る。
// 増減列は colId が `<metric>Delta` で行データに値を持たないため、結果値は deltaResult で算出する。
export const deltaDef = (metric: string): FormulaDef<ProductData> => ({
  refs: () => [metric, `${metric}Before`],
  tooltip: simTooltip({ template: `{${metric}} − {${metric}Before}` }, (row) =>
    deltaResult(row, metric)
  ),
});

export const SIM_FORMULA_DEFS: FormulaDefs<ProductData> = {
  planDelta: deltaDef('plan'),
  netDelta: deltaDef('net'),
  planPriceDelta: deltaDef('planPrice'),
  priceDelta: deltaDef('price'),

  // NET ＝ 納価 − 納価 × マージン率（固定マージン率の行のみ算出）
  net: {
    isFormula: (row) => isFixedMarginRow(row),
    refs: () => ['planPrice', 'margin'],
    tooltip: simTooltip(
      { template: '{planPrice} − {planPrice} × {margin}' },
      fieldResult('net')
    ),
  },
  // マージン率 ＝ (納価 − NET) ÷ 納価 × 100%（NET入力の行のみ算出。参考2-1 No.2-2）
  margin: {
    isFormula: (row) => !isFixedMarginRow(row),
    refs: () => ['planPrice', 'net'],
    tooltip: simTooltip(
      { template: '({planPrice} − {net}) ÷ {planPrice} × 100%' },
      fieldResult('margin')
    ),
  },
  // 値入率 ＝ (売価 − 納価) ÷ 売価 × 100%
  discount: {
    refs: () => ['price', 'planPrice'],
    tooltip: simTooltip(
      { template: '({price} − {planPrice}) ÷ {price} × 100%' },
      fieldResult('discount')
    ),
  },
  // 社外売上高 ＝ 社外売単価(補足2-2) × 入数 × 計画函数(変更後)
  externalSales: {
    refs: () => ['quantity', 'plan'],
    tooltip: simTooltip(
      { template: '{__unitPrice} × {quantity} × {plan}' },
      fieldResult('externalSales')
    ),
  },
  // 売上高 ＝ 社外売上高 − 量経追加口 − 条件口（量経追加口・条件口は明細に列が無い）
  netSales: {
    refs: () => ['externalSales'],
    tooltip: simTooltip(
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
    tooltip: simTooltip(
      { template: '{_tradeProfit} − {_directFixed}' },
      fieldResult('managementProfitAmount')
    ),
  },
  // 管理利益率 ＝ 管理利益額 ÷ 売上高 × 100%
  managementProfitRate: {
    refs: () => ['managementProfitAmount', 'netSales'],
    tooltip: simTooltip(
      { template: '{managementProfitAmount} ÷ {netSales} × 100%' },
      fieldResult('managementProfitRate')
    ),
  },
};

// ===== 変更前 / 変更後 / 増減 比較 ヘルパー =====
// 文字列→数値（カンマ・%除去）。空は NaN。
export const parseMetric = parseSimMetric;

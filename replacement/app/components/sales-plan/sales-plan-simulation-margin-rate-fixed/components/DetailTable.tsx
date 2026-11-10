import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ICellRendererParams,
  RowClassParams,
  GridApi,
  GridReadyEvent,
  GetRowIdParams,
  FilterChangedEvent,
  RowDataUpdatedEvent,
} from 'ag-grid-community';

import { Trash2, Copy, FileSearch } from 'lucide-react';
import { toast } from 'sonner';

import { planDetailTotalRatesOf } from '../../../../utils/sales-plan/plan-detail/planDetailTotalRates';
import {
  campaignComboOptions,
  registeredCampaignName,
} from '../../../../utils/sales-plan/simulation/simulationCampaignName';

import {
  GRID_COLORS,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  formatEmptyAsDash,
  gridFilterContextMenuItems,
  changedCellStyle,
  requiredEmptyCellStyle,
  useFormulaSourceHighlight,
  useGridColumnState,
  useChangedCells,
  useLinkedCellUndo,
  withHeaderTooltips,
  copySourceLeftBorder,
  CopySourceLegend,
  type FormulaDef,
  type FormulaDefs,
  GRID_NUMBER_TEXT_FILTER,
  GRID_MONTH_TEXT_FILTER,
  useRevealNewRows,
} from '../../../grid';
import { DeltaCell, formatDelta, deltaTextColor } from '../../../ui/delta-cell';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanAmount,
  formatPlanRate,
  roundPlanNumber,
  planAmountFormatter,
  planRateFormatter,
} from '../../../../utils/sales-plan/common/planDetailNumberFormat';
import { BottomPane } from '../../../ui/bottom-pane';
import { SimulationReferenceTable } from '../../../shared/sales-plan/simulation/SimulationReferenceTable';
import {
  DETAIL_PERIOD_FROM_ID,
  SimulationPeriodPicker,
} from '../../../shared/sales-plan/simulation/SimulationPeriodPicker';
import {
  BUTTON_STYLES,
  BUTTON_BASE,
  CARD_TITLE_CLASS,
  FORM_LABEL_CLASS,
  CARD_CLASS,
} from '../../../../../styles/commonStyles';
import { ConfirmDialog } from '../../../ui/confirm-dialog';
import {
  canSelectConfirm,
  confirmBlockReason,
  hasSameSimulationKey,
  simulationKeyDuplicateMessage,
} from '../../../../utils/sales-plan/simulation/simulationConfirmRules';

import { MonthYearCellEditor } from '../../../ui/month-year-cell-editor';
import {
  CAMPAIGN_OPTIONS,
  REGULAR_PRODUCTS_DATA,
  NEW_PRODUCTS_DATA,
  PROMOTION_PRODUCTS_DATA,
  GIFT_PRODUCTS_DATA,
} from '../../../../constants/simulationSalesPlanMockData';
import {
  SingleComboboxCellEditor,
  toComboOptions,
} from '../../../ui/single-combobox-cell-editor';
import {
  PROMOTION_NONE_LABEL,
  CATEGORY_LABELS_MARGIN,
} from '../../../../constants/promotionCategories';
import { buildCategoryChangeRows } from '../../../../utils/sales-plan/common/productCategoryChange';
import { stripCopySource } from '../../../../utils/common/copySourceMarks';
import { planDetailCodeColumns } from '../../../shared/sales-plan/common/planDetailCodeColumns';
import {
  heldRowKeyOf,
  isRowInActiveTab,
} from '../../../../utils/sales-plan/simulation/heldCategoryRows';
import {
  managementClassFromCode,
  campaignClassFromCode,
  isManagementCodeInClass,
  isCampaignCodeInClass,
  EXPENSE_MANAGEMENT_CLASS_OPTIONS,
  EXPENSE_MANAGEMENT_CODE_OPTIONS,
  EXPENSE_CAMPAIGN_CODE_OPTIONS,
} from '../../../../constants/expenseRelations';
import {
  managementClassCodeOf,
  managementClassNameOf,
  managementCodeNameOf,
  managementCodeOfName,
  campaignClassCodeOf,
  campaignClassNameOf,
  campaignCodeNameOf,
  campaignCodeOfName,
  managementClassComboOptions,
  managementClassCodeComboOptions,
  managementCodeComboOptions,
  managementCodeNameComboOptions,
  campaignClassComboOptions,
  campaignClassCodeComboOptions,
  campaignCodeComboOptions,
  campaignCodeNameComboOptions,
} from '../../../../constants/comboFieldOptions';
import {
  CURRENT_USER_NAME,
  SIMULATION_CLOSED_MONTHS,
} from '../../../../constants/planBasicInfoMockData';
import {
  addMonths,
  isInPeriod,
  withYear,
} from '../../../../utils/common/yearMonth';
import {
  isFixedMarginMonth,
  isNetInputMonth,
} from '../../../../utils/sales-plan/simulation/tradeSystem';
import { SUMMARY_PRODUCT_OPTIONS } from '../../../../constants/productMasters';
import {
  makeExternalUnitPriceOf,
  makeCostUnitPriceOf,
  unitTimesQuantityTimesPlan,
  makeDetailValueOf,
  makeDetailTooltip,
  deltaResult,
} from '../../../../utils/sales-plan/common/formulaCellHelpers';
import { simulationManagementProfitOf } from '../../../../utils/sales-plan/simulation/simulationManagementProfit';

// 拡売費の管理コード／施策コードの全候補（管理区分・施策区分で絞り込んで使う）
const MGMT_CODE_LIST = EXPENSE_MANAGEMENT_CODE_OPTIONS.map((o) => o.value);
const CAMPAIGN_CODE_LIST = EXPENSE_CAMPAIGN_CODE_OPTIONS.map((o) => o.value);

// 拡売費①②（明細内）のプルダウン選択肢（表内は SingleComboboxCellEditor で編集）

export interface ProductData {
  // 行の一意ID（getRowId・行更新／削除の照合に使用。販売計画表と同じく id で統一）
  id?: string;
  campaign?: string;
  // 企画名（確度の右隣に表示。企画コード/区分に対応する名称）
  campaignName?: string;
  probability?: string;
  targetMonth?: string;
  section: string;
  metaBrand: string;
  containerCapacityG?: string;
  summaryProduct: string;
  wholesaleMesh: string;
  productCategory: string;
  // 販売期間（ギフトの上旬/中旬/下旬）。ギフト以外は未設定（空欄＝ー表示）。
  period?: string;
  quantity: string;
  plan: string;
  net: string;
  planPrice: string;
  price: string;
  margin: string;
  discount: string;
  // 変更前（販売計画表の保存値スナップショット）／AF実績（参照） — 比較表示用
  planBefore?: string;
  netBefore?: string;
  planPriceBefore?: string;
  priceBefore?: string;
  marginBefore?: string;
  exp1PlannedAmountBefore?: string;
  exp2PlannedAmountBefore?: string;
  planAfter?: string;
  netAfter?: string;
  planPriceAfter?: string;
  priceAfter?: string;
  marginAfter?: string;
  exp1PlannedAmountAfter?: string;
  exp2PlannedAmountAfter?: string;
  _isHeader?: boolean;
  // 明細追加・コピーで採番する挿入順。値が大きいほど新しく、表示時は合計行直下（先頭）へ並べる
  _addedSeq?: number;
  // 計画キー（コピー元グループ単位）。同一計画の明細はこのキーを共有し、確定の排他判定に使う
  _planKey?: string;
  // 行の追加経路（カラーバー表示用）: reference=コピー元ペイン / detail=グリッドの行コピー / new=明細追加
  _copySource?: 'reference' | 'detail' | 'new';
  managementProfitAmount?: string;
  managementProfitRate?: string;
  netSales?: string;
  externalSales?: string;
  // 企画単位集計の合計行で値入率（加重平均）を算出するための集計専用値（非表示）。
  //   _markupAmount＝Σ(売価−納価)×入数×計画函数／_retailAmount＝Σ売価×入数×計画函数
  _markupAmount?: string;
  _retailAmount?: string;
  // 売上高（＝社外売上高−量経追加口−条件口）の算出途中値（非表示。計算式ツールチップ用）
  _volumeAdd?: string;
  _condition?: string;
  // 管理利益額（＝売買差益−直接固定費）の算出途中値（非表示。計算式ツールチップ用）
  _tradeProfit?: string;
  _directFixed?: string;
  // 摘要1（企画に紐づく摘要）、販促区分、受渡、生販
  summary1?: string;
  promotion?: string;
  delivery?: string;
  production?: string;
  exp1PlannedAmount: string;
  exp1PostingMonth: string;
  exp1ManagementCode: string;
  exp1AccountItem: string;
  exp1ManagementClass: string;
  exp1CampaignClass?: string;
  exp1CampaignCode?: string;
  exp1Description: string; // 摘要1(社内用)
  exp1Creator?: string; // 作成者（行追加・コピー時にログインユーザー名を自動設定。編集不可）
  exp2PlannedAmount: string;
  exp2PostingMonth: string;
  exp2ManagementCode: string;
  exp2AccountItem: string;
  exp2ManagementClass: string;
  exp2CampaignClass?: string;
  exp2CampaignCode?: string;
  exp2Description: string; // 摘要1(社内用)
  exp2Creator?: string; // 作成者（行追加・コピー時にログインユーザー名を自動設定。編集不可）
  // ギフトの「上旬・中旬・下旬」3行1セットを識別するキー。
  // 同一 giftSetId の行はグリッドで販売期間・計画(函数)以外をセル結合し、
  // 追加・コピー・削除を3行まとめて行う。
  giftSetId?: string;
  // グリッド表示用の一時フラグ（rowData生成時に付与。セル結合の先頭行判定と行数）。
  _giftFirst?: boolean;
  _giftSpan?: number;
  // 操作アイコンをセット中央行にのみ表示するための一時フラグ（rowData生成時に付与）。
  _giftMiddle?: boolean;
  // セット最終行（下旬）判定。操作列の内部罫線制御に使用。
  _giftLast?: boolean;
}

// 新規行の強調表示でフォーカスを当てる列（先頭の対象年月）。
// 強調（スクロール・フラッシュ）は共通の useRevealNewRows が行う（→ 02 変更履歴）。
const REVEAL_FOCUS_COLUMN = 'targetMonth';

// 明細行の一意ID（Undo履歴を維持するためモジュール直下で参照を固定する → 02 §7.1）。
// 編集対象フィールド（metaBrand/summaryProduct/section）は含めない。
// 含めると編集で行IDが変わり、変更セルのハイライト記録（useChangedCells）
// が孤立する。id だけで一意（コピー行の id は copy-... で一意採番）。
const getDetailRowId = (params: GetRowIdParams<ProductData>) =>
  String(params.data.id);

// 不採用行のグレーアウト背景：readonly(GRID_COLORS.readonly)より薄い灰。
// 不採用は変更可能なため、他のグレーアウトと区別する（gridStyles は変更しない）。
const REJECTED_BG = GRID_COLORS.rejectedBg;

// 比較表示の対象指標（変更前/変更後/増減/AF）
const COMPARISON_FIELDS = [
  'plan',
  'net',
  'planPrice',
  'price',
  'margin',
  'exp1PlannedAmount',
  'exp2PlannedAmount',
] as const;

// 作成者のダミー割り当てに使う決定的なハッシュ。
const hashId = (id?: string): number => {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

// 補足2-1：行ごとに「固定マージン率／NET入力」パターンを決定する。
// 本来は 販売店・1次店/3次店 × サマリ商品 × 対象年月 でマスタから取引制度を取得するが、
// モックでは対象年月の月の偶奇で代用する（奇数月＝固定マージン率、偶数月＝NET入力）。
// 対象年月が未入力の行は取引制度を判定できないため、NETは非活性とする。
const isFixedMarginRow = (data: any): boolean =>
  isFixedMarginMonth(data?.targetMonth);
const isNetInputRow = (data: any): boolean =>
  isNetInputMonth(data?.targetMonth);
// シミュレーション更新KEYの単価：NET入力はNET、固定マージン率は納価
const usesNetAsKey = (row: { targetMonth?: string }): boolean =>
  isNetInputRow(row);

// 数値変換・整形（モジュール内ヘルパー）。
const pmNum = (str?: string): number => {
  if (str === undefined || str === null || String(str).trim() === '')
    return NaN;
  const n = parseFloat(String(str).replace(/[,%]/g, ''));
  return isNaN(n) ? NaN : n;
};
// 行 → 商品マスタ。この画面はサマリ商品名で商品を特定する。
const masterOf = (row: ProductData) =>
  SUMMARY_PRODUCT_OPTIONS.find((o) => o.value === row.summaryProduct);

// 行の社外売単価（補足2-2）。社外売上高の算出（computeDerived）とツールチップの両方で使う。
const externalUnitPriceOf = makeExternalUnitPriceOf(masterOf);
// 行の売上原価単価（補足2-3）。管理利益額の算出（computeDerived）とツールチップの両方で使う。
const costUnitPriceOf = makeCostUnitPriceOf(masterOf);

// 算出値の保持用整形。digits を渡した項目（計画詳細と同じ項目一覧の桁数）は
// 端数を四捨五入してその桁数に固定する。保持値のため桁区切りは付けない。
// digits 省略時は従来どおり、整数はそのまま・小数を持つ場合のみ小数点以下2桁で表示する。
const pmFmt = (
  num: number,
  options: { digits?: number; percent?: boolean } = {}
): string => {
  if (!isFinite(num)) return '';
  const { digits, percent } = options;
  if (digits !== undefined)
    return percent ? formatPlanRate(num, digits) : roundPlanNumber(num, digits);
  const body = Number.isInteger(num) ? String(num) : num.toFixed(2);
  return percent ? `${body}%` : body;
};

// 再計算（computeDerived）で書き換わる算出列。連動セルの Undo（useLinkedCellUndo）で
// 主セルと一緒に退避・復元する従属セルとして使う（→ 02 §7.3）。
const DERIVED_FIELDS: (keyof ProductData)[] = [
  'net',
  'margin',
  'discount',
  'externalSales',
  '_volumeAdd',
  '_condition',
  '_tradeProfit',
  '_directFixed',
  'netSales',
  'managementProfitAmount',
  'managementProfitRate',
];

// 補足2-1 パターン別に NET／マージン率／値入率／社外売上高／売上高／管理利益を算出（data を直接更新）。
//  Pattern A（固定マージン率）：マージン率=固定(marginBefore)、NET=納価−納価×マージン率
//  Pattern B（NET入力）：NET=入力、マージン率=(納価−NET)/納価×100
//  社外売上高=社外売単価(補足2-2)×入数×函数、売上高=社外売上高−量経追加口−条件口（補足3-1）、
//  管理利益額=売買差益−直接固定費（補足3-1：計画詳細の集計と同じ定義）、
//  管理利益率=管理利益額/売上高×100（補足3-1：分母は売上高）
const computeDerived = (data: any): void => {
  const num = (v?: string) => {
    const n = pmNum(v);
    return isNaN(n) ? 0 : n;
  };
  const planPrice = pmNum(data?.planPrice); // 納価
  if (isFixedMarginRow(data)) {
    const m = pmNum(data?.marginBefore); // 固定マージン率
    if (!isNaN(planPrice) && !isNaN(m)) {
      data.net = pmFmt(planPrice - (planPrice * m) / 100, {
        digits: PLAN_DETAIL_DIGITS.price,
      });
      // 固定値を表示（マージン率＝小数第2位％）
      data.margin = pmFmt(m, {
        digits: PLAN_DETAIL_DIGITS.marginRate,
        percent: true,
      });
    }
  } else {
    const net = pmNum(data?.net); // NET入力
    if (!isNaN(planPrice) && planPrice !== 0 && !isNaN(net))
      data.margin = pmFmt(((planPrice - net) / planPrice) * 100, {
        digits: PLAN_DETAIL_DIGITS.marginRate,
        percent: true,
      });
  }
  // 値入率＝(売価−納価)/売価×100
  const price = pmNum(data?.price);
  if (!isNaN(price) && !isNaN(planPrice) && price !== 0)
    data.discount = pmFmt(((price - planPrice) / price) * 100, {
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
    data.netSales = pmFmt(sales, { digits: PLAN_DETAIL_DIGITS.amount });
    // 管理利益額は整数（四捨五入）で保持・表示する
    data.managementProfitAmount = pmFmt(mgmt, {
      digits: PLAN_DETAIL_DIGITS.amount,
    });
    data.managementProfitRate = pmFmt(sales !== 0 ? (mgmt / sales) * 100 : 0, {
      percent: true,
    }); // 管理利益率=管理利益額/売上高×100
  }
};

// 既存行（ダミー）の作成者。行追加・コピー時はログインユーザーを設定するため、
// 既存行のみ ID ハッシュで決定的に割り当てる。拡売費が未入力の枠は作成者も空欄。
const SIM_CREATORS = ['アサヒ　太郎', '山田 太郎', '佐藤 花子', '鈴木 一郎'];
const seedCreator = (
  d: Record<string, string | undefined>,
  prefix: 'exp1' | 'exp2'
): void => {
  if (d[`${prefix}Creator`] !== undefined) return;
  d[`${prefix}Creator`] = d[`${prefix}PlannedAmount`]
    ? SIM_CREATORS[hashId(d.id) % SIM_CREATORS.length]
    : '';
};

// 初期行：比較項目の Before/After を確定したうえで補足2-1 パターンで算出し、
// 算出された NET／マージン率を Before に同期して初期の増減を0にする。
const initSimRow = (r: ProductData): ProductData => {
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

// ── ギフト（上旬・中旬・下旬の3行1セット）ユーティリティ ──
// 販売期間の並び（上旬→中旬→下旬）。
const GIFT_PERIOD_ORDER = ['上旬', '中旬', '下旬'];
// 新しいセット識別キーを採番。
// 商品区分 → 明細表のセクション名（タブ・状態配列のキー）。
// 当画面（量販）の商品区分は「特売」だが、セクション名は「特殊商品」のため読み替える
// （page.tsx の categoryToSection と同じ対応）。
const categoryToSection = (category: string): string =>
  category === '特売' ? '特殊商品' : category;

const newGiftSetId = (): string =>
  `giftset-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
// 販売期間の並び順インデックス。
const giftPeriodIndex = (period?: string): number => {
  const i = GIFT_PERIOD_ORDER.indexOf(period ?? '');
  return i < 0 ? GIFT_PERIOD_ORDER.length : i;
};
// セル結合用 rowSpan：セット先頭行のみセット行数を返し、他は1（先頭セルが覆う）。
const giftRowSpan = (params: any): number =>
  params.data?._giftFirst ? (params.data?._giftSpan ?? 1) : 1;

// 全項目が空の明細行テンプレート（ギフトセット生成で共通利用）。
const makeEmptyProduct = (section: string): ProductData => ({
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

// 拡売費①②を空にする差分（参照コピー・新規追加の初期化に使用）。
const EMPTY_EXPENSE_FIELDS = {
  exp1PlannedAmount: '',
  exp1PlannedAmountBefore: '',
  exp1PostingMonth: '',
  exp1ManagementCode: '',
  exp1AccountItem: '',
  exp1ManagementClass: '',
  exp1CampaignClass: '',
  exp1CampaignCode: '',
  exp1Description: '',
  exp2PlannedAmount: '',
  exp2PlannedAmountBefore: '',
  exp2PostingMonth: '',
  exp2ManagementCode: '',
  exp2AccountItem: '',
  exp2ManagementClass: '',
  exp2CampaignClass: '',
  exp2CampaignCode: '',
  exp2Description: '',
} as const;

export interface DetailTableHandle {
  addCopiedRow: (data: ProductData) => void;
  /** 同じ対象年月・同じ企画の明細へ企画名を連動する */
  syncCampaignName: (
    targetMonth: string,
    campaign: string,
    campaignName: string
  ) => void;
  /** 既存行をテンプレートに新規行を合計行直下へ追加（明細追加用） */
  addNewRow: (overrides: Partial<ProductData> & { section: string }) => void;
  /** id 一致行を更新（明細編集用） */
  updateRow: (data: ProductData) => void;
  /** id 一致行を削除（明細削除用）。ギフトはセット単位（giftSetId）で削除 */
  deleteRow: (target: ProductData | ProductData['id']) => void;
  // ギフト：上旬/中旬/下旬の3行を1セットとして追加（plans=各期間の箱数=計画函数）
  addGiftSet: (
    base: Partial<ProductData>,
    plans: [string, string, string]
  ) => void;
  // ギフト：セットをまるごと複製して新規セット（3行）を追加（コピー由来）
  addCopiedGiftSet: (
    base: Partial<ProductData>,
    plans: [string, string, string]
  ) => void;
  // ギフト：セットの共通項目・各期間の計画(箱数)を更新
  updateGiftSet: (
    giftSetId: string,
    base: Partial<ProductData>,
    plans: [string, string, string]
  ) => void;
  // ギフト：セットの現在値を取得（編集ペインの初期表示用）
  getGiftSet: (
    giftSetId: string
  ) => { base: ProductData; plans: [string, string, string] } | null;
  // 保存時：左端の帯（コピー元・明細コピー・明細追加）と編集セルの黄色強調を消す
  clearSavedMarks: () => void;
}

interface DetailTableProps {
  onOpenAddDetail?: (section: string) => void;
  onOpenDeleteDetail?: (data: ProductData) => void;
  // 企画単位集計データを親（集計表）へ通知する
  onCampaignDataChange?: (rows: ProductData[]) => void;
  // 全明細を親へ通知する（追加可否・確定排他の判定に使用）
  onRowsChange?: (rows: ProductData[]) => void;
  // シミュレーション（詳細）の対象期間（YYYY/MM）。明細表と参照用下ペインはこの期間内の
  // 対象年月の明細のみ扱う。集計の対象期間とは連動しない（6/16 第9回 決定9）。
  // 明細追加ペインの選択範囲にも使うため画面（page.tsx）側で保持する。
  targetPeriodFrom: string;
  targetPeriodTo: string;
  // 詳細の対象期間の変更。未保存の入力を破棄してから呼ぶ（6/16 第9回 決定10）。
  onTargetPeriodFromChange: (value: string) => void;
  onTargetPeriodToChange: (value: string) => void;
  // シミュレーション（集計）の対象期間（YYYY/MM）。企画単位集計はこの期間内の明細を集計する。
  aggregationPeriodFrom: string;
  aggregationPeriodTo: string;
}

// モックの対象年月を年だけ置き換える（月はそのまま）。
// 明細・参照用下ペインともシステム日付の当年に寄せ、対象期間の初期値（当年1〜12月）で
// 表示されるようにする。
const withTargetYear = (rows: ProductData[], year: number): ProductData[] =>
  rows.map((r) =>
    r.targetMonth ? { ...r, targetMonth: withYear(r.targetMonth, year) } : r
  );
const THIS_YEAR = new Date().getFullYear();

// 計算式（派生）セル → 計算式テンプレートと算出元フィールド。
// 計算式セルにホバーすると、計算式ツールチップ（式＋実値の2行）を表示し、
// 同時に当該行内の算出元セルの枠線を強調する（マウスが離れると消える）。
// 「補足資料_手売り_販売計画_計算式一覧表」補足1-1・補足2-1・補足2-2・補足5-2 に準拠。
// 行ごとに「固定マージン率（NETが算出）」「NET入力（マージン率が算出）」が入れ替わるため、
// net / margin は isFormula で行単位に判定する。
const SIM_COLUMN_LABELS: Record<string, string> = {
  plan: '計画函数(SIM値)',
  planBefore: '計画函数(計画値)',
  net: 'NET(SIM値)',
  netBefore: 'NET(計画値)',
  planPrice: '納価(SIM値)',
  planPriceBefore: '納価(計画値)',
  price: '売価(SIM値)',
  priceBefore: '売価(計画値)',
  margin: 'マージン率',
  quantity: '入数',
  externalSales: '社外売上高',
  netSales: '売上高',
  _volumeAdd: '量経追加口',
  _condition: '条件口',
  _tradeProfit: '売買差益',
  _directFixed: '直接固定費',
  managementProfitAmount: '管理利益額',
  exp1PlannedAmountBefore: '拡売費①計画金額',
  exp2PlannedAmountBefore: '拡売費②計画金額',
  __unitPrice: '社外売単価',
};

// この画面に売上原価列は無いが、makeDetailValueOf は原価単価の resolver を要求するため
// costUnitPriceOf を渡す（__costUnitPrice はどのテンプレートからも参照されない）。
const simTooltip = makeDetailTooltip<ProductData>(
  SIM_COLUMN_LABELS,
  makeDetailValueOf(externalUnitPriceOf, costUnitPriceOf)
);

// セル自身の値を結果として使う。
const fieldResult =
  (field: keyof ProductData) =>
  (row: ProductData): string =>
    String(row[field] ?? '');

// 増減列（計画函数・NET・納価・売価）の定義を作る。
// 増減列は colId が `<metric>Delta` で行データに値を持たないため、結果値は deltaResult で算出する。
const deltaDef = (metric: string): FormulaDef<ProductData> => ({
  refs: () => [metric, `${metric}Before`],
  tooltip: simTooltip({ template: `{${metric}} − {${metric}Before}` }, (row) =>
    deltaResult(row, metric)
  ),
});

const SIM_FORMULA_DEFS: FormulaDefs<ProductData> = {
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

export const DetailTable = forwardRef<DetailTableHandle, DetailTableProps>(
  function DetailTable(
    {
      onOpenAddDetail,
      onOpenDeleteDetail,
      onCampaignDataChange,
      onRowsChange,
      targetPeriodFrom,
      targetPeriodTo,
      onTargetPeriodFromChange,
      onTargetPeriodToChange,
      aggregationPeriodFrom,
      aggregationPeriodTo,
    },
    ref
  ) {
    // 明細データ（グリッドの行）の状態
    const [regularProductsData, setRegularProductsData] = useState<
      Array<ProductData>
    >(() => withTargetYear(REGULAR_PRODUCTS_DATA, THIS_YEAR).map(initSimRow));

    const [newProductsData, setNewProductsData] = useState<ProductData[]>(() =>
      withTargetYear(NEW_PRODUCTS_DATA, THIS_YEAR).map(initSimRow)
    );

    const [promotionProductsData, setPromotionProductsData] = useState<
      Array<ProductData>
    >(() => withTargetYear(PROMOTION_PRODUCTS_DATA, THIS_YEAR).map(initSimRow));

    const [giftProductsData, setGiftProductsData] = useState<
      Array<ProductData>
    >(() => withTargetYear(GIFT_PRODUCTS_DATA, THIS_YEAR).map(initSimRow));

    const allData = useMemo(
      () => [
        ...regularProductsData,
        ...newProductsData,
        ...promotionProductsData,
        ...giftProductsData,
      ],
      [
        regularProductsData,
        newProductsData,
        promotionProductsData,
        giftProductsData,
      ]
    );

    // シミュレーション（詳細）の対象期間内の明細（明細表の表示対象）
    const periodData = useMemo(
      () =>
        allData.filter((row) =>
          isInPeriod(row.targetMonth ?? '', targetPeriodFrom, targetPeriodTo)
        ),
      [allData, targetPeriodFrom, targetPeriodTo]
    );

    // シミュレーション（集計）の対象期間内の明細（企画単位集計の対象）
    const aggregationPeriodData = useMemo(
      () =>
        allData.filter((row) =>
          isInPeriod(
            row.targetMonth ?? '',
            aggregationPeriodFrom,
            aggregationPeriodTo
          )
        ),
      [allData, aggregationPeriodFrom, aggregationPeriodTo]
    );

    // 保存済みの明細（初期表示時点、以降は保存のたびに更新）。
    // 詳細の対象期間を変更したときは、未保存の入力を破棄してこの内容へ戻す（6/16 第9回 決定10）。
    const savedRowsRef = useRef({
      regular: regularProductsData,
      new: newProductsData,
      promotion: promotionProductsData,
      gift: giftProductsData,
    });

    // 確定排他の判定（セルエディタ・ツールチップ）から常に最新の全明細を参照するための ref
    const allDataRef = useRef<ProductData[]>(allData);
    allDataRef.current = allData;

    // 参照表（販売計画(コピー元)）に表示する初期データのスナップショット。
    // ライブの allData を渡すとコピー実行で追加した行がコピー元側にも現れてしまうため、
    // 初期表示時点の計画を固定表示し、コピー先（シミュレーション詳細）にのみ行が追加されるようにする。
    // 表示する期間は詳細の対象期間（参照表側で絞り込む）。
    const [referenceRows] = useState<ProductData[]>(() => allData);

    // 全明細を親へ通知（追加可否・確定排他の判定に使用）。
    // 4つの状態配列の変化時のみ発火させ、再レンダーループを避ける。
    useEffect(() => {
      onRowsChange?.([
        ...regularProductsData,
        ...newProductsData,
        ...promotionProductsData,
        ...giftProductsData,
      ]);
    }, [
      regularProductsData,
      newProductsData,
      promotionProductsData,
      giftProductsData,
      onRowsChange,
    ]);

    // 企画×確度単位集計：allData を「企画＋確度」でグルーピングし、数値列のみ合計
    // （集計表ではこれを企画でドリルダウン表示する）
    const buildCampaignSummary = (): ProductData[] => {
      const toNum = (s?: string) =>
        s ? parseFloat(String(s).replace(/,/g, '')) || 0 : 0;
      const groups = new Map<string, ProductData[]>();
      aggregationPeriodData.forEach((row) => {
        const key = `${row.campaign || '（未設定）'}｜${row.probability || ''}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      });
      const sum = (rows: ProductData[], f: keyof ProductData) =>
        String(rows.reduce((s, r) => s + toNum(r[f] as string), 0));
      // 明細1行ごとに「単価 × 入数 × 計画函数」を求めて合算する（値入率の加重平均用）
      const sumPerBox = (
        rows: ProductData[],
        unitOf: (r: ProductData) => number
      ) =>
        String(
          rows.reduce(
            (s, r) => s + unitOf(r) * toNum(r.quantity) * toNum(r.plan),
            0
          )
        );
      // グループ内で最初に値を持つ行の値を代表値として採用
      const pick = (rows: ProductData[], f: keyof ProductData) => {
        const found = rows.find(
          (r) => r[f] != null && String(r[f]).trim() !== ''
        );
        return found ? String(found[f]) : '';
      };
      const result: ProductData[] = [];
      let seq = 1;
      groups.forEach((rows) => {
        const i = seq - 1; // 0-based グループ番号（ダミー率の変化用）
        const campaign = rows[0].campaign || '（未設定）';
        result.push({
          id: String(seq++),
          campaign,
          campaignName: pick(rows, 'campaignName'),
          probability: rows[0].probability || '',
          targetMonth: pick(rows, 'targetMonth'),
          section: rows[0].section,
          summary1: pick(rows, 'summary1'),
          metaBrand: pick(rows, 'metaBrand'),
          containerCapacityG: pick(rows, 'containerCapacityG'),
          summaryProduct: pick(rows, 'summaryProduct'),
          // 一般卸メッシュは卸のみ対象のため量販では空欄
          wholesaleMesh: '',
          productCategory: pick(rows, 'productCategory'),
          promotion: pick(rows, 'promotion'),
          delivery: pick(rows, 'delivery'),
          production: pick(rows, 'production'),
          quantity: sum(rows, 'quantity'),
          plan: sum(rows, 'plan'),
          net: sum(rows, 'net'),
          planPrice: sum(rows, 'planPrice'),
          price: sum(rows, 'price'),
          margin: '',
          // 値引率は単純合算できないため代表値（なければダミー値）を表示
          discount: pick(rows, 'discount') || `${(20 + (i % 6)).toFixed(2)}%`,
          managementProfitAmount: sum(rows, 'managementProfitAmount'),
          // 管理利益率は代表値（なければダミー値）を表示
          managementProfitRate:
            pick(rows, 'managementProfitRate') ||
            `${(18 + (i % 5)).toFixed(2)}%`,
          netSales: sum(rows, 'netSales'),
          externalSales: sum(rows, 'externalSales'),
          // 値入率の加重平均用（合計行で Σ値入額 ÷ Σ売価金額 × 100 を算出する）
          _markupAmount: sumPerBox(
            rows,
            (r) => toNum(r.price) - toNum(r.planPrice)
          ),
          _retailAmount: sumPerBox(rows, (r) => toNum(r.price)),
          exp1PlannedAmount: sum(rows, 'exp1PlannedAmount'),
          exp1PostingMonth: '',
          exp1ManagementCode: '',
          exp1AccountItem: '',
          exp1ManagementClass: '',
          exp1Description: '',
          exp2PlannedAmount: sum(rows, 'exp2PlannedAmount'),
          exp2PostingMonth: '',
          exp2ManagementCode: '',
          exp2AccountItem: '',
          exp2ManagementClass: '',
          exp2Description: '',
        });
      });
      return result;
    };

    // 企画単位集計データを集計表へ通知（明細データ・集計の対象期間の変更時のみ実行）
    useEffect(() => {
      onCampaignDataChange?.(buildCampaignSummary());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aggregationPeriodData]);

    // 区分タブの絞り込み
    const [activeTab, setActiveTab] = useState<string>('all');
    // 表示中のタブで商品区分を変更した行。変更直後に行が消えると利用者が混乱するため、
    // 別の商品区分タブへ切り替えるまでは表示中のタブに残し、切替時に変更後のタブへ移す。
    const [heldRowKeys, setHeldRowKeys] = useState<Set<string>>(
      () => new Set()
    );
    const switchTab = useCallback((tab: string) => {
      setHeldRowKeys(new Set());
      setActiveTab(tab);
    }, []);

    // 詳細の対象期間変更の確認（未保存の入力の破棄を確認してから反映）
    const [pendingPeriodApply, setPendingPeriodApply] = useState<
      (() => void) | null
    >(null);

    // 参照用下ペイン（自計画を参照し、コピーで明細へ行追加）
    const [isReferencePaneShown, setIsReferencePaneShown] = useState(false);
    // 明細グリッドの API
    const mainGridApiRef = useRef<GridApi | null>(null);

    // ── 新規行（コピー）の強調表示 ──
    // 行追加は state 更新のため、追加直後はまだグリッドに行が無い。markRows で行IDを記録し、
    // グリッドの onRowDataUpdated（＝行が反映された後）で可視域へ送り、行全体をフラッシュして
    // 先頭セルへフォーカスを移す（下ペイン表示中のページ側のスクロールも共通フックが行う）。
    const reveal = useRevealNewRows({ focusColumn: REVEAL_FOCUS_COLUMN });

    // 明細グリッドのコンテナ（コピー元ペインを開いた際、グリッドヘッダーを
    // ヘッダーメニュー直下へスクロールするための参照）
    const gridContainerRef = useRef<HTMLDivElement>(null);

    // コピー元ペインを開いたら、明細グリッドのヘッダーがヘッダーメニュー（画面上端）の
    // 真下に来るようにスクロールする。ペイン展開のレイアウトが確定してから実行する。
    // ※ scrollIntoView は main／ドキュメントまでスクロールして sticky ヘッダーの表示を
    //   乱すため使わず、画面内のスクロール領域（最も近いスクロール可能な祖先）だけを動かす。
    useEffect(() => {
      if (!isReferencePaneShown) return;
      const id = window.setTimeout(() => {
        const gridEl = gridContainerRef.current;
        if (!gridEl) return;
        let scroller: HTMLElement | null = gridEl.parentElement;
        while (scroller) {
          const overflowY = window.getComputedStyle(scroller).overflowY;
          if (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            scroller.scrollHeight > scroller.clientHeight
          ) {
            break;
          }
          scroller = scroller.parentElement;
        }
        if (!scroller) return;
        const delta =
          gridEl.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top;
        scroller.scrollBy({ top: delta, behavior: 'smooth' });
      }, 350);
      return () => window.clearTimeout(id);
    }, [isReferencePaneShown]);

    // 「反映済を除く」フィルター（デフォルトON）
    const [shouldExcludeReflected, setShouldExcludeReflected] = useState(true);

    // 「不採用を除く」フィルター（デフォルトON）
    const [shouldExcludeRejected, setShouldExcludeRejected] = useState(true);

    // 連動セル（拡売費の管理区分⇔管理コード／施策区分⇔施策コード）の Undo/Redo を、
    // 主セル1回で従属セルごと一括・厳密に戻す共通フック（→ 02 §7.3）。
    const { makeHandler: makeLinkedHandler, clearCache: clearLinkedCache } =
      useLinkedCellUndo<ProductData>();

    // グリッド再構築トークン。セル編集（AG Grid が node.data を直接更新済み）以外の
    // 値更新（明細編集ペイン・ギフトセット更新・保存・未保存入力の破棄など）は、行の構造が
    // 変わらず rowStructureSignature が変化しないため、このトークンを進めて rowData を
    // 明示的に作り直し、状態の新値をグリッドへ反映する（→ 02 §7.1）。
    // ※作り直しで rowData 参照が変わり Undo 履歴はクリアされるが、これらは意図的な
    //   一括・ペイン操作のため許容する（セル編集の Undo は維持される）。
    const [gridRebuildToken, setGridRebuildToken] = useState(0);
    const bumpGridRebuild = useCallback(() => {
      // 作り直し（保存確定を含む）で行の値が入れ替わるため、連動セルのキャッシュも破棄する。
      clearLinkedCache();
      setGridRebuildToken((t) => t + 1);
    }, [clearLinkedCache]);

    // 行の追加
    const handleAddRow = useCallback(
      (section: string) => {
        if (onOpenAddDetail) {
          onOpenAddDetail(section);
        }
      },
      [onOpenAddDetail]
    );

    // 削除ボタンのクリック
    const handleDeleteClick = useCallback(
      (data: ProductData) => {
        if (onOpenDeleteDetail) {
          onOpenDeleteDetail(data);
        }
      },
      [onOpenDeleteDetail]
    );

    // 企画名の連動：同じ対象年月・同じ企画の明細すべて（フィルタで非表示の明細・反映済・不採用も含む）へ反映する。
    const handleSyncCampaignName = useCallback(
      (targetMonth: string, campaign: string, campaignName: string) => {
        if (!campaign) return;
        const isSameCampaign = (row: ProductData) =>
          row.targetMonth === targetMonth && row.campaign === campaign;
        const applyName = (prev: ProductData[]) =>
          prev.map((row) =>
            isSameCampaign(row) && row.campaignName !== campaignName
              ? { ...row, campaignName }
              : row
          );
        setRegularProductsData(applyName);
        setNewProductsData(applyName);
        setPromotionProductsData(applyName);
        setGiftProductsData(applyName);
        // rowData は値編集で作り直さないため、表示中の行は公式の updateData で更新する（→ 02 §7.1）
        mainGridApiRef.current?.forEachNode((node) => {
          if (node.data && isSameCampaign(node.data)) {
            node.updateData({ ...node.data, campaignName });
          }
        });
      },
      []
    );

    // 行のコピー
    const handleCopyRow = useCallback(
      (data: ProductData) => {
        // 行データを複製する
        const copiedData: ProductData = {
          ...data,
          // コピー行には一意な id を再採番（getRowId 衝突・編集時の源行巻き込みを防止）
          id: `copy-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          // 挿入順を採番。商品区分によらず表示時は合計行直下（先頭）へ並ぶ
          _addedSeq: Date.now(),
          // 計画キーはコピー元から引き継ぐ（同一計画の明細として確定排他の対象になる）。
          // 元行（_planKey 無し）からのコピーは元行 id を計画キーとして共有する。
          _planKey:
            data._planKey ??
            (data.id != null
              ? `id:${data.id}`
              : `plan-${Date.now()}-${Math.floor(Math.random() * 1e6)}`),
          // 拡売費①②はコピー元（明細追加/コピーフォームの入力値）をそのまま引き継ぐ。
          // 参照ペインからのコピーのみ handleReferenceCopyRow 側で空にする。
          // 追加・コピーで作られた行の作成者はログインユーザー（コピー元の作成者は引き継がない）。
          exp1Creator: CURRENT_USER_NAME,
          exp2Creator: CURRENT_USER_NAME,
        };

        // コピーした行を強調対象にする（行が反映された後に強調される）
        reveal.markRows([String(copiedData.id)]);

        // 編集ルーティング維持のため行は商品区分ごとの配列へ格納する（表示順は
        // rowData 側で _addedSeq により合計行直下へ並べ替える）。
        if (data.section === '定番商品') {
          setRegularProductsData((prev) => [copiedData, ...prev]);
        } else if (data.section === '新商品') {
          setNewProductsData((prev) => [copiedData, ...prev]);
        } else if (data.section === '特殊商品') {
          setPromotionProductsData((prev) => [copiedData, ...prev]);
        } else if (data.section === 'ギフト') {
          setGiftProductsData((prev) => [copiedData, ...prev]);
        }
      },
      [reveal]
    );

    // 参照表からのコピー：
    // ・企画／企画名／確度は未選択（空＝「ー」表示）
    // ・計画函数／NET／納価／売価／マージン率の変更後は 0
    //   （変更前との差分が増減に +/▲ 表示される）
    //   ※変更前（基準値）は参照値としてそのまま引き継ぐ
    // ・拡売費①②はすべて空（「ー」表示）にする。ただし計上年月は詳細の対象期間 from の翌月を設定する
    // ・参照表は詳細の対象期間内の明細だけを表示するため、対象年月はそのまま引き継ぐ
    const handleReferenceCopyRow = useCallback(
      (data: ProductData) => {
        const postingMonth = addMonths(targetPeriodFrom, 1);
        handleCopyRow({
          ...data,
          campaign: '',
          campaignName: '',
          probability: '',
          plan: '0',
          net: '0',
          planPrice: '0',
          price: '0',
          margin: '0',
          ...EMPTY_EXPENSE_FIELDS,
          exp1PostingMonth: postingMonth,
          exp2PostingMonth: postingMonth,
          _copySource: 'reference',
        });
        toast.success('参照表からコピーしました。');
      },
      [handleCopyRow, targetPeriodFrom]
    );

    // ギフト：上旬/中旬/下旬の3行を1セットとして追加（plans=各期間の箱数=計画函数）。
    const handleAddGiftSet = useCallback(
      (base: Partial<ProductData>, plans: [string, string, string]) => {
        const seq = Date.now();
        const newId = newGiftSetId();
        // 追加したセット（3行）は1計画として同じ計画キーを共有する。
        const planKey = `plan-new-${seq}-${Math.floor(Math.random() * 1e6)}`;
        const rows: ProductData[] = GIFT_PERIOD_ORDER.map((period, i) =>
          initSimRow({
            ...makeEmptyProduct('ギフト'),
            ...base,
            section: 'ギフト',
            productCategory: 'ギフト',
            giftSetId: newId,
            period,
            plan: plans[i] ?? '0',
            id: `new-${seq}-${i}`,
            // 追加した行の作成者はログインユーザー
            exp1Creator: CURRENT_USER_NAME,
            exp2Creator: CURRENT_USER_NAME,
            _addedSeq: seq,
            _planKey: planKey,
            _copySource: 'new',
          } as ProductData)
        );
        setGiftProductsData((prev) => [...rows, ...prev]);
      },
      []
    );

    // ギフト：セットをまるごと複製して新規セット（3行）を追加（コピー由来）。
    // handleAddGiftSet と同一だが、id と追加経路（カラーバー）をコピー扱いにする。
    const handleAddCopiedGiftSet = useCallback(
      (base: Partial<ProductData>, plans: [string, string, string]) => {
        const seq = Date.now();
        const newId = newGiftSetId();
        // 追加したセット（3行）は1計画として同じ計画キーを共有する。
        // コピー由来のため接頭辞は plan-copy-（Sim卸 handleAddCopiedGiftSet と統一）。
        const planKey = `plan-copy-${seq}-${Math.floor(Math.random() * 1e6)}`;
        const rows: ProductData[] = GIFT_PERIOD_ORDER.map((period, i) =>
          initSimRow({
            ...makeEmptyProduct('ギフト'),
            ...base,
            section: 'ギフト',
            productCategory: 'ギフト',
            giftSetId: newId,
            period,
            plan: plans[i] ?? '0',
            id: `copy-${seq}-${i}`,
            // コピーで作られた行の作成者はログインユーザー
            exp1Creator: CURRENT_USER_NAME,
            exp2Creator: CURRENT_USER_NAME,
            _addedSeq: seq,
            _planKey: planKey,
            _copySource: 'detail' as const,
          } as ProductData)
        );
        // コピーした3行（上旬/中旬/下旬）すべてを強調対象にする
        reveal.markRows(rows.map((r) => String(r.id)));
        setGiftProductsData((prev) => [...rows, ...prev]);
      },
      [reveal]
    );

    // ギフト：セットの共通項目・各期間の計画(箱数)を更新。
    const handleUpdateGiftSet = useCallback(
      (
        giftSetId: string,
        base: Partial<ProductData>,
        plans: [string, string, string]
      ) => {
        setGiftProductsData((prev) =>
          prev.map((r) => {
            if (r.giftSetId !== giftSetId) return r;
            const idx = giftPeriodIndex(r.period);
            const plan = plans[idx] ?? r.plan;
            const merged = {
              ...r,
              ...base,
              section: 'ギフト',
              productCategory: 'ギフト',
              giftSetId,
              period: r.period,
              plan,
            } as ProductData;
            // 納価・NET・売価・函数の変更に合わせて算出列（マージン率・値入率・
            // 社外売上高・管理利益など）を再計算する（セル編集時と同一の算出）。
            computeDerived(merged);
            return merged;
          })
        );
        // セル編集を通らない値更新のため rowData を作り直して新値を反映する。
        bumpGridRebuild();
      },
      [bumpGridRebuild]
    );

    // ギフト：セットの現在値を取得（編集ペインの初期表示用）。
    const getGiftSet = useCallback(
      (
        giftSetId: string
      ): { base: ProductData; plans: [string, string, string] } | null => {
        const rows = giftProductsData
          .filter((r) => r.giftSetId === giftSetId)
          .sort(
            (a, b) => giftPeriodIndex(a.period) - giftPeriodIndex(b.period)
          );
        if (rows.length === 0) return null;
        return {
          base: rows[0],
          plans: [
            rows[0]?.plan ?? '',
            rows[1]?.plan ?? '',
            rows[2]?.plan ?? '',
          ],
        };
      },
      [giftProductsData]
    );

    // 親から ref 経由で addCopiedRow を呼べるようにする
    useImperativeHandle(ref, () => ({
      addCopiedRow: (data: ProductData) => {
        handleCopyRow({ ...data, _copySource: 'detail' });
      },
      addNewRow: (overrides: Partial<ProductData> & { section: string }) => {
        const { section } = overrides;
        const list =
          section === '定番商品'
            ? regularProductsData
            : section === '新商品'
              ? newProductsData
              : section === '特殊商品'
                ? promotionProductsData
                : giftProductsData;
        const base =
          list[0] ??
          regularProductsData[0] ??
          newProductsData[0] ??
          promotionProductsData[0] ??
          giftProductsData[0];
        if (!base) return;
        handleCopyRow({
          ...base,
          // テンプレ行の拡売費は引き継がず一旦空に（フォーム入力があれば overrides で上書き）
          ...EMPTY_EXPENSE_FIELDS,
          // 新規行は確度・企画を空にする（テンプレ行が反映済/不採用でも
          // 「反映済/不採用を除く」フィルタで消えず、合計行直下に表示されるように）
          probability: '',
          campaign: '',
          campaignName: '',
          // 明細追加は新しい計画として扱う（テンプレ行 base の計画キーを引き継がない）
          _planKey: `plan-new-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          ...overrides,
          // base から引き継ぐ古い値を上書きするため末尾で 'new' を設定
          _copySource: 'new',
        } as ProductData);
      },
      updateRow: (data: ProductData) => {
        const upd = (prev: ProductData[]) =>
          prev.map((item) =>
            item.id === data.id ? { ...item, ...data } : item
          );
        setRegularProductsData(upd);
        setNewProductsData(upd);
        setPromotionProductsData(upd);
        setGiftProductsData(upd);
        // 明細編集ペインの更新はセル編集を通らず node.data が未更新のため、rowData を作り直す。
        bumpGridRebuild();
      },
      // 明細削除：ギフトはセット単位（giftSetId）、その他は一意な id で除去
      deleteRow: (target: ProductData | ProductData['id']) => {
        const row =
          target != null && typeof target === 'object' ? target : null;
        if (row?.section === 'ギフト' && row.giftSetId) {
          setGiftProductsData((prev) =>
            prev.filter((item) => item.giftSetId !== row.giftSetId)
          );
          return;
        }
        const id = row ? row.id : target;
        if (id == null) return;
        const del = (prev: ProductData[]) =>
          prev.filter((item) => item.id !== id);
        setRegularProductsData(del);
        setNewProductsData(del);
        setPromotionProductsData(del);
        setGiftProductsData(del);
      },
      addGiftSet: handleAddGiftSet,
      syncCampaignName: handleSyncCampaignName,
      addCopiedGiftSet: handleAddCopiedGiftSet,
      updateGiftSet: handleUpdateGiftSet,
      getGiftSet,
      // 保存時：帯（_copySource）と編集セルの黄色強調を消し、保存した値を新たな元値とする
      clearSavedMarks: () => {
        const saved = {
          regular: stripCopySource(regularProductsData),
          new: stripCopySource(newProductsData),
          promotion: stripCopySource(promotionProductsData),
          gift: stripCopySource(giftProductsData),
        };
        savedRowsRef.current = saved;
        setRegularProductsData(saved.regular);
        setNewProductsData(saved.new);
        setPromotionProductsData(saved.promotion);
        setGiftProductsData(saved.gift);
        resetChangedCells();
        // 保存した値（帯の除去を含む）はセル編集を通らないため、rowData を作り直す。
        bumpGridRebuild();
        setTimeout(
          () => mainGridApiRef.current?.refreshCells({ force: true }),
          0
        );
      },
    }));

    // 明細コピー：ペインを開かず、明細グリッドへ直接行を複製する。
    // ギフトは上旬/中旬/下旬の3行を1セットとしてまとめて複製する。
    const handleCopyClick = useCallback(
      (data: ProductData) => {
        if (data.section === 'ギフト' && data.giftSetId) {
          const set = getGiftSet(data.giftSetId);
          if (set) {
            handleAddCopiedGiftSet(set.base, set.plans);
            toast.success('明細をコピーしました。');
            return;
          }
        }
        handleCopyRow({ ...data, _copySource: 'detail' });
        toast.success('明細をコピーしました。');
      },
      [getGiftSet, handleAddCopiedGiftSet, handleCopyRow]
    );

    // 経費対象（expTarget）のチェックの更新
    const handleUpdateRegularProduct = useCallback(
      (updatedData: ProductData) => {
        setRegularProductsData((prev) =>
          prev.map((item) => (item.id === updatedData.id ? updatedData : item))
        );
      },
      []
    );

    const handleUpdateNewProduct = useCallback((updatedData: ProductData) => {
      setNewProductsData((prev) =>
        prev.map((item) => (item.id === updatedData.id ? updatedData : item))
      );
    }, []);

    const handleUpdatePromotionProduct = useCallback(
      (updatedData: ProductData) => {
        setPromotionProductsData((prev) =>
          prev.map((item) => (item.id === updatedData.id ? updatedData : item))
        );
      },
      []
    );

    const handleUpdateGiftProduct = useCallback((updatedData: ProductData) => {
      setGiftProductsData((prev) =>
        prev.map((item) => (item.id === updatedData.id ? updatedData : item))
      );
    }, []);

    // 商品区分の変更（グリッド内のセル編集）。
    // タブ振り分けに使う section・販促区分を連動させ、ギフト⇄他区分では
    // 販売期間の 1行⇔3行（上旬・中旬・下旬）を組み替える。
    // サマリ商品名など既に選択済みの商品情報は変更しない。
    const handleChangeProductCategory = useCallback(
      (data: ProductData, newCategory: string) => {
        // ギフトは3行1セットのためセット全行を変更対象にする。
        const sourceRows =
          data.section === 'ギフト' && data.giftSetId
            ? giftProductsData.filter((r) => r.giftSetId === data.giftSetId)
            : [data];
        const seq = Date.now();
        // 商品区分「特売」はセクション名「特殊商品」へ読み替える。
        const newSection = categoryToSection(newCategory);
        const rows = buildCategoryChangeRows(sourceRows, newCategory, {
          newGiftSetId,
          newRowId: (i) => `new-${seq}-${i}`,
          section: newSection,
          // 計画函数は変更前／変更後とも販売期間ごとの値のため合算・分配の対象にする
          periodFields: ['plan', 'planBefore', 'planAfter'],
        });
        if (rows.length === 0) return;
        const removedIds = new Set(sourceRows.map((r) => r.id));
        // 変更前のセクションの配列から取り除き、変更後のセクションの配列へ入れ替える。
        const replaceIn =
          (section: string) =>
          (prev: ProductData[]): ProductData[] => {
            const kept = prev.filter((r) => !removedIds.has(r.id));
            return newSection === section ? [...kept, ...rows] : kept;
          };
        setRegularProductsData(replaceIn('定番商品'));
        setNewProductsData(replaceIn('新商品'));
        setPromotionProductsData(replaceIn('特殊商品'));
        setGiftProductsData(replaceIn('ギフト'));
        // 「全て」以外のタブでは、別タブへ切り替えるまで変更した行を表示中のタブに残す
        if (activeTab !== 'all') {
          setHeldRowKeys((prev) => {
            const next = new Set(prev);
            rows.forEach((r) => next.add(heldRowKeyOf(r)));
            return next;
          });
        }
      },
      [giftProductsData, activeTab]
    );

    // 編集セルの変更ハイライト（黄＋オレンジ枠）：共通フックで変更セル・元値を追跡する（→ 02 §7.2）。
    // 元値に戻したら強調を解除する。色付けは各列の cellStyle で isCellChanged を見て行う。
    const { isCellChanged, trackCellChange, resetChangedCells } =
      useChangedCells();
    // 未保存の入力を破棄し、保存済みの明細へ戻す（詳細の対象期間の変更時）。
    // 編集セルの強調と、商品区分の変更でタブに残している行も解除する。
    const discardUnsavedEdits = () => {
      const saved = savedRowsRef.current;
      setRegularProductsData(saved.regular);
      setNewProductsData(saved.new);
      setPromotionProductsData(saved.promotion);
      setGiftProductsData(saved.gift);
      setHeldRowKeys(new Set());
      resetChangedCells();
      // 保存済みの明細へ戻す値はセル編集を通らないため、rowData を作り直す。
      bumpGridRebuild();
      setTimeout(
        () => mainGridApiRef.current?.refreshCells({ force: true }),
        0
      );
    };

    // 詳細の対象期間の変更を確認ダイアログへ回す（同じ値の再選択は何もしない）
    const requestPeriodChange = (
      current: string,
      next: string,
      apply: (value: string) => void
    ) => {
      if (next === current) return;
      setPendingPeriodApply(() => () => {
        discardUnsavedEdits();
        apply(next);
      });
    };

    // Yellow: 手入力可能セル
    const yellowCellStyle = (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return undefined;
      // 確度が「反映済」「不採用」の場合はグレーアウト
      const probability = params.data?.probability;
      if (probability === '反映済') {
        return {
          backgroundColor: GRID_COLORS.readonly,
          cursor: 'pointer',
        };
      }
      if (probability === '不採用') {
        return {
          backgroundColor: REJECTED_BG,
          cursor: 'pointer',
        };
      }
      // 編集済みセルは黄色＋オレンジ枠で強調（gridStyles.ts 準拠）
      if (isCellChanged(params)) {
        return { ...changedCellStyle(), cursor: 'pointer' };
      }
      return { backgroundColor: GRID_COLORS.editable, cursor: 'pointer' };
    };

    // Yellow with red text for negative values (拡売費①、②用)
    const yellowCellStyleWithRedNegative = (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return undefined;
      // 確度が「反映済」「不採用」の場合はグレーアウト
      const probability = params.data?.probability;
      const value = parseFloat(String(params.value || '').replace(/,/g, ''));
      const isNegative = !isNaN(value) && value < 0;

      if (probability === '反映済') {
        return {
          backgroundColor: GRID_COLORS.readonly,
          cursor: 'pointer',
          ...(isNegative && { color: GRID_COLORS.overText }),
        };
      }
      if (probability === '不採用') {
        return {
          backgroundColor: REJECTED_BG,
          cursor: 'pointer',
          ...(isNegative && { color: GRID_COLORS.overText }),
        };
      }
      // 編集済みセルは黄色＋オレンジ枠で強調（マイナスは赤字を維持）
      if (isCellChanged(params)) {
        return {
          ...changedCellStyle(),
          cursor: 'pointer',
          ...(isNegative && { color: GRID_COLORS.overText }),
        };
      }
      if (isNegative) {
        return {
          backgroundColor: GRID_COLORS.editable,
          cursor: 'pointer',
          color: GRID_COLORS.overText,
        };
      }
      return { backgroundColor: GRID_COLORS.editable, cursor: 'pointer' };
    };

    // White: 自動表示・参照セル
    const whiteCellStyle = (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return undefined;
      // 確度が「反映済」「不採用」の場合はグレーアウト
      const probability = params.data?.probability;
      if (probability === '反映済') {
        return { backgroundColor: GRID_COLORS.readonly };
      }
      if (probability === '不採用') {
        return { backgroundColor: REJECTED_BG };
      }
      return { backgroundColor: GRID_COLORS.readonly };
    };

    // 白背景・マイナス値は赤字
    const whiteCellStyleWithRedNegative = (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return undefined;
      // 確度が「反映済」「不採用」の場合はグレーアウト
      const probability = params.data?.probability;
      const value = parseFloat(String(params.value || '').replace(/,/g, ''));
      const isNegative = !isNaN(value) && value < 0;

      if (probability === '反映済') {
        return {
          backgroundColor: GRID_COLORS.readonly,
          ...(isNegative && { color: GRID_COLORS.overText }),
        };
      }
      if (probability === '不採用') {
        return {
          backgroundColor: REJECTED_BG,
          ...(isNegative && { color: GRID_COLORS.overText }),
        };
      }
      if (isNegative) {
        return {
          backgroundColor: GRID_COLORS.readonly,
          color: GRID_COLORS.overText,
        };
      }
      return { backgroundColor: GRID_COLORS.readonly };
    };

    // 商品区分ごとに背景色を切り替え、マイナス値は赤字にするファクトリ
    const makeCellStyleWithRedNegative =
      (
        rules: Record<string, 'yellow' | 'white' | 'gray'>,
        defaultStyle: 'yellow' | 'white' | 'gray' = 'white'
      ) =>
      (params: any) => {
        if (params.data?._isHeader || params.node?.rowPinned) return undefined;

        // 確度が「反映済」「不採用」の場合はグレーアウト
        const probability = params.data?.probability;
        const value = parseFloat(String(params.value || '').replace(/,/g, ''));
        const isNegative = !isNaN(value) && value < 0;

        if (probability === '反映済') {
          return {
            backgroundColor: GRID_COLORS.readonly,
            cursor: 'pointer',
            ...(isNegative && { color: GRID_COLORS.overText }),
          };
        }
        if (probability === '不採用') {
          return {
            backgroundColor: REJECTED_BG,
            cursor: 'pointer',
            ...(isNegative && { color: GRID_COLORS.overText }),
          };
        }

        const cat: string = params.data?.productCategory ?? '';
        const style = rules[cat] ?? defaultStyle;

        if (style === 'yellow') {
          // 編集済みセルは黄色＋オレンジ枠で強調（マイナスは赤字を維持）
          if (isCellChanged(params)) {
            return {
              ...changedCellStyle(),
              cursor: 'pointer',
              ...(isNegative && { color: GRID_COLORS.overText }),
            };
          }
          return {
            backgroundColor: GRID_COLORS.editable,
            cursor: 'pointer',
            ...(isNegative && { color: GRID_COLORS.overText }),
          };
        }
        if (style === 'gray')
          return {
            backgroundColor: GRID_COLORS.readonly,
            ...(isNegative && { color: GRID_COLORS.overText }),
          };
        return {
          backgroundColor: GRID_COLORS.readonly,
          ...(isNegative && { color: GRID_COLORS.overText }),
        };
      };

    // 指定商品区分のみ編集可能にするファクトリ
    // 確度が「反映済」の行は編集不可（プルダウン非活性）
    const isReflectedRow = (params: any) =>
      params.data?.probability === '反映済';

    // ヘッダー行・合計行・反映済行は編集不可、それ以外は編集可
    const baseEditable = (params: any) =>
      !params.data?._isHeader &&
      !params.node?.rowPinned &&
      !isReflectedRow(params);

    // ヘッダー/合計行以外は全て編集可（売価・マージン率の既存ルールに準拠）
    const allEditable = (params: any) =>
      !params.data?._isHeader && !params.node?.rowPinned;

    // ===== 変更前 / 変更後 / 増減 比較 ヘルパー =====
    // 文字列→数値（カンマ・%除去）。空は NaN。
    const parseMetric = (str?: string) => {
      if (str === undefined || str === null || String(str).trim() === '')
        return NaN;
      const n = parseFloat(String(str).replace(/[,%]/g, ''));
      return isNaN(n) ? NaN : n;
    };
    // 数値→文字列。digits を渡した項目は項目一覧の桁数へ四捨五入して保持する。
    // 省略時は従来どおり整数はそのまま／小数は2桁で表示する。
    const formatMetric = (num: number, isPercent: boolean, digits?: number) => {
      if (!isFinite(num)) return '';
      if (digits !== undefined)
        return isPercent
          ? formatPlanRate(num, digits)
          : roundPlanNumber(num, digits);
      const s = Number.isInteger(num) ? String(num) : num.toFixed(2);
      return isPercent ? `${s}%` : s;
    };
    // 増減の表記（+N／▲N／0）を項目一覧の桁数で作る。
    // 共通の formatDelta は桁数指定を持たないため、桁指定がある項目のみ本関数で整形する。
    const formatMetricDelta = (
      num: number,
      isPercent: boolean,
      digits?: number
    ) => {
      if (digits === undefined) return formatDelta(num, isPercent);
      if (!isFinite(num)) return '';
      const abs = Math.abs(num);
      const body = isPercent
        ? formatPlanRate(abs, digits)
        : formatPlanAmount(abs, digits);
      if (num > 0) return `+${body}`;
      if (num < 0) return `▲${body}`;
      return body;
    };
    // section に応じた state 同期（連動セルの共通フックの syncState 用）。
    // フックが node.data 更新・行の再描画を済ませるため state だけを更新し、rowData は作り直さない（→ 02 §7.1）。
    const syncRowState = (row: ProductData) => {
      if (row.section === '定番商品') handleUpdateRegularProduct(row);
      else if (row.section === '新商品') handleUpdateNewProduct(row);
      else if (row.section === '特殊商品') handleUpdatePromotionProduct(row);
      else if (row.section === 'ギフト') handleUpdateGiftProduct(row);
    };
    // section に応じた更新（4分岐の一本化）
    const routeUpdate = (params: any, updatedData: ProductData) => {
      // rowData は値編集で作り直さない（Undo 履歴を維持する → 02 §7.1）ため、当該ノードの
      // data を直接更新し行内の全セル（増減・マージン率などの算出列）を再描画する。
      Object.assign(params.data, updatedData);
      params.api?.refreshCells({ rowNodes: [params.node], force: true });
      const s = params.data?.section;
      if (s === '定番商品') params.context.updateRegularProduct(updatedData);
      else if (s === '新商品') params.context.updateNewProduct(updatedData);
      else if (s === '特殊商品')
        params.context.updatePromotionProduct(updatedData);
      else if (s === 'ギフト') params.context.updateGiftProduct(updatedData);
    };
    // 変更後セル：入力値をそのまま変更後の値にする（符号を付けた相対入力は行わない）
    const makeAfterSetter =
      (field: string, isPercent: boolean, digits?: number) => (params: any) => {
        const raw = String(params.newValue ?? '').trim();
        if (raw === '') {
          params.data[field] = '';
          return true;
        }
        const after = parseMetric(raw);
        if (isNaN(after)) return false;
        params.data[field] = formatMetric(after, isPercent, digits);
        return true;
      };
    // 増減の基準（変更前）。計画函数は空欄なら0として扱う（10/27 第4回 決定事項21）。
    // 空欄＝元の計画に無い明細のため、変更後がそのまま「+」の増減になる。
    // NET・納価・売価は従来どおり（どちらかが空なら増減も空欄）。
    const deltaBaseOf = (field: string, data: any): number => {
      const before = parseMetric(data?.[`${field}Before`]);
      return field === 'plan' && isNaN(before) ? 0 : before;
    };
    // 増減 = 変更後 − 変更前（保存せず都度算出）
    const makeDeltaGetter =
      (field: string, isPercent: boolean, digits?: number) => (params: any) => {
        if (params.data?._isHeader) return '';
        // 合計行（ピン留め）も「変更後合計 − 変更前合計」で増減合計を算出
        const before = deltaBaseOf(field, params.data);
        const after = parseMetric(params.data?.[field]);
        if (isNaN(before) || isNaN(after)) return '';
        const dv = after - before;
        // プラス＝+N／マイナス＝▲N／ゼロ＝0（共通ユーティリティ formatDelta）
        return formatMetricDelta(dv, isPercent, digits);
      };
    // 増減セルのスタイル（編集可=黄／不可=灰、増加=青字／減少=赤字）
    const deltaCellStyle =
      (editableFn: (p: any) => boolean) => (params: any) => {
        if (params.data?._isHeader) return undefined;
        const probability = params.data?.probability;
        // 増減の文字色（増加＝青字／減少＝赤字）は共通ユーティリティで判定
        const deltaColor = deltaTextColor(params.value);
        // 合計行（ピン留め）：背景は行スタイル(total)に任せ、増減の文字色のみ付与
        if (params.node?.rowPinned)
          return deltaColor ? { color: deltaColor } : undefined;
        if (probability === '反映済')
          return {
            backgroundColor: GRID_COLORS.readonly,
            ...(deltaColor && { color: deltaColor }),
          };
        if (probability === '不採用')
          return {
            backgroundColor: REJECTED_BG,
            ...(deltaColor && { color: deltaColor }),
          };
        const editable = editableFn(params);
        return {
          backgroundColor: editable
            ? GRID_COLORS.editable
            : GRID_COLORS.readonly,
          ...(editable && { cursor: 'pointer' }),
          ...(deltaColor && { color: deltaColor }),
        };
      };
    // 変更後セル：基本スタイル＋変更時ハイライト（changedCellStyle）
    const makeAfterStyle =
      (field: string, baseStyle: (p: any) => any) => (params: any) => {
        const base = baseStyle(params) || {};
        if (params.data?._isHeader || params.node?.rowPinned) return base;
        if (isReflectedRow(params)) return base;
        const before = parseMetric(params.data?.[`${field}Before`]);
        const after = parseMetric(params.data?.[field]);
        if (!isNaN(before) && !isNaN(after) && before !== after) {
          return { ...base, ...changedCellStyle() };
        }
        return base;
      };
    // 固定マージン率モード：納価（変更後）から NET・マージン率（変更後）を再計算する。
    // NET = 納価 − 納価 × マージン率(固定＝変更前) ÷ 100、マージン率 = (納価−NET)/納価 × 100。
    // 算出列を販売計画表（補足2-1/補足3-1）と同様に動的算出する。
    //   NET      = 納価 − 納価 × マージン率/100（固定マージン率）
    //   マージン率 = (納価 − NET) / 納価 × 100
    //   値入率    = (売価 − 納価) / 売価 × 100
    //   社外売上高 = 売価 × 入数 × 函数 ／ 売上高 = NET × 入数 × 函数
    //   管理利益額 = 売上高 − 拡売費(①+②) ／ 管理利益率 = 管理利益額/売上高×100
    // 算出は補足2-1 パターン対応の共通 computeDerived（モジュール）へ委譲。
    const recomputeDerived = (data: any) => computeDerived(data);
    // 1指標 → 変更前/変更後/増減 の子列を生成
    const makeComparisonChildren = (m: {
      field: string;
      width: number;
      isPercent: boolean;
      // 項目一覧の小数桁（NET・納価=2／売価=0）。変更前・変更後・増減で共通に使う。
      decimals?: number;
      editable: (p: any) => boolean;
      afterStyle: (p: any) => any;
      childSuffix?: string;
      // 変更後が算出値（入力不可）か。NET・マージン率は固定マージン率から算出する。
      computed?: boolean;
      // 変更後セル編集後の追加処理（納価変更時に NET・マージン率を再計算）。
      onAfterCellChange?: (p: any) => void;
      // 変更後セルの valueSetter を差し替える（納価の同一値制御などに使用）。
      afterValueSetter?: (p: any) => boolean;
      // ギフト3行1セットで結合対象外にするか（計画函数は期間ごとに値が異なるため true）。
      unmerge?: boolean;
      // 変更後セルを整数のみ入力可にする（計画函数・売価）。
      integerOnly?: boolean;
    }): ColDef[] => {
      const suffix = m.childSuffix ?? '';
      // ギフト結合対象外の指標は各行で表示（rowSpan を常に1で上書き）。
      const rowSpanOverride = m.unmerge ? { rowSpan: () => 1 } : {};
      // 変更前・変更後は同じ項目のため同じ桁数で表示する。
      const decimalFormatter =
        m.decimals === undefined
          ? undefined
          : m.isPercent
            ? planRateFormatter(m.decimals)
            : planAmountFormatter(m.decimals);
      const afterCol: ColDef = {
        headerName: `SIM値${suffix}`,
        field: m.field,
        ...GRID_NUMBER_TEXT_FILTER,
        width: m.width,
        cellClass: 'ag-cell-right',
        ...(decimalFormatter && { valueFormatter: decimalFormatter }),
        cellStyle: m.computed
          ? whiteCellStyleWithRedNegative
          : makeAfterStyle(m.field, m.afterStyle),
        editable: m.computed ? false : m.editable,
        ...rowSpanOverride,
        onCellValueChanged: (params: any) => {
          m.onAfterCellChange?.(params);
          routeUpdate(params, { ...params.data });
        },
      };
      // 算出列（NET・マージン率）は入力不可のため、エディタ・セッターは付与しない
      if (!m.computed) {
        // 整数のみの項目（計画函数・売価）は小数を入力させない
        if (m.integerOnly) {
          afterCol.cellEditor = 'agNumberCellEditor';
          afterCol.cellEditorParams = { precision: 0 };
          // cellDataType の自動推論は valueSetter/valueParser を上書きするため無効化する
          afterCol.cellDataType = false;
        } else {
          afterCol.cellEditor = 'agTextCellEditor';
        }
        afterCol.valueSetter =
          m.afterValueSetter ??
          makeAfterSetter(m.field, m.isPercent, m.decimals);
      }
      return [
        {
          headerName: `計画値${suffix}`,
          field: `${m.field}Before`,
          ...GRID_NUMBER_TEXT_FILTER,
          columnGroupShow: 'open',
          width: m.width,
          cellClass: 'ag-cell-right',
          cellStyle: whiteCellStyleWithRedNegative,
          editable: false,
          ...rowSpanOverride,
          valueFormatter: decimalFormatter ?? formatEmptyAsDash,
        },
        afterCol,
        {
          headerName: `増減${suffix}`,
          colId: `${m.field}Delta`,
          ...GRID_NUMBER_TEXT_FILTER,
          // 表示値はマイナスを「▲N」で持ち数値へ変換できないため、絞り込みは変更後−変更前の数値で行う
          filterValueGetter: (params) => {
            const delta =
              parseMetric(params.data?.[m.field]) -
              deltaBaseOf(m.field, params.data);
            return isNaN(delta) ? null : delta;
          },
          columnGroupShow: 'open',
          width: m.width,
          cellClass: 'ag-cell-right',
          // 増減列は入力不可（非活性）で表示のみ。差分は共通の DeltaCell でアイコン表示。
          cellStyle: deltaCellStyle(() => false),
          editable: false,
          ...rowSpanOverride,
          valueGetter: makeDeltaGetter(m.field, m.isPercent, m.decimals),
          cellRenderer: DeltaCell,
        },
      ];
    };
    // 1指標 → 「変更前/変更後/増減/AF」を子に持つ列グループ
    const makeComparisonGroup = (m: {
      field: string;
      header: string;
      width: number;
      isPercent: boolean;
      // 項目一覧の小数桁（NET・納価=2／売価=0）。
      decimals?: number;
      editable: (p: any) => boolean;
      afterStyle: (p: any) => any;
      computed?: boolean;
      onAfterCellChange?: (p: any) => void;
      afterValueSetter?: (p: any) => boolean;
      // グループヘッダーのツールチップ（計画詳細と同じ説明を表示）
      headerTooltip?: string;
      // ギフト3行1セットで結合対象外にするか（計画函数のみ true）。
      unmerge?: boolean;
      // 変更後セルを整数のみ入力可にする（計画函数・売価）。
      integerOnly?: boolean;
    }) => ({
      headerName: m.header,
      headerTooltip: m.headerTooltip,
      marryChildren: true,
      // 既定で変更前/増減/AFを展開表示（グループの＋/−で折りたたみ可能）
      openByDefault: true,
      children: makeComparisonChildren(m),
    });

    // NET（変更後）：補足2-1 のNET入力パターン(Pattern B)のみ活性。
    // 固定マージン率(Pattern A)と、取引制度を判定できない行は非活性。
    const netEditable = (params: any) =>
      allEditable(params) && isNetInputRow(params.data);

    // NET（変更後）セルのスタイル：Pattern B=黄（活性）、それ以外=グレー（非活性）。
    const netAfterStyle = (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return undefined;
      return isNetInputRow(params.data)
        ? yellowCellStyleWithRedNegative(params)
        : whiteCellStyleWithRedNegative(params);
    };

    // 必須項目（企画・確度・企画名）が未入力のセルは、入力が必要であることを示すため
    // 赤の破線枠＋赤字で強調する。販売計画(コピー元)からのコピーは企画・確度・企画名を
    // ー（未選択）で追加するため、そのままでは保存できない行であることを画面上で示す。
    // 反映済など編集できない行は入力を促す対象にならないため強調しない。
    const requiredCellStyle = (params: any) => {
      const base = yellowCellStyle(params);
      if (!baseEditable(params)) return base;
      const isEmpty = String(params.value ?? '').trim() === '';
      return isEmpty ? requiredEmptyCellStyle(base) : base;
    };

    // シミュレーション更新KEYの重複チェック付きの valueSetter を作る（VL-04）。
    // 企画・確度・NET・納価の入力確定時に、KEYが同じ明細が他にあれば元の値に戻してトーストで知らせる。
    const withSimulationKeyCheck =
      (field: keyof ProductData, setValue: (params: any) => boolean) =>
      (params: any) => {
        const prevValue = params.data[field];
        if (!setValue(params)) return false;
        if (
          hasSameSimulationKey(params.data, allDataRef.current, usesNetAsKey)
        ) {
          params.data[field] = prevValue; // 変更を破棄
          toast.error(simulationKeyDuplicateMessage('変更'));
          return false;
        }
        return true;
      };
    const campaignValueSetter = withSimulationKeyCheck('campaign', (params) => {
      params.data.campaign = params.newValue ?? '';
      return true;
    });
    const probabilityValueSetter = withSimulationKeyCheck(
      'probability',
      (params) => {
        params.data.probability = params.newValue ?? '';
        return true;
      }
    );
    const netValueSetter = withSimulationKeyCheck(
      'net',
      makeAfterSetter('net', false, PLAN_DETAIL_DIGITS.price)
    );
    const napaValueSetter = withSimulationKeyCheck(
      'planPrice',
      makeAfterSetter('planPrice', false, PLAN_DETAIL_DIGITS.price)
    );

    // 企画を選んだら、同じ対象年月・同じ企画の明細に登録済みの企画名を設定する（無ければ空欄）。
    // 従属セルの Undo は主セル1回で戻す共通フックに委譲する（→ 02 §7.3）。
    const handleCampaignChanged = makeLinkedHandler('campaign', {
      depFields: ['campaignName'],
      deriveDeps: (value, row) => ({
        campaignName: registeredCampaignName(
          allDataRef.current,
          row.targetMonth,
          value,
          row.id
        ),
      }),
      syncState: syncRowState,
    });

    // 列定義
    // 拡売費①②の共通列（計画金額～摘要1(社内用)の11列）を生成する。
    // 管理区分・管理コード・施策区分・施策コードは「区分値／コード」列と「名称」列に分け、
    // 行の保持値（管理区分＝名称／管理コード＝コード）から導出して相互に連動させる。
    // 作成者（exp1Creator/exp2Creator）は列表示しないが、行の追加・コピー時の記録として
    // データ側では引き続きログインユーザーを保持する。
    const refreshExpenseRow = (params: any) =>
      params.api?.refreshCells({ rowNodes: [params.node], force: true });

    const makeExpenseColumns = (prefix: 'exp1' | 'exp2'): ColDef[] => {
      // 以下4つの連動は共通フック（useLinkedCellUndo）に委譲する（→ 02 §7.3）。従属セルは
      // Undo スタックに積まれず、Ctrl+Z 1回で主セルと従属セル（自動補完・クリアした区分／コード、
      // 管理利益額などの算出列）がまとめて元に戻る。コード列・名称列のどちらから確定しても
      // 同じ結果になるよう、確定値（名称列では名称）ではなく行データの値を基準に導出する。
      const mgmtClassField = `${prefix}ManagementClass` as keyof ProductData;
      const mgmtCodeField = `${prefix}ManagementCode` as keyof ProductData;
      const accountItemField = `${prefix}AccountItem` as keyof ProductData;
      const campaignClassField = `${prefix}CampaignClass` as keyof ProductData;
      const campaignCodeField = `${prefix}CampaignCode` as keyof ProductData;
      // 管理コード（コード列・名称列のいずれか）確定時：管理区分・勘定科目を自動補完し、
      // 管理区分で管理利益額の費目（ロケ補填・固定費・自販機関連費）が変わるため再計算する
      const handleMgmtCodeChanged = makeLinkedHandler(mgmtCodeField, {
        depFields: [mgmtClassField, accountItemField, ...DERIVED_FIELDS],
        deriveDeps: (_value, row) => {
          const next: any = { ...row };
          const cls = managementClassFromCode(next[mgmtCodeField]);
          if (cls) {
            next[mgmtClassField] = cls;
            next[accountItemField] =
              EXPENSE_MANAGEMENT_CLASS_OPTIONS.find((o) => o.value === cls)
                ?.accountItem ?? next[accountItemField];
          }
          recomputeDerived(next);
          return next;
        },
        syncState: syncRowState,
      });
      // 管理区分（区分値列・名称列のいずれか）確定時：該当しない管理コードはクリアし、再計算する
      const handleMgmtClassChanged = makeLinkedHandler(mgmtClassField, {
        depFields: [mgmtCodeField, ...DERIVED_FIELDS],
        deriveDeps: (_value, row) => {
          const next: any = { ...row };
          const code = next[mgmtCodeField];
          if (code && !isManagementCodeInClass(code, next[mgmtClassField])) {
            next[mgmtCodeField] = '';
          }
          recomputeDerived(next);
          return next;
        },
        syncState: syncRowState,
      });
      // 施策コード（コード列・名称列のいずれか）確定時：施策区分を自動セット
      const handleCampaignCodeChanged = makeLinkedHandler(campaignCodeField, {
        depFields: [campaignClassField],
        deriveDeps: (_value, row) => ({
          [campaignClassField]:
            campaignClassFromCode(row[campaignCodeField] as string) ||
            row[campaignClassField],
        }),
        syncState: syncRowState,
      });
      // 施策区分（区分値列・名称列のいずれか）確定時：該当しない施策コードはクリア
      const handleCampaignClassChanged = makeLinkedHandler(campaignClassField, {
        depFields: [campaignCodeField],
        deriveDeps: (_value, row) => {
          const code = row[campaignCodeField] as string;
          const cls = row[campaignClassField] as string;
          return {
            [campaignCodeField]:
              code && !isCampaignCodeInClass(code, cls) ? '' : code,
          };
        },
        syncState: syncRowState,
      });

      // 拡売費①の必須項目（計画金額・計上年月・管理区分・管理コード）が全て未入力の行かを判定する
      const isExp1EmptyRow = (data: any): boolean =>
        [
          'PlannedAmountBefore',
          'PostingMonth',
          'ManagementClass',
          'ManagementCode',
        ].every(
          (suffix) => String(data?.[`exp1${suffix}`] ?? '').trim() === ''
        );
      // 拡売費②を編集不可にする行（拡売費①が全て未入力）。①→②の順で入力させる。
      const exp2Locked = (params: any) =>
        prefix === 'exp2' &&
        !params.data?._isHeader &&
        !params.node?.rowPinned &&
        isExp1EmptyRow(params.data);

      const columns: ColDef[] = [
        {
          // 変更後金額・増減金額は廃止し、計画金額（旧 変更前金額）を直接編集する
          headerName: '計画金額',
          field: `${prefix}PlannedAmountBefore`,
          ...GRID_NUMBER_TEXT_FILTER,
          width: 80,
          cellClass: 'ag-cell-right',
          cellStyle: yellowCellStyleWithRedNegative,
          editable: baseEditable,
          cellEditor: 'agTextCellEditor',
          valueFormatter: formatEmptyAsDash,
          valueSetter: (params: any) => {
            const raw = String(params.newValue ?? '').trim();
            params.data[`${prefix}PlannedAmountBefore`] =
              raw === '' ? '' : formatMetric(parseMetric(raw), false);
            return true;
          },
          onCellValueChanged: (params: any) => {
            // 計画金額は管理利益額（直接固定費・ロケ補填）の算出元のため再計算する
            recomputeDerived(params.data);
            // 拡売費①の入力有無で拡売費②の活性・グレーアウトが変わるため行を再描画する
            refreshExpenseRow(params);
            routeUpdate(params, { ...params.data });
          },
        },
        {
          headerName: '計上年月',
          field: `${prefix}PostingMonth`,
          ...GRID_MONTH_TEXT_FILTER,
          width: 96,
          cellClass: 'ag-cell-left',
          cellStyle: yellowCellStyle,
          // カレンダー入力フォーム（YYYY/MM）で入力
          editable: baseEditable,
          cellEditor: MonthYearCellEditor,
          cellEditorPopup: true,
          onCellValueChanged: (params: any) => {
            // 拡売費①の入力有無で拡売費②の活性・グレーアウトが変わるため行を再描画する
            refreshExpenseRow(params);
            routeUpdate(params, { ...params.data });
          },
        },
        {
          headerName: '管理区分',
          colId: `${prefix}ManagementClassCode`,
          width: 88,
          cellClass: 'ag-cell-left',
          cellStyle: yellowCellStyle,
          editable: baseEditable,
          valueGetter: (params: any) =>
            managementClassCodeOf(
              params.data?.[`${prefix}ManagementClass`] ?? ''
            ),
          // 区分値で選択された場合も、行は管理区分の名称を保持する
          valueSetter: (params: any) => {
            params.data[`${prefix}ManagementClass`] = managementClassNameOf(
              params.newValue
            );
            return true;
          },
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: {
            comboOptions: managementClassCodeComboOptions(),
            placeholder: '管理区分を選択',
          },
          onCellValueChanged: handleMgmtClassChanged,
        },
        {
          headerName: '管理区分名称',
          field: `${prefix}ManagementClass`,
          width: 136,
          cellClass: 'ag-cell-left',
          cellStyle: yellowCellStyle,
          editable: baseEditable,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: {
            comboOptions: managementClassComboOptions(),
            placeholder: '管理区分名称を選択',
          },
          onCellValueChanged: handleMgmtClassChanged,
        },
        {
          headerName: '管理コード',
          field: `${prefix}ManagementCode`,
          width: 104,
          cellClass: 'ag-cell-left',
          cellStyle: yellowCellStyle,
          editable: baseEditable,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          // 管理区分が選択済みなら該当する管理コードのみに絞り込む
          cellEditorParams: (params: any) => {
            const cls = params.data[`${prefix}ManagementClass`];
            return {
              comboOptions: managementCodeComboOptions(
                MGMT_CODE_LIST.filter(
                  (c) => !cls || isManagementCodeInClass(c, cls)
                )
              ),
              placeholder: '管理コードを選択',
            };
          },
          onCellValueChanged: handleMgmtCodeChanged,
        },
        {
          headerName: '管理コード名称',
          colId: `${prefix}ManagementCodeName`,
          width: 136,
          cellClass: 'ag-cell-left',
          cellStyle: yellowCellStyle,
          editable: baseEditable,
          valueGetter: (params: any) =>
            managementCodeNameOf(
              params.data?.[`${prefix}ManagementCode`] ?? ''
            ),
          // 名称で選択された場合も、行は管理コードを保持する
          valueSetter: (params: any) => {
            params.data[`${prefix}ManagementCode`] = managementCodeOfName(
              params.newValue
            );
            return true;
          },
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: (params: any) => {
            const cls = params.data[`${prefix}ManagementClass`];
            return {
              comboOptions: managementCodeNameComboOptions(
                MGMT_CODE_LIST.filter(
                  (c) => !cls || isManagementCodeInClass(c, cls)
                )
              ),
              placeholder: '管理コード名称を選択',
            };
          },
          onCellValueChanged: handleMgmtCodeChanged,
        },
        {
          headerName: '施策区分',
          colId: `${prefix}CampaignClassCode`,
          width: 88,
          cellClass: 'ag-cell-left',
          cellStyle: yellowCellStyle,
          editable: baseEditable,
          valueGetter: (params: any) =>
            campaignClassCodeOf(params.data?.[`${prefix}CampaignClass`] ?? ''),
          valueSetter: (params: any) => {
            params.data[`${prefix}CampaignClass`] = campaignClassNameOf(
              params.newValue
            );
            return true;
          },
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: {
            comboOptions: campaignClassCodeComboOptions(),
            placeholder: '施策区分を選択',
          },
          onCellValueChanged: handleCampaignClassChanged,
        },
        {
          headerName: '施策区分名称',
          field: `${prefix}CampaignClass`,
          width: 120,
          cellClass: 'ag-cell-left',
          cellStyle: yellowCellStyle,
          editable: baseEditable,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: {
            comboOptions: campaignClassComboOptions(),
            placeholder: '施策区分名称を選択',
          },
          onCellValueChanged: handleCampaignClassChanged,
        },
        {
          headerName: '施策コード',
          field: `${prefix}CampaignCode`,
          width: 104,
          cellClass: 'ag-cell-left',
          cellStyle: yellowCellStyle,
          editable: baseEditable,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          // 施策区分が選択済みなら該当する施策コードのみに絞り込む
          cellEditorParams: (params: any) => {
            const cls = params.data[`${prefix}CampaignClass`];
            return {
              comboOptions: campaignCodeComboOptions(
                CAMPAIGN_CODE_LIST.filter(
                  (c) => !cls || isCampaignCodeInClass(c, cls)
                )
              ),
              placeholder: '施策コードを選択',
            };
          },
          onCellValueChanged: handleCampaignCodeChanged,
        },
        {
          headerName: '施策コード名称',
          colId: `${prefix}CampaignCodeName`,
          width: 152,
          cellClass: 'ag-cell-left',
          cellStyle: yellowCellStyle,
          editable: baseEditable,
          valueGetter: (params: any) =>
            campaignCodeNameOf(params.data?.[`${prefix}CampaignCode`] ?? ''),
          valueSetter: (params: any) => {
            params.data[`${prefix}CampaignCode`] = campaignCodeOfName(
              params.newValue
            );
            return true;
          },
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          cellEditorParams: (params: any) => {
            const cls = params.data[`${prefix}CampaignClass`];
            return {
              comboOptions: campaignCodeNameComboOptions(
                CAMPAIGN_CODE_LIST.filter(
                  (c) => !cls || isCampaignCodeInClass(c, cls)
                )
              ),
              placeholder: '施策コード名称を選択',
            };
          },
          onCellValueChanged: handleCampaignCodeChanged,
        },
        {
          headerName: '摘要1(社内用)',
          field: `${prefix}Description`,
          width: 120,
          cellClass: 'ag-cell-left',
          cellStyle: yellowCellStyle,
          editable: baseEditable,
          cellEditor: 'agTextCellEditor',
          onCellValueChanged: (params: any) =>
            routeUpdate(params, { ...params.data }),
        },
      ];

      if (prefix !== 'exp2') return columns;
      // 拡売費①が全て未入力の行では、拡売費②の入力列を編集不可＋グレーアウトにする
      return columns.map((col) =>
        col.editable === baseEditable
          ? {
              ...col,
              editable: (params: any) =>
                baseEditable(params) && !exp2Locked(params),
              cellStyle: (params: any) => {
                if (exp2Locked(params)) {
                  return {
                    backgroundColor: GRID_COLORS.readonly,
                    cursor: 'default',
                  };
                }
                const base = col.cellStyle;
                return typeof base === 'function' ? base(params) : base;
              },
            }
          : col
      );
    };

    // コード値・区分値の列（PJルール：名称と別列で保持。既定は非表示で列メニューから表示できる。
    // 初期表示は基本設計で業務側が項目ごとに決める）。計画詳細と同じ列定義を使う。
    const codeColumns = useMemo(
      () => planDetailCodeColumns(whiteCellStyle),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 列定義と同じく初回の参照に固定する
      []
    );

    const columnDefs: ColDef[] = useMemo(
      () => [
        {
          headerName: '対象年月',
          field: 'targetMonth',
          ...GRID_MONTH_TEXT_FILTER,
          width: 104,
          lockPinned: true,
          cellClass: 'ag-cell-left',
          // 自動表示の白背景に、行の追加経路を示すカラーバー（左罫線）を合成
          cellStyle: (params: any) => ({
            ...(whiteCellStyle(params) || {}),
            ...copySourceLeftBorder(params.data?._copySource),
          }),
          // 合計行は対象年月＋企画（先頭の列）を結合して「合計」と表示
          colSpan: (params: any) => (params.node?.rowPinned ? 2 : 1),
          // 編集不可（自動表示）。読み取り専用のため editor 設定は持たない。
          editable: false,
        },
        {
          headerName: '企画',
          field: 'campaign',
          width: 80,
          lockPinned: true,
          cellClass: 'ag-cell-left',
          cellStyle: requiredCellStyle,
          editable: baseEditable,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          // 使用中の企画は企画名を併記する（対象年月ごとに管理するため行の対象年月で作る）
          cellEditorParams: (params: any) => ({
            comboOptions: campaignComboOptions(
              CAMPAIGN_OPTIONS,
              allDataRef.current,
              params.data?.targetMonth
            ),
            width: '22rem',
          }),
          valueSetter: campaignValueSetter,
          onCellValueChanged: handleCampaignChanged,
        },
        {
          // 企画名（企画の右隣・手入力）
          headerName: '企画名',
          field: 'campaignName',
          width: 128,
          cellClass: 'ag-cell-left',
          cellStyle: requiredCellStyle,
          // 合計行は企画名～サマリ商品名（スクロール列）を結合（表示は空欄）
          colSpan: (params: any) => (params.node?.rowPinned ? 7 : 1),
          editable: baseEditable,
          cellEditor: 'agTextCellEditor',
          valueFormatter: (params: any) =>
            params.node?.rowPinned ? '' : formatEmptyAsDash(params),
          onCellValueChanged: (params) => {
            routeUpdate(params, {
              ...params.data,
              campaignName: params.newValue,
            });
            // 同じ対象年月・同じ企画の明細へ連動する（Undo でも再発火するため元の名前に戻る）
            handleSyncCampaignName(
              params.data.targetMonth,
              params.data.campaign,
              params.newValue ?? ''
            );
          },
        },
        {
          headerName: '確度',
          field: 'probability',
          width: 80,
          cellClass: 'ag-cell-left',
          cellStyle: requiredCellStyle,
          editable: baseEditable,
          cellEditor: SingleComboboxCellEditor,
          cellEditorPopup: true,
          valueFormatter: (params: any) =>
            params.node?.rowPinned ? '' : formatEmptyAsDash(params),
          valueSetter: probabilityValueSetter,
          // 確定の排他（同一計画・同一商品の二重確定）に該当する行は「確定」を選択不可にする。
          // 反映済はシステムが付与する状態のため手動選択肢には含めない。
          cellEditorParams: (params: any) => ({
            comboOptions: toComboOptions(
              canSelectConfirm(params.data, allDataRef.current)
                ? ['A', 'B', 'C', '確定', '不採用']
                : ['A', 'B', 'C', '不採用']
            ),
          }),
          // 確定不可の理由をセルのツールチップで表示する
          tooltipValueGetter: (params: any) =>
            params.node?.rowPinned
              ? null
              : confirmBlockReason(params.data, allDataRef.current),
          onCellValueChanged: (params) => {
            const updatedData = {
              ...params.data,
              probability: params.newValue,
            };
            // rowData は値編集で作り直さないため、当該ノードの data を直接更新する。
            // 確度で行の背景（反映済・不採用のグレー：getRowStyle）が変わるため行ごと描き直す。
            Object.assign(params.data, updatedData);
            params.api.redrawRows({ rowNodes: [params.node] });
            if (params.data.section === '定番商品') {
              params.context.updateRegularProduct(updatedData);
            } else if (params.data.section === '新商品') {
              params.context.updateNewProduct(updatedData);
            } else if (params.data.section === '特殊商品') {
              params.context.updatePromotionProduct(updatedData);
            } else if (params.data.section === 'ギフト') {
              params.context.updateGiftProduct(updatedData);
            }
          },
        },
        codeColumns.productCategoryCode,
        {
          headerName: '商品区分',
          field: 'productCategory',
          width: 88,
          cellClass: 'ag-cell-left',
          // 商品区分：全区分を活性（編集可＝白／変更後は黄）。ギフトは3行1セットの先頭セルで結合表示する。
          cellStyle: yellowCellStyle,
          editable: baseEditable,
          cellEditor: SingleComboboxCellEditor,
          cellEditorParams: {
            // ギフトを含む全区分から選択できる（ギフト⇄他区分の変更も可）。
            comboOptions: CATEGORY_LABELS_MARGIN.map((value) => ({
              value,
              label: value,
            })),
            placeholder: '商品区分を選択',
          },
          cellEditorPopup: true,
          filter: true,
          headerTooltip:
            '商品区分[自動表示]前年同月実績の商品区分(定番商品/新商品/特殊商品/ギフト)を取得表示',
          onCellValueChanged: (params: any) => {
            // 商品区分の変更に応じてタブ振り分け（section）・販促区分を連動させ、
            // ギフト⇄他区分では販売期間の 1行⇔3行 を組み替える。
            if (params.newValue === params.oldValue) return;
            params.context.changeProductCategory(params.data, params.newValue);
          },
        },
        codeColumns.promotionCode,
        {
          // 全区分=グレー（非活性・自動表示）。特殊商品/ギフトは区分名で固定表示。
          headerName: '販促区分',
          field: 'promotion',
          width: 144,
          cellClass: 'ag-cell-left',
          cellStyle: whiteCellStyle,
          // 読み取り専用（自動表示）のため editor 設定は持たない。
          editable: false,
          // 特殊商品/ギフトは販促区分を区分名で固定表示（データ値に依存しない）
          valueFormatter: (params: any) =>
            params.data?.productCategory === '特殊商品'
              ? PROMOTION_NONE_LABEL
              : params.data?.productCategory === 'ギフト'
                ? 'ギフト'
                : (params.value ?? ''),
          headerTooltip:
            '販促区分[自動表示]サマリ商品に紐づく販促区分を取得表示',
        },
        {
          headerName: 'メタブランド',
          field: 'metaBrand',
          width: 112,
          cellClass: 'ag-cell-left',
          cellStyle: whiteCellStyle,
          filter: true,
          headerTooltip:
            'メタブランド[自動表示]サマリ商品に紐づくメタブランドを取得表示',
        },
        {
          headerName: '容器容量G',
          field: 'containerCapacityG',
          width: 112,
          cellClass: 'ag-cell-left',
          cellStyle: whiteCellStyle,
          filter: true,
          headerTooltip:
            '容器容量G[自動表示]サマリ商品に紐づく容器容量Gを取得表示',
        },
        {
          // 定番商品/新商品/特殊/ギフト=黄（セレクトボックス）
          headerName: 'サマリ商品',
          field: 'summaryProduct',
          width: 264,
          cellClass: 'ag-cell-left',
          cellStyle: whiteCellStyle,
          // 読み取り専用（自動表示）のため editor 設定は持たない。
          editable: false,
          filter: true,
          headerTooltip:
            'サマリ商品[自動表示]前年同月実績のサマリ商品を取得表示',
        },
        // コード値・区分値の列（PJルール：名称と別列で保持。既定は非表示で列メニューから表示できる）
        codeColumns.metaBrandCode,
        codeColumns.containerCapacityCode,
        codeColumns.summaryProductCode,
        {
          // 販売期間：入数の左隣に配置。非活性（グレー）。
          // ギフトは上旬/中旬/下旬の3行1セットで自動表示（field:'period'）。
          // セル結合対象外（行ごとに表示）のため rowSpan は常に1。
          headerName: '販売期間',
          field: 'period',
          width: 72,
          cellClass: 'ag-cell-left',
          cellStyle: whiteCellStyle,
          editable: false,
          rowSpan: () => 1,
          valueFormatter: (params: any) =>
            params.node?.rowPinned ? '' : formatEmptyAsDash(params),
          headerTooltip:
            '販売期間[自動表示]ギフトは上旬/中旬/下旬の3行1セットで表示',
        },
        {
          headerName: '入数',
          headerTooltip: '入数[自動表示]サマリ商品に紐づく入数を取得表示',
          field: 'quantity',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 68,
          cellClass: 'ag-cell-right',
          cellStyle: whiteCellStyle,
        },
        makeComparisonGroup({
          field: 'plan',
          header: '計画函数',
          // 計画函数は整数（3桁区切り）
          decimals: 0,
          // 計画函数は整数のみ入力可
          integerOnly: true,
          headerTooltip: '函数-計画[入力値/自動表示]前年同月実績値を取得表示',
          width: 80,
          isPercent: false,
          editable: baseEditable,
          afterStyle: yellowCellStyleWithRedNegative,
          // ギフトは上旬/中旬/下旬で計画(箱数)が異なるためセル結合対象外
          unmerge: true,
          // 函数変更で社外売上高・売上高・管理利益（算出値）を再計算
          onAfterCellChange: (params: any) => recomputeDerived(params.data),
        }),
        makeComparisonGroup({
          field: 'net',
          header: 'NET',
          decimals: PLAN_DETAIL_DIGITS.price,
          headerTooltip: 'NET[自動表示]固定マージン率：納価-納価*マージン率',
          width: 84,
          isPercent: false,
          // 補足2-1：NET入力パターンのみ活性、固定マージン率パターンは算出・非活性
          editable: netEditable,
          afterStyle: netAfterStyle,
          // シミュレーション更新KEYが同じ明細があれば変更できない（VL-04）
          afterValueSetter: netValueSetter,
          onAfterCellChange: (params: any) => recomputeDerived(params.data),
        }),
        makeComparisonGroup({
          field: 'planPrice',
          header: '納価',
          decimals: PLAN_DETAIL_DIGITS.price,
          headerTooltip:
            '納価-計画[入力値]固定マージン率：前年同月実績を初期表示し手入力',
          width: 80,
          isPercent: false,
          // 納価は両パターンとも活性
          editable: allEditable,
          afterStyle: yellowCellStyleWithRedNegative,
          // シミュレーション更新KEYが同じ明細があれば変更できない（VL-04）
          afterValueSetter: napaValueSetter,
          // 納価変更で NET・マージン率・値入率・社外売上高等（算出値）を再計算
          onAfterCellChange: (params: any) => recomputeDerived(params.data),
        }),
        makeComparisonGroup({
          field: 'price',
          header: '売価',
          // 売価は整数のみ入力可
          integerOnly: true,
          decimals: PLAN_DETAIL_DIGITS.amount,
          headerTooltip:
            '売値[入力値/自動表示]前年同月実績値を取得表示（手入力可）',
          width: 80,
          isPercent: false,
          editable: allEditable,
          afterStyle: yellowCellStyleWithRedNegative,
          // 売価変更で値入率・社外売上高（算出値）を再計算
          onAfterCellChange: (params: any) => recomputeDerived(params.data),
        }),
        {
          // マージン率は変更前/変更後/増減に分けず1列で表示（算出値・入力不可）。
          // 値＝固定マージン率（(納価−NET)/納価×100）。
          headerName: 'マージン率',
          headerTooltip:
            'マージン率[条件分岐]固定マージン率：[自動表示]固定マージン率設定値を取得表示、NET入力：[算出](納価-NET)/納価*100%',
          field: 'margin',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 88,
          cellClass: 'ag-cell-right',
          cellStyle: whiteCellStyleWithRedNegative,
          editable: false,
          // マージン率＝小数第2位（％）
          valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.marginRate),
        },
        {
          // ギフト=白（算出値）、その他=グレー（入力不可）
          headerName: '値入率',
          headerTooltip: '値入率[算出](売価-納価)/売価*100%',
          field: 'discount',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 80,
          cellClass: 'ag-cell-right',
          cellStyle: makeCellStyleWithRedNegative({ ギフト: 'white' }, 'gray'),
          // 値入率＝小数第1位（％）
          valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.rate),
        },
        {
          headerName: '管理利益額',
          field: 'managementProfitAmount',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 96,
          cellClass: 'ag-cell-right',
          cellStyle: whiteCellStyleWithRedNegative,
          editable: false,
          // 管理利益額＝整数
          valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
        },
        {
          headerName: '管理利益率',
          field: 'managementProfitRate',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 96,
          cellClass: 'ag-cell-right',
          cellStyle: whiteCellStyleWithRedNegative,
          editable: false,
        },
        {
          headerName: '売上高',
          field: 'netSales',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 96,
          cellClass: 'ag-cell-right',
          cellStyle: whiteCellStyleWithRedNegative,
          editable: false,
          // 売上高＝整数
          valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
        },
        {
          headerName: '社外売上高',
          headerTooltip: '社外売上高[算出]社外売単価×入数×計画函数(SIM値)',
          field: 'externalSales',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 96,
          cellClass: 'ag-cell-right',
          cellStyle: whiteCellStyleWithRedNegative,
          editable: false,
          // 社外売上高＝整数
          valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
        },
        {
          headerName: '拡売費①',
          openByDefault: true,
          children: makeExpenseColumns('exp1'),
        },
        {
          headerName: '拡売費②',
          openByDefault: true,
          children: makeExpenseColumns('exp2'),
        },
        {
          headerName: '',
          colId: 'actions',
          width: 80,
          pinned: 'right',
          lockPinned: true,
          cellClass: 'ag-cell-center',
          sortable: false,
          filter: false,
          resizable: false,
          // 右固定列は rowSpan が効かないため結合はしない（rowSpan:1）。
          // 代わりにセット中央行(_giftMiddle)にのみアイコンを描画し、内部罫線を消して
          // 1セットに結合されたように見せる（下記 cellClassRules / CSS）。
          rowSpan: () => 1,
          cellClassRules: {
            // ギフトのセット内部の横罫線を消す
            'gift-actions': (p: any) => p.data?.section === 'ギフト',
            // セット最終行(下旬)のみ下罫線を出してセット境界を示す
            'gift-actions-bottom': (p: any) =>
              p.data?.section === 'ギフト' && !!p.data?._giftLast,
          },
          cellRenderer: (params: ICellRendererParams) => {
            if (params.data._isHeader) return null;
            if (params.node.rowPinned) return null;

            // ギフトは3行1セット。コピー・削除はセット単位で行う。
            // アイコンはセット中央行(中旬)にのみ描画し、3行を結合した中央に1つ表示する（10/27 第4回 決定事項24）。
            const isGift = params.data.section === 'ギフト';
            if (isGift && !params.data._giftMiddle) return null;

            const handleDelete = () => {
              params.context.onDeleteRow(params.data);
            };

            const handleCopyForPane = () => {
              // ギフトも他区分と同様にコピーする（セット単位で3行まとめて複製する）
              params.context.onCopyForPane(params.data);
            };

            // 確度が反映済の行はコピー・削除を非活性にする（編集アイコンは廃止し、コピー・削除のみ）
            const isReflected = params.data.probability === '反映済';

            return (
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={isReflected ? undefined : handleCopyForPane}
                  disabled={isReflected}
                  className={`p-1 rounded transition-colors ${
                    isReflected
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-green-600 hover:text-green-800 hover:bg-green-50 focus:ring-2 focus:ring-green-500 focus:outline-none'
                  }`}
                  aria-label={`${params.data.summaryProduct}をコピー`}
                  title="コピー"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={isReflected ? undefined : handleDelete}
                  disabled={isReflected}
                  className={`p-1 rounded transition-colors ${
                    isReflected
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-red-600 hover:text-red-800 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:outline-none'
                  }`}
                  aria-label={`${params.data.summaryProduct}を削除`}
                  title="削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          },
        },
      ],
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
      []
    );

    // 計算式セルのクリック中、算出元セルの枠線を強調するフック（計画詳細と同一の仕組み）。
    const formulaHL = useFormulaSourceHighlight<ProductData>(SIM_FORMULA_DEFS, {
      isEligibleRow: (r) => !(r as any)._isHeader && r.metaBrand !== '合計',
    });

    // 列状態（列幅・ソート・固定・表示）を localStorage へ保存／復元する共通フック。
    // 画面独自の onGridReady（API 保持・計算式ハイライトの API 捕捉）は option 経由で連結する。
    const gridColumnStateProps = useGridColumnState(
      'Sim.detail.columnState.v3',
      {
        onGridReady: (e: GridReadyEvent) => {
          mainGridApiRef.current = e.api;
          formulaHL.captureApi(e.api);
        },
      }
    );

    const defaultColDef: ColDef = useMemo(
      () => ({
        ...GRID_DEFAULT_COL_DEF,
        resizable: true,
        sortable: true,
        filter: true,
        // 空白セルは「-」を表示（画面設計標準）
        valueFormatter: formatEmptyAsDash,
        // ギフトの3行1セットをセル結合（販売期間・計画列は個別に rowSpan:1 で上書き）
        rowSpan: giftRowSpan,
      }),
      []
    );

    // Undo履歴を維持するため props の参照を安定させる（→ 02 §7.1）
    const gridColumnDefs = useMemo(
      () => withHeaderTooltips(columnDefs),
      [columnDefs]
    );
    const gridDefaultColDef = useMemo<ColDef>(
      () => ({
        ...defaultColDef,
        menuTabs: ['generalMenuTab', 'columnsMenuTab'],
        // 計算式セルは計算式テキスト、それ以外は従来どおりセル値を表示する
        tooltipValueGetter: formulaHL.tooltipValueGetter,
        // 計算式セルのクリックで算出元セルを枠線強調
        cellClassRules: {
          // 共通の既定列設定のルール（値が無いセルの「-」をグレー等）を引き継ぐ
          ...GRID_DEFAULT_COL_DEF.cellClassRules,
          ...formulaHL.cellClassRules,
          // ギフト結合セル（先頭行＝spanされる列）にセット下端の罫線を付与。
          // 販売期間・計画・操作列は結合対象外（行ごと）のため除外。
          'gift-merged-bottom': (p: any) =>
            !!p.data?._giftFirst &&
            p.colDef.field !== 'period' &&
            p.colDef.field !== 'plan' &&
            p.colDef.colId !== 'actions',
        },
      }),
      [defaultColDef, formulaHL]
    );

    // 表示対象の行（タブ・保留行・「反映済を除く」「不採用を除く」・追加順の並べ替えを適用）。
    const visibleRows = useMemo(() => {
      // 商品区分を変更して保留中の行は、別タブへ切り替えるまで表示中のタブに残す
      const byTab = periodData.filter((item) =>
        isRowInActiveTab(item, activeTab, heldRowKeys)
      );
      // 「反映済を除く」「不採用を除く」がチェックされている場合は該当行を非表示
      const filtered = byTab.filter((item) => {
        if (shouldExcludeReflected && item.probability === '反映済')
          return false;
        if (shouldExcludeRejected && item.probability === '不採用')
          return false;
        return true;
      });
      // 明細追加・コピーで採番した行（_addedSeq あり）を、商品区分によらず
      // 合計行直下（先頭）へ新しい順で並べる。既存行は元の順序を維持（安定ソート）。
      const sorted = [...filtered].sort(
        (a, b) => (b._addedSeq ?? 0) - (a._addedSeq ?? 0)
      );
      return sorted;
    }, [
      periodData,
      activeTab,
      heldRowKeys,
      shouldExcludeReflected,
      shouldExcludeRejected,
    ]);

    // 列フィルタを通過した行のID（フィルタ無しは null）。合計行を表示中の明細だけで計算し直すために使う
    // （10/27 第4回 決定事項19・画面設計標準 4.4 ③）。公式の onFilterChanged／forEachNodeAfterFilter で取得する。
    const [filteredRowIds, setFilteredRowIds] = useState<Set<string> | null>(
      null
    );
    const collectFilteredRowIds = useCallback((api: GridApi) => {
      if (!api.isAnyFilterPresent()) {
        setFilteredRowIds(null);
        return;
      }
      const ids = new Set<string>();
      api.forEachNodeAfterFilter((node) => {
        if (node.id) ids.add(node.id);
      });
      setFilteredRowIds(ids);
    }, []);
    const handleFilterChanged = useCallback(
      (e: FilterChangedEvent) => collectFilteredRowIds(e.api),
      [collectFilteredRowIds]
    );
    // 行の追加・削除や区分タブの切替の後は、フィルタを掛け直した結果で取り直す。
    const handleRowDataUpdated = useCallback(
      (e: RowDataUpdatedEvent) => {
        collectFilteredRowIds(e.api);
        reveal.onRowDataUpdated(e);
      },
      [collectFilteredRowIds, reveal]
    );

    // 合計行（表の最上行に固定する青帯の行）。確度が混ざった明細の単純合計で、
    // 表示中の明細（区分タブ・反映済／不採用を除く・列フィルタの結果）だけを合計する。
    const pinnedTotalRows = useMemo(() => {
      const targetRows = visibleRows.filter(
        (row) => !filteredRowIds || filteredRowIds.has(String(row.id))
      );
      // ギフトは上旬/中旬/下旬の3行1セット。販売期間・計画函数以外はセル結合されて
      // 3行で1つの値の表示になるため、セット代表行だけを集計して三重計上を防ぐ（計画詳細と同じ）。
      const countedGiftSets = new Set<string>();
      const mergedRows = targetRows.filter((row) => {
        if (!row.giftSetId) return true;
        if (countedGiftSets.has(row.giftSetId)) return false;
        countedGiftSets.add(row.giftSetId);
        return true;
      });
      const sumOf = (rows: ProductData[], field: keyof ProductData): string =>
        String(
          rows.reduce((sum, row) => {
            const value = parseMetric(row[field] as string);
            return sum + (isNaN(value) ? 0 : value);
          }, 0)
        );
      // ％の列は合計せず、分子・分母の合算から率を求める（計画詳細と同じ。分母が0なら「-」）
      const rates = planDetailTotalRatesOf(
        mergedRows,
        'marginRateFixed',
        costUnitPriceOf
      );
      const rateText = (value: number): string =>
        Number.isFinite(value) ? String(value) : '';
      const profitAmount = Number(sumOf(mergedRows, 'managementProfitAmount'));
      const netSales = Number(sumOf(mergedRows, 'netSales'));
      const total: Partial<ProductData> = {
        id: 'pinned-total',
        section: '合計',
        targetMonth: '合計',
        metaBrand: '合計',
        // 計画函数はギフトも行ごとに値が異なる（セル結合対象外）ため全行を集計する
        plan: sumOf(targetRows, 'plan'),
        planBefore: sumOf(targetRows, 'planBefore'),
        // NET・納価・売価・入数は単価・単位のため合計しない（空欄＝「-」表示）
        margin: rateText(rates.margin),
        discount: rateText(rates.discount),
        managementProfitAmount: String(profitAmount),
        managementProfitRate: netSales
          ? formatPlanRate((profitAmount / netSales) * 100, 2)
          : '',
        netSales: String(netSales),
        externalSales: sumOf(mergedRows, 'externalSales'),
        exp1PlannedAmount: sumOf(mergedRows, 'exp1PlannedAmount'),
        exp1PlannedAmountBefore: sumOf(mergedRows, 'exp1PlannedAmountBefore'),
        exp2PlannedAmount: sumOf(mergedRows, 'exp2PlannedAmount'),
        exp2PlannedAmountBefore: sumOf(mergedRows, 'exp2PlannedAmountBefore'),
      };
      return [total];
      // parseMetric は純粋関数のため依存に含めない
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleRows, filteredRowIds]);

    // 行の構造シグネチャ（表示行の行ID＋ギフトセット＋挿入順）。セル値の編集では変化せず、
    // 行の追加・削除・コピー、タブ・期間・絞り込みの切替などで表示行が変わったときだけ変化する。
    // これを rowData 作り直しのきっかけにし、値編集では rowData 参照を変えない
    // ＝AG Grid の Undo/Redo 履歴を維持する（rowData 参照が変わると公式仕様で履歴がクリアされる。
    // セル値は AG Grid がノードの data を直接更新し、state へは onCellValueChanged で同期する → 02 §7.1）。
    const rowStructureSignature = useMemo(
      () =>
        visibleRows
          .map((r) => `${r.id}#${r.giftSetId ?? ''}#${r._addedSeq ?? ''}`)
          .join('|'),
      [visibleRows]
    );

    // グリッドへ渡す行データ（ギフトのセル結合用の印を付与）
    const rowData = useMemo(() => {
      // ギフトの3行1セットをセル結合するため、セット単位で
      // 先頭行(_giftFirst＋行数_giftSpan)・中央行(_giftMiddle：操作アイコン表示)・
      // 最終行(_giftLast：操作列の下罫線)を付与する。
      const annotated = visibleRows.map((row) => ({
        ...row,
        _giftFirst: false,
        _giftSpan: 1,
        _giftMiddle: false,
        _giftLast: false,
      }));
      let i = 0;
      while (i < annotated.length) {
        const row = annotated[i];
        if (row.section !== 'ギフト' || !row.giftSetId) {
          i++;
          continue;
        }
        let j = i;
        while (
          j < annotated.length &&
          annotated[j].giftSetId === row.giftSetId
        ) {
          j++;
        }
        const size = j - i;
        annotated[i]._giftFirst = true;
        annotated[i]._giftSpan = size;
        annotated[j - 1]._giftLast = true;
        annotated[i + Math.floor(size / 2)]._giftMiddle = true;
        i = j;
      }
      return annotated;
      // visibleRows は本文で参照するが依存には含めない（値編集で rowData 参照を変えず
      // Undo 履歴を維持するため、作り直しは構造シグネチャ／再構築トークンの変化時のみに限定）。
      // 構造変化・セル編集を通らない値更新の時点では visibleRows が最新のため、作り直す値も最新。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowStructureSignature, gridRebuildToken]);

    const getRowStyle = useCallback((params: RowClassParams) => {
      // ピン留めされた行（合計行）
      if (params.node.rowPinned) {
        return {
          backgroundColor: GRID_COLORS.total, // 合計行：薄青（gridStyles準拠）
          fontWeight: 'bold',
        };
      }

      // 確度に基づいてグレーアウト
      const probability = params.data?.probability;
      if (probability === '反映済') {
        return {
          backgroundColor: GRID_COLORS.readonly, // gray-200 - 薄いグレー
        };
      }
      if (probability === '不採用') {
        return {
          backgroundColor: REJECTED_BG, // 不採用 - より薄いグレー（変更可）
        };
      }

      // 通常の行は背景色を設定せず、CSSのホバー効果を優先
      return {};
    }, []);

    return (
      <>
        <div className={`${CARD_CLASS} overflow-hidden mb-4`}>
          {/* Table title header */}
          <div className="bg-white px-3 pt-2 pb-4 card-header-accent">
            {/* 1段目: タイトル、計画コピー対象月、コピーボタン、函数計画の初期表示 */}
            <div className="flex items-center gap-2 flex-nowrap">
              <span className={`${CARD_TITLE_CLASS} whitespace-nowrap`}>
                シミュレーション（詳細）
              </span>

              {/* 対象期間（詳細ヘッダー1段目に常時表示。集計の対象期間とは連動しない） */}
              <div className="ml-2">
                <SimulationPeriodPicker
                  fromId={DETAIL_PERIOD_FROM_ID}
                  ariaLabelPrefix="詳細の対象期間"
                  disabledMonths={SIMULATION_CLOSED_MONTHS}
                  fromPeriod={targetPeriodFrom}
                  toPeriod={targetPeriodTo}
                  onFromPeriodChange={(v) =>
                    requestPeriodChange(
                      targetPeriodFrom,
                      v,
                      onTargetPeriodFromChange
                    )
                  }
                  onToPeriodChange={(v) =>
                    requestPeriodChange(
                      targetPeriodTo,
                      v,
                      onTargetPeriodToChange
                    )
                  }
                />
              </div>

              {/* 参照ボタン：自計画を参照し、コピーで明細へ行追加 */}
              <button
                type="button"
                onClick={() => setIsReferencePaneShown((prev) => !prev)}
                className={`flex items-center gap-1 ml-2 px-3 py-1 text-sm whitespace-nowrap ${BUTTON_STYLES.outline} ${BUTTON_BASE}`}
              >
                <FileSearch className="w-4 h-4" />
                販売計画(コピー元)
              </button>

              {/* 行の追加経路（コピー由来）を示すカラーバー凡例 */}
              <CopySourceLegend className="ml-2" />
            </div>

            {/* 2段目: セグメントタブ */}
            <div className="flex items-center gap-2 mt-2">
              {/* セグメントタブ */}
              <div className="flex items-center">
                <button
                  onClick={() => switchTab('all')}
                  className={`px-4 py-2 rounded-l-lg border-2 transition-colors whitespace-nowrap text-xs ${
                    activeTab === 'all'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                  }`}
                >
                  全て
                </button>
                <button
                  onClick={() => switchTab('定番商品')}
                  className={`px-4 py-2 border-2 border-l-0 transition-colors whitespace-nowrap text-xs ${
                    activeTab === '定番商品'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                  }`}
                >
                  定番商品
                </button>
                <button
                  onClick={() => switchTab('新商品')}
                  className={`px-4 py-2 border-2 border-l-0 transition-colors whitespace-nowrap text-xs ${
                    activeTab === '新商品'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                  }`}
                >
                  新商品
                </button>
                <button
                  onClick={() => switchTab('特殊商品')}
                  className={`px-4 py-2 border-2 border-l-0 transition-colors whitespace-nowrap text-xs ${
                    activeTab === '特殊商品'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                  }`}
                >
                  特売
                </button>
                <button
                  onClick={() => switchTab('ギフト')}
                  className={`px-4 py-2 rounded-r-lg border-2 border-l-0 transition-colors whitespace-nowrap text-xs ${
                    activeTab === 'ギフト'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                  }`}
                >
                  ギフト
                </button>
              </div>

              {/* 反映済を除く */}
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap ml-4">
                <input
                  type="checkbox"
                  checked={shouldExcludeReflected}
                  onChange={(e) => setShouldExcludeReflected(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className={FORM_LABEL_CLASS}>反映済を除く</span>
              </label>

              {/* 不採用を除く */}
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap ml-2">
                <input
                  type="checkbox"
                  checked={shouldExcludeRejected}
                  onChange={(e) => setShouldExcludeRejected(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className={FORM_LABEL_CLASS}>不採用を除く</span>
              </label>

              {/* 右端配置ボタン */}
              <div className="flex items-center gap-2 ml-auto">
                {/* 明細追加ボタン */}
                <button
                  onClick={() =>
                    handleAddRow(activeTab === 'all' ? '' : activeTab)
                  }
                  className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} px-3 py-1 whitespace-nowrap text-sm`}
                  aria-label="＋明細追加"
                >
                  ＋明細追加
                </button>
              </div>
            </div>
          </div>

          {/* AG Grid Table（1920x1080 のPCで画面いっぱいに表示）
            減算値 11.25rem = ヘッダ・フッタ・カード下余白の固定高。最下部までスクロールした
            状態でグリッド本体が画面高にちょうど収まる値（カード見出し・ツールバーは
            スクロールアウトしてよい方針）。 */}
          <div
            ref={gridContainerRef}
            className="sales-detail-grid"
            style={{
              height: 'calc(100vh - 11.25rem)',
              minHeight: '25rem',
              width: '100%',
            }}
          >
            <style>{`
                    .sales-detail-grid .ag-cell-right {
                      text-align: right;
                    }
                    .sales-detail-grid .ag-cell-left {
                      text-align: left;
                    }
                    .sales-detail-grid .ag-cell-center {
                      text-align: center;
                    }

                    /* 罫線・ヘッダ背景は共通テーマ（GRID_THEME＝支払申請一覧参照と同一）に統一。
                       個別の border-right / ヘッダ背景の上書きは行わない。 */
                    .sales-detail-grid .ag-cell {
                      transition: background-color 0.2s ease;
                    }
                    /* ギフト3行1セットの結合セルは、セット下端の横罫線が消えるため補う */
                    .sales-detail-grid .ag-cell.gift-merged-bottom {
                      border-bottom: 1px solid var(--grid-grid-line) !important;
                    }
                    /* 操作列：ギフトはセット内部の横罫線を消し、最終行のみ下罫線を出して
                       1セットに結合されたように見せる（アイコンは中央行にのみ描画） */
                    .sales-detail-grid .ag-cell.gift-actions {
                      border-bottom: none !important;
                    }
                    .sales-detail-grid .ag-cell.gift-actions-bottom {
                      border-bottom: 1px solid var(--grid-grid-line) !important;
                    }
                    /* ホバー：行全体を薄いブルー（GRID_COLORS.rowHover）でハイライト。
                       白・グレー系（反映済・不採用のグレーアウト含む）も含め、
                       行内の全セルをブルーにする。 */
                    .sales-detail-grid .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell,
                    .sales-detail-grid .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell[style*="background-color"] {
                      background-color: var(--grid-row-hover) !important;
                    }
                    /* マイナス値の赤字表示を維持（ホバー時も） */
                    .sales-detail-grid .ag-cell[style*="color: rgb(220, 38, 38)"] {
                      color: var(--grid-decrease-text) !important;
                    }
                    .sales-detail-grid .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell[style*="color: rgb(220, 38, 38)"] {
                      color: var(--grid-decrease-text) !important;
                    }
                    .sales-detail-grid .ag-row-pinned-top {
                      border-top: 2px solid var(--grid-pinned-row-border);
                    }
                    .sales-detail-grid .ag-row-pinned-top .ag-cell:hover {
                      background-color: var(--grid-total) !important; /* 合計行（薄青）はホバーエフェクトを維持 */
                    }
                    /* 編集中のセルはクリーム色を強調 */
                    .sales-detail-grid .ag-cell-inline-editing[style*="background-color: rgb(255, 255, 255)"] {
                      background-color: var(--grid-editing-bg) !important;
                      box-shadow: 0 0 0 2px var(--grid-editing-border) inset;
                    }
                  `}</style>
            <AgGridReact
              rowData={rowData}
              // 行が反映された後に、コピーした新規行を可視域へ送って強調する
              onRowDataUpdated={handleRowDataUpdated}
              // 合計行（表の最上行に固定）。列フィルタの変更で表示中の明細だけの合計に計算し直す
              pinnedTopRowData={pinnedTotalRows}
              onFilterChanged={handleFilterChanged}
              columnDefs={gridColumnDefs}
              // ギフトの3行1セルをセル結合（rowSpan）するために必須
              suppressRowTransform={true}
              onCellMouseOver={formulaHL.onCellMouseOver}
              onCellMouseOut={formulaHL.onCellMouseOut}
              // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
              tooltipShowMode="standard"
              tooltipShowDelay={300}
              tooltipHideDelay={5000}
              onCellValueChanged={(params: any) => {
                // 編集済みセルを記録（元値に戻したら解除）し、当該セルを再描画して
                // 黄色＋オレンジ枠（changedCellStyle）を反映する
                trackCellChange(params);
                params.api.refreshCells({
                  rowNodes: [params.node],
                  columns: [params.column.getColId()],
                  force: true,
                });
              }}
              defaultColDef={gridDefaultColDef}
              getContextMenuItems={gridFilterContextMenuItems}
              statusBar={GRID_STATUS_BAR}
              getRowStyle={getRowStyle}
              getRowId={getDetailRowId}
              ensureDomOrder={true}
              context={{
                onAddRow: handleAddRow,
                onDeleteRow: handleDeleteClick,
                onCopyRow: handleCopyRow,
                onCopyForPane: handleCopyClick,
                updateRegularProduct: handleUpdateRegularProduct,
                updateNewProduct: handleUpdateNewProduct,
                updatePromotionProduct: handleUpdatePromotionProduct,
                updateGiftProduct: handleUpdateGiftProduct,
                changeProductCategory: handleChangeProductCategory,
              }}
              {...gridColumnStateProps}
              {...GRID_BASE_PROPS}
            />
          </div>
        </div>

        {/* 参照用下ペイン：自計画を参照し、コピーで明細へ行を追加。
          プッシュ式：親画面に被さらず中身を押し上げるため、参照表と明細表を同時に視認できる。 */}
        <BottomPane
          open={isReferencePaneShown}
          onClose={() => setIsReferencePaneShown(false)}
          title="販売計画(コピー元)"
        >
          <SimulationReferenceTable
            rows={referenceRows}
            onCopyRow={handleReferenceCopyRow}
            showWholesaleMesh={false}
            fromPeriod={targetPeriodFrom}
            toPeriod={targetPeriodTo}
          />
        </BottomPane>

        {/* 詳細の対象期間変更の確認: 明細を取り直すため、未保存の入力の破棄を確認する */}
        <ConfirmDialog
          open={pendingPeriodApply !== null}
          title="対象期間変更の確認"
          confirmLabel="変更"
          description="入力中のデータが破棄されます。本当によろしいですか？"
          onConfirm={() => {
            const apply = pendingPeriodApply;
            setPendingPeriodApply(null);
            apply?.();
          }}
          onCancel={() => setPendingPeriodApply(null)}
        />
      </>
    );
  }
);

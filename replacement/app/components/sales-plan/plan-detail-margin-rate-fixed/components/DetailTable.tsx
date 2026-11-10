import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  FilterChangedEvent,
  GridApi,
  ICellRendererParams,
  RowClassParams,
} from 'ag-grid-community';
import { Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';

import {
  GRID_COLORS,
  GRID_DEFAULT_COL_DEF,
  GRID_STATUS_BAR,
  GRID_BASE_PROPS,
  useGridColumnState,
  editableBg,
  changedCellStyle,
  formatEmptyAsDash,
  gridFilterContextMenuItems,
  useFormulaSourceHighlight,
  copySourceLeftBorder,
  CopySourceLegend,
  type FormulaDefs,
  withHeaderTooltips,
  GRID_NUMBER_TEXT_FILTER,
  GRID_MONTH_TEXT_FILTER,
  useChangedCells,
  useLinkedCellUndo,
} from '../../../grid';
import { GRID_EMPTY_TEXT, parseFormulaNumber } from '../../../grid/gridCommon';
import { planDetailTotalRatesOf } from '../../../../utils/sales-plan/plan-detail/planDetailTotalRates';
import { NO_DELIVERY_PRICE_NOTE } from '../../../../constants/aggregationTree';
import { planDetailCodeColumns } from '../../../shared/sales-plan/common/planDetailCodeColumns';
import { PlanRateLinks } from '../../../shared/sales-plan/plan-detail/PlanRateLinks';
import { Input } from '../../../ui/input';
import { MonthYearCellEditor } from '../../../ui/month-year-cell-editor';
import { SingleComboboxCellEditor } from '../../../ui/single-combobox-cell-editor';
import { hasPriorYearActual } from '../../../../utils/sales-plan/plan-detail/nonProductExpenseRow';
import { ConfirmDialog } from '../../../ui/confirm-dialog';
import { PlanCopyPane } from '../../../shared/sales-plan/plan-detail/PlanCopyPane';
import type { SalesPlanCopyResult } from '../../../shared/sales-plan/plan-detail/PlanCopyPane';
import {
  type ProductData,
  SAMPLE_STORES,
  REGULAR_PRODUCTS_DATA,
  NEW_PRODUCTS_DATA,
  PROMOTION_PRODUCTS_DATA,
  GIFT_PRODUCTS_DATA,
} from '../../../../constants/salesPlanRetailMockData';
import {
  firstStoreCode,
  thirdStoreCode,
} from '../../../../constants/storeTierMockData';
import {
  getPromotionLabels,
  CATEGORY_LABELS_MARGIN,
} from '../../../../constants/promotionCategories';
import {
  SUMMARY_PRODUCT_BY_VALUE,
  SUMMARY_PRODUCT_VALUES,
  SUMMARY_PRODUCT_OPTIONS,
} from '../../../../constants/productMasters';
import {
  promotionComboOptions,
  summaryProductComboOptions,
} from '../../../../constants/comboFieldOptions';
import {
  makeExternalUnitPriceOf,
  makeCostUnitPriceOf,
  markupAmountOf,
  unitTimesQuantityTimesPlan,
  makeDetailValueOf,
  makeDetailTooltip,
} from '../../../../utils/sales-plan/common/formulaCellHelpers';
import {
  PLAN_DETAIL_DIGITS,
  formatPlanRate,
  roundPlanNumber,
  planAmountFormatter,
  planCountFormatter,
  planRateFormatter,
  planNumberParser,
} from '../../../../utils/sales-plan/common/planDetailNumberFormat';
import { currentMonthEstimate } from '../../../../utils/sales-plan/plan-detail/currentMonthEstimate';
import { buildCategoryChangeRows } from '../../../../utils/sales-plan/common/productCategoryChange';
import { toAxisMetaBrand } from '../../../../constants/aggregationAxisMapping';
import { volumeAddRateOf } from '../../../../constants/aggregationMasterDummy';
import {
  CARD_TITLE_CLASS,
  FORM_LABEL_CLASS,
  BUTTON_STYLES,
  BUTTON_BASE,
  TEXT_INPUT_CLASS,
  CARD_CLASS,
} from '../../../../../styles/commonStyles';

// EDI反映の固定ダミー生成用。納価-計画（初期値）を基準にオフセットを与え、
// 差異±1.00未満（強調なし）／±1.00以上（強調）が混在するようにする。一部は空欄（ー）。
const EDI_OFFSETS = [0.3, -0.5, 0.8, 1.5, -2.2, 3.1, -0.2, 2.6];
const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
// EDI反映の固定値。納価-計画を編集しても EDI反映 は固定のままなので、
// 「納価-計画 と EDI反映 の差異が±1.00以上」で強調表示が動的に切り替わる。
const fixedEdi = (id: string, planPrice?: string): string => {
  const s = hashStr(id);
  if (s % 4 === 0) return ''; // 適度にデータなし（ー）
  const plan = parseFloat(String(planPrice ?? '').replace(/,/g, ''));
  if (!(plan > 0)) return '';
  return roundPlanNumber(
    plan + EDI_OFFSETS[s % EDI_OFFSETS.length],
    PLAN_DETAIL_DIGITS.price
  );
};

// 各行に一意なIDを付与（getRowId・行更新の照合に使用）。
// 重複するサマリ商品名でも getRowId が衝突せず、編集時に行が消えないようにする。
// あわせて EDI反映の固定ダミー（ediPrice）を初期設定する。
const withRowId = (rows: ProductData[], prefix: string): ProductData[] =>
  rows.map((r, i) => {
    const id = (r as any).id ?? `${prefix}-${i}`;
    return {
      ...(r as any),
      id,
      ediPrice: (r as any).ediPrice || fixedEdi(id, (r as any).planPrice),
    };
  });

// 商品区分の変更で表示中のタブに残す行の識別キー（id優先。区分が変わっても変わらない値で作る）。
const heldRowKeyOf = (row: ProductData): string =>
  row.id ??
  `${row.metaBrand}-${row.summaryProduct}-${row.giftSetId ?? ''}-${row.period ?? ''}`;

// 行の照合（id優先。無ければ従来の商品名+メタブランド）。
const matchesRow = (item: any, updatedData: any): boolean =>
  updatedData.id != null
    ? item.id === updatedData.id
    : item.summaryProduct === updatedData.summaryProduct &&
      item.metaBrand === updatedData.metaBrand;

// ── ギフト（上旬・中旬・下旬の3行1セット）ユーティリティ ──
// 販売期間の並び（上旬→中旬→下旬）。
const GIFT_PERIOD_ORDER = ['上旬', '中旬', '下旬'];
// 新しいセット識別キーを採番。
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

// 全項目が空の明細行テンプレート（明細追加・ギフトセット生成で共通利用）。
const makeEmptyProduct = (section: string): ProductData => ({
  section,
  productCategory: section,
  metaBrand: '',
  summaryProduct: '',
  wholesaleMesh: '',
  endSale: '',
  promotion: '',
  quantity: '',
  plan: '',
  estimate: '',
  actual: '',
  prevYear: '',
  ratio: '',
  net: '',
  planPrice: '',
  prevYearPrice: '',
  price: '',
  margin: '',
  volumeAddRate: '',
  externalSales: '',
  delivery: '',
  discount: '',
  profit: '',
  exp1PlannedAmount: '',
  exp1PostingMonth: '',
  exp1ManagementCode: '',
  exp1AccountItem: '',
  exp1ManagementClass: '',
  exp1Description: '',
  exp2PlannedAmount: '',
  exp2PostingMonth: '',
  exp2ManagementCode: '',
  exp2AccountItem: '',
  exp2ManagementClass: '',
  exp2Description: '',
});

export interface DetailTableHandle {
  addCopiedRow: (data: ProductData) => void;
  // 明細追加：フォーム値から新規行を生成し、合計行直下（先頭）へ追加
  addNewRow: (overrides: Partial<ProductData> & { section: string }) => void;
  // 明細編集（ギフト以外）：id 一致の行を更新（商品区分＝section で対象配列へ振り分け）
  updateRow: (data: ProductData) => void;
  // 明細削除：一意な id で対象行を表から除去
  deleteRow: (target: ProductData | string) => void;
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
  // 計画保存時：明細コピー・明細追加の帯と編集セルの強調を消し、未保存状態を解除する
  clearSavedMarks: () => void;
}

interface DetailTableProps {
  onOpenFixedMargin?: () => void;
  onOpenAddDetail?: (section: string) => void;
  onOpenDeleteDetail?: (data: ProductData) => void;
  onOpenAnnualContract?: () => void;
  onOpenCenterFee?: () => void;
  onOpenWholesaleIncentive?: () => void;
  // コピー右ペインの表示種別（null=閉／'plan'=前月計画コピー／'headquarters'=本部計画コピー）。
  // 他の右ペインと排他表示するため開閉は親が管理する。
  copyPaneMode?: null | 'plan' | 'headquarters';
  onOpenPlanCopy?: () => void;
  onOpenHeadquartersCopy?: () => void;
  onCloseCopyPane?: () => void;
  // 各ペインで設定した値。**単位を含んだ表示用文字列**（率は `8.70%`、直接入力の金額は `123,000円`）。
  // 金額に「%」を付けないため、単位は渡す側で付与する。
  annualContractAvg?: string;
  centerFeeAvg?: string;
  wholesaleIncentiveAvg?: string;
  fixedMarginAvg?: string;
  // 年間計画／シミュレーションへの画面遷移コールバック
  onNavigate?: (menuId: string) => void;
  // 年間計画・シミュレーションのボタンを非活性にするか（取引制度を変更した後の対象年月）
  isPlanNavigationDisabled?: boolean;
  // グリッドの全明細行が変わったときに親へ通知する（販売計画(集計)の算出元）。
  // 親側は必ず useCallback で安定化したハンドラを渡すこと（毎レンダリング再生成すると無限ループになる）。
  onRowsChange?: (rows: ProductData[]) => void;
}

// 行 → 商品マスタ。この画面はサマリ商品名で商品を特定する。
const masterOf = (row: ProductData) =>
  SUMMARY_PRODUCT_OPTIONS.find((o) => o.value === row.summaryProduct);

// 行の社外売単価（補足2-2）／売上原価単価（補足2-3）。
const externalUnitPriceOf = makeExternalUnitPriceOf(masterOf);
const costUnitPriceOf = makeCostUnitPriceOf(masterOf);

// マージン率固定パターン（補足2-1）：マージン率は固定設定値（非活性）。
// 納価・売価・入数・函数(計画)・サマリ商品名の変更に応じて
// NET・値入率・社外売上高・売上原価を再計算する。
// NET = 納価 - 納価 × マージン率、値入率 = (売価 - 納価) / 売価 × 100。
// 社外売上高 = 社外売単価(補足2-2) × 入数 × 函数(計画)、
// 売上原価 = 売上原価単価(補足2-3) × 入数 × 函数(計画)。
// 納価未入力時は NET・値入率を更新しない（前年実績の初期表示を維持）。
// 初期表示（useState の初期化子）とセル編集後の両方から呼べるよう、
// コンポーネントの外＝モジュールスコープの純関数として定義する。
function recalcFixedMargin(data: ProductData): ProductData {
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

// 連動セル（→ 02 §7.3）：recalcFixedMargin が算出して書き換える従属セル。
const FIXED_MARGIN_CALC_FIELDS: (keyof ProductData)[] = [
  'net',
  'discount',
  'markupAmount',
  'externalSales',
  'delivery',
  'volumeAddRate',
];
// 連動セル：サマリ商品名の選択で共通マスタから補完する従属セル。
const SUMMARY_MASTER_FIELDS: (keyof ProductData)[] = [
  'metaBrand',
  'containerCapacityG',
  'wholesaleMesh',
  'quantity',
  'actual',
  'prevYear',
];
// 連動セルのキャッシュを引く行キー（共通フック useLinkedCellUndo の rowIdOf）。
// 行IDに「主セル・従属セル以外の算出元」の値を加える。他の算出元を変えた後に主セルを
// 以前の値へ打ち直したとき、古い算出値をキャッシュから戻さず導出し直すため。
// Undo/Redo は後の編集から順に戻るため算出元が一致し、キャッシュから厳密に復元される。
const linkedRowKeyOf =
  (fields: (keyof ProductData)[]) =>
  (params: { node?: { id?: string }; data?: ProductData }): string =>
    [
      params.node?.id ?? '',
      ...fields.map((f) => String(params.data?.[f] ?? '')),
    ].join('#');

// 計算式（派生）セル → 計算式テンプレートと算出元フィールド。
// 計算式セルにホバーすると、計算式ツールチップ（式＋実値の2行）を表示し、
// 同時に当該行内の算出元セルの枠線を強調する（マウスが離れると消える）。
// 「補足資料_手売り_販売計画_計算式一覧表」補足1-1・補足2-1・補足2-2・補足2-3 に準拠。
// refs は当該行内かつ「明細表に表示される列」の算出元のみを対象とする。
// テンプレートの `{token}` は実値を代入できる算出元、素のテキストは画面外の算出元。
const RETAIL_COLUMN_LABELS: Record<string, string> = {
  plan: '計画',
  prevYear: '前年実績',
  planPrice: '納価',
  margin: 'マージン率',
  price: '売価',
  quantity: '入数',
  __unitPrice: '社外売単価',
  __costUnitPrice: '売上原価単価',
};

const retailTooltip = makeDetailTooltip<ProductData>(
  RETAIL_COLUMN_LABELS,
  makeDetailValueOf(externalUnitPriceOf, costUnitPriceOf)
);

// セル自身の値を結果として使う（明細表は算出結果を行データに保持している）。
const fieldResult =
  (field: keyof ProductData) =>
  (row: ProductData): string =>
    String(row[field] ?? '');

const RETAIL_FORMULA_DEFS: FormulaDefs<ProductData> = {
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

export const DetailTable = forwardRef<DetailTableHandle, DetailTableProps>(
  function DetailTable(
    {
      onOpenFixedMargin,
      onOpenAddDetail,
      onOpenDeleteDetail,
      onOpenAnnualContract,
      onOpenCenterFee,
      onOpenWholesaleIncentive,
      copyPaneMode = null,
      onOpenPlanCopy,
      onOpenHeadquartersCopy,
      onCloseCopyPane,
      annualContractAvg = '0.00%',
      centerFeeAvg = '0.00%',
      wholesaleIncentiveAvg = '0.00%',
      fixedMarginAvg = '0.00%',
      onNavigate,
      isPlanNavigationDisabled = false,
      onRowsChange,
    },
    ref
  ) {
    // 計算式セルのクリック中、算出元セルの枠線を強調するフック。
    const formulaHL = useFormulaSourceHighlight<ProductData>(
      RETAIL_FORMULA_DEFS,
      { isEligibleRow: (r) => !r._isHeader && r.metaBrand !== '合計' }
    );

    // 列状態（幅・並び順・ソート・固定・表示）を localStorage へ保存／復元する共通フック。
    // グリッド初期化時の formulaHL.captureApi は本フックの onGridReady 経由で実行する。
    // 保存時に編集セルの強調を消す（値は変わらないため再描画を明示する）ためのAPI
    const gridApiRef = useRef<GridApi | null>(null);
    const gridColumnState = useGridColumnState('sales-plan-retail-detail', {
      onGridReady: (p) => {
        formulaHL.captureApi(p.api);
        gridApiRef.current = p.api;
      },
    });

    // セル編集による未保存状態を保持（画面遷移時のアラート判定に使用）
    const hasUnsavedRef = useRef(false);

    // 編集セルの変更ハイライト（黄＋オレンジ枠）の追跡・判定（共通フック → 02 §7.2）。
    // 元値に戻したら強調を解除し、計画保存時に resetChangedCells でクリアする。
    // 本画面は列ごとの cellStyle で isCellChanged を参照して強調色を付ける。
    const { isCellChanged, trackCellChange, resetChangedCells } =
      useChangedCells();

    // 年間計画／シミュレーションへの遷移は確認ダイアログで「入力中のデータが破棄
    // される」旨を確認してから遷移する。
    const [pendingNavMenuId, setPendingNavMenuId] = useState<string | null>(
      null
    );
    const handleNavigateWithGuard = (menuId: string) => {
      setPendingNavMenuId(menuId);
    };

    // 明細データ（グリッドの行）の状態
    // 初期表示時から社外売上高・売上原価等が算出値になるよう、各行に
    // recalcFixedMargin を1度通す（recalcFixedMargin はモジュールスコープの純関数）。
    const [regularProductsData, setRegularProductsData] = useState<
      Array<ProductData>
    >(() => withRowId(REGULAR_PRODUCTS_DATA, 'reg').map(recalcFixedMargin));

    const [newProductsData, setNewProductsData] = useState<ProductData[]>(() =>
      withRowId(NEW_PRODUCTS_DATA, 'new').map(recalcFixedMargin)
    );

    const [promotionProductsData, setPromotionProductsData] = useState<
      Array<ProductData>
    >(() => withRowId(PROMOTION_PRODUCTS_DATA, 'promo').map(recalcFixedMargin));

    const [giftProductsData, setGiftProductsData] = useState<
      Array<ProductData>
    >(() => withRowId(GIFT_PRODUCTS_DATA, 'gift').map(recalcFixedMargin));

    // 販売計画(集計)へ渡す全明細行。4つの商品区分タブの行をまとめる。
    const allProductRows = useMemo(
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

    // 明細行が変わるたびに親へ通知する（集計値をグリッドの現在値へ追従させる）
    useEffect(() => {
      onRowsChange?.(allProductRows);
    }, [allProductRows, onRowsChange]);

    const allData = [
      ...regularProductsData,
      ...newProductsData,
      ...promotionProductsData,
      ...giftProductsData,
    ].map((row) => {
      // 販促区分のダミー値を商品区分に応じて補完
      // 特殊商品はリスト無し→空欄（グリッドで'-'表示）
      if (row.productCategory === '特殊商品') {
        return { ...row, promotion: '' };
      }
      if (row.promotion) return row;
      const labels = getPromotionLabels(row.productCategory);
      return { ...row, promotion: labels[0] ?? '' };
    });

    // 函数計画の初期表示の割合（％）
    const [casePlanPercentage, setCasePlanPercentage] = useState('100');

    // 総店舗数
    const [totalStoreCount, setTotalStoreCount] = useState('50');

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
    // 表示中のタブに属する行か（商品区分を変更して保留中の行を含む）
    const isRowInActiveTab = (row: ProductData) =>
      activeTab === 'all' ||
      row.section === activeTab ||
      heldRowKeys.has(heldRowKeyOf(row));

    // グリッド再構築トークン。セル編集（AG Gridがnode.dataを直接更新済み）以外の
    // 値更新（モーダル編集・函数反映・コピーペイン適用など）は、行の構造が変わらず
    // rowStructureSignature が変化しないため、このトークンを bump して rowData を
    // 明示的に再構築し、状態の新値をグリッドへ反映する（→ 02 §7.1）。
    // ※再構築で rowData 参照が変わり Undo 履歴はクリアされるが、これらは意図的な
    //   一括/モーダル操作であり許容する（セル編集の Undo は維持される）。
    const [gridRebuildToken, setGridRebuildToken] = useState(0);
    // 連動セル（主セル編集に連動する従属セル）を Undo/Redo で一括・厳密復元する共通フック（→ 02 §7.3）。
    const { makeHandler, clearCache } = useLinkedCellUndo<ProductData>();
    // 再構築で行データが作り直されるため、連動セルのキャッシュも破棄する（保存確定時も本経路）。
    const bumpGridRebuild = useCallback(() => {
      clearCache();
      setGridRebuildToken((t) => t + 1);
    }, [clearCache]);

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

    // 行のコピー
    const handleCopyRow = useCallback(
      (data: ProductData) => {
        // 行データを複製する
        const copiedData = {
          ...data,
          // コピー行には一意なIDを再採番（getRowId 衝突・編集時の源行巻き込みを防止）
          id: `copy-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          // 挿入順を採番。商品区分によらず表示時は合計行直下（先頭）へ並ぶ
          _addedSeq: Date.now(),
        } as ProductData;

        // 編集ルーティング維持のため行は商品区分ごとの配列へ格納する（表示順は
        // rowData 側で _addedSeq により合計行直下へ並べ替える）。
        if (data.section === '定番商品') {
          setRegularProductsData((prev) => [...prev, copiedData]);
        } else if (data.section === '新商品') {
          setNewProductsData((prev) => [...prev, copiedData]);
        } else if (data.section === '特売') {
          setPromotionProductsData((prev) => [...prev, copiedData]);
        } else if (data.section === 'ギフト') {
          setGiftProductsData((prev) => [...prev, copiedData]);
        }
        bumpGridRebuild();
      },
      [bumpGridRebuild]
    );

    // ギフト：上旬/中旬/下旬の3行を1セットとして追加（plans=各期間の箱数=計画函数）。
    const handleAddGiftSet = useCallback(
      (base: Partial<ProductData>, plans: [string, string, string]) => {
        const seq = Date.now();
        const newId = newGiftSetId();
        const rows: ProductData[] = GIFT_PERIOD_ORDER.map((period, i) => ({
          ...makeEmptyProduct('ギフト'),
          ...base,
          section: 'ギフト',
          productCategory: 'ギフト',
          giftSetId: newId,
          period,
          plan: plans[i] ?? '',
          estimate: plans[i] ?? '',
          id: `new-${seq}-${i}`,
          _addedSeq: seq,
          _copySource: 'new' as const,
        }));
        setGiftProductsData((prev) => [...prev, ...rows]);
        bumpGridRebuild();
      },
      [bumpGridRebuild]
    );

    // ギフト：セットをまるごと複製して新規セット（上旬/中旬/下旬の3行）を追加。
    // handleAddGiftSet と同様だが、行の追加経路をコピー由来（_copySource:'detail'・id=copy-...）とする。
    const handleAddCopiedGiftSet = useCallback(
      (base: Partial<ProductData>, plans: [string, string, string]) => {
        const seq = Date.now();
        const newId = newGiftSetId();
        const rows: ProductData[] = GIFT_PERIOD_ORDER.map((period, i) => ({
          ...makeEmptyProduct('ギフト'),
          ...base,
          section: 'ギフト',
          productCategory: 'ギフト',
          giftSetId: newId,
          period,
          plan: plans[i] ?? '',
          estimate: plans[i] ?? '',
          id: `copy-${seq}-${i}`,
          _addedSeq: seq,
          _copySource: 'detail' as const,
        }));
        setGiftProductsData((prev) => [...prev, ...rows]);
        bumpGridRebuild();
      },
      [bumpGridRebuild]
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
            return {
              ...r,
              ...base,
              section: 'ギフト',
              productCategory: 'ギフト',
              giftSetId,
              period: r.period,
              plan,
              estimate: plan,
            };
          })
        );
        // セル編集を通らない値更新のため rowData を再構築して新値を反映する。
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

    // Expose 行操作（追加・コピー・削除）to parent via ref
    useImperativeHandle(ref, () => ({
      addCopiedRow: (data: ProductData) => {
        handleCopyRow({ ...data, _copySource: 'detail' });
      },
      // 明細追加：完全な空テンプレートにフォーム値を上書きし、合計行直下（先頭）へ追加。
      // id・_addedSeq の採番と商品区分配列への振り分けは handleCopyRow が行う。
      addNewRow: (overrides: Partial<ProductData> & { section: string }) => {
        const base = makeEmptyProduct(overrides.section);
        handleCopyRow({ ...base, ...overrides, _copySource: 'new' });
      },
      // 明細削除：ギフトはセット単位（giftSetId）、その他は一意な id で除去
      deleteRow: (target: ProductData | string) => {
        const row = typeof target === 'string' ? null : target;
        if (row?.section === 'ギフト' && row.giftSetId) {
          setGiftProductsData((prev) =>
            prev.filter((item) => item.giftSetId !== row.giftSetId)
          );
          bumpGridRebuild();
          return;
        }
        const id = typeof target === 'string' ? target : target?.id;
        if (!id) return;
        const del = (prev: ProductData[]) =>
          prev.filter((item) => item.id !== id);
        setRegularProductsData(del);
        setNewProductsData(del);
        setPromotionProductsData(del);
        setGiftProductsData(del);
        bumpGridRebuild();
      },
      // ギフト以外の明細編集を id 一致で更新（商品区分＝section で対象配列を選択）
      // ※モーダル経由の編集は AG Grid のセル編集を通らず node.data が未更新のため、
      //   トークンを bump して rowData を再構築し新値を反映する（セル編集とは別経路）。
      updateRow: (data: ProductData) => {
        if (data.section === '新商品') handleUpdateNewProduct(data);
        else if (data.section === '特売') handleUpdatePromotionProduct(data);
        else if (data.section === 'ギフト') handleUpdateGiftProduct(data);
        else handleUpdateRegularProduct(data);
        bumpGridRebuild();
      },
      addGiftSet: handleAddGiftSet,
      addCopiedGiftSet: handleAddCopiedGiftSet,
      updateGiftSet: handleUpdateGiftSet,
      getGiftSet,
      // 計画保存時：左端の帯（明細コピー・明細追加由来）と編集セルの強調を消す。
      // 保存した値を新たな元値とするため、元値の記録と未保存状態もリセットする。
      clearSavedMarks: () => {
        const strip = (prev: ProductData[]) =>
          prev.map((r) =>
            r._copySource ? { ...r, _copySource: undefined } : r
          );
        setRegularProductsData(strip);
        setNewProductsData(strip);
        setPromotionProductsData(strip);
        setGiftProductsData(strip);
        resetChangedCells();
        hasUnsavedRef.current = false;
        // 帯の有無は行構造シグネチャに含まれないため、再構築を明示する
        bumpGridRebuild();
        setTimeout(() => gridApiRef.current?.refreshCells({ force: true }), 0);
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
          prev.map((item) =>
            matchesRow(item, updatedData) ? updatedData : item
          )
        );
      },
      []
    );

    const handleUpdateNewProduct = useCallback((updatedData: ProductData) => {
      setNewProductsData((prev) =>
        prev.map((item) => (matchesRow(item, updatedData) ? updatedData : item))
      );
    }, []);

    const handleUpdatePromotionProduct = useCallback(
      (updatedData: ProductData) => {
        setPromotionProductsData((prev) =>
          prev.map((item) =>
            matchesRow(item, updatedData) ? updatedData : item
          )
        );
      },
      []
    );

    const handleUpdateGiftProduct = useCallback((updatedData: ProductData) => {
      setGiftProductsData((prev) =>
        prev.map((item) => (matchesRow(item, updatedData) ? updatedData : item))
      );
    }, []);

    // 連動セル反映後の state 同期（商品区分＝section で対象配列を選択）。
    // rowData の参照は変えない（再構築トークンを進めない → 02 §7.1・§7.3）。
    const syncRowBySection = useCallback(
      (row: ProductData) => {
        if (row.section === '定番商品') handleUpdateRegularProduct(row);
        else if (row.section === '新商品') handleUpdateNewProduct(row);
        else if (row.section === '特売') handleUpdatePromotionProduct(row);
        else if (row.section === 'ギフト') handleUpdateGiftProduct(row);
      },
      [
        handleUpdateRegularProduct,
        handleUpdateNewProduct,
        handleUpdatePromotionProduct,
        handleUpdateGiftProduct,
      ]
    );

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
        const rows = buildCategoryChangeRows(sourceRows, newCategory, {
          newGiftSetId,
          newRowId: (i) => `new-${seq}-${i}`,
        });
        if (rows.length === 0) return;
        const removedIds = new Set(sourceRows.map((r) => r.id));
        // 変更前の区分の配列から取り除き、変更後の区分の配列へ入れ替える。
        const replaceIn =
          (category: string) =>
          (prev: ProductData[]): ProductData[] => {
            const kept = prev.filter((r) => !removedIds.has(r.id));
            return newCategory === category ? [...kept, ...rows] : kept;
          };
        setRegularProductsData(replaceIn('定番商品'));
        setNewProductsData(replaceIn('新商品'));
        setPromotionProductsData(replaceIn('特売'));
        setGiftProductsData(replaceIn('ギフト'));
        // 「全て」以外のタブでは、別タブへ切り替えるまで変更した行を表示中のタブに残す。
        if (activeTab !== 'all') {
          setHeldRowKeys((prev) => {
            const next = new Set(prev);
            rows.forEach((r) => next.add(heldRowKeyOf(r)));
            return next;
          });
        }
        bumpGridRebuild();
      },
      [giftProductsData, bumpGridRebuild, activeTab]
    );

    // 合計の算出
    // 値は文字列で保持するのが基本だが、グリッドの編集経路によっては数値で
    // 渡ることがあるため、文字列化してから解釈する。
    const parseNumber = (value: string | number | undefined | null) => {
      if (value === null || value === undefined || value === '') return 0;
      const num = parseFloat(String(value).replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    };

    // 前年実績×率% を計画函数へ反映するヘルパー（前年実績が無い行は据え置き）
    const applyRateToRows = (rows: ProductData[], rate: number) =>
      rows.map((row) => {
        const base = parseNumber(row.prevYear);
        if (base <= 0) return row;
        return {
          ...row,
          plan: String(Math.round((base * rate) / 100)),
          // 率は小数点以下2桁を四捨五入し、小数点以下1桁で表示する。
          ratio: formatPlanRate(rate, PLAN_DETAIL_DIGITS.ratio),
        };
      });

    // 函数反映の確認ダイアログ表示状態
    const [isApplyConfirmShown, setIsApplyConfirmShown] = useState(false);

    // 「函数反映」ボタン押下：表示中の商品区分の計画函数へ前年実績比の率を適用
    // （確認ダイアログでOK後に実行）
    const handleApplyCasePlan = useCallback(() => {
      const rate = parseNumber(casePlanPercentage);
      if (activeTab === 'all' || activeTab === '定番商品')
        setRegularProductsData((prev) => applyRateToRows(prev, rate));
      if (activeTab === 'all' || activeTab === '新商品')
        setNewProductsData((prev) => applyRateToRows(prev, rate));
      if (activeTab === 'all' || activeTab === '特売')
        setPromotionProductsData((prev) => applyRateToRows(prev, rate));
      if (activeTab === 'all' || activeTab === 'ギフト')
        setGiftProductsData((prev) => applyRateToRows(prev, rate));
      // セル編集を通らない一括更新のため rowData を再構築して新値を反映する。
      bumpGridRebuild();
      toast.success('函数を反映しました。');
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
    }, [activeTab, casePlanPercentage]);

    // ペインで指定した商品区分・率でコピーを実行（コピー元＝前年実績を基準）
    const handlePlanCopyExecute = useCallback(
      (result: SalesPlanCopyResult) => {
        const rate = parseNumber(result.percentage);
        const isSelected = (category: string) =>
          result.categories.includes(category);
        if (isSelected('定番商品'))
          setRegularProductsData((prev) => applyRateToRows(prev, rate));
        if (isSelected('新商品'))
          setNewProductsData((prev) => applyRateToRows(prev, rate));
        if (isSelected('特売'))
          setPromotionProductsData((prev) => applyRateToRows(prev, rate));
        if (isSelected('ギフト'))
          setGiftProductsData((prev) => applyRateToRows(prev, rate));
        // 拡売費は別表（拡売費計画）のため本表では対象外
        // セル編集を通らない一括更新のため rowData を再構築して新値を反映する。
        bumpGridRebuild();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 意図的に依存を限定（列定義/ヘルパーの安定化・再実行抑止のため）
      []
    );

    // 手入力可能セル：白（編集可 / gridStyles準拠）。編集後は黄色＋オレンジ枠で強調。
    const yellowCellStyle = (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return undefined;
      const base = editableBg(true, { cursor: 'pointer' });
      return isCellChanged(params) ? { ...base, ...changedCellStyle() } : base;
    };

    // 自動表示・参照セル：灰（編集不可 / gridStyles準拠）
    const whiteCellStyle = (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return undefined;
      return editableBg(false);
    };

    // 一次店/三次店 のサンプル（モック行に値が無い場合のフォールバック表示用）

    // 行インデックスから決定的にサンプル店舗を割り当てる
    const sampleStore = (node: any) => {
      const idx =
        typeof node?.rowIndex === 'number' && node.rowIndex >= 0
          ? node.rowIndex
          : 0;
      return SAMPLE_STORES[idx % SAMPLE_STORES.length];
    };

    // 一次店/三次店 セルの値取得（実データ優先・無ければサンプル）
    const storeValueGetter = (key: 'tier1' | 'tier3') => (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return '';
      return params.data?.[key] || sampleStore(params.node)[key];
    };

    // 一次店コード/三次店コード セルの値取得。表示中の店舗名から共通マスタのコードを引く
    // （基本情報エリアの「コード:名称」表示と同じ storeTierMockData を参照）。
    const storeCodeValueGetter = (key: 'tier1' | 'tier3') => (params: any) => {
      const name = storeValueGetter(key)(params);
      if (!name) return '';
      return key === 'tier1' ? firstStoreCode(name) : thirdStoreCode(name);
    };

    // 行ID由来の決定的シード（並び替え・絞り込みでも安定する擬似ランダム種）。
    const rowSeed = (params: any) => {
      const id = params.data?.id;
      if (typeof id === 'string') {
        let h = 0;
        for (let i = 0; i < id.length; i += 1)
          h = (h * 31 + id.charCodeAt(i)) | 0;
        return Math.abs(h);
      }
      const idx = params.node?.rowIndex;
      return typeof idx === 'number' && idx >= 0 ? idx : 0;
    };

    // 終売区分のダミー値（決定的擬似ランダムなYYYY/MM）。一部行はデータなし（ー表示）。
    const endSaleDummy = (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return '';
      if (params.data?.endSale) return params.data.endSale;
      const s = rowSeed(params);
      if (s % 7 === 0) return ''; // 一部はデータなし（ー）
      return `${2025 + (s % 3)}/${String((s % 12) + 1).padStart(2, '0')}`;
    };

    // EDI反映は withRowId で固定値（data.ediPrice）を設定済み。その固定値を返す。
    const ediDummy = (params: any) => {
      if (params.data?._isHeader || params.node?.rowPinned) return '';
      return params.data?.ediPrice ?? '';
    };

    // NET・納価（計画／EDI反映／前年実績）は単価のため合計行では集計せず「-」を表示する（課題1758）。
    const priceFormatterExceptTotal = (params: any) =>
      params.node?.rowPinned
        ? GRID_EMPTY_TEXT
        : planAmountFormatter(PLAN_DETAIL_DIGITS.price)(params);

    // 入数・売価も合計行では集計せず「-」を表示する（課題1758）。
    const countFormatterExceptTotal = (params: any) =>
      params.node?.rowPinned ? GRID_EMPTY_TEXT : planCountFormatter(params);
    const amountFormatterExceptTotal = (params: any) =>
      params.node?.rowPinned
        ? GRID_EMPTY_TEXT
        : planAmountFormatter(PLAN_DETAIL_DIGITS.amount)(params);

    // 納価-計画 と EDI反映 の差異が±1.00以上か（強調表示・マッチング起動の共通判定）。
    const isEdiDiff = (params: any): boolean => {
      if (params.data?._isHeader || params.node?.rowPinned) return false;
      const plan = parseNumber(params.data?.planPrice);
      const ediStr = ediDummy(params);
      return (
        ediStr !== '' && plan > 0 && Math.abs(plan - parseNumber(ediStr)) >= 1.0
      );
    };

    // 納価-計画セルのスタイル：EDI反映との差異が±1.00以上なら赤字・太字で強調。
    // 強調しない場合は元のスタイル（baseStyleFn）をそのまま返す。
    const withEdiDiffHighlight =
      (baseStyleFn: (p: any) => any) => (params: any) => {
        const base = baseStyleFn(params) || {};
        if (isEdiDiff(params)) {
          return { ...base, color: GRID_COLORS.overText, fontWeight: 'bold' };
        }
        return base;
      };

    // 商品区分ごとに背景色を切り替えるファクトリ
    const makeCellStyle =
      (
        rules: Record<string, 'yellow' | 'white' | 'gray'>,
        defaultStyle: 'yellow' | 'white' | 'gray' = 'white'
      ) =>
      (params: any) => {
        if (params.data?._isHeader || params.node?.rowPinned) return undefined;
        const cat: string = params.data?.productCategory ?? '';
        const style = rules[cat] ?? defaultStyle;
        // yellow=編集可（白）／gray・white=編集不可（灰）。gridStyles準拠
        if (style === 'yellow') {
          const base = editableBg(true, { cursor: 'pointer' });
          return isCellChanged(params)
            ? { ...base, ...changedCellStyle() }
            : base;
        }
        return editableBg(false);
      };

    // NET・値入率・社外売上高・売上原価の算出は recalcFixedMargin（モジュールスコープ）を参照。

    // 列フィルタを通過した行のID（フィルタ無しは null）。合計行を表示中の行だけで計算し直すために使う
    // （画面設計標準 4.4 ③）。公式の onFilterChanged／forEachNodeAfterFilter で取得する。
    const [filteredRowIds, setFilteredRowIds] = useState<Set<string> | null>(
      null
    );
    const handleFilterChanged = useCallback((e: FilterChangedEvent) => {
      if (!e.api.isAnyFilterPresent()) {
        setFilteredRowIds(null);
        return;
      }
      const ids = new Set<string>();
      e.api.forEachNodeAfterFilter((node) => {
        if (node.id) ids.add(node.id);
      });
      setFilteredRowIds(ids);
    }, []);

    const totals = useMemo(() => {
      // 合計行は表示中の商品区分タブの明細だけを集計する
      // （「全て」は全区分。rowData のタブ絞り込みと同じ条件）。
      // 列フィルタ中は、フィルタを通過した行だけを集計する（行IDは getRowId と同じ組み立て）。
      const targetRows = allData.filter(
        (row) =>
          isRowInActiveTab(row) &&
          !row._isHeader &&
          (!filteredRowIds ||
            filteredRowIds.has(
              row.id ?? `${row.section}-${row.metaBrand}-${row.summaryProduct}`
            ))
      );

      // ギフトは上旬/中旬/下旬の3行1セット。販売期間・計画(函数)以外はセル結合されて
      // 3行が1セル＝1つの値の表示になるため、セット代表行だけを集計して三重計上を防ぐ。
      const countedGiftSets = new Set<string>();
      const mergedRows = targetRows.filter((row) => {
        if (!row.giftSetId) return true;
        if (countedGiftSets.has(row.giftSetId)) return false;
        countedGiftSets.add(row.giftSetId);
        return true;
      });

      const sumOf = (
        rows: ProductData[],
        pick: (row: ProductData) => unknown
      ): number => rows.reduce((sum, row) => sum + parseNumber(pick(row)), 0);
      // 函数は整数のみのため、合計も四捨五入して整数にする。
      const countText = (value: number): string =>
        value.toLocaleString('ja-JP', { maximumFractionDigits: 0 });

      // 率は分子・分母を合算してから除算する（課題1758・utils/sales-plan/plan-detail/planDetailTotalRates）。
      // 金額列（社外売上高・値入額）と同じくギフトはセット代表行だけを対象にする。
      const rates = planDetailTotalRatesOf(
        mergedRows,
        'marginRateFixed',
        costUnitPriceOf
      );
      // 分母が0のときは空値（率の列の valueFormatter が「-」を表示する）。
      const rateText = (value: number): string =>
        Number.isFinite(value) ? String(value) : '';

      return {
        section: '合計',
        metaBrand: '合計',
        summaryProduct: '',
        wholesaleMesh: '',
        productCategory: '',
        endSale: '',
        promotion: '',
        // 入数・売価は行ごとの単位・単価のため合計しない（空欄表示）。
        quantity: '',
        // 計画(函数)はギフトも行ごとに値が異なる（セル結合対象外）ため全行を集計する。
        plan: countText(sumOf(targetRows, (row) => row.plan)),
        estimate: countText(
          mergedRows.reduce(
            (sum, row) =>
              sum +
              currentMonthEstimate(
                parseNumber(row.actual),
                row.summaryProduct || row.wholesaleMesh
              ),
            0
          )
        ),
        actual: countText(sumOf(mergedRows, (row) => row.actual)),
        prevYear: countText(sumOf(mergedRows, (row) => row.prevYear)),
        // 金額列は列の valueFormatter（planAmountFormatter）が桁を整えるため、
        // ここでは素の数値文字列で渡す。
        // NET・納価(計画/EDI反映/前年実績) は単価のため合計しない（空欄表示）。
        net: '',
        planPrice: '',
        ediPrice: '',
        prevYearPrice: '',
        price: '',
        // 値入額は金額のため明細を合計する（課題1757）。
        markupAmount: String(sumOf(mergedRows, (row) => row.markupAmount)),
        externalSales: String(sumOf(mergedRows, (row) => row.externalSales)),
        delivery: String(sumOf(mergedRows, (row) => row.delivery)),
        // ％表示の列は合計せず、分子・分母の合算から率を求めて表示する（課題1758）。
        ratio: rateText(rates.ratio),
        margin: rateText(rates.margin),
        unitRate: '',
        discount: rateText(rates.discount),
        volumeAddRate: rateText(rates.volumeAddRate),
        profit: rateText(rates.profit),
        exp1PlannedAmount: '',
        exp1PostingMonth: '',
        exp1Delivery: '',
        exp1ManagementClass: '',
        exp1ManagementCode: '',
        exp1Description: '',
        exp2PlannedAmount: '',
        exp2PostingMonth: '',
        exp2Delivery: '',
        exp2ManagementClass: '',
        exp2ManagementCode: '',
        exp2Description: '',
        expTarget: false,
        _isHeader: false,
      };
      // isRowInActiveTab は activeTab・heldRowKeys から決まるため、それらを依存に置く。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allData, activeTab, heldRowKeys, filteredRowIds]);

    // 列定義

    // コード値・区分値の列（名称列から値を引く・既定は非表示）
    const codeColumns = useMemo(
      () => planDetailCodeColumns(whiteCellStyle),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 列定義と同じく初回の参照に固定する
      []
    );

    const columnDefs: ColDef[] = useMemo(
      () => [
        {
          headerName: 'メタブランド',
          field: 'metaBrand',
          width: 112,
          lockPinned: true,
          cellClass: 'ag-cell-left-pinned',
          cellStyle: (params: any) => ({
            ...(whiteCellStyle(params) || {}),
            ...copySourceLeftBorder(params.data?._copySource),
          }),
          filter: true,
          // 合計行は先頭の列（メタブランド・容器容量G・サマリ商品名）を結合して「合計」表示
          colSpan: (params: any) => (params.node?.rowPinned ? 3 : 1),
          headerTooltip:
            'メタブランド[自動表示]サマリ商品に紐づくメタブランドを取得表示',
        },
        {
          headerName: '容器容量G',
          field: 'containerCapacityG',
          width: 112,
          lockPinned: true,
          cellClass: 'ag-cell-left-pinned',
          cellStyle: whiteCellStyle,
          filter: true,
          headerTooltip:
            '容器容量G[自動表示]サマリ商品に紐づく容器容量Gを取得表示',
        },
        {
          // 定番商品=グレー（一般卸メッシュを使用）、新商品/特殊/ギフト=黄（セレクトボックス）
          headerName: 'サマリ商品',
          field: 'summaryProduct',
          width: 264,
          lockPinned: true,
          cellClass: 'ag-cell-left-pinned',
          // サマリ商品名：商品区分によらず全行を活性（編集可・黄）
          cellStyle: yellowCellStyle,
          editable: (params) =>
            !params.data?._isHeader && !params.node?.rowPinned,
          cellEditor: SingleComboboxCellEditor,
          cellEditorParams: {
            // 明細追加フォームと同一の共通マスタ（サマリ商品名）から選択肢を生成
            comboOptions: summaryProductComboOptions(SUMMARY_PRODUCT_VALUES),
            placeholder: 'サマリ商品名を選択',
          },
          cellEditorPopup: true,
          filter: true,
          headerTooltip:
            'サマリ商品[自動表示]前年同月実績のサマリ商品を取得表示',
          // サマリ商品名選択時、共通マスタから
          // メタブランド／容器容量G／入数／当月実績／前年実績を自動補完する
          // （明細追加と同一挙動。実績系はサマリ商品に紐づく前年同月実績値）。
          // 当月着地見込は算出値のため補完対象外（従来どおり計算式で算出）。
          // サマリ商品名・入数は社外売上高・売上原価の算出元でもあるため
          // recalcFixedMargin で追従させる。
          // 連動セルは共通フックで反映し、Ctrl+Z 1回で主セルごと戻る（→ 02 §7.3）。
          onCellValueChanged: makeHandler('summaryProduct', {
            depFields: [...SUMMARY_MASTER_FIELDS, ...FIXED_MARGIN_CALC_FIELDS],
            deriveDeps: (value, row) => {
              const master = SUMMARY_PRODUCT_BY_VALUE.get(value);
              return recalcFixedMargin({
                ...row,
                ...(master
                  ? {
                      metaBrand: master.metaBrand,
                      containerCapacityG: master.containerCapacityG,
                      wholesaleMesh: master.wholesaleMesh,
                      quantity: master.quantity,
                      actual: master.currentActual,
                      prevYear: master.prevYearActual,
                    }
                  : {}),
              });
            },
            syncState: syncRowBySection,
            rowIdOf: linkedRowKeyOf(['plan', 'planPrice', 'price', 'margin']),
          }),
        },
        // コード値・区分値の列（PJルール：名称と別列で保持。既定は非表示で列メニューから表示できる）
        codeColumns.metaBrandCode,
        codeColumns.containerCapacityCode,
        codeColumns.summaryProductCode,
        {
          // 終売区分：商品区分によらず全行を非活性（グレー）。
          // 中身はランダムなYYYY/MM（一部はデータなし＝ー表示）。
          headerName: '終売区分',
          field: 'endSale',
          ...GRID_MONTH_TEXT_FILTER,
          width: 88,
          cellClass: 'cell-left',
          cellStyle: whiteCellStyle,
          editable: false,
          valueGetter: (params: any) =>
            params.node?.rowPinned ? '' : endSaleDummy(params),
          // 合計行はスクロール列（終売区分～販売期間）を結合（表示は空欄）
          colSpan: (params: any) => (params.node?.rowPinned ? 4 : 1),
          valueFormatter: (params: any) =>
            params.node?.rowPinned ? '' : formatEmptyAsDash(params),
          // 終売区分はカレンダー（年月）入力。グリッドは MonthYearCellEditor を popup 表示する
          cellEditor: MonthYearCellEditor,
          cellEditorPopup: true,
          headerTooltip:
            '終売区分[自動表示]サマリ商品に紐づく終売予定年月（YYYY/MM）を取得表示',
          onCellValueChanged: (params) => {
            const updatedData = {
              ...params.data,
              endSale: params.newValue,
            };
            if (params.data.section === 'ギフト') {
              params.context.updateGiftProduct(updatedData);
            }
          },
        },
        codeColumns.productCategoryCode,
        {
          headerName: '商品区分',
          field: 'productCategory',
          width: 88,
          cellClass: 'cell-left',
          // 商品区分：全区分を活性（編集可＝白／変更後は黄）。ギフトは3行1セットの先頭セルで結合表示する。
          cellStyle: yellowCellStyle,
          editable: (params: any) =>
            !params.data?._isHeader && !params.node?.rowPinned,
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
          // 販促区分：特殊商品・ギフトは区分名で固定のため非活性（グレー・編集不可）、他区分は活性（黄）。
          headerName: '販促区分',
          field: 'promotion',
          width: 144,
          cellClass: 'cell-left',
          cellStyle: makeCellStyle(
            { 特殊商品: 'gray', ギフト: 'gray' },
            'yellow'
          ),
          editable: (params: any) =>
            !params.data?._isHeader &&
            !params.node?.rowPinned &&
            params.data?.productCategory !== '特殊商品' &&
            params.data?.productCategory !== 'ギフト',
          cellEditor: SingleComboboxCellEditor,
          cellEditorParams: (params: any) => {
            const cat = params.data?.productCategory ?? '';
            return {
              comboOptions: promotionComboOptions(
                cat === '特殊商品' ? ['特殊商品'] : getPromotionLabels(cat)
              ),
              placeholder: '販促区分を選択',
            };
          },
          // 特殊商品は選択肢データが無いため「特殊商品」を表示（それ以外は入力値）
          valueFormatter: (params: any) =>
            params.data?.productCategory === '特殊商品'
              ? '特殊商品'
              : (params.value ?? ''),
          cellEditorPopup: true,
          headerTooltip:
            '販促区分[自動表示]サマリ商品に紐づく販促区分を取得表示',
          onCellValueChanged: (params) => {
            const updatedData = {
              ...params.data,
              promotion: params.newValue,
            };
            if (params.data.section === 'ギフト') {
              params.context.updateGiftProduct(updatedData);
            }
          },
        },
        {
          // ギフトは上旬/中旬/下旬の3行1セット。販売期間は全区分で非活性（グレー・自動表示）。
          // セル結合対象外（行ごとに表示）。
          headerName: '販売期間',
          field: 'period',
          width: 72,
          cellClass: 'cell-left',
          cellStyle: whiteCellStyle,
          rowSpan: () => 1,
          headerTooltip:
            '販売期間[自動表示]ギフトは上旬/中旬/下旬の3行1セットで表示',
        },
        {
          headerName: '入数',
          headerTooltip: '入数[自動表示]サマリ商品に紐づく入数を取得表示',
          field: 'quantity',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 68,
          cellClass: 'cell-right',
          cellStyle: whiteCellStyle,
          // 入数＝整数（3桁区切り）。合計行は空欄。
          valueFormatter: countFormatterExceptTotal,
        },
        {
          headerName: '函数',
          children: [
            {
              // 全区分=黄（手入力）。ギフトも行ごとに計画(箱数)を入力するためセル結合対象外。
              headerName: '計画',
              headerTooltip:
                '函数-計画[入力値/自動表示]前年同月実績値を取得表示',
              field: 'plan',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 80,
              cellClass: 'cell-right',
              cellStyle: yellowCellStyle,
              rowSpan: () => 1,
              editable: (params) =>
                !params.data._isHeader && !params.node.rowPinned,
              // 函数-計画＝整数（3桁区切り）。函数反映・計画コピーは素の数値を書き込むため
              // 表示側で桁区切りを付ける。
              valueFormatter: planCountFormatter,
              // 整数のみ入力可（小数は入力させない）。
              // cellDataType の自動推論は valueParser を数値型のものへ上書きし、
              // 保持値が number になって集計の文字列処理が壊れるため false で無効化する。
              cellEditor: 'agNumberCellEditor',
              cellEditorParams: { precision: 0 },
              cellDataType: false,
              valueParser: planNumberParser(0),
              // 函数(計画) は社外売上高・売上原価の算出元でもあるため
              // recalcFixedMargin で追従させる（連動セルは共通フック → 02 §7.3）。
              onCellValueChanged: makeHandler('plan', {
                depFields: FIXED_MARGIN_CALC_FIELDS,
                deriveDeps: (_value, row) => recalcFixedMargin(row),
                syncState: syncRowBySection,
                rowIdOf: linkedRowKeyOf([
                  'planPrice',
                  'price',
                  'margin',
                  'quantity',
                  'summaryProduct',
                  'metaBrand',
                ]),
              }),
            },
            {
              // 新商品=グレー（非活性）、その他=白（自動表示）
              headerName: '当月着地見込',
              headerTooltip:
                '函数-当月着地見込[算出]当月実績÷当月実績反映日数×当月日数',
              field: 'estimate',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 124,
              cellClass: 'cell-right',
              cellStyle: makeCellStyle({ 新商品: 'gray' }, 'white'),
              // 当月着地見込＝当月実績÷当月実績反映日数×当月日数（算出値）。
              // 合計行（ピン留め）は集計済みの値をそのまま表示する。
              valueGetter: (params) => {
                if (params.node?.rowPinned) return params.data?.estimate ?? '';
                if (params.data?._isHeader) return '';
                const v = currentMonthEstimate(
                  parseFormulaNumber(params.data?.actual) || 0,
                  params.data?.summaryProduct || params.data?.wholesaleMesh
                );
                return v ? String(v) : '';
              },
              // 算出値のため素の数値が入る。表示側で3桁区切りを付ける。
              valueFormatter: planCountFormatter,
            },
            {
              headerName: '当月実績',
              headerTooltip: '函数-当月実績[自動表示]同年同月実績値を取得表示',
              field: 'actual',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 92,
              cellClass: 'cell-right',
              cellStyle: whiteCellStyle,
              // 函数-当月実績＝整数（3桁区切り）
              valueFormatter: planCountFormatter,
            },
            {
              // 新商品=グレー（非活性）、その他=白（自動表示）
              headerName: '前年実績',
              headerTooltip: '函数-前年実績[自動表示]前年同月実績値を取得表示',
              field: 'prevYear',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 92,
              cellClass: 'cell-right',
              cellStyle: makeCellStyle({ 新商品: 'gray' }, 'white'),
              // 函数-前年実績＝整数（3桁区切り）
              valueFormatter: planCountFormatter,
            },
            {
              // 新商品/ギフト=グレー（非活性）、その他=白（計算項目）
              headerName: '計画/前年実績比',
              headerTooltip: '函数-計画/前年実績比[算出]計画/前年実績*100%',
              field: 'ratio',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 140,
              cellClass: 'cell-right',
              // 計画/前年実績比＝小数第1位（％）
              valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.ratio),
              cellStyle: makeCellStyle(
                { 新商品: 'gray', ギフト: 'gray' },
                'white'
              ),
            },
          ],
        },
        {
          // マージン率固定：NET=納価-納価×マージン率（算出表示・全区分で非活性）
          headerName: 'NET',
          headerTooltip:
            'NET[条件分岐]固定マージン率：[算出]納価-納価*マージン率、NET入力：[入力値]前年同月実績値を取得表示',
          field: 'net',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 84,
          cellClass: 'cell-right',
          cellStyle: whiteCellStyle,
          editable: false,
          // NET＝小数第2位。合計行は空欄。
          valueFormatter: priceFormatterExceptTotal,
        },
        {
          headerName: '納価',
          children: [
            {
              // マージン率固定：納価=手入力（全区分・前年同月実績を初期表示）
              headerName: '計画',
              headerTooltip:
                '納価-計画[入力値]固定マージン率：前年同月実績を初期表示し手入力',
              field: 'planPrice',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 80,
              cellClass: 'cell-right',
              // EDI反映との差異が±1.00以上なら赤字・太字で強調
              cellStyle: withEdiDiffHighlight(yellowCellStyle),
              editable: (params) =>
                !params.data._isHeader && !params.node.rowPinned,
              cellEditor: 'agTextCellEditor',
              // 納価-計画＝小数第2位（入力値も同じ桁へ丸めて保持する）。合計行は空欄。
              valueFormatter: priceFormatterExceptTotal,
              valueParser: planNumberParser(PLAN_DETAIL_DIGITS.price),
              // 納価(計画) は NET・値入率等の算出元（連動セルは共通フック → 02 §7.3）。
              onCellValueChanged: makeHandler('planPrice', {
                depFields: FIXED_MARGIN_CALC_FIELDS,
                deriveDeps: (_value, row) => recalcFixedMargin(row),
                syncState: syncRowBySection,
                rowIdOf: linkedRowKeyOf([
                  'plan',
                  'price',
                  'margin',
                  'quantity',
                  'summaryProduct',
                  'metaBrand',
                ]),
              }),
            },
            {
              headerName: 'EDI反映',
              headerTooltip: '納価-EDI反映[自動表示]EDIの納価を取得表示',
              field: 'ediPrice',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 80,
              cellClass: 'cell-right',
              // 自動表示の参照セル（赤字・太字の差異強調はしない）
              cellStyle: whiteCellStyle,
              // 空欄行が多いため、擬似ランダムなEDI納価で補完しー表示を減らす
              // （合計行は単価のため集計せず空欄。ediDummy 側で '' を返す）。
              valueGetter: (params: any) => ediDummy(params),
              // 納価-EDI反映＝小数第2位。合計行は空欄。
              valueFormatter: priceFormatterExceptTotal,
            },
            {
              // 新商品/特殊商品/定番商品=グレー（非活性）、その他=白（自動表示）
              headerName: '前年実績',
              headerTooltip: '納価-前年実績[自動表示]前年同月実績値を取得表示',
              field: 'prevYearPrice',
              ...GRID_NUMBER_TEXT_FILTER,
              width: 88,
              cellClass: 'cell-right',
              // 納価-前年実績＝小数第2位。合計行は空欄。
              valueFormatter: priceFormatterExceptTotal,
              cellStyle: makeCellStyle(
                {
                  新商品: 'gray',
                  特殊商品: 'gray',
                  定番商品: 'gray',
                },
                'white'
              ),
            },
          ],
        },
        {
          // マージン率固定・NET入力：全区分で手入力可（黄）
          headerName: '売価',
          headerTooltip:
            '売価[入力値/自動表示]前年同月実績値を取得表示（手入力可）',
          field: 'price',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 80,
          cellClass: 'cell-right',
          cellStyle: yellowCellStyle,
          editable: (params) =>
            !params.data._isHeader && !params.node.rowPinned,
          // 売価＝整数（入力時点で小数を入力させず、保持値も整数へ丸める）。
          // cellDataType の自動推論は valueParser を上書きするため false で無効化する。
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: { precision: 0 },
          cellDataType: false,
          valueFormatter: amountFormatterExceptTotal,
          valueParser: planNumberParser(PLAN_DETAIL_DIGITS.amount),
          // 売価は値入率・値入額等の算出元（連動セルは共通フック → 02 §7.3）。
          onCellValueChanged: makeHandler('price', {
            depFields: FIXED_MARGIN_CALC_FIELDS,
            deriveDeps: (_value, row) => recalcFixedMargin(row),
            syncState: syncRowBySection,
            rowIdOf: linkedRowKeyOf([
              'plan',
              'planPrice',
              'margin',
              'quantity',
              'summaryProduct',
              'metaBrand',
            ]),
          }),
        },
        {
          // マージン率固定：固定マージン率設定値を初期表示し、商品区分によらず手入力可（黄）。
          // 入力しても他項目は再計算しない（納価・売価を編集した時点で、本値を用いて
          // NET・値入率が recalcFixedMargin により再計算される）。
          headerName: 'マージン率',
          headerTooltip:
            'マージン率[条件分岐/入力値]手入力しない場合は、固定マージン率：[自動表示]固定マージン率設定値を取得表示、NET入力：[算出](納価-NET)/納価*100%。商品区分によらず手入力での上書きも可',
          field: 'margin',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 88,
          cellClass: 'cell-right',
          cellStyle: yellowCellStyle,
          editable: (params) =>
            !params.data._isHeader && !params.node.rowPinned,
          cellEditor: 'agTextCellEditor',
          // マージン率＝小数第2位（％）
          valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.marginRate),
          valueParser: planNumberParser(PLAN_DETAIL_DIGITS.marginRate),
          // 手入力で上書きしたセル（変更済み＝黄＋橙枠）は自動表示値ではないため、
          // その旨をツールチップで示す（計画詳細(NET固定)のマージン率と同じ扱い）。
          // 未変更のセルは従来どおり共通の tooltipValueGetter に委ねる。
          // 合計行は納価が未入力の行を含めずに算出するため、その旨を表示する（課題1758・1815）。
          tooltipValueGetter: (params: any) =>
            params.node?.rowPinned
              ? NO_DELIVERY_PRICE_NOTE
              : isCellChanged(params)
                ? `手入力値（固定マージン率設定値の自動表示を上書き）\n= ${planRateFormatter(
                    PLAN_DETAIL_DIGITS.marginRate
                  )(params)}`
                : formulaHL.tooltipValueGetter(params),
          onCellValueChanged: (params) => {
            // 連動再計算はせず、入力値をそのまま行データへ保持する。
            const updatedData = { ...params.data, margin: params.newValue };
            if (params.data.section === '定番商品') {
              params.context.updateRegularProduct(updatedData);
            } else if (params.data.section === '新商品') {
              params.context.updateNewProduct(updatedData);
            } else if (params.data.section === '特売') {
              params.context.updatePromotionProduct(updatedData);
            } else if (params.data.section === 'ギフト') {
              params.context.updateGiftProduct(updatedData);
            }
          },
        },
        {
          // 値入額=(売価-納価)×入数×函数(計画)（算出・全区分。課題1757）。合計行は明細の合計。
          headerName: '値入額',
          headerTooltip: '値入額[算出](売価-納価)*入数*函数(計画)',
          field: 'markupAmount',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 88,
          cellClass: 'cell-right',
          cellStyle: whiteCellStyle,
          editable: false,
          // 値入額＝整数
          valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
        },
        {
          // マージン率固定：値入率=(売価-納価)/売価*100%（算出・全区分）
          headerName: '値入率',
          headerTooltip: '値入率[算出](売価-納価)/売価*100%',
          field: 'discount',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 80,
          cellClass: 'cell-right',
          cellStyle: whiteCellStyle,
          // 値入率＝小数第1位（％）
          valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.rate),
        },
        {
          headerName: '量経追加口率',
          headerTooltip: '量経追加口率[算出]量経追加口/社外売上高*100%',
          field: 'volumeAddRate',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 104,
          cellClass: 'cell-right',
          cellStyle: whiteCellStyle,
          editable: false,
          // 量経追加口率＝小数第1位（％）
          valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.rate),
        },
        {
          headerName: '社外売上高',
          headerTooltip: '社外売上高[算出]社外売単価×入数×函数(計画)',
          field: 'externalSales',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 88,
          cellClass: 'cell-right',
          cellStyle: whiteCellStyle,
          editable: false,
          // 社外売上高＝整数
          valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
        },
        {
          headerName: '売上原価',
          headerTooltip: '売上原価[算出]売上原価単価×入数×函数(計画)',
          field: 'delivery',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 88,
          cellClass: 'cell-right',
          cellStyle: whiteCellStyle,
          editable: false,
          // 売上原価＝整数
          valueFormatter: planAmountFormatter(PLAN_DETAIL_DIGITS.amount),
        },
        {
          headerName: '売買差益率',
          headerTooltip: '売買差益率[算出]売買差益/売上高*100%',
          field: 'profit',
          ...GRID_NUMBER_TEXT_FILTER,
          width: 104,
          cellClass: 'cell-right',
          cellStyle: whiteCellStyle,
          // 売買差益率＝小数第1位（％）
          valueFormatter: planRateFormatter(PLAN_DETAIL_DIGITS.rate),
        },
        // 一次店/三次店 列（常時表示。右端＝Actions列の直前）。
        // コード列は名称列の直前に置く（支払先コード＋支払先などの既存列と同じ並び）。
        {
          headerName: '一次店コード',
          field: 'tier1Code',
          width: 104,
          cellClass: 'cell-left',
          cellStyle: whiteCellStyle,
          editable: false,
          valueGetter: storeCodeValueGetter('tier1'),
        },
        {
          headerName: '一次店',
          field: 'tier1',
          width: 160,
          cellClass: 'cell-left',
          cellStyle: whiteCellStyle,
          editable: false,
          valueGetter: storeValueGetter('tier1'),
        },
        {
          headerName: '三次店コード',
          field: 'tier3Code',
          width: 104,
          cellClass: 'cell-left',
          cellStyle: whiteCellStyle,
          editable: false,
          valueGetter: storeCodeValueGetter('tier3'),
        },
        {
          headerName: '三次店',
          field: 'tier3',
          width: 160,
          cellClass: 'cell-left',
          cellStyle: whiteCellStyle,
          editable: false,
          valueGetter: storeValueGetter('tier3'),
        },
        {
          headerName: '',
          colId: 'actions',
          width: 80,
          pinned: 'right',
          lockPinned: true,
          cellClass: 'cell-center',
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

            // ギフトは3行1セット。編集・コピー・削除はセット単位で行う。
            // 右固定列は rowSpan が効かないため、セット先頭行(上旬)にのみアイコンを描画し、
            // 内部の横罫線を消して1セットに結合されたように見せる。
            const isGift = params.data.section === 'ギフト';
            if (isGift && !params.data._giftFirst) return null;

            const handleDelete = () => {
              params.context.onDeleteRow(params.data);
            };

            const handleCopyForPane = () => {
              // ギフトも他区分と同様にコピーする（セット単位で3行まとめて複製する）
              params.context.onCopyForPane(params.data);
            };

            // 定番商品も他区分と同様にコピー・削除できる（商品区分による制限は設けない）。
            // 削除のみ、前年実績（函数・納価のいずれか）に値がある行は不可とする。
            const deleteDisabled = hasPriorYearActual(
              params.data.prevYear,
              params.data.prevYearPrice
            );
            const deleteTitle = deleteDisabled
              ? '前年実績がある行は削除できません'
              : '削除';

            return (
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={handleCopyForPane}
                  className="p-1 rounded transition-colors text-green-600 hover:text-green-800 hover:bg-green-50 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  aria-label={`${params.data.summaryProduct}をコピー`}
                  title="コピー"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={deleteDisabled ? undefined : handleDelete}
                  disabled={deleteDisabled}
                  className={`p-1 rounded transition-colors ${
                    deleteDisabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-red-600 hover:text-red-800 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:outline-none'
                  }`}
                  aria-label={`${params.data.summaryProduct}を削除`}
                  title={deleteTitle}
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

    // グリッドへ渡す defaultColDef（menuTabs・ハイライト/ギフト結合の cellClassRules を合成）。
    // 参照を安定させ、セル値編集による再レンダーで列定義が作り直されないようにする。
    // （defaultColDef の参照が変わると AG Grid が列を再読込し Undo/Redo 履歴をクリアするため → 02 §7.1）
    const gridDefaultColDef = useMemo<ColDef>(
      () => ({
        ...defaultColDef,
        menuTabs: ['generalMenuTab', 'columnsMenuTab'],
        // 計算式セルは計算式テキスト、それ以外は従来どおりセル値を表示する
        tooltipValueGetter: formulaHL.tooltipValueGetter,
        // 算出元セルの枠線ハイライト（計算式セルのクリック中のみ付与）
        cellClassRules: {
          // 共通の既定列設定のルール（値が無いセルの「-」をグレー等）を引き継ぐ
          ...defaultColDef.cellClassRules,
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
      [defaultColDef, formulaHL.cellClassRules, formulaHL.tooltipValueGetter]
    );

    // ヘッダー tooltip 付与済みの列定義。参照を安定させ Undo 履歴クリアを防ぐ（同上）。
    const gridColumnDefs = useMemo(
      () => withHeaderTooltips(columnDefs),
      [columnDefs]
    );

    // 各行を一意に識別するためのID生成（metaBrand + summaryProduct + section で一意性を保証）。
    // 参照安定化のため useCallback 化（同上）。
    const getRowIdCallback = useCallback(
      (params: any) =>
        params.data?.id ??
        `${params.data.section}-${params.data.metaBrand}-${params.data.summaryProduct}`,
      []
    );

    // 行の構造シグネチャ（行ID＋ギフトセット＋挿入順）。セル値の編集では変化せず、
    // 行の追加/削除/コピー/並べ替えでのみ変化する。これを rowData 再生成のトリガに
    // することで「値編集では rowData 参照を変えない」＝AG Grid の Undo/Redo 履歴を維持する。
    // （rowData 参照が変わると公式仕様で履歴がクリアされる。セル値は AG Grid がノードの
    //   data を直接更新し、値の永続化は onCellValueChanged→state 同期で担保される）
    const rowStructureSignature = useMemo(
      () =>
        allData
          .map(
            (r) =>
              `${r.id ?? `${r.section}-${r.metaBrand}-${r.summaryProduct}`}#${r.giftSetId ?? ''}#${r._addedSeq ?? ''}`
          )
          .join('|'),
      [allData]
    );

    // タブフィルターを適用したデータを生成
    // （商品区分を変更して保留中の行は、別タブへ切り替えるまで表示中のタブに残す）
    const rowData = useMemo(() => {
      const byTab = allData.filter(isRowInActiveTab);
      // 明細追加・コピーで採番した行（_addedSeq あり）を、商品区分によらず
      // 合計行直下（先頭）へ新しい順で並べる。既存行は元の順序を維持（安定ソート）。
      const sorted = [...byTab].sort(
        (a, b) => (b._addedSeq ?? 0) - (a._addedSeq ?? 0)
      );
      // ギフトの3行1セットをセル結合するため、セット単位で
      // 先頭行(_giftFirst＋行数_giftSpan)・中央行(_giftMiddle：操作アイコン表示)・
      // 最終行(_giftLast：操作列の下罫線)を付与する。
      const annotated = sorted.map((row) => ({
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
      // allData は本文で参照するが依存には含めない（値編集で rowData 参照を変えず
      // Undo 履歴を維持するため、再生成は構造シグネチャ／再構築トークンの変化時のみに限定）。
      // 構造変化・非セル編集の値更新時は allData が最新のため rebuild に必要な値も最新。
      // isRowInActiveTab は activeTab・heldRowKeys から決まるため、それらを依存に置く。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowStructureSignature, activeTab, heldRowKeys, gridRebuildToken]);

    const getRowStyle = useCallback((params: RowClassParams) => {
      // ピン留めされた行（合計行）
      if (params.node.rowPinned) {
        return {
          backgroundColor: GRID_COLORS.total, // 合計行：薄青（gridStyles準拠）
          fontWeight: 'bold',
        };
      }

      // 通常の行は背景色を設定せず、CSSのホバー効果を優先
      return {};
    }, []);

    return (
      <>
        <div className={`${CARD_CLASS} overflow-hidden mb-4`}>
          {/* Table title header */}
          <div className="bg-white text-gray-900 text-left card-header-accent px-3 pt-2 pb-4">
            {/* 1段目: タイトル、コピーボタン、函数計画の初期表示 */}
            <div className="flex items-center gap-2 flex-nowrap">
              <span className={`${CARD_TITLE_CLASS} whitespace-nowrap`}>
                販売計画(詳細)
              </span>

              {/* 計画種別: 前月計画コピー / 本部計画コピー（右ペインで実行） */}
              <button
                onClick={onOpenPlanCopy}
                className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} px-3 py-1 whitespace-nowrap text-sm ml-[1.875rem]`}
                aria-label="前月計画コピー"
              >
                前月計画コピー
              </button>
              <button
                onClick={onOpenHeadquartersCopy}
                className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} px-3 py-1 whitespace-nowrap text-sm ml-2`}
                aria-label="本部計画コピー"
              >
                本部計画コピー
              </button>

              {/* Case Plan Initial Display */}
              <label
                htmlFor="case-plan-percentage"
                className={`${FORM_LABEL_CLASS} whitespace-nowrap ml-[1.875rem] mr-0 my-0`}
              >
                函数計画の初期表示：前年実績比
              </label>
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  value={casePlanPercentage}
                  onChange={(e) => {
                    // 整数3桁・小数第1位まで入力可能（数字と小数点のみ許可）
                    const value = e.target.value
                      .replace(/[^0-9.]/g, '') // 数字と小数点以外を除去
                      .replace(/(\..*)\./g, '$1') // 2つ目以降の小数点を除去
                      .replace(/^(\d{0,3})(\.\d?)?.*$/, '$1$2'); // 整数3桁・小数1桁に制限
                    setCasePlanPercentage(value);
                  }}
                  id="case-plan-percentage"
                  className={`${TEXT_INPUT_CLASS} w-15 border rounded px-2 py-1 focus:border-blue-500 text-right`}
                  maxLength={5}
                />
                <span className="text-gray-900 text-sm">%</span>
                {/* 函数反映ボタン：表示中タブの計画函数へ率を適用 */}
                <button
                  onClick={() => setIsApplyConfirmShown(true)}
                  className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} px-3 py-1 whitespace-nowrap text-sm ml-2`}
                  aria-label="函数反映"
                >
                  函数反映
                </button>
              </div>

              {/* Total Store Count */}
              <label
                htmlFor="total-store-count"
                className={`${FORM_LABEL_CLASS} whitespace-nowrap ml-[1.875rem] mr-0 my-0`}
              >
                総店舗数
              </label>
              <Input
                type="text"
                value={totalStoreCount}
                onChange={(e) => {
                  const value = e.target.value
                    .replace(/[^0-9]/g, '')
                    .slice(0, 3);
                  setTotalStoreCount(value);
                }}
                id="total-store-count"
                className={`${TEXT_INPUT_CLASS} w-15 border rounded px-2 py-1 focus:border-blue-500 text-right`}
                maxLength={3}
              />

              {/* コピー由来カラーバーの凡例（この画面は参照ペイン無し＝販売計画コピー元は出ない） */}
              <CopySourceLegend
                showReference={false}
                className="ml-[1.875rem]"
              />
            </div>

            {/* 2段目: セグメントタブ */}
            <div className="flex items-center gap-2 mt-2">
              {/* セグメントタブ */}
              <div className="flex items-center">
                <button
                  onClick={() => switchTab('all')}
                  aria-pressed={activeTab === 'all'}
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
                  aria-pressed={activeTab === '定番商品'}
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
                  aria-pressed={activeTab === '新商品'}
                  className={`px-4 py-2 border-2 border-l-0 transition-colors whitespace-nowrap text-xs ${
                    activeTab === '新商品'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                  }`}
                >
                  新商品
                </button>
                <button
                  onClick={() => switchTab('特売')}
                  aria-pressed={activeTab === '特売'}
                  className={`px-4 py-2 border-2 border-l-0 transition-colors whitespace-nowrap text-xs ${
                    activeTab === '特売'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                  }`}
                >
                  特売
                </button>
                <button
                  onClick={() => switchTab('ギフト')}
                  aria-pressed={activeTab === 'ギフト'}
                  className={`px-4 py-2 rounded-r-lg border-2 border-l-0 transition-colors whitespace-nowrap text-xs ${
                    activeTab === 'ギフト'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                  }`}
                >
                  ギフト
                </button>
              </div>

              {/* 年契基本分・センターフィ等の右ペインを開くリンク（拡売費計画タブと共通部品） */}
              <PlanRateLinks
                className="ml-[1.875rem]"
                items={[
                  {
                    label: '年契基本分',
                    value: annualContractAvg,
                    onClick: onOpenAnnualContract,
                  },
                  {
                    label: 'センターフィ',
                    value: centerFeeAvg,
                    onClick: onOpenCenterFee,
                  },
                  {
                    label: '取組強化マージン',
                    value: wholesaleIncentiveAvg,
                    onClick: onOpenWholesaleIncentive,
                  },
                  {
                    label: '固定マージン率',
                    value: fixedMarginAvg,
                    onClick: onOpenFixedMargin,
                  },
                ]}
              />

              {/* 右端配置ボタン */}
              <div className="flex items-center gap-2 ml-auto">
                {/* 年間計画ボタン（未保存時はアラート後に画面遷移） */}
                <button
                  onClick={() =>
                    handleNavigateWithGuard('annual-plan-creation')
                  }
                  disabled={isPlanNavigationDisabled}
                  className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} px-2 py-1 whitespace-nowrap text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white`}
                  aria-label="年間計画"
                >
                  年間計画
                </button>

                {/* シミュレーションボタン */}
                <button
                  onClick={() =>
                    handleNavigateWithGuard(
                      'sales-plan-simulation-margin-rate-fixed'
                    )
                  }
                  disabled={isPlanNavigationDisabled}
                  className={`${BUTTON_STYLES.outline} ${BUTTON_BASE} px-2 py-1 whitespace-nowrap text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white`}
                  aria-label="シミュレーション"
                >
                  シミュレーション
                </button>

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
            減算値 10.5rem = ヘッダ・フッタ・カード下余白の固定高。最下部までスクロールした
            状態でグリッド本体が画面高にちょうど収まる値（カード見出し・タブ・ツールバーは
            スクロールアウトしてよい方針）。 */}
          <div
            className="sales-detail-grid"
            style={{ height: 'calc(100vh - 10.5rem)', minHeight: '25rem' }}
          >
            <style>{`
                    /* （見出しの背景色・文字色は共通テーマ GRID_THEME に委ねる → 02 §7「ヘッダーの配色」・UI/UX UX-031） */
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
                       白・グレー系セルも含め、行内の全セルをブルーにする。 */
                    .sales-detail-grid .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell,
                    .sales-detail-grid .ag-row-hover:not(.ag-full-width-row):not(.ag-row-pinned) .ag-cell[style*="background-color"] {
                      background-color: var(--grid-row-hover) !important;
                    }
                    .sales-detail-grid .ag-row-pinned-top {
                      border-top: 2px solid var(--grid-pinned-row-border);
                    }
                    .sales-detail-grid .ag-row-pinned-top .ag-cell:hover {
                      background-color: var(--grid-total) !important; /* 合計行（薄青）はホバーエフェクトを維持 */
                    }
                    /* 編集中のセルを強調 */
                    .sales-detail-grid .ag-cell-inline-editing[style*="background-color: rgb(255, 255, 255)"] {
                      background-color: var(--grid-editing-bg) !important;
                      box-shadow: 0 0 0 2px var(--grid-editing-border) inset;
                    }
                  `}</style>
            <AgGridReact
              rowData={rowData}
              columnDefs={gridColumnDefs}
              // ギフトの3行1セルをセル結合（rowSpan）するために必須
              suppressRowTransform={true}
              defaultColDef={gridDefaultColDef}
              getContextMenuItems={gridFilterContextMenuItems}
              statusBar={GRID_STATUS_BAR}
              pinnedTopRowData={[totals]}
              onFilterChanged={handleFilterChanged}
              getRowStyle={getRowStyle}
              onCellMouseOver={formulaHL.onCellMouseOver}
              onCellMouseOut={formulaHL.onCellMouseOut}
              // 計算式をツールチップで見せるため、省略されていないセルでも出す（グローバルは whenTruncated）
              tooltipShowMode="standard"
              tooltipShowDelay={300}
              tooltipHideDelay={5000}
              onCellValueChanged={(params: any) => {
                // いずれかのセルが編集されたら未保存状態にする
                hasUnsavedRef.current = true;
                // 編集済みセルを記録（元値に戻したら解除）し、当該セルを再描画して
                // 黄色＋オレンジ枠（changedCellStyle）を反映する（共通フック → 02 §7.2）
                trackCellChange(params);
                params.api.refreshCells({
                  rowNodes: [params.node],
                  columns: [params.column.getColId()],
                  force: true,
                });
              }}
              getRowId={getRowIdCallback}
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
              {...GRID_BASE_PROPS}
              {...gridColumnState}
            />
          </div>
        </div>

        {/* 前月計画コピー／本部計画コピー 右ペイン
          本部計画コピー＝販売店（チェーン）選択あり、前月計画コピー＝販売店選択なし。
          その後は共通（商品区分→コピー元％→コピー実行の確認）。 */}
        <PlanCopyPane
          open={copyPaneMode !== null}
          onClose={onCloseCopyPane ?? (() => {})}
          title={
            copyPaneMode === 'headquarters'
              ? '本部計画コピー'
              : '前月計画コピー'
          }
          showStoreSelection={copyPaneMode === 'headquarters'}
          categories={CATEGORY_LABELS_MARGIN}
          onExecute={handlePlanCopyExecute}
        />

        {/* 函数反映の確認: 表内に入力中のデータがある場合にリセットされる旨を確認 */}
        <ConfirmDialog
          open={isApplyConfirmShown}
          title="函数反映の確認"
          confirmLabel="反映"
          description="入力中のデータがリセットされます。本当によろしいですか？"
          onConfirm={() => {
            setIsApplyConfirmShown(false);
            handleApplyCasePlan();
          }}
          onCancel={() => setIsApplyConfirmShown(false)}
        />

        {/* 年間計画／シミュレーション遷移の確認 */}
        <ConfirmDialog
          open={pendingNavMenuId !== null}
          title="画面移動の確認"
          confirmLabel="移動"
          description="入力中のデータが破棄されます。本当によろしいですか？"
          onConfirm={() => {
            const id = pendingNavMenuId;
            setPendingNavMenuId(null);
            if (id) onNavigate?.(id);
          }}
          onCancel={() => setPendingNavMenuId(null)}
        />
      </>
    );
  }
);
